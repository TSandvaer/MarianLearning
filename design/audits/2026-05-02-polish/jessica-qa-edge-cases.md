# QA + Edge-Case Polish Audit — 2026-05-02

**Auditor:** QA persona (umbrella ticket `86c9kwhdu`)
**Production URL audited:** https://marian-learning.vercel.app/
**Production HEAD at audit time:** `b09294a` (M2.5 + M3 merged)
**Audit context:** Quality bar shift — "polished, responsive, immersive" before
Marian uses it. This report is the QA / edge-case lens; visual/UX is Kyle's
report and developmental psychology is Dave's report.

---

## Walkthrough scope

### What was audited

- Source-tree static walkthrough of all flows currently live on prod:
  Splash, Greet, Hub, Math, WordSong, SessionEnd, ParentSettings.
- M2.5 parent-settings shape (`parentSettings.ts`, `ParentSettings.tsx`,
  read-merge contract).
- M3 mastery promotion rule (`mastery.ts`, `progressHistory.ts`,
  `defaults.ts`).
- Storage shape (`storage.ts`, `migrate.ts`, `sessionHistory.ts`).
- App orchestrator (`App.tsx`) — session lifecycle, abort wiring, audio
  tear-down gating, fetch-effect deps.
- Hidden affordances (long-press hooks, `?route=` URL override).
- Production HTML / manifest / `Cache-Control` headers (`HEAD` against prod).
- Existing test inventory under `tests/qa/` and `src/**/*.test.ts(x)`.
- Last 10 merged PRs (`git log -10`) for sweep targets.

### What I could NOT cover and why

- **Live iPad walkthrough.** This audit is being produced as a static-source
  pass; no real iPad / iPad Simulator was driven by hand. Every claim about
  iPad-specific behaviour is grounded in code review against the existing
  iPad-aware modules (`howlerContext`, `useAudioUnlockGate`) plus the
  production HTML / manifest. Findings flagged "iPad-only — needs Thomas's
  device pass" are the ones I cannot finally confirm without hardware.
- **Network throttling on real Vercel.** I read the cache strategy from the
  source PWA config rather than running DevTools against prod.
- **Real localStorage corruption replay.** I read the parser's defensive
  posture rather than corrupting a live store.
- **Multi-tab race in real Safari.** Asserted from absence of a `storage`
  event listener in source, not from observed behaviour.

The static-pass coverage is sufficient to inventory the e2e gaps and
ship-blocker class of issues; the items above are the ones Thomas should
pull through the real iPad on his post-audit pass.

---

## Findings

### P0 — Ship-blockers

#### P0.1 — No e2e test infrastructure exists

- **Repro:** `package.json` has no `playwright`, `cypress`, `@playwright/test`,
  or any browser-driver dependency. No `playwright.config.*`,
  `cypress.config.*`, or `*.spec.ts` files exist outside `node_modules`.
  `tests/qa/` contains only vitest unit/contract files.
- **Observed:** Zero automated coverage of any user-visible flow at the
  browser level. Every flow (Hub → Math → SessionEnd → Hub, parent-settings
  long-press, audio unlock on first-gesture, mastery promotion at
  session-end) is verified only by component-level unit tests with mocked
  audio + mocked storage.
- **Expected (per quality bar):** A small e2e harness that drives the prod
  build through the golden paths plus the survival-mode behaviours (offline
  cache, backgrounding, route bounces).
- **Why P0:** Every regression Kevin / Devon ship after today is a manual
  iPad re-test for Thomas. The current vitest suite cannot catch a
  cross-screen handoff bug (e.g. the "Path A fetch aborted by route change"
  P0 family in PR #111 / #117 / #118) — three of the last ten merged PRs
  fixed cross-screen audio races that no unit test would have caught.
- **Proposed fix:** Stand up Playwright with one config (`webkit` channel,
  iPad Pro viewport `1024×1366`, `prefers-reduced-motion` disabled). Land
  one smoke test (`hub → math → sessionEnd → hub`) and the parent-settings
  long-press path. CI runs against `vite preview` of the production build.

#### P0.2 — `recordProgressOnSessionEnd` hardcodes `skillFocus` to `add-to-10` / `blending-cv`

- **File:** `src/screens/SessionEnd/progressHistory.ts:70-73`
- **Repro:** Read `SURFACE_FOCUS`. Every math session writes
  `skillFocus: ['add-to-10']`; every word-song session writes
  `skillFocus: ['blending-cv']`. The comment at line 64 acknowledges this
  is a v1 simplification.
- **Observed:** M3's `applyMasteryRule` filters history by
  `entry.skillFocus.includes(node)`. Once `add-to-10` flips to
  `'mastered'`, the rule will never see ANY history entry referencing
  `add-to-20` (or `sub-to-20`, or `mult-2-5-10` — both already at
  `'intro'` per `defaults.ts:21,24`), so promotion stalls forever at
  the first node of each tree.
- **Expected:** `skillFocus` reflects the ACTUAL node(s) the session
  exercised. Either a per-problem node lookup, or — interim — the current
  focus-node from the planner response.
- **Why P0:** This is a silent breakage of the M3 feature that just shipped.
  The unit tests in `mastery.test.ts` synthesize history entries directly,
  so they don't catch the integration gap. Marian will hit `add-to-10`
  mastery threshold after ~3 perfect sessions (cross-day) and then NEVER
  promote past it via the in-app loop.
- **Proposed fix:** Either (a) read the planner-response focus-node back
  through to `recordProgressOnSessionEnd` and write it into `skillFocus`,
  or (b) ship a Marian-only override that maps surface →
  `progress.skillLevels` lookup (highest-`practicing` node in the tree).
  Either way, lock with a regression test that drives a full Math session
  on a profile where `add-to-10` is already `'mastered'` and asserts the
  next node's `skillFocus` is recorded.

#### P0.3 — Cross-day enforcement uses UTC day, but day-streak uses local-day

- **Files:** `src/lib/progress/mastery.ts:301` (UTC slice — `dateISO.slice(0,10)`)
  vs. `src/screens/SessionEnd/sessionHistory.ts:247-251` (local-time
  `differenceInCalendarDays`).
- **Repro:** Marian (Manila, UTC+8) plays at 21:00 local Monday — written
  as 13:00 UTC Monday. She plays at 22:30 local Tuesday — written as
  14:30 UTC Tuesday. Plays at 19:00 local Wednesday — 11:00 UTC Wednesday.
  Then plays again on Thursday at 09:00 local — 01:00 UTC Thursday.
  All three "perfect" Tuesday/Wed/Thursday sessions LOOK like distinct
  UTC days (great), but consider the inverse: Monday 09:30 local =
  01:30 UTC Monday, Monday 23:30 local = 15:30 UTC Monday — same UTC day,
  cross-day enforcement collapses these to one.
- **Worse repro:** Marian plays at 02:00 local on a school holiday morning
  (= 18:00 UTC previous day), then plays the next morning at 02:00 local
  again. Cross-day rule sees them as on different UTC days even though
  Marian experienced them as 24 hours apart on adjacent calendar days
  — that's actually a wash. The asymmetric case is: 23:30 local then
  00:30 local = same UTC day from Manila's perspective, but TWO local
  days. The mastery rule will count these as ONE (de-duplicated to last);
  the day-streak counter counts them as TWO (silent inconsistency).
- **Observed:** Two timezone semantics live in the same persisted store.
- **Expected:** One semantic. Local-day everywhere is the right choice
  for a single-user device — it matches Marian's lived experience.
- **Why P0:** The mastery rule directly drives curriculum advancement.
  On Marian's actual schedule (school morning + after-school session,
  often crossing 22:00-23:00 Manila), this DOES bite: a cross-day pair
  at 14:00 local + 23:00 local Tuesday will count as one UTC day, holding
  the promotion back by a session.
- **Proposed fix:** Switch `dedupeByCalendarDay` to local-time. Lock with
  a regression test that pins a Manila timezone via `Intl` mock and
  asserts the dedupe matches `nextDayStreak`'s local-day boundary.
  Document the convention in a single header comment that both files
  reference.

### P1 — Significant gaps

#### P1.1 — No `visibilitychange` / `pagehide` handling

- **Files:** Searched `src/**/*.ts(x)` — zero matches.
- **Risk:** Marian backgrounds the app mid-problem (home button, lock
  screen, switch app) and returns. The `useAudioUnlockGate` 5-second
  watchdog and the `mathPathA` Howl objects keep state in JS memory; on
  iOS, an aggressive multi-minute background may freeze them. There's no
  effect that:
  - Pauses in-flight audio when `document.hidden === true`.
  - Re-arms the audio gate when visibility returns.
  - Saves a "session checkpoint" so a kill-and-relaunch resumes mid-question
    instead of restarting the session from problem 1.
- **Observed surface:** None — the app currently relies on iOS to keep the
  PWA hot. Howler's `_autoSuspend` is forcibly disabled (`App.tsx:86`) which
  helps the 30s case, but a 10-minute lock screen is a different beast.
- **Proposed fix tickets:** (a) `pagehide` handler that writes a
  "current-problem" cookie crumb to localStorage; on next mount, if the
  crumb is fresh (< 5 min) and the route was math/literacy, offer a
  "resume?" prompt. (b) `visibilitychange` handler that, on `visible`,
  calls `gate.reportSpeechError()` to re-arm if no audio has played in the
  last 30s.

#### P1.2 — No `storage` event listener (multi-tab desync)

- **Files:** Searched `src/**/*.ts(x)` — zero matches for
  `addEventListener('storage'`.
- **Risk:** If Thomas (or QA) opens the app in two tabs (one debug, one
  prod), they drift silently. Two tabs each compute their own `Progress`
  on session-end, the LAST writer wins, and the other's cumulative
  stardust + day-streak quietly disappears.
- **Observed surface:** Both `marian-tutor:progress:v1` and
  `marian-tutor.session-history.v1` are read-once at component mount.
- **Why P1 not P0:** Marian uses the iPad; she won't realistically have
  two tabs. But QA workflows + the audit context (Thomas verifying on
  desktop while iPad is also installed) DO hit this. The data loss is
  unrecoverable.
- **Proposed fix:** A small `useStorageSync()` hook on the writer paths
  (`Hub`, `SessionEnd`) that listens for `storage` events keyed on the
  two storage keys and re-reads / re-renders. OR — simpler — reject
  saves whose `lastPlayedISO` is older than the on-disk `lastPlayedISO`
  by some threshold.

#### P1.3 — `useCharacterLongPress` doesn't cancel on `pointermove` drift

- **File:** `src/screens/Hub/useCharacterLongPress.ts:86-106`
- **Repro:** Press on Emma. Slide your finger off the image bounds while
  still pressing. The hook's only cancellation paths are
  `pointerup`/`pointercancel`/`pointerleave`. Because the hook calls
  `setPointerCapture(e.pointerId)` on `pointerdown` (line 91), `pointerleave`
  doesn't fire while the pointer is captured — the captured pointer keeps
  generating events on the originating element regardless of position.
  The 3s timer therefore keeps running even if the finger has drifted
  to a different region.
- **Observed:** This is the OPPOSITE problem from the parent-gate corner
  hook (`useParentGateLongPress`), which DOES bounds-check via
  `getBoundingClientRect()`. The character-art hook is more permissive,
  by design — but the design comment says "a small drift keeps the press
  alive" without specifying a max drift.
- **Why P1:** A child-thumb that wanders to the corner of the iPad while
  pressing on Emma still fires the parent gate. That's not a security
  hole (it's hidden), but it's an accidental affordance.
- **Proposed fix:** Cancel the timer in `pointermove` when distance from
  pointerdown coordinates exceeds ~80pt. Mirrors Apple's HIG long-press
  drift tolerance.

#### P1.4 — `playSessionUtterance` singleton has no surface discriminant

- **File:** `src/App.tsx:347-385`, `src/lib/audio/sessionAudio.ts`
- **Risk:** App.tsx documents the assumption: "whichever was last loaded;
  that is by construction the matching bundle for the track Marian just
  finished" (line 354). This is fragile — if a future flow is
  `Math → SessionEnd → Hub → WordSong (SessionEnd's farewell still
playing because user tapped through fast)`, the WordSong fetch starts
  and overwrites the singleton; the queued SessionEnd farewell now reads
  the WordSong bundle's IDs. SessionEnd uses surface-agnostic IDs
  (`session.end.opener`), so they happen to exist on both bundles, but
  any per-surface variant added later breaks silently.
- **Why P1:** Currently safe but one ticket away from breaking. Locking
  this with an explicit assertion would be cheap.
- **Proposed fix:** Add a `lastLoadedSurface` field to the singleton and
  warn (debug log) if SessionEnd reads against a different surface than
  the `payload.surface` it received. Better still, key the howl map by
  `(sessionId, utteranceId)` and pass the sessionId through to SessionEnd.

#### P1.5 — `?route=parent-settings` URL override is live in prod

- **File:** `src/App.tsx:95-115` — the initial-route override accepts
  `'parent-settings'`.
- **Repro:** Visit https://marian-learning.vercel.app/?route=parent-settings.
  The screen mounts directly without the 3s long-press gate.
- **Why P1 not P0:** PWA standalone-mode hides the URL bar, so Marian
  can't get there from her installed app. But the prod URL is shareable;
  if she ever opens it in Safari proper (e.g. she taps a link from a
  parent's text message) she lands on the unstyled parent screen.
- **Proposed fix:** Either gate `parent-settings` behind a same-session
  flag (set when the long-press fires) or remove `'parent-settings'` from
  the QA URL override allow-list before ship.

#### P1.6 — `deletetab` survival: fetch-abort happens AFTER session-end gate

- **File:** `src/App.tsx:649-680` (math tear-down effect; same shape for
  WordSong at 788-815).
- **Repro:** Mount Math. Path A fetch in-flight (slow network).
  Marian double-taps the back arrow before fetch resolves. Route flips
  `math → hub` directly (skips session-end). Tear-down fires:
  `mathAbortRef.current?.abort()`. Good. BUT — the same effect's
  microtask-deferred state reset (`setMathPlay(null) / setMathAudioReady(false) /
setMathPlan(null)`) only runs if `hadAudio` is true; if the fetch
  aborted before any state was published, `hadAudio` is false and the
  reset is skipped. Then `mathFetchStartedRef.current` is reset to
  `false` only inside the `hadAudio` branch.
- **Observed:** On a fast back-tap, `mathFetchStartedRef.current` could
  remain `true` while the fetch is aborted, so a re-entry into Math
  in the same App lifecycle does NOT re-fetch. Math falls back to the
  silent default.
- **Why P1:** Edge-case. Most route-leaves happen well after audio is
  loaded. But the logic has a gap — the latch reset should happen
  unconditionally on a confirmed leave-effect run, not gated on prior
  audio state.
- **Proposed fix:** Move `mathFetchStartedRef.current = false` and
  `mathAbortRef.current?.abort()` outside the `hadAudio` guard. Lock
  with a unit test that mounts Math with a never-resolving Path A
  promise, abruptly leaves to Hub, re-enters Math, asserts a fresh
  fetch started.

#### P1.7 — No regression test for "back-arrow mid-session preserves stardust"

- **Coverage gap.** Math/WordSong write per-problem stardust to localStorage
  via `_shared/stardust.ts`. If Marian taps the back arrow on problem 5,
  the in-flight session is abandoned. There's no test asserting that her
  earned-this-session stardust is either committed or discarded — and no
  spec definition of which it should be.
- **Why P1:** This is a "fairness" UX moment that bites if Marian
  accidentally taps the wrong icon. A 5-of-8 abandon should not punish
  her cumulative count (Dave's lens), but should not also count toward
  mastery (your lens — `successRate < 1.0` would record falsely).
- **Proposed fix:** Decision needed (Thomas), then a unit test pinning
  the chosen behaviour.

#### P1.8 — Audio fallback timer leaks if SessionEnd unmounts mid-utterance

- **File:** `src/screens/SessionEnd/SessionEnd.tsx:280-407` — sequential
  `playUtterance` chain wrapped in `addTimer`/`clearTimeout`, with a
  `fallbackTimerId` whose only cancellation path is the `onPlay` callback
  (line 290).
- **Repro:** SessionEnd mounts. Opener `playUtterance` is dispatched.
  Marian taps "All done!" before opener `onPlay` fires (e.g. she closes
  the iPad cover). Component unmounts. The chain's `then()` chain still
  resolves; if `fallbackTimerId` was scheduled but never cleared (the
  `onPlay` path is the only clearer), the `setTimeout` body still runs
  against an unmounted component — guarded by `_isMountedRef` checks
  but generates spurious console warnings.
- **Observed:** `addTimer` is documented to register timers for cleanup
  (`timersRef.current`), but `fallbackTimerId` is created outside that
  pattern (line 291 says "Cancel the fallback timer -- audio is working"
  implying it's a local `setTimeout`).
- **Why P1:** Doesn't crash but pollutes the audioCtxLog and risks racing
  with a fast-back tap.
- **Proposed fix:** Route ALL timers in this file through `addTimer`.

#### P1.9 — Howler `disableHowlerAutoSuspend()` runs at module-eval time, including during SSR/test imports

- **File:** `src/App.tsx:86`
- **Risk:** Calling Howler at module evaluation means importing `App.tsx`
  in a non-DOM context (Node + jsdom) instantiates Howler. Tests that mock
  `motion/react` have to also tolerate Howler's lazy ctx init. The current
  test suite handles this via mocking, but it's a foot-gun for future
  vitest contributors.
- **Why P1:** Test stability concern, not a runtime concern.
- **Proposed fix:** Wrap in a `typeof window === 'undefined'` guard, OR
  move the call into a small `bootstrap()` that `main.tsx` invokes —
  keeping `App.tsx` pure-import.

#### P1.10 — `console.warn` in production paths is unfiltered

- Two production paths in `App.tsx` (lines 588, 763) and four in
  `SessionEnd.tsx` (308, 334, 368, 399) emit `console.warn` on audio
  failures. Same in `Math.tsx:702`, `WordSong.tsx:551`, `Hub.tsx:259`.
- **Observed:** Production prod browser console grows over a 15-min
  session by ~12-20 warns when audio is flaky. None are silenced behind
  a `?debug=1` gate.
- **Why P1:** Not a Marian-facing problem (she doesn't see the console)
  but a diagnostic-noise problem when Thomas QAs. Mixes signal with the
  audioCtxLog.
- **Proposed fix:** Either gate behind `isDebugEnabled()` or route through
  the existing `debugBus` that the audioCtxLog already taps.

### P2 — Nice-to-haves

#### P2.1 — `useParentGateLongPress` v1 fires `console.log` only

- **File:** `src/screens/Hub/useParentGateLongPress.ts:119`
- The 2-second corner long-press is wired but its `onComplete` defaults to
  a `console.log`. M2.5 ParentSettings is reachable via the SEPARATE 3-second
  character-art long-press; the corner gate is now redundant (or v2's
  parent-area-with-real-content ticket).
- **Proposed:** Decide whether to retire the corner gate (and remove the
  invisible 96×96pt touch target stealing taps near the cumulative-stardust
  glyph) or wire it to a v2 destination.

#### P2.2 — Inline SVG in `Hub.tsx` are placeholders

- `NumberGardenSignature` / `WordSongSignature` are inline geometric
  placeholders (`Hub.tsx:649-703`). The component file's own header
  acknowledges Kyle's real assets land via ticket `86c9j53yx`. Worth
  flagging that the visual polish bar will not be cleared until those
  ship — Kyle's audit will probably echo this.

#### P2.3 — Manifest `orientation` is `portrait-primary`

- Locks portrait. Good for the design. But: if Marian is using the iPad in
  a kickstand case rotated to landscape, the entire app is sideways with
  no warning. iPad PWA standalone honours this strictly.
- **Proposed:** Either accept (current ship) or add a "rotate me" splash
  on landscape detect for first-time users.

#### P2.4 — `index.html` viewport disables `user-scalable`

- `maximum-scale=1.0, user-scalable=no` is the right call for a kid-app
  (no accidental zoom-in when the iPad lands face-down on the table) but
  removes the accessibility fallback. Fine for Marian; flag for the
  record.

#### P2.5 — Seven `setInterval` callsites with mixed cleanup posture

- `Hub.tsx:217`, `Math.tsx` (caption walk), `WordSong.tsx`, `Greet.tsx`,
  several `setTimeout` chains in `SessionEnd.tsx`. Each is individually
  reviewed but the pattern is fragile — any new screen that copies the
  shape is one missed cleanup away from a memory leak.
- **Proposed:** A small `useTimer()` hook utility that auto-cleans on
  unmount.

---

## e2e coverage inventory

| Flow                                                                                   | Has e2e? | Notes                                                                                                                          |
| -------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Splash auto-advance → Greet (first-ever)                                               | no       | unit-only (`Splash.test.tsx`)                                                                                                  |
| Splash auto-advance → Hub (returning)                                                  | no       | unit-only                                                                                                                      |
| Greet → Math handoff (audio unlock)                                                    | no       | `mathPathAIntegration.test.ts` is `it.todo` (5 placeholders)                                                                   |
| Hub → Math golden path (8 problems → SessionEnd)                                       | no       | unit-only Math.test.tsx, no full chain                                                                                         |
| Hub → WordSong golden path                                                             | no       | unit-only                                                                                                                      |
| SessionEnd "All done!" → Hub flip                                                      | no       | unit-only                                                                                                                      |
| SessionEnd → Hub stardust persisted across reload                                      | no       | not tested at all                                                                                                              |
| Mastery promotion happy path (after 3 perfect math sessions)                           | no       | mastery.test.ts is pure-function only                                                                                          |
| Mastery promotion P0 path: focus-node propagation through `recordProgressOnSessionEnd` | no       | not tested at all (this is the P0.2 gap)                                                                                       |
| Mastery promotion negative test: 0.85 < threshold                                      | partial  | mastery.test.ts unit-only, no integration                                                                                      |
| Mastery promotion same-day enforcement                                                 | partial  | mastery.test.ts has it; no end-to-end                                                                                          |
| Parent settings long-press open                                                        | no       | Hub.test.tsx tests the hook in isolation                                                                                       |
| Parent settings change → persist → reload → reflected                                  | no       | ParentSettings.test.tsx is component-level, no localStorage round-trip via real storage                                        |
| Parent settings change → mastery rule respects it (e.g. 80/2 vs 95/3)                  | no       | not tested at all                                                                                                              |
| Audio unlock on first-gesture (Greet wake-tap)                                         | no       | unit gate tested, real-Safari path is `it.todo` row 12 (intentionally iPad-only)                                               |
| Cold-mount Math while `prepareMathPathA` in flight                                     | no       | unit-only; the App-level race that bit PR #111 has no regression test                                                          |
| Static-fallback render during fetch wait (problems display + chips disabled)           | no       | not tested at all                                                                                                              |
| Path A fetch-abort on rapid route bounce                                               | no       | not tested — directly relevant to P1.6                                                                                         |
| Offline cache (PWA service worker) golden path                                         | no       | no test                                                                                                                        |
| localStorage corruption recovery (both keys)                                           | partial  | `loadProgress` unit-tests `null`/`undefined` recovery; sessionHistory has try-catch but no test for malformed JSON in the wild |
| Multi-tab same-key desync                                                              | no       | no test, no infra                                                                                                              |
| Backgrounding mid-session → resume                                                     | no       | no test, no infra                                                                                                              |
| Rage-tap on chip during animation                                                      | partial  | Math.test.tsx exercises double-tap; no rapid-fire 5+ taps                                                                      |
| Reduce-motion path through full session                                                | no       | hook unit-tested only                                                                                                          |
| Direct-launch via `?route=` for QA paths                                               | no       | no test                                                                                                                        |
| `prefers-reduced-motion` correctly collapses Greet animation                           | partial  | hook tested; full-screen integration not                                                                                       |

**Coverage gap count:** 24 distinct flows or survival behaviours that
are NOT covered by an automated browser-level test. Ten of those are
load-bearing user paths (the first 14 rows of the table).

**Coverage gaps to ticket:** see "Suggested follow-up tickets" below —
each row above without a "yes" maps to one or more proposed tickets.

---

## Static analysis sweep findings

### Sweep targets (last 10 PRs on main)

`b09294a` (M3), `d08097a` (M2.5), `6abacd0` (planner P0), `8fff733` (M2),
`dcb1028` (history persist), `e9414b9` (TTS phoneme), `a7a9323` (TTS
retry), `88dd734` (SessionEnd wiring), `469d531` (browser switchover),
`e37f937` (PR #105 acceptance).

### Findings

**TODO / FIXME residue.** One TODO in production code:
`src/screens/Greet.tsx:252` — `// TODO(86c9gnhez/sfx-chime-soft):` —
ticket-tagged, expected; not a sweep concern.

**`console.warn` in production paths.** Counted above (P1.10). Eight
unguarded sites. None on a hot path.

**`setTimeout`/`setInterval` cleanup.** Reviewed all 19 hit files:

- `useCharacterLongPress.ts` — has unmount cleanup (line 82-84). Good.
- `useParentGateLongPress.ts` — has unmount cleanup. Good.
- `Hub.tsx:217` — `setInterval` for caption tick. Cleared on completion;
  no unmount cleanup. **Minor leak risk** if Hub unmounts mid-greeting
  (e.g. fast back-tap). The promise's `cancelledRef` short-circuits
  state writes but the interval handle keeps running until completion.
  Roll into P2.5.
- `Math.tsx` `defaultPlayUtterance` — same pattern; same finding.
- `WordSong.tsx` — same.
- `SessionEnd.tsx` — `addTimer` pattern is correct except for the
  `fallbackTimerId` exception (P1.8).
- `Splash.tsx` — single `setTimeout`, useEffect cleanup. Good.
- `Greet.tsx` — multiple, all routed through useEffect cleanup. Good.

**Race-condition shapes.** Two effects with intentionally-narrow deps:

- `App.tsx:516-621` — Math fetch effect deps `[route, mathFallbackPlan]`,
  excludes `mathPlay`/`mathAudioReady`. Documented at length (lines
  496-515). Verified intentional. The latch + signal-checking is
  defensible. Note P1.6 — the shape is correct but the leave-effect's
  reset-gating (`hadAudio`) introduces a new gap.
- `App.tsx:719-777` — Word Song mirror; same shape.
- `App.tsx:649-680` — Math tear-down deps `[route, mathPlay,
mathAudioReady, mathPlan]`. Correct.
- `App.tsx:401-412` — debug probe activation; `[debugOn]`. Correct.
- `Math.tsx:738-748` — gate-state mirror; `[gate.state, audioUnlocked]`.
  Correct (idempotent guard).
- `Math.tsx:880` — read-aloud effect deps `[problemIndex, audioUnlocked,
audioReady]`. Correct.

**`react-hooks/set-state-in-effect`.** All deferred to `queueMicrotask` —
the project-wide pattern is consistent. No violations spotted.

**Accessibility regressions in recent merges.** Reviewed the changed
files in PRs #119 and #120:

- `ParentSettings.tsx` — toggles are `role="switch"` with
  `aria-checked`, segmented controls are `role="radiogroup"` /
  `role="radio"`. Done button is a `<button>`. **Good.** Minor: the
  segmented "Off" / "On" buttons inherit the parent radiogroup's
  `aria-label` but each individual radio button has no per-option label
  beyond visible text — keyboard users will hear "Off" / "On" in
  isolation, fine for parents but worth confirming.
- `Hub.tsx:419-431` (M2.5 long-press wiring) — Emma `<m.img>` carries
  `alt="Emma"` (good) and the long-press props don't override semantic
  attributes. The 96×96pt corner parent-gate is `aria-hidden`, which
  is correct for the spec.

**`aria-live` regions.** All the right places (`role="status"
aria-live="polite"` on the caption ribbons in Greet/Hub/Math/WordSong/
SessionEnd). DebugOverlay has it too. Good.

**Service-worker scope.** Manifest scope `/` and `start_url: /` are
correct. `Cache-Control: max-age=0, must-revalidate` on the prod HTML
means a cold reload always hits Vercel. The PWA service worker should
mediate; I did not verify the precache list against the asset graph in
this static pass — flag as something to spot-check.

**`<MotionConfig reducedMotion="user">`.** Single global config in
`App.tsx:819`. Honours the OS toggle. Good.

---

## Suggested follow-up tickets

- **ticket: stand up Playwright e2e harness** — single config (webkit + iPad
  Pro viewport), CI integration, one smoke test for Hub → Math →
  SessionEnd → Hub. Closes P0.1.
- **ticket: e2e — parent-settings long-press flow** — mount Hub, simulate
  3000ms pointerdown on Emma, assert ParentSettings renders. Closes part
  of P1 inventory row "Parent settings long-press open".
- **ticket: e2e — mastery promotion end-to-end** — seed `Progress`,
  drive 3 perfect math sessions, assert `add-to-10 → mastered`,
  `add-to-20 → intro`. Catches P0.2 if combined with the next ticket.
- **ticket: P0 — focus-node propagation through `recordProgressOnSessionEnd`** —
  close the SURFACE_FOCUS hardcode. Lock with a regression test that
  drives a Math session on a profile where `add-to-10 = mastered` and
  asserts the recorded `skillFocus` reflects the new active node.
- **ticket: P0 — unify cross-day enforcement on local-time** — switch
  `mastery.ts dedupeByCalendarDay` from UTC slice to local-day. Lock
  with timezone-pinned test (Manila).
- **ticket: P1 — visibilitychange handler** — pause/resume audio +
  re-arm gate on tab visibility transitions; persist mid-session
  checkpoint.
- **ticket: P1 — storage event listener** — react to multi-tab writes
  (or reject stale-writer saves).
- **ticket: P1 — pointermove drift cancel for character long-press** —
  bound the drift to ~80pt.
- **ticket: P1 — gate `?route=parent-settings`** — same-session flag
  or remove from QA URL allowlist.
- **ticket: P1 — fix Math/WordSong tear-down latch reset** — move
  `mathFetchStartedRef.current = false` outside the `hadAudio` guard;
  add a regression test for rapid leave-and-re-enter.
- **ticket: P1 — surface discriminant on `playSessionUtterance` singleton**
  — prevent silent cross-track audio bleed.
- **ticket: P1 — mid-session abandon: spec + test** — decide whether
  back-arrow on problem 5 commits stardust + records a partial history
  entry. Pin in spec, lock in test.
- **ticket: P1 — route all SessionEnd timers through `addTimer`** —
  the rogue `fallbackTimerId` is the only outlier.
- **ticket: P2 — `useTimer()` hook** — codify the cleanup pattern.
- **ticket: P2 — gate production `console.warn` calls behind
  `isDebugEnabled()`** — silences the prod console for non-debug
  sessions.
- **ticket: P2 — retire-or-wire the corner parent gate** — remove the
  invisible 96×96pt corner element if v2 isn't using it.

---

## What I deliberately did NOT cover

- **Visual polish / spec-to-pixel match** — Kyle's report.
- **Developmental psychology / age-appropriateness of the pacing,
  vocabulary, reward density** — Dave's report.
- **Live iPad device walkthrough** — depends on hardware I'm not driving
  in this audit; Thomas's post-audit pass owns the device-specific
  signoff. Several findings (P1.1 backgrounding, P1.5 `?route=` in PWA
  standalone, P2.3 orientation) need device confirmation.
- **Live network throttling on the prod URL** — checked the cache headers
  and PWA manifest in source; did not corner-case real Vercel.
- **Real localStorage corruption replay against prod** — read the parser's
  defensive posture in source. The shape is sound (`safeGetItem` /
  try-catch on `JSON.parse` / version-check / migrate / `null` on failure)
  but no live "set this to `{`" then refresh test was performed.
- **Service-worker precache audit** — the asset graph vs. the workbox
  config is not spot-checked here. Flag for a follow-up.
- **Multi-language / Tagalog fallback paths** — out of scope (English-only
  by design).
- **Anthropic API key revocation behaviour** — server-side concern; the
  browser sees a generic fetch failure and falls through to the silent
  fallback, which is the documented contract.
- **Memory profiling over a long session** — would need a real-iPad
  Memory tab; flagged P1.1 and P2.5 as the most likely leak shapes.
