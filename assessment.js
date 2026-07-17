// Fixed pre/post assessment — a stable 10-question quiz (NOT the random generator) so a
// learner's score before vs. after training is comparable. Measures learning gain for pilots.
// Answers are grounded in the audited FFY2026 + H.R.1 rules.

const STORAGE_KEY = "snapTrainerAssessments";

const QUESTIONS = [
  {
    module: "SNAP Basics",
    prompt: "A 1-person household has $1,200/mo gross earned income and no other income, no dependent-care/medical/shelter deductions. What is their net monthly income?",
    type: "number",
    correct: 751, // 1200 − 20% EID (240) = 960; − $209 standard = 751
    tolerance: 2,
    explain: "Subtract the 20% earned-income deduction ($240) → $960, then the $209 standard deduction → $751.",
  },
  {
    module: "SNAP Basics",
    prompt: "Under standard (non-MCE) rules, a 3-person household has $3,000/mo gross income. Do they pass the gross income test (≤130% FPL)?",
    type: "yesno",
    correct: false, // 130% FPL size 3 = $2,888
    explain: "The 130% FPL gross limit for size 3 is $2,888. $3,000 exceeds it, so they fail the gross test.",
  },
  {
    module: "Deductions",
    prompt: "What is the standard deduction for a 4-person household (FFY 2026)?",
    type: "choice",
    choices: [
      { label: "$209", value: "209" },
      { label: "$223", value: "223" },
      { label: "$261", value: "261" },
      { label: "$299", value: "299" },
    ],
    correct: "223",
    explain: "FFY2026 standard deduction: $209 for sizes 1–3, $223 for 4, $261 for 5, $299 for 6+.",
  },
  {
    module: "Deductions",
    prompt: "Which income is reduced by the 20% earned-income deduction?",
    type: "choice",
    choices: [
      { label: "Only earned income", value: "earned" },
      { label: "Only unearned income", value: "unearned" },
      { label: "Both earned and unearned", value: "both" },
    ],
    correct: "earned",
    explain: "The 20% deduction applies only to earned income. Unearned income counts in full toward net income.",
  },
  {
    module: "Elderly & Disabled",
    prompt: "Households with a member aged 60+ or disabled are exempt from the gross income test.",
    type: "yesno",
    correct: true,
    explain: "Correct — elderly/disabled households skip the gross-income test (net test still applies) and get a higher resource limit and uncapped shelter deduction.",
  },
  {
    module: "Elderly & Disabled",
    prompt: "Under Modified/Broad-Based Categorical Eligibility (MCE), the household still must pass the net income test.",
    type: "yesno",
    correct: true,
    explain: "MCE waives the asset test and raises the gross limit to 200% FPL, but the 100% FPL net income test still applies.",
  },
  {
    module: "SNAP Basics",
    prompt: "An eligible 2-person household has $800/mo net income. What is their monthly SNAP benefit?",
    type: "number",
    correct: 306, // max allotment size 2 ($546) − 30% of 800 ($240)
    tolerance: 2,
    explain: "Benefit = max allotment ($546 for size 2) − 30% of net income ($240) = $306.",
  },
  {
    module: "ABAWD",
    prompt: "A 40-year-old, able-bodied adult lives with and cares for their 15-year-old child (no younger children). Are they subject to the ABAWD time limit?",
    type: "yesno",
    correct: true, // child 14-17 does NOT exempt post-H.R.1
    explain: "Yes. H.R.1 narrowed the dependent-child exemption to a child under 14 — caring for a 15-year-old no longer exempts, so they are subject to the time limit.",
  },
  {
    module: "ABAWD",
    prompt: "Does veteran status, on its own, exempt someone from the ABAWD time limit under current (H.R.1) rules?",
    type: "yesno",
    correct: false,
    explain: "No. H.R.1 repealed the FRA-2023 exemptions for veterans, homeless individuals, and former foster youth.",
  },
  {
    module: "Noncitizen",
    prompt: "Under H.R.1/OBBB, is a refugee (not separately an LPR) eligible for SNAP?",
    type: "yesno",
    correct: false,
    explain: "No. OBBB narrowed eligibility to U.S. citizens/nationals, LPRs, Cuban/Haitian entrants, and COFA citizens. Refugees and asylees are no longer eligible unless they are separately an LPR.",
  },
];

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}
function save(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    /* ignore */
  }
}

let idx = 0;
let answers = [];

function isCorrect(q, given) {
  if (q.type === "number") return Math.abs(Number(given) - q.correct) <= (q.tolerance || 0);
  return given === q.correct;
}

function screen() {
  return { s: document.getElementById("assessment-screen"), c: document.getElementById("assessment-card") };
}

function renderIntro() {
  const { c } = screen();
  const attempts = load();
  const baseline = attempts[0];
  c.innerHTML = `
    <div class="wc-kicker">🎓 Knowledge Check</div>
    <h1 class="wc-title">Assessment</h1>
    <p class="fb-intro">${QUESTIONS.length} questions across all six modules — no coaching, no hints. Take it <strong>before</strong> you train to set a baseline, then again <strong>after</strong> to measure your gain.${
      baseline ? ` Your baseline: <strong>${baseline.pct}%</strong>.` : ""
    }</p>
    <div class="wc-menu">
      <button class="wc-btn primary" id="as-start">${baseline ? "Retake assessment" : "Start assessment"}</button>
      <button class="wc-btn" id="as-cancel">Cancel</button>
    </div>
  `;
  c.querySelector("#as-start").onclick = () => {
    idx = 0;
    answers = [];
    renderQuestion();
  };
  c.querySelector("#as-cancel").onclick = close;
}

function renderQuestion() {
  const { c } = screen();
  const q = QUESTIONS[idx];
  let input = "";
  if (q.type === "yesno") {
    input = `<div class="answer-row"><button class="answer-btn" data-v="true">Yes</button><button class="answer-btn" data-v="false">No</button></div>`;
  } else if (q.type === "choice") {
    input = `<div class="answer-row choice-col">${q.choices
      .map((ch) => `<button class="answer-btn choice-btn" data-v="${ch.value}">${ch.label}</button>`)
      .join("")}</div>`;
  } else {
    input = `<div class="answer-row"><span class="dollar-prefix">$</span><input type="number" id="as-num" class="num-input" placeholder="0" /><button class="answer-btn submit-btn" id="as-submit">Submit</button></div>`;
  }
  c.innerHTML = `
    <div class="wc-kicker">🎓 Assessment — Question ${idx + 1} of ${QUESTIONS.length}</div>
    <p class="prompt as-prompt">${q.prompt}</p>
    ${input}
  `;
  if (q.type === "number") {
    const inp = c.querySelector("#as-num");
    const submit = () => {
      if (inp.value === "") return;
      record(Number(inp.value));
    };
    c.querySelector("#as-submit").onclick = submit;
    inp.addEventListener("keydown", (e) => e.key === "Enter" && submit());
    inp.focus();
  } else {
    c.querySelectorAll(".answer-btn").forEach((b) => {
      b.onclick = () => {
        const raw = b.dataset.v;
        record(raw === "true" ? true : raw === "false" ? false : raw);
      };
    });
  }
}

function record(given) {
  const q = QUESTIONS[idx];
  answers.push({ q, given, correct: isCorrect(q, given) });
  idx++;
  if (idx < QUESTIONS.length) renderQuestion();
  else finish();
}

function finish() {
  const { c } = screen();
  const correct = answers.filter((a) => a.correct).length;
  const pct = Math.round((correct / QUESTIONS.length) * 100);
  const attempts = load();
  const baseline = attempts[0];
  attempts.push({ pct, correct, total: QUESTIONS.length, ts: new Date().toISOString() });
  save(attempts);

  let gainLine = "";
  if (baseline) {
    const delta = pct - baseline.pct;
    gainLine = `<p class="as-gain">Baseline <strong>${baseline.pct}%</strong> → Now <strong>${pct}%</strong> <span class="${
      delta >= 0 ? "per-good" : "per-bad"
    }">(${delta >= 0 ? "+" : ""}${delta} points)</span></p>`;
  } else {
    gainLine = `<p class="as-gain">Baseline recorded. Train, then retake to measure your gain.</p>`;
  }

  const review = answers
    .map(
      (a, i) =>
        `<div class="as-review ${a.correct ? "ok" : "bad"}"><span class="as-rq">${i + 1}. ${a.q.module}</span> — ${
          a.correct ? "✓ correct" : "✗ incorrect"
        }<div class="as-rex">${a.q.explain}</div></div>`
    )
    .join("");

  c.innerHTML = `
    <div class="wc-kicker">🎓 Assessment complete</div>
    <h1 class="wc-title">${correct} / ${QUESTIONS.length} — ${pct}%</h1>
    ${gainLine}
    <div class="as-reviews">${review}</div>
    <div class="wc-menu"><button class="wc-btn primary" id="as-done">Done</button></div>
  `;
  c.querySelector("#as-done").onclick = close;
}

function close() {
  const { s } = screen();
  if (s) s.hidden = true;
}

export function initAssessment() {
  const link = document.getElementById("wc-assessment");
  if (link)
    link.onclick = () => {
      const { s } = screen();
      if (!s) return;
      renderIntro();
      s.hidden = false;
    };
}
