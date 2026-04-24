const API = "https://remoteworker23.jeoliver1fan.workers.dev/";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");
const token = params.get("token");

function month() {
  return new Date().toISOString().slice(0, 7);
}

// ---------------- SAFE API ----------------

async function post(action, data = {}) {
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data })
    });

    const text = await res.text();

    if (!text || !text.trim().startsWith("{")) {
      throw new Error("Bad API response: " + text);
    }

    return JSON.parse(text);

  } catch (e) {
    console.error("API ERROR:", action, e);
    return null;
  }
}

// ---------------- LOADING UI ----------------

function setLoading(state) {
  const spinner = document.getElementById("loadingSpinner");
  const box = document.getElementById("ratingsBox");

  if (spinner) spinner.style.display = state ? "block" : "none";
  if (box) box.style.display = state ? "none" : "block";
}

// ---------------- VERIFY ----------------

async function verify() {
  const res = await post("verifyUser", {
    discordId: userId,
    token
  });

  if (!res || !res.valid) {
    document.body.innerHTML = "❌ Unauthorized";
    throw new Error("Unauthorized");
  }
}

// ---------------- LOAD REVIEWS ----------------

async function loadReviews() {
  setLoading(true);

  const box = document.getElementById("ratingsBox");
  if (!box) {
    setLoading(false);
    return;
  }

  let staff = null;
  let existing = null;

  try {
    staff = await post("getStaff");
    existing = await post("getRatings", { month: month() });

    if (!Array.isArray(staff)) throw new Error("Staff invalid");
    if (!Array.isArray(existing)) throw new Error("Ratings invalid");

  } catch (e) {
    console.error("LOAD ERROR:", e);
    box.innerHTML = "❌ Failed to load staff data";
    setLoading(false);
    return;
  }

  box.innerHTML = "";

  let rendered = false;

  staff.forEach(s => {
    if (!s.isActive) return;

    rendered = true;

    const isYou = String(s.discordId) === String(userId);

    const my = existing.find(e =>
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

  if (!rendered) {
    box.innerHTML = "⚠️ No staff available";
  }

  document.querySelectorAll("select, textarea").forEach(el => {
    el.addEventListener("change", saveReviews);
  });

  setLoading(false);
}

// ---------------- SAVE REVIEWS ----------------

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
}

// ---------------- INIT ----------------

(async () => {
  try {
    setLoading(true);

    await verify();
    await loadReviews();

  } catch (e) {
    console.error(e);
    document.body.innerHTML = "❌ Failed to load portal";
  }
})();