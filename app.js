const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

function month() {
  return new Date().toISOString().slice(0, 7);
}

// ---------------- FETCH ----------------

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
  const res = await post("verifyUser", { discordId: userId, token });

  if (!res.valid) {
    document.body.innerHTML = "❌ Unauthorized";
    throw new Error("Unauthorized");
  }

  isAdmin = res.isWebAdmin || false;

  const adminTab = document.getElementById("adminTab");
  if (adminTab && !isAdmin) adminTab.style.display = "none";
}

// ---------------- TAB SYSTEM (FIXED) ----------------

function setupTabs() {
  const tabs = document.querySelectorAll(".channel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      // remove active styling
      tabs.forEach(t => t.classList.remove("active"));

      // hide all panels
      document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));

      // activate clicked tab
      tab.classList.add("active");

      // show correct panel
      const el = document.getElementById(target);
      if (el) el.classList.remove("hidden");
    });
  });
}

// ---------------- RATINGS ----------------

async function loadRatings() {
  const staff = await post("getStaff");
  const existing = await post("getRatings", {
    month: month()
  });

  const container = document.getElementById("staffRatings");
  if (!container) return;

  container.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive) return;

    const my = existing.find(e => e.targetId === s.discordId);

    const isYou = s.discordId === userId;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL || ''}">

      <div style="flex:1">
        <b>${s.name} ${isYou ? "(You)" : ""}</b>

        ${isYou ? `
          <div style="opacity:0.7; margin-top:5px;">This is you!</div>
        ` : `
          <select data-id="${s.discordId}">
            ${["Excels","On Par","Meets Standards","Below Par","Needs Work","N/A"]
              .map(v => `<option ${my?.rating === v ? "selected" : ""}>${v}</option>`).join("")}
          </select>

          <textarea data-id="${s.discordId}">${my?.comment || ""}</textarea>
        `}
      </div>
    `;

    container.appendChild(div);
  });

  document.querySelectorAll("select, textarea").forEach(el => {
    el.onchange = saveRatings;
  });
}

// ---------------- SAVE RATINGS ----------------

async function saveRatings() {
  const ratings = [];

  document.querySelectorAll("select").forEach(sel => {
    const id = sel.dataset.id;
    if (!id) return;

    const comment = document.querySelector(`textarea[data-id="${id}"]`)?.value || "";

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
  const notes = await post("getNotes", {
    month: month()
  });

  const container = document.getElementById("staffNotes");
  if (!container) return;

  container.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive) return;

    const isYou = s.discordId === userId;
    const n = notes[s.discordId] || [];

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <b>${s.name} ${isYou ? "(You)" : ""}</b>

      ${isYou ? `<div style="opacity:0.7">This is you!</div>` : ""}

      <div style="margin-top:5px;">
        ${n.map(x => `
          <div>${x.type === "positive" ? "👍" : "👎"} ${x.note}</div>
        `).join("") || "<i>No notes</i>"}
      </div>

      ${!isYou ? `
        <textarea data-id="${s.discordId}"></textarea>
        <button onclick="addNote('${s.discordId}','positive')">👍</button>
        <button onclick="addNote('${s.discordId}','negative')">👎</button>
      ` : ""}
    `;

    container.appendChild(div);
  });
}

// ---------------- ADD NOTE ----------------

async function addNote(id, type) {
  const text = document.querySelector(`textarea[data-id="${id}"]`)?.value;

  if (!text) return;

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

  const container = document.getElementById("adminPanel");
  if (!container) return;

  container.innerHTML = "";

  data.forEach(s => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <b>${s.name}</b><br>
      Ratings: ${s.ratings}
    `;

    container.appendChild(div);
  });
}

// ---------------- INIT ----------------

(async () => {
  try {
    await verify();
    setupTabs();

    await loadRatings();
    await loadNotes();
    await loadAdmin();

  } catch (e) {
    console.error(e);
    document.body.innerHTML = "❌ Failed to load dashboard";
  } finally {
    document.getElementById("loadingScreen")?.remove();
    document.getElementById("app")?.classList.remove("hidden");
  }
})();