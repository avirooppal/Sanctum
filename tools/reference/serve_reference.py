#!/usr/bin/env python3
"""Offline reference server and mock gateway for upstream fidelity verification.

Serves the reference dashboard and chat interfaces backed by mock_gateway.py fixtures
and mock_electron_bridge.js for visual capture and token comparison without external network.
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import threading
import time

try:
    from tools.reference.mock_gateway import MockGatewayHandler
except ImportError:
    from mock_gateway import MockGatewayHandler

REFERENCE_DIR = Path(__file__).resolve().parent

DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hermes Reference Dashboard</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --card-bg: #141414;
      --card-border: #262626;
      --text: #ededed;
      --text-muted: #a1a1aa;
      --accent: #2563eb;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
    }
    aside {
      width: 237px;
      min-width: 237px;
      border-right: 1px solid var(--card-border);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #0f0f0f;
    }
    .brand {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.01em;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--card-border);
    }
    nav { display: flex; flex-direction: column; gap: 4px; }
    .nav-item {
      padding: 8px 12px;
      border-radius: 6px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 14px;
    }
    .nav-item.active {
      background: var(--card-border);
      color: var(--text);
      font-weight: 500;
    }
    main {
      flex: 1;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 1200px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    h1 { font-size: 20px; font-weight: 600; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .card-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .card-value {
      font-size: 24px;
      font-weight: 600;
      font-family: var(--font-mono);
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      background: #1e3a8a;
      color: #93c5fd;
      width: fit-content;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 8px;
    }
    th, td {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid var(--card-border);
    }
    th { color: var(--text-muted); font-weight: 500; }
    @media (max-width: 639px) {
      body { flex-direction: column; }
      aside { width: 100%; min-width: 100%; border-right: none; border-bottom: 1px solid var(--card-border); }
    }
  </style>
</head>
<body>
  <aside>
    <div class="brand">Reference Dashboard</div>
    <nav>
      <a href="#" class="nav-item active">Status</a>
      <a href="#" class="nav-item">Models</a>
      <a href="#" class="nav-item">Sessions</a>
      <a href="#" class="nav-item">Resources</a>
      <a href="#" class="nav-item">Config</a>
      <a href="#" class="nav-item">Licenses</a>
    </nav>
  </aside>
  <main>
    <div class="header">
      <h1>Runtime Overview</h1>
      <span class="badge">Healthy · Port 8899</span>
    </div>
    <div class="grid">
      <div class="card">
        <div class="card-title">Active Model</div>
        <div class="card-value" style="font-size: 18px;">Qwen3-0.6B-Q8</div>
        <div style="font-size: 12px; color: var(--text-muted);">Local CPU · 2048 ctx</div>
      </div>
      <div class="card">
        <div class="card-title">Memory (RSS)</div>
        <div class="card-value">450 MB</div>
        <div style="font-size: 12px; color: var(--text-muted);">Resident Engine Allocated</div>
      </div>
      <div class="card">
        <div class="card-title">Network Egress</div>
        <div class="card-value" style="color: #4ade80;">DENIED</div>
        <div style="font-size: 12px; color: var(--text-muted);">Default-Deny Enforced</div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Registered Models</div>
      <table>
        <thead>
          <tr><th>ID</th><th>Name</th><th>Fit Estimate</th><th>License</th></tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-family: var(--font-mono);">chat-tiny-q8</td>
            <td>Qwen3-0.6B-Q8 (Local CPU)</td>
            <td>Fits in 8GB RAM</td>
            <td>Apache-2.0</td>
          </tr>
          <tr>
            <td style="font-family: var(--font-mono);">embed-small-q8</td>
            <td>Qwen3-Embedding-0.6B</td>
            <td>Embedding index</td>
            <td>Apache-2.0</td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
  <script src="/mock_electron_bridge.js"></script>
</body>
</html>
"""

CHAT_HTML = """<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hermes Reference Chat</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --card-bg: #141414;
      --card-border: #262626;
      --text: #ededed;
      --text-muted: #a1a1aa;
      --accent: #2563eb;
      --user-bubble: #1f2937;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      height: 100vh;
      display: flex;
      overflow: hidden;
    }
    aside {
      width: 237px;
      min-width: 237px;
      border-right: 1px solid var(--card-border);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #0f0f0f;
    }
    .new-btn {
      background: var(--card-border);
      color: var(--text);
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
    }
    .section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-top: 8px;
    }
    .session-list { display: flex; flex-direction: column; gap: 2px; }
    .session-item {
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 13px;
      color: var(--text-muted);
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .session-item.active { background: #1a1a1a; color: var(--text); }
    .workspace {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .top-bar {
      height: 44px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      font-size: 13px;
    }
    .model-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 4px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      font-size: 12px;
    }
    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      align-items: center;
    }
    .messages-inner {
      width: 100%;
      max-width: 720px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .message-user {
      align-self: flex-end;
      background: var(--user-bubble);
      padding: 10px 14px;
      border-radius: 12px;
      max-width: 80%;
      font-size: 14px;
      line-height: 1.5;
    }
    .message-assistant {
      align-self: flex-start;
      width: 100%;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text);
    }
    .composer-area {
      padding: 16px 24px;
      display: flex;
      justify-content: center;
    }
    .composer-box {
      width: 100%;
      max-width: 720px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .composer-input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text);
      font-size: 14px;
      outline: none;
    }
    .status-bar {
      height: 28px;
      border-top: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      font-size: 11px;
      color: var(--text-muted);
      background: #0d0d0d;
    }
    @media (max-width: 639px) {
      aside { display: none; }
    }
  </style>
</head>
<body>
  <aside>
    <button class="new-btn">+ New Session</button>
    <div class="section-title">Pinned</div>
    <div class="session-list">
      <div class="session-item active">Sanctum Architecture & Privacy</div>
    </div>
    <div class="section-title">Recent</div>
    <div class="session-list">
      <div class="session-item">Local RAG Retrieval Tuning</div>
      <div class="session-item">Memory & Engine Verification</div>
    </div>
  </aside>
  <div class="workspace">
    <div class="top-bar">
      <div style="font-weight: 500;">Sanctum Architecture & Privacy</div>
      <div class="model-badge">
        <span>Qwen3-0.6B-Q8</span>
        <span style="color: var(--text-muted);">2048 ctx</span>
      </div>
    </div>
    <div class="chat-container">
      <div class="messages-inner">
        <div class="message-user">How does Sanctum enforce offline privacy by construction?</div>
        <div class="message-assistant">
          Sanctum enforces default-deny network containment at the kernel boundary before launching any model worker or tool. Zero outbound sockets are permitted, and all model inference and retrieval occur on-device without remote telemetry.
        </div>
      </div>
    </div>
    <div class="composer-area">
      <div class="composer-box">
        <input class="composer-input" placeholder="Type a message or / for commands..." readonly value="" />
        <span style="font-size: 12px; color: var(--text-muted);">Enter ↵</span>
      </div>
    </div>
    <div class="status-bar">
      <div>Engine: Ready · 0 queued</div>
      <div>Egress: Denied · Offline Self-Test PASS</div>
    </div>
  </div>
  <script src="/mock_electron_bridge.js"></script>
</body>
</html>
"""


class ReferenceServerHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        url = self.path.split("?")[0]
        if url == "/mock_electron_bridge.js":
            bridge_path = REFERENCE_DIR / "mock_electron_bridge.js"
            data = bridge_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif url in ("/dashboard", "/dashboard/"):
            data = DASHBOARD_HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif url in ("/chat", "/chat/", "/"):
            data = CHAT_HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            super().do_GET()

    def log_message(self, format, *args):
        pass


def start_mock_gateway(port=8899):
    server = HTTPServer(("127.0.0.1", port), MockGatewayHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def start_reference_server(port=5174):
    server = HTTPServer(("127.0.0.1", port), ReferenceServerHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


if __name__ == "__main__":
    gw = start_mock_gateway(8899)
    ref = start_reference_server(5174)
    print("Reference server running on http://127.0.0.1:5174", flush=True)
    print("Mock gateway running on http://127.0.0.1:8899", flush=True)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
