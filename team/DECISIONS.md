# DECISIONS — Marian Tutor

**Append-only history.** Newest entries at the bottom. Never rewrite or delete an entry — if a
decision is later reversed, append a _new_ entry recording the reversal and cross-reference the
original. This file is the durable record that survives session restarts, compaction, and worktree
churn.

Distinct from its siblings:

- [`STATE.md`](STATE.md) — the _live_ resume header. Current only, small, overwritten freely.
- `.claude/decisions-while-away.md` — the _autonomy audit trail_ (orchestrator self-logged decisions
  pending Thomas's accept/reverse, for calibration). Entries there that turn out to be materially
  load-bearing graduate here.
- `.claude/log/` — closed history, read-only.

## Entry schema

```
## YYYY-MM-DD — <one-line headline>
- **Decided:** <what was decided, concrete and specific>
- **Foundation:** <cited memory slug / doc section + path / ticket / prior precedent>
- **Alternative considered:** <what was not chosen, and why>
- **Reversibility:** <how to undo + rough effort>
- **Decided by:** Thomas | orchestrator (autonomy gates) | team consensus
```

---

## 2026-08-02 — Adopt Far-Horizon's orchestration doctrine (alignment pass)

- **Decided:** Ran `/project-alignment-analysis` against `c:\Trunk\PRIVATE\Far-Horizon` and adopted 14
  of 21 forward candidates. Seven new `CLAUDE.md` sections (idle-is-free, reviews-never-create-tickets,
  agents-may-not-create-tickets, documentation-incident-gate, predict-before-soak, kill-switch,
  coordination-docs-stay-small); the blanket sub-agent docs-read rule replaced with a scoped 1–3-doc
  routing table; a `PreToolUse` destructive-bash guard + `permissions.deny` list; a SessionStart
  resume fresh-scan nudge; the `name-the-bar` skill + a seeded `.claude/quality-bars.md`; the
  incident gate grafted into `maintain-docs`; `team/STATE.md` + `team/DECISIONS.md` created; the 63 KB
  away-queue and 78 KB decisions-while-away archived to `.claude/log/`.
- **Foundation:** Far-Horizon's 2026-08-02 doctrine rewrite, which followed a measured failure —
  79 commits since its last `feat` (47 docs, 12 chore, 10 fix, 8 test, 1 spike, 1 ci, zero feat).
  Full candidate list, per-item decisions, and the four-check verification:
  [`.claude/alignment/alignment-plan-Far-Horizon-2026-08-02.md`](../.claude/alignment/alignment-plan-Far-Horizon-2026-08-02.md).
- **Alternative considered:** FH's hard team ceiling (1 dev + 1 reviewer + ≤1 support) was **skipped** —
  it is downstream of FH's Unity-build cap of 1, a serialized CI lane this project does not have.
  FH's full manual-only `maintain-docs` rewrite was **adapted rather than adopted**: the Stop-hook
  trigger is kept and the incident gate layered on top, with a documented tripwire if the gate stops
  holding.
- **Reversibility:** every change is additive or a verified-superset replacement; `git revert` of the
  alignment commit restores prior behaviour in one PR. The two archived files were moved with
  `git mv`, so history follows them.
- **Decided by:** Thomas (per-candidate popups + explicit apply-all go-ahead)

## 2026-08-02 — Reconcile the two dispatch-cadence memories with "idle is free"

- **Decided:** Rewrote `feedback_drain_isnt_stop_signal` and `feedback_constant_work` (both in
  MarianLearning's project memory at `~/.claude/projects/c--Trunk-PRIVATE-MarianLearning/memory/`)
  to retire their always-dispatch conclusions, and updated their `MEMORY.md` index lines. Each keeps
  the half that was genuinely load-bearing: _scan before concluding "all gated"_ in the first, the
  _staleness watchdog_ (a freed slot may be a dead agent — probe, don't assume) in the second.
- **Foundation:** the contradiction was logged as V-1 in the alignment plan. Resolution cites the
  Far-Horizon measurement (79 commits / 47 docs / zero `feat`) as the cost of the never-idle framing.
- **Correction on the record:** the alignment plan's first draft called these memories _user-global_
  and concluded the pass "could not edit them." That was wrong — they are **project-scoped to
  MarianLearning** (outside the git repo, but not user-global), so the fix was in scope and only
  affects this project. V-1 is now marked RESOLVED rather than carried.
- **Alternative considered:** deleting both outright. Rejected — each contains a real incident and a
  discipline that still holds; deleting would have lost the staleness-watchdog mechanics and the
  2026-05-16 under-scanning lesson along with the retired framing.
- **Reversibility:** both files are single-file rewrites; prior content recoverable from this
  session's transcript. Low effort to restore.
- **Decided by:** Thomas ("address the 3 things still open")

## 2026-08-02 — Fix a false positive in the imported destructive-bash guard

- **Decided:** Smoke-tested `.claude/hooks/block-destructive-bash.sh` with 15 crafted PreToolUse
  payloads. Found and fixed a real defect inherited from Far-Horizon: the branch-delete check used
  `grep -Eqi`, whose `-i` folded the **safe** lowercase `git branch -d` (merged-only delete) into the
  `-D` force-delete match, blocking routine post-squash-merge cleanup. Dropped `-i` on that one check.
  15/15 after the fix.
- **Foundation:** V-5 in the alignment plan asked for exactly this smoke test before trusting the
  fail-open guard. Interpreter confirmed present under Git Bash (Python 3.14.4).
- **Alternative considered:** dropping `Bash(git branch -D:*)` from the `permissions.deny` list
  instead. Rejected — the deny-list entry is prefix-matched and correctly case-sensitive already; only
  the hook's regex was wrong, so fixing the regex preserves protection against the genuinely
  destructive form.
- **Reversibility:** one-line revert.
- **Decided by:** orchestrator (autonomy gates — reversible, foundation-citable, not on the
  never-auto-decide list); reported to Thomas in-session.
