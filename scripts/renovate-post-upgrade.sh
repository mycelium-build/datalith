#!/usr/bin/env bash
# Renovate post-upgrade task: dependency updates change THIRD-PARTY-NOTICES.md.
# Regenerates it from the updated lockfile. The notices also list the bundled assets, so the
# assets are first synced from datalith-app (a public repository: an anonymous clone is enough).
set -euo pipefail

cd "$(dirname "$0")/.."
npm ci --ignore-scripts
env -u DATALITH_SOURCE_DIR npm run sync-assets
npm run licenses:generate
