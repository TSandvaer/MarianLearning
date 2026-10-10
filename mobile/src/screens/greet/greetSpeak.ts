/**
 * The bridge between core's text-space Greet sequence
 * (`runGreetSequence`, `speakReprompt`) and the key-space native engine
 * (`playGreetLine`). Web counterpart: `playLineAdapter` in
 * `src/screens/Greet.tsx`.
 *
 * One native difference (`design/native/greet-math-native.md` § 1): the
 * web's unlock-retry machinery (6 s first-utterance watchdog, relock ring)
 * is not ported. A line that fails to start (the engine's start timeout)
 * or errors walks the rest of its caption silently at 165 wpm and then
 * resolves, so the sequence carries on and the heart still appears.
 * A cancel still rejects, which the sequence treats as silence.
 */
import {
  GREET_LINES,
  type SpeakFn,
  type SpeakLikeOptions,
} from '@marian/core/greet/greetSequence'
import {
  CAPTION_WALK_MS_PER_WORD,
  type GreetLineKey,
  type LineCallbacks,
} from '../../audio'

export type PlayGreetLineFn = (
  key: GreetLineKey,
  opts?: LineCallbacks,
) => Promise<void>

/** Line text → bundled clip key. Text is owned by core's `GREET_LINES`. */
export const GREET_LINE_KEYS: Readonly<Record<string, GreetLineKey>> = {
  [GREET_LINES[0]]: 'hi',
  [GREET_LINES[1]]: 'imEmma',
  [GREET_LINES[2]]: 'niceToMeet',
  [GREET_LINES[3]]: 'tapHeart',
}

export interface GreetSpeaker {
  speak: SpeakFn
  /** Stop a caption walk in flight (it rejects with `cancelled`). */
  cancelWalk(): void
}

export function createGreetSpeaker(play: PlayGreetLineFn): GreetSpeaker {
  let stopWalk: (() => void) | null = null

  /** Ticks words `from..n-1`, one per CAPTION_WALK_MS_PER_WORD. */
  function walk(
    wordCount: number,
    from: number,
    tick: (i: number) => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timers: ReturnType<typeof setTimeout>[] = []
      const stop = () => {
        timers.forEach(clearTimeout)
        if (stopWalk === stop) stopWalk = null
      }
      stopWalk = () => {
        stop()
        reject(new Error('cancelled'))
      }
      if (from === 0) tick(0)
      const first = Math.max(1, from)
      if (first >= wordCount) {
        stop()
        resolve()
        return
      }
      for (let i = first; i < wordCount; i++) {
        timers.push(
          setTimeout(
            () => {
              tick(i)
              if (i === wordCount - 1) {
                stop()
                resolve()
              }
            },
            (i - first + 1) * CAPTION_WALK_MS_PER_WORD,
          ),
        )
      }
    })
  }

  const speak: SpeakFn = (text: string, opts?: SpeakLikeOptions) => {
    const key = GREET_LINE_KEYS[text]
    if (!key) {
      return Promise.reject(new Error(`[Greet] no clip for line "${text}"`))
    }
    const words = text.split(/\s+/).filter(Boolean)
    let ticked = -1
    let started = false
    const onPlay = () => {
      started = true
      opts?.onStart?.()
    }
    const tick = (wordIndex: number) => {
      ticked = wordIndex
      opts?.onBoundary?.({
        wordIndex,
        word: words[wordIndex] ?? '',
        charIndex: 0,
      })
    }
    return play(key, { onPlay, onWordTick: tick }).catch((err: unknown) => {
      if (err instanceof Error && err.message === 'cancelled') throw err
      if (!started) onPlay()
      return walk(Math.max(1, words.length), ticked + 1, tick)
    })
  }

  return {
    speak,
    cancelWalk() {
      stopWalk?.()
    },
  }
}
