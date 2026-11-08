#!/usr/bin/env bash
# Decides whether the commit pushed to main is a tree that its pull request already verified.
#
# Prints `verified=true|false` on stdout (and appends it to $GITHUB_OUTPUT when set).
# Anything unexpected (no PR, API error, failed check) yields `false`: the full CI then runs.
#
# Environment: GH_TOKEN, REPO (owner/name), SHA (the pushed commit), CHECK_NAME (default: quality).
set -uo pipefail

: "${REPO:?}" "${SHA:?}"
check_name="${CHECK_NAME:-quality}"

emit() {
    echo "verified=$1"
    if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "verified=$1" >>"$GITHUB_OUTPUT"; fi
    exit 0
}
reason() { echo "::notice title=Full CI::$*" >&2; emit false; }

commit=$(gh api "repos/$REPO/commits/$SHA") || reason "cannot read commit $SHA"
tree=$(jq -r '.commit.tree.sha' <<<"$commit")
parent=$(jq -r '.parents[0].sha // empty' <<<"$commit")

# Exactly one merged PR must be associated with the commit (merge, squash and rebase merges alike).
pulls=$(gh api "repos/$REPO/commits/$SHA/pulls" --jq '[.[] | select(.merged_at != null and .base.ref == "main")]') \
    || reason "cannot list pull requests of $SHA"
[ "$(jq length <<<"$pulls")" = 1 ] || reason "$SHA does not belong to exactly one merged pull request"
head=$(jq -r '.[0].head.sha' <<<"$pulls")

head_tree=$(gh api "repos/$REPO/git/commits/$head" --jq '.tree.sha') || reason "cannot read PR head $head"
[ "$head_tree" = "$tree" ] || reason "tree of PR head ($head_tree) differs from tree of $SHA ($tree)"

# The pull_request CI tests the merge of the PR into main. That merge equals the PR head only when
# the head already contains the previous tip of main; otherwise the tested tree was not this one.
if [ -n "$parent" ]; then
    status=$(gh api "repos/$REPO/compare/$parent...$head" --jq '.status') || reason "cannot compare $parent with $head"
    case "$status" in
        ahead | identical) ;;
        *) reason "PR head does not contain the previous main ($parent): compare status $status" ;;
    esac
fi

# The latest GitHub Actions run of the required job on the PR head must have succeeded.
conclusion=$(gh api "repos/$REPO/commits/$head/check-runs?per_page=100" \
    --jq "[.check_runs[] | select(.name == \"$check_name\" and .app.slug == \"github-actions\")]
          | sort_by(.started_at) | last | .conclusion // \"missing\"") \
    || reason "cannot read check runs of $head"
[ "$conclusion" = success ] || reason "check $check_name on $head is $conclusion"

echo "Tree $tree was verified by the CI of $head" >&2
emit true
