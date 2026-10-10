"""Strict bounded WAV decoding for the locally supported speech profile format."""

from io import BytesIO
import wave

from .types import AudioBuffer

MAX_WAV_BYTES = 64 * 1024 * 1024


def decode_pcm16_wav(payload: bytes, *, max_bytes: int = MAX_WAV_BYTES) -> AudioBuffer:
    if not isinstance(payload, bytes):
        raise TypeError("WAV payload must be bytes")
    if type(max_bytes) is not int or not 1 <= max_bytes <= 256 * 1024 * 1024:
        raise ValueError("max_bytes must be between 1 byte and 256 MiB")
    if not payload or len(payload) > max_bytes:
        raise ValueError("WAV payload is empty or exceeds its configured byte limit")
    try:
        with wave.open(BytesIO(payload), "rb") as source:
            if source.getcomptype() != "NONE":
                raise ValueError("only uncompressed PCM WAV is supported")
            if source.getsampwidth() != 2 or source.getnchannels() != 1:
                raise ValueError("WAV must be mono PCM16")
            if source.getframerate() != 16000:
                raise ValueError("WAV must use a 16 kHz sample rate")
            frame_count = source.getnframes()
            if frame_count <= 0 or frame_count * 2 > max_bytes:
                raise ValueError("WAV contains no audio or exceeds its configured limit")
            pcm = source.readframes(frame_count)
            if len(pcm) != frame_count * 2:
                raise ValueError("WAV audio payload is truncated")
    except (wave.Error, EOFError) as error:
        raise ValueError("invalid or unsupported WAV container") from error
    return AudioBuffer(pcm_s16le=pcm, sample_rate=16000, channels=1)
