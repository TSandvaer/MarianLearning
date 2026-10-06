/**
 * Guidance G1 (123jpnbca4r) — suggestion rule, Emma's lines per Hub
 * state (mockup screens a / c / d / a2) and the once-only morning wake.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HubCardModel, FlowerSlot } from './hubCardModel'
import {
  GUIDANCE_LINES,
  flowerWakeFor,
  guidanceNeedsGesture,
  pickGuidanceLines,
  playGuidanceLine,
  cancelGuidanceLine,
  readFlowerWake,
  suggestWorld,
  writeFlowerWake,
  CAPTION_MS_PER_WORD,
} from './hubGuidance'

function card(
  world: HubCardModel['world'],
  slots: FlowerSlot[],
  slotDays: (string | null)[] = slots.map(() => null),
  extra: Partial<HubCardModel> = {},
): HubCardModel {
  const good = slots.filter((s) => s !== 'empty').length
  return {
    world,
    landNumber: 1,
    landArt: world === 'math' ? 'land-ng-1' : 'land-ws-1',
    showLandNumber: true,
    current: world === 'math' ? 'add-to-20' : 'letter-sounds',
    unlocksNext: world === 'math' ? 'sub-to-10' : 'blending-cv',
    slots,
    slotDays,
    earnedToday: slots.includes('sleeping'),
    flowersToUnlock: slots.length - good,
    complete: false,
    ...extra,
  }
}

const text = (ids: string[]) =>
  ids.map((id) => GUIDANCE_LINES[id as keyof typeof GUIDANCE_LINES].text)

describe('suggestWorld', () => {
  it('suggests the world closer to its unlock when both can earn today', () => {
    const ng = card('math', ['grown', 'empty', 'empty'])
    const ws = card('word-song', ['empty', 'empty', 'empty'])
    expect(suggestWorld(ng, ws, null)).toBe('number-garden')
    expect(suggestWorld(ng, ws, 'number-garden')).toBe('number-garden')
  })

  it("moves to the world that can still earn today's flower", () => {
    const ng = card('math', ['grown', 'sleeping', 'empty'])
    const ws = card('word-song', ['empty', 'empty', 'empty'])
    expect(suggestWorld(ng, ws, 'number-garden')).toBe('word-song')
  })

  it('no suggestion when both worlds are done today', () => {
    const ng = card('math', ['grown', 'sleeping', 'empty'])
    const ws = card('word-song', ['sleeping', 'empty', 'empty'])
    expect(suggestWorld(ng, ws, null)).toBeNull()
  })

  it('a tie alternates from the last suggestion (Word Song when none)', () => {
    const ng = card('math', ['grown', 'empty', 'empty'])
    const ws = card('word-song', ['grown', 'empty', 'empty'])
    expect(suggestWorld(ng, ws, null)).toBe('word-song')
    expect(suggestWorld(ng, ws, 'word-song')).toBe('number-garden')
    expect(suggestWorld(ng, ws, 'number-garden')).toBe('word-song')
  })

  it('a completed world is never suggested', () => {
    const ng = card('math', ['grown', 'grown', 'grown'], undefined, {
      complete: true,
      flowersToUnlock: 0,
      unlocksNext: null,
    })
    const ws = card('word-song', ['empty', 'empty', 'empty'])
    expect(suggestWorld(ng, ws, null)).toBe('word-song')
  })
})

describe('pickGuidanceLines — the mockup states', () => {
  it('a · morning: names one world and gives the choice back', () => {
    const numberGarden = card('math', ['grown', 'empty', 'empty'])
    const wordSong = card('word-song', ['empty', 'empty', 'empty'])
    expect(
      text(
        pickGuidanceLines({
          numberGarden,
          wordSong,
          suggestion: 'number-garden',
          wakeWorlds: [],
        }),
      ),
    ).toEqual(["Let's grow a flower in Number Garden! Or pick Word Song."])
    expect(
      text(
        pickGuidanceLines({
          numberGarden,
          wordSong,
          suggestion: 'word-song',
          wakeWorlds: [],
        }),
      ),
    ).toEqual(["Let's grow a flower in Word Song! Or pick Number Garden."])
  })

  it('c · one world done: its flower sleeps, Emma suggests the other', () => {
    const numberGarden = card('math', ['grown', 'sleeping', 'empty'])
    const wordSong = card('word-song', ['empty', 'empty', 'empty'])
    expect(
      text(
        pickGuidanceLines({
          numberGarden,
          wordSong,
          suggestion: 'word-song',
          wakeWorlds: [],
        }),
      ),
    ).toEqual(["Your flower is sleeping. Let's play Word Song!"])
  })

  it('d · both done: Emma offers practice', () => {
    const numberGarden = card('math', ['grown', 'sleeping', 'empty'])
    const wordSong = card('word-song', ['sleeping', 'empty', 'empty'])
    expect(
      text(
        pickGuidanceLines({
          numberGarden,
          wordSong,
          suggestion: null,
          wakeWorlds: [],
        }),
      ),
    ).toEqual(['Both flowers are sleeping. Want to practise more?'])
  })

  it('a2 · next morning, one flower from the unlock: wake line, then the path line', () => {
    const numberGarden = card('math', ['grown', 'grown', 'empty'])
    const wordSong = card('word-song', ['grown', 'empty', 'empty'])
    expect(
      text(
        pickGuidanceLines({
          numberGarden,
          wordSong,
          suggestion: 'number-garden',
          wakeWorlds: ['math', 'word-song'],
        }),
      ),
    ).toEqual([
      'Your flowers woke up!',
      'One more flower, and a new path opens!',
    ])
  })

  it('a2 with one world asleep and no unlock near: singular wake + morning line', () => {
    const numberGarden = card('math', ['grown', 'empty', 'empty'])
    const wordSong = card('word-song', ['empty', 'empty', 'empty'])
    expect(
      text(
        pickGuidanceLines({
          numberGarden,
          wordSong,
          suggestion: 'number-garden',
          wakeWorlds: ['math'],
        }),
      ),
    ).toEqual([
      'Your flower woke up!',
      "Let's grow a flower in Number Garden! Or pick Word Song.",
    ])
  })

  it("every line is short (≤ 11 words, the mockup's longest) and caption-only for now", () => {
    for (const line of Object.values(GUIDANCE_LINES)) {
      expect(line.text.split(/\s+/).length).toBeLessThanOrEqual(11)
      expect(line.audioSrc).toBeNull()
    }
    expect(guidanceNeedsGesture(['guide.woke-up', 'guide.one-more'])).toBe(
      false,
    )
  })
})

describe('flowerWakeFor — once, the first visit after the flower slept', () => {
  const asleep = card(
    'math',
    ['grown', 'sleeping', 'empty'],
    ['2026-05-01', null, null],
  )
  const nextMorning = card(
    'math',
    ['grown', 'grown', 'empty'],
    ['2026-05-01', '2026-05-02', null],
  )

  it('wakes the flowers newer than the last seen day, and records them', () => {
    const r = flowerWakeFor([nextMorning], { math: '2026-05-01' })
    expect(r.wakeWorlds).toEqual(['math'])
    expect(r.wakeSlots).toEqual({ math: [1] })
    expect(r.next).toEqual({ math: '2026-05-02' })
  })

  it('does not wake again once recorded', () => {
    const first = flowerWakeFor([nextMorning], { math: '2026-05-01' })
    expect(flowerWakeFor([nextMorning], first.next).wakeWorlds).toEqual([])
  })

  it('a flower sleeping today never wakes the same day', () => {
    const r = flowerWakeFor([asleep], { math: '2026-05-01' })
    expect(r.wakeWorlds).toEqual([])
  })

  it('skipped days: the buds simply wait and wake on the next visit', () => {
    const later = card(
      'math',
      ['grown', 'grown', 'empty'],
      ['2026-05-01', '2026-05-02', null],
    )
    // Last visit was the day she earned it (May 2); she returns May 9.
    expect(flowerWakeFor([later], { math: '2026-05-01' }).wakeWorlds).toEqual([
      'math',
    ])
  })

  it('empty cards never wake', () => {
    const r = flowerWakeFor(
      [card('word-song', ['empty', 'empty', 'empty'])],
      {},
    )
    expect(r.wakeWorlds).toEqual([])
    expect(r.next).toEqual({})
  })

  it('read/write round-trips and tolerates junk', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    expect(readFlowerWake(storage)).toEqual({})
    writeFlowerWake({ math: '2026-05-02' }, storage)
    expect(readFlowerWake(storage)).toEqual({ math: '2026-05-02' })
    store.set('hub-flower-wake.v1', '{"math":3,"word-song":"2026-05-01"}')
    expect(readFlowerWake(storage)).toEqual({ 'word-song': '2026-05-01' })
    store.set('hub-flower-wake.v1', 'not json')
    expect(readFlowerWake(storage)).toEqual({})
  })
})

describe('playGuidanceLine (caption only)', () => {
  afterEach(() => vi.useRealTimers())

  it('reveals every word at 165 wpm, then resolves', async () => {
    vi.useFakeTimers()
    const ticks: number[] = []
    const done = playGuidanceLine('guide.woke-up', {
      onWordTick: (i) => ticks.push(i),
    })
    await vi.advanceTimersByTimeAsync(CAPTION_MS_PER_WORD * 4)
    await done
    expect(ticks).toEqual([0, 1, 2, 3])
  })

  it('cancel stops the walk and resolves', async () => {
    vi.useFakeTimers()
    const ticks: number[] = []
    const done = playGuidanceLine('guide.both-sleeping', {
      onWordTick: (i) => ticks.push(i),
    })
    await vi.advanceTimersByTimeAsync(CAPTION_MS_PER_WORD)
    cancelGuidanceLine()
    await done
    await vi.advanceTimersByTimeAsync(CAPTION_MS_PER_WORD * 10)
    expect(ticks).toEqual([0, 1])
  })
})
