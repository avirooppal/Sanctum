# Air-gapped installation

No signed offline release exists yet (Phase 6). Do not describe the source checkout
as a verified air-gapped installer. After an explicitly online development `uv sync
--locked`, doctor and tests run using `uv run --offline ...` with cached dependencies.
Doctor itself needs only Python standard library and local profile files.

For offline source diagnostics without uv/build tools, set PYTHONPATH to apps/cli
and run `python -m sanctum doctor --profiles profiles/hardware.json` from the root.
No weights ship. A future bundle must include pinned permissive engines/models,
licenses, signatures, hashes, SBOM, runtime dependencies and an offline-install test.

## Development bundle
`tools/build_dev_bundle.py` assembles an unsigned Linux reference bundle after explicit provisioning/build. `tools/clean_install_test.py` measured offline copy to first answer in a fresh Linux rootfs (50.6005s). It does not establish signed-release or bare-metal portability. Full license notices, signing and SBOM release packaging remain Phase 6 work.
