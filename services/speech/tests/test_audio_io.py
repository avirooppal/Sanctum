import io
import sys
import unittest
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services/speech"))
from sanctum_speech.audio_io import decode_pcm16_wav  # noqa: E402


def wav_bytes(*, channels=1, width=2, rate=16000, compression="NONE", frames=None):
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(width)
        wav.setframerate(rate)
        if compression != "NONE":
            wav.setcomptype(compression, "compressed")
        wav.writeframes(frames if frames is not None else b"\0" * width * channels * 10)
    return output.getvalue()


class AudioDecodeTests(unittest.TestCase):
    def test_decodes_supported_local_pcm_wav(self):
        encoded = wav_bytes()
        audio = decode_pcm16_wav(encoded)
        self.assertEqual(audio.sample_rate, 16000)
        self.assertEqual(audio.channels, 1)
        self.assertEqual(audio.duration_seconds, 10 / 16000)

    def test_rejects_invalid_container_or_excessive_size(self):
        with self.assertRaises(ValueError):
            decode_pcm16_wav(b"not a wav")
        with self.assertRaises(ValueError):
            decode_pcm16_wav(wav_bytes(), max_bytes=8)

    def test_rejects_unsupported_pcm_parameters(self):
        for encoded in (wav_bytes(channels=2), wav_bytes(width=1), wav_bytes(rate=44100)):
            with self.subTest(encoded_length=len(encoded)), self.assertRaises(ValueError):
                decode_pcm16_wav(encoded)

    def test_rejects_empty_or_truncated_payload(self):
        with self.assertRaises(ValueError):
            decode_pcm16_wav(wav_bytes(frames=b""))
        encoded = wav_bytes()
        with self.assertRaises(ValueError):
            decode_pcm16_wav(encoded[:-3])


if __name__ == "__main__":
    unittest.main()
