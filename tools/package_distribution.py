import hashlib
import json
import os
import subprocess
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSION = "1.0.0"


def hash_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def package():
    with open(os.path.join(ROOT, "package-lock.json"), encoding="utf-8") as lock_file:
        locked_packages = json.load(lock_file)["packages"]

    def locked_version(name):
        return locked_packages[f"node_modules/{name}"]["version"]

    dist_dir = os.path.join(ROOT, "dist")
    os.makedirs(dist_dir, exist_ok=True)

    exe_name = "Sanctum.exe"
    exe_path = os.path.join(dist_dir, exe_name)
    if not os.path.exists(exe_path):
        print(f"Warning: {exe_path} not found yet. Run installer build first.")
        return

    # Git commit hash
    git_commit = "d078a76"
    try:
        rev = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True)
        if rev.returncode == 0 and rev.stdout.strip():
            git_commit = rev.stdout.strip()
    except Exception:
        pass

    # 1. SHA256SUMS (Sanctum.exe is the only shipped binary)
    sha256_exe = hash_file(exe_path)
    with open(os.path.join(dist_dir, "SHA256SUMS"), "w", encoding="utf-8") as f:
        f.write(f"{sha256_exe}  {exe_name}\n")
    print(f"Generated SHA256SUMS: {sha256_exe}")

    # 3. License Bundle & Third-Party Notices
    bundle_file = os.path.join(dist_dir, "LICENSE_BUNDLE.txt")
    with open(bundle_file, "w", encoding="utf-8") as f:
        f.write("=== SANCTUM LICENSE BUNDLE ===\n\n")
        f.write("Package: Sanctum Desktop\n")
        f.write(f"Version: {VERSION}\n")
        f.write("License: MIT License (Sanctum Contributors)\n\n")
        license_path = os.path.join(ROOT, "LICENSE")
        if os.path.exists(license_path):
            with open(license_path, "r", encoding="utf-8") as lf:
                f.write(lf.read())
                f.write("\n\n")

    notices_file = os.path.join(dist_dir, "THIRD_PARTY_NOTICES.txt")
    with open(notices_file, "w", encoding="utf-8") as f:
        f.write("=== SANCTUM THIRD PARTY NOTICES ===\n\n")
        f.write("Sanctum bundles components licensed under permissive open-source licenses:\n\n")
        f.write("- Next.js (MIT License) - Vercel, Inc.\n")
        f.write("- React (MIT License) - Meta Platforms, Inc.\n")
        f.write("- Zustand (MIT License) - Zustand Contributors\n")
        f.write("- Tailwind CSS (MIT License) - Tailwind Labs, Inc.\n")
        f.write("- Lucide React (ISC License) - Lucide Contributors\n")
        f.write("- class-variance-authority (Apache-2.0) - Joe Bell\n")
        f.write("- clsx (MIT License) - Luke Edwards\n")
        f.write("- PDF.js / pdfjs-dist (Apache-2.0) - Mozilla Foundation\n")
        f.write("- Mammoth (BSD-2-Clause) - Michael Williamson\n")
    print(f"Generated {bundle_file} and {notices_file}")

    # 4. Source Link / Offer
    source_link_file = os.path.join(dist_dir, "SOURCE_ARCHIVE_LINK.txt")
    with open(source_link_file, "w", encoding="utf-8") as f:
        f.write("Sanctum Complete Corresponding Source Code:\n")
        f.write("Repository: https://github.com/avirooppal/Sanctum\n")
        f.write(f"Commit: {git_commit}\n")
        f.write("License: MIT License per LICENSE file\n")
    print(f"Generated {source_link_file}")

    # 5. SBOM (SPDX 2.3 JSON format)
    sbom_file = os.path.join(dist_dir, "sbom.spdx.json")
    sbom_data = {
        "spdxVersion": "SPDX-2.3",
        "dataLicense": "CC0-1.0",
        "SPDXID": "SPDXRef-DOCUMENT",
        "name": "Sanctum Desktop SBOM",
        "documentNamespace": f"https://github.com/avirooppal/Sanctum/spdxdocs/sanctum-{VERSION}",
        "creationInfo": {
            "created": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "creators": ["Organization: Sanctum Contributors"],
        },
        "packages": [
            {
                "name": "Sanctum",
                "SPDXID": "SPDXRef-Package-Sanctum",
                "versionInfo": VERSION,
                "packageFileName": exe_name,
                "downloadLocation": "https://github.com/avirooppal/Sanctum/releases",
                "licenseConcluded": "MIT",
                "checksums": [{"algorithm": "SHA256", "checksumValue": sha256_exe}],
            },
            {
                "name": "next",
                "SPDXID": "SPDXRef-Package-NextJS",
                "versionInfo": locked_version("next"),
                "downloadLocation": "https://registry.npmjs.org/next",
                "licenseConcluded": "MIT",
            },
            {
                "name": "react",
                "SPDXID": "SPDXRef-Package-React",
                "versionInfo": locked_version("react"),
                "downloadLocation": "https://registry.npmjs.org/react",
                "licenseConcluded": "MIT",
            },
            {
                "name": "zustand",
                "SPDXID": "SPDXRef-Package-Zustand",
                "versionInfo": locked_version("zustand"),
                "downloadLocation": "https://registry.npmjs.org/zustand",
                "licenseConcluded": "MIT",
            },
        ],
    }
    with open(sbom_file, "w", encoding="utf-8") as f:
        json.dump(sbom_data, f, indent=2)
    print(f"Generated {sbom_file}")


if __name__ == "__main__":
    package()
