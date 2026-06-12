# Voice-QA Rounds 2-4 Retro — the fix cycle: 45 fails → 9, and the phantom-triage saga

**Date:** 2026-06-11 → 2026-06-12
**Shipped:** PRs #379 (round-2 records), #382 (SW-bypass), #384 (round-2 SSML fixes), #388 (round-3 records + triage), #389 (audition page), #392 (round-4 records + badge clear)
**Issues:** #377 (round 2) · #387 (round 3) · #391 (round 4, open pending the last 9)
**Outcome:** Thomas's baseline pass (45 fails) drove three fix/re-test rounds down to **645/654 pass, 9 open fails** — and most of the journey's "fails" turned out to be the delivery pipeline, not the audio: stale service-worker bytes masquerading as bad renders.

## What shipped

| PR   | Surface                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------- |
| #379 | Round-2 verdict records into `design/voice-qa/`                                                 |
| #382 | `bypassServiceWorker` for the voice-QA page — fetch audio around the SW cache                   |
| #384 | SSML fixes for the 6 genuine round-2 fails                                                      |
| #388 | Round-3 records + the decidedAt/audioHash triage that separated phantoms from real fails        |
| #389 | Audition page (`voice-audition.html`) — 3 stubborn sounds × 7 SSML variants of real baked canon |
| #392 | Round-4 records; 21 re-passed badges cleared from `voice-qa-status.json`                        |

## The phantom-triage saga (the wave's central lesson)

- **Round 2 reported 30 fails; 24 were phantoms.** Their verdicts were decided 14:34–14:51Z against pre-fix bytes — the device's stale SW served old audio. Only 6 were genuine current-byte failures (fixed in #384). The original round-2 fix tickets were both re-scoped after triage.
- **The SW-bypass (#382) then hit a bootstrapping gap:** the bypass ships inside `voice-qa.html`, but that page was itself SW-precached — the fix can't deploy through the stale SW it exists to clear. Recovery: private Safari tab. Permanent fix: `globIgnores` for QA-surface pages (ticket 86ca7yqur → PR #394, in CI at retro time).
- **Round 4 confirmed the diagnosis:** 21 of the 24 phantom-suspects re-passed unchanged in Thomas's private-tab pass. Zero audio was touched for those 21 — the "fails" were never about the audio.
- **Standing method (now testing-and-ci.md §4.4.2):** triage every reported fail by `decidedAt` timestamp vs deploy time + `audioHash` BEFORE filing fix tickets.

## What went well

- **Two-consecutive-ear-rejections → audition pivot.** After the 3 stubborn sounds (vvv, O, "four") failed two one-shot SSML fix attempts, the team stopped guessing and built the audition page (#389): 7 variants per sound, variant 0 = current baseline, one parallel A/B pass for Thomas instead of serial fix-reject cycles. (Pattern recorded in memory: audio-audition-page.)
- **Verification discipline held under merge pressure:** Jessica's round-4 counts (654 verdicts / 645 pass / 9 fail / 21 badge removals) were independently re-derived before #392 merged; Devon's #394 review re-ran the build and grepped the precache manifest himself rather than trusting the PR body.
- **The hash-keyed verdict design paid off exactly as intended:** re-bakes auto-flipped affected items to needs-retest, which is what made phantom-vs-genuine triage mechanically decidable at all.

## Process notes

- Chunked-report reassembly (adaptive fence length) worked across all three rounds; parse script at `%TEMP%\claude\vqa391-parse.cjs` (adapt issue number per round).
- Round-record PRs are mechanical but not skippable — `voice-qa-status.json` is the single source the page reads for badges; stale badges = Thomas re-listens to already-passed items.
- The records PRs and content-wave PRs interleaved on main all session with zero conflicts — disjoint keys in `status.json` made the predicted merge conflicts a non-event.

## Open / next (the last 9)

- **6 fails (vvv×4, O, four):** await Thomas's audition picks at `voice-audition.html`. On picks: winning SSML → `api/_tts.ts renderSsmlInnerText`, `revoiceCanonTargeted --ids` re-render of the 6, status.json repoint. If "none beats baseline" for a sound → route to Dave for a different mnemonic strategy.
- **2 fails (letter-sounds recap.4 / streak.4):** verdicts still carry ROUND-1 timestamps; their #375 fixes are live — they need a round-5 listen, not a fix.
- **1 fail (hub-welcome-what-today-alt-3.mp3):** genuine new pacing defect ("too much gap between hello and friend") — fix ticket 86ca7zeqh, fold into the audition-winner dispatch.
- **Round 5** = the 6 audition winners + alt-3 fix + the 2 stale-verdict listens. Potentially the closing round.
- QA-page precache exposure: PR #394 closes it for voice-qa/voice-audition; 86ca7zjxz covers the third page (letter-sounds-test.html).
