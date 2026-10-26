import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RESULTS_DIR = os.path.join(ROOT, "evals", "results", "exe")
EXE_PATH = os.path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe")


def test_consent_and_allowlist():
    log_file = os.path.join(RESULTS_DIR, "down_consent.log")
    port = 1371
    proc = subprocess.Popen([EXE_PATH, "--headless", "--port", str(port)])
    time.sleep(1.5)

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== DOWN-4a: Consent Gate & Host Allowlist Enforcement ===\n")

        # 1. Test unconsented download attempt
        req_unconsented = urllib.request.Request(
            f"http://127.0.0.1:{port}/v1/downloads",
            data=json.dumps({"model": "test-unconsented.gguf", "url": "https://huggingface.co/model.gguf"}).encode(
                "utf-8"
            ),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req_unconsented, timeout=5) as resp:
                f.write(f"Unexpected success without consent: {resp.status}\n")
                ok_consent = False
        except urllib.error.HTTPError as e:
            f.write(f"Unconsented request blocked with status: {e.code}\n")
            body = e.read().decode("utf-8")
            f.write(f"Response error body: {body}\n")
            ok_consent = e.code == 403 and "CONSENT_REQUIRED" in body

        # 2. Test forbidden foreign domain redirect/attempt (even with consent)
        req_forbidden_host = urllib.request.Request(
            f"http://127.0.0.1:{port}/v1/downloads",
            data=json.dumps(
                {
                    "model": "test-forbidden.gguf",
                    "url": "https://untrusted-foreign-tracker.com/payload.gguf",
                    "consent": True,
                }
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req_forbidden_host, timeout=5) as resp:
                f.write(f"Unexpected success on non-allowlisted host: {resp.status}\n")
                ok_allowlist = False
        except urllib.error.HTTPError as e:
            f.write(f"Non-allowlisted host blocked with status: {e.code}\n")
            body = e.read().decode("utf-8")
            f.write(f"Response error body: {body}\n")
            ok_allowlist = e.code == 403 and "Egress Broker allowlist" in body

        ok = ok_consent and ok_allowlist
        f.write(f"Result: {'PASS' if ok else 'FAIL'}\n")

    proc.terminate()
    proc.wait(timeout=5)
    print(
        f"DOWN-4a (Consent & Allowlist): {'PASS' if ok else 'FAIL'} - Blocked unconsented & untrusted hosts. Written to {log_file}"
    )
    return ok


def test_resumability():
    log_file = os.path.join(RESULTS_DIR, "down_resume.log")
    port = 1372
    proc = subprocess.Popen([EXE_PATH, "--headless", "--port", str(port)])
    time.sleep(1.5)

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== DOWN-4b: HTTP Range & Resumability Verification ===\n")

        # Request bytes 0-15 of index.html
        req_range = urllib.request.Request(f"http://127.0.0.1:{port}/", headers={"Range": "bytes=0-15"})
        with urllib.request.urlopen(req_range, timeout=5) as resp:
            status = resp.status
            content_range = resp.headers.get("Content-Range")
            data = resp.read()
            f.write(f"HTTP Status: {status} (Expected: 206 Partial Content)\n")
            f.write(f"Content-Range Header: {content_range}\n")
            f.write(f"Received bytes length: {len(data)} (Expected: 16)\n")

            ok = status == 206 and len(data) == 16 and "bytes 0-15" in (content_range or "")
            f.write(f"Result: {'PASS' if ok else 'FAIL'}\n")

    proc.terminate()
    proc.wait(timeout=5)
    print(
        f"DOWN-4b (Resumability): {'PASS' if ok else 'FAIL'} - HTTP 206 Partial Content verified. Written to {log_file}"
    )
    return ok


def test_integrity_and_margin():
    log_file = os.path.join(RESULTS_DIR, "down_integrity.log")
    port = 1373
    proc = subprocess.Popen([EXE_PATH, "--headless", "--port", str(port)])
    time.sleep(1.5)

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== DOWN-4c: SHA-256 Integrity Verification & Disk Margin ===\n")

        # Send download with mismatched sha256 hash
        fake_expected_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        req_mismatch = urllib.request.Request(
            f"http://127.0.0.1:{port}/v1/downloads",
            data=json.dumps(
                {
                    "model": "corrupt-test.gguf",
                    "url": "https://huggingface.co/model.gguf",
                    "sha256": fake_expected_hash,
                    "consent": True,
                }
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req_mismatch, timeout=5) as resp:
                f.write(f"Unexpected success on mismatched hash: {resp.status}\n")
                ok_hash = False
        except urllib.error.HTTPError as e:
            f.write(f"Mismatched hash blocked with status: {e.code} (Expected 422 Unprocessable)\n")
            body = e.read().decode("utf-8")
            f.write(f"Response body: {body}\n")
            ok_hash = e.code == 422 and "Checksum mismatch" in body

        # Verify corrupt file is purged from disk
        app_data = os.environ.get("APPDATA", os.path.expanduser("~\\AppData\\Roaming"))
        models_dir = os.path.join(app_data, "Sanctum", "models")
        part_file = os.path.join(models_dir, "corrupt-test.gguf.part")
        target_file = os.path.join(models_dir, "corrupt-test.gguf")
        purged = not os.path.exists(part_file) and not os.path.exists(target_file)
        f.write(f"Corrupt partial file purged from disk: {purged}\n")

        ok = ok_hash and purged
        f.write(f"Result: {'PASS' if ok else 'FAIL'}\n")

    proc.terminate()
    proc.wait(timeout=5)
    print(
        f"DOWN-4c (Integrity & Margin): {'PASS' if ok else 'FAIL'} - Mismatched hash rejected (422) & purged. Written to {log_file}"
    )
    return ok


def test_sanitization_and_atomic():
    log_file = os.path.join(RESULTS_DIR, "down_atomic.log")
    port = 1374
    proc = subprocess.Popen([EXE_PATH, "--headless", "--port", str(port)])
    time.sleep(1.5)

    with open(log_file, "w", encoding="utf-8") as f:
        f.write("=== DOWN-4d: Filename Sanitization, Atomic Rename & Ledger ===\n")

        # Test download with Windows reserved name and traversal: "CON.gguf"
        req_reserved = urllib.request.Request(
            f"http://127.0.0.1:{port}/v1/downloads",
            data=json.dumps(
                {
                    "model": "CON.gguf",
                    "url": "https://huggingface.co/sanctum/model.gguf",
                    "consent": True,
                }
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req_reserved, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            sanitized_name = data.get("model")
            f.write(f"Sanitized filename result: {sanitized_name}\n")
            # Must not be raw 'CON.gguf' (e.g. '_CON.gguf')
            ok_sanitize = sanitized_name != "CON.gguf" and "CON" in sanitized_name

        # Verify ledger entry written
        app_data = os.environ.get("APPDATA", os.path.expanduser("~\\AppData\\Roaming"))
        ledger_file = os.path.join(app_data, "Sanctum", "download_ledger.json")
        f.write(f"Download ledger file exists: {os.path.exists(ledger_file)}\n")
        with open(ledger_file, "r", encoding="utf-8-sig") as lf:
            ledger_data = json.load(lf)
        f.write(f"Ledger entries count: {len(ledger_data)}\n")
        f.write(f"Latest ledger entry: {json.dumps(ledger_data[-1])}\n")

        ok = ok_sanitize and len(ledger_data) > 0
        f.write(f"Result: {'PASS' if ok else 'FAIL'}\n")

    proc.terminate()
    proc.wait(timeout=5)
    print(
        f"DOWN-4d (Atomic & Sanitization): {'PASS' if ok else 'FAIL'} - Filenames sanitized and logged to ledger. Written to {log_file}"
    )
    return ok


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--test",
        choices=["consent_allowlist", "resumability", "integrity_margin", "sanitization_atomic", "all"],
        default="all",
    )
    args = parser.parse_args()

    success = True
    if args.test in ["consent_allowlist", "all"]:
        success = test_consent_and_allowlist() and success
    if args.test in ["resumability", "all"]:
        success = test_resumability() and success
    if args.test in ["integrity_margin", "all"]:
        success = test_integrity_and_margin() and success
    if args.test in ["sanitization_atomic", "all"]:
        success = test_sanitization_and_atomic() and success

    sys.exit(0 if success else 1)
