"""Read-only installation prerequisites; never starts an unconfined engine."""

import json
import os
import platform
import shutil
import socket
import subprocess
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path

CHECKS = {
    "ipv4_tcp",
    "ipv4_udp",
    "ipv6_tcp",
    "ipv6_udp",
    "unix_socket",
    "file_open",
    "exec",
    "namespace",
    "connect",
    "descriptor_passing",
    "io_uring",
}
MESSAGES = {
    "platform": "Linux x86_64 with glibc 2.35 or later is required. On Windows use the dedicated WSL2 launcher.",
    "owner": "Run this check as the owner,not root.",
    "disk": "Not enough space for installation staging. Free space or choose another installation directory.",
    "port": "This loopback port is busy. Stop the existing application or choose another port.",
    "containment": "Kernel containment could not be verified. Startup is blocked;never run unconfined.",
}


@dataclass
class Facts:
    os: str
    arch: str
    libc: str
    libc_version: str
    uid: int
    ram_bytes: int
    free_bytes: int
    port_free: bool
    existing_install: bool
    apparmor_restricted: bool
    cpu_flags: list[str]


def supported(facts: Facts) -> bool:
    try:
        version = tuple(int(v) for v in facts.libc_version.split(".")[:2])
    except ValueError:
        return False
    return (
        facts.os == "Linux"
        and facts.arch in {"x86_64", "AMD64"}
        and facts.libc == "glibc"
        and version >= (2, 35)
    )


def assess(facts: Facts, contained: bool, required_bytes: int) -> dict:
    checks = {
        "platform": supported(facts),
        "owner": facts.uid > 0,
        "disk": facts.free_bytes >= required_bytes,
        "port": facts.port_free,
        "containment": contained,
    }
    messages = [MESSAGES[key] for key, passed in checks.items() if not passed]
    if facts.apparmor_restricted and not contained:
        messages.append(
            "Ubuntu AppArmor restricts user namespaces. Use a root-owned installation and its executable-specific AppArmor policy;do not disable the system-wide restriction."
        )
    return {
        "schema_version": "1.0",
        "ready_for_installation": all(checks.values()),
        "model_readiness": "unverified",
        "facts": asdict(facts),
        "checks": checks,
        "messages": messages,
    }


def valid_probe(value: object, trace: str) -> bool:
    if (
        not isinstance(value, dict)
        or value.get("schema_version") != "1.0"
        or value.get("accepted") is not True
        or value.get("trace_id") != trace
    ):
        return False
    for role in ("worker_checks", "supervisor_checks"):
        checks = value.get(role)
        if (
            not isinstance(checks, dict)
            or set(checks) != CHECKS
            or any(result != "denied" for result in checks.values())
        ):
            return False
    return True


def probe(binary: Path) -> bool:
    if not binary.is_absolute() or not binary.is_file():
        return False
    trace = uuid.uuid4().hex
    envelope = {
        "user": "install-check",
        "workspace": "diagnostics",
        "data_class": "restricted",
        "trace_id": trace,
        "policy_context": {"cloud_connectors": []},
    }
    try:
        with subprocess.Popen(
            [str(binary), "check"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            env={},
            start_new_session=True,
        ) as child:
            try:
                stdout, _ = child.communicate(json.dumps(envelope), timeout=15)
            except subprocess.TimeoutExpired:
                try:
                    os.kill(
                        -child.pid, 9
                    )  # Linux-only process group; never a Windows execution path.
                except ProcessLookupError:
                    pass
                child.communicate(timeout=5)
                return False
            if child.returncode != 0 or len(stdout) > 65536:
                return False
            return valid_probe(json.loads(stdout), trace)
    except (OSError, ValueError, subprocess.SubprocessError):
        return False


def inventory(install_root: Path, port: int) -> Facts:
    ancestor = install_root.expanduser().resolve()
    existing = ancestor.exists()
    while not ancestor.exists():
        ancestor = ancestor.parent
    free = shutil.disk_usage(ancestor).free
    ram = 0
    flags: list[str] = []
    restricted = False
    if platform.system() == "Linux":
        try:
            for line in Path("/proc/meminfo").read_text().splitlines():
                if line.startswith("MemTotal:"):
                    ram = int(line.split()[1]) * 1024
            for line in Path("/proc/cpuinfo").read_text().splitlines():
                if line.startswith("flags"):
                    flags = line.split(":", 1)[1].split()
                    break
            policy = Path("/proc/sys/kernel/apparmor_restrict_unprivileged_userns")
            restricted = policy.is_file() and policy.read_text().strip() == "1"
        except (OSError, ValueError):
            pass
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
            listener.bind(("127.0.0.1", port))
        port_free = True
    except OSError:
        port_free = False
    libc, version = platform.libc_ver()
    return Facts(
        platform.system(),
        platform.machine(),
        libc,
        version,
        os.getuid() if hasattr(os, "getuid") else 0,
        ram,
        free,
        port_free,
        existing,
        restricted,
        flags,
    )


def check(install_root: Path, port: int, required_bytes: int, binary: Path) -> dict:
    facts = inventory(install_root, port)
    contained = probe(binary) if supported(facts) and facts.uid > 0 else False
    return assess(facts, contained, required_bytes)
