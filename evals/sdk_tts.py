"""Real official-SDK TTS integration against a confined local gateway."""

import argparse
import hashlib
from io import BytesIO
import json
from pathlib import Path
import time
from urllib.parse import urlsplit
import wave

import httpx2
from openai import APIStatusError, AuthenticationError, BadRequestError, OpenAI


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8766/v1")
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    url = urlsplit(args.base_url)
    if url.scheme != "http" or url.hostname != "127.0.0.1" or url.path != "/v1":
        raise ValueError("SDK smoke must use the local gateway")
    with OpenAI(
        base_url=args.base_url,
        api_key=args.token_file.read_text().strip(),
        max_retries=0,
        http_client=httpx2.Client(trust_env=False, timeout=170),
    ) as client:
        request = {
            "model": args.model,
            "voice": args.voice,
            "input": "Sanctum keeps your conversations on this machine.",
            "response_format": "wav",
        }
        started = time.perf_counter()
        wav = client.audio.speech.create(**request).read()
        elapsed = time.perf_counter() - started
        with wave.open(BytesIO(wav)) as audio:
            assert audio.getnchannels() == 1 and audio.getsampwidth() == 2
            assert audio.getframerate() == 16000
            seconds = audio.getnframes() / audio.getframerate()
            samples = audio.readframes(audio.getnframes())
            assert seconds > 0 and any(samples)
        passed = ["wav"]
        pcm = client.audio.speech.create(**{**request, "response_format": "pcm"}).read()
        assert pcm == samples
        passed.append("pcm")
        for name, changes in [
            ("unknown_model", {"model": "not-configured"}),
            ("unknown_voice", {"voice": "not-configured"}),
            ("workspace_spoof", {"extra_body": {"context": {"workspace_id": "other"}}}),
            ("unsupported_format", {"response_format": "mp3"}),
        ]:
            try:
                client.audio.speech.create(**{**request, **changes})
            except BadRequestError:
                passed.append(name)
            else:
                raise AssertionError(f"{name} was accepted")
        try:
            client.audio.speech.create(**{**request, "input": "x" * 70000})
        except APIStatusError as error:
            assert error.status_code == 413
            passed.append("body_limit")
        else:
            raise AssertionError("oversized request accepted")
        try:
            client.with_options(api_key="wrong").audio.speech.create(**request)
        except AuthenticationError:
            passed.append("authentication")
        else:
            raise AssertionError("unauthenticated synthesis accepted")
    record = {
        "suite": "real-openai-sdk-tts",
        "passed": passed,
        "model": args.model,
        "voice": args.voice,
        "audio_seconds": seconds,
        "first_request_seconds": elapsed,
        "wav_sha256": hashlib.sha256(wav).hexdigest(),
        "physical_playback_verified": False,
        "voice_turn_slo_verified": False,
    }
    args.output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
