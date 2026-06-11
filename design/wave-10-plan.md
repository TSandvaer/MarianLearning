# Wave 10 — Math pivot: subitising (sub-to-10 EASY band) + sub-to-20 directive defense-in-depth

**Status:** plan — pre-dispatch
**Date drafted:** 2026-06-11
**Author:** Matt (planning role; orchestrator dispatches)

## Sponsor decision (recorded)

| Field | Value |
| ----- | ----- |
| **Decider** | Thomas (Sponsor / Product Owner) |
| **Date** | 2026-06-11 |
| **Decision** | Wave 10 = the **math pivot**: subitising + sub-to-20 directive sharpening + canon re-bake. |
| **Alternative considered** | Digraphs-ch / digraphs-th literacy continuation (SkillNode literals already exist from PR #211; content-side only, ~8-10 PRs). |
| **Why recorded here** | Wave-direction selection is a strategic-priority call (never-auto-decide per the orchestrator-autonomy never-list). It was Thomas's to make; the Wave 9 retro (`retro-2026-06-08-wave-9-per-vowel-letter-sounds.md` § Open/next) left both candidates open pending sponsor input. This is that input. |

> **One finding that reshapes the brief — surfaced, not silently absorbed (`[[feedback_no_sponsor_as_expert]]`):** Thomas's framing was "subitising + sub-to-20 directive sharpening + **canon re-bake**." Two of those three sub-items are already shipped or were audited-and-closed, so the literal framing over-scopes the wave. The team rec below re-shapes the *content* of the math pivot to the work that genuinely remains, while keeping the wave squarely inside Thomas's math-pivot direction. This is a re-shape **within** the chosen direction, not a redirect away from it — the math pivot stands.

---

## TL;DR

Wave 10 delivers the math pivot in two tracks of genuinely-remaining work, plus a thin verification track:

1. **Subitising — extend the dot-card scaffold to the `sub-to-10` EASY band.** The add-to-10 EASY-band subitising scaffold already shipped (PRs #268/#270, ticket `86c9ur1zr`): `src/screens/Math/subitisingScaffold.ts`, the `<DotCard>` / `<DotCardOverlay>` primitive, and the `profile.subitisingScaffoldSessionsObserved` fluency-fade counter are all live. The open extension is the **sub-to-10 analogue** — explicitly deferred in `design/math/subitising-scaffold-content.md` §7.2 / §8.1 ("post-`sub-to-10` ship; different mental model — take-from-one-quantity vs combine-two; needs fresh visual-primitive design"). This is a **research-gated, spec-first** track: Dave consult → Kyle spec → Devon impl → Jessica E2E. It is NOT a greenfield build and NOT a copy of the add-to-10 trigger predicate.

2. **sub-to-20 directive defense-in-depth (NO re-bake).** Dave's post-Wave-6 canon-engineering audit (PR #327, `design/research/sub-to-20-canon-audit-2026-05-23.md`) reached an explicit **"do NOT re-bake; close audit"** verdict: the sub-to-20 directive at `api/_planner.ts:1112-1187` is "materially the sharpest math-track directive in the codebase," the composition-lint binding already exists and is "the most comprehensive in the codebase," and the shipped canon is "composition-lint-clean and pedagogically excellent" — at the pedagogical ceiling (4 CLEAN Class-B facts in P4-P8 vs minimum 2). The audit left exactly **three** deferred follow-ups, all defense-in-depth: (a) the missing `api/_planner.test.ts` sub-to-20 directive-side test suite, (b) the Pattern 7 triple-pin `<drift-guard>` tag, (c) the Pattern 6 stylistic hoist (CATEGORY-MIX BUDGET first). Wave 10 ships (a) + (b) — real verification value, low risk, no canon churn — and explicitly **defers (c)** as cosmetic-only with no documented saturation failure mode on this tier.

3. **Verification track.** Jessica's failing-first specs gate both tracks objectively per `[[feedback_progression_e2e_mandatory]]` + `[[feedback_jessica_first_for_objective_gates]]`.

**The wave is 5 tickets across 4 tracks** (research / spec / planner-lint / render-UI / e2e). Subitising is the load-bearing pedagogical work; sub-to-20 defense-in-depth is mechanical hardening.

---

## The "canon re-bake" question — explicit team recommendation

Thomas's framing included "canon re-bake." Single team rec (no option-menu to Thomas per `[[feedback_no_sponsor_as_expert]]`):

**Recommendation: do NOT re-bake sub-to-20 canon in Wave 10.** Foundation:

- Dave's PR #327 audit § 5 "Re-bake decision": *"Do NOT re-bake. The shipped canon is composition-lint-clean and pedagogically excellent. A re-bake under stylistic Pattern 6 / Pattern 7 additions has no informational content change and risks the LIKELY-row-risk above (canon differs in 1-3 facts; E2E specs that hard-code values break)."*
- Marian-disruption blast radius of a re-bake is **zero** today — she is not on the app (`[[project_marian_not_using_yet]]`) and sub-to-20 is two promotions away even when she starts. But "zero disruption" is an argument for *safety*, not for *value* — the canon is already at the pedagogical ceiling, so a re-bake buys nothing.
- A re-bake is non-deterministic (Haiku); it would churn 1-3 facts with no quality gain and could break any E2E spec that pins literal fact strings — pure cost.

**If Thomas wants the canon re-baked anyway** (e.g. to land the Pattern 6 stylistic hoist and regenerate against it for fleet consistency), that is a one-ticket add (W10.X below, marked OPTIONAL) — but the audit's verdict is churn-without-payback, and the orchestrator's default is to skip it. Surface this to Thomas as a yes/no on the OPTIONAL ticket only; the rest of the wave does not depend on his answer.

---

## Scope

### Drives

1. **Bridge counting → retrieval on the subtraction tier.** Marian's diagnostic finger-counts on subtraction count-backs; subitising the minuend as an instant-recognition pattern (rather than counting it out) is the same number-sense intervention that grounded the add-to-10 scaffold (Dave `add-to-10-counting-to-recall.md`). The sub-to-10 EASY band (`5-5=0`, `8-4=4`, `6-3=3`, `9-1=8`) is where the take-from-one-quantity mental model first appears — the right place to introduce a subtraction-shaped dot-card.
2. **Close the sub-to-20 directive's two real verification gaps** (planner-test coverage + triple-pin tag) so future directive edits can't drift inside-bounds-but-wrong without a test catching it. Per Dave PR #327 § 4 risk-register row "no planner-test sub-to-20 coverage" (MEDIUM today).
3. **Keep the math pivot inside the 4-6 week scope budget** by NOT re-baking canon that's already at the pedagogical ceiling, and by spec-gating the subitising extension before any code so the fresh visual primitive doesn't get built twice.

### Success criteria

- All wave tickets shipped to main with green CI (fast-gate: typecheck + lint + canon-lint + vitest; e2e: Playwright chromium + webkit).
- Dave research note on the sub-to-10 subitising mental model lands under `design/research/` (W10.1).
- Kyle spec for the sub-to-10 subitising scaffold lands under `design/math/` extending `subitising-scaffold-content.md` (W10.2), with the take-away visual semantics resolved.
- `shouldShowSubitisingScaffold()` (or the equivalent existing predicate) fires for `focusNode === 'sub-to-10'` EASY band per spec; the `<DotCard>` primitive renders the subtraction-shaped affordance (W10.3).
- `api/_planner.test.ts` carries a sub-to-20 directive-side suite asserting read-line template / pool membership / band coverage / annotation presence / no-`distractorClass`-emission (W10.4).
- `<drift-guard RULE_IDENTITY=sub-to-20; ...>` triple-pin tag present at `api/_planner.ts:1112` (W10.4, bundled).
- Failing-first E2E spec covers the sub-to-10 subitising trigger + fluency-fade + a regression-pin (W10.5); assertion-sensitivity sub-test included per Wave 7 retro Pattern 3.

### Ship target

~2-3 dispatch arcs. Comparable scope to Wave 9 — one research/spec front-half (W10.1 → W10.2 sequential, pedagogy-gated) then a parallel implementation back-half. Smaller than Wave 7's 10-PR arc.

---

## Ticket inventory

> Ticket IDs are **NOT yet filed** — this is a plan PR. The orchestrator files the tickets after reviewing this plan (per the dispatch brief: "Do NOT file the Wave 10 tickets yet"). The `<pending>` placeholders below are filled at filing time, never fabricated.

### Primary

| #     | Ticket | Title | Assignee | Track |
| ----- | ------ | ----- | -------- | ----- |
| —     | `<pending-epic>` | Wave 10 (parent): math pivot — sub-to-10 subitising + sub-to-20 defense-in-depth | (epic) | (parent) |
| W10.1 | `<pending>` | Research — sub-to-10 subitising mental model + take-away visual semantics + fluency-fade signal | Dave | research |
| W10.2 | `<pending>` | Spec — sub-to-10 subitising scaffold content tier (extends `subitising-scaffold-content.md`) | Kyle | spec |
| W10.3 | `<pending>` | Impl — `sub-to-10` subitising trigger predicate + `<DotCard>` take-away render + fluency-fade gate | Devon | render-UI |
| W10.4 | `<pending>` | sub-to-20 defense-in-depth — `_planner.test.ts` directive suite + Pattern 7 `<drift-guard>` tag | Kevin | planner-lint |
| W10.5 | `<pending>` | Failing-first E2E — sub-to-10 subitising trigger + fluency-fade + regression-pin | Jessica | e2e |

### Optional (Thomas yes/no — re-bake)

| #     | Ticket | Title | Assignee | Track |
| ----- | ------ | ----- | -------- | ----- |
| W10.X | `<pending>` | OPTIONAL — Pattern 6 hoist + sub-to-20 canon re-bake (skip per Dave PR #327 verdict unless Thomas requests) | Kevin | planner-lint |

### Out of scope for Wave 10

- **sub-to-20 canon re-bake** (W10.X is OPTIONAL and recommended-skip — Dave PR #327 "do NOT re-bake").
- **Pattern 6 stylistic hoist** as a standalone (folded into the OPTIONAL re-bake ticket only — cosmetic, no documented saturation failure mode on sub-to-20).
- **Subitising for multiplication concept** (`subitising-scaffold-content.md` §7.3 / §8.2 — post-`add-to-20` ship; fresh visual primitive + fresh research).
- **add-to-20 cross-10-bridge subitising extension** (`add-to-20-content.md` §53 — separate future sibling spec).
- **Digraphs-ch / digraphs-th content tiers** (the alternative Thomas did NOT pick; Wave 11 candidate).
- **New SkillNode literals** — none added this wave.
- **New ParentSettings field** (`subitisingScaffold?: 'on'|'off'|'auto'` is `subitising-scaffold-content.md` §8.4 follow-up, not this wave).
- **`distractors.ts` widening for new subtraction distractor classes** — sub-to-10's distractor pool is already shipped; subitising is a render-layer scaffold, not a distractor change.

---

## Track recommendations (grouped by surface)

Per `[[feedback_track_based_wave_decomposition]]` — tracks reflect the file/system surface each ticket touches, making parallel-author conflict prediction explicit. Assignee recommendation per surface: **planner / lint → Kevin; render / UI → Devon; e2e / spec → Jessica**; research → Dave; design-spec → Kyle.

### Track 1 — Research + Spec (Dave → Kyle)

- **W10.1 (Dave)** — Research note answering the §7.2 open questions: how does subitising work for *take-from-one-quantity* subtraction (vs *combine-two* addition)? Does the dot-card show the minuend and fade `subtrahend` pips, or a different primitive? Which fluency-fade signal (re-use `subitisingScaffoldSessionsObserved`, or a per-tier counter)? Touches `design/research/` only (NEW file, e.g. `sub-to-10-subitising-mental-model.md`).
- **W10.2 (Kyle)** — Spec extending `design/math/subitising-scaffold-content.md` (or a sibling `sub-to-10` section) with the locked take-away visual semantics + trigger predicate + fluency-fade rule, consuming Dave's note. Touches `design/math/subitising-scaffold-content.md` (+ possibly `design/screen-math-subitising-prompt.md` for the take-away visual envelope).
- **Sequential, pedagogy-gated:** W10.2 must NOT begin until W10.1 lands and its mental-model call is reviewed — same gate Dave's `sub-to-20-pedagogical-sequence.md` placed on Kyle's sub-to-20 spec. Both markdown-only; mergeable orchestrator-direct per `[[feedback_pr_review_routing]]` (Dave research-PR / spec-only precedent).

### Track 2 — Render / UI (Devon)

- **W10.3 (Devon)** — Implements the `sub-to-10` trigger branch of `shouldShowSubitisingScaffold()` + the take-away `<DotCard>` render mode + the fluency-fade gate. **Strongest-on-frontend** rationale: animation / layout / visual-primitive work (the take-away pip-fade affordance), squarely Devon's lane per the agent roster.
- Touches `src/screens/Math/subitisingScaffold.ts`, `src/screens/Math/Math.tsx` (trigger wiring + render), the `<DotCard>` / `<DotCardOverlay>` components, `src/App.tsx` (session-start derived-state block — mind the add-to-10 precedent at `App.tsx:818-827`), possibly `src/lib/progress/types.ts` if a new per-tier fade counter is introduced.
- **Hard dependency on W10.2** (spec is the contract). Kevin reviews per the cross-pair rule.

### Track 3 — Planner / lint (Kevin)

- **W10.4 (Kevin)** — `api/_planner.test.ts` sub-to-20 directive-side suite (mirror the sub-to-10 distractorClass drift-guard at `_planner.test.ts:3289-3332`) + the `<drift-guard RULE_IDENTITY=sub-to-20; SPEC=design/math/sub-to-20-content.md§1.1; LINT=scripts/compositionLint.ts:1198 (RULES) + 1312 (lint fn) + 3893 (BINDING)>` tag at `api/_planner.ts:1112`. **Strongest-on-backend / TDD** rationale: pure test-authoring + directive annotation, no UI surface.
- Touches `api/_planner.test.ts` (NEW suite) + `api/_planner.ts:1112` (one-line tag). NO directive prose edit, NO canon re-bake.
- **No dependency** on the subitising tracks — fully parallel-dispatchable from Round 1. Devon reviews per the cross-pair rule.
- **Pre-dispatch hygiene self-check (Dave PR #327 § 3 follow-up #3):** the dispatch brief MUST cite the *verified* lint-binding state, not a guessed one. `git grep -l "SUB_TO_TWENTY\|SubToTwenty"` confirms the binding exists at `scripts/compositionLint.ts:1198 (RULES) / 1312 (lint fn) / 3893 (path binding)`. Two prior cycles (B1 add-to-10, B5 sub-to-20) had Matt's brief wrongly claim "no binding exists" — that claim is NOT repeated here; the binding is confirmed present and W10.4 ADDS test coverage on top of it, it does not create the binding.

### Track 4 — E2E (Jessica)

- **W10.5 (Jessica)** — Failing-first spec for the sub-to-10 subitising trigger: scaffold fires on `sub-to-10` EASY-band in-scope problems, does NOT fire out-of-band, fades per the fluency rule, plus a regression-pin and the assertion-sensitivity sub-test (Wave 7 retro Pattern 3). **Strongest-on-automation** rationale.
- Touches `e2e/sub-to-10-subitising.spec.ts` (NEW), `e2e/_helpers/seedStorage.ts` (only if a new fade-counter field needs seeding — coordinate with W10.3), `e2e/_helpers/mockClaude.ts` (extension if needed).
- **Soft dependency on W10.2** (Jessica can author RED against the spec'd field shape before W10.3 lands, per `.claude/docs/testing-and-ci.md` §4.1.1a typing-contract precedent). **Hard dependency for GREEN on W10.3.**
- Per `[[feedback_failing_first_must_prove_green]]` + `.claude/docs/testing-and-ci.md` §4.1.1d/§4.1.1e: canon-bytes mock + positive discriminators on captured request bodies, NOT `failNetwork: true` + negative-membership. Per §4.1.1b: `test.setTimeout(>=180_000)` if the spec walks multiple full sessions to exercise the fade.

---

## Sequencing

### Round 1 (immediate parallel dispatch)

```
W10.1 Dave   research note  (parallel — markdown only, gates W10.2)
W10.4 Kevin  sub-to-20 D-i-D (parallel — fully independent of subitising tracks)
```

Two agents in flight from the start. Kevin's sub-to-20 defense-in-depth has zero coupling to the subitising work, so it ships on its own clock while the pedagogy front-half runs.

### Round 2 (fires when W10.1 lands + is reviewed)

```
W10.2 Kyle    spec           (needs Dave's mental-model call)
W10.5 Jessica E2E author RED  (parallel — references the spec'd field shape pre-impl)
```

### Round 3 (fires when W10.2 lands)

```
W10.3 Devon   impl           (needs Kyle's spec as contract)
```

### Round 4 (fires when W10.3 merges)

```
W10.5 Jessica E2E GREEN attestation + merge
```

### Dispatch density

- Peak in-flight: 2 agents (Dave + Kevin in Round 1; Kyle + Jessica in Round 2).
- Per `[[feedback_dispatch_density_vs_gate]]`: gate-actor is CI for W10.3/W10.4/W10.5 (fan out); but W10.1 → W10.2 is a **pedagogy gate**, not a CI gate — that front-half is deliberately serial and unhurried. No Thomas surface for any code round.

### SEQUENCING CONSTRAINT — voice-QA baseline gates any audio re-bake (LOAD-BEARING)

> **A voice-QA test system is being built in parallel RIGHT NOW** (tickets VQA.1-3: `86ca7er39` / `86ca7er73` / `86ca7eraj`). Thomas will use it to **baseline-test all current canon audio** in a first full voice-QA pass.

**The constraint:** **no Wave 10 ticket may trigger a canon audio re-bake before Thomas's first full voice-QA baseline pass completes.** A re-bake regenerates utterance text → re-renders Azure TTS bytes → invalidates the very canon Thomas is about to baseline. Re-baking mid-baseline would pull the rug out from under the voice-QA system the moment it goes live.

**How the plan honours it:**

- **The primary 5 tickets (W10.1-W10.5) do NOT re-bake any canon.** W10.4 is test-coverage + a one-line directive tag — zero canon bytes touched. The subitising tracks (W10.1-W10.3, W10.5) are render-layer scaffold work — zero canon bytes touched. So the primary wave is **already baseline-safe** and can proceed in parallel with the voice-QA build with no audio risk.
- **The OPTIONAL re-bake ticket (W10.X) is the only canon-mutating ticket in the wave, and it is sequenced LAST and marked `gated-on-sponsor-baseline`.** It may NOT be dispatched until (1) Thomas confirms he wants the re-bake at all (recommended-skip per Dave PR #327), AND (2) Thomas's first full voice-QA baseline pass on current canon is complete. Even if Thomas greenlights the re-bake, it waits behind the baseline.
- **Audio-TTS correctness is a load-bearing Sponsor gate** regardless (`matt.md` step 6 + `[[feedback_jessica_audio_visual_gate_narrowed]]`): any utterance-text / SSML / re-render change routes to Thomas's ear, never auto-merged. W10.X inherits that gate on top of the baseline gate.

**Net:** the wave is structured so the work Thomas picked (the math pivot) proceeds immediately and safely alongside the voice-QA build, and the one piece that *could* collide with the baseline (a canon re-bake) is both (a) recommended-skip and (b) hard-gated behind the baseline if he wants it anyway.

---

## Conflict surface

Per `[[feedback_track_based_wave_decomposition]]` + the Wave 9 lesson (branch each ticket off post-merge `origin/main` to dissolve predicted sibling conflicts).

| File | Touched by | Conflict risk + recommended merge order |
| ---- | ---------- | --------------------------------------- |
| `design/research/sub-to-10-subitising-mental-model.md` (NEW) | W10.1 | None — Dave's branch only. Merge FIRST (gates W10.2). |
| `design/math/subitising-scaffold-content.md` | W10.2 | None — Kyle sole editor. Merge after W10.1. |
| `design/screen-math-subitising-prompt.md` | W10.2 (maybe) | None — Kyle sole editor if touched. |
| `src/screens/Math/subitisingScaffold.ts` | W10.3 | None — Devon sole editor. |
| `src/screens/Math/Math.tsx` | W10.3 | **Low** — Devon sole editor this wave, but Math.tsx is hot-edit territory (~2200 lines); rebase onto latest `origin/main` before opening the PR. Anchor any spec refs by stable name primitives (`shouldShowSubitisingScaffold`, `<DotCard>`, `subitisingScaffoldRenderedRef`), NOT line numbers, per `.claude/docs/screens-and-flows.md` § Math spec-authoring convention. |
| `src/App.tsx` | W10.3 | None this wave — but the session-start derived-state block (`App.tsx:818-827`) is the add-to-10 subitising precedent; Devon extends the same block. Mind the 3-block refactor trigger in `architecture-overview.md` if a third derived block is added. |
| `src/lib/progress/types.ts` | W10.3 (maybe) | **Low** — only if a new per-tier fade counter is introduced; additive optional field, same pattern as `subitisingScaffoldSessionsObserved`. Merge after W10.2 spec locks whether a new field is needed. |
| `api/_planner.test.ts` | W10.4 | None — Kevin sole editor (NEW suite, append-only). Fully parallel — merge any time. |
| `api/_planner.ts` (line ~1112) | W10.4 | **Very low** — one-line `<drift-guard>` tag insert at the sub-to-20 block head. No prose edit. Would only conflict with W10.X (re-bake) if both touch the sub-to-20 directive — but W10.X is OPTIONAL + last + gated, so no live overlap. |
| `public/canon/math/level-1/sub-to-20.json` | W10.X only (OPTIONAL) | **N/A for primary wave** — primary tickets never touch canon. If W10.X runs, it is the sole canon edit and is gated-on-sponsor-baseline (see Sequencing Constraint). |
| `e2e/sub-to-10-subitising.spec.ts` (NEW) | W10.5 | None — NEW file. |
| `e2e/_helpers/seedStorage.ts` | W10.5 (maybe), W10.3 (maybe) | **Low** — only if W10.3 adds a new seeded fade-counter field; then W10.5 consumes it. Coordinate field name at W10.2 spec time (vocabulary-contract discipline) so Devon + Jessica use the same identifier. Merge W10.3 first; W10.5 rebases. |
| `e2e/_helpers/mockClaude.ts` | W10.5 (maybe) | None — extension only. |

**Recommended merge order:** W10.1 → W10.4 (parallel, independent) → W10.2 → W10.3 → W10.5. W10.X (if greenlit) is strictly last and behind the voice-QA baseline.

**Net:** Wave 10 has **near-zero inter-ticket conflict** by construction. The only predictable overlaps are W10.3 ↔ W10.5 on a possible new fade-counter field (resolved by a vocabulary contract at W10.2 spec time per `[[parallel-agent-shared-concept-vocabulary]]`) and the Math.tsx hot-edit rebase hygiene (mechanical). The sub-to-20 track is fully isolated from the subitising tracks.

---

## Dispatch contracts (stubs — Matt finalises at ticket-filing time)

Per `design/dispatch-contract.md`: contracts attach to non-trivial / cross-persona / architecture-touching tickets. W10.3 (render + session-gen + persistence) and W10.4 (session-generation directive) both qualify. W10.1/W10.2 are spec/research (Goal + Out-of-scope only). Jessica writes each Done-when test BEFORE the implementing dev is dispatched — the test is the spec.

### W10.3 — sub-to-10 subitising impl (contract stub)

```
### Dispatch contract
Goal: When Marian is on sub-to-10 EASY-band problems, a take-away-shaped dot-card
  flashes the minuend as an instant-recognition pattern before Emma reads the line —
  the subtraction analogue of the shipped add-to-10 scaffold.

Acceptance criteria (each maps to a Jessica assertion — finalise against Kyle's W10.2 spec):
- shouldShowSubitisingScaffold fires for focusNode === 'sub-to-10' on in-band problems per spec
- does NOT fire out-of-band / on other focus nodes
- <DotCard> renders the take-away affordance per Kyle's locked visual semantics
- fluency-fade gate suppresses the scaffold per the W10.2 fade rule
- reduced-motion + no-Emma-voice-change invariants preserved (subitising-scaffold-content.md S3.2/S5)
- no regression: existing add-to-10 subitising tests still pass

Out of scope (do NOT touch):
- The add-to-10 trigger branch (do not refactor the shipped predicate)
- Any canon JSON / planner directive / Azure TTS (render-layer only)
- distractors.ts (no distractor-class change)
- New ParentSettings field (S8.4 follow-up, not this wave)

Done-when test: e2e/sub-to-10-subitising.spec.ts::<Jessica names it> (W10.5)
  Asserts: scaffold data-attribute present iff sub-to-10 EASY-band in-scope problem

Files in play: src/screens/Math/subitisingScaffold.ts, src/screens/Math/Math.tsx,
  src/components/<DotCard files>, src/App.tsx (session-start derived block),
  src/lib/progress/types.ts (only if new fade counter)
  -> Edit outside this list -> comment on the ticket and wait.
```

### W10.4 — sub-to-20 defense-in-depth (contract stub)

```
### Dispatch contract
Goal: Lock the sub-to-20 directive against silent inside-bounds-but-wrong drift by adding
  the missing planner-test suite + the Pattern 7 triple-pin drift-guard tag. NO re-bake.

Acceptance criteria:
- _planner.test.ts asserts every sub-to-20 directive-emitted read-line matches the "minus" template
- asserts NO read-line contains "take away"
- asserts every (a,b) pair is in the 22-fact SUB_TO_TWENTY_POOL
- asserts >=1 take-to-decade + >=2 CLEAN Class-B in P4-P8
- asserts the directive systemText carries the [BAND/category] + DEC= annotations
- asserts the directive does NOT instruct Haiku to emit distractorClass (not.toMatch on the emit-instruction phrasing)
- <drift-guard RULE_IDENTITY=sub-to-20; ...> tag present at api/_planner.ts:1112

Out of scope (do NOT touch):
- public/canon/math/level-1/sub-to-20.json (NO re-bake — Dave PR #327 verdict)
- The directive prose itself (no Pattern 6 hoist this ticket; that is OPTIONAL W10.X)
- Any other tier's directive or lint binding

Done-when test: api/_planner.test.ts::<the new sub-to-20 directive suite>
  Asserts: directive composition rules hold against a stubbed-Haiku sub-to-20 plan

Files in play: api/_planner.test.ts (NEW suite), api/_planner.ts (line ~1112 tag only)
  -> Edit outside this list -> comment on the ticket and wait.
```

---

## Peer-review pairs

Per `[[feedback_pr_review_routing]]` + Wave 9 retro Pattern B (10/10 routing-correct):

| Ticket | Author | Reviewer | Routing rule |
| ------ | ------ | -------- | ------------ |
| W10.1 | Dave | (none — research markdown direct merge) | Dave research-PR precedent — orchestrator merges direct after CI fast-gate |
| W10.2 | Kyle | (none — spec markdown direct merge) | Spec-only precedent — orchestrator merges direct after CI fast-gate |
| W10.3 | Devon | Kevin | Standard Devon-Kevin cross-pair (Devon authors render -> Kevin reviews) |
| W10.4 | Kevin | Devon | Standard Kevin-Devon cross-pair |
| W10.5 | Jessica | Devon | Jessica's specs route to Devon for objective layout/numeric assertions per `[[feedback_jessica_audio_visual_gate_narrowed]]` |
| W10.X | Kevin | Devon | (OPTIONAL) — PLUS mandatory Thomas ear-gate on the re-baked audio (audio-TTS load-bearing gate) |

**Thomas-surface prediction:** the primary 5 tickets are CI/peer-gated — no Thomas surface. **W10.2 carries one latent subjective-visual surface:** the take-away dot-card affordance (fade-out pips vs alternative primitive) is a Kyle design call that may want a Thomas eyeball if Kyle + Devon can't converge on the visual feel — route per the subjective-visual gate (`[[feedback_jessica_audio_visual_gate_narrowed]]`), Thomas only on aesthetic disagreement Devon can't resolve. **W10.X carries the hard audio-TTS Thomas gate** (re-baked utterance audio -> Thomas's ear).

---

## Risk register

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | **Subitising for subtraction is a fresh mental model** — the add-to-10 two-cell combine layout does not map onto take-from-one-quantity. Building the wrong primitive is the cost. | W10.1 (Dave research) -> W10.2 (Kyle spec) is a hard pedagogy gate before any code. `subitising-scaffold-content.md` §7.2 already flags "different mental model; needs fresh visual-primitive design." Do NOT let W10.3 start before the spec locks the take-away semantics. |
| R2 | **Math.tsx hot-edit rebase churn** (~2200 lines, frequent additions). | W10.3 rebases onto latest `origin/main` before opening the PR; spec refs anchored by stable name primitives, not line numbers (`.claude/docs/screens-and-flows.md` § Math). |
| R3 | **Sub-to-20 re-bake collides with Thomas's voice-QA baseline.** | Structural: primary wave touches ZERO canon; the only canon-mutating ticket (W10.X) is OPTIONAL, last, and `gated-on-sponsor-baseline`. See Sequencing Constraint. |
| R4 | **W10.5 trivially-green trap** (`failNetwork` + negative-membership). | W10.5 acceptance criteria pin canon-bytes mock + positive discriminators on captured request bodies + assertion-sensitivity sub-test, per `.claude/docs/testing-and-ci.md` §4.1.1d/§4.1.1e. |
| R5 | **W10.5 E2E timeout sizing** (multi-session fade walk blows the 90s budget). | `test.setTimeout(>=180_000)` at authoring time per `.claude/docs/testing-and-ci.md` §4.1.1b. |
| R6 | **Matt pre-audit binding-status claim wrong (3rd cycle).** Dave's PR #327 flagged 2 consecutive cycles where Matt's brief wrongly claimed "no sub-to-20 lint binding." | This plan does NOT repeat that claim. The binding is confirmed present (`scripts/compositionLint.ts:1198/1312/3893`) via grep before drafting; W10.4 ADDS test coverage on top of the existing binding, it does not create a binding. Dispatch brief carries the verified state. |
| R7 | **New fade-counter field vocabulary divergence** between W10.3 (producer) and W10.5 (consumer). | Vocabulary contract at W10.2 spec time per `[[parallel-agent-shared-concept-vocabulary]]` — Kyle's spec names the exact field identifier (if one is needed) so Devon + Jessica read the same name. Merge W10.3 first; W10.5 rebases. |
| R8 | **Re-bake pressure from the literal "canon re-bake" framing.** Thomas's words included "canon re-bake"; absorbing that literally would churn a ceiling-quality canon. | Surfaced as an explicit team rec (do-NOT-re-bake) up top + an OPTIONAL gated ticket. The wave does not depend on the re-bake; Thomas gets a clean yes/no on W10.X only. Per `[[feedback_no_sponsor_as_expert]]`. |
| R9 | **MCP ClickUp auth expiry mid-wave** (Wave 9 retro flagged). | Out of Matt's hands; orchestrator handles re-auth. Plan correctness does not depend on mid-wave ticket-flip latency. |

---

## Defer-list (Wave 11+)

- **Digraphs-ch + digraphs-th content tiers** — the alternative Thomas did NOT pick this wave. SkillNode literals already exist (PR #211 split); content-side only, ~8-10 PRs. Strong Wave 11 candidate.
- **Subitising for multiplication concept** (`subitising-scaffold-content.md` §7.3 / §8.2) — post-`add-to-20` ship; fresh visual primitive + fresh Dave research.
- **add-to-20 cross-10-bridge subitising extension** (`add-to-20-content.md` §53 / §668) — separate future sibling spec.
- **Pattern 6 stylistic hoist fleet-wide** — apply the CATEGORY-MIX-BUDGET-first shape across add-to-10 / sub-to-10 / two-digit tiers for consistency. Cosmetic; low priority; only worth it bundled with a re-bake that is needed for other reasons.
- **READ-LINE NEGATIVE ANCHOR back-port** — Dave PR #327 § 2 notes sub-to-20 has this anchor but add-to-10 / add-to-20 / sub-to-10 do NOT (latent silent-wrong-tier-misrender risk). Back-port as defense-in-depth when those tiers are next touched.
- **`subitisingScaffold` ParentSettings opt-out** (`subitising-scaffold-content.md` §8.4) — if Thomas requests after ship.
- **Sight-words / simple-sentences tiers** — Wave 12+ per CLAUDE.md skill-tree order.

---

## Memory promotion candidates (this wave)

- **Subitising-for-subtraction primitive** — if the take-away dot-card ships clean, that is a reusable pattern for the multiplication-grouping primitive later. Candidate retro pattern.
- **"Literal sponsor framing over-scopes the wave" handling** — Thomas said "canon re-bake"; the right move was to honour the *direction* (math pivot) while re-shaping the *content* to genuinely-remaining work and surfacing the re-bake as a recommend-skip. If this lands without friction it reinforces `[[feedback_no_sponsor_as_expert]]` + `[[feedback_dont_stop_execute_default]]`.
- **Audit-closes-the-loop on directive sharpening** — Dave's PR #327 "do NOT re-bake; close audit" verdict saved a whole re-bake + spec + regression-spec arc (B6/B7 skipped). Validates the close-audit-as-a-real-outcome posture for directive-sharpening work.

---

## Cross-references

- **Sponsor decision** — Thomas 2026-06-11 (math pivot over digraphs); recorded in the header table.
- `[[feedback_no_sponsor_as_expert]]` — single team rec on the re-bake question; no option-menu to Thomas.
- `[[feedback_track_based_wave_decomposition]]` — per-track assignee_recommendation (planner/lint -> Kevin, render/UI -> Devon, e2e/spec -> Jessica).
- `[[feedback_pr_review_routing]]` + `[[feedback_jessica_audio_visual_gate_narrowed]]` — peer-review pairs + Thomas-surface narrowing.
- `[[feedback_progression_e2e_mandatory]]` + `[[feedback_jessica_first_for_objective_gates]]` — W10.5 failing-first gate.
- `[[feedback_failing_first_must_prove_green]]` — W10.5 must prove GREEN, not just RED.
- `[[feedback_haiku_directive_sharpening]]` — the 7-pattern playbook W10.4 verifies sub-to-20 against (Patterns 1/2/4/5 honoured; 6/7 are the gaps; 7 + the planner-test land this wave).
- `[[feedback_canon_state_empirical_verification]]` — binding-state + canon-state claims verified by grep before drafting (R6).
- `[[parallel-agent-shared-concept-vocabulary]]` — fade-counter field-name contract (R7).
- `[[project_marian_not_using_yet]]` — Marian in content + polish phase; Playwright is the integration surface; re-bake has zero Marian-disruption (but also zero value).
- `[[feedback_dont_stop_execute_default]]` — orchestrator takes the defensible default (skip re-bake) rather than escalating a menu.
- **Dave PR #327** — `design/research/sub-to-20-canon-audit-2026-05-23.md` — "do NOT re-bake; close audit"; the three deferred follow-ups W10.4 lands (a)+(b), defers (c).
- **Dave** — `design/research/sub-to-20-pedagogical-sequence.md` — sub-to-20 curriculum authority (Class A/B, no-borrow, band split).
- **Dave** — `design/research/add-to-10-counting-to-recall.md` — the original subitising-as-automaticity-accelerator research (Priority 2) that grounded the add-to-10 scaffold and grounds the sub-to-10 extension.
- **Kyle** — `design/math/subitising-scaffold-content.md` §7.2 / §8.1 — the explicit deferral of sub-to-10 subitising that W10.1/W10.2 pick up.
- **Kyle** — `design/screen-math-subitising-prompt.md` — the dot-card visual primitive W10.3 consumes.
- `design/math/sub-to-20-content.md` — Kyle's sub-to-20 spec (22-fact pool) W10.4's planner-test asserts against.
- `design/wave-9-plan.md` — structural template for this plan (track decomposition + conflict-surface + sequencing shape).
- `.claude/retros/retro-2026-06-08-wave-9-per-vowel-letter-sounds.md` § Open/next — left the math-pivot-vs-digraphs choice to Thomas; this wave is that choice resolved.
- `.claude/docs/screens-and-flows.md` § Math — Math.tsx spec-authoring convention (stable name primitives, not line numbers).
- `.claude/docs/architecture-overview.md` § session-start derived-state blocks — the App.tsx kick-effect pattern W10.3 extends (mind the 3-block refactor trigger).
- `.claude/docs/testing-and-ci.md` §4.1.1b/§4.1.1d/§4.1.1e — W10.5 timeout sizing + trivially-green-trap avoidance.
- `.claude/docs/planner-and-canon.md` § "Wire shape is utterance-only" + § "Drift-guard shape for these locks" — informs W10.4's test assertions.
- `design/dispatch-contract.md` — contract structure for W10.3 + W10.4 stubs above.
