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
  const res = await post("verifyUser", {
    discordId: userId,
    token
  });

  if (!res?.valid) {
    document.body.innerHTML = "❌ Unauthorized";
    throw new Error("Unauthorized");
  }

  USER = res;
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

  if (reviewsPage) reviewsPage.classList.toggle("hidden", page !== "reviews");
  if (adminPage) adminPage.classList.toggle("hidden", page !== "admin");
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
    const selectedRating = my?.rating?.toString().trim().toLowerCase();

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${s.avatarURL || ''}">
      <div>
        <b>${s.name}</b>

        ${isYou ? `
          <p style="opacity:0.6;">This is you</p>
        ` : `
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

  document.querySelectorAll("select, textarea")
    .forEach(el => el.addEventListener("change", saveReviews));
}

async function loadAdmin() {
  if (!USER?.isWebAdmin) return;

  setActivePage("admin");

  if (!STAFF_CACHE) {
    STAFF_CACHE = await post("getStaff");
  }

  const monthValue = document.getElementById("adminMonthSelect")?.value || month();
  const ratings = await post("getRatings", { month: monthValue });

  const statsBox = document.getElementById("adminStats");
  const reviewsBox = document.getElementById("adminReviews");

  if (!Array.isArray(STAFF_CACHE) || !Array.isArray(ratings)) {
    if (statsBox) statsBox.innerHTML = "<div class='card'>❌ Failed to load admin data</div>";
    if (reviewsBox) reviewsBox.innerHTML = "";
    return;
  }

  const numeric = {
    Excels: 5,
    "On Par": 4,
    "Meets Standards": 3,
    "Below Par": 2,
    "Needs Work": 1
  };

  const stats = STAFF_CACHE.map(s => {
    const teamRatings = ratings.filter(r => String(r.targetId).trim() === String(s.discordId).trim());
    const count = teamRatings.length;
    const average = count ? (teamRatings.reduce((sum, r) => sum + (numeric[r.rating] || 0), 0) / count).toFixed(2) : null;
    const comments = teamRatings.filter(r => String(r.comment ?? "").trim()).length;
    return { staff: s, count, average, comments, ratings: teamRatings };
  });

  if (statsBox) {
    statsBox.innerHTML = stats.map(stat => `
      <div class="stat-card">
        <b>${stat.staff.name}</b>
        <span>Reviews: ${stat.count}</span>
        <span>Average: ${stat.average ?? "N/A"}</span>
        <span>Comments: ${stat.comments}</span>
      </div>
    `).join("");
  }

  if (reviewsBox) {
    reviewsBox.innerHTML = ratings.length ? ratings.map(r => {
      const target = STAFF_CACHE.find(s => String(s.discordId).trim() === String(r.targetId).trim());
      const name = target ? target.name : String(r.targetId).trim();
      return `
        <div class="review-card">
          <b>${name}</b>
          <small>Reviewer: ${String(r.reviewerId).trim()} · Rating: ${r.rating}</small>
          <p>${String(r.comment || "").trim() || "No comment."}</p>
        </div>
      `;
    }).join("") : "<div class='card'>No ratings found for this month.</div>";
  }
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
    await verify();
    setupNav();
    await loadReviews();
  } catch (e) {
    console.error(e);
    document.body.innerHTML = "❌ Failed to load portal";
  }
})();