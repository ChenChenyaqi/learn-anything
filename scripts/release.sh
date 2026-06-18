#!/usr/bin/env bash
#
# release.sh <version> — automated release workflow.
#
# Reads release notes from ./release-notes.md (gitignored) and runs:
#   A. develop → release/v<version> → PR to main
#   B. wait CI (Build+Test) → merge → tag → GitHub release
#   C. sync main back to develop via PR
#
# Usage:
#   1. Write your release notes into ./release-notes.md (markdown body).
#   2. Run:  ./scripts/release.sh 1.3.0
#
set -euo pipefail

VERSION="${1:-}"
NOTES_FILE="release-notes.md"

die() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }
log()  { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }

cd "$(git rev-parse --show-toplevel)"

# ─── preflight ──────────────────────────────────────────────────────────────
log "Preflight checks"
[ -n "$VERSION" ] || die "Usage: ./scripts/release.sh <version>   (e.g. 1.3.0)"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Version must be semver x.y.z"
[ "$(git rev-parse --abbrev-ref HEAD)" = "develop" ] || die "Must run on branch 'develop'"
git diff --quiet && git diff --cached --quiet || die "Working tree must be clean"
[ -f "$NOTES_FILE" ] || die "$NOTES_FILE not found in repo root (write your release notes there)"
[ -s "$NOTES_FILE" ] || die "$NOTES_FILE is empty"

CURRENT_VERSION="$(awk -F'"' '/"version":/ {print $4; exit}' packages/cli/package.json)"

ver_gt() {
  local a b i
  local IFS=.
  a=($1)
  b=($2)
  for i in 0 1 2; do
    (( ${a[i]:-0} > ${b[i]:-0} )) && return 0
    (( ${a[i]:-0} < ${b[i]:-0} )) && return 1
  done
  return 1
}
ver_gt "$VERSION" "$CURRENT_VERSION" || die "Version $VERSION must be greater than current $CURRENT_VERSION"

DATE="$(date +%F)"
RELEASE_BRANCH="release/v$VERSION"
SYNC_BRANCH="sync/main-to-develop-v$VERSION"
log "Releasing v$VERSION (current v$CURRENT_VERSION) · $DATE"

# ─── A. prepare ─────────────────────────────────────────────────────────────
log "A1 · create $RELEASE_BRANCH from develop"
git checkout -b "$RELEASE_BRANCH"

log "A2 · update CHANGELOG.md"
NOTES_PATH="$NOTES_FILE" awk -v new="$VERSION" -v date="$DATE" '
  BEGIN {
    p = ENVIRON["NOTES_PATH"]
    body = ""
    while ((getline line < p) > 0) body = body line "\n"
    close(p)
  }
  /^## \[/ && !done {
    print "## [" new "] - " date
    print ""
    printf "%s", body
    print ""
    done = 1
  }
  { print }
' CHANGELOG.md > CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md

awk -v prev="$CURRENT_VERSION" -v new="$VERSION" '
  /^\[Unreleased\]:/ {
    sub("v" prev "...HEAD", "v" new "...HEAD")
    print
    print "[" new "]: https://github.com/ChenChenyaqi/learn-anything/compare/v" prev "...v" new
    next
  }
  { print }
' CHANGELOG.md > CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md

log "A3 · bump version in both package.json"
awk -v v="$VERSION" '/"version":/ && !d {gsub(/"[0-9]+\.[0-9]+\.[0-9]+"/, "\"" v "\""); d=1} {print}' packages/cli/package.json > .pkg.tmp && mv .pkg.tmp packages/cli/package.json
awk -v v="$VERSION" '/"version":/ && !d {gsub(/"[0-9]+\.[0-9]+\.[0-9]+"/, "\"" v "\""); d=1} {print}' packages/cli/site/package.json > .pkg.tmp && mv .pkg.tmp packages/cli/site/package.json

log "A4 · verify changes"
grep -q "\"$VERSION\"" packages/cli/package.json || die "cli version bump failed"
grep -q "\"$VERSION\"" packages/cli/site/package.json || die "site version bump failed"
grep -q "\[$VERSION\]" CHANGELOG.md || die "CHANGELOG entry missing"

log "A5 · commit & push"
git add CHANGELOG.md packages/cli/package.json packages/cli/site/package.json
git commit -m "chore(release): v$VERSION"
git push -u origin "$RELEASE_BRANCH"

log "A6 · open PR to main"
PR_URL="$(gh pr create --base main --head "$RELEASE_BRANCH" --title "chore(release): v$VERSION" --body-file "$NOTES_FILE")"
PR_NUM="${PR_URL##*/}"
echo "    PR #$PR_NUM → main: $PR_URL"

# ─── B. merge & publish ─────────────────────────────────────────────────────
log "B1 · wait for CI on release PR"
sleep 10
gh pr checks "$PR_NUM" --watch || die "CI failed on release PR #$PR_NUM"

log "B2 · merge release PR (create a merge commit)"
gh pr merge "$PR_NUM" --merge --delete-branch

log "B3 · checkout main, tag & push"
git checkout main
git pull origin main
git tag "v$VERSION"
git push origin "v$VERSION"

log "B4 · publish GitHub release"
gh release create "v$VERSION" --title "v$VERSION" --notes-file "$NOTES_FILE"
echo "    https://github.com/ChenChenyaqi/learn-anything/releases/tag/v$VERSION"

# ─── C. sync develop ────────────────────────────────────────────────────────
log "C1 · sync main back to develop"
git checkout develop
git pull origin develop
git checkout -b "$SYNC_BRANCH"
git merge origin/main --no-edit

log "C2 · push sync branch & open PR"
git push -u origin "$SYNC_BRANCH"
SYNC_URL="$(gh pr create --base develop --head "$SYNC_BRANCH" --title "sync: main → develop after v$VERSION" --body "Bring release v$VERSION changes from main back to develop.")"
SYNC_NUM="${SYNC_URL##*/}"
echo "    PR #$SYNC_NUM → develop: $SYNC_URL"

log "C3 · wait for CI on sync PR"
sleep 10
gh pr checks "$SYNC_NUM" --watch || die "CI failed on sync PR #$SYNC_NUM"

log "C4 · merge sync PR"
gh pr merge "$SYNC_NUM" --merge --delete-branch

git checkout develop
git pull origin develop

log "C5 · cleanup local branches"
git branch -D "$RELEASE_BRANCH" 2>/dev/null || true
git branch -D "$SYNC_BRANCH" 2>/dev/null || true

log "✅ Released v$VERSION"
