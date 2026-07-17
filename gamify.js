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

export const AVATARS = ["🐻", "🦊", "🦁", "🐯", "🐨", "🐼", "🐸", "🦉", "🐧", "🐢", "🦆", "🦅"];

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

// ---- Sound (synthesized via Web Audio — no asset files; off by default) ----

let _ctx = null;
function audio() {
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      _ctx = null;
    }
  }
  return _ctx;
}

export function soundEnabled() {
  try {
    return localStorage.getItem("snapTrainerSound") === "1";
  } catch (e) {
    return false;
  }
}
export function setSound(on) {
  try {
    localStorage.setItem("snapTrainerSound", on ? "1" : "0");
  } catch (e) {
    /* ignore */
  }
}

function blip(freq, start, dur, type, vol) {
  const c = audio();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type || "sine";
  o.frequency.value = freq;
  o.connect(g);
  g.connect(c.destination);
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol || 0.1, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// Short, subtle cues. name: correct | wrong | points | unlock | rankup
export function playSound(name) {
  if (!soundEnabled()) return;
  const c = audio();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  if (name === "correct") {
    blip(660, 0, 0.12, "sine", 0.1);
    blip(880, 0.09, 0.14, "sine", 0.1);
  } else if (name === "wrong") {
    blip(196, 0, 0.18, "sine", 0.08);
  } else if (name === "points") {
    blip(1046, 0, 0.07, "triangle", 0.06);
  } else if (name === "unlock") {
    [523, 659, 784, 1046].forEach((f, i) => blip(f, i * 0.09, 0.16, "triangle", 0.09));
  } else if (name === "rankup") {
    [523, 659, 784, 1046, 1318].forEach((f, i) => blip(f, i * 0.08, 0.2, "sine", 0.1));
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
