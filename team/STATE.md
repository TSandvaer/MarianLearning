# STATE — Marian Tutor live coordination

**Resume next-action:** _Awaiting Thomas's review+merge of the Far-Horizon alignment PR (branch `chore/far-horizon-alignment-2026-08-02`). Nothing is dispatched and nothing is blocked on an agent. **On merge, the doctrine in `CLAUDE.md` changes** — read the seven new `##` sections before the next orchestration tick, because three of them (idle-is-free, reviews-never-create-tickets, agents-may-not-create-tickets) reverse habits earlier sessions ran on._

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

- **Thomas review+merge** — the alignment PR. Only open item.

## Known loose ends (not blocking)

- **Untracked files predating 2026-08-02, deliberately left alone** — `.claude/claudeteam.yaml`,
  `.skirt-swatch.html`, `.skirt-swatch.png`, `design/dispatch-contract.md`,
  `design/project-analysis-2026-07-06.md`. Not reviewed by the alignment pass; decide separately.
- **`.claude/log/away-queue-archive-2026-08-02.md` carries ~71 lines of pre-2026-08-02 uncommitted
  away-queue content** that was dirty in the working tree before this session. It rides along in the
  archive commit — the entries are historical, so this is capture, not loss.
- **`feedback_no_idle_no_stale_agents`** was NOT rewritten in the memory reconciliation. Its
  _staleness-detection_ half stands; its _never-idle_ half is now superseded by
  `CLAUDE.md § Idle is free`. Both sibling memories carry a pointer saying so, but the entry itself
  still reads never-idle-first. Worth a pass if it causes friction.
