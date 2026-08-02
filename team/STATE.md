# STATE — Marian Tutor live coordination

**Resume next-action:** _Idle — board not scanned this session. Nothing dispatched, no agent in flight, no PR open. **Before your first dispatch, read the seven new `##` doctrine sections in `CLAUDE.md`** (landed 2026-08-02 in PR #490, `976beef`) — three of them reverse habits earlier sessions ran on, so acting from memory will be wrong._

> **The doctrine is LIVE as of `976beef`.** What changed for you, concretely:
>
> - **Dispatch briefs must NAME 1–3 docs.** The blanket "read every `.claude/docs/*.md`" rule is gone; the routing table is in `CLAUDE.md § Sub-agents — read the SCOPED docs at start`. Any brief template still saying "read them all" is stale.
> - **`APPROVE_WITH_NITS` no longer exists.** Two verdicts only. Reviews may not create tickets; nits are fixed in-PR or dropped. Docs-only and test-only PRs get no reviewer.
> - **Agents may not create tickets**, except a bug reproduced in the deployed PWA.
> - **Idle is free.** Scan the whole board so you never wrongly conclude "all gated" — then dispatch only what earns its cost. A justified idle slot is a valid outcome; say why.
> - **`maintain-docs` needs a named incident with a named cost.** `NO_CHANGES` is the expected result (3/3 runs in the landing session returned it). If several consecutive runs all produce edits, the gate is being read too loosely.
> - **Kill switch:** any calendar week with zero `feat` merges retires the standing team — `git log origin/main --since="7 days ago" --pretty=%s | grep -c "^feat"`.
>
> Two project-scoped memories were reconciled to match (`feedback_drain_isnt_stop_signal`, `feedback_constant_work`); they live outside the repo in `~/.claude/projects/`.

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

_(none — PR #490 merged 2026-08-02 17:05 UTC as `976beef`)_

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
