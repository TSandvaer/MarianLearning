/**
 * Letter critters' word hunt, the core (`design/native/critters-word-hunt.md`
 * § 1, ACs H1-H6; the rules are Dave's ruling of 2026-10-25,
 * `design/research/critters-word-hunt-2026-10-25.md`).
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
  HUNT_STORAGE_KEY,
  huntComplete,
  huntDeal,
  huntFind,
  huntHintTarget,
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
  CRITTER_SAID_PICTURE_WORDS,
  CRITTER_SAID_WORDS,
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

/** The four new pictures (critters-word-hunt.md § 7) are bundled. */
const NEW_PICTURES = ['mug', 'sad', 'mud', 'hug'].every((w) =>
  CRITTER_SAID_PICTURE_WORDS.includes(w),
)

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

  it('with the probe guard, no probe-reserve word is spellable (11 short-a rounds)', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const r = huntDeal(['a'], seeded(seed), { probeGuard: true })
      expectDaveRound(r, 'a')
      const words = spells(r.letters)
      expect(words.filter((w) => PROBE_RESERVE_WORDS.includes(w))).toEqual([])
    }
    expect(huntRounds('a', { probeGuard: true })).toHaveLength(11)
  })

  it('Dave (1)’s counts: 184 rounds in all once the four new pictures land (a 45, e 21, i 30, o 27, u 61)', () => {
    expect(
      Object.fromEntries(
        [...'aeiou'].map((v) => [v, huntRounds(v).length] as const),
      ),
    ).toEqual({ a: 45, e: 21, i: 30, o: 27, u: NEW_PICTURES ? 61 : 57 })
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

  it('rejects a round that spells a quiet word: Kyle’s sample rounds spell ant and act', () => {
    expect(huntRoundOf(['a', 'c', 'f', 'm', 'n', 't'])).toBeNull()
    expect(huntRoundOf(['a', 'b', 'c', 'm', 'p', 't'])).toBeNull()
    expect(CRITTER_NOT_SAID.has('ant')).toBe(true)
    expect(CRITTER_NOT_SAID.has('act')).toBe(true)
  })
})

describe('H3: which words count', () => {
  it('HUNT_FAMILIAR is Dave’s 68, each a word Emma says', () => {
    expect([...HUNT_FAMILIAR].sort()).toEqual([...DAVES_68].sort())
    expect(HUNT_FAMILIAR.size).toBe(68)
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

describe('H5: huntHintTarget', () => {
  it('picture words a-z first, then the other targets a-z; undefined when every target is found', () => {
    const r = huntRoundOf(['a', 'b', 'g', 'h', 'p', 't'])!
    expect(r.targets).toEqual(['bag', 'bat', 'hat', 'pat', 'tag', 'tap'])
    expect(huntHintTarget(r, [])).toBe('bag')
    expect(huntHintTarget(r, ['bag', 'bat'])).toBe('hat')
    // tap is a said word with a picture, not a picture word: after tag.
    expect(huntHintTarget(r, ['bag', 'bat', 'hat'])).toBe('tag')
    expect(huntHintTarget(r, ['bag', 'bat', 'hat', 'tag'])).toBe('pat')
    expect(huntHintTarget(r, ['bag', 'bat', 'hat', 'tag', 'pat'])).toBe('tap')
    expect(huntHintTarget(r, r.targets)).toBeUndefined()
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
