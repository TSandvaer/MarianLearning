# Decisions log — orchestrator autonomy audit trail

Every decision the orchestrator makes autonomously (under the four gates in user-global
§ "Orchestrator autonomy": reversible, foundation-citable, not on the never-auto-decide list, logged
BEFORE execution) is recorded here. Thomas reviews on return and marks each entry `accepted` or
`reversed`. Calibration target: **5–10% reversal rate**.

Filename retained for path stability with the historic logs and the user-global rule that names it.

**This file stays small.** Per `CLAUDE.md § Coordination docs stay small`: once entries are reviewed
and the calibration signal is taken, archive them under `.claude/log/` rather than letting the file
accrete. If it passes ~10 KB, archive the reviewed entries.

> **History:** every decision logged through 2026-08-02 is archived at
> [`.claude/log/decisions-while-away-archive-2026-08-02.md`](log/decisions-while-away-archive-2026-08-02.md)
> (78 KB). That archive is read-only history; do not append to it.

## Entry schema

```
## YYYY-MM-DD HHMM UTC — <one-line headline>
- **Decided:** <what was done, concrete and specific>
- **Foundation:** <cited memory name / doc section + path / prior-session precedent>
- **Alternative:** <what surfacing would have produced as the other option>
- **Reversibility:** <how to undo + estimated effort>
- **Status:** pending review | accepted | reversed by <user> <date>
```

## Entries

_(none since the 2026-08-02 archive)_
