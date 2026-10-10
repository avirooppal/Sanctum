# Development bundle CLI v1

`python tools/build_dev_bundle.py [--output PATH]` copies the current Linux runtime,
profiles, compiled UI and staged engine/model artifacts into an unsigned development
bundle. Default stays `dist/reference`. An existing destination is an error; never
overwrite or delete it. An output inside a copied source directory is rejected to
prevent recursive self-copying. This is not a signed release or license-complete
offline installer. Runtime startup verifies configured artifact hashes.
