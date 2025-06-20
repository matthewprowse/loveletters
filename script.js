const SUPABASE_URL = "https://fcgryppvohjwouihyocn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZ3J5cHB2b2hqd291aWh5b2NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzMjA3MTYsImV4cCI6MjA2NTg5NjcxNn0.ktXtHmQFzmjrv1LRPTdmzqEUfP7lVOmzPCqeQ5JLjVM";

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

async function FetchGalleryFiles () {
  const page = document.querySelector("#gallery");

  const { data, error } = await supa
    .from("file")
    .select("path,type,group(id,date,location)");

  if (error || !data?.length) {
    console.error("file fetch", error);
    return;
  }

  const grouped = {};
  data.forEach(f => {
    const key = `${f.group.date}||${f.group.location}`;
    (grouped[key] ||= []).push(f);
  });

  page.innerHTML = "";
  const groups = Object.entries(grouped)
    .sort(([a], [b]) => new Date(a.split("||")[0]) - new Date(b.split("||")[0]));

  const lazyBlocks = [];

  groups.forEach(([key, files], idx) => {
    const [date, loc] = key.split("||");

    const wrap = document.createElement("div");
    wrap.className = "column-gap-16";
    page.append(wrap);

    wrap.insertAdjacentHTML("beforeend", `
      <div class="row-space-between">
        <p class="medium-secondary">${Format(date)}</p>
        <div class="chip-large" style="cursor:pointer"
             onclick='BatchDownload([${files.map(f => `"${f.path}"`)}])'>Save All</div>
      </div>
      <div class="row">
        <div class="chip-small">${files[0]?.group.id ?? ""}</div>
        <div class="dot"></div>
        <p class="medium">${loc}</p>
      </div>`);

    for (let i = 0; i < files.length; i += 2) {
      const row = document.createElement("div");
      row.className = "row";
      wrap.append(row);

      for (let j = 0; j < 2; j++) {
        const f = files[i + j];
        if (!f) continue;

        const col = document.createElement("div");
        col.className = "column-gap-8";
        row.append(col);

        const frame = document.createElement("div");
        frame.className = "block";
        frame.style.width = "100%";
        frame.style.aspectRatio = "1 / 1";
        frame.style.backgroundColor = "#f3f3f3";
        frame.style.border = "1px solid rgba(197,197,197,.24)";
        frame.style.backgroundSize = "cover";
        frame.style.backgroundPosition = "center";
        frame.style.backgroundRepeat = "no-repeat";
        frame.style.cursor = "pointer";
        col.append(frame);

        if (f.type === "image") {
          frame.dataset.src = `${f.path}?quality=65`;
          lazyBlocks.push(frame);
        } else {
          const label = document.createElement("div");
          label.className = "chip-large";
          label.textContent = "View Video";
          frame.style.display = "flex";
          frame.style.alignItems = "center";
          frame.style.justifyContent = "center";
          frame.append(label);
        }

        frame.onclick = () => location.href = f.path;

        const saveWrap = document.createElement("div");
        saveWrap.className = "row-flex-end";
        col.append(saveWrap);

        const saveBtn = document.createElement("div");
        saveBtn.className = "chip-large";
        saveBtn.textContent = "Save";
        saveBtn.style.cursor = "pointer";
        saveBtn.onclick = () => Download(f.path);
        saveWrap.append(saveBtn);
      }
    }

    if (idx !== groups.length - 1) {
      page.insertAdjacentHTML("beforeend",
        '<div class="row-center"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>');
    }
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.style.backgroundImage = `url("${el.dataset.src}")`;
        io.unobserve(el);
      }
    });
  }, { rootMargin: "200px 0px" });

  lazyBlocks.forEach(el => io.observe(el));
}

async function Download(url) {
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

function BatchDownload(arr) { arr.forEach(Download); }

function SetNote(n,d,h,b){
  document.getElementById("note-number").textContent = n;
  document.getElementById("note-date").textContent = d;
  document.getElementById("note-header").textContent = h;
  const note_body = document.getElementById("note-body");
  note_body.innerHTML = b.replace(/\n/g, "<br>");
}
function Format(s){
  return new Date(s).toLocaleDateString("en-ZA",
    { weekday:"long", day:"numeric", month:"long", year:"numeric" });
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
            const converted_file = await ConvertHeicToJpg(file);
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

async function ConvertHeicToJpg(heic_file) {
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