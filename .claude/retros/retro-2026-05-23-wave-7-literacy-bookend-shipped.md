# Retro — Wave 7 (literacy bookend: letter-names + letter-sounds end-to-end)

**Date:** 2026-05-23
**Scope:** Wave 7 rounds 1-3 — the literacy bookend ships from canon through screen-render across all 6 content-tier surfaces (canon + planner-first-class + browser-parser + WordSong-render + E2E + lint binding for letter-sounds; lint binding for letter-names deferred to follow-up `86c9y6g5x`). 10 PRs merged end-to-end in one continuous orchestration arc.

## Outcome

Wave 7 closed the bottom-of-tree gap in the Word Song skill graph that had been silently demoting `letter-names` and `letter-sounds` to a `blending-cv` stub since the planner's `effectiveFocusNode` fallback was introduced. Marian's natural focus-node picker now lands on real letter-glyph chips when she first opens Word Song with no prior progress — the literacy on-ramp is no longer "Tap the cat" before she can name a letter.

The wave also shipped two infrastructure pivots that emerged from process pain rather than design intent: the **6-surface content-tier shipping rule** (a tier that lands canon + planner-first-class alone silently runs as a stub on the screen) and the **team-rec consultation pattern** (specialist-domain questions go to the persona team, not Thomas, then come back as a single synthesized recommendation).

| PR   | Author / scope                                                                                       | Merged at         |
| ---- | ---------------------------------------------------------------------------------------------------- | ----------------- |
| #332 | Dave — A6: letter-sounds Haiku directive in WORD_SONG_TRACK_GUIDE                                    | `1b67f66`         |
| #333 | Orch (Matt option-c amendment) — cross-project handoff: rename ClickUp MCP tool refs                 | `f53d3de` 11:57Z  |
| #334 | Kyle — letter-sounds spec §7 Q4 Option B composite + Q6 90/3 (team rec, Thomas accepted)             | `95b8021` 11:58Z  |
| #335 | Kevin — A3: bake letter-names canon + planner first-class                                            | `ff5a31a` 13:20Z  |
| #336 | Orch — mark 3 decisions-log entries accepted by Thomas                                               | `0da0e62` 13:15Z  |
| #337 | Devon — A7: bake letter-sounds canon + planner + tier-aware PHONEME_OVERRIDES + current-vowel hint   | `4091e95` 14:21Z  |
| #338 | Jessica — A4: letter-names regression E2E (wire-level + assertion-sensitivity sub-test)              | `29ade57` 14:38Z  |
| #339 | Kevin — A4b: letter-names parser + WordSong render branch                                            | `5f422b3` 18:30Z  |
| #340 | Jessica — A8: letter-sounds regression E2E (wire-level + assertion-sensitivity sub-test)             | `8284fa4` 18:30Z  |
| #341 | Kevin — A8b: letter-sounds parser + WordSong render branch (rebased after #339)                     | `9a3cc0d` 19:24Z  |

Devon reviewed Kevin's PRs (#335, #339, #341); Kevin reviewed Devon's PR (#337); Devon reviewed Jessica's PRs (#338, #340) per the routing rule. All cross-reviews APPROVE on first pass; one Devon NOF on #341 (shared LETTER_SOUNDS_POOL constant dedup) accepted as a follow-up ticket rather than blocking the merge.

**Test surface delta:** baseline 2733 → 2818 PASS (+85 net new tests this arc). Canon files: 22 (math + word-song, both new literacy tiers included). Composition-lint bindings: 7 (added letter-sounds in #337; letter-names binding deferred). Both E2E regression specs (letter-names + letter-sounds) run on chromium + webkit with 4 tests + an assertion-sensitivity sub-test each.

---

## Key patterns surfaced

### Pattern 1 — Content tiers ship in 6 surfaces, not just canon-bake

**Promoted to:** `[[project_content_tier_ships_6_surfaces]]` (NEW memory entry).

Wave 7 round 1 landed Kevin's A3 (letter-names canon + planner first-class) and Devon's A7 (letter-sounds canon + planner first-class). Both PRs were green, merged cleanly, and shipped to production. Marian opening Word Song with `focusNode = 'letter-names'` should have seen letter glyphs on the chip row. She didn't — she saw the same picture chips the `blending-cv` stub renders, because `WordSong/planFromServer.ts`'s read-line parser had no case for `"Say the letter A."` and `WordSong.tsx`'s render branch had no `contentType === 'letter-name'` dispatch site. Canon + planner-first-class alone silently demote to the `blending-cv` fallback at the screen layer.

The rule the wave forced out: every content tier needs **6 surfaces in lockstep** — (1) canon JSON on disk, (2) planner first-class focus node so Haiku emits real content, (3) browser parser case in `planFromServer.ts`, (4) WordSong render branch in `WordSong.tsx`, (5) E2E regression spec to lock against silent-demote, (6) compositionLint binding to prevent rule-drift on re-bakes. Missing any single surface is invisible at merge time and surfaces as wrong-content render in production.

A3 + A7 shipped surfaces 1+2 only. A4b + A8b (PRs #339 + #341) added surfaces 3+4. A4 + A8 (PRs #338 + #340) added surface 5. Letter-sounds added surface 6 in A7's compositionLint binding; letter-names binding is deferred to `86c9y6g5x`. The pattern generalizes to any future content tier and is the single most load-bearing dispatch-brief discipline change from the wave.

### Pattern 2 — Sibling-tier rebase resolution is mechanical orchestrator hygiene

**Promoted to:** `[[feedback_sibling_tier_rebase_mechanical]]` (NEW memory entry).

Hit twice this wave. When Kevin's A3 (letter-names canon + planner) landed, Devon's A7 (letter-sounds canon + planner) had to rebase because both PRs widened `WORD_SONG_FIRST_CLASS_FOCUS_NODES`, both bumped the canon-combo count assertion in `generateSessionCanon.test.ts`, and both touched `effectiveFocusNode`'s allow-list. Same shape when Kevin's A4b (letter-names parser + render) landed and Devon's A8b (letter-sounds parser + render) had to rebase: both widened the read-line regex array, both added a render-branch case in `WordSong.tsx`, both extended the contentType union.

The pattern: when two sibling-tier PRs conflict on **sync-contract files** (planner first-class blocks, parser switch tables, render-branch dispatch sites, canon combo-count assertions), the resolution is mechanical — accept both additions and bump the combo count by 2 instead of 1. No semantic merge call required, no orchestrator round-trip with the implementing agent. The orchestrator can resolve in-lane and re-push.

This saved roughly two dispatch cycles per collision (the agent would have spent ~15 minutes round-tripping the "which side wins" question). Worth codifying because the next 2-3 waves are likely to ship similar sibling-tier pairs (next-vowel CVC tiers, additional digraph tiers, multiplication tiers).

### Pattern 3 — Post-impl assertion-sensitivity sub-test

When `[[feedback_progression_e2e_mandatory]]` requires a failing-first E2E, but the impl has already shipped (A3+A7 canon+planner are on `main` by the time Jessica writes A4+A8), the "fail RED on base" lever doesn't exist — the spec author can't go back in time. Jessica's pattern on both A4 and A8: ship the main assertion as a wire-level positive discriminator (route-intercept the `/api/claude` POST body, assert the focus-node is what the picker should have chosen), then add a parallel **assertion-sensitivity sub-test** that mocks WRONG canon bytes (swapping the mnemonic word for the letter, or substituting the wrong letter) and asserts the main assertion fails.

The sub-test proves the spec is sensitive to canon drift, not just to the happy path. Without it, a future canon re-bake that quietly emits the wrong letter would be invisible. With it, the spec catches both the live regression class (silent demote) and the latent regression class (correct routing, wrong content).

Documented inline in the spec files; `maintain-docs` may elevate to `.claude/docs/testing-and-ci.md` as a sibling to the existing §4.1.1d trivially-green-trap rule. The pattern generalizes to any tier whose implementation lands before the failing-first spec — which is the structurally-common case under the wave-decomposition model where impl and test are parallel tracks.

### Pattern 4 — WordSong contentType-branch render dispatch

Kevin's A4b NOF #1 (subsequently confirmed by Devon's cross-review on A8b) surfaced the right shape for adding a new WordSong content tier to the screen. The pattern: introduce a sentinel `WordEntry` (e.g. a `letter-name` entry whose `pictureKey` is the letter glyph itself), then dispatch on `contentType` at **3 sites** — the word-card render path, the chip inner-render, and `buildChipOrder`. The chip frame itself is unchanged; only the inner content varies.

Generalizes to any future content tier with a non-word-pair primitive — sentence chips, sight-word chips, phoneme chips. The 3-site dispatch is invariant; only the `case` body changes. Without this pattern, each new tier would need a new render-path branch through the chip-positioning code, which is the most fragile part of `WordSong.tsx`.

Worth elevating to `.claude/docs/screens-and-flows.md` § WordSong via the maintain-docs Stop hook on a follow-up turn. The current doc covers the chip frame and the contentType discriminant but doesn't enumerate the 3 dispatch sites.

### Pattern 5 — WORKED EXAMPLE band-tag inconsistency is a Haiku failure-mode multiplier

Kevin's A3 NOF on attempt 1: the letter-names directive's WORKED EXAMPLE block had `P1 = M labeled CLEAN` but the FACT POOL tags for `M` carried `DOUBLE-HUMP`. Haiku copied the inconsistent example verbatim during bake — the resulting canon's P1 was `M` with both tag-class labels active simultaneously. Forced a re-bake on attempt 2 after Kevin sharpened the directive.

The trap: WORKED EXAMPLES are load-bearing in directive prose because Haiku treats them as the **highest-confidence** signal for what to emit, overriding the pool tags when they conflict. When a worked example contradicts the pool, the worked example wins — silently — and the resulting canon ships rule-inconsistent content.

Filed as ticket `86c9y6g53` (Dave to fix A2 letter-names WORKED EXAMPLE block before any future re-bake). Doc-worthy in `.claude/docs/planner-and-canon.md` § "Directive sharpening" as a sibling to the existing pattern-3 (`per-rule self-check anchored against attention-budget-shift`) and pattern-5 (`DOUBLES-CAP self-check`) entries from `[[feedback_haiku_directive_sharpening]]`. The general rule: **WORKED EXAMPLE rows must be tag-consistent with the FACT POOL row for the same fact** — otherwise the example silently overrides the pool.

### Pattern 6 — Substitution-table architecture for phoneme-aware tiers

Devon's A7 (letter-sounds canon) + Kyle's A5 §2.4 spec uncovered that the obvious approach (inline `<phoneme>` markup in canon text) doesn't work: `escapeSsml` at `api/_tts.ts:117` and `:227` XML-escapes everything passed through the SSML body, so any `<phoneme alphabet="ipa">` in the canon JSON's `text` field comes out the other side as literal `&lt;phoneme...&gt;` strings in the SSML body. Azure happily reads them as text and Emma pronounces `"less than phoneme alphabet equals quote i p a quote..."`.

The only viable path: widen `PHONEME_OVERRIDES` (the substitution table in `api/_tts.ts`) and gate it with a `tiers?: SkillNode[]` filter so that letter-sounds tier's `/æ/` override for "apple" doesn't fire on math tiers that happen to use "apple" as a counting noun. The new shape: `Record<string, { ipa: string; tiers?: SkillNode[] }>`. Override fires only when the current tier matches; default-undefined `tiers` means "all tiers" for the existing back-compat entries (e.g. `four → /fɔːr/`).

Worth elevating to `.claude/docs/audio-system.md` § PHONEME_OVERRIDES via maintain-docs. The doc currently mentions the single `four` entry; it doesn't enumerate the tier-filter shape or the escapeSsml structural constraint that drove it. Pattern generalizes to any future phoneme-aware tier (digraphs-sh, digraphs-ch, sight-words with irregular vowel patterns).

### Pattern 7 — Rule-7 dedup yields to a category-cap floor

Devon's A7 compositionLint binding for letter-sounds is the first tier where dedup deliberately **yields** to a category-cap floor. The setup: letter-sounds canon must include ≥3 facts targeting the current vowel (the `currentTargetVowel` cap, per spec §6), but the dedup rule (no repeated letters across the session) would forbid filling the floor when only 3 canonical letters teach the target vowel. The resolution: the `only-canonical-letter` constraint for the focus vowel pins those 3 facts in slots P1-P3, and dedup yields for them — every other slot still enforces dedup against the rest of the pool.

Generalizes to any future tier with a **floor-AND-cap** shape — the obvious next-up is sub-to-20's "strict no-borrow floor + crossover cap" combo (where ≥2 facts must be strict-no-borrow but no more than 1 can crossover). The pattern is: identify which constraint is load-bearing for pedagogical fidelity, pin it as a floor, and let dedup yield within that pinned subset.

Documented inline in `compositionLint.ts` letter-sounds binding; not yet elevated to the docs index. Worth flagging the next time a tier with this shape lands.

---

## Process observations

### Team-rec consultation pattern adopted

**Promoted to:** `[[feedback_no_sponsor_as_expert]]` (NEW memory entry).

Mid-wave, when Kyle's letter-sounds spec §7 had two open questions (Q4 — composite vs single-mnemonic; Q6 — mastery threshold 80/2 vs 90/3 vs 95/3), the orchestrator surfaced a 2x2 option menu to Thomas. Thomas's response: "I'm not the expert — consult the team and come back with a single recommendation." The orchestrator then dispatched Dave (child psychology) and Kyle (content design) in parallel, synthesized their replies into a single rec (Option B composite + 90/3 gate, justified by Dave's working-memory load research + Kyle's pedagogy-fit analysis), and surfaced that single rec for accept/redirect. Thomas accepted on first read, no follow-up cycle.

The rule: for specialist-domain questions (pedagogy, content, UX, audio, visual), the orchestrator dispatches the relevant persona(s) and presents **one synthesized team recommendation** — never a menu of options for Thomas to choose between. Thomas's role on these classes is sign-off, not decision-authoring. Reverses the orchestrator's prior default of "surface choices when uncertain."

The wave hit this rule again on A4b chip-design + A8b audio-on-tap; both went team-rec-first and Thomas accepted both on first surface.

### Orchestrator over-gating call-out

Roughly 3 hours into the wave, Thomas asked "what do you need me for?" The orchestrator was queueing routine merges (CI green, peer-reviewer approved, no scope flags) for sign-off rather than auto-deciding. After the call-out, the orchestrator shifted to **standing authority** on the routine-merge class (per the 2026-05-23 promotion in `[[feedback_orchestrator_autonomy_framework_2026_05_23]]` rule 6) and burned through the rest of the queue. ~22 PRs merged in the session total; only the team-rec calls (Q4/Q6, A4b chip-design, A8b audio-on-tap) and the cross-project handoff (#333 Matt option-c amendment) actually required Thomas surface time.

Calibration target for future waves: routine merges with peer-reviewer + CI green should not appear on Thomas's surface unless something flags them out of the auto-decide class.

### A8b audio-on-tap — Kevin overrules Devon's NOF with empirical foundation

Devon's review of A8b raised an NOF: "should we add per-chip-tap phoneme audio so Marian gets explicit /æ/ feedback when she taps the wrong chip?" Kevin overruled, citing the canon already ships 5 utterance slots per problem (read / correct / reprompt / hint / giveAnswer), each wrapping the target mnemonic through A7's tier-aware PHONEME_OVERRIDES. Marian gets 1-4 phoneme exposures per problem via the existing read-aloud cadence; adding a 6th on per-chip-tap would risk degrading the assessment integrity (Marian could iterate by hearing the right answer before tapping).

Verified by counting utterances in the baked letter-sounds canon (`public/canon/word-song/level-1/letter-sounds.json` — 8 problems × 5 slots = 40 utterances, every read + correct + hint slot contains a phoneme-wrapped mnemonic). Queued as Wave 8 candidate **only if** user research finds value; not a current-wave defect.

The NOF was correct to raise (Devon was checking whether the audio surface was complete); the override was correct to apply (the existing surface is sufficient). Worth flagging because both calls — raising and overruling — followed `[[feedback_distractor_class_pedagogical_gates_mechanical]]`'s pedagogical-first audit pattern, generalized to audio: existence of an audio surface is a mechanical question; whether more exposure helps or hurts learning is the pedagogical question that gates it.

### Cross-project handoff model proved itself

PR #333 (ClickUp MCP tool-ref rename) came from a sister project. RandomGame's orchestrator pre-staged a `chore/agent-tool-surface-mcp-rename` branch in this repo (as a sibling to its own RandomGame PR #336 in that project's repo). MARIAN's orchestrator picked it up, rebased onto current `main`, made a Matt option-c amendment (skip the deprecated `nsxdavid-clickup-mcp` rename for the 6 agents that don't reference it), and merged. End-to-end: ~12 minutes of cross-project orchestration, zero ambiguity, zero round-tripping.

Flagged as **approved for future use** in `decisions-while-away.md`. The model works when (a) the upstream project pre-stages a branch in the downstream repo (not a separate PR + sync request), (b) the downstream orchestrator's amendment scope is narrow and well-documented, and (c) the change-class is mechanical chore-work (no scope-class flags, no peer-review-by-other-persona requirement).

---

## Follow-up tickets filed this wave (5 TO DO)

1. **`86c9y5d9x`** — Wave 8 per-vowel `letterSoundsVowelStates` for letter-sounds. Deferred Option A from Kyle's §7 Q4 resolution; sponsor-accepted scope deferral.
2. **`86c9y6g53`** — Fix Dave A2 letter-names WORKED EXAMPLE band-tag inconsistency (P1 = M labeled CLEAN but pool tags DOUBLE-HUMP; Haiku copied verbatim on Kevin A3 attempt 1). Blocks any future letter-names re-bake from re-introducing the bug.
3. **`86c9y6g5x`** — Letter-names compositionLint binding (defense-in-depth; matches letter-sounds binding added in A7). Depends on `86c9y6g53` for the corrected WORKED EXAMPLE shape.
4. **`86c9y6g6n`** — debugSeed letter-names recipe (`?debug=1&seed=letter-names`). iPad-smoke convenience; sponsor uses this surface for visual verification on a freshly-cleared iPad.
5. **`86c9y6xkh`** — Extract shared `LETTER_SOUNDS_POOL` constant. Devon's NOF on #341 — currently the pool is duplicated between `planFromServer.ts` and `WordSong.tsx`. Mechanical dedup; not blocking.

---

## Memory promotions this wave (3 NEW)

- **`[[project_content_tier_ships_6_surfaces]]`** — every new content tier needs canon + planner-first-class + parser + screen-render + E2E + lint binding in lockstep; missing any one silently demotes to the `blending-cv` stub.
- **`[[feedback_sibling_tier_rebase_mechanical]]`** — sibling-tier PRs that conflict on sync-contract files (planner first-class, parser switch, render dispatch) resolve "accept both additions + bump combo count by 2" in-lane; no semantic merge call required.
- **`[[feedback_no_sponsor_as_expert]]`** — specialist-domain questions (pedagogy / content / UX / audio / visual) get dispatched to the persona team and come back as a single synthesized rec for accept/redirect; never surface option menus that ask Thomas to choose.

---

## "Do not regress" patterns

- **Track-based parallel-author wave decomposition** ([[feedback_track_based_wave_decomposition]]) — Wave 7's plan carried per-track `assignee_recommendation` (A1/A5 spec → Kyle; A2/A6 directive → Dave; A3/A7 canon+planner → Kevin/Devon split; A4/A8 E2E → Jessica; A4b/A8b parser+screen → Kevin). All 6 personas had work in flight simultaneously at peak. No idle persona-time, no orchestrator serialization. Continue.
- **Pre-staged Wave-N+1 plumbing** (carried forward from Wave 6 retro) — A6 + A2 directives shipped one round before A7 + A3 canon-bakes; A1 + A5 specs shipped before that. The bake step had no plumbing-change surface, only a directive read. Continue staggering directive → canon → parser → screen → E2E across rounds.
- **Failing-first protocol via assertion-sensitivity sub-test** — Jessica's A4 + A8 pattern (see Pattern 3) preserves the falsification record even when impl-first ordering makes pure RED-on-base impossible. Continue when the wave shape forces this ordering.
- **Pre-merge self-fixup discipline** — Kevin self-caught the rebase-onto-#339 conflict on A8b before pushing for review; Devon self-caught the SSML escape interaction on A7 before pushing. Self-review is healthy and faster than a round-trip with the reviewer.
- **Cross-persona routing held** — Kevin reviewed Devon's planner+canon work (A7), Devon reviewed Kevin's parser+screen work (A4b/A8b), Devon reviewed both of Jessica's E2E specs (A4/A8). Reversal of the 2026-05-22 Wave 3-4 retro Pattern B (9/11 routing-misses); Wave 7 hit 10/10 routing-correct.

---

## Open strategic calls for Thomas

### Wave 7 epic flip

Wave 7 epic ticket `86c9y494c` is currently IN PROGRESS. Once the 5 follow-up tickets above are filed (currently TO DO), flip the epic to COMPLETE.

### Wave 8 direction — three threads on the table

Wave 7 closed the literacy-tier bookend. The next wave has three plausible threads, each with different scope and gate-actor:

1. **Literacy continuation — digraphs-ch + digraphs-th tiers.** Same 6-surface shape as Wave 7; estimated 8-10 PRs. Builds on the digraphs-sh precedent (PR #220/#223) and the Wave 7 sibling-tier rebase pattern. Gate-actor: orchestrator + personas; minimal Thomas surface.
2. **Math pivot — sub-to-20 directive sharpening + canon re-bake.** Per Dave's audit (PR #327), sub-to-20 has the same EASY-band saturation prior as add-to-10 did pre-#266. Estimated 4-6 PRs (directive sharpening + re-bake + sibling-tier composition-lint extension). Gate-actor: Kevin + Dave; Thomas surface only for the post-bake ear-test if the SSML changes (per `[[feedback_jessica_audio_visual_gate_narrowed]]`).
3. **Polish + iPad smoke.** Wave 7's content-tier rule cleared the silent-demote class; Marian's natural picker now lands her on real letter content. Worth an iPad smoke pass to confirm the chip-render and audio land as expected on real Safari before stacking more content. Gate-actor: Thomas (real-Safari + real-Marian-iPad-orientation observation). Marian-not-using-the-app-yet rule ([[project_marian_not_using_yet]]) still holds; this is Thomas's own ear+eye test, not a child-observation session.

Recommendation: thread 3 (iPad smoke) **first** as a 30-min orchestrator-dispatched Playwright pass plus a Thomas 15-min iPad ear-test, then thread 2 (math pivot — Dave's audit is already merged and ready to spec), with thread 1 queued for Wave 9. Reasoning: shipping more content on top of an un-smoke-tested literacy bookend risks compounding any field defect; the math thread is well-scoped and unblocks the next math-tier in the diagnostic without depending on the literacy surface.

Surface this as a single rec for accept/redirect on next session resume.
