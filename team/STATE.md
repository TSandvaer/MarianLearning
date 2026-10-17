# STATE — Marian Tutor live coordination

**Resume next-action:** _2026-10-17: Content wave 2 SHIPPED (build 10 on the iPad, production 2e2675f, smoke green). In flight: Map tap-to-play #592 (Kevin review, Lily render of 60 lines), then Thomas's ear test and iPad look; it has a server change, so `yarn release` BEFORE TestFlight build 11. Voice-QA baseline #590 merging._

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
