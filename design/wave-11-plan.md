# Wave 11 — Digraphs ch + th content tiers

**Status:** plan — pre-dispatch
**Date drafted:** 2026-06-11
**Author:** Matt (planning role; orchestrator dispatches)
**Branch:** `matt/wave-11-plan` (base `main` @ `1b6c1b6`)

## Sponsor decision (recorded)

| Field                 | Value                                                                                                                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decider**           | Thomas (Sponsor / Product Owner)                                                                                                                                                                                                                                            |
| **Date**              | 2026-06-11                                                                                                                                                                                                                                                                  |
| **Decision**          | Wave 11 = **digraphs ch + th content tiers** — the front-runner from the Wave 10 retro defer-list.                                                                                                                                                                          |
| **Why recorded here** | Wave-direction selection is a strategic-priority call (never-auto-decide per the orchestrator-autonomy never-list). It was Thomas's to make; the Wave 10 retro (`retro-2026-06-11-wave-10-math-pivot.md` § Open/next) listed it as a Wave 11 candidate. This is that input. |

---

## TL;DR — the requested work is already shipped

**The digraphs-ch and digraphs-th content tiers are FULLY SHIPPED across all six content surfaces, all sibling-tier widening points, and e2e — and were re-baked with the British Olivia voice in PR #356.** There is no content-tier build work left to dispatch. This plan surfaces that finding with ground-truth evidence (not silently absorbing it per `[[feedback_no_sponsor_as_expert]]`), and re-points the wave at the genuinely-remaining digraph-adjacent work for Thomas's direction.

The nomination came from a **stale defer-list**. The Wave 10 retro § Open/next and `skill-trees-and-content.md` both describe ch/th as "SkillNode literals exist" — implying infrastructure-only, content pending. Ground truth is further along: the content tiers were authored, baked, spec'd, researched, and e2e-covered back in PRs #226/#227 (ch) and #230 (th), then re-voiced in #356. The retro line was written from the doc's framing, not from the code.

This is a verify-ground-truth-before-building situation: a plan that filed "build the ch/th content tiers" tickets would be fabricating progress against already-merged work.

---

## Evidence — six-surface coverage confirmed (ground truth, not docs)

Verified by `git grep` + `ls` against `main` @ `1b6c1b6`. The content-tier 6-surface contract (`[[project_content_tier_ships_6_surfaces]]`):

| #   | Surface                                 | digraphs-ch                                     | digraphs-th-voiceless                                                             | Evidence                                                                                                                                                                                         |
| --- | --------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Canon bake**                          | shipped — `digraphs-ch.json` (1.10 MB)          | shipped — `digraphs-th-voiceless.json` (1.19 MB)                                  | `public/canon/word-song/level-1/`; both in `WORD_SONG_FOCUS_NODES` bake list (`scripts/generateSessionCanon.ts:290-292`). Sizes match `cvc-words.json` (1.08 MB) — real baked audio, not stubs.  |
| 2   | **Planner-first-class**                 | shipped                                         | shipped                                                                           | Both in `WORD_SONG_FIRST_CLASS_FOCUS_NODES` (`api/_planner.ts:759-761`) + full `WORD_SONG_TRACK_GUIDE` directive blocks (ch: ZERO hybridMode words; th: TWO hybridMode + articulation scaffold). |
| 3   | **Browser parser / planner word lists** | shipped — `WORD_SONG_TARGET_WORDS_DIGRAPHS_CH`  | shipped — `WORD_SONG_TARGET_WORDS_DIGRAPHS_TH`                                    | `api/_plannerWordList.ts:215+`, `259+`.                                                                                                                                                          |
| 4   | **WordSong render (wordPack)**          | shipped — chin/chip/chop/chat/chest/chug/chick  | shipped — thin/bath/path/moth/thick (+pool)                                       | `src/screens/WordSong/wordPack.ts:867-934`, `998-1066`; `vowel`-set per the ch/th asymmetry note in `skill-trees-and-content.md`.                                                                |
| 5   | **E2E**                                 | shipped — `digraphs-ch-content.spec.ts`         | shipped — `digraphs-th-content.spec.ts` + `digraphs-th-mouth-cue-display.spec.ts` | `e2e/`; failing-first specs landed via #226 / #230.                                                                                                                                              |
| 6   | **Lint / planner-test regression**      | shipped — routing-table sweep + drift tripwires | shipped — same                                                                    | `api/_planner.test.ts:2556+` (ch block), `2793+` (th block) — `VALID_WORD_SONG_FOCUS_NODES` membership pins + cache-invariant + no-graduation-leak.                                              |

**Plus all 16 sibling-tier widening points** (`sibling-tier-checklist.md`) confirmed present for both literals: `types.ts` union, `focusNode.ts` order, `mastery.ts` `LITERACY_TREE`, `guards.ts` `SKILL_NODES`, `defaults.ts` `SCHEMA_FLOOR_NODES` + `DEFAULT_SKILL_LEVELS`, `Hub/stages.ts` (+ id union), `stageIcons.tsx` (ch/th glyphs), `progressProjection.ts` (digraphs-ch / digraphs-th labels), `e2e/_helpers/seedStorage.ts`, `api/_planner.ts` valid+first-class sets, `generateSessionCanon.ts` bake list, `debugSeed.ts` (`?debug=1&seed=digraphs-ch` + `...=digraphs-th-voiceless`).

**Pedagogy gate — SATISFIED (committed citations exist):** Dave's ch/th sequencing research is committed:

- `design/research/digraph-ch-addendum.md` (/tʃ/ acquisition + ch inventory) — commit `5da1e71`.
- `design/research/digraph-th-addendum.md` (voiceless /θ/ + th inventory) — commit `8c43395`.
- `design/research/digraph-acquisition-marian.md` (umbrella sequencing).

Per-tier word-list specs also committed: `design/word-song/digraphs-ch-word-list.md`, `digraphs-th-word-list.md`, `digraphs-th-mouth-cue-integration.md`. The dispatch-template Pedagogy gate (committed-citation-before-content) is met — and was met when the tiers originally shipped.

**Ship provenance:** ch via PR #226 (e2e) / #227 (wordPack+planner+canon); th via PR #230; both re-baked text-preserving in the British-voice swap PR #356 (`b1c9da8`) and validated through the voice-QA loop.

---

## What genuinely remains in the digraph family (two polish-backlog items)

Neither is a "content tier"; neither is dev-dispatchable today without Thomas's direction. Both were already on the polish backlog before this wave.

### A. Digraph picture packs (asset-generation track — gated on Thomas / Midjourney)

ch/sh/th word chips render **silhouette fallbacks**, not real illustrations — there are **no `pic-{chin,chip,...,thin,bath,...}.svg` assets** in `public/assets/`. The prompt specs exist and are committed (`design/word-song/digraphs-{ch,sh,th}-picture-pack-prompts.md`), so the design work is done; the missing step is the Midjourney generation -> bgclear/crop -> embed pipeline. That is a **Thomas-driven MJ activity** (`[[feedback_mj_walkthrough_step_by_step]]` — one prompt at a time, Thomas is the 4-grid gate), not a Kevin/Devon build. Same posture as every prior vowel-tier picture pack.

### B. sh/ch mouth-cue parity (subjective-visual + design-intent)

Only `emma-th-mouth.svg` shipped (PR #235/#237). `emma-sh-mouth.svg` + `emma-ch-mouth.svg` are explicitly **design-intent-not-yet-shipped** per `emma-character-and-animation.md` § 3b. The wiring seam is a documented template (PR #236 `SkillLevel`-prop-gated non-pose cue), so the dev side is mechanical — but the **asset** side is another face-crop MJ generation (high-contrast-background caveat per the Emma doc) + a subjective-visual sign-off that is a Thomas gate, not a Jessica gate (`[[feedback_jessica_audio_visual_gate_narrowed]]`).

---

## Recommendation (single team rec — no option-menu per `[[feedback_no_sponsor_as_expert]]`)

**Do NOT file build tickets for the ch/th content tiers — they are shipped. Close the Wave 11 "content tiers" framing as already-delivered, and let Thomas choose the actual next wave.** The literacy track's digraph **decoding content is complete through th**; the remaining literacy frontier is `sight-words` / `simple-sentences` (still stub tiers), and the remaining digraph work is the two polish items above.

Foundation:

- Ground-truth six-surface + sibling-tier + e2e evidence above (all `git grep`/`ls`-verified at `1b6c1b6`).
- `[[feedback_ship_over_design_approval]]` inverted: don't re-build what empirical check confirms is shipped.
- Wave-direction is a never-auto-decide strategic call — surfaced to Thomas, not auto-redirected.

**Three candidate next-waves for Thomas (recorded for the decision, NOT auto-selected):**

1. **Digraph picture packs** (A above) — MJ asset-gen track, Thomas-paced. Closes the silhouette-fallback gap across sh+ch+th chips. Highest "makes the shipped tiers feel finished" value; lowest dev content; bounded by Thomas's MJ evenings.
2. **sh/ch mouth-cue parity** (B above) — one MJ face-crop pair + the documented `SkillLevel`-prop wiring + a subjective-visual sign-off. Small, but Thomas-gated on the asset + the look.
3. **`sight-words` content tier** — the genuine next literacy content frontier (real first-class tier build: 6 surfaces + 16 sibling points + research-gated sequencing). This is the closest analogue to what Thomas thought he was picking — a net-new literacy content tier — and is fully dev-dispatchable.

My pick if Thomas wants to keep momentum on net-new literacy content: **option 3 (`sight-words`)**. My pick if Thomas wants to "finish the digraphs properly" first: **option 1 (picture packs)**, paced to his MJ availability. Either is defensible; the call is his because it's strategic priority + (for 1/2) asset-aesthetic, both on the never-auto-decide list.

---

## Tickets

**NO tickets filed for this wave.** There is no content-tier build work to dispatch — the ch/th tiers are merged. Filing tickets against shipped work would fabricate progress (`[[feedback_no_fabrication]]` / `[[feedback_canon_state_empirical_verification]]`). The candidate next-waves above are **not** filed either — they await Thomas's wave-direction pick, at which point the chosen direction gets its own plan + ticket inventory (Wave-10-style: research/spec/impl/e2e tracks with `assignee_recommendation` per track).

When Thomas picks, the track decomposition will be:

| Direction                | Tracks (per `[[feedback_track_based_wave_decomposition]]`)                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Picture packs (opt 1)    | research (Dave — picture-vocab fit, if any) / MJ gen (Thomas) / embed+wire (Devon) / e2e (Jessica — chip-render-with-real-asset pin)            |
| Mouth-cue parity (opt 2) | MJ face-crop (Thomas) / wire (Devon — `SkillLevel`-prop seam) / subjective sign-off (Thomas)                                                    |
| sight-words (opt 3)      | research (Dave — sight-word sequencing, pedagogy-gated) -> spec (Kyle) -> planner+canon+lint (Kevin) / render+wordPack (Devon) -> e2e (Jessica) |

---

## Out of scope

- **Re-building / re-baking the ch/th content tiers** — shipped + voice-QA'd; a re-bake is churn-without-payback (same logic as Wave 10's sub-to-20 re-bake skip) and risks the voice-QA baseline.
- **Auto-selecting the next wave** — Thomas's call (strategic priority + asset-aesthetic).
- **Stale-doc cleanup** (retro defer-list + `skill-trees-and-content.md` "future digraph tiers" framing) — worth a one-line doc fix, but routed through the `maintain-docs` Stop hook, not this plan PR.

---

## Non-obvious findings (for `maintain-docs` routing)

1. **`skill-trees-and-content.md` Digraph tier status is stale** — it says `digraphs-sh` is first-class and "future digraph tiers (digraphs-ch, digraphs-th-voiceless) are expected to follow the same sibling-node pattern." They already DID — both are first-class shipped. The doc reads as if ch/th are pending. Same staleness in the Wave 10 retro § Open/next ("SkillNode literals exist") and the Wave 10 plan line 14.
2. **The defer-list nominated already-done work** — a retro's "Open/next" list is a seed regenerated from doc framing, not a verified backlog. Wave-kickoff must `git grep` the actual surfaces before scoping, exactly as Wave 10's plan did for "canon re-bake." The cost of skipping that check is a wave that dispatches build tickets against merged code.
3. **`_planner.test.ts` prose is the most current digraph source-of-truth** — its describe-block headers ("digraphs-ch content tier (SECOND digraph tier)", "digraphs-th ... THIRD and final") accurately track ship state where the `.claude/docs/` files lagged.
