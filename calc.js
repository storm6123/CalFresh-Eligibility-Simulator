import { SNAP, ABAWD, NONCITIZEN } from "./rules.js";

export function hasElderlyOrDisabled(household) {
  return household.members.some((m) => m.age >= 60 || m.disabled);
}

export function grossEarnedIncome(household) {
  return household.members.reduce((s, m) => s + (m.grossEarnedIncome || 0), 0);
}

export function grossUnearnedIncome(household) {
  return household.members.reduce((s, m) => s + (m.grossUnearnedIncome || 0), 0);
}

export function totalGrossIncome(household) {
  return grossEarnedIncome(household) + grossUnearnedIncome(household);
}

function utilityAllowance(household) {
  switch (household.utilityResponsibility) {
    case "heating_cooling":
      return SNAP.SUA;
    case "two_utilities":
      return SNAP.LUA;
    case "phone_only":
      return SNAP.TUA;
    default:
      return 0;
  }
}

// Net income computation follows the mandatory federal deduction order:
// earned income deduction -> standard deduction -> dependent care -> medical (elderly/disabled) -> shelter.
export function computeNetIncome(household) {
  const earned = grossEarnedIncome(household);
  const unearned = grossUnearnedIncome(household);
  const eid = earned * SNAP.earnedIncomeDeductionRate;
  let income = earned - eid + unearned;

  const standardDeduction = SNAP.standardDeduction(household.size);
  income -= standardDeduction;

  const dependentCare = household.dependentCareCost || 0;
  income -= dependentCare;

  const elderlyOrDisabled = hasElderlyOrDisabled(household);
  let medicalDeduction = 0;
  if (elderlyOrDisabled && (household.medicalExpenses || 0) > SNAP.medicalExpenseThreshold) {
    medicalDeduction = household.medicalExpenses - SNAP.medicalExpenseThreshold;
    income -= medicalDeduction;
  }

  let shelterDeduction = 0;
  if (household.isHomelessHousehold) {
    shelterDeduction = SNAP.homelessShelterDeduction;
    income -= shelterDeduction;
  } else {
    const totalShelterCost = (household.shelterCost || 0) + utilityAllowance(household);
    const halfRemainingIncome = income * 0.5;
    let excessShelter = Math.max(0, totalShelterCost - halfRemainingIncome);
    if (!elderlyOrDisabled) excessShelter = Math.min(excessShelter, SNAP.maxShelterDeductionNonElderly);
    shelterDeduction = excessShelter;
    income -= excessShelter;
  }

  income = Math.max(0, income);
  return {
    netIncome: Math.round(income),
    breakdown: { earned, unearned, eid: Math.round(eid), standardDeduction, dependentCare, medicalDeduction: Math.round(medicalDeduction), shelterDeduction: Math.round(shelterDeduction) },
  };
}

// Categorical eligibility pathway: 'full_ce' (all tests waived) | 'mce' (asset waived, 200% gross, net still applies) | 'standard'.
export function eligibilityPathway(household) {
  if (household.categoricalStatus === "full_ce") return "full_ce";
  if (household.categoricalStatus === "mce") {
    const gross = totalGrossIncome(household);
    if (gross <= SNAP.grossLimit200MCE.forSize(household.size)) return "mce";
  }
  return "standard";
}

export function passesEligibility(household, netIncome) {
  const pathway = eligibilityPathway(household);
  if (pathway === "full_ce") {
    return { pathway, eligible: true, grossTest: "waived", netTest: "waived", assetTest: "waived" };
  }

  const elderlyOrDisabled = hasElderlyOrDisabled(household);
  const gross = totalGrossIncome(household);
  const netLimit = SNAP.netLimit100.forSize(household.size);
  const netPass = netIncome <= netLimit;

  let grossPass = true;
  let grossTest = "waived (elderly/disabled household)";
  if (pathway === "mce") {
    grossTest = `<= 200% FPL ($${SNAP.grossLimit200MCE.forSize(household.size)})`;
    grossPass = gross <= SNAP.grossLimit200MCE.forSize(household.size);
  } else if (!elderlyOrDisabled) {
    grossTest = `<= 130% FPL ($${SNAP.grossLimit130.forSize(household.size)})`;
    grossPass = gross <= SNAP.grossLimit130.forSize(household.size);
  }

  const assetTest = pathway === "mce" ? "waived" : elderlyOrDisabled ? `<= $${SNAP.resourceLimitElderlyDisabled}` : `<= $${SNAP.resourceLimitStandard}`;
  const assetLimit = elderlyOrDisabled ? SNAP.resourceLimitElderlyDisabled : SNAP.resourceLimitStandard;
  const assetPass = pathway === "mce" ? true : (household.resources || 0) <= assetLimit;

  return {
    pathway,
    eligible: grossPass && netPass && assetPass,
    grossTest,
    grossPass,
    netTest: `<= 100% FPL ($${netLimit})`,
    netPass,
    assetTest,
    assetPass,
  };
}

export function snapBenefit(household, netIncome, eligible) {
  if (!eligible) return 0;
  const maxAllot = SNAP.maxAllotment.forSize(household.size);
  const contribution = Math.floor(netIncome * 0.3);
  let benefit = Math.max(0, maxAllot - contribution);
  if (household.size <= 2 && benefit > 0) benefit = Math.max(benefit, SNAP.minimumAllotment1to2);
  return Math.round(benefit);
}

// A member is excluded from the ABAWD definition entirely if outside the age range, disabled,
// or has their own minor child in the SNAP household — these are NOT "exemptions", they mean
// the person was never an ABAWD in the first place.
export function abawdStatus(person) {
  const inAgeRange = person.age >= ABAWD.ageMin && person.age <= ABAWD.ageMax;
  if (!inAgeRange) return { isABAWD: false, reason: "outside_age_range" };
  if (person.disabled) return { isABAWD: false, reason: "disabled" };
  if (person.hasOwnMinorChildInHousehold) return { isABAWD: false, reason: "has_dependent_child" };

  const exemptions = [];
  const ageBasedWorkRegExempt = person.age >= 60;
  if (person.pregnant) exemptions.push("pregnant");
  if (person.medicallyUnfitForWork) exemptions.push("medically_unfit");
  if ((person.workHoursPerWeek || 0) >= ABAWD.workRequirementHoursPerWeek) exemptions.push("meeting_work_requirement");
  if (person.isHomeless) exemptions.push("homeless");
  if (person.isVeteran) exemptions.push("veteran");
  if (person.isNativeAmericanTribalMember) exemptions.push("native_american_tribal_member");

  const subjectToTimeLimit = exemptions.length === 0;
  return {
    isABAWD: true,
    subjectToTimeLimit,
    exemptions,
    note:
      ageBasedWorkRegExempt && subjectToTimeLimit
        ? "Age 60-64 is exempt from general work registration, but H.R.1 means age alone no longer exempts from the ABAWD time limit — a real ABAWD exemption is still required."
        : null,
  };
}

export function noncitizenEligibility(person) {
  const s = person.citizenshipStatus;
  if (s === "citizen") return { eligible: true, waitingPeriod: false };
  if (NONCITIZEN.eligibleImmediately.includes(s)) return { eligible: true, waitingPeriod: false };
  if (s === "lpr") {
    if (person.lprException) return { eligible: true, waitingPeriod: false, viaException: person.lprException };
    if ((person.lprYearsInStatus || 0) >= 5) return { eligible: true, waitingPeriod: false };
    return { eligible: false, waitingPeriod: true, yearsRemaining: 5 - (person.lprYearsInStatus || 0) };
  }
  if (NONCITIZEN.noLongerEligible.includes(s)) return { eligible: false, reason: "no_longer_eligible_post_hr1" };
  return { eligible: false, reason: "unknown_status" };
}
