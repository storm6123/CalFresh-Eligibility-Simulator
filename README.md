# SNAP Policy Trainer

A browser-based training game that teaches **SNAP / CalFresh** eligibility policy by putting
you in the eligibility worker's chair — running CalSAWS-style **Eligibility Determination and
Benefit Calculation (EDBC)** cases. Policy is current as of **FFY 2026, including the H.R.1
changes**.

## Features

- **Six modules** — SNAP Basics → Deductions → Elderly & Disabled → ABAWD Work Requirements
  → Noncitizen Eligibility → Capstone.
- **Learning Mode** — per-step coaching, per-module policy primers, retry freely, nothing
  scored. **Graded Shift** — timed, scored, with a leaderboard.
- **Scoring** rewards accuracy (a dollar-weighted **Payment Error Rate** modeled on H.R.1's
  cost-share trigger), speed, and volume — including the "Alaska Exemption" mini-game.
- **Guided tour**, floating **calculator**, and a **feedback** button (Google Form).

## Run locally

It's a static site (plain HTML/JS/CSS, no build step). Serve the folder over HTTP:

```bash
python3 server.py          # serves on http://localhost:8743
# or: python3 -m http.server 8743
```

Open <http://localhost:8743>. (ES modules require http/https — opening `index.html` from the
file system won't work.)

`server.py` is a convenience for local dev only and is not needed when hosted statically.

## Deploy (GitHub Pages)

The repo root is the site root, so Pages works with no build:

1. **Settings → Pages → Build and deployment → Source: Deploy from a branch**
2. Branch: `main`, folder: `/ (root)` → **Save**
3. The site publishes at `https://<user>.github.io/<repo>/`.

## Feedback

The 💬 Feedback button opens a Google Form. Paste your form link into `feedback.js`
(`FEEDBACK_FORM_URL`). See [FEEDBACK_PROCESS.md](FEEDBACK_PROCESS.md) for the full
capture → aggregate → approve/deny workflow.

## Policy grounding

Determinations are checked against current federal SNAP figures and California CalFresh
guidance (ACLs, ACINs, CFR, FNS COLA tables). This is a **training simulator** — not the live
CalSAWS system, and it holds no real case data.
