"""Local dev server for the inference endpoint - the exact same `handler` Vercel
runs, served over http.server.

    .venv/bin/python dev_server.py            # serves on http://localhost:8000/api
    curl -s --data-binary @tests/fixtures/images/1.jpg \
         -H 'Content-Type: image/jpeg' http://localhost:8000/api | python -m json.tool
"""
import os
import sys
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "api"))
from index import handler  # noqa: E402

PORT = int(os.environ.get("PORT", "8000"))


class Router(handler):
    """Serve the function at both / and /api so either URL works locally."""

    def _route(self, method):
        # strip a leading /api so the handler's verb methods run regardless
        self.path = "/" if self.path.rstrip("/") in ("", "/api") else self.path
        getattr(handler, f"do_{method}")(self)

    def do_GET(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def do_OPTIONS(self):
        self._route("OPTIONS")


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Router)
    print(f"inference dev server on http://localhost:{PORT}/api  (Ctrl-C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.shutdown()
