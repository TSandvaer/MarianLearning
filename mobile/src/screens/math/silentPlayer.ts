/**
 * Math's silent fallback player (web `defaultPlayUtterance`): no voice, the
 * caption walks at 165 wpm. Used when the session start failed (offline,
 * server error, a plan the app cannot read): Marian still gets every line
 * as text and a fully playable problem.
 *
 * Same timing as the web: `onPlay` and word 0 at once, then one word per
 * 60000 / 165 ms, and the promise resolves one word-interval after the
 * last word (the natural tail of real audio). Unlike the web it can be
 * cancelled (the screen unmounting), which rejects with `cancelled`.
 */
import { CAPTION_WALK_MS_PER_WORD } from '../../audio'
import type { PlayMathUtteranceFn } from './mathTypes'

export interface SilentMathPlayer {
  play: PlayMathUtteranceFn
  /** Stop the walk in flight (it rejects with `cancelled`). */
  cancel(): void
}

export function createSilentMathPlayer(): SilentMathPlayer {
  let stop: (() => void) | null = null

  return {
    play(text, opts) {
      stop?.()
      return new Promise<void>((resolve, reject) => {
        const words = text.split(/\s+/).filter(Boolean)
        const wordCount = Math.max(1, words.length)
        const timers: ReturnType<typeof setTimeout>[] = []
        const own = () => {
          timers.forEach(clearTimeout)
          if (stop === own) stop = null
          reject(new Error('cancelled'))
        }
        stop = own
        const done = () => {
          timers.forEach(clearTimeout)
          if (stop === own) stop = null
          resolve()
        }

        opts?.onPlay?.()
        opts?.onWordTick?.(0)
        for (let i = 1; i < wordCount; i++) {
          timers.push(
            setTimeout(
              () => opts?.onWordTick?.(i),
              i * CAPTION_WALK_MS_PER_WORD,
            ),
          )
        }
        // Web: the interval fires once more after the last word, then a
        // tail of one more interval (a one-word line: one interval).
        const endAt =
          wordCount <= 1
            ? CAPTION_WALK_MS_PER_WORD
            : (wordCount + 1) * CAPTION_WALK_MS_PER_WORD
        timers.push(setTimeout(done, endAt))
      })
    },
    cancel() {
      stop?.()
    },
  }
}
