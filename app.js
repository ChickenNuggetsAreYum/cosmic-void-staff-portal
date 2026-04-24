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

// ---------------- AUTH (NO FLASH EVER) ----------------

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

  if (!res.isWebAdmin) {
    document.getElementById("adminTab").style.display = "none";
  }

  return res;
}

// ---------------- TAB SYSTEM ----------------

function setupTabs() {
  document.querySelectorAll(".channel").forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
      document.querySelectorAll(".channel").forEach(c => c.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.remove("hidden");
    };
  });
}

// ---------------- RATINGS ----------------

async function loadRatings() {
  staffCache = await post("getStaff");

  const c = document.getElementById("staffRatings");
  c.innerHTML = "";

  staffCache.forEach(s => {
    if (!s.isActive || s.discordId === userId) return;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL}">
      <div style="flex:1">
        <b>${s.name}</b>

        <select data-id="${s.discordId}">
          <option>Excels</option>
          <option>On Par</option>
          <option>Meets Standards</option>
          <option>Below Par</option>
          <option>Needs Work</option>
          <option>N/A</option>
        </select>

        <textarea data-id="${s.discordId}" placeholder="Comment"></textarea>
      </div>
    `;

    c.appendChild(div);
  });

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

// ---------------- NOTES (WITH HISTORY) ----------------

async function loadNotes() {
  const notes = await post("getNotes", {
    authorId: userId,
    month: month()
  });

  const c = document.getElementById("notesHistory");
  c.innerHTML = "";

  if (!notes.length) {
    c.innerHTML = "<p>No notes this month.</p>";
    return;
  }

  notes.forEach(n => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <b>${n.targetId}</b><br>
      ${n.type === "positive" ? "👍" : "👎"}<br>
      ${n.note}
    `;

    c.appendChild(div);
  });
}

// ---------------- INIT (ORDER FIX = NO LOADING BUGS) ----------------

(async () => {
  await verify();

  setupTabs();

  await loadRatings();
  await loadNotes();

  document.getElementById("loadingScreen").style.display = "none";
  document.getElementById("app").classList.remove("hidden");
})();