#!/usr/bin/env python3
"""SNAP Policy Trainer dev server.

Serves the static game AND accepts beta feedback at POST /feedback, appending each
submission as one JSON line to feedback.jsonl (next to this file). That file is what
gets aggregated into proposed product changes for review.
"""
import datetime
import http.server
import json
import os
import socketserver
import urllib.parse

PORT = int(os.environ.get("PORT", "8743"))
BASE = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE)
FEEDBACK_FILE = os.path.join(BASE, "feedback.jsonl")
SCORES_FILE = os.path.join(BASE, "scores.jsonl")
SHARED_TOKEN = "snap-trainer-v1"  # mirrors remoteBoard.js LB.token / Apps Script SHARED_TOKEN


def clamp(n, lo, hi):
    return max(lo, min(hi, n))


def compute_score(cases, accuracy_pct, avg_seconds, error_rate_pct, exemption):
    """Recompute the composite score from validated components — the client's score is ignored.
    Mirrors scoring.js computeShift() exactly."""
    acc_mult = (accuracy_pct / 100.0) ** 2
    speed_mult = clamp(1.4 - avg_seconds / 24.0, 0.6, 1.4)
    if exemption:
        per_penalty = 1.0
    elif error_rate_pct > 6.0:
        per_penalty = clamp(1 - (error_rate_pct - 6.0) * 0.03, 0.4, 1.0)
    else:
        per_penalty = 1.0
    return round(cases * 120 * acc_mult * speed_mult * per_penalty)


def validate_and_build(data):
    """Return a sanitized score row, or (None, reason) if the payload is junk."""
    if data.get("token") != SHARED_TOKEN:
        return None, "bad token"
    try:
        cases = int(data.get("casesProcessed"))
        accuracy = float(data.get("accuracyPct"))
        avg_seconds = float(data.get("avgSeconds"))
        error_rate = float(data.get("errorRatePct"))
    except (TypeError, ValueError):
        return None, "missing/invalid fields"
    # Plausibility gates — reject implausible payloads outright.
    if not (1 <= cases <= 500):
        return None, "cases out of range"
    if not (0 <= accuracy <= 100):
        return None, "accuracy out of range"
    if not (0 <= error_rate <= 100):
        return None, "error rate out of range"
    if avg_seconds < 1.5 or avg_seconds > 3600:
        return None, "avg time implausible"
    name = str(data.get("name") or "Anon").strip()[:24] or "Anon"
    exemption = bool(data.get("exemption"))
    score = compute_score(cases, accuracy, avg_seconds, error_rate, exemption)  # server-authoritative
    return {
        "name": name,
        "clientId": str(data.get("clientId") or "")[:64],
        "casesProcessed": cases,
        "accuracyPct": round(accuracy, 1),
        "avgSeconds": round(avg_seconds, 1),
        "errorRatePct": round(error_rate, 1),
        "exemption": exemption,
        "score": score,
        "ts": datetime.datetime.now().isoformat(timespec="seconds"),
    }, None


def read_top_scores(n):
    rows = []
    try:
        with open(SCORES_FILE, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
    except FileNotFoundError:
        return []
    rows.sort(key=lambda r: r.get("score", 0), reverse=True)
    return rows[:n]


class Handler(http.server.SimpleHTTPRequestHandler):
    def _json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = self.path.split("?")[0].rstrip("/")
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        if path == "/feedback":
            try:
                data = json.loads(raw.decode("utf-8") or "{}")
                if not isinstance(data, dict):
                    data = {"value": data}
            except Exception:
                data = {"raw": raw.decode("utf-8", "replace")}
            data["received_at"] = datetime.datetime.now().isoformat(timespec="seconds")
            try:
                with open(FEEDBACK_FILE, "a", encoding="utf-8") as fh:
                    fh.write(json.dumps(data, ensure_ascii=False) + "\n")
                self._json({"ok": True})
            except Exception as exc:  # pragma: no cover
                self._json({"ok": False, "error": str(exc)}, 500)
        elif path == "/board":
            try:
                data = json.loads(raw.decode("utf-8") or "{}")
            except Exception:
                data = {}
            row, reason = validate_and_build(data if isinstance(data, dict) else {})
            if row is None:
                self._json({"ok": False, "error": reason}, 400)
                return
            try:
                with open(SCORES_FILE, "a", encoding="utf-8") as fh:
                    fh.write(json.dumps(row, ensure_ascii=False) + "\n")
                self._json({"ok": True, "score": row["score"]})
            except Exception as exc:  # pragma: no cover
                self._json({"ok": False, "error": str(exc)}, 500)
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")
        if path == "/board":
            qs = urllib.parse.parse_qs(self.path.split("?", 1)[1] if "?" in self.path else "")
            if (qs.get("token", [""])[0]) != SHARED_TOKEN:
                self._json({"ok": False, "error": "bad token"}, 403)
                return
            try:
                n = int(qs.get("n", ["25"])[0])
            except ValueError:
                n = 25
            self._json(read_top_scores(clamp(n, 1, 100)))
        else:
            super().do_GET()

    def log_message(self, *args):
        pass  # keep the console quiet


class Server(socketserver.TCPServer):
    allow_reuse_address = True  # so quick restarts don't hit "address already in use"


if __name__ == "__main__":
    with Server(("", PORT), Handler) as httpd:
        print(f"SNAP Policy Trainer on http://localhost:{PORT}  (feedback -> {FEEDBACK_FILE})")
        httpd.serve_forever()
