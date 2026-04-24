const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

function month() {
  return new Date().toISOString().slice(0, 7);
}

// ---------------- API WRAPPER ----------------

async function post(action, data = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action, ...data })
  });

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Bad API response:", text);
    throw new Error("Invalid server response");
  }
}

// ---------------- AUTH ----------------

async function verifyAccess() {
  if (!userId || !token) {
    document.body.innerHTML = "<h2>❌ Missing credentials</h2>";
    return null;
  }

  try {
    const res = await post("verifyUser", {
      discordId: userId,
      token: token
    });

    if (!res || res.valid !== true) {
      document.body.innerHTML = "<h2>❌ Invalid or expired login</h2>";
      return null;
    }

    return res;
  } catch (e) {
    console.error(e);
    document.body.innerHTML = "<h2>❌ Unable to verify access</h2>";
    return null;
  }
}

// ---------------- NAV ----------------

function setupNav(isAdmin) {
  const nav = document.querySelector(".nav");
  const adminLink = document.getElementById("adminLink");

  // prevent flash
  if (nav) nav.style.visibility = "visible";

  if (adminLink) {
    if (isAdmin) {
      adminLink.style.display = "inline-block";
      adminLink.href = `admin.html?id=${userId}&token=${token}`;
    } else {
      adminLink.style.display = "none";
    }
  }

  const ratingsLink = document.getElementById("ratingsLink");
  const notesLink = document.getElementById("notesLink");

  if (ratingsLink) {
    ratingsLink.href = `ratings.html?id=${userId}&token=${token}`;
  }

  if (notesLink) {
    notesLink.href = `notes.html?id=${userId}&token=${token}`;
  }
}

// ---------------- STATUS ----------------

async function loadStatus() {
  const el = document.getElementById("statusText");
  if (!el) return;

  el.innerText = "Loading...";

  try {
    const staff = await post("getStaff");

    if (!Array.isArray(staff)) throw new Error("Bad staff data");

    const active = staff.filter(s => s.isActive === true).length;

    el.innerText = `🟢 ${active} staff loaded`;
  } catch (e) {
    console.error(e);
    el.innerText = "⚠️ Failed to load status";
  }
}

// ---------------- INIT (CRITICAL FLOW) ----------------

(async () => {
  const auth = await verifyAccess();
  if (!auth) return;

  setupNav(auth.isWebAdmin === true);

  await loadStatus();

  const staff = await post("getStaff");

  if (document.getElementById("staffList")) {
    loadRatings(staff);
  }

  if (document.getElementById("notesList")) {
    loadNotes(staff);
  }
})();

// ---------------- RATINGS ----------------

async function loadRatings(staff) {
  const container = document.getElementById("staffList");
  if (!container) return;

  container.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive) return;

    const div = document.createElement("div");
    div.className = "card";

    if (s.discordId == userId) {
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

// ---------------- SAVE RATINGS ----------------

async function saveRatings() {
  const selects = document.querySelectorAll("select");

  let ratings = [];

  selects.forEach(s => {
    const id = s.dataset.id;
    if (!id) return;

    const comment =
      document.querySelector(`[data-comment='${id}']`)?.value || "";

    ratings.push({
      targetId: id,
      rating: s.value,
      comment
    });
  });

  await post("saveRatings", {
    reviewerId: userId,
    token: token,
    month: month(),
    ratings
  });

  alert("Saved!");
}

// ---------------- NOTES ----------------

async function loadNotes(staff) {
  const container = document.getElementById("notesList");
  if (!container) return;

  container.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive || s.discordId == userId) return;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL}">
      <b>${s.name}</b>

      <button onclick="sendNote('${s.discordId}','positive')">👍</button>
      <button onclick="sendNote('${s.discordId}','negative')">👎</button>

      <textarea id="n-${s.discordId}" placeholder="Note"></textarea>
    `;

    container.appendChild(div);
  });
}

// ---------------- SEND NOTE ----------------

async function sendNote(id, type) {
  const note = document.getElementById(`n-${id}`).value;

  await post("saveNote", {
    authorId: userId,
    token: token,
    targetId: id,
    type,
    note,
    month: month()
  });

  alert("Saved note!");
}