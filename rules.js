// SNAP (federal) policy data, FY2026 (Oct 1 2025 - Sep 30 2026), 48 states + DC figures.
// Sourced live from CDSS/FNS COLA notices via a CalFresh policy knowledge base tool on 2026-07-16.
// California-specific administrative detail (forms, notices, CalSAWS) is deliberately omitted —
// this models the underlying federal SNAP rules that apply nationwide.

export const CITATIONS = {
  cola2026: {
    label: "FFY 2026 SNAP COLA (income standards, deductions, allotments)",
    url: "https://www.fns.usda.gov/snap/cost-living-adjustments",
  },
  maxAllotments: {
    label: "FNS FY2026 Maximum Allotments & Deductions",
    url: "https://www.fns.usda.gov/sites/default/files/resource-files/snap-fy26maximumAllotments-deductions.pdf",
  },
  incomeStandards: {
    label: "FNS FY2026 Income Eligibility Standards",
    url: "https://www.fns.usda.gov/sites/default/files/resource-files/snap-fy26-incomeEligibilityStandards.pdf",
  },
  deductionOrder: {
    label: "CA Food Stamp Manual §63-503.311/.312 (net income computation order)",
    url: "https://www.cdss.ca.gov/Portals/9/Regs/Man/Fsman/fsman06.docx",
  },
  ceDistinction: {
    label: "ACL 13-32 / 14-56 — Categorical Eligibility vs. Modified CE",
    url: "https://www.cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACLs/2023/23-80.pdf",
  },
  abawdHr1Age: {
    label: "ACL 25-93 — H.R.1 ABAWD age range change (18–64, eff. 2026-06-01)",
    url: "https://www.cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACLs/2025/25-93.pdf",
  },
  abawdFra2023: {
    label: "ACL 23-80 — Fiscal Responsibility Act ABAWD changes (2023)",
    url: "https://www.cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACLs/2023/23-80.pdf",
  },
  abawdHandbook: {
    label: "ACL 19-93 — ABAWD Time Limit Handbook",
    url: "https://www.cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACLs/2019/19-93_ES.pdf",
  },
  noncitizenHr1: {
    label: "ACL 25-92 — H.R.1 / OBBB noncitizen eligibility changes",
    url: "https://www.cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACLs/2025/25-92.pdf",
  },
  noncitizenHr1Summary: {
    label: "ACL 25-50 — CalFresh impacts of H.R.1 (overview)",
    url: "https://www.cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACLs/2025/25-50.pdf",
  },
};

function sizeIndexed(base, additional, maxSize = 8) {
  const table = { ...base };
  return {
    forSize(n) {
      if (n <= maxSize) return table[Math.max(1, n)];
      return table[maxSize] + (n - maxSize) * additional;
    },
  };
}

export const SNAP = {
  period: "FFY 2026 (Oct 1, 2025 – Sep 30, 2026)",

  maxAllotment: sizeIndexed(
    { 1: 298, 2: 546, 3: 785, 4: 994, 5: 1183, 6: 1421, 7: 1571, 8: 1789 },
    218
  ),

  // 130% FPL — standard gross income test
  grossLimit130: sizeIndexed(
    { 1: 1696, 2: 2292, 3: 2888, 4: 3483, 5: 4079, 6: 4675, 7: 5271, 8: 5867 },
    596
  ),

  // 165% FPL — households where elderly/disabled members are a separate household
  grossLimit165: sizeIndexed(
    { 1: 2152, 2: 2909, 3: 3665, 4: 4421, 5: 5177, 6: 5934, 7: 6690, 8: 7446 },
    757
  ),

  // 200% FPL — Modified/Broad-Based Categorical Eligibility gross test
  grossLimit200MCE: sizeIndexed(
    { 1: 2610, 2: 3526, 3: 4442, 4: 5360, 5: 6276, 6: 7192, 7: 8110, 8: 9026 },
    918
  ),

  // 100% FPL — net income test (applies to standard rules AND MCE households)
  netLimit100: sizeIndexed(
    { 1: 1305, 2: 1763, 3: 2221, 4: 2680, 5: 3138, 6: 3596, 7: 4055, 8: 4513 },
    459
  ),

  standardDeduction(size) {
    if (size <= 3) return 209;
    if (size === 4) return 223;
    if (size === 5) return 261;
    return 299;
  },

  earnedIncomeDeductionRate: 0.2,
  medicalExpenseThreshold: 35, // elderly/disabled only; actual expenses above this are deductible
  maxShelterDeductionNonElderly: 744, // uncapped if household has an elderly/disabled member
  homelessShelterDeduction: 198.99,
  SUA: 663,
  LUA: 170,
  TUA: 20,
  resourceLimitStandard: 3000,
  resourceLimitElderlyDisabled: 4500,
  minimumAllotment1to2: 24,
};

// ABAWD = Able-Bodied Adult Without Dependents.
// Age range has moved three times: 18-49 (pre-Sept 2023) -> 18-54 (FRA 2023) -> 18-64 (H.R.1, CA eff. 2026-06-01).
// This game always plays the CURRENT (post-H.R.1) rule set.
export const ABAWD = {
  ageMin: 18,
  ageMax: 64,
  timeLimitMonths: 3,
  periodMonths: 36,
  workRequirementHoursPerWeek: 20,
  workRequirementHoursPerMonth: 80,
  // H.R.1 changes (current as of 2026-07-16):
  changes: [
    "Age range expanded from 18-54 to 18-64.",
    "Individuals 60-64 are exempt from general work registration by age, but are still subject to the ABAWD time limit unless another exemption applies.",
    "The dependent-child exemption was NARROWED: living with a child under 18 no longer exempts by itself — only responsibility for a dependent child under age 14 exempts (ACL 25-93). Caring for a 14–17-year-old alone no longer exempts.",
    "The FRA-2023 exemptions for veterans, individuals experiencing homelessness, and former foster youth (under 25) were ELIMINATED (ACL 25-93). None of these exempt from the time limit on their own.",
    "A NEW exemption for Native American tribal members was added (eff. 2026-06-01).",
  ],
  // Exemptions still in effect after H.R.1 (non-exhaustive, used by the scenario generator):
  // Veteran / homeless / former-foster-youth are intentionally NOT here — repealed by H.R.1.
  exemptionReasons: [
    "pregnant",
    "medically certified unfit for work",
    "already meeting the 20hr/week work requirement",
    "native_american_tribal_member",
  ],
};

// Post-H.R.1 (OBBB) noncitizen SNAP eligibility, eff. 2025-07-04 / 2026-04-01.
// Eligibility is now much narrower than pre-2025 law.
export const NONCITIZEN = {
  eligibleImmediately: ["us_national", "cuban_haitian_entrant", "cofa_citizen"],
  eligibleAfterWait: ["lpr"], // 5-year wait unless an exception below applies
  lprWaitExceptions: [
    "under_18",
    "40_qualifying_work_quarters",
    "blind_or_disabled",
    "elderly_65_pre_1996",
    "military_connection",
    "amerasian",
    "american_indian_born_abroad",
    "hmong_highland_laotian_tribal_member",
  ],
  // No longer SNAP-eligible after H.R.1/OBBB, regardless of prior law:
  noLongerEligible: [
    "refugee",
    "asylee",
    "afghan_iraqi_siv", // unless separately an LPR
    "victim_of_trafficking", // unless separately an LPR
    "battered_alien", // unless separately an LPR
    "conditional_entrant", // unless separately an LPR
    "deportation_withheld",
    "parolee", // unless separately an LPR
  ],
};
