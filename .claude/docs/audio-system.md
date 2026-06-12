# Audio system

What this doc covers: the runtime audio stack on the browser side — Howler initialisation and gesture-unlock, the three flavours of MP3 source (bundled Greet lines, server-rendered session lines, Hub welcome lines), the iOS `'interrupted'`/`'suspended'` recovery layer, and the per-screen Path A wiring that bridges `/api/claude` to `<Math>`/`<WordSong>`. Server-side TTS rendering is summarised here as a contract; full Vercel/Azure pipeline docs live in `planner-and-canon.md`. Design rationale (the five-round Web Speech investigation that motivated the Howler+MP3 pivot) lives in `MarianLearning/design/audio-architecture.md` and is cited rather than repeated.

## Top-level shape

Audio is "Howler + MP3s, never `speechSynthesis`":

- **Bundled MP3s** — Greet's 4 fixed lines and 18 Hub welcome variants ship in `public/assets/audio/`. Howler plays them as static assets.
- **Per-session MP3s** — Math + Word Song problem audio is rendered by Azure TTS on the server at session-start, base64-embedded in the JSON response, decoded into Blob URLs in the browser, and played by Howler.
- **Howler is the single audio engine.** Web Speech (`speechSynthesis`) was retired in PR #25 after five rounds of iPad first-speak failures (see `MarianLearning/design/audio-architecture.md` for the journey).
- **Voice config** — `en-GB-OliviaNeural`, rate `-10%`, pitch `+0Hz`, volume `+0%`. Swapped from `en-US-EmmaMultilingualNeural` in PR #356 (2026-06-07) after the US voice mangled isolated short-vowel phonemes. Defined server-side in [api/\_session.ts:66](MarianLearning/api/_session.ts#L66) (`EMMA_VOICE_CONFIG`); the browser never sees the config — it consumes already-rendered bytes. Changing it re-renders TWO surfaces — see "Two-surface rule" under §Asset pipeline.

## Howler context lifecycle

[src/lib/audio/howlerContext.ts](MarianLearning/src/lib/audio/howlerContext.ts) is a thick file (~1078 lines) that owns the iOS audio quirks. It exports five fix surfaces, layered Phase-2 → Phase-8 against Thomas's iPad PWA captures (ticket `86c9gvd0y`):

- **`resumeHowlerContextOnGesture()`** ([howlerContext.ts:195](MarianLearning/src/lib/audio/howlerContext.ts#L195)) — synchronous `ctx.resume()` call inside the user-gesture tick. iOS associates the resume with the gesture's task. No-op when ctx is already `running` or unavailable.
- **`awaitHowlerContextResume()`** ([howlerContext.ts:371](MarianLearning/src/lib/audio/howlerContext.ts#L371)) — event-driven wait for `ctx.state === 'running'` with a 5 s fallback timeout. Phase-7 fix: replaced a fixed 500 ms race because real iPad cold-idle resume took 3.6 s. Subscribes to `statechange` and the resume promise.
- **`unlockIosAudioSession()`** ([howlerContext.ts:762](MarianLearning/src/lib/audio/howlerContext.ts#L762)) — plays a 1-sample silent buffer (Phase-5), refills `Howler._html5AudioPool` with fresh `new Audio()` objects up to `Howler.html5PoolSize` (Phase-6), and invokes Howler's private `_unlockAudio()` (Phase-8). All three side effects must happen synchronously inside the gesture window for iOS to re-engage the OS audio session.
- **`disableHowlerAutoSuspend()`** ([howlerContext.ts:1048](MarianLearning/src/lib/audio/howlerContext.ts#L1048)) — Phase-8: writes `Howler.autoSuspend = false` at boot. Suppresses Howler's internal 30 s idle timer that would otherwise flip `Howler.state = 'suspended'` and gate `play()` behind a deferred `'resume'` event that never fires on long-idle iPad PWA.
- **`readHowlerContextRunning()`** ([howlerContext.ts:166](MarianLearning/src/lib/audio/howlerContext.ts#L166)) — pure read. Used by Math/WordSong on cold mount to detect "Greet already unlocked the context" so they fire read-aloud without waiting for a chip tap.

The single re-export surface is [src/lib/audio/index.ts](MarianLearning/src/lib/audio/index.ts) — every screen and helper imports from there.

### Why Howler instead of speechSynthesis

iPad WebKit's `speechSynthesis.speak()` silently drops the first utterance on most cold-PWA loads. Five rounds of investigation (PRs #18 → #24, ticket `86c9gp99a`) confirmed it is not fixable from the app layer. PR #25 swapped Greet to pre-recorded MP3s; PRs #82 → #96 extended that to dynamic Math/WordSong content via Azure Speech REST. The principle is locked: **never call `speechSynthesis.*` from this app.** See `project_audio_architecture.md` memory entry.

## Pre-recorded MP3s — Greet

[src/lib/audio/preRecorded.ts](MarianLearning/src/lib/audio/preRecorded.ts) plays the 4 fixed Greet lines.

- **`GreetLineKey`** taxonomy: `'hi' | 'imEmma' | 'niceToMeet' | 'tapHeart'` ([preRecorded.ts:73](MarianLearning/src/lib/audio/preRecorded.ts#L73)).
- **Asset paths** ([preRecorded.ts:79](MarianLearning/src/lib/audio/preRecorded.ts#L79)):
  - `/assets/audio/greet/greet-01-hi.mp3`
  - `/assets/audio/greet/greet-02-im-emma.mp3` (renamed from `melody` in PR #96)
  - `/assets/audio/greet/greet-03-nice-to-meet-you.mp3`
  - `/assets/audio/greet/greet-04-tap-the-heart.mp3`
- **Word counts per line** ([preRecorded.ts:91](MarianLearning/src/lib/audio/preRecorded.ts#L91)) — used to drive the linear caption-tick timer (`onWordTick(i)`). Pre-recorded MP3s do not fire word-boundary events, so the screen ticks at `audio.duration() / wordCount` intervals from the `onplay` event.
- **Lazy construction.** `new Howl({ src })` triggers an XHR; the module defers construction to the first `loadGreetAudio()` call so Splash mounts before any audio I/O.
- **Cancel semantics.** `cancel()` stops the active line and rejects the in-flight promise with `Error('cancelled')`.
- **Caller responsibility.** `playGreetLine(key)` returns a Promise that rejects on `loaderror`/`playerror`/cancellation. Callers must attach a `.catch` — pre-86c9gr43t silent swallows produced GBUG-7's frozen-Greet behaviour.
- **Phase-4 wiring.** Before `Howl.play()`, the module awaits `awaitHowlerContextResume()` so the buffer source binds against a `running` ctx, not a still-suspended one ([preRecorded.ts:399](MarianLearning/src/lib/audio/preRecorded.ts#L399)).

### Asset pipeline

`scripts/render-greet-mp3s.mjs` and `scripts/render-hub-mp3s.mjs` regenerate the bundled MP3s from the canonical SSML. They read `.env.local` for `AZURE_SPEECH_KEY`/`AZURE_SPEECH_REGION` and call the same Azure REST endpoint the runtime planner uses. Re-render whenever the voice config or line text changes (Phase 3a re-baked all four Greet lines for the Ana → Emma swap, 2026-04-28). Asset budget: ~56 KB total across the four Greet lines.

#### Two-surface rule for voice / prosody changes

Emma's voice has two **independent** render surfaces:

| Surface     | Files                                                                                    | Render tooling                                                                  |
| ----------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Baked canon | 23 JSON files under `public/canon/`                                                      | `scripts/revoiceCanon.ts` (full) / `scripts/revoiceCanonTargeted.ts` (targeted) |
| Static MP3s | 4 Greet + 18 Hub files under `public/assets/audio/greet/` and `public/assets/audio/hub/` | `scripts/render-greet-mp3s.mjs`, `scripts/render-hub-mp3s.mjs`                  |

**Rule: any PR claiming "voice swap complete" must enumerate both surfaces in its ACs and ship both artifact sets.** The `revoiceCanon*` path touches only canon JSON — it silently leaves the static MP3s on the old voice. This bit for real: PR #356's en-GB-OliviaNeural rollout re-voiced baked canon only; voice-QA round-2 (issue #377, 2026-06-11) found all 22 static greet/hub files still on the old voice (HASH-SAME verdicts after PR #373's cache-bust proved live bytes were being ear-tested). Re-render tracked in ticket `86ca7y0gw`.

## Per-session MP3s — sessionAudio

[src/lib/audio/sessionAudio.ts](MarianLearning/src/lib/audio/sessionAudio.ts) plays Claude-generated lines (Math problem reads, Word Song reads, hint/correct/reprompt/giveAnswer slots, all 19 Session-End utterances).

Lifecycle:

1. `loadSessionAudio(sessionId, utterances)` — decodes each `Utterance.audio.base64` into a Blob, builds a Blob URL, constructs one Howl per utterance with `{ src: [blobUrl], format: ['mp3'] }`. The `format: ['mp3']` hint is required because Howler can't infer extension from `blob:` URIs.
2. `playSessionUtterance(utteranceId)` — looks up the cached Howl, dispatches `play()`, drives caption ticks.
3. `unloadSessionAudio()` / `clearSessionAudio(sessionId)` — tear down Howls + revoke Blob URLs.

### IndexedDB cache

- Database name: `marian-tutor-session-audio` ([sessionAudio.ts:171](MarianLearning/src/lib/audio/sessionAudio.ts#L171)).
- Store name: `session-audio-v${CACHE_VERSION}` where `CACHE_VERSION = 3` ([sessionAudio.ts:169](MarianLearning/src/lib/audio/sessionAudio.ts#L169)).
- Cache invalidation: bump `CACHE_VERSION` whenever the server-side TTS rendering shape changes. The integer doubles as the IndexedDB schema version, so `onupgradeneeded` fires and drops every prior store. Version history:
  - v1 — pre-PR-#82 (plain text → AnaNeural).
  - v2 — post-PR-#82 (digit-by-digit SSML for two-digit numbers, AnaNeural).
  - v3 — post-Phase-3a (Ana → Emma multilingual swap, 2026-04-28).
- Cache key is `sessionId` only — does NOT fingerprint SSML/voice/prosody. Use the version bump for invalidation.
- Soft-fail to in-memory only on `QuotaExceededError` or any IndexedDB op failure.

### Watchdog instrumentation

`ONPLAY_WATCHDOG_MS = 800` ([sessionAudio.ts:77](MarianLearning/src/lib/audio/sessionAudio.ts#L77)) — pure diagnostic. If Howler's `'play'` event hasn't fired 800 ms after `howl.play()`, the module records an `'onplay-watchdog-missed'` row in the audio-context probe log. Does not abort or retry — the row pairs with a `'howl-play-call'` row by `utteranceId` so iPad QA exports localise "play() returned a sound id but no audio emitted" cases.

## Pending-resume gate

[src/lib/audio/pendingResumeGate.ts](MarianLearning/src/lib/audio/pendingResumeGate.ts) is the iOS visibility-recovery layer (PR #137, ticket `86c9kxtmu`).

The problem: when iPad PWA returns from background with `ctx.state === 'interrupted'` or `'suspended'`, calling `ctx.resume()` from a `visibilitychange` handler does NOT actually re-engage the OS audio session — the system event isn't a real user gesture. Howler returns sound ids, no audio emits, and the queued buffer fires into whatever screen is mounted when the user finally taps (cross-screen leak).

Three-state machine ([pendingResumeGate.ts:99](MarianLearning/src/lib/audio/pendingResumeGate.ts#L99)):

- `'idle'` — normal; audio dispatches play immediately.
- `'pending'` — visibility-recovery edge fired; affordance mounted; audio dispatches enqueue instead of play.
- `'awaiting-tap'` — 3 s fallback timer fired without a gesture; pure diagnostic signal in the audioCtxLog.

Public API ([pendingResumeGate.ts:286](MarianLearning/src/lib/audio/pendingResumeGate.ts#L286)):

- `markPendingResume()` — called by `useHowlerSuspendOnHide` on the `visible` edge when ctx is suspended/interrupted.
- `isPendingResume()` — read by `playSessionUtterance` and `playHubLine` before dispatching.
- `enqueueOnResume({ label, run })` — most-recent-only queue (size 1). Stale enqueues are discarded so Marian hears her current screen, not a stack of every backgrounded line.
- `drainOnGesture(resumeFn, unlockFn)` — called from chip-tap / hub-node-tap / wake-tap handlers. Order: `resume → unlock → run queued handler → clear gate`. Idle-gate fast path is a no-op (the chip-tap's normal Phase-2/5 pipeline already handles non-recovery gestures).
- `subscribePendingResumeGate(cb)` — App.tsx subscribes to render the "tap to continue" affordance.

The gate does NOT register tap listeners itself — screens own their tap surfaces and call `drainOnGesture()` from their own handlers. A window-level listener would race React's event delegation and break the gesture-context association on iOS.

See `project_ios_interrupted_audio_recovery.md` memory entry for the data trail.

## Audio unlock gate (per-screen first-utterance retry)

[src/lib/audio/useAudioUnlockGate.ts](MarianLearning/src/lib/audio/useAudioUnlockGate.ts) is a per-screen React hook that handles the first-utterance miss and cross-screen soft re-gate cases.

State machine: `idle` → `pending` → (`unlocked` | `relock`).

- **5 000 ms watchdog** ([useAudioUnlockGate.ts:169](MarianLearning/src/lib/audio/useAudioUnlockGate.ts#L169)) — the first-utterance retry contract. Bumped from 2 s in round 5 (`86c9gp99a`) after Thomas iPad QA showed first-speech routinely takes 3–5 s on cold-cache PWA loads.
- **250 ms watchdog** — passed by callers handling cross-screen soft re-gate (audio context has been silently suspended after >5 min background).
- `wrapSpeak(runSpeak)` — synchronous wrapper: arms watchdog, sets state to `pending`, runs the caller's speak in the same tick.
- `reportSpeechStart()` — wired into TTS `onstart`; clears the watchdog and transitions to `unlocked`.
- `reportSpeechError()` — wired into Howler `loaderror`/`playerror`; transitions to `relock` regardless of current state.
- `registerRetry(cb)` + `dispatchGesture()` — components register a synchronous retry callback; the next user tap while `state === 'relock'` invokes it inside the same JS tick (preserving gesture-context association on iOS).
- `showGate: state === 'relock'` — convenience for components that render the wake-tap ring.

The hook does NOT own the wake-state visuals or the speak call itself. Each screen mount gets its own gate so cross-screen state never bleeds.

## Path A — Math and Word Song wiring

The "Path A" modules bridge `/api/claude` (kind=`session-start`, track-based payload) → `sessionAudio.ts` → the screen's `playUtterance` prop.

### Math

[src/lib/audio/mathPathA.ts](MarianLearning/src/lib/audio/mathPathA.ts):

1. App.tsx calls `prepareMathPathA({ level, childName, sessionId, focusNode?, recentSuccessRate? })`.
2. POSTs `{ kind: 'session-start', payload: { track: 'math', level, childName, progress? } }` to `/api/claude`.
3. Server returns a `SessionStartResponse` with the rebuilt plan + inline base64 MP3s.
4. Module rehydrates a `MathSessionPlan` via `mathSessionPlanFromServer` (parses addends out of the `read` text), registers Howls keyed by utterance id, builds a text → first-matching-id lookup.
5. Returns `{ plan, playUtterance, textToId, utteranceCount, unload }`.

The `playUtterance` is text-keyed — the screen passes `"Three plus two. How many?"` and the module dispatches the matching Howl by id. Duplicate text (e.g. `"Hmm... try again?"` rendered 8 times for cache locality) resolves to the first matching id; all 8 are byte-identical.

Diagnostic tag: `(playUtterance as any).__playerKind = 'real'` ([mathPathA.ts:358](MarianLearning/src/lib/audio/mathPathA.ts#L358)) — read by `lib/debug/playerKind.ts` to attribute audioCtxLog rows.

Error codes ([mathPathA.ts:157](MarianLearning/src/lib/audio/mathPathA.ts#L157)): `config-missing | tts-failed | rate-limited | planner-failed | invalid-response | network-error | aborted`. Caller falls back to a static plan + silent default `playUtterance` on any failure.

### Word Song

[src/lib/audio/wordSongPathA.ts](MarianLearning/src/lib/audio/wordSongPathA.ts) — near-clone of `mathPathA.ts` with one addition: `isGraduationSession` flag (ticket `86c9m3aec`). When set AND server-side focus is `cvc-words`, the planner mixes 2–3 novel short-a probe words into the 8-problem set.

Same shape, same contract, same fallback behaviour. The duplication is intentional — the modules don't share state, screens don't share an audio bundle session-side.

## Hub welcome lines

[src/screens/Hub/playHubLine.ts](MarianLearning/src/screens/Hub/playHubLine.ts) plays the welcome-back greeting Marian hears on Hub mount.

Why this exists separately from the screen: `Hub.tsx` ships a `playLineFn` prop that defaults to a silent caption-walk (165 wpm). That was correct while the bundled MP3s were pending; once Kyle's manifest landed in PR #133, the Hub still ran on the silent fallback because no production caller wired `playLineFn`. This module is the missing default that App.tsx wires in (see `project_hub_audio_wiring.md` memory entry).

Key behaviours:

- **Lazy Howl construction per `HubLineId`.** Cache lives for the app session.
- **Soft-fail to caption-walk.** On `loaderror`/`playerror`/Howler-unavailable, falls back to a silent 165 wpm tick that resolves the same way the loaded path does. Screen never bricks.
- **Pending-resume gate consultation** ([playHubLine.ts:259](MarianLearning/src/screens/Hub/playHubLine.ts#L259)) — when `isPendingResume()`, enqueues the play instead of dispatching. The drain re-enters via `playRunImmediate`.
- **`cancelActive()`** ([playHubLine.ts:425](MarianLearning/src/screens/Hub/playHubLine.ts#L425)) — stops the most-recently-started Hub utterance synchronously. Wired in PR #144 (ticket `86c9m4afh`) after Thomas's iPad ear-test confirmed Hub lines were leaking past the route flip into Math/WordSong's read-aloud. The old `cancelledRef` only short-circuited caption ticks; it never told Howler to stop.

The Phase-2/4/5 audio-context-resume helpers from `preRecorded.ts` are intentionally NOT replicated here — Hub mounts after multiple gestures (Splash → Greet → Math/WordSong → SessionEnd → Hub), so the context has been running for minutes by the time a welcome line plays. If Hub is the first screen the user lands on (`path === 'app-open'`), `Hub.tsx`'s own `gestureUnlocked` flag gates the first play behind a pointerdown.

### Hub asset manifest

`public/assets/audio/hub/` (18 MP3s):

- 3 base lines × 3 alts: `hub-welcome-what-today*`, `hub-welcome-try-number-garden*`, `hub-welcome-try-word-song*`, `hub-welcome-back-soon*`
- Single-shot lines: `hub-welcome-pick-again`, `hub-welcome-pick-next`, `hub-welcome-first-again`, `hub-enter-number-garden`, `hub-enter-word-song`

The id ↔ src mapping lives in `src/screens/Hub/hubLines.ts` (`HUB_LINES`, `HUB_LINE_WORD_COUNTS`).

## SFX

[src/lib/sfx/sfx.ts](MarianLearning/src/lib/sfx/sfx.ts) — defensive Howler wrapper for short sound effects.

Catalog in `public/assets/`:

- `sfx-cheer.mp3` — correct-answer celebration
- `sfx-chime-soft.mp3` — gentle ack (still pending Thomas's audio sourcing per `assets-todo.md`)
- `sfx-plink.mp3` — small ack
- `sfx-poof.mp3` — distractor dismissal
- `sfx-sparkle.mp3` — stardust earned

`createSfx({ src, volume?, HowlCtor? })` returns `{ play, unload, missedPlays, loadFailed }`. Soft-fails on missing assets — `play()` becomes a no-op that increments `missedPlays`, and a single `console.warn` per asset points at `assets-todo.md`. Used by Math's chip-tap success, Word Song's chip-tap success, the stardust shimmer, Session End celebration, etc.

## iOS audio quirks (running list)

- **Gesture unlock required.** First Howler `play()` per app session must land inside a synchronous user-gesture handler tick. Howler's lazy-init creates `Howler.ctx` in `'suspended'` state on Splash → Greet auto-advance (no gesture); the gate stays suspended until the heart tap.
- **Aggressive auto-suspend after >5 min background.** PWA's `Howler.ctx` flips to `'suspended'`; the OS audio session is independently released after ~60 s of silence regardless of `ctx.state`.
- **`'interrupted'` state on visibility return.** iOS-specific; treated identically to `'suspended'` by the recovery helpers.
- **Phone calls / Siri preempt the audio session.** Same recovery path.
- **First-speak unreliability.** iPad WebKit silently drops the first `speechSynthesis.speak()` — historical, but the reason the entire architecture is Howler+MP3.
- **Howler's `_audioUnlocked` flag is sticky.** Once true, Howler never re-runs its own unlock loop. Phase-5/6/8 helpers replicate the load-bearing side effects manually inside our gesture handlers.

## Cross-references

- `MarianLearning/design/audio-architecture.md` — full design rationale + 5-round Web Speech investigation
- `MarianLearning/design/screen-3-math.md` §"Audio integration contract" — Path A wire shape
- `MarianLearning/design/screen-4-word-song.md` §"Audio integration contract" — Path A wire shape
- `MarianLearning/design/session-1.md` — first-session contract and iPad audio constraint
- `planner-and-canon.md` — server-side TTS pipeline (Azure REST, SSML construction, prebuilt canon)
- `project_audio_architecture.md` memory — Howler + MP3 + server TTS decision
- `project_tts_provider_decision.md` memory — Azure Speech REST locked 2026-04-26; Emma multilingual locked 2026-04-28
- `project_audio_phoneme_overrides.md` memory — SSML `<phoneme alphabet="ipa">` for "four"
- `project_ios_interrupted_audio_recovery.md` memory — visibility + first-gesture recovery contract
- `project_hub_audio_wiring.md` memory — playHubLine canonical module
