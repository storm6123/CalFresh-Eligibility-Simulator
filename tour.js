// Optional guided interface tour ("spotlight" onboarding). Dims the screen, highlights one
// element at a time with a tooltip, and steps through the layout. Fully skippable.

let steps = [];
let idx = 0;
let onDone = null;
let repositionHandler = null;

function els() {
  return {
    layer: document.getElementById("tour-layer"),
    spot: document.getElementById("tour-spotlight"),
    tip: document.getElementById("tour-tip"),
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function position() {
  const { spot, tip } = els();
  const step = steps[idx];
  const target = step.selector ? document.querySelector(step.selector) : null;

  if (target) {
    const r = target.getBoundingClientRect();
    const pad = 6;
    spot.style.display = "block";
    spot.style.top = r.top - pad + "px";
    spot.style.left = r.left - pad + "px";
    spot.style.width = r.width + pad * 2 + "px";
    spot.style.height = r.height + pad * 2 + "px";

    const tipH = tip.offsetHeight || 160;
    const tipW = tip.offsetWidth || 300;
    let top = r.bottom + 12;
    if (top + tipH > window.innerHeight - 10) top = Math.max(10, r.top - tipH - 12);
    let left = clamp(r.left, 10, window.innerWidth - tipW - 10);
    tip.style.top = top + "px";
    tip.style.left = left + "px";
  } else {
    // No target — center the tooltip, no spotlight.
    spot.style.display = "none";
    const tipH = tip.offsetHeight || 160;
    const tipW = tip.offsetWidth || 300;
    tip.style.top = window.innerHeight / 2 - tipH / 2 + "px";
    tip.style.left = window.innerWidth / 2 - tipW / 2 + "px";
  }
}

function render() {
  const { tip } = els();
  const step = steps[idx];
  const target = step.selector ? document.querySelector(step.selector) : null;
  if (target) target.scrollIntoView({ block: "center", inline: "nearest" });

  const isLast = idx === steps.length - 1;
  tip.innerHTML = `
    <div class="tour-step">Step ${idx + 1} of ${steps.length}</div>
    <h3 class="tour-title">${step.title}</h3>
    <p class="tour-body">${step.body}</p>
    <div class="tour-controls">
      <button class="tour-btn ghost" id="tour-skip">Skip tour</button>
      <span class="tour-spacer"></span>
      ${idx > 0 ? '<button class="tour-btn" id="tour-back">Back</button>' : ""}
      <button class="tour-btn primary" id="tour-next">${isLast ? "Done" : "Next"}</button>
    </div>`;

  tip.querySelector("#tour-skip").onclick = finish;
  tip.querySelector("#tour-next").onclick = () => (isLast ? finish() : go(idx + 1));
  const back = tip.querySelector("#tour-back");
  if (back) back.onclick = () => go(idx - 1);

  // Let layout settle, then position (tooltip height is known after content set).
  setTimeout(position, 30);
}

function go(n) {
  idx = clamp(n, 0, steps.length - 1);
  render();
}

function finish() {
  const { layer } = els();
  if (layer) layer.hidden = true;
  if (repositionHandler) {
    window.removeEventListener("resize", repositionHandler);
    window.removeEventListener("scroll", repositionHandler, true);
    repositionHandler = null;
  }
  const cb = onDone;
  onDone = null;
  if (cb) cb();
}

export function startTour(tourSteps, done) {
  steps = tourSteps || [];
  onDone = done || null;
  idx = 0;
  if (!steps.length) {
    if (onDone) onDone();
    return;
  }
  const { layer } = els();
  if (!layer) return;
  layer.hidden = false;
  repositionHandler = () => {
    if (!layer.hidden) position();
  };
  window.addEventListener("resize", repositionHandler);
  window.addEventListener("scroll", repositionHandler, true);
  render();
}
