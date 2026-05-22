# Session Handoff — 2026-04-26

Supersedes `SESSION-STATE-2026-04-25-night.md`. Read this one first. Final state at end of session, after the overnight chain + Thomas's iPad test pass.

---

## TL;DR

- **21 PRs merged this session** (#27–#48, contiguous)
- **Path A server-side TTS:** code shipped + recovered after 3-round hot-fix saga. **But functionally broken in prod** — WSS handshake to `speech.platform.bing.com` times out from Vercel egress. P1 ticket `86c9gv8um` filed for Devon. Math live-audio integration blocked.
- **Math screen impl shipped (PR #40) + Math QA clean (PR #44)** — visual flow + answer tracking work fine on iPad; just no audio yet (waiting on the WSS fix)
- **iOS audio-context decay discovered** by Thomas's iPad test — Greet (and all audio surfaces) become tap-dead after ~30s idle. P1 ticket `86c9gvd0y` filed for Devon, scope clarified to whole audio surface (single fix benefits Greet + Math + Session End + Word Song).
- **`ANTHROPIC_API_KEY` landed in Vercel env** (Thomas, ~13:00 CEST). Stub endpoint returns 200; live render still 502s on the WSS issue.
- **Persona-signature instruction added to all 6 agent files** — fixes the Content Integrity guard widening warnings. **Effective next VS Code session restart.**
- **Math-impl read-aloud-vs-chip-tap race** filed as `86c9guh4y` (Devon, normal) — only matters once live audio works; not urgent.

---

## What landed this session (full PR ledger)

| PR  | Title                                                      | Squash SHA | Notes                                 |
| --- | ---------------------------------------------------------- | ---------- | ------------------------------------- |
| #27 | docs: audio architecture decisions and journey             | `ce959f9`  | (carried from prior)                  |
| #28 | feat(audio): Path A server-side TTS pipeline               | `16aeea7`  | broken at runtime                     |
| #29 | fix(greet): GBUG-7 silent-halt recovery                    | `256fa69`  | shipped                               |
| #30 | docs(session-1): asset-table .png→.svg + JSDoc fixups      | `14bab85`  | Kyle                                  |
| #31 | qa: regression checklists for #28 + #29                    | `50ba8b4`  | Jessica pre-author                    |
| #32 | fix(api): cold-start runtime config (insufficient)         | `70b0dc7`  | hot-fix r1, didn't help               |
| #33 | design(spec): Screen 3 Math (716 lines)                    | `7093cd8`  | Kyle                                  |
| #34 | fix(api): { fetch } entrypoint shape (insufficient)        | `bf4bd5b`  | hot-fix r2, didn't help               |
| #35 | research(math): distractor cutoff + streak threshold       | `ed266f2`  | Dave                                  |
| #36 | fix(api): .js extensions on relative imports — REAL FIX    | `199411b`  | hot-fix r3 fixed cold-start           |
| #37 | qa(run): first-run results for Path A + GBUG-7             | `019ab21`  | Jessica                               |
| #38 | design(spec): lock Dave's Math recommendations             | `8a2e477`  | Kyle                                  |
| #39 | chore(lint): forbid bare relative imports in api/\*        | `c66215d`  | Kevin — prevents ESM regression class |
| #40 | feat(math): Screen 3 Math impl                             | `615513c`  | Devon — +101 tests                    |
| #41 | design(spec): mid-session interrupt and resume (824 lines) | `e32fe90`  | Kyle                                  |
| #42 | design(spec): Screen 5 Session End (917 lines)             | `a316ea8`  | Kyle                                  |
| #43 | design(spec): tighten gentle-ramp distractor example       | `281f3cc`  | Kyle                                  |
| #44 | qa(math): regression checklist + first run                 | `cf37047`  | Jessica — 0 FAILs                     |
| #45 | chore(prettier): one-time --write design/\*_/_.md          | `80a6b8a`  | Kevin                                 |
| #46 | design(spec): retire sprite-sheet recommendation           | `efa3619`  | Kyle                                  |
| #47 | chore(test): formalize jsdom Storage shim                  | `b892dac`  | Kevin — 503 tests                     |
| #48 | qa(path-a): finish env-var-gated rows                      | `2f5afe1`  | Jessica — found WSS issue             |

---

## Tickets through statuses

**To COMPLETE:** `86c9gp99a` (Web Speech investigation), `86c9gqprh` (Plan B Greet), `86c9gr43t` (GBUG-7), `86c9grnj4` (Path A cold-start regression), `86c9gt449` (Math spec-lock), `86c9grnjf` (mid-session resume spec), `86c9grnjd` (Session End spec), `86c9gu2rg` (lint rule), `86c9grn2d` (prettier sweep), `86c9grn1v` (sprite-sheet retire), `86c9gn9th` (Storage shim), `86c9guegd` (distractor example fix).

**Currently READY FOR QA TEST:** `86c9grn33` (Math impl) — awaits Thomas iPad pass + waits on `86c9gv8um` for live audio.

**Currently IN REVIEW:** `86c9gr385` (Path A) — moved BACK from READY FOR QA TEST after Jessica found the WSS upstream timeout.

**TO DO high:**

- `86c9gv8um` Path A WSS handshake timeout — **urgent / P1, Devon**
- `86c9gvd0y` iOS audio-context decay (whole audio surface) — **urgent / P1, Devon**
- `86c9gugm7` Session End "All done!" CTA destination — **decision-needed, Thomas** (if Option B selected, triggers a Hub spec ticket as hard prerequisite)

**TO DO normal/low (parked):**

- `86c9grn33` Math impl follow-ups — `86c9guh4y` (Devon, read-aloud race), `86c9guegd` (closed)
- `86c9grn3n` lib/tts cleanup (Kevin, blocked on Math + Word Song shipping)
- `86c9grn2q` pic-dog format decision (Thomas)
- `86c9grp6a` Devon's deferred PR #29 nit
- `86c9gp6jq` SFX preload registry, `86c9gp6g2` Math→MathScreen rename (both Devon, both queued)
- `86c9gugmm` /api/claude rehydrate semantics (Kevin)
- `86c9gumgk` Math QA spec drift consolidation (5 items)
- `86c9gumhp` Math QA automation gaps (6 items, ~2h work)
- `86c9gv05j` "sprite swap" terminology sweep (Kyle)
- `86c9gv13m` qa/greet-regression.md format drift
- `86c9gv8v4` MathSessionPlan shape mismatch with wire shape (Devon, footgun for live-integration swap)

---

## Owed by Thomas (priority order)

1. **VS Code session restart** — needed to load the new persona-no-signing instruction in agent files
2. **Decision: Devon's next priority** — `86c9gv8um` (WSS) vs `86c9gvd0y` (audio-context decay) vs both in parallel? They're independent surfaces (server-side vs client-side), can be done in parallel agents.
3. **Plan B pricing** — IF Devon's WSS investigation confirms Vercel egress / Microsoft block-list as root cause, the entire Path A architecture may need to swap to a different TTS provider (OpenAI / Google / ElevenLabs) OR self-host an edge-tts shim on Cloudflare Workers / Railway. Worth thinking about now before Devon spends a day chasing the wrong fix.
4. **iPad pass on Math + Greet** — Math screen visual + answer tracking confirmed working today; need Greet repro confirmation post-WSS-fix
5. **Decision: Session End "All done!" CTA destination** — `86c9gugm7` (A/B/C; B triggers a Hub spec)
6. **Decision: bilingual sleep splash policy** — Open Q on Session End spec (most read-heavy moment for an English-second-language 8yo)
7. **Add real `ANTHROPIC_API_KEY`** to Vercel env eventually (placeholder works for now since we don't actually call Anthropic in v1)

---

## Memories saved this session

- `project_vercel_runtime_config.md` — REWRITTEN with real cause (ESM `.js` extensions); tells future agents to get Vercel logs FIRST, not iterate hot-fix guesses
- `feedback_overnight_orchestration.md` — ScheduleWakeup chain pattern + overnight-safe filter + hard stops + morning handoff template
- `feedback_constant_work.md` — find parallel non-conflicting work whenever waiting on agents
- `feedback_agent_staleness.md` — pair every >15min dispatch with ScheduleWakeup health-check
- `feedback_persona_no_signing.md` (NEW this session) — persona-signature policy: agents do not sign comments / commits with persona names; identity is captured elsewhere

---

## Hot-fix saga lessons (preserve for next time)

PR #28 shipped with three concurrent issues that masked each other:

1. `export const config = { runtime: 'nodejs' }` — Next.js middleware shape, rejected by Vercel Functions bundler (PR #32)
2. `export default async function handler(...)` — bare default fn falls through @vercel/node legacy `(req, res)` codepath, throws TypeError on `request.headers.get()` (PR #34)
3. **`from './_types'` bare relative imports** — Node ESM strict-resolution requires `.js` extensions; bare specifiers crash at module-load with `ERR_MODULE_NOT_FOUND` (PR #36 — the ACTUAL cause)

PRs #32 and #34 were correct as defensive hardening but neither addressed the real fault. **The 3-hour debug cost was avoidable if we'd pulled Vercel logs first.** Captured in:

- Memory: `project_vercel_runtime_config.md`
- Lint: PR #39 prevents the regression class structurally
- CI: `scripts/post-deploy-smoke.sh` + `.github/workflows/post-deploy-smoke.yml`

Same lesson applied at the audio-context decay bug (`86c9gvd0y`) — the 30-second-then-tap-dead repro is a classic iOS WebKit audio-session-interruption shape; Devon should test the hypothesis empirically (log `AudioContext.state` over 30s+ idle) before guessing at fixes.

---

## Worktree state

```
C:/Trunk/PRIVATE/MARIAN-TUTOR/MarianLearning   ce959f9 [main]   ← stale (41 phantom-staged scaffold files; pre-existing)
```

All other worktrees pruned cleanly throughout the session.

---

## Notable session events

- Anthropic API was overloaded once (~09:40 CEST, killed Devon Math impl twice). Recovered by 10:27 CEST (overnight chain wake 1 confirmed via Matt canary).
- Content Integrity guard fired 4 times on persona signatures. Fix appended to all 6 agent files (effective next VS Code restart).
- Vercel CLI auth was needed to read function logs. Thomas did the OAuth flow successfully; Devon used it on round 3 of the hot-fix saga to find the actual ESM error. **The CLI is now auth'd on Thomas's machine for future investigations.**
- Overnight chain ran 4-of-4 wakes successfully (09:40 → 13:34 CEST), no hard-stop conditions triggered.

---

_Last updated 2026-04-26 ~14:30 CEST at end of session. Quote of the day: "always get logs first, never iterate hot-fix guesses."_
