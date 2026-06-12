# Wave 12 Retro — Three-hint utterances (hint → hint1/2/3, plan to canon in one day)

**Date:** 2026-06-12 (single-day wave; plan merged 12:03Z, canon merged 17:32Z)
**Shipped:** PRs #397 (wave plan, Matt), #407 (W12-01 parser + slot-type widening, Kevin), #409 (W12-02 three-beat hint choreography, Devon), #411 (W12-03 planner three-slot directive, Kevin), #410 (W12-05 failing-first e2e spec, Jessica — merged after the stack it pinned), #415 (generic-tier hint templates research, Dave), #413 (W12-04 canon re-bake, Kevin — merged last, ear-test moved post-merge)
**Plan:** design/wave-12-plan.md · **Outcome:** the single `math.p<N>.hint` utterance became three discrete escalating utterances (`hint1/2/3`) across all 11 math tiers — 88 legacy clips replaced by 264 new clips — with byte-preservation of the 561 non-hint clips independently verified, so the voice-QA baseline survived the re-bake untouched. W12-01 shipped back-compat (LEGACY mode) so production ran safely between the parser merge and the canon merge.

## Sponsor decisions (recorded)

| Decision                                                   | Decider              | Date       | Outcome                                                                                                         |
| ---------------------------------------------------------- | -------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| Wave 12 = three-hint utterances, full three-slot           | Thomas (walkthrough) | 2026-06-12 | Executed as drafted in #397                                                                                     |
| W12-04 split-bake (Dave templates for the 5 generic tiers) | Orchestrator (auto)  | 2026-06-12 | Logged in .claude/decisions-while-away.md — **Status: pending review**                                          |
| Ear-test moved post-merge (option 2)                       | Thomas               | 2026-06-12 | #413 merged on byte-preservation proof; 264 new clips ear-tested on production voice-qa.html; fails fix forward |

## What went well

- **Pattern A sequencing executed cleanly:** parser first (#407), consumers in parallel after (#409 choreography + #411 planner), canon last (#413). No vocabulary divergence, no cross-PR merge conflicts — the type chain never raced.
- **Back-compat by design bought a safe merge window:** W12-01's LEGACY mode meant every intermediate merge was production-safe; main auto-deployed all day with the three-hint render path dormant until the canon landed.
- **Byte-preservation as a merge gate worked:** `scripts/verifyThreeHintBytePreservation.ts` proved the 561 non-hint clips byte-identical against the git baseline, with output quoted in the PR body. That proof is what made the sponsor's merge-first ear-test call (option 2) safe — prior voice-QA verdicts carried over by construction.
- **RED→GREEN failing-first worked exactly as designed:** Jessica's spec (#410) was verified RED against pre-wave main, paired at dispatch with W12-01/W12-02, and went green against the merged stack — the spec was the contract, not an afterthought.
- **Mid-wave pedagogy gap closed without stalling:** when derivation turned out non-deterministic for 5 of 11 tiers, Dave tabulated deterministic templates for them (#415, 40-problem tabulation, zero RE-DEFERs) and the bake consumed them with zero divergence.

## Lessons / patterns

- **Flat counts in wave plans hide structural risk.** The plan's "88→264" framing implied a uniform mechanical bake; in reality only 6/11 tiers had deterministic hint derivation, and the generic 5 needed fresh pedagogy mid-wave. Future wave plans should state the derivation basis per tier (or per content class), not just the clip arithmetic.
- **Review agents die before posting verdicts — verify, don't trust the notification.** 3 of 4 review dispatches today completed their analysis but never posted the PR comment. Standing fix: verify `gh pr view --json comments,reviews` after every review dispatch; a SendMessage-resume ("post your verdict") recovers it cheaply. (Persisted to memory.)
- **Merge gates ≠ dispatch gates.** Thomas challenged under-width dispatching twice: "merges after X" is a merge constraint, not a reason to delay dispatch. Pattern-B parallels go out immediately under a vocabulary contract, and idle personas get explained proactively. (Persisted to memory.)
- **Whole-file `--ours`/`--theirs` during rebase is a footgun.** A near-miss where a whole-file conflict resolution would have silently dropped sibling changes was caught by an existing regression test — count-based assertions earned their keep. (Captured in testing-and-ci.md §7.2.)
- **An ear-gate can move post-merge when byte-safety is proven.** The default (pre-merge preview listening) forces verdicts onto a throwaway origin — localStorage verdicts are per-origin, so the preview always looks blank. With byte-preservation verified, merge-first lets the sponsor test on production where the verdict history lives, and the new clips are the only unanswered items. Candidate default for future canon re-bakes that carry a byte-preservation proof.

## Open / next

- **Ear-test in progress:** the 264 hint clips await Thomas's pass on production voice-qa.html; fails get a triage clip list and route to Kevin (audition-page pattern if 2+ rejections on one sound).
- **decisions-while-away.md** carries the W12-04 split-bake entry pending Thomas's accepted/reversed mark.
- **Sequencing-held tickets now unblocked by this wave's merges:** 86ca8a8h6 (generic-tier drift-guard — next `_planner.ts` ticket), 86ca7yvzz (act() warning — next WordSong-tests ticket).
- **Word-song three-hint is out-of-scope-by-ruling** — a future ticket if ever wanted, not implied debt.
- Wave 13 direction is Thomas's call. Candidates: stop-for-now impl (86ca7urx1, spec merged #381), simple-sentences tier, M4.x slow-fact analysis (unblocked by the #406 latency re-anchor).
- New reusable bake tooling on main: `scripts/rebakeThreeHint.ts` (deterministic add-three/remove-legacy) + `scripts/verifyThreeHintBytePreservation.ts` (byte-proof vs git baseline) — reuse for future three-hint levels.
