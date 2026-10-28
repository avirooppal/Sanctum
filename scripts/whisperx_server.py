"""Compatibility launcher for the canonical local WhisperX service.

Usage: python scripts/whisperx_server.py --model base --port 8000
"""
import runpy
from pathlib import Path

if __name__ == "__main__":
    runpy.run_path(
        str(Path(__file__).resolve().parents[1] / "core" / "ai" / "speech" / "whisperx_server.py"),
        run_name="__main__",
    )
