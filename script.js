const SUPABASE_URL = "https://fcgryppvohjwouihyocn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZ3J5cHB2b2hqd291aWh5b2NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzMjA3MTYsImV4cCI6MjA2NTg5NjcxNn0.ktXtHmQFzmjrv1LRPTdmzqEUfP7lVOmzPCqeQ5JLjVM";

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const date_cache = new Map();
const FormatCached = (s) => {
  if (!date_cache.has(s)) {
    date_cache.set(s, new Date(s).toLocaleDateString("en-ZA", 
      { weekday:"long", day:"numeric", month:"long", year:"numeric" }));
  }
  return date_cache.get(s);
};

let gallery_observer = null;

const PreloadImage = (src) => {
  const img = new Image();
  const promise = new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
  
  img.src = src;
  return promise;
};

document.addEventListener("DOMContentLoaded", () => {
  const loc_input = document.getElementById("new-location");
  const file_pick = document.getElementById("new-files");
  const add_btn = document.getElementById("new-add-btn");
  const file_preview_list = document.getElementById("file-preview-list");
  
  if (!loc_input || !file_pick || !add_btn || !file_preview_list) return;

  let selected_files = new Map();

  file_pick.addEventListener('change', (event) => {
    const files = Array.from(event.target.files || []);
    
    files.forEach(file => {
      if (!selected_files.has(file.name)) {
        AddFilePreview(file);
      }
    });
    
    event.target.value = '';
    
    UpdateFileCount();
  });

  function UpdateFileCount() {
    const file_count = document.getElementById('file-count');
    if (file_count) {
      const photo_count = Array.from(selected_files.values()).filter(f => f.file.type.startsWith('image/')).length;
      const video_count = Array.from(selected_files.values()).filter(f => f.file.type.startsWith('video/')).length;
      
      let count_text = [];
      if (photo_count > 0) count_text.push(`${photo_count} Photo${photo_count > 1 ? 's' : ''}`);
      if (video_count > 0) count_text.push(`${video_count} Video${video_count > 1 ? 's' : ''}`);
      
      file_count.textContent = count_text.length > 0 ? count_text.join(', ') : '0 Files';
    }
  }

  function AddFilePreview(file) {
    const file_id = `${file.name}-${Date.now()}`;
    const file_item = document.createElement('div');
    file_item.className = 'file-preview-item';
    file_item.dataset.fileId = file_id;
    
    const thumbnail = document.createElement('div');
    thumbnail.className = 'file-preview-thumbnail';
    
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.style.width = '48px';
      img.style.height = '48px';
      img.style.borderRadius = '12px';
      img.style.objectFit = 'cover';
      
      img.onerror = () => {
        thumbnail.innerHTML = '<div style="width: 48px; height: 48px; background: rgba(197, 197, 197, 0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: Manrope; font-size: 12px; font-weight: 600; line-height: 16px; color: black;">Photo</div>';
      };
      
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = () => {
        thumbnail.innerHTML = '<div style="width: 48px; height: 48px; background: rgba(197, 197, 197, 0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: Manrope; font-size: 12px; font-weight: 600; line-height: 16px; color: black;">Photo</div>';
      };
      reader.readAsDataURL(file);
      
      thumbnail.appendChild(img);
    } else {
      thumbnail.innerHTML = '<div style="width: 48px; height: 48px; background: rgba(197, 197, 197, 0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: Manrope; font-size: 12px; font-weight: 600; line-height: 16px; color: black;">Video</div>';
    }
    
    const info = document.createElement('div');
    info.className = 'file-preview-info';
    
    const name = document.createElement('p');
    name.className = 'file-preview-name';
    name.textContent = file.name;
    
    const status_text = document.createElement('p');
    status_text.className = 'status-text';
    status_text.style.fontSize = '12px';
    status_text.style.fontWeight = '600';
    status_text.style.color = 'rgba(0, 0, 0, 0.5)';
    status_text.style.margin = '0';
    status_text.style.lineHeight = '16px';
    status_text.style.fontFamily = 'Manrope';
    status_text.textContent = 'Ready';
    
    const file_column = document.createElement('div');
    file_column.className = 'column-no-gap';
    file_column.appendChild(status_text);
    file_column.appendChild(name);
    
    const remove_btn = document.createElement('button');
    remove_btn.className = 'chip-large file-preview-remove';
    remove_btn.textContent = 'Remove';
    remove_btn.onclick = () => RemoveFile(file_id);
    
    info.appendChild(file_column);
    
    file_item.appendChild(thumbnail);
    file_item.appendChild(info);
    file_item.appendChild(remove_btn);
    
    file_preview_list.appendChild(file_item);
    
    selected_files.set(file_id, {
      file: file,
      element: file_item,
      name: name,
      status_text: status_text
    });
  }

  function RemoveFile(file_id) {
    const file_data = selected_files.get(file_id);
    if (file_data) {
      file_data.element.remove();
      selected_files.delete(file_id);
      UpdateFileCount();
    }
  }

  function UpdateFileProgress(file_id, progress) {
    const file_data = selected_files.get(file_id);
    if (file_data) {
      const file_column = file_data.element.querySelector('.column-no-gap');
      
      if (progress === 0) {
        file_column.innerHTML = '';
        file_data.status_text.textContent = 'Ready';
        file_column.appendChild(file_data.status_text);
        file_column.appendChild(file_data.name);
      } else if (progress < 100) {
        file_column.innerHTML = '';
        file_data.status_text.textContent = `Processing: ${progress}%`;
        file_column.appendChild(file_data.status_text);
        file_column.appendChild(file_data.name);
      } else {
        file_column.innerHTML = '';
        file_data.status_text.textContent = 'Complete';
        file_column.appendChild(file_data.status_text);
        file_column.appendChild(file_data.name);
      }
    }
  }

  add_btn.onclick = async () => {
    const location_txt = loc_input.value.trim();
    const files = Array.from(selected_files.values()).map(f => f.file);
    
    if (!location_txt) { 
      alert("Enter Location"); 
      return; 
    }
    if (!files.length) { 
      alert("Select File(s)"); 
      return; 
    }

    add_btn.disabled = true;
    add_btn.textContent = 'Uploading';

    const today_iso = new Date().toISOString().split("T")[0];
    const { data:grp, error:grp_err } = await supa
      .from("group")
      .insert([{ date: today_iso, location: location_txt }])
      .select("id")
      .single();

    if (grp_err || !grp?.id) {
      alert("Cannot Create Group");
      add_btn.disabled = false;
      add_btn.textContent = 'Add Files';
      return;
    }
    
    const group_id = grp.id;

    const delay = ms => new Promise(res => setTimeout(res, ms));
    let uploaded_count = 0;

    for (const [file_id, file_data] of selected_files) {
      const file = file_data.file;
      
      try {
        UpdateFileProgress(file_id, 10);
        
        let file_to_upload = file;
        let file_name = file.name;
        
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          UpdateFileProgress(file_id, 20);
          try {
            const converted_file = await ConvertHeicToJpgFile(file);
            file_to_upload = converted_file;
            file_name = converted_file.name;
            UpdateFileProgress(file_id, 30);
          } catch (conversion_err) {
          }
        }

        const clean_name = file_name.replace(/\s+/g, "_");
        const key = `${group_id}-${Date.now()}-${clean_name}`;
        const content_type = file_to_upload.type;

        UpdateFileProgress(file_id, 40);

        const { error:up_err } = await supa
          .storage
          .from("gallery")
          .upload(key, file_to_upload, { contentType: content_type, upsert: false });

        if (up_err) { 
          UpdateFileProgress(file_id, 0);
          continue; 
        }
        UpdateFileProgress(file_id, 70);

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
            } else {
              await delay(1000);
            }
          } catch (url_err) {
            await delay(1000);
          }
        }
        
        if (!public_url) { 
          public_url = `${SUPABASE_URL}/storage/v1/object/public/gallery/${key}`;
        }

        UpdateFileProgress(file_id, 90);

        const f_type = file_to_upload.type.startsWith("video") ? "video" : "image";
        const file_data = { 
          path: public_url, 
          type: f_type, 
          group: group_id 
        };
        
        const { data:file_insert, error:file_err } = await supa
          .from("file")
          .insert([file_data])
          .select("id")
          .single();

        if (file_err) {
        } else {
          UpdateFileProgress(file_id, 100);
          uploaded_count++;
        }
        
      } catch (err) {
        UpdateFileProgress(file_id, 0);
      }
    }

    loc_input.value = "";
    selected_files.clear();
    file_preview_list.innerHTML = "";
    
    add_btn.disabled = false;
    add_btn.textContent = 'Add Files';
    
    location.hash = 'gallery';
    FetchGalleryFiles();
  };

  InitTabs();
  FetchTodayNote();
  FetchHistoryNotes();
  FetchGalleryFiles();
});

function InitTabs() {
  const tabs = document.querySelectorAll(".tab");
  const pages = document.querySelectorAll(".page");
  const bar = document.querySelector(".tab-bar");

  const Show = id => {
    pages.forEach(p => (p.style.display = p.id === id ? "flex" : "none"));
    tabs.forEach(t => {
      const on = t.dataset.target === id;
      t.classList.toggle("active", on);
      t.classList.toggle("inactive", !on);
    });

    const add_btn = document.getElementById('new-add-btn');
    if (add_btn) add_btn.style.display = (id === 'new') ? 'block' : 'none';
    
    const hide = id === "new";
    bar.style.display = hide ? "none" : "flex";
    
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
  const formatted_date = new Date(n.date).toLocaleDateString("en-ZA", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  SetNote(n.number, formatted_date, n.header, n.body);
}

async function FetchHistoryNotes() {
  const page = document.querySelector("#history");
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supa
    .from("note")
    .select("*")
    .lte("date", today)
    .order("date", { ascending: false })
    .order("number", { ascending: false });

  if (error || !data?.length) return;
  page.innerHTML = "";

  const fragment = document.createDocumentFragment();

  data.forEach((n, i) => {
    const formatted_date = FormatCached(n.date);

    const note_container = document.createElement('div');
    note_container.className = 'column-gap-16';
    
    note_container.innerHTML = `
        <div class="column-gap-8">
            <div class="row">
                <div class="chip-small">${n.number}</div>
                <div class="dot"></div>
                <p class="medium-secondary">${formatted_date}</p>
            </div>
            <h2>${n.header}</h2>
        </div>
        <p style="white-space: pre-wrap;">${n.body}</p>
    `;
    fragment.appendChild(note_container);

    if (i !== data.length - 1) {
      const separator = document.createElement("div");
      separator.className = "row-center";
      separator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
      fragment.appendChild(separator);
    }
  });

  page.appendChild(fragment);
}

async function FetchGalleryFiles() {
  const page = document.querySelector("#gallery");
  page.innerHTML = "";

  const { data, error } = await supa
    .from("file")
    .select("id,path,type,gallery_group:group(id,date,location)")
    .order("id", { ascending: false });

  if (error || !data?.length) { 
    return; 
  }

  const groups = [];
  const group_map = new Map();
  data.forEach(f => {
    if (f.gallery_group) {
      const group_id = f.gallery_group.id;
      if (!group_map.has(group_id)) {
        const new_group = [];
        group_map.set(group_id, new_group);
        groups.push(new_group);
      }
      group_map.get(group_id).push(f);
    }
  });

  const fragment = document.createDocumentFragment();
  
  const CreateFileFrame = (file_data) => {
    const frame = document.createElement("div");
    frame.className = "block";
    
    if (file_data.type === "image") {
      frame.dataset.src = `${file_data.path}?quality=70`;
    } else {
      frame.innerHTML = '<div class="chip-large">View Video</div>';
    }
    
    frame.onclick = () => location.href = file_data.path;
    return frame;
  };

  const GenerateFilesHtml = (files) => {
    const items_html = files.map((file, i) =>
        `<div class="gallery-item-wrapper">
            <div class="file-frame-placeholder" data-index="${i}"></div>
        </div>`
    ).join('');
    return `<div class="gallery-grid-container">${items_html}</div>`;
  };

  groups.forEach((files, idx) => {
      const group_data = files[0].gallery_group;
      const date = group_data.date;
      const loc = group_data.location;
      
      const photo_count = files.filter(f => f.type === 'image').length;
      const video_count = files.filter(f => f.type === 'video').length;
      let count_text = [];
      if (photo_count > 0) count_text.push(`${photo_count} Photo${photo_count > 1 ? 's' : ''}`);
      if (video_count > 0) count_text.push(`${video_count} Video${video_count > 1 ? 's' : ''}`);

      const wrap = document.createElement("div");
      wrap.className = 'column-gap-16';
      
      const header_html = `
        <div class="column-gap-8">
            <div class="row">
                <div class="chip-small">${group_data.id}</div>
                <div class="dot"></div>
                <p class="medium-secondary">${FormatCached(date)}</p>
            </div>
            <div class="row-space-between">
                <h2 style="flex: 1; min-width: 0; margin-right: 12px;">${loc}</h2>
                <div class="chip-large" style="flex-shrink: 0;">${count_text.join(', ')}</div>
            </div>
        </div>
      `;

      wrap.innerHTML = `
        ${header_html}
        <div class="files-container" data-files-container>
          ${GenerateFilesHtml(files)}
        </div>
      `;

      const frame_placeholders = wrap.querySelectorAll(".file-frame-placeholder");
      frame_placeholders.forEach((placeholder) => {
        const file_data = files[parseInt(placeholder.dataset.index)];
        if (file_data) {
          const frame = CreateFileFrame(file_data);
          if (frame.dataset.src) {
          }
          placeholder.replaceWith(frame);
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

  page.appendChild(fragment);
  
  const lazy_blocks = page.querySelectorAll('[data-src]');
  if (!gallery_observer) {
    gallery_observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (el.dataset.src) {
            const src = el.dataset.src;
            el.removeAttribute('data-src');
            
            PreloadImage(src).then(() => {
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
  
  lazy_blocks.forEach(el => {
    gallery_observer.observe(el);
    
    const rect = el.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
    
    if (isVisible && el.dataset.src) {
      const src = el.dataset.src;
      el.removeAttribute('data-src');
      
      PreloadImage(src).then(() => {
        el.style.backgroundImage = `url("${src}")`;
      }).catch(() => {
        el.style.backgroundImage = `url("${src}")`;
      });
      
      gallery_observer.unobserve(el);
    }
  });
}

function SetNote(n,d,h,b){
  document.getElementById("note-number").textContent = n;
  document.getElementById("note-date").textContent = d;
  document.getElementById("note-header").textContent = h;
  const note_body = document.getElementById("note-body");
  note_body.innerHTML = b.replace(/\n/g, "<br>");
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