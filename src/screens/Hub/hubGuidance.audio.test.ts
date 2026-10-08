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
  pickGuidanceLines,
  playGuidanceLine,
  unloadGuidanceLines,
  type GuidanceLineId,
} from './hubGuidance'
import type { HubCardModel } from '@marian/core/hub/hubCardModel'

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
})

describe('morning wake-up — which clip the Hub requests', () => {
  /** A world whose flower slept yesterday and is one of three today. */
  const card = (world: HubCardModel['world']): HubCardModel => ({
    world,
    landNumber: 1,
    landArt: world === 'math' ? 'land-ng-1' : 'land-ws-1',
    showLandNumber: true,
    current: world === 'math' ? 'add-to-20' : 'letter-sounds',
    unlocksNext: world === 'math' ? 'sub-to-10' : 'blending-cv',
    slots: ['grown', 'empty', 'empty'],
    slotDays: ['2026-05-02', null, null],
    earnedToday: false,
    flowersToUnlock: 2,
    complete: false,
  })
  const oneClip = GUIDANCE_LINES['guide.hub.woke.one'].audioSrc
  const twoClip = GUIDANCE_LINES['guide.woke-up'].audioSrc

  /** Play this morning's Hub lines in order; the clip srcs requested. */
  async function requestedSrcs(
    wakeWorlds: HubCardModel['world'][],
  ): Promise<string[]> {
    const lines = pickGuidanceLines({
      numberGarden: card('math'),
      wordSong: card('word-song'),
      suggestion: 'number-garden',
      wakeWorlds,
    })
    for (const id of lines) {
      const done = playGuidanceLine(id)
      howls[howls.length - 1]!.handlers.end?.()
      await done
    }
    return howls.flatMap((h) => h.src)
  }

  it('one world woke: "Your flower woke up!" plays its own Lily clip', async () => {
    expect(oneClip).toBe('/assets/audio/path/guide-hub-woke-one.mp3')
    const srcs = await requestedSrcs(['math'])
    expect(srcs[0]).toBe(oneClip)
    expect(srcs.filter((s) => s === oneClip)).toHaveLength(1)
    expect(srcs).not.toContain(twoClip)
  })

  it('two worlds woke: the plural clip plays, never the one-world clip', async () => {
    const srcs = await requestedSrcs(['math', 'word-song'])
    expect(srcs[0]).toBe(twoClip)
    expect(srcs).not.toContain(oneClip)
  })
})
