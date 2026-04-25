# Greet MP3 fail-recovery (GBUG-7) — Regression Checklist

ClickUp tickets:
- `86c9gr43t` — **GBUG-7: surface MP3 load failures so Greet recovers instead of silently halting, PR #29.** Wires `runGreetSequence.onLineError` → `useAudioUnlockGate.reportSpeechError()` → relock ring re-appears → next gesture retries the failed line via `start(failedIndex)`. Adds `tests/qa/audioAssetIntegrity.test.ts` build-time guard (Jessica's automation candidate #1 from PR #26 QA report).

Lineage:
- `86c9gqprh` (PR #25) — Plan B for Greet (pre-recorded bundled MP3s). Introduced the GBUG-7 surface area: a single Howler `loaderror` / `playerror` on any of Greet's 4 MP3s used to freeze the screen with empty caption ribbon and no heart CTA.
- `86c9gp99a` (PRs #15–#24) — original gesture-unlock + first-utterance retry contract. PR #29 reuses the same `useAudioUnlockGate` machinery and extends it with a `reportSpeechError()` method symmetric to `reportSpeechStart()`.

Spec: `qa/greet-regression.md` § "iPad Safari TTS gesture-bug regression list" GBUG-7 row is the source-of-truth for the bug shape. PR #29's "Testable acceptance criteria (for Jessica)" + "How (architectural)" sections in the PR body are the contract this checklist validates.

**Spec drift / new spec text needed:** `design/session-1.md` does not currently document the load-error recovery pathway — it pre-dates Plan B's file-asset audio. After PR #29 merges, Kyle should add a short paragraph under "Implementation Notes" describing the contract: *"If a Greet MP3 fails to load or play, the wake-tap surface re-engages with the ready ring and Marian can retry. The sequence resumes from the failed line, not from the start."* Flag for Matt to file as a docs ticket.

Prior siblings:
- `qa/greet-regression.md` — Plan B Greet checklist; this file is its dedicated GBUG-7 deep-dive.

This checklist is reusable: rerun every merge that touches `src/lib/audio/useAudioUnlockGate.ts`, `src/lib/audio/preRecorded.ts`, `src/screens/greetSequence.ts`, `src/screens/Greet.tsx`, `tests/qa/audioAssetIntegrity.test.ts`, or any of the 4 Greet MP3 files under `public/assets/audio/greet/`. Aim for ~12 minutes desktop end-to-end, plus the iPad pass.

If a Greet PR also alters the wake handler shape (synchronous `playGreetLine('hi')` inside the gesture handler), re-run `qa/greet-regression.md` AC rows 7, 20, 24 too. GBUG-7 recovery is **additive** to those rows, not a replacement.

## How to run

1. `yarn install` (once per branch).
2. `yarn typecheck && yarn lint && yarn test --run` — all green before any manual step. PR #29 advertises 269 tests passing (+32 vs. baseline 237). If local count diverges, investigate before continuing.
3. `yarn dev` and open `http://127.0.0.1:5173/` in Chromium DevTools at iPad portrait viewport (768×1024, dpr 2). Or hit the deployed Vercel preview URL after PR merges.
4. iPad rows: install the PWA from the Vercel preview URL onto a real iPad, launch from home screen.
5. Walk through the matrix below. Mark each row PASS / NOTES / FAIL / DEFERRED.

Touch-target / pixel-perfect / iPad-Safari-quirk rows are **DEFERRED-TO-DEVICE** — Thomas owns the binding verdict on a real iPad.

---

## Spec drift / ambiguities flagged for Kyle, Matt, and Thomas

| # | Status | Note |
|---|---|---|
| A | **Resolved in PR #29** | Recovery contract: `runGreetSequence.onLineError(index, err)` fires when a `playGreetLine` Howler `loaderror`/`playerror` rejects; sequence halts (does NOT auto-advance); caller routes through `gate.reportSpeechError()` to surface the relock ring. Wired in `src/screens/Greet.tsx:497-513`. |
| B | **Resolved in PR #29** | Retry seed: `runGreetSequence.start(fromIndex?)` accepts an optional index; `lastFailedLineRef` (`Greet.tsx:291`) carries the failed index across the relock → gesture cycle. The retry callback (`Greet.tsx:730-746`) reads the ref and seeds the new sequence at that line. Out-of-range seeds clamp to `[0, GREET_LINES.length - 1]` (`greetSequence.ts:258`). |
| C | **Resolved in PR #29** | Build-time integrity guard: `tests/qa/audioAssetIntegrity.test.ts` fails the build if any of the 4 MP3s is missing, sub-1KB, oversize (>30KB), or not a valid MPEG Layer III header. Source-driven from `GREET_LINE_SOURCES` so a future line addition / rename auto-extends coverage. |
| D | **Resolved in PR #29** | Debug overlay: `onLineError` calls `recordSpeakAttempt(GREET_LINES[i], 'errored', err.message)` so the `?debug=1` overlay's `last speak` row surfaces *which* MP3 failed plus the failure message. **Closes part of GBUG-8** (`qa/greet-regression.md` row 21) for the error path specifically — happy-path Plan B playback still leaves `last speak` dark per GBUG-8, which is a separate ticket. |
| **E** | **Open — flag for Kyle** | `design/session-1.md` does not document the load-error recovery pathway. After merge, add a short Implementation Notes paragraph: *"If a Greet MP3 fails to load or play, the wake-tap surface re-engages with the ready ring; the sequence resumes from the failed line on retry, not from the start."* **Not a release blocker** — implementation matches user-visible expectations — but the spec audit trail will be confusing for the next reader. |
| **F** | **Open — flag for Matt** | PR #29 explicitly defers two things to follow-up enhancement tickets: (1) substituting a fallback line ("Sorry, I can't talk right now"), (2) Web Speech `onerror` path (dead under Plan B, retires fully when Path A `86c9gr385` lands). Recap to Matt so they enter the queue. |
| **G** | **Open — flag for Devon/Kevin** | Cancellation-race contract: PR #29 keeps `cancelled` flag in `runGreetSequence` (`greetSequence.ts:181`) and gates `onLineError` via `if (cancelled) return` (`greetSequence.ts:238`). Test at `greetSequence.test.ts:344` (`it('does NOT fire onLineError when cancel() runs before the speak rejects')`) covers the unit contract. **Real-world concern** is route-change mid-sequence: if the user navigates away (no Math screen yet, but on PR-#29's main branch this is just refresh) the orchestrator's late-resolving promise may still try to call `onLineError`. The flag handles it; row 11 below validates. |

A/B/C/D are unblocked in the matrix. E, F, G are notes for Matt's queue, not gating items.

---

## Distribution

`X automated / Y manual desktop / Z iPad-only`

- **AC matrix:** 8 AC rows (rows 1–8) covering each failure mode + happy-path drift guard + asset integrity + debug overlay + cancellation race.
- **Survival/regression rows:** 4 (rows 9–12) covering PWA reload, full Greet flow on device, edge-cases.
- **Total:** **12 rows.**
- **Automated:** 7 (rows 1, 2, 3, 4, 7, 8, 11 — covered by Vitest in `Greet.test.tsx`, `greetSequence.test.ts`, `useAudioUnlockGate.test.tsx`, `tests/qa/audioAssetIntegrity.test.ts`).
- **Manual desktop:** 4 (rows 5, 6, 9, 10 — DevTools Network-blocking, build-time corruption sim, debug overlay inspection, happy-path drift confirmation against Vercel preview).
- **iPad-only:** 1 (row 12 — full Greet flow on real device after merge).

Plus 5 survival checks (lens 4) and 4 console/network sanity items below the matrix.

---

## AC matrix

One row per acceptance-criteria item from PR #29's "Testable acceptance criteria (for Jessica)" section, plus rows for each distinct failure mode called out in the brief, the build-time guard, the cancellation-race contract, and the iPad regression.

| # | Acceptance criterion (source) | Owner | How verified |
|---|---|---|---|
| 1 | **Recovery contract — line-0 (`greet-01-hi.mp3`) failure:** when line 0's MP3 fails to load, the relock ring re-appears with the wake-tap target hot. Marian can tap → same failure → ring re-appears again. **No silent halt, no empty ribbon, no error UI** (PR #29 AC bullet 1 + GBUG-7 row in `qa/greet-regression.md`). | **Auto + Desktop** | **Auto:** `Greet.test.tsx:1293` `describe('Greet MP3 failure recovery (ticket 86c9gr43t — GBUG-7)')`, with subtest at `:1302` covering "fast-fail path: line 0's MP3 fails to load". Asserts gate transitions to `relock`, ring re-appears, no error copy in DOM, retry callback wired. **Desktop:** Network tab → block `greet-01-hi.mp3` → tap Wake → silence (no audio) → ring re-appears within ~1.5s (gate watchdog) → tap again → same failure → ring re-appears. Repeat 3× to confirm Marian-facing behavior is "tap to try again," not stuck. |
| 2 | **Recovery contract — mid-sequence (`greet-02-im-melody.mp3`) failure:** "Hi!" plays successfully (line 0), line 2's MP3 then fails, relock ring re-appears with the wake-tap target hot. Tap → orchestrator resumes from line 2 (the failed line, NOT from line 0). (PR #29 AC bullet 1 + `start(fromIndex)` contract.) | **Auto + Desktop** | **Auto:** `Greet.test.tsx:1365` covers the line-2 failure path with the exact `[preRecorded] loaderror for "/assets/audio/greet/greet-02-im-melody.mp3"` message. `greetSequence.test.ts:306` `it('fires onLineError for a mid-sequence failure (not just line 0)')` covers the orchestrator side. `greetSequence.test.ts:90` `it('start(fromIndex) seeds the sequence at the given line — used by the relock retry path')` covers the resume-from-failed-line contract. **Desktop:** Network tab → block `greet-02-im-melody.mp3` only → tap Wake → "Hi!" plays audibly → silence (line 2 fails) → ring re-appears → tap → orchestrator should attempt line 2 again (not "Hi!"). Inspect Network tab to confirm no second `greet-01-hi.mp3` request fires. |
| 3 | **Recovery contract — post-unlock failure (line 3 or line 4 of the sequence):** any line after the gate has fully unlocked (`state === 'unlocked'`) that subsequently fails should still flip the gate back to `relock` (mid-sequence MP3 failure ≠ first-utterance silent miss). Wake-tap surface re-arms. (PR #29 architecture: `reportSpeechError` "transitions to `relock` from any state ... so a mid-sequence MP3 failure surfaces the relock UI symmetric with the silent-miss case.") | **Auto + Desktop** | **Auto:** `useAudioUnlockGate.test.tsx:294` `it('transitions unlocked → relock on reportSpeechError (mid-sequence MP3 failure)')`. Confirms the from-`unlocked` path. **Desktop:** Network tab → block `greet-03-nice-to-meet-you.mp3` only → tap Wake → "Hi!" plays → "I'm Melody." plays → silence (line 3 fails) → ring re-appears (overlaying the in-progress intro state) → tap → resumes from line 3. Heart should appear after line 3 actually completes (i.e. after the retry succeeds), not at first failure. |
| 4 | **Recovery contract — repeated failure of the same line:** Marian taps to retry the failed line, the MP3 fails again (e.g. it's still blocked / still corrupt). The gate flips back to `relock` *again*, ring re-appears, wake-tap surface re-engages. Marian can keep tapping indefinitely. **No degradation to a stuck state, no shame copy, no nag, no fallback message.** (PR #29 brief: "Marian can keep tapping (agency).") | **Auto + Desktop** | **Auto:** the `lastFailedLineRef` lifecycle (`Greet.tsx:741`: "Consume the failed-line marker — if THIS retry also fails, the orchestrator's onLineError will re-set it") is covered by the recovery test suite at `Greet.test.tsx:1413` per the inline comment "MP3 fails. Ticket explicitly notes she'll 'hit the same load [failure]'". **Desktop:** Network tab → block `greet-02-im-melody.mp3` → tap Wake → line 0 plays → line 2 fails → ring → tap → line 2 fails again → ring → tap → ring → ... Repeat ≥5 times. **Confirm:** no error UI ever appears, no console errors that would scare Thomas during a debug session beyond the expected `loaderror` log line, gate transitions are clean each cycle. |
| 5 | **Build-time integrity guard:** rename one of the 4 MP3s under `public/assets/audio/greet/` to anything else (e.g. `greet-01-hi.mp3` → `greet-01-hi.mp3.bak`), run `yarn test`, expect failure pointing at the missing file. Then revert the rename. (PR #29 AC bullet 3 + `tests/qa/audioAssetIntegrity.test.ts`.) | **Desktop** (build-time) | **Manual desktop:** in the QA worktree (NOT the main checkout), `mv public/assets/audio/greet/greet-01-hi.mp3 public/assets/audio/greet/greet-01-hi.mp3.bak`, run `yarn test --run tests/qa/audioAssetIntegrity.test.ts`, assert the test fails with a clear message naming `greet-01-hi.mp3`. **Then:** restore the file (`mv ... .bak ...`) and rerun the test to confirm green. **Bonus checks** (covered by the same test file but worth manually triggering once): truncate one MP3 to <1KB (`head -c 500 ... > smaller.mp3 && mv smaller.mp3 ...`) → expect size-floor failure; pad one MP3 to >30KB → expect size-ceiling failure; corrupt the first 2 bytes (`printf '\x00\x00' \| dd of=... bs=1 count=2 conv=notrunc`) → expect MPEG-header failure. **Restore originals after each.** |
| 6 | **Debug overlay surfaces *which* MP3 failed (`?debug=1`):** open `?debug=1` in a Safari/Chromium tab, repro the blocked-MP3 path (row 2). The overlay's `last speak` row should read `errored: "I'm Melody."` plus the failing MP3 source URL in the error tail. The `gate` row should read `relock`. (PR #29 AC bullet 4.) | **Desktop** | **Manual desktop:** open `http://127.0.0.1:5173/?debug=1` (or Vercel preview equivalent). Network tab → block `greet-02-im-melody.mp3`. Tap Wake. After line 0 plays and line 2 fails, inspect overlay: `last speak` row should show `errored: "I'm Melody."` and the message should reference `/assets/audio/greet/greet-02-im-melody.mp3` (per `Greet.test.tsx:1490` `it('emits the failed MP3 source URL to the debug bus so iPad QA can identify the file without console access')`). `gate` row should read `relock`. `recent taps` row should populate with the wake-tap event. **Closes the PR-#26 GBUG-8 follow-up for the error path.** Note: happy-path Plan B playback's `last speak` row still reads dark — that's a separate (still-open) ticket. |
| 7 | **Cancellation race — route-change mid-sequence doesn't leave orphaned `onLineError` callbacks mutating state:** if the component unmounts (or `cancel()` is called externally) before a late-resolving `playGreetLine` promise rejects, `onLineError` MUST NOT fire. (PR #29 architecture: cancellations are gated on the `cancelled` flag at `greetSequence.ts:181, 238`.) | **Auto** | **Auto:** `greetSequence.test.ts:344` `it('does NOT fire onLineError when cancel() runs before the speak rejects')` is the binding test. `:248` `it('cancel() suppresses callbacks after cancellation, even if a speak() resolves late')` covers the late-resolution path. **Test needed for full coverage:** Greet-component-level test that mounts `<Greet />`, triggers a wake-tap, then unmounts the component before the line-1 promise rejects. Assert no `onLineError` side effect (no `lastFailedLineRef` write, no `gate.reportSpeechError` call). Currently relying on the orchestrator-level guarantee. **Flag to Devon as a tightening test.** |
| 8 | **Happy-path drift guard:** with no MP3s blocked, Greet plays all 4 lines, heart CTA appears after line 3, heart-tap advances to Math screen. (PR #29 AC bullet 2 — confirms the fix didn't break the working case.) | **Auto + Desktop** | **Auto:** `Greet.test.tsx:1383` `it('reaches the heart CTA when no MP3 fails — drift guard for the happy path')`. Plus all of `qa/greet-regression.md`'s AC matrix continues to pass — verify the Greet test suite is fully green pre-manual. **Desktop:** Network tab → no blocks → tap Wake → all 4 lines play in order with ~400ms gaps → heart appears after line 3 → heart tap → chime (silent until asset lands) + advance to Math. Should be visually + audibly identical to the post-PR #25 baseline. |
| **9** | **Survival — IndexedDB / localStorage non-impact:** GBUG-7 fix touches only in-memory React refs (`lastFailedLineRef`) and the gate state machine. No persistent storage involvement. Hard-reload mid-relock should land back in fresh `wake` state, NOT in `relock` with a stale `lastFailedLineRef`. (Implicit invariant.) | **Desktop** | **Manual desktop:** Network tab → block `greet-02-im-melody.mp3` → tap Wake → line 0 plays → line 2 fails → ring appears → **hard reload (Ctrl+Shift+R)**. App should re-init in clean wake state with no leftover relock UI. (Greet has zero `localStorage`/`IndexedDB` reads — confirmed via `qa/runs/greet-2026-04-25-3d8664f.md:90`.) |
| **10** | **Survival — Greet's bundled MP3 path still works under Workbox precache** (PR #29 doesn't touch `vite.config.ts` precache rules; baseline = 37 entries). | **Desktop** | **Manual desktop:** `yarn build && yarn preview`. Chrome DevTools → Application → Service Workers → install PWA → throttle Network to "Offline" → hard reload → confirm Greet renders, Wake works, tap unlocks audio, all 4 MP3s play offline. Verify `Application → Cache Storage` contains the 4 `greet-*.mp3` entries. (This row also exists in `qa/greet-regression.md` AC #23 — re-running here as a non-regression spot-check.) |
| **11** | **Cancellation race — orchestrator's `cancelled` flag gates onLineError** (PR #29 architecture: `if (cancelled) return` before forwarding). | **Auto** | **Auto:** `greetSequence.test.ts:344` (covered by row 7) plus `:265` `it('a rejected speak() halts the sequence without throwing')` confirms the unit-level swallow contract for cancelled state. `:248` covers the late-resolve case. Re-asserting here for traceability against PR #29's review item discussion. |
| **12** | **iPad regression — full Greet flow on real device after merge** (chime → Hi → Melody → captions → heart) still works when all MP3s present. The whole reason GBUG-7 mattered: confirm the recovery wiring didn't introduce a regression to the happy path on the actual hardware. | **iPad** | **DEVICE:** Install PWA from Vercel preview (after PR #29 merges and a fresh deploy is up). Hard-launch from home screen. **Tap Wake** → confirm "Hi!" plays audibly within 250ms → confirm 4-line sequence plays in order with ear-wiggle on "Hi!" → confirm heart appears after line 3 → tap heart → chime (silent until asset lands) + advance. Repeat 3× from cold launch. **Then bonus device-only check:** turn iPad to airplane mode, hard-quit PWA, relaunch — Greet should play offline (Workbox precache). All 4 MP3s should be served from cache. **If any line goes silent on the device with all MP3s present, GBUG-7 fix has regressed PR #25's happy path.** Thomas's binding pass. |

---

## Survival checks (lens 4)

| Check | How | Expected |
|---|---|---|
| Rage-tap on the relock ring | After triggering an MP3 failure, tap the ring/screen ≥10× as fast as possible. | First tap fires the retry callback (registered at `Greet.tsx:730-746`). Subsequent taps in the same JS tick eaten by the gate's idempotency (gate state moves out of `relock` on first tap). No double-`start(fromIndex)`, no double-Howl-instance, no orphan promise. |
| Tap during the silence-after-failure window (between `playerror` rejection and the `relock` state propagating to UI) | Block an MP3, tap Wake, then aggressively tap during the brief window before the ring re-appears. | The intermediate window is short (microtask flush). The full-viewport tap target is gone (we're in `intro` state momentarily) — taps land on inert background. When ring appears, next tap dispatches gesture. **No corruption.** |
| Multiple distinct lines fail in sequence | Block lines 2 AND 3. Tap Wake → line 0 plays → line 2 fails → ring → tap → line 2 succeeds (line 2 is no longer blocked? scenario unrealistic without unblocking) — **simplify:** block line 2 only, tap-tap-tap to retry until you give up. | At each retry, `lastFailedLineRef` is consumed and re-set by the orchestrator (`Greet.tsx:741`). No accumulation of failed indices, no off-by-one (e.g. retrying line 1 when line 2 is the actual failure). |
| Heart-tap during a line-4 failure | Block `greet-04-tap-the-heart.mp3`. Tap Wake → lines 0, 1, 2 play → heart appears after line 3 → line 4 starts → fails → ring re-appears overlaying the heart? | **Behavior is undefined by spec.** The heart appears at line 2 end (`HEART_REVEAL_AFTER_LINE_INDEX = 2`); line 4 (`'Tap the heart when you're ready.'`) plays after the heart is already visible. If line 4's MP3 fails, the gate flips to `relock` AND the heart is already rendered. **Possible failure mode:** Marian can either tap the heart (advances to Math) OR tap the relock surface (retries line 4). **Flag for Kyle to specify** — current implementation gives both surfaces; whichever Marian taps first wins. Probably fine but worth confirming intent. |
| Background / resume mid-relock (iPad PWA) | Trigger a failure on iPad, get to the relock ring, swipe to home, wait 30s, return. | Relock state should persist (it's in-memory React state, no SW involvement). Tap → retry path runs. **DEVICE-only.** |

---

## Console / network sanity

- DevTools Console during a normal Greet flow (no MP3 blocked) must show **zero** errors and zero warnings beyond the React StrictMode double-mount noise. (Same baseline as `qa/greet-regression.md`.)
- DevTools Console during a deliberate MP3 block: ONE expected log line per failure — `[preRecorded] loaderror for "/assets/audio/greet/greet-XX-...mp3"`. No unhandled-promise-rejection. No React error-boundary trigger.
- Network tab during retry: each retry should re-fetch the failed MP3 (Howler re-instantiates). The 3 successful MP3s should NOT be re-fetched (cached). Verify by looking for ≥2 entries for the failed MP3 path with status `(blocked)` and exactly 1 entry each for the others.
- Service worker precache should remain at **37 entries** (PR #29 doesn't add any precached files; the `tests/qa/audioAssetIntegrity.test.ts` is a build-time test, not a runtime asset).

---

## GBUG cross-reference (where this checklist sits in `qa/greet-regression.md`'s GBUG list)

| GBUG | Status after PR #29 |
|---|---|
| GBUG-1 first-utterance silent rejection | Unchanged. Still resolved by the synchronous wake-tap → `playGreetLine('hi')` shape. PR #29 doesn't alter the wake handler's synchronicity. |
| GBUG-2 async-gap audio unlock break | Unchanged. PR #29 doesn't introduce `await` between gesture and play. |
| GBUG-3 caption ribbon empty when audio is rejected | **Improved.** Before PR #29, a `loaderror` left the ribbon mounted with no boundary events. After PR #29, `onLineError` flips the gate to `relock` which hides the ribbon (`shouldShowRibbon` gate condition unchanged) and shows the ring. |
| GBUG-4 WebAudio context not unlocked for SFX | Unchanged. Chime still kicks synchronously inside the wake handler. |
| GBUG-5 audio context relock after long background | Unchanged. PR #29's `reportSpeechError` is symmetric with the existing `pending → relock` path; the cross-screen soft re-gate (Math/Word/Reward) is untouched. |
| ~~GBUG-6~~ voice picker race | OBSOLETE under Plan B (no `getVoices()`). |
| **GBUG-7** | **RESOLVED in PR #29.** Recovery contract wired. Build-time integrity guard prevents corrupt-asset shipping. Debug overlay surfaces failed file. Cancellation race covered by orchestrator-level test. **Headline AC of this checklist.** |
| **GBUG-8** debug overlay `last speak` row dark on Greet | **PARTIALLY RESOLVED.** PR #29's `recordSpeakAttempt(..., 'errored', ...)` populates the row on the error path. **Happy-path playback still leaves the row dark** because `lib/audio/preRecorded.ts` doesn't call `recordSpeakAttempt` on success. Tracked separately. |

When a PR touches `useAudioUnlockGate.ts`, `greetSequence.ts`, `Greet.tsx`, or `preRecorded.ts`, rerun:
- AC rows 1, 2, 3, 4, 7, 8, 11.
- Survival checks: rage-tap on relock ring, multiple distinct lines fail.
- The matching GBUG row above (GBUG-7 / GBUG-8).

---

## Test-needed gaps to log for Kevin / Devon (follow-up tickets)

Captured during checklist authoring; do NOT block PR #29 merge but should be in Matt's queue:

1. **Greet-component unmount-during-failure test** — extends row 7. Mount `<Greet />`, fire wake-tap, then unmount before the line-1 promise rejects. Assert no `onLineError` side effect. Currently relying on the orchestrator-level `cancelled` flag; component-level test would tighten the contract. ~30 minutes.
2. **Heart-tap during line-4 failure spec clarification** — see survival check row 4. Kyle to specify the intended UX when both heart and relock surface are simultaneously interactable. Then a test to enforce.
3. **Happy-path debug overlay `last speak` wiring** — GBUG-8 follow-up. Wire `recordSpeakAttempt` into `preRecorded.ts`'s success path so the overlay isn't dark during normal playback. Out of scope for PR #29 (PR addresses the error path); separate ticket.
4. **Fallback-line spec + impl** — PR #29 explicitly defers ("substituting a fallback line e.g. 'Sorry, I can't talk right now'"). Kyle + Thomas to decide whether silent-retry-loop is the desired UX forever or whether after N retries Melody says something. ~spec ticket then a feature ticket.

---

## Out of scope for this checklist

- Greet's wake-tap synchronicity contract (covered by `qa/greet-regression.md` rows 7, 20, 24).
- Greet's first-utterance retry contract (covered by `qa/greet-regression.md` rows 8, 8b — distinct from GBUG-7's mid-sequence MP3 failure path; the retry contracts share machinery but address different failure modes).
- Path A server-side TTS pipeline (`86c9gr385`, PR #28) — covered by `qa/path-a-server-tts.md`. PR #29 doesn't touch any Path A files.
- Web Speech (`lib/tts/*`) error path — PR #29 explicitly out-of-scope (dead under Plan B, retires fully when Path A lands).
- Final art / sound direction on the relock ring — Kyle's call.
- iPad real-device "tap-twice-fast" timing edge cases — Thomas's pass.
