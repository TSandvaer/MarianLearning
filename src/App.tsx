import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domAnimation,
} from 'motion/react'
import Splash from './screens/Splash'
import Greet from './screens/Greet'
import Hub from './screens/Hub'
import type { HubEntryPath } from './screens/Hub'
import MathScreen, { pickStaticSessionPlan } from './screens/Math'
import type {
  MathSessionPlan,
  MathSessionResult,
  PlayMathUtteranceFn,
} from './screens/Math'
import WordSong, { pickStaticWordSongPlan } from './screens/WordSong'
import type {
  PlayWordSongUtteranceFn,
  WordSongSessionPlan,
  WordSongSessionResult,
} from './screens/WordSong'
import SessionEnd from './screens/SessionEnd'
import type { PlayUtteranceFn, SessionEndPayload } from './screens/SessionEnd'
import ParentSettings from './screens/ParentSettings'
import {
  SESSION_HISTORY_KEY,
  markTreeTouched,
  readSessionHistory,
  writeSessionHistory,
  type SkillTreeId,
} from './screens/SessionEnd/sessionHistory'
import { HUB_LAST_UNMOUNT_KEY } from './screens/Hub/useRapidRemountSuppression'
import { STARDUST_STORAGE_KEY } from './screens/_shared/stardust'
import {
  DebugOverlay,
  activateAudioContextProbe,
  emitBundleInit,
  isDebugEnabled,
  maybeApplyDebugSeed,
  recordPathASettleEvent,
} from './lib/debug'
import { disableHowlerAutoSuspend, playSessionUtterance } from './lib/audio'
import { PendingResumeAffordance } from './components/PendingResumeAffordance'
import type { PlaySessionUtteranceOptions } from './lib/audio'
import { prepareMathPathA } from './lib/audio/mathPathA'
import { prepareWordSongPathA } from './lib/audio/wordSongPathA'
import {
  useHowlerSuspendOnHide,
  useRequestPersistentStorageOnGesture,
} from './lib/lifecycle'
import {
  buildLeitnerSessionHint,
  buildSlowFactSessionHint,
  clearProgress,
  crossVowelMixingActive,
  dueLeitnerItems,
  getOrCreateDeviceId,
  getSettings,
  isGraduationSessionPending,
  loadProgress,
  pickFocusNode,
  pickRecentSuccessRate,
  reconcileWithCloud,
  type FocusMode,
  type LeitnerSessionHintItem,
  type LetterSoundsVowel,
  type Progress,
  type ProgressTrack,
  type SkillLevel,
  type SkillNode,
  type SlowFactHint,
  type VowelSubMasteryState,
} from './lib/progress'
import {
  createSubitisingRng,
  easyBandLeitnerMeanBox,
  easyBandSubLeitnerMeanBox,
  readSubitisingScaffoldSessionsObserved,
  readSubitisingScaffoldSubSessionsObserved,
  shouldScaffoldThisSession,
} from './screens/Math/subitisingScaffold'
import { projectHubTreeProgress } from './screens/Hub/progressProjection'
import type { HubTreeProgress } from './screens/Hub'
import type { Route } from './router/route'
import { FIRST_ROUTE } from './router/route'

/**
 * Phase-8 fix (ticket 86c9gvd0y) — disable Howler's internal `_autoSuspend`
 * timer ONCE at module load.
 *
 * The 30-second iPad audio-decay bug Thomas reproduced is caused by
 * Howler's own `_autoSuspend` mechanism (howler.js line 461-505): after
 * 30 s with no sound playing, Howler flips `Howler.state` to `'suspending'`
 * → `'suspended'` and calls `Howler.ctx.suspend()`. On the next gesture,
 * `Howl.play()` checks `Howler.state === 'running'` (line 886) — finds
 * it `'suspended'` — and defers playback to a `'resume'` event that, on
 * iPad PWA after long idle, sometimes never fires.
 *
 * `Howler.autoSuspend = false` (the public, documented option from the
 * library) suppresses the entire timer. `Howler.state` never leaves
 * `'running'` after the first play, `play()` always takes the synchronous
 * fast path, and `_emit('play', id)` always fires — fixing exactly the
 * "speak-call lands but speak-onplay never fires" symptom Phase-7's iPad
 * capture localized.
 *
 * Done at module top level (not inside React) for two reasons:
 *
 *   1. Howler's `_autoSuspend` runs as soon as a sound finishes. The
 *      Greet chime at line 0 plays on splash auto-advance — we want
 *      `autoSuspend` already disabled by then. A `useEffect` after first
 *      render is a microtask too late.
 *   2. The setting is global to the Howler singleton; running it once at
 *      module load is sufficient for the lifetime of the page.
 *
 * No production cost: one boolean property write at startup. Power impact
 * of leaving the WebAudio graph alive is negligible (Safari parks the
 * audio thread when no nodes are connected; our session has nothing
 * connected when idle).
 */
disableHowlerAutoSuspend()

/**
 * Apply `?debug=1&seed=<value>` localStorage seed BEFORE any React
 * tree imports run their `useState(loadProgress)` initializers. Module-
 * load timing is essential — a `useEffect` would land after the first
 * render reads stale storage. No-op when `?debug=1` is missing or the
 * seed value is unrecognized; never runs in Marian's normal flow. See
 * `src/lib/debug/debugSeed.ts` for recognized seed values + rationale.
 */
maybeApplyDebugSeed()

/**
 * QA reset affordance — `?reset=1` (M5, ticket 86c9kmwh0).
 *
 * Clears Marian's local learning state on app boot so Thomas/QA can
 * replay the first-launch flow on a real iPad without manually editing
 * DevTools storage. This is a QA tool, NOT a Marian-facing control — there
 * is no UI; the only feedback is a single `console.log` line.
 *
 * Module-load timing is essential (same rationale as `maybeApplyDebugSeed`
 * above): the clears must land BEFORE any React `useState(loadProgress)` /
 * `getInitialRoute()` / `nextAfterSplash()` initializer reads storage, so
 * the very first render sees a fresh blank slate and routes Splash → Greet
 * (first-launch) rather than Splash → Hub. A `useEffect` would land a
 * microtask too late, after the first render already read the stale keys.
 *
 * Scope of the wipe (the four "learning state" keys):
 *   - `marian-tutor:progress:v1`        — the Progress doc (AC: clearProgress()).
 *   - `marian-tutor.session-history.v1` — sessionCount/day-streak. REQUIRED
 *     for the first-launch observable: `nextAfterSplash()` branches on
 *     `sessionCount`, which lives here, NOT in the Progress doc. Clearing
 *     Progress alone would leave a returning user on the Splash → Hub branch.
 *   - `marian-tutor.stardust.v1`        — cumulative stardust (a reset that
 *     kept the star total would confuse a QA replay).
 *   - `marian-tutor.hub.lastUnmountAt`  — transient rapid-remount suppressor.
 *
 * Deliberately PRESERVED:
 *   - `marian-tutor.backup`    — the ParentSettings manual-recovery export.
 *     Wiping the safety net on a reset would defeat its purpose.
 *   - `marian-tutor:device-id` — cloud-sync identity. Not "progress"; a new
 *     id could fork cloud state.
 */
function maybeApplyResetParam(): void {
  if (typeof window === 'undefined') return
  let isReset: boolean
  try {
    isReset = new URLSearchParams(window.location.search).get('reset') === '1'
  } catch {
    // URLSearchParams should not throw on a string, but be defensive.
    return
  }
  if (!isReset) return

  clearProgress() // marian-tutor:progress:v1

  // The remaining three keys have no dedicated clear helper and their
  // owning adapters don't expose removeItem; remove them directly,
  // wrapped defensively (private mode / locked-down iframe never crashes
  // boot — same posture as storage.ts's safeRemoveItem).
  for (const key of [
    SESSION_HISTORY_KEY,
    STARDUST_STORAGE_KEY,
    HUB_LAST_UNMOUNT_KEY,
  ]) {
    try {
      window.localStorage?.removeItem(key)
    } catch {
      // ignore — best-effort.
    }
  }

  console.log(
    '[reset] ?reset=1 — cleared progress, session-history, stardust, and hub state. App will boot into first-launch (Greet).',
  )
}

maybeApplyResetParam()

/**
 * Optional initial-route override via `?route=literacy` etc. Used for
 * QA-direct-launch into the Word Song surface (or any future screen)
 * before the orchestrator's session-sequencer wires the auto-handoff
 * from Math → Word Song. Falls back to FIRST_ROUTE on missing /
 * unrecognised values.
 */
function getInitialRoute(): Route {
  if (typeof window === 'undefined') return FIRST_ROUTE
  try {
    const params = new URLSearchParams(window.location.search)
    const v = params.get('route')
    if (
      v === 'splash' ||
      v === 'greet' ||
      v === 'hub' ||
      v === 'math' ||
      v === 'literacy' ||
      v === 'session-end' ||
      v === 'reward' ||
      v === 'parent-settings'
    ) {
      return v
    }
  } catch {
    // URLSearchParams should not throw on a string, but be defensive.
  }
  return FIRST_ROUTE
}

/**
 * Compute the post-Splash route per `design/screen-hub.md` § "Navigation
 * contract" Q1:
 *   - `sessionCount === 0` (first-ever launch) → Greet (then Math →
 *     SessionEnd → Hub via the standard flow).
 *   - `sessionCount >= 1` → Hub directly. Greet is a once-ever moment
 *     and never re-shows on subsequent launches.
 *
 * Reads `marian-tutor.session-history.v1` (now v2-aware via the lazy
 * migration in `screens/SessionEnd/sessionHistory.ts`) — a missing /
 * malformed key reads as `sessionCount === 0`, so the first-ever path
 * is the safe default if storage is unavailable.
 */
function nextAfterSplash(): Route {
  try {
    const history = readSessionHistory()
    return history.sessionCount === 0 ? 'greet' : 'hub'
  } catch {
    return 'greet'
  }
}

/**
 * M2 (ticket 86c9kmwba). Read the persisted `Progress` document and
 * project the focus-node hints for `track` that the /api/claude payload
 * carries.
 *
 * Returns `{ focusNode: undefined, recentSuccessRate: undefined }` when
 * storage has no document yet (first run / private mode) — the server
 * falls back to the level-1 default focus node for `track`. Don't
 * synthesise a placeholder value here; that would mask the "first run"
 * path in the planner.
 *
 * Pure module-scope function — no React, no closure deps. The App fetch
 * effect calls this once per session-start (the ticket's contract is
 * "browser reads `loadProgress()` before each session-start fetch"); the
 * cost is one localStorage read per effect run, which is negligible. We
 * deliberately don't memoize across fetches: a save in another tab
 * would otherwise serve stale hints.
 */
function readProgressHintsForTrack(track: ProgressTrack): {
  focusNode: string | undefined
  /**
   * The mode the focus picker selected `focusNode` under (ticket
   * 86c9qa6n3). `'cvc-review'` means a MASTERED CVC tier was deliberately
   * re-surfaced for a cross-vowel review session — the word-song
   * kick-effect's `focusIsCvcTier` gate reads this to let cross-vowel
   * mixing through even though the node is mastered. `undefined` on the
   * no-progress path.
   */
  focusMode: FocusMode | undefined
  recentSuccessRate: number | null | undefined
  isGraduationSession: boolean | undefined
  leitner: LeitnerSessionHintItem[] | undefined
  slowFacts: SlowFactHint[] | undefined
  lifetimeFirstEncounters: readonly string[] | undefined
  letterSoundsVowelStates:
    | Record<LetterSoundsVowel, VowelSubMasteryState>
    | undefined
} {
  const progress = loadProgress()
  if (progress === null) {
    return {
      focusNode: undefined,
      focusMode: undefined,
      recentSuccessRate: undefined,
      isGraduationSession: undefined,
      leitner: undefined,
      slowFacts: undefined,
      lifetimeFirstEncounters: undefined, // legacy / first-launch no-progress path; track-aware helpers never see this branch in practice
      letterSoundsVowelStates: undefined,
    }
  }
  // CVC review mode (ticket 86c9qa6n3) reads the session count from the
  // SEPARATE session-history blob (`marian-tutor.session-history.v1`) —
  // it does not live on the Progress doc. The picker uses it to drive the
  // post-graduation periodic round-robin. Math track ignores sessionCount.
  const sessionCount = readSessionHistory().sessionCount
  const { node: focusNode, mode: focusMode } = pickFocusNode(
    progress,
    track,
    sessionCount,
  )
  // 86c9m3aec: graduation-session hint piggy-backs on the same hint
  // read. Only word-song carries graduation-gated nodes today; the
  // helper itself returns false for non-gated nodes / wrong tracks,
  // so calling it on math is safe but always false.
  const isGraduationSession = isGraduationSessionPending(
    progress,
    focusNode,
    track,
  )
  // 86c9pwgc8 (M4): ship the Leitner hint for the math track only.
  // Word-song has no Leitner box in v1. Empty box → undefined so the
  // wire field is omitted entirely and the canon-served path stays
  // free; non-empty box → an array sorted box-ascending the planner
  // weights toward problems 4-8.
  //
  // 86c9kmwf8 (M4 residual delta — spaced-review schedule): filter the
  // box through `dueLeitnerItems(box, now)` FIRST so only facts whose
  // box-derived review interval has elapsed since `lastSeen` ship. This
  // is the time dimension PR #164 didn't carry — previously every box
  // fact shipped into every session ("weighted review"), now a fact is
  // only resurfaced once it is actually due ("spaced review"). The
  // filter is applied at the caller (not inside `buildLeitnerSessionHint`)
  // so the hint builder stays a pure box→wire flatten with no clock
  // dependency, and the empty-box / cap / sort contract is unchanged —
  // the due-filter just feeds it a (possibly smaller) box. When the
  // filtered subset is empty (nothing due yet), the field is omitted and
  // the canon-served free path is preserved exactly as before.
  let leitner: LeitnerSessionHintItem[] | undefined = undefined
  if (track === 'math') {
    const due = dueLeitnerItems(progress.mathFactsLeitner, Date.now())
    const hint = buildLeitnerSessionHint(due)
    if (hint.length > 0) {
      leitner = hint
    }
  }
  // M4.x slow-fact directive (follow-up to 86c9pwgc8). Math track only —
  // mirrors the Leitner posture. Empty result → undefined so the wire
  // field is omitted entirely and the canon-served path stays free for
  // greenfield Marian. Non-empty → list sorted by median-latency-
  // descending (slowest-first), capped at SLOW_FACT_HINT_MAX_ITEMS.
  let slowFacts: SlowFactHint[] | undefined = undefined
  if (track === 'math') {
    const hint = buildSlowFactSessionHint(progress)
    if (hint.length > 0) {
      slowFacts = hint
    }
  }
  // 86c9q9ben (AC9c-AC9f) + sub-to-10 content tier (Kyle §4.3, 2026-05-15):
  // ship the lifetime-first-encounter list for BOTH tracks. The server's
  // `applyFirstEncounterGate` consults this to decide whether to fire
  // tier-specific scaffolding on `session.end.opener` (word-song today;
  // math gate is infrastructure-ready for `sub-to-10` per Kyle's spec).
  // Always include the field when progress exists — empty array is
  // meaningful (greenfield Marian, fire scaffolding on every tier's first
  // session). The read-path defaulter ensures the field is never undefined
  // here. Static type spans both tracks (`SkillNode[]`) post Wave 3.4 —
  // session-end append-on-math is a follow-up.
  const lifetimeFirstEncounters: readonly string[] =
    progress.lifetimeFirstEncounters ?? []
  // Wave 9 W9.4 (ticket 86c9ya3r9): ship the per-vowel letter-sounds
  // sub-mastery map for the word-song track when the picked focus node
  // is `letter-sounds`. The server derives the current-target vowel via
  // the §1.4 algorithm and bypasses canon/cache only on non-greenfield
  // state. The read-path defaulter
  // (`storage.ts:withDefaultedLetterSoundsVowelStates`) guarantees a
  // fully-populated 4-vowel map whenever progress exists, so we ship a
  // complete map or omit the field entirely (no partial ships). Other
  // tracks / focus nodes omit it — the server ignores a misrouted map
  // anyway (the derivation gates on effective focus === letter-sounds).
  let letterSoundsVowelStates:
    | Record<LetterSoundsVowel, VowelSubMasteryState>
    | undefined = undefined
  if (track === 'word-song' && focusNode === 'letter-sounds') {
    letterSoundsVowelStates = progress.literacy?.letterSoundsVowelStates
  }
  return {
    focusNode,
    focusMode,
    recentSuccessRate: pickRecentSuccessRate(progress, track),
    isGraduationSession,
    leitner,
    slowFacts,
    lifetimeFirstEncounters,
    letterSoundsVowelStates,
  }
}

/**
 * App shell.
 *
 * Routing is intentionally a tiny piece of local state — see
 * `src/router/route.ts` for the rationale. Session 1 is a fixed linear
 * sequence; we don't pay the bundle cost of react-router until URLs become
 * a real requirement (parental dashboard / return-user flow).
 *
 * Motion is wrapped here so every screen can use `<m.*>` without each one
 * paying the LazyMotion init cost. Reduce-motion is honoured globally:
 * iPad's "Reduce Motion" accessibility toggle collapses springs to fades
 * and freezes infinite-repeat pulses. Each screen still gets the same
 * markup — no per-screen branching for the a11y path.
 */
export default function App() {
  const [route, setRoute] = useState<Route>(() => getInitialRoute())

  // ── Page-lifecycle hooks (Jessica e2e batch — Bugs B + C) ──
  //
  // These mount-once hooks live at the App root so we install exactly
  // one document-level listener for `visibilitychange` and one for
  // `storage`, regardless of how many screens consume the signals.
  // See lib/lifecycle/* for the per-hook docstrings.
  useHowlerSuspendOnHide()

  // Request persistent localStorage on the first user gesture (ticket
  // 86c9pkfth). Reduces iOS Safari storage-eviction probability for
  // Marian's progress blob; deferred to first gesture so the (rare)
  // permission prompt doesn't land mid-Splash. Fire-and-forget — no
  // UI surface, no error toast.
  useRequestPersistentStorageOnGesture()

  /**
   * Boot-time cloud-sync reconcile (ticket 86c9pkfyu — T2).
   *
   * Fire-and-forget: kicks off a GET against /api/progress with a 3s
   * timeout. localStorage stays the source-of-truth — this effect only
   * mutates state when the CLOUD blob is strictly newer. The 3s
   * timeout guarantees we never block Marian on a slow / offline KV
   * read; the rest of the App tree boots in parallel and the worst
   * case is a delayed install AFTER Splash → Greet/Hub.
   *
   * The post-install side-effect: refresh `hubProgressSnapshot` so a
   * subsequent Hub mount sees the cloud-installed blob. Math /
   * WordSong fetch effects re-read `loadProgress()` per session-start
   * already, so they pick up the install on the next session.
   */
  const [hubEntryPath, setHubEntryPath] = useState<HubEntryPath>('app-open')

  /**
   * Snapshot of `loadProgress()` taken whenever the route becomes 'hub'
   * (ticket 86c9kwnkw — wire Progress prop into Hub).
   *
   * Read on EVERY hub-route entry, not once per app mount, so:
   *   - The post-session-end Hub mount sees the freshly-saved Progress
   *     (the M3 mastery rule writes new `skillLevels` and possibly
   *     `pendingPromotion` during SessionEnd's mount effect).
   *   - The mid-skill-back Hub mount sees the latest persisted state
   *     even if a sibling tab wrote to localStorage.
   *   - The Parent-Settings → Hub return reflects any threshold changes
   *     that the engine consults on the next session-end (no Hub-side
   *     re-render is needed for Parent Settings itself, but the celebration
   *     state can change on confirm).
   *
   * Held as Progress | null so Hub's defaults still apply when storage is
   * empty (first run / private mode). The projection below maps null to
   * the Hub-default `{ numberGardenIndex: 0, wordSongIndex: 0 }`.
   */
  const [hubProgressSnapshot, setHubProgressSnapshot] =
    useState<Progress | null>(() => loadProgress())

  useEffect(() => {
    if (route !== 'hub') return
    // Re-read on every hub-route entry so a Session-End → Hub flip picks
    // up the just-written promotion state. `loadProgress()` is a single
    // localStorage read — cheap. Deferred to a microtask to satisfy the
    // `react-hooks/set-state-in-effect` rule (same pattern Math/WordSong
    // tear-down effects use).
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setHubProgressSnapshot(loadProgress())
    })
    return () => {
      cancelled = true
    }
  }, [route])

  /**
   * Boot-time cloud reconcile (ticket 86c9pkfyu). Runs once per app
   * lifetime. The promise NEVER throws — see `reconcileWithCloud`.
   * On a successful cloud install, we re-read storage to refresh the
   * Hub snapshot so any active Hub render reflects the freshly
   * installed blob.
   */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const deviceId = getOrCreateDeviceId()
        const local = loadProgress()
        const outcome = await reconcileWithCloud(deviceId, local)
        if (cancelled) return
        if (outcome.kind === 'installed-from-cloud') {
          // localStorage now holds the cloud blob. Refresh the snapshot
          // state so a Hub render that's already mounted re-projects.
          setHubProgressSnapshot(outcome.progress)
        }
      } catch {
        // Unreachable — reconcileWithCloud catches its own errors. The
        // try/catch is belt-and-braces in case a future refactor leaks
        // a throw; we never want boot to fail because of cloud-sync.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const hubTreeProgress = useMemo<HubTreeProgress>(
    () => projectHubTreeProgress(hubProgressSnapshot),
    [hubProgressSnapshot],
  )

  /**
   * Splash advance — branches on session-history per the Hub navigation
   * contract (`design/screen-hub.md` § Q1):
   *   - `sessionCount === 0` → Greet (first-ever Session 1 path)
   *   - `sessionCount >= 1` → Hub (returning launches)
   */
  const handleSplashAdvance = useCallback(() => {
    const next = nextAfterSplash()
    if (next === 'hub') {
      // Determine whether to surface the 'app-open-recent' anchor
      // ("Back so soon!" within ~6h) or the standard 'app-open'
      // anchor.
      try {
        const history = readSessionHistory()
        const last = new Date(history.lastSessionCompletedAt)
        const recent =
          !Number.isNaN(last.getTime()) &&
          Date.now() - last.getTime() < 6 * 60 * 60 * 1000
        setHubEntryPath(recent ? 'app-open-recent' : 'app-open')
      } catch {
        setHubEntryPath('app-open')
      }
    }
    setRoute(next)
  }, [])

  /**
   * Greet → Math handoff. The first-ever flow lands on Math directly
   * (Session 1's fixed sequence per `design/session-1.md`). Greet is
   * never re-shown — when Marian returns to Hub via Session-End the
   * Splash router branches based on `sessionCount`.
   */
  const handleGreetAdvance = useCallback(() => {
    setRoute('math')
  }, [])

  /**
   * Hub → Math/WordSong handoff. The Hub component owns the
   * suggestion-outcome write; this orchestrator records the tree as
   * "touched today" (drives tomorrow's suggestion alternation) and
   * routes.
   *
   * Per spec § "localStorage updates required → Write moments":
   * `todayTreesTouched` is written when a content screen mounts via
   * the orchestrator's session-start path. Wiring it here keeps the
   * write atomic with the route change.
   */
  const handleHubPickTree = useCallback((tree: SkillTreeId) => {
    try {
      const prev = readSessionHistory()
      const next = markTreeTouched(prev, tree, new Date())
      if (next !== prev) writeSessionHistory(next)
    } catch {
      // Storage failures are non-fatal — the suggestion algorithm
      // still works against stale state, just one nudge less varied.
    }
    setRoute(tree === 'number-garden' ? 'math' : 'literacy')
  }, [])

  /** Hub parent-gate completion — v1 no-op (console.log inside the hook). */
  const handleHubParentGate = useCallback(() => {
    // v2 will navigate to a real parent area here. v1 ships invisible.
  }, [])

  /**
   * Hub character-art 3-second long-press → Parent Settings (M2.5,
   * ticket 86c9kpjc7). The orchestrator owns the route flip; the Hub
   * doesn't navigate directly. Tap-and-release does NOT fire — see
   * `useCharacterLongPress` for the timer contract.
   */
  const handleHubCharacterLongPress = useCallback(() => {
    setRoute('parent-settings')
  }, [])

  /** Parent Settings → Hub when the parent taps "Done". */
  const handleParentSettingsExit = useCallback(() => {
    setHubEntryPath('mid-skill-back')
    setRoute('hub')
  }, [])

  /**
   * Imperative teardown for the Word Song Path A pre-warm
   * (ticket 86c9pr4h9). Declared as a ref-stored callback so handlers
   * declared earlier in the component can invoke it without holding
   * a forward reference to the word-song state/refs that live further
   * down. The actual function body is wired below where those refs
   * are declared (search for `tearDownWordSongAudioRef.current = ...`).
   *
   * Invoked from `handleSessionEndAllDone` (post-completion) and
   * `handleBackToHub` (mid-skill abandon) when the surface in play
   * was word-song. The leave-effect previously handled both via
   * literacy → hub transitions, but now excepts `hub` to keep the
   * pre-warm fetch alive on `splash → hub` — so the post-session
   * teardown is driven imperatively from the matching gestures.
   */
  const tearDownWordSongAudioRef = useRef<(() => void) | null>(null)

  /**
   * Mid-skill back-arrow → Hub. Wired into Math/WordSong via their
   * `onRequestExit` callback (added in slice 4).
   *
   * 86c9pr4h9 — when the back-arrow is pressed mid-Word Song, this
   * handler also tears down the word-song Path A audio + resets the
   * latch so the next hub-mount pre-warm fetches fresh content. Same
   * rationale as the matching teardown in `handleSessionEndAllDone`:
   * the leave-effect for word-song now excepts `hub` (because the
   * kick-effect fires there for pre-warm), so the prior literacy →
   * hub teardown that the leave-effect used to do no longer fires
   * here. Discriminated on the current `route` because the same
   * handler is wired to both Math and Word Song's onRequestExit.
   */
  const handleBackToHub = useCallback(() => {
    if (route === 'literacy') {
      tearDownWordSongAudioRef.current?.()
    }
    setHubEntryPath('mid-skill-back')
    setRoute('hub')
  }, [route])

  /**
   * Session-End handoff state. Captured from the originating screen's
   * `onSessionComplete({ ... surface })` callback and surfaced to the
   * Session-End screen on mount. Persisted in component state (not a
   * ref) because the screen reads it during render and we want
   * React-driven re-render parity with the route flip.
   *
   * The full Session-End screen (ticket 86c9hb2r6) replaces the
   * earlier placeholder. Thomas decided Option C for the CTA
   * destination: "Come back soon" sleep splash.
   *
   * Declared above `handleSessionEndAllDone` so that handler can read
   * `sessionEndPayload?.surface` to drive the post-session word-song
   * audio teardown (ticket 86c9pr4h9).
   */
  const [sessionEndPayload, setSessionEndPayload] =
    useState<SessionEndPayload | null>(null)

  /**
   * Always-fresh mirror of the active math plan (ticket 86c9pwgc8 — M4).
   * Read by `handleMathComplete` to derive the per-problem `mathFacts`
   * forwarded to SessionEnd for Leitner promotion. The ref pattern
   * lets the handler stay declared early in the component (before
   * `mathPlan` / `mathFallbackPlan`) without forcing those values into
   * the dep array, which would re-create the handler on every fetch
   * resolve. Set inside an effect after both plans are declared.
   */
  const activeMathPlanRef = useRef<MathSessionPlan | null>(null)

  /**
   * Session-End "All done!" → Hub. Wired into SessionEnd via the new
   * `onAllDone` prop (slice 6 ties the route flip; spec calls for a
   * one-line change in SessionEnd.tsx, this orchestrator-side handler
   * is the receiving side of that handoff).
   *
   * 86c9pr4h9 — when the just-completed session was word-song, this
   * handler also tears down the word-song Path A audio + resets the
   * latch so the next hub-mount pre-warm fetches fresh content. The
   * leave-effect for word-song now excepts `hub` (because the kick-
   * effect fires there for pre-warm), so the prior session-end → hub
   * teardown that the leave-effect used to do no longer fires here.
   * Hooking the teardown to the deterministic "All done" tap is
   * cleaner than detecting transitions in the leave-effect: it fires
   * exactly once, has access to the surface tag, and lives next to
   * the matching route flip.
   */
  const handleSessionEndAllDone = useCallback(() => {
    if (sessionEndPayload?.surface === 'word-song') {
      tearDownWordSongAudioRef.current?.()
    }
    setHubEntryPath('session-end')
    setRoute('hub')
  }, [sessionEndPayload])

  const handleMathComplete = useCallback((result: MathSessionResult) => {
    // Math's existing payload omits the `surface` discriminant per
    // PR #54 / screen-3-math.md:411 — the Session-End spec's
    // backwards-compat shim defaults missing `surface` to `'math'`
    // (screen-5-session-end.md:96-102). We materialise the default
    // here so downstream consumers always see a complete payload.
    //
    // Forward the M4 Leitner-wiring fields (ticket 86c9pwgc8):
    // per-problem first-tap correctness drives Leitner box
    // promotion / demotion at session-end; latency persists on the
    // history entry for future "slow facts" surfacing; mathFacts
    // gives the progress writer a key without re-deriving from the
    // active plan (which may have been swapped for the static
    // fallback by then).
    const activePlan = activeMathPlanRef.current
    const mathFacts = activePlan
      ? activePlan.problems.map((p) => ({
          a: p.addendA,
          b: p.addendB,
          // Read op from the per-problem MathProblem (Kyle's sub-to-10
          // content tier spec §5 + audit §1). Pre-sub-to-10 the field
          // was hardcoded `'+'` because add-to-10 was the only first-
          // class math tier; with sub-to-10 emitting `op: '-'`, the
          // per-problem field is the source of truth — synthesizing
          // `'+'` here would pollute Leitner + slowFacts aggregates
          // with op-mismatched facts (10−2=8 keyed as 10+2=12 etc.).
          op: p.op,
        }))
      : undefined
    setSessionEndPayload({
      totalCorrect: result.totalCorrect,
      totalStardust: result.totalStardust,
      finalStreak: result.finalStreak,
      earnedThisSession: result.earnedThisSession,
      surface: 'math',
      perProblemCorrect: result.perProblemCorrect,
      latencyMs: result.latencyMs,
      ...(mathFacts !== undefined ? { mathFacts } : {}),
      // Subitising scaffold exposure (ticket 86c9ur1zr §2.2). Math
      // surface only; forwarded into recordProgressOnSessionEnd so
      // the writer bumps profile.subitisingScaffoldSessionsObserved
      // when this session actually exposed Marian to the scaffold.
      // Math.tsx only sets `subitisingScaffoldRendered = true` when
      // the scaffold-gate path was active AND the overlay rendered
      // for at least one in-scope problem — see MathSessionResult
      // and Math.tsx's subitisingScaffoldRenderedRef.
      ...(result.subitisingScaffoldRendered === true
        ? { subitisingScaffoldRendered: true }
        : {}),
      // Sub-to-10 minuend-scaffold exposure (ticket 86ca7kdw8 §13.4.1).
      // Forwarded into recordProgressOnSessionEnd so the writer bumps
      // the SEPARATE profile.subitisingScaffoldSubSessionsObserved
      // counter when this sub-to-10 session actually exposed Marian to
      // the minuend cell.
      ...(result.subitisingScaffoldSubRendered === true
        ? { subitisingScaffoldSubRendered: true }
        : {}),
      // Per-problem first-tap chip value (Kevin schema-first PR
      // pairing with Dave's PR #284 two-digit add/sub research).
      // Persisted on SessionHistoryEntry.perProblemAnswerValue so a
      // future tier-ship PR (two-digit-addsub) can classify wrong-
      // tap patterns post-hoc.
      perProblemAnswerValue: result.perProblemAnswerValue,
      // Per-problem OFFERED distractor class (Kevin Wave 5 PR B —
      // ticket 86c9y1p99). Persisted on
      // SessionHistoryEntry.perProblemDistractorClass.
      perProblemDistractorClass: result.perProblemDistractorClass,
    })
    setRoute('session-end')
  }, [])

  const handleWordSongComplete = useCallback(
    (result: WordSongSessionResult) => {
      setSessionEndPayload({
        totalCorrect: result.totalCorrect,
        totalStardust: result.totalStardust,
        finalStreak: result.finalStreak,
        earnedThisSession: result.earnedThisSession,
        surface: result.surface,
        // Forward per-problem outcomes + target words for the
        // graduation gate (ticket 86c9m3aec). SessionEnd computes the
        // canonical/novel split and persists the dual-pool entry when
        // the just-completed session was a graduation run.
        perProblemCorrect: result.perProblemCorrect,
        targetWords: result.targetWords,
        // Per-problem first-tap chip word (Kevin schema-first PR,
        // 2026-05-21, surface parity with the math
        // perProblemAnswerValue field). No current word-song
        // consumer; plumbed for future error-pattern classification.
        perProblemAnswerWord: result.perProblemAnswerWord,
        // Wave 9 W9.4 (ticket 86c9ya3r9): the planner-derived
        // letter-sounds current-target vowel frozen at session-start.
        // `null` (canon / cache / fallback / non-letter-sounds /
        // tier-mastered) → omit so SessionEnd's W9.3 write falls back
        // to the composite-tier mastery path. SessionEnd additionally
        // gates on the re-derived focus node being `letter-sounds`.
        ...(wordSongCurrentTargetVowelRef.current !== null
          ? { currentTargetVowel: wordSongCurrentTargetVowelRef.current }
          : {}),
      })
      setRoute('session-end')
    },
    [],
  )

  /**
   * Stable adapter passed to `<SessionEnd playUtteranceFn>` (ticket
   * 86c9kj2u6). Routes the four `session.end.*` utterance ids through the
   * singleton `playSessionUtterance` — the same howl map that was loaded
   * by whichever pathA module ran most recently (math or word-song;
   * `loadSessionAudio` keys by sessionId so the latest of the two wins).
   *
   * Why we don't branch on `surface`
   * --------------------------------
   * Both Math and Word Song fetch the same Session-End utterance bundle
   * from the planner — the prompt section is identical and the surface-
   * agnostic id strings (`session.end.opener` etc.) are picked up by
   * either track's `prepareXPathA` call. The singleton holds whichever
   * was last loaded; that is by construction the matching bundle for the
   * track Marian just finished. If a future surface adds a per-track
   * Session-End variant, branch this helper on `sessionEndPayload.surface`
   * and select the corresponding sessionId — the wire-shape contract is
   * already in place.
   *
   * Why we don't reach into `mathPlay` / `wordSongPlay`
   * ---------------------------------------------------
   * Those adapters are TEXT-keyed (per `mathPathA.ts` header — Math.tsx
   * reads `problem.utterances.read` as plain strings). SessionEnd is
   * ID-keyed because the celebration text is fixed and the screen does
   * not parse a plan. Going through the singleton's id-keyed
   * `playSessionUtterance` is the direct shape; the text-keyed adapters
   * would require the celebration strings to be embedded in the planner
   * output, which is more wire-data and a coupling we don't need.
   *
   * Stability: `playSessionUtterance` is a module-singleton reference;
   * the wrapping `useMemo` keeps the React-prop identity stable across
   * renders. SessionEnd reads `playUtteranceFn` once in its mount
   * effect; even so, an unstable ref would risk reset-loop bugs in any
   * follow-up that adds it to a dependency array.
   */
  const sessionEndPlayUtterance = useMemo<PlayUtteranceFn>(() => {
    return (
      utteranceId: string,
      opts?: PlaySessionUtteranceOptions,
    ): Promise<void> => {
      return playSessionUtterance(utteranceId, opts)
    }
  }, [])

  // Capture once on mount — flipping debug mid-session would tear the
  // overlay in/out and isn't worth the complexity. To enable, append
  // `?debug=1` to the URL (works in Safari tab and PWA install both).
  const debugOn = useMemo(() => isDebugEnabled(), [])

  // Phase-1 instrumentation for ticket 86c9gvd0y (iOS audio-context
  // decay). The probe is started exactly once when debug is enabled and
  // intentionally NOT torn down — the React tree may unmount on
  // hot-reload, but the probe outlives that and keeps the localStorage
  // log contiguous across screen navigations.
  //
  // No production cost: when `debugOn` is false the effect is a no-op
  // and the probe module never instantiates a poller, listener, or
  // localStorage handle.
  useEffect(() => {
    if (!debugOn) return
    activateAudioContextProbe()
    // Deliberate: no cleanup. See above for rationale.

    // Bundle / cache sanity probe (ticket 86c9hjnn8 follow-up). Emitted
    // once per App mount, AFTER the probe is active so the bundle-init
    // row lands at the top of Thomas's audioCtxLog export. The async
    // reads (IDB schema version, SW script URL) are best-effort; the
    // probe handles any partial result gracefully.
    void emitBundleInit()
  }, [debugOn])

  // ── Math screen — Path A live audio wiring (ticket 86c9gumgk item F) ──
  //
  // Track-based switchover (ticket 86c9jteud): the server is now the
  // source of truth for the plan. We send `{track, level, childName}` and
  // the response carries Haiku-generated problems + pre-rendered audio.
  // The rehydrated plan flows back via `prepareMathPathA(...).plan` and
  // is stored in `mathPlan` state below. Until the fetch resolves (or if
  // it fails), `<MathScreen plan>` falls back to a deterministic static
  // plan — Marian sees a working Math screen with on-curriculum problems
  // and the silent-but-captioned default `playUtterance`. Audio-only
  // degradation, no UX brick.
  // The static rotation that Math renders when the live Path A fetch
  // hasn't resolved yet (or rejected). Picks the right tier for Marian's
  // current focus node so a fresh-mount cold render shows on-tier
  // problems even before the canon / live planner lands. Read once at
  // App mount via `pickFocusNode(loadProgress(), 'math')` rather than
  // re-fetching per render — focus node only changes on mastery
  // promotion, which happens at session-end and the next App mount picks
  // it up.
  const mathFallbackFocusNode = useMemo<SkillNode | undefined>(() => {
    const progress = loadProgress()
    if (progress === null) return undefined
    // Math track never enters CVC review — `.node` is always the forward
    // pick. sessionCount is irrelevant here (omitted → 0).
    return pickFocusNode(progress, 'math').node
  }, [])
  const mathFallbackPlan = useMemo<MathSessionPlan>(
    () => pickStaticSessionPlan(undefined, mathFallbackFocusNode),
    [mathFallbackFocusNode],
  )

  /**
   * Subitising scaffold per-session decision (ticket 86c9ur1zr —
   * `design/math/subitising-scaffold-content.md` §2.3). Computed ONCE
   * per App mount — the session's "is today a dots day?" answer is
   * frozen for the lifetime of this mount. Derived from:
   *   - `subitisingScaffoldSessionsObserved` (counter on profile)
   *   - `easyBandLeitnerMeanBox` (per-band Leitner-mean signal)
   *   - `createSubitisingRng(sessionStartISO, focusNode)` for
   *     deterministic per-session randomness.
   *
   * `sessionStartISO` is captured here at App-mount time via a stable
   * `useMemo([])` so it doesn't shift between re-renders. For a
   * Marian session that goes Greet → Math → SessionEnd → Hub, the
   * App mounts once and the ISO is consistent. For a returning
   * session (Splash → Hub → Math), same App mount, same ISO. The
   * RNG is keyed on the ISO + focus node, so two different days
   * (different App mounts) produce different streams.
   *
   * Output is `false` for:
   *   - First-launch / no-progress state — no Progress doc, no need
   *     to gate (the focus-node check inside the predicate is the
   *     only relevant test for fresh users; production focus node
   *     after `defaultProgress()` is 'add-to-10' anyway).
   *   - Focus node not 'add-to-10' — passes through, doesn't matter
   *     what the per-session decision is because the C1 gate in
   *     Math.tsx rejects.
   *   - Marian post-fluency-fade (Leitner mean ≥ 4.0) — gate disabled.
   *
   * Output is `true` for:
   *   - First-encounter window (counter < 3 sessions).
   *   - Fluency-fade probabilistic branches that land on the active side.
   */
  const subitisingSessionStartISO = useMemo(() => new Date().toISOString(), [])
  const mathSubitisingScaffoldActive = useMemo<boolean>(() => {
    const progress = loadProgress()
    if (progress === null) return false
    const sessionsObserved = readSubitisingScaffoldSessionsObserved(progress)
    const mean = easyBandLeitnerMeanBox(progress.mathFactsLeitner)
    const focusNode = pickFocusNode(progress, 'math').node
    const rng = createSubitisingRng(subitisingSessionStartISO, focusNode)
    return shouldScaffoldThisSession(mean, sessionsObserved, rng)
  }, [subitisingSessionStartISO])
  /**
   * Sub-to-10 minuend-scaffold per-session decision (ticket 86ca7kdw8 —
   * `design/math/subitising-scaffold-content.md` §13.4). Sibling of
   * `mathSubitisingScaffoldActive` above, computed ONCE per App mount,
   * but keyed to the SUB-TO-10 fade signal:
   *   - `subitisingScaffoldSubSessionsObserved` (the SEPARATE counter)
   *   - `easyBandSubLeitnerMeanBox` (subtraction-facts-only Leitner mean)
   *   - the same `createSubitisingRng(sessionStartISO, focusNode)` stream
   *
   * The two decisions are INDEPENDENT — distinct add/sub automaticity
   * pathways (Dave's W10.1 research § Source 5). The sub gate reads the
   * sub counter + sub-facts mean, so a high ADD-facts Leitner mean does
   * NOT fade the sub scaffold (§13.4 — reusing the add signal would put
   * the sub scaffold in late-fade on day 1, which is wrong).
   *
   * `shouldScaffoldThisSession` is REUSED unchanged — only the mean and
   * the counter passed in differ (§13.4.3). The C1/S1 focus-node gate in
   * Math.tsx (`shouldShowSubitisingSubScaffold`) rejects non-`sub-to-10`
   * sessions, so this decision only matters when Marian is actually on
   * the sub-to-10 tier.
   */
  const mathSubitisingSubScaffoldActive = useMemo<boolean>(() => {
    const progress = loadProgress()
    if (progress === null) return false
    const sessionsObserved = readSubitisingScaffoldSubSessionsObserved(progress)
    const mean = easyBandSubLeitnerMeanBox(progress.mathFactsLeitner)
    const focusNode = pickFocusNode(progress, 'math').node
    const rng = createSubitisingRng(subitisingSessionStartISO, focusNode)
    return shouldScaffoldThisSession(mean, sessionsObserved, rng)
  }, [subitisingSessionStartISO])
  const [mathPlan, setMathPlan] = useState<MathSessionPlan | null>(null)

  // Keep the active-math-plan ref synced with whichever plan is rendering
  // (ticket 86c9pwgc8 — M4). Effect runs post-render so we satisfy the
  // "no ref mutation during render" lint guidance. Reads `mathPlan` first
  // (server-derived); falls back to `mathFallbackPlan` (static rotation).
  useEffect(() => {
    activeMathPlanRef.current = mathPlan ?? mathFallbackPlan
  }, [mathPlan, mathFallbackPlan])

  // The live `playUtterance` becomes non-null once the /api/claude fetch
  // resolves and the audio is loaded. Until then (or on any failure),
  // <Math> renders without the prop and falls back to its silent-but-
  // captioned default (165 wpm). No error chime, no nag copy — Marian
  // sees text. See `lib/audio/mathPathA.ts` for the full failure-mode
  // surface and the wire-shape adapter rationale.
  const [mathPlay, setMathPlay] = useState<PlayMathUtteranceFn | null>(null)
  const mathUnloadRef = useRef<(() => void) | null>(null)
  /**
   * Aborts the in-flight `prepareMathPathA` fetch on session end / route
   * leave. Held in a ref because the leave-effect needs to access it
   * without depending on `controller` being recreated (the fetch effect
   * is one-shot, gated by `mathFetchStartedRef`).
   */
  const mathAbortRef = useRef<AbortController | null>(null)
  /**
   * Audio-ready gate for Math (ticket 86c9hjnn8). Flipped to `true` once
   * `prepareMathPathA` settles — resolve OR reject. Math reads this prop
   * to hold the cold-mount first read-aloud until the real `playUtterance`
   * is bound (or until we know we're going to use the silent fallback,
   * which is the same result either way: don't fire the read-aloud while
   * `playUtterance` is still in transition).
   *
   * Why both branches flip it to `true`
   * -----------------------------------
   * On resolve, `mathPlay` becomes the real Path A player; firing the
   * read-aloud now will play audibly. On reject, `mathPlay` stays null
   * and Math falls back to its silent-but-captioned `defaultPlayUtterance`;
   * we still want chips to unlock via that fallback's word-tick walk
   * (otherwise a Path A failure would brick the screen). The bug we're
   * fixing is specifically the WINDOW between mount and fetch settle —
   * once we're past that window in either direction, the existing
   * behaviour is correct.
   *
   * Reset to `false` whenever the route leaves Math so a re-entry
   * (Math → SessionEnd → Math via QA flow) restarts the gate cleanly.
   */
  const [mathAudioReady, setMathAudioReady] = useState(false)

  /**
   * Once-per-app-session latch for the Math Path A fetch (ticket 86c9hjnn8).
   *
   * Without this latch, including `route` and `mathPlay` in the fetch
   * effect's deps caused the greet → math transition to abort the
   * still-in-flight fetch and re-start a fresh one — burning a duplicate
   * server TTS render and delaying resolution by however long the first
   * fetch had already been running. The ref pins the fetch to the FIRST
   * route entering [greet, math] and the rest of the lifecycle is driven
   * by the leave-effect below (which also resets the latch on session
   * end so a future session re-fetches).
   */
  const mathFetchStartedRef = useRef(false)

  /**
   * Kick the Math Path A fetch as soon as Greet mounts (ticket 86c9hjnn8).
   * Greet's wake + 4-line intro + heart-tap window is ~8-15s on real
   * Marian-paced flows; that's plenty of time for the /api/claude POST to
   * settle before Math mounts. Starting on `route === 'math'` (the prior
   * behaviour) made the cold-mount race tight: fetch began at mount and
   * resolved seconds later, well after the read-aloud had already fired
   * silently against `defaultPlayUtterance`.
   *
   * Direct `?route=math` QA launches also trigger the fetch (the latch
   * fires the first time route is greet OR math, whichever comes first).
   *
   * Why no cleanup-on-deps-change here (Kevin's PR #92 review)
   * ----------------------------------------------------------
   * Earlier shape returned a cleanup that ran `controller.abort()` and set
   * a local `cancelled = true`. With `route` in the deps, that cleanup
   * fires on every greet → math transition — exactly the slow-network case
   * the pre-warm was meant to cover. The fetch then rejected with
   * `AbortError`; the `.catch` saw `cancelled === true` and skipped the
   * unblocking `setMathAudioReady(true)`; the latch prevented re-issue;
   * Math's cold-mount gate held forever. Empirical reproduction: hold the
   * fetch open, fire greet → math; observe `started=1, aborted=1,
   * audioReady=false`.
   *
   * Fix: route-change cleanup must NOT touch the in-flight pre-warm. The
   * leave-effect below owns the abort surface (greet/math → non-audio
   * route via `mathAbortRef`); the unmount-effect further down owns the
   * full-App-unmount abort. The settle handlers below check
   * `controller.signal.aborted` to short-circuit when the leave-effect or
   * the unmount-effect has decided we're tearing down — that's the
   * authoritative "should I publish state?" signal under the new shape.
   */
  useEffect(() => {
    if (route !== 'greet' && route !== 'math') return
    if (mathFetchStartedRef.current) return
    mathFetchStartedRef.current = true

    const controller = new AbortController()

    // Track-based payload (ticket 86c9jteud). Level 1 + name "Marian"
    // is the only level we ship today; the planner contract is forward-
    // compatible to level 9 and the per-child name comes from the
    // progress profile in a future ticket. The sessionId pins the
    // IndexedDB audio cache for this session run.
    //
    // M2 (ticket 86c9kmwba): also read `loadProgress()` and ship the
    // focus-node hint + recent success rate for the math track. Server
    // uses these to target the right curriculum slice; on a first-run
    // / no-storage path, both stay undefined and the server uses its
    // own default (add-to-10).
    const sessionId = `math-${mathFallbackPlan.id}-${Date.now()}`
    const mathHints = readProgressHintsForTrack('math')
    void prepareMathPathA(
      {
        level: 1,
        childName: 'Marian',
        sessionId,
        focusNode: mathHints.focusNode,
        recentSuccessRate: mathHints.recentSuccessRate,
        // 86c9pwgc8 (M4): forward the Leitner hint for the math track.
        // Server-side planner reads this via the `progress.leitner`
        // wire field and weights box-1 facts toward problems 4-8.
        // Empty box → undefined here, which keeps the canon-served
        // free path active.
        leitner: mathHints.leitner,
        // M4.x slow-fact directive (follow-up to 86c9pwgc8). Forward
        // the "accurate but slow" fact list. Server-side planner reads
        // this via the `progress.slowFacts` wire field and dosed-back
        // for automaticity-building practice. Empty list → undefined,
        // canon-served path stays free.
        slowFacts: mathHints.slowFacts,
        // sub-to-10 content tier (Kyle §4.3, 2026-05-15): forward the
        // lifetime-first-encounter list. Server's
        // `applyFirstEncounterGate` consults it for gated math nodes
        // (`'sub-to-10'`); the schema now legally carries math node ids
        // (Wave 3.4), but the rewrite remains a no-op until session-end
        // append-on-math lands in a follow-up. Jessica's
        // sub-to-10-first-encounter-gate.spec.ts asserts the field
        // is present on math requests.
        lifetimeFirstEncounters: mathHints.lifetimeFirstEncounters,
      },
      { signal: controller.signal },
    )
      .then((prepared) => {
        if (controller.signal.aborted) {
          // Leave-effect (or unmount-effect) aborted us mid-flight. Drop
          // the loaded howls so we don't leak — the next greet/math entry
          // will fetch fresh per the latch reset in the leave-effect.
          prepared.unload()
          return
        }
        mathUnloadRef.current = prepared.unload
        // Diagnostic instrumentation (ticket 86c9hjnn8 follow-up).
        // Records the resolve in the audioCtxLog timeline so the iPad
        // export shows when the pre-warm finished. Fires BEFORE the
        // setStates so the timestamp pairs with the prop flip cleanly.
        recordPathASettleEvent('math', 'resolve')
        // Server-derived plan now drives the screen visuals — addends,
        // distractor seeds, and per-problem text all come from this
        // plan. See `prepareMathPathA` for the rehydration via
        // `mathSessionPlanFromServer`.
        setMathPlan(prepared.plan)
        // Wrap in a thunk so React doesn't call the function before storing
        // it (useState treats function arg as a lazy initializer).
        setMathPlay(() => prepared.playUtterance)
        setMathAudioReady(true)
      })
      .catch((err: unknown) => {
        // Soft-fail: keep playUtterance null, Math falls back to silent
        // default. Log so the QA pass can attribute the fallback if it
        // bites a captured iPad session.
        if (controller.signal.aborted) {
          // Aborted by leave/unmount — settling state would either be
          // ignored (post-unmount setState no-op) or stomp the leave
          // effect's reset to false. Silent.
          return
        }
        // Diagnostic instrumentation (ticket 86c9hjnn8 follow-up).
        // Records the rejection with its message so the iPad export
        // attributes the silent-fallback path to a concrete cause.
        recordPathASettleEvent(
          'math',
          'reject',
          err instanceof Error ? err.message : String(err),
        )
        console.warn(
          '[App] Math Path A unavailable; using silent fallback:',
          err,
        )
        // Even on failure, unblock Math's cold-mount read-aloud — the
        // silent fallback at least walks the caption + unlocks chips,
        // which is better than leaving the screen permanently waiting.
        setMathAudioReady(true)
      })

    // Capture the controller so the leave-effect below can abort if Marian
    // bails the session (greet/math → non-audio surface) before the fetch
    // resolves. The latch ref keeps THIS effect from re-firing, so a
    // per-run cleanup would hurt (see header comment) — we deliberately
    // omit it.
    //
    // Why no full-App-unmount cleanup either
    // --------------------------------------
    // A separate `[]`-deps cleanup would seem to handle the "tab closed
    // mid-fetch" case, but its cleanup also fires on StrictMode's
    // simulated unmount (dev only). Combined with the latch persisting
    // in the ref, the simulated remount short-circuits the body and the
    // fetch never resumes — re-creating the same brick-shape we're
    // fixing here. In practice the browser cancels in-flight fetches
    // on real tab close, and tests that unmount during fetch let the
    // promise settle into the post-unmount setState no-op (React 18+
    // is silent about that). Net: leaving the abort path solely with
    // the leave-effect is safe and avoids the StrictMode foot-gun.
    mathAbortRef.current = controller
    // `mathFallbackPlan` is `useMemo([])`-stable — listing it satisfies
    // eslint without changing semantics. Route is in deps so the effect
    // is allowed to fire on the first transition into greet/math even if
    // App mounted on splash.
  }, [route, mathFallbackPlan])

  /**
   * Tear-down on session-end / cold-restart. Runs only when route leaves
   * Math AND Greet AND Session-End — i.e. the user has either completed
   * the celebration screen or navigated to a non-audio surface. Releases
   * the howls, resets the latch so a future session re-fetches, and
   * clears the audio-ready gate so the next Math mount holds again until
   * its real player binds.
   *
   * Why we keep audio alive through `route === 'session-end'`
   * ----------------------------------------------------------
   * Ticket 86c9kj2u6 wires SessionEnd to play `session.end.*` utterances
   * via the singleton `playSessionUtterance` from `lib/audio`. Those howls
   * were loaded into the same singleton during `prepareMathPathA`. If we
   * tore down on math → session-end (the prior gate), `unloadSessionAudio`
   * would null out the loaded map and SessionEnd's lookups would reject
   * with "loadSessionAudio() must be called before play" — putting us
   * straight back into the silent fallback we are trying to fix. Holding
   * the audio alive across math → session-end keeps the howls Marian's
   * tap on problem 8 just gesture-unlocked playable through the farewell
   * sequence; the hub leaving session-end fires the tear-down for both
   * tracks (Math + WordSong) so neither leaks into a follow-up session.
   *
   * setState calls deferred to a microtask to satisfy
   * `react-hooks/set-state-in-effect` — same pattern as the screen-level
   * audio-unlock effects (see Math.tsx / WordSong.tsx).
   */
  useEffect(() => {
    if (route === 'math' || route === 'greet' || route === 'session-end') return

    // ── Latch + abort cleanup ALWAYS runs when leaving the audio surfaces.
    //
    // Bug fix (ticket 86c9kxtm5, Jessica e2e batch): the prior shape
    // early-returned on `!hadAudio` BEFORE resetting the latch and
    // aborting the controller. If Marian rapid-bounced away from
    // greet/math BEFORE the in-flight fetch had set any of
    // {mathUnloadRef, mathPlay, mathAudioReady, mathPlan}, the latch
    // (`mathFetchStartedRef`) stayed `true`. A subsequent re-entry into
    // greet/math would short-circuit the kick-effect at
    // `if (mathFetchStartedRef.current) return` and Marian would silently
    // ride the still-in-flight fetch from the first mount — duplicate
    // requests on real fixes, brick on stale state on the corner. Worse:
    // the controller never aborted, so the orphaned fetch settled into
    // the singleton howl map and leaked across sessions.
    //
    // The latch reset + abort are essential and must fire whether or not
    // the fetch had progressed. The state-clear pass below is the only
    // part the `hadAudio` guard usefully gates — there's no point queuing
    // a microtask to set already-null state to null.
    if (mathAbortRef.current) {
      mathAbortRef.current.abort()
      mathAbortRef.current = null
    }
    mathFetchStartedRef.current = false

    const hadAudio =
      mathUnloadRef.current !== null ||
      mathPlay !== null ||
      mathAudioReady ||
      mathPlan !== null
    if (!hadAudio) return
    if (mathUnloadRef.current) {
      mathUnloadRef.current()
      mathUnloadRef.current = null
    }
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setMathPlay(null)
      setMathAudioReady(false)
      // Clear the server-derived plan so a re-entry into greet/math
      // re-fetches and rebinds. The fallback plan persists (it's
      // useMemo([])-stable) so the screen still renders during the
      // re-fetch window.
      setMathPlan(null)
    })
    return () => {
      cancelled = true
    }
  }, [route, mathPlay, mathAudioReady, mathPlan])

  // ── Word Song screen — Path A live audio wiring ──
  //
  // Mirrors Math's wiring above (track-based switchover, ticket
  // 86c9jteud): the server picks the 8 target words via Haiku and
  // returns inline-rendered TTS audio. The rehydrated plan flows back
  // via `prepareWordSongPathA(...).plan` and is stored in `wordSongPlan`
  // state. Falls back to a static plan during the fetch window (and on
  // failure) so the screen always has something to render.
  const wordSongFallbackPlan = useMemo<WordSongSessionPlan>(
    () => pickStaticWordSongPlan(),
    [],
  )
  const [wordSongPlan, setWordSongPlan] = useState<WordSongSessionPlan | null>(
    null,
  )
  const [wordSongPlay, setWordSongPlay] =
    useState<PlayWordSongUtteranceFn | null>(null)
  /**
   * Letter-sounds current-target vowel (slash notation) the planner
   * derived for the active session (Wave 9 W9.4 — ticket 86c9ya3r9).
   * Captured from the `/api/claude` response envelope when the live
   * Path A fetch resolves; frozen for the session lifetime and read at
   * session-end so `recordProgressOnSessionEnd` tags the history entry
   * with the exact vowel the planner targeted (no re-derivation).
   * `null` on canon-served / cached / fallback / non-letter-sounds /
   * tier-mastered responses → the W9.3 composite-tier mastery path
   * applies. Reset whenever the word-song fetch latch resets so a stale
   * vowel can't leak into the next session's entry.
   */
  const wordSongCurrentTargetVowelRef = useRef<
    '/o/' | '/u/' | '/i/' | '/e/' | null
  >(null)
  /**
   * Cross-vowel distractor mix mode for the active session (ticket
   * 86c9qa0kf). Computed once from `loadProgress()` + the live
   * parentSettings at session-start kick-time, frozen on the
   * `<WordSong>` prop for the session's lifetime per spec §4 "uniform
   * per session" rule. Reset to `false` whenever the word-song fetch
   * latch resets (so the next session re-evaluates against
   * potentially-updated progress + parentSettings).
   */
  const [wordSongCrossVowel, setWordSongCrossVowel] = useState(false)
  /**
   * Digraphs-th mouth-cue state (#231 spec). Computed once at session-start
   * from `loadProgress()` alongside `crossVowelMixing`. Frozen on the
   * `<WordSong>` prop for the session lifetime. Reset to `'locked'` on
   * leave so the next session re-evaluates against updated progress.
   */
  const [wordSongDigraphsThLevel, setWordSongDigraphsThLevel] =
    useState<SkillLevel>('locked')
  /**
   * True iff `digraphs-th-voiceless` is `intro` AND absent from
   * `lifetimeFirstEncounters` — gates Placement A first-encounter panel.
   * Frozen with `wordSongDigraphsThLevel`; reset on leave.
   */
  const [
    wordSongDigraphsThFirstEncounter,
    setWordSongDigraphsThFirstEncounter,
  ] = useState(false)
  const wordSongUnloadRef = useRef<(() => void) | null>(null)
  const wordSongAbortRef = useRef<AbortController | null>(null)
  const wordSongFetchStartedRef = useRef(false)
  /**
   * Audio-ready gate for Word Song (ticket 86c9hjnn8). Same shape as
   * `mathAudioReady` above — flipped to `true` once
   * `prepareWordSongPathA` settles so the cold-mount read-aloud waits
   * for a real `playUtterance` before firing. See the Math gate's
   * documentation for the long-form rationale.
   */
  const [wordSongAudioReady, setWordSongAudioReady] = useState(false)

  /**
   * Wire the imperative teardown ref now that the word-song state and
   * refs are declared (ticket 86c9pr4h9). Body mirrors the leave-
   * effect's tear-down branch: abort the controller, unload howls,
   * reset the latch, clear plan/play/audioReady. Used by
   * `handleSessionEndAllDone` and `handleBackToHub` to substitute for
   * the `literacy → hub` teardown that the leave-effect used to drive
   * (the leave-effect now excepts `hub` to keep the pre-warm fetch
   * alive across `splash → hub`).
   *
   * Idempotent — calling on an already-clean state is a no-op.
   *
   * Wired via `useEffect` (rather than a render-time ref assignment)
   * to satisfy React 19's `react-hooks/refs` rule — refs may not be
   * mutated during render. The effect runs once per render with the
   * current setters in scope; React's render-after-state-change
   * cycle keeps the bound function fresh.
   */
  useEffect(() => {
    tearDownWordSongAudioRef.current = () => {
      if (wordSongAbortRef.current) {
        wordSongAbortRef.current.abort()
        wordSongAbortRef.current = null
      }
      if (wordSongUnloadRef.current) {
        wordSongUnloadRef.current()
        wordSongUnloadRef.current = null
      }
      wordSongFetchStartedRef.current = false
      setWordSongPlay(null)
      setWordSongAudioReady(false)
      setWordSongPlan(null)
      // Ticket 86c9qa0kf — reset cross-vowel state so the next session
      // re-evaluates the predicate against potentially-updated progress
      // (e.g. mid-session a parent toggled the setting in another tab).
      setWordSongCrossVowel(false)
      // #231 — reset th mouth-cue state so the next session re-evaluates.
      setWordSongDigraphsThLevel('locked')
      setWordSongDigraphsThFirstEncounter(false)
      // Wave 9 W9.4 (ticket 86c9ya3r9) — reset the frozen current-target
      // vowel so a stale vowel can't leak into the next session's
      // history entry.
      wordSongCurrentTargetVowelRef.current = null
    }
  })

  /**
   * Kick the Word Song Path A fetch as soon as Hub mounts (ticket
   * 86c9pr4h9 — mirrors the Math pre-warm shape from 86c9hjnn8).
   *
   * Pre-86c9pr4h9 the kick fired only on `route === 'literacy'`, which
   * meant the cold-mount race between Marian's tap on the Word Song
   * chip and the /api/claude POST + 8× Azure TTS render + canon
   * lookup landed entirely AFTER the route flip. On real iPad signal
   * (Marian, 2026-05-08) this was a noticeable wait the first time she
   * tried Word Song. Math had no equivalent wait because its kick
   * fires on `greet || math` — the 4-line Greet intro + heart-tap
   * window is plenty for the network to settle.
   *
   * Hub is the right anchor: a returning user (sessionCount ≥ 1)
   * lands on Hub via Splash → Hub, and a first-launch user reaches
   * Hub via Greet → Math → SessionEnd → Hub before any literacy
   * entry. Either way, by the time Marian taps the Word Song chip
   * the network has been working for at least a few hundred ms (and
   * usually seconds).
   *
   * Direct `?route=literacy` QA launches still trigger the fetch (the
   * latch fires the first time route enters [hub, literacy], whichever
   * comes first), so the QA path is not regressed.
   *
   * Same no-cleanup shape as the Math fetch-effect — settle handlers
   * gate on `controller.signal.aborted`. See that effect's header for
   * the full rationale on why a per-render cleanup re-creates the
   * brick-shape this latch is here to avoid.
   *
   * Why hub joins the leave-effect's exception list (below)
   * -------------------------------------------------------
   * If we kicked on hub but DIDN'T except hub in the leave-effect, the
   * `splash → hub` transition would fire BOTH effects in one commit:
   * the kick starts the fetch, then the leave-effect aborts it (hub
   * not in `[literacy, session-end]`). The exception list is widened
   * to `[hub, literacy, session-end]` so an in-flight pre-warm
   * survives Marian's first hub mount. The post-session teardown that
   * the prior leave-effect handled on `literacy → hub` is now driven
   * imperatively from `handleSessionEndAllDone` (see below).
   */
  useEffect(() => {
    if (route !== 'hub' && route !== 'literacy') return
    if (wordSongFetchStartedRef.current) return
    wordSongFetchStartedRef.current = true

    const controller = new AbortController()

    // M2 (ticket 86c9kmwba): focus-node hint for the word-song track.
    // Same shape as the math fetch effect above — see that block for
    // the rationale.
    // 86c9m3aec: ALSO carries the graduation-session flag — when the
    // last 3 cvc-words sessions all hit ≥90% canonical and no novel-
    // probe entry has tagged the tail window yet, the planner mixes
    // 2–3 novel short-a probe words into the 8-problem set.
    const sessionId = `word-song-${wordSongFallbackPlan.id}-${Date.now()}`
    const wordSongHints = readProgressHintsForTrack('word-song')

    // Cross-vowel mix mode (ticket 86c9qa0kf — cross-vowel mix v1 impl;
    // ticket 86c9qa6n3 — CVC review firing layer). Compute once at
    // session-start kick-time:
    //   - parentSettings.crossVowelMixingEnabled must be `true`
    //   - All three CVC tiers must be `'mastered'` (crossVowelMixingActive)
    //   - The picked focusNode must be a CVC tier — satisfied either by
    //     forward progression on a CVC tier OR (post-mastery) by the
    //     CVC-review picker re-surfacing a mastered CVC tier
    //     (`focusMode === 'cvc-review'`, ticket 86c9qa6n3 AC4).
    //
    // The `focusMode === 'cvc-review'` arm is the fix for the PR #181
    // forward-compat paradox: once every CVC tier is mastered the forward
    // picker walks past them onto `digraphs-sh`, so cross-vowel could never
    // fire in regular play. The review picker now lands focus back on a
    // mastered CVC tier, and this gate lets the mode through.
    //
    // Frozen on the `<WordSong>` prop for the session's lifetime. The
    // session is uniformly cross-vowel or uniformly same-vowel — never
    // half-and-half (per spec §4 "uniform per session" rule).
    let nextCrossVowel = false
    {
      const wordSongProgress = loadProgress()
      if (wordSongProgress !== null) {
        const settings = getSettings(wordSongProgress)
        const focus = wordSongHints.focusNode
        const focusIsCvcTier =
          focus === 'cvc-words' ||
          focus === 'cvc-words-short-o' ||
          focus === 'cvc-words-short-u'
        // A CVC-review pick always lands on a CVC tier, so `focusIsCvcTier`
        // is already true for it; the explicit `|| cvc-review` arm makes
        // the AC4 intent legible and robust if the picker's node choice
        // ever widens beyond the three CVC tiers.
        const focusEligibleForCrossVowel =
          focusIsCvcTier || wordSongHints.focusMode === 'cvc-review'
        nextCrossVowel =
          focusEligibleForCrossVowel &&
          crossVowelMixingActive(wordSongProgress, settings)
      }
    }
    setWordSongCrossVowel(nextCrossVowel)

    // #231 — digraphs-th mouth-cue: compute node level + first-encounter flag
    // once at session-start, frozen for the session lifetime. Same structural
    // pattern as `nextCrossVowel` above.
    {
      const thProgress = loadProgress()
      if (thProgress !== null) {
        const thLevel = thProgress.skillLevels['digraphs-th-voiceless']
        setWordSongDigraphsThLevel(thLevel)
        const lfe = wordSongHints.lifetimeFirstEncounters ?? []
        setWordSongDigraphsThFirstEncounter(
          thLevel === 'intro' && !lfe.includes('digraphs-th-voiceless'),
        )
      }
    }

    void prepareWordSongPathA(
      {
        level: 1,
        childName: 'Marian',
        sessionId,
        focusNode: wordSongHints.focusNode,
        recentSuccessRate: wordSongHints.recentSuccessRate,
        isGraduationSession: wordSongHints.isGraduationSession,
        // 86c9q9ben (AC9f): drives the server-side session.end.opener
        // gate for tier-specific first-encounter scaffolding.
        lifetimeFirstEncounters: wordSongHints.lifetimeFirstEncounters,
        // Wave 9 W9.4 (ticket 86c9ya3r9): per-vowel letter-sounds
        // sub-mastery map. Only populated by the hint reader when the
        // picked focus node is `letter-sounds`; the server derives the
        // current-target vowel + round-trips it on the response.
        letterSoundsVowelStates: wordSongHints.letterSoundsVowelStates,
      },
      { signal: controller.signal },
    )
      .then((prepared) => {
        if (controller.signal.aborted) {
          prepared.unload()
          return
        }
        wordSongUnloadRef.current = prepared.unload
        // Wave 9 W9.4 (ticket 86c9ya3r9): freeze the planner-derived
        // current-target vowel for this session so session-end can tag
        // the history entry without re-deriving. `undefined` (canon /
        // cache / fallback / tier-mastered) → store `null`.
        wordSongCurrentTargetVowelRef.current =
          prepared.currentTargetVowel ?? null
        // Diagnostic instrumentation (ticket 86c9hjnn8 follow-up). See
        // the Math fetch-effect for the rationale.
        recordPathASettleEvent('wordSong', 'resolve')
        // Server-derived plan drives the picture chips and target words;
        // see Math's parallel `setMathPlan` call for the rationale.
        setWordSongPlan(prepared.plan)
        setWordSongPlay(() => prepared.playUtterance)
        setWordSongAudioReady(true)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        recordPathASettleEvent(
          'wordSong',
          'reject',
          err instanceof Error ? err.message : String(err),
        )
        console.warn(
          '[App] Word Song Path A unavailable; using silent fallback:',
          err,
        )
        // Even on failure, unblock the cold-mount read-aloud so the
        // silent fallback walks the caption + unlocks chips. See the
        // Math gate's docstring above for the same-shape rationale.
        setWordSongAudioReady(true)
      })

    wordSongAbortRef.current = controller
    // No cleanup — see the Math fetch-effect for the why (route changes
    // must NOT abort, and adding a `[]`-deps unmount cleanup re-creates
    // the StrictMode-double-mount bug shape).
  }, [route, wordSongFallbackPlan])

  /**
   * Tear-down effect for Word Song. Same shape as Math's tear-down above,
   * with the same Session-End hold (ticket 86c9kj2u6 — the singleton howl
   * map is shared with `playSessionUtterance`, so unloading on
   * literacy → session-end would brick SessionEnd's audio).
   *
   * 86c9pr4h9: `hub` is now in the exception list because the kick-
   * effect above fires on hub mount for the Word Song pre-warm. If hub
   * weren't excepted, the `splash → hub` route flip would run both
   * effects in the same commit — the kick starts the fetch, this
   * leave-effect aborts it. The post-session-end teardown that this
   * effect previously handled on `literacy → hub` is now driven
   * imperatively from `handleSessionEndAllDone` (see that handler for
   * the rationale; the short version: deterministic "session done"
   * signal beats reading transition state from the leave-effect).
   *
   * setState calls deferred to a microtask to satisfy the
   * `react-hooks/set-state-in-effect` rule.
   */
  useEffect(() => {
    if (route === 'hub' || route === 'literacy' || route === 'session-end') {
      return
    }

    // Mirror of the Math leave-effect's latch-leak fix
    // (ticket 86c9kxtm5). Reset the latch + abort the controller
    // unconditionally; only the state-clear pass is gated on `hadAudio`.
    // See the Math leave-effect's comment block above for the full
    // rationale on why pre-`hadAudio` reset is essential.
    if (wordSongAbortRef.current) {
      wordSongAbortRef.current.abort()
      wordSongAbortRef.current = null
    }
    wordSongFetchStartedRef.current = false

    const hadAudio =
      wordSongUnloadRef.current !== null ||
      wordSongPlay !== null ||
      wordSongAudioReady ||
      wordSongPlan !== null
    if (!hadAudio) return
    if (wordSongUnloadRef.current) {
      wordSongUnloadRef.current()
      wordSongUnloadRef.current = null
    }
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setWordSongPlay(null)
      setWordSongAudioReady(false)
      setWordSongPlan(null)
      // Ticket 86c9qa0kf — symmetry with the imperative tear-down above.
      setWordSongCrossVowel(false)
      // #231 — symmetry with imperative tear-down.
      setWordSongDigraphsThLevel('locked')
      setWordSongDigraphsThFirstEncounter(false)
      // Wave 9 W9.4 (ticket 86c9ya3r9): reset the frozen current-target
      // vowel — symmetry with the imperative tear-down. Deferred into
      // the microtask (not the effect body) so React 19's ref-
      // immutability rule is satisfied; the ref is non-null only when a
      // resolve also set the audio state, so `hadAudio` is true on every
      // path that could have left a stale vowel.
      wordSongCurrentTargetVowelRef.current = null
    })
    return () => {
      cancelled = true
    }
  }, [route, wordSongPlay, wordSongAudioReady, wordSongPlan])

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <AnimatePresence mode="wait">
          {route === 'splash' && (
            <Splash key="splash" onAdvance={handleSplashAdvance} />
          )}
          {route === 'greet' && (
            <Greet key="greet" onAdvance={handleGreetAdvance} />
          )}
          {route === 'hub' && (
            <Hub
              key="hub"
              path={hubEntryPath}
              progress={hubTreeProgress}
              pendingPromotion={hubProgressSnapshot?.pendingPromotion}
              onPickTree={handleHubPickTree}
              onParentGate={handleHubParentGate}
              onCharacterLongPress={handleHubCharacterLongPress}
            />
          )}
          {route === 'math' && (
            <MathScreen
              key="math"
              plan={mathPlan ?? mathFallbackPlan}
              playUtterance={mathPlay ?? undefined}
              audioReady={mathAudioReady}
              focusNode={mathFallbackFocusNode}
              subitisingScaffoldActive={mathSubitisingScaffoldActive}
              subitisingSubScaffoldActive={mathSubitisingSubScaffoldActive}
              onSessionComplete={handleMathComplete}
              onRequestExit={handleBackToHub}
            />
          )}
          {route === 'literacy' && (
            <WordSong
              key="literacy"
              plan={wordSongPlan ?? wordSongFallbackPlan}
              playUtterance={wordSongPlay ?? undefined}
              audioReady={wordSongAudioReady}
              crossVowelMixing={wordSongCrossVowel}
              digraphsThNodeLevel={wordSongDigraphsThLevel}
              digraphsThFirstEncounter={wordSongDigraphsThFirstEncounter}
              onSessionComplete={handleWordSongComplete}
              onRequestExit={handleBackToHub}
            />
          )}
          {route === 'session-end' && (
            <SessionEnd
              key="session-end"
              payload={sessionEndPayload}
              playUtteranceFn={sessionEndPlayUtterance}
              onAllDone={handleSessionEndAllDone}
            />
          )}
          {route === 'parent-settings' && (
            <ParentSettings
              key="parent-settings"
              onExit={handleParentSettingsExit}
            />
          )}
        </AnimatePresence>
        {/* Debug overlay sits outside AnimatePresence so it persists across
            screen transitions. Gated on `?debug=1` so it never ships visibly
            in normal sessions. See lib/debug/DebugOverlay.tsx for the iPad
            QA usage notes. */}
        {debugOn && <DebugOverlay />}
        {/* PR #137 round 2 (ticket 86c9kxtmu) — "tap to continue" affordance
            for the iPad PWA visibility-recovery edge case. Round-4 mounts
            the affordance immediately on the visibility-recovery edge
            (gate state `'pending'`) rather than waiting for the 3 s
            fallback to reach `'awaiting-tap'`; Thomas's iPad capture
            showed Marian sitting silent for the full fallback window
            most of the time. Lives outside the AnimatePresence so a
            backgrounded session that returns mid-screen-transition
            still gets the affordance promptly. See
            `components/PendingResumeAffordance.tsx`. */}
        <PendingResumeAffordance />
      </MotionConfig>
    </LazyMotion>
  )
}
