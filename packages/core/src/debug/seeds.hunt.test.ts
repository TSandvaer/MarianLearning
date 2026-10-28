/**
 * The Letter critters seeds the maestro flows need (critters-four-letter.md
 * F20, F21; since the pictured-only boards, critters-word-hunt.md § 16.4,
 * B7): `critters-hunt` with only "3" open and the round a b f g h t, bag
 * and hat found; `critters-hunt-four` with both open and the four-letter
 * round a b c d n s t in progress, ants and bats found; and
 * `critters-hunt-i`, the short-i round i b g p s x, bib found.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  huntBoardOrder,
  huntOpenLengths,
  huntRoundOf,
  loadHuntRecord,
  setHuntOpenLengths,
} from '../games/critterHunt'
import { applyDebugSeed, DEBUG_SEED_NAMES } from './seeds'

describe('the critters seeds (F20, F21; B7)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it('critters-hunt: a b f g h t with bag and hat found, only "3" open, even over a learner with "4" open', () => {
    setHuntOpenLengths([3, 4])
    expect(huntOpenLengths()).toEqual([3, 4])
    expect(applyDebugSeed('critters-hunt')).toBe(true)
    expect(huntOpenLengths()).toEqual([3])
    const r = loadHuntRecord(3)!
    expect(r.letters).toEqual(['a', 'b', 'f', 'g', 'h', 't'])
    expect(r.found).toEqual(['bag', 'hat'])
    expect(r.complete).toBe(false)
    expect(huntRoundOf(r.letters)).toEqual({
      letters: r.letters,
      targets: r.targets,
      extras: r.extras,
    })
    // t-a-g completes it in hunt-slot-3; bat stays findable.
    expect(huntBoardOrder(r)).toEqual(['bag', 'bat', 'hat', 'tag'])
    expect(r.extras).toEqual(['fat', 'gag', 'tab'])
  })

  it('critters-hunt-four: "3" and "4" open; a b c d n s t with ants and bats found, cats and sand to find, band the extra', () => {
    expect(DEBUG_SEED_NAMES).toContain('critters-hunt-four')
    expect(applyDebugSeed('critters-hunt-four')).toBe(true)
    expect(huntOpenLengths()).toEqual([3, 4])
    const r = loadHuntRecord(4)!
    expect(r.letters).toEqual(['a', 'b', 'c', 'd', 'n', 's', 't'])
    expect(r.found).toEqual(['ants', 'bats'])
    expect(r.complete).toBe(false)
    expect(huntRoundOf(r.letters, { length: 4 })).toEqual({
      letters: r.letters,
      targets: r.targets,
      extras: r.extras,
    })
    // c-a-t-s completes it in hunt-slot-2; sand stays findable.
    expect(huntBoardOrder(r)).toEqual(['ants', 'bats', 'cats', 'sand'])
    expect(r.extras).toEqual(['band'])
  })

  it('critters-hunt-i: i b g p s x with bib found, short i current', () => {
    expect(DEBUG_SEED_NAMES).toContain('critters-hunt-i')
    expect(applyDebugSeed('critters-hunt-i')).toBe(true)
    const r = loadHuntRecord(3)!
    expect(r.letters).toEqual(['i', 'b', 'g', 'p', 's', 'x'])
    expect(r.found).toEqual(['bib'])
    expect(r.complete).toBe(false)
    expect(huntRoundOf(r.letters)).toEqual({
      letters: r.letters,
      targets: r.targets,
      extras: r.extras,
    })
    expect(huntBoardOrder(r)).toEqual(['bib', 'pig', 'sip', 'six'])
    expect(r.extras).toEqual(['big', 'gig', 'sis'])
  })

  it('setHuntOpenLengths: [3] removes the field and keeps the rounds', () => {
    applyDebugSeed('critters-hunt-four')
    setHuntOpenLengths([3])
    expect(huntOpenLengths()).toEqual([3])
    expect(loadHuntRecord(4)!.found).toEqual(['ants', 'bats'])
  })
})
