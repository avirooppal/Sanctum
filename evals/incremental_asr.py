"""Measure real bounded prefix ASR on a verified local WAV in kernel isolation."""

import argparse
import hashlib
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/speech"))
sys.path.insert(0, str(ROOT / "tools"))
from isolated_run import self_test  # noqa: E402
from sanctum_speech.audio_io import decode_pcm16_wav  # noqa: E402
from sanctum_speech.backends.factory import load_asr  # noqa: E402
from sanctum_speech.incremental import IncrementalASR  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--wav", type=Path, required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    self_test()
    if args.wav.stat().st_size > 1024 * 1024:
        raise ValueError("fixture too large")
    data = args.wav.read_bytes()
    if hashlib.sha256(data).hexdigest() != args.sha256:
        raise ValueError("fixture hash mismatch")
    audio = decode_pcm16_wav(data)
    profile = json.loads(args.profile.read_text())
    session = IncrementalASR(load_asr(profile))
    records = []
    for offset in range(0, len(audio.pcm_s16le), 32000):
        start = time.perf_counter()
        result = session.append(audio.pcm_s16le[offset : offset + 32000])
        if result is not None:
            records.append(dict(result, compute_seconds=time.perf_counter() - start))
    start = time.perf_counter()
    final = session.finish()
    records.append(dict(final, compute_seconds=time.perf_counter() - start))
    output = {
        "suite": "isolated-incremental-asr",
        "profile": profile["id"],
        "audio_sha256": args.sha256,
        "records": records,
        "egress_denial_probes": 4,
        "delivery": "file-fed 1-second chunks; no realtime pacing",
        "voice_slo_verified": False,
    }
    args.output.write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
