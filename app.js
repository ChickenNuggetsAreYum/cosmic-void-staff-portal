const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params=new URLSearchParams(location.search);
const userId=params.get("id");
const token=params.get("token");

function month(){
  return new Date().toISOString().slice(0,7);
}

async function post(a,d={}){
  const r=await fetch(API,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:a,...d})
  });
  return r.json();
}

let me=null;
let isAdmin=false;

(async()=>{

  const v=await post("verifyUser",{discordId:userId,token});

  if(!v.valid){
    document.body.innerHTML="Unauthorized";
    return;
  }

  me=v;
  isAdmin=v.isWebAdmin;

  if(!isAdmin)
    document.querySelector('[data-tab="admin"]').style.display="none";

  document.getElementById("loading").style.display="none";
  document.getElementById("app").classList.remove("hidden");

  setupTabs();
  loadRatings();
  loadAdmin();

})();

// ---------------- TABS ----------------

function setupTabs(){
  document.querySelectorAll(".channel").forEach(t=>{
    t.onclick=()=>{
      document.querySelectorAll(".tab").forEach(x=>x.classList.add("hidden"));
      document.getElementById(t.dataset.tab).classList.remove("hidden");
    };
  });
}

// ---------------- RATINGS ----------------

async function loadRatings(){

  const staff=await post("getStaff");
  const saved=await post("getRatings",{month:month()});

  const box=document.getElementById("ratings");
  box.innerHTML="";

  staff.forEach(s=>{

    const my=saved.find(r=>
      r.targetId===s.discordId &&
      r.reviewerId===userId
    );

    const isYou=s.discordId===userId;

    box.innerHTML+=`
      <div class="card">
        <img src="${s.avatarURL}" class="pfp">

        <div>
          <b>${s.name}</b>
          ${isYou?`<span class="you">This is you!</span>`:""}
        </div>

        <select data-id="${s.discordId}">
          ${["Excels","On Par","Meets Standards","Below Par","Needs Work","N/A"]
          .map(v=>`
            <option ${my?.rating===v?"selected":""}>${v}</option>
          `).join("")}
        </select>

        <textarea data-id="${s.discordId}">${my?.comment||""}</textarea>
      </div>
    `;
  });

  document.querySelectorAll("select,textarea").forEach(el=>{
    el.onchange=saveRatings;
  });
}

// ---------------- SAVE ----------------

async function saveRatings(){

  const ratings=[];

  document.querySelectorAll("select").forEach(sel=>{
    const id=sel.dataset.id;
    const comment=document.querySelector(`textarea[data-id="${id}"]`)?.value||"";

    if(sel.value==="N/A") return;

    ratings.push({
      targetId:id,
      rating:sel.value,
      comment
    });
  });

  await post("saveRatings",{
    month:month(),
    reviewerId:userId,
    ratings
  });
}

// ---------------- ADMIN ----------------

async function loadAdmin(){

  const box=document.getElementById("admin");

  const data=await post("getDashboard",{month:month()});

  box.innerHTML=data.map(s=>`
    <div class="card">
      <img src="${s.avatarURL}" class="pfp">
      <b>${s.name}</b>
      <div>Ratings: ${s.ratings}</div>
    </div>
  `).join("");
}