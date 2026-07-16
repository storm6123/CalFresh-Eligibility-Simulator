// Shift-scoring model for the leaderboard.
//
// TWO DISTINCT quality measures (this is the key point):
//   • ACCURACY — the share of determination STEPS answered correctly (answer-weighted).
//     Enters the score as a squared reward multiplier: 90% → ×0.81, 80% → ×0.64.
//   • PAYMENT ERROR RATE (PER) — DOLLAR-weighted, computed the way SNAP Quality Control
//     does it: total benefit dollars mis-issued (over- + under-payments) ÷ total benefit
//     dollars in play, with small errors under the QC exclusion threshold dropped. A $2
//     miscalculation barely moves PER; wrongly denying a $400/mo household spikes it.
//     When PER tops 6.00%, an H.R.1-style cost-share penalty cuts the score (ACL 25-50).
//
// Because PER is dollar-weighted and accuracy is answer-weighted, they are genuinely
// different numbers — a worker can have high step-accuracy but a bad PER if their few
// misses were big-dollar benefit errors, and vice-versa.
//
//   score = volumeBase × accuracyMultiplier × speedMultiplier × perPenalty
//   (accuracy → accuracyMultiplier; PER → perPenalty; both reward correctness, differently)

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export const SCORING = {
  pointsPerCase: 120,
  perPenaltyThresholdPct: 6.0, // H.R.1 PER cost-share trigger
  speedTargetSeconds: 12, // ~this pace ≈ neutral (1.0x) speed multiplier
};

// The (real, darkly funny) "Alaska Exemption": under H.R.1, states with the HIGHEST payment
// error rates get their cost-share liability delayed — so a very high PER dodges the penalty.
// A PER above this threshold unlocks the exemption challenge (…and a polar bear).
export const ALASKA_EXEMPTION_PER = 13.34;

// SNAP QC excludes payment errors at or below a small-dollar threshold (inflation-adjusted
// each fiscal year; ~$57 in recent years). Illustrative here, not an official figure.
export const QC_ERROR_EXCLUSION = 57;

export function computeShift({
  casesProcessed = 0,
  correct = 0,
  total = 0,
  totalResponseMs = 0,
  perErrorDollars = 0,
  perDenominatorDollars = 0,
  errorRatePct = null, // optional explicit override (used for seeded benchmarks)
  waivePerPenalty = false, // true when the Alaska Exemption bear fight was won
}) {
  const accuracyPct = total > 0 ? (correct / total) * 100 : 0;
  // PER is dollar-weighted and INDEPENDENT of accuracy.
  const per =
    errorRatePct != null ? errorRatePct : perDenominatorDollars > 0 ? (perErrorDollars / perDenominatorDollars) * 100 : 0;
  const avgSeconds = total > 0 ? totalResponseMs / total / 1000 : 0;

  // Accuracy multiplier — quadratic so mistakes hurt disproportionately.
  // 100% → 1.00, 90% → 0.81, 80% → 0.64, 70% → 0.49.
  const accuracyMultiplier = total > 0 ? Math.pow(accuracyPct / 100, 2) : 0;

  // Speed multiplier — faster than target rewards up to 1.4x, slower falls to 0.6x.
  const speedMultiplier = total > 0 ? clamp(1.4 - avgSeconds / (SCORING.speedTargetSeconds * 2), 0.6, 1.4) : 1;

  // H.R.1 PER penalty band — above 6% error, apply an escalating cost-share hit,
  // UNLESS the Alaska Exemption was claimed (bear defeated), which waives it entirely.
  const perPenalty = waivePerPenalty
    ? 1
    : per > SCORING.perPenaltyThresholdPct
    ? clamp(1 - (per - SCORING.perPenaltyThresholdPct) * 0.03, 0.4, 1)
    : 1;

  const volumeBase = casesProcessed * SCORING.pointsPerCase;
  const score = Math.round(volumeBase * accuracyMultiplier * speedMultiplier * perPenalty);

  return {
    score,
    accuracyPct: Math.round(accuracyPct * 10) / 10,
    errorRatePct: Math.round(per * 10) / 10,
    avgSeconds: Math.round(avgSeconds * 10) / 10,
    casesProcessed,
    correct,
    total,
    accuracyMultiplier: Math.round(accuracyMultiplier * 100) / 100,
    speedMultiplier: Math.round(speedMultiplier * 100) / 100,
    perPenaltyApplied: perPenalty < 1,
    perPenalty: Math.round(perPenalty * 100) / 100,
  };
}

// PER status label mirroring the H.R.1 framing.
export function perStatus(errorRatePct) {
  if (errorRatePct <= SCORING.perPenaltyThresholdPct) return { label: "Within federal tolerance", cls: "per-good" };
  if (errorRatePct <= 10) return { label: "Above 6% — cost-share penalty", cls: "per-warn" };
  return { label: "High error rate — major penalty", cls: "per-bad" };
}

// Seeded benchmark rows — clearly-labeled TARGET tiers to measure against, not real users.
// (A real cross-machine leaderboard would require a shared backend.) Scores are computed
// through the same computeShift() formula so they stay consistent with real play.
// perPct here is the dollar-weighted Payment Error Rate — deliberately NOT just
// (100 − accuracy), since QC PER weights by benefit dollars and drops small errors.
const BENCHMARK_SEEDS = [
  { name: "Trainee (benchmark)", casesProcessed: 6, correct: 15, total: 24, avgSeconds: 22, perPct: 21 },
  { name: "New EW (benchmark)", casesProcessed: 8, correct: 26, total: 32, avgSeconds: 16, perPct: 12 },
  { name: "Journey Worker (benchmark)", casesProcessed: 10, correct: 37, total: 42, avgSeconds: 12, perPct: 7.5 },
  { name: "Senior EW (benchmark)", casesProcessed: 12, correct: 51, total: 55, avgSeconds: 10, perPct: 4.5 },
  { name: "Lead / QC Reviewer (benchmark)", casesProcessed: 14, correct: 66, total: 68, avgSeconds: 9, perPct: 1.8 },
  { name: "State Top Performer (benchmark)", casesProcessed: 16, correct: 79, total: 80, avgSeconds: 8, perPct: 0.6 },
];

export function benchmarkEntries() {
  return BENCHMARK_SEEDS.map((s) => {
    const shift = computeShift({
      casesProcessed: s.casesProcessed,
      correct: s.correct,
      total: s.total,
      totalResponseMs: s.avgSeconds * s.total * 1000,
      errorRatePct: s.perPct,
    });
    return { name: s.name, benchmark: true, ts: 0, ...shift };
  });
}
