# Developer tools

`check.py`: local source gates. `license_scan.py`: reviewed dependency metadata.
`generate_api_docs.py`: generate docs/api.md from OpenAPI.
`isolated_run.py`: Linux network namespace prototype and startup probes.
Tests: `uv run --offline python -m unittest discover -s tools/tests -v`.

`check_rust.sh`: offline Linux Rust format/lint/tests, license and containment checks.
`rust_license_scan.py`: verify resolved crate licenses and cached archive hashes.
`verify_containment.py`: execute two-process kernel checks, save measured results.
