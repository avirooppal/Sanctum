"""Exercise a new engine/model catalog without touching the user's running Ollama.
Copies already-downloaded immutable blobs to save bandwidth; the catalog starts
empty and Sanctum must pull the real registry manifest, verify, and run the model.
"""
import json
import os
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request
import urllib.error
from pathlib import Path

def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]
port, engine_port = free_port(), free_port()
token = secrets.token_hex(16)
source = Path.home() / '.ollama/models'
manifest = json.loads((source / 'manifests/registry.ollama.ai/library/qwen3/1.7b').read_text())
with tempfile.TemporaryDirectory(prefix='sanctum-first-model-') as directory:
    root = Path(directory)
    models = root / 'models'
    (models / 'blobs').mkdir(parents=True)
    for blob in [manifest['config'], *manifest['layers']]:
        name = blob['digest'].replace(':', '-')
        shutil.copyfile(source / 'blobs' / name, models / 'blobs' / name)
    env = dict(os.environ, OLLAMA_MODELS=str(models))
    process = subprocess.Popen([str(Path('deploy/installer/build_payload/Sanctum-Desktop.exe').resolve()), '--headless', '--port', str(port), '--engine-port', str(engine_port), '--data-dir', str(root/'profile'), '--auth-token', token], env=env, creationflags=subprocess.CREATE_NO_WINDOW)
    def call(path, method='GET'):
        req = urllib.request.Request(f'http://127.0.0.1:{port}' + path, method=method, headers={'X-Sanctum-Auth': token})
        with urllib.request.urlopen(req, timeout=45) as response: return json.load(response)
    try:
        for _ in range(100):
            try:
                call('/health'); break
            except urllib.error.URLError: time.sleep(.1)
        assert call('/api/ollama/models')['models'] == [], 'Catalog must start empty'
        print('PASS Sanctum automatically started a separate real Ollama with no installed models', flush=True)
        call('/api/setup/start', 'POST')
        call('/api/setup/cancel', 'POST')
        for _ in range(60):
            status = call('/api/setup')
            if not status['busy']: break
            time.sleep(.5)
        assert status['phase'] == 'cancelled', status
        print('PASS setup cancellation', flush=True)
        call('/api/setup/start', 'POST')
        seen = set()
        for _ in range(600):
            status = call('/api/setup')
            if status['phase'] not in seen:
                print(status['phase'], status['detail'], flush=True)
                seen.add(status['phase'])
            if not status['busy']: break
            time.sleep(1)
        assert status['phase'] == 'ready', status
        assert 'model' in seen and 'verifying' in seen
        assert (models/'manifests/registry.ollama.ai/library/qwen3/1.7b').exists()
        assert call('/api/ollama/models')['models'][0]['name'] == 'qwen3:1.7b'
        print('PASS first-model registry pull, local verification, inference, and retry after cancellation', flush=True)
    finally:
        process.terminate(); process.wait(timeout=15)
        time.sleep(2)
