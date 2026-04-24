const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

function month() {
  return new Date().toISOString().slice(0, 7);
}

async function post(action, data = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data })
  });

  return res.json();
}

// ---------------- AUTH ----------------

let isAdmin = false;

async function verify() {
  if (!userId || !token) {
    document.body.innerHTML = "Missing credentials";
    return;
  }

  const res = await post("verifyUser", { discordId: userId, token });

  if (!res.valid) {
    document.body.innerHTML = "Unauthorized";
    return;
  }

  isAdmin = res.isWebAdmin;

  const adminTab = document.getElementById("adminTab");
  if (adminTab && !isAdmin) adminTab.style.display = "none";
}

// ---------------- TABS ----------------

function setupTabs() {
  document.querySelectorAll(".channel").forEach(t => {
    t.onclick = () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.add("hidden"));
      document.querySelectorAll(".channel").forEach(x => x.classList.remove("active"));

      t.classList.add("active");
      document.getElementById(t.dataset.tab).classList.remove("hidden");
    };
  });
}

// ---------------- RATINGS ----------------

async function loadRatings() {
  const staff = await post("getStaff");
  const existing = await post("getRatings", { month: month() });

  const box = document.getElementById("staffRatings");
  box.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive) return;

    const my = existing.find(e => e.targetId === s.discordId);
    const isYou = s.discordId === userId;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL || ''}" class="avatar">
      <b>${s.name} ${isYou ? "(You)" : ""}</b>

      ${isYou ? `<div>This is you!</div>` : `
        <select data-id="${s.discordId}">
          ${["Excels","On Par","Meets Standards","Below Par","Needs Work","N/A"]
            .map(v => `<option ${my?.rating === v ? "selected" : ""}>${v}</option>`).join("")}
        </select>

        <textarea data-id="${s.discordId}">${my?.comment || ""}</textarea>
      `}
    `;

    box.appendChild(div);
  });

  document.querySelectorAll("select, textarea").forEach(e => {
    e.onchange = saveRatings;
  });
}

async function saveRatings() {
  const ratings = [];

  document.querySelectorAll("select").forEach(sel => {
    const id = sel.dataset.id;
    const comment = document.querySelector(`textarea[data-id="${id}"]`)?.value || "";

    if (!id || sel.value === "N/A") return;

    ratings.push({
      targetId: id,
      rating: sel.value,
      comment
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
  const staff = await post("getStaff");
  const notes = await post("getNotes", { month: month() });

  const box = document.getElementById("staffNotes");
  box.innerHTML = "";

  staff.forEach(s => {
    const n = notes[s.discordId] || [];
    const isYou = s.discordId === userId;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL || ''}" class="avatar">
      <b>${s.name}</b>

      ${n.map(x => `<div>${x.type === "positive" ? "👍" : "👎"} ${x.note}</div>`).join("")}

      ${!isYou ? `
        <textarea data-id="${s.discordId}"></textarea>
        <button onclick="addNote('${s.discordId}','positive')">👍</button>
        <button onclick="addNote('${s.discordId}','negative')">👎</button>
      ` : `<div>This is you!</div>`}
    `;

    box.appendChild(div);
  });
}

async function addNote(id, type) {
  const text = document.querySelector(`textarea[data-id="${id}"]`)?.value;
  if (!text || !text.trim()) return;

  await post("saveNote", {
    month: month(),
    authorId: userId,
    token,
    targetId: id,
    type,
    note: text
  });

  loadNotes();
}

// ---------------- ADMIN ----------------

async function loadAdmin() {
  const data = await post("getDashboard", { month: month() });

  const box = document.getElementById("adminPanel");
  box.innerHTML = "";

  data.forEach(s => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL || ''}" class="avatar">
      <b>${s.name}</b><br>
      Ratings: ${s.ratings}
    `;

    box.appendChild(div);
  });
}

// ---------------- INIT ----------------

(async () => {
  await verify();
  setupTabs();
  await loadRatings();
  await loadNotes();
  await loadAdmin();
})();