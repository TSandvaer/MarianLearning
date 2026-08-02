#!/usr/bin/env bash
# Smoke test for .claude/hooks/block-destructive-bash.sh
#
# Feeds crafted PreToolUse JSON payloads to the hook and asserts deny/allow.
# NOTHING is executed — the hook only inspects command TEXT and prints a decision,
# so this is safe to run anywhere.
#
# Run after ANY change to the hook's patterns:
#   bash scripts/smoke-destructive-hook.sh
#
# Why this exists: the hook was imported from Far-Horizon in the 2026-08-02
# alignment pass (.claude/alignment/alignment-plan-Far-Horizon-2026-08-02.md).
# The first run caught a real defect — the branch-delete check used `grep -Eqi`,
# and the `-i` folded the SAFE lowercase `git branch -d` (merged-only delete)
# into the `-D` force-delete match, which would have blocked routine
# post-squash-merge cleanup. Fixed by making that one check case-sensitive.
# The false-positive cases below are the regression guard for that class of bug:
# a guard that is too eager is as costly as one that is too lax.
#
# The hook is FAIL-OPEN by design (any parse problem -> allow), so a broken
# interpreter degrades to "no protection" silently rather than blocking work.
# That is exactly why this test asserts the DENY cases explicitly.

set -u

HOOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.claude/hooks/block-destructive-bash.sh"

if [ ! -f "$HOOK" ]; then
  echo "FATAL: hook not found at $HOOK" >&2
  exit 2
fi

echo "hook: $HOOK"
echo "interpreter check:"
echo "  python3 -> $(command -v python3 || echo NONE)"
echo "  python  -> $(command -v python || echo NONE)"
PY="$(command -v python3 || command -v python || true)"
if [ -z "$PY" ]; then
  echo "FATAL: no python interpreter — the hook would fail-open (allow everything)." >&2
  exit 2
fi
echo "  version -> $("$PY" -c 'import sys;print(sys.version.split()[0])' 2>&1 | head -1)"
echo

fails=0

run() {
  local expect="$1" cmd="$2"
  local payload out got mark
  payload="$("$PY" -c 'import json,sys; print(json.dumps({"tool_name":"Bash","tool_input":{"command":sys.argv[1],"description":"smoke test"}}))' "$cmd")"
  out="$(printf '%s' "$payload" | bash "$HOOK" 2>&1)"
  got="ALLOW"
  case "$out" in *'"deny"'*) got="DENY";; esac
  if [ "$got" = "$expect" ]; then
    mark="ok  "
  else
    mark="FAIL"
    fails=$((fails + 1))
  fi
  printf '%s  %-5s expect=%-5s  %s\n' "$mark" "$got" "$expect" "$cmd"
}

echo "=== should DENY (destructive) ==="
run DENY 'git reset --hard HEAD~1'
run DENY 'git push --force origin main'
run DENY 'git push origin main --force'          # flag-order robustness
run DENY 'git push --force-with-lease origin feat/x'
run DENY 'rm -rf /c/tmp/somedir'
run DENY 'cd /tmp && rm -fr build'               # leading-verb + chained
run DENY 'gh repo delete TSandvaer/MarianLearning'
run DENY 'git branch -D feat/old-branch'
run DENY 'Remove-Item -Recurse -Force C:\tmp\x'

echo
echo "=== should ALLOW (false-positive guard) ==="
run ALLOW 'git status'
run ALLOW 'git push origin main'
run ALLOW 'git commit -m "explain why rm -rf is dangerous"'        # quoted-span strip
run ALLOW 'gh pr create --body "do not use git push --force here"' # quoted-span strip
run ALLOW 'git branch -d feat/merged-branch'                       # -d is SAFE, not -D
run ALLOW 'yarn build'

echo
if [ "$fails" -eq 0 ]; then
  echo "PASS — all cases behaved as expected."
  exit 0
fi
echo "FAIL — $fails case(s) wrong. Do not ship the hook in this state."
exit 1
