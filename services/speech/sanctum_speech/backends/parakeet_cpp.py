"""Local Parakeet CLI adapter with explicit coarse transcript timestamps."""

from pathlib import Path
import subprocess
import tempfile
import wave

from .whisper_cpp import sha256_file
from ..types import AudioBuffer, TranscriptSegment, TranscriptionResult


class ParakeetCppASR:
    def __init__(
        self,
        executable: Path,
        model: Path,
        *,
        threads=1,
        timeout_seconds=120,
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
            or profile.get("asr", {}).get("engine") != "parakeet.cpp"
        ):
            raise ValueError("a denied-egress parakeet.cpp profile is required")
        config = profile["asr"]
        executable, model = Path(config["executable_path"]), Path(config["model_path"])
        for path, expected in [
            (executable, config["executable_sha256"]),
            (model, config["model_sha256"]),
        ]:
            if not path.is_file() or sha256_file(path) != expected:
                raise ValueError("ASR artifact does not match its pinned hash")
        return cls(
            executable.resolve(),
            model.resolve(),
            threads=config["threads"],
            timeout_seconds=config.get("timeout_seconds", 120),
        )

    def transcribe(self, audio: AudioBuffer, *, language=None, prompt=None) -> TranscriptionResult:
        if prompt:
            raise ValueError("this Parakeet backend does not support vocabulary prompts")
        if audio.channels != 1 or audio.sample_rate != 16000 or not audio.pcm_s16le:
            raise ValueError("Parakeet requires nonempty mono 16 kHz PCM")
        if len(audio.pcm_s16le) > 64 * 1024 * 1024:
            raise ValueError("audio exceeds the 64 MiB limit")
        with tempfile.TemporaryDirectory(prefix="sanctum-parakeet-") as directory:
            wav, output = Path(directory) / "input.wav", Path(directory) / "transcript"
            with wave.open(str(wav), "wb") as container:
                container.setnchannels(1)
                container.setsampwidth(2)
                container.setframerate(16000)
                container.writeframes(audio.pcm_s16le)
            self.run_process(
                [
                    str(self.executable),
                    "--model",
                    str(self.model),
                    "--file",
                    str(wav),
                    "--threads",
                    str(self.threads),
                    "--no-gpu",
                    "--no-prints",
                    "--output-txt",
                    "--output-file",
                    str(output),
                ],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                check=True,
                timeout=self.timeout_seconds,
                shell=False,
            )
            with output.with_suffix(".txt").open("rb") as source:
                raw = source.read(1024 * 1024 + 1)
            if len(raw) > 1024 * 1024:
                raise ValueError("transcription exceeds output limit")
            text = raw.decode("utf-8").strip()
        segments = (TranscriptSegment(0, audio.duration_seconds, text),) if text else ()
        return TranscriptionResult(text, segments, language=None, duration=audio.duration_seconds)
