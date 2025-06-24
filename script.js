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

function FormatDate(date) {
  return new Date(date).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function GetFileCountText(files) {
  const photo_count = files.filter(f => f.type === 'image' || f.type.startsWith('image/')).length;
  const video_count = files.filter(f => f.type === 'video' || f.type.startsWith('video/')).length;
  let count_text = [];
  if (photo_count > 0) count_text.push(`${photo_count} Photo${photo_count > 1 ? 's' : ''}`);
  if (video_count > 0) count_text.push(`${video_count} Video${video_count > 1 ? 's' : ''}`);
  return count_text.length > 0 ? count_text.join(', ') : '0 Files';
}

const PreloadImage = (src) => {
  const img = new Image();
  const promise = new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
  
  img.src = src;
  return promise;
};

function Delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function EnsureUrlProtocol(url) {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

let gallery_observer = null;

document.addEventListener("DOMContentLoaded", () => {
  const loc_input = document.getElementById("new-location");
  const desc_input = document.getElementById("new-description");
  const file_pick = document.getElementById("new-files");
  const add_btn = document.getElementById("new-add-btn");
  const file_preview_list = document.getElementById("file-preview-list");
  const link_input = document.getElementById("new-link");
  if (!loc_input || !desc_input || !file_pick || !add_btn || !file_preview_list || !link_input) return;
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
      const files = Array.from(selected_files.values()).map(f => f.file);
      file_count.textContent = GetFileCountText(files);
    }
  }

  function AddFilePreview(file) {
    const file_id = `${file.name}-${Date.now()}`;
    const file_item = document.createElement('div');
    file_item.className = 'file-preview-item';
    file_item.dataset.fileId = file_id;
    const thumbnail = document.createElement('div');
    thumbnail.className = 'file-preview-thumbnail';
    const create_thumbnail_content = (emoji) => {
      return `<div style="width: 56px; height: 56px; background: var(--bg-color); border-radius: 12px; display: flex; align-items: center; justify-content: center;"><span style="font-size:16px;">${emoji}</span></div>`;
    };
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.style.cssText = 'width: 56px; height: 56px; border-radius: 12px; object-fit: cover;';
      img.onerror = () => { thumbnail.innerHTML = create_thumbnail_content('🖼️'); };
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = () => { thumbnail.innerHTML = create_thumbnail_content('🖼️'); };
      reader.readAsDataURL(file);
      thumbnail.appendChild(img);
    } else {
      thumbnail.innerHTML = create_thumbnail_content('🎬');
    }
    const info = document.createElement('div');
    info.className = 'file-preview-info';
    const name = document.createElement('p');
    name.className = 'file-preview-name';
    name.textContent = file.name;
    const status_text = document.createElement('p');
    status_text.className = 'status-text';
    status_text.style.cssText = 'font-size: 12px; font-weight: 600; color: rgba(0, 0, 0, 0.5); margin: 0; line-height: 16px; font-family: Manrope;';
    status_text.textContent = 'Ready';
    info.appendChild(status_text);
    info.appendChild(name);
    const remove_btn = document.createElement('button');
    remove_btn.className = 'chip-large file-preview-remove';
    remove_btn.textContent = 'Remove';
    remove_btn.onclick = () => RemoveFile(file_id);
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
    if (!file_data) return;
    const status_text = file_data.status_text;
    if (progress === 0) {
      status_text.textContent = 'Ready';
    } else if (progress < 100) {
      status_text.textContent = `Processing: ${progress}%`;
    } else {
      status_text.textContent = 'Complete';
    }
  }

  add_btn.onclick = async () => {
    const location_text = loc_input.value.trim();
    const location_link = link_input.value.trim();
    const description_text = desc_input.value.trim();
    const files = Array.from(selected_files.values()).map(f => f.file);
    if (!location_text) { alert("Enter Location"); return; }
    if (!files.length) { alert("Select File(s)"); return; }
    add_btn.disabled = true;
    add_btn.textContent = 'Uploading';
    try {
      const today_iso = new Date().toISOString().split("T")[0];
      const { data: group_data, error: group_error } = await supa
        .from("group")
        .insert([{ date: today_iso, location: location_text, link: location_link, body: description_text }])
        .select("id")
        .single();
      if (group_error || !group_data?.id) {
        throw new Error("Cannot Create Group");
      }
      const group_id = group_data.id;
      for (const [file_id, file_data] of selected_files) {
        const file = file_data.file;
        UpdateFileProgress(file_id, 10);
        let file_to_upload = file;
        let file_name = file.name;
        const clean_name = file_name.replace(/\s+/g, "_");
        const key = `${group_id}-${Date.now()}-${clean_name}`;
        const content_type = file_to_upload.type;
        UpdateFileProgress(file_id, 40);
        const { error: upload_error } = await supa
          .storage
          .from("gallery")
          .upload(key, file_to_upload, { contentType: content_type, upsert: false });
        if (upload_error) { UpdateFileProgress(file_id, 0); continue; }
        UpdateFileProgress(file_id, 70);
        await Delay(2000);
        let public_url = null;
        for (let attempt = 0; attempt < 3 && !public_url; attempt++) {
          try {
            const { data, error: url_error } = supa
              .storage
              .from("gallery")
              .getPublicUrl(key);
            if (data?.publicUrl) {
              public_url = data.publicUrl;
            } else {
              await Delay(1000);
            }
          } catch (url_error) {
            await Delay(1000);
          }
        }
        if (!public_url) {
          public_url = `${SUPABASE_URL}/storage/v1/object/public/gallery/${key}`;
        }
        UpdateFileProgress(file_id, 90);
        const file_type = file_to_upload.type.startsWith("video") ? "video" : "image";
        const file_insert_data = {
          path: public_url,
          type: file_type,
          group: group_id
        };
        const { data: file_insert, error: file_error } = await supa
          .from("file")
          .insert([file_insert_data])
          .select("id")
          .single();
        if (file_error) {
          UpdateFileProgress(file_id, 0);
        } else {
          UpdateFileProgress(file_id, 100);
        }
      }
      loc_input.value = "";
      link_input.value = "";
      desc_input.value = "";
      desc_input.style.height = '56px';
      selected_files.clear();
      file_preview_list.innerHTML = "";
      location.hash = 'gallery';
      FetchGalleryFiles();
    } catch (error) {
      alert(error.message || "Upload failed");
    } finally {
      add_btn.disabled = false;
      add_btn.textContent = 'Add Files';
    }
  };

  desc_input.addEventListener('input', function() {
    this.style.height = '56px';
    if (this.scrollHeight > 56) {
      this.style.height = this.scrollHeight + 'px';
    }
  });

  InitTabs();
  FetchTodayNote();
  FetchHistoryNotes();
  FetchGalleryFiles();
  StartCountdown();
});

function StartCountdown() {
  const countdown_container = document.getElementById('countdown-container');
  if (!countdown_container) return;
  const countdown_date = new Date('2025-07-21T14:00:00+02:00').getTime();
  const UpdateCountdown = () => {
    const now = new Date().getTime();
    const distance = countdown_date - now;
    if (distance < 0) {
      countdown_container.innerHTML = `<h2>I've Arrived Back</h2>`;
      if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
      }
      return;
    }
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    let time_text = '';
    if (days > 0) {
      const days_text = days === 1 ? 'Day' : 'Days';
      const hours_text = hours === 1 ? 'Hour' : 'Hours';
      time_text = `${days} ${days_text}, ${hours} ${hours_text}`;
    } else if (hours > 0) {
      const hours_text = hours === 1 ? 'Hour' : 'Hours';
      const minutes_text = minutes === 1 ? 'Minute' : 'Minutes';
      time_text = `${hours} ${hours_text}, ${minutes} ${minutes_text}`;
    } else if (minutes > 0) {
      const minutes_text = minutes === 1 ? 'Minute' : 'Minutes';
      const seconds_text = seconds === 1 ? 'Second' : 'Seconds';
      time_text = `${minutes} ${minutes_text}, ${seconds} ${seconds_text}`;
    } else {
      const seconds_text = seconds === 1 ? 'Second' : 'Seconds';
      time_text = `${seconds} ${seconds_text}`;
    }
    countdown_container.innerHTML = `
      <p class="medium-secondary">I'm Arriving Back In</p>
      <h2>${time_text}</h2>
    `;
  };
  UpdateCountdown();
  window.countdownInterval = setInterval(UpdateCountdown, 1000);
}

function InitTabs() {
  const tabs = document.querySelectorAll(".tab");
  const pages = document.querySelectorAll(".page");
  const bar = document.querySelector(".tab-bar");
  const countdown_container = document.getElementById('countdown-container');
  const sticky_add_btn_container = document.getElementById('sticky-add-btn-container');
  const desc_input = document.getElementById('new-description');
  const Show = id => {
    pages.forEach(p => (p.style.display = p.id === id ? "flex" : "none"));
    tabs.forEach(t => {
      const on = t.dataset.target === id;
      t.classList.toggle("active", on);
      t.classList.toggle("inactive", !on);
    });
    const add_btn = document.getElementById('new-add-btn');
    if (add_btn) add_btn.style.display = (id === 'new') ? 'block' : 'none';
    if (sticky_add_btn_container) sticky_add_btn_container.style.display = (id === 'new') ? 'flex' : 'none';
    if (countdown_container) {
      const is_today = id === 'today';
      countdown_container.style.display = is_today ? 'flex' : 'none';
      document.body.classList.toggle('body-padded-for-countdown', is_today);
    }
    const hide = id === "new";
    bar.style.display = hide ? "none" : "flex";
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id === 'new' && desc_input) {
      desc_input.style.height = '56px';
    }
  };
  const Cur = () => (location.hash ? location.hash.slice(1) : tabs[0].dataset.target);
  Show(Cur());
  tabs.forEach(t => t.onclick = () => (location.hash = t.dataset.target));
  addEventListener("hashchange", () => Show(Cur()));
}

async function FetchTodayNote() {
  const today = new Date().toISOString().split("T")[0];
  SetNote('', 'Loading', 'Loading', 'Loading');
  const { data, error } = await supa
    .from("note")
    .select("*")
    .eq("date", today)
    .order("date", { ascending: false })
    .limit(1);
  if (error || !data?.length) {
    const today_formatted = FormatDate(today);
    SetNote("", today_formatted, "No Note Available", "");
    return;
  }
  const n = data[0];
  const formatted_date = FormatDate(n.date);
  const { data: history_data } = await supa
    .from("note")
    .select("id")
    .lte("date", today)
    .order("date", { ascending: true });
  const note_number = history_data ? history_data.findIndex(note => note.id === n.id) + 1 : 1;
  SetNote(note_number, formatted_date, n.header, n.body);
}

function RenderParagraphs(text) {
  if (!text) return '';
  const paragraphs = text.split(/\r?\n\s*\r?\n/);
  let html = '';
  for (let i = 0; i < paragraphs.length; i++) {
    html += `<p>${paragraphs[i]}</p>`;
  }
  return html;
}

function SetNote(n, d, h, b) {
  document.getElementById("note-number").textContent = n ? n : "";
  document.getElementById("note-date").textContent = d;
  document.getElementById("note-header").textContent = h;
  
  const todayContent = document.getElementById("today-content");
  
  const existingBodyParagraphs = todayContent.querySelectorAll(':scope > p');
  existingBodyParagraphs.forEach(p => p.remove());
  
  if (b) {
    const noteBody = document.createElement('p');
    noteBody.style.whiteSpace = 'pre-wrap';
    noteBody.textContent = b;
    todayContent.appendChild(noteBody);
  }
}

async function FetchHistoryNotes() {
  const page = document.querySelector("#history");
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supa
    .from("note")
    .select("*")
    .lte("date", today)
    .order("date", { ascending: false });
  if (error || !data?.length) return;
  page.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const [i, n] of data.entries()) {
    const formatted_date = FormatCached(n.date);
    const note_number = data.length - i;
    const note_container = document.createElement('div');
    note_container.className = 'column gap-16';
    note_container.innerHTML = `
      <div class="column gap-8">
        <div class="row">
          <div class="chip-small">${note_number}</div>
          <div class="dot"></div>
          <p class="medium-secondary">${formatted_date}</p>
        </div>
        <h2>${n.header}</h2>
      </div>
      <p style="white-space: pre-wrap;">${n.body}</p>
    `;
    fragment.appendChild(note_container);
    if (i !== data.length - 1) {
      fragment.appendChild(CreateSeparator());
    }
  }
  page.appendChild(fragment);
}

async function FetchGalleryFiles() {
  const page = document.querySelector("#gallery");
  page.innerHTML = "";
  const { data, error } = await supa
    .from("file")
    .select("id,path,type,gallery_group:group(id,date,location,body,link)")
    .order("id", { ascending: false });
  if (error || !data?.length) { return; }
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
  function CreateFileFrame(file_data) {
    const frame = document.createElement("div");
    frame.className = "block";
    const is_image = file_data.type === "image";
    const emoji = is_image ? "🖼️" : "🎬";
    frame.innerHTML = `<div class="gallery-loading-block" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <span style="font-size:24px;line-height:1;">${emoji}</span>
      <span style="height:4px;display:block;"></span>
      <span style="font-size:14px;line-height:24px;font-weight:600;color:var(--text-muted);font-family:var(--font-family);">Loading</span>
    </div>`;
    if (is_image) {
      const img = new window.Image();
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '24px';
      img.onload = () => {
        frame.innerHTML = '';
        frame.appendChild(img);
      };
      img.src = `${file_data.path}?quality=70`;
    }
    frame.onclick = () => location.href = file_data.path;
    return frame;
  }
  function GenerateFilesHtml(files) {
    const items_html = files.map((file, i) =>
      `<div class="gallery-item-wrapper">
        <div class="file-frame-placeholder" data-index="${i}"></div>
      </div>`
    ).join('');
    return `<div class="gallery-grid-container">${items_html}</div>`;
  }
  groups.forEach((files, idx) => {
    const group_data = files[0].gallery_group;
    const date = group_data.date;
    const loc = group_data.location;
    const body = group_data.body;
    const link = group_data.link;
    const group_number = groups.length - idx;
    const count_text = GetFileCountText(files);
    const wrap = document.createElement("div");
    wrap.className = 'column gap-16';
    const header_html = `
      <div class="column gap-8">
        <div class="row">
          <div class="chip-small">${group_number}</div>
          <div class="dot"></div>
          <p class="medium-secondary">${FormatCached(date)}</p>
        </div>
        <div class="row space-between">
          <h2 style="flex: 1; min-width: 0; margin-right: 12px;">${loc}</h2>
          <div class="chip-large" style="flex-shrink: 0;">${count_text}</div>
        </div>
      </div>
    `;
    wrap.innerHTML = `
      ${header_html}
      <div class="column gap-8">
        ${body ? `<p style=\"white-space: pre-wrap;\">${body}</p>` : ''}
        ${link ? `<a href=\"${EnsureUrlProtocol(link)}\" target=\"_blank\" style=\"font-size:14px;font-weight:600;line-height:24px;color:rgba(0,0,0,0.5);text-decoration:none;\">View Location</a>` : ''}
      </div>
      <div class="files-container" data-files-container>
        ${GenerateFilesHtml(files)}
      </div>
    `;
    const frame_placeholders = wrap.querySelectorAll(".file-frame-placeholder");
    frame_placeholders.forEach((placeholder) => {
      const file_data = files[parseInt(placeholder.dataset.index)];
      if (file_data) {
        const frame = CreateFileFrame(file_data);
        placeholder.replaceWith(frame);
      }
    });
    fragment.appendChild(wrap);
    if (idx !== groups.length - 1) {
      fragment.appendChild(CreateSeparator());
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
            LoadLazyImage(el, src);
          }
        }
      });
    }, { rootMargin: "200px 0px", threshold: 0.1 });
  }
  lazy_blocks.forEach(el => {
    gallery_observer.observe(el);
    const rect = el.getBoundingClientRect();
    const is_visible = rect.top < window.innerHeight && rect.bottom > 0;
    if (is_visible && el.dataset.src) {
      const src = el.dataset.src;
      LoadLazyImage(el, src);
    }
  });
}

function CreateSeparator() {
  const separator = document.createElement("div");
  separator.className = "row center";
  separator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  return separator;
}

function LoadLazyImage(el, src) {
  el.removeAttribute('data-src');
  PreloadImage(src).then(() => {
    el.style.backgroundImage = `url("${src}")`;
  }).catch(() => {
    el.style.backgroundImage = `url("${src}")`;
  });
  gallery_observer.unobserve(el);
}