import { CITATIONS, SNAP } from "./rules.js";
import { LEVELS, generateCase } from "./scenarios.js";
import { computeShift, perStatus, benchmarkEntries, QC_ERROR_EXCLUSION, ALASKA_EXEMPTION_PER } from "./scoring.js";
import { startBearFight } from "./bearfight.js";
import { initFeedbackButton } from "./feedback.js";
import { initCalculator } from "./calculator.js";
import { initReference } from "./reference.js";
import { initAssessment } from "./assessment.js";
import { startTour } from "./tour.js";

const STORAGE_KEY = "snapTrainerState";
const CASES_TO_UNLOCK_NEXT = 3;
const MAX_LEADERBOARD = 30;
const MIN_CASES_TO_SUBMIT = 10; // a single case can't swing PER — require a fuller sample first
const MAX_HISTORY_ROWS = 20;

function emptySession() {
  return { casesProcessed: 0, correct: 0, total: 0, totalResponseMs: 0, perErrorDollars: 0, perDenominatorDollars: 0, history: [] };
}

function loadState() {
  let s = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) s = JSON.parse(raw);
  } catch (e) {
    /* ignore corrupt storage */
  }
  if (!s) s = {};
  // Normalize so older saved state still works after the leaderboard update.
  s.unlockedLevel = s.unlockedLevel || 1;
  s.score = s.score || 0;
  s.citations = s.citations || [];
  s.levelStats = s.levelStats || {};
  s.session = s.session || emptySession();
  if (s.session.perErrorDollars == null) s.session.perErrorDollars = 0;
  if (s.session.perDenominatorDollars == null) s.session.perDenominatorDollars = 0;
  if (!Array.isArray(s.session.history)) s.session.history = [];
  s.leaderboard = s.leaderboard || null; // seeded on first init
  s.playerName = s.playerName || null;
  return s;
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function levelStats(level) {
  if (!state.levelStats[level]) state.levelStats[level] = { completed: 0, correct: 0, total: 0 };
  return state.levelStats[level];
}

let currentLevel = 1;
let currentCase = null;
let stepIndex = 0;
let streak = 0;
let caseCorrectCount = 0;
let caseTotalCount = 0;
let awaitingNext = false;
let stepStartTime = 0;
let mode = "play"; // "play" | "board"
let gameMode = "graded"; // "graded" | "learning"
let caseAnswers = {}; // step.id -> { given, correct } for the current case (drives dollar-weighted PER)

const el = (id) => document.getElementById(id);

function fmtMoney(n) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

// Learning Mode coaching: teach the METHOD (and the real FY2026 numbers) for each
// determination step, grounded in the current case's household.
function coachHint(step) {
  const hh = currentCase ? currentCase.household : null;
  const size = hh ? hh.size : 1;
  const noncitizen = `After H.R.1 / OBBB, the only SNAP-eligible immigration statuses are: U.S. citizens & nationals, Lawful Permanent Residents (green-card holders — usually after a 5-year wait), Cuban/Haitian entrants, and COFA citizens. Refugees, asylees, most parolees, SIV holders, and trafficking/battered/conditional entrants are <em>no longer</em> eligible unless they are also an LPR.`;

  switch (step.id) {
    case "pathway":
      return `Pick the eligibility pathway first. If <em>every</em> member gets CalWORKs/TANF or SSI → <strong>full Categorical Eligibility</strong> (all financial tests waived). If the household gets a TANF-funded benefit and gross income is ≤ 200% FPL ($${SNAP.grossLimit200MCE.forSize(size).toLocaleString()} for size ${size}) → <strong>Modified CE</strong> (resource test waived, but the net-income test still applies). Otherwise → <strong>standard rules</strong> (gross, net, and resource tests all apply).`;
    case "netIncome":
      return `Start from <strong>total gross income = earned + unearned</strong>. Then apply deductions in the mandatory federal order: (1) subtract 20% of <strong>earned</strong> income only (the earned-income deduction — unearned income is <em>not</em> reduced and counts in full); (2) subtract the standard deduction (<strong>$${SNAP.standardDeduction(size)}</strong> for size ${size}); (3) dependent-care costs; (4) medical expenses over $${SNAP.medicalExpenseThreshold} (elderly/disabled members only); (5) excess shelter — shelter + the utility allowance above half of the remaining income, capped at $${SNAP.maxShelterDeductionNonElderly} unless the household has an elderly/disabled member. What remains is net monthly income.`;
    case "eligible":
      if (currentLevel === 5) return noncitizen;
      return `Check every applicable test. <strong>Gross income</strong> ≤ 130% FPL ($${SNAP.grossLimit130.forSize(size).toLocaleString()} for size ${size}) — or ≤ 200% ($${SNAP.grossLimit200MCE.forSize(size).toLocaleString()}) under Modified CE, and waived if the household is elderly/disabled. <strong>Net income</strong> ≤ 100% FPL ($${SNAP.netLimit100.forSize(size).toLocaleString()}). <strong>Resources</strong> ≤ $${SNAP.resourceLimitStandard.toLocaleString()} ($${SNAP.resourceLimitElderlyDisabled.toLocaleString()} if elderly/disabled), unless waived by CE. The household must pass all tests that apply.`;
    case "benefit":
      return `Benefit = maximum allotment − 30% of net income (dropped to whole dollars). The max allotment for size ${size} is <strong>$${SNAP.maxAllotment.forSize(size).toLocaleString()}</strong>. If the household is ineligible, the benefit is $0. Households of 1–2 have a $${SNAP.minimumAllotment1to2} minimum allotment.`;
    case "isAbawd":
    case "abawd":
      return `An ABAWD is age <strong>18–64</strong>, able-bodied, and not responsible for a dependent child <strong>under age 14</strong>. Anyone outside that age range, disabled, or caring for a child under 14 is <em>not</em> an ABAWD. Trap: H.R.1 narrowed the dependent-child exemption from under-18 to <strong>under-14</strong>, so caring only for a 14–17-year-old no longer exempts. (H.R.1 also raised the top age from 54 to 64.)`;
    case "subjectToTimeLimit":
      return `An ABAWD is subject to the 3-months-in-36 time limit <em>unless</em> exempt: meeting the 20 hr/week (80 hr/month) work requirement, pregnant, medically unfit for work, or a Native American tribal member. Watch the traps: H.R.1 <strong>repealed</strong> the veteran, homeless, and former-foster-youth exemptions (so those alone no longer exempt), and being age 60–64 exempts someone from work <em>registration</em> but NOT from the ABAWD time limit.`;
    case "waitingPeriod":
      return `Lawful Permanent Residents generally must wait 5 years before qualifying — unless they are under 18, blind/disabled, have 40 qualifying work quarters, have a U.S. military connection, or meet another listed exception.`;
    case "noncitizen":
      return noncitizen;
    default:
      return step.explain || "Work through the household facts and apply the relevant rule.";
  }
}

function stepCorrectStr(step) {
  return step.type === "number"
    ? "$" + Math.round(step.correct).toLocaleString()
    : step.type === "yesno"
    ? step.correct
      ? "Yes"
      : "No"
    : String(step.correct);
}

function stepCiteHtml(step) {
  return (step.citationKeys || [])
    .map((k) => CITATIONS[k])
    .filter(Boolean)
    .map((c) => `<a href="${c.url}" target="_blank" rel="noopener">${c.label}</a>`)
    .join(" · ");
}

function nextStepButtonHtml() {
  return `<button class="answer-btn next-btn" id="next-step">${stepIndex + 1 >= currentCase.steps.length ? "Case summary" : "Next step"}</button>`;
}

function wireNextStep() {
  const btn = el("next-step");
  if (btn)
    btn.onclick = () => {
      stepIndex++;
      renderStep();
    };
}

function renderLevelTabs() {
  const wrap = el("level-tabs");
  wrap.innerHTML = "";
  LEVELS.forEach(({ level, title }) => {
    // Learning Mode unlocks every module so newcomers can explore any topic.
    const locked = gameMode === "graded" && level > state.unlockedLevel;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = (mode === "play" && level === currentLevel ? "active" : "") + (locked ? " locked" : "");
    btn.disabled = locked;
    btn.textContent = title;
    btn.title = locked ? "Complete earlier modules to unlock" : title;
    btn.onclick = () => beginModule(level);
    li.appendChild(btn);
    wrap.appendChild(li);
  });

  // My Progress (skill map) — always available.
  const progLi = document.createElement("li");
  const progBtn = document.createElement("button");
  progBtn.className = "board-link";
  progBtn.textContent = "📈 My Progress";
  progBtn.onclick = () => showProgress();
  progLi.appendChild(progBtn);
  wrap.appendChild(progLi);

  // Leaderboard entry — graded mode only (Learning Mode never posts).
  if (gameMode === "graded") {
    const boardLi = document.createElement("li");
    const boardBtn = document.createElement("button");
    boardBtn.className = "board-link" + (mode === "board" ? " active" : "");
    boardBtn.textContent = "📊 Leaderboard";
    boardBtn.onclick = () => showBoard();
    boardLi.appendChild(boardBtn);
    wrap.appendChild(boardLi);
  }
}

// Per-module skill map from persistent graded stats — shows strengths/weaknesses.
function skillLabel(pct) {
  if (pct === null) return { text: "Not started", cls: "sk-none" };
  if (pct >= 90) return { text: "Strong", cls: "sk-strong" };
  if (pct >= 70) return { text: "Developing", cls: "sk-dev" };
  return { text: "Needs work", cls: "sk-weak" };
}

function showProgress() {
  const screen = el("progress-screen");
  const card = el("progress-card");
  if (!screen || !card) return;

  let totCorrect = 0;
  let totTotal = 0;
  const rows = LEVELS.map(({ level, title }) => {
    const s = state.levelStats[level] || { completed: 0, correct: 0, total: 0 };
    totCorrect += s.correct;
    totTotal += s.total;
    const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : null;
    const lab = skillLabel(pct);
    return `<div class="sk-row">
      <div class="sk-name">${title}</div>
      <div class="sk-bar"><div class="sk-fill ${lab.cls}" style="width:${pct || 0}%"></div></div>
      <div class="sk-pct">${pct === null ? "—" : pct + "%"}</div>
      <div class="sk-tag ${lab.cls}">${lab.text}</div>
      <div class="sk-cases">${s.completed} case${s.completed === 1 ? "" : "s"}</div>
    </div>`;
  }).join("");

  const overall = totTotal > 0 ? Math.round((totCorrect / totTotal) * 100) : null;
  const weakest = LEVELS.map(({ level, title }) => {
    const s = state.levelStats[level] || { total: 0, correct: 0 };
    return { title, pct: s.total > 0 ? s.correct / s.total : null };
  })
    .filter((x) => x.pct !== null)
    .sort((a, b) => a.pct - b.pct)[0];

  card.innerHTML = `
    <div class="wc-kicker">📈 My Progress</div>
    <h1 class="wc-title">Skill Map</h1>
    <p class="fb-intro">Your accuracy by module across graded cases on this device. ${
      overall === null
        ? "Play some graded cases to start building your map."
        : `Overall: <strong>${overall}%</strong> across ${totTotal} determinations.${
            weakest ? ` Focus area: <strong>${weakest.title}</strong>.` : ""
          }`
    }</p>
    <div class="sk-map">${rows}</div>
    <div class="wc-menu"><button class="wc-btn primary" id="prog-close">Close</button></div>
  `;
  card.querySelector("#prog-close").onclick = () => (screen.hidden = true);
  screen.hidden = false;
  card.scrollTop = 0;
}

function applyModeChrome() {
  const learning = gameMode === "learning";
  ["workload-header", "workload-box", "shift-header", "shift-box", "history-section"].forEach((id) => {
    const node = el(id);
    if (node) node.style.display = learning ? "none" : "";
  });
  const banner = el("learning-banner");
  if (banner) banner.hidden = !learning;
}

function renderSidebar() {
  el("score").textContent = state.score;
  el("streak").textContent = streak > 0 ? `🔥 x${streak}` : "—";
  const stats = levelStats(currentLevel);
  el("level-progress").textContent = `${stats.completed} case${stats.completed === 1 ? "" : "s"} completed in this module`;
  renderShiftBox();
  applyModeChrome();

  const lib = el("citation-library");
  lib.innerHTML = "";
  const collected = state.citations;
  if (collected.length === 0) {
    lib.innerHTML = '<li class="empty">Answer correctly to collect policy citations here.</li>';
  } else {
    collected
      .slice()
      .reverse()
      .forEach((key) => {
        const c = CITATIONS[key];
        if (!c) return;
        const li = document.createElement("li");
        li.innerHTML = `<a href="${c.url}" target="_blank" rel="noopener">${c.label}</a>`;
        lib.appendChild(li);
      });
  }
}

function memberRole(m) {
  if (m.relationship === "applicant") return "Applicant";
  if (m.relationship === "spouse") return "Spouse";
  if (m.relationship === "child") return "Child";
  return "Member";
}

function memberFlags(m) {
  const flags = [];
  if (m.age >= 60) flags.push("60+");
  if (m.disabled) flags.push("Disabled");
  if (m.pregnant) flags.push("Pregnant");
  if (m.isVeteran) flags.push("Veteran");
  if (m.isHomeless) flags.push("Homeless");
  if (m.medicallyUnfitForWork) flags.push("Unfit for work");
  if (m.isNativeAmericanTribalMember) flags.push("Tribal member");
  if (m.hasDependentChildUnder14) flags.push("Cares for child &lt;14");
  if (m.hasChild14to17) flags.push("Child 14–17 in home");
  if (m.hasOwnMinorChildInHousehold && !m.hasDependentChildUnder14 && !m.hasChild14to17) flags.push("Has minor child");
  if ((m.workHoursPerWeek || 0) > 0) flags.push(`${m.workHoursPerWeek} hr/wk`);
  return flags.map((f) => `<span class="flag-pill">${f}</span>`).join("") || "—";
}

function renderHousehold(household) {
  const box = el("household-card");
  const levelMeta = LEVELS.find((l) => l.level === currentLevel);

  const rows = household.members
    .map(
      (m) => `<tr>
        <td>${m.name}</td>
        <td>${m.age}</td>
        <td>${memberRole(m)}</td>
        <td>${m.grossEarnedIncome ? fmtMoney(m.grossEarnedIncome) : "—"}</td>
        <td>${m.grossUnearnedIncome ? fmtMoney(m.grossUnearnedIncome) : "—"}</td>
        <td>${memberFlags(m)}</td>
      </tr>`
    )
    .join("");

  const facts = [];
  const addFact = (k, v) => facts.push(`<li><span class="fk">${k}:</span> <span class="fv">${v}</span></li>`);
  addFact("AU size", household.size);
  if (household.categoricalStatus && household.categoricalStatus !== "standard") {
    addFact(
      "Categorical status",
      household.categoricalStatus === "full_ce" ? "All members on CalWORKs/TANF or SSI" : "Receives a TANF-funded (MCE) benefit"
    );
  }
  addFact("Countable resources", fmtMoney(household.resources || 0));
  if (household.isHomelessHousehold) addFact("Housing", "Homeless household");
  if (household.shelterCost) addFact("Shelter cost", `${fmtMoney(household.shelterCost)}/mo`);
  if (household.utilityResponsibility && household.utilityResponsibility !== "none")
    addFact("Utility responsibility", household.utilityResponsibility.replace(/_/g, " "));
  if (household.dependentCareCost) addFact("Dependent care", `${fmtMoney(household.dependentCareCost)}/mo`);
  if (household.medicalExpenses) addFact("Out-of-pocket medical (elderly/disabled)", `${fmtMoney(household.medicalExpenses)}/mo`);

  box.innerHTML = `
    <span class="au-badge">Module ${currentLevel} of ${LEVELS.length} — ${levelMeta.title}</span>
    <table class="au-grid">
      <thead>
        <tr><th>Name</th><th>Age</th><th>Role</th><th>Earned Inc.</th><th>Unearned Inc.</th><th>Non-Financial Flags</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <ul class="case-facts">${facts.join("")}</ul>
  `;
}

function renderStep() {
  const stepArea = el("step-area");
  const feedbackArea = el("feedback-area");
  feedbackArea.innerHTML = "";
  awaitingNext = false;

  if (stepIndex >= currentCase.steps.length) {
    renderCaseComplete();
    return;
  }

  const step = currentCase.steps[stepIndex];
  el("progress-label").textContent = `Determination step ${stepIndex + 1} of ${currentCase.steps.length}`;
  stepStartTime = Date.now();

  let inputHtml = "";
  if (step.type === "yesno") {
    inputHtml = `
      <div class="answer-row">
        <button class="answer-btn" data-value="true">Yes</button>
        <button class="answer-btn" data-value="false">No</button>
      </div>`;
  } else if (step.type === "choice") {
    inputHtml = `<div class="answer-row choice-col">${step.choices
      .map((c) => `<button class="answer-btn choice-btn" data-value="${c.value}">${c.label}</button>`)
      .join("")}</div>`;
  } else if (step.type === "number") {
    inputHtml = `
      <div class="answer-row">
        <span class="dollar-prefix">$</span>
        <input type="number" id="num-input" class="num-input" placeholder="0" />
        <button class="answer-btn submit-btn" id="submit-num">Calculate</button>
      </div>`;
  }

  const coach = gameMode === "learning" ? `<div class="coach">💡 <strong>Coach:</strong> ${coachHint(step)}</div>` : "";
  stepArea.innerHTML = `${coach}<p class="prompt">${step.prompt}</p>${inputHtml}`;

  if (step.type === "number") {
    const input = el("num-input");
    const submit = el("submit-num");
    const submitFn = () => {
      if (input.value === "") return;
      handleAnswer(step, Number(input.value));
    };
    submit.onclick = submitFn;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitFn();
    });
    input.focus();
  } else {
    stepArea.querySelectorAll(".answer-btn").forEach((btn) => {
      btn.onclick = () => {
        const raw = btn.dataset.value;
        const value = raw === "true" ? true : raw === "false" ? false : raw;
        handleAnswer(step, value);
      };
    });
  }
}

function isCorrect(step, given) {
  if (step.type === "number") return Math.abs(given - step.correct) <= (step.tolerance || 0);
  return given === step.correct;
}

function handleAnswer(step, given) {
  if (awaitingNext) return;

  // Learning Mode — no scoring, retry allowed, teaching-first feedback.
  if (gameMode === "learning") {
    const correctLearn = isCorrect(step, given);
    el("step-area")
      .querySelectorAll(".answer-btn")
      .forEach((b) => (b.disabled = true));
    const fb = el("feedback-area");
    const cite = stepCiteHtml(step);
    if (correctLearn) {
      awaitingNext = true;
      fb.innerHTML = `<div class="feedback correct">
        <p class="verdict">✓ Correct</p>
        <p class="explain">${step.explain}</p>
        ${cite ? `<p class="cite">Policy authority: ${cite}</p>` : ""}
        ${nextStepButtonHtml()}
      </div>`;
      wireNextStep();
    } else {
      fb.innerHTML = `<div class="feedback incorrect">
        <p class="verdict">✗ Not quite — take another look.</p>
        <p class="explain">💡 ${coachHint(step)}</p>
        <div class="answer-row">
          <button class="answer-btn" id="try-again">Try again</button>
          <button class="answer-btn choice-btn" id="show-answer">Show the answer</button>
        </div>
      </div>`;
      el("try-again").onclick = () => renderStep();
      el("show-answer").onclick = () => {
        awaitingNext = true;
        fb.innerHTML = `<div class="feedback incorrect">
          <p class="verdict">Answer: ${stepCorrectStr(step)}</p>
          <p class="explain">${step.explain}</p>
          ${cite ? `<p class="cite">Policy authority: ${cite}</p>` : ""}
          ${nextStepButtonHtml()}
        </div>`;
        wireNextStep();
      };
    }
    return;
  }

  awaitingNext = true;

  const elapsedMs = stepStartTime ? Date.now() - stepStartTime : 0;
  const correct = isCorrect(step, given);
  caseTotalCount++;
  caseAnswers[step.id] = { given, correct };

  // Accumulate the running shift for the leaderboard.
  state.session.total += 1;
  state.session.totalResponseMs += Math.min(elapsedMs, 120000); // cap a single answer at 2 min
  if (correct) state.session.correct += 1;

  if (correct) {
    caseCorrectCount++;
    streak++;
    const gain = 10 + Math.min(streak, 10) * 2;
    state.score += gain;
    (step.citationKeys || []).forEach((k) => {
      if (!state.citations.includes(k)) state.citations.push(k);
    });
  } else {
    streak = 0;
  }
  saveState();
  renderSidebar();

  const stepAreaEl = el("step-area");
  stepAreaEl.querySelectorAll(".answer-btn").forEach((b) => (b.disabled = true));

  const feedbackArea = el("feedback-area");
  const citeHtml = (step.citationKeys || [])
    .map((k) => CITATIONS[k])
    .filter(Boolean)
    .map((c) => `<a href="${c.url}" target="_blank" rel="noopener">${c.label}</a>`)
    .join(" · ");

  const correctStr = step.type === "number" ? "$" + Math.round(step.correct).toLocaleString() : step.type === "yesno" ? (step.correct ? "Yes" : "No") : String(step.correct);
  feedbackArea.innerHTML = `
    <div class="feedback ${correct ? "correct" : "incorrect"}">
      <p class="verdict">${correct ? "✓ Determination correct" : `✗ Validation error — expected: ${correctStr}`}</p>
      <p class="explain">${step.explain}</p>
      ${citeHtml ? `<p class="cite">Policy authority: ${citeHtml}</p>` : ""}
      <button class="answer-btn next-btn" id="next-step">${stepIndex + 1 >= currentCase.steps.length ? "Case summary" : "Next step"}</button>
    </div>`;

  el("next-step").onclick = () => {
    stepIndex++;
    renderStep();
  };
}

function renderCaseComplete() {
  el("progress-label").textContent = "Case complete";

  // Learning Mode: nothing is scored, posted, or unlocked — just move on.
  if (gameMode === "learning") {
    el("step-area").innerHTML = `
      <div class="case-complete">
        <p class="verdict">Case complete — nicely done.</p>
        <p class="learn-note">📘 Learning Mode: nothing is scored or posted. Try another module from Task Navigation, or start a new case.</p>
        <button class="answer-btn next-btn" id="next-case">Next case</button>
      </div>`;
    el("feedback-area").innerHTML = "";
    el("next-case").onclick = () => newCase();
    return;
  }

  const stats = levelStats(currentLevel);
  stats.completed++;
  stats.correct += caseCorrectCount;
  stats.total += caseTotalCount;
  state.session.casesProcessed += 1;
  const pe = accrueCasePaymentError();

  const levelMeta = LEVELS.find((l) => l.level === currentLevel);
  state.session.history.push({
    caseNumber: currentCase.caseNumber,
    caseLabel: currentCase.caseLabel,
    module: levelMeta ? levelMeta.title : `Module ${currentLevel}`,
    correct: caseCorrectCount,
    total: caseTotalCount,
    errorDollars: pe ? pe.counted : 0,
    rawError: pe ? pe.raw : 0,
    direction: pe ? pe.direction : "none",
    hadDollars: pe ? pe.hadDollars : false,
  });
  if (state.session.history.length > 100) state.session.history.shift();

  const justUnlocked = stats.completed >= CASES_TO_UNLOCK_NEXT && state.unlockedLevel === currentLevel && currentLevel < LEVELS.length;
  if (justUnlocked) state.unlockedLevel = currentLevel + 1;
  saveState();
  renderSidebar();
  renderLevelTabs();
  renderCaseHistory();

  el("step-area").innerHTML = `
    <div class="case-complete">
      <p class="verdict">Case closed: ${caseCorrectCount}/${caseTotalCount} correct.</p>
      ${paymentErrorLine(pe)}
      ${justUnlocked ? `<p class="unlock">🔓 Level ${currentLevel + 1} unlocked!</p>` : ""}
      <button class="answer-btn next-btn" id="next-case">Next case</button>
    </div>`;
  el("feedback-area").innerHTML = "";
  el("next-case").onclick = () => newCase();
}

// Render the dollar consequence of the case's determination, so the PER impact is visible
// the moment it happens.
function paymentErrorLine(pe) {
  if (!pe) return "";
  if (pe.counted > 0) {
    const verb = pe.direction === "over" ? "overissued" : pe.direction === "under" ? "underissued" : "mis-issued";
    return `<p class="pe-line pe-bad">💵 Payment error: <strong>${fmtMoney(pe.counted)}</strong> ${verb} — counts toward your Payment Error Rate.</p>`;
  }
  if (pe.raw > 0) {
    return `<p class="pe-line pe-minor">Minor <strong>${fmtMoney(pe.raw)}</strong> difference — under the ~$${QC_ERROR_EXCLUSION} QC small-error exclusion, so it does not count toward your PER.</p>`;
  }
  if (pe.hadDollars) {
    return `<p class="pe-line pe-good">💵 Correct issuance — <strong>$0</strong> payment error.</p>`;
  }
  return `<p class="pe-line pe-good">No benefit dollars issued — no payment error.</p>`;
}

// Compact per-row description of a case's payment error, for the history table.
function historyErrorCell(row) {
  if (row.errorDollars > 0) {
    const verb = row.direction === "over" ? "over" : row.direction === "under" ? "under" : "mis";
    return `<span class="he-bad">${fmtMoney(row.errorDollars)} <span class="he-dir">${verb}</span></span>`;
  }
  if (row.rawError > 0) return `<span class="he-minor">${fmtMoney(row.rawError)} excl.</span>`;
  if (row.hadDollars) return `<span class="he-good">$0</span>`;
  return `<span class="he-none">—</span>`;
}

function renderCaseHistory() {
  const box = el("case-history");
  if (!box) return;
  const hist = state.session.history || [];
  if (hist.length === 0) {
    box.innerHTML = '<p class="hist-empty">No cases completed this shift yet. Close a case and it will appear here with its payment-error detail.</p>';
    return;
  }
  const shown = hist.slice(-MAX_HISTORY_ROWS).reverse();
  const rows = shown
    .map(
      (r, i) => `<tr>
        <td>${hist.length - i}</td>
        <td>${r.caseNumber || "—"}</td>
        <td>${r.module}</td>
        <td>${r.correct}/${r.total}</td>
        <td class="hist-err">${historyErrorCell(r)}</td>
      </tr>`
    )
    .join("");
  const totalErr = hist.reduce((s, r) => s + (r.errorDollars || 0), 0);
  box.innerHTML = `
    <table class="au-grid hist-grid">
      <thead>
        <tr><th>#</th><th>Case No.</th><th>Module</th><th>Steps</th><th>Payment Error</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="hist-total">Shift total mis-issued (counts toward PER): <strong>${fmtMoney(totalErr)}</strong>${
      hist.length > MAX_HISTORY_ROWS ? ` · showing last ${MAX_HISTORY_ROWS} of ${hist.length} cases` : ""
    }</p>
  `;
}

// ---- Current shift + leaderboard ----

// Translate the worker's answers on the just-closed case into dollars mis-issued vs. dollars
// in play, and add them to the running shift's dollar-weighted Payment Error Rate.
function accrueCasePaymentError() {
  const iss = currentCase && currentCase.issuance;
  if (!iss) return null;
  let counted = 0; // dollar error after QC exclusion (counts toward PER)
  let raw = 0; // dollar error before exclusion
  let stake = 0; // benefit dollars in play
  let signedNet = 0; // + = overissued, - = underissued (benefit component)
  let sawFlagError = false;

  if (iss.benefit) {
    const correctIssued = iss.benefit.eligible ? iss.benefit.correctBenefit : 0;
    const eligAns = caseAnswers["eligible"];
    const benAns = caseAnswers["benefit"];
    const saidEligible = eligAns ? eligAns.given === true : true;
    let workerIssued;
    if (!saidEligible) workerIssued = 0;
    else workerIssued = benAns != null && isFinite(Number(benAns.given)) ? Number(benAns.given) : correctIssued;
    signedNet += workerIssued - correctIssued;
    const e = Math.abs(workerIssued - correctIssued);
    raw += e;
    counted += e <= QC_ERROR_EXCLUSION ? 0 : e; // QC small-error exclusion
    stake += Math.max(correctIssued, workerIssued);
  }

  for (const f of iss.flags || []) {
    const ans = caseAnswers[f.stepId];
    const wrong = ans && ans.correct === false;
    if (wrong) sawFlagError = true;
    const e = wrong ? f.stake : 0;
    raw += e;
    counted += e <= QC_ERROR_EXCLUSION ? 0 : e;
    stake += f.stake;
  }

  state.session.perErrorDollars += counted;
  state.session.perDenominatorDollars += stake;

  let direction = "none";
  if (sawFlagError && signedNet === 0) direction = "mis";
  else if (signedNet > 0) direction = "over";
  else if (signedNet < 0) direction = "under";
  else if (sawFlagError) direction = "mis";

  return { counted, raw, stake, direction, hadDollars: stake > 0 || raw > 0 };
}

function renderShiftBox() {
  const box = el("shift-box");
  if (!box) return;
  if (gameMode === "learning") {
    box.innerHTML = "";
    return;
  }
  const s = state.session;
  const shift = computeShift(s);
  const per = perStatus(shift.errorRatePct);
  const hasData = s.total > 0;
  const canSubmit = s.casesProcessed >= MIN_CASES_TO_SUBMIT;

  box.innerHTML = `
    <div class="wl-row"><span>Cases this shift</span><span class="wl-val">${s.casesProcessed}</span></div>
    <div class="wl-row"><span>Accuracy (steps)</span><span class="wl-val">${hasData ? shift.accuracyPct + "%" : "—"}</span></div>
    <div class="wl-row"><span>Avg time / answer</span><span class="wl-val">${hasData ? shift.avgSeconds + "s" : "—"}</span></div>
    <div class="wl-row"><span>Payment Error Rate ($)</span><span class="wl-val ${per.cls}">${s.perDenominatorDollars > 0 ? shift.errorRatePct + "%" : "—"}</span></div>
    <div class="wl-row shift-score"><span>Projected score</span><span class="wl-val">${shift.score}</span></div>
    ${
      s.perDenominatorDollars > 0 && shift.errorRatePct > ALASKA_EXEMPTION_PER
        ? `<div class="per-flag exempt-flag">❄️ PER over ${ALASKA_EXEMPTION_PER}% — Alaska Exemption challenge unlocks on submit!</div>`
        : hasData && shift.perPenaltyApplied
        ? `<div class="per-flag">⚠ PER above 6% — H.R.1 cost-share penalty applied (×${shift.perPenalty})</div>`
        : ""
    }
    <button class="answer-btn shift-submit" id="submit-shift" ${canSubmit ? "" : "disabled"}>Submit shift to leaderboard</button>
    <div class="shift-note">${
      canSubmit
        ? "Submitting posts your score and starts a fresh shift."
        : `Complete ${MIN_CASES_TO_SUBMIT - s.casesProcessed} more case${MIN_CASES_TO_SUBMIT - s.casesProcessed === 1 ? "" : "s"} to submit (min. ${MIN_CASES_TO_SUBMIT}) — a fuller sample keeps one case from swinging your PER.`
    }</div>
  `;
  const submit = el("submit-shift");
  if (submit) submit.onclick = submitShift;
}

function ensureLeaderboard() {
  if (!state.leaderboard) {
    state.leaderboard = benchmarkEntries();
    saveState();
  }
}

function playerHandle() {
  if (state.playerName) return state.playerName;
  let name = "";
  try {
    name = window.prompt("Enter your worker name or initials for the Performance Board:", "") || "";
  } catch (e) {
    name = "";
  }
  name = name.trim().slice(0, 24) || "You";
  state.playerName = name;
  saveState();
  return name;
}

function submitShift() {
  if (state.session.casesProcessed < MIN_CASES_TO_SUBMIT) return;
  const preview = computeShift(state.session);
  // A PER above the Alaska Exemption threshold unlocks the polar bear challenge.
  if (preview.errorRatePct > ALASKA_EXEMPTION_PER) {
    openBearScreen(preview.errorRatePct);
    return;
  }
  postShift(false);
}

// Post the current shift to the leaderboard. waivePenalty=true when the Alaska Exemption
// bear fight was won (PER cost-share penalty waived).
function postShift(waivePenalty) {
  ensureLeaderboard();
  const name = playerHandle();
  const shift = computeShift({ ...state.session, waivePerPenalty: waivePenalty });
  const entry = { name, benchmark: false, you: true, exemption: !!waivePenalty, ts: Date.now(), ...shift };

  // Clear the prior "current-you" marker; keep historical player rows.
  state.leaderboard.forEach((e) => (e.you = false));
  state.leaderboard.push(entry);
  state.leaderboard.sort((a, b) => b.score - a.score);
  state.leaderboard = state.leaderboard.slice(0, MAX_LEADERBOARD);

  state.session = emptySession();
  saveState();
  closeBearScreen();
  renderSidebar();
  renderCaseHistory();
  showBoard();
}

function openBearScreen(perPct) {
  el("bear-screen").hidden = false;
  startBearFight(el("bear-card"), {
    perPct,
    onWin: () => postShift(true),
    onLose: () => endShiftDefeated(),
    onDecline: () => {
      closeBearScreen();
      postShift(false);
    },
  });
}

function closeBearScreen() {
  const bs = el("bear-screen");
  if (bs) bs.hidden = true;
}

// Bear won: the shift ends with no posted score.
function endShiftDefeated() {
  state.session = emptySession();
  saveState();
  closeBearScreen();
  renderSidebar();
  renderCaseHistory();
  showPlay();
}

function showPlay() {
  mode = "play";
  el("play-view").hidden = false;
  el("board-view").hidden = true;
  renderLevelTabs();
  renderSidebar();
  renderCaseHistory();
}

function showBoard() {
  mode = "board";
  el("play-view").hidden = true;
  el("board-view").hidden = false;
  el("page-title").textContent = "Leaderboard — Eligibility Worker Productivity";
  ensureLeaderboard();
  renderLeaderboard();
  renderLevelTabs();
  setFooterLoadTime();
  window.scrollTo(0, 0);
}

function renderLeaderboard() {
  const board = el("board-view");
  const entries = (state.leaderboard || []).slice().sort((a, b) => b.score - a.score);
  const rows = entries
    .map((e, i) => {
      const rank = i + 1;
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
      const per = perStatus(e.errorRatePct);
      const cls = e.you ? "you-row" : e.benchmark ? "bench-row" : "";
      const exemptionBadge = e.exemption ? ' <span class="exempt-tag" title="Alaska Exemption claimed — PER penalty waived">❄️ exempt</span>' : "";
      return `<tr class="${cls}">
        <td class="rank">${medal}</td>
        <td>${e.name}${e.you ? ' <span class="you-tag">you</span>' : ""}${exemptionBadge}</td>
        <td>${e.casesProcessed}</td>
        <td>${e.accuracyPct}%</td>
        <td>${e.avgSeconds}s</td>
        <td class="${per.cls}">${e.errorRatePct}%</td>
        <td class="score-cell">${e.score.toLocaleString()}</td>
      </tr>`;
    })
    .join("");

  board.innerHTML = `
    <div class="title-row">
      <h1 class="page-title">Leaderboard</h1>
    </div>
    <section class="panel">
      <div class="panel-head">Eligibility Worker Productivity — Ranked by Composite Score</div>
      <div class="panel-body">
        <p class="board-intro">Composite score rewards <strong>accuracy</strong> most, then <strong>speed</strong>, then <strong>volume</strong>. Two <em>distinct</em> quality measures apply: <strong>Accuracy</strong> is the share of determination steps you answer correctly (a squared reward). <strong>Payment Error Rate (PER)</strong> is dollar-weighted — the share of benefit dollars mis-issued (over- + under-payments), dropping small errors, the way SNAP Quality Control measures it. When PER tops 6.00%, an H.R.1-style cost-share penalty cuts your score (ACL 25-50).</p>
        <table class="au-grid board-grid">
          <thead>
            <tr><th>Rank</th><th>Worker</th><th>Cases</th><th>Accuracy</th><th>Avg Time</th><th>PER</th><th>Score</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="board-actions">
          <button class="answer-btn" id="board-back">← Back to cases</button>
          <button class="answer-btn choice-btn" id="board-rename">Change worker name</button>
          <button class="answer-btn choice-btn" id="board-reset">Reset board</button>
        </div>
        <p class="board-disclaimer">These rankings are stored locally in this browser. Rows marked <em>(benchmark)</em> are target skill tiers, not other people. A shared cross-user board would require a hosted server — ask to set one up.</p>
      </div>
    </section>
  `;
  el("board-back").onclick = () => {
    showPlay();
    if (!currentCase) newCase();
    else setFooterLoadTime();
  };
  el("board-rename").onclick = () => {
    state.playerName = null;
    playerHandle();
    renderSidebar();
  };
  el("board-reset").onclick = () => {
    if (window.confirm("Reset the Performance Board to just the benchmark tiers? Your posted shifts will be cleared.")) {
      state.leaderboard = benchmarkEntries();
      saveState();
      renderLeaderboard();
    }
  };
}

function setFooterLoadTime() {
  const secs = (0.7 + Math.random() * 1.8).toFixed(2);
  el("page-footer").innerHTML = `This <span class="type-link">Type 1</span> page took ${secs} seconds to load.`;
}

function primaryName(household) {
  const applicant = household.members.find((m) => m.relationship === "applicant") || household.members[0];
  return applicant ? applicant.name : "Applicant";
}

// Populate the CalSAWS-style Benefit Processing Range dropdowns with a window of months
// centered on the current benefit month. Defaults Begin/End to the current month, matching
// the real Run EDBC screen's single-month default.
function populateBenefitMonths() {
  const begin = el("begin-month");
  const end = el("end-month");
  if (!begin || !end) return;
  const now = new Date();
  const opts = [];
  for (let offset = -6; offset <= 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const label = `${mm}/${d.getFullYear()}`;
    opts.push(label);
  }
  const current = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const optionHtml = opts.map((o) => `<option value="${o}"${o === current ? " selected" : ""}>${o}</option>`).join("");
  begin.innerHTML = optionHtml;
  end.innerHTML = optionHtml;
  begin.value = current;
  end.value = current;
}

function newCase() {
  currentCase = generateCase(currentLevel);
  stepIndex = 0;
  caseCorrectCount = 0;
  caseTotalCount = 0;
  caseAnswers = {};

  const levelMeta = LEVELS.find((l) => l.level === currentLevel);
  const first = primaryName(currentCase.household);
  const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
  currentCase.caseNumber = String(1000000 + Math.floor(Math.random() * 8999999));
  currentCase.caseLabel = `${surname}, ${first}`;
  el("case-name").textContent = currentCase.caseLabel;
  el("case-number").textContent = currentCase.caseNumber;
  el("page-title").textContent = `Run Eligibility Determination and Benefit Calculation (EDBC) — ${levelMeta.title}`;

  renderLevelTabs();
  renderSidebar();
  populateBenefitMonths();
  renderHousehold(currentCase.household);
  renderStep();
  renderCaseHistory();
  setFooterLoadTime();
}

const SURNAMES = ["Alvarez", "Nguyen", "Johnson", "Patel", "Kim", "Robinson", "Garcia", "Okafor", "Martinez", "Lee", "Hassan", "Brooks", "Torres", "Chen", "Ramirez"];

// ---- Learning Mode module primers (shown once per module, before the first case) ----

const LEVEL_PRIMERS = {
  1: {
    body: `<p>SNAP — called <strong>CalFresh</strong> in California — helps low-income households buy food. Eligibility comes down to <strong>income</strong> and <strong>resources</strong>.</p>
      <p>There are two income tests: a <strong>gross income test</strong> (before deductions, usually 130% of the federal poverty level) and a <strong>net income test</strong> (after deductions, 100% FPL), plus a <strong>resource/asset limit</strong>.</p>
      <p>The monthly benefit is the <strong>maximum allotment</strong> for the household size <em>minus 30% of net income</em> — reflecting the expectation that a household spends about a third of its own money on food. This module walks you through computing net income, applying the tests, and calculating the benefit.</p>`,
  },
  2: {
    body: `<p>Net income is what's left after SNAP's allowable <strong>deductions</strong>, applied in a fixed federal order:</p>
      <ul><li>20% <strong>earned-income</strong> deduction</li><li>a <strong>standard deduction</strong> by household size</li><li><strong>dependent-care</strong> costs</li><li>an <strong>excess medical</strong> deduction (elderly/disabled only)</li><li>an <strong>excess shelter</strong> deduction — rent/mortgage plus a utility allowance above half the household's income, capped for non-elderly/disabled households</li></ul>
      <p>Deductions matter because they can move a household under the net-income limit and <em>raise</em> the benefit. This module drills the shelter and utility rules.</p>`,
  },
  3: {
    body: `<p>Households with a member who is <strong>elderly (60+)</strong> or <strong>disabled</strong> get special treatment: they're <strong>exempt from the gross-income test</strong>, their excess shelter deduction is <strong>uncapped</strong>, they can deduct out-of-pocket <strong>medical expenses over $35/month</strong>, and they face a higher resource limit.</p>
      <p>Separately, <strong>Categorical Eligibility</strong> can waive tests entirely. <strong>Full CE</strong> (all members on CalWORKs/SSI) waives every financial test. <strong>Modified / Broad-Based CE</strong> raises the gross limit to 200% FPL and drops the asset test, but the net-income test still applies.</p>
      <p>This module is about spotting which pathway and which rules apply before you calculate.</p>`,
  },
  4: {
    body: `<p><strong>Able-Bodied Adults Without Dependents (ABAWDs)</strong> can receive SNAP for only <strong>3 months in any 36-month period</strong> unless they meet a work requirement (20 hrs/week) or qualify for an exemption.</p>
      <p><strong>H.R.1 (2025)</strong> made this stricter: it raised the age range to <strong>18–64</strong> and removed the exemption for people living with or parenting a child under 18.</p>
      <p>Watch the traps: someone disabled, under 18 / over 64, or caring for a child <strong>under 14</strong> <em>isn't an ABAWD at all</em> — but caring only for a 14–17-year-old no longer exempts (H.R.1 narrowed it from under-18). And being <strong>60–64 exempts you from work registration but NOT from the ABAWD time limit</strong>. This module is about deciding who is an ABAWD and who is subject to the clock.</p>`,
  },
  5: {
    body: `<p>Not every lawfully present immigrant qualifies for SNAP, and <strong>H.R.1 / OBBB (2025)</strong> narrowed eligibility sharply.</p>
      <p>Now only these are eligible: <strong>U.S. citizens and nationals</strong>, <strong>Lawful Permanent Residents</strong> (green-card holders — usually after a 5-year wait unless an exception applies), <strong>Cuban/Haitian entrants</strong>, and <strong>COFA</strong> citizens.</p>
      <p>Groups that used to qualify immediately — <strong>refugees, asylees, many parolees, SIV holders, and trafficking / domestic-violence survivors</strong> — are <em>no longer eligible</em> unless they've since become LPRs. This module tests who still qualifies and who faces the 5-year wait.</p>`,
  },
  6: {
    body: `<p>The capstone combines everything: read a mixed household, pick the right <strong>eligibility pathway</strong>, compute <strong>net income</strong> with the full deduction stack, decide <strong>eligibility</strong> and the <strong>benefit</strong>, and make the <strong>ABAWD</strong> and <strong>noncitizen</strong> calls for individual members.</p>
      <p>These are the cases that most resemble a real, messy caseload — where one wrong flag can change a household's entire benefit. Take your time and lean on the coach hints.</p>`,
  },
};

let primersSeen = new Set();

function closePrimer() {
  const s = el("primer-screen");
  if (s) s.hidden = true;
}

function showPrimer(level, opts = {}) {
  const p = LEVEL_PRIMERS[level];
  const meta = LEVELS.find((l) => l.level === level);
  const card = el("primer-card");
  const cont = opts.onContinue || closePrimer;
  if (!p || !card) {
    cont();
    return;
  }
  card.innerHTML = `
    <div class="wc-kicker">📘 Module ${level} Primer</div>
    <h1 class="wc-title">${meta.title}</h1>
    <div class="primer-body">${p.body}</div>
    <div class="wc-menu"><button class="wc-btn primary" id="primer-start">${opts.label || "Start cases →"}</button></div>`;
  el("primer-screen").hidden = false;
  card.querySelector("#primer-start").onclick = cont;
}

// Enter a module: in Learning Mode, show its primer once before the first case.
function beginModule(level) {
  currentLevel = level;
  showPlay();
  if (gameMode === "learning" && !primersSeen.has(level)) {
    primersSeen.add(level);
    showPrimer(level, {
      onContinue: () => {
        closePrimer();
        newCase();
      },
    });
  } else {
    newCase();
  }
}

// Re-open the current module's primer mid-session (from the Learning banner) — just closes.
function reopenPrimer() {
  showPrimer(currentLevel, { label: "← Back to the case", onContinue: closePrimer });
}

// ---- Welcome / tutorial screens ----

const TOUR_SEEN_KEY = "snapTrainerTourSeen";

function tourSeen() {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch (e) {
    return true; // if storage is unavailable, don't nag
  }
}

function markTourSeen() {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch (e) {
    /* ignore */
  }
  const nudge = el("tour-nudge");
  if (nudge) nudge.hidden = true;
}

function showWelcome() {
  el("tutorial-screen").hidden = true;
  el("welcome-screen").hidden = false;
  const nameInput = el("welcome-name");
  if (nameInput && state.playerName) nameInput.value = state.playerName;
  const startTitle = document.querySelector("#wc-start .mode-title");
  if (startTitle) startTitle.textContent = anyProgress() ? "🎯 Continue Graded Shift" : "🎯 Graded Shift";
  const nudge = el("tour-nudge");
  if (nudge) nudge.hidden = tourSeen(); // first-visit-only nudge
}

function showTutorial() {
  el("welcome-screen").hidden = true;
  el("tutorial-screen").hidden = false;
}

function anyProgress() {
  return state.session.casesProcessed > 0 || Object.values(state.levelStats).some((s) => s.completed > 0);
}

function captureWelcomeName() {
  const nameInput = el("welcome-name");
  const val = (nameInput && nameInput.value.trim().slice(0, 24)) || "";
  if (val) {
    state.playerName = val;
    saveState();
  }
}

function enterApp() {
  el("welcome-screen").hidden = true;
  el("tutorial-screen").hidden = true;
}

function startPlay(newMode) {
  captureWelcomeName();
  gameMode = newMode === "learning" ? "learning" : "graded";
  if (gameMode === "learning") primersSeen = new Set(); // re-show primers each learning session
  enterApp();
  mode = "play";
  currentCase = null; // fresh case so the mode's chrome + coaching apply cleanly
  beginModule(gameMode === "graded" ? Math.min(state.unlockedLevel, LEVELS.length) : 1);
}

// ---- Guided interface tour ----

const TOUR_STEPS = [
  { selector: ".case-bar", title: "Case header & quick tools", body: "The client's name and case number sit here, with quick links on the right — including <strong>Menu</strong>, <strong>Feedback</strong>, and Help." },
  { selector: ".global-tabs", title: "CalSAWS module tabs", body: "These mirror the real CalSAWS navigation. You work in <strong>Eligibility</strong>, where determinations happen — the others are here for realism." },
  { selector: ".task-nav", title: "Your training modules", body: "Pick a topic here. In <strong>Learning Mode</strong> every module is open; in <strong>Graded</strong> they unlock as you clear cases. The 📊 Leaderboard also lives here." },
  { selector: "#learning-banner", title: "Learning Mode banner", body: "When you're learning, this reminds you coaching is on and nothing is scored. The <strong>📖 Module Primer</strong> button re-opens the concept overview anytime." },
  { selector: "#household-card", title: "The Assistance Unit", body: "This is the household you're evaluating — members, ages, income, and non-financial flags (elderly, disabled, immigration status). Everything you need for the determination is here." },
  { selector: ".bpr-row", title: "Benefit Processing Range", body: "The benefit month you're determining, just like the real Run EDBC screen." },
  { selector: "#step-area", title: "Work the determination", body: "Answer each step here — net income, eligibility, benefit amount, and more. In Learning Mode a <strong>💡 Coach</strong> hint explains the method first, and you can retry." },
  { selector: "#citation-library", title: "Policy references", body: "Every correct answer cites the real policy it comes from (ACL, CFR, FNS COLA). They collect here so you can look them up." },
  { selector: "#calc-fab", title: "Calculator", body: "Need to run the math? Pop open the floating calculator anytime — type an expression or use the keypad." },
  { selector: "#feedback-link", title: "Leave feedback", body: "This is a beta. Spot a bug, a confusing screen, or a policy detail that looks off? Tell us here — it feeds directly into improvements." },
  { selector: "#menu-link", title: "That's the tour!", body: "Use <strong>Menu</strong> anytime to switch between Learning and Graded modes, view the leaderboard, or replay this tour. You're all set — good luck!" },
];

function launchTour() {
  captureWelcomeName();
  markTourSeen();
  // Put the app in a representative state so every highlighted element exists.
  gameMode = "learning";
  enterApp();
  mode = "play";
  currentLevel = 1;
  currentCase = null;
  showPlay();
  newCase(); // renders a Learning-Mode case (banner, coach, panels all present)
  setTimeout(() => startTour(TOUR_STEPS), 60); // let the case render, then start (setTimeout fires even if tab is backgrounded)
}

function init() {
  currentLevel = Math.min(state.unlockedLevel, LEVELS.length);
  ensureLeaderboard();

  const help = el("help-link");
  const banner = el("help-banner");
  if (help && banner) {
    help.onclick = () => (banner.hidden = !banner.hidden);
    const closeBtn = el("help-close");
    if (closeBtn) closeBtn.onclick = () => (banner.hidden = true);
  }

  el("wc-start").onclick = () => startPlay("graded");
  el("wc-learning").onclick = () => startPlay("learning");
  el("wc-tutorial").onclick = showTutorial;
  el("wc-tour").onclick = launchTour;
  const nudgeStart = el("nudge-start");
  if (nudgeStart) nudgeStart.onclick = launchTour;
  const nudgeDismiss = el("nudge-dismiss");
  if (nudgeDismiss) nudgeDismiss.onclick = markTourSeen;
  el("wc-leaderboard").onclick = () => {
    captureWelcomeName();
    gameMode = "graded";
    enterApp();
    showBoard();
  };
  el("tut-start").onclick = () => startPlay("graded");
  el("tut-back").onclick = showWelcome;
  const menu = el("menu-link");
  if (menu) menu.onclick = showWelcome;

  const primerReopen = el("primer-reopen");
  if (primerReopen) primerReopen.onclick = reopenPrimer;

  initCalculator();
  initReference();
  initAssessment();

  initFeedbackButton(() => {
    const meta = LEVELS.find((l) => l.level === currentLevel);
    return { mode: gameMode, module: meta ? meta.title : `Module ${currentLevel}` };
  });

  showWelcome();
}

init();
