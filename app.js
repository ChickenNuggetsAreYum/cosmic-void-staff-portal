const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

 params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

function month() {
  return new Date().toISOString().slice(0, 7);
}

// ---------------- SAFE FETCH ----------------

async function post(action, data = {}) {
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data })
    });

    return await res.json();
  } catch (err) {
    console.error("API error:", err);
    return null;
  }
}

// ---------------- AUTH ----------------

async function verify() {
  if (!userId || !token) {
    throw new Error("Missing credentials");
  }

  const res = await post("verifyUser", {
    discordId: userId,
    token
  });

  if (!res || !res.valid) {
    throw new Error("Unauthorized");
  }

  // hide admin safely (no flicker)
  const adminTab = document.getElementById("adminTab");
  if (adminTab && !res.isWebAdmin) {
    adminTab.style.display = "none";
  }

  return res;
}

// ---------------- TABS ----------------

function setupTabs() {
  document.querySelectorAll(".channel").forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
      document.querySelectorAll(".channel").forEach(c => c.classList.remove("active"));

      tab.classList.add("active");

      const el = document.getElementById(target);
      if (el) el.classList.remove("hidden");
    });
  });
}

// ---------------- RATINGS ----------------

async function loadRatings() {
  const container = document.getElementById("staffRatings");
  if (!container) return;

  const staff = await post("getStaff");
  if (!staff) return;

  container.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive) return;

    const isYou = s.discordId === userId;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL || ''}">
      <div style="flex:1">
        <b>${s.name || "Unknown"} ${isYou ? "(You)" : ""}</b>

        ${isYou ? `<div style="opacity:.7">This is you</div>` : `
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

    container.appendChild(div);
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

    const commentEl = document.querySelector(`textarea[data-id="${id}"]`);

    ratings.push({
      targetId: id,
      rating: sel.value,
      comment: commentEl ? commentEl.value : ""
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
  const container = document.getElementById("staffNotes");
  if (!container) return;

  const data = await post("getNotes", {
    month: month(),
    authorId: userId,
    token
  });

  if (!data) return;

  container.innerHTML = "";

  for (const targetId in data) {
    const notes = data[targetId];

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <b>${targetId}</b><br>
      ${notes.map(n => `• ${n.note || ""}`).join("<br>")}
    `;

    container.appendChild(div);
  }
}

// ---------------- ADMIN ----------------

async function loadAdmin() {
  const panel = document.getElementById("adminPanel");
  if (!panel) return;

  const staff = await post("getStaff");
  const ratings = await post("getRatings", {
    month: month(),
    reviewerId: userId,
    token
  });

  const notes = await post("getNotes", {
    month: month(),
    authorId: userId,
    token
  });

  if (!staff) return;

  panel.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive) return;

    const r = (ratings || []).filter(x => x.targetId === s.discordId);
    const n = (notes || {})[s.discordId] || [];

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL || ''}">
      <div style="flex:1">
        <b>${s.name}</b><br>
        Rating: ${r[0]?.rating || "N/A"}<br><br>
        Notes:<br>
        ${n.map(x => `• ${x.note}`).join("<br>") || "None"}
      </div>
    `;

    panel.appendChild(div);
  });
}

// ---------------- INIT (NO FREEZES EVER) ----------------

(async () => {
  try {
    await verify();
    setupTabs();

    await loadRatings();
    await loadNotes();
    await loadAdmin();

  } catch (err) {
    console.error(err);
    document.body.innerHTML = "❌ Failed to load Cosmic Void Staff Portal";
  } finally {
    const loader = document.getElementById("loadingScreen");
    const app = document.getElementById("app");

    if (loader) loader.style.display = "none";
    if (app) app.classList.remove("hidden");
  }
})();