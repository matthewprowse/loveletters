const SUPABASE_URL = "https://fcgryppvohjwouihyocn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZ3J5cHB2b2hqd291aWh5b2NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzMjA3MTYsImV4cCI6MjA2NTg5NjcxNn0.ktXtHmQFzmjrv1LRPTdmzqEUfP7lVOmzPCqeQ5JLjVM";

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const date_cache = new Map();
const format_cached = (s) => {
  if (!date_cache.has(s)) {
    date_cache.set(s, new Date(s).toLocaleDateString("en-ZA", 
      { weekday:"long", day:"numeric", month:"long", year:"numeric" }));
  }
  return date_cache.get(s);
};

let gallery_observer = null;
let image_cache = new Map();

const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const preload_image = (src) => {
  if (image_cache.has(src)) return image_cache.get(src);
  
  const img = new Image();
  const promise = new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
  
  img.src = src;
  image_cache.set(src, promise);
  return promise;
};

document.addEventListener("DOMContentLoaded", () => {
  const loc_input = document.getElementById("new-location");
  const file_pick = document.getElementById("new-files");
  const add_btn = document.getElementById("new-add-btn");
  const file_preview_list = document.getElementById("file-preview-list");
  
  if (!loc_input || !file_pick || !add_btn || !file_preview_list) return;

  let selectedFiles = new Map(); // Map to store file objects with their preview elements

  // Initialize visibility
  updateVisibility();

  // Handle file selection
  file_pick.addEventListener('change', (event) => {
    const files = Array.from(event.target.files || []);
    
    files.forEach(file => {
      if (!selectedFiles.has(file.name)) {
        addFilePreview(file);
      }
    });
    
    // Clear the input to allow selecting the same file again
    event.target.value = '';
    
    // Show/hide elements based on whether there are files
    updateVisibility();
  });

  function updateVisibility() {
    const hasFiles = selectedFiles.size > 0;
    const separator = document.querySelector('.processing-separator');
    const processingText = document.querySelector('.processing-text');
    const addBtn = document.getElementById('new-add-btn');
    const fileCount = document.getElementById('file-count');
    
    if (separator) separator.style.display = hasFiles ? 'block' : 'none';
    if (processingText) processingText.style.display = hasFiles ? 'block' : 'none';
    if (addBtn) addBtn.style.display = hasFiles ? 'block' : 'none';
    if (fileCount) {
      const count = selectedFiles.size;
      fileCount.textContent = count === 1 ? '1 File' : `${count} Files`;
    }
  }

  function addFilePreview(file) {
    const fileId = `${file.name}-${Date.now()}`;
    const fileItem = document.createElement('div');
    fileItem.className = 'file-preview-item';
    fileItem.dataset.fileId = fileId;
    
    const info = document.createElement('div');
    info.className = 'file-preview-info';
    
    const name = document.createElement('p');
    name.className = 'file-preview-name';
    name.textContent = file.name;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'chip-large file-preview-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => removeFile(fileId);
    
    info.appendChild(name);
    
    fileItem.appendChild(info);
    fileItem.appendChild(removeBtn);
    
    file_preview_list.appendChild(fileItem);
    
    selectedFiles.set(fileId, {
      file: file,
      element: fileItem,
      name: name
    });
  }

  function removeFile(fileId) {
    const fileData = selectedFiles.get(fileId);
    if (fileData) {
      fileData.element.remove();
      selectedFiles.delete(fileId);
      updateVisibility();
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function updateFileProgress(fileId, progress) {
    const fileData = selectedFiles.get(fileId);
    if (fileData && fileData.name) {
      if (progress === 0) {
        fileData.name.textContent = fileData.file.name;
      } else if (progress < 100) {
        fileData.name.textContent = `Processing: ${progress}%`;
      } else {
        fileData.name.textContent = 'Complete';
      }
    }
  }

  add_btn.onclick = async () => {
    const location_txt = loc_input.value.trim();
    const files = Array.from(selectedFiles.values()).map(f => f.file);
    
    if (!location_txt) { 
      alert("Enter Location"); 
      return; 
    }
    if (!files.length) { 
      alert("Select File(s)"); 
      return; 
    }

    // Disable the button during upload
    add_btn.disabled = true;
    add_btn.textContent = 'Uploading...';

    const today_iso = new Date().toISOString().split("T")[0];
    const { data:grp, error:grp_err } = await supa
      .from("group")
      .insert([{ date: today_iso, location: location_txt }])
      .select("id")
      .single();

    if (grp_err || !grp?.id) {
      console.error("group insert", grp_err);
      alert("Cannot Create Group");
      add_btn.disabled = false;
      add_btn.textContent = 'Add Files';
      return;
    }
    
    const group_id = grp.id;
    console.log("Group Created:", group_id);

    const delay = ms => new Promise(res => setTimeout(res, ms));
    let uploadedCount = 0;

    for (const [fileId, fileData] of selectedFiles) {
      const file = fileData.file;
      
      try {
        updateFileProgress(fileId, 10);
        
        let file_to_upload = file;
        let file_name = file.name;
        
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          console.log("Converting HEIC:", file.name);
          updateFileProgress(fileId, 20);
          try {
            const converted_file = await ConvertHeicToJpgFile(file);
            file_to_upload = converted_file;
            file_name = converted_file.name;
            console.log("HEIC Converted:", file_name);
            updateFileProgress(fileId, 30);
          } catch (conversion_err) {
            console.error("Converting HEIC Failed:", conversion_err);
            console.log("Uploading HEIC");
          }
        }

        const clean_name = file_name.replace(/\s+/g, "_");
        const key = `${group_id}-${Date.now()}-${clean_name}`;
        const content_type = file_to_upload.type;

        console.log("Uploading File:", key);
        updateFileProgress(fileId, 40);

        const { error:up_err } = await supa
          .storage
          .from("gallery")
          .upload(key, file_to_upload, { contentType: content_type, upsert: false });

        if (up_err) { 
          console.error("Upload Failed:", up_err, file_name); 
          updateFileProgress(fileId, 0);
          continue; 
        }
        console.log("File Uploaded:", key);
        updateFileProgress(fileId, 70);

        console.log("Storage Waiting Period...");
        await delay(2000);

        let public_url = null;
        for (let attempt = 0; attempt < 3 && !public_url; attempt++) {
          try {
            const { data, error:url_err } = supa
              .storage
              .from("gallery")
              .getPublicUrl(key);
            
            if (data?.publicUrl) {
              public_url = data.publicUrl;
              console.log("Public URL Generated:", public_url);
            } else {
              console.warn("Public URL Failed. Retrying...", key, url_err);
              await delay(1000);
            }
          } catch (url_err) {
            console.warn("URL Generation Failed. Retrying...", key, url_err);
            await delay(1000);
          }
        }
        
        if (!public_url) { 
          console.error("Public URL Generation Failed...", key); 
          public_url = `${SUPABASE_URL}/storage/v1/object/public/gallery/${key}`;
          console.log("Fallback URL:", public_url);
        }

        updateFileProgress(fileId, 90);

        const f_type = file_to_upload.type.startsWith("video") ? "video" : "image";
        const file_data = { 
          path: public_url, 
          type: f_type, 
          group: group_id 
        };
        
        console.log("Inserting File Record:", file_data);
        
        const { data:file_insert, error:file_err } = await supa
          .from("file")
          .insert([file_data])
          .select("id")
          .single();

        if (file_err) {
          console.error("File Insert Failed:", file_err);
          console.error("File Data Failed:", file_data);
        } else {
          console.log("File Row Created:", file_insert?.id);
          updateFileProgress(fileId, 100);
          uploadedCount++;
        }
        
      } catch (err) {
        console.error("Cannot Process File", file.name, err);
        updateFileProgress(fileId, 0);
      }
    }

    // Clear everything after upload
    loc_input.value = "";
    selectedFiles.clear();
    file_preview_list.innerHTML = "";
    
    add_btn.disabled = false;
    add_btn.textContent = 'Add Files';
    
    // Navigate to gallery page
    location.hash = 'gallery';
    FetchGalleryFiles();
  };

  InitTabs();
  FetchTodayNote();
  FetchHistoryNotes();
  FetchGalleryFiles();
  initTodayScroll();
  setupScrollToTop();
});

function InitTabs() {
  const tabs = document.querySelectorAll(".tab");
  const pages = document.querySelectorAll(".page");
  const footer = document.querySelector(".footer");
  const bar = document.querySelector(".tab-bar");
  const todayFloatingHeader = document.getElementById('today-floating-header');
  const galleryFloatingHeader = document.getElementById('gallery-floating-header');
  const historyFloatingHeader = document.getElementById('history-floating-header');

  const Show = id => {
    document.body.classList.toggle('body-padded-for-fab', id === 'gallery' || id === 'history' || id === 'today');
    
    pages.forEach(p => (p.style.display = p.id === id ? "flex" : "none"));
    tabs.forEach(t => {
      const on = t.dataset.target === id;
      t.classList.toggle("active", on);
      t.classList.toggle("inactive", !on);
    });

    if (todayFloatingHeader) todayFloatingHeader.style.display = (id === 'today') ? 'block' : 'none';
    if (galleryFloatingHeader) galleryFloatingHeader.style.display = (id === 'gallery') ? 'block' : 'none';
    if (historyFloatingHeader) historyFloatingHeader.style.display = (id === 'history') ? 'block' : 'none';

    const hide = id === "new";
    footer.style.display = hide ? "none" : "block";
    bar.style.display    = hide ? "none" : "flex";
    
    // Scroll to top when switching pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const Cur = () => (location.hash ? location.hash.slice(1)
                                    : tabs[0].dataset.target);
  Show(Cur());
  tabs.forEach(t => t.onclick = () => (location.hash = t.dataset.target));
  addEventListener("hashchange", () => Show(Cur()));
}

async function FetchTodayNote() {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supa
    .from("note")
    .select("*")
    .eq("date", today)
    .order("number", { ascending: true })
    .limit(1);

  if (error || !data?.length) { SetNote("-", "No New Notes", "", ""); return; }
  const n = data[0];
  const formattedDate = new Date(n.date).toLocaleDateString("en-ZA", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  SetNote(n.number, formattedDate, n.header, n.body);
  
  // Start countdown timer
  startCountdown();
}

function startCountdown() {
  // Target date: July 20, 2025 at 10:00 AM SAST
  const targetDate = new Date('2025-07-20T10:00:00+02:00'); // SAST is UTC+2
  
  function updateCountdown() {
    const now = new Date();
    const timeLeft = targetDate - now;
    
    if (timeLeft <= 0) {
      document.getElementById('countdown-timer').textContent = "0d 0h 0m 0s";
      return;
    }
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    const countdownText = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    document.getElementById('countdown-timer').textContent = countdownText;
  }
  
  updateCountdown();
  setInterval(updateCountdown, 1000);
}

async function FetchHistoryNotes() {
  const box = document.querySelector("#history-container");
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supa
    .from("note")
    .select("*")
    .lte("date", today)
    .order("date", { ascending: false })
    .order("number", { ascending: false });

  if (error || !data?.length) return;
  box.innerHTML = "";

  data.forEach((n, i) => {
    const noteKey = `note-${n.date}-${n.number}`;
    const headerHTML = `
        <div class="column-gap-8" ${i === 0 ? 'style="display: none;"' : ''}>
          <div class="row">
            <div class="chip-small">${n.number}</div>
            <div class="dot"></div>
                <p class="medium-secondary">${format_cached(n.date)}</p>
          </div>
            <h2>${n.header}</h2>
        </div>
    `;

    const noteHTML = `
      <div class="column-gap-16 ${i === 0 ? 'first-item-no-gap' : ''}" data-note-key="${noteKey}">
        ${headerHTML}
        <div class="note-content" data-note-content>
        <p style="white-space: pre-wrap;">${n.body}</p>
      </div>
      </div>
    `;
    box.insertAdjacentHTML("beforeend", noteHTML);

    if (i !== data.length - 1) {
      box.insertAdjacentHTML("beforeend", `
        <div class="row-center note-separator">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
      </div>
    `);
    }
  });

  // Set initial header content from the very first note
  const firstNote = box.querySelector('.column-gap-16[data-note-key]');
  if(firstNote) {
    const headerContent = document.querySelector('#history-floating-header .column-gap-8');
    const firstNoteHeader = firstNote.querySelector('.column-gap-8').innerHTML;
    headerContent.innerHTML = firstNoteHeader;
  }

  initHistoryScroll();
}

async function FetchGalleryFiles() {
  const page = document.querySelector("#gallery");
  page.innerHTML = ""; // Clear previous content

  // Fetch all files with group information
  const { data, error } = await supa
    .from("file")
    .select("id,path,type,gallery_group:group(id,date,location)")
    .order("id", { ascending: false }); // Sort files by ID (newest first)

  if (error || !data?.length) { 
    console.error("file fetch", error); 
    return; 
  }

  // Group items by date and location
  const grouped = {};
  data.forEach(f => {
    const key = `${f.gallery_group.date}||${f.gallery_group.location}`;
    (grouped[key] ||= []).push(f);
  });

  // Sort groups by date (newest to oldest)
  const groups = Object.entries(grouped).sort((a, b) => {
    const dateA = new Date(a[0].split('||')[0]);
    const dateB = new Date(b[0].split('||')[0]);
    return dateB - dateA; // Newest first
  });

  const fragment = document.createDocumentFragment();
  const lazy_blocks = [];

  // This is your original, correct function for creating image frames.
  const create_file_frame = (file_data) => {
    const frame = document.createElement("div");
    frame.className = "block";
    
    if (file_data.type === "image") {
      frame.dataset.src = `${file_data.path}?quality=70`;
      lazy_blocks.push(frame);
    } else {
      frame.innerHTML = '<div class="chip-large">View Video</div>';
    }
    
    frame.onclick = () => location.href = file_data.path;
    return frame;
  };

  // This is your original, correct function for generating the two-column layout.
  const generate_files_html = (files) => {
    const itemsHTML = files.map((file, i) =>
        `<div class="gallery-item-wrapper">
            <div class="file-frame-placeholder" data-index="${i}"></div>
        </div>`
    ).join('');
    return `<div class="gallery-grid-container">${itemsHTML}</div>`;
  };

  const batch_create_elements = () => {
    groups.forEach(([key, files], idx) => {
      const [date, loc] = key.split("||");
      const file_paths = files.map(f => `"${f.path}"`).join(",");

      const wrap = document.createElement("div");
      wrap.className = `column-gap-16 ${idx === 0 ? 'first-item-no-gap' : ''}`;
      wrap.dataset.groupKey = key;
      
      // The header for each group. It's hidden for the first group only.
      const headerHTML = `
        <div class="column-gap-8" ${idx === 0 ? 'style="display: none;"' : ''}>
        <div class="row">
          <div class="chip-small">${files[0]?.gallery_group.id ?? ""}</div>
          <div class="dot"></div>
              <p class="medium-secondary">${format_cached(date)}</p>
            </div>
            <div class="row-space-between">
                <h2>${loc}</h2>
                <div class="chip-large" style="cursor:pointer" onclick="BatchDownloadZip([${file_paths}], '${loc}')">Save All</div>
            </div>
        </div>
      `;

      wrap.innerHTML = `
        ${headerHTML}
        <div class="column-gap-16 files-container" data-files-container>
          ${generate_files_html(files)}
        </div>
      `;

      const frame_placeholders = wrap.querySelectorAll(".file-frame-placeholder");
      frame_placeholders.forEach((placeholder) => {
        const file_data = files[parseInt(placeholder.dataset.index)];
        if (file_data) {
          placeholder.replaceWith(create_file_frame(file_data));
        }
      });

      fragment.appendChild(wrap);

      if (idx !== groups.length - 1) {
        const separator = document.createElement("div");
        separator.className = "row-center";
        separator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
        fragment.appendChild(separator);
      }
    });
  };

  batch_create_elements();
  
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'content-wrapper';
  contentWrapper.appendChild(fragment);

  page.appendChild(contentWrapper);

  if (!gallery_observer) {
    gallery_observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (el.dataset.src) {
            const src = el.dataset.src;
            el.removeAttribute('data-src');
            
            preload_image(src).then(() => {
              el.style.backgroundImage = `url("${src}")`;
            }).catch(() => {
              el.style.backgroundImage = `url("${src}")`;
            });
            
            gallery_observer.unobserve(el);
          }
        }
      });
    }, { 
      rootMargin: "200px 0px",
      threshold: 0.1
    });
  }

  lazy_blocks.forEach(el => gallery_observer.observe(el));

  // Set initial header content from the very first group
  const firstGroup = page.querySelector('.column-gap-16[data-group-key]');
  if(firstGroup) {
    const headerContent = document.querySelector('#gallery-floating-header .column-gap-8');
    const firstGroupHeader = firstGroup.querySelector('.column-gap-8').innerHTML;
    headerContent.innerHTML = firstGroupHeader;
  }

  initGalleryScroll();
}

async function DownloadFile(url) {
  const file_name = url.split("/").pop().split("?")[0];
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();
    const mime_type = response.headers.get('content-type') || 'application/octet-stream';
    const file_blob = new Blob([blob], { type: mime_type });
    const blob_url = URL.createObjectURL(file_blob);
  const a = document.createElement("a");
  a.href = blob_url;
  a.download = file_name;
    a.style.display = 'none';
    document.body.appendChild(a);
  a.click();
    document.body.removeChild(a);
  URL.revokeObjectURL(blob_url);
  } catch (error) {
    console.error('Download failed:', error);
  }
}

function BatchDownload(arr) { 
  arr.forEach((url, index) => {
    setTimeout(() => DownloadFile(url), index * 300);
  }); 
}

async function BatchDownloadZip(urls, location) {
  try {
    // Import JSZip dynamically
    const JSZip = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    const zip = new JSZip.default();
    
    // Download all files and add them to zip with numbered names
    const downloadPromises = urls.map(async (url, index) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();
        
        // Get file extension from original URL
        const originalName = url.split("/").pop().split("?")[0];
        const extension = originalName.includes('.') ? originalName.split('.').pop() : 'jpg';
        
        // Add to zip with numbered filename
        const numberedName = `${index + 1}.${extension}`;
        zip.file(numberedName, blob);
        
        return { success: true, index };
      } catch (error) {
        console.error(`Failed to download file ${index + 1}:`, error);
        return { success: false, index, error };
      }
    });
    
    // Wait for all downloads to complete
    const results = await Promise.all(downloadPromises);
    const successfulDownloads = results.filter(r => r.success);
    
    if (successfulDownloads.length === 0) {
      alert('Failed to download any files');
      return;
    }
    
    // Generate zip file
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // Create download link
    const zipName = `${location.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
    const blobUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = zipName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    
    console.log(`Successfully downloaded ${successfulDownloads.length} files as ${zipName}`);
    
  } catch (error) {
    console.error('Zip creation failed:', error);
    alert('Failed to create zip file. Please try again.');
  }
}

function SetNote(n,d,h,b){
  document.getElementById("note-number").textContent = n;
  document.getElementById("note-date").textContent = d;
  document.getElementById("note-header").textContent = h;
  const note_body = document.getElementById("note-body");
  note_body.innerHTML = b.replace(/\n/g, "<br>");
}

function Format(s){
  return format_cached(s);
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function adjustPagePadding(pageId) {
    const page = document.getElementById(pageId);
    const header = document.getElementById(`${pageId}-floating-header`);
    if (header) {
        const headerHeight = header.offsetHeight;
        if (pageId === 'today') {
            page.style.paddingTop = `${headerHeight + 16}px`;
        }
    }
}

function createAdvancedScrollHandler(options) {
    let currentActiveKey = null;
    let lastScrollY = window.scrollY;

    return () => {
        const header = document.getElementById(options.headerId);
        if (!header) return;

        const headerHeight = header.offsetHeight;

        // Border visibility: appears instantly on any scroll
        header.classList.toggle('scrolled', window.scrollY > 10);

        const fab = document.getElementById('scroll-to-top');
        if (fab) fab.classList.toggle('visible', window.scrollY > 200);

        const items = document.querySelectorAll(options.itemSelector);
        if (items.length === 0) return;

        const scrollingDown = window.scrollY > lastScrollY;
        let activeItem = null;

        if (scrollingDown) {
            for (const item of items) {
                const triggerEl = item.querySelector(options.downTriggerSelector);
                if (triggerEl && triggerEl.getBoundingClientRect().bottom < headerHeight) {
                    activeItem = item;
    }
            }
        } else { // Scrolling Up
            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i];
                const triggerEl = item.querySelector(options.upTriggerSelector);
                if (triggerEl && triggerEl.getBoundingClientRect().top < headerHeight) {
                    activeItem = item;
                    break;
                }
            }
        }

        if (!activeItem) activeItem = items[0];
        
        const activeKey = activeItem.dataset[options.keyAttribute];
        if (activeKey !== currentActiveKey) {
            currentActiveKey = activeKey;
            const header_content = header.querySelector('.column-gap-8');
            const newHeaderHTML = activeItem.querySelector('.column-gap-8').innerHTML;
            if (header_content && newHeaderHTML) {
                header_content.innerHTML = newHeaderHTML;
            }
        }
        lastScrollY = window.scrollY;
    };
}

let todayScrollHandler = null;
function initTodayScroll() {
    if (todayScrollHandler) window.removeEventListener('scroll', todayScrollHandler);
    let showingNoteInfo = false;
    
    todayScrollHandler = () => {
        const header = document.getElementById('today-floating-header');
        if (!header) return;

        const noteHeader = document.getElementById('note-header');
        const noteDate = document.getElementById('note-date');
        const noteNumber = document.getElementById('note-number');
        
        if (!noteHeader || !noteDate || !noteNumber) return;

        const currentScrollY = window.scrollY;
        const noteHeaderRect = noteHeader.getBoundingClientRect();
        const headerHeight = header.offsetHeight;

        // Border visibility: appears instantly on any scroll
        header.classList.toggle('scrolled', currentScrollY > 10);

        // Show FAB when title is in the header (when we've scrolled past the h1)
        const fab = document.getElementById('scroll-to-top');
        if (fab) {
            const shouldShowFab = noteHeaderRect.top < headerHeight;
            fab.classList.toggle('visible', shouldShowFab);
        }

        // Show note info when we've scrolled past the h1 (when h1 top is above the header)
        const shouldShowNoteInfo = noteHeaderRect.top < headerHeight;

        // Only update if state actually needs to change
        if (shouldShowNoteInfo !== showingNoteInfo) {
            showingNoteInfo = shouldShowNoteInfo;
            
            const headerNumberElement = header.querySelector('#floating-note-number');
            const headerDateElement = header.querySelector('#floating-note-date');
            const headerTitleElement = header.querySelector('#countdown-timer');
            
            if (headerNumberElement && headerDateElement && headerTitleElement) {
                if (showingNoteInfo) {
                    // Show note information
                    headerNumberElement.textContent = noteNumber.textContent;
                    headerDateElement.textContent = noteDate.textContent;
                    headerTitleElement.textContent = noteHeader.textContent;
            } else {
                    // Show countdown timer
                    headerNumberElement.textContent = "0";
                    headerDateElement.textContent = "I'm Arriving Back In";
                    // The countdown timer will be updated by the startCountdown function
                }
            }
        }
    };
    window.addEventListener('scroll', todayScrollHandler, { passive: true });
    todayScrollHandler(); // Initial call
}

let historyScrollHandler = null;
function initHistoryScroll() {
    if (historyScrollHandler) window.removeEventListener('scroll', historyScrollHandler);
    historyScrollHandler = createAdvancedScrollHandler({
        headerId: 'history-floating-header',
        itemSelector: '#history-container .column-gap-16[data-note-key]',
        keyAttribute: 'noteKey',
        downTriggerSelector: 'h2',
        upTriggerSelector: '.row'
    });
    window.addEventListener('scroll', historyScrollHandler, { passive: true });
}

let galleryScrollHandler = null;
function initGalleryScroll() {
    if (galleryScrollHandler) window.removeEventListener('scroll', galleryScrollHandler);
    galleryScrollHandler = createAdvancedScrollHandler({
        headerId: 'gallery-floating-header',
        itemSelector: '#gallery .column-gap-16[data-group-key]',
        keyAttribute: 'groupKey',
        downTriggerSelector: 'h2',
        upTriggerSelector: '.row'
    });
    window.addEventListener('scroll', galleryScrollHandler, { passive: true });
      }

function setupScrollToTop() {
  const fab = document.getElementById('scroll-to-top');
  if (fab) {
    fab.onclick = scrollToTop;
  }
}

async function ConvertHeicToJpgFile(heic_file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      const img = new Image();
      
      img.onload = function() {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const jpg_file = new File([blob], heic_file.name.replace(/\.heic$/i, ".jpg"), {
              type: "image/jpeg"
            });
            resolve(jpg_file);
          } else {
            reject(new Error("Conversion Failed"));
          }
        }, "image/jpeg", 1.0);
      };
      
      img.onerror = function() {
        reject(new Error("Cannot Load HEIC Image"));
      };
      
      img.src = e.target.result;
    };
    
    reader.onerror = function() {
      reject(new Error("Cannot Read HEIC Image"));
    };
    
    reader.readAsDataURL(heic_file);
  });
}