"""Linux development network isolation; not an agent sandbox. See contract."""

import errno
import socket
import struct
import subprocess
import sys
from pathlib import Path


def probe(family, kind, address):
    try:
        with socket.socket(family, kind) as sock:
            sock.settimeout(1)
            if kind == socket.SOCK_STREAM:
                sock.connect(address)
            else:
                sock.sendto(b"sanctum-egress-self-test", address)
    except OSError as exc:
        if exc.errno in (errno.ENETUNREACH, errno.EHOSTUNREACH, errno.EACCES, errno.EPERM):
            return
        if family == socket.AF_INET6 and exc.errno == errno.EAFNOSUPPORT:
            return  # Kernel has no IPv6 support; no IPv6 path exists.
        if family == socket.AF_INET6 and exc.errno == errno.EADDRNOTAVAIL:
            return  # No usable source address in the interface-checked namespace.
        raise RuntimeError(f"inconclusive network probe: {exc}") from exc
    raise RuntimeError("egress probe unexpectedly succeeded")


def self_test():
    if {name for _, name in socket.if_nameindex()} != {"lo"}:
        raise RuntimeError("network namespace contains non-loopback interfaces")
    import fcntl

    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as control:
        flags = fcntl.ioctl(control.fileno(), 0x8913, struct.pack("256s", b"lo"))
    if struct.unpack_from("H", flags, 16)[0] & 1:
        raise RuntimeError("loopback must be down in this isolated prototype")
    for family, host in ((socket.AF_INET, "192.0.2.1"), (socket.AF_INET6, "2001:db8::1")):
        for kind in (socket.SOCK_STREAM, socket.SOCK_DGRAM):
            probe(family, kind, (host, 443 if kind == socket.SOCK_STREAM else 53))


def main():
    if sys.platform != "linux":
        print("Network containment unsupported on this OS; command not started.", file=sys.stderr)
        return 78
    args = sys.argv[1:]
    internal = bool(args and args[0] == "--inside")
    if internal:
        args.pop(0)
    if not args or args.pop(0) != "--" or not args:
        print("usage: isolated_run.py -- COMMAND [ARGS...]", file=sys.stderr)
        return 78
    try:
        if internal:
            self_test()
            print("PASS: isolated IPv4/IPv6 TCP/UDP egress self-test (4 probes)", flush=True)
            return subprocess.call(args, close_fds=True)
        return subprocess.call(
            [
                "unshare",
                "--user",
                "--map-root-user",
                "--net",
                sys.executable,
                str(Path(__file__).resolve()),
                "--inside",
                "--",
                *args,
            ],
            close_fds=True,
        )
    except (OSError, RuntimeError) as exc:
        print(f"Isolation failed; command not started: {exc}", file=sys.stderr)
        return 78


if __name__ == "__main__":
    raise SystemExit(main())
