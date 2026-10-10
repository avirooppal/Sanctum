"""Shared nonblocking engine leases; see engine-admission-v1.md."""

from contextlib import ExitStack, contextmanager
import os
import stat
import time


@contextmanager
def acquire(root, key, capacity, background):
    import fcntl

    if (
        not key
        or any(not (c.isascii() and (c.isalnum() or c == "-")) for c in key)
        or capacity not in (1, 2)
    ):
        raise ValueError("invalid engine admission key/capacity")
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    if root.is_symlink():
        raise ValueError("admission root symlink prohibited")
    root.chmod(0o700)
    for slot in [0] if background else reversed(range(capacity)):
        descriptor = os.open(
            root / f"{key}-{slot}.lock",
            os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_CLOEXEC,
            0o600,
        )
        try:
            metadata = os.fstat(descriptor)
            if not stat.S_ISREG(metadata.st_mode) or metadata.st_mode & 0o077:
                raise ValueError("unsafe admission file")
            try:
                fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                continue
            yield
            return
        finally:
            os.close(descriptor)
    raise TimeoutError("engine busy; retry later")


@contextmanager
def wait_execution(root, key, deadline, background=False):
    with ExitStack() as stack:
        while True:
            if time.monotonic() >= deadline:
                raise TimeoutError("engine execution deadline")
            if background:
                try:
                    with acquire(root, key, 2, False):
                        pass
                except TimeoutError:
                    time.sleep(0.01)
                    continue
            try:
                stack.enter_context(acquire(root, f"execute-{key}", 1, False))
                break
            except TimeoutError:
                if time.monotonic() >= deadline:
                    raise TimeoutError("engine execution deadline") from None
                time.sleep(0.01)
        yield
