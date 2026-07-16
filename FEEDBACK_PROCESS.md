# Beta Feedback → Product Changes

How player feedback flows into changes you approve or deny. Feedback is collected via a
**Google Form** so it works on a plain static host (no backend needed).

## 1. One-time setup

1. Create a Google Form with (suggested) questions:
   - **Overall rating** — Linear scale 1–5
   - **What's this about?** — Multiple choice: Bug / Confusing / Policy accuracy / Feature idea / Visual / Other
   - **Your feedback** — Paragraph
   - **Where were you?** — Short answer (optional; can be auto-filled — see below)
2. In the form, click **Send → 🔗 (link)** and copy the URL.
3. Paste it into `feedback.js` at the top: `const FEEDBACK_FORM_URL = "…";`
4. (Optional) Auto-fill the "Where were you?" question with the player's current mode +
   module: use the full `…/viewform` URL, get that question's field id (`entry.123…`),
   and set `PREFILL_CONTEXT_ENTRY` in `feedback.js`.

Until a real URL is set, the in-app button shows a "not configured yet" note, so it's
obvious during setup.

## 2. Capture (automatic)

Players click **💬 Feedback** in the top bar → a short modal → **Open feedback form ↗**
(new tab). The modal also shows their current mode + module so they can mention it.
All responses collect in the form's linked **Google Sheet**.

## 3. Aggregate (ask Claude)

When you want a review, export the form's responses (**Google Sheets → File → Download →
CSV**, or copy the sheet) and share it with Claude:

> "Review the beta feedback." *(attach/paste the responses)*

Claude clusters the notes into themes and writes/updates **`feedback-review.md`** — a ranked
table of *proposed, actionable changes*, each tied to the feedback that motivated it.

## 4. Review & decide (you)

In `feedback-review.md`, set each item's **Status** to `Approved` or `Denied` (add a note
if useful), then tell Claude to proceed. Claude builds only the **Approved** items and marks
them `Shipped`. Denied items stay logged so they aren't re-proposed.

### Proposed-change table format

| ID | Theme | Mentions | Avg rating | Proposed change | Effort | Status | Notes |
|----|-------|----------|-----------|-----------------|--------|--------|-------|
| F-001 | _e.g._ Net-income step is confusing | 3 | 3.7 | Add a worked-example toggle on the net-income step | S | Pending | |

- **Effort**: S (<1 session), M (a few edits), L (new subsystem).
- **Status**: `Pending` → `Approved`/`Denied` (you) → `Shipped` (Claude).
- Ranked by a blend of frequency, severity (bugs/policy > polish), and low ratings.
- Policy-accuracy reports are checked against the CalFresh policy knowledge base before any
  rule change.

## Note on the old local endpoint

`server.py` (with its `POST /feedback` → `feedback.jsonl`) is now only for **local dev** —
it still serves the app on your machine. Production uses the Google Form, so `server.py`
and `feedback.jsonl` don't need to be deployed to the static host.
