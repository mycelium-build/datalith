#!/usr/bin/env bash
# prek hook: formats the files being committed (prek passes them as arguments) and stages the
# result, so the commit goes through formatted.
# prek sets unstaged changes aside while hooks run, so only staged content is formatted.
# If a file also has unstaged changes, prek cannot restore them over the formatting: it undoes the
# fix and stops the commit.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

npx --no-install vp fmt "$@"
git add -- "$@"
