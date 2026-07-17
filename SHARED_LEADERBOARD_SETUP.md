# Shared Leaderboard Setup (Google Apps Script + Sheet)

Turns the local per-browser board into a **live shared board** your team competes on — no
server to run or pay for. ~10 minutes.

## Steps

1. **Create the Sheet.** Go to [sheets.new](https://sheets.new) and name it e.g. "SNAP Trainer Leaderboard".
2. **Open the script editor.** In the Sheet: **Extensions → Apps Script**.
3. **Paste the code.** Delete the default `function myFunction(){}`, then paste the entire
   contents of [`google-apps-script.gs`](google-apps-script.gs). Save (💾).
4. **Deploy as a Web App.** Click **Deploy → New deployment → (gear) Web app**. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
   Click **Deploy**, authorize when prompted, and **copy the Web app URL** (ends in `/exec`).
5. **Point the game at it.** In [`remoteBoard.js`](remoteBoard.js), set:
   ```js
   endpoint: "https://script.google.com/macros/s/AKfy.../exec",
   ```
   Commit + push (the live site auto-deploys). *(Or, without editing code, run in the browser
   console once per device: `localStorage.setItem('snapTrainerLbEndpoint','<your /exec URL>')`.)*
6. **Done.** Submitting a shift now posts to the Sheet, and the Leaderboard shows the live
   shared ranking with a 🟢 banner.

## How junk is prevented

- **The game posts automatically** — players never type a score.
- **The server recomputes the score** from the gameplay components (cases/accuracy/speed/PER)
  and ignores any score the client sends — a fake total can't be injected.
- **Range checks** reject implausible payloads (cases 1–500, accuracy/PER 0–100%, average time
  ≥ 1.5s so "50 cases in 2 seconds" is refused).
- **A shared token** blocks random web bots from posting.

**Honest limit:** the token lives in public client code, so a determined technical user could
still POST *plausible-but-fake* components. The range floors bound how absurd that can get, and
you can delete any suspicious row directly in the Sheet. For a friendly team training board this is
an appropriate tradeoff; don't treat scores as audited truth.

## Privacy
Only first name / initials + gameplay stats are stored — no case data, no PII. Keep it that way
by asking players to use initials. The Sheet is yours; you control access and can clear it anytime.

## Rotating the token
To invalidate old clients (e.g., after a wider release), change `SHARED_TOKEN` in **both**
`google-apps-script.gs` (redeploy) and `remoteBoard.js` (redeploy the site).
