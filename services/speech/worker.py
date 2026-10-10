"""One bounded file-ASR request under the Rust supervisor's inherited isolation."""

import base64
import json
from pathlib import Path
import signal
import sys

from jsonschema import Draft202012Validator, ValidationError

from sanctum_speech.backends.factory import load_asr
from sanctum_speech.backends.flite import FliteTTS
from sanctum_speech.backends.silero_cpp import SileroCppVAD
from sanctum_speech.multipart import MAX_UPLOAD, parse_upload
from sanctum_speech.pipeline import TranscriptionPipeline
from sanctum_speech.service import SpeechSynthesisService, TranscriptionService
from sanctum_speech.types import AudioInterval

ROOT = Path(__file__).resolve().parents[2]


class WholeFile:
    """Explicit no-VAD mode; not a voice activity detection algorithm."""

    def speech_intervals(self, audio):
        return (AudioInterval(0, audio.duration_seconds),)


def deadline(_signal, _frame):
    raise TimeoutError("speech deadline exceeded")


def require_isolation():
    if sys.platform != "linux":
        raise RuntimeError("Linux containment required")
    interfaces = [
        line.split(":")[0].strip()
        for line in Path("/proc/net/dev").read_text().splitlines()
        if ":" in line
    ]
    status = Path("/proc/self/status").read_text()
    if interfaces != ["lo"] or "Seccomp:\t2" not in status or "NoNewPrivs:\t1" not in status:
        raise RuntimeError("inherited containment required")


def authenticated_context(fields, trace_id):
    context = {
        "workspace_id": "solo",
        "data_class": "restricted",
        "trace_id": trace_id,
        "policy_context": {"cloud_enabled": False},
    }
    legacy_context = fields.pop("context", None)
    if legacy_context is not None:
        if not isinstance(legacy_context, dict):
            raise ValueError("invalid context")
        normalized = {**legacy_context, "trace_id": trace_id}
        if normalized != context:
            raise ValueError("context does not match the authenticated solo session")
    fields["context"] = context


def process_synthesis(profile, model_id, content_type, trace_id, body):
    if content_type.split(";")[0].strip() != "application/json" or len(body) > 65536:
        raise ValueError("invalid synthesis body")
    fields = json.loads(body)
    if not isinstance(fields, dict):
        raise ValueError("synthesis request must be an object")
    authenticated_context(fields, trace_id)
    if profile["id"] != model_id:
        raise ValueError("TTS model must match its profile")
    registry = json.loads((ROOT / "profiles/registry.json").read_text())
    voices = {
        entry["id"]: entry for entry in registry["models"] if entry["id"] in profile["voices"]
    }
    engine = FliteTTS.from_profile(profile)
    service = SpeechSynthesisService(
        engine, model_id=model_id, voices=voices, max_audio_bytes=1024 * 1024
    )
    kind, audio = service.synthesize(fields)
    return {
        "ok": True,
        "content_type": kind,
        "audio_base64": base64.b64encode(audio).decode("ascii"),
    }


def process(profile, model_id, content_type, trace_id, body):
    fields, audio = parse_upload(content_type, body)
    authenticated_context(fields, trace_id)
    schema = json.loads((ROOT / "docs/contracts/speech-profile.schema.json").read_text())
    Draft202012Validator(schema).validate(profile)
    registry = json.loads((ROOT / "profiles/registry.json").read_text())
    entry = next((item for item in registry["models"] if item["id"] == model_id), None)
    if (
        entry is None
        or "asr" not in entry["capabilities"]
        or entry["sha256"] != profile["asr"]["model_sha256"]
        or profile["id"] != model_id
    ):
        raise ValueError("ASR model must match the registry and profile")
    vad = profile["vad"]
    if vad["engine"] == "silero.cpp":
        vad_entry = next(
            (item for item in registry["models"] if item["id"] == vad["model_id"]), None
        )
        if (
            vad_entry is None
            or vad_entry["capabilities"] != ["vad"]
            or vad_entry["sha256"] != vad["model_sha256"]
        ):
            raise ValueError("VAD model must match the registry")
        detector = SileroCppVAD.from_profile(profile)
    elif vad["engine"] == "none":
        detector = WholeFile()
    else:
        raise ValueError("VAD engine is not implemented")
    if profile["asr"].get("timeout_seconds", 1800) > 120:
        raise ValueError("worker ASR deadline must not exceed 120 seconds")
    engine = load_asr(profile)
    service = TranscriptionService(
        TranscriptionPipeline(detector, engine), model_id=model_id, max_upload_bytes=MAX_UPLOAD
    )
    content_type, result = service.transcribe_upload(fields, audio)
    return {"ok": True, "content_type": content_type, "result": result}


def main():
    require_isolation()
    signal.signal(signal.SIGALRM, deadline)
    signal.alarm(150)
    try:
        profile_path, model_id, content_type, trace_id = sys.argv[1:5]
        operation = sys.argv[5] if len(sys.argv) == 6 else "transcribe"
        if len(sys.argv) not in (5, 6) or operation not in ("transcribe", "synthesize"):
            raise ValueError("invalid operation")
        limit = 65536 if operation == "synthesize" else MAX_UPLOAD
        body = sys.stdin.buffer.read(limit + 1)
        if len(body) > limit:
            result = {"ok": False, "status": 413, "error": "Upload too large"}
        else:
            profile = json.loads(Path(profile_path).read_text())
            handler = process_synthesis if operation == "synthesize" else process
            result = handler(profile, model_id, content_type, trace_id, body)
    except (ValueError, ValidationError):
        result = {"ok": False, "status": 400, "error": "Invalid local speech request"}
    except Exception:
        result = {"ok": False, "status": 503, "error": "Local speech engine unavailable"}
    finally:
        signal.alarm(0)
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
