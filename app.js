const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

let staffCache = [];

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

// ---------------- AUTH ----------------

async function verify() {
  const res = await post("verifyUser", {
    discordId: userId,
    token
  });

  if (!res.valid) {
    document.body.innerHTML = "❌ Unauthorized";
    throw new Error();
  }

  if (!res.isWebAdmin) {
    document.getElementById("adminTab").style.display = "none";
  }

  return res;
}

// ---------------- TABS ----------------

function setupTabs() {
  document.querySelectorAll(".channel").forEach(t => {
    t.onclick = () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.add("hidden"));
      document.querySelectorAll(".channel").forEach(c => c.classList.remove("active"));

      t.classList.add("active");
      document.getElementById(t.dataset.tab).classList.remove("hidden");
    };
  });
}

// ---------------- RATINGS ----------------

async function loadRatings() {
  staffCache = await post("getStaff");

  const c = document.getElementById("staffRatings");
  c.innerHTML = "";

  staffCache.forEach(s => {
    if (!s.isActive) return;

    const isYou = s.discordId === userId;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL}">
      <div style="flex:1">
        <b>${s.name} ${isYou ? "(You)" : ""}</b>

        ${isYou ? `<div>📌 This is you!</div>` : `
          <select data-id="${s.discordId}">
            <option>Excels</option>
            <option>On Par</option>
            <option>Meets Standards</option>
            <option>Below Par</option>
            <option>Needs Work</option>
            <option>N/A</option>
          </select>

          <textarea data-id="${s.discordId}"></textarea>
        `}
      </div>
    `;

    c.appendChild(div);
  });

  document.querySelectorAll("select, textarea").forEach(x => {
    x.onchange = saveRatings;
  });
}

async function saveRatings() {
  const ratings = [];

  document.querySelectorAll("select").forEach(s => {
    const id = s.dataset.id;
    if (!id) return;

    ratings.push({
      targetId: id,
      rating: s.value,
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
  const data = await post("getNotes", {
    month: month(),
    authorId: userId
  });

  const c = document.getElementById("staffNotes");
  c.innerHTML = "";

  for (const targetId in data) {
    const notes = data[targetId];

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <b>${targetId}</b><br>
      ${notes.map(n => `• ${n.note}`).join("<br>")}
    `;

    c.appendChild(div);
  }
}

// ---------------- ADMIN ----------------

async function loadAdmin() {
  const months = await post("getAvailableMonths");
  const latest = months[0];

  const data = await post("getAdminMonthData", {
    month: latest
  });

  const staff = await post("getStaff");

  const c = document.getElementById("adminPanel");
  c.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive) return;

    const r = data.ratings.filter(x => x.targetId === s.discordId);
    const n = data.notes[s.discordId] || [];

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL}">
      <div style="flex:1">
        <b>${s.name}</b><br>
        Rating: ${r[0]?.rating || "N/A"}<br><br>

        Notes:<br>
        ${n.map(x => `• ${x.note}`).join("<br>") || "None"}
      </div>
    `;

    c.appendChild(div);
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