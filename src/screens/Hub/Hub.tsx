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
 * The screen is intentionally calm: two clay world cards with their
 * flower slots, Emma naming one next action (Guidance G1, ClickUp
 * 123jpnbca4r), and an invisible parent-gate corner. No stardust total,
 * no day streak (bar 14: no unexplained counters), no nags, no
 * auto-advance, no leaderboard.
 *
 * Architectural notes
 * -------------------
 * - Pure helpers live in sibling files (`hubSuggestion.ts`, `hubLines.ts`,
 *   `useRapidRemountSuppression.ts`, `useParentGateLongPress.ts`,
 *   `stageIcons.tsx`). This file is the orchestration layer + visual
 *   choreography. Tests for the algorithms live with the algorithms.
 * - All animation goes through `<m.*>` under the global LazyMotion at the
 *   App root. Same iPad budget rule as everywhere else.
 * - Emma's lines: the guidance lines in `hubGuidance.ts`, played from the
 *   G3 Lily recordings (`audioSrc`) with the caption walking alongside;
 *   a line without a recording walks its caption at 165 wpm.
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
  isoDate,
  readSessionHistoryForToday,
  writeSessionHistory,
  type SessionHistoryV2,
  type SkillTreeId,
} from '@marian/core/sessionEnd/sessionHistory'
import type { StorageAdapter } from '@marian/core/math/stardust'
import {
  computeSuggestion,
  recordSuggestionOutcome,
  type SuggestionTarget,
} from './hubSuggestion'
import type { HubEntryPath } from '@marian/core/hub/hubLines'
import {
  GUIDANCE_LINES,
  cancelGuidanceLine as defaultCancelGuidanceLine,
  flowerWakeFor,
  guidanceNeedsGesture,
  pickGuidanceLines,
  playGuidanceLine as defaultPlayGuidanceLine,
  readFlowerWake,
  unloadGuidanceLines,
  writeFlowerWake,
  type GuidanceLineId,
} from './hubGuidance'
import { useRapidRemountSuppression } from './useRapidRemountSuppression'
import { useParentGateLongPress } from './useParentGateLongPress'
import { useCharacterLongPress } from './useCharacterLongPress'
import { HubWorldCard } from './HubPathCard'
import {
  buildHubCardModel,
  type HubCardModel,
} from '@marian/core/hub/hubCardModel'
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
import { loadProgress, type Progress } from '@marian/core/progress'
import { now as progressNow } from '@marian/core/progress/clock'
import type { HubTreeProgress } from '@marian/core/hub/progressProjection'

// ── Public types ────────────────────────────────────────────────────────

// `HubTreeProgress` lives with its projection in `@marian/core`.
export type { HubTreeProgress }

export interface HubProps {
  /** Which path Marian took to land here. Drives greeting flavour + audio gate. */
  path?: HubEntryPath
  /** Test seam: replace localStorage adapter. */
  storage?: StorageAdapter
  /**
   * Test seam: clock injection. Defaults to the progress clock
   * (`lib/progress/clock.ts`), so `?debug=1&dayOffset=N` moves the
   * Hub's "today" (sleeping flowers, suggestion) with the rest of the app.
   */
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
  id: GuidanceLineId,
  opts?: PlayHubLineOptions,
) => Promise<void>

/** Pause between two of Emma's lines (wake-up, then the next action). */
const LINE_GAP_MS = 1200

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
  now = progressNow,
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
  // Today's local day key on the progress clock, fixed for the visit.
  const [today] = useState(() => isoDate(now()))
  const numberGardenCard = useMemo(
    () => buildHubCardModel(doc, 'math', today),
    [doc, today],
  )
  const wordSongCard = useMemo(
    () => buildHubCardModel(doc, 'word-song', today),
    [doc, today],
  )

  // Morning wake-up (Guidance G1): flowers that slept since the last
  // visit open once. Decided on mount, recorded right away so the next
  // visit — even a rapid remount — never shows it again.
  const [wake] = useState(() =>
    flowerWakeFor([numberGardenCard, wordSongCard], readFlowerWake(storage)),
  )
  useEffect(() => {
    writeFlowerWake(wake.next, storage)
  }, [wake, storage])

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

  // The world Emma names (Guidance G1): the one that can still earn
  // today's flower, closest to its unlock first; null when both have it.
  const suggestion = useMemo<SuggestionTarget>(
    () => computeSuggestion(history, now(), doc),
    // now is stable for the mount lifetime; recompute on history / doc
    // change so a tap-driven write reflects on next render.
    [history, now, doc],
  )

  // Rapid-remount suppression — if Hub mounts within 30s of an unmount,
  // skip the welcome-back greeting (per Dave's Q5 30s rule).
  const suppressed = useRapidRemountSuppression()

  // Emma's lines for this visit, decided once on mount: the wake-up
  // first when flowers woke, then one next action (hubGuidance.ts).
  const [lines] = useState<GuidanceLineId[]>(() =>
    suppressed
      ? []
      : pickGuidanceLines({
          numberGarden: numberGardenCard,
          wordSong: wordSongCard,
          suggestion,
          wakeWorlds: wake.wakeWorlds,
        }),
  )

  // ── Caption ribbon -----------------------------------------------------

  const [lineIndex, setLineIndex] = useState(0)
  const [captionRevealed, setCaptionRevealed] = useState(0)
  const currentLine: GuidanceLineId | null = lines[lineIndex] ?? null
  const captionWords = useMemo(() => {
    if (currentLine === null) return [] as string[]
    return GUIDANCE_LINES[currentLine].text.split(/\s+/).filter(Boolean)
  }, [currentLine])
  const showRibbon = captionRevealed > 0 && currentLine !== null

  // Audio gate: when a line has a recording (ticket G3), the app-open
  // path waits for the iOS user-gesture unlock; other paths (session-end
  // / mid-skill-back) reach Hub via a tap, so the context is hot.
  // Caption-only lines show straight away.
  const needsGesture =
    (path === 'app-open' || path === 'app-open-recent') &&
    guidanceNeedsGesture(lines)
  const [gestureUnlocked, setGestureUnlocked] = useState(!needsGesture)

  // ── Greeting playback --------------------------------------------------

  const playLine = useCallback(
    (id: GuidanceLineId, opts: PlayHubLineOptions = {}): Promise<void> => {
      if (playLineFn) return playLineFn(id, opts)
      // Default: the recorded Lily line (Howler), or the caption walk
      // (165 wpm) for a line without a recording.
      return defaultPlayGuidanceLine(id, opts)
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
    defaultCancelGuidanceLine()
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
    greetingDispatchedRef.current = true
    if (lines.length === 0) {
      // Log suppression decisions exactly once per Hub mount so the
      // iPad-export consoles show *why* Emma stayed quiet (ticket
      // 86c9kxv47).
      console.log(
        '[Hub] guidance: no line',
        suppressed ? '(rapid-remount within 30s)' : '(nothing to say)',
        { path, suggestion, suppressed },
      )
      return
    }
    cancelledRef.current = false
    console.log('[Hub] guidance: dispatching', { lines, path, suggestion })
    greetingPromiseRef.current = (async () => {
      for (let i = 0; i < lines.length; i++) {
        if (cancelledRef.current) return
        if (i > 0) {
          await new Promise((r) => setTimeout(r, LINE_GAP_MS))
          if (cancelledRef.current) return
        }
        setLineIndex(i)
        setCaptionRevealed(0)
        await playLine(lines[i]!, {
          onWordTick: (w) => {
            if (cancelledRef.current) return
            setCaptionRevealed(w + 1)
          },
        })
      }
    })().catch((err) => {
      // Soft-fail: log but don't break the screen. Both cards stay
      // tappable.
      console.warn('[Hub] guidance line failed:', err)
    })
  }, [lines, path, playLine, suggestion, suppressed])

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
      cancelledRef.current = true
      defaultCancelGuidanceLine()
      // Release the recorded lines' Howls when the Hub leaves; the next
      // visit rebuilds the one or two it plays.
      unloadGuidanceLines()
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
      const patch = recordSuggestionOutcome(history, suggestion)
      const next: SessionHistoryV2 = { ...history, ...patch }
      writeSessionHistory(next, storage)
      setHistory(next)

      // Hand off to the orchestrator. The orchestrator owns the route
      // change to Math / WordSong; Hub doesn't navigate directly.
      onPickTree?.(tree)
    },
    [history, suggestion, storage, onPickTree, gestureUnlocked, cancelLine],
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
      data-lines={lines.join(' ')}
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
              key={currentLine ?? 'no-line'}
              data-testid="hub-ribbon"
              role="status"
              aria-live="polite"
              className="hub-bubble"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <p data-testid="hub-caption" data-line={currentLine ?? ''}>
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

        {/* The two world cards; each carries its own map button. */}
        <HubWorldCard
          tree="number-garden"
          label="Number Garden"
          model={numberGardenCard}
          suggested={suggestion === 'number-garden'}
          wakeSlots={wake.wakeSlots.math}
          onTap={() => handleNodeTap('number-garden')}
          onPress={handleNodePress}
          onOpenMap={onOpenMap ? () => handleOpenMap('math') : undefined}
        />
        <HubWorldCard
          tree="word-song"
          label="Word Song"
          model={wordSongCard}
          suggested={suggestion === 'word-song'}
          wakeSlots={wake.wakeSlots['word-song']}
          onTap={() => handleNodeTap('word-song')}
          onPress={handleNodePress}
          onOpenMap={onOpenMap ? () => handleOpenMap('word-song') : undefined}
        />
      </div>
    </m.main>
  )
}
