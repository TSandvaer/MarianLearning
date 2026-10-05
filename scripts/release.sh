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
# The first production deploy after a while has twice returned "Not authorized"
# and succeeded on an immediate retry (2026-10-04 and 2026-10-05), so retry once.
if ! vercel deploy --prod --yes && ! { echo 'release: retrying once…'; vercel deploy --prod --yes; }; then
  cat <<'MSG'
release: Vercel refused the production deploy (seen once on 2026-10-04 as
"Not authorized"; it did not reproduce minutes later). Workaround that worked:
  1. vercel deploy --yes          (preview of the same clean main)
  2. Vercel dashboard → Deployments → that preview → ⋯ → Promote to Production
  3. gh workflow run post-deploy-smoke.yml --ref main
MSG
  exit 1
fi
gh workflow run post-deploy-smoke.yml --ref main
echo "Smoke check dispatched: gh run list --workflow post-deploy-smoke.yml --limit 1"
