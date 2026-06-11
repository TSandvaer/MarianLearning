# Wave 10 Retro — Math pivot: sub-to-10 subitising + sub-to-20 defense-in-depth

**Date:** 2026-06-11 (single-day wave)
**Shipped:** PRs #365 (W10.1 research), #367 (W10.2 spec), #369 (W10.3 impl), #366 (W10.4 planner-lock), #368 (W10.5 e2e) + NITs #370 (drift-guard ref) / #371 (reserved-band focus-gate)
**Plan:** design/wave-10-plan.md (PR #364) · **Outcome:** the sub-to-10 EASY-band subitising scaffold (single-cell minuend, die-face ≤5 / ten-frame 6-10, per-tier fluency fade) is live; the sub-to-20 directive is drift-locked (13-test suite + triple-pin tag); zero canon bytes touched all wave.

## Sponsor decisions (recorded)

| Decision                                    | Decider | Date       | Outcome                                                                                                         |
| ------------------------------------------- | ------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| Wave 10 = math pivot (over digraphs-ch/-th) | Thomas  | 2026-06-11 | Executed                                                                                                        |
| W10.X optional sub-to-20 re-bake            | Thomas  | 2026-06-11 | **SKIP** — per Dave PR #327 "do NOT re-bake; canon at pedagogical ceiling"; also protects the voice-QA baseline |

## What went well

- **Research → spec → impl → e2e pipeline ran serially in one day** with each gate consumed verbatim downstream: Dave's three locked calls → Kyle's §13 (incl. the value-conditional ten-frame resolution of the pip-vocabulary gap Dave flagged) → Devon's impl matched §13.5 identifier-for-identifier → Jessica's spec asserted the same names. Zero vocabulary divergence (plan R7 mitigated by construction).
- **"Literal sponsor framing over-scopes the wave" handled cleanly:** Thomas's phrase "directive sharpening + canon re-bake" was re-shaped (with sources) to the genuinely-remaining work; the re-bake became an explicit recommend-skip he confirmed in one click. The wave shrank from ~6 PRs of assumed scope to 5 tickets of real scope.
- **Done-when-by-reviewer worked:** Kevin's review of #369 ran Jessica's spec against Devon's build and correctly attributed the one failure to the spec side (audio-gate seam), not the impl — saving a false REQUEST_CHANGES round.
- **Reviews kept catching real things:** the op-vs-focus-gated reserved band (latent 80px regression on locked tiers, invisible to every test class — found only via `git show origin/main:` structural comparison).

## Lessons / patterns

- **Spec-vs-spec testid supersession across waves:** the W9 suppression spec asserted `math-dot-card-cell === 0`; Kyle's §13.5 deliberately reused that testid for the minuend cell. The newer locked spec wins; the stale assertion was a hard CI blocker inside the impl PR. When a new spec reuses an old spec's DOM vocabulary, grep older e2e specs for contradicting assertions at spec time, not at impl-CI time.
- **Single-vs-multi-problem e2e seam split (Jessica):** tests asserting only on Q1 run fine with silent-MP3 mocks; any test that crosses a problem boundary via chip tap needs REAL on-disk canon bytes so the read-aloud→chip-enable gate releases. `forceHowlerUnlock` is the wrong seam there (silent-demote → static add-to-10 fallback → structurally unsatisfiable assertion). One spec can legitimately mix both strategies.
- **Scaffold counters use default-at-consumer-read-site** — deliberate divergence from the sibling-tier checklist (no defaults.ts / seedStorage / cloudSync mirror entries; inline `isProgressV1` validation covers both load paths). Don't flag the absence as a gap in review.
- **Ticket line refs go stale fast** (`_planner.test.ts` grew ~750 lines since the plan): anchor dispatch briefs and drift-guard tags by exported names/test names; treat line numbers as human hints. Cost this wave: one NIT PR (#370).
- **Mechanical hygiene:** `git checkout -- src/` after an overlay-build leaves the other branch's UNTRACKED files behind (explicit `rm` needed); `netstat` TIME_WAIT entries on :4173 are not a live server — only LISTENING blocks `--strictPort`.

## Open / next (Wave 11 candidates per plan defer-list)

- Digraphs-ch / digraphs-th content tiers (the unpicked alternative; SkillNode literals exist).
- READ-LINE NEGATIVE ANCHOR back-port to add-to-10 / add-to-20 / sub-to-10 directives.
- `SeedProgressOptions` widening for scaffold fields (2 raw-spread adopters today; 3rd triggers per §4.1.1c).
- The add-to-10 subitising spec's 2 `test.fixme`s — root cause identified by Jessica (failNetwork beforeEach not displaced by canned-plan re-install); fix is dropping the failNetwork beforeEach.
- Thomas's voice-QA baseline pass remains the standing sponsor activity (system live, no report yet).
