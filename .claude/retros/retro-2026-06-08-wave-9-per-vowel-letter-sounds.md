# Wave 9 Retro — Per-vowel letter-sounds sub-mastery (`letterSoundsVowelStates`)

**Date:** 2026-06-08
**Shipped:** PRs #357 (W9.2), #358 (W9.3), #359 (W9.4), #353 (W9.5) + #352 (W9.1 spec lock, shipped 2026-05-24)
**Parent:** `86c9y5d9x` · **Plan:** `design/wave-9-plan.md`
**Outcome:** Option-A per-vowel sub-mastery shipped on top of Wave 7's Option-B composite tier. The `/i/ → /e/` adjacency ban is now a hard runtime gate (`letterSoundsVowelStates['/i/'] === 'mastered'`) rather than a directive-level approximation.

## What shipped

| Ticket           | PR   | Surface                                                                                     | Reviewer                |
| ---------------- | ---- | ------------------------------------------------------------------------------------------- | ----------------------- |
| W9.2 `86c9ya3gd` | #357 | Progress shape — `progress.literacy.letterSoundsVowelStates` + defaulter + cloudSync parity | Devon APPROVE           |
| W9.3 `86c9ya3m6` | #358 | Mastery rule — per-vowel M3 branch + `currentTargetVowel` + bake-metadata                   | Kevin APPROVE           |
| W9.4 `86c9ya3r9` | #359 | Planner — `/i/→/e/` runtime gate + slash↔IPA bridge + bypass                                | Devon APPROVE           |
| W9.5 `86c9ya3vk` | #353 | Failing-first E2E — 6 tests, all GREEN on the full stack                                    | Devon APPROVE_WITH_NITS |

Follow-up: `86ca5khz6` — 2 cosmetic test NITs (stale JSDoc + read-line regex faithfulness), non-blocking.

## What went well

- **Linear dependency chain executed cleanly.** W9.2 → W9.3 → W9.4 → W9.5-flip ran serially with zero rebase conflicts. Branching each ticket off post-merge `origin/main` (rather than authoring against unmerged siblings) sidestepped the predicted `types.ts`/`guards.ts` sibling-tier conflicts entirely — the conflict-surface table in the plan over-predicted because serial merge order eliminated the overlap.
- **Failing-first did its job.** Jessica's #353 was authored 2026-05-24 against _guessed_ shapes; on rebase against the real stack she found and corrected 3 assertion mismatches (request discriminator is `letterSoundsVowelStates` not `currentTargetVowel`; per-vowel activation needs tagged history; Test 4's "no literacy block" assertion contradicted the always-on defaulter). The failing-first→green discipline surfaced the guessed-shape drift before it could mask a real regression.
- **Empirical canon verification held.** Both W9.3 and the reviewers ran `git grep "perVowelTrackingActive"` to confirm only the additive `bakeMetadata` flag changed — no utterance/audio re-bake. Per `[[feedback_canon_state_empirical_verification]]`.
- **WIP-recovery worked.** W9.2 (Kevin) hit a dropped `<task-notification>` — the agent completed the implementation but the notification never arrived, and the work sat uncommitted in the worktree. A `SendMessage` liveness ping resumed the same agent (NOT a re-dispatch, which would have reset the worktree and destroyed the 816 lines), and it committed + opened the PR cleanly. Per `[[feedback_subagent_ratelimit_uncommitted_work]]`.

## What to watch / patterns to promote

- **Per-vowel-supersedes-composite is a two-condition gate.** `perVowelTrackingActive()` requires BOTH the W9.2 sub-state present AND ≥1 `currentTargetVowel`-tagged history entry. The all-intro defaulter alone does NOT activate it — a tagged session must have played first. This is the load-bearing fallback contract; now documented in `progress-and-persistence.md`.
- **Two vowel vocabularies are a silent-bug trap.** Directive uses bare-IPA (`ɒ ʌ ɪ ɛ`); progress/canon/envelope use slash-LETTER (`/o/ /u/ /i/ /e/`). Bridged by `SLASH_VOWEL_TO_IPA` / `IPA_TO_LETTER_VOWEL`. Both forms are valid strings → no type error on a mix-up. Documented in `planner-and-canon.md`.
- **Bypass predicate shape is new.** Letter-sounds canon/cache bypass keys on _non-fallback state_ (any vowel beyond all-intro), NOT field-presence like leitner/slowFacts — so the first-ever (all-intro) session stays canon-served and preserves the cost ceiling.
- **Hand-mirror hazard for a 5th vowel.** `DEFAULT_LETTER_SOUNDS_VOWEL_STATES` + `LETTER_SOUNDS_VOWELS` (guards.ts) + the cloudSync defaulter mirror are NOT derived from the type union — adding a vowel needs manual extension of all three. The `cloudSync.test.ts` parity test guards storage↔cloudSync drift but NOT the literal-vs-union gap.
- **Stale `vite preview` on :4173 produced a false "5 failed".** Jessica's first debugging half chased a phantom — a leftover preview server from a prior worktree run served an OLD bundle. The §2.4.1 silent-reuse trap. Confirm `netstat | grep :4173` is clear before trusting a worktree e2e result.

## Process notes

- Whole wave was CI-gated, no Thomas surface (mechanical infra + pedagogically-locked predicate) — matched the plan's prediction exactly.
- Doc capture (progress-and-persistence.md + planner-and-canon.md) applied at wave-close via the proper 3-proposer maintain-docs flow rather than per-PR, giving one coherent per-vowel section instead of four partial edits.

## Open / next

- **Wave 10 direction is Thomas's call** (never-auto-decide — strategic priority). Defer-list candidates per the plan: math pivot (subitising / sub-to-20 directive sharpening, Dave's audit ready) OR digraphs-ch/-th content tiers (SkillNode literals already exist). Both are real; sequencing needs sponsor input.
