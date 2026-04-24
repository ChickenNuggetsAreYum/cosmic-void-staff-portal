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
  const res = await post("verifyUser", { discordId: userId, token });

  if (!res.valid) {
    document.body.innerHTML = "❌ Unauthorized";
    throw new Error("Unauthorized");
  }

  isAdmin = res.isWebAdmin || false;

  if (!isAdmin) {
    const admin = document.getElementById("adminTab");
    if (admin) admin.style.display = "none";
  }
}

// ---------------- RATINGS ----------------

async function loadRatings() {
  const staff = await post("getStaff");
  const existing = await post("getRatings", {
    month: month()
  });

  const container = document.getElementById("staffRatings");
  container.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive || s.discordId === userId) return;

    const my = existing.find(e => e.targetId === s.discordId);

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL}">
      <b>${s.name}</b>

      <select data-id="${s.discordId}">
        ${["Excels","On Par","Meets Standards","Below Par","Needs Work","N/A"]
          .map(v => `<option ${my?.rating === v ? "selected" : ""}>${v}</option>`).join("")}
      </select>

      <textarea data-id="${s.discordId}">${my?.comment || ""}</textarea>
    `;

    container.appendChild(div);
  });

  document.querySelectorAll("select, textarea").forEach(el => {
    el.onchange = saveRatings;
  });
}

async function saveRatings() {
  const ratings = [];

  document.querySelectorAll("select").forEach(sel => {
    const id = sel.dataset.id;
    const comment = document.querySelector(`textarea[data-id="${id}"]`)?.value;

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
  container.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive || s.discordId === userId) return;

    const n = notes[s.discordId] || [];

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <b>${s.name}</b>

      ${n.map(x => `<div>${x.type === "positive" ? "👍" : "👎"} ${x.note}</div>`).join("")}

      <textarea data-id="${s.discordId}"></textarea>

      <button onclick="addNote('${s.discordId}','positive')">👍</button>
      <button onclick="addNote('${s.discordId}','negative')">👎</button>
    `;

    container.appendChild(div);
  });
}

async function addNote(id, type) {
  const text = document.querySelector(`textarea[data-id="${id}"]`)?.value;

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
    await loadRatings();
    await loadNotes();
    await loadAdmin();

  } catch (e) {
    console.error(e);
  } finally {
    document.getElementById("loadingScreen")?.remove();
    document.getElementById("app")?.classList.remove("hidden");
  }
})();