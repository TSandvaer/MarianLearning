/**
 * Shim drift guard — pins the e2e `wordSongNodesInOrder.ts` shim
 * against the canonical `src/lib/progress/focusNode.ts` source-of-truth
 * (ticket 86c9qa0kq, Kevin's PR #183 review follow-up).
 *
 * Why this matters
 * ----------------
 * The shim duplicates `WORD_SONG_NODES_IN_ORDER` because the e2e
 * tsconfig's `include` set doesn't reach `src/` (see the shim's own
 * file header). Without a CI-time equality assertion, the only thing
 * keeping the two lists aligned is developer discipline at tier-
 * insertion time — exactly the fragility class this PR removes from
 * the spec layer. This test plugs that gap.
 *
 * If a future tier (short-i, short-e, etc.) lands in
 * `src/lib/progress/focusNode.ts` without the corresponding update to
 * the shim, this test fails CI with a diff readable by Jessica or any
 * other reviewer who isn't already steeped in the e2e/src split.
 */

import { describe, expect, it } from 'vitest'
import { WORD_SONG_NODES_IN_ORDER as SHIM_NODES } from './wordSongNodesInOrder'
import { WORD_SONG_NODES_IN_ORDER as CANONICAL_NODES } from '../../src/lib/progress/focusNode'

describe('wordSongNodesInOrder.ts shim — parity with src/lib/progress/focusNode.ts', () => {
  it('contains exactly the same nodes in the same order as the canonical source-of-truth', () => {
    // Cast to a writable string array for the equality assertion —
    // both sides are typed `readonly` and Vitest's `toEqual` compares
    // structurally, so the cast is purely for `toEqual`'s ergonomics.
    const shim = SHIM_NODES as readonly string[]
    const canonical = CANONICAL_NODES as readonly string[]
    expect(shim).toEqual(canonical)
  })

  it('shim length matches the canonical track length', () => {
    expect(SHIM_NODES).toHaveLength(CANONICAL_NODES.length)
  })

  it('every shim entry exists in the canonical track and vice versa', () => {
    // Belt-and-suspenders set-equality. If `toEqual` above ever loses
    // its order-sensitivity (it shouldn't), this case still fails on
    // a missing entry on either side.
    const shimSet = new Set(SHIM_NODES)
    const canonicalSet = new Set(CANONICAL_NODES)
    for (const entry of CANONICAL_NODES) {
      expect(shimSet.has(entry)).toBe(true)
    }
    for (const entry of SHIM_NODES) {
      expect(canonicalSet.has(entry)).toBe(true)
    }
  })
})
