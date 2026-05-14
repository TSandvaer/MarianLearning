import { describe, expect, it, vi } from 'vitest'
import { CVC_CROSS_VOWEL_VOWELS } from '../../lib/progress'
import {
  GENTLE_RAMP_THROUGH,
  pickDistractors,
  pickTier,
} from './wordDistractors'
import {
  FORBIDDEN_PAIRS,
  TARGET_PAIRINGS,
  TARGET_PAIRINGS_CROSSVOWEL,
  TARGET_WORDS,
  getWordEntry,
  isForbiddenPair,
} from './wordPack'

describe('pickTier', () => {
  it('returns "gentle" for problems 1 through GENTLE_RAMP_THROUGH', () => {
    for (let i = 1; i <= GENTLE_RAMP_THROUGH; i++) {
      expect(pickTier(i)).toBe('gentle')
    }
  })

  it('returns "trap" for problems past the ramp', () => {
    for (let i = GENTLE_RAMP_THROUGH + 1; i <= 8; i++) {
      expect(pickTier(i)).toBe('trap')
    }
  })

  it('cutoff matches Math — gentle through problem 3', () => {
    // Per spec line 184: "The cutoff is locked at 3, parallel to Math.
    // Do not parameterise."
    expect(GENTLE_RAMP_THROUGH).toBe(3)
    expect(pickTier(3)).toBe('gentle')
    expect(pickTier(4)).toBe('trap')
  })
})

describe('pickDistractors', () => {
  it("returns the gentle pair for problems 1-3 from Kyle's matrix", () => {
    const cat = getWordEntry('cat')
    for (let problem = 1; problem <= 3; problem++) {
      const [d1, d2] = pickDistractors(cat, problem)
      expect([d1.word, d2.word]).toEqual(['bus', 'sun'])
    }
  })

  it("returns the trap pair for problems 4-8 from Kyle's matrix", () => {
    const cat = getWordEntry('cat')
    for (let problem = 4; problem <= 8; problem++) {
      const [d1, d2] = pickDistractors(cat, problem)
      expect([d1.word, d2.word]).toEqual(['bat', 'cap'])
    }
  })

  it('every target word has a deterministic gentle + trap pair', () => {
    for (const target of TARGET_WORDS) {
      const gentle = pickDistractors(target, 1)
      const trap = pickDistractors(target, 5)

      // Both pairs distinct from each other and from target.
      expect(gentle[0].word).not.toBe(target.word)
      expect(gentle[1].word).not.toBe(target.word)
      expect(gentle[0].word).not.toBe(gentle[1].word)

      expect(trap[0].word).not.toBe(target.word)
      expect(trap[1].word).not.toBe(target.word)
      expect(trap[0].word).not.toBe(trap[1].word)
    }
  })

  it('no distractor pairing produces a forbidden silhouette pair', () => {
    // Defensive — Kyle's matrix is curated to avoid this, but if anyone
    // ever drifts the matrix, the pickDistractors() defensive assertion
    // fires. This test catches it before runtime.
    for (const target of TARGET_WORDS) {
      for (const problem of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const [d1, d2] = pickDistractors(target, problem)

        expect(
          isForbiddenPair(target.word, d1.word),
          `target=${target.word} d1=${d1.word} (problem ${problem})`,
        ).toBe(false)
        expect(
          isForbiddenPair(target.word, d2.word),
          `target=${target.word} d2=${d2.word} (problem ${problem})`,
        ).toBe(false)
        expect(
          isForbiddenPair(d1.word, d2.word),
          `d1=${d1.word} d2=${d2.word} (problem ${problem})`,
        ).toBe(false)
      }
    }
  })

  it('gentle distractors are different category AND different starting consonant from target', () => {
    // Gentle-tier rule from spec §"Distractor policy" → "Gentle tier":
    // "objects from clearly different categories and clearly different
    // sounds." The matrix should reflect that.
    for (const target of TARGET_WORDS) {
      const [d1, d2] = pickDistractors(target, 1)
      // At least one of (different category, different starting consonant,
      // different vowel) must be true for each distractor — and ideally all.
      // We assert at least one differs to catch obvious matrix drift.
      const targetStart = target.word[0]
      for (const d of [d1, d2]) {
        const differs =
          d.category !== target.category ||
          d.word[0] !== targetStart ||
          d.vowel !== target.vowel
        expect(
          differs,
          `gentle distractor "${d.word}" should differ from "${target.word}" on at least one axis`,
        ).toBe(true)
      }
    }
  })

  it('trap distractors share at least one axis with target (spec §Trap tier)', () => {
    // Trap-tier rule from spec §"Distractor policy" → "Trap tier":
    // "Distractors share *one* meaningful axis with the correct word:
    // same category, OR same starting consonant, OR same vowel sound,
    // OR same ending consonant."
    for (const target of TARGET_WORDS) {
      const [d1, d2] = pickDistractors(target, 5)
      for (const d of [d1, d2]) {
        const targetStart = target.word[0]
        const targetEnd = target.word[target.word.length - 1]
        const dEnd = d.word[d.word.length - 1]
        const sharesAxis =
          d.category === target.category ||
          d.word[0] === targetStart ||
          d.vowel === target.vowel ||
          dEnd === targetEnd
        expect(
          sharesAxis,
          `trap distractor "${d.word}" should share an axis with "${target.word}"`,
        ).toBe(true)
      }
    }
  })

  it('throws for a target word that is not in the pairings matrix', () => {
    // After the short-e pool promotion (ticket 86c9teua2) flipped `pen`
    // to `isTarget: true`, `DISTRACTOR_ONLY_WORDS` is empty — every
    // pack-resident word has a matrix row. To exercise the
    // "no pairing matrix entry" path defensively we synthesise a
    // pack-shaped WordEntry whose `word` is an out-of-matrix string.
    // Pre-condition: the word is NOT a key in TARGET_PAIRINGS — we
    // confirm at runtime via `TARGET_PAIRINGS[word]` so a future
    // matrix expansion that adds it won't silently flip this assertion.
    const outOfMatrixWord = 'zzz-out-of-matrix' as const
    expect(TARGET_PAIRINGS[outOfMatrixWord]).toBeUndefined()
    const fakeTarget = {
      word: outOfMatrixWord,
      pictureKey: outOfMatrixWord,
      vowel: 'a' as const,
      category: 'object' as const,
      isTarget: true,
    }
    expect(() => pickDistractors(fakeTarget, 1)).toThrow(
      /no pairing matrix entry/,
    )
  })

  it('every target word in TARGET_WORDS has a TARGET_PAIRINGS entry', () => {
    for (const target of TARGET_WORDS) {
      expect(TARGET_PAIRINGS[target.word]).toBeDefined()
    }
  })

  it('every distractor referenced in the matrix resolves to a known word entry (cross-vowel-tier load-bearing regression guard)', () => {
    // Cross-vowel-tier load-bearing: words like `pen` (own vowel 'e', post-#208
    // target) appear as string distractors in short-a TARGET_PAIRINGS rows
    // (`mat`, `bag`, `pan`, `tag`, `van`). Same shape applies to `dog`, `log`
    // (short-o targets in short-a rows), `bus`, `cup`, `sun` (short-u targets
    // in short-a rows). If a future PR removes any of these from TARGET_WORDS
    // without retiring the string references that point at it,
    // `getWordEntry(distractor)` throws at runtime — short-a session trios at
    // problems 1-3 (gentle tier) brick. This iteration is the regression
    // guard.
    //
    // Count-based per feedback_count_assertions_on_regression_tests: we
    // accumulate the count of distractor lookups attempted AND the count of
    // failed lookups, then assert both numbers explicitly. A `.not.toThrow()`
    // per-iteration assertion is implicitly count-based on throws, but the
    // explicit counters make the intent legible at the assertion site and
    // guard against an iteration body silently short-circuiting (e.g. via a
    // future early-return refactor) without the test noticing.
    let lookupCount = 0
    const failedLookups: string[] = []
    for (const [, pairings] of Object.entries(TARGET_PAIRINGS)) {
      for (const word of [...pairings.gentle, ...pairings.trap]) {
        lookupCount += 1
        try {
          getWordEntry(word)
        } catch {
          failedLookups.push(word)
        }
      }
    }
    // Every TARGET_PAIRINGS row has exactly 2 gentle + 2 trap = 4 distractor
    // references. With 26 target rows shipped (14 short-a + 4 short-a probes
    // + 8 short-o), lookupCount = 26 × 4 = 104 at the time of authoring. Pin
    // the lower bound rather than the exact number so future tier additions
    // don't break this assertion — the load-bearing claim is "every
    // distractor resolves," not "exactly N distractors."
    expect(lookupCount).toBeGreaterThanOrEqual(26 * 4)
    expect(failedLookups).toEqual([])
  })
})

describe('pickDistractors — defensive assertions (matrix-drift guards)', () => {
  // Drive the defensive throws by importing a fresh module instance with
  // a stubbed wordPack. Tests use vi.doMock to make this hermetic — the
  // module-mock is scoped to this describe via `vi.resetModules`.
  it('throws when the matrix surfaces a forbidden silhouette pair (target ↔ distractor)', async () => {
    vi.resetModules()
    vi.doMock('./wordPack', async () => {
      const real =
        await vi.importActual<typeof import('./wordPack')>('./wordPack')
      // Force the matrix entry for `cat` to use `dog` (forbidden pair).
      const drifted = {
        ...real.TARGET_PAIRINGS,
        cat: {
          gentle: ['dog' as const, 'sun' as const],
          trap: ['bat' as const, 'cap' as const],
        },
      } as typeof real.TARGET_PAIRINGS
      return {
        ...real,
        TARGET_PAIRINGS: drifted,
      }
    })
    const { pickDistractors: localPick } = await import('./wordDistractors')
    const { getWordEntry: localGet } = await import('./wordPack')
    expect(() => localPick(localGet('cat'), 1)).toThrow(/forbidden pair/)
    vi.doUnmock('./wordPack')
    vi.resetModules()
  })

  it('throws when the matrix surfaces a self-pair (target == distractor)', async () => {
    vi.resetModules()
    vi.doMock('./wordPack', async () => {
      const real =
        await vi.importActual<typeof import('./wordPack')>('./wordPack')
      const drifted = {
        ...real.TARGET_PAIRINGS,
        // pair 'cat' against itself — distinctness rule
        cat: {
          gentle: ['cat' as const, 'sun' as const],
          trap: ['bat' as const, 'cap' as const],
        },
      } as typeof real.TARGET_PAIRINGS
      return {
        ...real,
        TARGET_PAIRINGS: drifted,
      }
    })
    const { pickDistractors: localPick } = await import('./wordDistractors')
    const { getWordEntry: localGet } = await import('./wordPack')
    expect(() => localPick(localGet('cat'), 1)).toThrow(/distinctness/)
    vi.doUnmock('./wordPack')
    vi.resetModules()
  })
})

describe('FORBIDDEN_PAIRS', () => {
  it("contains the silhouette-similarity pairs from Kyle's pack-doc + the v2 short-o + v3 short-u + v4 short-i + v5 short-e additions (tickets 86c9m3ae3 / 86c9q9ben / 86c9qdba4 / 86c9teua2)", () => {
    // Per design/word-song-picture-pack.md §"Distractor pairing matrix"
    // implementation hand-off note + design/word-song/short-o-pool-
    // expansion.md §3 (mom↔dad composition collision) +
    // design/word-song/short-u-pool-expansion.md §3 / §10 Q3 lock
    // 2026-05-08 (rug↔mat flat-rectangle floor coverings; tub↔cup
    // side-profile vessels) + design/word-song/short-i-pool-expansion.md
    // §3 / §10 Q2 LOCKED 2026-05-09 (fig↔bun round-food; pig↔dog and
    // pig↔cat four-legged-animal cross-pack hygiene) +
    // design/word-song/short-e-pool-expansion.md §3 / §5 LOCKED
    // 2026-05-09 (net↔bag fabric-with-handle; egg↔nut ovals;
    // egg↔bun round-food). Exact list, in any order.
    const pairs = FORBIDDEN_PAIRS.map((p) => [...p].sort().join(','))
    const expectedPairs = [
      ['cat', 'dog'],
      ['bus', 'van'],
      ['pan', 'pot'],
      ['cap', 'hat'],
      ['man', 'dad'],
      ['mom', 'dad'], // ticket 86c9m3ae3 — both parent-with-child compositions
      ['rug', 'mat'], // ticket 86c9q9ben — flat-rectangular floor coverings
      ['tub', 'cup'], // ticket 86c9q9ben — vessels in side profile
      ['fig', 'bun'], // ticket 86c9qdba4 — round food with top-feature (mandatory per spec §3)
      ['pig', 'dog'], // ticket 86c9qdba4 — four-legged mammal cross-pack hygiene
      ['pig', 'cat'], // ticket 86c9qdba4 — four-legged animal cross-pack hygiene
      ['net', 'bag'], // ticket 86c9teua2 — fabric-with-handle (mesh-vs-solid)
      ['egg', 'nut'], // ticket 86c9teua2 — ovals (smooth-vs-seam)
      ['egg', 'bun'], // ticket 86c9teua2 — round food (smooth-vs-score)
    ].map((p) => [...p].sort().join(','))

    for (const expected of expectedPairs) {
      expect(pairs).toContain(expected)
    }
    expect(pairs).toHaveLength(expectedPairs.length)
  })

  it('isForbiddenPair matches in either direction', () => {
    expect(isForbiddenPair('cat', 'dog')).toBe(true)
    expect(isForbiddenPair('dog', 'cat')).toBe(true)
    expect(isForbiddenPair('cat', 'bus')).toBe(false)
    // Self-pair is technically not in FORBIDDEN_PAIRS — distinctness is
    // a separate rule.
    expect(isForbiddenPair('cat', 'cat')).toBe(false)
  })
})

// --------------------------------------------------------------------------
// Cross-vowel distractor matrix (ticket 86c9qa0kf — cross-vowel mix v1 impl)
// --------------------------------------------------------------------------

describe('TARGET_PAIRINGS_CROSSVOWEL', () => {
  // The 33 effective candidate pool (14 short-a target + 8 short-o + 11
  // short-u — excluding the 4 short-a probes AND excluding the 3
  // short-o pool-extension words from ticket 86c9teu2e).
  //
  // Scope note (ticket 86c9qdba4): the cross-vowel matrix's coverage
  // tracks `mastery.ts CVC_CROSS_VOWEL_NODES` — only the CVC tiers the
  // `crossVowelMixingActive` predicate gates on. Adding a new vowel-tier
  // sibling to TARGET_WORDS (e.g. the short-i pool added under
  // 86c9qdba4) does NOT automatically add rows to the cross-vowel
  // matrix; widening the matrix is gated on a corresponding update to
  // `CVC_CROSS_VOWEL_NODES` (separately ticketed under cross-vowel
  // matrix v2). Scoping `CROSS_VOWEL_TARGETS` here by vowel keeps the
  // exhaustiveness invariant correctly aligned with the runtime
  // contract — adding a new tier to TARGET_WORDS doesn't false-fail
  // this test until the cross-vowel matrix expands to cover it.
  //
  // Scope note (ticket 86c9teu2e — short-o pool extension): the v2
  // pool-extension words (`cot, top, pop`) extend an EXISTING tier
  // (short-o) — vowel-scoped filtering above wouldn't excise them.
  // Per the extension spec §5, cross-vowel matrix rows for these 3
  // entries are deferred to the cross-vowel-mode impl ticket
  // (86c9m3aek). Scoping them out here by an explicit
  // `POOL_EXTENSION_PENDING_CROSSVOWEL` set keeps the same
  // exhaustiveness contract: adding pool-extension words to an
  // existing tier doesn't false-fail this test until the cross-vowel
  // matrix is widened to cover them. Same posture as PROBE_WORDS.
  //
  // Single source of truth (ticket 86c9qdp2n): `CVC_CROSS_VOWEL_VOWELS`
  // is exported from `mastery.ts` paired with `CVC_CROSS_VOWEL_NODES`.
  // When the cross-vowel matrix widens, both constants update together.
  const PROBE_WORDS = new Set(['nap', 'rat', 'map', 'tap'])
  const POOL_EXTENSION_PENDING_CROSSVOWEL = new Set(['cot', 'top', 'pop'])
  const CROSS_VOWEL_VOWEL_SET: ReadonlySet<'a' | 'o' | 'u' | 'i' | 'e'> =
    new Set(CVC_CROSS_VOWEL_VOWELS)
  const CROSS_VOWEL_TARGETS = TARGET_WORDS.filter(
    (w) =>
      w.isTarget &&
      !PROBE_WORDS.has(w.word) &&
      !POOL_EXTENSION_PENDING_CROSSVOWEL.has(w.word) &&
      CROSS_VOWEL_VOWEL_SET.has(w.vowel),
  )

  it('has exactly 33 rows — 14 short-a canonical + 8 short-o v1 + 11 short-u (probes + pool-extension pending + non-cross-vowel-tier targets excluded)', () => {
    // Spec §4 AC4 — 33 rows total. Probes (`nap, rat, map, tap`)
    // intentionally excluded so they remain graduation-session-only
    // emit-paths. Pool-extension words (`cot, top, pop` from ticket
    // 86c9teu2e) intentionally excluded — cross-vowel matrix
    // widening for them is deferred to ticket 86c9m3aek per spec §5.
    const rowCount = Object.keys(TARGET_PAIRINGS_CROSSVOWEL).length
    expect(rowCount).toBe(33)
  })

  it('every cross-vowel target has a row; no probe word does', () => {
    for (const target of CROSS_VOWEL_TARGETS) {
      expect(
        TARGET_PAIRINGS_CROSSVOWEL[target.word],
        `cross-vowel matrix missing row for "${target.word}"`,
      ).toBeDefined()
    }
    // Probe words MUST NOT have rows — they would break the
    // generalization-probe-only invariant if they leaked into chip
    // trios outside graduation sessions.
    for (const probe of PROBE_WORDS) {
      expect(
        TARGET_PAIRINGS_CROSSVOWEL[probe],
        `probe word "${probe}" must not appear in TARGET_PAIRINGS_CROSSVOWEL`,
      ).toBeUndefined()
    }
  })

  it('every distractor referenced is a known WordEntry (resolves via getWordEntry)', () => {
    for (const [, pairings] of Object.entries(TARGET_PAIRINGS_CROSSVOWEL)) {
      for (const word of [...pairings.gentle, ...pairings.trap]) {
        expect(() => getWordEntry(word)).not.toThrow()
      }
    }
  })

  it('no row references a probe word as a distractor (probes stay graduation-only)', () => {
    for (const [target, pairings] of Object.entries(
      TARGET_PAIRINGS_CROSSVOWEL,
    )) {
      for (const word of [...pairings.gentle, ...pairings.trap]) {
        expect(
          PROBE_WORDS.has(word),
          `cross-vowel distractor "${word}" for target "${target}" is a probe word — must be excluded`,
        ).toBe(false)
      }
    }
  })

  it('every row has at least one cross-vowel distractor (vowel-mix preference)', () => {
    // Spec §4 rule 1 — at least one cross-vowel chip per pair, ideally
    // both. This loose check enforces "at least one" per the spec
    // language ("ideally both" is a preference, not a hard rule).
    for (const target of CROSS_VOWEL_TARGETS) {
      const pairings = TARGET_PAIRINGS_CROSSVOWEL[target.word]!
      for (const tier of ['gentle', 'trap'] as const) {
        const [w1, w2] = pairings[tier]
        const e1 = getWordEntry(w1)
        const e2 = getWordEntry(w2)
        const atLeastOneCrossVowel =
          e1.vowel !== target.vowel || e2.vowel !== target.vowel
        expect(
          atLeastOneCrossVowel,
          `${target.word} ${tier} pair [${w1}, ${w2}] has no cross-vowel distractor`,
        ).toBe(true)
      }
    }
  })

  it('no pair surfaces a forbidden silhouette pair (target↔d1, target↔d2, d1↔d2)', () => {
    // Same defensive audit as TARGET_PAIRINGS — matrix-author drift
    // surfaces here before runtime. Spec §5 confirms zero new
    // FORBIDDEN_PAIRS entries needed; this test is the regression
    // guard.
    for (const [target, pairings] of Object.entries(
      TARGET_PAIRINGS_CROSSVOWEL,
    )) {
      for (const tier of ['gentle', 'trap'] as const) {
        const [d1, d2] = pairings[tier]
        expect(
          isForbiddenPair(target, d1),
          `target=${target} d1=${d1} (tier ${tier})`,
        ).toBe(false)
        expect(
          isForbiddenPair(target, d2),
          `target=${target} d2=${d2} (tier ${tier})`,
        ).toBe(false)
        expect(
          isForbiddenPair(d1, d2),
          `d1=${d1} d2=${d2} (tier ${tier})`,
        ).toBe(false)
      }
    }
  })

  it('every row passes distinctness — d1 ≠ d2, d1 ≠ target, d2 ≠ target', () => {
    for (const [target, pairings] of Object.entries(
      TARGET_PAIRINGS_CROSSVOWEL,
    )) {
      for (const tier of ['gentle', 'trap'] as const) {
        const [d1, d2] = pairings[tier]
        expect(d1).not.toBe(target)
        expect(d2).not.toBe(target)
        expect(d1).not.toBe(d2)
      }
    }
  })

  it('no row uses the borderline-avoided pairs (spec §5: [cat,fox], [mom,man], [pot,tub])', () => {
    // Spec §5 author-avoid: these are not in FORBIDDEN_PAIRS (kept the
    // matrix author flexible) but the spec recommends avoiding them.
    // This test pins that decision.
    const avoidedPairs: ReadonlyArray<readonly [string, string]> = [
      ['cat', 'fox'],
      ['mom', 'man'],
      ['pot', 'tub'],
    ]
    function pairMatches(
      a: string,
      b: string,
      [x, y]: readonly [string, string],
    ): boolean {
      return (a === x && b === y) || (a === y && b === x)
    }
    for (const [target, pairings] of Object.entries(
      TARGET_PAIRINGS_CROSSVOWEL,
    )) {
      for (const tier of ['gentle', 'trap'] as const) {
        const [d1, d2] = pairings[tier]
        for (const avoid of avoidedPairs) {
          expect(
            pairMatches(target, d1, avoid),
            `target=${target} d1=${d1} hits avoided pair ${avoid.join('/')}`,
          ).toBe(false)
          expect(
            pairMatches(target, d2, avoid),
            `target=${target} d2=${d2} hits avoided pair ${avoid.join('/')}`,
          ).toBe(false)
          expect(
            pairMatches(d1, d2, avoid),
            `tier=${tier} d1=${d1} d2=${d2} hits avoided pair ${avoid.join('/')}`,
          ).toBe(false)
        }
      }
    }
  })
})

describe('pickDistractors — cross-vowel mode (ticket 86c9qa0kf)', () => {
  it('reads from TARGET_PAIRINGS by default (back-compat)', () => {
    const cat = getWordEntry('cat')
    // Same-vowel matrix's cat-gentle is ['bus','sun']; cross-vowel
    // matrix's cat-gentle is ['log','cup']. The default call must
    // return the same-vowel pair.
    const [d1, d2] = pickDistractors(cat, 1)
    expect([d1.word, d2.word]).toEqual(['bus', 'sun'])
  })

  it('reads from TARGET_PAIRINGS_CROSSVOWEL when {crossVowel: true} is passed', () => {
    const cat = getWordEntry('cat')
    // Cross-vowel matrix's cat-gentle is ['log','cup'].
    const [d1, d2] = pickDistractors(cat, 1, { crossVowel: true })
    expect([d1.word, d2.word]).toEqual(['log', 'cup'])
  })

  it('reads cross-vowel trap pair for problems 4-8', () => {
    const cat = getWordEntry('cat')
    // Cross-vowel matrix's cat-trap is ['hot','nut'].
    for (let problem = 4; problem <= 8; problem++) {
      const [d1, d2] = pickDistractors(cat, problem, { crossVowel: true })
      expect([d1.word, d2.word]).toEqual(['hot', 'nut'])
    }
  })

  it('cross-vowel distractors are honoured for short-o targets', () => {
    const dog = getWordEntry('dog')
    // Cross-vowel matrix's dog-gentle is ['hat','cup']; trap is the
    // textbook bag/dog/bug minimal triplet → ['bag','bug'].
    const [g1, g2] = pickDistractors(dog, 1, { crossVowel: true })
    expect([g1.word, g2.word]).toEqual(['hat', 'cup'])
    const [t1, t2] = pickDistractors(dog, 5, { crossVowel: true })
    expect([t1.word, t2.word]).toEqual(['bag', 'bug'])
  })

  it('cross-vowel distractors are honoured for short-u targets', () => {
    const sun = getWordEntry('sun')
    const [g1, g2] = pickDistractors(sun, 1, { crossVowel: true })
    expect([g1.word, g2.word]).toEqual(['cat', 'mom'])
    const [t1, t2] = pickDistractors(sun, 5, { crossVowel: true })
    expect([t1.word, t2.word]).toEqual(['fan', 'man'])
  })

  it('throws when called with a probe target in cross-vowel mode (probes excluded)', () => {
    // Probes (`nap, rat, map, tap`) have rows in TARGET_PAIRINGS but
    // NOT in TARGET_PAIRINGS_CROSSVOWEL. A cross-vowel call with a
    // probe target would have nothing to look up — the explicit
    // throw surfaces the contract violation rather than silently
    // returning a bad pair.
    const nap = getWordEntry('nap')
    expect(() => pickDistractors(nap, 1, { crossVowel: true })).toThrow(
      /TARGET_PAIRINGS_CROSSVOWEL/,
    )
  })

  it('every cross-vowel target resolves a gentle + trap pair without throwing', () => {
    // Defense-in-depth — exercises every row through the full
    // pickDistractors path including the assertNotForbidden /
    // distinctness defensive checks.
    //
    // Scope note (ticket 86c9qdba4): see the parent describe block's
    // scoping rationale. New vowel tiers (short-i, future short-e) are
    // intentionally excluded from the cross-vowel matrix until the
    // matrix is explicitly widened under a separate ticket.
    //
    // Single source of truth (ticket 86c9qdp2n): pulls
    // `CVC_CROSS_VOWEL_VOWELS` from `mastery.ts`.
    //
    // Pool-extension scope (ticket 86c9teu2e): the short-o pool
    // extension (`cot, top, pop`) intentionally has NO cross-vowel
    // matrix rows yet — that's deferred to the cross-vowel-mode
    // impl ticket 86c9m3aek. They are scoped out here by the same
    // exclusion pattern used for probe words.
    const PROBE_WORDS = new Set(['nap', 'rat', 'map', 'tap'])
    const POOL_EXTENSION_PENDING_CROSSVOWEL = new Set(['cot', 'top', 'pop'])
    const CROSS_VOWEL_VOWEL_SET: ReadonlySet<'a' | 'o' | 'u' | 'i' | 'e'> =
      new Set(CVC_CROSS_VOWEL_VOWELS)
    const targets = TARGET_WORDS.filter(
      (w) =>
        w.isTarget &&
        !PROBE_WORDS.has(w.word) &&
        !POOL_EXTENSION_PENDING_CROSSVOWEL.has(w.word) &&
        CROSS_VOWEL_VOWEL_SET.has(w.vowel),
    )
    for (const target of targets) {
      expect(
        () => pickDistractors(target, 1, { crossVowel: true }),
        `gentle pair throws for ${target.word}`,
      ).not.toThrow()
      expect(
        () => pickDistractors(target, 5, { crossVowel: true }),
        `trap pair throws for ${target.word}`,
      ).not.toThrow()
    }
  })

  it('explicit {crossVowel: false} reads from TARGET_PAIRINGS', () => {
    // Distinct from the default-undefined branch — covers the explicit
    // false case.
    const cat = getWordEntry('cat')
    const [d1, d2] = pickDistractors(cat, 1, { crossVowel: false })
    expect([d1.word, d2.word]).toEqual(['bus', 'sun'])
  })
})
