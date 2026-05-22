# Session Handoff — 2026-04-27 (updated)

Supersedes `SESSION-STATE-2026-04-26.md`. Read this one first.

---

## TL;DR

- **13 PRs merged this session** (#51–#73 contiguous range, all merged).
- **Word Song screen shipped end-to-end** (Marian's literacy track) — spec, picture-pack proposal, phonics research, impl, QA checklist, Session End amendment, UX polish, all merged.
- **iOS audio-context decay bug saga reached Phase 8.** Each phase fixed something real (proven by probe data) but uncovered the next layer. Phase 8 is the highest-confidence fix yet — Devon read Howler source end-to-end and found the actual root cause: `Howler._autoSuspend()` schedules a 30,000ms timer after every sound `_ended`, which matches our >30s idle repro window precisely. Fix: `Howler.autoSuspend = false`. **Awaits Thomas's iPad verification.**
- **iPad PASSes confirmed**: voice-quality SSML (`86c9gxup4` COMPLETE), rage-tap protection (`86c9gy4mf` COMPLETE), Math live audio in normal use, Greet in normal use.
- **iPad tests still pending**: Phase 8 decay verification (climactic), Word Song full-session test (celebration + Session End transition).
- **Thomas's hard directive (locked in 2026-04-26 evening, reaffirmed 3 times)**: no PR reviews, no design approvals, no morning anything except **iPad testing**. Orchestrator handles ALL approvals via Kevin↔Devon peer-review + autonomous merge.
- **All agents idle** at handoff time (07:35 UTC ish). Thomas mid-iPad-batch.

---

## What landed this session (full PR ledger — all merged)

| PR  | Title                                                                           | Notes                                                     |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| #51 | fix(audio): Phase 1 instrumentation + Phase 2 fix for iOS audio decay           | Phase 2 verified ineffective; instrumentation kept        |
| #52 | qa(math): additive Math QA spec drift consolidation                             | Scope-mismatch with original ticket but additively useful |
| #53 | feat(api): Azure Speech REST swap (replaces broken edge-tts WSS)                | Kevin                                                     |
| #54 | feat(math): Path A wire-up + MathSessionPlan adapter                            | Kevin                                                     |
| #55 | debug(audio): Phase 3 probe extension (gate state + speak channels)             | Devon                                                     |
| #56 | chore(deps): remove unused ws + @types/ws                                       | Kevin                                                     |
| #57 | qa: Math audio re-QA post-PR-#54 (surfaced P0 Azure prod issue)                 | Jessica                                                   |
| #58 | chore(api): console.error on tts-failed catch path                              | Kevin                                                     |
| #59 | fix(audio): Phase 4 await-then-play                                             | Devon — verified didn't fully fix                         |
| #60 | fix(audio): Phase 5 silent-buffer iOS-audio-session unlock                      | Devon — verified didn't fully fix                         |
| #61 | design(spec): Screen 4 Word Song (875 lines)                                    | Kyle                                                      |
| #62 | research(phonics): sequence + word selection for Marian (396 lines, 18 sources) | Dave                                                      |
| #63 | qa(math): backfill 6 automation gaps + persona-name scrub                       | Devon                                                     |
| #64 | design(word-song): short-a CVC picture-pack proposal v1                         | Kyle                                                      |
| #65 | feat(voice): SSML emphasis on interrogative phrases                             | Devon — **iPad-PASS** ✅                                  |
| #66 | fix(math): hold resolved flag in ref to prevent rage-tap stardust compounding   | Devon — **iPad-PASS** ✅                                  |
| #67 | design(session-end): amend for Word Song handoff state                          | Kyle                                                      |
| #68 | qa(word-song): regression checklist + AC matrix per spec                        | Jessica                                                   |
| #69 | feat(word-song): impl + rage-tap mirror (50 new tests, 97% coverage)            | Devon                                                     |
| #70 | fix(audio): Phase 6 HTML5 audio pool refill                                     | Devon — verified didn't fully fix                         |
| #71 | fix(word-song): celebration visibility + Session End transition                 | Devon-2                                                   |
| #72 | fix(audio): Phase 7 event-driven ctx.resume wait + 5s timeout                   | Devon — verified didn't fully fix                         |
| #73 | fix(audio): Phase 8 — `Howler.autoSuspend = false` (the actual root cause)      | Devon — **awaits iPad**                                   |

**P0 Azure prod fix** (mid-session, no PR — env var fix on Vercel UI applied by Thomas):

- Symptom: `/api/claude` returned `tts-failed: fetch failed` ~200ms against production
- Diagnosis (Kevin, post-Vercel-logs): `AZURE_SPEECH_REGION` was wrong on Production env vars
- Fix: Thomas updated env var to `westeurope`, redeployed
- Verified PASS via curl

---

## The decay bug saga (8 phases — Phase 8 is the candidate saga-closer)

Ticket: `86c9gvd0y` — iOS audio-context decay leaves entire audio system tap-dead after long idle.

| Phase | PR      | Hypothesis                                                                                                                                                                                                                                                     | Outcome                                                                                                             |
| ----- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1     | #51     | Probe to capture state during failure                                                                                                                                                                                                                          | Captured: ctx suspended for 60s+, tap → ctx running, but no speak-onplay                                            |
| 2     | #51     | resumeHowlerContextOnGesture (sync ctx.resume on gesture)                                                                                                                                                                                                      | iPad-FAIL (ctx still suspended at speak-call time)                                                                  |
| 3     | #55     | Probe extension: speak-call/speak-onplay/handler-error/gateState                                                                                                                                                                                               | Captured: speak-call fires sound id, no speak-onplay                                                                |
| 4     | #59     | awaitHowlerContextResume (await before play)                                                                                                                                                                                                                   | iPad-FAIL (await timeout 500ms too short for long idle)                                                             |
| 5     | #60     | Silent buffer + ctx.resume in gesture (canonical iOS unlock)                                                                                                                                                                                                   | iPad-FAIL (Howler HTML5 pool exhausted)                                                                             |
| 6     | #70     | Refill `Howler._html5AudioPool` on gesture                                                                                                                                                                                                                     | Pool refill works (0→10) but iPad-FAIL persists                                                                     |
| 7     | #72     | Event-driven wait on `statechange` → `running`, 5s fallback                                                                                                                                                                                                    | iPad-FAIL — ctx now reaches `running` in 217ms, but `speak-onplay` STILL doesn't fire; `howlerAudioUnlocked: false` |
| **8** | **#73** | **`Howler.autoSuspend = false`** — Howler's INTERNAL state machine has a 30s timer (line 484) that flips `Howler.state` to `'suspended'`; `Howl.play()` reads `Howler.state` (not AudioContext.state) and defers via 'resume' event that never settles on iPad | **MERGED, awaits Thomas's iPad verification**                                                                       |

**Why 8 phases:** every phase fixed something real (proven by probe data) but each surfaced the next layer. The empirical chain is healthy. **Phase 8 is the highest-confidence fix** because Devon found the explicit 30,000ms timer in Howler source that matches our >30s idle repro window precisely. Kevin verified each line citation in `node_modules/howler/dist/howler.js`:

- Line 484-505: 30000ms `setTimeout` in `_autoSuspend` ✓
- Line 1997: `_autoSuspend()` called from `_ended` ✓
- Line 886: `Howl.play()` checks `Howler.state` ✓
- Line 52: `self.autoSuspend = true` default ✓

**Phase 8 specifics (PR #73, merged):**

- `disableHowlerAutoSuspend()` helper at module load in `App.tsx` — total disable (not just next-fire)
- Defensive `Howler._unlockAudio()` belt-and-braces inside `unlockIosAudioSession`
- New probe fields: `howlerState`, `howlerAutoSuspend`, `howlerUnlockMethodCalled`
- Phase 5/6/7 helpers untouched — Phase 8 is purely additive
- 752/752 tests pass, lint+typecheck clean

**If Phase 8 still fails on iPad** (low-probability given source-trace alignment): the new probe data will show whether `howlerAutoSuspend: false` actually engaged at gesture time, and whether `Howler.state` stayed `'running'` through idle. Kevin flagged Howler `sampleRate` reset as a potential next variable for Phase 9 if needed.

---

## iPad batch results so far (this session)

| Test                                              | Status                                            |
| ------------------------------------------------- | ------------------------------------------------- |
| Voice quality "How many" interrogative            | ✅ PASS — `86c9gxup4` COMPLETE                    |
| Rage-tap protection (5x rapid → 1 stardust)       | ✅ PASS — `86c9gy4mf` COMPLETE                    |
| Phase 8 decay (idle 60s → tap → audio)            | ⏳ Pending — climactic test                       |
| Word Song first-run (initial post-Word-Song-impl) | Mostly pass; surfaced 2 bugs both fixed by PR #71 |
| Word Song full session (post PR #71)              | ⏳ Pending — celebration + Session End verify     |
| Math live audio in normal use                     | ✅ PASS observed during Word Song "how many" test |

---

## Tickets through statuses

**COMPLETE:**

- `86c9gxup4` voice-quality SSML
- `86c9gy4mf` rage-tap stardust compounding (Math)
- `86c9gnhez` Greet (per earlier session)
- All design/research/QA-checklist tickets from this session

**Currently READY FOR QA TEST (awaits iPad):**

- `86c9gvd0y` (decay bug, Phase 8 deployed) — **highest-priority test**
- `86c9grn33` (Math impl) — long-idle audio depends on Phase 8
- `86c9gy8gu` (Word Song impl tracker)
- `86c9h07fy` (Word Song celebration timing)
- `86c9h07ht` (Word Song Session End transition)

**TO DO low-priority parked:**

- `86c9gy7ju` Math wrong-tap closure-stale (low, bounded)
- `86c9gyb2v` Word Song wrong-tap closure-stale (low, bounded; parallels Math)
- `86c9h0uf3` loading indicator during 5s resume wait (UX polish, conditional on Phase 8 PASS)
- `86c9grn3n` lib/tts cleanup (Kevin, was blocked on Word Song shipping — now unblocked)
- `86c9gugmm` /api/claude rehydrate semantics (Kevin)
- `86c9gugm7` Session End "All done!" CTA destination (Thomas decision)
- `86c9grn2q` pic-dog format decision (Thomas)
- 14 spec drifts captured by Jessica in `qa/word-song.md` (A–N)

---

## Memory updates this session

Saved/updated:

- `feedback_constant_work.md` — extended with proactive auto-dispatch on agent completion (was: passive "find work while waiting"). Persona→column lookup table baked in.
- `feedback_inject_ticket_body.md` — Jessica/Kyle/Dave can't WebFetch ClickUp (auth wall); orchestrator must inject ticket body into prompts.
- `feedback_worktree_isolation.md` — multiple writer-agents in same root checkout collide; use per-ticket worktrees. **Important**: `isolation: "worktree"` parameter on Agent dispatches DOES NOT work from this orchestrator's CWD because CWD is not a git repo; the actual repo is at `MarianLearning/`. Manual `git worktree add` pattern is the working solution.
- `feedback_bashless_persona_git_ops.md` — Dave (research persona) has no Bash; orchestrator must do git ops + PR creation.
- `feedback_pr_merge_authority.md` (existing, applied broadly) — orchestrator merges all PRs autonomously after peer review.
- `feedback_ship_over_design_approval.md` — once empirical data confirms a bug, ship the fix; no separate design-approval gate.
- `feedback_persona_no_signing.md` — sub-agents must NOT sign comments/commits with persona names.
- `project_tts_provider_decision.md` — Azure Speech REST locked in 2026-04-26; en-US-AnaNeural voice; $0/mo F0 free tier.
- `project_audio_architecture.md` — rewritten to reflect Azure REST as active path.

---

## Owed by Thomas

In priority order:

1. **iPad test of Phase 8** — climactic decay test. https://marian-learning.vercel.app, Splash → Greet → idle 60+s → tap. If passes, 8-phase saga closes.
2. **iPad test of Word Song full session** — `?route=literacy`, complete 8 problems, expect visible celebration animations + Session End transition after problem 8.
3. **Decisions** (no time pressure): Word Song picture sourcing route (commission/curate/AI-gen — see `design/word-song-picture-pack.md`), Phoneme MP3 pipeline, Session End "All done!" CTA destination (`86c9gugm7`), short-vowel sequence change recommended by Dave's research (`o → u → i → e` instead of CLAUDE.md's `o → u → e → i`).
4. **Stash sanity check** — `git stash apply 7703e76` if you want to verify the pre-existing stash from earlier work.
5. **Dangling local branch** — `chore/86c9gw9fe-ws-cleanup` has commits from a worktree-collision earlier; cleanup whenever.

---

## Operating directives (Thomas, locked in)

1. **NO PR reviews** for Thomas — orchestrator handles via Kevin↔Devon peer review + auto-merge.
2. **NO design approvals** for Thomas — orchestrator merges spec/research/picture-pack PRs autonomously.
3. **NO morning approvals** of any kind — only iPad testing.
4. **Ship-velocity bias** for Marian's app to be usable.
5. **Empirical-first rule still binding** — get logs/data before iterating fixes (PR #28 saga lesson).
6. **Worktree isolation for parallel writers** — manual `git worktree add ../MarianLearning-worktrees/<id>` pattern from inside the agent's brief.

---

## What the next session needs to know

- **Read this file FIRST**, then `MEMORY.md`, then check ClickUp board state.
- **Phase 8 is the highest-confidence fix of the saga** — Howler source-trace identified the explicit 30s timer matching our repro window. If Phase 8 passes iPad, the 8-phase decay saga finally closes.
- **Two iPad tests remain**: Phase 8 decay (idle 60s, tap, expect audio), Word Song full session (celebration + Session End).
- **Probe instrumentation is rich** — if Phase 8 fails, the next iPad capture will show `howlerAutoSuspend`, `howlerState`, `howlerUnlockMethodCalled` so we know exactly what to look at.
- **Word Song is feature-complete for v1** modulo phoneme MP3s + real picture assets (pending Thomas's sourcing decision).
- **Math live audio works end-to-end** in normal use (verified by Thomas via "how many" test).
- 13 PRs merged means the codebase has changed substantially; if doing code-read of any specific area, fetch latest main first.

---

## Quote of the session

"i dont need to do morning review" + "i dont need to approve PR's" + "ok save state and everything so i can start a new session" — Thomas locked in autonomous orchestration after watching the team ship 13 PRs in ~12 hours.

---

_Last updated 2026-04-27 ~07:35 UTC, written before context compaction. Phase 8 deployed. iPad verification of Phase 8 is the climactic next step._
