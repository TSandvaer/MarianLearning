# Backlog-Sweep Retro — tap-gate chain, add-to-20 research closure, QA-page precache hardening

**Date:** 2026-06-12 (single afternoon, post-Wave-11 close)
**Shipped:** PRs #394 + #398 (QA-page globIgnores, Kevin), #399 (tap-gate spec, Kyle), #400 (add-to-20 Class B research, Dave), #401 (§7.6 closure annotations, Kevin), #402 (tap-gate impl, Devon) — plus docs chores #393/#403 and retros #395
**Tickets closed:** 86ca7yqur · 86ca7zjxz · 86ca7urvk (+ child 86ca84ukt) · 86ca7urp4 (+ child 86ca84un0)
**Outcome:** the idle window while Thomas-gated threads (Wave 12 plan read, audition picks) waited was converted into six merged PRs: the SW bootstrapping gap is closed for all three QA-surface pages, the polish-audit tap-gate recommendation went ruling → spec → implementation in one day, and the add-to-20 research deferral is resolved with spec annotations.

## What went well

- **Research → spec → impl chain in one afternoon with zero renegotiation:** Dave's MODIFY ruling (TTS-start gate, not 500ms timer) was consumed verbatim by Kyle's spec, which was consumed verbatim by Devon's impl. Each stage's binding constraints were inlined in the next dispatch brief.
- **Devon's separation decision protected the regression surface:** instead of retargeting `readAloudPlayed` (whose completion semantics anchor the M4 latency window and ~20 regression tests), he introduced a separate `chipGateOpen` signal. Kevin's review verified the separation empirically — no existing consumer changed semantics.
- **Kyle caught a live spec/impl divergence while speccing:** the old "chips remain tappable during TTS playback" AC had been false since the completion-gate shipped; the spec PR reworded it. Spec-authoring on top of live code surfaces drift that neither pure review nor pure testing had caught.
- **Review depth stayed real on small PRs:** Devon re-built and re-grepped the precache manifest himself on both globIgnore PRs; Kevin re-ran the full vitest suite and grepped every `readAloudPlayed` consumer on #402. Two findings escaped into tickets rather than being lost (third QA page; M4.x latency anchor).

## Lessons / patterns

- **Review agents complete analysis but die before posting the verdict (2/2 on Devon's dispatches).** The in-chat analysis is NOT the audit record; verify `gh pr view <n> --json comments,reviews` for "REVIEW VERDICT" after every review completion, and SendMessage-resume the agent with "post your verdict" — it posts within one round. Kevin's review (3rd dispatch) posted unprompted after the brief made posting an explicit, confirm-the-URL step. Captured in memory (`review-agents-die-before-posting-verdict`).
- **`prettier --write` whole-file rewrite inflates markdown diffs:** a 9-line hand-edit to a prettier-dirty design doc committed as 73/55 (PR #401). Verify intended lines via targeted diff grep, not diff size. Now documented in testing-and-ci.md §5.
- **Gate-relaxation framing beats gate-addition framing:** the tap-gate "feature" was actually a relaxation — chips already locked until read-aloud _completion_; the spec moved the open-point earlier (TTS start) with a fail-open watchdog. Identifying the existing gate first (Kyle's finding) turned a scary interaction change into a low-risk retarget.
- **A finding's escape route matters:** Kevin's M4.x latency-anchor catch (fast taps now record latency `-1`, skewing the slow-fact dataset) was explicitly out of #402's scope. It survived as ticket 86ca85b7u with a pedagogy-consult flag instead of dying in a review comment.

## Open / next

- 86ca85b7u — M4.x latency-anchor decision (blocks M4.x analysis work; Dave consult at dispatch).
- 86ca85b62 — #402 comment-hygiene NITs (batch with next Math.tsx ticket).
- 86ca7yg0r — planner mode-count comments (batch with W12-03's `_planner.ts` work).
- 86ca7yvzz — WordSong act() warning (batch with next WordSong-tests ticket).
- Thomas's real-iPad feel check on the 200ms chip opacity-lift (rides his next iPad pass).
- Thomas gates unchanged: Wave 12 plan PR #397 read; audition picks; voice-qa issues #372/#377/#387 close call.
