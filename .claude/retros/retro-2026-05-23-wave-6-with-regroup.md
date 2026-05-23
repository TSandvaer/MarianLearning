# Retro — Wave 6 (two-digit-addsub-with-regroup canon) + PR #309 NIT cleanup

**Date:** 2026-05-23  
**Scope:** Wave 6 substantive ship + sibling PR #309 NIT cleanup arc — 6 PRs end-to-end in one orchestration session.

## Outcome

Wave 6 shipped end-to-end in one continuous orchestration arc. Canon for `two-digit-addsub-with-regroup` baked + on main, closing the last Wave-5 deferral (`WAVE_5_PR_B_PENDING_WITH_REGROUP` exemption removed). Three sibling PR #309 NITs (Devon's cross-review NOFs from prior session) cleaned up in parallel. 6 PRs merged, 0 reverts, 0 broken main builds.

| PR   | Author / scope                                                                                | Merged at |
| ---- | --------------------------------------------------------------------------------------------- | --------- |
| #313 | Kevin — PR #309 NIT 1: type alias rename `ResolvedDistractorClass` → `OfferedDistractorClass` | `84afa09` |
| #314 | Dave — Wave 6A: Haiku directive sharpening for `-with-regroup`                                | `5de4836` |
| #316 | Kevin — PR #309 NIT 3: tighten `SessionEndPayload.perProblemDistractorClass`                  | `a827bf9` |
| #317 | Kevin — PR #309 NIT 2: retire `buildChipOrderWithClass`, fold into `buildChipOrder`           | `588b08d` |
| #318 | Kevin — Wave 6C: bake `-with-regroup` canon, retire deferral exemption                        | `3d88fc4` |
| #315 | Jessica — Wave 6B: failing-first E2E for `-with-regroup` progression                          | `32bcd4a` |

Devon reviewed all 6 PRs (Kevin ×4 + Dave ×1 + Jessica ×1); all APPROVE on first cross-review pass.

## What went well

- **First-attempt clean bake on PR #318.** Dave's directive (PR #314) with the RULE_IDENTITY+SPEC+LINT triple-pin drift-guard produced a Haiku canon that honored every load-bearing dimension (op-mix, band-by-slot, carry/borrow cap, P1=+ rule, ≥1 borrow-from-tens in P5-P8, 30-fact pool membership, no duplicates) on the first bake. No re-rolls. Devon's independent verification of all 8 problems passed without a single drift.
- **Track-based parallel-author wave decomposition** ([[feedback_track_based_wave_decomposition]]). Dave + Jessica fanned out in parallel at the start of Wave 6 (directive-author + failing-first-test author). Kevin took NIT 1 first (independent of Wave 6 critical path), then pivoted to Wave 6C once #314 merged. No idle persona.
- **Failing-first protocol validated end-to-end.** Jessica's Test 1 (canon `existsSync` assertion) was concrete, flake-immune, and flipped RED → GREEN exactly when Wave 6C landed. The protocol caught the canon-binding seam at the right granularity.
- **Auto-mode orchestration scaled cleanly.** 6 PRs through brief + dispatch + review + merge with minimal user intervention. The orchestrator-autonomy promoted classes from 2026-05-23 ([[feedback_orchestrator_autonomy_framework_2026_05_23]] rule 6) — routine-PR-merge with CI green + peer-reviewer attached — handled all 6 merges as auto-decide.
- **Pre-staged Wave-N+1 plumbing** paid off. PR #307 (Wave 5 PR A) had pre-registered `lintTwoDigitAddsubWithRegroup` lint binding + the `MATH_NODES_IN_ORDER` literal in the schema. Wave 6C became purely a bake + exemption-removal step — no plumbing changes, no schema edits. This is the cleanest possible Wave-N+1 surface.

## What went poorly

- **Jessica's Test 2 was structurally defective.** Under `installClaudeMock(page, { failNetwork: true })`, the route abort fires BEFORE the server-side canon-lookup codepath — meaning the canon being on disk could never make Test 2 green. The defect was caught only by Kevin's empirical verification during Wave 6C bake; Devon's PR #315 review ran the test, saw it RED on `main`, and approved without tracing why the post-bake transition would actually work. Required a mid-merge-cascade `.fixme` on Test 2 + Wave 6D follow-up ticket queued. **Lesson:** failing-first tests need to prove they can be MADE GREEN, not just verified RED, before being marked load-bearing.
- **ClickUp MCP auth expired silently mid-session and never recovered.** Multiple ticket flips queued (Wave 6 epic IN PROGRESS → COMPLETE, NIT tickets IN REVIEW, NIT tickets COMPLETE). No auto-refresh path was triggered in the chat-side `/mcp` surface. Backlog of ticket-state work waiting on next user-initiated re-auth.
- **Sub-agent `duration_ms` reports are wildly inaccurate.** Kevin's Wave 6C agent reported `duration_ms: 1061390` (~17 min) when wall-clock was much shorter; Dave's Wave 6A reported `10572844` ms (~176 min) when actual time was ~30 min. Orchestrator can't reliably use the `duration_ms` field for staleness detection — must use external signals (worktree commits, branch push timestamps).
- **Two early ClickUp ticket-update denials by auto-mode classifier.** Flipping `86c9y34xp` and `86c9y34xn` to IN PROGRESS was denied with "Moving a ticket to IN PROGRESS modifies an external collaboration system item the agent did not create this session, with no user direction for this specific change." Workaround was to skip the IN PROGRESS step entirely (the IN REVIEW flip later, when the corresponding PR lands, was accepted). **Lesson:** in auto-mode, ClickUp ticket-status moves are easier to clear when paired with a concrete observable side-effect (PR open / merged) rather than a speculative "about to start work" flip.
- **One Kevin agent dispatch died on a Claude session-limit** (per the new-account switch event mid-session). No partial commits existed; full re-dispatch was needed. ~5-min orchestration cost.
- **Doc-hygiene drift accumulated unrecorded.** Devon's PR #317 review flagged 4 stale `buildChipOrderWithClass` references in Math.tsx JSDoc + `screens-and-flows.md:166`. A follow-up ticket was queued but blocked on MCP re-auth, so the drift is currently uncatalogued at the source-of-truth level. Risk: forgotten if next session's resumer doesn't notice the todo.

## Surprising findings

- **The RULE_IDENTITY+SPEC+LINT triple-pin pattern emerged via independent discovery, not design.** Dave used it organically in PR #314's directive; Devon independently flagged it in his review as "the strongest pin I've seen in directive prose." Now codified as Pattern 7 in [[feedback_haiku_directive_sharpening]]. The 2026-05-15 4-pattern playbook had a Pattern 4 ("drift-guard wording") but didn't mandate the LINT coordinate. Empirical discovery beat the abstract framing.
- **The `pickStaticSessionPlan` add-to-20 special-case is a sibling-tier-shipping landmine.** Jessica's spec author note (PR #315 spec docstring) catalogued that `pickStaticSessionPlan` only special-cases `add-to-20`; every other non-`add-to-10` tier under `failNetwork` falls into the add-to-10 rotation. This means failing-first tests that rely on operand range to distinguish tiers are structurally tied to this special-case logic. Worth surfacing in `.claude/docs/testing-and-ci.md` adjacent to the existing §4.1.1d trivially-green-trap rule (deferred to next doc-elevation pass).
- **The producer-strict / boundary-loose persistence pattern surfaced via Kevin's NIT 3 investigation.** Producer (`Math.tsx`) is strict-typed; middle-hop (`SessionEndPayload`) was previously wide-typed; persistence boundary (`guards.ts`) is intentionally loose with documented rationale. NIT 3 closed the middle-hop hole without disturbing the boundary contract. Devon recommends documenting this in `progress-and-persistence.md` adjacent to the K2 remap. Pending.
- **Wave 6C bake telemetry:** 1 session × 8 problems = ~59 utterances, ~1295 KB on-disk. Lower than expected — the directive's tight rules + Haiku's first-attempt cleanness meant no re-bake cycles. Cost: ~$0.02 spend per [[feedback_haiku_directive_sharpening]] cost expectation.

## Patterns + anti-patterns to internalize

- **PATTERN — pre-staged Wave-N+1 plumbing**: When a wave touches a binding seam (lint contract + schema literal + planner directive + canon file), pre-stage the lint contract + schema literal one wave early. The next wave becomes purely a bake step. Validated on Wave 6C; should be the default for future tier-ship waves.
- **PATTERN — triple-pin drift-guard tags** ([[feedback_haiku_directive_sharpening]] Pattern 7): every `<drift-guard>` MUST include `RULE_IDENTITY` + `SPEC=file:section` + `LINT=file:line`. One coordinate is a sticky note; three is a load-bearing anchor.
- **PATTERN — producer-strict / boundary-loose persistence**: type strictly at the producer + in-app middle hops; intentionally widen at the persistence boundary with documented rationale. Strict-typed values flow into loose persistence as structural subtypes (no coercion). Documented at `guards.ts:184-200` but not yet at `.claude/docs/progress-and-persistence.md` (queued).
- **ANTI-PATTERN — failing-first via network-abort mocks at the route layer**: route-level network aborts can't be unwound by server-side state changes. If the assertion is "canon serves the right content", the mock must serve canon-bytes, not abort. See PR #283 add-to-20 pattern for the correct shape. Wave 6D ticket queued to upgrade Jessica's spec.
- **ANTI-PATTERN — cross-PR doc-hygiene gets silently abandoned**: when a reviewer flags stale references across files outside the PR's scope, the in-PR push to "keep boundary clean" is correct BUT the follow-up ticket must be filed in the same orchestration tick — otherwise the drift is uncatalogued. The MCP-expiry this session made this worse; we now have ≥4 stale references and a queued-but-unfiled ticket.

## Durable lessons promoted to memory

- **Pattern 7 (RULE_IDENTITY+SPEC+LINT triple-pin)** → [[feedback_haiku_directive_sharpening]] updated this session.
- **Retro convention (option 1 / wave-batch threshold)** → [[feedback_retro_post_merge_convention]] created this session. (THIS file is the first artifact under the new convention.)
- **Producer-strict / boundary-loose pattern** → pending elevation to `.claude/docs/progress-and-persistence.md` (queued).
- **MATH_TRACK_GUIDE insertion-order discipline** → pending elevation to `.claude/docs/planner-and-canon.md` (queued, per Devon's PR #314 review).

## Next-session backlog

1. **File Wave 6D ticket**: replace `failNetwork: true` mock with canon-bytes mock per PR #283 pattern in Jessica's `-with-regroup` E2E spec. Un-`fixme` Test 2.
2. **File doc-hygiene ticket**: clean up 4 stale `buildChipOrderWithClass` references (3 in Math.tsx JSDoc lines 900/1664/2986 + `.claude/docs/screens-and-flows.md:166`).
3. **Flip ClickUp tickets** to reflect actual state (epic `86c9y34xn` → COMPLETE; NIT tickets `86c9y34xp`, `86c9y34xr`, `86c9y34xx` → COMPLETE).
4. **Doc elevations**: producer-strict/boundary-loose pattern → `progress-and-persistence.md`; MATH_TRACK_GUIDE insertion-order → `planner-and-canon.md`.
5. **Wave 7?** — open question for sponsor: what's the next math-tier or skill-area to ship? Wave 5 (`-no-regroup`) + Wave 6 (`-with-regroup`) closes the two-digit-addsub family. Likely candidates: multiplication 2×/5×/10× per the project skill tree, or shore up subtraction-to-20-with-regrouping.
