"""Hash-pinned local Flite reference; no voice downloads or voice cloning."""

import json
import math
from pathlib import Path
import re
import subprocess
import tempfile

from jsonschema import Draft202012Validator

from .whisper_cpp import sha256_file
from ..audio_io import decode_pcm16_wav
from ..types import AudioBuffer

ROOT = Path(__file__).resolve().parents[4]


class FliteTTS:
    def __init__(
        self,
        executable: Path,
        voices: dict[str, str],
        *,
        timeout_seconds=120,
        run_process=subprocess.run,
    ):
        if not voices or any(
            re.fullmatch(r"[a-z][a-z0-9_]{0,63}", value) is None for value in voices.values()
        ):
            raise ValueError("only configured built-in voice names are supported")
        self.executable = executable
        self.voices = dict(voices)
        self.timeout_seconds = timeout_seconds
        self.run_process = run_process

    @classmethod
    def from_profile(cls, profile: dict):
        if profile.get("egress") != "denied":
            raise ValueError("TTS requires denied egress")
        schema = json.loads((ROOT / "docs/contracts/tts-profile-v1.schema.json").read_text())
        Draft202012Validator(schema).validate(profile)
        executable = Path(profile["executable_path"])
        if not executable.is_file() or sha256_file(executable) != profile["executable_sha256"]:
            raise ValueError("TTS executable hash mismatch")
        registry = json.loads((ROOT / "profiles/registry.json").read_text())
        entries = {entry["id"]: entry for entry in registry["models"]}
        for voice in profile["voices"]:
            entry = entries.get(voice)
            if (
                entry is None
                or entry["capabilities"] != ["tts"]
                or entry["sha256"] != profile["executable_sha256"]
            ):
                raise ValueError("built-in voice must match the registered artifact")
        return cls(
            executable.resolve(), profile["voices"], timeout_seconds=profile["timeout_seconds"]
        )

    def synthesize(
        self, text: str, *, voice: str, sample_rate: int = 16000, speed: float = 1.0
    ) -> AudioBuffer:
        if voice not in self.voices or sample_rate != 16000:
            raise ValueError("unsupported registered voice or sample rate")
        if not isinstance(text, str) or not text.strip() or len(text) > 10000 or "\0" in text:
            raise ValueError("invalid synthesis text")
        if not math.isfinite(speed) or not 0.5 <= speed <= 2:
            raise ValueError("speed must be between 0.5 and 2")
        with tempfile.TemporaryDirectory(prefix="sanctum-tts-") as directory:
            input_path, output_path = Path(directory) / "input.txt", Path(directory) / "output.wav"
            input_path.write_text(text, encoding="utf-8")
            self.run_process(
                [
                    str(self.executable),
                    "-voice",
                    self.voices[voice],
                    "--setf",
                    f"duration_stretch={1 / speed:g}",
                    "-f",
                    str(input_path),
                    "-o",
                    str(output_path),
                ],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                check=True,
                timeout=self.timeout_seconds,
                shell=False,
            )
            with output_path.open("rb") as source:
                raw = source.read(64 * 1024 * 1024 + 1)
            return decode_pcm16_wav(raw)
