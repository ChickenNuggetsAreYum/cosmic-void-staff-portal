const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params = new URLSearchParams(location.search);
const userId = params.get("id");
const token = params.get("token");

function month(){
  return new Date().toISOString().slice(0,7);
}

async function post(action,data={}){
  const r = await fetch(API,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ action,...data })
  });
  return r.json();
}

let isAdmin=false;

(async()=>{
  const v = await post("verifyUser",{ discordId:userId, token });

  if(!v.valid){
    document.body.innerHTML="Unauthorized";
    return;
  }

  isAdmin = v.isWebAdmin;

  if(!isAdmin){
    document.getElementById("adminTab").style.display="none";
  }

  document.getElementById("loading").style.display="none";
  document.getElementById("app").classList.remove("hidden");

  setupTabs();
  loadRatings();
  loadNotes();
})();

function setupTabs(){
  document.querySelectorAll(".channel").forEach(t=>{
    t.onclick=()=>{
      document.querySelectorAll(".tab").forEach(x=>x.classList.add("hidden"));
      document.getElementById(t.dataset.tab).classList.remove("hidden");
    };
  });
}

async function loadRatings(){
  const staff = await post("getStaff");
  const ratings = await post("getRatings",{month:month()});

  const box = document.getElementById("ratings");
  box.innerHTML="";

  staff.forEach(s=>{
    const my = ratings.find(r=>r.targetId===s.discordId);

    box.innerHTML += `
      <div class="card">
        <b>${s.name}</b>
        <select>
          <option ${my?.rating==="Excels"?"selected":""}>Excels</option>
          <option>On Par</option>
          <option>Meets Standards</option>
          <option>Below Par</option>
          <option>Needs Work</option>
          <option>N/A</option>
        </select>
      </div>
    `;
  });
}

async function loadNotes(){
  const box=document.getElementById("notes");
  box.innerHTML="Notes loaded";
}