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
 * Wave 5 (ticket 86c9y0bvc) sibling-tier widening of `'two-digit-addsub'`
 * — the SkillNode union split into adjacent no-regroup + with-regroup
 * tiers, but the bake list (`MATH_FOCUS_NODES` in
 * `generateSessionCanon.ts`, row #15 of the sibling-tier checklist) is
 * deferred to PR B. The legacy `'two-digit-addsub'` literal stays in
 * the bake list and on disk as `two-digit-addsub.json` until PR B does
 * the rebake + file rename atomically with the prompt block update in
 * `MATH_TRACK_GUIDE`.
 *
 * Effect on the canon-coverage tripwire below: `VALID_MATH_FOCUS_NODES`
 * now contains TWO entries the bake list does NOT cover (the new
 * `'two-digit-addsub-no-regroup'` and `'two-digit-addsub-with-regroup'`
 * literals) PLUS one entry the bake list still covers under the legacy
 * name (`'two-digit-addsub'`, which the bake list maps to canon file
 * `two-digit-addsub.json` — to be renamed in PR B to
 * `two-digit-addsub-no-regroup.json`).
 *
 * Until PR B lands, the "covers every" sweep skips the post-split
 * literals via `WAVE_5_DEFERRED_TO_PR_B`. PR B's checklist item is to
 * delete this exemption when it widens the bake list.
 */
const WAVE_5_DEFERRED_TO_PR_B = new Set<string>([
  'two-digit-addsub-no-regroup',
  'two-digit-addsub-with-regroup',
])

describe('activeCombos — coverage matches the curriculum', () => {
  it('produces 19 combos: 10 math nodes × level 1 + 9 word-song nodes × level 1 (digraphs-th content tier added)', () => {
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
    expect(combos).toHaveLength(19)
    const mathCount = combos.filter((c) => c.track === 'math').length
    const wordSongCount = combos.filter((c) => c.track === 'word-song').length
    expect(mathCount).toBe(10)
    expect(wordSongCount).toBe(9)
  })

  it('every math combo names a node from VALID_MATH_FOCUS_NODES (Wave 5 transitional exemption — bake list still ships legacy `two-digit-addsub` until PR B)', () => {
    // Wave 5 (ticket 86c9y0bvc): the bake list still references the
    // legacy `'two-digit-addsub'` literal because the canon file on
    // disk is still `two-digit-addsub.json`. `VALID_MATH_FOCUS_NODES`
    // no longer contains that literal post-split. PR B renames the
    // bake-list entry + canon file + prompt block in lockstep; until
    // then we exempt the legacy literal from the per-combo validity
    // check. The companion "covers every" sweep below applies the
    // mirror exemption (new tiers not yet in the bake list).
    const combos = activeCombos().filter((c) => c.track === 'math')
    for (const combo of combos) {
      if (combo.focusNode === 'two-digit-addsub') {
        // Legacy literal — accepted in transition; PR B renames it.
        continue
      }
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

  it('covers every VALID_MATH_FOCUS_NODES entry — drift tripwire (Wave 5 transitional exemption — see WAVE_5_DEFERRED_TO_PR_B)', () => {
    // Wave 5 (ticket 86c9y0bvc): the SkillNode-level split widened
    // `VALID_MATH_FOCUS_NODES` with two new tiers, but row #15 of the
    // sibling-tier checklist (bake list extension) is explicitly
    // deferred to PR B. Exempt those literals from the "covers every"
    // drift check until PR B lands the canon + prompt rebake. The
    // exemption is single-edit removable — delete the
    // `WAVE_5_DEFERRED_TO_PR_B` Set declaration above + the filter
    // here, and the tripwire reverts to its pre-Wave-5 strictness.
    const combos = activeCombos().filter((c) => c.track === 'math')
    const covered = new Set(combos.map((c) => c.focusNode))
    for (const node of VALID_MATH_FOCUS_NODES) {
      if (WAVE_5_DEFERRED_TO_PR_B.has(node)) continue
      expect(covered.has(node)).toBe(true)
    }
  })

  it('produces no duplicate (track, level, focusNode) triples', () => {
    const combos = activeCombos()
    const keys = combos.map((c) => `${c.track}/${c.level}/${c.focusNode}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
