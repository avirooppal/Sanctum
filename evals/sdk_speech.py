"""Real official-SDK file-ASR integration; requires a confined gateway and local WAV."""

import argparse
import hashlib
import json
from pathlib import Path
import time
from urllib.parse import urlsplit

from openai import AuthenticationError, BadRequestError, OpenAI


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8766/v1")
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    url = urlsplit(args.base_url)
    if url.scheme != "http" or url.hostname != "127.0.0.1" or url.path != "/v1":
        raise ValueError("SDK smoke must use the local gateway")
    # Disable environment proxies so credentials cannot be sent through a proxy.
    import httpx2

    audio = args.audio.read_bytes()
    client = OpenAI(
        base_url=args.base_url,
        api_key=args.token_file.read_text().strip(),
        max_retries=0,
        http_client=httpx2.Client(trust_env=False, timeout=170),
    )
    passed = []
    started = time.perf_counter()
    result = client.audio.transcriptions.create(model=args.model, file=("speech.wav", audio))
    elapsed = time.perf_counter() - started
    assert result.text.strip(), "real ASR returned no text"
    passed.append("json")
    for kind in ("text", "verbose_json", "vtt"):
        response = client.audio.transcriptions.create(
            model=args.model,
            file=("speech.wav", audio),
            response_format=kind,
        )
        if kind == "verbose_json":
            assert response.segments and response.duration > 0
        elif kind == "vtt":
            assert response.startswith("WEBVTT")
        else:
            assert response.strip()
        passed.append(kind)
    for name, options in [
        ("unknown_model", {"model": "not-configured", "file": ("speech.wav", audio)}),
        ("invalid_audio", {"model": args.model, "file": ("speech.wav", b"not-wav")}),
        (
            "workspace_spoof",
            {
                "model": args.model,
                "file": ("speech.wav", audio),
                "extra_body": {"context": json.dumps({"workspace_id": "other"})},
            },
        ),
    ]:
        try:
            client.audio.transcriptions.create(**options)
        except BadRequestError:
            passed.append(name)
        else:
            raise AssertionError(f"{name} was accepted")
    try:
        client.with_options(api_key="wrong").audio.transcriptions.create(
            model=args.model, file=("speech.wav", audio)
        )
    except AuthenticationError:
        passed.append("authentication")
    else:
        raise AssertionError("unauthenticated upload accepted")
    record = {
        "suite": "real-openai-sdk-speech",
        "passed": passed,
        "audio_sha256": hashlib.sha256(audio).hexdigest(),
        "model": args.model,
        "first_request_seconds": elapsed,
        "transcript": result.text,
        "voice_latency_verified": False,
    }
    args.output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, indent=2))
    client.close()


if __name__ == "__main__":
    main()
