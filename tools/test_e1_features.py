import subprocess
import time
import urllib.request
import json
import sys
import os

def test_features():
    exe = os.path.abspath("deploy/installer/build_payload/Sanctum-Desktop.exe")
    if not os.path.exists(exe):
        print(f"Executable not found: {exe}")
        sys.exit(1)

    print("Launching Sanctum-Desktop in headless mode on port 1341...")
    proc = subprocess.Popen([exe, "--headless", "--port", "1341"])
    time.sleep(2)

    try:
        # 1. Health
        with urllib.request.urlopen("http://127.0.0.1:1341/api/health", timeout=5) as r:
            health = json.loads(r.read().decode())
            assert health.get("status") == "ok", f"Health failed: {health}"
            print("[OK] Health endpoint OK:", health)

        # 2. Capabilities
        with urllib.request.urlopen("http://127.0.0.1:1341/api/capability", timeout=5) as r:
            caps = json.loads(r.read().decode())
            capabilities = caps.get("capabilities", [])
            assert "assistants" in capabilities and "mcp" in capabilities and "models" in capabilities
            print(f"[OK] Capabilities endpoint OK ({len(capabilities)} capabilities: {capabilities})")

        # 3. Initial models list
        with urllib.request.urlopen("http://127.0.0.1:1341/v1/models", timeout=5) as r:
            models = json.loads(r.read().decode())
            print(f"[OK] Initial models list OK: {models}")

        # 4. Import GGUF Model
        dummy_model_bytes = b"GGUF\x03\x00\x00\x00mock-model-weights"
        import_req = urllib.request.Request(
            "http://127.0.0.1:1341/api/models/import-gguf",
            data=dummy_model_bytes,
            headers={"Content-Type": "application/octet-stream"},
            method="POST",
        )
        with urllib.request.urlopen(import_req, timeout=5) as r:
            imp_res = json.loads(r.read().decode())
            assert imp_res.get("id") == "imported-model.gguf"
            print("[OK] GGUF import endpoint OK:", imp_res)

        # 5. Check model listed after import
        with urllib.request.urlopen("http://127.0.0.1:1341/v1/models", timeout=5) as r:
            models_after = json.loads(r.read().decode())
            found = any(m.get("id") == "imported-model.gguf" for m in models_after.get("data", []))
            assert found, f"Imported model not found in models list: {models_after}"
            print("[OK] Models list contains imported-model.gguf OK")

        # 6. Chat completions SSE stream
        chat_payload = json.dumps({
            "model": "imported-model.gguf",
            "messages": [{"role": "user", "content": "Hello Sanctum!"}],
            "stream": True,
        }).encode("utf-8")
        chat_req = urllib.request.Request(
            "http://127.0.0.1:1341/v1/chat/completions",
            data=chat_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(chat_req, timeout=5) as r:
            stream_body = r.read().decode("utf-8")
            assert "data: " in stream_body
            assert "data: [DONE]" in stream_body
            print("[OK] Chat completions SSE streaming OK (received tokens + [DONE])")

        # 7. Non-streaming Chat completion
        chat_sync_payload = json.dumps({
            "model": "imported-model.gguf",
            "messages": [{"role": "user", "content": "Ping"}],
            "stream": False,
        }).encode("utf-8")
        chat_sync_req = urllib.request.Request(
            "http://127.0.0.1:1341/v1/chat/completions",
            data=chat_sync_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(chat_sync_req, timeout=5) as r:
            sync_res = json.loads(r.read().decode("utf-8"))
            assert len(sync_res.get("choices", [])) > 0
            print("[OK] Non-streaming chat completion OK:", sync_res["choices"][0]["message"]["content"])

        # 8. Assistant profiles GET / POST
        prof_payload = json.dumps({
            "operation": "save",
            "name": "E1 Partner",
            "system_prompt": "You are pair programming with the user.",
            "scope": "user",
        }).encode("utf-8")
        prof_req = urllib.request.Request(
            "http://127.0.0.1:1341/v1/profiles",
            data=prof_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(prof_req, timeout=5) as r:
            prof_res = json.loads(r.read().decode("utf-8"))
            assert "id" in prof_res
            print("[OK] Profiles save OK:", prof_res)

        with urllib.request.urlopen("http://127.0.0.1:1341/v1/profiles", timeout=5) as r:
            profiles_list = json.loads(r.read().decode("utf-8"))
            assert "data" in profiles_list
            print(f"[OK] Profiles list OK: {profiles_list}")

        print("\n=== ALL E1 FEATURES VERIFIED SUCCESSFULLY ===")

    finally:
        proc.terminate()
        proc.wait(timeout=5)

if __name__ == "__main__":
    test_features()
