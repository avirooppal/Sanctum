"""
WhisperX Local Inference Server for Sanctum
Reference: https://github.com/m-bain/whisperX

Requirements:
    pip install whisperx fastapi uvicorn python-multipart torch torchaudio

Usage:
    python scripts/whisperx_server.py --model base --port 8000
"""

import argparse
import io
import os
import tempfile
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Sanctum WhisperX Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
device = "cpu"
compute_type = "int8"
loaded_model_name = "base"


@app.on_event("startup")
def load_whisperx_model():
    global model, device, compute_type, loaded_model_name
    try:
        import torch
        import whisperx
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"
        print(f"Loading WhisperX ({loaded_model_name}) on {device} ({compute_type})...")
        model = whisperx.load_model(loaded_model_name, device, compute_type=compute_type)
        print("WhisperX loaded successfully!")
    except Exception as e:
        print(f"Notice: WhisperX not yet installed or failed to load: {e}")
        print("Install via: pip install whisperx")


@app.get("/health")
def health():
    return {
        "status": "online",
        "engine": "whisperx",
        "model": loaded_model_name,
        "device": device,
        "compute_type": compute_type,
    }


@app.post("/transcribe")
@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(None),
    audio_file: UploadFile = File(None),
    model_name: str = Form("base"),
):
    upload = file or audio_file
    if not upload:
        return {"error": "No audio file provided"}

    content = await upload.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        if model is None:
            # Fallback to faster-whisper or standard whisper if whisperx isn't installed
            try:
                from faster_whisper import WhisperModel
                fw_model = WhisperModel(loaded_model_name, device=device, compute_type=compute_type)
                segments, info = fw_model.transcribe(tmp_path)
                seg_list = [{"text": s.text, "start": s.start, "end": s.end} for s in segments]
                full_text = " ".join([s["text"] for s in seg_list]).strip()
                return {"text": full_text, "segments": seg_list, "language": info.language}
            except Exception as e2:
                return {
                    "error": f"WhisperX model not loaded. Please pip install whisperx: {e2}"
                }

        import whisperx
        audio = whisperx.load_audio(tmp_path)
        result = model.transcribe(audio, batch_size=16)
        
        # Word-level alignment
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
        }
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sanctum WhisperX Server")
    parser.add_argument("--model", type=str, default="base", help="Model name (tiny, base, small, medium, large-v3)")
    parser.add_argument("--port", type=int, default=8000, help="Server port")
    args = parser.parse_args()
    loaded_model_name = args.model
    uvicorn.run(app, host="127.0.0.1", port=args.port)
