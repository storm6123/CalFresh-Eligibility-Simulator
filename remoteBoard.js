// Optional shared leaderboard backed by a Google Apps Script + Sheet (or the local dev server).
// The game posts only gameplay COMPONENTS (cases/accuracy/speed/PER); the server recomputes the
// score and range-checks the components, so a client can't inject a fake total. Until an endpoint
// is configured, the board stays local (per-browser) exactly as before.

export const LB = {
  // Paste your deployed Apps Script web-app URL here (…/exec) to turn on the shared board.
  // You can also set it at runtime without editing code: localStorage 'snapTrainerLbEndpoint'.
  endpoint: "https://script.google.com/macros/s/AKfycbwpg2pXV7SixxXbw-cZQy8Ps557IsfJzcYckMG9i9FjGMhXe1MIrcDfW6BRxtJi9lT3Fw/exec",
  token: "snap-trainer-v1", // must match SHARED_TOKEN in the Apps Script
  topN: 25,
};

function resolveEndpoint() {
  try {
    return (localStorage.getItem("snapTrainerLbEndpoint") || LB.endpoint || "").trim();
  } catch (e) {
    return LB.endpoint;
  }
}

export function isConfigured() {
  return !!resolveEndpoint();
}

// Stable anonymous per-browser id so a user's own rows can be highlighted on the shared board.
export function clientId() {
  try {
    let id = localStorage.getItem("snapTrainerClientId");
    if (!id) {
      id = "c_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("snapTrainerClientId", id);
    }
    return id;
  } catch (e) {
    return "c_anon";
  }
}

// Submit a shift's COMPONENTS (not the score). Uses a "simple" text/plain POST to avoid a CORS
// preflight, which Apps Script web apps don't answer.
export async function submitScore(entry) {
  const endpoint = resolveEndpoint();
  if (!endpoint) return { ok: false, skipped: true };
  const payload = {
    token: LB.token,
    clientId: clientId(),
    name: entry.name,
    casesProcessed: entry.casesProcessed,
    accuracyPct: entry.accuracyPct,
    avgSeconds: entry.avgSeconds,
    errorRatePct: entry.errorRatePct,
    exemption: !!entry.exemption,
  };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok !== false, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Fetch the shared top-N. Returns an array (marking the caller's own rows) or null on failure.
export async function fetchScores() {
  const endpoint = resolveEndpoint();
  if (!endpoint) return null;
  try {
    const url = endpoint + (endpoint.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(LB.token) + "&n=" + LB.topN;
    const res = await fetch(url);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.scores || [];
    const me = clientId();
    return list.map((e) => ({ ...e, you: e.clientId === me, benchmark: false }));
  } catch (e) {
    return null;
  }
}
