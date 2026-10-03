#!/usr/bin/env bash
# Manual production release. Pushes to main no longer auto-deploy
# (vercel.json: git.deploymentEnabled.main = false), so production ships only
# from here. `vercel --prod` uploads the LOCAL working tree, so refuse unless
# it is a clean checkout of main that matches origin/main exactly.
set -euo pipefail

git fetch origin main --quiet
branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" = "main" ] || { echo "release: checkout main first (on '$branch')"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "release: working tree not clean"; exit 1; }
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || {
  echo "release: local main differs from origin/main — push or pull first"; exit 1; }

echo "Releasing $(git log -1 --format='%h %s') to production…"
vercel --prod
gh workflow run post-deploy-smoke.yml --ref main
echo "Smoke check dispatched: gh run list --workflow post-deploy-smoke.yml --limit 1"
