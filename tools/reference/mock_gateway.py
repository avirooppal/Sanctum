#!/usr/bin/env python3
"""Isolated mock gateway for upstream reference dashboard and renderer.

Serves the exact JSON endpoints that web/src/lib/api.ts and apps/desktop call,
populated with realistic fixture data for reference visual screenshots.
"""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import sys

FIXTURES = {
    "/api/status": {
        "status": "healthy",
        "version": "1.0.0-reference",
        "uptime": 3600,
        "active_models": ["chat-tiny-q8"],
        "memory_rss_mb": 450,
    },
    "/api/config": {
        "profile": "runtime-cpu",
        "hardware": "T0 Tiny",
        "threads": 2,
        "context": 2048,
        "egress_denied": True,
        "cloud_connectors_enabled": False,
        "speech": {"model": "asr-parakeet-q4k", "tts": "tts-flite-slt"},
    },
    "/api/models": {
        "models": [
            {
                "id": "chat-tiny-q8",
                "name": "Qwen3-0.6B-Q8 (Local CPU)",
                "context_length": 2048,
                "quantization": "Q8_0",
                "fit_estimate": "Fits in 8GB RAM",
                "license": "Apache-2.0",
                "capabilities": ["chat", "tools"],
            },
            {
                "id": "embed-small-q8",
                "name": "Qwen3-Embedding-0.6B (Local)",
                "context_length": 2048,
                "quantization": "Q8_0",
                "fit_estimate": "Embedding index",
                "license": "Apache-2.0",
                "capabilities": ["embedding"],
            },
        ]
    },
    "/api/sessions": {
        "sessions": [
            {
                "id": "session-ref-001",
                "title": "Sanctum Architecture & Privacy Review",
                "created_at": 1773000000,
                "updated_at": 1773000500,
                "message_count": 4,
                "model": "chat-tiny-q8",
            },
            {
                "id": "session-ref-002",
                "title": "Local RAG Retrieval Tuning",
                "created_at": 1773001000,
                "updated_at": 1773001200,
                "message_count": 2,
                "model": "chat-tiny-q8",
            },
        ]
    },
    "/api/health": {"status": "ok"},
}


class MockGatewayHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = self.path.split("?")[0]
        if url in FIXTURES:
            data = json.dumps(FIXTURES[url]).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_response(200)
            data = b'{"ok": true}'
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    def do_POST(self):
        url = self.path.split("?")[0]
        if url == "/api/ticket":
            data = json.dumps({"ticket": "ref-ticket-12345", "expires_in": 30}).encode("utf-8")
        else:
            data = b'{"ok": true, "result": "mock_ack"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        # Silent logger during automated visual runs
        pass


def run(port=8899):
    server = HTTPServer(("127.0.0.1", port), MockGatewayHandler)
    print(f"Mock gateway listening on http://127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
    run(port)
