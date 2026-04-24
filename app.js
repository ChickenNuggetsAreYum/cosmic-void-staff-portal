const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

function month() {
  return new Date().toISOString().slice(0, 7);
}

// ---------------- NAV / TABS ----------------

function openTab(tab) {
  document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
  document.getElementById(tab).classList.remove("hidden");
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

async function verify() {
  const res = await post("verifyUser", {
    discordId: userId,
    token
  });

  if (!res.valid) {
    document.body.innerHTML = "❌ Unauthorized";
    throw new Error();
  }

  if (res.isWebAdmin) {
    document.getElementById("adminChannel").style.display = "block";
  } else {
    document.getElementById("adminChannel").style.display = "none";
  }

  return res;
}

// ---------------- DASHBOARD ----------------

async function loadHome() {
  const el = document.getElementById("statusText");

  const data = await post("getDashboardStatus", {
    month: month()
  });

  el.innerText = `📊 ${data.completed} / ${data.totalStaff} completed`;
}

// ---------------- RATINGS ----------------

async function loadRatings() {
  const staff = await post("getStaff");
  const c = document.getElementById("staffRatings");

  c.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive || s.discordId === userId) return;

    const div = document.createElement("div");
    div.className = "card";

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

      <textarea data-comment="${s.discordId}"></textarea>
    `;

    c.appendChild(div);
  });
}

async function saveRatings() {
  const selects = document.querySelectorAll("select");

  let ratings = [];

  selects.forEach(s => {
    const id = s.dataset.id;
    if (!id) return;

    ratings.push({
      targetId: id,
      rating: s.value,
      comment: document.querySelector(`[data-comment="${id}"]`)?.value || ""
    });
  });

  await post("saveRatings", {
    reviewerId: userId,
    token,
    month: month(),
    ratings
  });

  alert("Saved!");
}

// ---------------- NOTES ----------------

async function loadNotes() {
  const staff = await post("getStaff");
  const c = document.getElementById("staffNotes");

  c.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive || s.discordId === userId) return;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL}">
      <b>${s.name}</b>

      <button onclick="sendNote('${s.discordId}','positive')">👍</button>
      <button onclick="sendNote('${s.discordId}','negative')">👎</button>

      <textarea id="n-${s.discordId}"></textarea>
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

  alert("Saved");
}

// ---------------- INIT ----------------

(async () => {
  await verify();
  await loadHome();
  await loadRatings();
  await loadNotes();

  openTab("home");
})();