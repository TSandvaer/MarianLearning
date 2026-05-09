/**
 * Screen 5 -- Session End.
 *
 * Spec: `design/screen-5-session-end.md`
 *
 * Mounts after problem 8 on either Math or Word Song. Shows a calm,
 * predictable closing moment: stardust count-up, optional streak band,
 * spoken goodbye via Path A TTS, and a single "All done!" CTA that leads
 * to the Option C sleep splash.
 *
 * This is NOT a results screen or a report card. It celebrates "you did
 * the thing" without quantifying wrongs, ranking against past self, or
 * dangling a re-engagement nudge.
 *
 * Audio contract
 * --------------
 * All TTS is routed through `playUtteranceFn` (backed by
 * `sessionAudio.playSessionUtterance` in production). The session-start
 * audio bundle includes all Session-End utterances pre-rendered. This
 * screen does NOT use `lib/tts.speak()` or `preRecorded.playGreetLine()`.
 *
 * The audio context is already gesture-unlocked from the last tap on
 * Math/Word Song's problem 8. `useAudioUnlockGate` is NOT used here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { createSfx, type Sfx } from '../../lib/sfx'
import { cancelSessionAudio } from '../../lib/audio'
import type { PlaySessionUtteranceOptions } from '../../lib/audio'
import StardustCounter from './StardustCounter'
import StreakBand from './StreakBand'
import SleepSplash from './SleepSplash'
import { recordSessionEnd } from './sessionHistory'
import { recordProgressOnSessionEnd } from './progressHistory'
import {
  defaultProgress,
  isGraduationSessionPending,
  loadProgress,
  pickFocusNode,
  type Progress,
  type ProgressTrack,
  type SkillNode,
} from '../../lib/progress'
import { WORD_SONG_NOVEL_PROBE_WORDS } from '../../../api/_plannerWordList'
import type { GraduationSessionSplit, LeitnerOutcome } from './progressHistory'
import type { StorageAdapter } from '../Math/stardust'
import {
  WORDSONG_SESSION_END_BONUS,
  grantWordSongCompletionBonus,
} from '../_shared/wordSongCompletionBonus'
import type { ReactElement } from 'react'

// ── Public types ------------------------------------------------------------

export type SessionEndSurface = 'math' | 'word-song'

export interface SessionEndPayload {
  totalCorrect: number
  totalStardust: number
  finalStreak: number
  earnedThisSession: number
  surface: SessionEndSurface
  /**
   * Per-problem clean-win outcome.
   *
   * Original use (ticket 86c9m3aec — word-song graduation): the screen
   * computes the canonical/novel pool split for graduation-session
   * accounting.
   *
   * Extended use (ticket 86c9pwgc8 — M4 Leitner wiring, math): the
   * screen forwards this into `recordProgressOnSessionEnd` so the
   * progress write path can promote / demote each session's facts in
   * `mathFactsLeitner`. Both surfaces emit the field now.
   */
  perProblemCorrect?: readonly boolean[]
  /**
   * Target word per problem (lowercase). Word-song only; undefined for
   * math. Cross-references against
   * `WORD_SONG_NOVEL_PROBE_WORDS` to determine the canonical/novel
   * split.
   */
  targetWords?: readonly string[]
  /**
   * Per-problem first-tap latency in milliseconds, indexed 0..N-1
   * (math only — ticket 86c9pwgc8 M4). Sentinel `-1` means the
   * problem was never tapped. Forwarded into the progress write path
   * for persistence on `SessionHistoryEntry.latencyMs`. Word-song
   * sessions don't ship this field today.
   */
  latencyMs?: readonly number[]
  /**
   * Per-problem math fact, indexed 0..N-1 (math only — ticket
   * 86c9pwgc8 M4). Each entry mirrors the corresponding
   * `MathProblem.{addendA, addendB, correct}` so SessionEnd can map
   * `perProblemCorrect[i]` to a Leitner-box fact key without re-
   * deriving from the audio plan. Word-song sessions don't ship this
   * field; literacy has no Leitner box in v1.
   */
  mathFacts?: readonly { a: number; b: number; op: '+' | '-' | '*' }[]
}

/**
 * Signature for playing one pre-rendered session-end utterance by id.
 * Backed by `sessionAudio.playSessionUtterance` in production.
 */
export type PlayUtteranceFn = (
  utteranceId: string,
  opts?: PlaySessionUtteranceOptions,
) => Promise<void>

export interface SessionEndProps {
  /** Payload from the originating screen's `onSessionComplete`. */
  payload: SessionEndPayload | null
  /**
   * Optional: fires when Marian taps "All done!". When provided, the
   * screen routes to Hub via this handler instead of falling through
   * to the legacy Sleep splash. Wired by App.tsx as part of the Hub
   * navigation contract (`design/screen-hub.md` § "Q4: Session-End →
   * Hub flip"). When `undefined` the legacy Sleep-splash path runs —
   * preserved for unit tests + the dark-launch fallback Thomas
   * approves.
   */
  onAllDone?: () => void
  /** Test seam: replace the live Path A playback function. */
  playUtteranceFn?: PlayUtteranceFn
  /** Test seam: replace chime SFX. */
  chime?: Sfx
  /** Test seam: replace sparkle SFX. */
  sparkle?: Sfx
  /** Test seam: replace plink SFX. */
  plink?: Sfx
  /** Test seam: replace localStorage adapter. */
  storage?: StorageAdapter
  /** Test seam: clock injection. */
  now?: () => Date
}

// ── Sequence phases ---------------------------------------------------------

type Phase =
  | 'opener' // t=0: "You did it!" + sparkle burst
  | 'recap' // t~1400: stardust count-up + "You earned N stars!"
  | 'streak' // t~3400: streak band (if finalStreak >= 3)
  | 'goodbye' // t~5000: "See you soon."
  | 'settled' // t~6200: CTA visible, idle
  | 'sleep-splash' // post-CTA-tap

// ── Timing constants (spec section "Audio dispatch sequence") ---------------

const OPENER_DELAY_MS = 0
const RECAP_DELAY_MS = 1400
const STREAK_DELAY_MS = 3400
const GOODBYE_DELAY_MS = 5000
const CTA_DELAY_MS = 6200
const FALLBACK_CTA_DELAY_MS = 4000

// ── Spring presets (spec section "Motion") ----------------------------------

const RIBBON_SPRING = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 20,
}

const CTA_SPRING = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 16,
}

// ── Reduce-motion hook (copied from Greet pattern) --------------------------

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (ev: MediaQueryListEvent) => setReduced(ev.matches)
    if (mq.addEventListener) {
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    return undefined
  }, [])

  return reduced
}

// ── Component ---------------------------------------------------------------

export default function SessionEnd({
  payload,
  onAllDone,
  playUtteranceFn,
  chime: chimeProp,
  sparkle: sparkleProp,
  plink: plinkProp,
  storage,
  now,
}: SessionEndProps): ReactElement {
  const reducedMotion = usePrefersReducedMotion()

  // Normalise the payload per the backwards-compat shim (spec line 96-102)
  const p = useMemo(() => {
    if (!payload) {
      return {
        totalCorrect: 0,
        totalStardust: 0,
        finalStreak: 0,
        earnedThisSession: 0,
        surface: 'math' as const,
      }
    }
    return {
      ...payload,
      surface: payload.surface ?? ('math' as const),
    }
  }, [payload])

  /**
   * Word-song completion bonus (ticket 86c9kwvza, locked 2026-05-02).
   *
   * Per Dave's audit, word-song stardust moved from per-correct-tap to
   * per-session-end. WordSong no longer mutates the stardust store while
   * Marian is playing; the flat `+WORDSONG_SESSION_END_BONUS` is granted
   * here, in the mount effect, alongside the other session-end persistence
   * writes. Math is unchanged — its grants land per-correct inside Math.tsx.
   *
   * `displayedTotalStardust` is what the counter ticks up to AND what the
   * `data-total-stardust` data-attribute exposes for QA. For math it equals
   * `payload.totalStardust` (already includes the in-session grants). For
   * word-song it equals `payload.totalStardust + WORDSONG_SESSION_END_BONUS`
   * because the bonus has not yet been folded into the payload at the point
   * Marian's last chip-tap fires `onSessionComplete`.
   */
  const wordSongCompletionGrant =
    p.surface === 'word-song' ? WORDSONG_SESSION_END_BONUS : 0
  const displayedTotalStardust = p.totalStardust + wordSongCompletionGrant
  const displayedEarnedThisSession =
    p.surface === 'word-song' ? wordSongCompletionGrant : p.earnedThisSession

  // ── SFX instances (lazy-init, one per mount) ----------------------------

  const [chimeInstance] = useState<Sfx>(
    () =>
      chimeProp ??
      createSfx({ src: '/assets/sfx-chime-soft.mp3', volume: 0.85 }),
  )
  const [sparkleInstance] = useState<Sfx>(
    () =>
      sparkleProp ?? createSfx({ src: '/assets/sfx-sparkle.mp3', volume: 0.7 }),
  )
  const [plinkInstance] = useState<Sfx>(
    () => plinkProp ?? createSfx({ src: '/assets/sfx-plink.mp3', volume: 0.6 }),
  )

  // ── Phase state machine -------------------------------------------------

  const [phase, setPhase] = useState<Phase>('opener')
  const [captionText, setCaptionText] = useState('')
  const [captionRevealed, setCaptionRevealed] = useState(0)
  const [showStardustCounter, setShowStardustCounter] = useState(false)
  const [showStreakBand, setShowStreakBand] = useState(false)
  const [showCta, setShowCta] = useState(false)
  const [ctaTapping, setCtaTapping] = useState(false)

  // Refs for timer cleanup
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const audioFailedRef = useRef(false)

  const addTimer = useCallback((cb: () => void, ms: number) => {
    const id = setTimeout(() => {
      // Remove from the tracked list
      timersRef.current = timersRef.current.filter((t) => t !== id)
      cb()
    }, ms)
    timersRef.current.push(id)
    return id
  }, [])

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) clearTimeout(id)
    timersRef.current = []
  }, [])

  // ── Persist session history on mount (spec section "localStorage") ------
  //
  // Two writes land here, both gated to mount-once:
  //   1. `recordSessionEnd` -> `marian-tutor.session-history.v1` (Hub stats:
  //      session count, day-streak, lastPlayed, etc.)
  //   2. `recordProgressOnSessionEnd` -> `marian-tutor:progress:v1` (adaptive
  //      engine plumbing: rolling SessionHistoryEntry list capped at 30, plus
  //      profile.lastPlayedISO). Ticket 86c9kmu63 is the first production
  //      caller of `saveProgress` — until now the progress blob was only
  //      exercised by unit tests.
  //
  // Both writes use the same wall-clock instant for clean cross-payload
  // correlation. The progress write goes through its own helper so the
  // SessionEnd component stays UI-only; the helper handles `loadProgress
  // ?? defaultProgress()` and the `MAX_SESSION_HISTORY=30` trim is enforced
  // inside `saveProgress`.

  useEffect(() => {
    const clock = now ?? (() => new Date())
    const dateISO = clock().toISOString()
    // Word-song completion bonus (ticket 86c9kwvza). Persists FIRST so
    // `recordSessionEnd` (which reads stardust to compute Hub's
    // `cumulativeStardust` field) sees the post-bonus total — otherwise
    // Hub would understate cumulative stardust for word-song sessions.
    if (p.surface === 'word-song') {
      grantWordSongCompletionBonus(storage, now)
    }
    recordSessionEnd(p.finalStreak, storage, now)
    // P0.2 fix (audit follow-up to PR #120): derive the focus node the
    // just-completed session targeted, instead of writing a hardcoded
    // surface-keyed constant. Reads `loadProgress()` and runs the same
    // `pickFocusNode` selector App.tsx uses at session-start fetch time.
    // `skillLevels` cannot have shifted between session-start and now —
    // `applyMasteryRule()` only runs INSIDE `recordProgressOnSessionEnd`
    // (the very next call), so the value here is exactly what the
    // planner saw. Without this fix, M3 silently caps after one
    // promotion hop because new history entries keep claiming the old
    // focus node forever (audit:
    // `design/audits/2026-05-02-polish/jessica-qa-edge-cases.md` P0.2).
    const progressForFocus = loadProgress() ?? defaultProgress()
    const track = trackForSurface(p.surface)
    const focusNode = pickFocusNode(progressForFocus, track)
    // 86c9m3aec: graduation-session split computation. Lives at the
    // session-end persistence boundary because:
    //   1. We need to read `loadProgress()` at the same instant we
    //      record — same `progressForFocus` snapshot used for focus
    //      derivation.
    //   2. The `WordSongSessionResult.targetWords / perProblemCorrect`
    //      shipped from the screen carries the per-problem state
    //      needed to compute the split.
    //
    // Two-step verification: (a) the engine flagged the upcoming
    // session as graduation when the planner request was issued, AND
    // (b) the rendered plan actually contained novel-pool words. The
    // second check guards the fallback path — if the live planner
    // failed and the static `STATIC_WORD_SONG_PLANS` rotation served
    // the screen, no novel words were used and we must NOT compute a
    // split (would mis-classify a fallback session as failed graduation).
    const graduationSplit = computeGraduationSplit(
      progressForFocus,
      track,
      focusNode,
      p,
    )
    // M4 Leitner outcomes (ticket 86c9pwgc8). Math sessions ship
    // `mathFacts` + `perProblemCorrect`; SessionEnd zips them into
    // `LeitnerOutcome[]` so the progress writer can promote / demote
    // each fact. Word-song sessions never ship `mathFacts` (no
    // Leitner box on literacy in v1) so the field stays absent.
    let leitnerOutcomes: ReturnType<typeof buildLeitnerOutcomes> = undefined
    if (
      p.surface === 'math' &&
      p.mathFacts !== undefined &&
      p.perProblemCorrect !== undefined
    ) {
      leitnerOutcomes = buildLeitnerOutcomes(p.mathFacts, p.perProblemCorrect)
    }

    recordProgressOnSessionEnd({
      surface: p.surface,
      totalCorrect: p.totalCorrect,
      dateISO,
      focusNode,
      ...(graduationSplit !== null ? { graduationSplit } : {}),
      ...(leitnerOutcomes !== undefined ? { leitnerOutcomes } : {}),
      // Latency persistence (ticket 86c9pwgc8 — M4). Math only;
      // word-song doesn't ship `latencyMs` today.
      ...(p.surface === 'math' && p.latencyMs !== undefined
        ? { latencyMs: p.latencyMs }
        : {}),
      // mathFacts persistence (M4.x slow-fact directive — follow-up
      // to 86c9pwgc8). Math only; word-song has no Leitner box on
      // literacy in v1. Persisted as a parallel array to `latencyMs`
      // so the slow-fact session-gen hint can join latency to a
      // concrete fact key without re-deriving from the audio plan.
      ...(p.surface === 'math' && p.mathFacts !== undefined
        ? { mathFacts: p.mathFacts }
        : {}),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Play utterance helper (tolerant of missing fn) ----------------------

  const playUtterance = useCallback(
    (
      utteranceId: string,
      opts?: PlaySessionUtteranceOptions,
    ): Promise<void> => {
      if (!playUtteranceFn) {
        // Silent fallback: fire onPlay immediately, tick words linearly
        // at 165 wpm so caption still reveals. Matches Math's default.
        return new Promise<void>((resolve) => {
          opts?.onPlay?.()
          opts?.onWordTick?.(0)
          resolve()
        })
      }
      return playUtteranceFn(utteranceId, opts)
    },
    [playUtteranceFn],
  )

  // ── Orchestrate the TTS sequence on mount -------------------------------

  useEffect(() => {
    // Fallback timer: surface CTA even if all audio fails
    const fallbackTimerId = addTimer(() => {
      if (!showCta) {
        setShowCta(true)
        setPhase('settled')
      }
    }, FALLBACK_CTA_DELAY_MS)

    // t=0: Opener -- "You did it!"
    const runSequence = async () => {
      try {
        // Play sparkle SFX on entry
        sparkleInstance.play()

        // Play opener utterance
        setPhase('opener')
        await new Promise<void>((resolve, reject) => {
          const timer = addTimer(() => {
            playUtterance('session.end.opener', {
              onPlay: () => {
                // Cancel the fallback timer -- audio is working
                clearTimeout(fallbackTimerId)
                timersRef.current = timersRef.current.filter(
                  (t) => t !== fallbackTimerId,
                )
              },
              onWordTick: (wordIndex) => {
                setCaptionText('You did it!')
                setCaptionRevealed(wordIndex + 1)
              },
            })
              .then(resolve)
              .catch(reject)
          }, OPENER_DELAY_MS)
          // If timer never fires (shouldn't happen but be defensive)
          if (timer === undefined) resolve()
        })
      } catch (err) {
        console.warn('[SessionEnd] opener utterance failed:', err)
        audioFailedRef.current = true
      }

      // t=1400: Recap -- copy is surface-dependent.
      //
      //   - math: "You earned N stars!" where N = totalStardust (unchanged).
      //     Utterance id `session.end.recap.<N>` is in the planner bundle.
      //   - word-song (ticket 86c9kwvza): "You earned 5 stars for finishing!"
      //     Copy is fixed — the +5 is the completion bonus, not a function
      //     of how many problems Marian got right. Utterance id
      //     `session.end.recap.wordsong-completion` is a NEW id; until the
      //     planner's audio bundle includes it, the silent fallback (which
      //     fires `onWordTick(0)` once) keeps the caption pipeline alive
      //     and the existing graceful-degradation path bridges the audio.
      //
      // Skip-when-zero only applies to math (word-song always has a +5
      // grant to celebrate, even on a session where Marian got 0 correct).
      try {
        setPhase('recap')
        setShowStardustCounter(true)

        if (p.surface === 'word-song') {
          await new Promise<void>((resolve) => {
            addTimer(
              () => {
                const recapId = 'session.end.recap.wordsong-completion'
                const copy = `You earned ${numberToWord(WORDSONG_SESSION_END_BONUS)} stars for finishing!`
                playUtterance(recapId, {
                  onWordTick: (wordIndex) => {
                    setCaptionText(copy)
                    setCaptionRevealed(wordIndex + 1)
                  },
                })
                  .then(resolve)
                  .catch((err) => {
                    console.warn('[SessionEnd] recap utterance failed:', err)
                    resolve()
                  })
              },
              RECAP_DELAY_MS - (OPENER_DELAY_MS > 0 ? OPENER_DELAY_MS : 0),
            )
          })
        } else if (p.totalStardust > 0) {
          await new Promise<void>((resolve) => {
            addTimer(
              () => {
                const recapId = `session.end.recap.${p.totalStardust}`
                playUtterance(recapId, {
                  onWordTick: (wordIndex) => {
                    const starWord =
                      p.totalStardust === 1
                        ? `You earned one star!`
                        : `You earned ${numberToWord(p.totalStardust)} stars!`
                    setCaptionText(starWord)
                    setCaptionRevealed(wordIndex + 1)
                  },
                })
                  .then(resolve)
                  .catch((err) => {
                    console.warn('[SessionEnd] recap utterance failed:', err)
                    resolve()
                  })
              },
              RECAP_DELAY_MS - (OPENER_DELAY_MS > 0 ? OPENER_DELAY_MS : 0),
            )
          })
        } else {
          // Zero stardust on math: skip the recap line but wait the gap.
          await new Promise<void>((resolve) => {
            addTimer(resolve, RECAP_DELAY_MS)
          })
        }
      } catch {
        // Swallow -- continue sequence
      }

      // t=3400: Streak -- "N in a row! Wow!" (only if finalStreak >= 3)
      if (p.finalStreak >= 3) {
        try {
          setPhase('streak')
          setShowStreakBand(true)

          await new Promise<void>((resolve) => {
            addTimer(() => {
              const streakId = `session.end.streak.${p.finalStreak}`
              playUtterance(streakId, {
                onWordTick: (wordIndex) => {
                  setCaptionText(`${p.finalStreak} in a row! Wow!`)
                  setCaptionRevealed(wordIndex + 1)
                },
              })
                .then(resolve)
                .catch((err) => {
                  console.warn('[SessionEnd] streak utterance failed:', err)
                  resolve()
                })
            }, STREAK_DELAY_MS - RECAP_DELAY_MS)
          })
        } catch {
          // Swallow -- continue sequence
        }
      }

      // t=5000: Goodbye -- "See you soon."
      try {
        setPhase('goodbye')
        await new Promise<void>((resolve) => {
          const baseDelay =
            p.finalStreak >= 3
              ? GOODBYE_DELAY_MS - STREAK_DELAY_MS
              : GOODBYE_DELAY_MS - RECAP_DELAY_MS
          addTimer(() => {
            playUtterance('session.end.goodbye', {
              onPlay: () => {
                // Cancel fallback timer if it somehow survived
                clearTimeout(fallbackTimerId)
              },
              onWordTick: (wordIndex) => {
                setCaptionText('See you soon.')
                setCaptionRevealed(wordIndex + 1)
              },
            })
              .then(resolve)
              .catch((err) => {
                console.warn('[SessionEnd] goodbye utterance failed:', err)
                resolve()
              })
          }, baseDelay)
        })
      } catch {
        // Swallow
      }

      // t=6200: CTA appears
      const settledDelay = CTA_DELAY_MS - GOODBYE_DELAY_MS
      addTimer(() => {
        setPhase('settled')
        setShowCta(true)
        // Clear caption after goodbye settles
        setCaptionText('')
        setCaptionRevealed(0)
      }, settledDelay)
    }

    void runSequence()

    return () => {
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cleanup SFX on unmount ----------------------------------------------

  useEffect(() => {
    return () => {
      chimeInstance.unload()
      sparkleInstance.unload()
      plinkInstance.unload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── CTA tap handler -----------------------------------------------------

  const handleCtaTap = useCallback(() => {
    if (phase === 'sleep-splash') return

    setCtaTapping(true)
    chimeInstance.play()

    // Cancel any in-flight TTS
    cancelSessionAudio()

    // Hub-route flip (`design/screen-hub.md` § Q4): when the orchestrator
    // wires `onAllDone`, route to Hub instead of falling through to the
    // legacy Sleep splash. The chime + scale tween still play; only the
    // post-300ms destination changes. When `onAllDone` is undefined,
    // legacy Sleep splash renders — preserves existing tests + supports
    // a dark-launch fallback if Thomas opts for one.
    if (onAllDone) {
      addTimer(() => {
        onAllDone()
      }, 300)
      return
    }

    // Fade to sleep splash after 300ms (legacy path).
    addTimer(() => {
      setPhase('sleep-splash')
    }, 300)
  }, [phase, chimeInstance, addTimer, onAllDone])

  // ── Sparkle particles (entry burst) -------------------------------------
  // Positions are generated once via useState lazy initializer. This avoids
  // both the useMemo react-hooks/purity violation (Math.random) and the
  // useRef react-hooks/refs violation (reading .current during render).

  const [sparkleParticles] = useState(() =>
    generateSparkleParticles(reducedMotion),
  )

  // ── Render ----------------------------------------------------------------

  const showRibbon = captionText.length > 0

  return (
    <m.main
      data-testid="session-end"
      data-surface={p.surface}
      data-phase={phase}
      data-total-stardust={displayedTotalStardust}
      data-earned={displayedEarnedThisSession}
      data-final-streak={p.finalStreak}
      data-completion-bonus={wordSongCompletionGrant}
      className="
        relative flex h-full w-full flex-col items-center
        bg-my-cream text-ink
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
        overflow-hidden
      "
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Twilight wash background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 35%, rgba(230,210,245,0.5) 0%, rgba(255,245,250,0) 60%), linear-gradient(180deg, #FFF5FA 0%, #F5EDF7 100%)',
        }}
      />

      {/* Emma celebrating -- centered, ~38vh */}
      <div className="pointer-events-none relative flex h-[38vh] w-full items-center justify-center">
        {/* Sparkle burst on entry */}
        <AnimatePresence>
          {phase !== 'sleep-splash' &&
            sparkleParticles.map((particle) => (
              <m.div
                key={`sparkle-${particle.id}`}
                aria-hidden
                className="absolute"
                initial={{ opacity: 1, x: 0, y: 0, scale: 0.5 }}
                animate={
                  reducedMotion
                    ? { opacity: [1, 0], scale: 0.5 }
                    : {
                        opacity: [1, 0],
                        x: particle.x,
                        y: particle.y,
                        scale: [0.5, 1, 0],
                      }
                }
                transition={{
                  duration: 1.2,
                  delay: particle.delay,
                  ease: 'easeOut',
                }}
              >
                <SparkleParticle />
              </m.div>
            ))}
        </AnimatePresence>

        {/* Emma image -- uses emma-cheering.svg (the canonical
            big-celebration pose, BOTH hands raised; reserved for
            Session-End and never used per-problem). Replaces the legacy
            melody-cheering.svg in the Phase 3b character pivot
            (ticket 86c9jccp7). */}
        <AnimatePresence initial={false}>
          <m.img
            layoutId="emma"
            key="celebrating"
            data-testid="session-end-emma"
            src="/assets/emma-cheering.svg"
            alt="Emma celebrating"
            draggable={false}
            className="absolute h-full w-auto select-none"
            initial={
              reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }
            }
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            transition={
              reducedMotion
                ? { duration: 0.3 }
                : {
                    type: 'spring',
                    stiffness: 180,
                    damping: 20,
                  }
            }
          />
        </AnimatePresence>
      </div>

      {/* Speech ribbon -- identical pattern to Greet/Math caption */}
      {showRibbon && (
        <m.div
          data-testid="session-end-ribbon"
          role="status"
          aria-live="polite"
          className="
            mx-auto mt-2 mb-4 w-[88%] max-w-2xl
            rounded-3xl border-[3px] border-my-pink bg-white
            px-6 py-3
            shadow-[0_8px_24px_rgba(244,143,177,0.18)]
            text-center
          "
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reducedMotion ? { duration: 0.3 } : RIBBON_SPRING}
        >
          <p
            data-testid="session-end-caption"
            className="font-display text-[2.4rem] leading-snug text-ink"
          >
            {renderCaption(captionText, captionRevealed)}
          </p>
        </m.div>
      )}

      {/* Stardust counter -- ~14vh band. For word-song, the displayed
          total includes the +5 completion bonus so Marian sees the post-
          grant number tick up. Math is unchanged. */}
      <div className="flex h-[14vh] items-center justify-center">
        <StardustCounter
          totalStardust={displayedTotalStardust}
          active={showStardustCounter}
          plink={plinkInstance}
          reducedMotion={reducedMotion}
        />
      </div>

      {/* Streak band -- ~10vh, fixed height even when hidden */}
      <StreakBand
        finalStreak={p.finalStreak}
        visible={showStreakBand}
        reducedMotion={reducedMotion}
      />

      {/* Spacer -- ~8vh breathing room */}
      <div className="h-[8vh]" aria-hidden />

      {/* "All done!" CTA -- ~12vh bottom band, thumb-zone */}
      <div className="flex h-[12vh] w-full items-center justify-center">
        <AnimatePresence>
          {showCta && phase !== 'sleep-splash' && (
            <m.button
              key="cta-all-done"
              data-testid="session-end-cta"
              type="button"
              aria-label="All done!"
              onClick={handleCtaTap}
              className="
                flex select-none items-center justify-center gap-2
                rounded-full border-[3px] border-my-pink bg-white
                px-10 font-display text-[2rem] text-my-rose
                shadow-[0_6px_20px_rgba(244,143,177,0.25)]
                active:scale-95
                touch-manipulation
              "
              style={{
                height: '88pt',
                minWidth: '220pt',
              }}
              initial={
                reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }
              }
              animate={
                ctaTapping
                  ? { opacity: 1, scale: [1, 0.95, 1] }
                  : reducedMotion
                    ? { opacity: 1 }
                    : { opacity: 1, scale: 1 }
              }
              exit={{ opacity: 0 }}
              transition={
                ctaTapping
                  ? { duration: 0.2, ease: 'easeOut' }
                  : reducedMotion
                    ? { duration: 0.2 }
                    : CTA_SPRING
              }
            >
              <span aria-hidden>&#x2713;</span>
              <span>All done!</span>
            </m.button>
          )}
        </AnimatePresence>
      </div>

      {/* Sleep splash overlay (Option C) */}
      <AnimatePresence>
        {phase === 'sleep-splash' && <SleepSplash key="sleep-splash" />}
      </AnimatePresence>
    </m.main>
  )
}

// ── Helpers -----------------------------------------------------------------

/** Render caption text with word-by-word reveal. Same pattern as Greet. */
function renderCaption(text: string, revealedCount: number): ReactElement[] {
  const words = text.split(/\s+/).filter(Boolean)
  return words.map((word, i) => (
    <m.span
      key={`caption-${i}`}
      data-testid="session-end-caption-word"
      data-revealed={i < revealedCount ? 'true' : 'false'}
      className="inline-block"
      style={{ marginRight: i === words.length - 1 ? 0 : '0.4em' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: i < revealedCount ? 1 : 0 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
    >
      {word}
    </m.span>
  ))
}

/** Inline sparkle particle SVG. Same shape as Math/Greet. */
function SparkleParticle(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      role="presentation"
      aria-hidden
    >
      <path
        d="M12 2 L13.6 9.4 L21 11 L13.6 12.6 L12 20 L10.4 12.6 L3 11 L10.4 9.4 Z"
        fill="#FFD966"
        stroke="#E0B800"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Generate sparkle particle positions. Called once during ref init
 *  (outside of render) to avoid react-hooks/purity lint violations
 *  from Math.random(). */
function generateSparkleParticles(
  reducedMotion: boolean,
): { id: number; x: number; y: number; delay: number }[] {
  const spread = reducedMotion ? 200 : 300
  const maxDelay = reducedMotion ? 0.2 : 0.3
  return Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * spread,
    y: (Math.random() - 0.5) * spread,
    delay: Math.random() * maxDelay,
  }))
}

/**
 * Map the SessionEnd `surface` discriminant to the `ProgressTrack` shape
 * used by `pickFocusNode` / `pickRecentSuccessRate`. The two unions are
 * intentionally identical today (`'math' | 'word-song'`) but live in
 * different domains — the surface is a UI/audio routing key, the track
 * is a curriculum partition. Funnelling through one helper keeps the
 * coupling explicit so a future divergence (a third surface, or a track
 * rename) only needs touching once.
 */
function trackForSurface(surface: SessionEndSurface): ProgressTrack {
  return surface
}

/**
 * Compute the graduation-session split for the just-completed session
 * (ticket 86c9m3aec). Returns `null` when this was NOT a graduation
 * run, in which case `recordProgressOnSessionEnd` falls back to the
 * legacy `totalCorrect / 8` shape.
 *
 * Two-step verification (both must hold):
 *   1. The engine flagged the upcoming session as graduation when the
 *      planner request was issued — meaning at session-start, the last
 *      `threshold.sessions` qualifying entries were all canonical and
 *      the node was at 'practicing'. Re-evaluated here by reading
 *      `loadProgress()` BEFORE the new entry is appended; the value is
 *      identical to what App.tsx computed at session-start because
 *      `applyMasteryRule` only runs INSIDE
 *      `recordProgressOnSessionEnd` (the very next call after this
 *      function returns).
 *   2. The rendered plan actually contained novel-pool words.
 *      `targetWords` is the 8-word vector the screen displayed; we
 *      intersect with `WORD_SONG_NOVEL_PROBE_WORDS`. If the
 *      intersection is empty the live planner did NOT honour the
 *      graduation flag (likely the static `STATIC_WORD_SONG_PLANS`
 *      fallback ran). We treat that as a non-graduation session — the
 *      next session will re-attempt graduation per the detector.
 *
 * Defensive: when `targetWords` or `perProblemCorrect` is missing
 * (math sessions, hand-built test fixtures), this returns `null`
 * without inspecting the inputs further. Math sessions always return
 * `null` because `WORD_SONG_NOVEL_PROBE_WORDS` only resolves on the
 * word-song track.
 */
function computeGraduationSplit(
  progress: Progress,
  track: ProgressTrack,
  focusNode: SkillNode,
  payload: SessionEndPayload,
): GraduationSessionSplit | null {
  if (track !== 'word-song') return null
  const targetWords = payload.targetWords
  const perProblemCorrect = payload.perProblemCorrect
  if (!targetWords || !perProblemCorrect) return null
  if (targetWords.length !== perProblemCorrect.length) return null

  // Step 1: was the upcoming session flagged as graduation?
  if (!isGraduationSessionPending(progress, focusNode, track)) return null

  // Step 2: did the rendered plan actually use novel-pool words?
  const novelSet: ReadonlySet<string> = new Set(WORD_SONG_NOVEL_PROBE_WORDS)
  let canonicalCount = 0
  let canonicalCorrect = 0
  let novelCount = 0
  let novelCorrect = 0
  for (let i = 0; i < targetWords.length; i++) {
    const word = targetWords[i]!
    const correct = perProblemCorrect[i] === true
    if (novelSet.has(word)) {
      novelCount += 1
      if (correct) novelCorrect += 1
    } else {
      canonicalCount += 1
      if (correct) canonicalCorrect += 1
    }
  }

  // Live planner did not honour the graduation directive (likely
  // fallback static plan ran). Don't compute split — let the engine
  // treat this as a regular session and re-attempt graduation next
  // time.
  if (novelCount === 0) return null

  return {
    canonicalCorrect,
    canonicalCount,
    novelCorrect,
    novelCount,
  }
}

/**
 * Zip math facts + per-problem first-tap outcomes into the Leitner-
 * outcome shape the progress writer consumes (ticket 86c9pwgc8 — M4).
 *
 * Defensive shape:
 *   - When the two arrays have unequal lengths, emit only the
 *     overlapping prefix. A length mismatch indicates an upstream
 *     bug; emitting the partial set is safer than throwing (the
 *     screen has already done its job and bricking the session-end
 *     persistence over a length skew is the wrong tradeoff).
 *   - When `correct` is undefined (out-of-range index), the outcome
 *     still carries the fact so the box self-populates; the rank is
 *     left unchanged in the writer.
 */
function buildLeitnerOutcomes(
  facts: ReadonlyArray<{ a: number; b: number; op: '+' | '-' | '*' }>,
  perProblemCorrect: readonly boolean[],
): LeitnerOutcome[] | undefined {
  const n = Math.min(facts.length, perProblemCorrect.length)
  if (n === 0) return undefined
  const out: LeitnerOutcome[] = new Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = {
      fact: { a: facts[i]!.a, b: facts[i]!.b, op: facts[i]!.op },
      correct: perProblemCorrect[i],
    }
  }
  return out
}

/** Convert a number (0-19) to its English word for the TTS caption. */
function numberToWord(n: number): string {
  const words = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ]
  return words[n] ?? String(n)
}
