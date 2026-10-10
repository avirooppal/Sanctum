"""Measure a real pinned local file-VAD adapter and its silence behavior."""

import argparse
import hashlib
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/speech"))
from sanctum_speech.audio_io import decode_pcm16_wav  # noqa: E402
from sanctum_speech.backends.silero_cpp import SileroCppVAD  # noqa: E402
from sanctum_speech.types import AudioBuffer  # noqa: E402
from jsonschema import Draft202012Validator  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    profile = json.loads(args.profile.read_text())
    Draft202012Validator(
        json.loads((ROOT / "docs/contracts/speech-profile.schema.json").read_text())
    ).validate(profile)
    with args.audio.open("rb") as source:
        raw = source.read(64 * 1024 * 1024 + 1)
    audio = decode_pcm16_wav(raw)
    detector = SileroCppVAD.from_profile(profile)
    started = time.perf_counter()
    intervals = detector.speech_intervals(audio)
    elapsed = time.perf_counter() - started
    silence = detector.speech_intervals(AudioBuffer(b"\0\0" * 16000, 16000))
    assert not silence, "VAD classified digital silence as speech"
    assert intervals, "speech fixture produced no intervals"
    record = {
        "suite": "real-file-vad-smoke",
        "profile": profile,
        "audio_sha256": hashlib.sha256(raw).hexdigest(),
        "audio_seconds": audio.duration_seconds,
        "vad_seconds": elapsed,
        "intervals": [{"start": i.start, "end": i.end} for i in intervals],
        "silence_intervals": len(silence),
        "streaming_latency_verified": False,
    }
    args.output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
