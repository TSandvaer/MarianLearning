/**
 * One Emma line on one player: start it from the top, drive the caption
 * ticks from the player's clock, and settle exactly once.
 *
 * Settles with:
 * - resolve on the clip's natural end (`didJustFinish`), after ticking any
 *   word the 50 ms status cadence skipped, so the caption ends fully shown
 *   (the web's `playHubLine` settle rule);
 * - reject `Error('cancelled')` on `cancel()`;
 * - reject `Error('start-timeout')` when the clip has not started
 *   `START_TIMEOUT_MS` after `play()` while the app is in the foreground;
 * - reject `Error('<player error>')` when the player reports an error.
 *
 * `park()` / `unpark()` are the lifecycle hooks (see `voiceChannel.ts`):
 * park pauses the clip and freezes the start timer; unpark resumes the clip
 * where it stopped. The captions follow the audio clock, so they freeze and
 * resume with the voice.
 */
import { countWords, wordIndexAt } from './captionClock'
import type { PlayerLike, PlayerStatus } from './playerPort'

/** Same order of magnitude as the web's first-utterance retry (5 s). */
export const START_TIMEOUT_MS = 5_000

export interface LineCallbacks {
  /** The clip actually started (first status with `playing`). */
  onPlay?: () => void
  /** Word i of the line should now be visible. Fires 0..n-1, in order. */
  onWordTick?: (wordIndex: number) => void
}

export interface StartLineOptions extends LineCallbacks {
  /** Caption text; its whitespace-split word count drives the ticks. */
  text: string
  /** Diagnostic label (`greet:hi`, `session:p1.read`, ...). */
  label: string
  /** ms from `play()` to the first `playing` status. */
  onLatency?: (ms: number, label: string) => void
  /** Clock seam. */
  now?: () => number
}

export type LineState = 'starting' | 'playing' | 'parked' | 'settled'

export interface LineHandle {
  readonly done: Promise<void>
  readonly state: LineState
  cancel(): void
  park(): void
  unpark(): void
}

export function startLine(
  player: PlayerLike,
  opts: StartLineOptions,
): LineHandle {
  const now = opts.now ?? Date.now
  const wordCount = Math.max(1, countWords(opts.text))
  let state: LineState = 'starting'
  let started = false
  let parked = false
  let lastTick = -1
  let playCalledAt = 0
  let startTimer: ReturnType<typeof setTimeout> | null = null

  let resolveDone: () => void = () => {}
  let rejectDone: (err: Error) => void = () => {}
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve
    rejectDone = reject
  })
  // A fire-and-forget caller must not trip an unhandled rejection.
  done.catch(() => {})

  const tickUpTo = (idx: number) => {
    while (lastTick < idx) {
      lastTick += 1
      opts.onWordTick?.(lastTick)
    }
  }

  const clearStartTimer = () => {
    if (startTimer !== null) {
      clearTimeout(startTimer)
      startTimer = null
    }
  }

  const armStartTimer = () => {
    clearStartTimer()
    startTimer = setTimeout(() => {
      startTimer = null
      if (!started && !parked) settle(new Error('start-timeout'))
    }, START_TIMEOUT_MS)
  }

  const markStarted = () => {
    started = true
    state = 'playing'
    clearStartTimer()
    opts.onLatency?.(now() - playCalledAt, opts.label)
    opts.onPlay?.()
    tickUpTo(0)
  }

  const sub = player.addListener(
    'playbackStatusUpdate',
    (status: PlayerStatus) => {
      if (state === 'settled') return
      if (status.error) {
        settle(new Error(status.error))
        return
      }
      if (status.didJustFinish) {
        // A very short clip can finish between two status updates.
        if (!started) markStarted()
        tickUpTo(wordCount - 1)
        settle(null)
        return
      }
      if (!started) {
        if (status.playing && !parked) markStarted()
        else return
      }
      tickUpTo(wordIndexAt(status.currentTime, status.duration, wordCount))
    },
  )

  function settle(err: Error | null): void {
    if (state === 'settled') return
    state = 'settled'
    clearStartTimer()
    sub.remove()
    if (err) rejectDone(err)
    else resolveDone()
  }

  function callPlay(): void {
    playCalledAt = now()
    try {
      player.play()
    } catch (err) {
      settle(err instanceof Error ? err : new Error(String(err)))
      return
    }
    if (!started) armStartTimer()
  }

  // A reused player (replayed line, duplicate session text) sits at its
  // end; a fresh one is at 0.
  const begin = async () => {
    try {
      if (player.currentTime > 0) await player.seekTo(0)
    } catch {
      // Best effort: a failed rewind still plays (from wherever it is).
    }
    if (state === 'settled' || parked) return
    callPlay()
  }
  void begin()

  return {
    done,
    get state() {
      return state
    },
    cancel() {
      if (state === 'settled') return
      try {
        player.pause()
      } catch {
        // Best effort: the line is over for the caller either way.
      }
      settle(new Error('cancelled'))
    },
    park() {
      if (state === 'settled' || parked) return
      parked = true
      state = 'parked'
      clearStartTimer()
      try {
        player.pause()
      } catch {
        // The OS has usually paused it already (background, interruption).
      }
    },
    unpark() {
      if (state === 'settled') return
      const wasParked = parked
      parked = false
      if (started) {
        state = 'playing'
        // expo-audio resumes a clip it paused itself on foreground; only
        // nudge one that is still stopped (JS paused it first, or an
        // interruption ended without the OS's "should resume").
        if (!player.playing) callPlay()
      } else if (wasParked) {
        state = 'starting'
        callPlay()
      }
    },
  }
}
