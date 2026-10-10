"""Offline WER and voice-loop metric runner for licensed local audio suites."""

import argparse
import json
import math
import unicodedata
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((ROOT / "docs/contracts/speech-eval.schema.json").read_text())


def normalize_words(text: str) -> list[str]:
    if not isinstance(text, str):
        raise TypeError("reference and hypothesis must be strings")
    normalized = unicodedata.normalize("NFKC", text).casefold()
    cleaned = []
    for char in normalized:
        category = unicodedata.category(char)
        if char in {"'", "’"}:
            continue
        cleaned.append(char if category[0] in {"L", "N"} or char.isspace() else " ")
    return " ".join("".join(cleaned).split()).split()


def edit_counts(reference: list[str], hypothesis: list[str]) -> tuple[int, int]:
    previous = list(range(len(hypothesis) + 1))
    for row, ref_word in enumerate(reference, start=1):
        current = [row]
        for column, hyp_word in enumerate(hypothesis, start=1):
            current.append(
                min(
                    current[column - 1] + 1,
                    previous[column] + 1,
                    previous[column - 1] + (ref_word != hyp_word),
                )
            )
        previous = current
    return previous[-1], len(reference)


def word_error_rate(reference: str, hypothesis: str) -> float:
    edits, words = edit_counts(normalize_words(reference), normalize_words(hypothesis))
    if words == 0:
        raise ValueError("WER is undefined for an empty normalized reference")
    return edits / words


def percentile(values: list[float], quantile: float) -> float:
    ordered = sorted(values)
    index = max(0, math.ceil(quantile * len(ordered)) - 1)
    return ordered[index]


def evaluate(input_path: Path, output_path: Path | None = None) -> dict:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    Draft202012Validator(SCHEMA).validate(payload)
    records = payload["records"]
    language_counts: dict[str, list[int]] = {}
    total_edits = 0
    total_words = 0
    audio_seconds = 0.0
    asr_seconds = 0.0
    for record in records:
        edits, words = edit_counts(
            normalize_words(record["reference"]), normalize_words(record["hypothesis"])
        )
        if words == 0:
            raise ValueError(f"record {record['id']} has an empty normalized reference")
        total_edits += edits
        total_words += words
        language = language_counts.setdefault(record["language"], [0, 0])
        language[0] += edits
        language[1] += words
        audio_seconds += record["audio_seconds"]
        asr_seconds += record["asr_seconds"]

    wer = total_edits / total_words
    target = payload.get("wer_target")
    voice_turns = payload.get("voice_turns", [])
    latency_p95 = (
        percentile([turn["first_audio_ms"] for turn in voice_turns], 0.95) if voice_turns else None
    )
    is_t1 = payload["hardware_tier"] == "T1"
    result = {
        "suite": payload["suite"],
        "dataset_license": payload["dataset_license"],
        "profile_id": payload["profile_id"],
        "hardware_tier": payload["hardware_tier"],
        "cases": len(records),
        "reference_words": total_words,
        "wer": wer,
        "wer_target": target,
        "wer_pass": None if target is None else wer <= target,
        "by_language": {
            language: {"wer": edits / words, "edits": edits, "reference_words": words}
            for language, (edits, words) in sorted(language_counts.items())
        },
        "asr_real_time_factor": asr_seconds / audio_seconds,
        "voice_first_audio_p50_ms": percentile(
            [turn["first_audio_ms"] for turn in voice_turns], 0.50
        )
        if voice_turns
        else None,
        "voice_first_audio_p95_ms": latency_p95,
        "voice_first_audio_max_ms": max(
            (turn["first_audio_ms"] for turn in voice_turns), default=None
        ),
        "voice_latency_target_ms": 800,
        "latency_pass": None if not is_t1 or not voice_turns else latency_p95 < 800,
        "barge_in_success_rate": (
            sum(turn["barge_in_success"] for turn in voice_turns) / len(voice_turns)
        )
        if voice_turns
        else None,
        "phase3_slo_verified": bool(
            is_t1
            and target is not None
            and wer <= target
            and latency_p95 is not None
            and latency_p95 < 800
        ),
    }
    if output_path is not None:
        output_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Licensed local speech-eval JSON")
    parser.add_argument("--output", type=Path, help="Optional result JSON path")
    args = parser.parse_args()
    print(json.dumps(evaluate(args.input, args.output), indent=2))


if __name__ == "__main__":
    main()
