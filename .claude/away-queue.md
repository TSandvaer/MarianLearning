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

_(none)_
