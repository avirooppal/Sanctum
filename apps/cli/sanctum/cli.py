import argparse
import json
import sys
from pathlib import Path

from .doctor import collect, load_profiles, report


def main() -> int:
    parser = argparse.ArgumentParser(prog="sanctum")
    commands = parser.add_subparsers(dest="command", required=True)
    doctor = commands.add_parser("doctor", help="Offline hardware and readiness report")
    doctor.add_argument("--json", action="store_true", help="Emit versioned JSON")
    doctor.add_argument("--mode", choices=["solo", "team"], default="solo")
    doctor.add_argument("--profiles", type=Path, default=Path("profiles/hardware.json"))
    args = parser.parse_args()
    try:
        profiles = load_profiles(args.profiles)
        result = report(collect(), profiles, args.mode)
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as exc:
        print(f"sanctum doctor: {exc}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        hw = result["hardware"]
        print(f"Sanctum doctor | {hw['os']} {hw['arch']} | {hw['cpu_count']} logical CPUs")
        ram = f"{hw['ram_bytes'] / 1024**3:.2f} GiB" if hw["ram_bytes"] else "unknown"
        print(f"RAM: {ram}")
        for gpu in hw["gpus"]:
            vram = (
                f"{gpu['vram_bytes'] / 1024**3:.2f} GiB" if gpu["vram_bytes"] else "unknown/shared"
            )
            print(f"GPU: {gpu['name']} | VRAM: {vram}")
        selected = result["recommendation"]
        if selected:
            print(f"Hardware tier: {selected['tier']} | Recommended profile: {selected['id']}")
            print(f"Engine: {selected['engine']} | Quantization: {selected['quantization']}")
        else:
            print("Hardware tier: unknown/unsupported | Recommended profile: none")
        print("Privacy: cloud disabled; egress UNVERIFIED; service startup BLOCKED")
        for warning in result["warnings"]:
            print(f"Warning: {warning}")
    return 0 if result["recommendation"] else 2
