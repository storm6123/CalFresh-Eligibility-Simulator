// Cosmetic gamification helpers — progression math, celebratory effects, avatars.
// None of this affects determinations or scoring; it's pure motivational polish that reads
// the existing Points total (used here as XP toward a worker rank).

// Career ranks, keyed off cumulative Points (earned only in graded play).
export const RANKS = [
  { min: 0, title: "Trainee", icon: "🌱" },
  { min: 500, title: "Eligibility Worker I", icon: "📄" },
  { min: 1500, title: "Eligibility Worker II", icon: "📊" },
  { min: 3000, title: "Eligibility Worker III", icon: "🗂️" },
  { min: 5000, title: "Senior Eligibility Worker", icon: "⭐" },
  { min: 8000, title: "Lead Worker", icon: "🎖️" },
  { min: 12000, title: "Supervisor", icon: "🏅" },
  { min: 18000, title: "Bureau Chief", icon: "👑" },
];

export function rankProgress(score) {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (score >= r.min) idx = i;
  });
  const rank = RANKS[idx];
  const next = RANKS[idx + 1] || null;
  const pct = next ? Math.max(0, Math.min(100, Math.round(((score - rank.min) / (next.min - rank.min)) * 100))) : 100;
  return { rank, next, pct, toNext: next ? next.min - score : 0, isMax: !next };
}

export const AVATARS = ["🧑‍💼", "👩‍💼", "👨‍💼", "🧑‍💻", "👩‍🏫", "🧕", "👨‍🦱", "👩‍🦰", "🧑‍🦲", "👳", "🦸", "🐻"];

// ---- Effects layer (floating text, confetti, toasts) ----

function fxRoot() {
  let r = document.getElementById("fx-root");
  if (!r) {
    r = document.createElement("div");
    r.id = "fx-root";
    document.body.appendChild(r);
  }
  return r;
}

// Floating "+N" style pop near a screen point.
export function floatPop(text, x, y) {
  const s = document.createElement("div");
  s.className = "fx-float";
  s.textContent = text;
  s.style.left = x + "px";
  s.style.top = y + "px";
  fxRoot().appendChild(s);
  setTimeout(() => s.remove(), 1100);
}

// Pop near the center-top of an element (e.g., the step area) when it exists.
export function floatPopAt(selector, text) {
  const elem = document.querySelector(selector);
  if (!elem) return;
  const r = elem.getBoundingClientRect();
  floatPop(text, r.left + r.width / 2 - 16, r.top + 12);
}

export function confettiBurst() {
  const root = fxRoot();
  const colors = ["#2166b0", "#efa829", "#2e7d32", "#c0392b", "#8e44ad", "#16a2b8"];
  for (let i = 0; i < 32; i++) {
    const c = document.createElement("div");
    c.className = "fx-confetti";
    c.style.left = 8 + Math.random() * 84 + "%";
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = Math.random() * 0.25 + "s";
    c.style.setProperty("--rot", Math.random() * 360 + "deg");
    root.appendChild(c);
    setTimeout(() => c.remove(), 2000);
  }
}

// Non-blocking celebratory banner (top-center), auto-dismisses.
export function toast(html) {
  const t = document.createElement("div");
  t.className = "fx-toast";
  t.innerHTML = html;
  fxRoot().appendChild(t);
  setTimeout(() => t.classList.add("show"), 20);
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 400);
  }, 3600);
}
