/**
 * Guidance G1 × G3 — the Hub's default line player plays the G3 Lily
 * recordings through Howler (one Howl per clip), stops on cancel and
 * releases the Howls on unload (the Hub leaving).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const howls = vi.hoisted(
  () =>
    [] as {
      src: string[]
      handlers: Record<string, (() => void) | undefined>
      play: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
      unload: ReturnType<typeof vi.fn>
    }[],
)

vi.mock('howler', () => ({
  Howl: class {
    src: string[]
    handlers: Record<string, (() => void) | undefined> = {}
    play = vi.fn(() => {
      this.handlers.play?.()
      return 1
    })
    stop = vi.fn()
    unload = vi.fn()
    constructor(opts: { src: string[] }) {
      this.src = opts.src
      howls.push(this)
    }
    duration() {
      return 2
    }
    on(event: string, cb: () => void) {
      this.handlers[event] = cb
    }
    off(event: string) {
      this.handlers[event] = undefined
    }
  },
}))

import {
  GUIDANCE_LINES,
  cancelGuidanceLine,
  playGuidanceLine,
  unloadGuidanceLines,
  type GuidanceLineId,
} from './hubGuidance'

afterEach(() => {
  cancelGuidanceLine()
  unloadGuidanceLines()
  howls.length = 0
})

describe('playGuidanceLine — recorded lines', () => {
  const recorded = (Object.keys(GUIDANCE_LINES) as GuidanceLineId[]).filter(
    (id) => GUIDANCE_LINES[id].audioSrc !== null,
  )

  it.each(recorded)('%s plays its G3 clip and resolves on end', async (id) => {
    const ticks: number[] = []
    const done = playGuidanceLine(id, { onWordTick: (i) => ticks.push(i) })
    expect(howls).toHaveLength(1)
    expect(howls[0]!.src).toEqual([GUIDANCE_LINES[id].audioSrc])
    expect(howls[0]!.play).toHaveBeenCalledTimes(1)
    expect(ticks[0]).toBe(0) // caption starts with the audio
    howls[0]!.handlers.end?.()
    await done
  })

  it('cancel stops the clip; unload releases its Howl', async () => {
    const done = playGuidanceLine('guide.woke-up')
    const howl = howls[0]!
    cancelGuidanceLine()
    await done
    expect(howl.stop).toHaveBeenCalledTimes(1)
    unloadGuidanceLines()
    expect(howl.unload).toHaveBeenCalledTimes(1)
  })

  it('the line without a recording builds no Howl', () => {
    void playGuidanceLine('guide.woke-up.one')
    expect(howls).toHaveLength(0)
  })
})
