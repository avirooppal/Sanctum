"""Measure one real file-ASR to chat to WAV turn; excludes physical capture/playback."""

import argparse
import hashlib
from io import BytesIO
import json
from pathlib import Path
import time
import wave

import httpx2
from openai import OpenAI


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--asr", required=True)
    parser.add_argument("--chat", required=True)
    parser.add_argument("--tts", required=True)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    raw = args.audio.read_bytes()
    with OpenAI(
        base_url="http://127.0.0.1:8766/v1",
        api_key=args.token_file.read_text().strip(),
        max_retries=0,
        http_client=httpx2.Client(trust_env=False, timeout=170),
    ) as client:
        start = time.perf_counter()
        transcript = client.audio.transcriptions.create(model=args.asr, file=("turn.wav", raw)).text
        after_asr = time.perf_counter()
        assert transcript.strip()
        answer = (
            client.chat.completions.create(
                model=args.chat,
                messages=[
                    {"role": "system", "content": "Respond in one short sentence."},
                    {"role": "user", "content": transcript},
                ],
                max_tokens=64,
                temperature=0,
            )
            .choices[0]
            .message.content
        )
        after_chat = time.perf_counter()
        assert answer and answer.strip()
        audio = client.audio.speech.create(
            model=args.tts, voice=args.voice, input=answer, response_format="wav"
        ).read()
        finish = time.perf_counter()
    with wave.open(BytesIO(audio)) as output:
        seconds = output.getnframes() / output.getframerate()
        assert seconds > 0
    record = {
        "suite": "real-file-voice-turn",
        "input_sha256": hashlib.sha256(raw).hexdigest(),
        "transcript": transcript,
        "answer": answer,
        "asr_seconds": after_asr - start,
        "chat_seconds": after_chat - after_asr,
        "tts_seconds": finish - after_chat,
        "full_wav_available_seconds": finish - start,
        "output_audio_seconds": seconds,
        "output_sha256": hashlib.sha256(audio).hexdigest(),
        "physical_capture_playback_verified": False,
        "t1_slo_verified": False,
        "samples": 1,
    }
    args.output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
