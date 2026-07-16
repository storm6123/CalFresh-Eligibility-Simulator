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

PORT = int(os.environ.get("PORT", "8743"))
BASE = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE)
FEEDBACK_FILE = os.path.join(BASE, "feedback.jsonl")


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path.rstrip("/") == "/feedback":
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
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
                body = b'{"ok":true}'
                status = 200
            except Exception as exc:  # pragma: no cover
                body = json.dumps({"ok": False, "error": str(exc)}).encode("utf-8")
                status = 500
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *args):
        pass  # keep the console quiet


class Server(socketserver.TCPServer):
    allow_reuse_address = True  # so quick restarts don't hit "address already in use"


if __name__ == "__main__":
    with Server(("", PORT), Handler) as httpd:
        print(f"SNAP Policy Trainer on http://localhost:{PORT}  (feedback -> {FEEDBACK_FILE})")
        httpd.serve_forever()
