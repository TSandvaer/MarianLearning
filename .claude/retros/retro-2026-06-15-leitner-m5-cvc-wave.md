# Retro — Leitner / M5 / CVC wave (2026-06-14 → 06-15)

Away-orchestration session. Drained a large wave to a clean board (0 open PRs at peak), then opened the CVC phoneme-blend MVP. Drafted mid-away after the 9-PR cluster merged.

## Shipped (merged to main)

| PR   | What                                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| #447 | M4 — time-based Leitner spaced-review schedule (`dueLeitnerItems` + `LEITNER_REVIEW_INTERVAL_DAYS`); `progress.leitner` payload is now the due subset |
| #448 | Voice-QA round-6 — 3 pronunciation/speed re-bakes ("four"×2, "row" vowel); 5 timbre clips accepted as model-floor                                     |
| #450 | Dave research — Leitner interval-tuning recommendation (11 sources)                                                                                   |
| #451 | M5 closeout — `?reset=1` dual-blob clear + session-end focus-recap beat (graceful-skip pre-bake)                                                      |
| #452 | Leitner tuning — box2 2→1, box3 4→3, `LEITNER_DUE_PER_SESSION_CAP=3`                                                                                  |
| #454 | Dave research — CVC within-tier review-mode design                                                                                                    |
| #455 | Kyle design — CVC 2nd-wrong phoneme-blend prompt spec                                                                                                 |
| #449 | E2e — `?reset=1` first-launch regression-lock                                                                                                         |
| #453 | E2e — recap-beat graceful-skip regression-lock (assertion flipped post-M5)                                                                            |

**Held:** #456 (CVC phoneme-blend consumer pipeline — APPROVE'd but mis-ticketed; see below).

## What went well

- **Graceful-skip degradation pattern** (M5 recap + CVC blend): when an utterance id isn't baked yet, the beat skips entirely rather than rendering a silent/captioned-but-mute line — audio-first-aligned. Reused cleanly across both features.
- **Adversarial e2e caught real gaps the unit suite missed:** Jessica's #453 found the recap dead-pause P1 (real-player reject vs the masking unit fake); CI's leitner-directive e2e caught the cap-3 payload-content break that fast-gate + unit were blind to.
- **Away-mode drain held:** the wave merged via cron + completion-poll wake signals with no stuck windows; per-agent liveness probes kept state honest.

## What to improve

1. **TICKET MISMATCH (the headline failure).** I ran a full Dave-research → Kyle-design → Devon-build chain (#456, phoneme-blend prompt) under ticket `86c9qa6n3` **without reading the ticket body**. The real `86c9qa6n3` is a _different_ feature — the cross-vowel-mix-firing `pickCvcReviewNode` picker, with an already-locked mechanic and pre-existing research (`cvc-review-mode-mechanic.md`). Dave even flagged his new research as "complementary, not duplicative" to the existing file — a signal I should have caught. **Fix: ALWAYS fetch + inline the ClickUp ticket body before dispatching research/design/build (`feedback_inject_ticket_body`).** The phoneme-blend is still good, Thomas-approved work — it just needs its own ticket.
2. **Run the leitner-directive e2e locally on any cap/interval change** — fast-gate + unit don't cover payload-content assertions (#452 missed this; cost a re-dispatch).
3. **Review agents repeatedly completed analysis without posting the verdict comment** — had to SendMessage-resume 3× this session to get verdicts on the PR. Worth a dispatch-brief reinforcement.

## Patterns captured to docs this session

- `progress-and-persistence.md` — `progress.leitner` = due subset; the dual-blob reset trap (`clearProgress` + session-history).
- `planner-and-canon.md` — `renderSsmlInnerText` early-return trap (recap/streak byte-shared under `tierFilter='letter-sounds'`).
- `testing-and-ci.md` — `lastSeen:0` always-due fixture trap; stacked failing-first-spec `--onto` rebase gotcha.

## Open (Thomas-gated, queued in decisions-while-away.md)

- Re-ticket #456 (phoneme-blend) + merge?
- Build the actual `86c9qa6n3` (cross-vowel-mix-firing, mechanic locked)?
- Voice-QA ear-test of the 3 round-6 clips (prod); CVC blend audio bake + Kyle's 3 questions; recap-audio bake.
- Light-up blocker: emitting the 6th `blend` slot collides with `SYSTEM_PREAMBLE` "exactly 5 utterances / 60 entries" — needs a coordinated planner change + Thomas-gated bake.
