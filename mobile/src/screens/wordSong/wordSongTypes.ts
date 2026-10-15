/**
 * Word Song's public contract, ported from the web's
 * `src/screens/WordSong/WordSong.tsx` (the source of truth). Same field
 * names and semantics, so App hands Session End exactly what the web does.
 */

/** What the screen hands App when problem 8 finishes (web `WordSongSessionResult`). */
export interface WordSongSessionResult {
  totalCorrect: number
  totalStardust: number
  finalStreak: number
  /** Always 0: Word Song grants no stardust per answer (+5 at Session End). */
  earnedThisSession: number
  surface: 'word-song'
  /**
   * Per problem: right in the end without Emma giving the answer
   * (ever-correct: a wrong-then-right retry records `true`; Math records
   * the first tap). Session End's graduation split reads it.
   */
  perProblemCorrect: readonly boolean[]
  /** Per problem: the target word (`plan.problems[i].target.word`). */
  targetWords: readonly string[]
  /** Per problem: the word on the first chip tapped, `null` if none. */
  perProblemAnswerWord: readonly (string | null)[]
  /**
   * First-tap correctness of the warm-up problems, in order (native spec
   * review-mode-and-warmup-native.md § 7.4). The per-problem arrays above
   * cover the 8 scored problems only; `totalCorrect` and the streak too.
   */
  warmupCorrect: readonly boolean[]
  /**
   * First-tap correctness of the 8 scored problems (fast-track spec
   * `design/native/fast-track-native.md` § 3.2). Unlike `perProblemCorrect`
   * (counts a retry that ends right), a problem solved after a wrong tap
   * is `false` here.
   */
  firstTapCorrect: readonly boolean[]
}

export interface PlayWordSongUtteranceOptions {
  /** Fires once when the audio actually begins. */
  onPlay?: () => void
  /** Fires per word; the caption (and the blend's letters) follow it. */
  onWordTick?: (wordIndex: number) => void
  /** The clip's clock in ms (real audio only; the marks-driven blend). */
  onTime?: (ms: number) => void
}

/** A session line's MP3 on disk and its byte length (`fileFor`). */
export type ClipFileFn = (
  text: string,
) => { uri: string; bytes: number } | undefined

/**
 * Plays one Word Song line by its text. Resolves at the line's end; rejects
 * when the line is replaced, cancelled or fails to play. The session
 * audio's `playUtterance` (`LoadedSessionAudio`) has exactly this shape.
 */
export type PlayWordSongUtteranceFn = (
  text: string,
  opts?: PlayWordSongUtteranceOptions,
) => Promise<void>
