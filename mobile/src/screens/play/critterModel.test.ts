import {
  CRITTER_SOUND_SOURCE,
  CRITTER_WORDS_BY_STEP,
} from '@marian/core/games/playPlace'
import { audioForWebPath } from '../../audio/bundledAudio'
import {
  blendClipPath,
  blendSegments,
  blendText,
  seatAt,
  seatedRun,
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
})
