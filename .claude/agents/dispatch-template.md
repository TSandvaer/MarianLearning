# Orchestrator dispatch template

Standard snippets the orchestrator pastes into every Agent brief. Centralising them here keeps individual briefs short and uniform, and makes future protocol updates a one-file change instead of N-brief change.

**Reference order:** orchestrator authors a task-specific brief (Goal / AC / Out-of-scope / Test / Files-in-play per `[[project_dispatch_contract]]`), then appends or inlines the snippets below as needed. Don't quote the whole template — pick the relevant blocks.

**Imported from:** RandomGame's `team/orchestrator/dispatch-template.md` (2026-05-22 import per `/investigate` finding that Marian briefs were authored from-scratch, contributing to brief-quality drift). Adapted to Marian personas (Kevin / Devon / Jessica / Kyle / Dave / Matt) + Marian-specific gates (Vitest / Playwright / canon-lint / iPad PWA instead of GUT / HTML5 / Godot).

---

## Wave decomposition — track-based parallel-author routing (Matt-owned)

When Matt decomposes a Wave (or any multi-PR work batch) into tickets, every ticket carries an `assignee_recommendation` field driven by the **track-based routing rule** below. Added 2026-05-23 in response to Pattern H of `retro-2026-05-22-waves-3-4.md` (Kevin authored 6/11 of Waves 3+4; Devon 1/11) — the prior pattern serialized Kevin on parallelizable lint+render tracks.

**Routing rule (defaults — Matt adjusts on persona-load):**

| Track                                                   | Default assignee | Examples                                                                                |
| ------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------- |
| planner / lint / schema / canon / API / progress-engine | **Kevin**        | `planner.ts`, `compositionLint.ts`, canon JSON, `progress.ts` schema, `api/_planner.ts` |
| render / distractor / UI / animation / visual           | **Devon**        | distractor classes, chip rendering, Emma pose, Hub UI, Math/WordSong screens            |
| e2e / regression / spec / failing-first test            | **Jessica**      | `e2e/*.spec.ts`, regression suites, Playwright contracts                                |

**Decomposition output shape — every ticket in the Wave's plan row carries:**

```markdown
| Ticket    | Title   | Work-type                    | assignee_recommendation | Files-in-play |
| --------- | ------- | ---------------------------- | ----------------------- | ------------- |
| 86c9xxxxx | <title> | impl/spec/test/investigation | Kevin/Devon/Jessica     | <paths>       |
```

**Parallel-fire discipline (mandatory):** once decomposed, Matt files ALL tickets for the Wave in ONE response (parallel `mcp__clickup__create_task` calls), then surfaces the list back to the orchestrator. The orchestrator then dispatches the workers **in the same orchestrator round** — multiple `Agent` spawns per response — not serially across multiple rounds. Per `feedback_always_parallel_dispatch.md` + 2026-05-23 retune (Pattern H mitigation).

**Why this matters:** sequential dispatch (Kevin first, wait, Devon second) serializes a workload that has independent tracks. Track-based author splitting at the decomposition step prevents the Pattern H concentration. Wave 5 evidence (post-rule): Kevin authored planner + canon + lint; Devon authored render-side. Lower per-author load + higher parallel throughput.

---

## Scoped contract (mandatory in every dispatch)

Pin the agent's allowed file scope + role boundary so they don't blind-resolve into another agent's lane on conflict. Block goes near the top of the brief, after the task-specific summary and before the worktree state.

```markdown
**Scoped contract:**

- **Owned files / directories (you may edit):** <list — e.g. `scripts/compositionLint.ts`, `scripts/compositionLint.test.ts`, `api/_planner.ts`>.
- **Read-only references (read but do NOT edit):** <list — e.g. `design/math/two-digit-addsub-content.md`, `public/canon/math/level-1/two-digit-addsub.json`>.
- **Out of scope (do NOT touch — surface a flag instead):** other roles' design docs, other agents' in-flight branches, persona files in `.claude/agents/`.
- **Conflict rule:** if your work would require touching a file outside this scope, STOP and surface a one-line note in your hand-back report. Don't blind-resolve into another role's area.
```

Replace placeholders with the task-specific scope. Skip the block only for trivial idle-tick state PRs.

## Vocabulary contract (parallel dispatches sharing a NEW concept)

When dispatching two or more agents in parallel where both will reference a NEW shared concept — a new TypeScript type / union member, a new content-type discriminant, a new SkillNode-adjacent constant, a new event/payload shape, a new exported helper — shape-contracts alone let each agent invent divergent names → non-mergeable sibling PRs (ClaudeTeam M3-10 precedent: `PersonaGroup` vs `CollapsedPersonaGroup`, reconciliation re-dispatch). Imported from RandomGame 2026-06-11; mirrors the user-global vocabulary discipline (sub-agents don't inherit user-global rules — this section is their inheritance surface).

**Default = Pattern A (sequence).** Dispatch the type-author first — typically Kevin for planner/types/wordPack data shapes, Devon for render/component types, Kyle for design-spec constants. Merge their PR. THEN dispatch the consumer(s) against the merged-on-main vocabulary. Costs one merge cycle; eliminates divergence by construction. (Wave 11 precedent: Kevin authors the sight-word content-type discriminant in W11-02; Devon's W11-03 render dispatch waits for the merge.)

**Pattern B (parallel with contract)** only when all names are confidently known upfront AND parallelism is load-bearing. Both briefs MUST carry this block verbatim:

```markdown
**Vocabulary contract (both author + reviewer read identical names — divergence = REQUEST_CHANGES, not NIT):**

- **Type name(s):** `<ExactName>` (e.g. `SightWordEntry`)
- **Union alias / discriminator value(s):** `<exact strings>` (e.g. contentType `'sight-word'`)
- **Type-guard function (if any):** `<exactName>` returning `entry is <Type>`
- **Defining file (export site):** `<exact path>` — consumers import from there
- **Cross-file consumers:** list each path that references the identifier
```

**Cross-review check.** When peer-reviewing a PR parallel to another in-flight PR sharing a concept, grep the sibling branch for the identifier names and verify they match. Vocabulary divergence is mergeability-blocking — `REQUEST_CHANGES`, not `APPROVE_WITH_NITS`.

## Worktree state (mandatory in every dispatch)

Per `[[feedback_per_role_persistent_worktrees]]`.

````markdown
**Worktree state — IMPORTANT:**

- Operate ONLY in `C:/Trunk/PRIVATE/MarianLearning-<your-role>-wt` (your role-persistent worktree). Do NOT touch other agents' worktrees. Do NOT operate in the main checkout `C:/Trunk/PRIVATE/MarianLearning/` — that's the orchestrator's survey directory, READ-ONLY.
- Run-start invocation:
  ```bash
  cd C:/Trunk/PRIVATE/MarianLearning-<your-role>-wt
  git fetch origin
  git checkout -B <your-role>/<task-name> origin/main
  ```
````

- Push by refspec: `git push origin <your-role>/<task-name>:<your-role>/<task-name>`.
- The `git checkout -B` always force-creates from `origin/main`. Don't try to recover prior in-flight work — every dispatch starts fresh.
- Worktree-busy local-branch-delete errors after merge are harmless (remote branch is deleted by `gh pr merge --delete-branch`; only the local ref lingers). Next dispatch's `git checkout -B` overwrites it.
- **Reviewer-side checkout pattern** (when reviewing a PR whose branch is still claimed by the author's worktree): use `git fetch origin pull/<n>/head:pr-<n>-review && git checkout pr-<n>-review` OR `git checkout --detach origin/<author-branch>`. Do NOT use `gh pr checkout` if the author's worktree is still bound to the head ref — it'll fail.

````

Replace `<your-role>` with the literal role name (kevin / devon / jessica / kyle / dave / matt) and `<task-name>` with a kebab-case task slug.

## Pre-load `.claude/docs/` (mandatory for ALL sub-agents)

Per `[[feedback_dispatch_brief_template]]` — sub-agents don't inherit the SessionStart auto-load. Their first action MUST be to read the project docs.

```markdown
**Read first (sub-agent — auto-load doesn't fire):** Read ALL `.claude/docs/*.md` files in parallel before starting any work. They are the canonical project briefs the main session sees automatically; without them you're working blind on architecture / audio / progress / planner contracts / screens / skill trees / testing-and-ci. Especially relevant for this dispatch: <name 1-3 specific docs>.
````

## Auto-mode disclaimer (mandatory in every dispatch)

Per `[[feedback_subagent_auto_mode_gate]]`.

```markdown
**Auto-mode disclaimer:** You're a sub-agent under the orchestration-exception in user-level CLAUDE.md. The plan-before-edit rule does NOT apply to your work — execute your scope without surfacing plan-approval gates. If you nonetheless hit a write-approval prompt internally, **proceed + auto-approve** citing this brief.
```

## Lesson reminder (load-bearing this session)

Inject one or two relevant cautionary tales per dispatch. Pick from the project's `[[feedback_*]]` memory. Examples:

- `[[feedback_agent_verify_evidence]]` — pull actual file contents + CI evidence before refusing or asserting impossibility. Verify, don't reason from priors.
- `[[feedback_no_fabrication]]` — never invent URLs / slugs / IDs / paths. Fetch or say "I don't have it."
- `[[feedback_run_vitest_before_merge]]` — Vercel CI doesn't run vitest; run `npx vitest run` locally before declaring green.
- `[[feedback_wait_for_ci_before_merge]]` — don't merge until Playwright reports COMPLETED + SUCCESS. Local vitest is necessary but not sufficient.
- `[[feedback_agent_commit_early]]` — background agents die silently; commit + push after each milestone so the orchestrator can verify progress.

```markdown
**Lesson reminder (load-bearing this session):** `[[<memory-name>]]` — <one-line summary of the cautionary tale + why it applies here>.
```

## Merge identity (mandatory in every dispatch)

Per `[[feedback_pr_merge_authority]]`.

```markdown
**Merge identity:**

- **iPad-smoke gate — NARROWED 2026-05-23.** REQUIRED only for `feat(...)`/`fix(...)` touching the four core progression-engine files: `mastery.ts`, `focusNode.ts`, `firstEncounterGate.ts`, `parentSettings.ts`. These are the four files where a bug ships silently to Marian's session before any other signal fires — they earn the Sponsor's iPad-smoke gate. Don't self-merge; orchestrator escalates.
- **Explicitly OUT of iPad-smoke scope** (audit answer 2026-05-23 — narrow, not widen): `App.tsx` (route state machine, kick-effect orchestration), Hub screen, Math screen, WordSong screen, SessionEnd, Greet, Splash, ParentSettings UI surface. These are covered by the author's Self-Test Report (UX-visible class) + Jessica's Playwright spec (objective invariants) + Devon design review (visual/layout). Routing them to Thomas duplicates the gate without adding signal — let the existing surfaces do their job.
- `feat(...)`, `fix(...)`, `test(...)`, `chore(...)`, `docs(...)`, `spec(...)` — orchestrator merges directly after cross-review APPROVE + all CI gates green. Don't self-merge in any category.
- Open the PR and stop. Orchestrator picks up.
```

## ClickUp lifecycle (paired flips, same tool round as the action)

Per `[[feedback_clickup_status_sync]]` + `[[feedback_clickup_forward_only_default]]` + `[[project_dispatch_contract]]`.

```markdown
**ClickUp lifecycle (paired flips, NOT advisory):**

- **At run-start** (if orchestrator hasn't already flipped): use your persona's `mcp__clickup__update_task` (Kevin/Devon have read+update; Kyle/Jessica/Dave have read; Matt has full). Flip ticket to **IN PROGRESS** in the same tool round as your first work. If you lack ClickUp MCP, surface the unflipped state in your hand-back so the orchestrator can dispatch Matt.
- **On PR open** (`gh pr create`): immediately fire `mcp__clickup__update_task task_id=<ticket> status="IN REVIEW"` in the same response. Or surface to orchestrator for Matt.
- **Don't lie to the board.** If you can't open the PR (ran into a blocker), don't flip to IN REVIEW — keep it at IN PROGRESS and surface the blocker.
- **MCP unreachable / no MCP for your persona:** surface the unflipped state explicitly in your hand-back. Orchestrator routes to Matt.
```

**Ticket-body hard gates (2026-05-22 retro):** before dispatching, the orchestrator MUST verify the ticket body has explicit OOS list + named success-test. Tickets missing either field bounce back to Matt for flesh-out before dispatch. Per `[[project_dispatch_contract]]` (2026-05-22 update).

**Work-type tag (2026-05-22 retro):** every ticket carries a free-text tag from `impl` / `spec` / `investigation` / `test` / `chore` / `cleanup`. The tag drives which acceptance gates apply per the rubric: impl needs a green test, spec needs PR-opens-to-template, investigation needs question-answered-in-PR-body, test needs a failing-first contract, chore needs no behavior change, cleanup needs comment-only or follow-up reframe. Without a work-type tag the rubric mis-scores spec/investigation tickets as low quality.

## Acceptance gates (paste the ones that apply)

```markdown
**Acceptance gates:**

- `npx vitest run` GREEN (current baseline visible via session-pickup memory)
- `yarn build` GREEN (Windows EPERM workaround per `[[reference_pwa_asset_size_limits]]` if needed)
- `npx tsc --noEmit -p tsconfig.api.json` clean (for api/ touches) or `-p tsconfig.app.json` (for src/ touches) or `-p tsconfig.e2e.json` (for e2e/ touches)
- `npx tsx scripts/compositionLint.ts` GREEN (for canon / planner directive changes)
- `npm run canon:lint` GREEN (text + composition, for canon touches)
- `npx playwright test --project=chromium <spec-file>` GREEN OR fail-as-designed (for failing-first specs)
- e2e under 35-min Playwright cap (per PR #281)
- **Canon-state empirical verification:** any spec / directive / planner-prose PR whose body cites canon state ("ships X facts of Y", "emits Z phrase", "the canon has N entries") MUST include a verifying `git grep` / `cat` / canon JSON read line in the PR body — actual command + actual output, not paraphrase. Per `[[feedback_canon_state_empirical_verification]]`.
- **Lint-infra split-PR pattern:** when PR A ships new canon-lint infrastructure with deferred binding, it MUST include a `lintBeforeRebake` failing-test fixture exercising the new rule against the pre-rebake canon and asserting it FAILS. PR B asserts it PASSES post-rebake. Per `testing-and-ci.md` § "Lint-infra split-PR pattern requires a `lintBeforeRebake` failing test".
```

**CI-status command discipline (orchestrator + tripwires + cross-reviewers):** when checking "is CI green?" for a merge-gate decision, use `gh pr view <num> --json statusCheckRollup -q '.statusCheckRollup[] | {name, status, conclusion}'` (authoritative against the PR endpoint) OR `gh run view <run-id> --json status,conclusion` (authoritative against the Actions endpoint). Do NOT rely on `gh pr checks <num>` for merge decisions — it caches "pending" status for 2+ hours after the underlying run actually completes (cost: 100-min pipeline halt on PRs #299 + #300 2026-05-22). Per `[[feedback_gh_pr_checks_stale_cache]]`. Sanity check: any "pending" >30min on `gh pr checks` → drill in with the authoritative command before concluding "still waiting".

## Regression guard (mandatory for any production code change)

```markdown
**Regression guard:** Name at least one test (vitest unit or Playwright e2e) that would fail if this feature broke in a future unrelated PR. If none exists, add it in this PR. The named test is the artifact a future unrelated PR's CI run flips RED against, so the regression surfaces at PR-time rather than at Marian-iPad-smoke-time.
```

## Pedagogy gate (mandatory for content-tier / curriculum dispatches)

Any dispatch that introduces or alters pedagogical content — a new content tier, a distractor class, word/fact pools, mastery or advancement thresholds, opener/hint phrasing, sequencing decisions — MUST carry an explicit pedagogy-gate line in the brief:

```markdown
**Pedagogy gate:** <satisfied — `design/research/<file>.md §N` | not-required — <one-line reason>>
```

- **Satisfied requires a COMMITTED research artifact** — a `design/research/*.md` file on main (or a ClickUp Format B comment by Dave). An untracked or never-committed research file is NOT a valid citation: if the citing spec merges before the research file, the evidence chain dies (see backstory).
- **No grounding research → bounce to Dave first**, same bounce rule as the ticket-body hard gates above. The orchestrator dispatches Dave before the spec/impl dispatch fires.
- **`not-required` is for dispatches with no pedagogical surface** (infra, lint, refactor, CI, audio plumbing, test-only) — one line of reason, not a silent omission.
- Wave plans already encode this gate as track ordering (research → spec → impl, e.g. Wave 10's "W10.1 (Dave) → W10.2 (Kyle) is a hard pedagogy gate before any code"). This block is the safety net for one-off dispatches OUTSIDE a wave, which previously had no structural prompt.

**Backstory (2026-06-11 R&D-sufficiency investigation):** the pedagogy gate was enforced only by wave-plan track ordering plus author-driven "pending Dave" spec markers. Two deferrals shipped unresolved that way (`design/math/add-to-20-content.md` §1 intro "Class B … pending Dave dispatch"; `design/math/two-digit-addsub-with-regroup-content.md` "30-fact pool LOCKED — pending Dave research review"), and one research file (`design/research/speed-feedback-automaticity-marian.md`) was cited as LOCKED authority in 5+ specs without ever being committed — the original evidence chain was lost and had to be reconstructed.

## Final-report shape — TIGHT (mandatory in every dispatch)

```markdown
**Final report to orchestrator — TIGHT (≤300 words):**

Your task-completion message back to the orchestrator MUST be tight to preserve the orchestrator's main-window context. Required content:

- **PR URL** (1 line)
- **Verdict** (1 line — `READY-TO-MERGE` / `blocked-on-X` / `partial — see follow-up #...`)
- **Acceptance gates** (1-3 lines max — which gates ran + which passed)
- **Blockers or follow-ups** (1-3 lines max — only what the orchestrator needs to act on this turn)
- **Doc updates** (1 line — `Doc updates: <file> — <one-line>` or `Doc updates: none`)
- **ClickUp state** (1 line — `Ticket <id> moved <from> → <to>` or `Ticket <id> not flipped — surface to Matt`)

Detailed content goes in artifacts the orchestrator can read on-demand, NOT in the orchestrator-bound message:

- **Empirical evidence / test counts / lint output** → PR body
- **Per-AC walkthrough** → PR body or Self-Test Report comment (if UX-visible per `[[feedback_self_test_report]]`)
- **Non-obvious findings** → PR body "Non-obvious findings" section + brief mention in orchestrator-bound report

**Use `gh pr create --body-file <path>` for PR bodies longer than 5 lines** (avoids 600s-stream-watchdog kill on heredoc/inline `--body` patterns observed in sibling projects).
```

**Backstory:** Verbose sub-agent final reports flooding the orchestrator's main conversation window is the dominant context-bloat surface. Tight orchestrator-bound reports + detailed PR-body artifacts is the discipline that closes that gap. Cap at ≤300 words for any normal dispatch; only investigations warrant longer hand-backs.

## Doc-update reporting (mandatory in every dispatch)

Per `[[feedback_subagent_doc_edits_visibility]]` + `[[feedback_claude_docs_not_in_git]]`.

```markdown
**Doc updates (`.claude/docs/`):** if your maintain-docs Stop hook ran and produced an update to any file under `.claude/docs/`, list those files + the rationale in your final report. Format: `Doc updates: <file> — <one-line rationale>`. If no docs were updated, state explicitly: `Doc updates: none.` Apply doc edits DIRECTLY to the parent workspace `C:/Trunk/PRIVATE/MarianLearning/.claude/docs/` — these files are not in git (per `[[feedback_claude_docs_not_in_git]]`); propagation is via SessionStart hook. NEVER include `.claude/docs/` files in your PR.
```

## Self-Test Report (UX-visible PRs only)

Required for `feat(integration|ui|math|wordsong|hub|audio|progression|greet|sessionend)`, `fix(...)` on the same scopes, when the PR changes user-visible behavior (audio, animation, copy, runtime path). NOT required for: pure refactors with no behavior change, build/CI/infra, test-only PRs, doc/spec PRs.

Per `[[feedback_self_test_report]]`.

```markdown
**Self-Test Report (REQUIRED before review for UX-visible PRs):**

After `gh pr create`, post a PR comment with the Self-Test Report. Reviewer's review starts from this report, not from a cold-read of the diff.

Comment template:

## Self-Test Report

**Verification method:** <local dev server / vitest unit / Playwright headless / iPad-Safari soak (if available)>

### AC walkthrough

- [x] AC1: <description> — observed: <what you saw/heard>
- [x] AC2: ...
- [ ] AC3: <if not personally verified — explain why + what's covered by automated tests>

### Side-effect inventory

- <other screen / state / persisted blob that might be affected>: <expected vs. observed>

### Open concerns / known gaps

<anything noticed but out of this PR's scope — file a followup ticket for each>
```

For chore/docs/test/refactor PRs that don't need a Self-Test Report, replace the block with: `**Self-Test:** <one-line — e.g. "vitest 2591 PASS / yarn build clean / no runtime path touched">.`

## Cross-review verdict format

Per `[[feedback_pr_review_routing]]` (2026-05-22 hard-gate update) + `[[reference_gh_self_review_block]]`.

**HARD GATE (2026-05-22):** cross-persona review is MANDATORY for every code / spec / test PR by Kevin / Devon / Kyle / Jessica before merge. The orchestrator dispatches the cross-persona reviewer (Devon for Kevin's code; Kevin for Devon's; Devon for Kyle's specs; Devon for Jessica's tests) IMMEDIATELY after `gh pr create`, BEFORE any orchestrator scan or `code-review` skill invocation. Orchestrator/code-review-skill review is SUPPLEMENTARY, not a substitute. Calibration target: >80% of code PRs routed correctly (baseline 18% in Waves 3+4 pre-retro).

```markdown
**Cross-review verdict format:**
Since you can't `gh pr review --approve` your own author's PR (and the harness identity = your persona may collide), deliver your verdict via `gh pr comment <PR#> --body` with this exact header pattern:
```

## REVIEW VERDICT: APPROVE | REQUEST_CHANGES | APPROVE_WITH_NITS

```

Followed by per-finding details. The orchestrator parses this header to decide merge action.
```

### Three-verdict semantics (imported from RandomGame 2026-06-11)

All three verdicts are load-bearing — pick the right one; don't downgrade or upgrade out of conflict-avoidance.

- **APPROVE** — ships as-is, nothing to flag beyond LGTM. Cite the evidence per focus point (file:line, CI state on commit SHA, what you independently re-ran).
- **APPROVE_WITH_NITS** — the mergeable-with-followup verdict. PR meets all ACs and SHIPS as-is; the reviewer lists non-blocking quality issues as a NUMBERED list with file:line refs. The orchestrator then either auto-files a `chore(...): PR-#N NITs follow-up` ticket scoped to the comment text (auto-decide class when scope is mechanically derivable), or absorbs the NITs into an overlapping already-scheduled downstream PR and notes the absorption on both. Does NOT apply if any NIT is flagged "needs discussion" or scope-expanding — that escalates.
  - Do NOT downgrade to APPROVE — silently dropped NITs regress on the next PR touching the surface.
  - Do NOT upgrade to REQUEST_CHANGES — it incorrectly blocks a shippable PR.
- **REQUEST_CHANGES** — PR does not merge until resolved. Reserved for: AC not met, test gap on the failure mode, vocabulary divergence with a parallel PR (see Vocabulary contract), claim-fidelity violation in the Self-Test Report, missing regression guard on a production-code change. List required changes numbered with file:line.

**Reviewer self-discipline:** tempted to APPROVE to avoid friction but you have NITs → use APPROVE_WITH_NITS. Tempted to REQUEST_CHANGES over something suboptimal that doesn't block ACs → use APPROVE_WITH_NITS. The middle lane exists to prevent the binary "ship clean or block" trap.

## Done clause (mandatory in every dispatch)

```markdown
**Done = PR open with: <list of artifacts> + ClickUp ticket flipped to IN REVIEW (or surfaced to Matt) + non-obvious findings section in PR body (if any). Brief report (≤300 words): <list of facts to surface>.**

Report back when done.
```

Replace `<list of artifacts>` and `<list of facts>` with task-specific values.

## Worktree cleanup notes (orchestrator-side, post-merge)

After a PR merges, the local-branch-delete may fail with `cannot delete branch '<role>/<task>' used by worktree at '<path>'`. This is cosmetic — the GitHub-side state is clean (remote branch deleted via `--delete-branch`), only the local branch ref lingers. Options:

- Leave it — next dispatch's `git checkout -B <new-task>` overwrites the stale local branch.
- Force-overwrite via `cd <worktree-path> && git fetch origin && git checkout -B <new-branch> origin/main`.

---

## Pre-dispatch checklist (orchestrator-side; imported from RandomGame 2026-06-11)

Run BEFORE firing each `Agent` call. Catches missing brief blocks when fixing them is a one-line edit — not after the agent burned cycles on an under-specified task.

- [ ] **Worktree-concurrency check** — scan in-flight Agent tasks for any in the target persona's worktree (`MarianLearning-<role>-wt`). Occupied → queue or reassign; never stack.
- [ ] **Fresh `origin/main`** — Step 0 force-creates the branch from `origin/main`; confirm a fetch happens (the standard Step 0 includes it).
- [ ] **Ticket body reachable** — personas WITH ClickUp read tools (Kevin, Devon, Dave, Matt) get a routing slip + ticket ID; personas WITHOUT (Jessica, Kyle) get the body inline verbatim.
- [ ] **Ticket hard gates** — explicit Out-of-scope list + named success-test present; missing → flesh out before dispatch (auto-decide class when context suffices).
- [ ] **Branch name** — `<role>/<ticket-id>-<slug>`.
- [ ] **Scoped contract block** present; tempting adjacent files NAMED in OOS.
- [ ] **Reviewer named** per routing: Devon reviews Kevin/Kyle/Jessica; Kevin reviews Devon; Dave research merges direct; markdown-only plan/spec/research PRs merge on fast-gate per precedent.
- [ ] **Pedagogy gate** (content-tier / curriculum dispatches) — committed research citation named, or explicit not-required line.
- [ ] **Port-4173 rule** — at most ONE `yarn e2e` runner across all worktrees; tell other concurrent agents vitest-only.
- [ ] **Azure credential routing** — bake / re-render work goes to a worktree with `.env.local` (kevin-wt, devon-wt) or carries compensating analysis.
- [ ] **ClickUp lifecycle** — flip to IN PROGRESS at dispatch (this-session tickets; older tickets skip to IN-REVIEW at PR-open per classifier precedent).
- [ ] **Final-report contract** — terse, cite-able evidence, real values only (no fabricated PR numbers/SHAs; "the creating turn is never the referencing turn").
- [ ] **Doc preload preamble** ("read `.claude/docs/*.md` first") + **non-obvious-findings postamble** present.
- [ ] **Vocabulary contract OR Pattern A** chosen when parallel dispatches share a NEW concept.
- [ ] **Self-Test Report block** when the PR is UX-visible.
- [ ] **`run_in_background: true` + `name:`** set on the Agent call.

## When NOT to use this template

Skip most blocks for:

- Status-pulse cron firings (read-only summaries — no dispatch).
- One-line ticket comments via Matt (no scope/worktree/gates needed).
- /investigate skill invocations (already structured by the skill itself).
- Idle-tick state updates (no scope needed).

The template is for **work-producing dispatches** (impl PRs, test PRs, review dispatches, spec PRs). Trivial admin actions stay short.
