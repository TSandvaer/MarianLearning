/**
 * Math's public contract, ported from the web's `src/screens/Math/Math.tsx`
 * (the source of truth). Same field names and semantics, so App hands
 * SessionEnd exactly what the web hands it.
 */
import type { OfferedDistractorClass } from './chipOrder'

/** What the screen hands App when problem 8 finishes (web `MathSessionResult`). */
export interface MathSessionResult {
  totalCorrect: number
  totalStardust: number
  finalStreak: number
  /** Stardust earned in this session, not the all-time total. */
  earnedThisSession: number
  /**
   * Per problem: was the FIRST chip tap correct? A wrong-then-correct
   * retry records `false` (Leitner promote / demote at session end).
   */
  perProblemCorrect: readonly boolean[]
  /**
   * Per problem: ms from the chip gate opening to the first tap. `-1`
   * when not measured, below 250 ms (touch noise) or above 60 s (walked
   * away).
   */
  latencyMs: readonly number[]
  /** The add-path subitising scaffold rendered on at least one problem. */
  subitisingScaffoldRendered: boolean
  /** The sub-to-10 minuend scaffold rendered on at least one problem. */
  subitisingScaffoldSubRendered: boolean
  /** Per problem: the value of the first chip tapped, `null` if none. */
  perProblemAnswerValue: readonly (number | null)[]
  /** Per problem: the distractor class offered (`null` for P1–P3). */
  perProblemDistractorClass: readonly (OfferedDistractorClass | null)[]
}

export interface PlayMathUtteranceOptions {
  /** Fires once when the audio actually begins. */
  onPlay?: () => void
  /** Fires per word; the caption ribbon reveals with it. */
  onWordTick?: (wordIndex: number) => void
}

/**
 * Plays one Math line by its text. Resolves at the line's end; rejects
 * when the line is replaced, cancelled or fails to play. The session
 * audio's `playUtterance` (`LoadedSessionAudio`) has exactly this shape.
 */
export type PlayMathUtteranceFn = (
  text: string,
  opts?: PlayMathUtteranceOptions,
) => Promise<void>
