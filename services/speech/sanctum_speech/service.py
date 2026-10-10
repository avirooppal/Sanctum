"""Contract-validated local file transcription orchestration."""

import json
from io import BytesIO
from pathlib import Path
import wave

from jsonschema import Draft202012Validator, RefResolver, ValidationError

from .audio_io import MAX_WAV_BYTES, decode_pcm16_wav
from .pipeline import TranscriptionPipeline
from .responses import format_transcription
from .types import AudioBuffer

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


SPEECH_REQUEST_SCHEMA = OPENAPI["components"]["schemas"]["SpeechRequest"]
SPEECH_REQUEST_VALIDATOR = Draft202012Validator(
    SPEECH_REQUEST_SCHEMA, resolver=RefResolver.from_schema(OPENAPI)
)
REGISTRY_SCHEMA = json.loads(
    (ROOT / "docs/contracts/registry.schema.json").read_text(encoding="utf-8")
)


class SpeechSynthesisService:
    def __init__(
        self,
        engine,
        *,
        model_id: str,
        voices: dict[str, dict],
        max_audio_bytes: int = MAX_WAV_BYTES,
    ):
        if not model_id:
            raise ValueError("model_id must identify a configured local TTS profile")
        if not voices:
            raise ValueError("at least one fully registered local voice is required")
        for voice_id, registry_entry in voices.items():
            if not voice_id or not isinstance(registry_entry, dict):
                raise ValueError("voice entries must be keyed by a non-empty local ID")
            registry_document = {
                "schema_version": "1.0",
                "models": [registry_entry],
                "dependencies": [],
            }
            try:
                Draft202012Validator(REGISTRY_SCHEMA).validate(registry_document)
            except ValidationError as error:
                raise ValueError(
                    "voice does not satisfy the permissive model registry contract"
                ) from error
            if registry_entry["id"] != voice_id:
                raise ValueError("voice registry key must match the registered model ID")
            if "tts" not in registry_entry["capabilities"]:
                raise ValueError("registered voice must declare the tts capability")
        if type(max_audio_bytes) is not int or not 1 <= max_audio_bytes <= MAX_WAV_BYTES:
            raise ValueError("max_audio_bytes must be between 1 byte and 64 MiB")
        self.engine = engine
        self.model_id = model_id
        self.voices = json.loads(json.dumps(voices))
        self.max_audio_bytes = max_audio_bytes

    def synthesize(self, request: dict) -> tuple[str, bytes]:
        if not isinstance(request, dict):
            raise TypeError("request must be an object")
        SPEECH_REQUEST_VALIDATOR.validate(request)
        if request["model"] != self.model_id:
            raise ValueError("requested model does not match the configured local TTS profile")
        if request["voice"] not in self.voices:
            raise ValueError("requested voice is not configured locally")
        audio = self.engine.synthesize(
            request["input"], voice=request["voice"], speed=request.get("speed", 1.0)
        )
        if not isinstance(audio, AudioBuffer):
            raise TypeError("TTS engine must return AudioBuffer")
        if len(audio.pcm_s16le) > self.max_audio_bytes:
            raise ValueError("generated audio exceeds the configured byte limit")
        response_format = request.get("response_format", "wav")
        if response_format == "pcm":
            return "audio/pcm", audio.pcm_s16le
        if response_format != "wav":
            raise ValueError("response_format must be wav or pcm")
        container = BytesIO()
        with wave.open(container, "wb") as output:
            output.setnchannels(audio.channels)
            output.setsampwidth(2)
            output.setframerate(audio.sample_rate)
            output.writeframes(audio.pcm_s16le)
        encoded = container.getvalue()
        if len(encoded) > self.max_audio_bytes:
            raise ValueError("generated WAV exceeds the configured byte limit")
        return "audio/wav", encoded
