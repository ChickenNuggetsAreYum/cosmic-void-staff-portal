const API = "https://script.google.com/macros/s/AKfycbyl0_Aq4jBLmMKTqXORLxb6AGJ0xKOYti-DITn6Ix0NbnSSgPDKRSxQKAZ24sz_0DTG/exec";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

function getMonth() {
  return new Date().toISOString().slice(0,7);
}

// Navigation links
if (document.getElementById("ratingsLink")) {
  document.getElementById("ratingsLink").href = `ratings.html?id=${userId}&token=${token}`;
  document.getElementById("notesLink").href = `notes.html?id=${userId}&token=${token}`;
  document.getElementById("adminLink").href = `admin.html?id=${userId}&token=${token}`;
}

// =====================
// LOAD STAFF
// =====================
async function fetchStaff() {
  const res = await fetch(API, {
    method: "POST",
    body: JSON.stringify({ action: "getStaff" })
  });

  return await res.json();
}

// =====================
// RATINGS PAGE
// =====================
if (document.getElementById("staffList")) {
  loadRatingsPage();
}

async function loadRatingsPage() {
  const staff = await fetchStaff();
  const container = document.getElementById("staffList");

  let count = 0;
  let total = 0;

  staff.forEach(s => {
    if (!s.isActive) return;

    const div = document.createElement("div");
    div.className = "card";

    if (s.discordId == userId) {
      div.innerHTML = `<b>${s.name} (This is you)</b>`;
    } else {
      total++;

      div.innerHTML = `
        <img src="${s.avatarURL}">
        <b>${s.name}</b>
        <select data-id="${s.discordId}">
          <option value="">Select Rating</option>
          <option>Excels</option>
          <option>On Par</option>
          <option>Meets Standards</option>
          <option>Below Par</option>
          <option>Needs Work</option>
          <option>N/A</option>
        </select>
        <textarea placeholder="Comment..." data-comment="${s.discordId}"></textarea>
      `;
    }

    container.appendChild(div);
  });

  document.getElementById("progress").innerText = `0 / ${total} completed`;
}

async function saveRatings() {
  const selects = document.querySelectorAll("select");

  let ratings = [];

  selects.forEach(s => {
    if (!s.value) return;

    const id = s.dataset.id;
    const comment = document.querySelector(`[data-comment='${id}']`).value;

    ratings.push({
      targetId: id,
      rating: s.value,
      comment
    });
  });

  await fetch(API, {
    method: "POST",
    body: JSON.stringify({
      action: "saveRatings",
      reviewerId: userId,
      month: getMonth(),
      ratings
    })
  });

  alert("Ratings saved!");
}

// =====================
// NOTES PAGE
// =====================
if (document.getElementById("notesList")) {
  loadNotesPage();
}

async function loadNotesPage() {
  const staff = await fetchStaff();
  const container = document.getElementById("notesList");

  staff.forEach(s => {
    if (!s.isActive || s.discordId == userId) return;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL}">
      <b>${s.name}</b>
      <button onclick="sendNote('${s.discordId}','positive')">👍</button>
      <button onclick="sendNote('${s.discordId}','negative')">👎</button>
      <textarea id="note-${s.discordId}" placeholder="Write note..."></textarea>
    `;

    container.appendChild(div);
  });
}

async function sendNote(targetId, type) {
  const note = document.getElementById(`note-${targetId}`).value;

  await fetch(API, {
    method: "POST",
    body: JSON.stringify({
      action: "saveNote",
      authorId: userId,
      targetId,
      type,
      note,
      month: getMonth()
    })
  });

  alert("Note saved!");
}

// =====================
// ADMIN PAGE
// =====================
if (document.getElementById("adminContent")) {
  loadAdmin();
}

async function loadAdmin() {
  const staff = await fetchStaff();
  const me = staff.find(s => s.discordId == userId);

  if (!me || !me.isWebAdmin) {
    document.body.innerHTML = "Access Denied";
    return;
  }

  document.getElementById("adminContent").innerHTML =
    "<p>Admin access granted</p>";
}

function resetMonth() {
  alert("Manual reset: just start new month (data stays)");
}