# Alignment Plan — adopt from Far-Horizon

Generated: 2026-08-02 | Current: `c:\Trunk\PRIVATE\MarianLearning` | Target: `c:\Trunk\PRIVATE\Far-Horizon`
Status: **APPLIED 2026-08-02** — all 14 changes written (Thomas chose "Apply all 14", deny list as written)

## Applied file list

| File                                                     | Change                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                                              | §"Sub-agents — read the SCOPED docs at start" replaces the blanket-read rule (change 1); 7 new `##` sections appended (changes 2, 4, 5, 6, 7, 11 + coordination-docs)                                                                         |
| `.claude/hooks/block-destructive-bash.sh`                | **new** — copied verbatim from FH (5,491 B)                                                                                                                                                                                                   |
| `.claude/hooks/_extract_command.py`                      | **new** — copied verbatim from FH (1,702 B)                                                                                                                                                                                                   |
| `.claude/hooks/session-start-auto-status.sh`             | replaced with FH's resume-nudge version, board reference adapted to ML + a pointer to §"Idle is free" as counterweight                                                                                                                        |
| `.claude/settings.json`                                  | `permissions.deny` added (8 entries); `hooks.PreToolUse` added (Bash matcher). Validated as parseable JSON; hook events now PreToolUse, SessionStart, Stop                                                                                    |
| `.claude/skills/name-the-bar/SKILL.md`                   | **new** — adapted from FH (bars file repointed to `.claude/`, ear-test economy, ML memory slugs, + a boundary deferring domain questions to Dave/Kyle per `feedback_no_sponsor_as_expert`)                                                    |
| `.claude/quality-bars.md`                                | **new** — 8 rows seeded from `MEMORY.md` + `CLAUDE.md`, all marked `seeded` until a `/name-the-bar` popup confirms them                                                                                                                       |
| `.claude/skills/maintain-docs/SKILL.md`                  | 4 grafts: Step-1b incident gate; the "how could docs be improved" proposer question **banned** and replaced with the single prevention question; consolidator rules 5–8 (incident gate, NO_CHANGES default, ~30-line cap); tripwire guardrail |
| `.claude/log/away-queue-archive-2026-08-02.md`           | `git mv` from `.claude/away-queue.md` (63,090 B) — history preserved                                                                                                                                                                          |
| `.claude/log/decisions-while-away-archive-2026-08-02.md` | `git mv` from `.claude/decisions-while-away.md` (78,324 B) — history preserved                                                                                                                                                                |
| `.claude/away-queue.md`                                  | **recreated** — fresh queue with schema + archive pointer (away mode still ON, so the live consumer keeps working)                                                                                                                            |
| `.claude/decisions-while-away.md`                        | **recreated** — fresh audit trail with schema + archive pointer                                                                                                                                                                               |
| `team/STATE.md`                                          | **new** — resume header, in-flight-agent table keyed on agentId, open-PR table                                                                                                                                                                |
| `team/DECISIONS.md`                                      | **new** — append-only, seeded with this alignment pass as its first entry                                                                                                                                                                     |

**Not touched by this pass:** `.claude/docs/planner-and-canon.md` and `.claude/docs/testing-and-ci.md`
show as modified in `git status`, but were already modified before this session started (present in the
session-open snapshot). **Correction to this plan's first draft**, which guessed they were "likely the
concurrently-orchestrating session": their on-disk `LastWriteTime` is **2026-06-19**, six weeks before
this pass — so they are long-stale uncommitted edits, not concurrent activity. Content is substantive
(+47 lines): the `reorderContinuantOnsetFirst` / `pinCvcRecapFocus` post-Haiku passes, the optional
per-problem slot contract, blend pass-7 (/v/ and /w/ recovered), the static-`voice-qa-status.json`-label
trap, and production-frame phoneme auditioning. Real captured findings sitting uncommitted — worth
recovering, but out of scope here and left untouched.

**Post-apply smoke test still recommended (V-5):** confirm the destructive guard actually fires —
attempt a `git reset --hard` in a scratch dir and check for the deny. The hook is fail-open, so a
missing/stubbed Python interpreter yields "no protection" silently rather than an error.

Provenance: most adopted rules come from Far-Horizon's **2026-08-02 orchestration-doctrine rewrite**,
which followed a measured failure — _79 commits since the last `feat`: 47 docs, 12 chore, 10 fix,
8 test, 1 spike, 1 ci, ZERO feat_ (`git log 0dc4844..origin/main`, measured 2026-08-02 in FH's
`CLAUDE.md` § "The measured failure this replaces"). The rules below are that project's named
countermeasures. FH's own diagnosis: a **demand engine** (an anti-idle hook) feeding on **supply
engines** (auto-docs, NITs tickets, agent-created tickets) that manufacture work from work.

## Decisions

| #   | Dimension      | Title                                               | Decision  | Adapt note                                 |
| --- | -------------- | --------------------------------------------------- | --------- | ------------------------------------------ |
| 1   | claude.md      | Scoped pre-reads (retire blanket docs read)         | Adopt     | —                                          |
| 2   | claude.md      | Reviews may NEVER create a ticket                   | Adopt     | —                                          |
| 3   | claude.md + fs | Coordination docs stay small (+ archive)            | Adopt     | —                                          |
| 4   | claude.md      | Documentation requires a paid-for incident          | Adopt     | —                                          |
| 5   | claude.md      | Idle is free; unjustified dispatch is the bug       | Adopt     | —                                          |
| 6   | claude.md      | Kill switch (zero-`feat` week retires the team)     | Adopt     | —                                          |
| 7   | claude.md      | Agents may not create tickets                       | Adopt     | —                                          |
| 8   | hooks          | `block-destructive-bash.sh` + `_extract_command.py` | Adopt     | —                                          |
| 9   | settings       | `permissions.deny` block                            | Adopt     | —                                          |
| 10  | hooks          | `session-start-auto-status.sh` resume nudge         | Adopt     | board ref swapped to ML's                  |
| 11  | claude.md      | Predict-Before-Soak + bounded convergence           | Adopt     | —                                          |
| 12  | skills         | `name-the-bar` + `.claude/quality-bars.md`          | Adopt     | bars file at `.claude/`, not `team/`       |
| 13  | skills         | `maintain-docs` incident gate                       | **Adapt** | graft gate into ML's skill; KEEP Stop hook |
| 14  | team           | `team/` structure                                   | **Adapt** | STATE.md + DECISIONS.md only               |

---

## Changes to apply (current project only)

### 1. Scoped pre-reads [Adopt]

- **Action:** replace the sub-agent blanket-read paragraph in `CLAUDE.md` § "Sub-agents — read the docs at start"
- **Source:** FH `CLAUDE.md` § "Detailed Documentation" — _"The blanket read-everything rule was retired 2026-08-02 (Sponsor decision): ~1,855 lines of context on every dispatch including trivial ones, paid in full by ~13 agents that died mid-task in a single week."_
- **Rationale for ML:** ML's ten `.claude/docs/*.md` files total **704,124 bytes (~704 KB)** on disk
  (measured 2026-08-02). Every sub-agent dispatch currently mandates reading all of them.
- **Replacement text:**

  ```markdown
  ### Sub-agents — read the SCOPED docs at start

  **If you are a sub-agent spawned via the Agent tool, you do NOT inherit the SessionStart
  auto-load.** The former blanket rule ("Read every `.claude/docs/*.md` before any work") is
  **retired** — ML's doc set is ~704 KB and loading all of it on every dispatch, including trivial
  ones, is paid for in context on tasks that never touch most of it.

  **Dispatch briefs NAME the 1–3 docs the task class requires.** Reading a doc outside your list is
  fine when you have a reason; reading all of them by default is not. Routing table:

  | Task class                                               | Read before starting                                      |
  | -------------------------------------------------------- | --------------------------------------------------------- |
  | Audio / voice / TTS / canon bake / SSML                  | `audio-system.md`, `planner-and-canon.md`                 |
  | Content tier / skill node / word pack / distractors      | `skill-trees-and-content.md`, `sibling-tier-checklist.md` |
  | Screen / UI / route / flow change                        | `screens-and-flows.md`, `architecture-overview.md`        |
  | Emma visual / pose / animation                           | `emma-character-and-animation.md`                         |
  | Progress / mastery / focus-node / Leitner / persistence  | `progress-and-persistence.md`                             |
  | Planner / `/api/claude` / parser contract / rate limiter | `planner-and-canon.md`                                    |
  | Test authoring / E2E / CI gates                          | `testing-and-ci.md`                                       |
  | Orchestration / dispatch concurrency                     | `orchestration-concurrency.md`                            |

  If your brief names no docs and the task is non-trivial, ask the orchestrator which apply rather
  than defaulting to all of them.

  Sub-agents should still include a "Non-obvious findings" section in their final report — but note
  that findings now clear the incident gate (§ Documentation requires a paid-for incident) before
  they become docs.
  ```

- **Risk/conflict:** the routing table must stay in sync if a doc is added or renamed. Mitigation: the
  table lives adjacent to the existing doc index in the same file, so both are edited together.

### 2. Reviews may NEVER create a ticket [Adopt]

- **Action:** append a rule to `CLAUDE.md`
- **Source:** FH `CLAUDE.md` § Orchestration doctrine. Verified generator FH killed: **#383 → #394 ("#383 NITs") → #401 ("#394 NITs")**.
- **Exact text to append:**

  ```markdown
  ## Reviews may NEVER create a ticket

  `APPROVE_WITH_NITS` is **deleted**. There are two verdicts:

  - **`APPROVE`** — merge.
  - **`REQUEST_CHANGES`** — fixed **in this PR**; the reviewer re-checks the diff **once**, then done.

  Nits are fixed now or dropped. Dropping them is an accepted cost. A would-be third round escalates
  to Thomas with the ship-with-documented-defect option rather than spawning another round.

  **Docs-only and test-only PRs get NO reviewer** — CI green, merge. **Code PRs get one reviewer, one
  round.**

  This supersedes, for this project, the user-global auto-decide class
  "NITs-ticket-creation from APPROVE_WITH_NITS review comments" — that class has no subject any more,
  because the verdict it keys on no longer exists.
  ```

- **Risk/conflict:** intentionally retires a user-global auto-decide class **for this project only**.
  The user-global rule stays intact for other projects. Peer-review routing
  (`[[feedback_pr_review_routing]]`) is unaffected — only the verdict vocabulary changes.

### 3. Coordination docs stay small [Adopt]

- **Action:** (a) move `.claude/away-queue.md` (63,090 B) → `.claude/log/away-queue-archive-2026-08-02.md`;
  (b) move `.claude/decisions-while-away.md` (78,324 B) → `.claude/log/decisions-while-away-archive-2026-08-02.md`;
  (c) append the no-regrowth rule to `CLAUDE.md`
- **Source:** FH `CLAUDE.md` § Orchestration doctrine, last bullet; FH's own archives at
  `team/log/away-queue-archive-2026-08-02.md` (140,602 B) and
  `team/log/decisions-while-away-archive-2026-08-02.md` (72,512 B)
- **Exact text to append:**

  ```markdown
  ## Coordination docs stay small

  `team/STATE.md` is a **resume header, not a log**. `team/DECISIONS.md` is **append-only history**.
  Historical `.claude/away-queue.md` and `.claude/decisions-while-away.md` content is archived under
  `.claude/log/` — do not grow the live files back into logs. If a live coordination file passes
  ~10 KB, archive the closed entries rather than letting it accrete.
  ```

- **Risk/conflict:** ⚠ **away mode is still ON in this project** (unlike FH, which turned it off).
  The two files therefore still have a live consumer. Fresh, empty live files are recreated at the
  original paths so away-mode writes keep working; only the closed backlog moves.

### 4. Documentation requires a paid-for incident [Adopt]

- **Action:** append a rule to `CLAUDE.md`
- **Source:** FH `CLAUDE.md` § Orchestration doctrine + FH `.claude/skills/maintain-docs/SKILL.md` § "Step 1: The incident gate"
- **Exact text to append:**

  ```markdown
  ## Documentation requires a paid-for incident

  A `.claude/docs/` entry may be written only by naming **the incident it would have prevented and
  what that incident cost** — a wasted rebuild, an overturned ear-test, a dead agent-hour, a wrong
  merge, a re-bake. Write it in this shape before proposing anything:

  > **Incident:** <what broke, cited> — **Cost:** <what was actually spent>

  No named incident with a cost → **no doc**. "Useful", "non-obvious", and "future Claude would
  benefit" are **not incidents** — that bar was already written down here and it did not hold.

  **Corollary:** the docs are not a growth surface. Prefer amending an existing doc over creating a
  new one; a new file needs its own incident. `NO_CHANGES` is the expected outcome of most
  `maintain-docs` runs, and is a success rather than a failure.
  ```

- **Risk/conflict:** tightens, and partially supersedes, the existing CLAUDE.md line _"the early-exit
  filter is high"_ and the user-global maintain-docs "high content bar" (non-obvious / reusable / not
  already covered). Those three tests remain **necessary but no longer sufficient** — the incident
  gate is added on top. Change 13 grafts the same gate into the skill so the rule is enforced where
  docs are actually written.

### 5. Idle is free; an unjustified dispatch is the bug [Adopt]

- **Action:** append a rule to `CLAUDE.md`
- **Source:** FH `CLAUDE.md` § Orchestration doctrine, first bullet
- **Exact text to append:**

  ```markdown
  ## Idle is free; an unjustified dispatch is the bug

  Rank the dispatchable set by **user-visible value** — value to Marian in the deployed app — never
  by readiness. A bug in the shipped PWA outranks every doc ticket. **Prefer leaving a slot idle to
  manufacturing work.**

  Still scan the **whole** board so you never wrongly conclude "all gated" — but having scanned,
  dispatch only what earns its cost. Drain-complete is a legitimate resting state, not a failure to
  be papered over with regenerated backlog.
  ```

- **Risk/conflict:** ⚠ **directly reverses two live memories** — `[[feedback_drain_isnt_stop_signal]]`
  ("regenerate backlog, keep dispatching reversible work") and `[[feedback_constant_work]]`
  ("proactive dispatch when an agent frees up"). Those live in the user memory directory, **outside
  this project tree**, so this plan cannot and does not edit them. Surfaced at the final gate as a
  required follow-up: both need retiring or project-scoping, or the orchestrator will hold
  contradictory instructions.

### 6. Kill switch [Adopt]

- **Action:** append a rule to `CLAUDE.md`
- **Source:** FH `CLAUDE.md` § "Kill switch (automatic — not a judgement call)"
- **Exact text to append:**

  ```markdown
  ## Kill switch (automatic — not a judgement call)

  **Any calendar week with zero `feat` merges retires the standing team.** Check:
  ```

  git log origin/main --since="7 days ago" --pretty=%s | grep -c "^feat"

  ```

  `0` → collapse to a single hands-on session + an on-demand QA agent, and stop dispatching personas.
  No debate, no appeal. This exists because a drought is invisible from inside it — FH's ran ten days
  before anyone named it, and it took an independent audit to surface.
  ```

- **Risk/conflict:** none structurally. Note the check counts merged subjects on `origin/main`;
  ML squash-merges with conventional-commit titles, so `^feat` matches as intended.

### 7. Agents may not create tickets [Adopt]

- **Action:** append a rule to `CLAUDE.md`
- **Source:** FH `CLAUDE.md` § Orchestration doctrine
- **Exact text to append:**

  ```markdown
  ## Agents may not create tickets

  Agents may file a ticket **only** for a bug **reproduced in the deployed PWA** (or in a PR preview
  build). Every other ticket — features, refactors, research, hygiene, follow-ups — needs Thomas's
  yes first.

  An unbounded ticket source plus any board scan guarantees the team never runs out of non-user-visible
  work. Combined with § "Reviews may NEVER create a ticket", this closes both supply engines.
  ```

- **Risk/conflict:** composes with change 2 (reviews) — together they remove both agent-side ticket
  sources. Orchestrator- and Thomas-created tickets are unaffected.

### 8. `block-destructive-bash.sh` + `_extract_command.py` [Adopt]

- **Action:** add two hook files + wire a `PreToolUse` matcher in `.claude/settings.json`
- **Source:** `c:\Trunk\PRIVATE\Far-Horizon\.claude\hooks\block-destructive-bash.sh` (5,491 B) and
  `_extract_command.py` (1,702 B)
- **Content:** copy both verbatim. They are already project-agnostic — the only project-specific
  string is the deny reason's pointer to `.claude/away-queue.md`, a path ML also has.
- **Settings wiring to add:**

  ```json
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/block-destructive-bash.sh\""
        }
      ]
    }
  ]
  ```

- **Risk/conflict:** ML has no existing `PreToolUse` block, so this is purely additive. The hook is
  **fail-open** (any read/parse problem → exit 0 → allow), so a malfunction degrades to today's
  behaviour rather than blocking work. Requires `python3` or `python` on PATH; absent one it exits 0.

### 9. `permissions.deny` block [Adopt]

- **Action:** add a `deny` array to `.claude/settings.json` `permissions`
- **Source:** FH `.claude/settings.json` lines 6–15
- **Exact keys to add:**

  ```json
  "deny": [
    "Bash(git push --force:*)",
    "Bash(git push -f:*)",
    "Bash(git push --force-with-lease:*)",
    "Bash(git reset --hard:*)",
    "Bash(rm -rf:*)",
    "Bash(rm -fr:*)",
    "Bash(gh repo delete:*)",
    "Bash(git branch -D:*)"
  ]
  ```

- **Risk/conflict:** deny is evaluated before allow, so this **narrows** ML's existing broad
  `Bash(git push:*)` allow without removing it. ⚠ Includes `--force-with-lease`, which ML's
  rebase-recovery flow uses (`[[feedback_rebase_crlf_lint_failure]]`,
  `[[feedback_sibling_tier_rebase_mechanical]]`). Grep of `.claude/**` found **0 occurrences** of the
  flag, so nothing in committed project config depends on it — but the orchestrator does type it by
  hand during rebase recovery, and after this it will be denied. See verification finding V-2.

### 10. `session-start-auto-status.sh` resume nudge [Adopt, adapted]

- **Action:** replace `.claude/hooks/session-start-auto-status.sh` with FH's version, board reference adapted
- **Source:** `c:\Trunk\PRIVATE\Far-Horizon\.claude\hooks\session-start-auto-status.sh` (4,959 B) vs ML's (2,162 B)
- **Delta:** FH's version parses the SessionStart `source` field and, on `source=resume`, injects a
  fresh-whole-board-scan nudge — fired whether or not auto-status was armed, and appended to the
  re-arm context when it was. Rationale in-file: _"a resumed session's save-state is STALE, not
  current truth."_
- **Adapt note:** FH's nudge hardcodes `mcp__clickup__get_tasks on list 901523878268` and `/whip`.
  Swapped for ML's board. Replacement nudge text:

  ```
  # Fresh-scan nudge (SessionStart resume)

  This session was RESUMED — a prior session's save-state is STALE, not current truth. Before
  concluding the board is drained, run a FRESH whole-board scan (ClickUp MCP over the Marian Tutor
  list, via a subagent — it overflows context) plus `gh pr list --state open`, and fill-or-justify
  every idle persona slot. Do not trust a remembered 'all gated' / 'drained'.
  ```

- **Risk/conflict:** this **replaces** an existing file rather than adding one — permitted because the
  new version is a strict superset of ML's current logic (same state-file read, same re-arm context,
  same `compact`-exclusion rationale) plus the resume branch. Verified by diff: ML's file contains no
  line absent from FH's apart from the nudge-free control flow. Not an overwrite of divergent local work.

### 11. Predict-Before-Soak + bounded convergence [Adopt]

- **Action:** append a rule to `CLAUDE.md`
- **Source:** FH `CLAUDE.md` § "Hard rules" testing-bar bullet, referencing `team/TESTING_BAR.md` § Predict-Before-Soak
- **Exact text to append:**

  ```markdown
  ## Predict-Before-Soak + bounded convergence

  Any PR whose acceptance is **Thomas's ear or eye** (voice/audio renders, Emma visuals, motion feel,
  first-of-class UI) carries two extra lines in its Self-Test Report:

  - **Prediction (falsifiable, written BEFORE the soak):** what you expect Thomas to hear or see,
    specific enough to be wrong. "Sounds good" is not a prediction; "the /v/ in _van_ will hold ~180 ms
    and will NOT buzz like the isolated /ʋ/" is.
  - **Bounded convergence claim:** name the bar you tested **and the bars you did NOT test**. Silence
    about an untested surface reads as coverage; say what you left alone.

  After the soak, grade the prediction against the verdict. A wrong prediction is useful signal, not
  a failure — an ungraded one wastes the round.
  ```

- **Risk/conflict:** extends the existing Self-Test Report convention (`[[feedback_self_test_report]]`)
  rather than replacing it. Composes with change 12 — a prediction is strongest when made against a
  _confirmed_ bar from `.claude/quality-bars.md`.

### 12. `name-the-bar` skill + `.claude/quality-bars.md` [Adopt, adapted]

- **Action:** (a) add `.claude/skills/name-the-bar/SKILL.md`; (b) create `.claude/quality-bars.md` seeded from ML's existing taste memories
- **Source:** `c:\Trunk\PRIVATE\Far-Horizon\.claude\skills\name-the-bar\SKILL.md`;
  companion artifact `c:\Trunk\PRIVATE\Far-Horizon\team\quality-bars.md` (48,684 B, 11 confirmed bars)
- **Adapt note:** ML has no `team/` directory, so the bars file lands at `.claude/quality-bars.md`.
  All FH-specific references in the SKILL.md body are rewritten for ML: `team/quality-bars.md` →
  `.claude/quality-bars.md`; `team/TESTING_BAR.md § Predict-Before-Soak` →
  `CLAUDE.md § Predict-Before-Soak + bounded convergence` (change 11 — use the full heading verbatim,
  so the cross-reference resolves); the soak economy → ML's ear-test / audition-page economy;
  FH memory slugs → ML's.
- **Seed rows for `.claude/quality-bars.md`** — each derived from an existing ML memory, marked as
  seeded-from-memory rather than freshly Sponsor-confirmed:
  - British (en-GB) voice is the standard; **voice swaps must preserve text** — `[[feedback_prefer_british_voice]]`
  - Audio is judged on **real baked canon in the production frame**, never a synthetic preview — `[[feedback_audio_audition_page_pattern]]`
  - **Never a red X** — Emma reacts in character on error — `CLAUDE.md` § Design principles
  - Distractors are gated on **7–9-year-old error-pattern fit first**, mechanics second — `[[feedback_distractor_class_pedagogical_gates_mechanical]]`
  - Objective invariants are proven by a **Playwright spec**, not by Thomas — `[[feedback_jessica_first_for_objective_gates]]`
  - Thomas is spent only on **subjective feel, real-iOS, real-Marian, strategy, external** — `[[feedback_thomas_only_when_essential]]`
- **Risk/conflict:** no name collision — ML has no `name-the-bar` skill and no `quality-bars.md`.
  The skill is orchestrator-run; its own § Boundaries already says a passive/non-orchestration session
  drafts inferences without firing popups, which matches this session's posture.

### 13. `maintain-docs` incident gate [Adapt — merge, do not overwrite]

- **Action:** edit the **existing** `.claude/skills/maintain-docs/SKILL.md` in place; **keep** the
  Stop-hook wiring in `.claude/settings.json`
- **Source:** FH `.claude/skills/maintain-docs/SKILL.md` § "Step 1: The incident gate", § "Your task — ONE question only", § Guardrails
- **Adapt note (user):** graft the incident gate into ML's skill; do **not** take FH's full manual-only
  rewrite and do **not** unwire the Stop hook.
- **Grafts to apply:**
  1. Insert FH's **incident gate** as a hard precondition in Step 1, alongside (not replacing) ML's
     existing early-exit filter — including the
     `> **Incident:** <what broke, cited> — **Cost:** <what was actually spent>` shape.
  2. In the proposer task, add FH's banned second question. ML's current proposer asks _"How can the
     documentation be improved along quality, coverage, relevance?"_ — FH deletes exactly that
     question, with the reason: _"It always has an answer, and answering it is what produced 47 docs
     commits and zero features in ten days."_ Replace it with FH's single question: **"Would this doc
     entry have PREVENTED the named incident?"**
  3. Add FH's consolidator rules: **"Default to NO_CHANGES — returning an empty plan is a success, not
     a failure"** and the **~30-line total cap** ("if the incident's lesson needs more than that, it is
     not a doc, it is a ticket").
  4. Add FH's guardrail: **"If several consecutive invocations all produce edits, the incident gate is
     being read too loosely — tighten it, don't celebrate the throughput."**
- **Explicitly NOT taken:** FH's `description:` rewrite to MANUAL-ONLY, its
  "⛔ This skill is MANUAL-ONLY" section, and its _"never re-register this skill as a Stop hook"_
  guardrail — all three contradict the user's Adapt decision to keep automatic firing.
- **Risk/conflict:** ⚠ residual tension, stated plainly: FH's evidence is that the _automatic firing_
  is the thing that broke — three agents asked "find something to document" will find something, and
  returning `NO_PROPOSALS` reads as failing the task. Keeping the Stop hook keeps that pressure; the
  incident gate is a content bar layered against it, not a removal of the trigger. Guardrail 4 above is
  the tripwire: consecutive doc-producing runs mean the gate is being read too loosely.

### 14. `team/STATE.md` + `team/DECISIONS.md` [Adapt — two files only]

- **Action:** create `team/STATE.md` and `team/DECISIONS.md`
- **Source:** `c:\Trunk\PRIVATE\Far-Horizon\team\STATE.md` (5,172 B), `team\DECISIONS.md` (186,992 B, append-only)
- **Adapt note (user):** take these two only. Skip `ROLES.md`, `GIT_PROTOCOL.md`, `RESUME.md`,
  `TESTING_BAR.md` and the per-role subdirs — ML's `.claude/agents/*.md` and
  `.claude/agents/dispatch-template.md` already cover roles and git protocol.
- **`team/STATE.md` shape:** a **resume header, not a log** — first line answers _"if this session dies
  right now, the next orchestrator should do X next"_, then in-flight agents (agentId + dispatch time +
  expected-by), open PRs, and current gates. Capped small; superseded content goes to DECISIONS.
- **`team/DECISIONS.md` shape:** append-only, newest last, one `## YYYY-MM-DD — <headline>` per entry
  with Decided / Foundation / Alternative / Reversibility.
- **Risk/conflict:** creates a **new top-level `team/` directory** in a repo that has none. Both files
  start near-empty (headers + protocol only) — this plan does not migrate history into them. Composes
  with change 3: the archived away-queue/decisions content stays under `.claude/log/` and is _not_
  replayed into `team/DECISIONS.md`.

---

## Self-verification (Step 6) — run 2026-08-02

- [x] **No internal conflicts.** Change 1 forward-references `§ Documentation requires a paid-for
incident` (change 4) — heading text matches exactly. Change 12 referenced a truncated form of change
      11's heading; **fixed** to the full `§ Predict-Before-Soak + bounded convergence`. Changes 2 and 7
      compose (both close ticket-supply engines, different actors). Change 5 does not require the skipped
      team ceiling. No two changes edit the same line; changes 2/4/5/6/7/11 each append a distinct new
      `##` section to `CLAUDE.md`, change 1 replaces one existing subsection.
- [x] **Production-protection intact.** Neither project's `CLAUDE.md` declares a "never touch PROD"
      clause. No change touches Vercel deploy authority, `main` branch protection, `gh pr merge`, or
      release mechanics. Change 9 **strengthens** destructive-action protection. Nothing weakened,
      duplicated, or reordered.
- [x] **Add/append only.** Verified against `git check-ignore` — all eight new paths are trackable,
      none ignored. Changes 8/9 add absent keys (`PreToolUse`, `permissions.deny`) to `settings.json` —
      confirmed absent by grep. Change 13 edits ML's `maintain-docs` **in place** (the Adapt merge), and
      explicitly does not take FH's three manual-only sections. **One file replacement, justified:**
      change 10 replaces `session-start-auto-status.sh`. Diff confirms ML's version contains **no line
      absent from FH's** apart from the nudge-free control flow — a verified superset, not a lossy
      overwrite of local work.
- [x] **No conflict with current project** — with four findings, three carried forward. Details below.

### Verification findings

- **V-1 — `[RESOLVED 2026-08-02]` Change 5 contradicted two live memories.**
  `[[feedback_drain_isnt_stop_signal]]` ("regenerate backlog, keep dispatching reversible work") and
  `[[feedback_constant_work]]` ("idle time is wasted time; auto-dispatch on completion") said the
  opposite of "prefer leaving a slot idle."
  **Correction to this plan's first draft:** these were described as _user-global_. They are not —
  both live at `~/.claude/projects/c--Trunk-PRIVATE-MarianLearning/memory/`, which is **project-scoped
  memory for MarianLearning**. Outside the git repo, yes; user-global, no. That distinction matters:
  editing them affects only this project, which is the correct scope, so the follow-up was actionable
  after all rather than out of reach.
  **Resolved:** both rewritten in the same session. Each keeps its genuinely-load-bearing half — the
  _scan-before-concluding-all-gated_ discipline in the first, the _staleness watchdog_ (a freed slot
  may be a dead agent) in the second — and retires the always-dispatch conclusion, citing the
  Far-Horizon measurement. `MEMORY.md` index lines updated so neither still advertises the retired
  framing.
- **V-2 — `[RESOLVED 2026-08-02, after firing in production]` Change 9 denied
  `git push --force-with-lease`.** Flagged at decision time; Adopt-as-written was chosen with the flag
  visible. **It then fired within the hour, on this very PR.** Local `main` turned out to be ~4 weeks
  stale, so PR #490 opened `CONFLICTING`; the fix was a rebase onto `origin/main` `cea94c3`, and the
  force-push to land it was blocked by both layers — exactly the predicted bite, on exactly the
  predicted workflow.
  **Resolved (Thomas's call):** narrowed to allow the **lease-based family** — `--force-with-lease`
  and its companion `--force-if-includes` refuse the push if the remote moved under you, so they
  cannot silently clobber, which is the harm the check exists to prevent. **Bare `--force` and `-f`
  stay blocked in both layers.** Removed the deny entry; narrowed the hook's regex so `--force` must
  be followed by space/quote/end and therefore does **not** substring-match `--force-with-lease`.
  Smoke test extended to 17 cases (added bare `-f` on the deny side, both lease forms on the allow
  side, the latter specifically guarding the substring trap) — **17/17**.
  **Calibration note:** this is the intended feedback loop working. The guard was adopted, it fired,
  the firing was correct-by-its-own-rule but wrong-for-the-workflow, and the rule was narrowed rather
  than bypassed. The block was never retried or routed around; it was staged to `.claude/away-queue.md`
  as ENTRY-001 per the deny reason's own instruction, then cleared by decision.
- **V-3 — `[carried]` Change 9 denies `git branch -D`, which squash-merge cleanup needs.**
  Squash-merged branches read as _unmerged_ to `git branch -d`, so deleting them genuinely requires
  `-D` (`[[feedback_squash_merge_branch_triage]]`). FH tolerates this because it merges with
  `gh pr merge --delete-branch`, which ML also uses — so routine cleanup is unaffected, but manual
  local-branch pruning will be denied. Same narrowing option at the gate.
- **V-4 — `[resolved]` Change 3 moves files referenced elsewhere.** `.claude/docs/testing-and-ci.md`
  and six retros reference the away-queue / decisions paths. Resolved by change 3's design: fresh empty
  live files are recreated at the original paths (away mode is still ON here), so every reference still
  resolves and away-mode writes keep working.
- **V-5 — `[RESOLVED 2026-08-02]` Change 8's Python dependency + a false positive it exposed.**
  Smoke-tested by piping 15 crafted `PreToolUse` payloads to the hook script directly (nothing
  executed). Interpreter resolves fine under Git Bash — `python3` → `WindowsApps/python3`,
  Python **3.14.4**. First run: **14/15**, with one genuine defect —
  **`git branch -d feat/merged-branch` was DENIED.** The upstream Far-Horizon pattern uses
  `grep -Eqi` for the branch-delete check, and the `-i` folds lowercase `-d` (the _safe_ merged-only
  delete, which git refuses on unmerged branches) into the `-D` force-delete match. That would have
  blocked routine post-squash-merge cleanup.
  **Fixed** by dropping `-i` from that one check (case-sensitive `-D` only), with an in-file comment
  recording why. Re-run: **15/15**. Reported back to Far-Horizon in the handoff doc — their copy still
  has the bug.
  Test script retained at
  `<scratchpad>/smoke-destructive-hook.sh` for re-running after any pattern change.

**Result: all four checks green.** V-1/V-2/V-3 are carried consequences of decisions already made
with the trade-off visible, not unresolved defects. V-1 needs a follow-up outside this plan's reach.

## Skipped / excluded (audit trail)

**Skipped by user:**

- Hard team ceiling (1 dev + 1 reviewer + ≤1 support) — Skip. FH's ceiling is downstream of its
  Unity-build cap of 1 (an absolute `unity-build` CI concurrency group + a single registered runner);
  ML's constraint is different (port 4173, one `yarn e2e` at a time). Does not transfer on its own merits.

**Not proposed (Low value — available on request):**

- Final-report contract ≤200 words
- "Do not test the test infrastructure" (no guards on guards)
- "No line-anchor audits" — ⚠ would conflict with ML's CLAUDE.md, which explicitly instructs sub-agents
  to cite `file:line` from live greps
- `agent-liveness-stop.sh` agentId parse tightening (` (internal ID` anchor) — unverified against ML's
  live transcript format; a mismatch would silently no-op the hook
- `read-obsidian-folder` skill — hardcoded to FH's vault path and ClickUp list
- `erik` technical-research consultant persona

**Auto-excluded:**

- `orchestrator-anti-idle-stop.sh` — **known-harmful**. Present on disk in FH but deliberately unwired;
  FH's CLAUDE.md names it as the demand engine that forbade ending a tick without dispatching and holds
  it responsible for the zero-`feat` fortnight.
- `session-start-auto-pixellab.sh` — PixelLab is not a MarianLearning concern
- FH's Unity / Blender / art doc set — domain-irrelevant
- `Bash(gh pr merge:*)` allow — already present in ML's settings
- FH `settings.local.json` equivalents — machine-specific
