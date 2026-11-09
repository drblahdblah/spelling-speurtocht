#!/usr/bin/env python3
"""An offline, loopback-only server for Spelling Speurtocht. No dependencies."""

import argparse
import mimetypes
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


WEB_ROOT = Path(__file__).resolve().parent / "web"
ROUTES = {"/": "index.html", "/index.html": "index.html", "/style.css": "style.css",
          "/game.js": "game.js", "/words.json": "words.json", "/icon.svg": "icon.svg",
          "/strong-words.json": "strong-words.json", "/nouns.json": "nouns.json"}
CSP = ("default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; "
       "connect-src 'self'; font-src 'none'; object-src 'none'; base-uri 'none'; "
       "frame-ancestors 'none'; form-action 'none'")


class GameHandler(BaseHTTPRequestHandler):
    """Serve an explicit asset list; never expose the surrounding workspace."""

    def do_GET(self):
        self._serve(send_body=True)

    def do_HEAD(self):
        self._serve(send_body=False)

    def _serve(self, send_body):
        port = self.server.server_port
        # Reject foreign Host headers, including DNS rebinding attempts.
        if self.headers.get_all("Host", []) not in (
                ["127.0.0.1:{}".format(port)], ["localhost:{}".format(port)]):
            self.send_error(403, "Use the local address printed by the launcher.")
            return
        name = ROUTES.get(urlsplit(self.path).path)
        if name is None:
            self.send_error(404)
            return
        try:
            body = (WEB_ROOT / name).read_bytes()
        except OSError:
            self.send_error(503, "A game file is missing. Restore the web folder.")
            return
        content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if send_body:
            self.wfile.write(body)

    def log_message(self, format, *args):
        # No browsing or answer history in server logs.
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765, help="Local port (default: 8765)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Choose a port between 1 and 65535.")
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), GameHandler)
    except OSError as error:
        parser.exit(1, "Could not start the game: {}.\nTry --port 8766.\n".format(error))
    url = "http://127.0.0.1:{}/".format(server.server_port)
    print("\n  Spelling Speurtocht\n  {}\n\n  Stop with Ctrl+C.\n".format(url), flush=True)
    timer = None
    if not args.no_browser:
        timer = threading.Timer(0.4, webbrowser.open, args=(url,))
        timer.daemon = True
        timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nTot de volgende keer!")
    finally:
        if timer:
            timer.cancel()
        server.server_close()


if __name__ == "__main__":
    main()
