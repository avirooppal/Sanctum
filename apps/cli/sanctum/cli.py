import argparse
import json
import sys
from pathlib import Path

from .doctor import collect, load_profiles, report
from .provisioning import provision, estimate


def main() -> int:
    parser = argparse.ArgumentParser(prog="sanctum")
    commands = parser.add_subparsers(dest="command", required=True)
    doctor = commands.add_parser("doctor", help="Offline hardware and readiness report")
    doctor.add_argument("--install-check", action="store_true")
    doctor.add_argument(
        "--probe-binary",
        type=Path,
        default=Path.home() / ".local/lib/sanctum/current/bin/sanctum-foundation",
    )
    doctor.add_argument("--install-root", type=Path, default=Path.home() / ".local/lib/sanctum")
    doctor.add_argument("--port", type=int, default=8769)
    doctor.add_argument("--required-bytes", type=int, default=2 * 1024**3)
    doctor.add_argument("--json", action="store_true", help="Emit versioned JSON")
    doctor.add_argument("--mode", choices=["solo", "team"], default="solo")
    doctor.add_argument("--profiles", type=Path, default=Path("profiles/hardware.json"))
    for name in ("pull", "estimate"):
        command = commands.add_parser(name)
        command.add_argument("id")
        command.add_argument("--manifest", type=Path, default=Path("profiles/artifacts.json"))
        if name == "pull":
            command.add_argument("--allow-network", action="store_true")
            command.add_argument("--from-file", type=Path)
            command.add_argument("--store", type=Path, default=Path(".sanctum/artifacts"))
        else:
            command.add_argument("--ram-gib", type=float)

    config_cmd = commands.add_parser("config", help="Manage typed settings and configuration")
    config_sub = config_cmd.add_subparsers(dest="config_action", required=True)
    c_get = config_sub.add_parser("get", help="Get a setting value")
    c_get.add_argument("key", help="Setting key dot-path")
    c_set = config_sub.add_parser("set", help="Set a setting value")
    c_set.add_argument("key", help="Setting key dot-path")
    c_set.add_argument("value", help="Setting value")
    c_list = config_sub.add_parser("list", help="List all settings")
    c_list.add_argument("--scope", choices=["global", "assistant", "thread", "model"])
    c_export = config_sub.add_parser("export", help="Export configuration as JSON")
    c_export.add_argument("--output", type=Path, help="Target file path")
    c_import = config_sub.add_parser("import", help="Import configuration from JSON")
    c_import.add_argument("path", type=Path, help="JSON file path to import")
    config_cmd.add_argument("--config-dir", type=Path, help="Custom data directory")

    args = parser.parse_args()

    if args.command == "config":
        from . import config as config_mod

        custom_dir = getattr(args, "config_dir", None)
        try:
            if args.config_action == "get":
                val = config_mod.get_setting(args.key, custom_dir)
                print(json.dumps(val) if isinstance(val, (dict, list)) else val)
                return 0
            elif args.config_action == "set":
                config_mod.set_setting(args.key, args.value, custom_dir)
                print(f"Setting '{args.key}' saved.")
                return 0
            elif args.config_action == "list":
                res = config_mod.list_settings(args.scope, custom_dir)
                print(json.dumps(res, indent=2))
                return 0
            elif args.config_action == "export":
                res = config_mod.export_settings(custom_dir)
                out = json.dumps(res, indent=2)
                if args.output:
                    args.output.write_text(out, encoding="utf-8")
                    print(f"Exported settings to {args.output}")
                else:
                    print(out)
                return 0
            elif args.config_action == "import":
                applied = config_mod.import_settings(args.path, custom_dir)
                print(f"Imported {applied} setting(s) from {args.path}")
                return 0
        except Exception as exc:
            print(f"sanctum config error: {exc}", file=sys.stderr)
            return 2
    if args.command == "doctor" and args.install_check:
        from .install_check import check

        if not 1 <= args.port <= 65535 or args.required_bytes < 0:
            parser.error("port must be1..65535 and required-bytes must be nonnegative")
        try:
            result = check(args.install_root, args.port, args.required_bytes, args.probe_binary)
        except (OSError, ValueError):
            print(
                "Installation prerequisites could not be read. Startup is blocked.", file=sys.stderr
            )
            return 78
        print(json.dumps(result, indent=2))
        return 0 if result["ready_for_installation"] else 78
    if args.command in ("pull", "estimate"):
        try:
            manifest = json.loads(args.manifest.read_text())
            entry = next(a for a in manifest["artifacts"] if a["id"] == args.id)
            if args.command == "pull":
                print(provision(entry, args.store, args.from_file, args.allow_network))
            else:
                ram = int(args.ram_gib * 1024**3) if args.ram_gib else collect().ram_bytes
                print(json.dumps(estimate(entry, ram), indent=2))
            return 0
        except (OSError, ValueError, StopIteration, KeyError) as exc:
            print(f"sanctum {args.command}: {exc or 'unknown artifact'}", file=sys.stderr)
            return 2
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
