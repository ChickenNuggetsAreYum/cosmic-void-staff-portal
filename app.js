const API = "https://script.google.com/macros/s/AKfycbyl0_Aq4jBLmMKTqXORLxb6AGJ0xKOYti-DITn6Ix0NbnSSgPDKRSxQKAZ24sz_0DTG/exec";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

function month() {
  return new Date().toISOString().slice(0,7);
}

function post(action, data = {}) {
  return fetch(API, {
    method: "POST",
    body: JSON.stringify({ action, ...data })
  }).then(r => r.json());
}

// ---------------- NAV ----------------

if (document.getElementById("ratingsLink")) {
  document.getElementById("ratingsLink").href = `ratings.html?id=${userId}&token=${token}`;
  document.getElementById("notesLink").href = `notes.html?id=${userId}&token=${token}`;
  document.getElementById("adminLink").href = `admin.html?id=${userId}&token=${token}`;
}

// ---------------- RATINGS ----------------

if (document.getElementById("staffList")) loadRatings();

async function loadRatings() {
  const staff = await post("getStaff");
  const container = document.getElementById("staffList");

  staff.forEach(s => {
    if (!s.isActive) return;

    const div = document.createElement("div");
    div.className = "card";

    if (s.discordId == userId) {
      div.innerHTML = `<b>${s.name} (You)</b>`;
    } else {
      div.innerHTML = `
        <img src="${s.avatarURL}" width="50">
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

async function saveRatings() {
  const selects = document.querySelectorAll("select");

  let ratings = [];

  selects.forEach(s => {
    const id = s.dataset.id;
    const comment = document.querySelector(`[data-comment='${id}']`)?.value || "";

    ratings.push({
      targetId: id,
      rating: s.value,
      comment
    });
  });

  await post("saveRatings", {
    reviewerId: userId,
    month: month(),
    ratings
  });

  alert("Saved!");
}

// ---------------- NOTES ----------------

if (document.getElementById("notesList")) loadNotes();

async function loadNotes() {
  const staff = await post("getStaff");
  const container = document.getElementById("notesList");

  staff.forEach(s => {
    if (!s.isActive || s.discordId == userId) return;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL}" width="50">
      <b>${s.name}</b>

      <button onclick="sendNote('${s.discordId}','positive')">👍</button>
      <button onclick="sendNote('${s.discordId}','negative')">👎</button>

      <textarea id="n-${s.discordId}" placeholder="Note"></textarea>
    `;

    container.appendChild(div);
  });
}

async function sendNote(id, type) {
  const note = document.getElementById(`n-${id}`).value;

  await post("saveNote", {
    authorId: userId,
    targetId: id,
    type,
    note,
    month: month()
  });

  alert("Saved note!");
}