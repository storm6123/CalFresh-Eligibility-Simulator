# Beta Feedback — Review & Decisions

Working backlog from tester feedback. You set **Status** to `Approved` / `Denied`; I build the
approved items and mark them `Shipped`. See [FEEDBACK_PROCESS.md](FEEDBACK_PROCESS.md).

| ID | Theme | Mentions | Proposed change | Effort | Status | Notes |
|----|-------|----------|-----------------|--------|--------|-------|
| F-001 | **Bug: veteran status wrongly exempted from ABAWD** | 1 | Remove veteran/homeless/former-foster-youth from ABAWD exemptions (H.R.1 repealed them per ACL 25-93). Keep them as teaching "traps" that explain the repeal. | S | ✅ Shipped | Verified against policy KB. Live in commit `1e113ed`. |
| F-002 | **Few/no BBCE (Modified CE) cases** | 1 | Option A: represent MCE in Module 2 (~1/3 of cases) with the pathway step shown for CE cases; keep MCE households ≤200% FPL so they resolve to MCE; label tests as "Modified CE". Module 1 stays standard-by-design (foundation); Modules 3 & 6 already had CE. | S | ✅ Shipped | Approved. Commit `d1751f0`. |
| F-003 | **Net income looked like it ignored unearned income** | 1 | Math was correct; presentation implied net was earned-only. Coach hint + explanation now show gross = earned + unearned and state unearned counts in full. | S | ✅ Shipped | Commit `d1751f0`. |
| F-004 | **"Module" chip looked like a button but did nothing** | 1 | Restyle the Case Summary module chip as a plain uppercase label (no border/background). | S | ✅ Shipped | Commit `d1751f0`. |

## Detail

### F-001 — Veteran/homeless ABAWD exemption (Shipped)
**Feedback:** "veteran status DOES NOT exempt you from ABAWD."
**Confirmed:** ACL 25-93 (eff. 2026-06-01) — H.R.1 repealed the FRA-2023 exemptions for veterans,
individuals experiencing homelessness, and former foster youth. Fixed in `calc.js`, `rules.js`,
`game.js` (coach hint), and `scenarios.js` (explanations now call out the repeal). Tribal-member
exemption retained (the correct new H.R.1 exemption).

### F-002 — BBCE / Modified Categorical Eligibility representation (Pending)
**Feedback:** "there's no BBCE-eligible cases here. In most BBCE states, everyone gets it… not
super important but just noting."
**Options if approved:**
- **A (light):** Bump the probability that a generated household is MCE in Modules 1–3, so most
  cases use the 200% FPL gross test with no asset test (matching CA practice).
- **B (fuller):** Add a dedicated "pathway" step earlier (which CE applies?) and a short note on
  each case showing the eligibility pathway in play.
**My recommendation:** A — small change, improves realism without diluting the standard-rules
teaching. Say the word and I'll implement + push.
