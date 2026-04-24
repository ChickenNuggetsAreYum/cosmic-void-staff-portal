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
}

// ---------------- NAV ----------------

function setupNav() {
  const reviewsTab = document.querySelector("[data-page='reviews']");

  if (reviewsTab) {
    reviewsTab.addEventListener("click", async (e) => {
      e.preventDefault();
      await loadReviews();
    });
  }
}

// ---------------- LOAD REVIEWS ----------------

async function loadReviews() {
  const box = document.getElementById("ratingsBox");
  if (!box) return;

  // fetch once only
  if (!STAFF_CACHE) {
    STAFF_CACHE = await post("getStaff");
  }

  if (!RATINGS_CACHE) {
    RATINGS_CACHE = await post("getRatings", { month: month() });
  }

  if (!Array.isArray(STAFF_CACHE) || !Array.isArray(RATINGS_CACHE)) {
    box.innerHTML = "❌ Failed to load data";
    return;
  }

  box.innerHTML = "";

  STAFF_CACHE.forEach(s => {
    if (!s.isActive) return;

    const isYou = String(s.discordId) === String(userId);

    const my = RATINGS_CACHE.find(e =>
      String(e.targetId) === String(s.discordId)
    );

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
              .map(v => `
                <option ${my?.rating === v ? "selected" : ""}>${v}</option>
              `).join("")}
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