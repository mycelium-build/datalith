#!/usr/bin/env bash
# prek hook: runs `npm run licenses:check` when dependency or license files change.
# Stale notices are regenerated and staged, so the commit goes through with them.
# The notices also list the bundled assets: they need the generated site data (`npm run prebuild`).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if npm run --silent licenses:check; then
    exit 0
fi

echo "License notices are stale: regenerating." >&2
npm run --silent licenses:generate
npm run --silent licenses:check
git add -- THIRD-PARTY-NOTICES.md
echo "Regenerated and staged THIRD-PARTY-NOTICES.md." >&2
