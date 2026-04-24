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
    throw new Error();
  }

  const res = await post("verifyUser", {
    discordId: userId,
    token
  });

  if (!res.valid) {
    document.body.innerHTML = "<h2>❌ Invalid access</h2>";
    throw new Error();
  }

  return res;
}

// ---------------- NAV ----------------

function setupNav(isAdmin) {
  const admin = document.getElementById("adminLink");

  if (admin) {
    admin.style.display = isAdmin ? "inline-block" : "none";
    admin.href = `admin.html?id=${userId}&token=${token}`;
  }

  document.getElementById("homeLink").href =
    `index.html?id=${userId}&token=${token}`;

  document.getElementById("ratingsLink").href =
    `ratings.html?id=${userId}&token=${token}`;

  document.getElementById("notesLink").href =
    `notes.html?id=${userId}&token=${token}`;
}

// ---------------- DASHBOARD ----------------

async function loadDashboard() {
  const el = document.getElementById("statusText");
  if (!el) return;

  el.innerText = "Loading...";

  const data = await post("getDashboardStatus", {
    month: month()
  });

  el.innerText = `📊 ${data.completed} / ${data.totalStaff} completed`;

  return data;
}

// ---------------- INIT ----------------

(async () => {
  const auth = await verifyAccess();

  setupNav(auth.isWebAdmin);

  const dash = await loadDashboard();

  const staff = await post("getStaff");

  if (document.getElementById("staffList")) loadRatings(staff);
  if (document.getElementById("notesList")) loadNotes(staff, dash);
  if (document.getElementById("adminPanel")) loadAdmin(auth);
})();

// ---------------- RATINGS ----------------

function loadRatings(staff) {
  const c = document.getElementById("staffList");
  if (!c) return;

  c.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive) return;

    const div = document.createElement("div");
    div.className = "card";

    if (s.discordId === userId) {
      div.innerHTML = `<b>${s.name} (You)</b>`;
      return;
    }

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

    c.appendChild(div);
  });
}

// ---------------- NOTES ----------------

function loadNotes(staff, dash) {
  const c = document.getElementById("notesList");
  if (!c) return;

  c.innerHTML = "";

  const locked = !dash.allComplete;

  staff.forEach(s => {
    if (!s.isActive || s.discordId === userId) return;

    const div = document.createElement("div");
    div.className = "card";

    if (locked) {
      div.innerHTML = `<b>${s.name}</b><p>🔒 Locked until ratings complete</p>`;
    } else {
      div.innerHTML = `
        <img src="${s.avatarURL}">
        <b>${s.name}</b>

        <button onclick="sendNote('${s.discordId}','positive')">👍</button>
        <button onclick="sendNote('${s.discordId}','negative')">👎</button>

        <textarea id="n-${s.discordId}"></textarea>
      `;
    }

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

  alert("Saved");
}   