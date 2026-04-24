const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

function month() {
  return new Date().toISOString().slice(0, 7);
}

// ---------------- CACHE ----------------

let STAFF_CACHE = null;
let RATINGS_CACHE = null;
let NOTES_CACHE = null;
let RATINGS_MONTH = null;
let USER = null;

// ---------------- API ----------------

async function post(action, data = {}) {
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data })
    });

    const text = await res.text();
    return JSON.parse(text);

  } catch (e) {
    console.error("API ERROR:", action, e);
    return null;
  }
}

// ---------------- VERIFY ----------------

async function verify() {
  const tokenRes = await post("getToken", { discordId: userId });
  const verifyRes = await post("verifyUser", {
    discordId: userId,
    token
  });

  if (!tokenRes?.success) {
    document.body.innerHTML = "❌ Unauthorized";
    throw new Error("Unauthorized");
  }

  if (tokenRes.isActive !== true) {
    setActivePage("revoked");
    return false;
  }

  if (!verifyRes?.valid) {
    document.body.innerHTML = "❌ Unauthorized";
    throw new Error("Unauthorized");
  }

  USER = {
    ...tokenRes,
    isWebAdmin: verifyRes.isWebAdmin
  };
  return true;
}

// ---------------- NAV ----------------

function setupNav() {
  const reviewsTab = document.querySelector("[data-page='reviews']");
  const adminTab = document.querySelector("[data-page='admin']");

  if (reviewsTab) {
    reviewsTab.addEventListener("click", async (e) => {
      e.preventDefault();
      await loadReviews();
    });
  }

  if (adminTab) {
    adminTab.addEventListener("click", async (e) => {
      e.preventDefault();
      await loadAdmin();
    });

    if (USER?.isWebAdmin) {
      adminTab.classList.remove("hidden");
    }
  }

  initAdminControls();
}

function setActivePage(page) {
  document.querySelectorAll("[data-page]").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });

  const reviewsPage = document.getElementById("reviewsPage");
  const adminPage = document.getElementById("adminPage");
  const revokedPage = document.getElementById("revokedPage");
  const menu = document.querySelector(".menu");

  if (reviewsPage) reviewsPage.classList.toggle("hidden", page !== "reviews");
  if (adminPage) adminPage.classList.toggle("hidden", page !== "admin");
  if (revokedPage) revokedPage.classList.toggle("hidden", page !== "revoked");
  if (menu) menu.classList.toggle("hidden", page === "revoked");
}

function initAdminControls() {
  const select = document.getElementById("adminMonthSelect");
  const reload = document.getElementById("adminReload");
  if (!select || !reload) return;

  const values = [];
  const current = new Date();
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - i, 1);
    values.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }

  select.innerHTML = values.map(month => `<option value="${month}">${month}</option>`).join("");
  select.value = month();
  reload.addEventListener("click", loadAdmin);
}

// ---------------- LOAD REVIEWS ----------------

async function loadReviews() {
  const box = document.getElementById("reviewsBox");
  const spinner = document.getElementById("loadingSpinner");
  if (!box) return;

  const currentMonth = month();
  if (RATINGS_MONTH !== currentMonth) {
    RATINGS_CACHE = null;
    RATINGS_MONTH = currentMonth;
  }

  // fetch once only
  if (!STAFF_CACHE) {
    STAFF_CACHE = await post("getStaff");
  }

  if (!RATINGS_CACHE) {
    RATINGS_CACHE = await post("getRatings", { month: currentMonth });
  }

  if (!Array.isArray(STAFF_CACHE) || !Array.isArray(RATINGS_CACHE)) {
    if (spinner) spinner.style.display = "none";
    box.innerHTML = "❌ Failed to load data";
    return;
  }

  if (spinner) spinner.style.display = "none";
  box.innerHTML = "";
  setActivePage("reviews");

  const ratingMap = RATINGS_CACHE.reduce((map, row) => {
    const targetId = String(row.targetId ?? "").trim();
    const reviewerId = String(row.reviewerId ?? "").trim();
    if (targetId && reviewerId) {
      map[`${targetId}|${reviewerId}`] = row;
    }
    return map;
  }, {});

  STAFF_CACHE.forEach(s => {
    if (!s.isActive) return;

    const isYou = String(s.discordId) === String(userId);
    const my = ratingMap[`${String(s.discordId).trim()}|${String(userId).trim()}`];
    const selectedRating = my?.rating?.toString().trim().toLowerCase() || "n/a";

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL || ''}">
      <div>
        ${isYou ? `
          <b>${s.name}</b>
          <p style="opacity:0.6;">This is you</p>
        ` : `
          <button class="staff-link" data-id="${s.discordId}">${s.name}</button>
          <select data-id="${s.discordId}">
            ${["Excels","On Par","Meets Standards","Below Par","Needs Work","N/A"]
              .map(v => {
                const normalized = v.toLowerCase();
                return `<option value="${v}" ${selectedRating === normalized ? "selected" : ""}>${v}</option>`;
              }).join("")}
          </select>

          <textarea data-id="${s.discordId}">${my?.comment || ""}</textarea>
        `}
      </div>
    `;

    box.appendChild(div);
  });

  document.querySelectorAll("#reviewsBox select, #reviewsBox textarea")
    .forEach(el => el.addEventListener("change", saveReviews));

  document.querySelectorAll(".staff-link").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      await openStaffDetails(el.dataset.id, { adminView: false, tab: "Notes" });
    });
  });
}

async function getNotesForTarget(targetId, monthValue = month()) {
  const notes = await post("getNotes", { month: monthValue, targetId });
  return Array.isArray(notes) ? notes : [];
}

function renderRatingList(staff, ratings, adminView) {
  if (!ratings.length) {
    return `<div class="card"><p>No ratings found for ${staff.name} this month.</p></div>`;
  }

  const reviewerMap = STAFF_CACHE.reduce((map, s) => {
    map[String(s.discordId).trim()] = s.name;
    return map;
  }, {});

  if (adminView) {
    return ratings.map(r => {
      const reviewer = reviewerMap[String(r.reviewerId).trim()] || String(r.reviewerId).trim();
      return `
        <div class="review-card">
          <b>${reviewer}</b>
          <small>Rating: ${r.rating}</small>
          <p>${String(r.comment || "").trim() || "No comment."}</p>
        </div>
      `;
    }).join("");
  }

  const myRating = ratings.find(r => String(r.reviewerId).trim() === String(userId).trim());
  if (!myRating) {
    return `<div class="card"><p>You haven't rated ${staff.name} yet.</p></div>`;
  }

  return `
    <div class="review-card">
      <b>Your rating</b>
      <small>Rating: ${myRating.rating}</small>
      <p>${String(myRating.comment || "").trim() || "No comment."}</p>
    </div>
  `;
}

async function saveNote(targetId, adminView = false) {
  const noteInput = document.getElementById("detailsNoteInput");
  if (!noteInput) return;

  await post("saveNotes", {
    month: month(),
    reviewerId: userId,
    targetId,
    note: noteInput.value.trim()
  });

  if (adminView) {
    await openAdminStaffDetails(targetId);
  } else {
    await openStaffDetails(targetId, { adminView: false, tab: "Notes" });
  }
}

async function openStaffDetails(targetId, { adminView = false, tab = "Notes" } = {}) {
  const staff = STAFF_CACHE?.find(s => String(s.discordId).trim() === String(targetId).trim());
  if (!staff) return;

  const ratings = (RATINGS_CACHE || []).filter(r => String(r.targetId).trim() === String(targetId).trim());
  const notes = await getNotesForTarget(targetId);

  renderDetailsPanel(staff, { ratings, notes, activeTab: tab, adminView });
}

function renderDetailsPanel(staff, { ratings, notes, activeTab = "Notes", adminView = false }) {
  const panel = document.getElementById(adminView ? "adminDetail" : "detailsPanel");
  if (!panel) return;
  panel.classList.remove("hidden");

  const noteEntry = notes.find(n => String(n.reviewerId).trim() === String(userId).trim());
  const noteText = noteEntry?.note || "";

  panel.innerHTML = `
    <div class="details-panel">
      <div class="details-tabs">
        <button type="button" class="details-tab-button ${activeTab === "Ratings" ? "active" : ""}" data-tab="Ratings">Ratings</button>
        <button type="button" class="details-tab-button ${activeTab === "Notes" ? "active" : ""}" data-tab="Notes">Notes</button>
      </div>

      <div id="detailsContent">
        ${activeTab === "Ratings" ? `
          ${renderRatingList(staff, ratings, adminView)}
        ` : `
          <div>
            <label for="detailsNoteInput"><b>${adminView ? "Add or update a note" : "Your note"}</b></label>
            <textarea id="detailsNoteInput" rows="5">${noteText}</textarea>
            <button id="saveDetailsNote">Save Note</button>

            <div style="margin-top:20px;">
              <b>Existing notes</b>
              ${notes.length ? notes.map(note => {
                const reviewer = STAFF_CACHE.find(s => String(s.discordId).trim() === String(note.reviewerId).trim());
                return `
                  <div class="note-item">
                    <small>${reviewer?.name || note.reviewerId}</small>
                    <p>${String(note.note || "").trim() || "No note."}</p>
                  </div>
                `;
              }).join("") : "<div class='card'>No notes yet.</div>"}
            </div>
          </div>
        `}
      </div>
    </div>
  `;

  panel.querySelectorAll(".details-tab-button").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nextTab = btn.dataset.tab;
      renderDetailsPanel(staff, { ratings, notes, activeTab: nextTab, adminView });
    });
  });

  panel.querySelector("#saveDetailsNote")?.addEventListener("click", async () => {
    await saveNote(staff.discordId, adminView);
  });
}

async function loadAdmin() {
  if (!USER?.isWebAdmin) return;

  setActivePage("admin");

  if (!STAFF_CACHE) {
    STAFF_CACHE = await post("getStaff");
  }

  const monthValue = document.getElementById("adminMonthSelect")?.value || month();
  const ratings = await post("getRatings", { month: monthValue });
  const listBox = document.getElementById("adminList");
  const detailBox = document.getElementById("adminDetail");

  if (!Array.isArray(STAFF_CACHE) || !Array.isArray(ratings)) {
    if (listBox) listBox.innerHTML = "<div class='card'>❌ Failed to load admin data</div>";
    if (detailBox) detailBox.classList.add("hidden");
    return;
  }

  const staffRows = STAFF_CACHE.filter(s => s.isActive === true);

  if (listBox) {
    listBox.innerHTML = staffRows.length ? staffRows.map(s => {
      const count = ratings.filter(r => String(r.targetId).trim() === String(s.discordId).trim()).length;
      return `
        <div class="staff-card" data-id="${s.discordId}">
          <b>${s.name}</b>
          <p>Ratings: ${count}</p>
        </div>
      `;
    }).join("") : "<div class='card'>No active staff found.</div>";
  }

  if (detailBox) {
    detailBox.classList.add("hidden");
    detailBox.innerHTML = "";
  }

  document.querySelectorAll(".staff-card").forEach(card => {
    card.addEventListener("click", async () => {
      await openAdminStaffDetails(card.dataset.id, monthValue);
    });
  });
}

async function openAdminStaffDetails(targetId, monthValue = month()) {
  const staff = STAFF_CACHE?.find(s => String(s.discordId).trim() === String(targetId).trim());
  if (!staff) return;

  const ratings = (await post("getRatings", { month: monthValue }))?.filter(r => String(r.targetId).trim() === String(targetId).trim()) || [];
  const notes = await getNotesForTarget(targetId, monthValue);

  renderDetailsPanel(staff, { ratings, notes, activeTab: "Ratings", adminView: true });
}

// ---------------- SAVE ----------------

async function saveReviews() {
  const ratings = [];

  document.querySelectorAll("select").forEach(sel => {
    const id = sel.dataset.id;

    if (!id || id === userId) return;
    if (sel.value === "N/A") return;

    const comment =
      document.querySelector(`textarea[data-id="${id}"]`)?.value || "";

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

  // refresh cache so edits persist instantly
  RATINGS_CACHE = await post("getRatings", { month: month() });
}

// ---------------- INIT ----------------

(async () => {
  try {
    const allowed = await verify();
    if (!allowed) return;
    setupNav();
    await loadReviews();
  } catch (e) {
    console.error(e);
    document.body.innerHTML = "❌ Failed to load portal";
  }
})();