// Small floating calculator for working the benefit math. Not full-screen — it sits in the
// corner so you can see the case while you compute. Type an expression or use the keys.

const SAFE = /^[0-9+\-*/().\s]*$/;

function evaluate(display) {
  const expr = display.value;
  if (!expr.trim()) return;
  if (!SAFE.test(expr)) {
    display.value = "Error";
    return;
  }
  try {
    // Sanitized to digits/operators/parens above, so this is safe arithmetic only.
    const val = Function('"use strict"; return (' + expr + ")")();
    if (typeof val === "number" && isFinite(val)) {
      display.value = String(Math.round(val * 100) / 100);
    } else {
      display.value = "Error";
    }
  } catch (e) {
    display.value = "Error";
  }
}

export function initCalculator() {
  const fab = document.getElementById("calc-fab");
  const panel = document.getElementById("calc-panel");
  const display = document.getElementById("calc-display");
  const keys = document.getElementById("calc-keys");
  const closeBtn = document.getElementById("calc-close");
  if (!fab || !panel || !display || !keys) return;

  const toggle = () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) display.focus();
  };
  fab.onclick = toggle;
  if (closeBtn) closeBtn.onclick = () => (panel.hidden = true);

  keys.addEventListener("click", (e) => {
    const btn = e.target.closest(".calc-key");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "clear") display.value = "";
    else if (act === "back") display.value = display.value.slice(0, -1);
    else if (act === "eq") evaluate(display);
    else {
      if (display.value === "Error") display.value = "";
      display.value += btn.dataset.val;
    }
    display.focus();
  });

  display.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      evaluate(display);
    }
  });
}
