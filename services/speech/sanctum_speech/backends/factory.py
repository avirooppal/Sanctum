"""Profile-selected local ASR implementations; no remote fallback."""

from .parakeet_cpp import ParakeetCppASR
from .whisper_cpp import WhisperCppASR
from ..interfaces import ASREngine


def load_asr(profile: dict) -> ASREngine:
    engine = profile["asr"]["engine"]
    if engine == "whisper.cpp":
        return WhisperCppASR.from_profile(profile)
    if engine == "parakeet.cpp":
        return ParakeetCppASR.from_profile(profile)
    raise ValueError("unsupported local ASR engine")
