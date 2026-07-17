// Always-available reference cheat sheet. Content is generated from the same SNAP/ABAWD data
// the engine uses, so the numbers can never drift from what the game scores against.
import { SNAP, ABAWD } from "./rules.js";

function money(n) {
  return "$" + Math.round(n).toLocaleString();
}

function incomeTable() {
  let rows = "";
  for (let n = 1; n <= 8; n++) {
    rows += `<tr><td>${n}</td><td>${money(SNAP.grossLimit130.forSize(n))}</td><td>${money(
      SNAP.netLimit100.forSize(n)
    )}</td><td>${money(SNAP.grossLimit200MCE.forSize(n))}</td><td>${money(SNAP.maxAllotment.forSize(n))}</td></tr>`;
  }
  return `<table class="au-grid ref-table">
    <thead><tr><th>HH size</th><th>Gross 130%</th><th>Net 100%</th><th>MCE 200%</th><th>Max allotment</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="ref-note">+ each additional member: gross +${money(596)}, net +${money(459)}, MCE +${money(918)}, allotment +${money(218)}.</p>`;
}

function buildContent() {
  return `
    <div class="wc-kicker">📋 Quick Reference — ${SNAP.period}</div>
    <h1 class="wc-title">SNAP / CalFresh Cheat Sheet</h1>

    <h3 class="ref-h">Income limits &amp; max allotment</h3>
    ${incomeTable()}

    <h3 class="ref-h">Deductions</h3>
    <ul class="ref-list">
      <li><strong>Order:</strong> 20% earned-income deduction → standard deduction → dependent care → excess medical (elderly/disabled) → excess shelter.</li>
      <li><strong>Standard deduction:</strong> 1–3 ${money(209)} · 4 ${money(223)} · 5 ${money(261)} · 6+ ${money(299)}.</li>
      <li><strong>Utility allowances:</strong> SUA ${money(SNAP.SUA)} · LUA ${money(SNAP.LUA)} · TUA ${money(SNAP.TUA)}.</li>
      <li><strong>Excess shelter:</strong> (shelter + utility allowance) − 50% of remaining income; capped at ${money(
        SNAP.maxShelterDeductionNonElderly
      )} <em>unless</em> a member is elderly/disabled (then uncapped).</li>
      <li><strong>Homeless shelter deduction:</strong> ${money(SNAP.homelessShelterDeduction)}. <strong>Medical:</strong> out-of-pocket over ${money(
        SNAP.medicalExpenseThreshold
      )}/mo (elderly/disabled only).</li>
    </ul>

    <h3 class="ref-h">Eligibility</h3>
    <ul class="ref-list">
      <li><strong>Benefit</strong> = max allotment − 30% of net income. Minimum ${money(SNAP.minimumAllotment1to2)} for eligible 1–2 person households.</li>
      <li><strong>Resource limit:</strong> ${money(SNAP.resourceLimitStandard)} standard · ${money(
        SNAP.resourceLimitElderlyDisabled
      )} if elderly/disabled.</li>
      <li><strong>Elderly (60+)/disabled households:</strong> gross-income test waived; uncapped shelter; medical deduction; higher resource limit.</li>
      <li><strong>Categorical eligibility:</strong> Full CE (all members on CalWORKs/SSI) waives all tests. Modified/Broad-Based CE: ≤200% FPL gross, no asset test, net test still applies.</li>
    </ul>

    <h3 class="ref-h">ABAWD time limit (H.R.1)</h3>
    <ul class="ref-list">
      <li>Age <strong>${ABAWD.ageMin}–${ABAWD.ageMax}</strong>; limited to <strong>${ABAWD.timeLimitMonths} months in ${ABAWD.periodMonths}</strong> unless meeting the work requirement (<strong>${ABAWD.workRequirementHoursPerWeek} hrs/wk</strong>, ${ABAWD.workRequirementHoursPerMonth}/mo) or exempt.</li>
      <li><strong>Exemptions:</strong> pregnant; medically unfit; meeting the work requirement; Native American/Tribal member; responsible for a dependent child <strong>under 14</strong>.</li>
      <li><strong>Traps:</strong> veteran / homeless / former-foster-youth status <em>no longer</em> exempts (H.R.1 repeal). A child <strong>14–17</strong> does not exempt. Age 60–64 skips work <em>registration</em> but NOT the time limit.</li>
    </ul>

    <h3 class="ref-h">Noncitizen eligibility (H.R.1 / OBBB)</h3>
    <ul class="ref-list">
      <li><strong>Eligible:</strong> U.S. citizens &amp; nationals; Cuban/Haitian entrants; COFA citizens; LPRs (after a 5-year wait unless an exception applies).</li>
      <li><strong>No longer eligible:</strong> refugees, asylees, parolees, SIV holders, trafficking/battered/conditional entrants — unless they are separately an LPR.</li>
    </ul>

    <p class="ref-foot">Figures are FFY 2026 (48 states + DC). Training reference — verify against current policy for real cases.</p>
    <div class="wc-menu"><button class="wc-btn primary" id="ref-close">Close</button></div>
  `;
}

function open() {
  const screen = document.getElementById("reference-screen");
  const card = document.getElementById("reference-card");
  if (!screen || !card) return;
  card.innerHTML = buildContent();
  card.querySelector("#ref-close").onclick = () => (screen.hidden = true);
  screen.hidden = false;
  card.scrollTop = 0;
}

export function initReference() {
  const link = document.getElementById("reference-link");
  if (link) link.onclick = open;
}
