"""OpenAI-compatible serializers for engine-neutral transcription results."""

from .types import TranscriptionResult


def _vtt_timestamp(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d}.{milliseconds:03d}"


def format_transcription(
    result: TranscriptionResult, response_format: str
) -> tuple[str, str | dict]:
    if not isinstance(result, TranscriptionResult):
        raise TypeError("result must be a TranscriptionResult")
    if response_format == "text":
        return "text/plain; charset=utf-8", result.text
    if response_format == "json":
        return "application/json", {"text": result.text}
    if response_format == "verbose_json":
        body = {
            "text": result.text,
            "language": result.language,
            "duration": result.duration,
            "segments": [
                {
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text,
                    "speaker_id": segment.speaker_id,
                }
                for segment in result.segments
            ],
        }
        return "application/json", body
    if response_format == "vtt":
        cues = [
            f"{_vtt_timestamp(segment.start)} --> {_vtt_timestamp(segment.end)}\n{segment.text}"
            for segment in result.segments
        ]
        return "text/vtt; charset=utf-8", "WEBVTT\n\n" + "\n\n".join(cues) + "\n"
    raise ValueError("response_format must be json, text, verbose_json, or vtt")
