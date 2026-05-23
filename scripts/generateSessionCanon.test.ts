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

/**
 * Wave 6C (ticket 86c9y34xn) — `'two-digit-addsub-with-regroup'` is now
 * a first-class baked tier. Dave's directive shipped in PR #314; this
 * arc bakes the canon, removes the prior Wave-5 deferral exemption, and
 * extends the bake list to 11 math nodes. The deferral helper from
 * Wave 5 PR B (`WAVE_5_PR_B_PENDING_WITH_REGROUP`) is retired.
 *
 * Disk mapping (`canonFileTierFor`):
 *   `'two-digit-addsub-no-regroup'`   → `two-digit-addsub.json` (legacy disk name)
 *   `'two-digit-addsub-with-regroup'` → `two-digit-addsub-with-regroup.json` (new)
 */

describe('activeCombos — coverage matches the curriculum', () => {
  it('produces 20 combos: 11 math nodes × level 1 + 9 word-song nodes × level 1 (with-regroup baked post-Wave 6C)', () => {
    // Step 2 of the planner-parser contract added cvc-words alongside
    // blending-cv as a first-class word-song content mode. Ticket
    // 86c9m3ae3 added `cvc-words-short-o` as the next-vowel sibling
    // tier; ticket 86c9q9ben added `cvc-words-short-u` as the third
    // vowel-tier sibling (see `design/word-song/short-u-pool-expansion.md`).
    // Ticket 86c9qdba4 added `cvc-words-short-i` as the fourth
    // vowel-tier sibling (see `design/word-song/short-i-pool-expansion.md`).
    // Ticket 86c9teua2 added `cvc-words-short-e` as the fifth and FINAL
    // single-vowel sibling tier in the o → u → i → e canonical arc (see
    // `design/word-song/short-e-pool-expansion.md`).
    // The digraphs-sh content tier added `digraphs-sh` as the FIRST
    // digraph tier — first-class, baked (see
    // `design/word-song/digraphs-sh-word-list.md` §6/§8 AC10).
    // The digraphs-ch content tier added `digraphs-ch` as the SECOND
    // digraph tier — first-class, baked (see
    // `design/word-song/digraphs-ch-word-list.md` §6/§8 AC10).
    // The digraphs-th content tier added `digraphs-th-voiceless` as the
    // THIRD and final digraph tier — first-class, baked (see
    // `design/word-song/digraphs-th-word-list.md` §1).
    // Remaining untuned tiers (letter-sounds / sight-words /
    // simple-sentences) are deliberately NOT in canon — they fall back
    // to blending-cv content via the planner's `effectiveFocusNode`, so
    // baking a duplicate blob would be wasted bytes.
    const combos = activeCombos()
    expect(combos).toHaveLength(20)
    const mathCount = combos.filter((c) => c.track === 'math').length
    const wordSongCount = combos.filter((c) => c.track === 'word-song').length
    expect(mathCount).toBe(11)
    expect(wordSongCount).toBe(9)
  })

  it('every math combo names a node from VALID_MATH_FOCUS_NODES (Wave 6C — bake list emits BOTH `-no-regroup` and `-with-regroup` wire literals)', () => {
    // Wave 6C (ticket 86c9y34xn): the bake list now emits both
    // `'two-digit-addsub-no-regroup'` and `'two-digit-addsub-with-regroup'`.
    // The disk files diverge per `canonFileTierFor`: no-regroup writes
    // `two-digit-addsub.json` (legacy stable disk name); with-regroup
    // writes `two-digit-addsub-with-regroup.json` (new).
    const combos = activeCombos().filter((c) => c.track === 'math')
    for (const combo of combos) {
      expect(VALID_MATH_FOCUS_NODES).toContain(combo.focusNode)
      expect(combo.level).toBe(1)
    }
  })

  it('word-song combos are blending-cv + cvc-words + cvc-words-short-o + cvc-words-short-u + cvc-words-short-i + cvc-words-short-e + digraphs-sh + digraphs-ch + digraphs-th-voiceless (planner first-class scope)', () => {
    const combos = activeCombos().filter((c) => c.track === 'word-song')
    expect(combos).toHaveLength(9)
    const focusNodes = combos.map((c) => c.focusNode).sort()
    expect(focusNodes).toEqual([
      'blending-cv',
      'cvc-words',
      'cvc-words-short-e',
      'cvc-words-short-i',
      'cvc-words-short-o',
      'cvc-words-short-u',
      'digraphs-ch',
      'digraphs-sh',
      'digraphs-th-voiceless',
    ])
    // All must be valid focus-node names per the planner's allow-list
    // — drift tripwire if the planner's accept set contracts.
    for (const node of focusNodes) {
      expect(VALID_WORD_SONG_FOCUS_NODES).toContain(node)
    }
  })

  it('covers every VALID_MATH_FOCUS_NODES entry — drift tripwire (post-Wave-6C: no exemptions)', () => {
    // Wave 6C (ticket 86c9y34xn): every VALID_MATH_FOCUS_NODES literal
    // is now baked. The Wave-5 deferral exemption for
    // `'two-digit-addsub-with-regroup'` is retired.
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
