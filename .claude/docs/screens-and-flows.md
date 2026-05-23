# Screens and Flows

What this doc covers: every screen Marian can land on — its file location, route contract (where it routes from / to), props it consumes, key state inputs, and the local helpers + tests that surround it. Architectural plumbing (the route state machine, App-level audio pre-warm, providers) lives in [`architecture-overview.md`](./architecture-overview.md). Design rationale is **not** duplicated here; each section links to the canonical `design/screen-*.md`.

Screen order matches the first-launch sequence: Splash → Greet → Math → SessionEnd → Hub, plus Word Song (entered from Hub on a returning launch), ParentSettings (entered via long-press), and the debug-seed deep-launches.

---

## Splash

- Component: [`MarianLearning/src/screens/Splash.tsx`](MarianLearning/src/screens/Splash.tsx)
- Timing helper: [`MarianLearning/src/screens/splashTiming.ts`](MarianLearning/src/screens/splashTiming.ts)
- Spec: [`MarianLearning/design/session-1.md`](MarianLearning/design/session-1.md) §"Screen 1 — Splash / Launch".

**Route contract**: rendered when `route === 'splash'` (the App's `FIRST_ROUTE`). Routes via `props.onAdvance()` → `handleSplashAdvance` ([App.tsx:290-308](MarianLearning/src/App.tsx#L290-L308)) → `greet` (sessionCount === 0) or `hub` (sessionCount ≥ 1).

**Behaviour**:

- **Silent.** No TTS, no SFX, by spec.
- Auto-advances after `WARM_CAP_MS = 1500` (warm) or `COLD_CAP_MS = 3000` (cold). Cap captured once at mount via `useState(() => splashCapMs(detector()))`. See [Splash.tsx:65](MarianLearning/src/screens/Splash.tsx#L65) and [splashTiming.ts:32-55](MarianLearning/src/screens/splashTiming.ts#L32-L55) for the cold-start heuristic (sessionStorage warm flag → `performance.getEntriesByType('navigation')` → cold default).
- Visual: Emma logo spring-scale-in (stiffness 180, damping 18) + 3 pulsing dots with 150 ms stagger. Cream background with subtle radial pink wash.
- No skip — Marian cannot tap past it.

**State inputs**: none from props beyond `onAdvance` and a `detector` test seam. Reads `sessionStorage[marian.splash.warm]` non-fatally.

---

## Greet

- Component: [`MarianLearning/src/screens/Greet.tsx`](MarianLearning/src/screens/Greet.tsx)
- Sequence orchestrator: [`MarianLearning/src/screens/greetSequence.ts`](MarianLearning/src/screens/greetSequence.ts)
- Spec: [`MarianLearning/design/session-1.md`](MarianLearning/design/session-1.md) §"Screen 2 — First Greeting".

**Route contract**: rendered when `route === 'greet'`. Reached only on the first-ever launch (sessionCount === 0) — never re-shown. Routes via `props.onAdvance()` → `handleGreetAdvance` ([App.tsx:316-318](MarianLearning/src/App.tsx#L316-L318)) → `math`. See auto-memory `project_first_launch_session_1.md` for the canonical Greet → Math (NOT → Hub) contract.

**Lines** ([greetSequence.ts:78-83](MarianLearning/src/screens/greetSequence.ts#L78-L83)):

```ts
GREET_LINES = [
  'Hi!',
  "I'm Emma.",
  "It's so nice to meet you.",
  "Tap the heart when you're ready.",
]
```

400 ms gap between lines (`LINE_GAP_MS`). Emma is named here; the line was renamed from "I'm Melody." in Phase 3a (ticket 86c9hjnq1, 2026-04-28).

**State machine** (`'wake' | 'intro'`):

- `wake` — initial state. Audio context locked. Emma idle + breathing, soft pink ready ring. The entire viewport is a tap target. After 8 s of no tap: a one-shot finger-tap icon + ear-wiggle nudge fires (no nag loop).
- `intro` — post-tap. Same tap synchronously dispatches `speak(line0)`, unlocking iPad Safari's audio context. The 4 lines play with caption word-by-word reveal; the heart appears after line index 2 (`HEART_REVEAL_AFTER_LINE_INDEX = 2`, [greetSequence.ts:89](MarianLearning/src/screens/greetSequence.ts#L89)) — i.e. AFTER "It's so nice to meet you." completes.

**Audio**: pre-recorded MP3s through Howler (`lib/audio/preRecorded`), keyed by `GreetLineKey` (`'hi'` / `'imEmma'` / `'niceToMeet'` / `'tapHeart'`). The `LINE_TEXT_TO_KEY` bridge at [Greet.tsx:42-47](MarianLearning/src/screens/Greet.tsx#L42-L47) translates the orchestrator's text-space sequence into the engine's key-space.

**First-utterance retry**: `useAudioUnlockGate` arms a 6 s watchdog (`FIRST_UTTERANCE_RETRY_MS` from `_shared/gameplayConstants`). If `onPlay` never fires, the wake ring re-shows silently and the next gesture re-fires line 0. No error copy.

**Re-prompt**: 20 s of no heart-tap → replay line 3 (`REPROMPT_AFTER_MS = 20_000`, [greetSequence.ts:97](MarianLearning/src/screens/greetSequence.ts#L97)).

**Heart-tap → Math handoff**: 400 ms transition (`HEART_TAP_TRANSITION_MS`).

---

## Hub

The skill-tree picker — home of the app from Session 2 onward.

- Component: [`MarianLearning/src/screens/Hub/Hub.tsx`](MarianLearning/src/screens/Hub/Hub.tsx)
- Index barrel: [`MarianLearning/src/screens/Hub/index.ts`](MarianLearning/src/screens/Hub/index.ts)
- Spec: [`MarianLearning/design/screen-hub.md`](MarianLearning/design/screen-hub.md) (canonical).

**Route contract**: rendered when `route === 'hub'`. Mounted on:

- `app-open` with sessionCount ≥ 1 (Splash → Hub branch).
- `session-end` "All done!" tap (`handleSessionEndAllDone`, [App.tsx:379-382](MarianLearning/src/App.tsx#L379-L382)).
- `mid-skill-back` from Math/WordSong (`handleBackToHub`, [App.tsx:368-371](MarianLearning/src/App.tsx#L368-L371)).
- `parent-settings` exit (`handleParentSettingsExit`, [App.tsx:359-362](MarianLearning/src/App.tsx#L359-L362)).

Routes out via `onPickTree` ([App.tsx:331-341](MarianLearning/src/App.tsx#L331-L341)) → `math` (number-garden) or `literacy` (word-song); `onCharacterLongPress` → `parent-settings`.

**Props** ([Hub.tsx:105-176](MarianLearning/src/screens/Hub/Hub.tsx#L105-L176)):

- `path: HubEntryPath` — drives greeting flavour + audio-gate decision (`'app-open' | 'app-open-recent' | 'session-end' | 'mid-skill-back' | 'first-ever'`).
- `progress: HubTreeProgress` — per-tree current-stage indices, drives the path-strip's sliding window.
- `pendingPromotion?: SkillNode` — when set, mounts `PromotionCelebration` overlay; cleared by ParentSettings confirm UI (Hub does NOT mutate storage on dismiss).
- `onPickTree`, `onCharacterLongPress`, `onParentGate` — orchestrator-owned navigation handoffs.

### Hub helpers and sibling files

| File                                                                                            | Role                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- | --------------------- |
| [`hubLines.ts`](MarianLearning/src/screens/Hub/hubLines.ts)                                     | 18-line MP3 manifest + selection helpers (`pickHubGreeting`, `isLastSessionRecent`, `shouldShowDayStreak`). 9 anchor lines + 9 rotation variants + 2 node-tap.                                                            |
| [`hubSuggestion.ts`](MarianLearning/src/screens/Hub/hubSuggestion.ts)                           | Soft-suggestion algorithm. `computeSuggestion(history, now)` returns `'number-garden'                                                                                                                                     | 'word-song' | null`. `recordSuggestionOutcome` writes back the override-streak counter. |
| [`progressProjection.ts`](MarianLearning/src/screens/Hub/progressProjection.ts)                 | Pure projection from `Progress` doc to `HubTreeProgress` indices + `labelForSkillNode` for the celebration caption.                                                                                                       |
| [`stages.ts`](MarianLearning/src/screens/Hub/stages.ts)                                         | Stage taxonomy (`NUMBER_GARDEN_STAGES`, `WORD_SONG_STAGES`) + [`slidingWindow(stages, currentIndex, size)`](MarianLearning/src/screens/Hub/stages.ts#L71) helper for the path-strip.                                      |
| [`stageIcons.tsx`](MarianLearning/src/screens/Hub/stageIcons.tsx)                               | `<StageIcon stage={...} kind="mastered                                                                                                                                                                                    | in-progress | current                                                                   | locked" />` renderer. |
| [`PromotionCelebration.tsx`](MarianLearning/src/screens/Hub/PromotionCelebration.tsx)           | Overlay shown when `pendingPromotion` is set. 8 radial sparkles, Emma celebration pose, 3.5 s auto-dismiss.                                                                                                               |
| [`playHubLine.ts`](MarianLearning/src/screens/Hub/playHubLine.ts)                               | Howler-backed default `playLineFn`. Falls back to caption-walk on load/play error. **Canonical wiring** — without this module Hub silently runs on the no-audio fallback (see auto-memory `project_hub_audio_wiring.md`). |
| [`useCharacterLongPress.ts`](MarianLearning/src/screens/Hub/useCharacterLongPress.ts)           | 3-second long-press on Emma → ParentSettings. `CHARACTER_LONG_PRESS_MS = 3000`.                                                                                                                                           |
| [`useParentGateLongPress.ts`](MarianLearning/src/screens/Hub/useParentGateLongPress.ts)         | 2-second long-press on top-right corner (96×96pt invisible). `PARENT_GATE_LONG_PRESS_MS = 2000`. v1 is no-op; v2 will navigate.                                                                                           |
| [`useRapidRemountSuppression.ts`](MarianLearning/src/screens/Hub/useRapidRemountSuppression.ts) | Suppresses welcome-back greeting if Hub re-mounts within 30 s (`RAPID_REMOUNT_THRESHOLD_MS`). Backed by `sessionStorage`.                                                                                                 |

### Suggestion algorithm

[`computeSuggestion()`](MarianLearning/src/screens/Hub/hubSuggestion.ts#L61-L80) decision tree:

1. Cool-down active (`now < suggestionCooldownUntil`) → `null`.
2. Today touched exactly ONE tree → suggest the OTHER.
3. Today touched BOTH trees → `null`.
4. Today touched NEITHER → alternate from `lastSuggestion`. If null, default to `'word-song'` (Marian's lower-confidence skill per the diagnostic).

3 consecutive overrides triggers a 2-day cool-down (`SUGGESTION_OVERRIDE_CAP = 3`, `SUGGESTION_COOLDOWN_MS = 2 days`). Both Thomas-locked 2026-04-28.

### Path-strip

Each tree shows a 5-cell sliding window over its stage list. Computed via [`slidingWindow(stages, currentIndex, 5)`](MarianLearning/src/screens/Hub/stages.ts#L71) — centres on `currentIndex` with edge-clamping. Cells render as `mastered | current | locked` (Hub doesn't surface `'in-progress'` distinct from `'current'` today).

### Celebration overlay

`pendingPromotion !== undefined && dismissedFor !== pendingPromotion` ([Hub.tsx:210-215](MarianLearning/src/screens/Hub/Hub.tsx#L210-L215)) gates visibility. Idle Emma and `<PromotionCelebration>` live under one shared `<AnimatePresence mode="wait">` ([Hub.tsx:651-690](MarianLearning/src/screens/Hub/Hub.tsx#L651-L690)) so the swap fades cleanly — landed in commit `49ced39` (PR #154). `mode="wait"` guarantees only ONE Emma in the DOM at a time, which keeps the count-based regression test (`hub-emma` count = 0 during celebration, 1 otherwise) green.

### Cancel-on-tap

When Marian taps a skill-tree chip mid-greeting, [`handleNodeTap`](MarianLearning/src/screens/Hub/Hub.tsx#L479-L536) calls `cancelLine()` synchronously inside the gesture handler. Without the audio cancel, Hub utterances were leaking into Math/WordSong's read-aloud past the route-flip (ticket 86c9m4afh, Thomas's iPad ear-test 2026-05-03). The `handleNodePress` `onPointerDown` ([Hub.tsx:475-477](MarianLearning/src/screens/Hub/Hub.tsx#L475-L477)) flips `greetingDispatchedRef = true` BEFORE the event bubbles to `<m.main>`'s `handleFirstTap`, so the gesture-unlock effect's microtask short-circuits.

---

## Math

- Component: [`MarianLearning/src/screens/Math/Math.tsx`](MarianLearning/src/screens/Math/Math.tsx)
- Index barrel: [`MarianLearning/src/screens/Math/index.ts`](MarianLearning/src/screens/Math/index.ts)
- Spec: [`MarianLearning/design/screen-3-math.md`](MarianLearning/design/screen-3-math.md).

**Route contract**: rendered when `route === 'math'`. Reached from Greet (first-ever flow) or Hub (number-garden tile). Routes out via `onSessionComplete` → `handleMathComplete` ([App.tsx:398-412](MarianLearning/src/App.tsx#L398-L412)) → `session-end` (after problem 8); or `onRequestExit` → `handleBackToHub` → `hub` (mid-skill back-arrow).

**Plan source**: [`pickStaticSessionPlan()`](MarianLearning/src/screens/Math/sessionPlans.ts) returns the rotation fallback plan; the live plan flows in via `props.plan` from App's `mathPlan` state, populated by [`prepareMathPathA`](MarianLearning/src/lib/audio/mathPathA.ts) — see `audio-system.md` and `planner-and-canon.md`.

**Sibling files**:

| File                                                                     | Role                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [`Math.tsx`](MarianLearning/src/screens/Math/Math.tsx)                   | Orchestration + visual choreography (~1000+ lines).                                   |
| [`constants.ts`](MarianLearning/src/screens/Math/constants.ts)           | Re-exports `STREAK_BONUS_THRESHOLDS` from `_shared/gameplayConstants.ts`.             |
| [`distractors.ts`](MarianLearning/src/screens/Math/distractors.ts)       | `pickDistractors()` algorithm — see `skill-trees-and-content.md`.                     |
| [`sessionPlans.ts`](MarianLearning/src/screens/Math/sessionPlans.ts)     | `MathSessionPlan`, `MathProblem`, `pickStaticSessionPlan()`.                          |
| [`planFromServer.ts`](MarianLearning/src/screens/Math/planFromServer.ts) | `mathSessionPlanFromServer()` rehydrates the wire-shape into the screen's plan shape. |
| [`stardust.ts`](MarianLearning/src/screens/Math/stardust.ts)             | Per-screen stardust persistence (`marian-tutor.stardust.v1`).                         |

**Behaviour highlights**:

- 8 problems per session (`MATH_SESSION_PROBLEMS` from `_shared/gameplayConstants`).
- Chip-tap advance: 4 chips, picture-grounded distractors (flowers/sparkles for visual anchoring). Spring `whileTap={{ scale: 0.96 }}` everywhere, no red X — Emma reacts in character on incorrect taps.
- Streak bonus thresholds: `[3, 5, 8]` — chime fires on threshold crossings only, staggered 320 ms after sparkle to read as a separate beat.
- Cold-mount audio gate: `audioReady` prop holds the first read-aloud until `prepareMathPathA` settles (resolve OR reject). See [Math.tsx:163-194](MarianLearning/src/screens/Math/Math.tsx#L163-L194). Backwards-compatible: undefined preserves immediate-fire behaviour.
- HUD: cumulative stardust + earned-this-session counter, streak indicator. 250 ms HUD pop tween on grant.

**ACs touched** (high level — full ACs in the spec): chip taps disabled until first read-aloud completes; per-correct stardust grant + sparkle burst; advance after 1.2 s on correct (or hard-ceiling 1.6 s); guided pose after 2nd wrong (`GUIDED_AFTER_WRONG_COUNT`), give-answer after 3rd; surface tag `'math'` flows through to SessionEnd via the backwards-compat shim.

**Per-problem capture refs — four-ref lockstep pattern (post PR #309, 2026-05-22).** Math.tsx maintains **four** per-problem capture refs that flow Math → App (`handleMathComplete`) → `SessionEndPayload` → `recordProgressOnSessionEnd` → `SessionHistoryEntry`. All four follow the same shape:

| Ref                            | Slot value type                                               | Captured by                                                                           | Drives                                                                   |
| ------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `perProblemCorrectRef`         | `boolean` (first-tap semantics)                               | `firstTapRecordedRef`-gated assignment inside chip-tap handler                        | Mastery rule via `successRate`                                           |
| `latencyMsByProblemRef`        | `number` (ms; `-1` sentinel for not-measured)                 | `useLayoutEffect([readAloudPlayed])` anchor + chip-tap delta                          | M4 Leitner / M4.x slow-fact directive                                    |
| `perProblemAnswerValueRef`     | `number \| null` (literal chip value of first tap)            | `firstTapRecordedRef`-gated assignment inside chip-tap handler                        | Future wrong-tap classification                                          |
| `perProblemDistractorClassRef` | `OfferedDistractorClass \| null` (offered class, gentle=null) | `useEffect([problemIndex, chipOrderWithClass.offeredClass])` writes when chips render | Future diagnostic-aware mastery gate (Kyle's two-digit-addsub spec §5.4) |

**Pattern at each sync point:**

1. **Mount initialization** — `useRef<...[]>(plan.problems.map(...))` with the appropriate default per slot.
2. **Per-problem write** — either a once-per-problem latch on first chip-tap (refs 1 + 3 + `latencyMs` via deferred capture) OR a render-keyed effect (ref 4 — written when the chip helper emits a new resolved class). The distractor-class ref is **positional / tap-outcome-independent** — wrong-then-correct retry leaves the slot unchanged because the write fires at chip-render, not chip-tap.
3. **Resize-on-plan-length-change** — a single `useEffect([planLength])` block walks all four refs and copies-forward when `plan.problems.length` changes (defensive against future tiers with non-8 problem counts).
4. **Session-end emission** — `MathSessionResult.{field}` carries `ref.current.slice()` (mutation-safe copy).

**When adding a new per-problem capture in the future, ALL four lockstep sites must be extended in the same PR:** ref declaration, write site, resize block, emission. Missing any one drops the capture silently. PR #309 (ticket 86c9y1p99) added `perProblemDistractorClass` and is the worked example for this pattern.

Note: `mathFacts` is the 5th persisted per-problem field on `SessionHistoryEntry` but is NOT captured in Math.tsx — it is derived inside `App.tsx#handleMathComplete` from `activeMathPlanRef` and zipped against `perProblemCorrect` at session-complete time. It does NOT follow this lockstep pattern.

**Spec-authoring convention** (Devon's PR #163 review takeaway): `Math.tsx` is hot-edit territory (~2200 lines, frequent additions) and any `Math.tsx:NNNN` reference in a design spec drifts within days — Kyle's PR #163 had refs that had drifted by 30 to 200 lines between draft and Devon's review. Anchor specs by **stable name primitives** instead: `data-testid="..."` ids, exported component names (`<FlowerGlyph>`, `<DotCardOverlay>`), gate predicates (`audioReady !== false`), or named refs (`chipReadyAtRef`, `firstTapRecordedRef`). Line-number citations are fine for grep convenience inside `.claude/docs/` markdown but are NOT a stable contract for cross-file specs.

---

## WordSong

- Component: [`MarianLearning/src/screens/WordSong/WordSong.tsx`](MarianLearning/src/screens/WordSong/WordSong.tsx)
- Index barrel: [`MarianLearning/src/screens/WordSong/index.ts`](MarianLearning/src/screens/WordSong/index.ts)
- Spec: [`MarianLearning/design/screen-4-word-song.md`](MarianLearning/design/screen-4-word-song.md).

**Route contract**: rendered when `route === 'literacy'`. Reached from Hub (word-song tile). Routes out via `onSessionComplete` → `handleWordSongComplete` ([App.tsx:414-432](MarianLearning/src/App.tsx#L414-L432)) → `session-end`; or `onRequestExit` → `handleBackToHub` → `hub`.

**Plan source**: [`pickStaticWordSongPlan()`](MarianLearning/src/screens/WordSong/wordSessionPlans.ts) returns the static fallback; live plan via [`prepareWordSongPathA`](MarianLearning/src/lib/audio/wordSongPathA.ts).

**Sibling files**:

| File                                                                             | Role                                                                                 |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`WordSong.tsx`](MarianLearning/src/screens/WordSong/WordSong.tsx)               | Orchestration + visual choreography.                                                 |
| [`constants.ts`](MarianLearning/src/screens/WordSong/constants.ts)               | Re-exports `STREAK_BONUS_THRESHOLDS`.                                                |
| [`wordPack.ts`](MarianLearning/src/screens/WordSong/wordPack.ts)                 | `WordEntry` shape, `WORD_PACK`, `FORBIDDEN_PAIRS`. See `skill-trees-and-content.md`. |
| [`wordDistractors.ts`](MarianLearning/src/screens/WordSong/wordDistractors.ts)   | `pickDistractors()` for picture-grounded chips, honours forbidden pairs.             |
| [`wordSessionPlans.ts`](MarianLearning/src/screens/WordSong/wordSessionPlans.ts) | `WordSongSessionPlan`, `WordSongProblem`, static fallback factory.                   |
| [`planFromServer.ts`](MarianLearning/src/screens/WordSong/planFromServer.ts)     | Rehydrates wire-shape into screen plan.                                              |
| [`wordPictures.tsx`](MarianLearning/src/screens/WordSong/wordPictures.tsx)       | Inline-SVG picture placeholders (real assets land later).                            |

**Behaviour highlights**:

- 8 CVC problems per session; current focus tier is `cvc-words` (short-a) with `cvc-words-short-o` shipping in PR #151-#155.
- Read-line caption pattern: the on-screen line renders as `["Read", "the", "<word>."]` — all three words tick word-by-word. The picture renders alongside but is the meaning-anchor, not the chip target.
- 3-chip picker (vs. Math's 4) — picture-grounded; the word text under each picture also reveals.
- Silent-text window: 1500 ms (`SILENT_TEXT_WINDOW_MS`, [WordSong.tsx:147](MarianLearning/src/screens/WordSong/WordSong.tsx#L147)) — on `cvc-word` problems the word text shows immediately but Emma's read-aloud is delayed so Marian gets a decoding beat. Does NOT apply to `blending-cv` content (recognise-by-name, not phonics).
- Stardust: per-correct grants were removed in ticket 86c9kwvza; the flat `+5` completion bonus (`WORDSONG_SESSION_END_BONUS`) is granted inside SessionEnd's mount effect via `grantWordSongCompletionBonus`. The `earnedThisSession` field on the result is always `0` for word-song now.
- Cancel-on-tap: PR #144 wired `cancelSessionAudio` into the chip-tap path so an in-flight read-aloud stops cleanly when Marian advances.
- HUD pop bumped to 400 ms (Word Song-specific; Math intentionally still uses 250 ms).
- Surface tag: `WordSongSessionResult` carries `surface: 'word-song'`, plus `perProblemCorrect: readonly boolean[]` and `targetWords: readonly string[]` for the graduation gate.

**Refactor hazard — `firstTapRecordedRef` same-name-different-role across Math and WordSong (Kevin NOF PR #289, Devon-confirmed, 2026-05-21):**

- `Math.tsx`'s `firstTapRecordedRef` gates THREE captures (`perProblemCorrectRef`, `latencyMsRef`, `perProblemAnswerValueRef`) — all under **first-tap semantics**: wrong-then-correct counts as FALSE on `perProblemCorrect`.
- `WordSong.tsx`'s `firstTapRecordedRef` gates ONE capture (`perProblemAnswerWordRef`) under first-tap semantics, but `perProblemCorrectRef` is written separately inside `handleCorrectTap` under **ever-correct semantics**: wrong-then-correct counts as TRUE on `perProblemCorrect`.

Same field name (`perProblemCorrect`), divergent per-screen semantics. Currently invisible to downstream consumers — `mastery.ts` and `focusNode.ts` always dispatch on `track` before reading the field — but a "consolidate similar code" refactor that pulls the two latches into a shared hook would silently flip WordSong's `perProblemCorrect` semantics. Inline comments + JSDoc in PR #289 are the defense; if you propose consolidating these latches, both screens' tests AND the downstream mastery logic must be re-audited together. Thomas chose option (a) "doc only, do not refactor" 2026-05-21.

---

## SessionEnd

- Component: [`MarianLearning/src/screens/SessionEnd/SessionEnd.tsx`](MarianLearning/src/screens/SessionEnd/SessionEnd.tsx)
- Sub-components: [`StardustCounter.tsx`](MarianLearning/src/screens/SessionEnd/StardustCounter.tsx), [`StreakBand.tsx`](MarianLearning/src/screens/SessionEnd/StreakBand.tsx), [`SleepSplash.tsx`](MarianLearning/src/screens/SessionEnd/SleepSplash.tsx).
- Storage helpers: [`sessionHistory.ts`](MarianLearning/src/screens/SessionEnd/sessionHistory.ts), [`progressHistory.ts`](MarianLearning/src/screens/SessionEnd/progressHistory.ts).
- Spec: [`MarianLearning/design/screen-5-session-end.md`](MarianLearning/design/screen-5-session-end.md).

**Route contract**: rendered when `route === 'session-end'`. Reached after problem 8 on Math (`handleMathComplete`) or Word Song (`handleWordSongComplete`). Routes out via `onAllDone` → `handleSessionEndAllDone` ([App.tsx:379-382](MarianLearning/src/App.tsx#L379-L382)) → `hub`. When `onAllDone` is undefined, falls through to the legacy `<SleepSplash>` (Option C "Come back soon" — preserved as a dark-launch fallback per auto-memory `project_session_end_and_hub.md`).

**Audio**: Path A utterances `session.end.opener | recap | streak | goodbye | cta` routed via `playUtteranceFn` (App-supplied via [`sessionEndPlayUtterance`](MarianLearning/src/App.tsx#L469-L476) → `playSessionUtterance` singleton). The Math + Word Song howl maps stay loaded across `math/literacy → session-end` so the celebration can play; tear-down fires only on `session-end → hub` (or other non-audio routes).

**Phase machine** ([SessionEnd.tsx:118-124](MarianLearning/src/screens/SessionEnd/SessionEnd.tsx#L118-L124)):

```
opener (t=0)  →  recap (t=1400)  →  streak (t=3400, if finalStreak ≥ 3)
            →  goodbye (t=5000)  →  settled (t=6200)  →  sleep-splash (post-CTA)
```

Constants: `OPENER_DELAY_MS = 0`, `RECAP_DELAY_MS = 1400`, `STREAK_DELAY_MS = 3400`, `GOODBYE_DELAY_MS = 5000`, `CTA_DELAY_MS = 6200`. Audio failure fallback collapses CTA reveal to 4000 ms.

**Mount-effect persistence** ([SessionEnd.tsx:285+](MarianLearning/src/screens/SessionEnd/SessionEnd.tsx#L285)):

1. **Word-song completion bonus** — `grantWordSongCompletionBonus(...)` writes `+5` to `marian-tutor.stardust.v1` BEFORE `recordSessionEnd` so `cumulativeStardust` is post-bonus.
2. **`recordSessionEnd(finalStreak, storage, now)`** — writes `marian-tutor.session-history.v1` (Hub stats: `sessionCount++`, `lastSessionCompletedAt`, `lastSessionStardust`, `dayStreak`, `cumulativeStardust`).
3. **`recordProgressOnSessionEnd(...)`** — writes `marian-tutor:progress:v1` (rolling `SessionHistoryEntry` list, capped at 30, plus `profile.lastPlayedISO`). This call also runs `applyMasteryRule()` which can flip `skillLevels` and queue `pendingPromotion`. See `progress-and-persistence.md` for the rule's full semantics.

Both writes use the same wall-clock instant for cross-payload correlation.

**Payload shape** ([SessionEnd.tsx:58-78](MarianLearning/src/screens/SessionEnd/SessionEnd.tsx#L58-L78)): `totalCorrect`, `totalStardust`, `finalStreak`, `earnedThisSession`, `surface: 'math' | 'word-song'`, plus optional `perProblemCorrect: readonly boolean[]` + `targetWords: readonly string[]` for the graduation gate (word-song only).

**Display**: `displayedTotalStardust = payload.totalStardust + (surface === 'word-song' ? WORDSONG_SESSION_END_BONUS : 0)`. The stardust counter ticks up to that value; `data-total-stardust` data-attribute exposes it for QA.

---

## ParentSettings

- Component: [`MarianLearning/src/screens/ParentSettings/ParentSettings.tsx`](MarianLearning/src/screens/ParentSettings/ParentSettings.tsx)
- Index barrel: [`MarianLearning/src/screens/ParentSettings/index.ts`](MarianLearning/src/screens/ParentSettings/index.ts)
- Spec: [`MarianLearning/design/adaptive-engine-one-pager.md`](MarianLearning/design/adaptive-engine-one-pager.md) §"Parent settings (v1 scope)".

**Route contract**: rendered when `route === 'parent-settings'`. Reached **only** via the 3-second long-press on Hub character art (`onCharacterLongPress` → `handleHubCharacterLongPress` → `parent-settings`). Routes out via `props.onExit` → `handleParentSettingsExit` ([App.tsx:359-362](MarianLearning/src/App.tsx#L359-L362)) → `hub` with `hubEntryPath = 'mid-skill-back'`.

**Settings rows** ([ParentSettings.tsx:1-28](MarianLearning/src/screens/ParentSettings/ParentSettings.tsx#L1-L28)):

- `autoPromote` — toggle. When `false`, mastery rule queues `pendingPromotion` for parent confirm; when `true`, promotion applies immediately on the next session-end.
- `sessionModePicker` — segmented (off | on).
- `masteryThreshold` — TWO three-way segmented controls (math + word-song independently). Presets: `80/2 | 90/3 | 95/3`. Math default `95/3`; word-song default `90/3`. Locked in ticket 86c9kwvy0.
- `crossDayEnforcement` — toggle.
- `showLevelToMarian` — toggle.

**Save model**: every control writes through `storage.save(...)` immediately — no explicit save button. The "Done" button at top simply calls `onExit`. See [ParentSettings.tsx:117-137](MarianLearning/src/screens/ParentSettings/ParentSettings.tsx#L117-L137) for the patch-and-merge `update()` callback.

**Pending-promotion confirm**: [`handleConfirmPromotion`](MarianLearning/src/screens/ParentSettings/ParentSettings.tsx#L153-L177) re-applies `applyMasteryRule()` against a temporarily `autoPromote=true` view, then restores the parent's true preference — the queued node moves to `'mastered'` and the downstream node unlocks.

**Backup section** (PR #159): a read-only `<textarea>` displaying a JSON export of `marian-tutor:progress:v1` and `marian-tutor.session-history.v1` wrapped in a provenance envelope (`{ kind: 'marian-tutor.backup', version: 1, exportedAtISO, progress, sessionHistory }`) + a Copy button. v1 manual recovery path if Safari clears origin storage. Future T2 restore-from-paste will validate the `kind` field before installing. See `progress-and-persistence.md` § "Backup export & storage persistence" for the wrapper schema, the `useRequestPersistentStorageOnGesture` hook, and the iOS Safari opacity caveat.

**Visual**: deliberately drab — slate text on white, system font, no Emma art. The point is "this is obviously not a Marian screen." See [ParentSettings.tsx:179+](MarianLearning/src/screens/ParentSettings/ParentSettings.tsx#L179).

---

## Debug seeds (QA / iPad smoke)

- Module: [`MarianLearning/src/lib/debug/debugSeed.ts`](MarianLearning/src/lib/debug/debugSeed.ts)
- Gate: `?debug=1` in URL (same predicate that drives `<DebugOverlay>`).

Seeds run at module load via [`maybeApplyDebugSeed()`](MarianLearning/src/App.tsx#L103) — BEFORE the React tree's `useState(loadProgress)` initializers, so the first render reads the seeded values without a forced reload.

**Recognized seed values** ([debugSeed.ts:187-336](MarianLearning/src/lib/debug/debugSeed.ts#L187-L336)):

| Seed                         | Effect                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cvc-words`                  | Marks `letter-names`, `letter-sounds`, `blending-cv` as `'mastered'`; `cvc-words` as `'practicing'`. Skips Greet (sessionCount → 1) so app deep-routes to Hub.                                                                                                                                                                                                             |
| `cvc-words-graduation-ready` | Same as `cvc-words`, plus 3 cross-day canonical sessions at 100% so the next session-start fetch flags `isGraduationSession=true`. SAR walkthrough state (ticket 86c9m3aec).                                                                                                                                                                                               |
| `cvc-words-short-o`          | All short-a CVC mastered; Marian now practising `cvc-words-short-o`. Used by Thomas's iPad smoke-test for the short-o tier.                                                                                                                                                                                                                                                |
| `cvc-words-short-u`          | short-a + short-o mastered; practising `cvc-words-short-u`. Third vowel-tier sibling (ticket 86c9q9ben).                                                                                                                                                                                                                                                                   |
| `cvc-words-short-i`          | short-a + short-o + short-u mastered; practising `cvc-words-short-i`. Fourth vowel-tier sibling (ticket 86c9qdba4).                                                                                                                                                                                                                                                        |
| `cross-vowel-mixing`         | All four CVC vowel tiers mastered; focus is `digraphs` (the next non-mastered node). Exercises the `crossVowelMixingActive` predicate-true branch for the parent-settings UI; chips do NOT render cross-vowel in the natural session flow because the caller-side `focusIsCvcTier` gate in `App.tsx` returns `false` when focus is `digraphs`. v1 seed (ticket 86c9qa0kf). |
| `add-to-20`                  | Math track: `number-recog` + `add-to-10` mastered; practising `add-to-20`. iPad smoke-test entry for the next math tier (ticket 86c9q5q13).                                                                                                                                                                                                                                |

URLs are of the form `https://marian-learning.vercel.app/?debug=1&seed=cvc-words-short-i`. Idempotent — applying the same seed twice short-circuits via the `changed` flag; a real returning user with `sessionCount > 0` is never displaced (the seeder only bumps from 0 → 1).

Adding new seeds: extend the `SEEDS` table, marking ALL preceding nodes in the relevant track as `'mastered'` so `pickFocusNode()` walks past them and lands on the intended target.

---

## Cross-references

- [`architecture-overview.md`](./architecture-overview.md) — entry points, route state machine, build pipeline.
- `audio-system.md` — Path A pre-warm, Howler singletons, Greet/Math/WordSong/SessionEnd audio wiring.
- `planner-and-canon.md` — `/api/claude` shape, plan rehydration, canon strategy.
- `progress-and-persistence.md` — `Progress` doc shape, `applyMasteryRule`, `pendingPromotion`, Leitner box, localStorage keys.
- `skill-trees-and-content.md` — Number Garden + Word Song stage taxonomies, distractor algorithms, word/picture packs.
- `emma-character-and-animation.md` — `EmmaCharacter` component, pose system, motion patterns.
- `testing-and-ci.md` — vitest + Playwright e2e patterns, CI gates.
