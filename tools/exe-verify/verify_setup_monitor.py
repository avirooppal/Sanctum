"""Verify real desktop setup, system measurements and logs using an isolated profile.
No existing model installations or user conversations are removed.
"""
import json
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.request
import urllib.error
from pathlib import Path

exe = Path('deploy/installer/build_payload/Sanctum-Desktop.exe').resolve()
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
token = secrets.token_hex(16)
base = f'http://127.0.0.1:{port}'
def call(path, method='GET', authenticated=True):
    req = urllib.request.Request(base + path, method=method, headers={'X-Sanctum-Auth': token} if authenticated else {})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)
with tempfile.TemporaryDirectory(prefix='sanctum-setup-test-') as profile:
    process = subprocess.Popen([str(exe), '--headless', '--port', str(port), '--auth-token', token, '--data-dir', profile], creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        for _ in range(100):
            try:
                if call('/health')['status'] == 'ok': break
            except urllib.error.URLError: time.sleep(.1)
        for path in ['/api/setup', '/api/system', '/api/logs']:
            try:
                call(path, authenticated=False)
                raise AssertionError('Unauthenticated request accepted')
            except urllib.error.HTTPError as error: assert error.code == 401
        call('/api/setup/start', 'POST')
        for _ in range(240):
            status = call('/api/setup')
            if not status['busy']: break
            time.sleep(1)
        assert status['phase'] == 'ready', status
        assert status['model'], status
        print('PASS automatic setup verifies a real chat model:', status['model'], flush=True)
        call('/api/system')
        time.sleep(2.2)
        system = call('/api/system')
        assert system['ramTotalGB'] > 0 and 0 < system['ramUsedGB'] <= system['ramTotalGB'], system
        assert system['logicalCores'] > 0 and 0 <= system['cpuPercent'] <= 100, system
        assert system['diskFreeGB'] > 0 and system['appMemoryMB'] > 0 and system['engineOnline'], system
        assert system['gpuTemperature'] is None and system['gpuUtilization'] is None
        print('PASS real CPU/RAM/disk/uptime/process/engine readings; unavailable sensors remain null', flush=True)
        logs = call('/api/logs')
        assert any(e['category'] == 'startup' for e in logs['entries']), logs
        assert any('Setup verified' in e['message'] for e in logs['entries']), logs
        assert not any(token in e['message'] for e in logs['entries'])
        assert Path(logs['path']).is_file()
        call('/api/logs', 'DELETE')
        assert call('/api/logs')['entries'] == []
        print('PASS persistent local logs, real clearing, protected API endpoints', flush=True)
    finally:
        process.terminate()
        process.wait(timeout=15)
