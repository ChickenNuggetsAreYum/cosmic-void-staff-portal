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
  if (!userId || !token) {
    document.body.innerHTML = "❌ Missing credentials";
    throw new Error();
  }

  const res = await post("verifyUser", { discordId: userId, token });

  if (!res.valid) {
    document.body.innerHTML = "❌ Unauthorized";
    throw new Error();
  }

  isAdmin = res.isWebAdmin;

  const adminTab = document.getElementById("adminTab");
  if (adminTab && !isAdmin) adminTab.style.display = "none";
}

// ---------------- TABS ----------------

function setupTabs() {
  const tabs = document.querySelectorAll(".channel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      document.querySelectorAll(".channel").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));

      tab.classList.add("active");

      const page = document.getElementById(target);
      if (page) page.classList.remove("hidden");
    });
  });
}

// ---------------- RATINGS ----------------

async function loadRatings() {
  const box = document.getElementById("staffRatings");
  if (!box) return; // ✅ SAFE GUARD

  const staff = await post("getStaff");
  const existing = await post("getRatings", { month: month() });

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

      ${isYou ? `<div class="you-tag">This is you!</div>` : `
        <select data-id="${s.discordId}">
          ${["Excels","On Par","Meets Standards","Below Par","Needs Work","N/A"]
            .map(v => `<option ${my?.rating === v ? "selected" : ""}>${v}</option>`).join("")}
        </select>

        <textarea data-id="${s.discordId}">${my?.comment || ""}</textarea>
      `}
    `;

    box.appendChild(div);
  });

  document.querySelectorAll("select, textarea").forEach(el => {
    el.addEventListener("change", saveRatings);
  });
}

async function saveRatings() {
  const ratings = [];

  document.querySelectorAll("select").forEach(sel => {
    const id = sel.dataset.id;
    if (!id) return;

    const comment = document.querySelector(`textarea[data-id="${id}"]`)?.value || "";

    if (sel.value === "N/A") return;

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
  const box = document.getElementById("staffNotes");
  if (!box) return; // ✅ FIX CRASH

  const staff = await post("getStaff");
  const notes = await post("getNotes", { month: month() });

  box.innerHTML = "";

  staff.forEach(s => {
    const isYou = s.discordId === userId;
    const n = notes[s.discordId] || [];

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL || ''}" class="avatar">
      <b>${s.name} ${isYou ? "(You)" : ""}</b>

      <div class="notes">
        ${n.length
          ? n.map(x => `<div>${x.type === "positive" ? "👍" : "👎"} ${x.note}</div>`).join("")
          : "<i>No notes</i>"
        }
      </div>

      ${!isYou ? `
        <textarea data-id="${s.discordId}" placeholder="Write note..."></textarea>
        <button onclick="addNote('${s.discordId}','positive')">👍</button>
        <button onclick="addNote('${s.discordId}','negative')">👎</button>
      ` : `<div class="you-tag">This is you!</div>`}
    `;

    box.appendChild(div);
  });
}

async function addNote(id, type) {
  const input = document.querySelector(`textarea[data-id="${id}"]`);
  const text = input?.value;

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
  const box = document.getElementById("adminPanel");
  if (!box) return;

  const data = await post("getDashboard", { month: month() });

  box.innerHTML = "";

  if (!data.length) {
    box.innerHTML = "<i>No data yet</i>";
    return;
  }

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

// ---------------- INIT (SAFE PAGE-AWARE LOADING) ----------------

(async () => {
  try {
    await verify();
    setupTabs();

    if (document.getElementById("staffRatings")) {
      await loadRatings();
    }

    if (document.getElementById("staffNotes")) {
      await loadNotes();
    }

    if (document.getElementById("adminPanel")) {
      await loadAdmin();
    }

  } catch (e) {
    console.error(e);
    document.body.innerHTML = "❌ Failed to load portal";
  }
})();