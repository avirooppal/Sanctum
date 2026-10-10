"""Silero file VAD through a pinned local whisper.cpp executable."""

from pathlib import Path
import re
import subprocess
import tempfile
import wave

from .whisper_cpp import sha256_file
from ..types import AudioBuffer, AudioInterval


class SileroCppVAD:
    def __init__(
        self,
        executable: Path,
        model: Path,
        *,
        threads=1,
        timeout_seconds=20,
        run_process=subprocess.run,
    ):
        self.executable = executable
        self.model = model
        self.threads = threads
        self.timeout_seconds = timeout_seconds
        self.run_process = run_process

    @classmethod
    def from_profile(cls, profile: dict):
        if (
            profile.get("egress") != "denied"
            or profile.get("vad", {}).get("engine") != "silero.cpp"
        ):
            raise ValueError("a denied-egress silero.cpp profile is required")
        config = profile["vad"]
        executable, model = Path(config["executable_path"]), Path(config["model_path"])
        for path, expected in [
            (executable, config["executable_sha256"]),
            (model, config["model_sha256"]),
        ]:
            if not path.is_file() or sha256_file(path) != expected:
                raise ValueError("VAD artifact does not match its pinned hash")
        return cls(
            executable.resolve(),
            model.resolve(),
            threads=config["threads"],
            timeout_seconds=config["timeout_seconds"],
        )

    def speech_intervals(self, audio: AudioBuffer) -> tuple[AudioInterval, ...]:
        if audio.channels != 1 or audio.sample_rate != 16000:
            raise ValueError("Silero VAD requires mono 16 kHz PCM")
        if not audio.pcm_s16le or len(audio.pcm_s16le) > 64 * 1024 * 1024:
            raise ValueError("VAD audio must be nonempty and at most 64 MiB")
        with tempfile.TemporaryDirectory(prefix="sanctum-vad-") as directory:
            wav = Path(directory) / "input.wav"
            with wave.open(str(wav), "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(16000)
                output.writeframes(audio.pcm_s16le)
            result = self.run_process(
                [
                    str(self.executable),
                    "--vad-model",
                    str(self.model),
                    "--file",
                    str(wav),
                    "--no-prints",
                    "-t",
                    str(self.threads),
                ],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                check=True,
                timeout=self.timeout_seconds,
                shell=False,
            )
        lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        header = re.fullmatch(r"Detected ([0-9]+) speech segments:", lines[0]) if lines else None
        if header is None or int(header[1]) != len(lines) - 1:
            raise ValueError("invalid VAD segment count")
        intervals = []
        previous = 0.0
        for index, line in enumerate(lines[1:]):
            match = re.fullmatch(
                r"Speech segment ([0-9]+): start = ([0-9.]+), end = ([0-9.]+)", line
            )
            if match is None or int(match[1]) != index:
                raise ValueError("invalid VAD segment")
            start, end = float(match[2]) / 100, float(match[3]) / 100
            if start < previous or end > audio.duration_seconds + 0.01:
                raise ValueError("VAD segments overlap or exceed audio")
            interval = AudioInterval(start, min(end, audio.duration_seconds))
            intervals.append(interval)
            previous = interval.end
        return tuple(intervals)
