# SME Review Packet — CalFresh Eligibility Simulator

**Purpose:** let a CalFresh policy expert validate the rules the trainer teaches in ~1–2 hours.
**Policy basis:** FFY 2026 (Oct 1 2025 – Sep 30 2026) + H.R.1 (OBBB).
**How to use:** for each row, mark ✅ (correct), ✏️ (needs change — add a note), or ❓ (unsure).
Anything not ✅ becomes a fix. All figures were cross-checked against the CalFresh policy KB on
2026-07-17 (see POLICY_AUDIT.md), but a human SME sign-off is the goal here.

---

## Module 1 — SNAP Basics

| Rule as taught | Value / logic | Source | ✔ |
|----------------|---------------|--------|---|
| Gross income test (standard) | ≤ 130% FPL by size (1: $1,696 … 8: $5,867, +$596) | FNS FY26 Income Eligibility Standards | ☐ |
| Net income test | ≤ 100% FPL by size (1: $1,305 … 8: $4,513, +$459) | FNS FY26 Income Eligibility Standards | ☐ |
| Resource limit | $3,000 standard / $4,500 if elderly or disabled | ACIN I-46-25 | ☐ |
| Benefit formula | max allotment − 30% of net income (floored at $0) | 7 CFR 273.10 | ☐ |
| Max allotment | 1: $298 … 8: $1,789, +$218/add'l | FNS FY26 Max Allotments | ☐ |
| Minimum allotment | $24 for eligible 1–2 person households (even at $0 formula) | 7 CFR 273.10(e)(2) | ☐ |

## Module 2 — Deductions

| Rule as taught | Value / logic | Source | ✔ |
|----------------|---------------|--------|---|
| Deduction order | EID → standard → dependent care → excess medical → excess shelter | MPP §63-503.311/.312 | ☐ |
| Earned income deduction | 20% of gross earned income | 7 CFR 273.9(d) | ☐ |
| Standard deduction | 1–3: $209; 4: $223; 5: $261; 6+: $299 | ACIN I-46-25 | ☐ |
| Utility allowances | SUA $663 / LUA $170 / TUA $20 | ACIN I-46-25 | ☐ |
| Excess shelter | (shelter + utility allowance) − 50% of income after prior deductions | 7 CFR 273.9(d)(6) | ☐ |
| Shelter cap | $744 (non-elderly/disabled); uncapped if elderly/disabled member | ACIN I-46-25 | ☐ |
| Homeless shelter deduction | $198.99 | ACIN I-46-25 | ☐ |

## Module 3 — Elderly & Disabled Households

| Rule as taught | Value / logic | Source | ✔ |
|----------------|---------------|--------|---|
| Gross income test | **waived** for households with an elderly (60+) or disabled member | 7 CFR 273.9(a) | ☐ |
| Excess shelter | **uncapped** | 7 CFR 273.9(d)(6) | ☐ |
| Medical deduction | out-of-pocket medical over $35/mo for elderly/disabled members | 7 CFR 273.9(d)(3) | ☐ |
| Resource limit | $4,500 | ACIN I-46-25 | ☐ |
| Full categorical eligibility | all members on CalWORKs/TANF or SSI → all financial tests waived | ACL 13-32 / 14-56 | ☐ |
| Modified CE (BBCE) | ≤ 200% FPL gross, no asset test, **net test still applies** | ACL 13-32 / 14-56 | ☐ |

## Module 4 — ABAWD Work Requirements (H.R.1)

| Rule as taught | Value / logic | Source | ✔ |
|----------------|---------------|--------|---|
| ABAWD age range | 18–64 (raised from 18–54 by H.R.1) | ACL 25-93 | ☐ |
| Time limit | 3 months of benefits in any 36-month period | ACL 19-93 / 25-93 | ☐ |
| Work requirement | 20 hrs/week (80 hrs/month averaged) | ACL 19-93 | ☐ |
| Exemptions still valid | pregnant; medically unfit; meeting work req; **Native American/Tribal member (new)** | ACL 25-93 | ☐ |
| Dependent-child exemption | responsibility for a child **under 14** (H.R.1 narrowed from under 18) | ACL 25-93 | ☐ |
| Repealed exemptions | veteran, homeless, former foster youth — **no longer exempt** | ACL 25-93 | ☐ |
| Age 60–64 nuance | exempt from work *registration* but NOT from the ABAWD *time limit* | ACL 25-93 | ☐ |

## Module 5 — Noncitizen Eligibility (H.R.1 / OBBB)

| Rule as taught | Value / logic | Source | ✔ |
|----------------|---------------|--------|---|
| Eligible immediately | U.S. citizens & nationals; Cuban/Haitian entrants; COFA citizens | ACL 25-92 | ☐ |
| LPR (green card) | eligible after 5-year wait unless an exception applies | ACL 25-92 | ☐ |
| LPR wait exceptions | under 18; 40 qualifying quarters; blind/disabled; 65+ & lawfully residing 8/22/96; military connection; others | ACL 25-92 | ☐ |
| No longer eligible | refugees, asylees, parolees, SIV holders, trafficking/battered/conditional entrants, deportation-withheld — unless separately an LPR | ACL 25-92 / 25-50 | ☐ |
| CA implementation | new applications 4/1/2026; ongoing HHs at recertification | ACL 25-92 | ☐ |

## Module 6 — Capstone
Combines Modules 1–5 in one mixed household (pathway → net income → eligibility → benefit, plus
ABAWD and noncitizen calls for individual members). No new rules; validates the integration.

---

## Reviewer sign-off

- Reviewer name / title: ____________________
- Date: ____________________
- Overall: ☐ Approved as accurate  ☐ Approved with the noted changes  ☐ Needs rework
- Notes / corrections:

> _One wrong rule taught confidently is worse than no tool — please flag anything that isn't
> exactly right for current policy._
