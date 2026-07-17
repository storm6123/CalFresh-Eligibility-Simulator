# Policy Accuracy Audit — CalFresh Eligibility Simulator

Full audit of every policy figure and rule the game asserts, verified against the CalFresh
policy knowledge base (authoritative ACLs / ACINs / CFR / FNS COLA tables). Date: 2026-07-17.
Policy basis: **FFY 2026 + H.R.1 (OBBB)**.

## Method
Extracted every constant (rules.js), every calculation (calc.js), and every scenario
explanation/citation (scenarios.js, game.js), then confirmed each against the policy KB. Fixes
were verified in-browser via direct module tests.

## Verified correct (no change needed)

| Area | Checked | Result |
|------|---------|--------|
| Max allotments (48 states/DC, FFY26) | 1→$298 … 8→$1,789, +$218 | ✅ match |
| Gross 130% / Net 100% / 165% / 200% MCE income limits | all sizes | ✅ match |
| Standard deduction | 1–3 $209, 4 $223, 5 $261, 6+ $299 | ✅ match |
| SUA / LUA / TUA | $663 / $170 / $20 | ✅ match |
| Max shelter deduction (non-elderly/disabled) | $744 | ✅ match |
| Homeless shelter deduction | $198.99 | ✅ match |
| Resource limits | $3,000 / $4,500 (elderly-disabled) | ✅ match |
| Earned income deduction | 20% | ✅ match |
| Medical deduction threshold | over $35, elderly/disabled only | ✅ match |
| Net income deduction order | EID → std → dep care → medical → shelter | ✅ match |
| Benefit formula | max allotment − 30% net | ✅ match |
| ABAWD age / time limit / work hours | 18–64, 3-in-36, 20/wk (80/mo) | ✅ match |
| ABAWD 60–64 nuance | exempt from work registration, NOT time limit | ✅ match |
| Noncitizen eligibility (OBBB) | US nationals / Cuban-Haitian / COFA immediate; LPR 5-yr + exceptions; refugees/asylees/parolees ineligible | ✅ match |
| Categorical eligibility | full CE waives all; MCE = 200% gross, net applies, asset waived | ✅ match |
| Elderly/disabled treatment | gross test waived, uncapped shelter, medical deduction, $4,500 resources | ✅ match |

## Bugs found & fixed

| # | Issue | Fix | Commit |
|---|-------|-----|--------|
| A-1 | Veteran & homeless treated as ABAWD-exempt | H.R.1 repealed those FRA-2023 exemptions (ACL 25-93); removed, kept as teaching traps | `1e113ed` |
| A-2 | Net-income presentation implied unearned income was ignored | Math was correct; clarified coach hint + explanation to show gross = earned + unearned | `d1751f0` |
| A-3 | ABAWD dependent-child exemption used "under 18" | H.R.1 narrowed it to **under 14** (ACL 25-93); a 14–17 child no longer exempts (now a trap) | `a9ce202` |
| A-4 | $24 minimum allotment not applied when formula floored to $0 | Eligible 1–2 person households get the minimum regardless (7 CFR 273.10(e)(2)) | `2e3efc2` |

## Scope note (not a bug — a limitation)
This audit covers the **eligibility-determination rules the game teaches**. It does not make the
game a complete caseworker onboarding tool: interviewing, verification/documentation, real
CalSAWS data entry, notices, reporting, recertification, overissuances, and mixed-status
proration mechanics are out of scope. Use as a *reinforcement* layer alongside a full curriculum,
and keep the on-screen "training simulator — verify against policy" disclaimer.
