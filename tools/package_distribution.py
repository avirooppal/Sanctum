import hashlib
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def hash_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def package():
    dist_dir = os.path.join(ROOT, "dist")
    os.makedirs(dist_dir, exist_ok=True)

    exe_path = os.path.join(dist_dir, "Sanctum-Setup-0.1.0-x64.exe")
    if not os.path.exists(exe_path):
        print(f"Warning: {exe_path} not found yet. Run installer build first.")
        return

    # 1. SHA256SUMS
    sha256 = hash_file(exe_path)
    sums_file = os.path.join(dist_dir, "SHA256SUMS")
    with open(sums_file, "w", encoding="utf-8") as f:
        f.write(f"{sha256}  Sanctum-Setup-0.1.0-x64.exe\n")
    print(f"Generated SHA256SUMS: {sha256}")

    # 2. License Bundle
    bundle_file = os.path.join(dist_dir, "LICENSE_BUNDLE.txt")
    with open(bundle_file, "w", encoding="utf-8") as f:
        f.write("=== SANCTUM LICENSE BUNDLE ===\n\n")
        f.write(
            "Combined Distributed Work License: GNU Affero General Public License Version 3 or later\n"
        )
        f.write("Upstream Jan Components: Apache License 2.0 (Menlo Research Inc.)\n")
        f.write("Upstream Odysseus Workspace: AGPL-3.0-or-later (Odysseus Contributors)\n\n")
        f.write("--- THIRD PARTY NOTICES ---\n")
        notices_path = os.path.join(ROOT, "THIRD_PARTY_NOTICES.md")
        if os.path.exists(notices_path):
            with open(notices_path, "r", encoding="utf-8") as nf:
                f.write(nf.read())
    print(f"Generated {bundle_file}")

    # 3. Source Archive Link
    source_link_file = os.path.join(dist_dir, "SOURCE_ARCHIVE_LINK.txt")
    with open(source_link_file, "w", encoding="utf-8") as f:
        f.write("Sanctum Complete Corresponding Source Code:\n")
        f.write("Repository: https://github.com/avirooppal/Sanctum\n")
        f.write("Branch: jan-style\n")
        f.write("Commit: dfd739f\n")
        f.write("License: AGPL-3.0-or-later per docs/LICENSE_DECISION.md\n")
    print(f"Generated {source_link_file}")

    # 4. SBOM (SPDX 2.3 JSON format)
    sbom_file = os.path.join(dist_dir, "sbom.spdx.json")
    sbom_data = {
        "spdxVersion": "SPDX-2.3",
        "dataLicense": "CC0-1.0",
        "SPDXID": "SPDXRef-DOCUMENT",
        "name": "Sanctum Desktop Installer SBOM",
        "documentNamespace": "https://github.com/avirooppal/Sanctum/spdxdocs/sanctum-0.1.0",
        "creationInfo": {
            "created": "2026-10-21T13:30:00Z",
            "creators": ["Organization: Sanctum Contributors"],
        },
        "packages": [
            {
                "name": "Sanctum-Setup",
                "SPDXID": "SPDXRef-Package-Sanctum-Setup",
                "versionInfo": "0.1.0",
                "packageFileName": "Sanctum-Setup-0.1.0-x64.exe",
                "downloadLocation": "https://github.com/avirooppal/Sanctum/releases",
                "licenseConcluded": "AGPL-3.0-or-later",
                "checksums": [{"algorithm": "SHA256", "checksumValue": sha256}],
            },
            {
                "name": "jan-web-app",
                "SPDXID": "SPDXRef-Package-Jan-WebApp",
                "versionInfo": "0.8.5-e7cbcf6d",
                "downloadLocation": "https://github.com/janhq/jan",
                "licenseConcluded": "Apache-2.0",
            },
            {
                "name": "odysseus-workspace",
                "SPDXID": "SPDXRef-Package-Odysseus",
                "versionInfo": "8877273e",
                "downloadLocation": "https://github.com/odysseus-dev/odysseus",
                "licenseConcluded": "AGPL-3.0-or-later",
            },
        ],
    }
    with open(sbom_file, "w", encoding="utf-8") as f:
        json.dump(sbom_data, f, indent=2)
    print(f"Generated {sbom_file}")


if __name__ == "__main__":
    package()
