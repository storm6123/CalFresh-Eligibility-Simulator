import { SNAP, ABAWD, NONCITIZEN, CITATIONS } from "./rules.js";
import {
  computeNetIncome,
  eligibilityPathway,
  passesEligibility,
  snapBenefit,
  totalGrossIncome,
  hasElderlyOrDisabled,
  abawdStatus,
  noncitizenEligibility,
} from "./calc.js";

const FIRST_NAMES = ["Maria", "James", "Aisha", "Tran", "Carlos", "Devon", "Priya", "Marcus", "Elena", "Yusuf", "Nadia", "Omar", "Grace", "Miguel", "Sam", "Keisha", "Ling", "Rosa"];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function round10(n) {
  return Math.round(n / 10) * 10;
}
function names(n) {
  const pool = [...FIRST_NAMES];
  const picked = [];
  for (let i = 0; i < n; i++) {
    const idx = randInt(0, pool.length - 1);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}
function money(n) {
  return `$${Math.round(n).toLocaleString()}`;
}

export const LEVELS = [
  { level: 1, title: "SNAP Basics", blurb: "Gross/net income tests and the benefit formula." },
  { level: 2, title: "Deductions", blurb: "Shelter, utilities, and dependent care in the net income calculation." },
  { level: 3, title: "Elderly & Disabled Households", blurb: "Medical deductions, uncapped shelter, and categorical eligibility pathways." },
  { level: 4, title: "ABAWD Work Requirements", blurb: "Who's subject to the 3-month time limit after H.R.1 — and who's exempt." },
  { level: 5, title: "Noncitizen Eligibility", blurb: "Who still qualifies for SNAP after H.R.1 / OBBB narrowed eligibility." },
  { level: 6, title: "Capstone Cases", blurb: "Everything at once, in one household." },
];

function pickTargetGross(size, pathway = "standard") {
  const limit = pathway === "mce" ? SNAP.grossLimit200MCE.forSize(size) : SNAP.grossLimit130.forSize(size);
  // Keep MCE-designated households at/below the 200% ceiling so they actually resolve to MCE
  // (often above 130% FPL, where the MCE pathway changes the outcome). Standard cases range wider.
  const pct = pathway === "mce" ? choice([55, 70, 85, 95]) : choice([55, 70, 85, 100, 112, 125, 145]);
  return round10((limit * pct) / 100);
}

function buildHousehold({ size, elderlyDisabled = false, categoricalStatus = "standard", withDeductions = false }) {
  const adultCount = elderlyDisabled ? 1 : Math.min(2, size);
  const childCount = size - adultCount;
  const allNames = names(size);
  const [applicantName, secondName] = allNames;
  const grossTarget = pickTargetGross(size, categoricalStatus);
  const earnedShare = choice([1, 0.6, 0]); // all earned, mixed, or all unearned
  const totalEarned = round10(grossTarget * earnedShare);
  const totalUnearned = grossTarget - totalEarned;

  const members = [];
  members.push({
    id: 0,
    name: applicantName,
    age: elderlyDisabled ? randInt(60, 78) : randInt(24, 55),
    disabled: elderlyDisabled && choice([true, false]),
    relationship: "applicant",
    grossEarnedIncome: totalEarned,
    grossUnearnedIncome: totalUnearned,
    hasOwnMinorChildInHousehold: childCount > 0,
  });
  if (adultCount === 2) {
    members.push({
      id: 1,
      name: secondName,
      age: randInt(24, 55),
      disabled: false,
      relationship: "spouse",
      grossEarnedIncome: 0,
      grossUnearnedIncome: 0,
      hasOwnMinorChildInHousehold: childCount > 0,
    });
  }
  const childNames = allNames.slice(adultCount);
  for (let i = 0; i < childCount; i++) {
    members.push({
      id: members.length,
      name: childNames[i],
      age: randInt(2, 16),
      disabled: false,
      relationship: "child",
      grossEarnedIncome: 0,
      grossUnearnedIncome: 0,
      hasOwnMinorChildInHousehold: false,
    });
  }

  const household = {
    size,
    members,
    categoricalStatus,
    resources: elderlyDisabled ? choice([1500, 4000, 5200]) : choice([500, 2000, 3400]),
    shelterCost: 0,
    utilityResponsibility: "none",
    dependentCareCost: 0,
    medicalExpenses: 0,
    isHomelessHousehold: false,
  };

  if (withDeductions) {
    household.isHomelessHousehold = choice([true, false, false, false]);
    if (!household.isHomelessHousehold) {
      household.shelterCost = round10(randInt(400, 1600));
      household.utilityResponsibility = choice(["heating_cooling", "two_utilities", "phone_only", "none"]);
    }
    if (childCount > 0) household.dependentCareCost = choice([0, 0, 150, 300]);
  }
  if (elderlyDisabled) {
    household.medicalExpenses = choice([0, 60, 140, 260]);
  }

  return household;
}

function eligibilitySteps(household, opts = {}) {
  const { netIncome, breakdown } = computeNetIncome(household);
  const pathway = eligibilityPathway(household);
  const elig = passesEligibility(household, netIncome);
  const benefit = snapBenefit(household, netIncome, elig.eligible);
  const steps = [];

  if (opts.askPathway) {
    steps.push({
      id: "pathway",
      prompt: `${household.members[0].name}'s household — which eligibility pathway applies?`,
      type: "choice",
      choices: [
        { value: "full_ce", label: "Full Categorical Eligibility (all tests waived)" },
        { value: "mce", label: "Modified/Broad-Based CE (asset waived, 200% gross, net still applies)" },
        { value: "standard", label: "Standard rules (gross, net, and asset tests all apply)" },
      ],
      correct: pathway,
      explain:
        pathway === "full_ce"
          ? "Every household member receives CalWORKs/TANF or SSI, so ALL financial tests — gross, net, and resources — are waived entirely."
          : pathway === "mce"
          ? `The household is at or below 200% FPL ($${SNAP.grossLimit200MCE.forSize(household.size)}) and receives a TANF-funded benefit, so it qualifies for Modified/Broad-Based CE: the resource test is waived and the gross limit is raised to 200% FPL, but the net income test still applies.`
          : "No categorical eligibility applies — the household must pass the standard gross income, net income, AND resource tests.",
      citationKeys: ["ceDistinction"],
    });
  }

  steps.push({
    id: "netIncome",
    prompt: "What is the household's net monthly income (after all deductions)?",
    type: "number",
    tolerance: 2,
    correct: netIncome,
    explain: `Start from gross income: ${money(breakdown.earned)} earned + ${money(breakdown.unearned)} unearned = ${money(
      breakdown.earned + breakdown.unearned
    )}. Then subtract deductions: earned-income deduction -${money(breakdown.eid)} (20% of the earned portion only — unearned income counts in full) · standard deduction -${money(
      breakdown.standardDeduction
    )} · dependent care -${money(breakdown.dependentCare)} · medical -${money(breakdown.medicalDeduction)} · excess shelter -${money(
      breakdown.shelterDeduction
    )} → Net income = ${money(netIncome)}.`,
    citationKeys: ["deductionOrder", "cola2026"],
  });

  steps.push({
    id: "eligible",
    prompt: "Is this household eligible for SNAP?",
    type: "yesno",
    correct: elig.eligible,
    explain: `Gross test: ${elig.grossTest}${elig.grossPass === undefined ? "" : elig.grossPass ? " ✓ pass" : " ✗ fail"} · Net test: ${elig.netTest}${
      elig.netPass === undefined ? "" : elig.netPass ? " ✓ pass" : " ✗ fail"
    } · Asset test: ${elig.assetTest}${elig.assetPass === undefined ? "" : elig.assetPass ? " ✓ pass" : " ✗ fail"}.`,
    citationKeys: ["incomeStandards", "ceDistinction"],
  });

  steps.push({
    id: "benefit",
    prompt: "What is the household's monthly SNAP benefit?",
    type: "number",
    tolerance: 1,
    correct: benefit,
    explain: (function () {
      if (!elig.eligible) return "Not eligible, so the benefit is $0.";
      const maxAllot = SNAP.maxAllotment.forSize(household.size);
      const rawBenefit = Math.max(0, maxAllot - Math.floor(netIncome * 0.3));
      const raised = household.size <= 2 && benefit === SNAP.minimumAllotment1to2 && rawBenefit < SNAP.minimumAllotment1to2;
      return `Max allotment for household size ${household.size} is ${money(maxAllot)}. Benefit = max allotment − 30% of net income (floored) = ${money(
        maxAllot
      )} − ${money(Math.floor(netIncome * 0.3))} = ${money(rawBenefit)}${
        raised ? `, raised to the $${SNAP.minimumAllotment1to2} minimum allotment for eligible 1-2 person households.` : "."
      }`;
    })(),
    citationKeys: ["maxAllotments", "cola2026"],
  });

  return steps;
}

function level1() {
  const size = choice([1, 2, 3]);
  const household = buildHousehold({ size });
  return { household, steps: eligibilitySteps(household) };
}

function level2() {
  const size = choice([2, 3, 4]);
  // California is a Broad-Based CE state — most households get Modified CE. Represent it here
  // (with the pathway step shown so the concept is taught where it first appears).
  const categoricalStatus = choice(["standard", "standard", "mce"]);
  const household = buildHousehold({ size, withDeductions: true, categoricalStatus });
  return { household, steps: eligibilitySteps(household, { askPathway: categoricalStatus !== "standard" }) };
}

function level3() {
  const size = choice([1, 2, 3, 4]);
  const categoricalStatus = choice(["standard", "standard", "mce", "full_ce"]);
  const household = buildHousehold({ size, elderlyDisabled: true, withDeductions: true, categoricalStatus });
  return { household, steps: eligibilitySteps(household, { askPathway: true }) };
}

function abawdCandidate() {
  const age = choice([randInt(18, 59), randInt(60, 64), randInt(60, 64)]);
  const flags = {
    pregnant: false,
    medicallyUnfitForWork: false,
    isHomeless: false,
    isVeteran: false,
    isNativeAmericanTribalMember: false,
    workHoursPerWeek: 0,
  };
  const kind = choice(["none", "none", "working", "child_under_14", "child_teen", "tribal", "pregnant", "unfit", "veteran"]);
  if (kind === "working") flags.workHoursPerWeek = choice([22, 30, 40]);
  if (kind === "tribal") flags.isNativeAmericanTribalMember = true;
  if (kind === "pregnant") flags.pregnant = true;
  if (kind === "unfit") flags.medicallyUnfitForWork = true;
  if (kind === "veteran") flags.isVeteran = true; // trap: H.R.1 repealed the veteran exemption

  // H.R.1 narrowed the dependent-child exemption to a child under 14. A child 14-17 does NOT
  // exempt — that's the "child_teen" trap.
  const hasDependentChildUnder14 = kind === "child_under_14";
  const hasChild14to17 = kind === "child_teen";
  const disabled = choice([false, false, false, true]);
  const [name] = names(1);
  return { name, age, disabled, hasDependentChildUnder14, hasChild14to17, ...flags };
}

function level4() {
  const person = abawdCandidate();
  const status = abawdStatus(person);

  let reasonText;
  if (!status.isABAWD) {
    reasonText =
      status.reason === "outside_age_range"
        ? `${person.name} is age ${person.age}, outside the current 18-64 ABAWD age range (expanded from 18-54 by H.R.1).`
        : status.reason === "disabled"
        ? `${person.name} is disabled, so they don't meet the ABAWD definition at all.`
        : `${person.name} is responsible for a dependent child under age 14, so they don't meet the ABAWD definition (H.R.1 narrowed this exemption from under-18 to under-14 — ACL 25-93).`;
  } else if (status.subjectToTimeLimit) {
    const repealed = person.isVeteran ? "veteran status" : person.isHomeless ? "experiencing homelessness" : null;
    reasonText = `${person.name} (age ${person.age}) meets the ABAWD definition and has no qualifying exemption, so they ARE subject to the 3-months-in-36 time limit.${
      person.hasChild14to17
        ? " Note: living with a 14–17-year-old does NOT exempt them — H.R.1 narrowed the dependent-child exemption to children under age 14 (ACL 25-93)."
        : ""
    }${
      repealed ? ` Note: ${repealed} does NOT exempt them — H.R.1 repealed the FRA-2023 veteran, homeless, and former-foster-youth exemptions (ACL 25-93).` : ""
    }${
      person.age >= 60 ? " Being 60-64 exempts them from general work registration, but NOT from the ABAWD time limit itself — a real exemption is still required (H.R.1)." : ""
    }`;
  } else {
    reasonText = `${person.name} meets the ABAWD definition but qualifies for an exemption (${status.exemptions.join(", ")}), so they are NOT currently subject to the time limit.`;
  }

  const steps = [
    {
      id: "isAbawd",
      prompt: `Does ${person.name} (age ${person.age}) meet the definition of an ABAWD?`,
      type: "yesno",
      correct: status.isABAWD,
      explain: reasonText,
      citationKeys: ["abawdHr1Age", "abawdFra2023"],
    },
  ];
  if (status.isABAWD) {
    steps.push({
      id: "subjectToTimeLimit",
      prompt: `Is ${person.name} currently subject to the 3-month ABAWD time limit (i.e., not exempt)?`,
      type: "yesno",
      correct: status.subjectToTimeLimit,
      explain: reasonText,
      citationKeys: ["abawdHandbook", "abawdHr1Age"],
    });
  }

  const household = {
    size: 1,
    members: [{ ...person, grossEarnedIncome: (person.workHoursPerWeek || 0) * 4.33 * 16, grossUnearnedIncome: 0 }],
    categoricalStatus: "standard",
    resources: 1000,
    shelterCost: 0,
    utilityResponsibility: "none",
    dependentCareCost: 0,
    medicalExpenses: 0,
    isHomelessHousehold: person.isHomeless,
  };

  return { household, steps, focusMember: person };
}

const CITIZENSHIP_LABELS = {
  citizen: "U.S. citizen",
  lpr: "Lawful Permanent Resident (green card holder)",
  cuban_haitian_entrant: "Cuban/Haitian entrant",
  cofa_citizen: "Compacts of Free Association (COFA) citizen",
  refugee: "Refugee",
  asylee: "Person granted asylum",
  afghan_iraqi_siv: "Afghan/Iraqi Special Immigrant Visa holder",
  victim_of_trafficking: "Victim of severe trafficking",
  battered_alien: "Battered alien",
  conditional_entrant: "Conditional entrant",
  parolee: "Individual granted parole",
};

function noncitizenCandidate() {
  const [name] = names(1);
  const status = choice([
    "citizen",
    "lpr",
    "lpr",
    "lpr",
    "cuban_haitian_entrant",
    "cofa_citizen",
    "refugee",
    "asylee",
    "afghan_iraqi_siv",
    "victim_of_trafficking",
    "parolee",
  ]);
  const person = { name, citizenshipStatus: status, lprYearsInStatus: 0, lprException: null };
  if (status === "lpr") {
    const scenario = choice(["under5_no_exception", "over5", "under18_exception", "disabled_exception", "workquarters_exception"]);
    if (scenario === "over5") person.lprYearsInStatus = randInt(5, 20);
    else if (scenario === "under18_exception") {
      person.lprYearsInStatus = randInt(0, 3);
      person.lprException = "under_18";
    } else if (scenario === "disabled_exception") {
      person.lprYearsInStatus = randInt(0, 4);
      person.lprException = "blind_or_disabled";
    } else if (scenario === "workquarters_exception") {
      person.lprYearsInStatus = randInt(0, 4);
      person.lprException = "40_qualifying_work_quarters";
    } else {
      person.lprYearsInStatus = randInt(0, 4);
    }
  }
  return person;
}

function level5() {
  const person = noncitizenCandidate();
  const result = noncitizenEligibility(person);
  const label = CITIZENSHIP_LABELS[person.citizenshipStatus] || person.citizenshipStatus;

  let explain;
  if (person.citizenshipStatus === "citizen") {
    explain = `${person.name} is a U.S. citizen — fully eligible, no immigration-status test applies.`;
  } else if (NONCITIZEN.eligibleImmediately.includes(person.citizenshipStatus)) {
    explain = `${person.name}'s status is "${label}" — one of the categories still eligible immediately with no waiting period after H.R.1/OBBB.`;
  } else if (person.citizenshipStatus === "lpr") {
    explain = result.eligible
      ? person.lprException
        ? `${person.name} is an LPR, but qualifies for the "${person.lprException.replace(/_/g, " ")}" exception, so the 5-year wait doesn't apply.`
        : `${person.name} has been an LPR for ${person.lprYearsInStatus} years, clearing the 5-year wait.`
      : `${person.name} has only been an LPR for ${person.lprYearsInStatus} year(s) and doesn't meet any exception, so they're still within the 5-year waiting period (${result.yearsRemaining} year(s) remaining).`;
  } else {
    explain = `${person.name}'s status is "${label}". This category was made INELIGIBLE for SNAP by H.R.1/OBBB (eff. 2025-07-04) unless the person is separately an LPR who has cleared the waiting period — a major change from pre-2025 law, when this group was eligible immediately.`;
  }

  const steps = [
    {
      id: "eligible",
      prompt: `Is ${person.name} (${label}) currently SNAP-eligible?`,
      type: "yesno",
      correct: result.eligible,
      explain,
      citationKeys: ["noncitizenHr1", "noncitizenHr1Summary"],
    },
  ];
  if (person.citizenshipStatus === "lpr" && !person.lprException) {
    steps.push({
      id: "waitingPeriod",
      prompt: `Is ${person.name} subject to a 5-year waiting period?`,
      type: "yesno",
      correct: !result.eligible,
      explain,
      citationKeys: ["noncitizenHr1"],
    });
  }

  const household = {
    size: 1,
    members: [{ ...person, age: 30, disabled: false, grossEarnedIncome: 1200, grossUnearnedIncome: 0, hasOwnMinorChildInHousehold: false }],
    categoricalStatus: "standard",
    resources: 800,
    shelterCost: 0,
    utilityResponsibility: "none",
    dependentCareCost: 0,
    medicalExpenses: 0,
    isHomelessHousehold: false,
  };

  return { household, steps, focusMember: person };
}

function level6() {
  const size = randInt(3, 5);
  const household = buildHousehold({ size, elderlyDisabled: true, withDeductions: true, categoricalStatus: choice(["standard", "mce"]) });

  const abawdMember = abawdCandidate();
  const noncitizenMember = noncitizenCandidate();
  household.members.push({ ...abawdMember, grossEarnedIncome: (abawdMember.workHoursPerWeek || 0) * 4.33 * 15, grossUnearnedIncome: 0 });
  household.members.push({ ...noncitizenMember, age: 29, disabled: false, grossEarnedIncome: 0, grossUnearnedIncome: 400, hasOwnMinorChildInHousehold: false });
  household.size = household.members.length;

  const steps = eligibilitySteps(household, { askPathway: true });

  const abStatus = abawdStatus(abawdMember);
  steps.push({
    id: "abawd",
    prompt: `Is ${abawdMember.name} (age ${abawdMember.age}) subject to the ABAWD time limit?`,
    type: "yesno",
    correct: abStatus.isABAWD && abStatus.subjectToTimeLimit,
    explain: !abStatus.isABAWD
      ? `${abawdMember.name} doesn't meet the ABAWD definition (${abStatus.reason.replace(/_/g, " ")}).`
      : abStatus.subjectToTimeLimit
      ? `${abawdMember.name} meets the ABAWD definition with no qualifying exemption — subject to the time limit.`
      : `${abawdMember.name} meets the ABAWD definition but is exempt (${abStatus.exemptions.join(", ")}).`,
    citationKeys: ["abawdHr1Age"],
  });

  const ncResult = noncitizenEligibility(noncitizenMember);
  const label = CITIZENSHIP_LABELS[noncitizenMember.citizenshipStatus] || noncitizenMember.citizenshipStatus;
  steps.push({
    id: "noncitizen",
    prompt: `Is ${noncitizenMember.name} (${label}) individually SNAP-eligible?`,
    type: "yesno",
    correct: ncResult.eligible,
    explain: `${noncitizenMember.name}'s status is "${label}". ${
      ncResult.eligible ? "This category remains eligible under current post-H.R.1 rules." : "This category is not currently SNAP-eligible under post-H.R.1/OBBB rules."
    }`,
    citationKeys: ["noncitizenHr1"],
  });

  return { household, steps };
}

const BUILDERS = { 1: level1, 2: level2, 3: level3, 4: level4, 5: level5, 6: level6 };

// Monthly benefit dollars at stake for a pass/fail (non-benefit-calc) determination,
// e.g. an ABAWD time-limit or noncitizen-eligibility call. Getting it wrong mis-issues
// roughly one person's benefit, so we use the 1-person max allotment as the proxy.
const FLAG_BENEFIT_AT_STAKE = SNAP.maxAllotment.forSize(1);

// Describe, per case, how the worker's answers translate into benefit dollars issued —
// so the game can compute a DOLLAR-WEIGHTED Payment Error Rate (QC-style), distinct from
// answer accuracy.
function buildIssuance(level, { household, steps }) {
  const stepIds = new Set(steps.map((s) => s.id));
  const issuance = { benefit: null, flags: [] };

  // Benefit-calc cases (SNAP Basics, Deductions, Elderly/Disabled, Capstone).
  if (stepIds.has("benefit")) {
    const { netIncome } = computeNetIncome(household);
    const elig = passesEligibility(household, netIncome);
    const correctBenefit = snapBenefit(household, netIncome, elig.eligible);
    issuance.benefit = { correctBenefit, eligible: elig.eligible };
  }

  // Pass/fail determinations that flip a household's benefit.
  if (level === 4) {
    issuance.flags.push({ stepId: stepIds.has("subjectToTimeLimit") ? "subjectToTimeLimit" : "isAbawd", stake: FLAG_BENEFIT_AT_STAKE });
  } else if (level === 5) {
    issuance.flags.push({ stepId: "eligible", stake: FLAG_BENEFIT_AT_STAKE });
  } else if (level === 6) {
    if (stepIds.has("abawd")) issuance.flags.push({ stepId: "abawd", stake: FLAG_BENEFIT_AT_STAKE });
    if (stepIds.has("noncitizen")) issuance.flags.push({ stepId: "noncitizen", stake: FLAG_BENEFIT_AT_STAKE });
  }

  return issuance;
}

export function generateCase(level) {
  const builder = BUILDERS[level] || level1;
  const built = builder();
  return { level, issuance: buildIssuance(level, built), ...built };
}
