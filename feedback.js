// Beta feedback → external Google Form. Works on any static host with no backend.
//
// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ SETUP (one time):                                                             │
// │ 1. Create a Google Form. Suggested questions:                                 │
// │      • Overall rating          (Linear scale 1–5)                             │
// │      • What's this about?       (Multiple choice: Bug / Confusing / Policy    │
// │                                  accuracy / Feature idea / Visual / Other)     │
// │      • Your feedback            (Paragraph)                                    │
// │      • Where were you? (opt.)   (Short answer — auto-filled if you set PREFILL)│
// │ 2. Click Send → link icon → copy the URL, and paste it below.                 │
// └─────────────────────────────────────────────────────────────────────────────┘
const FEEDBACK_FORM_URL = "https://forms.gle/4DRh2J5PiR7A5az96";

// OPTIONAL: auto-fill the "Where were you?" question with the current mode + module.
// Use the FULL form URL (…/viewform, not a forms.gle short link), add a short-answer
// question, find its field id (entry.123456789), and paste it here. Leave "" to skip.
const PREFILL_CONTEXT_ENTRY = "";

function isConfigured() {
  return FEEDBACK_FORM_URL && !/PASTE_YOUR/.test(FEEDBACK_FORM_URL);
}

function modeLabel(mode) {
  if (mode === "learning") return "Learning Mode";
  if (mode === "graded") return "Graded Shift";
  return null;
}

function formUrlWithContext(ctx) {
  if (!isConfigured()) return "#";
  let url = FEEDBACK_FORM_URL;
  if (PREFILL_CONTEXT_ENTRY && /\/viewform/.test(url)) {
    const label = [modeLabel(ctx.mode), ctx.module].filter(Boolean).join(" · ");
    const sep = url.includes("?") ? "&" : "?";
    url += `${sep}usp=pp_url&${encodeURIComponent(PREFILL_CONTEXT_ENTRY)}=${encodeURIComponent(label)}`;
  }
  return url;
}

function closeFeedback() {
  const s = document.getElementById("feedback-screen");
  if (s) s.hidden = true;
}

function render(card, ctx) {
  const ctxLabel = [modeLabel(ctx.mode), ctx.module].filter(Boolean).join(" · ");
  const configured = isConfigured();
  card.innerHTML = `
    <div class="wc-kicker">💬 Beta Feedback</div>
    <h1 class="wc-title">Tell us how it's going</h1>
    <p class="fb-intro">This trainer is in beta. Feedback opens in a short Google Form (new tab) — spot a bug, a confusing screen, or a policy detail that looks off? Let us know.</p>
    ${ctxLabel ? `<p class="fb-ctx">You're in: <strong>${ctxLabel}</strong> — handy to mention in the form.</p>` : ""}
    ${configured ? "" : `<p class="fb-foot fb-error">⚠ Feedback form not configured yet — paste your Google Form link into <code>feedback.js</code> (FEEDBACK_FORM_URL).</p>`}
    <div class="wc-menu">
      ${
        configured
          ? `<a class="wc-btn primary" id="fb-open" href="${formUrlWithContext(ctx)}" target="_blank" rel="noopener">Open feedback form ↗</a>`
          : `<button class="wc-btn primary" id="fb-open" disabled>Open feedback form ↗</button>`
      }
      <button class="wc-btn" id="fb-cancel">Cancel</button>
    </div>
  `;
  card.querySelector("#fb-cancel").onclick = closeFeedback;
  const open = card.querySelector("#fb-open");
  if (open && configured) open.addEventListener("click", () => setTimeout(closeFeedback, 150));
}

export function initFeedbackButton(getContext) {
  const link = document.getElementById("feedback-link");
  if (!link) return;
  link.onclick = () => {
    const card = document.getElementById("feedback-card");
    const screen = document.getElementById("feedback-screen");
    if (!card || !screen) return;
    render(card, (getContext && getContext()) || {});
    screen.hidden = false;
  };
}
