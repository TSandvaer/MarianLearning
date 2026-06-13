import { describe, expect, it, vi } from 'vitest'
import { CVC_CROSS_VOWEL_VOWELS } from '../../lib/progress'
import {
  GENTLE_RAMP_THROUGH,
  pickDistractors,
  pickTier,
} from './wordDistractors'
import {
  DISTRACTOR_ONLY_WORDS,
  FORBIDDEN_PAIRS,
  TARGET_PAIRINGS,
  TARGET_PAIRINGS_CROSSVOWEL,
  TARGET_WORDS,
  getWordEntry,
  isForbiddenPair,
} from './wordPack'

// All digraph-tier target words (sh + ch + th). Digraph tiers are NOT
// classified by the same-vowel CVC heuristic — their distractor rules are
// "pool-neighbour + cross-orthography contrast" (asserted in the dedicated
// per-tier describe blocks below), so the generic CVC-tier gentle/trap
// AXIS tests and the cross-vowel exhaustiveness scans must exclude them.
//
// The sh tier OMITS `vowel`, so a `w.vowel !== undefined` filter alone
// catches it; the ch + th tiers SET `vowel` (every ch/th word uses a
// short vowel Marian has covered), so the undefined-guard does NOT catch
// them — they need this explicit Set. The ch tier additionally happened to
// pass the generic gentle/trap axis tests by coincidence (every ch word
// starts `c`); the th tier does NOT (th-pool neighbours used as traps —
// e.g. `bath`'s trap `thin`, `moth`'s trap `thin`/`math` — share the `th`
// grapheme / `/θ/` phoneme but no starting char, ending char, vowel, or
// category). Scoping the generic axis tests by this Set is the th-tier
// analogue of the sh-tier exclusion already documented in those tests'
// comments — coverage for ch + th lives in their dedicated describe
// blocks instead.
const ALL_DIGRAPH_TIER_WORDS: ReadonlySet<string> = new Set([
  // digraphs-sh
  'ship',
  'shell',
  'shoe',
  'sheep',
  'shark',
  'shed',
  'shop',
  // digraphs-ch
  'chin',
  'chip',
  'chop',
  'chat',
  'chest',
  'chug',
  'chick',
  // digraphs-th-voiceless
  'thin',
  'bath',
  'math',
  'path',
  'moth',
  'thick',
  'cloth',
])

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
    //
    // SCOPED to vowel-bearing (CVC-tier) entries, EXCLUDING all
    // digraph-tier words (sh + ch + th — `ALL_DIGRAPH_TIER_WORDS`). The
    // digraphs-sh tier (`vowel` omitted) was already excluded by the
    // `vowel !== undefined` guard; the ch + th tiers SET `vowel` so they
    // need the explicit Set. Each digraph tier's gentle rule is "both
    // entries are pool neighbours, distinguished by PICTURE" (Kyle's
    // specs §2) — the category/consonant/vowel heuristic genuinely does
    // not apply; the dedicated per-tier describe blocks below assert the
    // pool-neighbour rule instead.
    for (const target of TARGET_WORDS.filter(
      (w) => w.vowel !== undefined && !ALL_DIGRAPH_TIER_WORDS.has(w.word),
    )) {
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
    //
    // SCOPED to vowel-bearing (CVC-tier) entries, EXCLUDING all
    // digraph-tier words (`ALL_DIGRAPH_TIER_WORDS`) — same rationale as
    // the gentle test above. Each digraph tier's trap rule
    // (cross-orthography contrast OR pool neighbour) is asserted in its
    // dedicated per-tier describe block. Note the th tier specifically
    // would FAIL this generic axis test if not excluded: th-pool
    // neighbours used as traps (e.g. `bath`'s trap `thin`, `moth`'s trap
    // `thin`/`math`) share the `th` grapheme / `/θ/` phoneme but not a
    // starting char, ending char, vowel, or category — the axis the th
    // tier tests is the chip-SELECTION /θ/-vs-/t/ contrast, not the CVC
    // character-overlap heuristic.
    for (const target of TARGET_WORDS.filter(
      (w) => w.vowel !== undefined && !ALL_DIGRAPH_TIER_WORDS.has(w.word),
    )) {
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

// --------------------------------------------------------------------------
// Digraphs-sh tier (ticket digraphs-sh wordPack)
//
// The sh-tier is structurally different from the same-vowel-only CVC tiers
// (Kyle's spec `design/word-song/digraphs-sh-word-list.md` §2):
//   - 7 sh-initial targets — 4 conventional sh-CVC (`ship/shell/shed/shop`)
//     + 3 long-vowel sight-word hybrids (`shoe/sheep/shark`).
//   - `vowel` is omitted on all 7; all 7 carry `phoneme: '/ʃ/'`.
//   - gentle pair = 2 sh-pool neighbours (distinguished by picture).
//   - trap pair = sh/s-contrast trap + sh-pool neighbour for the
//     strong-trap subset (`ship/shell/shop`), else 2 sh-pool neighbours
//     for the weak-trap subset (`shoe/sheep/shark/shed`).
//   - 2 new distractor-only s-contrast entries (`sell/sop`); `sip` is
//     dual-role (reuses its short-i `TARGET_WORDS` entry).
// --------------------------------------------------------------------------

describe('digraphs-sh tier — wordPack rows', () => {
  const SH_TARGET_WORDS = [
    'ship',
    'shell',
    'shoe',
    'sheep',
    'shark',
    'shed',
    'shop',
  ] as const
  const SH_HYBRID_WORDS = ['shoe', 'sheep', 'shark'] as const
  const SH_S_CONTRAST_DISTRACTORS = ['sip', 'sell', 'sop'] as const

  it('all 7 sh-target WordEntry rows exist with isTarget: true, phoneme "/ʃ/", and vowel omitted', () => {
    let foundCount = 0
    for (const word of SH_TARGET_WORDS) {
      const entry = getWordEntry(word)
      foundCount += 1
      expect(entry.isTarget, `${word} isTarget`).toBe(true)
      expect(entry.phoneme, `${word} phoneme`).toBe('/ʃ/')
      // `vowel` omitted on all 7 sh-tier entries — they are
      // phoneme-classified, not vowel-classified.
      expect(entry.vowel, `${word} vowel`).toBeUndefined()
    }
    // Count-based: all 7 resolved (none threw, none missing).
    expect(foundCount).toBe(7)
  })

  it('hybridMode: true is set on exactly the 3 long-vowel hybrids (shoe/sheep/shark)', () => {
    // Kyle's spec §6.1 + AC12 — hybridMode gates the planner's prompt
    // generation. The 4 conventional sh-CVC words must NOT carry it.
    const hybridWords = SH_TARGET_WORDS.filter(
      (w) => getWordEntry(w).hybridMode === true,
    )
    expect([...hybridWords].sort()).toEqual([...SH_HYBRID_WORDS].sort())
  })

  it('the 4 conventional sh-CVC words have hybridMode absent (=== false default)', () => {
    for (const word of ['ship', 'shell', 'shed', 'shop'] as const) {
      // Default-absent === false — no explicit `hybridMode: false` needed.
      expect(getWordEntry(word).hybridMode).toBeUndefined()
    }
  })

  it('every hybridMode: true word carries phoneme "/ʃ/" (AC12 cross-check)', () => {
    // Belt-and-braces: a hybridMode word is by construction a sh-tier
    // word, so it must also carry the sh digraph phoneme tag.
    let checked = 0
    for (const word of SH_HYBRID_WORDS) {
      const entry = getWordEntry(word)
      checked += 1
      expect(entry.hybridMode, `${word} hybridMode`).toBe(true)
      expect(entry.phoneme, `${word} phoneme`).toBe('/ʃ/')
    }
    expect(checked).toBe(3)
  })

  it('sell + sop are distractor-only entries (isTarget: false), NOT phoneme-tagged', () => {
    for (const word of ['sell', 'sop'] as const) {
      const entry = getWordEntry(word)
      expect(entry.isTarget, `${word} isTarget`).toBe(false)
      // NOT phoneme-tagged — the sh-target rows reference them as
      // untagged s-contrast distractors so the opt-in phoneme-scoping
      // check in pickDistractors passes (tagging them `/s/` would make
      // the sh-target rows throw on phoneme mismatch).
      expect(entry.phoneme, `${word} phoneme`).toBeUndefined()
    }
    // They live in DISTRACTOR_ONLY_WORDS, not TARGET_WORDS. The digraphs-ch
    // tier appended `sat` + `sick` (ch/s-contrast traps for `chat`/`chick`)
    // and the digraphs-th tier appended `tin` + `tick` + `pat` (th/t-contrast
    // traps for `thin`/`thick`/`path`) — each asserted in its dedicated
    // describe block below.
    const distractorOnlyWords = DISTRACTOR_ONLY_WORDS.map((e) => e.word)
    expect(distractorOnlyWords).toEqual([
      'sell',
      'sop',
      'sat',
      'sick',
      'tin',
      'tick',
      'pat',
      'bit', // simple-sentences `cat-sat-mat` grammar-fix target (#429)
    ])
  })

  it('sip remains a short-i TARGET_WORDS entry (dual-role, not duplicated)', () => {
    // `sip` is the sh/s-contrast trap for `ship` AND its own short-i
    // target — referenced by string from the sh-tier matrix, NOT added
    // as a second entry. It keeps `vowel: 'i'`, `isTarget: true`, and
    // stays untagged (no `/s/` phoneme).
    const sipEntries = TARGET_WORDS.filter((e) => e.word === 'sip')
    expect(sipEntries).toHaveLength(1)
    expect(sipEntries[0].vowel).toBe('i')
    expect(sipEntries[0].isTarget).toBe(true)
    expect(sipEntries[0].phoneme).toBeUndefined()
  })

  it('each sh-target produces exactly 2 distractors per pickDistractors (gentle + trap)', () => {
    // Mirrors the CVC-tier "every target word has a deterministic
    // gentle + trap pair" coverage, scoped to the sh-tier.
    let resolvedCount = 0
    for (const word of SH_TARGET_WORDS) {
      const target = getWordEntry(word)
      const gentle = pickDistractors(target, 1)
      const trap = pickDistractors(target, 5)
      expect(gentle, `${word} gentle`).toHaveLength(2)
      expect(trap, `${word} trap`).toHaveLength(2)
      // Distinctness — d1 ≠ d2 ≠ target, both tiers.
      expect(gentle[0].word).not.toBe(target.word)
      expect(gentle[1].word).not.toBe(target.word)
      expect(gentle[0].word).not.toBe(gentle[1].word)
      expect(trap[0].word).not.toBe(target.word)
      expect(trap[1].word).not.toBe(target.word)
      expect(trap[0].word).not.toBe(trap[1].word)
      resolvedCount += 1
    }
    expect(resolvedCount).toBe(7)
  })

  it('every sh-target gentle pair is two sh-pool neighbours (spec §2 gentle rule)', () => {
    // Gentle rule: BOTH entries are sh-pool words — Marian distinguishes
    // by picture, not by sh-vs-s. Count-based: tally non-sh-pool gentle
    // distractors, assert zero.
    const shPool = new Set<string>(SH_TARGET_WORDS)
    const nonShPoolGentle: string[] = []
    for (const word of SH_TARGET_WORDS) {
      const [d1, d2] = pickDistractors(getWordEntry(word), 1)
      for (const d of [d1, d2]) {
        if (!shPool.has(d.word)) nonShPoolGentle.push(`${word}->${d.word}`)
      }
    }
    expect(nonShPoolGentle).toEqual([])
  })

  it('strong-trap subset (ship/shell/shop) trap pair includes its sh/s-contrast distractor', () => {
    // Spec §2 strong-trap subset — these 3 targets have a real-word
    // s-onset minimal pair (sip/sell/sop). The trap pair must include it.
    const strongTrap: Record<string, string> = {
      ship: 'sip',
      shell: 'sell',
      shop: 'sop',
    }
    for (const [target, expectedSContrast] of Object.entries(strongTrap)) {
      const [d1, d2] = pickDistractors(getWordEntry(target), 5)
      const trapWords = [d1.word, d2.word]
      expect(
        trapWords,
        `${target} trap pair should include s-contrast "${expectedSContrast}"`,
      ).toContain(expectedSContrast)
    }
  })

  it('weak-trap subset (shoe/sheep/shark/shed) trap pair is two sh-pool neighbours (no s-contrast)', () => {
    // Spec §2 weak-trap subset — no good s-contrast word, so both trap
    // entries are sh-pool neighbours. Count-based: tally any
    // s-contrast distractor in these rows, assert zero.
    const shPool = new Set<string>(SH_TARGET_WORDS)
    const sContrastInWeakTrap: string[] = []
    for (const word of ['shoe', 'sheep', 'shark', 'shed'] as const) {
      const [d1, d2] = pickDistractors(getWordEntry(word), 5)
      for (const d of [d1, d2]) {
        if (!shPool.has(d.word)) sContrastInWeakTrap.push(`${word}->${d.word}`)
      }
    }
    expect(sContrastInWeakTrap).toEqual([])
  })

  it('no sh-tier trio surfaces a forbidden silhouette pair', () => {
    // Defensive — the new FORBIDDEN_PAIRS entries [shed,shop],
    // [shoe,shop], [ship,tub] plus all prior pairs. pickDistractors
    // throws on a forbidden pair, so a clean run across all problem
    // indices proves the matrix is clean.
    for (const word of SH_TARGET_WORDS) {
      const target = getWordEntry(word)
      for (const problem of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const [d1, d2] = pickDistractors(target, problem)
        expect(
          isForbiddenPair(target.word, d1.word),
          `${target.word}/${d1.word} (problem ${problem})`,
        ).toBe(false)
        expect(
          isForbiddenPair(target.word, d2.word),
          `${target.word}/${d2.word} (problem ${problem})`,
        ).toBe(false)
        expect(
          isForbiddenPair(d1.word, d2.word),
          `${d1.word}/${d2.word} (problem ${problem})`,
        ).toBe(false)
      }
    }
  })

  it('no sh-target trio leaks a CVC short-vowel word (cross-tier hygiene, spec §6)', () => {
    // sh-trios contain ONLY sh-pool words + the 3 s-contrast distractors
    // (sip/sell/sop). No `cat`/`dog`/`pen` etc. Count-based: tally any
    // distractor outside that allowed set across all problem indices.
    const allowed = new Set<string>([
      ...SH_TARGET_WORDS,
      ...SH_S_CONTRAST_DISTRACTORS,
    ])
    const leaks: string[] = []
    for (const word of SH_TARGET_WORDS) {
      const target = getWordEntry(word)
      for (const problem of [1, 5]) {
        const [d1, d2] = pickDistractors(target, problem)
        for (const d of [d1, d2]) {
          if (!allowed.has(d.word)) leaks.push(`${word}@${problem}->${d.word}`)
        }
      }
    }
    expect(leaks).toEqual([])
  })

  it('FORBIDDEN_PAIRS includes the 3 digraphs-sh additions', () => {
    const pairs = FORBIDDEN_PAIRS.map((p) => [...p].sort().join(','))
    for (const expected of [
      ['shed', 'shop'],
      ['shoe', 'shop'],
      ['ship', 'tub'],
    ].map((p) => [...p].sort().join(','))) {
      expect(pairs).toContain(expected)
    }
  })
})

// --------------------------------------------------------------------------
// Digraphs-ch tier (ticket digraphs-ch wordPack)
//
// The ch-tier reuses the sh-tier's cross-orthography distractor machinery
// (Kyle's spec `design/word-song/digraphs-ch-word-list.md`, reconciled
// against Dave's `design/research/digraph-ch-addendum.md`) but diverges
// from sh on three STRUCTURAL points (spec §0):
//   - 7 ch-initial targets — `chin/chip/chop/chat/chest/chug/chick` — ALL
//     fully decodable short-vowel words; ZERO `hybridMode` entries (unlike
//     sh's 3 long-vowel hybrids).
//   - `vowel` IS set on all 7 (not omitted as on sh-tier entries) — every
//     ch-word uses a short vowel Marian has formally covered.
//   - NO `phoneme` field on any ch entry (sh carried `phoneme: '/ʃ/'`).
//   - gentle pair = 2 ch-pool neighbours (distinguished by picture).
//   - trap pair = ch/s-contrast trap + ch-pool neighbour for the
//     strong-trap subset (`chip/chat/chick`), else 2 ch-pool neighbours
//     for the weak-trap subset (`chin/chop/chest/chug`).
//   - 2 new distractor-only s-contrast entries (`sat/sick`); `sip` is
//     dual-role (reuses its short-i `TARGET_WORDS` entry — now load-bearing
//     across THREE tiers: short-i / sh / ch).
// --------------------------------------------------------------------------

describe('digraphs-ch tier — wordPack rows', () => {
  const CH_TARGET_WORDS = [
    'chin',
    'chip',
    'chop',
    'chat',
    'chest',
    'chug',
    'chick',
  ] as const
  const CH_S_CONTRAST_DISTRACTORS = ['sip', 'sat', 'sick'] as const
  const CH_VOWELS: Record<string, 'a' | 'o' | 'u' | 'i' | 'e'> = {
    chin: 'i',
    chip: 'i',
    chop: 'o',
    chat: 'a',
    chest: 'e',
    chug: 'u',
    chick: 'i',
  }

  it('all 7 ch-target WordEntry rows exist with isTarget: true, vowel set, and NO phoneme tag', () => {
    let foundCount = 0
    for (const word of CH_TARGET_WORDS) {
      const entry = getWordEntry(word)
      foundCount += 1
      expect(entry.isTarget, `${word} isTarget`).toBe(true)
      // `vowel` IS set on every ch entry (unlike sh-tier entries which
      // omit it) — every ch-word uses a short vowel Marian has covered.
      expect(entry.vowel, `${word} vowel`).toBe(CH_VOWELS[word])
      // NO `phoneme` tag — the ch tier needs no cross-phoneme distractor
      // scoping (no pack-resident word shares the `ch` grapheme with a
      // different phoneme). Spec §6.
      expect(entry.phoneme, `${word} phoneme`).toBeUndefined()
    }
    // Count-based: all 7 resolved (none threw, none missing).
    expect(foundCount).toBe(7)
  })

  it('ZERO ch-tier entries carry hybridMode: true (the structural simplification vs sh — spec §6.1 / AC12)', () => {
    // Dave non-obvious finding #1: the ch short-vowel word stock is rich
    // enough that no long-vowel inclusions are needed, so every ch-word is
    // fully decodable and `hybridMode` is absent on all 7. Count-based:
    // tally any ch entry with a truthy `hybridMode`, assert zero.
    const hybridChWords = CH_TARGET_WORDS.filter(
      (w) => getWordEntry(w).hybridMode === true,
    )
    expect(hybridChWords).toEqual([])
    // Belt-and-braces: the field is absent (=== false default), not
    // explicitly `false`.
    for (const word of CH_TARGET_WORDS) {
      expect(
        getWordEntry(word).hybridMode,
        `${word} hybridMode`,
      ).toBeUndefined()
    }
  })

  it('sat + sick are distractor-only entries (isTarget: false), NOT phoneme-tagged', () => {
    for (const word of ['sat', 'sick'] as const) {
      const entry = getWordEntry(word)
      expect(entry.isTarget, `${word} isTarget`).toBe(false)
      // NOT phoneme-tagged — the ch-target rows reference them as untagged
      // s-contrast distractors. (ch targets carry no `phoneme` either, so
      // the opt-in phoneme-scoping branch never runs for ch-tier rows.)
      expect(entry.phoneme, `${word} phoneme`).toBeUndefined()
    }
    // They keep their real short vowel — they ARE short-vowel CVC words,
    // just not ch-tier targets.
    expect(getWordEntry('sat').vowel).toBe('a')
    expect(getWordEntry('sick').vowel).toBe('i')
    // The full distractor-only set after the digraph tiers: sh's sell/sop
    // + ch's sat/sick + th's tin/tick/pat (the th-tier appended its
    // t-contrast traps — asserted in the 'digraphs-th tier' block below).
    const distractorOnlyWords = DISTRACTOR_ONLY_WORDS.map((e) => e.word)
    expect(distractorOnlyWords).toEqual([
      'sell',
      'sop',
      'sat',
      'sick',
      'tin',
      'tick',
      'pat',
      'bit', // simple-sentences `cat-sat-mat` grammar-fix target (#429)
    ])
  })

  it('sip remains a single short-i TARGET_WORDS entry (now dual-role across short-i / sh / ch — not duplicated)', () => {
    // `sip` is the ch/s-contrast trap for `chip` AND the sh/s-contrast
    // trap for `ship` AND its own short-i target — referenced by string
    // from BOTH digraph matrices, NOT added as a second/third entry.
    const sipEntries = TARGET_WORDS.filter((e) => e.word === 'sip')
    expect(sipEntries).toHaveLength(1)
    expect(sipEntries[0].vowel).toBe('i')
    expect(sipEntries[0].isTarget).toBe(true)
    expect(sipEntries[0].phoneme).toBeUndefined()
  })

  it('each ch-target produces exactly 2 distractors per pickDistractors (gentle + trap)', () => {
    let resolvedCount = 0
    for (const word of CH_TARGET_WORDS) {
      const target = getWordEntry(word)
      const gentle = pickDistractors(target, 1)
      const trap = pickDistractors(target, 5)
      expect(gentle, `${word} gentle`).toHaveLength(2)
      expect(trap, `${word} trap`).toHaveLength(2)
      // Distinctness — d1 ≠ d2 ≠ target, both tiers.
      expect(gentle[0].word).not.toBe(target.word)
      expect(gentle[1].word).not.toBe(target.word)
      expect(gentle[0].word).not.toBe(gentle[1].word)
      expect(trap[0].word).not.toBe(target.word)
      expect(trap[1].word).not.toBe(target.word)
      expect(trap[0].word).not.toBe(trap[1].word)
      resolvedCount += 1
    }
    expect(resolvedCount).toBe(7)
  })

  it('every ch-target gentle pair is two ch-pool neighbours (spec §2 gentle rule)', () => {
    // Gentle rule: BOTH entries are ch-pool words — Marian distinguishes
    // by picture, not by ch-vs-s. Count-based: tally non-ch-pool gentle
    // distractors, assert zero.
    const chPool = new Set<string>(CH_TARGET_WORDS)
    const nonChPoolGentle: string[] = []
    for (const word of CH_TARGET_WORDS) {
      const [d1, d2] = pickDistractors(getWordEntry(word), 1)
      for (const d of [d1, d2]) {
        if (!chPool.has(d.word)) nonChPoolGentle.push(`${word}->${d.word}`)
      }
    }
    expect(nonChPoolGentle).toEqual([])
  })

  it('strong-trap subset (chip/chat/chick) trap pair includes its ch/s-contrast distractor', () => {
    // Spec §2 strong-trap subset — these 3 targets have a real-word,
    // 8yo-appropriate s-onset minimal pair (sip/sat/sick). The trap pair
    // must include it.
    const strongTrap: Record<string, string> = {
      chip: 'sip',
      chat: 'sat',
      chick: 'sick',
    }
    for (const [target, expectedSContrast] of Object.entries(strongTrap)) {
      const [d1, d2] = pickDistractors(getWordEntry(target), 5)
      const trapWords = [d1.word, d2.word]
      expect(
        trapWords,
        `${target} trap pair should include s-contrast "${expectedSContrast}"`,
      ).toContain(expectedSContrast)
    }
  })

  it('weak-trap subset (chin/chop/chest/chug) trap pair is two ch-pool neighbours (no s-contrast)', () => {
    // Spec §2 weak-trap subset — no shippable s-contrast word (sin
    // adult-register, sop obscure, sest/sug non-words), so both trap
    // entries are ch-pool neighbours. Count-based: tally any non-ch-pool
    // distractor in these rows, assert zero.
    const chPool = new Set<string>(CH_TARGET_WORDS)
    const sContrastInWeakTrap: string[] = []
    for (const word of ['chin', 'chop', 'chest', 'chug'] as const) {
      const [d1, d2] = pickDistractors(getWordEntry(word), 5)
      for (const d of [d1, d2]) {
        if (!chPool.has(d.word)) sContrastInWeakTrap.push(`${word}->${d.word}`)
      }
    }
    expect(sContrastInWeakTrap).toEqual([])
  })

  it('no ch-tier trio surfaces a forbidden silhouette pair', () => {
    // Defensive — the new FORBIDDEN_PAIRS entries [chest,chip],
    // [chick,chin], [chest,box] plus all prior pairs. pickDistractors
    // throws on a forbidden pair, so a clean run across all problem
    // indices proves the matrix is clean.
    for (const word of CH_TARGET_WORDS) {
      const target = getWordEntry(word)
      for (const problem of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const [d1, d2] = pickDistractors(target, problem)
        expect(
          isForbiddenPair(target.word, d1.word),
          `${target.word}/${d1.word} (problem ${problem})`,
        ).toBe(false)
        expect(
          isForbiddenPair(target.word, d2.word),
          `${target.word}/${d2.word} (problem ${problem})`,
        ).toBe(false)
        expect(
          isForbiddenPair(d1.word, d2.word),
          `${d1.word}/${d2.word} (problem ${problem})`,
        ).toBe(false)
      }
    }
  })

  it('no ch-target trio leaks a CVC short-vowel word, an sh-tier word, or a c-initial /k/-word (cross-tier hygiene, spec §6)', () => {
    // ch-trios contain ONLY ch-pool words + the 3 s-contrast distractors
    // (sip/sat/sick). No `cat`/`dog`/`pen` etc., no `ship`/`shop` etc.
    // Count-based: tally any distractor outside that allowed set across
    // all problem indices.
    const allowed = new Set<string>([
      ...CH_TARGET_WORDS,
      ...CH_S_CONTRAST_DISTRACTORS,
    ])
    const leaks: string[] = []
    for (const word of CH_TARGET_WORDS) {
      const target = getWordEntry(word)
      for (const problem of [1, 5]) {
        const [d1, d2] = pickDistractors(target, problem)
        for (const d of [d1, d2]) {
          if (!allowed.has(d.word)) leaks.push(`${word}@${problem}->${d.word}`)
        }
      }
    }
    expect(leaks).toEqual([])
  })

  it('FORBIDDEN_PAIRS includes the 3 digraphs-ch additions', () => {
    const pairs = FORBIDDEN_PAIRS.map((p) => [...p].sort().join(','))
    for (const expected of [
      ['chest', 'chip'],
      ['chick', 'chin'],
      ['chest', 'box'],
    ].map((p) => [...p].sort().join(','))) {
      expect(pairs).toContain(expected)
    }
  })
})

// --------------------------------------------------------------------------
// Digraphs-th tier (ticket digraphs-th wordPack)
//
// The th-tier reuses the sh + ch cross-orthography distractor machinery
// (Kyle's spec `design/word-song/digraphs-th-word-list.md`, RECONCILED
// against Dave's `design/research/digraph-th-addendum.md`). It is a HYBRID
// of the sh and ch postures (spec §0):
//   - 7 voiceless-/θ/ targets — `thin/bath/math/path/moth/thick/cloth`.
//   - `vowel` IS set on all 7 (like ch, unlike sh) — every th-word uses a
//     short vowel Marian has formally covered (short-i ×2, short-a ×3,
//     short-o ×2).
//   - `phoneme: '/θ/'` IS set on all 7 (like sh's `/ʃ/`, UNLIKE ch which
//     omitted `phoneme`) — `th` is THE canonical multi-phoneme grapheme
//     (/θ/ vs /ð/); the tag is the architectural floor for a future
//     voiced-/ð/ tier (spec §6.1).
//   - TWO `hybridMode: true` entries — `thick` (th + ck double-digraph)
//     and `cloth` (/kl/ onset blend); the other 5 are fully decodable
//     (spec §6.2). th resembles the sh tier's structure, NOT ch's clean
//     zero-`hybridMode` pool.
//   - gentle pair = 2 th-pool neighbours (distinguished by picture).
//   - trap pair = th/t-contrast trap + th-pool neighbour for the
//     strong-trap subset (`thin/thick/path/bath/math` — 5 of 7, the
//     richest of any digraph tier), else 2 th-pool neighbours for the
//     weak-trap subset (`moth/cloth` — no clean real-word t-contrast).
//   - 3 new distractor-only t-contrast entries (`tin/tick/pat`); `bat` +
//     `mat` are dual-role (reuse their short-a CVC `TARGET_WORDS` entries
//     as `bath`'s / `math`'s t-contrast traps).
// --------------------------------------------------------------------------

describe('digraphs-th tier — wordPack rows', () => {
  const TH_TARGET_WORDS = [
    'thin',
    'bath',
    'math',
    'path',
    'moth',
    'thick',
    'cloth',
  ] as const
  // The 5 strong-trap t-contrast distractors: 3 new distractor-only
  // (`tin/tick/pat`) + 2 dual-role existing short-a CVC targets
  // (`bat/mat`).
  const TH_T_CONTRAST_DISTRACTORS = [
    'tin',
    'tick',
    'pat',
    'bat',
    'mat',
  ] as const
  const TH_VOWELS: Record<string, 'a' | 'o' | 'u' | 'i' | 'e'> = {
    thin: 'i',
    bath: 'a',
    math: 'a',
    path: 'a',
    moth: 'o',
    thick: 'i',
    cloth: 'o',
  }
  const TH_HYBRID_MODE_WORDS = ['thick', 'cloth'] as const

  it('all 7 th-target WordEntry rows exist with isTarget: true, vowel set, and phoneme: "/θ/"', () => {
    let foundCount = 0
    for (const word of TH_TARGET_WORDS) {
      const entry = getWordEntry(word)
      foundCount += 1
      expect(entry.isTarget, `${word} isTarget`).toBe(true)
      // `vowel` IS set on every th entry (like ch, unlike sh) — every
      // th-word uses a short vowel Marian has covered.
      expect(entry.vowel, `${word} vowel`).toBe(TH_VOWELS[word])
      // `phoneme: '/θ/'` IS set on all 7 — the load-bearing schema
      // divergence from ch (which omitted `phoneme`). `th` is THE
      // canonical multi-phoneme grapheme; the tag scopes distractor
      // selection so a future voiced-/ð/ word can never co-occur in a
      // th-trio (spec §6.1 / AC12).
      expect(entry.phoneme, `${word} phoneme`).toBe('/θ/')
    }
    // Count-based: all 7 resolved (none threw, none missing).
    expect(foundCount).toBe(7)
  })

  it('thick + cloth carry hybridMode: true; the other 5 th targets do not (spec §6.2 / AC13)', () => {
    // RECONCILED — Dave §3e: `thick` (th-onset + ck-coda double-digraph)
    // and `cloth` (/kl/ onset blend) ship recognition-only. The other 5
    // (`thin/bath/math/path/moth`) are fully decodable. th is NOT a clean
    // zero-`hybridMode` tier the way ch was — it resembles the sh tier's
    // structure. Count-based: the set of hybridMode th words is exactly
    // [thick, cloth].
    const hybridThWords = TH_TARGET_WORDS.filter(
      (w) => getWordEntry(w).hybridMode === true,
    )
    expect([...hybridThWords].sort()).toEqual([...TH_HYBRID_MODE_WORDS].sort())
    // The other 5 carry no hybridMode flag (absent === false default).
    for (const word of TH_TARGET_WORDS) {
      if ((TH_HYBRID_MODE_WORDS as readonly string[]).includes(word)) continue
      expect(
        getWordEntry(word).hybridMode,
        `${word} hybridMode`,
      ).toBeUndefined()
    }
  })

  it('tin + tick + pat are distractor-only entries (isTarget: false), NOT phoneme-tagged', () => {
    for (const word of ['tin', 'tick', 'pat'] as const) {
      const entry = getWordEntry(word)
      expect(entry.isTarget, `${word} isTarget`).toBe(false)
      // NOT phoneme-tagged — the th-target rows reference them as untagged
      // t-contrast distractors. Tagging them `/t/` would trip the
      // phoneme-mismatch defensive check against the `/θ/`-tagged th
      // targets (spec §6.1).
      expect(entry.phoneme, `${word} phoneme`).toBeUndefined()
    }
    // They keep their real short vowel — they ARE short-vowel CVC words,
    // just not th-tier targets.
    expect(getWordEntry('tin').vowel).toBe('i')
    expect(getWordEntry('tick').vowel).toBe('i')
    expect(getWordEntry('pat').vowel).toBe('a')
    // The full distractor-only set after the th tier: sh's sell/sop +
    // ch's sat/sick + th's tin/tick/pat.
    const distractorOnlyWords = DISTRACTOR_ONLY_WORDS.map((e) => e.word)
    expect(distractorOnlyWords).toEqual([
      'sell',
      'sop',
      'sat',
      'sick',
      'tin',
      'tick',
      'pat',
      'bit', // simple-sentences `cat-sat-mat` grammar-fix target (#429)
    ])
  })

  it('bat + mat remain single short-a TARGET_WORDS entries (dual-role across short-a / th — not duplicated)', () => {
    // `bat` / `mat` are the th/t-contrast traps for `bath` / `math` AND
    // their own short-a CVC targets — referenced by string from the
    // th-tier matrix, NOT added as second entries.
    for (const word of ['bat', 'mat'] as const) {
      const entries = TARGET_WORDS.filter((e) => e.word === word)
      expect(entries, `${word} entry count`).toHaveLength(1)
      expect(entries[0].vowel, `${word} vowel`).toBe('a')
      expect(entries[0].isTarget, `${word} isTarget`).toBe(true)
      // Plain short-a CVC words — NOT phoneme-tagged (an untagged
      // distractor passes the `pickDistractors` phoneme-scoping check
      // against a `/θ/`-tagged th target by design).
      expect(entries[0].phoneme, `${word} phoneme`).toBeUndefined()
    }
  })

  it('each th-target produces exactly 2 distractors per pickDistractors (gentle + trap)', () => {
    let resolvedCount = 0
    for (const word of TH_TARGET_WORDS) {
      const target = getWordEntry(word)
      const gentle = pickDistractors(target, 1)
      const trap = pickDistractors(target, 5)
      expect(gentle, `${word} gentle`).toHaveLength(2)
      expect(trap, `${word} trap`).toHaveLength(2)
      // Distinctness — d1 ≠ d2 ≠ target, both tiers.
      expect(gentle[0].word).not.toBe(target.word)
      expect(gentle[1].word).not.toBe(target.word)
      expect(gentle[0].word).not.toBe(gentle[1].word)
      expect(trap[0].word).not.toBe(target.word)
      expect(trap[1].word).not.toBe(target.word)
      expect(trap[0].word).not.toBe(trap[1].word)
      resolvedCount += 1
    }
    expect(resolvedCount).toBe(7)
  })

  it('every th-target gentle pair is two th-pool neighbours (spec §2 gentle rule)', () => {
    // Gentle rule: BOTH entries are th-pool words — Marian distinguishes
    // by picture, not by th-vs-t. Count-based: tally non-th-pool gentle
    // distractors, assert zero.
    const thPool = new Set<string>(TH_TARGET_WORDS)
    const nonThPoolGentle: string[] = []
    for (const word of TH_TARGET_WORDS) {
      const [d1, d2] = pickDistractors(getWordEntry(word), 1)
      for (const d of [d1, d2]) {
        if (!thPool.has(d.word)) nonThPoolGentle.push(`${word}->${d.word}`)
      }
    }
    expect(nonThPoolGentle).toEqual([])
  })

  it('strong-trap subset (thin/thick/path/bath/math) trap pair includes its th/t-contrast distractor', () => {
    // Spec §2 strong-trap subset — these 5 targets have a real-word,
    // 8yo-appropriate t-contrast minimal pair (tin/tick/pat/bat/mat). The
    // trap pair must include it. This is the richest strong-trap subset
    // of any digraph tier (sh: 3, ch: 3, th: 5).
    const strongTrap: Record<string, string> = {
      thin: 'tin',
      thick: 'tick',
      path: 'pat',
      bath: 'bat',
      math: 'mat',
    }
    for (const [target, expectedTContrast] of Object.entries(strongTrap)) {
      const [d1, d2] = pickDistractors(getWordEntry(target), 5)
      const trapWords = [d1.word, d2.word]
      expect(
        trapWords,
        `${target} trap pair should include t-contrast "${expectedTContrast}"`,
      ).toContain(expectedTContrast)
    }
  })

  it('weak-trap subset (moth/cloth) trap pair is two th-pool neighbours (no t-contrast)', () => {
    // Spec §2 weak-trap subset — no clean real-word t-contrast
    // (`moth`→"mot" non-word; `cloth`'s /kl/ onset has no single
    // t-substitutable consonant), so both trap entries are th-pool
    // neighbours. Count-based: tally any non-th-pool distractor in these
    // rows, assert zero.
    const thPool = new Set<string>(TH_TARGET_WORDS)
    const tContrastInWeakTrap: string[] = []
    for (const word of ['moth', 'cloth'] as const) {
      const [d1, d2] = pickDistractors(getWordEntry(word), 5)
      for (const d of [d1, d2]) {
        if (!thPool.has(d.word)) tContrastInWeakTrap.push(`${word}->${d.word}`)
      }
    }
    expect(tContrastInWeakTrap).toEqual([])
  })

  it('no th-tier trio surfaces a forbidden silhouette pair', () => {
    // Defensive — the new FORBIDDEN_PAIRS entries [thin,thick],
    // [path,moth], [bath,box] plus all prior pairs. pickDistractors
    // throws on a forbidden pair, so a clean run across all problem
    // indices proves the matrix is clean. (This is the regression guard
    // for the spec-§2-preview defect: the spec's illustrative
    // `moth: trap: ['thin','thick']` would have tripped this — the
    // shipped matrix uses `['thin','math']` instead. See wordPack.ts
    // moth-row deviation note.)
    for (const word of TH_TARGET_WORDS) {
      const target = getWordEntry(word)
      for (const problem of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const [d1, d2] = pickDistractors(target, problem)
        expect(
          isForbiddenPair(target.word, d1.word),
          `${target.word}/${d1.word} (problem ${problem})`,
        ).toBe(false)
        expect(
          isForbiddenPair(target.word, d2.word),
          `${target.word}/${d2.word} (problem ${problem})`,
        ).toBe(false)
        expect(
          isForbiddenPair(d1.word, d2.word),
          `${d1.word}/${d2.word} (problem ${problem})`,
        ).toBe(false)
      }
    }
  })

  it('no th-target trio leaks a generic CVC word, an sh/ch-tier word, or a voiced-/ð/ word (cross-tier hygiene, spec §6)', () => {
    // th-trios contain ONLY th-pool words + the 5 t-contrast distractors
    // (tin/tick/pat/bat/mat). No generic `cat`/`dog`/`pen`, no
    // `ship`/`chip`, no `the`/`this`. `bat`/`mat` ARE permitted — they
    // are the diagnostic t-contrast traps, not generic filler.
    // Count-based: tally any distractor outside that allowed set across
    // all problem indices.
    const allowed = new Set<string>([
      ...TH_TARGET_WORDS,
      ...TH_T_CONTRAST_DISTRACTORS,
    ])
    const leaks: string[] = []
    for (const word of TH_TARGET_WORDS) {
      const target = getWordEntry(word)
      for (const problem of [1, 5]) {
        const [d1, d2] = pickDistractors(target, problem)
        for (const d of [d1, d2]) {
          if (!allowed.has(d.word)) leaks.push(`${word}@${problem}->${d.word}`)
        }
      }
    }
    expect(leaks).toEqual([])
  })

  it('every th-tier distractor carries phoneme "/θ/" OR is untagged (phoneme-scoping never rejects a v1 th pairing)', () => {
    // Spec §6.1: the phoneme-scoping branch in pickDistractors is
    // REACTIVATED for th-tier targets (they carry `phoneme: '/θ/'`) — but
    // every th-tier distractor is either a `/θ/`-tagged th-pool neighbour
    // (matches) or an UNTAGGED t-contrast trap (the branch does not
    // fire). So it never rejects a v1 th pairing. A clean pickDistractors
    // run across all problem indices already proves this (the branch
    // throws on mismatch), but assert the distractor phoneme tags
    // directly too for legibility. Count-based: tally any th-tier
    // distractor whose phoneme is tagged AND ≠ '/θ/', assert zero.
    const mismatches: string[] = []
    for (const word of TH_TARGET_WORDS) {
      const target = getWordEntry(word)
      for (const problem of [1, 5]) {
        const [d1, d2] = pickDistractors(target, problem)
        for (const d of [d1, d2]) {
          if (d.phoneme !== undefined && d.phoneme !== '/θ/') {
            mismatches.push(`${word}@${problem}->${d.word}(${d.phoneme})`)
          }
        }
      }
    }
    expect(mismatches).toEqual([])
  })

  it('FORBIDDEN_PAIRS includes the 3 digraphs-th additions', () => {
    const pairs = FORBIDDEN_PAIRS.map((p) => [...p].sort().join(','))
    for (const expected of [
      ['thin', 'thick'],
      ['path', 'moth'],
      ['bath', 'box'],
    ].map((p) => [...p].sort().join(','))) {
      expect(pairs).toContain(expected)
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
  it("contains the silhouette-similarity pairs from Kyle's pack-doc + the v2 short-o + v3 short-u + v4 short-i + v5 short-e + digraphs-sh + digraphs-ch + digraphs-th additions (tickets 86c9m3ae3 / 86c9q9ben / 86c9qdba4 / 86c9teua2 / digraphs-sh / digraphs-ch / digraphs-th)", () => {
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
      ['shed', 'shop'], // digraphs-sh — both small-structure silhouettes (in-pool hygiene)
      ['shoe', 'shop'], // digraphs-sh — shop-as-shoe-store silhouette collision risk
      ['ship', 'tub'], // digraphs-sh — both vessel-like silhouettes (cross-pool hygiene)
      ['chest', 'chip'], // digraphs-ch — small flat chip vs small chest mass-contrast (in-pool hygiene)
      ['chick', 'chin'], // digraphs-ch — both small rounded-form silhouettes (in-pool hygiene)
      ['chest', 'box'], // digraphs-ch — treasure-trunk vs plain cuboid (cross-pool hygiene)
      ['thin', 'thick'], // digraphs-th — antonym-pair silhouettes (same object class, opposite property extreme) — in-pool hygiene
      ['path', 'moth'], // digraphs-th — both low-mass irregular-outline silhouettes — in-pool hygiene
      ['bath', 'box'], // digraphs-th — open-top rounded tub vs plain cuboid — cross-pool hygiene
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
  // Digraph-tier words are NOT CVC cross-vowel nodes — they belong to the
  // `digraphs-sh` / `digraphs-ch` SkillNodes, not `cvc-words-short-*`, so
  // they never participate in cross-vowel distractor mixing (which is
  // gated on `mastery.ts CVC_CROSS_VOWEL_NODES`). The digraphs-sh tier
  // could rely on the `w.vowel !== undefined` guard below because sh-tier
  // entries OMIT `vowel`. The digraphs-ch tier CANNOT — ch entries SET
  // `vowel` (every ch-word uses a short vowel Marian has covered), and 3
  // of them (`chat` /a/, `chop` /o/, `chug` /u/) carry vowels that ARE in
  // `CVC_CROSS_VOWEL_VOWELS`. Without an explicit exclusion they would
  // false-fail the cross-vowel exhaustiveness invariants. This Set is the
  // ch-tier analogue of `POOL_EXTENSION_PENDING_CROSSVOWEL` — same
  // posture: a non-cross-vowel-tier addition to TARGET_WORDS doesn't
  // false-fail this test. When/if a future ticket promotes a digraph tier
  // into cross-vowel mixing, remove it here AND extend
  // `CVC_CROSS_VOWEL_NODES` + `CVC_CROSS_VOWEL_VOWELS` together.
  //
  // The digraphs-th tier is the same shape as ch — it SETS `vowel` (all 7
  // th-words use a short vowel Marian has covered: short-i ×2, short-a ×3,
  // short-o ×2), so the `w.vowel !== undefined` guard does NOT exclude
  // them; they need the explicit Set. Reuses the module-level
  // `ALL_DIGRAPH_TIER_WORDS` so the sh + ch + th lists never drift apart.
  const DIGRAPH_TIER_WORDS = ALL_DIGRAPH_TIER_WORDS
  const CROSS_VOWEL_VOWEL_SET: ReadonlySet<'a' | 'o' | 'u' | 'i' | 'e'> =
    new Set(CVC_CROSS_VOWEL_VOWELS)
  const CROSS_VOWEL_TARGETS = TARGET_WORDS.filter(
    (w) =>
      w.isTarget &&
      !PROBE_WORDS.has(w.word) &&
      !POOL_EXTENSION_PENDING_CROSSVOWEL.has(w.word) &&
      !DIGRAPH_TIER_WORDS.has(w.word) &&
      // `w.vowel` is optional (digraphs-sh tier omits it — sh-tier words
      // are phoneme-classified, not vowel-classified). The `undefined`
      // guard keeps the sh-tier words out of the cross-vowel
      // exhaustiveness scan; the digraphs-ch tier (which SETS `vowel`) is
      // excluded explicitly via `DIGRAPH_TIER_WORDS` above.
      w.vowel !== undefined &&
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
    // Digraph-tier words are not CVC cross-vowel nodes — see the
    // `DIGRAPH_TIER_WORDS` rationale in the `TARGET_PAIRINGS_CROSSVOWEL`
    // describe block above. The digraphs-ch + digraphs-th tiers SET
    // `vowel` (3 of the 7 ch words carry a/o/u; all 7 th words carry a
    // short vowel), so the `w.vowel !== undefined` guard alone does NOT
    // exclude them — they need the explicit Set. Reuses the module-level
    // `ALL_DIGRAPH_TIER_WORDS` so the sh + ch + th lists never drift.
    const DIGRAPH_TIER_WORDS = ALL_DIGRAPH_TIER_WORDS
    const CROSS_VOWEL_VOWEL_SET: ReadonlySet<'a' | 'o' | 'u' | 'i' | 'e'> =
      new Set(CVC_CROSS_VOWEL_VOWELS)
    const targets = TARGET_WORDS.filter(
      (w) =>
        w.isTarget &&
        !PROBE_WORDS.has(w.word) &&
        !POOL_EXTENSION_PENDING_CROSSVOWEL.has(w.word) &&
        !DIGRAPH_TIER_WORDS.has(w.word) &&
        // `w.vowel` is optional post-digraphs-sh tier — sh-tier words
        // omit it. Guard excludes sh from the cross-vowel scan; ch is
        // excluded explicitly via `DIGRAPH_TIER_WORDS` (ch SETS `vowel`).
        w.vowel !== undefined &&
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

// --------------------------------------------------------------------------
// Phoneme-scoping (Kevin's digraph-architecture-proposal §3 — phoneme-tag
// infrastructure PR, gum/gem latent-vulnerability closeout).
//
// The phoneme tag is an opt-in field on WordEntry. When a target carries a
// phoneme tag, any distractor that ALSO carries one must match — defensive
// throw, not silent filter. These tests drive the new branch through every
// shape combination of (target tagged?, distractor tagged?).
// --------------------------------------------------------------------------

describe('pickDistractors — phoneme-scoping (digraph-architecture-proposal §3)', () => {
  // Synthesise word entries to exercise the phoneme branch without
  // depending on the live matrix's contents — mirrors the
  // "out-of-matrix" test pattern but uses a real matrix row + mocked
  // wordPack to surface a controlled (target, d1, d2) phoneme triple.
  //
  // Each test resets module state, mocks `./wordPack` with a single
  // patched TARGET_PAIRINGS row + patched entries with phoneme tags,
  // then imports `pickDistractors` fresh. The mock is scoped to a
  // single test (`vi.resetModules()` + `vi.doUnmock()`).

  async function withPatchedPack<T>(
    targetWord: string,
    targetPhoneme: string | undefined,
    d1Word: string,
    d1Phoneme: string | undefined,
    d2Word: string,
    d2Phoneme: string | undefined,
    run: (
      pickDistractors: typeof import('./wordDistractors').pickDistractors,
      getWordEntry: typeof import('./wordPack').getWordEntry,
    ) => T,
  ): Promise<T> {
    vi.resetModules()
    vi.doMock('./wordPack', async () => {
      const real =
        await vi.importActual<typeof import('./wordPack')>('./wordPack')
      // Build a synthetic TARGET_WORDS list whose target + d1 + d2
      // entries carry the requested phoneme tags. Build a synthetic
      // TARGET_PAIRINGS row mapping target → both gentle and trap to
      // [d1, d2] so problemIndex doesn't matter.
      const realEntries: ReadonlyArray<import('./wordPack').WordEntry> =
        real.ALL_WORDS
      const findEntry = (word: string) => {
        const found = realEntries.find((e) => e.word === word)
        if (!found)
          throw new Error(`test setup: no ALL_WORDS entry for ${word}`)
        return found
      }
      const patchedEntries = [
        { ...findEntry(targetWord), phoneme: targetPhoneme },
        { ...findEntry(d1Word), phoneme: d1Phoneme },
        { ...findEntry(d2Word), phoneme: d2Phoneme },
      ]
      // Replace the entries that match by word; carry over everything
      // else so unrelated lookups still work.
      const patchedAll = realEntries.map((e) => {
        const replacement = patchedEntries.find((p) => p.word === e.word)
        return replacement ?? e
      })
      const patchedTargets = real.TARGET_WORDS.map((e) => {
        const replacement = patchedEntries.find((p) => p.word === e.word)
        return replacement ?? e
      })
      const patchedPairings = {
        ...real.TARGET_PAIRINGS,
        [targetWord]: {
          gentle: [d1Word, d2Word] as const,
          trap: [d1Word, d2Word] as const,
        },
      } as typeof real.TARGET_PAIRINGS
      const patchedGetWordEntry = (word: string) => {
        const hit = patchedAll.find((e) => e.word === word)
        if (!hit) {
          throw new Error(
            `[wordPack] No entry for word "${word}" — must be in TARGET_WORDS or DISTRACTOR_ONLY_WORDS`,
          )
        }
        return hit
      }
      return {
        ...real,
        ALL_WORDS: patchedAll,
        TARGET_WORDS: patchedTargets,
        TARGET_PAIRINGS: patchedPairings,
        getWordEntry: patchedGetWordEntry,
      }
    })
    const { pickDistractors: localPick } = await import('./wordDistractors')
    const { getWordEntry: localGet } = await import('./wordPack')
    try {
      return run(localPick, localGet)
    } finally {
      vi.doUnmock('./wordPack')
      vi.resetModules()
    }
  }

  it('throws when target is tagged + d1 is tagged with a mismatching phoneme', async () => {
    // Target /g/, distractor1 /dʒ/ — the canonical gum-vs-gem case.
    await withPatchedPack(
      'cat',
      '/g/',
      'bus',
      '/dʒ/',
      'sun',
      undefined,
      (pick, get) => {
        expect(() => pick(get('cat'), 1)).toThrow(/phoneme mismatch/)
        expect(() => pick(get('cat'), 1)).toThrow(/cat \(\/g\/\)/)
        expect(() => pick(get('cat'), 1)).toThrow(/bus \(\/dʒ\/\)/)
      },
    )
  })

  it('throws when target is tagged + d2 is tagged with a mismatching phoneme', async () => {
    // Mismatch on the second distractor specifically — exercises the
    // separate d2 branch (parallel to d1, distinct error site).
    await withPatchedPack(
      'cat',
      '/θ/',
      'bus',
      undefined,
      'sun',
      '/ð/',
      (pick, get) => {
        expect(() => pick(get('cat'), 1)).toThrow(/phoneme mismatch/)
        expect(() => pick(get('cat'), 1)).toThrow(/cat \(\/θ\/\)/)
        expect(() => pick(get('cat'), 1)).toThrow(/sun \(\/ð\/\)/)
      },
    )
  })

  it('passes when target is tagged + a distractor is untagged (one-side-tagged is opt-in)', async () => {
    // Target /g/, d1 untagged, d2 untagged. The phoneme tag is opt-in;
    // an untagged distractor is filler from another tier where the
    // vowel axis already constrains things.
    await withPatchedPack(
      'cat',
      '/g/',
      'bus',
      undefined,
      'sun',
      undefined,
      (pick, get) => {
        expect(() => pick(get('cat'), 1)).not.toThrow()
        const [d1, d2] = pick(get('cat'), 1)
        expect([d1.word, d2.word]).toEqual(['bus', 'sun'])
      },
    )
  })

  it('passes when target is untagged + distractors are tagged (target-side gate)', async () => {
    // Untagged target — the phoneme branch is gated on
    // `target.phoneme !== undefined` and short-circuits cleanly.
    await withPatchedPack(
      'cat',
      undefined,
      'bus',
      '/g/',
      'sun',
      '/dʒ/',
      (pick, get) => {
        expect(() => pick(get('cat'), 1)).not.toThrow()
        const [d1, d2] = pick(get('cat'), 1)
        expect([d1.word, d2.word]).toEqual(['bus', 'sun'])
      },
    )
  })

  it('passes when target and both distractors are untagged (no-op case)', async () => {
    // No tags anywhere — the entire branch is a no-op. Confirms the
    // back-compat posture for the bulk of the pack.
    await withPatchedPack(
      'cat',
      undefined,
      'bus',
      undefined,
      'sun',
      undefined,
      (pick, get) => {
        expect(() => pick(get('cat'), 1)).not.toThrow()
        const [d1, d2] = pick(get('cat'), 1)
        expect([d1.word, d2.word]).toEqual(['bus', 'sun'])
      },
    )
  })

  it('passes when target and both distractors are tagged with matching phonemes', async () => {
    // All three sides tagged with the same phoneme — the match path.
    // This is the "voiceless-th tier authored correctly" shape.
    await withPatchedPack(
      'cat',
      '/θ/',
      'bus',
      '/θ/',
      'sun',
      '/θ/',
      (pick, get) => {
        expect(() => pick(get('cat'), 1)).not.toThrow()
        const [d1, d2] = pick(get('cat'), 1)
        expect([d1.word, d2.word]).toEqual(['bus', 'sun'])
      },
    )
  })
})

describe('WordEntry.phoneme — live-pack annotations (gum/gem latent-vulnerability)', () => {
  it('gum carries phoneme: "/g/"', () => {
    const gum = getWordEntry('gum')
    expect(gum.phoneme).toBe('/g/')
  })

  it('gem carries phoneme: "/dʒ/"', () => {
    const gem = getWordEntry('gem')
    expect(gem.phoneme).toBe('/dʒ/')
  })

  it('most pack entries are untagged (phoneme is undefined)', () => {
    // Spot-check a handful of unambiguous-grapheme entries. The
    // phoneme tag is opt-in for grapheme-ambiguity cases only; the
    // bulk of the pack stays undefined.
    expect(getWordEntry('cat').phoneme).toBeUndefined()
    expect(getWordEntry('dog').phoneme).toBeUndefined()
    expect(getWordEntry('sun').phoneme).toBeUndefined()
    expect(getWordEntry('pig').phoneme).toBeUndefined()
    expect(getWordEntry('bed').phoneme).toBeUndefined()
  })

  it('gum and gem live in different vowel tiers so same-vowel rule masks the latent collision in v1', () => {
    // Sanity check that the v1 same-vowel-only rule is doing what the
    // architecture proposal §3.5 claims it does — gum is short-u, gem
    // is short-e. Adding phoneme tags is belt-and-braces; the v1
    // safety comes from the vowel axis still.
    expect(getWordEntry('gum').vowel).toBe('u')
    expect(getWordEntry('gem').vowel).toBe('e')
  })
})
