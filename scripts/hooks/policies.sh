#!/usr/bin/env bash
# prek hook: runs `npm run policies:check` when the policy inputs change.
# Stale pages are regenerated and staged, so the commit goes through with them.
# The check ignores the "Last updated" date, so the pages are only rewritten when they are stale.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if npm run --silent policies:check; then
    exit 0
fi

echo "Policy pages are stale: regenerating." >&2
npm run --silent policies:generate
npm run --silent policies:check
git add -- src/pages/privacy/index.astro src/pages/terms/index.astro
echo "Regenerated and staged the privacy and terms pages." >&2
