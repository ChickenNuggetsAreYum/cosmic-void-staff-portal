const API = "https://script.google.com/macros/s/AKfycbyl0_Aq4jBLmMKTqXORLxb6AGJ0xKOYti-DITn6Ix0NbnSSgPDKRSxQKAZ24sz_0DTG/exec";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

function month() {
  return new Date().toISOString().slice(0, 7);
}

function post(action, data = {}) {
  return fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data })
  }).then(r => r.json());
}

// ---------------- SECURITY CHECK (IMPORTANT) ----------------

async function verifyAccess() {
  if (!userId || !token) {
    document.body.innerHTML = "<h2>❌ Access denied (missing credentials)</h2>";
    return false;
  }

  try {
    const res = await post("verifyUser", {
      discordId: userId,
      token: token
    });

    if (!res || !res.valid) {
      document.body.innerHTML = "<h2>❌ Invalid or expired token</h2>";
      return false;
    }

    return true;
  } catch (e) {
    document.body.innerHTML = "<h2>❌ Unable to verify access</h2>";
    return false;
  }
}

// ---------------- NAV ----------------

function setupNav(isAdmin) {
  const ratingsLink = document.getElementById("ratingsLink");
  const notesLink = document.getElementById("notesLink");
  const adminLink = document.getElementById("adminLink");

  if (ratingsLink) {
    ratingsLink.href = `ratings.html?id=${userId}&token=${token}`;
  }

  if (notesLink) {
    notesLink.href = `notes.html?id=${userId}&token=${token}`;
  }

  if (adminLink) {
    if (isAdmin) {
      adminLink.href = `admin.html?id=${userId}&token=${token}`;
      adminLink.style.display = "inline-block";
    } else {
      adminLink.style.display = "none";
    }
  }
}

// ---------------- INIT ----------------

(async () => {
  const ok = await verifyAccess();
  if (!ok) return;

  const staff = await post("getStaff");
  const me = staff.find(s => s.discordId == userId);

  setupNav(me?.isWebAdmin === true);

  if (document.getElementById("staffList")) loadRatings();
  if (document.getElementById("notesList")) loadNotes();
})();

// ---------------- RATINGS ----------------

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
    month: month(),
    ratings
  });

  alert("Saved!");
}

// ---------------- NOTES ----------------

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