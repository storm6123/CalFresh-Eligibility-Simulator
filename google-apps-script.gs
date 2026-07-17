/**
 * SNAP Policy Trainer — shared leaderboard backend (Google Apps Script + Sheet).
 *
 * Deploy this as a Web App (Execute as: Me, Who has access: Anyone) and paste the /exec URL
 * into remoteBoard.js (LB.endpoint) or set localStorage 'snapTrainerLbEndpoint'.
 *
 * Anti-junk design (matches server.py):
 *  - The client posts only gameplay COMPONENTS; this script RECOMPUTES the score and ignores
 *    any score the client sends, so a fake total can't be injected.
 *  - Component range checks reject implausible payloads (e.g., 50 cases in 2 seconds).
 *  - A shared token blocks random web bots. NOTE: the token lives in public client code, so it
 *    deters drive-by spam, not a determined insider posting plausible-but-fake components — fine
 *    for a friendly team board. You can always delete junk rows straight from the Sheet.
 */

var SHARED_TOKEN = "snap-trainer-v1"; // must match remoteBoard.js LB.token
var SHEET_NAME = "scores";
var HEADERS = ["ts", "name", "clientId", "casesProcessed", "accuracyPct", "avgSeconds", "errorRatePct", "exemption", "score", "rankTitle", "rankIcon"];

function clamp_(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Recompute the composite score from components — identical to scoring.js computeShift().
function computeScore_(cases, accuracyPct, avgSeconds, errorRatePct, exemption) {
  var accMult = Math.pow(accuracyPct / 100, 2);
  var speedMult = clamp_(1.4 - avgSeconds / 24, 0.6, 1.4);
  var perPenalty = exemption ? 1 : errorRatePct > 6 ? clamp_(1 - (errorRatePct - 6) * 0.03, 0.4, 1) : 1;
  return Math.round(cases * 120 * accMult * speedMult * perPenalty);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// GET /exec?token=...&n=25  -> top N scores as JSON array
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.token !== SHARED_TOKEN) return json_({ ok: false, error: "bad token" });
  var n = clamp_(parseInt(p.n, 10) || 25, 1, 100);
  var sh = sheet_();
  var values = sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    rows.push({
      ts: r[0],
      name: r[1],
      clientId: r[2],
      casesProcessed: r[3],
      accuracyPct: r[4],
      avgSeconds: r[5],
      errorRatePct: r[6],
      exemption: r[7] === true || r[7] === "true",
      score: r[8],
      rankTitle: r[9] || "",
      rankIcon: r[10] || "",
    });
  }
  rows.sort(function (a, b) {
    return b.score - a.score;
  });
  return json_(rows.slice(0, n));
}

// POST /exec  (text/plain body = JSON of components) -> validates, recomputes score, appends row
function doPost(e) {
  var data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return json_({ ok: false, error: "bad json" });
  }
  if (data.token !== SHARED_TOKEN) return json_({ ok: false, error: "bad token" });

  var cases = parseInt(data.casesProcessed, 10);
  var accuracy = parseFloat(data.accuracyPct);
  var avgSeconds = parseFloat(data.avgSeconds);
  var errorRate = parseFloat(data.errorRatePct);
  if (isNaN(cases) || isNaN(accuracy) || isNaN(avgSeconds) || isNaN(errorRate))
    return json_({ ok: false, error: "missing/invalid fields" });
  if (cases < 1 || cases > 500) return json_({ ok: false, error: "cases out of range" });
  if (accuracy < 0 || accuracy > 100) return json_({ ok: false, error: "accuracy out of range" });
  if (errorRate < 0 || errorRate > 100) return json_({ ok: false, error: "error rate out of range" });
  if (avgSeconds < 1.5 || avgSeconds > 3600) return json_({ ok: false, error: "avg time implausible" });

  var name = String(data.name || "Anon").trim().slice(0, 24) || "Anon";
  var exemption = data.exemption === true;
  var score = computeScore_(cases, accuracy, avgSeconds, errorRate, exemption); // server-authoritative

  sheet_().appendRow([
    new Date().toISOString(),
    name,
    String(data.clientId || "").slice(0, 64),
    cases,
    Math.round(accuracy * 10) / 10,
    Math.round(avgSeconds * 10) / 10,
    Math.round(errorRate * 10) / 10,
    exemption,
    score,
    String(data.rankTitle || "").slice(0, 40),
    String(data.rankIcon || "").slice(0, 8),
  ]);
  return json_({ ok: true, score: score });
}
