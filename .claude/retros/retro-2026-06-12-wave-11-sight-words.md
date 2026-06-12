# Wave 11 Retro — Sight-words content tier (stub → first-class, end-to-end)

**Date:** 2026-06-11 → 2026-06-12 (overnight wave; final merge 2026-06-12 06:01Z)
**Shipped:** PRs #378 (wave plan), #380 (W11-01 research, Dave), #386 (W11-02 content tier first-class, Kevin), #390 (W11-03 recognition render branch, Devon), #383 (W11-04 failing-first e2e spec, Jessica — merged last, after the stack it pinned)
**Plan:** design/wave-11-sight-words-plan.md · **Outcome:** sight-words went from a genuine stub tier (zero content surfaces — verified `git ls-files | grep -i sight` → no matches at wave start) to a first-class tier across all six content surfaces: canon, planner-first-class, browser parser, WordSong render, e2e, lint.

## Sponsor decisions (recorded)

| Decision                                                 | Decider                | Date       | Outcome                                                                                                      |
| -------------------------------------------------------- | ---------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| Wave 11 = sight-words (over digraphs defer-list framing) | Thomas                 | 2026-06-11 | Executed — picked after Matt's audit proved digraphs ch/th ALREADY SHIPPED; the Wave 10 defer-list was stale |
| W11-02 scope amendment (parser + content-type files)     | Orchestrator (auto)    | 2026-06-11 | Granted per planner↔parser contract; logged in .claude/decisions-while-away.md — **Status: pending review**  |
| Uniform read line "Find the word: \<word\>."             | Dave (PROCEED-UNIFORM) | 2026-06-11 | Carrier-sentence scaffolding explicitly deferred to the simple-sentences tier                                |

## What went well

- **Stale-framing catch before any code:** the wave nearly launched as "digraphs ch/th" off Wave 10's defer-list. Matt's pre-wave audit showed both tiers already shipped — the defer-list framing was stale, not the codebase. Redirect to sight-words cost one sponsor round-trip instead of a dead wave. Docs corrected in the same cycle (skill-trees-and-content.md now carries a stale-framing hazard note).
- **Pedagogy locked before mechanics:** Dave's research (#380) ruled the load-bearing calls up front — Dolch 20-word starter, audio-first written-word matching, NO pictures, NO decoding beat, confusable-pair distractors, weak-monosyllable stress via prosody-pitch (Olivia ignores `<emphasis>`). Kevin and Devon consumed the rulings verbatim; no mid-wave pedagogy renegotiation.
- **Failing-first held its shape across sessions:** Jessica's spec PR (#383) stayed intentionally RED and OPEN while the content stack landed underneath it, then went green against the merged stack and merged last — the test was the spec, and the drain discipline (don't merge/close intentional-RED PRs) worked as documented.
- **Six-surface checklist prevented the silent-demote trap:** the known failure mode (canon + planner alone → tier silently demotes to a blending-cv stub) was checked explicitly; render (#390) and parser/content-type (#386 scope amendment) shipped as first-class surfaces.

## Lessons / patterns

- **Defer-lists rot; audit before adopting one as a wave plan.** A "next wave candidates" list written N waves ago describes the codebase as it was then. The fix is mechanical: grep the actual surfaces before dispatching. (This is now a standing note in skill-trees-and-content.md.)
- **forceHowlerUnlock poisons canon-served WordSong specs:** Jessica's test-3 RED turned out to be her own spec defect — the silent-demote fires on canon-served audio and falls back to CVC content, making the sight-words assertion structurally unsatisfiable. Root-caused by Devon, independently confirmed by Kevin, fixed on her branch. Extends the Wave 10 lesson: the unlock-shim seam choice is per-assertion, not per-spec. (Captured in testing-and-ci.md.)
- **Stale merge-ref re-trigger is now routine:** #383's CI snapshot predated the #390 merge; an empty commit (88320d3) re-triggered against the true merged stack. Pattern documented — PR CI snapshots the merge-ref at trigger time; a rerun reuses the OLD snapshot, only a new push re-snapshots.
- **Scope amendments beat scope violations:** Kevin hit the planner↔parser contract boundary mid-W11-02 (parser must widen before planner). The amendment was granted, logged as an auto-decision with the contract as foundation, and left for sponsor review — instead of either silently editing out-of-scope files or stalling the wave.

## Open / next

- **decisions-while-away.md** carries the W11-02 scope-amendment entry pending Thomas's accepted/reversed mark.
- Sight-words tier depth: starter set is Dolch 20; widening the word list is future content work, not wave-blocking.
- Wave 12 direction is Thomas's call. Front-runner per Dave's PROCEED-wave-scope ruling: three-hint utterances (86ca7uryr). Alternates: stop-for-now impl (86ca7urx1), simple-sentences tier.
- Voice-QA rounds 2-4 ran concurrently with this wave — separate retro: retro-2026-06-12-voice-qa-rounds-2-4.md.
