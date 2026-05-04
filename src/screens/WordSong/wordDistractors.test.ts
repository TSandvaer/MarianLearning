import { describe, expect, it, vi } from 'vitest'
import {
  GENTLE_RAMP_THROUGH,
  pickDistractors,
  pickTier,
} from './wordDistractors'
import {
  FORBIDDEN_PAIRS,
  TARGET_PAIRINGS,
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
    // Distractor-only word as target — should fail because TARGET_PAIRINGS
    // only has entries for the 14 target words.
    const fakeTarget = getWordEntry('bus') // distractor-only
    expect(() => pickDistractors(fakeTarget, 1)).toThrow(
      /no pairing matrix entry/,
    )
  })

  it('every target word in TARGET_WORDS has a TARGET_PAIRINGS entry', () => {
    for (const target of TARGET_WORDS) {
      expect(TARGET_PAIRINGS[target.word]).toBeDefined()
    }
  })

  it('every distractor referenced in the matrix is a known word entry', () => {
    for (const [, pairings] of Object.entries(TARGET_PAIRINGS)) {
      for (const word of [...pairings.gentle, ...pairings.trap]) {
        expect(() => getWordEntry(word)).not.toThrow()
      }
    }
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
  it("contains the silhouette-similarity pairs from Kyle's pack-doc + the v2 short-o additions (ticket 86c9m3ae3)", () => {
    // Per design/word-song-picture-pack.md §"Distractor pairing matrix"
    // implementation hand-off note + design/word-song/short-o-pool-
    // expansion.md §3 (mom↔dad composition collision). Exact list, in
    // any order.
    const pairs = FORBIDDEN_PAIRS.map((p) => [...p].sort().join(','))
    const expectedPairs = [
      ['cat', 'dog'],
      ['bus', 'van'],
      ['pan', 'pot'],
      ['cap', 'hat'],
      ['man', 'dad'],
      ['mom', 'dad'], // ticket 86c9m3ae3 — both parent-with-child compositions
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
