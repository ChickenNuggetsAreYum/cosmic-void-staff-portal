const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

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

  return await res.json();
}

// ---------------- AUTH ----------------

async function verifyAccess() {
  if (!userId || !token) {
    document.body.innerHTML = "<h2>❌ Missing credentials</h2>";
    return null;
  }

  const res = await post("verifyUser", {
    discordId: userId,
    token
  });

  if (!res || res.valid !== true) {
    document.body.innerHTML = "<h2>❌ Invalid login</h2>";
    return null;
  }

  return res;
}

// ---------------- DASHBOARD ----------------

async function loadDashboard() {
  const el = document.getElementById("statusText");
  if (!el) return;

  const data = await post("getDashboardStatus", {
    month: month()
  });

  el.innerText =
    `📊 ${data.completed} / ${data.totalStaff} completed`;

  return data;
}

// ---------------- NAV ----------------

function setupNav(isAdmin) {
  const admin = document.getElementById("adminLink");
  if (admin) admin.style.display = isAdmin ? "inline-block" : "none";

  document.getElementById("ratingsLink").href =
    `ratings.html?id=${userId}&token=${token}`;

  document.getElementById("notesLink").href =
    `notes.html?id=${userId}&token=${token}`;
}

// ---------------- INIT ----------------

(async () => {
  const auth = await verifyAccess();
  if (!auth) return;

  setupNav(auth.isWebAdmin === true);

  const dash = await loadDashboard();

  const staff = await post("getStaff");

  if (document.getElementById("staffList")) {
    loadRatings(staff);
  }

  if (document.getElementById("notesList")) {
    loadNotes(staff, dash);
  }
})();

// ---------------- RATINGS ----------------

function loadRatings(staff) {
  const container = document.getElementById("staffList");
  if (!container) return;

  container.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive) return;

    const div = document.createElement("div");
    div.className = "card";

    if (s.discordId === userId) {
      div.innerHTML = `<b>${s.name} (You)</b>`;
    } else {
      div.innerHTML = `
        <img src="${s.avatarURL}">
        <b>${s.name}</b>

        <select data-id="${s.discordId}">
          <option>Excels</option>
          <option>On Par</option>
          <option>Meets Standards</option>
          <option>Below Par</option>
          <option>Needs Work</option>
          <option>N/A</option>
        </select>

        <textarea data-comment="${s.discordId}" placeholder="Comment"></textarea>
      `;
    }

    container.appendChild(div);
  });
}

// ---------------- NOTES (LOCKED LOGIC) ----------------

function loadNotes(staff, dash) {
  const container = document.getElementById("notesList");
  if (!container) return;

  container.innerHTML = "";

  const locked = !dash.allComplete;

  staff.forEach(s => {
    if (!s.isActive || s.discordId === userId) return;

    const div = document.createElement("div");
    div.className = "card";

    if (locked) {
      div.innerHTML = `<b>${s.name}</b><p>🔒 Locked until all ratings are completed</p>`;
    } else {
      div.innerHTML = `
        <img src="${s.avatarURL}">
        <b>${s.name}</b>

        <button onclick="sendNote('${s.discordId}','positive')">👍</button>
        <button onclick="sendNote('${s.discordId}','negative')">👎</button>

        <textarea id="n-${s.discordId}" placeholder="Note"></textarea>
      `;
    }

    container.appendChild(div);
  });
}

// ---------------- SAVE NOTE ----------------

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

  alert("Saved!");
}