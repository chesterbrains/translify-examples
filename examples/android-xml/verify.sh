#!/usr/bin/env bash
# Proof that aapt2 accepts what `translify pull` writes: compile and link the resource tree, then compare
# the resource table with expected/dump.txt. Needs only the Android SDK build-tools (ANDROID_HOME).
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
AAPT2="$(ls -d "$SDK"/build-tools/*/aapt2 | sort -V | tail -1)"
JAR="$(ls -d "$SDK"/platforms/*/android.jar | sort -V | tail -1)"
rm -rf out && mkdir out
"$AAPT2" compile --dir app/src/main/res -o out/res.zip
"$AAPT2" link -o out/app.apk -I "$JAR" --manifest app/src/main/AndroidManifest.xml out/res.zip
"$AAPT2" dump resources out/app.apk | grep -v '^Binary' | diff - expected/dump.txt
echo ok
