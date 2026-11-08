#!/usr/bin/env bash
# Decides from the changed files what a workflow has to do. Writes `name=true|false` lines to
# stdout and to $GITHUB_OUTPUT. Anything unexpected (unknown base, git or API error) yields `true`:
# the work is done rather than skipped.
#
#   changes.sh ci <base> <head>   -> code, licenses, policies
#   changes.sh deploy <head>      -> shipped   (needs GH_TOKEN and REPO to find the last deployment)
#
# Safety of skipping: a file is only ever excluded when no build step, check or test reads it.
# Everything else, including every file this script does not know, counts as a change.
set -uo pipefail

# Files that neither the build, nor the checks, nor the tests read (see `ci_excluded`).
# `docs/` holds the repository's own notes: sync-docs reads docs/vault of *datalith-app*, not this
# repository. `.github/` is only read by GitHub itself, except ci.yml, which defines the checks.
ci_excluded() {
    case "$1" in
        .github/workflows/ci.yml) return 1 ;;
        README.md | CHANGELOG.md | CONTRIBUTING.md | docs/* | .github/* | .pre-commit-config.yaml | renovate.json | .env.example) return 0 ;;
        *) return 1 ;;
    esac
}

# The site that is deployed is built from the repository files, so the CI exclusions apply, except
# that a change to the deploy workflow itself must deploy, and that the CI-only files never matter.
deploy_excluded() {
    case "$1" in
        .github/workflows/deploy.yml) return 1 ;;
        .github/workflows/ci.yml | scripts/ci/*) return 0 ;;
        *) ci_excluded "$1" ;;
    esac
}

# Inputs of the license and policy checks (the same as the prek hooks).
LICENSES_INPUTS='^(package(-lock)?\.json|THIRD-PARTY-NOTICES\.md|LICENSE|scripts/(licenses|lib)/|\.github/workflows/ci\.yml)'
POLICIES_INPUTS='^(package(-lock)?\.json|policygen\.json|scripts/(policies|lib)/|src/pages/(privacy|terms)/|\.github/workflows/ci\.yml)'

emit() {
    echo "$1=$2"
    if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "$1=$2" >>"$GITHUB_OUTPUT"; fi
}

changed_files() { git diff --name-only --no-renames "$1" "$2" --; }

# True when at least one changed file is not excluded by the given predicate.
any_not_excluded() {
    local predicate=$1 file
    while IFS= read -r file; do
        [ -n "$file" ] || continue
        "$predicate" "$file" || return 0
    done
    return 1
}

mode=${1:-}
case "$mode" in
    ci)
        base=${2:-} head=${3:-}
        if [ -z "$base" ] || ! files=$(changed_files "$base" "$head" 2>/dev/null); then
            echo "::notice title=Full CI::unknown base '$base': running every check" >&2
            emit code true
            emit licenses true
            emit policies true
            exit 0
        fi
        if any_not_excluded ci_excluded <<<"$files"; then emit code true; else emit code false; fi
        if grep -Eq "$LICENSES_INPUTS" <<<"$files"; then emit licenses true; else emit licenses false; fi
        if grep -Eq "$POLICIES_INPUTS" <<<"$files"; then emit policies true; else emit policies false; fi
        ;;
    deploy)
        head=${2:-}
        # The last successful GitHub Pages deployment: its commit is what is live now. Taking the
        # difference since then (not only the push) also covers pushes whose deployment was
        # skipped, cancelled or failed.
        base=
        if [ -n "${REPO:-}" ] && deployments=$(gh api "repos/$REPO/deployments?environment=github-pages&per_page=20" --jq '.[] | "\(.id) \(.sha)"' 2>/dev/null); then
            while read -r id sha; do
                [ -n "$id" ] || continue
                state=$(gh api "repos/$REPO/deployments/$id/statuses?per_page=1" --jq '.[0].state' 2>/dev/null) || continue
                if [ "$state" = success ]; then base=$sha; break; fi
            done <<<"$deployments"
        fi
        if [ -z "$base" ] || ! files=$(changed_files "$base" "$head" 2>/dev/null); then
            echo "::notice title=Deploy::no usable previous deployment: deploying" >&2
            emit shipped true
            exit 0
        fi
        echo "Changes since the deployed commit $base:" >&2
        sed 's/^/  /' <<<"$files" >&2
        if any_not_excluded deploy_excluded <<<"$files"; then emit shipped true; else emit shipped false; fi
        ;;
    *)
        echo "usage: changes.sh ci <base> <head> | changes.sh deploy <head>" >&2
        exit 2
        ;;
esac
