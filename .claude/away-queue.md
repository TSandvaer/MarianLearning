# Away queue — items staged for Thomas

Actions the orchestrator may **not** auto-execute (externally-visible, destructive, billing/infra,
strategic-priority, or subjective-feel) are staged here as ready-to-approve drafts instead of being
performed. Thomas reviews on return and approves in one click.

**This file is a QUEUE, not a log.** Per `CLAUDE.md § Coordination docs stay small`: once an item is
approved, rejected, or otherwise closed, delete the entry — do not accumulate history here. Closed
history lives in `.claude/log/`. If this file passes ~10 KB, archive the closed entries.

> **History:** everything queued through 2026-08-02 is archived at
> [`.claude/log/away-queue-archive-2026-08-02.md`](log/away-queue-archive-2026-08-02.md) (63 KB).
> That archive is read-only history; do not append to it.

## Entry schema

```
## ENTRY-NNN — <one-line headline>
- **Staged:** YYYY-MM-DD HHMM UTC
- **Action needed:** <the exact thing Thomas must approve or do>
- **Why it can't be auto-decided:** <never-auto-decide class it falls under>
- **Draft / artifact:** <the ready-to-approve content, command, or link>
- **Status:** pending review | approved <date> | rejected <date>
```

## Open items

## ENTRY-001 — force-push the rebased alignment branch (PR #490)

- **Staged:** 2026-08-02
- **Action needed:** push the locally-rebased `chore/far-horizon-alignment-2026-08-02` over its remote
  tip, so PR #490 stops reading `CONFLICTING`:

  ```
  git push --force-with-lease origin chore/far-horizon-alignment-2026-08-02
  ```

- **Why it can't be auto-decided:** force-push is on the never-auto-decide list, and is now blocked by
  **both** layers this PR introduces — `permissions.deny` and `block-destructive-bash.sh`. The guard
  fired correctly; retrying or routing around it would defeat the thing being shipped.
- **State (verified 2026-08-02):**
  - local HEAD `00d4889` — rebased onto `origin/main` `cea94c3`, 2 commits ahead, working tree clean
  - remote branch tip `9e2b875` — the pre-rebase SHA that PR #490 currently shows
  - the rebase resolved 2 conflicts: `.claude/away-queue.md` (log-only; archive verified as a strict
    superset of main's version — 0 orphan lines) and `.claude/docs/planner-and-canon.md`
    (2 hunks, both purely prettier emphasis-marker normalization, no prose difference)
- **Draft / artifact:** the command above. Nothing else is pending on the branch.
- **Status:** **approved 2026-08-02** — cleared not by exception but by narrowing the rule: the
  lease-based family (`--force-with-lease`, `--force-if-includes`) is now allowed in both layers,
  bare `--force`/`-f` still blocked. See `CLAUDE.md`-adjacent detail in the alignment plan § V-2.
  Retained here as the worked example of the stage-don't-bypass path.
