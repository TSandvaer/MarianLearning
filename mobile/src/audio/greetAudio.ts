/**
 * Native port of the web's `src/lib/audio/preRecorded.ts`: the 4 fixed
 * Greet lines.
 *
 * Same contract: `playGreetLine(key, { onPlay, onWordTick })` resolves at
 * the line's end and rejects on cancel, start timeout or player error. The
 * caller attaches the `.catch` (web ticket 86c9gr43t). About 300 of the web
 * module's lines are iOS-WebKit unlock and Howler instrumentation; native
 * needs neither (no gesture unlock), so they are not ported.
 */
import { GREET_LINES } from '@marian/core/greet/greetSequence'
import { audioForWebPath } from './bundledAudio'
import { audioEngine, type AudioEngine } from './engine'
import type { LineCallbacks } from './linePlayback'

export type GreetLineKey = 'hi' | 'imEmma' | 'niceToMeet' | 'tapHeart'

/** Same web URL paths as `preRecorded.ts`'s `SOURCES`. */
export const GREET_LINE_SOURCES: Readonly<Record<GreetLineKey, string>> = {
  hi: '/assets/audio/greet/greet-01-hi.mp3',
  imEmma: '/assets/audio/greet/greet-02-im-emma.mp3',
  niceToMeet: '/assets/audio/greet/greet-03-nice-to-meet-you.mp3',
  tapHeart: '/assets/audio/greet/greet-04-tap-the-heart.mp3',
}

/** Caption text per key: core's `GREET_LINES`, in order. */
export const GREET_LINE_TEXT: Readonly<Record<GreetLineKey, string>> = {
  hi: GREET_LINES[0],
  imEmma: GREET_LINES[1],
  niceToMeet: GREET_LINES[2],
  tapHeart: GREET_LINES[3],
}

const KEYS = Object.keys(GREET_LINE_SOURCES) as GreetLineKey[]

export interface GreetAudio {
  /** Create the 4 players so line 1 doesn't pay the load. Idempotent. */
  loadGreetAudio(): void
  playGreetLine(key: GreetLineKey, opts?: LineCallbacks): Promise<void>
  /** Stop the line in flight (it rejects with `cancelled`). */
  cancel(): void
  /** Release the 4 players. */
  unload(): void
}

export function createGreetAudio(
  engine: AudioEngine = audioEngine,
): GreetAudio {
  const clipKey = (key: GreetLineKey) => `greet:${key}`
  const sourceOf = (key: GreetLineKey): number => {
    const mod = audioForWebPath(GREET_LINE_SOURCES[key])
    if (mod === undefined) {
      throw new Error(
        `[greetAudio] no bundled clip for "${GREET_LINE_SOURCES[key]}"`,
      )
    }
    return mod
  }

  function cancel(): void {
    // Only stop Emma when the line in flight is a Greet line.
    if (engine.voice.activeLabel?.startsWith('greet:')) engine.cancelVoice()
  }

  return {
    loadGreetAudio() {
      for (const key of KEYS) engine.preload(clipKey(key), sourceOf(key))
    },
    playGreetLine(key, opts = {}) {
      let source: number
      try {
        source = sourceOf(key)
      } catch (err) {
        return Promise.reject(err)
      }
      return engine.speak(clipKey(key), source, {
        text: GREET_LINE_TEXT[key],
        label: clipKey(key),
        onPlay: opts.onPlay,
        onWordTick: opts.onWordTick,
      })
    },
    cancel,
    unload() {
      cancel()
      engine.releasePrefix('greet:')
    },
  }
}

const greetAudio = createGreetAudio()
export const loadGreetAudio = greetAudio.loadGreetAudio
export const playGreetLine = greetAudio.playGreetLine
export const cancelGreetAudio = greetAudio.cancel
export const unloadGreetAudio = greetAudio.unload
