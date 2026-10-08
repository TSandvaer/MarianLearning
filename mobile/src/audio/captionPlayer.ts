/**
 * expo-audio playback with the web app's caption word-tick contract.
 *
 * Web contract (src/lib/audio/preRecorded.ts): `onPlay` fires when Howler's
 * `play` event fires, word 0 ticks immediately, then words tick at
 * `duration / wordCount` intervals (165 wpm fallback when duration is 0).
 *
 * Native port: same formula, but word ticks are derived from the PLAYER'S
 * `currentTime` (audio clock) in the status listener instead of a free-
 * running `setInterval`. Word i is revealed once
 * `currentTime >= i * (duration / wordCount)` — identical tick times to the
 * web, locked to the audio rather than to a JS timer.
 *
 * Precision: expo-audio emits status every `updateInterval` ms and DEFAULTS
 * TO 500 ms. At 500 ms a 2-word line ("I'm Emma.") would reveal word 2 up to
 * half a second late, so players here are created at 50 ms. Tick jitter is
 * therefore <= ~50 ms (the web's setInterval jitter is ~4-16 ms).
 */
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioSource,
  type AudioStatus,
} from 'expo-audio'

export interface PlayOptions {
  /** Audio actually started (first status update with `playing`). */
  onPlay?: () => void
  /** Word i of the line should now be visible. Fires 0..wordCount-1 in order. */
  onWordTick?: (wordIndex: number) => void
}

export interface Playback {
  /** Resolves on natural end; rejects on cancel / start timeout. */
  done: Promise<void>
  cancel: () => void
}

export const STATUS_INTERVAL_MS = 50
/** Matches the web's FIRST_UTTERANCE_RETRY_MS order of magnitude. */
const START_TIMEOUT_MS = 5_000
/** Web fallback cadence when the duration is not yet known. */
const FALLBACK_WPM = 165

/**
 * `EXPO_PUBLIC_SPIKE_MUTE=1 npx expo start` mutes every player — for any
 * automated run (Maestro etc.) so local checks stay silent.
 */
const MUTED = process.env.EXPO_PUBLIC_SPIKE_MUTE === '1'

let audioModeSet: Promise<void> | null = null

/** Idempotent. Call once at boot, before the first play. */
export function configureAudioSession(): Promise<void> {
  if (!audioModeSet) {
    audioModeSet = setAudioModeAsync({
      // iPad ring/silent switch must not mute Emma (Marian will not know
      // about it). expo-audio 57 defaults this to true; set explicitly.
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
    }).catch(() => {
      audioModeSet = null
    })
  }
  return audioModeSet ?? Promise.resolve()
}

export function makePlayer(source: AudioSource): AudioPlayer {
  const player = createAudioPlayer(source, {
    updateInterval: STATUS_INTERVAL_MS,
  })
  if (MUTED) player.muted = true
  return player
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/** Index of the last word that should be visible at `currentTimeS`. Pure. */
export function wordIndexAt(
  currentTimeS: number,
  durationS: number,
  wordCount: number,
): number {
  if (wordCount <= 1) return 0
  const totalMs =
    durationS > 0 ? durationS * 1000 : (wordCount / FALLBACK_WPM) * 60_000
  const intervalMs = totalMs / wordCount
  const idx = Math.floor((currentTimeS * 1000) / intervalMs)
  return Math.max(0, Math.min(wordCount - 1, idx))
}

/**
 * Play `player` from the start with caption ticks. One playback per player
 * at a time; callers cancel the previous one first.
 */
export function playWithCaptions(
  player: AudioPlayer,
  wordCount: number,
  opts: PlayOptions = {},
): Playback {
  let settled = false
  let started = false
  let lastTick = -1
  let resolveDone: () => void = () => {}
  let rejectDone: (err: Error) => void = () => {}
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve
    rejectDone = reject
  })
  // Callers that only fire-and-forget must not trip unhandled rejections.
  done.catch(() => {})

  const tickUpTo = (idx: number) => {
    while (lastTick < idx) {
      lastTick += 1
      opts.onWordTick?.(lastTick)
    }
  }

  const sub = player.addListener(
    'playbackStatusUpdate',
    (status: AudioStatus) => {
      if (settled) return
      if (!started) {
        if (!status.playing) return
        started = true
        clearTimeout(startTimer)
        opts.onPlay?.()
        tickUpTo(0)
      }
      if (status.didJustFinish) {
        // The last tick normally lands at (n-1)/n of the duration, well
        // before the end; this only matters if status updates were starved.
        tickUpTo(wordCount - 1)
        settle(null)
        return
      }
      tickUpTo(wordIndexAt(status.currentTime, status.duration, wordCount))
    },
  )

  const startTimer = setTimeout(() => {
    if (!started) settle(new Error('start-timeout'))
  }, START_TIMEOUT_MS)

  function settle(err: Error | null) {
    if (settled) return
    settled = true
    clearTimeout(startTimer)
    sub.remove()
    if (err) rejectDone(err)
    else resolveDone()
  }

  const start = async () => {
    try {
      // Replays (re-prompt line) need a rewind; a fresh player is at 0.
      if (player.currentTime > 0) await player.seekTo(0)
      if (settled) return
      player.play()
    } catch (err) {
      settle(err instanceof Error ? err : new Error(String(err)))
    }
  }
  void start()

  return {
    done,
    cancel: () => {
      if (settled) return
      try {
        player.pause()
      } catch {
        // best effort
      }
      settle(new Error('cancelled'))
    },
  }
}
