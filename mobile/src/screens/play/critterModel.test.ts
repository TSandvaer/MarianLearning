import {
  CRITTER_SOUND_SOURCE,
  CRITTER_WORDS_BY_STEP,
} from '@marian/core/games/playPlace'
import { audioForWebPath } from '../../audio/bundledAudio'
import {
  blendClipPath,
  blendSegments,
  blendText,
  emptySeats,
  seatAt,
  seatedRun,
  seatedWithGaps,
  seatGroups,
  swapSeats,
  unseat,
  EMPTY_SEATS,
} from './critterModel'

describe('seatedRun (§ 3.3)', () => {
  it.each([
    [
      ['f', 'a', null],
      [0, 1],
    ],
    [
      [null, 'a', 'n'],
      [1, 2],
    ],
    [
      ['f', 'a', 'n'],
      [0, 1, 2],
    ],
    [['f', null, 'n'], null],
    [['f', null, null], null],
    [[null, null, null], null],
  ] as const)('%j → %j', (seats, run) => {
    expect(seatedRun(seats as never)).toEqual(run)
  })

  it('seats, unseats and swaps', () => {
    let s = seatAt(EMPTY_SEATS, 0, 'f')
    s = seatAt(s, 1, 'a')
    expect(swapSeats(s, 0, 2)).toEqual([null, 'a', 'f'])
    expect(unseat(s, 0)).toEqual([null, 'a', null])
    expect(seatAt(s, 1, 'o')).toEqual(['f', 'o', null])
  })
})

describe('every critter sound has a bundled clip and marks (§ 3.4)', () => {
  const words = [...new Set(Object.values(CRITTER_WORDS_BY_STEP).flat())]

  it('every picture word', () => {
    expect(words).toHaveLength(45)
    for (const w of words) {
      expect(blendText(w)).toBe(`${w[0]} - ${w[1]} - ${w[2]} ... ${w}`)
      expect(blendSegments(w)).toHaveLength(4)
      expect(audioForWebPath(blendClipPath(w))).toBeDefined()
    }
  })

  it('every sound source', () => {
    for (const { word } of Object.values(CRITTER_SOUND_SOURCE)) {
      expect(blendSegments(word)).not.toBeNull()
      expect(audioForWebPath(blendClipPath(word))).toBeDefined()
    }
  })

  it('a digraph critter’s source is its own blend, not a CVC split (D9)', () => {
    expect(blendText('ship')).toBe('sh - i - p ... ship')
    expect(blendText('chip')).toBe('ch - i - p ... chip')
    expect(blendText('thin')).toBe('th - i - n ... thin')
    expect(blendText('ring')).toBe('r - i - ng ... ring')
    for (const g of ['sh', 'ch', 'th', 'ng']) {
      const { word, index } = CRITTER_SOUND_SOURCE[g]!
      expect(blendSegments(word)).toHaveLength(4)
      expect(blendText(word).split(' ... ')[0]!.split(' - ')[index]).toBe(g)
    }
  })
})

describe('four seats (critters-four-letter.md § 4.1)', () => {
  it('the groups of seated neighbours, left to right', () => {
    expect(seatGroups(['s', 't', null, 'p'])).toEqual([[0, 1], [3]])
    expect(seatGroups([null, 'a', 'b', 'c'])).toEqual([[1, 2, 3]])
    expect(seatGroups(['a', null, 'b', null])).toEqual([[0], [2]])
    expect(seatGroups(emptySeats(4))).toEqual([])
  })

  it('a partial run: each seated critter with the empty seats before it; ends skipped', () => {
    expect(seatedWithGaps(['f', null, 'o', 'g'])).toEqual([
      { seat: 0, emptyBefore: 0 },
      { seat: 2, emptyBefore: 1 },
      { seat: 3, emptyBefore: 0 },
    ])
    expect(seatedWithGaps(['f', null, null, 'g'])).toEqual([
      { seat: 0, emptyBefore: 0 },
      { seat: 3, emptyBefore: 2 },
    ])
    expect(seatedWithGaps([null, 's', 't', null])).toEqual([
      { seat: 1, emptyBefore: 0 },
      { seat: 2, emptyBefore: 0 },
    ])
  })

  it('all four seated is one unbroken run', () => {
    expect(seatedRun(['c', 'l', 'a', 'p'])).toEqual([0, 1, 2, 3])
    expect(seatedRun(['c', null, 'a', 'p'])).toBeNull()
  })
})
