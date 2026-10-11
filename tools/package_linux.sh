#!/usr/bin/env bash
# Package Sanctum into a verifiable, self-contained Linux archive (.tar.gz) and standalone directory.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="${ROOT}/dist"
PKG_NAME="sanctum-linux-x86_64"
TARGET_DIR="${DIST_DIR}/${PKG_NAME}"

echo "=== Packaging Sanctum Linux Distribution ==="
mkdir -p "${DIST_DIR}"
rm -rf "${TARGET_DIR}"
mkdir -p "${TARGET_DIR}/bin" "${TARGET_DIR}/web" "${TARGET_DIR}/profiles" "${TARGET_DIR}/docs"

# 1. Build and copy web assets
echo "1. Checking/copying production web assets..."
if [ ! -d "${ROOT}/apps/web/dist" ]; then
    echo "apps/web/dist not found. Please run 'npm run build --prefix apps/web' first."
    exit 1
fi
cp -r "${ROOT}/apps/web/dist/"* "${TARGET_DIR}/web/"


# 2. Build and copy daemon runtime
echo "2. Building release binary (or copying debug binary)..."
if [ -f "${ROOT}/target/release/sanctum-runtime" ]; then
    cp "${ROOT}/target/release/sanctum-runtime" "${TARGET_DIR}/bin/"
elif [ -f "${ROOT}/target/debug/sanctum-runtime" ]; then
    cp "${ROOT}/target/debug/sanctum-runtime" "${TARGET_DIR}/bin/"
fi

# 3. Copy profiles and license notices
echo "3. Copying configuration profiles and notices..."
cp -r "${ROOT}/profiles/"* "${TARGET_DIR}/profiles/"
cp "${ROOT}/LICENSE" "${TARGET_DIR}/"
cp "${ROOT}/THIRD_PARTY_NOTICES.md" "${TARGET_DIR}/"
cp "${ROOT}/README.md" "${TARGET_DIR}/docs/"

# 4. Create launcher installer script
cat << 'EOF' > "${TARGET_DIR}/install.sh"
#!/usr/bin/env bash
set -euo pipefail
PREFIX="${1:-$HOME/.local}"
echo "Installing Sanctum to ${PREFIX}..."
mkdir -p "${PREFIX}/bin" "${PREFIX}/share/sanctum"
cp -r web profiles "${PREFIX}/share/sanctum/"
if [ -f bin/sanctum-runtime ]; then
    cp bin/sanctum-runtime "${PREFIX}/bin/"
fi
echo "Sanctum installation complete."
EOF
chmod +x "${TARGET_DIR}/install.sh"

# 5. Archive and create SHA256 checksums
echo "4. Creating tarball and computing checksums..."
(cd "${DIST_DIR}" && tar -czf "${PKG_NAME}.tar.gz" "${PKG_NAME}")
(cd "${DIST_DIR}" && sha256sum "${PKG_NAME}.tar.gz" > "${PKG_NAME}.tar.gz.sha256")

echo "=== Linux Packaging Complete ==="
echo "Artifact: ${DIST_DIR}/${PKG_NAME}.tar.gz"
cat "${DIST_DIR}/${PKG_NAME}.tar.gz.sha256"
