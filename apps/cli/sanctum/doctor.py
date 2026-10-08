"""Read-only hardware probes. No sockets, downloads or telemetry."""

import json
import os
import platform
import subprocess
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

GIB = 1024**3


@dataclass
class GPU:
    name: str
    vendor: str
    vram_bytes: int | None = None


@dataclass
class Hardware:
    os: str
    arch: str
    ram_bytes: int | None = None
    cpu_count: int = 1
    gpus: list[GPU] = field(default_factory=list)
    cpu_features: list[str] = field(default_factory=list)
    npu: str = "unknown (no portable probe)"
    warnings: list[str] = field(default_factory=list)


def run(args: list[str]) -> str | None:
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=8, check=False)
        return result.stdout.strip() if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired, UnicodeError):
        return None


def collect() -> Hardware:
    hw = Hardware(platform.system(), platform.machine(), cpu_count=os.cpu_count() or 1)
    try:
        if hw.os == "Windows":
            output = run(
                [
                    "powershell.exe",
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    "@{ram=(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory; "
                    "gpus=@(Get-CimInstance Win32_VideoController | "
                    "Select-Object -ExpandProperty Name)} | ConvertTo-Json -Compress",
                ]
            )
            if output:
                data = json.loads(output)
                hw.ram_bytes = int(data["ram"])
                for name in data.get("gpus", []):
                    vendor = next(
                        (v for v in ("nvidia", "amd", "intel") if v in name.lower()), "unknown"
                    )
                    hw.gpus.append(GPU(name, vendor))
        elif hw.os == "Linux":
            for line in Path("/proc/meminfo").read_text().splitlines():
                if line.startswith("MemTotal:"):
                    hw.ram_bytes = int(line.split()[1]) * 1024
            for line in Path("/proc/cpuinfo").read_text().splitlines():
                if line.startswith(("flags\t", "Features\t")):
                    hw.cpu_features = sorted(line.split(":", 1)[1].split())
                    break
        elif hw.os == "Darwin":
            memory = run(["sysctl", "-n", "hw.memsize"])
            hw.ram_bytes = int(memory) if memory else None
            if hw.arch == "arm64":
                hw.gpus = [GPU("Apple integrated (shared system memory)", "apple")]
            features = run(["sysctl", "-n", "machdep.cpu.features"])
            hw.cpu_features = sorted(features.split()) if features else []
    except (OSError, ValueError, KeyError, TypeError):
        hw.warnings.append("Hardware probe was incomplete; unknown values are not estimated.")

    nvidia = run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
    if nvidia:
        detected = []
        for line in nvidia.splitlines():
            try:
                name, mib = line.rsplit(",", 1)
                memory_bytes = int(mib.strip()) * 1024**2
                if memory_bytes > 0:
                    detected.append(GPU(name.strip(), "nvidia", memory_bytes))
            except ValueError:
                hw.warnings.append("NVIDIA memory probe returned an unsupported value.")
        if detected:
            hw.gpus = [g for g in hw.gpus if g.vendor != "nvidia"] + detected
    if hw.ram_bytes is None:
        hw.warnings.append("RAM is unknown; no automatic profile can be recommended.")
    if not hw.cpu_features:
        hw.warnings.append("CPU instruction features are unverified on this platform.")
    hw.warnings.append("NPU and non-NVIDIA dedicated VRAM probing are unverified.")
    return hw


def load_profiles(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema_version") != "1.0" or not isinstance(data.get("profiles"), list):
        raise ValueError("unsupported profile configuration")
    profiles = data["profiles"]
    seen = set()
    for profile in profiles:
        for key in ("id", "tier", "engine", "quantization", "kv_cache"):
            if not isinstance(profile.get(key), str) or not profile[key]:
                raise ValueError(f"profile requires nonempty {key}")
        if profile["id"] in seen:
            raise ValueError("duplicate profile id")
        seen.add(profile["id"])
        for key in ("min_ram_gib", "priority", "context_tokens"):
            if type(profile.get(key)) is not int or profile[key] < 0:
                raise ValueError(f"profile requires nonnegative integer {key}")
        if profile.get("mode") not in ("any", "solo", "team"):
            raise ValueError("invalid profile mode")
        if type(profile.get("min_vram_gib", 0)) is not int or profile.get("min_vram_gib", 0) < 0:
            raise ValueError("invalid profile VRAM threshold")
    return list(profiles)


def recommend(hw: Hardware, profiles: list[dict[str, Any]], mode: str) -> dict[str, Any] | None:
    if hw.ram_bytes is None:
        return None
    for p in sorted(profiles, key=lambda item: (-item["priority"], item["id"])):
        if p["mode"] not in ("any", mode):
            continue
        if p.get("os", hw.os) != hw.os or p.get("arch", hw.arch) != hw.arch:
            continue
        if hw.ram_bytes < p["min_ram_gib"] * GIB:
            continue
        if p.get("min_vram_gib", 0) and not any(
            g.vram_bytes is not None
            and g.vram_bytes >= p["min_vram_gib"] * GIB
            and g.vendor == p.get("gpu_vendor", g.vendor)
            for g in hw.gpus
        ):
            continue
        return dict(p)
    return None


def report(hw: Hardware, profiles: list[dict[str, Any]], mode: str) -> dict[str, Any]:
    hardware = asdict(hw)
    hardware.pop("warnings")
    selected = recommend(hw, profiles, mode)
    warnings = list(hw.warnings)
    warnings.append(
        "Model selection and speed/fit estimates await verified weights and benchmarks."
    )
    if selected is None:
        warnings.append("No validated hardware profile fits this machine.")
    return {
        "schema_version": "1.0",
        "hardware": hardware,
        "recommendation": selected,
        "privacy": {
            "cloud_connectors": "disabled",
            "egress_enforcement": "unverified",
            "service_start_allowed": False,
        },
        "warnings": warnings,
    }
