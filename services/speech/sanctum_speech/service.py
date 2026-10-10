"""Contract-validated local file transcription orchestration."""

import json
from pathlib import Path

from jsonschema import Draft202012Validator, RefResolver

from .audio_io import MAX_WAV_BYTES, decode_pcm16_wav
from .pipeline import TranscriptionPipeline
from .responses import format_transcription

ROOT = Path(__file__).resolve().parents[3]
OPENAPI = json.loads((ROOT / "docs/contracts/speech.openapi.json").read_text(encoding="utf-8"))
REQUEST_SCHEMA = OPENAPI["components"]["schemas"]["TranscriptionRequest"]
REQUEST_VALIDATOR = Draft202012Validator(REQUEST_SCHEMA, resolver=RefResolver.from_schema(OPENAPI))


class TranscriptionService:
    def __init__(
        self,
        pipeline: TranscriptionPipeline,
        *,
        model_id: str,
        max_upload_bytes: int = MAX_WAV_BYTES,
    ):
        if not model_id:
            raise ValueError("model_id must identify a configured local profile")
        if type(max_upload_bytes) is not int or not 1 <= max_upload_bytes <= MAX_WAV_BYTES:
            raise ValueError("max_upload_bytes must be between 1 byte and 64 MiB")
        self.pipeline = pipeline
        self.model_id = model_id
        self.max_upload_bytes = max_upload_bytes

    def transcribe_upload(self, request: dict, audio_bytes: bytes) -> tuple[str, str | dict]:
        if not isinstance(request, dict):
            raise TypeError("request must be an object")
        REQUEST_VALIDATOR.validate({**request, "file": "<multipart audio upload>"})
        if request.get("model", self.model_id) != self.model_id:
            raise ValueError("requested model does not match the configured local profile")
        audio = decode_pcm16_wav(audio_bytes, max_bytes=self.max_upload_bytes)
        result = self.pipeline.transcribe(
            audio,
            language=request.get("language"),
            prompt=request.get("prompt"),
            diarize=request.get("diarize", False),
        )
        return format_transcription(result, request.get("response_format", "json"))
