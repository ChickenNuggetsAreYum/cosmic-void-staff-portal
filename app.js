const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

function month() {
  return new Date().toISOString().slice(0, 7);
}

function isTrue(value) {
  return value === true || String(value).trim().toLowerCase() === "true";
}

function hideSpinner() {
  const spinner = document.getElementById("loadingSpinner");
  if (spinner) spinner.style.display = "none";
}

function showSpinner() {
  const spinner = document.getElementById("loadingSpinner");
  if (spinner) spinner.style.display = "block";
}

function showError(message) {
  hideSpinner();
  const box = document.getElementById("reviewsBox");
  if (box) {
    box.innerHTML = `<div class="card"><p>${message}</p></div>`;
  } else {
    document.body.innerHTML = message;
  }
}

window.addEventListener("unhandledrejection", event => {
  console.error("Unhandled promise rejection:", event.reason);
  showError("❌ Unexpected error occurred while loading. Please refresh the page.");
});

// ---------------- CACHE ----------------

let STAFF_CACHE = null;
let RATINGS_CACHE = null;
let NOTES_CACHE = null;
let RATINGS_MONTH = null;
let USER = null;
let EXPANDED_CARD = null;

// ---------------- API ----------------

async function post(action, data = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const text = await res.text();
    return JSON.parse(text);

  } catch (e) {
    clearTimeout(timeoutId);
    console.error("API ERROR:", action, e);
    return null;
  }
}

// ---------------- VERIFY ----------------

async function verify() {
  if (!userId || !token) {
    showError("❌ Unauthorized: missing credentials");
    throw new Error("Missing credentials");
  }

  const tokenRes = await post("getToken", { discordId: userId });
  const verifyRes = await post("verifyUser", {
    discordId: userId,
    token
  });

  if (!isTrue(tokenRes?.success)) {
    showError("❌ Unauthorized");
    throw new Error("Unauthorized");
  }

  if (!isTrue(tokenRes.isActive)) {
    setActivePage("revoked");
    return false;
  }

  if (!isTrue(verifyRes?.valid)) {
    showError("❌ Unauthorized");
    throw new Error("Unauthorized");
  }

  USER = {
    ...tokenRes,
    isWebAdmin: isTrue(verifyRes.isWebAdmin)
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
  if (!select) return;

  const values = [];
  const current = new Date();
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - i, 1);
    values.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }

  select.innerHTML = values.map(month => `<option value="${month}">${month}</option>`).join("");
  select.value = month();

  if (!select.dataset.adminInit) {
    select.addEventListener("change", loadAdmin);
    select.dataset.adminInit = "true";
  }
}

// ---------------- LOAD REVIEWS ----------------

async function loadReviews() {
  const box = document.getElementById("reviewsBox");
  const spinner = document.getElementById("loadingSpinner");
  if (!box) return;

  showSpinner();
  const currentMonth = month();
  if (RATINGS_MONTH !== currentMonth) {
    RATINGS_CACHE = null;
    RATINGS_MONTH = currentMonth;
  }

  try {
    // fetch once only
    if (!STAFF_CACHE || RATINGS_MONTH !== currentMonth) {
      STAFF_CACHE = await post("getStaff");
    }

    if (!RATINGS_CACHE || RATINGS_MONTH !== currentMonth) {
      RATINGS_CACHE = await post("getRatings", { month: currentMonth });
      RATINGS_MONTH = currentMonth;
    }

    if (!Array.isArray(STAFF_CACHE) || !Array.isArray(RATINGS_CACHE)) {
      showError("❌ Failed to load data");
      return;
    }

    await loadNotesForMonth(currentMonth);

    hideSpinner();
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
      if (!isTrue(s.isActive)) return;

      const isYou = String(s.discordId) === String(userId);
      const my = ratingMap[`${String(s.discordId).trim()}|${String(userId).trim()}`];
      const selectedRating = my?.rating?.toString().trim().toLowerCase() || "n/a";

      const div = document.createElement("div");
      div.className = "card";
      div.dataset.id = s.discordId;

      if (isYou) {
        div.className += " no-click";
        div.innerHTML = `
          <img src="${s.avatarURL || ''}">
          <div class="card-body">
            <b>${s.name}</b>
            <p style="opacity:0.6;">This is you</p>
          </div>
        `;
      } else {
        div.innerHTML = `
          <img src="${s.avatarURL || ''}">
          <div class="card-body">
            <b>${s.name}</b>
            <select data-id="${s.discordId}">
              ${["Excels","On Par","Meets Standards","Below Par","Needs Work","N/A"]
                .map(v => {
                  const normalized = v.toLowerCase();
                  return `<option value="${v}" ${selectedRating === normalized ? "selected" : ""}>${v}</option>`;
                }).join("")}
            </select>
            <textarea data-id="${s.discordId}">${my?.comment || ""}</textarea>
          </div>
          <div class="card-details"></div>
        `;
        
        div.addEventListener("click", async (e) => {
          if (e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
          
          if (EXPANDED_CARD === s.discordId) {
            div.classList.remove("expanded");
            EXPANDED_CARD = null;
          } else {
            if (EXPANDED_CARD) {
              document.querySelector(`[data-id="${EXPANDED_CARD}"]`)?.classList.remove("expanded");
            }
            div.classList.add("expanded");
            EXPANDED_CARD = s.discordId;
            await expandStaffCard(s.discordId, div);
          }
        });
      }

      box.appendChild(div);
    });

    document.querySelectorAll("#reviewsBox select, #reviewsBox textarea")
      .forEach(el => el.addEventListener("change", saveReviews));
  } catch (e) {
    console.error("Review load failed", e);
    showError("❌ Failed to load reviews");
  } finally {
    hideSpinner();
  }
}

async function expandStaffCard(targetId, cardEl) {
  const ratings = (RATINGS_CACHE || []).filter(r => String(r.targetId).trim() === String(targetId).trim());
  const notes = await getNotesForTarget(targetId);
  const detailsDiv = cardEl.querySelector(".card-details");
  
  if (!detailsDiv) return;
  
  detailsDiv.innerHTML = `
    <div style="display: flex; gap: 10px; margin-bottom: 14px;">
      <button class="details-tab-button active" data-tab="Ratings">Ratings</button>
      <button class="details-tab-button" data-tab="Notes">Notes</button>
      <button type="button" style="margin-left: auto; background: #3b82f6; padding: 6px 10px; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 0.9rem;">🔄</button>
    </div>
    <div class="details-content" data-tab="Ratings">
      ${ratings.length ? ratings.map(r => {
        const reviewer = STAFF_CACHE.find(s => String(s.discordId).trim() === String(r.reviewerId).trim());
        const reviewer_name = reviewer?.name || String(r.reviewerId).trim();
        if (String(r.reviewerId).trim() === String(userId).trim()) {
          return `
            <div class="review-card">
              <b>Your rating</b>
              <small>Rating: ${r.rating}</small>
              <p>${String(r.comment || "").trim() || "No comment."}</p>
            </div>
          `;
        }
        return "";
      }).join("") || "<p>You haven't rated yet.</p>"}
    </div>
    <div class="details-content" data-tab="Notes" style="display: none;">
      <label for="noteType${targetId}"><b>Note type</b></label>
      <select id="noteType${targetId}">
        <option value="Positive">Positive 👍</option>
        <option value="Negative">Negative 👎</option>
      </select>
      <textarea id="noteInput${targetId}" rows="4"></textarea>
      <button id="saveNoteBtn${targetId}" style="margin-top: 10px;">Save Note</button>
      
      <div style="margin-top: 20px;">
        <b>All notes</b>
        ${notes.length ? notes.map(note => {
          const reviewer = STAFF_CACHE.find(s => String(s.discordId).trim() === String(note.reviewerId).trim());
          const icon = note.type === "Negative" ? "👎" : "👍";
          return `
            <div class="note-item">
              <small>${icon} ${reviewer?.name || note.reviewerId}</small>
              <p>${String(note.note || "").trim() || "No note."}</p>
            </div>
          `;
        }).join("") : "<p>No notes yet.</p>"}
      </div>
    </div>
  `;

  const myNote = notes.find(n => String(n.reviewerId).trim() === String(userId).trim());
  if (myNote) {
    const noteTypeEl = detailsDiv.querySelector(`#noteType${targetId}`);
    const noteInputEl = detailsDiv.querySelector(`#noteInput${targetId}`);
    if (noteTypeEl) noteTypeEl.value = myNote.type || "Positive";
    if (noteInputEl) noteInputEl.value = myNote.note || "";
  }

  detailsDiv.querySelectorAll(".details-tab-button").forEach(btn => {
    btn.addEventListener("click", () => {
      detailsDiv.querySelectorAll(".details-tab-button").forEach(b => b.classList.remove("active"));
      detailsDiv.querySelectorAll(".details-content").forEach(c => c.style.display = "none");
      btn.classList.add("active");
      detailsDiv.querySelector(`[data-tab="${btn.dataset.tab}"]`).style.display = "block";
    });
  });

  detailsDiv.querySelector(`#saveNoteBtn${targetId}`)?.addEventListener("click", async () => {
    const noteType = detailsDiv.querySelector(`#noteType${targetId}`)?.value || "Positive";
    const noteText = detailsDiv.querySelector(`#noteInput${targetId}`)?.value || "";
    
    await post("saveNotes", {
      month: month(),
      reviewerId: userId,
      targetId,
      type: noteType,
      note: noteText.trim()
    });

    NOTES_CACHE = null;
    await expandStaffCard(targetId, cardEl);
  });

  detailsDiv.querySelector("button:last-of-type")?.addEventListener("click", async () => {
    NOTES_CACHE = null;
    await expandStaffCard(targetId, cardEl);
  });
}

async function loadNotesForMonth(monthValue = month()) {
  if (NOTES_CACHE?.month === monthValue && NOTES_CACHE.map) {
    return NOTES_CACHE;
  }

  const notes = await post("getNotes", { month: monthValue });
  const normalized = Array.isArray(notes) ? notes : [];
  const map = normalized.reduce((acc, note) => {
    const targetId = String(note.targetId || "").trim();
    if (!targetId) return acc;
    if (!acc[targetId]) acc[targetId] = [];
    acc[targetId].push(note);
    return acc;
  }, {});

  NOTES_CACHE = { month: monthValue, map };
  return NOTES_CACHE;
}

async function getNotesForTarget(targetId, monthValue = month()) {
  const cache = await loadNotesForMonth(monthValue);
  return cache.map[String(targetId).trim()] || [];
}

async function loadAdmin() {
  if (!USER?.isWebAdmin) return;

  setActivePage("admin");

  if (!STAFF_CACHE) {
    STAFF_CACHE = await post("getStaff");
  }

  const monthValue = document.getElementById("adminMonthSelect")?.value || month();
  if (RATINGS_MONTH !== monthValue) {
    RATINGS_CACHE = null;
    RATINGS_MONTH = monthValue;
  }

  if (!RATINGS_CACHE) {
    RATINGS_CACHE = await post("getRatings", { month: monthValue });
  }

  await loadNotesForMonth(monthValue);

  const ratings = RATINGS_CACHE;
  const listBox = document.getElementById("adminList");

  if (!Array.isArray(STAFF_CACHE) || !Array.isArray(ratings)) {
    if (listBox) listBox.innerHTML = "<div class='card'>❌ Failed to load admin data</div>";
    return;
  }

  const staffRows = STAFF_CACHE.filter(s => isTrue(s.isActive));

  if (listBox) {
    listBox.innerHTML = staffRows.length ? staffRows.map(s => {
      const count = ratings.filter(r => String(r.targetId).trim() === String(s.discordId).trim()).length;
      return `
        <div class="card" data-id="${s.discordId}">
          <img src="${s.avatarURL || ''}">
          <div class="card-body">
            <b>${s.name}</b>
            <p>Ratings: ${count}</p>
          </div>
          <div class="card-details"></div>
        </div>
      `;
    }).join("") : "<div class='card'>No active staff found.</div>";
  }

  document.querySelectorAll("#adminList .card").forEach(card => {
    const staffId = card.dataset.id;
    card.addEventListener("click", async (e) => {
      if (e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
      
      if (EXPANDED_CARD === staffId) {
        card.classList.remove("expanded");
        EXPANDED_CARD = null;
      } else {
        if (EXPANDED_CARD) {
          document.querySelector(`#adminList [data-id="${EXPANDED_CARD}"]`)?.classList.remove("expanded");
        }
        card.classList.add("expanded");
        EXPANDED_CARD = staffId;
        await expandAdminCard(staffId, card, monthValue);
      }
    });
  });
}

async function expandAdminCard(targetId, cardEl, monthValue = month()) {
  const ratings = (RATINGS_CACHE || []).filter(r => String(r.targetId).trim() === String(targetId).trim());
  const notes = await getNotesForTarget(targetId, monthValue);
  const detailsDiv = cardEl.querySelector(".card-details");
  
  if (!detailsDiv) return;
  
  detailsDiv.innerHTML = `
    <div style="display: flex; gap: 10px; margin-bottom: 14px;">
      <button class="details-tab-button active" data-tab="Ratings">Ratings</button>
      <button class="details-tab-button" data-tab="Notes">Notes</button>
      <button type="button" style="margin-left: auto; background: #3b82f6; padding: 6px 10px; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 0.9rem;">🔄</button>
    </div>
    <div class="details-content" data-tab="Ratings">
      ${ratings.length ? ratings.map(r => {
        const reviewer = STAFF_CACHE.find(s => String(s.discordId).trim() === String(r.reviewerId).trim());
        const reviewer_name = reviewer?.name || String(r.reviewerId).trim();
        return `
          <div class="review-card">
            <b>${reviewer_name}</b>
            <small>Rating: ${r.rating}</small>
            <p>${String(r.comment || "").trim() || "No comment."}</p>
          </div>
        `;
      }).join("") : "<p>No ratings yet.</p>"}
    </div>
    <div class="details-content" data-tab="Notes" style="display: none;">
      <label for="noteType${targetId}"><b>Note type</b></label>
      <select id="noteType${targetId}">
        <option value="Positive">Positive 👍</option>
        <option value="Negative">Negative 👎</option>
      </select>
      <textarea id="noteInput${targetId}" rows="4"></textarea>
      <button id="saveAdminNoteBtn${targetId}" style="margin-top: 10px;">Save Note</button>
      
      <div style="margin-top: 20px;">
        <b>All notes</b>
        ${notes.length ? notes.map(note => {
          const reviewer = STAFF_CACHE.find(s => String(s.discordId).trim() === String(note.reviewerId).trim());
          const icon = note.type === "Negative" ? "👎" : "👍";
          return `
            <div class="note-item">
              <small>${icon} ${reviewer?.name || note.reviewerId}</small>
              <p>${String(note.note || "").trim() || "No note."}</p>
            </div>
          `;
        }).join("") : "<p>No notes yet.</p>"}
      </div>
    </div>
  `;

  const myNote = notes.find(n => String(n.reviewerId).trim() === String(userId).trim());
  if (myNote) {
    const noteTypeEl = detailsDiv.querySelector(`#noteType${targetId}`);
    const noteInputEl = detailsDiv.querySelector(`#noteInput${targetId}`);
    if (noteTypeEl) noteTypeEl.value = myNote.type || "Positive";
    if (noteInputEl) noteInputEl.value = myNote.note || "";
  }

  detailsDiv.querySelectorAll(".details-tab-button").forEach(btn => {
    btn.addEventListener("click", () => {
      detailsDiv.querySelectorAll(".details-tab-button").forEach(b => b.classList.remove("active"));
      detailsDiv.querySelectorAll(".details-content").forEach(c => c.style.display = "none");
      btn.classList.add("active");
      detailsDiv.querySelector(`[data-tab="${btn.dataset.tab}"]`).style.display = "block";
    });
  });

  detailsDiv.querySelector(`#saveAdminNoteBtn${targetId}`)?.addEventListener("click", async () => {
    const noteType = detailsDiv.querySelector(`#noteType${targetId}`)?.value || "Positive";
    const noteText = detailsDiv.querySelector(`#noteInput${targetId}`)?.value || "";
    
    await post("saveNotes", {
      month: monthValue,
      reviewerId: userId,
      targetId,
      type: noteType,
      note: noteText.trim()
    });

    NOTES_CACHE = null;
    await expandAdminCard(targetId, cardEl, monthValue);
  });

  detailsDiv.querySelector("button:last-of-type")?.addEventListener("click", async () => {
    NOTES_CACHE = null;
    await expandAdminCard(targetId, cardEl, monthValue);
  });
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