// Low-fidelity "Alaska Exemption" polar bear battle.
// Unlocked when a shift's Payment Error Rate clears ALASKA_EXEMPTION_PER (13.34%): high
// enough that federal cost-share liability is delayed under H.R.1 — but you must beat a
// polar bear to claim the exemption. Win → PER penalty waived. Lose → shift is over.

const PLAYER_MAX = 100;
const BEAR_MAX = 120;

export function startBearFight(card, { perPct, onWin, onLose, onDecline }) {
  let playerHp = PLAYER_MAX;
  let bearHp = BEAR_MAX;
  let meterTimer = null;
  let meterPos = 0;
  let meterDir = 1;
  let busy = false; // ignore clicks during the brief hit animation
  const log = [];

  function clearMeter() {
    if (meterTimer) {
      clearInterval(meterTimer);
      meterTimer = null;
    }
  }

  function hpBar(label, hp, max, cls) {
    const pct = Math.max(0, Math.round((hp / max) * 100));
    return `<div class="hp-row">
      <span class="hp-label">${label}</span>
      <div class="hp-track"><div class="hp-fill ${cls}" style="width:${pct}%"></div></div>
      <span class="hp-num">${Math.max(0, hp)}</span>
    </div>`;
  }

  function renderIntro() {
    card.innerHTML = `
      <div class="wc-kicker">❄️ Alaska Exemption</div>
      <h1 class="wc-title">A polar bear blocks your path</h1>
      <p class="wc-sub">Your Payment Error Rate of <strong>${perPct}%</strong> clears the <strong>13.34%</strong> Alaska Exemption threshold — high enough that your federal cost-share liability is <em>delayed</em> and won't touch your score. (Yes, really: under H.R.1 the worse your error rate, the longer you dodge the penalty.)</p>
      <p class="wc-sub">But the exemption is guarded. Defeat the polar bear 🐻‍❄️ to claim it. Lose, and your shift is over.</p>
      <div class="wc-menu">
        <button class="wc-btn primary" id="bear-fight">🥊 Fight the bear</button>
        <button class="wc-btn" id="bear-decline">Accept the PER penalty instead</button>
      </div>`;
    card.querySelector("#bear-fight").onclick = startBattle;
    card.querySelector("#bear-decline").onclick = () => {
      clearMeter();
      onDecline();
    };
  }

  function renderBattle(flash) {
    card.innerHTML = `
      <div class="wc-kicker">❄️ Alaska Exemption — Battle</div>
      <div class="bear-scene ${flash || ""}">
        <div class="bear-emoji">🐻‍❄️</div>
      </div>
      ${hpBar("Polar Bear", bearHp, BEAR_MAX, "bear")}
      ${hpBar("You (Eligibility Worker)", playerHp, PLAYER_MAX, "you")}
      <div class="meter-wrap">
        <div class="meter-track"><div class="meter-zone"></div><div class="meter-marker" id="meter-marker"></div></div>
        <div class="meter-hint">Hit <strong>Strike</strong> when the marker is in the blue zone for a critical hit.</div>
      </div>
      <div class="wc-menu"><button class="wc-btn primary" id="bear-strike">🥊 Strike!</button></div>
      <div class="bear-log" id="bear-log">${log.slice(-4).map((l) => `<div>${l}</div>`).join("")}</div>`;

    const marker = card.querySelector("#meter-marker");
    clearMeter();
    meterTimer = setInterval(() => {
      meterPos += meterDir * 4;
      if (meterPos >= 100) {
        meterPos = 100;
        meterDir = -1;
      }
      if (meterPos <= 0) {
        meterPos = 0;
        meterDir = 1;
      }
      marker.style.left = meterPos + "%";
    }, 24);
    card.querySelector("#bear-strike").onclick = strike;
  }

  function strike() {
    if (busy) return;
    busy = true;
    clearMeter();

    const dist = Math.abs(meterPos - 50); // zone is the middle ~20% (40–60)
    let dmg;
    let crit = false;
    if (dist <= 10) {
      dmg = 30 + Math.floor(Math.random() * 12);
      crit = true;
    } else {
      dmg = Math.max(6, Math.round(24 - dist * 0.4));
    }
    bearHp -= dmg;
    log.push(`You strike for <strong>${dmg}</strong>${crit ? " — CRITICAL! ❄️" : "."}`);

    if (bearHp <= 0) return finishWin();

    const bd = 8 + Math.floor(Math.random() * 15);
    playerHp -= bd;
    log.push(`🐻‍❄️ The bear mauls you for <strong>${bd}</strong>.`);
    renderBattle("shake");

    setTimeout(() => {
      busy = false;
      if (playerHp <= 0) finishLose();
      else renderBattle();
    }, 450);
  }

  function finishWin() {
    clearMeter();
    card.innerHTML = `
      <div class="wc-kicker">❄️ Exemption Claimed</div>
      <h1 class="wc-title">You bested the bear! 🐻‍❄️🥊</h1>
      <p class="wc-sub">The Alaska Exemption holds. Your ${perPct}% PER triggers <strong>no cost-share penalty</strong> on this shift — federal liability delayed, courtesy of one defeated polar bear.</p>
      <div class="wc-menu"><button class="wc-btn primary" id="bear-claim">Claim exemption &amp; post shift</button></div>`;
    card.querySelector("#bear-claim").onclick = onWin;
  }

  function finishLose() {
    clearMeter();
    card.innerHTML = `
      <div class="wc-kicker">❄️ Defeated</div>
      <h1 class="wc-title">The bear won. 🐻‍❄️</h1>
      <p class="wc-sub">Your shift ends here — no exemption, no posted score. The polar bear pads back to its ice floe. Better luck (and lower error rates) next shift.</p>
      <div class="wc-menu"><button class="wc-btn primary" id="bear-end">End shift</button></div>`;
    card.querySelector("#bear-end").onclick = onLose;
  }

  function startBattle() {
    renderBattle();
  }

  renderIntro();
}
