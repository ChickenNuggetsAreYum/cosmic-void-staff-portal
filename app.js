const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

function month(){
  return new Date().toISOString().slice(0,7);
}

// ---------------- SAFE FETCH ----------------

async function post(action,data={}){
  try {
    const res = await fetch(API,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({action,...data})
    });

    const text = await res.text();
    return JSON.parse(text);

  } catch (e) {
    console.error("API ERROR:", action, e);
    return {};
  }
}

// ---------------- NAV ----------------

function setupNav(){
  document.querySelectorAll(".menu a").forEach(a=>{
    a.addEventListener("click",(e)=>{
      e.preventDefault();

      const page = a.dataset.page;

      document.getElementById("ratingsPage").classList.add("hidden");
      document.getElementById("notesPage").classList.add("hidden");

      document.getElementById(page + "Page").classList.remove("hidden");
    });
  });

  // default page
  document.getElementById("ratingsPage").classList.remove("hidden");
}

// ---------------- VERIFY ----------------

async function verify(){
  const res = await post("verifyUser",{discordId:userId,token});

  if(!res.valid){
    document.body.innerHTML="❌ Unauthorized";
    throw new Error();
  }
}

// ---------------- RATINGS ----------------

async function loadRatings(){

  const box = document.getElementById("ratingsBox");
  if(!box) return;

  const staff = await post("getStaff");
  const existing = await post("getRatings",{month:month()});

  box.innerHTML="";

  staff.forEach(s=>{

    if(!s.isActive) return;

    const isYou = s.discordId === userId;
    const my = existing.find(e=>e.targetId===s.discordId);

    const div = document.createElement("div");
    div.className="card";

    div.innerHTML=`
      <img src="${s.avatarURL||''}">
      <div>
        <b>${s.name}</b>

        ${isYou ? `
          <p style="opacity:.6">This is you</p>
        ` : `
          <select data-id="${s.discordId}">
            ${["Excels","On Par","Meets Standards","Below Par","Needs Work","N/A"]
              .map(v=>`<option ${my?.rating===v?"selected":""}>${v}</option>`).join("")}
          </select>

          <textarea data-id="${s.discordId}">${my?.comment||""}</textarea>
        `}
      </div>
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

    const id = sel.dataset.id;
    if(!id || id===userId) return;

    const comment = document.querySelector(`textarea[data-id="${id}"]`)?.value || "";

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

// ---------------- NOTES ----------------

async function loadNotes(){

  const box=document.getElementById("notesBox");
  if(!box) return;

  const staff = await post("getStaff");
  const notes = await post("getNotes",{month:month()});

  box.innerHTML="";

  staff.forEach(s=>{

    const isYou = s.discordId === userId;
    const list = notes[s.discordId] || [];

    const div=document.createElement("div");
    div.className="card";

    div.innerHTML=`
      <img src="${s.avatarURL||''}">
      <div>
        <b>${s.name}</b>

        <div>
          ${list.length
            ? list.map(n=>`<div>${n.type==="positive"?"👍":"👎"} ${n.note}</div>`).join("")
            : "<i>No notes</i>"
          }
        </div>

        ${isYou ? `<p style="opacity:.6">This is you</p>` : `
          <textarea data-id="${s.discordId}"></textarea>
          <button onclick="addNote('${s.discordId}','positive')">👍</button>
          <button onclick="addNote('${s.discordId}','negative')">👎</button>
        `}
      </div>
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

// ---------------- INIT (NO CRASH LOADING FIX) ----------------

(async()=>{
  try {

    await verify();
    setupNav();

    await loadRatings();
    await loadNotes();

  } catch (e) {
    console.error(e);
    document.body.innerHTML="❌ Failed to load portal";
  }
})();