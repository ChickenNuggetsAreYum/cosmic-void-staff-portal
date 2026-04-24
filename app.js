const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

function month(){
  return new Date().toISOString().slice(0,7);
}

// ---------------- API ----------------

async function post(action,data={}){
  const res = await fetch(API,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({action,...data})
  });

  return res.json();
}

// ---------------- AUTH ----------------

let isAdmin=false;
let staffCache=[];

async function verify(){
  const res = await post("verifyUser",{discordId:userId,token});

  if(!res.valid){
    document.body.innerHTML="❌ Unauthorized";
    throw new Error();
  }

  isAdmin = res.isWebAdmin;

  const adminTab = document.getElementById("adminTab");
  if(adminTab) adminTab.style.display = isAdmin ? "block" : "none";
}

// ---------------- TABS (FIXED START TAB) ----------------

function setupTabs(){

  const tabs=document.querySelectorAll(".channel");
  const pages=document.querySelectorAll(".tab");

  function open(tabName){

    pages.forEach(p=>p.classList.add("hidden"));
    tabs.forEach(t=>t.classList.remove("active"));

    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const page = document.getElementById(tabName);

    if(tabBtn) tabBtn.classList.add("active");
    if(page) page.classList.remove("hidden");
  }

  tabs.forEach(tab=>{
    tab.addEventListener("click",()=>{
      open(tab.dataset.tab);
    });
  });

  // 🔥 FORCE START ON RATINGS
  open("ratings");
}

// ---------------- RATINGS ----------------

async function loadRatings(){

  const box=document.getElementById("staffRatings");
  if(!box) return;

  const staff = await post("getStaff");
  staffCache = staff;

  const existing = await post("getRatings",{month:month()});

  box.innerHTML="";

  staff.forEach(s=>{

    if(!s.isActive) return;

    const isYou = s.discordId === userId;

    const my = existing.find(e=>e.targetId===s.discordId);

    const div=document.createElement("div");
    div.className="card";

    div.innerHTML=`
      <img src="${s.avatarURL||''}" class="avatar">
      <b>${s.name}</b>

      ${isYou ? `
        <div class="you-overlay">This is you!</div>
      ` : `
        <div class="rating-box">
          <select data-id="${s.discordId}">
            ${["Excels","On Par","Meets Standards","Below Par","Needs Work","N/A"]
              .map(v=>`<option ${my?.rating===v?"selected":""}>${v}</option>`).join("")}
          </select>

          <textarea data-id="${s.discordId}">${my?.comment||""}</textarea>
        </div>
      `}
    `;

    box.appendChild(div);
  });

  document.querySelectorAll("select,textarea").forEach(el=>{
    el.addEventListener("change",saveRatings);
  });
}

async function saveRatings(){

  const ratings=[];

  document.querySelectorAll("select").forEach(sel=>{

    const id=sel.dataset.id;
    if(!id || id===userId) return;

    const comment=document.querySelector(`textarea[data-id="${id}"]`)?.value||"";

    if(sel.value==="N/A") return;

    ratings.push({
      targetId:id,
      rating:sel.value,
      comment
    });
  });

  await post("saveRatings",{
    reviewerId:userId,
    token,
    month:month(),
    ratings
  });
}

// ---------------- NOTES (FIXED VISUAL + STRUCTURE) ----------------

async function loadNotes(){

  const box=document.getElementById("staffNotes");
  if(!box) return;

  const staff=await post("getStaff");
  const notes=await post("getNotes",{month:month()});

  box.innerHTML="";

  staff.forEach(s=>{

    const isYou=s.discordId===userId;
    const list=notes[s.discordId]||[];

    const div=document.createElement("div");
    div.className="card notes-card";

    div.innerHTML=`
      <img src="${s.avatarURL||''}" class="avatar">
      <b>${s.name}</b>

      <div class="note-list">
        ${list.length
          ? list.map(n=>`
              <div class="note ${n.type}">
                ${n.type==="positive"?"👍":"👎"} ${n.note}
              </div>
            `).join("")
          : "<i>No notes</i>"
        }
      </div>

      ${isYou ? `<div class="you-overlay">This is you!</div>` : `
        <textarea data-id="${s.discordId}" placeholder="Add note..."></textarea>
        <button onclick="addNote('${s.discordId}','positive')">👍</button>
        <button onclick="addNote('${s.discordId}','negative')">👎</button>
      `}
    `;

    box.appendChild(div);
  });
}

async function addNote(id,type){

  const input=document.querySelector(`textarea[data-id="${id}"]`);
  const text=input?.value;

  if(!text || !text.trim()) return;

  await post("saveNote",{
    month:month(),
    authorId:userId,
    token,
    targetId:id,
    type,
    note:text
  });

  loadNotes();
}

// ---------------- ADMIN (FIXED ACCURACY) ----------------

async function loadAdmin(){

  const box=document.getElementById("adminPanel");
  if(!box) return;

  const ratings=await post("getRatings",{month:month()});
  const staff=staffCache.length?staffCache:await post("getStaff");

  let map={};

  staff.forEach(s=>{
    map[s.discordId]={
      name:s.name,
      avatarURL:s.avatarURL,
      count:0
    };
  });

  ratings.forEach(r=>{
    if(map[r.targetId]){
      map[r.targetId].count++;
    }
  });

  box.innerHTML="";

  Object.values(map).forEach(s=>{
    const div=document.createElement("div");
    div.className="card";

    div.innerHTML=`
      <img src="${s.avatarURL||''}" class="avatar">
      <b>${s.name}</b>
      <div>Ratings: ${s.count}</div>
    `;

    box.appendChild(div);
  });
}

// ---------------- INIT ----------------

(async()=>{
  try{

    await verify();
    setupTabs();

    await loadRatings();
    await loadNotes();
    await loadAdmin();

  }catch(e){
    console.error(e);
    document.body.innerHTML="❌ Failed to load";
  }
})();