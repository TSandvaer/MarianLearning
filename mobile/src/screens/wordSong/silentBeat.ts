/**
 * The `cvc-word` silent beat (`design/native/word-song-native.md` § 6):
 * the word shows, and Emma reads it once the beat is over. The beat counts
 * foreground time only (it pauses in the background and resumes with the
 * time it had left), and letter taps hold it: the read starts at
 *
 *   min(5000, max(base, lastLetterTap + 1000)) ms after the card appeared
 *
 * so Emma never says the word over her decoding, and a tapping game never
 * stalls the problem. `base` is core's `SILENT_TEXT_WINDOW_MS` (1500).
 *
 * A little story's reading beat (content wave 3 § 4.4 step 3) is the same
 * clock with its own numbers: `base` = `storyReadBeatMs` (12–21 s), a word
 * tap holds it to ≥ 2000 ms after the tap, never past 30 s (`holdMs`,
 * `capMs`).
 */
export const LETTER_TAP_HOLD_MS = 1000
export const SILENT_BEAT_CAP_MS = 5000

export interface SilentBeat {
  /** The app went to the background / came back. */
  setHidden(hidden: boolean): void
  /** A letter was tapped during the beat. */
  letterTapped(): void
  /** Stop for good (problem advance, unmount). */
  cancel(): void
  /** Foreground ms since the card appeared. */
  readonly elapsed: number
}

export interface SilentBeatDeps {
  /** A tap holds the beat to at least this long after it (default 1000). */
  holdMs?: number
  /** The beat never runs past this much foreground time (default 5000). */
  capMs?: number
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (id: unknown) => void
}

export function startSilentBeat(
  baseMs: number,
  hidden: boolean,
  onDone: () => void,
  deps: SilentBeatDeps = {},
): SilentBeat {
  const now = deps.now ?? Date.now
  const setTimer =
    deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer =
    deps.clearTimer ??
    ((id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>))
  let banked = 0
  let since: number | null = hidden ? null : now()
  let lastTap: number | null = null
  let timer: unknown = null
  let over = false

  const elapsed = () => banked + (since === null ? 0 : now() - since)

  const schedule = () => {
    if (timer !== null) clearTimer(timer)
    timer = null
    if (over || since === null) return
    const target = Math.min(
      deps.capMs ?? SILENT_BEAT_CAP_MS,
      Math.max(
        baseMs,
        lastTap === null ? 0 : lastTap + (deps.holdMs ?? LETTER_TAP_HOLD_MS),
      ),
    )
    timer = setTimer(
      () => {
        timer = null
        if (over) return
        over = true
        onDone()
      },
      Math.max(0, target - elapsed()),
    )
  }
  schedule()

  return {
    setHidden(next) {
      if (over) return
      if (next && since !== null) {
        banked += now() - since
        since = null
      } else if (!next && since === null) {
        since = now()
      }
      schedule()
    },
    letterTapped() {
      if (over) return
      lastTap = elapsed()
      schedule()
    },
    cancel() {
      over = true
      if (timer !== null) clearTimer(timer)
      timer = null
    },
    get elapsed() {
      return elapsed()
    },
  }
}
