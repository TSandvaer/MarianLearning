# STATE — Marian Tutor live coordination

**Resume next-action:** _2026-10-20 07:50Z: RELEASED fc16006 (wave 5 #617/#621, profiles A+B #622/#634, planner #631, avatars #633, take-away #624, flower-bed game #635 with soil beds); smoke SUCCESS; TestFlight build 16 EAS a348688d (auto-submit b429e7ec); baseline PR #641 merge on green. Next: Thomas installs build 16 on BOTH devices -> profiles device ACs 39-42. Real blending #636 (Kevin) + #637 (Devon) approved but HELD: merge main, CI, ear test 31 lines, device ACs 18-20, then build 17 BEFORE any yarn release. Profiles phase 3 name audio starts after build 16 (Thomas). Auto-status ON local (cron 1be7c5ac). Code merges/releases/builds need Thomas._

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
