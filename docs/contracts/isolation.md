# Network isolation contract v0

`python tools/isolated_run.py -- COMMAND [ARGS...]` is a Linux-only prototype
launcher. It creates a new user/network namespace, closes inherited descriptors,
checks that only loopback exists and is down, and probes IPv4/IPv6 TCP and UDP.
Only explicit kernel no-route/permission errors count as denial; timeouts and
connection refusal do not. Any unexpected result prevents command execution.
Exit 78: unsupported platform or failed self-test. OS launcher errors also return
nonzero; command exit status otherwise propagates.
The launcher never probes the network before namespace creation succeeds.

This is network isolation, not an untrusted-code sandbox: filesystem access,
Unix sockets, privilege changes and host IPC need additional containment before
inference or agents can start. No product service is implemented in this slice.
Windows/macOS service startup stays unsupported until native containment exists.
