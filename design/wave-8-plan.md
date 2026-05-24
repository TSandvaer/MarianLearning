# Wave 8 — Polish + iPad smoke first

**Status:** plan — pre-dispatch
**Date drafted:** 2026-05-24
**Author:** Matt (planning role; orchestrator dispatches)
**Sponsor decision:** Wave 8 = polish + iPad smoke first (Thomas, 2026-05-23, accepting Wave 7 retro PR #342 recommendation).
**Foundation:** retro `retro-2026-05-23-wave-7-literacy-bookend-shipped.md` § "Open strategic calls for Thomas → thread 3 (iPad smoke) first"; `[[project_content_tier_ships_6_surfaces]]`; `[[feedback_track_based_wave_decomposition]]`; `[[feedback_pr_review_routing]]`.

---

## TL;DR

Wave 8 is a deliberate **polish + integration-smoke mini-wave** before the next content-tier push. Wave 7 closed the literacy bookend (`letter-names` + `letter-sounds`) end-to-end across all 6 content-tier surfaces, but shipped 4 follow-up tickets and left one integration gap: there is no Playwright spec that drives a fresh-launch user through the full letter-names session. Wave 8 clears the follow-ups and adds the integration smoke.

The wave has **5 tickets** across **5 tracks** (planner-directive, debug-tooling, refactor, lint, e2e), with **2 already in flight** (Kevin g53, Devon g6n). The remaining 3 dispatch when workers free. After the Wave 7 sibling-tier rebase patterns, all 5 tickets are well-scoped and mechanically resolvable — no specialist-domain dispatches required.

Math pivot (subitising / sub-to-20 directive sharpening) and literacy continuation (per-vowel `letterSoundsVowelStates`, digraphs-ch / digraphs-th) are explicitly **deferred to Wave 9+**. Marian is not yet using the app (per `[[project_marian_not_using_yet]]`); polish + smoke before more content is the right discipline.

---

## Scope

### Drives

1. **Clear Wave-7 follow-up backlog** — the 4 tickets filed at Wave 7 close (g53, g6n, g5x, xkh) are all mechanical or defense-in-depth. Shipping them tightens the literacy surface before adding new content.
2. **Add first-time-experience iPad smoke** — Wave 7's letter-names regression spec (PR #338) is wire-level + assertion-sensitivity, not a full session walk-through. Without a full-session integration smoke, the letter-names tier is *correct on paper but unproven on the screen*. New ticket `86c9y9qz9` (filed this wave) closes that gap.
3. **Hold the line on content-tier additions** — no new tiers (no `cvc-words-short-e` content extensions, no digraphs-ch / digraphs-th, no math tier additions). Wave 9 reopens content.

### Success criteria

- All 5 wave tickets shipped to main with green CI (typecheck + lint + vitest + Playwright fast-gate + Playwright e2e).
- Letter-names compositionLint binding (g5x) extends test count to match sub-to-10 + letter-sounds parity (~15 tests).
- Letter-names debugSeed recipe (g6n) accessible via `?debug=1&seed=letter-names`; idempotent per existing SEEDS pattern.
- LETTER_SOUNDS_POOL dedup (xkh) leaves zero inline pool literals in `planFromServer.ts` + `WordSong.tsx`; drift-tripwire test passes.
- Letter-names WORKED EXAMPLE fix (g53) verified by next letter-names bake producing clean canon on attempt 1.
- First-time-experience iPad smoke spec (`86c9y9qz9`) drives ≥3 letter-names problems with correct + wrong + give-answer paths; runs green on chromium.

### Ship target

Wave 8 closure within ~1-2 dispatch arcs (4-8 hours of orchestration). Smaller scope than Wave 7's 10-PR arc — 5 tickets total, 2 already in flight, 3 mechanical follow-ups.

---

## Ticket inventory

### In flight (already dispatched — do not re-queue)

| #   | Ticket          | Title                                                              | Assignee   | Track             | Branch                                                |
| --- | --------------- | ------------------------------------------------------------------ | ---------- | ----------------- | ----------------------------------------------------- |
| W8.1 | **86c9y6g53**   | Fix Dave A2 letter-names WORKED EXAMPLE band-tag inconsistency     | Kevin      | planner-directive | `kevin/g53-letter-names-worked-example-fix`           |
| W8.2 | **86c9y6g6n**   | Add letter-names SEEDS recipe to debugSeed.ts                      | Devon      | debug-tooling     | `devon/g6n-letter-names-debug-seed`                   |

### Queued (orchestrator dispatches when workers free)

| #   | Ticket          | Title                                                                              | Assignee recommendation | Track    | Dependencies                                                                                  |
| --- | --------------- | ---------------------------------------------------------------------------------- | ----------------------- | -------- | --------------------------------------------------------------------------------------------- |
| W8.3 | **86c9y6xkh**   | Extract shared LETTER_SOUNDS_POOL constant (dedup planFromServer.ts + WordSong.tsx) | Kevin or Devon          | refactor | None (independent of in-flight work)                                                          |
| W8.4 | **86c9y6g5x**   | Letter-names compositionLint binding (defense-in-depth)                            | Kevin or Devon          | lint     | **W8.1** (g53) — WORKED EXAMPLE fix must land first; otherwise binding may false-positive    |
| W8.5 | **86c9y9qz9**   | First-time-experience iPad smoke for letter-names (Jessica Playwright spec)        | Jessica                 | e2e      | **W8.2** (g6n) — debugSeed recipe must land first so the spec can use the seed URL           |

**Note on assignee recommendations per `[[feedback_track_based_wave_decomposition]]`:** the queued tickets carry per-track guidance. W8.3 (refactor) and W8.4 (lint) are mechanically structured; either developer has the context after Wave 7 A3/A7/A4b/A8b. W8.5 is a Playwright spec → Jessica per `[[feedback_jessica_first_for_objective_gates]]`. The orchestrator should pick whichever of Kevin/Devon has less load when W8.3/W8.4 fire.

**Load balancing note:** Wave 7 retro Pattern B (cross-persona review routing held 10/10) confirms Kevin reviews Devon's work and vice versa. For Wave 8, the predictable review pairs are:
- W8.3 → reviewer is whoever didn't author (Kevin/Devon cross-pair)
- W8.4 → reviewer is whoever didn't author (Kevin/Devon cross-pair)
- W8.5 → reviewer is Devon (Jessica spec → Devon for objective-layout/numeric per `[[feedback_jessica_audio_visual_gate_narrowed]]`)

---

## Track recommendations (grouped by surface)

Per Wave 7 precedent (`design/wave-7-plan.md` § "Per-tier work"), the tracks reflect *which file/system surface a ticket touches*, not just the persona. This makes parallel-author conflict prediction explicit.

### Track 1 — Planner-directive (Kevin in-flight)

- **W8.1 (g53)** — Letter-names WORKED EXAMPLE band-tag fix in `api/_planner.ts`.
- Touches `WORD_SONG_TRACK_GUIDE` letter-names directive block only. No conflict surface with other in-flight work.
- Generalisable pattern: WORKED EXAMPLE rows must be tag-consistent with the FACT POOL rows for the same fact — surfacing this to `.claude/docs/planner-and-canon.md` (Wave 7 retro Pattern 5 doc-elevation candidate).

### Track 2 — Debug-tooling (Devon in-flight)

- **W8.2 (g6n)** — Letter-names debugSeed recipe in `src/state/debugSeed.ts` (verify exact path; may be `src/lib/debug/debugSeed.ts` per `.claude/docs/screens-and-flows.md § Debug seeds`).
- Sole edits to `debugSeed.ts` SEEDS table + optional unit test. No conflict surface with W8.1.

### Track 3 — Refactor (Kevin or Devon)

- **W8.3 (xkh)** — Extract `LETTER_SOUNDS_POOL` to a shared module; consume from `planFromServer.ts` + `WordSong.tsx`.
- Touches `src/screens/WordSong/` only. No conflict with W8.1 (planner) or W8.2 (debugSeed).
- Mechanically scoped: ~50-80 LOC extraction + drift-tripwire test. ~30 min dev work.

### Track 4 — Lint (Kevin or Devon, AFTER W8.1)

- **W8.4 (g5x)** — Letter-names compositionLint binding in `scripts/compositionLint.ts` + `scripts/compositionLint.test.ts`.
- Touches lint infra only. Mirror sub-to-10 / letter-sounds binding shape; ~200-400 LOC + ~15 unit tests.
- **Hard dependency on W8.1**: if the WORKED EXAMPLE inconsistency is still in `_planner.ts` when this binding lands, future re-bakes will trip false-positives. W8.1 must merge first.

### Track 5 — E2E (Jessica, AFTER W8.2)

- **W8.5 (86c9y9qz9)** — First-time-experience iPad smoke spec at `e2e/letter-names-first-time-experience.spec.ts`.
- Touches `e2e/` only. **Hard dependency on W8.2** (debugSeed recipe must exist for the spec to use the seed URL).
- Per `.claude/docs/testing-and-ci.md §4.1.1b` (failing-first timeout sizing), the spec must call `test.setTimeout(180_000)` minimum (3 sessions × ~50s wall-time + 30s headroom).

---

## Sequencing

### Currently in flight (no orchestrator action needed)

```
W8.1 Kevin g53 (planner-directive) — IN FLIGHT
W8.2 Devon g6n (debug-tooling)    — IN FLIGHT
```

### Round 2 — fires when W8.1 or W8.2 lands (parallel-dispatchable per `[[feedback_always_parallel_dispatch]]`)

```
W8.3 xkh refactor       — independent (can fire now, parallel with W8.1 + W8.2)
W8.4 g5x lint            — needs W8.1 MERGED
W8.5 86c9y9qz9 E2E smoke — needs W8.2 MERGED
```

### Practical dispatch order

The orchestrator may dispatch W8.3 **immediately** (no dependency) and queue W8.4 + W8.5 against the merge events of W8.1 + W8.2 respectively. The merge cascade:

1. W8.1 (Kevin) merges → unblocks W8.4 (lint binding) for dispatch.
2. W8.2 (Devon) merges → unblocks W8.5 (Jessica E2E spec) for dispatch.
3. W8.3 (refactor) runs independently throughout.

This keeps 3-5 agents in flight (orchestrator default density per `[[feedback_always_parallel_dispatch]]`) and avoids serialization on the dependency chain.

### Conflict surface

Per Wave 7 sibling-tier rebase experience (`[[feedback_sibling_tier_rebase_mechanical]]`):

| File                              | Touched by    | Conflict risk                                                                                  |
| --------------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| `api/_planner.ts`                 | W8.1          | None — only Kevin's branch edits this in flight                                                |
| `src/lib/debug/debugSeed.ts`      | W8.2          | None — only Devon's branch edits this in flight                                                |
| `src/screens/WordSong/`           | W8.3          | Low — touches `planFromServer.ts` + `WordSong.tsx`; no other Wave 8 ticket touches these       |
| `scripts/compositionLint*.ts`     | W8.4          | None — sole editor                                                                              |
| `e2e/`                            | W8.5          | None — new spec file; reads `e2e/_helpers/seedStorage.ts` after W8.2's seed exists             |

**Net:** Wave 8 has *zero predictable inter-ticket conflicts*. The Wave 7 sibling-tier rebase pattern doesn't apply here; each track touches a distinct surface.

---

## Peer-review pairs

Per `[[feedback_pr_review_routing]]` + Wave 7 retro Pattern B (10/10 routing-correct):

| Ticket | Author | Reviewer | Routing rule                                                                                              |
| ------ | ------ | -------- | --------------------------------------------------------------------------------------------------------- |
| W8.1   | Kevin  | Devon    | Standard Kevin↔Devon cross-pair                                                                            |
| W8.2   | Devon  | Kevin    | Standard Kevin↔Devon cross-pair                                                                            |
| W8.3   | Kevin or Devon | the other | Kevin↔Devon cross-pair                                                                                      |
| W8.4   | Kevin or Devon | the other | Kevin↔Devon cross-pair                                                                                      |
| W8.5   | Jessica | Devon   | Jessica's specs route to Devon for objective layout/numeric assertions (`[[feedback_jessica_audio_visual_gate_narrowed]]`) |

---

## Risk register

Mechanical risks only — direction is locked, no strategic-pivot risk.

| #   | Risk                                                                                                                                                          | Mitigation                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | **W8.5 (E2E smoke) timeout sizing.** Multi-session progression specs systematically blow Playwright's default 90s budget per `.claude/docs/testing-and-ci.md §4.1.1b`. | Brief Jessica explicitly to set `test.setTimeout(180_000)` minimum (3 sessions × 50s + 30s headroom). Verified pattern from PR #206 (short-e progression spec).                                                                                                                                  |
| R2  | **W8.5 dependency on W8.2 seed.** If W8.2's SEEDS recipe path/shape diverges from the iPad-smoke spec's expectations, W8.5 may fail to load the seeded state. | Brief Jessica to verify the seed name + skill-level shape via `?debug=1&seed=<name>` smoke before authoring assertions. If divergence surfaces, file a one-line follow-up to align the seed shape; do NOT block W8.5 on it.                                                                       |
| R3  | **W8.4 (lint binding) false-positives if W8.1 hasn't merged.** Per the W8.4 ticket body, the binding may misfire against an inconsistent WORKED EXAMPLE.       | Hard merge-order gate: orchestrator does NOT dispatch W8.4 until W8.1 is MERGED (not just PR-open). Sequence enforced via the dispatch queue.                                                                                                                                                  |
| R4  | **CI fast-gate flake on W8.5.** Playwright AudioContext quirks on webkit (per `.claude/docs/testing-and-ci.md §2.2`) — webkit headless has no AudioContext.   | W8.5 explicitly scopes to chromium only; webkit may skip via `test.skip` if the chip-enable path requires audio. Brief Jessica with this — same pattern as cvc-words specs.                                                                                                                     |
| R5  | **Vacuous CI on W8.3 refactor.** Per `.claude/docs/testing-and-ci.md §3.3.2`, asset-only / pure-extraction PRs can pass CI while behavior is broken.          | W8.3 includes a drift-tripwire test asserting the constant matches the spec's documented pool. Brief Kevin/Devon explicitly to verify both call sites (`planFromServer.ts:97` + `WordSong.tsx:2176`) actually import the new constant, not just that the test compiles.                       |
| R6  | **MCP ClickUp auth expiry mid-wave.** Wave 7 retro flagged this risk; tickets may stall on status flips.                                                       | Out of Matt's hands; orchestrator handles re-auth when it surfaces. Plan does not depend on mid-wave ticket-flip latency for correctness.                                                                                                                                                       |
| R7  | **Wave 8 is markdown-heavy on this plan PR**. This PR itself is markdown-only and merges direct per `[[feedback_pr_review_routing]]` (Dave's research-PR precedent). | No peer review needed for this wave-plan PR; orchestrator can direct-merge once CI fast-gate passes (typecheck + lint trivially pass for a docs-only change).                                                                                                                                  |

---

## Out of scope (deferred to Wave 9+)

- **d9x per-vowel `letterSoundsVowelStates`** (literacy-tier scope) — per Wave 7 retro Open call thread 2 deferral. Filed as ticket `86c9y5d9x`. Adds vowel-aware first-encounter state to letter-sounds; non-trivial spec work + canon rebake. Wave 9 candidate.
- **Math pivot (subitising / sub-to-20 directive sharpening)** — per Wave 7 retro Open call thread 2. Dave's sub-to-20 audit (PR #327) is merged + ready to spec. Wave 9 candidate.
- **Digraphs-ch + digraphs-th content tiers** — per Wave 7 retro Open call thread 1. Same 6-surface shape as Wave 7; estimated 8-10 PRs. Wave 9 candidate.
- **Wave 6D follow-up — Jessica failNetwork → canon-bytes mock migration** — carry-over from Wave 6 retro. Defense-in-depth; not blocking.
- **Real-iPad observation (Thomas)** — Marian is not yet using the app per `[[project_marian_not_using_yet]]`. Thomas's own ear+eye test on letter-names is a *separate* sidebar he may run when convenient; not gating Wave 8 closure.

---

## Memory promotion candidates (this wave)

Patterns to watch for during Wave 8 dispatch that may warrant promotion at retro time:

- **Wave-8-style "polish mini-wave" framing** — if the polish + smoke-first discipline ships cleanly and the orchestrator wants to formalise "polish mini-wave after every content-tier wave," that's a candidate retro pattern.
- **First-time-experience integration smoke pattern (W8.5)** — if W8.5 ships clean and is reusable, the SEED→screen→session→end-state shape generalises to any tier whose natural picker doesn't land. Reference shape for Wave 9 if any tier defaults skip the entry point (e.g. cvc-words-short-e per Marian's diagnostic).
- **No-content-pivot waves are valuable** — calibration data point for orchestrator if the wave ships in ~half the time of Wave 7 with proportionally low risk. Foundation for future "polish wave" sizing.

---

## Cross-references

- `[[project_content_tier_ships_6_surfaces]]` — every new content tier needs 6 surfaces in lockstep (canon + planner-first-class + parser + screen-render + E2E + lint binding). Wave 7 lesson; informs why W8.4 (letter-names lint binding) closes the bookend tier's 6-surface contract.
- `[[feedback_sibling_tier_rebase_mechanical]]` — sibling-tier PR conflicts on sync-contract files resolve "accept both additions" in-lane. Wave 8 has zero sibling-tier conflicts predicted (see § Conflict surface).
- `[[feedback_track_based_wave_decomposition]]` — per-track assignee_recommendation pattern; informs § Track recommendations.
- `[[feedback_pr_review_routing]]` — Kevin↔Devon cross-review + Jessica→Devon routing; informs § Peer-review pairs.
- `[[feedback_jessica_first_for_objective_gates]]` — Playwright spec authoring is Jessica's surface; informs W8.5.
- `[[feedback_jessica_audio_visual_gate_narrowed]]` — Jessica spec reviewers default to Devon for objective layout/numeric.
- `[[feedback_progression_e2e_mandatory]]` — multi-session progression specs require timeout sizing per `.claude/docs/testing-and-ci.md §4.1.1b`.
- `[[feedback_always_parallel_dispatch]]` — 3-5 agents in flight default density.
- `[[project_marian_not_using_yet]]` — Marian is in content + polish phase; Playwright is the integration surface, not real-child observation.
- `[[feedback_no_sponsor_as_expert]]` — none of Wave 8's tickets require specialist-domain dispatch; all are mechanical or defense-in-depth.
- `.claude/retros/retro-2026-05-23-wave-7-literacy-bookend-shipped.md` § "Open strategic calls for Thomas" — Wave 8 = thread 3 (polish + iPad smoke).
- `.claude/docs/testing-and-ci.md §4.1.1b` — failing-first E2E timeout sizing (180s minimum for 3-session progression spec).
- `.claude/docs/testing-and-ci.md §2.2` — webkit headless AudioContext caveat.
- `.claude/docs/testing-and-ci.md §3.3.2` — vacuous CI on asset-only / pure-refactor PRs.
- `.claude/docs/planner-and-canon.md` — directive authoring patterns; doc-elevation candidate for the WORKED EXAMPLE band-tag consistency rule (Wave 7 retro Pattern 5).
- `design/wave-7-plan.md` — structural precedent for this plan.
