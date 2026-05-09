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
  it('produces 14 combos: 10 math nodes × level 1 + 4 word-song nodes × level 1 (short-u sibling tier added, ticket 86c9q9ben)', () => {
    // Step 2 of the planner-parser contract added cvc-words alongside
    // blending-cv as a first-class word-song content mode. Ticket
    // 86c9m3ae3 added `cvc-words-short-o` as the next-vowel sibling
    // tier; ticket 86c9q9ben added `cvc-words-short-u` as the third
    // vowel-tier sibling (see `design/word-song/short-u-pool-expansion.md`).
    // Untuned tiers (letter-sounds / digraphs / sight-words /
    // simple-sentences) are deliberately NOT in canon — they fall back
    // to blending-cv content via the planner's `effectiveFocusNode`,
    // so baking a duplicate blob would be wasted bytes.
    const combos = activeCombos()
    expect(combos).toHaveLength(14)
    const mathCount = combos.filter((c) => c.track === 'math').length
    const wordSongCount = combos.filter((c) => c.track === 'word-song').length
    expect(mathCount).toBe(10)
    expect(wordSongCount).toBe(4)
  })

  it('every math combo names a node from VALID_MATH_FOCUS_NODES', () => {
    const combos = activeCombos().filter((c) => c.track === 'math')
    for (const combo of combos) {
      expect(VALID_MATH_FOCUS_NODES).toContain(combo.focusNode)
      expect(combo.level).toBe(1)
    }
  })

  it('word-song combos are blending-cv + cvc-words + cvc-words-short-o + cvc-words-short-u (planner first-class scope)', () => {
    const combos = activeCombos().filter((c) => c.track === 'word-song')
    expect(combos).toHaveLength(4)
    const focusNodes = combos.map((c) => c.focusNode).sort()
    expect(focusNodes).toEqual([
      'blending-cv',
      'cvc-words',
      'cvc-words-short-o',
      'cvc-words-short-u',
    ])
    // All must be valid focus-node names per the planner's allow-list
    // — drift tripwire if the planner's accept set contracts.
    for (const node of focusNodes) {
      expect(VALID_WORD_SONG_FOCUS_NODES).toContain(node)
    }
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
