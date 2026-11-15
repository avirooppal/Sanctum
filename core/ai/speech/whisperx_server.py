"""
Sanctum Local Speech-to-Text (STT) Inference Server
Supports:
  - Alibaba Qwen3-ASR-0.6B (qwen3-asr-0.6b): Light, 52 languages, CPU/consumer GPU
  - NVIDIA Nemotron 3.5 Transcribe (nemotron-3.5-transcribe): Heavy, ~5.6% WER English, high-VRAM GPU
  - WhisperX / faster-whisper (whisper-base, whisper-small, base, small, etc.)

Usage:
    python core/ai/speech/whisperx_server.py --model qwen3-asr-0.6b --port 8000
    python core/ai/speech/whisperx_server.py --model nemotron-3.5-transcribe --port 8000
    python core/ai/speech/whisperx_server.py --model base --port 8000
"""

import argparse
import os
import tempfile
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, Form, Body
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Sanctum Local STT Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STT_CACHE_DIR = Path.home() / ".cache" / "sanctum" / "stt"
STT_MODEL_REPOS = {
    "qwen3-asr-0.6b": "Qwen/Qwen3-ASR-0.6B",
    "nemotron-3.5-transcribe": "nvidia/nemotron-3.5-transcribe",
    "whisper-base": "base",
    "whisper-small": "small",
}

model = None
backend_type = "whisperx"
device = "cpu"
compute_type = "int8"
loaded_model_name = "base"


def resolve_model_source(model_id: str) -> str:
    local_dir = STT_CACHE_DIR / model_id
    if (local_dir / ".sanctum_stt_ready.json").exists():
        return str(local_dir)
    return STT_MODEL_REPOS.get(model_id, model_id)


def load_stt_model(model_id: str):
    global model, backend_type, device, compute_type, loaded_model_name
    loaded_model_name = model_id
    model = None

    try:
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"
    except Exception:
        device = "cpu"
        compute_type = "int8"

    source = resolve_model_source(model_id)

    if model_id == "qwen3-asr-0.6b":
        backend_type = "qwen-asr"
        try:
            from qwen_asr import Qwen3ASRModel
            import torch
            dtype = torch.bfloat16 if device == "cuda" else torch.float32
            model = Qwen3ASRModel.from_pretrained(source, dtype=dtype, device_map=device)
            print(f"Qwen3-ASR-0.6B loaded from {source} on {device}")
            return
        except Exception:
            pass
        try:
            from transformers import pipeline
            model = pipeline("automatic-speech-recognition", model=source, device=0 if device == "cuda" else -1)
            print(f"Qwen3-ASR-0.6B loaded via transformers pipeline on {device}")
            return
        except Exception as e:
            print(f"Notice: Qwen3-ASR-0.6B failed to load ({e}). Install: pip install qwen-asr transformers torch")
            return

    if model_id == "nemotron-3.5-transcribe":
        backend_type = "nemo"
        try:
            import nemo.collections.asr as nemo_asr
            if os.path.isdir(source):
                nemo_files = list(Path(source).glob("*.nemo"))
                if nemo_files:
                    model = nemo_asr.models.ASRModel.restore_from(str(nemo_files[0]), map_location=device)
                else:
                    model = nemo_asr.models.ASRModel.from_pretrained(model_name=source, map_location=device)
            else:
                model = nemo_asr.models.ASRModel.from_pretrained(model_name=source, map_location=device)
            print(f"NVIDIA Nemotron 3.5 Transcribe loaded on {device}")
            return
        except Exception:
            pass
        try:
            from transformers import pipeline
            model = pipeline("automatic-speech-recognition", model=source, device=0 if device == "cuda" else -1)
            print(f"NVIDIA Nemotron 3.5 Transcribe loaded via transformers pipeline on {device}")
            return
        except Exception as e:
            print(f"Notice: Nemotron 3.5 Transcribe failed to load ({e}). Install: pip install nemo_toolkit[asr] torch")
            return

    # Default: WhisperX / faster-whisper
    backend_type = "whisperx"
    whisper_name = STT_MODEL_REPOS.get(model_id, model_id)
    try:
        import whisperx
        print(f"Loading WhisperX ({whisper_name}) on {device} ({compute_type})...")
        model = whisperx.load_model(whisper_name, device, compute_type=compute_type)
        print("WhisperX loaded successfully!")
    except Exception as e:
        print(f"Notice: WhisperX not yet installed or failed to load: {e}")


@app.on_event("startup")
def startup_load():
    load_stt_model(loaded_model_name)


@app.get("/health")
def health():
    return {
        "status": "online",
        "engine": backend_type,
        "model": loaded_model_name,
        "loaded": model is not None,
        "device": device,
        "compute_type": compute_type,
    }


@app.get("/models")
def list_models():
    downloaded = []
    if STT_CACHE_DIR.exists():
        for entry in STT_CACHE_DIR.iterdir():
            if entry.is_dir() and (entry / ".sanctum_stt_ready.json").exists():
                downloaded.append(entry.name)
    return {
        "active": loaded_model_name,
        "backend": backend_type,
        "downloaded": downloaded,
    }


@app.post("/models/load")
def switch_model(payload: dict = Body(...)):
    model_id = str(payload.get("model") or "").strip()
    if not model_id:
        return {"error": "model is required"}
    load_stt_model(model_id)
    return {
        "status": "ok",
        "model": loaded_model_name,
        "backend": backend_type,
        "loaded": model is not None,
    }


@app.post("/transcribe")
@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(None),
    audio_file: UploadFile = File(None),
    model_name: str = Form(None),
    model_field: str = Form(None, alias="model"),
):
    requested_model = (model_field or model_name or "").strip()
    if requested_model and requested_model != loaded_model_name:
        load_stt_model(requested_model)

    upload = file or audio_file
    if not upload:
        return {"error": "No audio file provided"}

    content = await upload.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        if loaded_model_name == "qwen3-asr-0.6b":
            if model is None:
                return {"error": "Qwen3-ASR-0.6B not loaded. Install: pip install qwen-asr transformers torch"}
            if hasattr(model, "transcribe"):
                results = model.transcribe(audio=tmp_path)
                text = results[0].text if isinstance(results, list) and results else str(results)
                lang = getattr(results[0], "language", "auto") if isinstance(results, list) and results else "auto"
                return {"text": text.strip(), "segments": [], "language": lang, "model": loaded_model_name}
            out = model(tmp_path)
            return {"text": (out.get("text") or "").strip(), "segments": [], "language": "auto", "model": loaded_model_name}

        if loaded_model_name == "nemotron-3.5-transcribe":
            if model is None:
                return {"error": "NVIDIA Nemotron 3.5 Transcribe not loaded. Install: pip install nemo_toolkit[asr] torch"}
            if hasattr(model, "transcribe"):
                results = model.transcribe([tmp_path])
                first = results[0] if isinstance(results, list) and results else results
                text = first.text if hasattr(first, "text") else str(first)
                return {"text": text.strip(), "segments": [], "language": "en", "model": loaded_model_name}
            out = model(tmp_path)
            return {"text": (out.get("text") or "").strip(), "segments": [], "language": "en", "model": loaded_model_name}

        # WhisperX / faster-whisper fallback
        if model is None:
            try:
                from faster_whisper import WhisperModel
                whisper_name = STT_MODEL_REPOS.get(loaded_model_name, loaded_model_name)
                fw_model = WhisperModel(whisper_name, device=device, compute_type=compute_type)
                segments, info = fw_model.transcribe(tmp_path)
                seg_list = [{"text": s.text, "start": s.start, "end": s.end} for s in segments]
                full_text = " ".join([s["text"] for s in seg_list]).strip()
                return {"text": full_text, "segments": seg_list, "language": info.language, "model": loaded_model_name}
            except Exception as e2:
                return {"error": f"WhisperX model not loaded. Please pip install whisperx: {e2}"}

        import whisperx
        audio = whisperx.load_audio(tmp_path)
        result = model.transcribe(audio, batch_size=16)
        try:
            model_a, metadata = whisperx.load_align_model(language_code=result["language"], device=device)
            result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)
        except Exception:
            pass

        full_text = " ".join([seg.get("text", "") for seg in result.get("segments", [])]).strip()
        return {
            "text": full_text,
            "segments": result.get("segments", []),
            "language": result.get("language", "en"),
            "model": loaded_model_name,
        }
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sanctum Local STT Server")
    parser.add_argument(
        "--model",
        type=str,
        default="qwen3-asr-0.6b",
        help="STT model ID (qwen3-asr-0.6b, nemotron-3.5-transcribe, whisper-base, whisper-small, base, small)",
    )
    parser.add_argument("--port", type=int, default=8000, help="Server port")
    args = parser.parse_args()
    loaded_model_name = args.model
    uvicorn.run(app, host="127.0.0.1", port=args.port)
