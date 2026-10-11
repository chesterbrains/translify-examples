#!/usr/bin/env bash
# Proof that Xcode accepts what `translify pull` writes: import the pulled Italian file into the
# catalog, then compare the catalog's `it-IT` localizations with expected/it.json. Needs Xcode (macOS).
set -euo pipefail
cd "$(dirname "$0")"
cp Sources/App/Localizable.xcstrings /tmp/Localizable.xcstrings.bak
trap 'cp /tmp/Localizable.xcstrings.bak Sources/App/Localizable.xcstrings' EXIT
xcodebuild -importLocalizations -localizationPath Localization/it.xliff 2>&1 | grep -E "Import started|WARNING|error" || true
python3 - <<'PY'
import json, sys
catalog = json.load(open('Sources/App/Localizable.xcstrings'))
actual = {key: entry.get('localizations', {}).get('it-IT') for key, entry in sorted(catalog['strings'].items())}
expected = json.load(open('expected/it.json'))
if actual != expected:
    print('MISMATCH\nactual:', json.dumps(actual, ensure_ascii=False, indent=1), '\nexpected:', json.dumps(expected, ensure_ascii=False, indent=1))
    sys.exit(1)
print('ok: it-IT localizations match expected/it.json')
PY
swift build 2>&1 | tail -1
