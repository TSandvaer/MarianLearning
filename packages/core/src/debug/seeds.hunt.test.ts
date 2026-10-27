/**
 * The Letter critters seeds the four-letter maestro flows need
 * (critters-four-letter.md F20, F21): `critters-hunt` with only "3" open,
 * and `critters-hunt-four` with both open and the four-letter round a b c
 * d l m p in progress, clap and lamp found.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  huntBoardOrder,
  huntOpenLengths,
  loadHuntRecord,
  setHuntOpenLengths,
} from '../games/critterHunt'
import { applyDebugSeed, DEBUG_SEED_NAMES } from './seeds'

describe('the critters seeds (F20, F21)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it('critters-hunt: the three-letter round, only "3" open, even over a learner with "4" open', () => {
    setHuntOpenLengths([3, 4])
    expect(huntOpenLengths()).toEqual([3, 4])
    expect(applyDebugSeed('critters-hunt')).toBe(true)
    expect(huntOpenLengths()).toEqual([3])
    const r = loadHuntRecord(3)!
    expect(r.letters).toEqual(['a', 'b', 'g', 'h', 'p', 't'])
    expect(r.found).toEqual(['bag', 'hat', 'bat', 'tap'])
    expect(r.complete).toBe(false)
  })

  it('critters-hunt-four: "3" and "4" open; a b c d l m p with clap and lamp found, camp and damp to find', () => {
    expect(DEBUG_SEED_NAMES).toContain('critters-hunt-four')
    expect(applyDebugSeed('critters-hunt-four')).toBe(true)
    expect(huntOpenLengths()).toEqual([3, 4])
    const r = loadHuntRecord(4)!
    expect(r.letters).toEqual(['a', 'b', 'c', 'd', 'l', 'm', 'p'])
    expect(r.found).toEqual(['clap', 'lamp'])
    expect(r.complete).toBe(false)
    expect(huntBoardOrder(r)).toEqual(['clap', 'lamp', 'camp', 'damp'])
  })

  it('setHuntOpenLengths: [3] removes the field and keeps the rounds', () => {
    applyDebugSeed('critters-hunt-four')
    setHuntOpenLengths([3])
    expect(huntOpenLengths()).toEqual([3])
    expect(loadHuntRecord(4)!.found).toEqual(['clap', 'lamp'])
  })
})
