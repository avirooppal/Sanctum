"""Run a hash-pinned local ASR profile against a local PCM WAV manifest."""

import argparse
import hashlib
import json
import sys
import time
import wave
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/speech"))
from sanctum_speech.backends.whisper_cpp import WhisperCppASR  # noqa: E402
from sanctum_speech.types import AudioBuffer  # noqa: E402

MANIFEST_SCHEMA = json.loads((ROOT / "docs/contracts/speech-benchmark.schema.json").read_text())
PROFILE_SCHEMA = json.loads((ROOT / "docs/contracts/speech-profile.schema.json").read_text())
MAX_AUDIO_BYTES = 64 * 1024 * 1024


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _local_audio(manifest_dir: Path, relative_path: str, expected_hash: str) -> AudioBuffer:
    path = (manifest_dir / relative_path).resolve(strict=True)
    if not path.is_relative_to(manifest_dir):
        raise ValueError("audio_path resolves outside the manifest directory")
    if not path.is_file() or path.stat().st_size > MAX_AUDIO_BYTES:
        raise ValueError("audio file must be regular and no larger than 64 MiB")
    if _sha256(path) != expected_hash:
        raise ValueError(f"audio SHA-256 mismatch: {relative_path}")
    try:
        with wave.open(str(path), "rb") as source:
            if source.getcomptype() != "NONE" or source.getsampwidth() != 2:
                raise ValueError("audio must be uncompressed PCM16 WAV")
            if source.getnchannels() != 1 or source.getframerate() != 16000:
                raise ValueError("audio must be mono 16 kHz WAV")
            frames = source.getnframes()
            if frames <= 0 or frames * 2 > MAX_AUDIO_BYTES:
                raise ValueError("audio frame count is empty or exceeds the size cap")
            pcm = source.readframes(frames)
    except (wave.Error, EOFError) as error:
        raise ValueError(f"invalid WAV audio: {relative_path}") from error
    return AudioBuffer(pcm_s16le=pcm, sample_rate=16000, channels=1)


def run_benchmark(manifest_path: Path, profile_path: Path, *, asr_factory=None) -> dict:
    manifest_path = manifest_path.resolve(strict=True)
    profile_path = profile_path.resolve(strict=True)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    Draft202012Validator(MANIFEST_SCHEMA).validate(manifest)
    Draft202012Validator(PROFILE_SCHEMA).validate(profile)
    if manifest["profile_id"] != profile["id"]:
        raise ValueError("manifest profile_id does not match selected profile")
    asr = (asr_factory or WhisperCppASR.from_profile)(profile)
    output = {
        key: manifest[key]
        for key in ("suite", "dataset_license", "profile_id", "hardware_tier", "wer_target")
    }
    output["records"] = []
    for record in manifest["records"]:
        audio = _local_audio(manifest_path.parent, record["audio_path"], record["audio_sha256"])
        started = time.perf_counter()
        transcript = asr.transcribe(audio, language=record["language"])
        elapsed = max(time.perf_counter() - started, 1e-9)
        output["records"].append(
            {
                "id": record["id"],
                "audio_sha256": record["audio_sha256"],
                "language": record["language"],
                "reference": record["reference"],
                "hypothesis": transcript.text,
                "audio_seconds": audio.duration_seconds,
                "asr_seconds": elapsed,
            }
        )
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = run_benchmark(args.manifest, args.profile)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(result['records'])} verified ASR records to {args.output}")


if __name__ == "__main__":
    main()
