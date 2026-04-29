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
  HUB_LINE_WORD_COUNTS,
  isLastSessionRecent,
  pickHubGreeting,
  shouldShowDayStreak,
  type HubEntryPath,
  type HubLineId,
} from './hubLines'
import { useRapidRemountSuppression } from './useRapidRemountSuppression'
import { useParentGateLongPress } from './useParentGateLongPress'
import { StageIcon } from './stageIcons'
import {
  NUMBER_GARDEN_STAGES,
  WORD_SONG_STAGES,
  slidingWindow,
  type StageId,
} from './stages'

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
  /** Per-tree progress indices for path-strip rendering. */
  progress?: HubTreeProgress
  /**
   * Fires when Marian taps a skill-tree node. The orchestrator routes
   * to Math (number-garden) or WordSong (word-song) as a result. The
   * Hub also commits the suggestion outcome to localStorage before
   * invoking — no need for the orchestrator to thread state back.
   */
  onPickTree?: (tree: SkillTreeId) => void
  /**
   * Fires when the invisible 2-second corner long-press completes. v1
   * defaults to a `console.log` (per spec). v2 will navigate to the
   * real parent area.
   */
  onParentGate?: () => void
  /**
   * Test seam: optional play-line function. Default fires `onPlay`
   * synchronously and walks word-ticks at ~165 wpm so the caption
   * still reveals even without audio binaries (same shape as Math's
   * default).
   */
  playLineFn?: PlayHubLineFn
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

export default function Hub({
  path = 'app-open',
  storage,
  now = () => new Date(),
  progress = { numberGardenIndex: 0, wordSongIndex: 0 },
  onPickTree,
  onParentGate,
  playLineFn,
}: HubProps): ReactElement {
  // Read history once on mount — Hub doesn't subscribe to localStorage
  // changes, the orchestrator unmounts/remounts when needed.
  const [history, setHistory] = useState<SessionHistoryV2>(() => {
    try {
      return readSessionHistoryForToday(now(), storage)
    } catch {
      return emptySessionHistory()
    }
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
      // Default: walk caption at ~165 wpm so the screen does something
      // visible even without real audio. Same shape as Math's default.
      return new Promise<void>((resolve) => {
        opts.onPlay?.()
        const wordCount = HUB_LINE_WORD_COUNTS[id]
        const totalMs = (wordCount / 165) * 60_000
        const interval = wordCount > 0 ? totalMs / wordCount : 0
        let i = 0
        opts.onWordTick?.(0)
        if (wordCount <= 1) {
          // Single-word lines resolve cleanly without an interval.
          resolve()
          return
        }
        const timer = window.setInterval(() => {
          i += 1
          opts.onWordTick?.(i)
          if (i >= wordCount - 1) {
            window.clearInterval(timer)
            resolve()
          }
        }, interval)
      })
    },
    [playLineFn],
  )

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
    if (greeting.lineId === null) return
    greetingDispatchedRef.current = true
    cancelledRef.current = false
    setCaptionRevealed(0)
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
  }, [greeting.lineId, playLine])

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

  // ── Parent-gate long-press --------------------------------------------

  const handleParentGateComplete = useCallback(() => {
    onParentGate?.()
  }, [onParentGate])

  const parentGateProps = useParentGateLongPress({
    onComplete: handleParentGateComplete,
  })

  // ── Node-tap handler ---------------------------------------------------

  const handleNodeTap = useCallback(
    (tree: SkillTreeId) => {
      // Cancel any in-flight greeting.
      cancelledRef.current = true
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
    [history, suggestion, now, storage, onPickTree, gestureUnlocked],
  )

  // ── First-tap audio unlock for the app-open path ----------------------

  const handleFirstTap = useCallback(() => {
    if (gestureUnlocked) return
    setGestureUnlocked(true)
  }, [gestureUnlocked])

  // ── Recent-stats visibility -------------------------------------------

  const showStardustToday = isLastSessionRecent(
    history.lastSessionCompletedAt,
    now(),
  )
  const showStreak = shouldShowDayStreak(
    history.dayStreak,
    history.lastSessionCompletedAt,
    now(),
  )
  const showRecentStats = showStardustToday || showStreak

  // ── Render ------------------------------------------------------------

  return (
    <m.main
      data-testid="hub"
      data-path={path}
      data-suggestion={suggestion ?? 'none'}
      data-suppressed={suppressed ? 'true' : 'false'}
      onPointerDown={handleFirstTap}
      className="
        relative flex h-full w-full flex-col
        bg-my-cream text-ink
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
        overflow-hidden
      "
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Pastel meadow wash (placeholder — Kyle's bg-meadow.svg lands via
          ticket 86c9j53yx). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 30%, rgba(186,222,255,0.45) 0%, rgba(255,250,242,0) 60%), linear-gradient(180deg, #FFFAF2 0%, #FFF5E6 100%)',
        }}
      />

      {/* HUD strip — cumulative stardust left, invisible parent-gate
          zone top-right. */}
      <div
        data-testid="hub-hud"
        className="relative flex h-14 w-full items-center justify-between px-4"
      >
        <div
          data-testid="hub-cumulative-stardust"
          data-total={history.cumulativeStardust}
          className="flex items-center gap-2 font-display text-3xl text-ink"
        >
          <SparkleGlyph />
          <span aria-label={`Stardust: ${history.cumulativeStardust}`}>
            {history.cumulativeStardust}
          </span>
        </div>

        {/* Invisible parent-gate corner. 96×96pt; no glyph, no
            affordance. Spec: aria-hidden, tabIndex omitted so screen
            readers / Marian's assistive tech don't surface it. */}
        <div
          data-testid="hub-parent-gate"
          aria-hidden
          className="absolute right-0 top-0"
          style={{
            width: '96pt',
            height: '96pt',
            // Pure invisible touch target — no background, no border.
          }}
          {...parentGateProps}
        />
      </div>

      {/* Emma centred-upper, ~22vh. layoutId carries from / to other
          screens via Framer Motion's shared-element transition. */}
      <div className="pointer-events-none flex h-[22vh] w-full items-center justify-center">
        <m.img
          layoutId="emma"
          data-testid="hub-emma"
          src="/assets/emma-idle.svg"
          alt="Emma"
          draggable={false}
          className="h-full w-auto select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Speech ribbon — same word-by-word reveal pattern as
          Greet/Math/Session-End. */}
      <div className="flex min-h-[3.5rem] items-start justify-center px-6">
        <AnimatePresence>
          {showRibbon && (
            <m.div
              key={greeting.lineId ?? 'no-line'}
              data-testid="hub-ribbon"
              role="status"
              aria-live="polite"
              className="
                rounded-3xl border-[3px] border-my-pink bg-white
                px-6 py-2
                shadow-[0_8px_24px_rgba(244,143,177,0.18)]
                text-center
              "
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <p
                data-testid="hub-caption"
                className="font-display text-[1.6rem] leading-snug text-ink"
              >
                {captionWords.map((word, i) => (
                  <m.span
                    key={`hub-w-${i}`}
                    data-testid="hub-caption-word"
                    data-revealed={i < captionRevealed ? 'true' : 'false'}
                    className="inline-block"
                    style={{
                      marginRight: i === captionWords.length - 1 ? 0 : '0.4em',
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
      </div>

      {/* Skill-tree picker — two nodes side-by-side. */}
      <div className="flex flex-1 items-center justify-center gap-7 px-4">
        <SkillTreeNode
          tree="number-garden"
          label="Number Garden"
          signature={<NumberGardenSignature />}
          stages={NUMBER_GARDEN_STAGES}
          currentIndex={progress.numberGardenIndex}
          suggested={suggestion === 'number-garden'}
          onTap={() => handleNodeTap('number-garden')}
        />
        <SkillTreeNode
          tree="word-song"
          label="Word Song"
          signature={<WordSongSignature />}
          stages={WORD_SONG_STAGES}
          currentIndex={progress.wordSongIndex}
          suggested={suggestion === 'word-song'}
          onTap={() => handleNodeTap('word-song')}
        />
      </div>

      {/* Recent-stats strip — fixed-slot height; renders empty when no
          values qualify so the layout doesn't reflow. */}
      <div
        data-testid="hub-recent-stats"
        data-visible={showRecentStats ? 'true' : 'false'}
        className="flex h-[8vh] w-full items-center justify-center gap-8 px-4"
      >
        {showStardustToday && (
          <div
            data-testid="hub-stardust-today"
            data-value={history.lastSessionStardust}
            className="flex flex-col items-center"
          >
            <div className="flex items-center gap-1 font-display text-2xl text-my-rose">
              <SparkleGlyph />
              <span>{history.lastSessionStardust}</span>
            </div>
            <span className="font-display text-sm text-ink/70">
              today's session
            </span>
          </div>
        )}
        {showStreak && (
          <div
            data-testid="hub-day-streak"
            data-value={history.dayStreak}
            className="flex flex-col items-center"
          >
            <div className="flex items-center gap-1 font-display text-2xl text-my-rose">
              {/* Sparkle glyph — same indicator the rest of the UI
                  uses for streaks (see Dave PR #38 streak-glyph
                  decision; the alternative would have triggered the
                  ambient-warmth dark pattern Mammarella et al. flag).
                  The text below ("day streak") disambiguates it from
                  the stardust-today sparkle to its left. */}
              <SparkleGlyph />
              <span>{history.dayStreak}</span>
            </div>
            <span className="font-display text-sm text-ink/70">day streak</span>
          </div>
        )}
      </div>
    </m.main>
  )
}

// ── SkillTreeNode subcomponent ─────────────────────────────────────────

interface SkillTreeNodeProps {
  tree: SkillTreeId
  label: string
  signature: ReactElement
  stages: readonly StageId[]
  currentIndex: number
  suggested: boolean
  onTap: () => void
}

function SkillTreeNode({
  tree,
  label,
  signature,
  stages,
  currentIndex,
  suggested,
  onTap,
}: SkillTreeNodeProps): ReactElement {
  const window5 = useMemo(
    () => slidingWindow(stages, currentIndex, 5),
    [stages, currentIndex],
  )

  return (
    <m.button
      type="button"
      data-testid="hub-tree-node"
      data-tree={tree}
      data-suggested={suggested ? 'true' : 'false'}
      onClick={onTap}
      aria-label={label}
      className={[
        'flex flex-col items-center justify-between',
        'rounded-[32px] bg-white px-6 py-6',
        'shadow-[0_8px_24px_rgba(244,143,177,0.20)]',
        'select-none touch-manipulation',
        suggested
          ? 'border-2 border-my-rose ring-2 ring-my-rose/30'
          : 'border border-my-pink/40',
      ].join(' ')}
      style={{ width: '280pt', height: '280pt' }}
      initial={{ scale: 1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <div className="flex h-20 items-center justify-center">{signature}</div>
      <span
        data-testid="hub-tree-label"
        className="font-display text-2xl text-ink"
      >
        {label}
      </span>
      <div
        data-testid="hub-path-strip"
        data-tree={tree}
        className="flex items-center justify-center gap-1.5"
      >
        {window5.items.map((stage, i) => {
          const absoluteIdx = window5.offset + i
          let kind: 'mastered' | 'in-progress' | 'current' | 'locked'
          if (absoluteIdx < currentIndex) kind = 'mastered'
          else if (absoluteIdx === currentIndex) kind = 'current'
          else kind = 'locked'
          return (
            <span
              key={stage}
              className="inline-flex items-center"
              data-testid="hub-path-strip-cell"
              data-stage={stage}
              data-kind={kind}
            >
              <StageIcon
                stage={stage as StageId}
                kind={kind}
                shimmering={kind === 'current'}
              />
              {i < window5.items.length - 1 && (
                <span
                  aria-hidden
                  className="mx-1 inline-block h-px w-3"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, currentColor 50%, transparent 50%)',
                    backgroundSize: '4px 1px',
                    color: kind === 'mastered' ? '#E91E63' : '#F8BBD0',
                  }}
                />
              )}
            </span>
          )
        })}
      </div>
    </m.button>
  )
}

// ── Inline SVG signatures (placeholders — real assets via 86c9j53yx) ───

function NumberGardenSignature(): ReactElement {
  return (
    <svg
      viewBox="0 0 120 64"
      width="120"
      height="64"
      role="presentation"
      aria-hidden
      data-testid="hub-signature-number-garden"
    >
      {[20, 60, 100].map((cx, i) => (
        <g key={cx} transform={`rotate(${(i - 1) * 8} ${cx} 32)`}>
          {/* 6 petals around a centre */}
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <ellipse
              key={deg}
              cx={cx}
              cy={32}
              rx="6"
              ry="14"
              fill={i === 1 ? '#F48FB1' : '#FFC1CC'}
              transform={`rotate(${deg} ${cx} 32)`}
            />
          ))}
          <circle cx={cx} cy={32} r="6" fill="#FFEB3B" />
        </g>
      ))}
    </svg>
  )
}

function WordSongSignature(): ReactElement {
  return (
    <svg
      viewBox="0 0 120 64"
      width="120"
      height="64"
      role="presentation"
      aria-hidden
      data-testid="hub-signature-word-song"
    >
      {/* Three music notes — heads + stems, gently tilted. */}
      {[
        { x: 18, y: 38, tilt: -6 },
        { x: 56, y: 30, tilt: 4 },
        { x: 96, y: 42, tilt: -2 },
      ].map((n, i) => (
        <g key={i} transform={`rotate(${n.tilt} ${n.x} ${n.y})`} fill="#9C27B0">
          <ellipse cx={n.x} cy={n.y} rx="8" ry="6" />
          <rect x={n.x + 6} y={n.y - 22} width="2" height="24" />
        </g>
      ))}
    </svg>
  )
}

function SparkleGlyph(): ReactElement {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="#FFD966"
      stroke="#E0B800"
      strokeWidth="0.6"
      aria-hidden
    >
      <path d="M12 2 L13.6 9.4 L21 11 L13.6 12.6 L12 20 L10.4 12.6 L3 11 L10.4 9.4 Z" />
    </svg>
  )
}
