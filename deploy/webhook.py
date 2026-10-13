#!/usr/bin/env python3
"""Verified GitHub push notifications trigger the fixed deployment unit."""
import hashlib
import hmac
import json
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

SECRET = Path('/etc/hill-rivals/webhook-secret').read_bytes().strip()

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', '0'))
        if self.path != '/github-webhook' or not 0 < length <= 2_000_000:
            self.send_error(400)
            return
        body = self.rfile.read(length)
        signature = 'sha256=' + hmac.new(SECRET, body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, self.headers.get('X-Hub-Signature-256', '')):
            self.send_error(403)
            return
        try:
            payload = json.loads(body)
        except ValueError:
            self.send_error(400)
            return
        event = self.headers.get('X-GitHub-Event')
        if event == 'push' and payload.get('ref') == 'refs/heads/main' and payload.get('repository', {}).get('full_name') == 'fecatt/hill-rivals':
            subprocess.run(['systemctl', 'start', '--no-block', 'hill-rivals-update.service'], check=True)
        self.send_response(202)
        self.end_headers()
        self.wfile.write(b'Accepted')

HTTPServer(('127.0.0.1', 3108), Handler).serve_forever()
