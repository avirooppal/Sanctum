"""ocr_server.py — Local loopback OCR sidecar for Sanctum (127.0.0.1:8010)."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
import uvicorn

from ocr_engine import OcrConfig, OcrError, get_engine

app = FastAPI(title="Sanctum Offline OCR Sidecar")

ENGINE = get_engine(
    OcrConfig(
        model_id_or_path=os.getenv("SANCTUM_OCR_MODEL", "PaddlePaddle/PaddleOCR-VL-1.6"),
        backend=os.getenv("SANCTUM_OCR_BACKEND", "auto"),  # type: ignore[arg-type]
        quantization=os.getenv("SANCTUM_OCR_QUANT", "4bit"),  # type: ignore[arg-type]
        llama_server_url=os.getenv("SANCTUM_OCR_LLAMA_URL", "http://127.0.0.1:8080"),
        offline=True,
    )
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "model": ENGINE.config.model_id_or_path}


@app.post("/ocr")
async def run_ocr(
    file: UploadFile = File(...),
    output_format: Literal["markdown", "json"] = Form("markdown"),
    task: Literal["ocr", "table", "formula", "chart", "seal", "spotting"] = Form("ocr"),
    unload_after: bool = Form(False),
) -> JSONResponse:
    suffix = Path(file.filename or "upload.png").suffix or ".png"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = Path(tmp.name)

    try:
        res = await ENGINE.extract_async(
            tmp_path,
            task=task,
            unload_after=unload_after,
        )
        if output_format == "json":
            return JSONResponse(
                content={
                    "file": file.filename,
                    "backend": res.backend,
                    "pages_total": res.pages_total,
                    "detected_language": res.detected_language,
                    "pages": [p.__dict__ for p in res.pages],
                }
            )
        return JSONResponse(
            content={
                "file": file.filename,
                "backend": res.backend,
                "pages_total": res.pages_total,
                "detected_language": res.detected_language,
                "markdown": res.markdown,
            }
        )
    except OcrError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        tmp_path.unlink(missing_ok=True)


@app.post("/unload")
async def unload() -> dict[str, str]:
    ENGINE.unload()
    return {"status": "unloaded"}


if __name__ == "__main__":
    port = int(os.getenv("SANCTUM_OCR_PORT", "8010"))
    uvicorn.run(app, host="127.0.0.1", port=port)
