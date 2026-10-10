"""Local push-to-talk dictation handler for the versioned realtime event contract."""

import json
from pathlib import Path

from jsonschema import Draft202012Validator, RefResolver

from .realtime import RealtimeAudioBuffer

ROOT = Path(__file__).resolve().parents[3]
OPENAPI = json.loads((ROOT / "docs/contracts/speech.openapi.json").read_text(encoding="utf-8"))
STREAM_SCHEMA = json.loads(
    (ROOT / "docs/contracts/speech-stream.schema.json").read_text(encoding="utf-8")
)
CONTEXT_SCHEMA = OPENAPI["components"]["schemas"]["RequestContext"]


class RealtimeDictationSession:
    def __init__(
        self,
        asr_engine,
        *,
        context: dict,
        language: str | None = None,
        prompt: str | None = None,
        max_audio_bytes: int = 25 * 1024 * 1024,
    ):
        Draft202012Validator(CONTEXT_SCHEMA, resolver=RefResolver.from_schema(OPENAPI)).validate(
            context
        )
        self.asr_engine = asr_engine
        self.context = context.copy()
        self.language = language
        self.prompt = prompt
        self.buffer = RealtimeAudioBuffer(max_bytes=max_audio_bytes)
        self._event_validator = Draft202012Validator(STREAM_SCHEMA)

    @property
    def buffered_bytes(self) -> int:
        return self.buffer.buffered_bytes

    def handle(self, event: dict) -> dict | None:
        self._event_validator.validate(event)
        event_type = event["type"]
        if event_type == "input_audio_buffer.append":
            self.buffer.append(
                event["audio"],
                sample_rate=event["sample_rate"],
                channels=event.get("channels", 1),
            )
            return None
        if event_type == "input_audio_buffer.commit":
            audio = self.buffer.commit()
            result = self.asr_engine.transcribe(audio, language=self.language, prompt=self.prompt)
            return {
                "type": "transcript.delta",
                "text": result.text,
                "final": True,
                "start": 0,
                "end": audio.duration_seconds,
            }
        if event_type == "response.cancel":
            self.buffer.clear()
            return None
        raise ValueError("dictation session accepts audio append, commit, or cancellation events")
