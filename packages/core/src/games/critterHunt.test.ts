/**
 * Letter critters' word hunt, the core (`design/native/critters-word-hunt.md`
 * § 1, ACs H1-H6; the rules are Dave's ruling of 2026-10-25,
 * `design/research/critters-word-hunt-2026-10-25.md`), and its four-letter
 * rounds (`design/native/critters-four-letter.md` § 1, ACs F1-F7; Dave's
 * ruling of 2026-10-26, (B), `design/research/critters-four-letter-2026-10-26.md`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { progressAtStep } from '../debug/stepProgress'
import {
  activateLearner,
  activeLearner,
  addLearner,
  ensureLearnerList,
  learnerKey,
  resetLearnersForTests,
} from '../learners'
import { setKeyValueStore, type KeyValueStore } from '../platform/keyValueStore'
import type { SkillNode } from '../progress/types'
import { PROBE_RESERVE_WORDS } from '../wordSong/novelProbeWords'
import {
  freshHuntRecord,
  HUNT_FALLBACK,
  HUNT_FAMILIAR,
  HUNT_FOUR_FALLBACK,
  HUNT_FOUR_UNDEALT,
  HUNT_RUDE_FOUR,
  HUNT_STORAGE_KEY,
  huntComplete,
  huntDeal,
  huntBoardOrder,
  huntFind,
  huntHintTarget,
  huntOpenLengths,
  huntProbeGuard,
  huntRoundOf,
  huntRounds,
  huntVowels,
  loadHuntRecord,
  saveHuntRecord,
  type HuntRound,
} from './critterHunt'
import {
  CRITTER_NEVER_SAY,
  CRITTER_NOT_SAID,
  CRITTER_PICTURE_WORDS,
  CRITTER_REAL_WORDS,
  CRITTER_SAID_LATER,
  CRITTER_SAID_PICTURE_WORDS,
  CRITTER_SAID_WORDS,
  HUNT_FOUR_PICTURE_WORDS,
  HUNT_FOUR_TARGETS,
  critterHasPicture,
} from './playPlace'

class MapStore implements KeyValueStore {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}

/** mulberry32: a small seeded generator, as the tests' `rng`. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Dave (1)'s familiar list, as printed. */
const DAVES_68 =
  'bad fat had lap mad pat ran sad sat wag wax and get let men met pet red set ten wet fed vet big bit did dig dip fin fit fix hid him hip hit lip lit mix pit rip sit six tin tip win dot fog got hop hog job jog lot nod not but cut dug fun hug hum mud mug mum pup rub run tug'.split(
    ' ',
  )

/** F7: the nine said later that join HUNT_FAMILIAR (ant and elf have pictures). */
const F7_FAMILIAR = 'act add end ill its odd off'.split(' ')

const CRITTER_LETTERS = 'abcdefghijlmnoprstuvwx'
const VOWELS = new Set('aeiou')

/**
 * What the critters can build from `letters`, counted the long way: each
 * letter of the word on the meadow, the vowel at most once, a consonant at
 * most twice.
 */
function buildable(word: string, letters: readonly string[]): boolean {
  return [...word].every((ch) => {
    const uses = [...word].filter((x) => x === ch).length
    return letters.includes(ch) && uses <= (VOWELS.has(ch) ? 1 : 2)
  })
}
const spells = (letters: readonly string[]) =>
  [...CRITTER_REAL_WORDS].filter((w) => buildable(w, letters))

/** Checks a round against every rule of Dave (1). */
function expectDaveRound(r: HuntRound, vowel: string) {
  expect(r.letters).toHaveLength(6)
  expect(r.letters[0]).toBe(vowel)
  const cs = r.letters.slice(1)
  expect(cs).toEqual([...cs].sort())
  expect(new Set(cs).size).toBe(5)
  for (const c of cs) {
    expect(CRITTER_LETTERS).toContain(c)
    expect(VOWELS.has(c)).toBe(false)
  }
  expect(r.targets.length).toBeGreaterThanOrEqual(5)
  expect(r.targets.length).toBeLessThanOrEqual(8)
  expect(r.targets.filter(critterHasPicture).length).toBeGreaterThanOrEqual(3)
  expect(r.extras.length).toBeLessThanOrEqual(3)
  for (const c of cs) expect(r.targets.some((w) => w.includes(c))).toBe(true)
  expect(spells(r.letters).filter((w) => CRITTER_NOT_SAID.has(w))).toEqual([])
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  resetLearnersForTests()
  setKeyValueStore(null)
  vi.restoreAllMocks()
})

describe('H1: huntVowels', () => {
  it('[] for null and before blending sounds; a on it; o, u, i, e as their steps open', () => {
    const at = (step: SkillNode) => {
      setKeyValueStore(new MapStore())
      return huntVowels(progressAtStep(step))
    }
    expect(huntVowels(null)).toEqual([])
    expect(at('letter-names')).toEqual([])
    expect(at('letter-sounds')).toEqual([])
    expect(at('blending-cv')).toEqual(['a'])
    expect(at('sounding-out')).toEqual(['a'])
    expect(at('cvc-words')).toEqual(['a'])
    // Marian today: cvc-words mastered, short o current.
    expect(at('cvc-words-short-o')).toEqual(['a', 'o'])
    expect(at('cvc-words-short-u')).toEqual(['a', 'o', 'u'])
    expect(at('cvc-words-short-i')).toEqual(['a', 'o', 'u', 'i'])
    expect(at('cvc-words-short-e')).toEqual(['a', 'o', 'u', 'i', 'e'])
  })

  it('the probe guard is on exactly while cvc-words is current', () => {
    const at = (step: SkillNode) => {
      setKeyValueStore(new MapStore())
      return huntProbeGuard(progressAtStep(step))
    }
    expect(huntProbeGuard(null)).toBe(false)
    expect(at('sounding-out')).toBe(false)
    expect(at('cvc-words')).toBe(true)
    expect(at('cvc-words-short-o')).toBe(false)
  })
})

describe('H2: huntDeal', () => {
  it.each(['a', 'e', 'i', 'o', 'u'])(
    'over 1,000 seeds, vowel %s: Dave (1)’s round, never last’s letters, the same seed the same round',
    (vowel) => {
      const last = huntRounds(vowel)[0]!.letters
      for (let seed = 0; seed < 1000; seed++) {
        const r = huntDeal([vowel], seeded(seed), { last })
        expectDaveRound(r, vowel)
        expect(r.letters).not.toEqual(last)
        expect(huntDeal([vowel], seeded(seed), { last })).toEqual(r)
      }
    },
  )

  it('with the probe guard, no probe-reserve word is spellable (95 short-a rounds since F7; 11 before)', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const r = huntDeal(['a'], seeded(seed), { probeGuard: true })
      expectDaveRound(r, 'a')
      const words = spells(r.letters)
      expect(words.filter((w) => PROBE_RESERVE_WORDS.includes(w))).toEqual([])
    }
    expect(huntRounds('a', { probeGuard: true })).toHaveLength(95)
  })

  it('the counts, re-pinned by F7: 439 rounds in all (a 203, e 39, i 53, o 83, u 61), Dave (1)’s count with the nine said later; 184 before', () => {
    expect(
      Object.fromEntries(
        [...'aeiou'].map((v) => [v, huntRounds(v).length] as const),
      ),
    ).toEqual({ a: 203, e: 39, i: 53, o: 83, u: 61 })
  })

  it('picks one of her vowels; the pinned fallbacks are Dave rounds that pass the probe guard', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 200; seed++) {
      seen.add(huntDeal(['a', 'o'], seeded(seed)).letters[0]!)
    }
    expect([...seen].sort()).toEqual(['a', 'o'])
    expect(huntDeal([], seeded(1)).letters[0]).toBe('a')
    for (const [v, letters] of Object.entries(HUNT_FALLBACK)) {
      const r = huntRoundOf(letters, { probeGuard: true })
      expect(r).not.toBeNull()
      expectDaveRound(r!, v)
    }
  })

  it('rejects a round that spells a quiet word: bar and art in a b g h r t', () => {
    expect(
      spells([...'abghrt'])
        .filter((w) => CRITTER_NOT_SAID.has(w))
        .sort(),
    ).toEqual(['art', 'bar'])
    expect(huntRoundOf([...'abghrt'])).toBeNull()
  })

  it('F7: Kyle’s sample round a c f m n t, rejected before for ant and act, deals with both as targets', () => {
    expect(huntRoundOf([...'acfmnt'])).toEqual({
      letters: [...'acfmnt'],
      targets: ['act', 'ant', 'can', 'cat', 'fan', 'fat', 'man', 'mat'],
      extras: ['nan', 'tan'],
    })
  })
})

describe('H3: which words count', () => {
  it('HUNT_FAMILIAR is Dave’s 68 and, since F7, the seven said later with no picture: 75, each a word Emma says', () => {
    expect([...HUNT_FAMILIAR].sort()).toEqual(
      [...DAVES_68, ...F7_FAMILIAR].sort(),
    )
    expect(HUNT_FAMILIAR.size).toBe(75)
    for (const w of HUNT_FAMILIAR) {
      expect(
        CRITTER_PICTURE_WORDS.includes(w) || CRITTER_SAID_WORDS.includes(w),
      ).toBe(true)
    }
  })

  it('in every round: targets are the spellable picture, pictured-said and familiar words; extras the other said words; never-say words neither', () => {
    for (const v of 'aeiou') {
      for (const r of huntRounds(v)) {
        const words = spells(r.letters)
        expect(r.targets).toEqual(
          words
            .filter(
              (w) =>
                CRITTER_PICTURE_WORDS.includes(w) ||
                CRITTER_SAID_PICTURE_WORDS.includes(w) ||
                HUNT_FAMILIAR.has(w),
            )
            .sort(),
        )
        expect(r.extras).toEqual(
          words
            .filter(
              (w) => CRITTER_SAID_WORDS.includes(w) && !r.targets.includes(w),
            )
            .sort(),
        )
        for (const w of words.filter((x) => CRITTER_NEVER_SAY.has(x))) {
          expect(r.targets).not.toContain(w)
          expect(r.extras).not.toContain(w)
        }
      }
    }
  })
})

const roundOf = (n: number): HuntRound => {
  const r = [...'aeiou']
    .flatMap((v) => huntRounds(v))
    .find((x) => x.targets.length === n)
  if (r === undefined) throw new Error(`no round with ${n} targets`)
  return r
}

describe('H4: huntComplete', () => {
  it.each([5, 6, 7, 8])(
    'N %i: false at N − 2, true at N − 1 and N, whatever extras',
    (n) => {
      const r = roundOf(n)
      const found = (k: number) => [...r.extras, ...r.targets.slice(0, k)]
      expect(huntComplete(r, found(n - 2))).toBe(false)
      expect(huntComplete(r, found(n - 1))).toBe(true)
      expect(huntComplete(r, found(n))).toBe(true)
      expect(huntComplete(r, r.extras)).toBe(false)
    },
  )
})

describe('P1: huntBoardOrder and huntHintTarget (§ 15.2)', () => {
  // § 15.2's table: picture words a-z · said words with a picture a-z ·
  // targets with no picture a-z.
  const TABLE: [string, string[]][] = [
    ['abghpt', ['bag', 'bat', 'hat', 'tag', 'tap', 'pat']],
    ['abhmpt', ['bat', 'hat', 'mat', 'ham', 'map', 'tap', 'pat']],
    ['ochmpt', ['cot', 'hot', 'mop', 'pot', 'mom', 'pop', 'top', 'hop']],
    ['oghjpt', ['hot', 'pot', 'pop', 'top', 'got', 'hog', 'hop', 'jog']],
    ['ubgmst', ['bug', 'bus', 'tub', 'gum', 'mug', 'mum', 'but', 'tug']],
  ]

  it.each(TABLE)('%s gives § 15.2’s board order', (letters, order) => {
    const r = huntRoundOf([...letters])!
    expect(huntBoardOrder(r)).toEqual(order)
  })

  it('orders picture words, then the other pictured targets, then the rest, each a-z', () => {
    const band = (w: string) =>
      CRITTER_PICTURE_WORDS.includes(w) ? 0 : critterHasPicture(w) ? 1 : 2
    for (const vowel of 'aeiou') {
      for (const r of huntRounds(vowel)) {
        const order = huntBoardOrder(r)
        expect([...order].sort()).toEqual([...r.targets].sort())
        for (let i = 1; i < order.length; i++) {
          const [x, y] = [order[i - 1]!, order[i]!]
          expect(band(x) < band(y) || (band(x) === band(y) && x < y)).toBe(true)
        }
      }
    }
  })

  it('the hint is the first unfound word in board order, for every round and 20 random found sets', () => {
    for (const vowel of 'aeiou') {
      for (const [k, r] of huntRounds(vowel).entries()) {
        const order = huntBoardOrder(r)
        const rng = seeded(k + 1)
        for (let t = 0; t < 20; t++) {
          const found = [...r.targets, ...r.extras].filter(() => rng() < 0.5)
          expect(huntHintTarget(r, found)).toBe(
            order.find((w) => !found.includes(w)),
          )
        }
        expect(huntHintTarget(r, [...r.targets])).toBeUndefined()
      }
    }
  })

  it('the seed’s round: tap (pictured) before pat (no picture)', () => {
    const r = huntRoundOf(['a', 'b', 'g', 'h', 'p', 't'])!
    expect(huntHintTarget(r, [])).toBe('bag')
    expect(huntHintTarget(r, ['bag', 'bat', 'hat'])).toBe('tag')
    expect(huntHintTarget(r, ['bag', 'bat', 'hat', 'tag'])).toBe('tap')
    expect(huntHintTarget(r, ['bag', 'bat', 'hat', 'tag', 'tap'])).toBe('pat')
  })

  it('the record keeps its shape: the order is derived, never stored', () => {
    const r = huntRoundOf(['a', 'b', 'g', 'h', 'p', 't'])!
    const rec = huntFind(huntFind(freshHuntRecord(r), 'tap'), 'bag')
    expect(Object.keys(rec).sort()).toEqual(
      ['complete', 'extras', 'found', 'letters', 'targets'].sort(),
    )
    expect(rec.found).toEqual(['tap', 'bag'])
    expect(rec.targets).toEqual(r.targets)
  })
})

describe('H6: the record, per learner', () => {
  it('round-trips through the learner-scoped store; learner B never reads learner A’s', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    ensureLearnerList()
    const a = activeLearner()!
    const b = addLearner({
      name: 'Sam',
      avatarId: 'owl',
      start: { math: 1, wordSong: 1 },
    })
    activateLearner(a.id)
    const round = huntRoundOf(['a', 'b', 'g', 'h', 'p', 't'])!
    const rec = huntFind(huntFind(freshHuntRecord(round), 'bag'), 'tab')
    saveHuntRecord(rec)
    expect(loadHuntRecord()).toEqual(rec)
    expect(store.data.has(learnerKey(HUNT_STORAGE_KEY, a))).toBe(true)

    activateLearner(b.id)
    expect(loadHuntRecord()).toBeNull()
    const other = freshHuntRecord(huntRoundOf(HUNT_FALLBACK.o!)!)
    saveHuntRecord(other)
    expect(store.data.has(`${HUNT_STORAGE_KEY}:${b.id}`)).toBe(true)

    activateLearner(a.id)
    expect(loadHuntRecord()).toEqual(rec)
    activateLearner(b.id)
    expect(loadHuntRecord()).toEqual(other)
  })

  it('huntFind adds a new target or extra in find order and marks the round complete at N − 1; a repeat or a foreign word changes nothing', () => {
    const round = huntRoundOf(['a', 'b', 'g', 'h', 'p', 't'])!
    let rec = freshHuntRecord(round)
    rec = huntFind(rec, 'hat')
    rec = huntFind(rec, 'gap')
    expect(rec.found).toEqual(['hat', 'gap'])
    expect(huntFind(rec, 'hat')).toBe(rec)
    expect(huntFind(rec, 'cat')).toBe(rec)
    for (const w of ['bag', 'bat', 'pat']) rec = huntFind(rec, w)
    expect(rec.complete).toBe(false)
    rec = huntFind(rec, 'tag')
    expect(rec.complete).toBe(true)
    expect(huntFind(rec, 'tap').complete).toBe(true)
  })

  it('an unreadable or malformed record reads as none', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    store.setItem(HUNT_STORAGE_KEY, '{not json')
    expect(loadHuntRecord()).toBeNull()
    store.setItem(HUNT_STORAGE_KEY, JSON.stringify({ 3: { letters: ['a'] } }))
    expect(loadHuntRecord()).toBeNull()
    const rec = freshHuntRecord(huntRoundOf(HUNT_FALLBACK.a!)!)
    saveHuntRecord(rec)
    expect(loadHuntRecord()).toEqual(rec)
  })
})

// ── Four-letter rounds (critters-four-letter.md § 1, F1-F7) ────────────────

/** Dave 23 (B), "The targets, exact": his 82, by vowel, * = pictured. */
const DAVES_82: Record<string, string> = {
  a: 'flag* hand* lamp* clap* flap slap snap drag glad flat plan swam camp damp ramp* band land sand*',
  o: 'frog* pond* stop* spot plot drop* crop flop plop prop trot blob cost soft from',
  i: 'gift* drip* grip trip flip clip* lift',
  u: 'drum* plum* club plug* slug* spun stun jump* bump dump lump pump* dust must rust just hunt gulp bulb*',
  e: 'tent* nest* belt* bend lend went sent rent bent dent best rest test vest* west felt melt left step stem sled* next text',
}
const daves82 = (v: string) => DAVES_82[v]!.replace(/\*/g, '').split(' ')
const davesPictured = Object.values(DAVES_82)
  .flatMap((ws) => ws.split(' '))
  .filter((w) => w.endsWith('*'))
  .map((w) => w.slice(0, -1))

/**
 * Dave 23 (B), the 18 rude four-letter words, as he prints them. All 18
 * reject a round.
 */
const DAVES_RUDE =
  'cunt shit piss twat slut crap turd damn hell butt slag prat bums tits cums fags gits guns'.split(
    ' ',
  )
/** Dave's Q21 answer: the 25 words no round deals, since they have no clip. */
const DAVES_UNDEALT_25 =
  'crab trap grab slot lost slip snip spin twin grin swim crib list mist fist mint hint limp film snug stub mend send help held'.split(
    ' ',
  )

/** The four-letter words the long way: from `words`, the ones `letters` build. */
const spellsFour = (words: Iterable<string>, letters: readonly string[]) =>
  [...words].filter((w) => buildable(w, letters))

/** Checks a round against every rule of Dave 23 (B) and the Q21 rule (F1). */
function expectFourRound(r: HuntRound, vowel: string) {
  expect(r.letters).toHaveLength(7)
  expect(r.letters[0]).toBe(vowel)
  const cs = r.letters.slice(1)
  expect(cs).toEqual([...cs].sort())
  expect(new Set(cs).size).toBe(6)
  for (const c of cs) {
    expect(CRITTER_LETTERS).toContain(c)
    expect(VOWELS.has(c)).toBe(false)
  }
  expect(r.targets).toEqual(spellsFour(HUNT_FOUR_TARGETS, r.letters).sort())
  expect(r.targets.length).toBeGreaterThanOrEqual(4)
  expect(r.targets.length).toBeLessThanOrEqual(6)
  expect(r.targets.filter(critterHasPicture).length).toBeGreaterThanOrEqual(2)
  expect(
    cs.filter((c) => !r.targets.some((w) => w.includes(c))).length,
  ).toBeLessThanOrEqual(1)
  expect(spellsFour(DAVES_RUDE, r.letters)).toEqual([])
  expect(spellsFour(DAVES_UNDEALT_25, r.letters)).toEqual([])
  expect(r.extras).toEqual([])
}

const FOUR = { length: 4 } as const

describe('F2: the four-letter lists (Dave 23 (B); Q21)', () => {
  it('HUNT_FOUR_TARGETS is Dave’s 82 (a 18, o 15, i 7, u 19, e 23); HUNT_RUDE_FOUR his printed 18; hump on neither', () => {
    expect([...HUNT_FOUR_TARGETS].sort()).toEqual(
      [...'aoiue'].flatMap(daves82).sort(),
    )
    expect([...'aoiue'].map((v) => daves82(v).length)).toEqual([
      18, 15, 7, 19, 23,
    ])
    expect([...HUNT_RUDE_FOUR].sort()).toEqual([...DAVES_RUDE].sort())
    expect(HUNT_RUDE_FOUR.size).toBe(18)
    expect(HUNT_FOUR_TARGETS.has('hump')).toBe(false)
    expect(HUNT_RUDE_FOUR.has('hump')).toBe(false)
  })

  it('HUNT_FOUR_UNDEALT is Dave’s 25 (Q21): four-letter words with no clip, on no other list', () => {
    expect([...HUNT_FOUR_UNDEALT].sort()).toEqual([...DAVES_UNDEALT_25].sort())
    expect(HUNT_FOUR_UNDEALT.size).toBe(25)
    for (const w of HUNT_FOUR_UNDEALT) {
      expect(w).toHaveLength(4)
      expect(HUNT_FOUR_TARGETS.has(w)).toBe(false)
      expect(HUNT_RUDE_FOUR.has(w)).toBe(false)
    }
  })

  it('the 25 pictured targets are Dave’s starred 25, each bundled', () => {
    expect([...HUNT_FOUR_PICTURE_WORDS].sort()).toEqual(davesPictured.sort())
    expect(HUNT_FOUR_PICTURE_WORDS).toHaveLength(25)
    for (const w of HUNT_FOUR_PICTURE_WORDS) {
      expect(HUNT_FOUR_TARGETS.has(w)).toBe(true)
      expect(critterHasPicture(w)).toBe(true)
    }
    for (const w of HUNT_FOUR_TARGETS) {
      expect(critterHasPicture(w)).toBe(HUNT_FOUR_PICTURE_WORDS.includes(w))
    }
  })
})

describe('F1: four-letter rounds', () => {
  it.each(['a', 'o', 'i', 'u', 'e'])(
    'every round huntRounds(%s, { length: 4 }) returns keeps Dave 23 (B)’s rules and the Q21 rule',
    (vowel) => {
      const rounds = huntRounds(vowel, FOUR)
      expect(rounds.length).toBeGreaterThan(0)
      for (const r of rounds) expectFourRound(r, vowel)
      // Consonant sets in lexicographic order, each once.
      const keys = rounds.map((r) => r.letters.join(''))
      expect(keys).toEqual([...keys].sort())
      expect(new Set(keys).size).toBe(keys.length)
    },
  )

  it.each(['a', 'o', 'i', 'u', 'e'])(
    'over 1,000 seeds, vowel %s: a four-letter round, never last’s letters, the same seed the same round',
    (vowel) => {
      const last = huntRounds(vowel, FOUR)[0]!.letters
      for (let seed = 0; seed < 1000; seed++) {
        const r = huntDeal([vowel], seeded(seed), { last, length: 4 })
        expectFourRound(r, vowel)
        expect(r.letters).not.toEqual(last)
        expect(huntDeal([vowel], seeded(seed), { last, length: 4 })).toEqual(r)
      }
    },
  )

  it('picks one of her vowels; no vowels deals short a', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 200; seed++) {
      seen.add(huntDeal(['a', 'o'], seeded(seed), FOUR).letters[0]!)
    }
    expect([...seen].sort()).toEqual(['a', 'o'])
    expect(huntDeal([], seeded(1), FOUR).letters[0]).toBe('a')
  })

  it('the rejections: a rude word, an undealt word (Q21), two decoys', () => {
    // Dave's short-a fallback deals; with r for p it spells crab.
    expect(huntRoundOf([...'abcdlmp'], FOUR)).not.toBeNull()
    expect(huntRoundOf([...'abcdlmr'], FOUR)).toBeNull()
    // o: slot and lost spell with s, l, t (Kyle's extra o round).
    const withSlot = huntRounds('o', FOUR).filter(
      (r) => spellsFour(['slot', 'lost'], r.letters).length > 0,
    )
    expect(withSlot).toEqual([])
    // e: send (Kyle's 15 extra e rounds).
    expect(
      huntRounds('e', FOUR).filter((r) => buildable('send', r.letters)),
    ).toEqual([])
    for (const v of 'aoiue') {
      for (const r of huntRounds(v, FOUR)) {
        expect(spellsFour(HUNT_RUDE_FOUR, r.letters)).toEqual([])
      }
    }
  })

  it('the probe guard is a three-letter rule: it changes no four-letter round', () => {
    for (const v of 'aoiue') {
      expect(huntRounds(v, { length: 4, probeGuard: true })).toEqual(
        huntRounds(v, FOUR),
      )
    }
  })

  it('three-letter rounds are unchanged by the length option’s default', () => {
    for (const v of 'aoiue') {
      expect(huntRounds(v, { length: 3 })).toEqual(huntRounds(v))
      for (const r of huntRounds(v)) expectDaveRound(r, v)
    }
  })
})

describe('F3: the pinned fallbacks and the counts', () => {
  const PINNED: Record<string, [string, string[]]> = {
    a: ['abcdlmp', ['camp', 'clap', 'damp', 'lamp']],
    o: ['obcdnpr', ['crop', 'drop', 'pond', 'prop']],
    i: ['icfglpt', ['clip', 'flip', 'gift', 'lift']],
    u: ['ubcdglp', ['bulb', 'club', 'gulp', 'plug']],
    e: ['ebcdlst', ['belt', 'best', 'sled', 'test']],
  }

  it.each(Object.entries(PINNED))(
    'with the 16 pictures bundled, vowel %s’s fallback is a round by F1 with § 1’s targets',
    (vowel, [letters, targets]) => {
      expect(HUNT_FOUR_FALLBACK[vowel]).toEqual([...letters])
      const r = huntRoundOf([...letters], FOUR)!
      expect(r).not.toBeNull()
      expectFourRound(r, vowel)
      expect(r.targets).toEqual(targets)
      expect(huntRounds(vowel, FOUR)).toContainEqual(r)
    },
  )

  it('the rounds per vowel are Dave’s (a 56, o 51, i 2, u 125, e 86: Q21, with HUNT_FOUR_UNDEALT), with his N splits', () => {
    const count = (v: string) => huntRounds(v, FOUR).length
    // The code's counts; Dave's are the same: a 56, o 51, i 2, u 125, e 86.
    expect(Object.fromEntries([...'aoiue'].map((v) => [v, count(v)]))).toEqual({
      a: 56,
      o: 51,
      i: 2,
      u: 125,
      e: 86,
    })
    const splits = (v: string) => {
      const out: Record<number, number> = {}
      for (const r of huntRounds(v, FOUR))
        out[r.targets.length] = (out[r.targets.length] ?? 0) + 1
      return out
    }
    expect(splits('a')).toEqual({ 4: 42, 5: 11, 6: 3 })
    expect(splits('o')).toEqual({ 4: 34, 5: 13, 6: 4 })
    expect(splits('i')).toEqual({ 4: 2 })
    expect(splits('u')).toEqual({ 4: 57, 5: 22, 6: 46 })
    expect(splits('e')).toEqual({ 4: 25, 5: 24, 6: 37 })
  })

  it('every one of the 82 targets is dealt by some round', () => {
    const dealt = new Set(
      [...'aoiue'].flatMap((v) =>
        huntRounds(v, FOUR).flatMap((r) => r.targets),
      ),
    )
    expect([...dealt].sort()).toEqual([...HUNT_FOUR_TARGETS].sort())
  })
})

const fourRoundOf = (n: number): HuntRound => {
  const r = [...'aoiue']
    .flatMap((v) => huntRounds(v, FOUR))
    .find((x) => x.targets.length === n)
  if (r === undefined) throw new Error(`no four-letter round with ${n} targets`)
  return r
}

describe('F4: huntComplete in a four-letter round', () => {
  it.each([4, 5, 6])(
    'N %i: false at N − 2, true at N − 1 and stays true at N',
    (n) => {
      const r = fourRoundOf(n)
      const found = (k: number) => r.targets.slice(0, k)
      expect(huntComplete(r, found(n - 2))).toBe(false)
      expect(huntComplete(r, found(n - 1))).toBe(true)
      expect(huntComplete(r, found(n))).toBe(true)
      let rec = freshHuntRecord(r)
      for (const w of r.targets.slice(0, n - 2)) rec = huntFind(rec, w)
      expect(rec.complete).toBe(false)
      rec = huntFind(rec, r.targets[n - 2]!)
      expect(rec.complete).toBe(true)
      expect(huntFind(rec, r.targets[n - 1]!).complete).toBe(true)
    },
  )
})

describe('F5: huntBoardOrder in a four-letter round', () => {
  it.each([
    ['odnprst', ['drop', 'pond', 'stop', 'prop', 'spot', 'trot']],
    ['aclmnps', ['clap', 'lamp', 'camp', 'plan', 'slap', 'snap']],
  ])('%s gives § 1’s board order', (letters, order) => {
    const r = huntRoundOf([...letters], FOUR)!
    expect(r).not.toBeNull()
    expect(huntBoardOrder(r)).toEqual(order)
    expect(huntHintTarget(r, [])).toBe(order[0])
  })

  it('every round: the pictured targets a-z, then the rest a-z', () => {
    for (const v of 'aoiue') {
      for (const r of huntRounds(v, FOUR)) {
        const pictured = r.targets.filter(critterHasPicture).sort()
        const rest = r.targets.filter((w) => !critterHasPicture(w)).sort()
        expect(huntBoardOrder(r)).toEqual([...pictured, ...rest])
      }
    }
  })
})

describe('F6: the open lengths and the four-letter record', () => {
  /** A short-a three-letter round, found up to all but its last target. */
  const threeRound = () => huntRoundOf(HUNT_FALLBACK.a!)!

  function twoLearners() {
    const store = new MapStore()
    setKeyValueStore(store)
    ensureLearnerList()
    const a = activeLearner()!
    const b = addLearner({
      name: 'Sam',
      avatarId: 'owl',
      start: { math: 1, wordSong: 1 },
    })
    activateLearner(a.id)
    return { store, a, b }
  }

  it('[3] until her first three-letter round completes, then [3, 4], written with the completing find; kept across restarts and New letters; learner B stays [3]', () => {
    const { store, a, b } = twoLearners()
    expect(huntOpenLengths()).toEqual([3])
    const round = threeRound()
    const n = round.targets.length
    let rec = freshHuntRecord(round)
    saveHuntRecord(rec, 3, { unlock: true })
    for (const w of round.targets.slice(0, n - 2)) {
      rec = huntFind(rec, w)
      saveHuntRecord(rec, 3, { unlock: true })
      expect(huntOpenLengths()).toEqual([3])
    }
    // The completing find: one write holds the find and the open.
    const writes = vi.spyOn(store, 'setItem')
    rec = huntFind(rec, round.targets[n - 2]!)
    expect(rec.complete).toBe(true)
    saveHuntRecord(rec, 3, { unlock: true })
    expect(writes).toHaveBeenCalledTimes(1)
    expect(huntOpenLengths()).toEqual([3, 4])
    expect(loadHuntRecord(3)).toEqual(rec)

    // Kept across a restart: a fresh read of the same store.
    resetLearnersForTests()
    setKeyValueStore(store)
    ensureLearnerList()
    activateLearner(a.id)
    expect(huntOpenLengths()).toEqual([3, 4])
    // Never reverts: New letters, a four-letter round, an unlock-less write.
    saveHuntRecord(freshHuntRecord(threeRound()), 3, { unlock: true })
    saveHuntRecord(
      freshHuntRecord(huntRoundOf(HUNT_FOUR_FALLBACK.a!, FOUR)!),
      4,
    )
    saveHuntRecord(freshHuntRecord(threeRound()), 3)
    expect(huntOpenLengths()).toEqual([3, 4])

    activateLearner(b.id)
    expect(huntOpenLengths()).toEqual([3])
    activateLearner(a.id)
    expect(huntOpenLengths()).toEqual([3, 4])
  })

  it('the gate: a complete round written without unlock (today’s three-letter screen) opens nothing', () => {
    twoLearners()
    const round = threeRound()
    const rec = round.targets.reduce(huntFind, freshHuntRecord(round))
    expect(rec.complete).toBe(true)
    saveHuntRecord(rec)
    saveHuntRecord(rec, 3)
    expect(huntOpenLengths()).toEqual([3])
  })

  it('no migration: a stored complete three-letter round (build 23/24) reads [3]; "4" opens on her NEXT completing find', () => {
    const { store, a } = twoLearners()
    const round = threeRound()
    const done = round.targets.reduce(huntFind, freshHuntRecord(round))
    store.setItem(learnerKey(HUNT_STORAGE_KEY, a), JSON.stringify({ 3: done }))
    expect(loadHuntRecord(3)).toEqual(done)
    expect(huntOpenLengths()).toEqual([3])
    // New letters: a fresh round, then its completing find.
    const next = huntRoundOf(HUNT_FALLBACK.o!)!
    let rec = freshHuntRecord(next)
    saveHuntRecord(rec, 3, { unlock: true })
    expect(huntOpenLengths()).toEqual([3])
    for (const w of next.targets.slice(0, next.targets.length - 1)) {
      rec = huntFind(rec, w)
      saveHuntRecord(rec, 3, { unlock: true })
    }
    expect(rec.complete).toBe(true)
    expect(huntOpenLengths()).toEqual([3, 4])
  })

  it('a complete four-letter round opens nothing more', () => {
    twoLearners()
    const four = huntRoundOf(HUNT_FOUR_FALLBACK.a!, FOUR)!
    const done = four.targets.reduce(huntFind, freshHuntRecord(four))
    saveHuntRecord(done, 4, { unlock: true })
    expect(huntOpenLengths()).toEqual([3])
  })

  it('a four-letter HuntRecord (7 letters) round-trips under "4" and leaves "3" untouched', () => {
    const { store, a } = twoLearners()
    const three = huntFind(freshHuntRecord(threeRound()), 'bag')
    saveHuntRecord(three, 3)
    const four = huntFind(
      freshHuntRecord(huntRoundOf(HUNT_FOUR_FALLBACK.a!, FOUR)!),
      'lamp',
    )
    expect(four.letters).toHaveLength(7)
    saveHuntRecord(four, 4)
    expect(loadHuntRecord(4)).toEqual(four)
    expect(loadHuntRecord(3)).toEqual(three)
    expect(loadHuntRecord()).toEqual(three)
    const raw = JSON.parse(store.getItem(learnerKey(HUNT_STORAGE_KEY, a))!)
    expect(raw[3]).toEqual(three)
    expect(raw[4]).toEqual(four)
  })

  it('each length’s guard: a 6-letter record under "4" and a 7-letter one under "3" read as none', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    const three = freshHuntRecord(threeRound())
    const four = freshHuntRecord(huntRoundOf(HUNT_FOUR_FALLBACK.u!, FOUR)!)
    store.setItem(HUNT_STORAGE_KEY, JSON.stringify({ 3: four, 4: three }))
    expect(loadHuntRecord(3)).toBeNull()
    expect(loadHuntRecord(4)).toBeNull()
  })

  it('an unreadable or malformed open field reads [3]', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    store.setItem(HUNT_STORAGE_KEY, '{not json')
    expect(huntOpenLengths()).toEqual([3])
    store.setItem(HUNT_STORAGE_KEY, JSON.stringify({ open: 'yes' }))
    expect(huntOpenLengths()).toEqual([3])
    store.setItem(HUNT_STORAGE_KEY, JSON.stringify({ open: [3, 4] }))
    expect(huntOpenLengths()).toEqual([3, 4])
    setKeyValueStore(null)
    expect(huntOpenLengths()).toEqual([3])
  })
})

describe('F7: the nine said later, in three-letter rounds', () => {
  it('act add end ill its odd off are on HUNT_FAMILIAR; ant and elf are said words with a picture; none of the 9 is on CRITTER_NOT_SAID', () => {
    for (const w of F7_FAMILIAR) expect(HUNT_FAMILIAR.has(w)).toBe(true)
    for (const w of ['ant', 'elf']) {
      expect(HUNT_FAMILIAR.has(w)).toBe(false)
      expect(CRITTER_SAID_PICTURE_WORDS).toContain(w)
    }
    for (const w of CRITTER_SAID_LATER) {
      expect(CRITTER_NOT_SAID.has(w)).toBe(false)
      expect(CRITTER_SAID_WORDS).toContain(w)
    }
  })

  it('they deal now: a round with d and short a can spell add (sad deals)', () => {
    const withAdd = huntRounds('a').filter((r) => r.targets.includes('add'))
    expect(withAdd.length).toBeGreaterThan(0)
    expect(huntRounds('a').some((r) => r.targets.includes('sad'))).toBe(true)
  })
})
