// Achievement/badge definitions. Pure data + predicates — no DOM. Each badge is earned once;
// game.js evaluates unearned badges against a context object at case-complete, shift-submit,
// and assessment events. `check(ctx)` returns true when the badge should unlock.
//
// ctx fields:
//   event        "case" | "shift" | "assessment"
//   cumCases     cumulative graded cases completed (always present)
//   modulesStrong count of modules at ≥90% accuracy over ≥5 answers (always present)
//   totalModules total number of modules
//   caseAllCorrect  (case) the just-closed case was 100% correct
//   moduleCleared   (case) a module has reached 3+ completed cases
//   shift        (shift) { accuracyPct, errorRatePct, avgSeconds, casesProcessed, score }
//   exemptionWon (shift) the Alaska Exemption bear fight was won
//   assessmentImproved (assessment) beat the baseline on a retake

export const ACHIEVEMENTS = [
  // Getting started / volume
  { id: "first_case", icon: "🎓", name: "First Case", desc: "Close your first determination.", check: (c) => c.cumCases >= 1 },
  { id: "first_shift", icon: "📁", name: "First Shift", desc: "Submit your first shift (10+ cases) to the board.", check: (c) => c.event === "shift" && c.shift.casesProcessed >= 1 },
  { id: "caseload_50", icon: "💼", name: "Caseload", desc: "Process 50 cases.", check: (c) => c.cumCases >= 50 },
  { id: "caseload_150", icon: "🏛️", name: "Seasoned Worker", desc: "Process 150 cases.", check: (c) => c.cumCases >= 150 },

  // Accuracy & quality
  { id: "sharp", icon: "🎯", name: "Sharp", desc: "Ace a case — 100% correct.", check: (c) => c.event === "case" && c.caseAllCorrect },
  { id: "clean_shift", icon: "✅", name: "Clean Shift", desc: "Submit a shift at 90%+ step accuracy.", check: (c) => c.event === "shift" && c.shift.accuracyPct >= 90 },
  { id: "flawless_shift", icon: "🌟", name: "Flawless", desc: "Submit a shift at 100% accuracy.", check: (c) => c.event === "shift" && c.shift.accuracyPct >= 100 },
  { id: "within_tolerance", icon: "🛡️", name: "Within Tolerance", desc: "Finish a shift with PER at or below the 6% federal threshold.", check: (c) => c.event === "shift" && c.shift.casesProcessed >= 10 && c.shift.errorRatePct <= 6 },
  { id: "precision", icon: "💎", name: "Precision", desc: "Finish a shift with a Payment Error Rate of 1% or less.", check: (c) => c.event === "shift" && c.shift.errorRatePct <= 1 && c.shift.casesProcessed >= 10 },
  { id: "quick_study", icon: "⚡", name: "Quick Study", desc: "Average under 10s/answer on a shift at 80%+ accuracy.", check: (c) => c.event === "shift" && c.shift.avgSeconds < 10 && c.shift.accuracyPct >= 80 },

  // Score tiers (formerly the benchmark rows)
  { id: "tier_journey", icon: "🥉", name: "Journey Worker", desc: "Score 1,000+ on a shift.", check: (c) => c.event === "shift" && c.shift.score >= 1000 },
  { id: "tier_senior", icon: "🥈", name: "Senior EW", desc: "Score 1,400+ on a shift.", check: (c) => c.event === "shift" && c.shift.score >= 1400 },
  { id: "tier_lead", icon: "🥇", name: "Lead / QC Reviewer", desc: "Score 1,800+ on a shift.", check: (c) => c.event === "shift" && c.shift.score >= 1800 },
  { id: "tier_top", icon: "👑", name: "State Top Performer", desc: "Score 2,200+ on a shift.", check: (c) => c.event === "shift" && c.shift.score >= 2200 },

  // Mastery
  { id: "module_cleared", icon: "📗", name: "Module Cleared", desc: "Complete 3 cases in a module.", check: (c) => c.event === "case" && c.moduleCleared },
  { id: "topic_mastery", icon: "🧠", name: "Topic Mastery", desc: "Reach 90%+ accuracy in a module (5+ answers).", check: (c) => c.modulesStrong >= 1 },
  { id: "full_mastery", icon: "🏆", name: "Full Mastery", desc: "Reach 90%+ accuracy in all six modules.", check: (c) => c.modulesStrong >= c.totalModules },

  // Special
  { id: "bear_wrestler", icon: "❄️", name: "Bear Wrestler", desc: "Win the Alaska Exemption polar bear fight.", check: (c) => c.event === "shift" && c.exemptionWon },
  { id: "improver", icon: "📈", name: "Improver", desc: "Beat your assessment baseline on a retake.", check: (c) => c.event === "assessment" && c.assessmentImproved },
];
