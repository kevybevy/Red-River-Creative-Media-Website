#!/usr/bin/env python3
"""Local preview server with caching turned off, so every edit shows on reload.
Usage: python3 serve.py [port]   (default 8123)"""
import functools, http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
root = os.path.dirname(os.path.abspath(__file__))
handler = functools.partial(NoCache, directory=root)
print(f"Serving {root} at http://localhost:{port}")
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
