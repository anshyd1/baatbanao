#!/usr/bin/env bash
# Re-copy the Tesseract.js runtime into vendor/tesseract/ so the app stays
# CSP-safe (self-hosted) and offline-capable.
#
#   bash tools/update-tesseract.sh
#
# Run this whenever you bump the versions below. Commit the result — the
# files are served straight from the repo (Vercel), there is no build step.
set -euo pipefail

TESS_VERSION="${TESS_VERSION:-5.1.1}"
CORE_VERSION="${CORE_VERSION:-5.1.1}"

DEST="$(cd "$(dirname "$0")/.." && pwd)/vendor/tesseract"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> fetching tesseract.js@$TESS_VERSION / tesseract.js-core@$CORE_VERSION"
cd "$TMP"
npm init -y >/dev/null 2>&1
npm i --no-audit --no-fund --silent \
  "tesseract.js@$TESS_VERSION" "tesseract.js-core@$CORE_VERSION"

echo "==> fetching tessdata_fast eng (1.98 MB .gz — the 10.9 MB standard model"
echo "    measured ZERO accuracy gain on our bills, so we ship fast)"
curl -fsSL -o eng.traineddata \
  "https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@main/eng.traineddata"
gzip -9 -f eng.traineddata

mkdir -p "$DEST/tessdata"
cp node_modules/tesseract.js/dist/tesseract.min.js          "$DEST/tesseract.min.js"
cp node_modules/tesseract.js/dist/worker.min.js             "$DEST/worker.min.js"
cp node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js "$DEST/"
cp node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js      "$DEST/"
cp node_modules/tesseract.js-core/LICENSE                   "$DEST/LICENSE.core"
cp node_modules/tesseract.js/dist/tesseract.min.js.LICENSE.txt "$DEST/LICENSE.tesseract.js"
mv eng.traineddata.gz "$DEST/tessdata/eng.traineddata.gz"

echo "==> done. Contents of vendor/tesseract:"
du -sh "$DEST"
ls -la "$DEST" "$DEST/tessdata"

echo
echo "REMEMBER: bump CACHE_VERSION in service-worker.js and the ?v= query on"
echo "voice-ocr.js in index.html so returning visitors pick up the new engine."
