# ADR 0030: Explicit managed Python for source CI

Accepted 2026-10-10. Hosted run 38051628648 used macOS framework Python 3.12
without sqlite3 extension loading. Two existing real sqlite-vec retrieval tests
failed with missing enable_load_extension. Require uv-managed Python 3.12 in the
source matrix; do not skip the tests or replace vector retrieval with a fake.
The pinned uv CLI supports --managed-python; its interpreter selection is documented
at https://docs.astral.sh/uv/concepts/python-versions/.

Disable matrix fail-fast so a macOS failure cannot hide the Windows result. This
does not make any job optional or remove any gate. Confirm the repair on actual
hosted macOS, Windows and Linux, plus the independent Rust and web jobs.
