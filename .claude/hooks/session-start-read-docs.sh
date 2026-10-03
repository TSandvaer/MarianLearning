#!/usr/bin/env bash
# SessionStart hook — injects the INDEX of .claude/docs/ (names + one-line
# descriptions), not the docs themselves. The session reads the doc it needs.
#
# Why index-only (2026-10-03): the docs grew to ~684KB. Claude Code caps hook
# context, so the old full-text preload was saved to a file and only a ~2KB
# preview reached the model — while that preview told it "already in context,
# do NOT Read them". The docs were effectively never loaded.
#
# Index lines come from CLAUDE.md's "Detailed Documentation" list (single
# source of truth); any doc missing from that list is still named.
#
# Always exits 0; never blocks.

set -eu

DOCS_DIR="$CLAUDE_PROJECT_DIR/.claude/docs"
[ -d "$DOCS_DIR" ] || exit 0

shopt -s nullglob
docs=("$DOCS_DIR"/*.md)
[ ${#docs[@]} -gt 0 ] || exit 0

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

{
  echo "# Project documentation index (.claude/docs/)"
  echo
  echo "These docs are NOT preloaded. Before working in an area, Read the matching doc (the routing table in CLAUDE.md maps task class -> docs). The large docs (testing-and-ci, planner-and-canon, progress-and-persistence, skill-trees-and-content) are 90-210KB: grep for the section you need and Read with offset/limit rather than whole-file."
  echo
  for f in "${docs[@]}"; do
    name="$(basename "$f")"
    kb=$(( $(wc -c < "$f") / 1024 ))
    line="$(grep -F "(.claude/docs/$name)" "$CLAUDE_PROJECT_DIR/CLAUDE.md" 2>/dev/null | head -1 | sed -E 's/^- \[([^]]*)\]\([^)]*\) — /\1 — /')"
    echo "- \`.claude/docs/$name\` (${kb}KB) — ${line:-no index entry in CLAUDE.md}"
  done
} > "$TMP"

DOC_COUNT=${#docs[@]}
node -e '
const fs = require("fs");
const data = fs.readFileSync(process.argv[1], "utf8");
process.stdout.write(JSON.stringify({
  systemMessage: `Project docs index loaded (${process.argv[2]} files; read on demand).`,
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: data },
}));
' "$TMP" "$DOC_COUNT"
