#!/usr/bin/env sh
# Proof that Ruby's I18n reads the pulled files and that they are already in i18n-tasks' canonical layout:
# render every key for it and compare with expected/it.json, then run `i18n-tasks normalize` and fail on any
# change to config/locales (needs git, since the diff is the check). Needs Ruby and Bundler.
set -eu
cd "$(dirname "$0")"
bundle exec ruby app.rb it | diff - expected/it.json
bundle exec i18n-tasks normalize
git diff --exit-code -- config/locales
echo "ok: it output matches expected/it.json and normalize leaves config/locales unchanged"
