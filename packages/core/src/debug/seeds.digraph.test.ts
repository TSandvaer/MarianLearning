/**
 * The digraph critters seeds Jessica's device runs use (critters-digraph.md
 * D23): `critters-hunt-sh`, digraphs-sh current and Dave's sh-i fallback
 * i sh b c n p with bin and pin found; and `critters-hunt-ch-four`,
 * digraphs-ch current, "3" and "4" open, and the four-seat round
 * e ch c j n s t with jets and nest found.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  huntBoardOrder,
  huntDigraphLineSaid,
  huntDigraphs,
  huntOpenLengths,
  huntRoundOf,
  huntUnits,
  huntVowels,
  loadHuntRecord,
} from '../games/critterHunt'
import { loadProgress } from '../progress'
import { applyDebugSeed, DEBUG_SEED_NAMES } from './seeds'

describe('the digraph critters seeds (D23)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it('critters-hunt-sh: i sh b c n p with bin and pin found, only sh open, the line unsaid', () => {
    expect(DEBUG_SEED_NAMES).toContain('critters-hunt-sh')
    expect(applyDebugSeed('critters-hunt-sh')).toBe(true)
    const progress = loadProgress()
    expect(huntVowels(progress)).toEqual(['a', 'o', 'u', 'i', 'e'])
    expect(huntDigraphs(progress)).toEqual(['sh'])
    expect(huntOpenLengths()).toEqual([3])
    expect(huntDigraphLineSaid()).toBe(false)
    const r = loadHuntRecord(3)!
    // The sh critter second, beside the vowel; no s and no h (D5).
    expect(r.letters).toEqual(['i', 'sh', 'b', 'c', 'n', 'p'])
    expect(r.found).toEqual(['bin', 'pin'])
    expect(r.complete).toBe(false)
    expect(huntRoundOf(r.letters)).toEqual({
      letters: r.letters,
      targets: r.targets,
      extras: r.extras,
    })
    // sh-i-p completes it in hunt-slot-3; bib stays findable.
    expect(huntBoardOrder(r)).toEqual(['bib', 'bin', 'pin', 'ship'])
    expect(huntUnits('ship', r.letters)).toEqual(['sh', 'i', 'p'])
    // shin is the chip's [sh][i][n].
    expect(r.extras).toEqual(['nib', 'nip', 'shin'])
    expect(huntUnits('shin', r.letters)).toEqual(['sh', 'i', 'n'])
  })

  it('critters-hunt-ch-four: "3" and "4" open; e ch c j n s t with jets and nest found, chest and tent to find', () => {
    expect(DEBUG_SEED_NAMES).toContain('critters-hunt-ch-four')
    expect(applyDebugSeed('critters-hunt-ch-four')).toBe(true)
    expect(huntDigraphs(loadProgress())).toEqual(['sh', 'ch'])
    expect(huntOpenLengths()).toEqual([3, 4])
    expect(huntDigraphLineSaid()).toBe(false)
    expect(loadHuntRecord(3)).toBeNull()
    const r = loadHuntRecord(4)!
    expect(r.letters).toEqual(['e', 'ch', 'c', 'j', 'n', 's', 't'])
    expect(r.found).toEqual(['jets', 'nest'])
    expect(r.complete).toBe(false)
    expect(huntRoundOf(r.letters, { length: 4 })).toEqual({
      letters: r.letters,
      targets: r.targets,
      extras: r.extras,
    })
    // ch-e-s-t completes it in hunt-slot-0, four tiles; tent stays findable.
    expect(huntBoardOrder(r)).toEqual(['chest', 'jets', 'nest', 'tent'])
    expect(huntUnits('chest', r.letters)).toEqual(['ch', 'e', 's', 't'])
    expect(r.extras).toEqual(['sent', 'test'])
  })
})
