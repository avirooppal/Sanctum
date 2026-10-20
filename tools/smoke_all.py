"""Real implemented-feature smoke; pending release requirements stay explicit."""

import contextlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGE_JOURNEYS = {
    "retained_state": ["J3", "J11", "J12"],
    "chat": ["J2", "J3"],
    "rag": ["J4"],
    "file_asr": ["J5"],
    "file_tts": ["J5"],
    "tickets": ["J5", "J12"],
    "purge_safety": ["J11", "J12"],
    "journey_readiness": [
        "J1",
        "J2",
        "J3",
        "J4",
        "J5",
        "J6",
        "J7",
        "J8",
        "J9",
        "J10",
        "J11",
        "J12",
    ],
    "ui_salvage": ["J3", "J9"],
}
PENDING = [
    "desktop_ui_first_run_models_settings_tools_mcp_providers_packs_computer_use",
    "websocket_voice_barge_in_diarization",
    "vision",
    "agents_approvals_ledger",
    "lan_tls",
    "fresh_clone_offline_bundle",
]


@contextlib.contextmanager
def preserve_result(historical, current):
    previous = historical.read_bytes() if historical.exists() else None
    try:
        yield
    except BaseException:
        if historical.exists() and historical.read_bytes() != previous:
            current.with_suffix(".failed.json").write_bytes(historical.read_bytes())
        raise
    else:
        current.write_bytes(historical.read_bytes())
    finally:
        if previous is None:
            historical.unlink(missing_ok=True)
        else:
            historical.write_bytes(previous)


def main():
    config = json.loads(
        Path(os.environ.get("SANCTUM_CONFIG", "profiles/runtime-cpu.json")).read_text()
    )
    token = Path(
        os.environ.get(
            "SANCTUM_TOKEN_FILE", str(Path(config["state_dir"]).expanduser() / "local.token")
        )
    )
    audio = Path(os.environ.get("SANCTUM_AUDIO", ".sanctum/speech-smoke/jfk.wav"))
    node = os.environ.get("SANCTUM_NODE") or shutil.which("node")
    package = os.environ.get("SANCTUM_PLAYWRIGHT")
    voice = os.environ.get("SANCTUM_TTS_VOICE")
    if not token.is_file() or not audio.is_file() or not node or not package or not voice:
        raise ValueError("provision token/audio/node/Playwright/TTS voice; no stages skipped")
    speech = config["speech"]
    tts = speech["tts"]["model_id"]
    asr = speech["model_id"]
    directory = ROOT / "evals/results"
    base = "http://127.0.0.1:8769"
    env = os.environ.copy()
    env["SANCTUM_BASE_URL"] = base
    stages = [
        (
            "retained_state",
            [
                sys.executable,
                "evals/retained_state_http.py",
                "--token-file",
                str(token),
                "--output",
                str(directory / "smoke-retained-state.json"),
            ],
            None,
        ),
        (
            "ui_salvage",
            [node, "evals/retired_ui.mjs", package, str(directory / "smoke-ui-salvage.json")],
            None,
        ),
        (
            "chat",
            [
                sys.executable,
                "evals/sdk_chat.py",
                "--base-url",
                base + "/v1",
                "--token-file",
                str(token),
            ],
            "phase1-sdk.json",
        ),
        (
            "rag",
            [
                sys.executable,
                "evals/knowledge_smoke.py",
                "--base-url",
                base,
                "--token-file",
                str(token),
            ],
            "phase2-smoke.json",
        ),
        (
            "file_asr",
            [
                sys.executable,
                "evals/sdk_speech.py",
                "--base-url",
                base + "/v1",
                "--token-file",
                str(token),
                "--audio",
                str(audio),
                "--model",
                asr,
                "--output",
                str(directory / "smoke-file-asr.json"),
            ],
            None,
        ),
        (
            "file_tts",
            [
                sys.executable,
                "evals/sdk_tts.py",
                "--base-url",
                base + "/v1",
                "--token-file",
                str(token),
                "--model",
                tts,
                "--voice",
                voice,
                "--output",
                str(directory / "smoke-file-tts.json"),
            ],
            None,
        ),
        (
            "tickets",
            [
                sys.executable,
                "evals/realtime_tickets_http.py",
                "--token-file",
                str(token),
                "--output",
                str(directory / "smoke-tickets.json"),
            ],
            None,
        ),
        (
            "purge_safety",
            [
                sys.executable,
                "evals/purge_safety.py",
                "--token-file",
                str(token),
                "--output",
                str(directory / "smoke-purge-safety.json"),
            ],
            None,
        ),
        (
            "journey_readiness",
            [
                sys.executable,
                "evals/journey_runner.py",
                "--token-file",
                str(token),
                "--base-url",
                base,
                "--output",
                str(directory / "smoke-journey-readiness.json"),
            ],
            None,
        ),
    ]
    record = {
        "suite": "smoke-all-v1",
        "scope": "currently_implemented",
        "passed": [],
        "release_complete": not PENDING,
        "pending_release_requirements": PENDING,
        "journey_support": STAGE_JOURNEYS,
        "full_journey_acceptance_verified": False,
    }
    for name, argv, historical in stages:
        manager = (
            preserve_result(directory / historical, directory / f"smoke-{name}.json")
            if historical
            else contextlib.nullcontext()
        )
        with manager:
            completed = subprocess.run(argv, cwd=ROOT, env=env, capture_output=True, text=True)
            (directory / f"smoke-{name}.log").write_text(
                completed.stdout + completed.stderr, encoding="utf-8"
            )
            if completed.returncode:
                record["failed"] = name
                (directory / "smoke-all-reference.json").write_text(
                    json.dumps(record, indent=2) + "\n", encoding="utf-8"
                )
                raise RuntimeError(f"smoke {name} failed; see named log")
        record["passed"].append(name)
    (directory / "smoke-all-reference.json").write_text(
        json.dumps(record, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(record, indent=2))
    if os.environ.get("SANCTUM_RELEASE_GATE") == "1" and PENDING:
        raise RuntimeError(
            "release gate incomplete; implemented-feature smoke is not RC acceptance"
        )


if __name__ == "__main__":
    main()
