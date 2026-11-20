"""Serve web/ on http://localhost:8000 with caching off, so edits always show on reload.

python tools/serve.py [port]
"""
import functools
import http.server
import pathlib
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
web = pathlib.Path(__file__).resolve().parent.parent / "web"
handler = functools.partial(NoCache, directory=str(web))
print(f"serving {web} on http://localhost:{port}")
http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
