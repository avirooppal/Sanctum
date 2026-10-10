"""Whisper.cpp CLI adapter; executable and model must be verified local artifacts."""

import json
import hashlib
from pathlib import Path
import subprocess
import tempfile
from typing import Callable
import wave

from sanctum_speech.types import AudioBuffer, TranscriptSegment, TranscriptionResult


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class WhisperCppASR:
    def __init__(
        self,
        executable_path: str | Path,
        model_path: str | Path,
        *,
        threads: int = 1,
        timeout_seconds: int = 1800,
        run_process: Callable = subprocess.run,
    ):
        self.executable_path = Path(executable_path)
        self.model_path = Path(model_path)
        self.threads = threads
        self.timeout_seconds = timeout_seconds
        self._run_process = run_process

    @classmethod
    def from_profile(cls, profile: dict, *, run_process: Callable = subprocess.run):
        if profile.get("egress") != "denied":
            raise ValueError("speech profile must explicitly deny egress")
        config = profile["asr"]
        if config.get("engine") != "whisper.cpp":
            raise ValueError("ASR engine is not supported by this adapter")
        executable_path = Path(config["executable_path"]).expanduser()
        model_path = Path(config["model_path"]).expanduser()
        if not executable_path.is_file():
            raise ValueError("ASR executable_path must be an existing local file")
        if not model_path.is_file():
            raise ValueError("ASR model_path must be an existing local file")
        if sha256_file(executable_path) != config["executable_sha256"]:
            raise ValueError("ASR executable SHA-256 does not match the profile")
        if sha256_file(model_path) != config["model_sha256"]:
            raise ValueError("ASR model SHA-256 does not match the profile")
        return cls(
            executable_path.resolve(),
            model_path.resolve(),
            threads=config["threads"],
            timeout_seconds=config.get("timeout_seconds", 1800),
            run_process=run_process,
        )

    def transcribe(
        self, audio: AudioBuffer, *, language: str | None = None, prompt: str | None = None
    ) -> TranscriptionResult:
        if not isinstance(audio, AudioBuffer):
            raise TypeError("audio must be an AudioBuffer")
        if audio.channels != 1 or audio.sample_rate != 16000:
            raise ValueError("whisper.cpp adapter requires mono 16 kHz PCM audio")

        with tempfile.TemporaryDirectory(prefix="sanctum-speech-") as directory:
            workdir = Path(directory)
            audio_path = workdir / "input.wav"
            output_prefix = workdir / "transcript"
            with wave.open(str(audio_path), "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(16000)
                wav_file.writeframes(audio.pcm_s16le)

            command = [
                str(self.executable_path),
                "-m",
                str(self.model_path),
                "-f",
                str(audio_path),
                "-oj",
                "-of",
                str(output_prefix),
                "-np",
                "-t",
                str(self.threads),
            ]
            if language:
                command.extend(("-l", language))
            if prompt:
                command.extend(("--prompt", prompt))
            self._run_process(
                command,
                cwd=workdir,
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                check=True,
                timeout=self.timeout_seconds,
                shell=False,
            )
            document = json.loads((workdir / "transcript.json").read_text(encoding="utf-8"))

        segments = tuple(
            TranscriptSegment(
                start=segment["offsets"]["from"] / 1000,
                end=segment["offsets"]["to"] / 1000,
                text=segment["text"].strip(),
            )
            for segment in document["transcription"]
            if segment["text"].strip()
        )
        return TranscriptionResult(
            text=" ".join(segment.text for segment in segments),
            segments=segments,
            language=document.get("result", {}).get("language", language),
            duration=audio.duration_seconds,
        )
