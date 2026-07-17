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
5. **Tell the game that URL.** The game doesn't know your Sheet exists until you give it the
   `/exec` URL from step 4. This is what switches it from a local board to the shared one.
   **Do this once, for everyone:** open [`remoteBoard.js`](remoteBoard.js), find the line near the
   top that reads `endpoint: "",` and paste your URL between the quotes:
   ```js
   endpoint: "https://script.google.com/macros/s/AKfy.../exec",
   ```
   Then commit + push — the live site rebuilds and the shared board is on for **all** users.
   *(Easiest option: just send the `/exec` URL to Claude and it will paste it in and push for you.)*

   > **Testing only:** to try it on one machine without editing code, run this in that browser's
   > console: `localStorage.setItem('snapTrainerLbEndpoint','<your /exec URL>')`. This affects
   > **only that one browser** — it does NOT turn the board on for teammates, so it's just for
   > a quick personal test.
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

## Updating the script (e.g., to show worker ranks)

When `google-apps-script.gs` changes (like adding the `rankTitle`/`rankIcon` columns so the
shared board shows each player's worker rank), redeploy the **same** deployment so the URL
doesn't change: paste the new code, save, then **Deploy → Manage deployments → ✏️ Edit →
Version: New version → Deploy**. Old rows simply lack the new columns (blank rank); new
submissions populate them. (Ranks always show on your local board and your own row without a
redeploy — the redeploy is only needed to see *other* players' ranks.)

## Rotating the token
To invalidate old clients (e.g., after a wider release), change `SHARED_TOKEN` in **both**
`google-apps-script.gs` (redeploy) and `remoteBoard.js` (redeploy the site).
