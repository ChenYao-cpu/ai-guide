"""Serve a verified APK from a dedicated LAN download folder, without Web/backend changes."""
import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.parse import urlparse


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--port', type=int, default=8088)
    args = parser.parse_args()
    directory = args.directory.resolve()
    record = json.loads((directory / 'verification.json').read_text(encoding='utf8'))
    apk_name = 'zhiyou-' + record['version'] + '.apk'
    apk = directory / apk_name
    with apk.open('rb') as handle:
        assert hashlib.file_digest(handle, 'sha256').hexdigest() == record['sha256']
    assert record['signature_verified'] and record['app_resources_verified']
    allowed = {'index.html': 'text/html; charset=utf-8', apk_name: 'application/vnd.android.package-archive',
               'download-qr.png': 'image/png'}

    class DownloadHandler(BaseHTTPRequestHandler):
        def do_HEAD(self):
            self.respond(False)

        def do_GET(self):
            self.respond(True)

        def respond(self, body):
            name = urlparse(self.path).path.lstrip('/') or 'index.html'
            if name not in allowed or not (directory / name).is_file():
                self.send_error(404)
                return
            file = directory / name
            self.send_response(200)
            self.send_header('Content-Type', allowed[name])
            self.send_header('Content-Length', str(file.stat().st_size))
            self.send_header('Cache-Control', 'no-store')
            if name == apk_name:
                self.send_header('Content-Disposition', 'attachment; filename="' + apk_name + '"')
            self.end_headers()
            if body:
                try:
                    with file.open('rb') as handle:
                        while chunk := handle.read(1024 * 1024):
                            self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    pass

    print('App-only download server listening on port ' + str(args.port), flush=True)
    ThreadingHTTPServer(('0.0.0.0', args.port), DownloadHandler).serve_forever()


if __name__ == '__main__':
    main()
