const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

let staffData = [];

function month() {
  return new Date().toISOString().slice(0, 7);
}

// ---------------- API ----------------

async function post(action, data = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data })
  });

  return res.json();
}

// ---------------- AUTH (NO FLASH) ----------------

async function verify() {
  if (!userId || !token) {
    document.body.innerHTML = "❌ Missing credentials";
    throw new Error();
  }

  const res = await post("verifyUser", {
    discordId: userId,
    token
  });

  if (!res.valid) {
    document.body.innerHTML = "❌ Unauthorized";
    throw new Error();
  }

  document.getElementById("app").classList.remove("hidden");

  if (!res.isWebAdmin) {
    document.getElementById("adminTab").style.display = "none";
  }

  return res;
}

// ---------------- TAB SYSTEM (FIXED ACTIVE STATE) ----------------

function setupTabs() {
  document.querySelectorAll(".channel").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));

      document.querySelectorAll(".channel").forEach(c => c.classList.remove("active"));

      btn.classList.add("active");

      document.getElementById(btn.dataset.tab).classList.remove("hidden");
    };
  });
}

// ---------------- HOME ----------------

async function loadHome() {
  const res = await post("getDashboardStatus", { month: month() });

  document.getElementById("statusText").innerText =
    `📊 ${res.completed} / ${res.totalStaff} completed`;
}

// ---------------- RATINGS (AUTO SAVE) ----------------

async function loadRatings() {
  staffData = await post("getStaff");

  const c = document.getElementById("staffRatings");
  c.innerHTML = "";

  staffData.forEach(s => {
    if (!s.isActive) return;

    const isYou = s.discordId === userId;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL}">

      <div style="flex:1">
        <b>${s.name} ${isYou ? "(You)" : ""}</b>

        ${isYou ? `<div style="opacity:.7">This is you!</div>` : `
          <select data-id="${s.discordId}">
            <option>Excels</option>
            <option>On Par</option>
            <option>Meets Standards</option>
            <option>Below Par</option>
            <option>Needs Work</option>
            <option>N/A</option>
          </select>

          <textarea data-id="${s.discordId}" placeholder="Comment"></textarea>
        `}
      </div>
    `;

    c.appendChild(div);
  });

  // auto-save (no button)
  document.querySelectorAll("select, textarea").forEach(el => {
    el.onchange = saveRatings;
  });
}

async function saveRatings() {
  const ratings = [];

  document.querySelectorAll("select").forEach(sel => {
    const id = sel.dataset.id;
    if (!id) return;

    ratings.push({
      targetId: id,
      rating: sel.value,
      comment: document.querySelector(`textarea[data-id="${id}"]`)?.value || ""
    });
  });

  await post("saveRatings", {
    reviewerId: userId,
    token,
    month: month(),
    ratings
  });
}

// ---------------- NOTES ----------------

async function loadNotes() {
  const c = document.getElementById("staffNotes");
  const staff = staffData.length ? staffData : await post("getStaff");

  c.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive || s.discordId === userId) return;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL}">
      <div style="flex:1">
        <b>${s.name}</b>

        <button onclick="sendNote('${s.discordId}','up')">👍</button>
        <button onclick="sendNote('${s.discordId}','down')">👎</button>

        <textarea id="n-${s.discordId}" placeholder="Add note"></textarea>
      </div>
    `;

    c.appendChild(div);
  });
}

async function sendNote(id, type) {
  const note = document.getElementById(`n-${id}`).value;

  await post("saveNote", {
    authorId: userId,
    token,
    targetId: id,
    type,
    note,
    month: month()
  });
}

// ---------------- INIT (CRITICAL ORDER FIX) ----------------

(async () => {
  await verify();

  setupTabs();

  await loadHome();
  await loadRatings();
  await loadNotes();
})();