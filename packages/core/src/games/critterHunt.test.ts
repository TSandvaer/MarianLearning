/**
 * Letter critters' word hunt, the core (`design/native/critters-word-hunt.md`
 * § 1, ACs H1-H6; the rules are Dave's ruling of 2026-10-25,
 * `design/research/critters-word-hunt-2026-10-25.md`), and its four-letter
 * rounds (`design/native/critters-four-letter.md` § 1, ACs F1-F7; Dave's
 * ruling of 2026-10-26, (B), `design/research/critters-four-letter-2026-10-26.md`).
 * Since the pictured-only boards (Dave's ruling of 2026-10-27, (A),
 * `design/research/critters-pictured-boards-2026-10-27.md`, "Dave 27"):
 * `critters-word-hunt.md` § 16 (B1-B7) and `critters-four-letter.md` § 15
 * (F23-F27), which amend or supersede H2-H4, P1 and F1-F5 as marked.
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

/**
 * Checks a round against every rule of B1 (Dave 27 (A), amending Dave
 * (1)): the targets exactly the spellable words with a picture, 4-8; the
 * extras exactly the other spellable said words, at most 3; at most one
 * consonant in no target; no quiet word spellable.
 */
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
  const words = spells(r.letters)
  expect(r.targets).toEqual(words.filter(critterHasPicture).sort())
  expect(r.extras).toEqual(
    words
      .filter((w) => CRITTER_SAID_WORDS.includes(w) && !critterHasPicture(w))
      .sort(),
  )
  expect(r.targets.length).toBeGreaterThanOrEqual(4)
  expect(r.targets.length).toBeLessThanOrEqual(8)
  expect(r.extras.length).toBeLessThanOrEqual(3)
  expect(
    cs.filter((c) => !r.targets.some((w) => w.includes(c))).length,
  ).toBeLessThanOrEqual(1)
  expect(words.filter((w) => CRITTER_NOT_SAID.has(w))).toEqual([])
}

/** A vowel's rounds by target count (N), as Dave prints his splits. */
const splitsOf = (rounds: readonly HuntRound[]) => {
  const out: Record<number, number> = {}
  for (const r of rounds)
    out[r.targets.length] = (out[r.targets.length] ?? 0) + 1
  return out
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

describe('B1 (amends H2): huntDeal', () => {
  it.each(['a', 'e', 'i', 'o', 'u'])(
    'over 1,000 seeds, vowel %s: a B1 round, never last’s letters, the same seed the same round',
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

  it('with the probe guard, no probe-reserve word is spellable (B2: 33 short-a rounds; 95 under the old rule)', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const r = huntDeal(['a'], seeded(seed), { probeGuard: true })
      expectDaveRound(r, 'a')
      const words = spells(r.letters)
      expect(words.filter((w) => PROBE_RESERVE_WORDS.includes(w))).toEqual([])
    }
    expect(huntRounds('a', { probeGuard: true })).toHaveLength(33)
  })

  it('picks one of her vowels; no vowels deals short a', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 200; seed++) {
      seen.add(huntDeal(['a', 'o'], seeded(seed)).letters[0]!)
    }
    expect([...seen].sort()).toEqual(['a', 'o'])
    expect(huntDeal([], seeded(1)).letters[0]).toBe('a')
  })

  it('rejects a round that spells a quiet word: bar and art in a b g h r t', () => {
    expect(
      spells([...'abghrt'])
        .filter((w) => CRITTER_NOT_SAID.has(w))
        .sort(),
    ).toEqual(['art', 'bar'])
    expect(huntRoundOf([...'abghrt'])).toBeNull()
  })

  it('B1: a familiar word with no picture is an extra; a round with 4 extras is not dealt (Dave 27 (A): a b g h p t, the old seed)', () => {
    // F7's sample round a c f m n t: act and fat leave the board for the
    // extras, beside nan and tan: 4, so it no longer deals.
    expect(
      spells([...'acfmnt'])
        .filter((w) => CRITTER_SAID_WORDS.includes(w) && !critterHasPicture(w))
        .sort(),
    ).toEqual(['act', 'fat', 'nan', 'tan'])
    expect(huntRoundOf([...'acfmnt'])).toBeNull()
    // Dave 27 (A): "4 extras: gag gap pat tab".
    expect(
      spells([...'abghpt'])
        .filter((w) => CRITTER_SAID_WORDS.includes(w) && !critterHasPicture(w))
        .sort(),
    ).toEqual(['gag', 'gap', 'pat', 'tab'])
    expect(huntRoundOf([...'abghpt'])).toBeNull()
  })

  it('B1: at most one decoy consonant (was 0)', () => {
    // e b d g n p: bed egg pen peg; d and n are in targets, so no decoy.
    // § 16.2's i b g p s x: bib pig sip six; every consonant in one.
    const withDecoy = [...'aeiou']
      .flatMap((v) => huntRounds(v))
      .filter((r) =>
        r.letters.slice(1).some((c) => !r.targets.some((w) => w.includes(c))),
      )
    expect(withDecoy.length).toBeGreaterThan(0)
    for (const r of withDecoy) {
      expect(
        r.letters.slice(1).filter((c) => !r.targets.some((w) => w.includes(c))),
      ).toHaveLength(1)
    }
  })
})

/**
 * Dave 27 (A), "Three-letter targets that are ever dealt", with fog and dig
 * pictured (Dave 27 (E); #719): o adds fog, and i adds dig and lid (computed).
 */
const DAVES_THREE_DEALT: Record<string, string> = {
  a: 'ant bag bat cab can cap cat dad fan ham hat jam man map mat nap pad pan sad tag tap van',
  o: 'box cot dog dot fog fox hot log mom mop pop pot rod top',
  u: 'bug bun bus cup gum jug mud mug mum nut rug run sun tub tug',
  i: 'bib dig fig lid pig sip six wig',
  e: 'bed egg elf hen jet leg net peg pen red ten web',
}

describe('B2: the three-letter counts (Dave 27 (A), with fog and dig by (E))', () => {
  it('the rounds per vowel: a 182, o 92, u 127, i 8, e 82, with Dave’s N splits', () => {
    expect(
      Object.fromEntries(
        [...'aouie'].map((v) => [v, huntRounds(v).length] as const),
      ),
    ).toEqual({ a: 182, o: 92, u: 127, i: 8, e: 82 })
    expect(splitsOf(huntRounds('a'))).toEqual({
      4: 96,
      5: 49,
      6: 27,
      7: 9,
      8: 1,
    })
    expect(splitsOf(huntRounds('o'))).toEqual({ 4: 58, 5: 12, 6: 21, 7: 1 })
    expect(splitsOf(huntRounds('u'))).toEqual({
      4: 53,
      5: 60,
      6: 11,
      7: 2,
      8: 1,
    })
    expect(splitsOf(huntRounds('i'))).toEqual({ 4: 8 })
    expect(splitsOf(huntRounds('e'))).toEqual({ 4: 70, 5: 10, 6: 2 })
  })

  it('the targets ever dealt are Dave’s, per vowel; 460 of the 491 rounds have an extra', () => {
    for (const v of 'aouie') {
      const dealt = new Set(huntRounds(v).flatMap((r) => r.targets))
      expect([...dealt].sort()).toEqual(DAVES_THREE_DEALT[v]!.split(' '))
    }
    const all = [...'aouie'].flatMap((v) => huntRounds(v))
    expect(all).toHaveLength(491)
    expect(all.filter((r) => r.extras.length > 0)).toHaveLength(460)
  })
})

describe('B3: the pinned three-letter fallbacks (Dave 27 (A))', () => {
  const PINNED: Record<string, [string, string[]]> = {
    a: ['abfght', ['bag', 'bat', 'hat', 'tag']],
    o: ['obfmpx', ['box', 'fox', 'mom', 'mop', 'pop']],
    u: ['ubcgjm', ['bug', 'gum', 'jug', 'mug', 'mum']],
    i: ['ibfgpw', ['bib', 'fig', 'pig', 'wig']],
    e: ['ebdfgl', ['bed', 'egg', 'elf', 'leg']],
  }

  it.each(Object.entries(PINNED))(
    'vowel %s: a B1 round with Dave’s targets, among its vowel’s rounds',
    (vowel, [letters, targets]) => {
      expect(HUNT_FALLBACK[vowel]).toEqual([...letters])
      const r = huntRoundOf([...letters])!
      expect(r).not.toBeNull()
      expectDaveRound(r, vowel)
      expect(r.targets).toEqual(targets)
      expect(huntRounds(vowel)).toContainEqual(r)
    },
  )

  it('the short-a one passes the probe guard', () => {
    expect(huntRoundOf(HUNT_FALLBACK.a!, { probeGuard: true })).toEqual(
      huntRoundOf(HUNT_FALLBACK.a!),
    )
    expect(Object.keys(HUNT_FALLBACK).sort()).toEqual([...'aeiou'])
  })
})

describe('B6: the deal skips a vowel with no round', () => {
  it('a vowel whose only round is last’s letters is skipped; the fallback deals only when every vowel has none', () => {
    // Four letters: short i deals 0 rounds (F26's case).
    expect(huntRounds('i', FOUR)).toEqual([])
    for (let seed = 0; seed < 200; seed++) {
      expect(huntDeal(['a', 'i'], seeded(seed), FOUR).letters[0]).toBe('a')
    }
    // Every vowel she has deals 0: the fallback, a's (no i entry).
    expect(huntDeal(['i'], seeded(1), FOUR)).toEqual(
      huntRoundOf(HUNT_FOUR_FALLBACK.a!, FOUR),
    )
    // A vowel with exactly one round other than last's: excluding every
    // short-i three-letter round but one leaves i one round.
    const iRounds = huntRounds('i')
    expect(iRounds.length).toBeGreaterThan(1)
    for (let seed = 0; seed < 200; seed++) {
      const r = huntDeal(['i'], seeded(seed), { last: iRounds[0]!.letters })
      expect(r.letters).not.toEqual(iRounds[0]!.letters)
      expect(iRounds).toContainEqual(r)
    }
  })
})

describe('H3 (superseded by B1): which words count', () => {
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

  it('B1, in every round: targets are the spellable picture and pictured-said words; extras the other said words, familiar ones among them; never-say words neither', () => {
    for (const v of 'aeiou') {
      for (const r of huntRounds(v)) {
        const words = spells(r.letters)
        expect(r.targets).toEqual(
          words
            .filter(
              (w) =>
                CRITTER_PICTURE_WORDS.includes(w) ||
                CRITTER_SAID_PICTURE_WORDS.includes(w),
            )
            .sort(),
        )
        for (const w of words.filter(
          (x) => HUNT_FAMILIAR.has(x) && !critterHasPicture(x),
        )) {
          expect(r.extras).toContain(w)
        }
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

describe('B4 (extends H4): huntComplete', () => {
  it.each([4, 5, 6, 7, 8])(
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

describe('P1, B5: huntBoardOrder and huntHintTarget (§ 15.2, § 16.2)', () => {
  // § 16.2's board orders: picture words a-z, then the said words with a
  // picture a-z (no third band is ever dealt).
  const TABLE: [string, string[]][] = [
    ['obgmpx', ['box', 'mop', 'mom', 'pop']],
    ['ubcgnr', ['bug', 'rug', 'bun', 'run']],
    ['ebdgnp', ['bed', 'pen', 'egg', 'peg']],
    ['ibgpsx', ['bib', 'pig', 'sip', 'six']],
  ]

  it.each(TABLE)('%s gives § 16.2’s board order', (letters, order) => {
    const r = huntRoundOf([...letters])!
    expect(r).not.toBeNull()
    expect(huntBoardOrder(r)).toEqual(order)
  })

  it('B5: every word of every dealt board has a picture, at both lengths', () => {
    for (const v of 'aeiou') {
      for (const r of [...huntRounds(v), ...huntRounds(v, FOUR)]) {
        expect(huntBoardOrder(r).filter((w) => !critterHasPicture(w))).toEqual(
          [],
        )
      }
    }
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

  it('the seed’s round (§ 16.4): bag bat hat tag; with bag and hat found the hint is bat (B11)', () => {
    const r = huntRoundOf(['a', 'b', 'f', 'g', 'h', 't'])!
    expect(huntHintTarget(r, [])).toBe('bag')
    expect(huntHintTarget(r, ['bag', 'hat'])).toBe('bat')
    expect(huntHintTarget(r, ['bag', 'hat', 'fat', 'gag'])).toBe('bat')
    expect(huntHintTarget(r, ['bag', 'bat', 'hat'])).toBe('tag')
  })

  it('the record keeps its shape: the order is derived, never stored', () => {
    const r = huntRoundOf(['a', 'b', 'f', 'g', 'h', 't'])!
    const rec = huntFind(huntFind(freshHuntRecord(r), 'tag'), 'bag')
    expect(Object.keys(rec).sort()).toEqual(
      ['complete', 'extras', 'found', 'letters', 'targets'].sort(),
    )
    expect(rec.found).toEqual(['tag', 'bag'])
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
    const round = huntRoundOf(['a', 'b', 'f', 'g', 'h', 't'])!
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
    const round = huntRoundOf(['a', 'b', 'f', 'g', 'h', 't'])!
    let rec = freshHuntRecord(round)
    rec = huntFind(rec, 'hat')
    rec = huntFind(rec, 'gag')
    expect(rec.found).toEqual(['hat', 'gag'])
    expect(huntFind(rec, 'hat')).toBe(rec)
    expect(huntFind(rec, 'cat')).toBe(rec)
    for (const w of ['bag', 'fat', 'tab']) rec = huntFind(rec, w)
    expect(rec.complete).toBe(false)
    rec = huntFind(rec, 'tag')
    expect(rec.complete).toBe(true)
    expect(huntFind(rec, 'bat').complete).toBe(true)
  })

  it('Q30: a round stored under the old rule (listen slots) reopens as stored, until New letters', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    // The old seed's round, as build 24 dealt and stored it.
    const old = {
      letters: [...'abghpt'],
      targets: ['bag', 'bat', 'hat', 'pat', 'tag', 'tap'],
      extras: ['gag', 'gap', 'tab'],
      found: ['bag', 'pat'],
      complete: false,
    }
    expect(huntRoundOf(old.letters)).toBeNull()
    store.setItem(HUNT_STORAGE_KEY, JSON.stringify({ 3: old }))
    expect(loadHuntRecord()).toEqual(old)
    expect(loadHuntRecord(3)).toEqual(old)
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
 * Dave 23 (B), the 18 rude four-letter words, as he prints them, and Dave
 * 27 (A)'s clit (F24). All 19 reject a round.
 */
const DAVES_RUDE =
  'cunt shit piss twat slut crap turd damn hell butt slag prat bums tits cums fags gits guns clit'.split(
    ' ',
  )
/** Dave's Q21 answer: the 25 words no round deals, since they have no clip. */
const DAVES_UNDEALT_25 =
  'crab trap grab slot lost slip snip spin twin grin swim crib list mist fist mint hint limp film snug stub mend send help held'.split(
    ' ',
  )
/** F24: crab has a clip since #714 and is a target, so 24 stay undealt. */
const UNDEALT_24 = DAVES_UNDEALT_25.filter((w) => w !== 'crab')
/** Dave 27 (A): the 14 voiceless plurals and crab (#714's clips). */
const PLURALS_AND_CRAB =
  'ants bats caps cats cots crab hats jets maps mats mops pots rats taps tops'.split(
    ' ',
  )

/** The four-letter words the long way: from `words`, the ones `letters` build. */
const spellsFour = (words: Iterable<string>, letters: readonly string[]) =>
  [...words].filter((w) => buildable(w, letters))

/**
 * Checks a round against every rule of F23 (Dave 27 (A), superseding F1):
 * the targets exactly the spellable `HUNT_FOUR_TARGETS` words with a
 * picture, 4-6; the extras exactly the other spellable ones, at most 3;
 * at most one decoy; no rude or undealt word spellable.
 */
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
  const words = spellsFour(HUNT_FOUR_TARGETS, r.letters)
  expect(r.targets).toEqual(words.filter(critterHasPicture).sort())
  expect(r.extras).toEqual(words.filter((w) => !critterHasPicture(w)).sort())
  expect(r.targets.length).toBeGreaterThanOrEqual(4)
  expect(r.targets.length).toBeLessThanOrEqual(6)
  expect(r.extras.length).toBeLessThanOrEqual(3)
  expect(
    cs.filter((c) => !r.targets.some((w) => w.includes(c))).length,
  ).toBeLessThanOrEqual(1)
  expect(spellsFour(DAVES_RUDE, r.letters)).toEqual([])
  expect(spellsFour(UNDEALT_24, r.letters)).toEqual([])
}

const FOUR = { length: 4 } as const

describe('F24 (supersedes F2): the four-letter lists (Dave 23 (B); Q21; Dave 27 (A))', () => {
  it('HUNT_FOUR_TARGETS is Dave’s 82 and the 14 plurals and crab (97); HUNT_RUDE_FOUR his printed 18 and clit (19); hump on neither', () => {
    expect([...HUNT_FOUR_TARGETS].sort()).toEqual(
      [...[...'aoiue'].flatMap(daves82), ...PLURALS_AND_CRAB].sort(),
    )
    expect(HUNT_FOUR_TARGETS.size).toBe(97)
    expect([...'aoiue'].map((v) => daves82(v).length)).toEqual([
      18, 15, 7, 19, 23,
    ])
    expect([...HUNT_RUDE_FOUR].sort()).toEqual([...DAVES_RUDE].sort())
    expect(HUNT_RUDE_FOUR.size).toBe(19)
    expect(HUNT_FOUR_TARGETS.has('hump')).toBe(false)
    expect(HUNT_RUDE_FOUR.has('hump')).toBe(false)
  })

  it('HUNT_FOUR_UNDEALT is Dave’s 25 without crab (24): four-letter words with no clip, on no other list', () => {
    expect([...HUNT_FOUR_UNDEALT].sort()).toEqual([...UNDEALT_24].sort())
    expect(HUNT_FOUR_UNDEALT.size).toBe(24)
    expect(HUNT_FOUR_UNDEALT.has('crab')).toBe(false)
    for (const w of HUNT_FOUR_UNDEALT) {
      expect(w).toHaveLength(4)
      expect(HUNT_FOUR_TARGETS.has(w)).toBe(false)
      expect(HUNT_RUDE_FOUR.has(w)).toBe(false)
    }
  })

  it('the 41 pictured targets are Dave’s starred 25, step, the 14 plurals and crab, each bundled', () => {
    expect([...HUNT_FOUR_PICTURE_WORDS].sort()).toEqual(
      [...davesPictured, 'step', ...PLURALS_AND_CRAB].sort(),
    )
    expect(HUNT_FOUR_PICTURE_WORDS).toHaveLength(41)
    for (const w of HUNT_FOUR_PICTURE_WORDS) {
      expect(HUNT_FOUR_TARGETS.has(w)).toBe(true)
      expect(critterHasPicture(w)).toBe(true)
    }
    for (const w of HUNT_FOUR_TARGETS) {
      expect(critterHasPicture(w)).toBe(HUNT_FOUR_PICTURE_WORDS.includes(w))
    }
  })
})

describe('F23 (supersedes F1): four-letter rounds', () => {
  it.each(['a', 'o', 'u', 'e'])(
    'every round huntRounds(%s, { length: 4 }) returns keeps F23',
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

  it.each(['a', 'o', 'u', 'e'])(
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

  it('the rejections: a rude word (clit, F24), an undealt word (Q21), two decoys', () => {
    // The old short-i fallback spells clit (Dave 27 (A)).
    expect(spellsFour(['clit'], [...'icfglpt'])).toEqual(['clit'])
    expect(huntRoundOf([...'icfglpt'], FOUR)).toBeNull()
    // Dave's short-a fallback deals; with r for n it spells trap.
    expect(huntRoundOf([...'abcdnst'], FOUR)).not.toBeNull()
    expect(spellsFour(['trap'], [...'abcprst'])).toEqual(['trap'])
    expect(huntRoundOf([...'abcprst'], FOUR)).toBeNull()
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

describe('F25 (supersedes F3): the pinned fallbacks and the counts', () => {
  const PINNED: Record<string, [string, string[], string[]]> = {
    a: ['abcdnst', ['ants', 'bats', 'cats', 'sand'], ['band']],
    o: ['obcmpst', ['cots', 'mops', 'pots', 'stop', 'tops'], ['cost', 'spot']],
    u: ['ubcjlmp', ['bulb', 'jump', 'plum', 'pump'], ['bump', 'club', 'lump']],
    e: ['ecjnpst', ['jets', 'nest', 'step', 'tent'], ['sent', 'test']],
  }

  it.each(Object.entries(PINNED))(
    'vowel %s’s fallback is a round by F23 with § 15.2’s targets and extras',
    (vowel, [letters, targets, extras]) => {
      expect(HUNT_FOUR_FALLBACK[vowel]).toEqual([...letters])
      const r = huntRoundOf([...letters], FOUR)!
      expect(r).not.toBeNull()
      expectFourRound(r, vowel)
      expect(r.targets).toEqual(targets)
      expect(r.extras).toEqual(extras)
      expect(huntRounds(vowel, FOUR)).toContainEqual(r)
    },
  )

  it('no i entry (Q36): a missing entry falls back to a’s', () => {
    expect(Object.keys(HUNT_FOUR_FALLBACK).sort()).toEqual(['a', 'e', 'o', 'u'])
    expect(HUNT_FOUR_FALLBACK.i).toBeUndefined()
  })

  it('the rounds per vowel are Dave 27’s (a 110, o 29, u 38, i 0, e 19), with his N splits and extras per round', () => {
    const count = (v: string) => huntRounds(v, FOUR).length
    expect(Object.fromEntries([...'aoiue'].map((v) => [v, count(v)]))).toEqual({
      a: 110,
      o: 29,
      i: 0,
      u: 38,
      e: 19,
    })
    expect(splitsOf(huntRounds('a', FOUR))).toEqual({ 4: 81, 5: 26, 6: 3 })
    expect(splitsOf(huntRounds('o', FOUR))).toEqual({ 4: 15, 5: 14 })
    expect(splitsOf(huntRounds('u', FOUR))).toEqual({ 4: 36, 5: 2 })
    expect(splitsOf(huntRounds('e', FOUR))).toEqual({ 4: 18, 5: 1 })
    const extras = (v: string) => {
      const out: Record<number, number> = {}
      for (const r of huntRounds(v, FOUR))
        out[r.extras.length] = (out[r.extras.length] ?? 0) + 1
      return out
    }
    expect(extras('a')).toEqual({ 0: 53, 1: 41, 2: 9, 3: 7 })
    expect(extras('o')).toEqual({ 1: 8, 2: 11, 3: 10 })
    expect(extras('u')).toEqual({ 2: 24, 3: 14 })
    expect(extras('e')).toEqual({ 2: 16, 3: 3 })
  })

  it('the pictured targets ever dealt are Dave 27’s; flag frog gift belt ramp sled clip drip never are', () => {
    const dealt = (v: string) =>
      [...new Set(huntRounds(v, FOUR).flatMap((r) => r.targets))].sort()
    expect(dealt('a')).toEqual(
      'ants bats caps cats clap crab hand hats lamp maps mats rats sand taps'.split(
        ' ',
      ),
    )
    expect(dealt('o')).toEqual('cots drop mops pond pots stop tops'.split(' '))
    expect(dealt('u')).toEqual('bulb drum jump plug plum pump slug'.split(' '))
    expect(dealt('e')).toEqual('jets nest step tent vest'.split(' '))
    expect(dealt('i')).toEqual([])
    const all = new Set([...'aoiue'].flatMap(dealt))
    for (const w of 'flag frog gift belt ramp sled clip drip'.split(' '))
      expect(all.has(w)).toBe(false)
  })
})

describe('F26: short i deals no four-letter round', () => {
  it('a learner with i (and so a): every four-letter deal over 1,000 seeds is another vowel’s; three-letter deals still include short i', () => {
    const vowels = ['a', 'o', 'u', 'i']
    const threeSeen = new Set<string>()
    for (let seed = 0; seed < 1000; seed++) {
      const four = huntDeal(vowels, seeded(seed), FOUR)
      expect(four.letters[0]).not.toBe('i')
      expectFourRound(four, four.letters[0]!)
      threeSeen.add(huntDeal(vowels, seeded(seed)).letters[0]!)
    }
    expect(threeSeen.has('i')).toBe(true)
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

describe('F27 (amends F5): huntBoardOrder in a four-letter round', () => {
  it.each([
    ['abcdnst', ['ants', 'bats', 'cats', 'sand']],
    ['obcmpst', ['cots', 'mops', 'pots', 'stop', 'tops']],
  ])('%s gives § 15.5’s board order', (letters, order) => {
    const r = huntRoundOf([...letters], FOUR)!
    expect(r).not.toBeNull()
    expect(huntBoardOrder(r)).toEqual(order)
    expect(huntHintTarget(r, [])).toBe(order[0])
  })

  it('every round: every word has a picture, so the order is the targets a-z', () => {
    for (const v of 'aoiue') {
      for (const r of huntRounds(v, FOUR)) {
        expect(huntBoardOrder(r)).toEqual([...r.targets].sort())
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
      'ants',
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

  it('they deal: add (no picture) as an extra since B1, sad (pictured) as a target', () => {
    const withAdd = huntRounds('a').filter((r) => r.extras.includes('add'))
    expect(withAdd.length).toBeGreaterThan(0)
    expect(huntRounds('a').some((r) => r.targets.includes('add'))).toBe(false)
    expect(huntRounds('a').some((r) => r.targets.includes('sad'))).toBe(true)
  })
})
