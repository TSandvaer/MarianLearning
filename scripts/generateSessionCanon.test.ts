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
  it('produces 44 combos: 17 math nodes × level 1 + 27 word-song nodes × level 1 (mult-mix spliced; duck-words + crab-words, content wave 1; div-share, tent-words + cake-words spliced, content wave 2; the three story steps and hundreds spliced, content wave 3; hundreds-addsub, bee-words, car-words and sheep-stories spliced, content wave 4; blending-cv and sounding-out spliced, real blending; hundreds-zeros and add-two-digit, snail-words, moon-words and goat-stories spliced, content wave 5)', () => {
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
    // Wave 7 Track A3 (ticket 86c9y4983) added `letter-names` — the FIRST
    // literacy tier in WORD_SONG_NODES_IN_ORDER — as a first-class baked
    // tier (see `design/word-song/letter-names-content.md` Kyle A1 +
    // `WORD_SONG_TRACK_GUIDE` letter-names block, Dave A2 PR #329).
    // Wave 7 Track A7 (ticket 86c9y49cd) added `letter-sounds` as the
    // FIRST non-CVC, non-digraph tier to ship first-class content (see
    // `design/word-song/letter-sounds-content.md`).
    // Wave 11 (ticket 86ca7xmr8) added `sight-words` as the FIRST
    // whole-word-RECOGNITION tier to ship first-class content (see
    // `design/research/sight-words-sequence-marian.md` +
    // `design/wave-11-sight-words-plan.md`).
    // Wave 13 (ticket 86ca8e6fr) added `simple-sentences` as the LAST Word
    // Song content tier — the sentence-COMPLETION (cloze) tier (terminal
    // node). See `design/research/simple-sentences-sequence-marian.md` +
    // `design/word-song/simple-sentences-content.md` +
    // `design/wave-13-simple-sentences-plan.md`. After this tier, EVERY
    // word-song node is first-class — no remaining untuned tiers.
    // Content wave 1 added `duck-words` and `crab-words` (land 6, "Big
    // words"; design/native/content-wave-1.md § 3–§ 4), fixed 8-word sessions.
    // Content wave 2 added `div-share` (sharing, land 4;
    // design/native/content-wave-2.md § 2.7) and `tent-words` and
    // `cake-words` (land 6; § 3–§ 4), all written by splices. Content wave
    // 3 added `fox-stories`, `hen-stories` and `bug-stories` (land 7;
    // design/native/content-wave-3.md § 4) and `hundreds` (land 5; § 3),
    // written by a splice. Content wave 4 added `hundreds-addsub` (more
    // and less, land 5; design/native/content-wave-4.md § 2.7), written by
    // a splice, and `bee-words`, `car-words` and `sheep-stories` (land 8;
    // design/native/content-wave-4.md § 3, § 4, § 6), written by
    // scripts/spliceContentWave4Canon.ts. Content wave 5 added
    // `hundreds-zeros` (zeros, land 5) and `add-two-digit` (adding big
    // numbers, land 6; design/native/content-wave-5.md § 2.7, § 3.7),
    // written by scripts/spliceContentWave5MathCanon.ts, and `snail-words`,
    // `moon-words` and `goat-stories` (land 9; design/native/content-wave-5.md
    // § 4, § 5, § 7), written by scripts/spliceContentWave5Canon.ts. Real
    // blending added `sounding-out` (land 2; design/native/real-blending.md
    // § 6), written with blending-cv's file by
    // scripts/spliceRealBlendingCanon.ts.
    const combos = activeCombos()
    expect(combos).toHaveLength(44)
    const mathCount = combos.filter((c) => c.track === 'math').length
    const wordSongCount = combos.filter((c) => c.track === 'word-song').length
    expect(mathCount).toBe(17)
    expect(wordSongCount).toBe(27)
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

  it('word-song combos are letter-names + letter-sounds + blending-cv + sounding-out + cvc-words + cvc-words-short-o + cvc-words-short-u + cvc-words-short-i + cvc-words-short-e + digraphs-sh + digraphs-ch + digraphs-th-voiceless + sight-words + simple-sentences + duck-words + crab-words + tent-words + cake-words + the three story steps + land 8 (bee-words, car-words, sheep-stories) + land 9 (snail-words, moon-words, goat-stories)', () => {
    const combos = activeCombos().filter((c) => c.track === 'word-song')
    expect(combos).toHaveLength(27)
    const focusNodes = combos.map((c) => c.focusNode).sort()
    expect(focusNodes).toEqual([
      'bee-words',
      'blending-cv',
      'bug-stories',
      'cake-words',
      'car-words',
      'crab-words',
      'cvc-words',
      'cvc-words-short-e',
      'cvc-words-short-i',
      'cvc-words-short-o',
      'cvc-words-short-u',
      'digraphs-ch',
      'digraphs-sh',
      'digraphs-th-voiceless',
      'duck-words',
      'fox-stories',
      'goat-stories',
      'hen-stories',
      'letter-names',
      'letter-sounds',
      'moon-words',
      'sheep-stories',
      'sight-words',
      'simple-sentences',
      'snail-words',
      'sounding-out',
      'tent-words',
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
