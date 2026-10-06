/**
 * Screen — Hub (skill-tree picker).
 *
 * Source-of-truth: `design/screen-hub.md` (canonical), backed by Dave's
 * developmental research at
 * `design/research/hub-navigation-research-86c9hab6y.md`.
 *
 * This is the home of the app from Session 2 onward. It mounts on:
 *   - app-open with `sessionCount >= 1`
 *   - Session-End "All done!" tap (post-route-flip)
 *   - mid-skill back-arrow tap from Math/WordSong
 *
 * The screen is intentionally calm: two skill-tree picker tiles, a
 * cumulative stardust counter, an invisible parent-gate corner, and an
 * optional recent-stats strip. No nags, no auto-advance, no leaderboard.
 *
 * Architectural notes
 * -------------------
 * - Pure helpers live in sibling files (`hubSuggestion.ts`, `hubLines.ts`,
 *   `useRapidRemountSuppression.ts`, `useParentGateLongPress.ts`,
 *   `stageIcons.tsx`). This file is the orchestration layer + visual
 *   choreography. Tests for the algorithms live with the algorithms.
 * - All animation goes through `<m.*>` under the global LazyMotion at the
 *   App root. Same iPad budget rule as everywhere else.
 * - Audio: 20 new pre-recorded MP3s (manifest in `hubLines.ts`); Kyle
 *   delivers the binaries via ticket `86c9j53yx`. v1 mocks them by
 *   playing through a default `playLineFn` that walks the caption at
 *   165 wpm even when audio fails to load — same shape as Math's silent
 *   fallback.
 * - Phase 3a / 3b character pivot: visuals + character name use Emma
 *   throughout (`emma-idle.svg`, "Number Garden", "Word Song").
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { AnimatePresence, m } from 'motion/react'
import {
  emptySessionHistory,
  readSessionHistoryForToday,
  writeSessionHistory,
  type SessionHistoryV2,
  type SkillTreeId,
} from '../SessionEnd/sessionHistory'
import type { StorageAdapter } from '../Math/stardust'
import {
  computeSuggestion,
  recordSuggestionOutcome,
  type SuggestionTarget,
} from './hubSuggestion'
import {
  HUB_LINES,
  pickHubGreeting,
  shouldShowDayStreak,
  type HubEntryPath,
  type HubLineId,
} from './hubLines'
import { useRapidRemountSuppression } from './useRapidRemountSuppression'
import { useParentGateLongPress } from './useParentGateLongPress'
import { useCharacterLongPress } from './useCharacterLongPress'
import { HubWorldCard } from './HubPathCard'
import { buildHubCardModel, type HubCardModel } from './hubCardModel'
import {
  playHubLine as defaultPlayHubLine,
  cancelActiveHubLine as defaultCancelHubLine,
} from './playHubLine'
import {
  resumeHowlerContextOnGesture,
  unlockIosAudioSession,
} from '../../lib/audio/howlerContext'
import { drainOnGesture } from '../../lib/audio/pendingResumeGate'
import { EmmaCharacter } from '../../components/EmmaCharacter'
import {
  SESSION_HISTORY_STORAGE_KEY,
  useStorageSync,
} from '../../lib/lifecycle'
import { loadProgress, type Progress } from '../../lib/progress'

// ── Public types ────────────────────────────────────────────────────────

/**
 * Per-tree progress used to drive the path-strip's sliding window. v1
 * defaults to "stage 0 for both trees" if the consumer doesn't pass a
 * value. The orchestrator (App / future progress model) wires real
 * values in later — no v1 progress model yet.
 */
export interface HubTreeProgress {
  numberGardenIndex: number
  wordSongIndex: number
}

export interface HubProps {
  /** Which path Marian took to land here. Drives greeting flavour + audio gate. */
  path?: HubEntryPath
  /** Test seam: replace localStorage adapter. */
  storage?: StorageAdapter
  /** Test seam: clock injection. */
  now?: () => Date
  /**
   * Per-tree progress indices (App's projection of its Progress
   * snapshot). The Hub card no longer renders from these; Hub uses the
   * prop's identity as the "App re-read Progress" signal to reload the
   * doc (see `progressDoc`).
   */
  progress?: HubTreeProgress
  /**
   * The Progress doc the Hub card renders from (ticket 123jpnbc3dq).
   * When omitted, Hub calls `loadProgress()` — re-read whenever the
   * `progress` prop changes identity, which App does on every snapshot
   * refresh (hub-route entry, cloud install).
   */
  progressDoc?: Progress | null
  /**
   * Fires when Marian taps a skill-tree node. The orchestrator routes
   * to Math (number-garden) or WordSong (word-song) as a result. The
   * Hub also commits the suggestion outcome to localStorage before
   * invoking — no need for the orchestrator to thread state back.
   */
  onPickTree?: (tree: SkillTreeId) => void
  /**
   * Fires when Marian taps the map button under a card (Emma's Path
   * 8/10, spec §2 "Map button"). The orchestrator routes to that world's
   * map. When omitted no map button renders.
   */
  onOpenMap?: (world: HubCardModel['world']) => void
  /**
   * Fires when the invisible 2-second corner long-press completes. v1
   * defaults to a `console.log` (per spec). v2 will navigate to the
   * real parent area.
   */
  onParentGate?: () => void
  /**
   * Fires when the 3-second long-press on the character art completes
   * (M2.5 — ticket 86c9kpjc7). The orchestrator routes to the
   * 'parent-settings' surface as a result. Tap-and-release does NOT
   * fire; long-press of any non-character element does NOT fire.
   */
  onCharacterLongPress?: () => void
  /**
   * Test seam: optional play-line function. Default fires `onPlay`
   * synchronously and walks word-ticks at ~165 wpm so the caption
   * still reveals even without audio binaries (same shape as Math's
   * default).
   */
  playLineFn?: PlayHubLineFn
  /**
   * Test seam: optional cancel-line function. Invoked from
   * `handleNodeTap` to stop the in-flight Hub utterance so it doesn't
   * leak past the route-flip into Math/WordSong's read-aloud (ticket
   * 86c9m4afh). Production default is the module-level
   * `cancelActiveHubLine` paired with `defaultPlayHubLine`. Tests
   * supplying a custom `playLineFn` typically pass a `vi.fn()` here so
   * they can assert the cancel was invoked exactly once.
   *
   * Idempotent — Hub calls this on every chip tap regardless of
   * whether a line is currently playing, and the underlying player
   * treats "no active utterance" as a no-op.
   */
  cancelLineFn?: () => void
}

export interface PlayHubLineOptions {
  onPlay?: () => void
  onWordTick?: (wordIndex: number) => void
}

export type PlayHubLineFn = (
  id: HubLineId,
  opts?: PlayHubLineOptions,
) => Promise<void>

// ── Component ────────────────────────────────────────────────────────────

const DEFAULT_TREE_PROGRESS: HubTreeProgress = {
  numberGardenIndex: 0,
  wordSongIndex: 0,
}

function safeLoadProgress(): Progress | null {
  try {
    return loadProgress()
  } catch {
    return null
  }
}

export default function Hub({
  path = 'app-open',
  storage,
  now = () => new Date(),
  progress = DEFAULT_TREE_PROGRESS,
  progressDoc,
  onPickTree,
  onOpenMap,
  onParentGate,
  onCharacterLongPress,
  playLineFn,
  cancelLineFn,
}: HubProps): ReactElement {
  // Unlock celebrations moved to the map (Emma's Path 9/10, spec §6):
  // the Hub no longer mounts the PromotionCelebration overlay, so an
  // unlock is celebrated once — there — and never again on the Hub.

  // Hub card data (ticket 123jpnbc3dq). `progress` changes identity
  // whenever App refreshes its Progress snapshot, so keying the reload on
  // it keeps the card in step with App without App passing the doc.
  const doc = useMemo<Progress | null>(
    () => (progressDoc !== undefined ? progressDoc : safeLoadProgress()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `progress` is the refresh signal
    [progressDoc, progress],
  )
  const numberGardenCard = useMemo(() => buildHubCardModel(doc, 'math'), [doc])
  const wordSongCard = useMemo(() => buildHubCardModel(doc, 'word-song'), [doc])

  // Read history once on mount + subscribe to cross-tab writes.
  //
  // Cross-tab sync (ticket 86c9kxtn1 — Jessica e2e batch — Bug C):
  // when Marian (or her sibling) opens the PWA in a second tab and a
  // session-history write lands there, the standard `storage` event
  // fires here. We re-read the blob and project it into state so the
  // HUD reflects the latest cumulative-stardust / sessionCount /
  // streak without a hard reload.
  const [history, setHistory] = useState<SessionHistoryV2>(() => {
    try {
      return readSessionHistoryForToday(now(), storage)
    } catch {
      return emptySessionHistory()
    }
  })

  const refreshHistoryFromStorage = useCallback(() => {
    try {
      setHistory(readSessionHistoryForToday(now(), storage))
    } catch {
      // Read failure (private mode, etc.) — keep the in-memory copy
      // rather than clobber to defaults.
    }
  }, [now, storage])

  useStorageSync({
    key: SESSION_HISTORY_STORAGE_KEY,
    onChange: refreshHistoryFromStorage,
  })

  // Decide the soft suggestion target (or null) for this mount.
  const suggestion = useMemo<SuggestionTarget>(
    () => computeSuggestion(history, now()),
    // history + now are stable for the mount lifetime; recompute on
    // history change so a tap-driven write reflects on next render.
    [history, now],
  )

  // Rapid-remount suppression — if Hub mounts within 30s of an unmount,
  // skip the welcome-back greeting (per Dave's Q5 30s rule).
  const suppressed = useRapidRemountSuppression()

  // Pick the greeting variant.
  const greeting = useMemo(
    () =>
      pickHubGreeting({
        path,
        suggestion,
        seed: history.sessionCount,
        suppressed,
      }),
    [path, suggestion, history.sessionCount, suppressed],
  )

  // ── Caption ribbon -----------------------------------------------------

  const [captionRevealed, setCaptionRevealed] = useState(0)
  const captionWords = useMemo(() => {
    if (greeting.lineId === null) return [] as string[]
    return HUB_LINES[greeting.lineId].text.split(/\s+/).filter(Boolean)
  }, [greeting.lineId])
  const showRibbon = captionRevealed > 0 && greeting.lineId !== null

  // Audio gate: app-open path needs the user-gesture unlock; other
  // paths (session-end / mid-skill-back) reach Hub via a tap, so the
  // audio context is already hot.
  const needsGesture = path === 'app-open' || path === 'app-open-recent'
  const [gestureUnlocked, setGestureUnlocked] = useState(!needsGesture)

  // ── Greeting playback --------------------------------------------------

  const playLine = useCallback(
    (id: HubLineId, opts: PlayHubLineOptions = {}): Promise<void> => {
      if (playLineFn) return playLineFn(id, opts)
      // Default: Howler-backed playback against the line manifest. The
      // helper soft-fails to a 165-wpm caption-walk on load/play error so
      // the screen never bricks even when an MP3 404s. Wired in ticket
      // 86c9kxv47 after Thomas's iPad ear-test (2026-05-02) reported "no
      // greet when I return to hub" — Hub had been running on a silent
      // caption-walk fallback because no production caller was supplying
      // `playLineFn`. See `./playHubLine.ts` for the player shape.
      return defaultPlayHubLine(id, opts)
    },
    [playLineFn],
  )

  /**
   * Cancel any in-flight Hub utterance — called from `handleNodeTap`
   * when Marian taps a skill-tree chip. Defaults to the module-level
   * `cancelActiveHubLine` paired with `defaultPlayHubLine`; tests can
   * inject a custom `cancelLineFn`. When the consumer supplies their
   * own `playLineFn` but no `cancelLineFn` the cancel is a no-op (the
   * test-injected player is responsible for its own teardown via the
   * existing `cancelledRef` short-circuit).
   *
   * Wired in ticket 86c9m4afh — see playHubLine.ts header for the
   * audio-handoff bug context.
   */
  const cancelLine = useCallback((): void => {
    if (cancelLineFn) {
      cancelLineFn()
      return
    }
    if (playLineFn) return // injected player without injected canceller
    defaultCancelHubLine()
  }, [cancelLineFn, playLineFn])

  /**
   * Whether the welcome-back line has been dispatched this mount. Held
   * in a ref so a re-render doesn't refire — the line is one-shot per
   * Hub visit (no auto-replay, per spec).
   */
  const greetingDispatchedRef = useRef(false)
  const greetingPromiseRef = useRef<Promise<void> | null>(null)

  // Cancel-on-tap mechanism: when a node tap fires, we want the
  // welcome-back line to stop mid-utterance. We can't actually cancel
  // a promise, so the cancel flag is read by the play resolution to
  // short-circuit any further state updates.
  const cancelledRef = useRef(false)

  const dispatchGreeting = useCallback(() => {
    if (greetingDispatchedRef.current) return
    if (greeting.lineId === null) {
      // Log suppression decisions exactly once per Hub mount so the
      // iPad-export consoles show *why* the welcome-back was skipped.
      // Added in ticket 86c9kxv47 — Thomas's "no greet when I return"
      // report turned out to be the silent-fallback bug, but the
      // logging was missing either way and would have made the
      // diagnosis 30 seconds instead of an investigation.
      greetingDispatchedRef.current = true
      console.log(
        '[Hub] welcome-back: suppressed',
        suppressed ? '(rapid-remount within 30s)' : '(no line for path)',
        { path, suggestion, suppressed },
      )
      return
    }
    greetingDispatchedRef.current = true
    cancelledRef.current = false
    setCaptionRevealed(0)
    console.log('[Hub] welcome-back: dispatching', {
      lineId: greeting.lineId,
      path,
      suggestion,
    })
    greetingPromiseRef.current = playLine(greeting.lineId, {
      onWordTick: (i) => {
        if (cancelledRef.current) return
        setCaptionRevealed(i + 1)
      },
    }).catch((err) => {
      // Soft-fail: log but don't break the screen. Failure surfaces
      // visually as "no caption revealed past initial render"; both
      // nodes remain tappable.
      console.warn('[Hub] welcome-back line failed:', err)
    })
  }, [greeting.lineId, path, playLine, suggestion, suppressed])

  // For paths where the audio context is already hot, fire on mount.
  // For app-open paths, wait for the first user gesture (tap-anywhere).
  // setState calls inside `dispatchGreeting` are deferred to a microtask
  // so this effect satisfies `react-hooks/set-state-in-effect` (same
  // pattern used by Math/WordSong audio-tear-down effects).
  useEffect(() => {
    if (!gestureUnlocked) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      dispatchGreeting()
    })
    return () => {
      cancelled = true
    }
  }, [gestureUnlocked, dispatchGreeting])

  /**
   * Cross-screen audio leak fix (PR #137 round 2, ticket 86c9kxtmu).
   *
   * Stop any in-flight Hub-line Howl on unmount. Without this cleanup,
   * a Howl that was dispatched while the OS audio session was preempted
   * (iPad PWA visibility-recovery edge) can sit queued waiting for the
   * context to come back; when a future user gesture (chip-tap on
   * Math, for instance) re-engages the session, the queued Hub Howl
   * fires into a screen that's no longer Hub. Thomas's iPad ear-test
   * heard exactly this — a "Hi.. try word song" line bleeding into a
   * Math problem.
   *
   * `defaultCancelHubLine()` is the singleton wrapper around the player's
   * `cancelActive`, calling `Howl.stop()` on whatever Howl was
   * registered as active by the most recent `playHubLine` dispatch.
   * Idempotent — safe to fire even when no Howl is in flight (the
   * common case when Hub re-mounts cleanly after a Session-End hand-
   * off, where the welcome-back has already settled).
   *
   * Note: we DO NOT call this when only the playback prop swapped out
   * via `playLineFn` — that's an injected test seam and the test owns
   * its own cleanup. The unmount cleanup attaches to the Hub component
   * lifecycle, not the prop reference.
   */
  useEffect(() => {
    return () => {
      defaultCancelHubLine()
    }
  }, [])

  // ── Parent-gate long-press --------------------------------------------

  const handleParentGateComplete = useCallback(() => {
    onParentGate?.()
  }, [onParentGate])

  const parentGateProps = useParentGateLongPress({
    onComplete: handleParentGateComplete,
  })

  // ── Character-art 3-second long-press (M2.5) -------------------------
  // Different surface from the corner-gate above: opens the parent
  // settings page (ticket 86c9kpjc7). Bound to the Emma `<m.img>` so a
  // long-press anywhere else on the Hub does NOT trigger it.
  const handleCharacterLongPressComplete = useCallback(() => {
    onCharacterLongPress?.()
  }, [onCharacterLongPress])

  const characterLongPressProps = useCharacterLongPress({
    onComplete: handleCharacterLongPressComplete,
  })

  // ── Node-tap handler ---------------------------------------------------

  /**
   * Synchronous chip `pointerdown` handler — runs BEFORE the event
   * bubbles up to `<m.main>`'s `handleFirstTap`. Marks the welcome-back
   * greeting as already-dispatched so the gesture-unlock effect's
   * post-commit microtask sees the ref set and short-circuits inside
   * `dispatchGreeting()`.
   *
   * Why a separate handler from `handleNodeTap`: `onClick` fires on
   * `pointerup` AFTER the parent's `pointerdown` has already flipped
   * `gestureUnlocked` and re-rendered. The effect runs between
   * pointerdown and pointerup; by the time `handleNodeTap` sets the
   * ref, the greeting has already been dispatched. We need the suppression
   * to be a child-bubbles-first `pointerdown` (DOM event-bubble order is
   * child → parent, so this fires before `handleFirstTap` on the parent).
   *
   * Idempotent: if `greetingDispatchedRef.current` is already `true`
   * (greeting already played, or rapid-remount suppression already
   * marked it), this is a no-op.
   *
   * Does NOT regress PR #144's cancel-on-tap behavior: when the greeting
   * is already mid-flight (gate unlocked at chip-tap time), this ref
   * write is a no-op (ref was set inside the original dispatch); the
   * `cancelLine()` call inside `handleNodeTap` is what stops the
   * audible Howl.
   *
   * Ticket 86c9m4u13 (2026-05-03 evening). Thomas's iPad: chip tap as
   * first gesture → "Try Word Song" played over the destination screen.
   */
  const handleNodePress = useCallback(() => {
    greetingDispatchedRef.current = true
  }, [])

  const handleNodeTap = useCallback(
    (tree: SkillTreeId) => {
      // PR #137 round 3 (ticket 86c9kxtmu) — gesture-deferred recovery
      // drain. If the visibility-recovery gate is pending (Marian
      // backgrounded the PWA on Hub, returned, and iOS handed us a
      // suspended/interrupted ctx on the visible edge), this call
      // runs `Howler.ctx.resume()` + `unlockIosAudioSession()` SYNCHRONOUSLY
      // inside this user-gesture handler — the iOS-required contract.
      // Drains any queued Hub welcome-back Howl so the line plays
      // inside this gesture window. When the gate is idle, this is
      // effectively a belt-and-suspenders resume + unlock for first-
      // gesture iOS unlocks.
      drainOnGesture(resumeHowlerContextOnGesture, unlockIosAudioSession)

      // Cancel any in-flight greeting. `cancelledRef` short-circuits
      // caption-walk state updates inside the play promise; `cancelLine()`
      // is the audio-side stop — tells the underlying Howl (or caption-
      // walk fallback) to actually go silent. Both are needed: the ref
      // guard stops React state updates during teardown, and the line-
      // cancel stops the audio. Without the audio-side cancel, Hub
      // utterances were leaking into Math/WordSong's read-aloud past the
      // route-flip (ticket 86c9m4afh, Thomas's iPad ear-test 2026-05-03).
      cancelledRef.current = true
      cancelLine()

      // Gesture-unlock race fix (ticket 86c9m4u13, 2026-05-03 evening).
      // The synchronous `greetingDispatchedRef.current = true` flip lives
      // in `handleNodePress` (chip `onPointerDown`) so it runs BEFORE the
      // event bubbles up to `<m.main>`'s `handleFirstTap`. By the time
      // React commits the gate-unlock state and runs the effect, the ref
      // is already true and `dispatchGreeting()` short-circuits — Marian
      // is already on her way to her chosen tree, no greeting needed.
      // See `handleNodePress` below for the rationale + ordering proof.

      // Unlock audio gate if this is the first gesture on app-open path.
      if (!gestureUnlocked) setGestureUnlocked(true)

      // Commit the suggestion outcome immediately so the next Hub
      // visit's algorithm reflects what just happened.
      const patch = recordSuggestionOutcome(history, suggestion, tree, now())
      const next: SessionHistoryV2 = { ...history, ...patch }
      writeSessionHistory(next, storage)
      setHistory(next)

      // Hand off to the orchestrator. The orchestrator owns the route
      // change to Math / WordSong; Hub doesn't navigate directly.
      onPickTree?.(tree)
    },
    [
      history,
      suggestion,
      now,
      storage,
      onPickTree,
      gestureUnlocked,
      cancelLine,
    ],
  )

  // ── Map button (Emma's Path 8/10) -------------------------------------

  const handleOpenMap = useCallback(
    (world: HubCardModel['world']) => {
      // Same gesture contract as a card tap: drain a pending iOS resume
      // inside the tap, stop the greeting, hand the route to App.
      drainOnGesture(resumeHowlerContextOnGesture, unlockIosAudioSession)
      cancelledRef.current = true
      cancelLine()
      onOpenMap?.(world)
    },
    [onOpenMap, cancelLine],
  )

  // ── First-tap audio unlock for the app-open path ----------------------

  const handleFirstTap = useCallback(() => {
    // PR #137 round 2 (ticket 86c9kxtmu) — same as `handleNodeTap`.
    // The wake-tap on app-open paths IS the user gesture iOS needs to
    // unstick a backgrounded audio context; drain inside this handler
    // so any pending utterance fires in the gesture window.
    drainOnGesture(resumeHowlerContextOnGesture, unlockIosAudioSession)
    if (gestureUnlocked) return
    setGestureUnlocked(true)
  }, [gestureUnlocked])

  // ── Day streak (the only stat besides stardust; R2 drops the strip) ---

  const showStreak = shouldShowDayStreak(
    history.dayStreak,
    history.lastSessionCompletedAt,
    now(),
  )

  // ── Render ------------------------------------------------------------
  //
  // Redesign R2 (123jpnbc68z): the clay "Toy Box" Hub. Everything sits
  // on `.hub-stage`, the reference's 820×1180 canvas scaled to the
  // screen (see hubClay.css); positions are reference px.

  return (
    <m.main
      data-testid="hub"
      data-path={path}
      data-suggestion={suggestion ?? 'none'}
      data-suppressed={suppressed ? 'true' : 'false'}
      onPointerDown={handleFirstTap}
      className="
        hub-clay
        relative flex h-full w-full flex-col
        text-ink
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
        overflow-hidden
      "
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Invisible parent-gate corner. 96×96pt; no glyph, no
          affordance. Spec: aria-hidden, tabIndex omitted so screen
          readers / Marian's assistive tech don't surface it. */}
      <div
        data-testid="hub-parent-gate"
        aria-hidden
        className="absolute right-0 top-0 z-10"
        style={{
          width: '96pt',
          height: '96pt',
          // Pure invisible touch target — no background, no border.
        }}
        {...parentGateProps}
      />

      <div className="hub-stage" data-testid="hub-stage">
        <div className="hub-garden" aria-hidden />

        {/* Emma: real art unchanged, with a warm backlight and a soft
            contact shadow (hubClay.css). The band is
            pointer-events-none; only the image takes the M2.5 long-press.
            Unlock celebrations play on the map (Emma's Path 9/10); the
            Hub only ever shows idle Emma. */}
        <div className="hub-emma-light" aria-hidden />
        <m.div
          key="idle-emma"
          className="hub-emma-band"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {/* Phase 3b motion brief (ticket 86c9kwvza): `EmmaCharacter`
              breathes (`scale [1, 1.02, 1]` over 4s) and takes the
              long-press handlers via spread. */}
          <EmmaCharacter
            pose="idle"
            layoutId="emma"
            data-testid="hub-emma"
            className="hub-emma-img select-none touch-none"
            {...characterLongPressProps}
          />
        </m.div>

        {/* Speech bubble — same word-by-word reveal pattern as
            Greet/Math/Session-End. */}
        <AnimatePresence>
          {showRibbon && (
            <m.div
              key={greeting.lineId ?? 'no-line'}
              data-testid="hub-ribbon"
              role="status"
              aria-live="polite"
              className="hub-bubble"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <p data-testid="hub-caption">
                {captionWords.map((word, i) => (
                  <m.span
                    key={`hub-w-${i}`}
                    data-testid="hub-caption-word"
                    data-revealed={i < captionRevealed ? 'true' : 'false'}
                    className="inline-block"
                    style={{
                      marginRight: i === captionWords.length - 1 ? 0 : '0.3em',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: i < captionRevealed ? 1 : 0 }}
                    transition={{ duration: 0.1, ease: 'easeOut' }}
                  >
                    {word}
                  </m.span>
                ))}
              </p>
            </m.div>
          )}
        </AnimatePresence>

        {/* HUD chips — stardust shown once; the day streak (sun) only
            while it is live. */}
        <div data-testid="hub-hud" className="hub-chips">
          <div
            data-testid="hub-cumulative-stardust"
            data-total={history.cumulativeStardust}
            className="hub-chip"
          >
            <StarGlyph />
            <span aria-label={`Stardust: ${history.cumulativeStardust}`}>
              {history.cumulativeStardust}
            </span>
          </div>
          {showStreak && (
            <div
              data-testid="hub-day-streak"
              data-value={history.dayStreak}
              aria-label={`Day streak: ${history.dayStreak}`}
              className="hub-chip hub-chip--small"
            >
              <SunGlyph />
              <span aria-hidden>{history.dayStreak}</span>
            </div>
          )}
        </div>

        {/* The two world cards; each carries its own map button. */}
        <HubWorldCard
          tree="number-garden"
          label="Number Garden"
          model={numberGardenCard}
          suggested={suggestion === 'number-garden'}
          onTap={() => handleNodeTap('number-garden')}
          onPress={handleNodePress}
          onOpenMap={onOpenMap ? () => handleOpenMap('math') : undefined}
        />
        <HubWorldCard
          tree="word-song"
          label="Word Song"
          model={wordSongCard}
          suggested={suggestion === 'word-song'}
          onTap={() => handleNodeTap('word-song')}
          onPress={handleNodePress}
          onOpenMap={onOpenMap ? () => handleOpenMap('word-song') : undefined}
        />
      </div>
    </m.main>
  )
}

// ── Clay HUD glyphs ────────────────────────────────────────────────────

function StarGlyph(): ReactElement {
  return (
    <svg viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id="hub-star-fill" cx="40%" cy="30%">
          <stop offset="0" stopColor="#fff6a8" />
          <stop offset=".6" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#f0a818" />
        </radialGradient>
      </defs>
      <path
        d="M50 6 L62 36 L94 38 L69 59 L77 91 L50 73 L23 91 L31 59 L6 38 L38 36 Z"
        fill="url(#hub-star-fill)"
        stroke="#e39a10"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <ellipse cx="40" cy="36" rx="6" ry="10" fill="#fff" opacity=".55" />
    </svg>
  )
}

function SunGlyph(): ReactElement {
  return (
    <svg viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id="hub-sun-fill" cx="40%" cy="35%">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset=".6" stopColor="#ffb52e" />
          <stop offset="1" stopColor="#f08a12" />
        </radialGradient>
      </defs>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect
          key={deg}
          x="45"
          y="2"
          width="10"
          height="20"
          rx="5"
          fill="#ffc531"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
      <circle
        cx="50"
        cy="50"
        r="27"
        fill="url(#hub-sun-fill)"
        stroke="#e8890f"
        strokeWidth="3"
      />
      <ellipse cx="42" cy="40" rx="6" ry="9" fill="#fff" opacity=".5" />
    </svg>
  )
}
