# Progression state-machine E2E coverage audit — 2026-05-13

**Context:** Thomas reproduced an 8-session production regression manually on
his iPhone. `cvc-words` and three other default-`'intro'` nodes are permanently
stuck: the mastery rule's `applyMasteryRule()` in `mastery.ts` only walks nodes
at `'practicing'` and explicitly skips `'intro'`. There is no `intro →
practicing` transition anywhere in the codebase. Ticket `86c9qu91g`.

This document inventories the progression state-machine edges, maps current
E2E coverage against them, and proposes a permanent dispatch gate to prevent
this class of bug from landing undetected again.

---

## 1. State-machine edge inventory

Four `SkillLevel` values: `locked | intro | practicing | mastered`.

The following transitions are implied by the design:

| Edge                            | Description                                                                            | Where it should happen                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `locked → intro`                | A node unlocks when its prerequisite is mastered                                       | `applyMasteryRule` (line ~250 / ~313) when a `practicing` node promotes |
| `intro → practicing`            | A node graduates from scaffolded intro to active practice after first real session     | **MISSING** — no code performs this transition (the bug)                |
| `practicing → mastered`         | A node is mastered after N qualifying sessions                                         | `applyMasteryRule` lines ~309-310 (`autoPromote=true` branch)           |
| `practicing → pending`          | Queued mastery when `autoPromote=false`                                                | `applyMasteryRule` line ~343, sets `pendingPromotion`                   |
| `pending → mastered` (re-entry) | Queued promotion applied on next session-end when `autoPromote` flipped back to `true` | `applyMasteryRule` lines ~239-258                                       |

### Coverage matrix (as of 2026-05-13, before fix)

| Edge                                       | E2E covered                                                                                                                                | Unit covered                       | Gap                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | -------------------------- |
| `locked → intro`                           | Partially — `mastery-promotion.spec.ts` test verifies `add-to-20` unlocks from `locked` to `intro` as a side-effect of `add-to-10` mastery | `mastery.test.ts` has direct tests | Covered                    |
| `intro → practicing`                       | **NONE**                                                                                                                                   | **NONE**                           | **CRITICAL GAP — the bug** |
| `practicing → mastered`                    | `mastery-promotion.spec.ts` — full end-to-end for `add-to-10`                                                                              | `mastery.test.ts` exhaustive       | Covered                    |
| `practicing → pending` (autoPromote=false) | Not covered in E2E                                                                                                                         | `mastery.test.ts` unit tests       | E2E gap, lower priority    |
| `pending → mastered` re-entry              | Not covered in E2E                                                                                                                         | `mastery.test.ts` unit tests       | E2E gap, lower priority    |

### Affected nodes (default-`'intro'` in diagnostic baseline)

These four nodes start at `'intro'` in `defaultProgress()` and are therefore
permanently unpromotable on current main:

| Node          | Track     | Downstream unlock   |
| ------------- | --------- | ------------------- |
| `cvc-words`   | word-song | `cvc-words-short-o` |
| `sub-to-20`   | math      | `two-digit-addsub`  |
| `mult-2-5-10` | math      | `mult-3-4`          |
| `sight-words` | word-song | `simple-sentences`  |

---

## 2. Spec delivered (ticket 86c9qu91g)

`e2e/progression-mastery-loop.spec.ts` — four test suites, one per affected
node. Each suite:

1. Seeds the node at `'intro'` with all prerequisites mastered.
2. Runs 2 perfect sessions (threshold 80%/2, crossDay off).
3. Asserts `skillLevels[node] === 'mastered'` and the downstream neighbour
   flipped to `'intro'`.
4. Uses count-based assertions throughout (`.toBe()` + `.toEqual([...])`).

All four tests FAIL on current main with "Expected: mastered / Received: intro".
All four turn GREEN once Kevin's fix (`fix/86c9qu91g-intro-to-practicing`) lands.

---

## 3. Permanent dispatch-rule proposal

**Rule — progression state-machine gate (memory-ready text):**

> Any PR that touches `mastery.ts`, `focusNode.ts`, `parentSettings.ts`,
> `progressHistory.ts`, `defaults.ts`, or `guards.ts` — i.e. any file in the
> progression state-machine — MUST be paired with at minimum one Jessica E2E
> spec that exercises the state transition the PR introduces or modifies.
>
> The spec must:
>
> - Be a FAILING test on the PR's base branch (failing-test-first discipline).
> - Use `seedStorage` helpers to drive a clean before-state.
> - Assert the EXACT skill level after N sessions (`.toBe()`, not `.toContain`).
> - Assert the downstream unlock as a second invariant.
>
> This gate is enforced at dispatch-brief authoring time by the orchestrator.
> The `qa/progression-e2e-coverage` branch (2026-05-13) is the reference
> implementation.

**Suggested memory entry key:** `feedback_progression_statemachine_e2e_gate`

---

## 4. Additional state-machine gaps flagged during audit

### Gap A — `intro → practicing` is the only completely missing transition

Confirmed by exhaustive grep: the string `'practicing'` is assigned in
`applyMasteryRule` only. The string `'intro'` is assigned in two places — the
`locked → intro` downstream-unlock branch in `applyMasteryRule`, and the
diagnostic-baseline `defaults.ts`. There is no write of `'practicing'` to a
node that was `'intro'`. The fix belongs in `applyMasteryRule`: after a first
session on an `'intro'` node (or immediately on first encounter), the node
should advance to `'practicing'` so the standard 90/3 / 95/3 window can begin
accumulating.

Kevin's fix (ticket `86c9qu91g`) addresses this edge specifically.

### Gap B — `practicing → mastered` is fully covered but only for `add-to-10`

`mastery-promotion.spec.ts` drives the loop for `add-to-10` only. The other
`'practicing'` nodes in the diagnostic baseline (`add-to-10`, `letter-sounds`,
`blending-cv`) have no individual E2E promotion loop. The add-to-10 spec is
representative, but a silent regression to `applyMasteryRule`'s `qualifies()`
function would only be caught on that one node. Risk is low because unit tests
in `mastery.test.ts` cover `qualifies()` exhaustively. Recommendation: leave
as-is for now; the unit coverage is sufficient for this edge.

### Gap C — `autoPromote=false` path is unit-only

The `pending → mastered` re-entry path (parent flips `autoPromote` from false
to true) has no E2E coverage. If the interaction between `ParentSettings` and
`applyMasteryRule` regresses, only unit tests would catch it. This is a
ParentSettings-screen concern — lower P than the intro bug. Flag for a
follow-up ticket when ParentSettings gets an E2E pass.

### Gap D — graduation gate (`cvc-words` novel-pool) has no E2E

`isGraduationSessionPending` and `graduationGateClears` in `mastery.ts` are
unit-tested only. A graduation-gate regression (novel-pool threshold not
evaluated, or planner not receiving the `isGraduationSession=true` flag) would
need Thomas to observe it on the iPad. Low-risk today because the graduation
gate is only active for `cvc-words` and the plannerRoundTrip.test.ts pins the
server contract. Worth an E2E spec when the graduation flow ships to Marian.

### Gap E — `crossDayEnforcement` de-dupe is not exercised in existing E2E

`mastery-promotion.spec.ts` seeds dates 3/2/1 days ago at mid-UTC so the
cross-day filter produces 3 distinct days regardless of whether UTC or
local-day keying is used. The P0.3 regression (UTC vs local-day for Manila
evening sessions) that was diagnosed in `design/audits/2026-05-02-polish/
jessica-qa-edge-cases.md` is NOT regression-locked in E2E with a timezone-
pinned test. The fix landed but there's no safety net if it regresses. Flag
for a follow-up timezone-pinned E2E spec.

---

## 5. Cross-references

- Failing spec: `e2e/progression-mastery-loop.spec.ts` (ticket 86c9qu91g).
- Fix PR: `fix/86c9qu91g-intro-to-practicing` (Kevin, in flight).
- Existing promotion spec: `e2e/mastery-promotion.spec.ts` (ticket 86c9kwnmx).
- Source of truth: `src/lib/progress/mastery.ts` `applyMasteryRule()`.
- Sibling doc: `.claude/docs/progress-and-persistence.md` § "M3 mastery rule".
- Prior QA audit: `design/audits/2026-05-02-polish/jessica-qa-edge-cases.md`.
