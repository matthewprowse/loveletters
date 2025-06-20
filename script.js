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
let current_page = 0;
const items_per_page = 20;
let loading_more = false;
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
  InitTabs();
  FetchTodayNote();
  FetchHistoryNotes();
  FetchGalleryFiles();
});

function InitTabs() {
  const tabs = document.querySelectorAll(".tab");
  const pages = document.querySelectorAll(".page");
  const footer = document.querySelector(".footer");
  const bar = document.querySelector(".tab-bar");

  const Show = id => {
    pages.forEach(p => (p.style.display = p.id === id ? "flex" : "none"));
    tabs.forEach(t => {
      const on = t.dataset.target === id;
      t.classList.toggle("active", on);
      t.classList.toggle("inactive", !on);
    });
    const hide = id === "new";
    footer.style.display = hide ? "none" : "block";
    bar.style.display    = hide ? "none" : "flex";
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
  SetNote(n.number, Format(n.date), n.header, n.body);
}

async function FetchHistoryNotes() {
  const box   = document.querySelector("#history");
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supa
    .from("note")
    .select("*")
    .lte("date", today)
    .order("date");

  if (error || !data?.length) return;
  box.innerHTML = "";

  data.forEach((n, i) => {
    box.insertAdjacentHTML("beforeend", `
      <div class="column-gap-16">
        <div class="column-gap-8">
          <div class="row">
            <div class="chip-small">${n.number}</div>
            <div class="dot"></div>
            <p class="medium-secondary">${Format(n.date)}</p>
          </div>
          <h1>${n.header}</h1>
        </div>
        <p style="white-space: pre-wrap;">${n.body}</p>
      </div>
    `);
    if (i !== data.length - 1)
      box.insertAdjacentHTML("beforeend", '<div class="row-center"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>');
  });
}

async function FetchGalleryFiles() {
  if (loading_more) return;
  
  const page = document.querySelector("#gallery");
  
  if (current_page === 0) {
    page.innerHTML = "";
    if (gallery_observer) {
      gallery_observer.disconnect();
      gallery_observer = null;
    }
    image_cache.clear();
  }

  loading_more = true;

  const { data, error } = await supa
    .from("file")
    .select("path,type,group(id,date,location)")
    .order("group.date", { ascending: false })
    .range(current_page * items_per_page, (current_page + 1) * items_per_page - 1);

  if (error || !data?.length) { 
    if (current_page === 0) console.error("file fetch", error); 
    loading_more = false;
    return; 
  }

  const grouped = {};
  data.forEach(f => {
    const key = `${f.group.date}||${f.group.location}`;
    (grouped[key] ||= []).push(f);
  });

  const groups = Object.entries(grouped)
    .sort(([a],[b]) => new Date(b.split("||")[0]) - new Date(a.split("||")[0]));

  const fragment = document.createDocumentFragment();
  const lazy_blocks = [];

  const create_file_frame = (file_data) => {
    const frame = document.createElement("div");
    frame.className = "block";
    frame.style.cssText = "width:100%;aspect-ratio:1/1;border:1px solid rgba(197,197,197,.24);background-size:cover;background-position:center;background-repeat:no-repeat;cursor:pointer";
    
    if (file_data.type === "image") {
      frame.dataset.src = `${file_data.path}?quality=70`;
      lazy_blocks.push(frame);
    } else {
      frame.style.cssText += ";display:flex;align-items:center;justify-content:center";
      frame.innerHTML = '<div class="chip-large">View Video</div>';
    }
    
    frame.onclick = () => location.href = file_data.path;
    return frame;
  };

  const generate_files_html = (files) => {
    const rows = [];
    for (let i = 0; i < files.length; i += 2) {
      const file_data = files[i];
      const next_file = files[i + 1];
      
      rows.push(`
        <div class="row" style="gap:12px">
          <div class="column-gap-8" style="flex:1">
            <div class="file-frame-placeholder" data-index="${i}"></div>
            <div class="row-flex-end">
              <div class="chip-large" style="cursor:pointer" onclick="DownloadFile('${file_data.path}')">Save</div>
            </div>
          </div>
          ${next_file ? `
            <div class="column-gap-8" style="flex:1">
              <div class="file-frame-placeholder" data-index="${i + 1}"></div>
              <div class="row-flex-end">
                <div class="chip-large" style="cursor:pointer" onclick="DownloadFile('${next_file.path}')">Save</div>
              </div>
            </div>
          ` : ''}
        </div>
      `);
    }
    return rows.join('');
  };

  const batch_create_elements = () => {
    groups.forEach(([key, files], idx) => {
      const [date, loc] = key.split("||");
      const file_paths = files.map(f => `"${f.path}"`).join(",");

      const wrap = document.createElement("div");
      wrap.className = "column-gap-16";
      
      wrap.innerHTML = `
        <div class="row-space-between">
          <p class="medium-secondary">${format_cached(date)}</p>
          <div class="chip-large" style="cursor:pointer" onclick="BatchDownload([${file_paths}])">Save All</div>
        </div>
        <div class="row">
          <div class="chip-small">${files[0]?.group.id ?? ""}</div>
          <div class="dot"></div>
          <p class="medium">${loc}</p>
        </div>
        <div class="files-container">${generate_files_html(files)}</div>
      `;

      const frame_placeholders = wrap.querySelectorAll(".file-frame-placeholder");
      frame_placeholders.forEach((placeholder, i) => {
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
  page.appendChild(fragment);

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

  if (data.length === items_per_page) {
    const load_more = document.createElement("div");
    load_more.className = "row-center";
    load_more.style.padding = "20px";
    load_more.innerHTML = '<div class="chip-large" style="cursor:pointer" onclick="LoadMoreGallery()">Load More</div>';
    page.appendChild(load_more);
  }

  loading_more = false;
}

const LoadMoreGallery = debounce(() => {
  current_page++;
  FetchGalleryFiles();
}, 100);

async function DownloadFile(url) {
  const file_name = url.split("/").pop().split("?")[0];

  const blob = await fetch(url).then(r => r.blob());
  const blob_url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blob_url;
  a.download = file_name;
  document.body.append(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(blob_url);
}

function BatchDownload(arr) { arr.forEach(DownloadFile); }

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

document.addEventListener("DOMContentLoaded", () => {
  const loc_input = document.getElementById("new-location");
  const file_pick = document.getElementById("new-files");
  const add_btn   = document.getElementById("new-add-btn");
  if (!loc_input || !file_pick || !add_btn) return;

  add_btn.onclick = async () => {
    const location_txt = loc_input.value.trim();
    const files       = Array.from(file_pick.files || []);
    if (!location_txt) { alert("Enter Location"); return; }
    if (!files.length){ alert("Select File(s)"); return; }

    const today_iso = new Date().toISOString().split("T")[0];
    const { data:grp, error:grp_err } = await supa
      .from("group")
      .insert([{ date: today_iso, location: location_txt }])
      .select("id")
      .single();

    if (grp_err || !grp?.id) {
      console.error("group insert", grp_err);
      alert("Cannot Create Group");
      return;
    }
    const group_id = grp.id;
    console.log("Group Created:", group_id);

    const delay = ms => new Promise(res => setTimeout(res, ms));

    for (const file of files) {
      try {
        let file_to_upload = file;
        let file_name = file.name;
        
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          console.log("Converting HEIC:", file.name);
          try {
            const converted_file = await ConvertHeicToJpgFile(file);
            file_to_upload = converted_file;
            file_name = converted_file.name;
            console.log("HEIC Converted:", file_name);
          } catch (conversion_err) {
            console.error("Converting HEIC Failed:", conversion_err);
            console.log("Uploading HEIC");
          }
        }

        const clean_name   = file_name.replace(/\s+/g, "_");
        const key         = `${group_id}-${Date.now()}-${clean_name}`;
        const content_type = file_to_upload.type;

        console.log("Uploading File:", key);

        const { error:up_err } = await supa
          .storage
          .from("gallery")
          .upload(key, file_to_upload, { contentType: content_type, upsert: false });

        if (up_err) { 
          console.error("Upload Failed:", up_err, file_name); 
          continue; 
        }
        console.log("File Uploaded:", key);

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
        }
        
      } catch (err) {
        console.error("Cannot Process File", file_name, err);
      }
    }

    loc_input.value = "";
    file_pick.value = "";
    alert("Complete");
    FetchGalleryFiles();
  };
});

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