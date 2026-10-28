/**
 * The raft island seeds Jessica's device runs use (raft-island-goal I16,
 * I17): eight kinds home on the 10 island (one raft open), and both rafts
 * open with eight kinds on the 20 island.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openRafts, loadIslandRecord } from '../games/raftIsland'
import { loadProgress } from '../progress'
import { applyDebugSeed, DEBUG_SEED_NAMES } from './seeds'

describe('the raft island seeds (I16, I17)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it('raft-island-eight: the raft, one raft open, all but the pig home', () => {
    expect(DEBUG_SEED_NAMES).toContain('raft-island-eight')
    expect(applyDebugSeed('raft-island-eight')).toBe(true)
    const record = loadIslandRecord()
    expect(record).toEqual({ 10: [1, 2, 3, 4, 5, 6, 7, 8], 20: [] })
    expect(openRafts(loadProgress(), record)).toEqual([10])
  })

  it('raft-two-rafts: both rafts open, the 20 island all but the pig', () => {
    expect(applyDebugSeed('raft-two-rafts')).toBe(true)
    const record = loadIslandRecord()
    expect(record).toEqual({
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      20: [1, 2, 3, 4, 5, 6, 7, 8],
    })
    expect(openRafts(loadProgress(), record)).toEqual([10, 20])
  })
})
