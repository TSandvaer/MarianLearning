# Wave 13 Retro — Simple-sentences tier (cloze content class, the last literacy tier, shipped end-to-end)

**Date:** 2026-06-12 → 2026-06-13 (overnight wave; final merge 2026-06-13 07:29Z)
**Shipped:** PRs #420 (W13-01 research, Dave — merged first, before the plan), #419 (wave plan, Matt), #421 (W13-02 spec, Kyle), #423 (W13-03 content + W13-04 render collapsed in, Kevin), #422 (W13-05 failing-first e2e, Jessica — merged last, after the stack it pinned)
**Plan:** design/wave-13-simple-sentences-plan.md · **Outcome:** `simple-sentences` went from the last stub-fallback Word Song tier to first-class across all six content surfaces. After this wave **every leaf literacy node is first-class** — the Word Song skill tree is fully built end-to-end. The tier introduces a genuinely new content class: **cloze** ("Finish the sentence: The cat \_\_\_ on the mat."), the first Word Song type whose answer is intentionally absent from the read line.

## Sponsor decisions (recorded)

| Decision                                                        | Decider               | Date       | Outcome                                                                                         |
| --------------------------------------------------------------- | --------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| Wave 13 = simple-sentences (over stop-for-now / M4.x slow-fact) | Thomas (walkthrough)  | 2026-06-12 | Executed                                                                                        |
| Mechanic = sentence-completion (cloze)                          | Dave research ruling  | 2026-06-12 | PROCEED-SENTENCE-COMPLETION; sentence-ordering rejected on Tagalog PSO→SVO transfer risk        |
| Scenes in v1; Thomas produces the MJ pack                       | Thomas (walkthrough)  | 2026-06-12 | Per-template ~20 scenes; tier renders text-only (graceful fallback) until the SVGs land         |
| §7 spec answers (5 questions)                                   | Thomas (walkthrough)  | 2026-06-13 | Q1 per-template, Q2 fill-gap-on-correct, Q4 leading blanks OK; Q3/Q5 auto-decided as mechanical |
| Byte-proof merge-first canon gate                               | Thomas (plan default) | 2026-06-13 | Approved as a plan default — #423 merged on byte-proof, no per-instance authorization needed    |
| W13-01 research pre-dispatch (ahead of plan approval)           | Orchestrator (auto)   | 2026-06-12 | Accepted by Thomas — validates research-pre-dispatch-on-sponsor-made-tier-choice                |

## What went well

- **The 5-track sequential wave executed clean.** research (Dave) → spec (Kyle) → content (Kevin) + failing-first e2e (Jessica, Pattern-B parallel under the vocabulary contract), with Matt's plan gating the lot. Each handoff consumed the prior artifact verbatim; no mid-wave renegotiation.
- **Pedagogy locked before mechanics, again.** Dave's research ruled the mechanic (cloze vs ordering vs read-and-match), the 40-sentence pool, the foil classes, the function-word ordering, and the scene role — all before Kyle specced or Kevin built. The Tagalog PSO→SVO argument against sentence-ordering was a tier-specific structural call, not a generic cognitive-load hand-wave.
- **W13-04's conditional collapse paid off exactly as planned.** The plan pre-authorized collapsing the render track into W13-03 _if_ the sight-words written-word picker transferred. It did — Kevin carried the sentence-panel + gap + scene-lookup render on the transferred chip, and Devon was never needed for a separate render PR. One fewer dispatch, one fewer review cycle.
- **Failing-first RED→GREEN worked end-to-end across the session boundary.** Jessica's spec (#422) was verified RED against pre-content main (the tier silently demoted to blending-cv), stayed open + intentionally-RED while the content stack landed, then went green on an empty-commit rebase against the merged W13-03 and merged last. The drain discipline (don't merge/close intentional-RED PRs) held.
- **Byte-proof merge-first graduated from per-instance to sponsor-default.** For #413/#418 the merge-first-on-byte-proof was a per-PR sponsor authorization (and #418's was even classifier-blocked until walkthrough). For #423, Thomas approved it as a _plan default_ — the merge went through with no classifier denial. The pattern is now the standing default for byte-preservation-proven canon PRs.

## Lessons / patterns

- **Cloze is a new parser-contract exception class.** Every prior Word Song template captures the target from a fixed read-line slot; cloze gaps the answer out by design, so the parser resolves the target from the `correct` utterance instead. This broke the read-line-captures-target invariant that had held for every tier — flagged at spec time (Kyle), confirmed at build (Kevin), verified at review (Devon). Captured in skill-trees-and-content.md; any future cloze/don't-say-the-answer tier inherits it.
- **First-class membership is load-bearing for AUDIO, not just canon generation.** Devon's review surfaced that `substituteSentenceGap` (the `___`→"blank" TTS transform) is gated on `tierFilter === 'simple-sentences'`; absent the tier from `WORD_SONG_FIRST_CLASS_FOCUS_NODES`, the bake would route to blending-cv and the gap would be voiced as silence/underscores with no visible error. The silent-demote trap extends into the audio domain. Captured in planner-and-canon.md + a new conditional row in sibling-tier-checklist.md.
- **Verify-against-evidence killed a phantom NIT.** The PR #375 NIT chore (`86ca7vjt7`, stale `<emphasis>` comment) turned out to be already-fixed by PR #384 — Devon verified on main and declined to open a PR editing an already-correct comment, rather than fabricating a no-op change to satisfy the ticket. Closed as resolved-by-#384.
- **Research can merge before the plan that scopes it.** #420 (research) merged ~20 min _before_ #419 (plan) — the research was pre-dispatched on Thomas's tier choice and merged direct on green while the plan sat at the walkthrough gate. Merge-gates ≠ dispatch-gates, applied to the research track.
- **Single-line-JSON canon files defeat `git diff --stat` for scope review.** All 24 canon files show `1 1` regardless of utterance-level changes; the only reliable byte-preservation check is a per-`audio.base64` sha256 comparison against origin/main (Devon re-ran it independently as a merge gate).

## Open / next

- **Two sponsor gates remain (away-queue.md):** the 59-clip sentence-prosody ear-test (production voice-qa.html — highest-risk audio class yet) and the MJ scene pack (~20 per-template scenes against Kevin's final sentence-ids; tier renders text-only until they land).
- **decisions-while-away.md** carries the #423 merge entry pending Thomas's accepted/reversed mark (and the W13-01 pre-dispatch entry, already accepted).
- **Two NIT chores in flight** (post-wave cleanup, both Devon-APPROVE'd, awaiting e2e): #424 (WordSong act() warning) + #425 (generic-tier directive drift-guard).
- **The literacy tree is complete.** Wave 14 direction is Thomas's call — no obvious next literacy tier remains; candidates are stop-for-now impl, M4.x slow-fact analysis, or polish.
