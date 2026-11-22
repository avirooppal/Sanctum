"""
ocr_engine.py — Offline OCR engine for Sanctum powered by PaddleOCR-VL-1.6 (0.9B).

Backends:
  - "transformers": Hugging Face AutoModelForImageTextToText (4-bit/8-bit/bf16/fp32)
  - "llamacpp":     Local llama-server (127.0.0.1) running PaddleOCR-VL-1.6 GGUF + mmproj
  - "auto":         Tries transformers first, falls back to local llama-server
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import gc
import io
import json
import os
import re
import sys
import threading
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, Literal, Optional

from PIL import Image, ImageOps

SUPPORTED_IMAGES = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
SUPPORTED_PDFS = {".pdf"}

TASK_PROMPTS: dict[str, str] = {
    "ocr": "OCR:",
    "table": "Table Recognition:",
    "formula": "Formula Recognition:",
    "chart": "Chart Recognition:",
    "seal": "Seal Recognition:",
    "spotting": "Spotting:",
}

ProgressCallback = Callable[[int, int, str], None]


class OcrError(RuntimeError):
    """Base OCR error."""


class OcrUnsupportedFileError(OcrError):
    """Raised on unsupported file extension or unreadable file."""


class OcrModelNotFoundError(OcrError):
    """Raised when local offline model weights are missing."""


@dataclass
class PageResult:
    page: int
    text: str
    language: str
    has_tables: bool = False
    has_formulas: bool = False


@dataclass
class OcrDocumentResult:
    file: str
    backend: str
    model: str
    pages_total: int
    detected_language: str
    markdown: str
    pages: list[PageResult] = field(default_factory=list)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(asdict(self), ensure_ascii=False, indent=indent)


def detect_language_offline(text: str) -> str:
    """Detect primary language offline. Uses langdetect if installed, else script heuristics."""
    sample = re.sub(r"[\s\d\W_]+", " ", text).strip()
    if len(sample) < 8:
        return "unknown"

    try:
        from langdetect import detect  # type: ignore
        return str(detect(sample[:4000]))
    except Exception:
        pass

    counts = {
        "zh": len(re.findall(r"[\u4e00-\u9fff]", text)),
        "ja": len(re.findall(r"[\u3040-\u30ff]", text)),
        "ko": len(re.findall(r"[\uac00-\ud7af]", text)),
        "ar": len(re.findall(r"[\u0600-\u06ff]", text)),
        "hi": len(re.findall(r"[\u0900-\u097f]", text)),
        "ru": len(re.findall(r"[\u0400-\u04ff]", text)),
        "latin": len(re.findall(r"[A-Za-z]", text)),
    }
    top_lang, top_val = max(counts.items(), key=lambda kv: kv[1])
    if top_val == 0:
        return "unknown"
    return "en" if top_lang == "latin" else top_lang


def _resize_if_needed(img: Image.Image, max_dim: int) -> Image.Image:
    w, h = img.size
    if max(w, h) <= max_dim:
        return img
    scale = max_dim / float(max(w, h))
    return img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)


def load_document_pages(
    file_path: str | Path,
    *,
    dpi: int = 200,
    max_image_dim: int = 2048,
    max_pages: Optional[int] = None,
) -> list[Image.Image]:
    """Load single image or render multi-page PDF into RGB PIL Images."""
    path = Path(file_path)
    if not path.is_file():
        raise OcrUnsupportedFileError(f"File not found: {path}")

    ext = path.suffix.lower()
    if ext in SUPPORTED_IMAGES:
        try:
            with Image.open(path) as im:
                img = ImageOps.exif_transpose(im).convert("RGB")
                return [_resize_if_needed(img, max_image_dim)]
        except Exception as exc:
            raise OcrUnsupportedFileError(f"Failed to open image '{path.name}': {exc}") from exc

    if ext in SUPPORTED_PDFS:
        try:
            import fitz  # type: ignore

            pages: list[Image.Image] = []
            with fitz.open(path) as doc:
                if doc.is_encrypted:
                    raise OcrUnsupportedFileError(f"PDF is password-protected: {path.name}")
                total = min(len(doc), max_pages) if max_pages else len(doc)
                zoom = dpi / 72.0
                mat = fitz.Matrix(zoom, zoom)
                for i in range(total):
                    pix = doc[i].get_pixmap(matrix=mat, alpha=False)
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    pages.append(_resize_if_needed(img, max_image_dim))
            if not pages:
                raise OcrUnsupportedFileError(f"PDF contains 0 pages: {path.name}")
            return pages
        except ImportError:
            pass

        try:
            from pdf2image import convert_from_path  # type: ignore

            raw_pages = convert_from_path(
                str(path),
                dpi=dpi,
                last_page=max_pages if max_pages else None,
            )
            return [_resize_if_needed(p.convert("RGB"), max_image_dim) for p in raw_pages]
        except ImportError as exc:
            raise OcrError(
                "PDF support requires PyMuPDF (`pip install pymupdf`) or pdf2image (`pip install pdf2image`)."
            ) from exc
        except Exception as exc:
            raise OcrUnsupportedFileError(f"Failed to render PDF '{path.name}': {exc}") from exc

    raise OcrUnsupportedFileError(
        f"Unsupported file type '{ext}'. Supported: {sorted(SUPPORTED_IMAGES | SUPPORTED_PDFS)}"
    )


@dataclass
class OcrConfig:
    model_id_or_path: str = "PaddlePaddle/PaddleOCR-VL-1.6"
    backend: Literal["auto", "transformers", "llamacpp"] = "auto"
    quantization: Literal["4bit", "8bit", "none"] = "4bit"
    device: Literal["auto", "cuda", "cpu", "mps"] = "auto"
    offline: bool = True
    max_new_tokens: int = 2048
    dpi: int = 200
    max_image_dim: int = 2048
    llama_server_url: str = "http://127.0.0.1:8080"
    llama_timeout_sec: int = 180


class PaddleOcrVLEngine:
    """Offline OCR engine wrapping PaddleOCR-VL-1.6 (0.9B) with memory lifecycle control."""

    def __init__(self, config: Optional[OcrConfig] = None) -> None:
        self.config = config or OcrConfig()
        self._lock = threading.RLock()
        self._active_backend: Optional[str] = None
        self._model: Any = None
        self._processor: Any = None

        if self.config.offline:
            os.environ["HF_HUB_OFFLINE"] = "1"
            os.environ["TRANSFORMERS_OFFLINE"] = "1"

    def load(self) -> str:
        with self._lock:
            if self._active_backend is not None:
                return self._active_backend

            if self.config.backend == "llamacpp":
                self._verify_llama_server()
                self._active_backend = "llamacpp"
                return self._active_backend

            if self.config.backend == "transformers":
                self._load_transformers()
                self._active_backend = "transformers"
                return self._active_backend

            try:
                self._load_transformers()
                self._active_backend = "transformers"
                return self._active_backend
            except Exception as tf_err:
                try:
                    self._verify_llama_server()
                    self._active_backend = "llamacpp"
                    return self._active_backend
                except Exception as llama_err:
                    raise OcrModelNotFoundError(
                        f"Could not initialize OCR engine.\n"
                        f"  - transformers failed: {tf_err}\n"
                        f"  - llama.cpp fallback failed: {llama_err}"
                    ) from tf_err

    def unload(self) -> None:
        with self._lock:
            self._model = None
            self._processor = None
            self._active_backend = None
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    torch.cuda.ipc_collect()
            except Exception:
                pass

    def __enter__(self) -> "PaddleOcrVLEngine":
        self.load()
        return self

    def __exit__(self, *_: Any) -> None:
        self.unload()

    def _load_transformers(self) -> None:
        try:
            import torch
            from transformers import AutoModelForImageTextToText, AutoProcessor
        except ImportError as exc:
            raise OcrError(
                "Missing PyTorch/Transformers. Install with: pip install torch transformers>=5.0.0"
            ) from exc

        has_cuda = torch.cuda.is_available()
        has_mps = hasattr(torch.backends, "mps") and torch.backends.mps.is_available()

        if self.config.device == "auto":
            target_device = "cuda" if has_cuda else ("mps" if has_mps else "cpu")
        else:
            target_device = self.config.device

        load_kwargs: dict[str, Any] = {
            "trust_remote_code": True,
            "local_files_only": self.config.offline,
        }

        if target_device == "cuda" and self.config.quantization in ("4bit", "8bit"):
            try:
                from transformers import BitsAndBytesConfig

                if self.config.quantization == "4bit":
                    load_kwargs["quantization_config"] = BitsAndBytesConfig(
                        load_in_4bit=True,
                        bnb_4bit_compute_dtype=torch.bfloat16,
                        bnb_4bit_quant_type="nf4",
                        bnb_4bit_use_double_quant=True,
                    )
                else:
                    load_kwargs["quantization_config"] = BitsAndBytesConfig(load_in_8bit=True)
                load_kwargs["device_map"] = "auto"
            except ImportError:
                load_kwargs["torch_dtype"] = torch.bfloat16
                load_kwargs["device_map"] = "auto"
        elif target_device == "cuda":
            load_kwargs["torch_dtype"] = torch.bfloat16
            load_kwargs["device_map"] = "auto"
        elif target_device == "mps":
            load_kwargs["torch_dtype"] = torch.float16
        else:
            load_kwargs["torch_dtype"] = torch.float32

        try:
            self._processor = AutoProcessor.from_pretrained(
                self.config.model_id_or_path,
                trust_remote_code=True,
                local_files_only=self.config.offline,
            )
            self._model = AutoModelForImageTextToText.from_pretrained(
                self.config.model_id_or_path,
                **load_kwargs,
            )
            if "device_map" not in load_kwargs:
                self._model = self._model.to(target_device)
            self._model.eval()
        except OSError as exc:
            raise OcrModelNotFoundError(
                f"Local weights for '{self.config.model_id_or_path}' not found in offline cache. "
                f"Download once first via `huggingface-cli download {self.config.model_id_or_path}`."
            ) from exc

    def _infer_transformers(self, image: Image.Image, prompt: str) -> str:
        import torch

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": prompt},
                ],
            }
        ]

        if hasattr(self._processor, "apply_chat_template"):
            inputs = self._processor.apply_chat_template(
                messages,
                add_generation_prompt=True,
                tokenize=True,
                return_dict=True,
                return_tensors="pt",
            )
        else:
            inputs = self._processor(
                text=[f"<|image_1|>{prompt}"],
                images=[image],
                return_tensors="pt",
            )

        inputs = {k: v.to(self._model.device) if hasattr(v, "to") else v for k, v in inputs.items()}

        with torch.inference_mode():
            output_ids = self._model.generate(
                **inputs,
                max_new_tokens=self.config.max_new_tokens,
                do_sample=False,
            )

        prompt_len = inputs["input_ids"].shape[-1]
        text = self._processor.decode(output_ids[0][prompt_len:], skip_special_tokens=True)
        return self._clean_markdown(text)

    def _verify_llama_server(self) -> None:
        url = self.config.llama_server_url.rstrip("/")
        if not (url.startswith("http://127.0.0.1") or url.startswith("http://localhost")):
            raise OcrError(f"Offline policy blocks non-loopback llama-server URL: {url}")
        try:
            req = urllib.request.Request(f"{url}/health", method="GET")
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status != 200:
                    raise OcrError(f"llama-server unhealthy (HTTP {resp.status})")
        except Exception as exc:
            raise OcrError(
                f"Local llama-server not reachable at {url}. Start it with:\n"
                f"  llama-server -m PaddleOCR-VL-1.6-Q4_K_M.gguf --mmproj PaddleOCR-VL-1.6-mmproj.gguf --host 127.0.0.1 --port 8080"
            ) from exc

    def _infer_llamacpp(self, image: Image.Image, prompt: str) -> str:
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        payload = {
            "model": "paddleocr-vl-1.6",
            "temperature": 0.0,
            "max_tokens": self.config.max_new_tokens,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        }
        body = json.dumps(payload).encode("utf-8")
        url = f"{self.config.llama_server_url.rstrip('/')}/v1/chat/completions"
        req = urllib.request.Request(
            url, data=body, headers={"Content-Type": "application/json"}, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=self.config.llama_timeout_sec) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            raise OcrError(f"llama-server request failed: {exc}") from exc

        content = data["choices"][0]["message"]["content"]
        return self._clean_markdown(content)

    @staticmethod
    def _clean_markdown(text: str) -> str:
        text = text.replace("\r\n", "\n").strip()
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text

    def extract(
        self,
        file_path: str | Path,
        *,
        task: Literal["ocr", "table", "formula", "chart", "seal", "spotting"] = "ocr",
        max_pages: Optional[int] = None,
        progress_callback: Optional[ProgressCallback] = None,
        unload_after: bool = False,
    ) -> OcrDocumentResult:
        prompt = TASK_PROMPTS.get(task, "OCR:")
        pages_imgs = load_document_pages(
            file_path,
            dpi=self.config.dpi,
            max_image_dim=self.config.max_image_dim,
            max_pages=max_pages,
        )
        total = len(pages_imgs)
        backend = self.load()

        page_results: list[PageResult] = []
        try:
            with self._lock:
                for idx, img in enumerate(pages_imgs, start=1):
                    if progress_callback:
                        progress_callback(idx, total, f"Processing page {idx}/{total}")
                    raw_md = (
                        self._infer_transformers(img, prompt)
                        if backend == "transformers"
                        else self._infer_llamacpp(img, prompt)
                    )
                    lang = detect_language_offline(raw_md)
                    page_results.append(
                        PageResult(
                            page=idx,
                            text=raw_md,
                            language=lang,
                            has_tables=("|" in raw_md and "---" in raw_md) or "<table" in raw_md.lower(),
                            has_formulas="$$" in raw_md or "\\(" in raw_md or "\\[" in raw_md,
                        )
                    )
                    if progress_callback:
                        progress_callback(idx, total, f"Completed page {idx}/{total}")
        finally:
            if unload_after:
                self.unload()

        if total == 1:
            combined_md = page_results[0].text
        else:
            combined_md = "\n\n---\n\n".join(
                f"<!-- Page {p.page} -->\n\n{p.text}" for p in page_results
            )

        doc_lang = detect_language_offline(combined_md)
        return OcrDocumentResult(
            file=str(Path(file_path).resolve()),
            backend=backend,
            model=self.config.model_id_or_path if backend == "transformers" else "PaddleOCR-VL-1.6-GGUF",
            pages_total=total,
            detected_language=doc_lang,
            markdown=combined_md,
            pages=page_results,
        )

    async def extract_async(
        self,
        file_path: str | Path,
        *,
        task: Literal["ocr", "table", "formula", "chart", "seal", "spotting"] = "ocr",
        max_pages: Optional[int] = None,
        progress_callback: Optional[ProgressCallback] = None,
        unload_after: bool = False,
    ) -> OcrDocumentResult:
        return await asyncio.to_thread(
            self.extract,
            file_path,
            task=task,
            max_pages=max_pages,
            progress_callback=progress_callback,
            unload_after=unload_after,
        )


_DEFAULT_ENGINE: Optional[PaddleOcrVLEngine] = None
_DEFAULT_LOCK = threading.Lock()


def get_engine(config: Optional[OcrConfig] = None) -> PaddleOcrVLEngine:
    global _DEFAULT_ENGINE
    with _DEFAULT_LOCK:
        if _DEFAULT_ENGINE is None or config is not None:
            _DEFAULT_ENGINE = PaddleOcrVLEngine(config)
        return _DEFAULT_ENGINE


def extract_text(
    file_path: str,
    *,
    output_format: Literal["markdown", "json"] = "markdown",
    task: Literal["ocr", "table", "formula", "chart", "seal", "spotting"] = "ocr",
    progress_callback: Optional[ProgressCallback] = None,
    unload_after: bool = False,
) -> str:
    result = get_engine().extract(
        file_path,
        task=task,
        progress_callback=progress_callback,
        unload_after=unload_after,
    )
    return result.to_json() if output_format == "json" else result.markdown


async def extract_text_async(
    file_path: str,
    *,
    output_format: Literal["markdown", "json"] = "markdown",
    task: Literal["ocr", "table", "formula", "chart", "seal", "spotting"] = "ocr",
    progress_callback: Optional[ProgressCallback] = None,
    unload_after: bool = False,
) -> str:
    result = await get_engine().extract_async(
        file_path,
        task=task,
        progress_callback=progress_callback,
        unload_after=unload_after,
    )
    return result.to_json() if output_format == "json" else result.markdown


def unload_model() -> None:
    global _DEFAULT_ENGINE
    with _DEFAULT_LOCK:
        if _DEFAULT_ENGINE is not None:
            _DEFAULT_ENGINE.unload()


def _cli() -> int:
    parser = argparse.ArgumentParser(description="Sanctum Offline OCR (PaddleOCR-VL-1.6)")
    parser.add_argument("file", help="Path to image (JPG/PNG/WEBP) or PDF")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown")
    parser.add_argument("--task", choices=list(TASK_PROMPTS.keys()), default="ocr")
    parser.add_argument("--backend", choices=["auto", "transformers", "llamacpp"], default="auto")
    parser.add_argument("--quant", choices=["4bit", "8bit", "none"], default="4bit")
    parser.add_argument("--model", default="PaddlePaddle/PaddleOCR-VL-1.6", help="HF repo ID or local dir")
    parser.add_argument("--llama-url", default="http://127.0.0.1:8080")
    parser.add_argument("--dpi", type=int, default=200)
    parser.add_argument("--max-pages", type=int, default=None)
    parser.add_argument("--output", "-o", help="Write output to file instead of stdout")
    parser.add_argument("--unload", action="store_true", help="Unload model immediately after run")
    args = parser.parse_args()

    cfg = OcrConfig(
        model_id_or_path=args.model,
        backend=args.backend,
        quantization=args.quant,
        dpi=args.dpi,
        llama_server_url=args.llama_url,
    )
    engine = PaddleOcrVLEngine(cfg)

    def on_progress(page: int, total: int, msg: str) -> None:
        print(f"[OCR {page}/{total}] {msg}", file=sys.stderr)

    try:
        res = engine.extract(
            args.file,
            task=args.task,
            max_pages=args.max_pages,
            progress_callback=on_progress,
            unload_after=args.unload,
        )
        out = res.to_json() if args.format == "json" else res.markdown
        if args.output:
            Path(args.output).write_text(out, encoding="utf-8")
            print(f"Saved OCR output to {args.output}", file=sys.stderr)
        else:
            print(out)
        return 0
    except OcrError as exc:
        print(f"OCR Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(_cli())
