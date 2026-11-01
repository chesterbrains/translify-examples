#!/usr/bin/env sh
# Proof that Ruby's I18n reads the pulled files and that they are already in i18n-tasks' canonical layout:
# render every key for it and compare with expected/it.json, then run `i18n-tasks normalize` and fail on any
# change to config/locales (compared with a snapshot taken before, so no git is needed). Needs Ruby and Bundler.
set -eu
cd "$(dirname "$0")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
bundle exec ruby app.rb it > "$tmp/it.json"
diff "$tmp/it.json" expected/it.json
cp -R config/locales "$tmp/locales"
bundle exec i18n-tasks normalize
diff -r "$tmp/locales" config/locales
echo "ok: it output matches expected/it.json and normalize leaves config/locales unchanged"
