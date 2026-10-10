"""Generate real local speech and record timings; does not measure physical playback."""

import argparse
import hashlib
import json
from pathlib import Path
import sys
import time
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/speech"))
from sanctum_speech.backends.flite import FliteTTS  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--text", required=True)
    parser.add_argument("--wav", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    profile = json.loads(args.profile.read_text())
    engine = FliteTTS.from_profile(profile)
    start = time.perf_counter()
    audio = engine.synthesize(args.text, voice=args.voice)
    elapsed = time.perf_counter() - start
    assert audio.pcm_s16le and any(audio.pcm_s16le), "TTS produced empty/silent PCM"
    with wave.open(str(args.wav), "wb") as output:
        output.setnchannels(audio.channels)
        output.setsampwidth(2)
        output.setframerate(audio.sample_rate)
        output.writeframes(audio.pcm_s16le)
    record = {
        "suite": "real-file-tts-smoke",
        "profile": profile,
        "text": args.text,
        "voice": args.voice,
        "sample_rate": audio.sample_rate,
        "channels": audio.channels,
        "audio_seconds": audio.duration_seconds,
        "synthesis_seconds": elapsed,
        "wav_sha256": hashlib.sha256(args.wav.read_bytes()).hexdigest(),
        "physical_playback_verified": False,
        "voice_turn_latency_verified": False,
    }
    args.output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
