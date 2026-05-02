/**
 * @vitest-environment node
 *
 * Smoke tests for the canon-generator script
 * (`scripts/generateSessionCanon.ts`). We import only the pure helpers
 * (`activeCombos`) and pin the contract:
 *
 *   1. The active-combo list is the cross-product the ticket calls for:
 *      math × {level: 1} × MATH_FOCUS_NODES + word-song × {level: 1} ×
 *      {blending-cv only}.
 *   2. Every active combo is a valid focus-node for its track per
 *      `_planner.ts`'s `VALID_*_FOCUS_NODES`. If a future curriculum
 *      tweak adds a math node, it must also be added to the script's
 *      enumeration — this test is the tripwire.
 *
 * We do NOT exercise the live runner here — the live path requires
 * Anthropic + Azure keys and would either burn billable calls or fail
 * in CI. The runner is exercised manually via the post-deploy smoke in
 * the PR description.
 *
 * Ticket 86c9kwhbc (D — pre-baked session canon).
 */
import { describe, expect, it } from 'vitest'

import { activeCombos } from './generateSessionCanon.ts'
import {
  VALID_MATH_FOCUS_NODES,
  VALID_WORD_SONG_FOCUS_NODES,
} from '../api/_planner.js'

describe('activeCombos — coverage matches the curriculum', () => {
  it('produces 11 combos: 10 math nodes × level 1 + 1 word-song node × level 1', () => {
    const combos = activeCombos()
    expect(combos).toHaveLength(11)
    const mathCount = combos.filter((c) => c.track === 'math').length
    const wordSongCount = combos.filter((c) => c.track === 'word-song').length
    expect(mathCount).toBe(10)
    expect(wordSongCount).toBe(1)
  })

  it('every math combo names a node from VALID_MATH_FOCUS_NODES', () => {
    const combos = activeCombos().filter((c) => c.track === 'math')
    for (const combo of combos) {
      expect(VALID_MATH_FOCUS_NODES).toContain(combo.focusNode)
      expect(combo.level).toBe(1)
    }
  })

  it('the only word-song combo is blending-cv (planner clamp scope)', () => {
    const combos = activeCombos().filter((c) => c.track === 'word-song')
    expect(combos).toHaveLength(1)
    expect(combos[0]!.focusNode).toBe('blending-cv')
    expect(VALID_WORD_SONG_FOCUS_NODES).toContain('blending-cv')
  })

  it('covers every VALID_MATH_FOCUS_NODES entry — drift tripwire', () => {
    const combos = activeCombos().filter((c) => c.track === 'math')
    const covered = new Set(combos.map((c) => c.focusNode))
    for (const node of VALID_MATH_FOCUS_NODES) {
      expect(covered.has(node)).toBe(true)
    }
  })

  it('produces no duplicate (track, level, focusNode) triples', () => {
    const combos = activeCombos()
    const keys = combos.map((c) => `${c.track}/${c.level}/${c.focusNode}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
