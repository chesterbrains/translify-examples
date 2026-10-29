#!/usr/bin/env bash
# Proof that Foundation reads what `translify pull` writes: lint the pulled tables, build the executable,
# format every key from it.lproj and compare with expected/it.json. Needs Swift and plutil (macOS).
set -euo pipefail
cd "$(dirname "$0")"
plutil -lint Sources/App/*.lproj/Localizable.strings Sources/App/*.lproj/Localizable.stringsdict
swift build 2>&1 | tail -1
swift run -q App it | diff - expected/it.json
echo "ok: it.lproj output matches expected/it.json"
