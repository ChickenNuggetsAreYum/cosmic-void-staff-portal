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
    return JSON.parse(text);

  } catch (e) {
    console.error("API ERROR:", action, e);
    return null;
  }
}

// ---------------- VERIFY ----------------

async function verify() {
  const res = await post("verifyUser", { discordId: userId, token });

  if (!res || !res.valid) {
    document.body.innerHTML = "❌ Unauthorized";
    throw new Error("Unauthorized");
  }
}

// ---------------- LOADING UI ----------------

function setLoading(state) {
  const spinner = document.getElementById("loadingSpinner");
  const box = document.getElementById("ratingsBox");

  if (spinner) spinner.style.display = state ? "block" : "none";
  if (box) box.style.display = state ? "none" : "block";
}

// ---------------- LOAD REVIEWS ----------------

async function loadReviews() {
  setLoading(true);

  const box = document.getElementById("ratingsBox");
  if (!box) {
    setLoading(false);
    return;
  }

  const staff = await post("getStaff");
  const existing = await post("getRatings", { month: month() });

  if (!staff || !existing) {
    box.innerHTML = "⚠️ Failed to load staff or ratings";
    setLoading(false);
    return;
  }

  box.innerHTML = "";

  staff.forEach(s => {
    if (!s.isActive) return;

    const isYou = String(s.discordId) === String(userId);

    const my = (existing || []).find(e =>
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

  document.querySelectorAll("select, textarea").forEach(el => {
    el.addEventListener("change", saveReviews);
  });

  setLoading(false);
}

// ---------------- SAVE ----------------

async function saveReviews() {
  const ratings = [];

  document.querySelectorAll("select").forEach(sel => {
    const id = sel.dataset.id;
    if (!id || id === userId) return;

    const comment = document.querySelector(
      `textarea[data-id="${id}"]`
    )?.value || "";

    if (sel.value === "N/A") return;

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