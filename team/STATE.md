# STATE — Marian Tutor live coordination

**Resume next-action:** _2026-10-23: Prod = d58e7408. Main b297bcb5. TestFlight build 20 (EAS 48a0943c, from f10a29d2 = #666 Letter critters fixes) submitted; waiting for Marian's play on build 20, incl. whether a critter should travel with the drag hand (Thomas: judge in build 20 first; a follow-up only if he asks). No workers in flight, no PRs open except this docs PR and the intentionally open #473/#483/#485/#488. Blocked: splash + boing sound effects until Thomas enables Sound Effects on the ElevenLabs key (then start Kevin from tmp/specs/spec-kevin-play-sfx.txt). Unreleased on main since d58e7408: #656 #652 #657 #660 #663 #664 #665 #666 #667 (native + core + CI); next `yarn release` needs a popup. Thomas to run the removal of 2 old scratchpad worktrees (check617, fixws). Profiles phase 3 (name audio, spec #645) not started; its gate (profiles part B on both devices) is met now that build 17+ is on both._

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
