# STATE — Marian Tutor live coordination

**Resume next-action:** _2026-10-16 evening: Content wave 1 SHIPPED (build 9 on the iPad, production af804cb, voice-QA baseline 55afdf3, Thomas's device check passed). Nothing in flight. Open with Thomas: iPhone to build 9; optional cleanup batch (old scratch worktrees, stale branches, Azure env vars in Vercel); Kyle's open picture questions (redraw the 8 simple-sentence scenes? the web copy of the pictures?). Next content comes from Dave's roadmap (#569) on Thomas's go._

_Earlier headers and log-like sections (2026-08-02 to 2026-10-14) are archived verbatim in [`log/state-archive-2026-08-02-to-2026-10-14.md`](log/state-archive-2026-08-02-to-2026-10-14.md)._

---

## What this file is

A **resume header, not a log** (`CLAUDE.md § Coordination docs stay small`). The first line answers
one question: _"if this session dies right now, what should the next orchestrator do next?"_ It is
**always current or explicitly idle** — never stale. If the orchestrator is between turns and
uncertain, the header says `Idle; next action depends on <event>`. Honest beats confident-wrong.

Superseded content does **not** accumulate here. Material decisions graduate to
[`DECISIONS.md`](DECISIONS.md); closed away-queue items and reviewed autonomy entries go to
`.claude/log/`. Target size: **under ~10 KB**.

Refresh the header on **every** dispatch, merge, and material decision.

## In-flight agents

Record the **agentId** at dispatch — it is the load-bearing identifier across session restarts
(name addressability decays). Include dispatch time and expected-by so staleness comparisons have a
reference point.

| Persona  | agentId | Ticket | Dispatched (UTC) | Expected by | Last verified |
| -------- | ------- | ------ | ---------------- | ----------- | ------------- |
| _(none)_ |         |        |                  |             |               |

> Liveness is reported **from a fresh probe only** — `SendMessage` by agentId + `git log` on the
> persona worktree + `gh pr view`. The absence of a `<task-notification>` is not evidence an agent is
> alive.

## Open PRs

| PR                | Branch | Author | State | Gate |
| ----------------- | ------ | ------ | ----- | ---- |
| _(none recorded)_ |        |        |       |      |

> Failing-first PRs awaiting an upstream merge are **healthy** and stay open across sessions — drain
> must not merge or close them (`feedback_failing_first_pr_open_across_sessions`).

## Current gates

_(see the resume header)_
