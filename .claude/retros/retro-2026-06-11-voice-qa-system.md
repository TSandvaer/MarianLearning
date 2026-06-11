# Voice-QA System Retro — full-coverage Emma speech ear-test loop

**Date:** 2026-06-11
**Shipped:** PRs #363 (page), #362 (endpoint), #361 (e2e spec) + #364 (Wave 10 plan, drafted in parallel by Matt)
**Tickets:** VQA.1 `86ca7er39` · VQA.2 `86ca7er73` · VQA.3 `86ca7eraj`
**Outcome:** Thomas can now ear-test every unique Emma render (632 deduped canon + 4 greet + 18 hub = 654 items) at `https://marian-learning.vercel.app/voice-qa.html`, verdict pass/fail with category + note, and submit batches that land as `voice-qa`-labeled GitHub issues for orchestrator pickup. Verdicts key on `(itemId, audioHash)` so any future re-bake auto-flips affected items to needs-retest. Endpoint verified live in production with env vars (401 on wrong secret).

## What shipped

| Ticket | PR   | Surface                                                                   | Review path                                                          |
| ------ | ---- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| VQA.1  | #363 | `public/voice-qa.html` — standalone static page, 654 items                | Kevin REQUEST_CHANGES (blocker routed to spec) → NITs fixed → merged |
| VQA.2  | #362 | `api/voice-qa-report.ts` — secret-gated, rate-limited, GitHub issue       | Devon: 3 rounds (2× REQUEST_CHANGES → adversarial APPROVE)           |
| VQA.3  | #361 | `e2e/voice-qa-page.spec.ts` — 6 tests, RED-first → 6/6 GREEN both engines | Kevin's #363 review surfaced the locator fix                         |

## What went well

- **Grill-me → vocabulary-contract dispatch (Pattern B) carried a 3-way parallel build.** Page, endpoint, and e2e spec were authored simultaneously against one explicit contract (shapes, status codes, data-testids, localStorage keys). Only two contract addendums surfaced mid-build (footer testid + per-row `data-audio-hash`), both relayed to Devon via SendMessage before his first push — zero rebase churn from vocabulary divergence.
- **Review rounds caught three real production-class bugs before Thomas ever touched the page:** (1) `MAX_VERDICTS=500` would have 400-rejected the full 654-verdict baseline submission; (2) the issue body crossed GitHub's 65,536-char limit at ~130 fails — the highest-signal report (bad bake breaking hundreds of cells) would have been the one that died; (3) Jessica's `toHaveCount` assertions counted `[hidden]` rows — the spec would have been red against a correct page.
- **WebKit-only verification catch.** Chromium ran the spec 6/6 green while WebKit (the iPad surrogate — the engine that matters) sat stuck in the 632-item hash loop past the expect timeout. Chromium-only verification would have shipped a spec red on the target engine.
- **Adversarial final review.** Devon's round-3 APPROVE drove the real `buildIssue` with worst-case inputs (2000 verdicts, 2000-char fields, all-fail) and verified no shape breaches 65,536 — approval by measurement, not by reading.

## What to watch

- **Vercel's GitHub webhook missed the #362 merge commit entirely** — no deployment record for 25+ min. Fix: empty commit to main re-triggers it. Watch for recurrence; two misses = ticket.
- **The report-issue chunking contract:** full report JSON arrives as fenced ```json parts (i/N) across issue comments; the fence length is ADAPTIVE (longer than the longest backtick run in the payload). Orchestrator-side parsing must read the opening fence length and match it on close — a fixed 3-backtick regex will corrupt reassembly.
- **`voice-qa-status.json` baseline flow is designed but unexercised** — first submitted report validates the orchestrator-maintained fix-status loop (badge "fixed in PR #N — re-test").
- **Page memory on iPad:** 632 base64 strings stay resident by design (replay affordance); blob URLs are capped at one live. Thomas's first full pass is the real memory test.

## Process notes

- Serial review-fix rounds on #362 (3 rounds) cost ~1 hour wall-clock but each round was load-bearing — this is the right depth for a contract/data-loss surface, not churn.
- The deploy gap shows "merged" ≠ "live": endpoint reachability was verified with a wrong-secret 401 probe before telling Thomas to test.
- Stale `vite preview` on :4173 (Wave 9 trap) was pre-emptively checked in every e2e run this wave — zero phantom failures.

## Open / next

- Thomas's first full baseline pass (654 items) — the system's first real exercise end-to-end.
- Kevin's W10.4 (#366) carries a stale `3893 (BINDING)` line ref inside the drift-guard tag (verbatim-from-ticket, non-blocking) — fix alongside the `.claude/docs` drift-guard line-ref refresh; Devon verified actuals: test block `_planner.test.ts:4035-4078`, binding `compositionLint.ts:4917-4921`.
- Wave 10 proceeds in parallel (W10.1 merged #365; W10.4 in CI; W10.2 Kyle next) — all canon-safe, no baseline interference.
