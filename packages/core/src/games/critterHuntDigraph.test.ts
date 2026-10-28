/**
 * Letter critters' word hunt, phase 3: the digraph critters' core
 * (`design/native/critters-digraph.md` § 11.1, ACs D1-D13). The rules are
 * Dave's digraph ruling of 2026-10-27, parts (A)-(C),
 * `design/research/critters-digraph-2026-10-28.md`, cited as "Dave D (A)"
 * to "Dave D (C)". Every rule is checked twice: against Dave's printed
 * lists, counts and fallbacks, and against a long-way oracle over every
 * letter set a pair could deal.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { progressAtStep } from '../debug/stepProgress'
import { setKeyValueStore, type KeyValueStore } from '../platform/keyValueStore'
import type { SkillNode } from '../progress/types'
import {
  freshHuntRecord,
  HUNT_DIGRAPH_FALLBACK,
  HUNT_DIGRAPH_FOUR_FALLBACK,
  HUNT_DIGRAPH_FOUR_REJECTS,
  HUNT_FOUR_UNDEALT,
  HUNT_RUDE_FOUR,
  HUNT_STORAGE_KEY,
  huntBoardOrder,
  huntComplete,
  huntDeal,
  huntDigraphs,
  huntFind,
  huntRoundOf,
  huntRounds,
  huntUnits,
  huntVowels,
  loadHuntRecord,
  saveHuntRecord,
  type HuntLength,
  type HuntRound,
} from './critterHunt'
import {
  CRITTER_DIGRAPH_BLENDS,
  CRITTER_NOT_SAID,
  CRITTER_PICTURE_WORDS,
  CRITTER_PRAISE_WORDS,
  CRITTER_REAL_WORDS,
  CRITTER_SAID_WORDS,
  CRITTER_SOUND_SOURCE,
  critterHasPicture,
  critterPraise,
  critterRun,
  HUNT_DIGRAPH_LATER,
  HUNT_DIGRAPH_LESSON_WORDS,
  HUNT_DIGRAPH_PICTURE_WORDS,
  HUNT_DIGRAPH_QUIET,
  HUNT_DIGRAPHS,
  HUNT_FOUR_LESSON_WORDS,
  HUNT_FOUR_TARGETS,
  type HuntDigraph,
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

const words = (s: string) => s.split(' ')

// Dave D (C)'s lists, as printed.
const DAVE_TARGETS = words('ship fish shed shop chip moth ring wing sing')
const DAVE_TARGETS_FOUR = ['chest']
const DAVE_EXTRAS = words('shin shot wish')
const DAVE_QUIET = words(
  'that than this them then thus with bath path both push bush wash chef itch chew show thaw',
)
const DAVE_RUDE = words(
  'shit shat shag gash tush dong bong wang dung thug meth chav',
)
const DAVE_KNOWN = words(
  'bash cash dash mash rash dish shut rush hush chat chop chug much such rich inch chin thin math thud bang fang gang hang rang sang long song hung lung rung sung',
)
const DAVE_RUDE_FOUR = words('shits shags bitch')
const DAVE_KNOWN_FOUR = words(
  'bench shelf brush ships chips swing crash flash smash trash fresh crush lunch punch bunch munch pinch chimp sting bring stung swung',
)

const VOWELS = new Set('aeiou')
const SINGLES = [...'bcdfghjlmnprstvwx']
const CRITTER_LETTERS = [...'abcdefghijlmnoprstuvwx']
const DIGRAPHS: readonly HuntDigraph[] = ['sh', 'ch', 'th', 'ng']
const FOUR = { length: 4 } as const

/**
 * Every way the critters `letters` spell `word` with `n` critters, the long
 * way: any critter whose letters come next, the vowel at most once, a
 * consonant critter at most twice (its twin).
 */
function splits(word: string, letters: readonly string[], n: number) {
  const out: string[][] = []
  const walk = (at: number, picked: string[]) => {
    if (picked.length > n) return
    if (at === word.length) {
      const ok = picked.every(
        (u) => picked.filter((x) => x === u).length <= (VOWELS.has(u) ? 1 : 2),
      )
      if (ok && picked.length === n) out.push([...picked])
      return
    }
    for (const u of letters) {
      if (!word.startsWith(u, at)) continue
      picked.push(u)
      walk(at + u.length, picked)
      picked.pop()
    }
  }
  walk(0, [])
  return out
}

/** Every k of `pool`, in order. */
function choose(pool: readonly string[], k: number): string[][] {
  if (k === 0) return [[]]
  return pool.flatMap((x, i) =>
    choose(pool.slice(i + 1), k - 1).map((rest) => [x, ...rest]),
  )
}

const PLAIN_THREE = [...CRITTER_REAL_WORDS].filter((w) => w.length === 3)
const PLAIN_FOUR = [
  ...HUNT_FOUR_TARGETS,
  ...HUNT_RUDE_FOUR,
  ...HUNT_FOUR_UNDEALT,
]
const DAVE_REJECTS = new Set([...DAVE_QUIET, ...DAVE_RUDE, ...DAVE_KNOWN])
const DAVE_REJECTS_FOUR = new Set([...DAVE_RUDE_FOUR, ...DAVE_KNOWN_FOUR])

/**
 * Dave D (B)'s digraph round, the long way, or `null`: the vowel, the
 * digraph and the singles a-z; exactly one digraph critter; never both of
 * its letters as singles (`pairRule`); no reject spellable; the targets
 * pictured, 4-8 (three seats) or 4-6 (four); at most 3 extras; at most one
 * consonant critter in no target; at least one target uses the digraph.
 * Words count by critters: a word is spelled at `length` seats when the
 * critters make it with exactly `length` of them.
 */
function daveRound(
  vowel: string,
  digraph: HuntDigraph,
  singles: readonly string[],
  length: HuntLength,
  {
    pairRule = true,
    known = true,
  }: { pairRule?: boolean; known?: boolean } = {},
): HuntRound | null {
  if (pairRule && [...digraph].every((ch) => singles.includes(ch))) return null
  const letters = [vowel, digraph, ...singles]
  const chars = new Set(letters.join(''))
  const spelledAt = (w: string) =>
    [...w].every((ch) => chars.has(ch)) && splits(w, letters, length).length > 0
  let said: string[]
  if (length === 3) {
    const plain = PLAIN_THREE.filter(spelledAt)
    const digraphWords = [...DAVE_TARGETS, ...DAVE_EXTRAS].filter(spelledAt)
    if (plain.some((w) => CRITTER_NOT_SAID.has(w))) return null
    const rejects = known
      ? DAVE_REJECTS
      : new Set([...DAVE_QUIET, ...DAVE_RUDE])
    if ([...rejects].some(spelledAt)) return null
    said = [
      ...plain.filter(
        (w) => critterHasPicture(w) || CRITTER_SAID_WORDS.includes(w),
      ),
      ...digraphWords,
    ]
  } else {
    const plain = PLAIN_FOUR.filter(spelledAt)
    if (plain.some((w) => HUNT_RUDE_FOUR.has(w) || HUNT_FOUR_UNDEALT.has(w)))
      return null
    if ([...DAVE_REJECTS_FOUR].some(spelledAt)) return null
    said = [
      ...plain.filter((w) => HUNT_FOUR_TARGETS.has(w)),
      ...DAVE_TARGETS_FOUR.filter(spelledAt),
    ]
  }
  const pictured = (w: string) =>
    DAVE_TARGETS.includes(w) ||
    DAVE_TARGETS_FOUR.includes(w) ||
    critterHasPicture(w)
  const targets = said.filter(pictured).sort()
  const extras = said.filter((w) => !pictured(w)).sort()
  if (extras.length > 3) return null
  const max = length === 3 ? 8 : 6
  if (targets.length < 4 || targets.length > max) return null
  const critters = (w: string) => splits(w, letters, length)[0]!
  const decoys = letters
    .slice(1)
    .filter((u) => !targets.some((w) => critters(w).includes(u)))
  if (decoys.length > 1) return null
  if (!targets.some((w) => critters(w).includes(digraph))) return null
  return { letters, targets, extras }
}

/** Every round the oracle deals for a pair, singles in lexicographic order. */
const daveRounds = (
  vowel: string,
  digraph: HuntDigraph,
  length: HuntLength,
  opts?: { pairRule?: boolean; known?: boolean },
) =>
  choose(SINGLES, length === 3 ? 4 : 5)
    .map((cs) => daveRound(vowel, digraph, cs, length, opts))
    .filter((r): r is HuntRound => r !== null)

/** A pair's rounds by target count (N), as Dave prints his splits. */
const splitsOf = (rounds: readonly HuntRound[]) => {
  const out: Record<number, number> = {}
  for (const r of rounds)
    out[r.targets.length] = (out[r.targets.length] ?? 0) + 1
  return out
}

/** The consonant critters of a round that no target uses (by critters). */
const decoysOf = (r: HuntRound, length: HuntLength) =>
  r.letters
    .slice(1)
    .filter(
      (u) =>
        !r.targets.some((w) => splits(w, r.letters, length)[0]!.includes(u)),
    )

const THREE_PAIRS: readonly (readonly [HuntDigraph, string])[] = [
  ['sh', 'o'],
  ['sh', 'i'],
  ['sh', 'e'],
  ['ch', 'i'],
  ['th', 'o'],
  ['ng', 'i'],
]

const digraphOf = (r: HuntRound) =>
  r.letters.find((u) => (DIGRAPHS as readonly string[]).includes(u))

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  setKeyValueStore(null)
  vi.restoreAllMocks()
})

describe('D1: a digraph round’s letters are its critters', () => {
  it('HUNT_DIGRAPHS is sh ch th ng, in teaching order', () => {
    expect(HUNT_DIGRAPHS).toEqual(['sh', 'ch', 'th', 'ng'])
  })

  it('every digraph round: the vowel, the digraph (Q41: second), then the singles a-z; 6 entries at three seats, 7 at four', () => {
    for (const length of [3, 4] as const)
      for (const g of DIGRAPHS)
        for (const v of 'aeiou') {
          for (const r of huntRounds(v, { digraph: g, length })) {
            expect(r.letters).toHaveLength(length === 3 ? 6 : 7)
            expect(r.letters[0]).toBe(v)
            expect(r.letters[1]).toBe(g)
            const singles = r.letters.slice(2)
            expect(singles).toEqual([...singles].sort())
            expect(new Set(singles).size).toBe(singles.length)
            for (const c of singles) expect(SINGLES).toContain(c)
          }
        }
  })

  it('the record guard accepts a digraph round of each length and still checks 1 + consonants entries', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    const three = huntFind(
      freshHuntRecord(huntRoundOf(HUNT_DIGRAPH_FALLBACK.sh!.i!)!),
      'ship',
    )
    const four = huntFind(
      freshHuntRecord(huntRoundOf(HUNT_DIGRAPH_FOUR_FALLBACK.ch!.e!, FOUR)!),
      'chest',
    )
    expect(three.found).toEqual(['ship'])
    expect(four.found).toEqual(['chest'])
    saveHuntRecord(three, 3)
    saveHuntRecord(four, 4)
    expect(loadHuntRecord(3)).toEqual(three)
    expect(loadHuntRecord(4)).toEqual(four)
    store.setItem(
      HUNT_STORAGE_KEY,
      JSON.stringify({ 3: { ...three, letters: three.letters.slice(1) } }),
    )
    expect(loadHuntRecord(3)).toBeNull()
  })
})

describe('D2: huntUnits, a word’s critters in the round', () => {
  it('ship on i sh b c n p is sh i p; chest on e ch c j n s t is ch e s t; wish is w i sh', () => {
    expect(huntUnits('ship', [...'i', 'sh', ...'bcnp'])).toEqual([
      'sh',
      'i',
      'p',
    ])
    expect(huntUnits('chest', ['e', 'ch', ...'cjnst'])).toEqual([
      'ch',
      'e',
      's',
      't',
    ])
    const wish = huntRounds('i', { digraph: 'sh' }).find((r) =>
      r.extras.includes('wish'),
    )!
    expect(huntUnits('wish', wish.letters)).toEqual(['w', 'i', 'sh'])
    // A plain word on a plain round: one critter a letter.
    expect(huntUnits('bag', [...'abfght'])).toEqual(['b', 'a', 'g'])
  })

  it('a word the round’s critters do not make is null (sip on i sh b c n p: no single s)', () => {
    expect(huntUnits('sip', [...'i', 'sh', ...'bcnp'])).toBeNull()
    expect(huntUnits('ship', [...'abfght'])).toBeNull()
  })

  it('every word a dealt round spells has exactly one split, and huntUnits is it', () => {
    for (const length of [3, 4] as const)
      for (const g of DIGRAPHS)
        for (const v of 'aeiou')
          for (const r of huntRounds(v, { digraph: g, length }))
            for (const w of [...r.targets, ...r.extras]) {
              const all = splits(w, r.letters, length)
              expect([w, all.length]).toEqual([w, 1])
              expect(huntUnits(w, r.letters)).toEqual(all[0])
            }
  })
})

describe('D3: critterRun keys on critters, not characters', () => {
  it('Dave D (A) and (C)’s runs', () => {
    expect(critterRun(['sh', 'i', 'p'])).toBe('word')
    expect(critterRun(['ch', 'e', 's', 't'])).toBe('word')
    for (const run of [
      ['sh', 'i', 'n'],
      ['sh', 'o', 't'],
      ['w', 'i', 'sh'],
    ])
      expect(critterRun(run)).toBe('word')
    // Four singles: a run of four, never ship.
    expect(critterRun(['s', 'h', 'i', 'p'])).toBe('quiet')
    // Three singles that spell no word.
    expect(critterRun(['s', 'h', 'i'], { funny: true })).toBe('funny')
    // Voiced th sings and sits (Dave D (C)).
    expect(critterRun(['th', 'i', 's'])).toBe('quiet')
    expect(critterRun(['w', 'i', 'th'])).toBe('quiet')
    // A digraph run on no list: funny at three seats, quiet at four.
    expect(critterRun(['sh', 'o', 'x'])).toBe('funny')
    expect(critterRun(['sh', 'o', 'x'], { funny: false })).toBe('quiet')
    expect(critterRun(['ch', 'e', 's', 'p'])).toBe('quiet')
    // A string is one critter a letter, as before.
    expect(critterRun('ship')).toBe('quiet')
    expect(critterRun('bag')).toBe('picture')
  })

  it('every three-critter run with one digraph: word for Dave’s targets and extras, quiet for his rejects, else funny (quiet with funny off); never picture', () => {
    const wrong: string[] = []
    let n = 0
    for (const g of DIGRAPHS)
      for (let at = 0; at < 3; at++)
        for (const x of CRITTER_LETTERS)
          for (const y of CRITTER_LETTERS) {
            const run = [x, y]
            run.splice(at, 0, g)
            const w = run.join('')
            for (const funny of [true, false]) {
              const want = [...DAVE_TARGETS, ...DAVE_EXTRAS].includes(w)
                ? 'word'
                : DAVE_REJECTS.has(w) || !funny
                  ? 'quiet'
                  : 'funny'
              const kind = critterRun(run, { funny })
              if (kind !== want) wrong.push(`${run.join('-')}:${kind}`)
              n++
            }
          }
    expect(wrong).toEqual([])
    expect(n).toBe(2 * 4 * 3 * 22 * 22)
  })

  it('every four-critter run with one digraph: word for chest only, else quiet', () => {
    const wrong: string[] = []
    for (const g of DIGRAPHS)
      for (let at = 0; at < 4; at++)
        for (const x of CRITTER_LETTERS)
          for (const y of CRITTER_LETTERS)
            for (const z of CRITTER_LETTERS) {
              const run = [x, y, z]
              run.splice(at, 0, g)
              const want = run.join('') === 'chest' ? 'word' : 'quiet'
              const kind = critterRun(run)
              if (kind !== want) wrong.push(`${run.join('-')}:${kind}`)
            }
    expect(wrong).toEqual([])
  })
})

describe('D4, D5, D6, D10: the rounds are the long way’s, by critters', () => {
  it.each(DIGRAPHS.flatMap((g) => [...'aeiou'].map((v) => [g, v] as const)))(
    'three seats, %s-%s: huntRounds equals the oracle over every letter set',
    (g, v) => {
      expect(huntRounds(v, { digraph: g })).toEqual(daveRounds(v, g, 3))
    },
  )

  it.each(DIGRAPHS.flatMap((g) => [...'aeiou'].map((v) => [g, v] as const)))(
    'four seats, %s-%s: huntRounds equals the oracle over every letter set',
    (g, v) => {
      expect(huntRounds(v, { digraph: g, length: 4 })).toEqual(
        daveRounds(v, g, 4),
      )
    },
  )

  it('D4: a single consonant whose letter sits in a digraph target is still a decoy unless a target uses it as a single', () => {
    for (const round of huntRounds('i', { digraph: 'sh' })) {
      const decoys = decoysOf(round, 3)
      expect(decoys.length).toBeLessThanOrEqual(1)
    }
    // fish and ship hold the letter h, not the critter: the single h is
    // the decoy of i sh f g h p, and the single c of e ch c j n s t
    // (chest holds the critter ch). Counting characters would find none.
    const shi = huntRoundOf(['i', 'sh', ...'fghp'])!
    expect(shi.targets).toEqual(words('fig fish pig ship'))
    expect(decoysOf(shi, 3)).toEqual(['h'])
    const che = huntRoundOf(['e', 'ch', ...'cjnst'], FOUR)!
    expect(decoysOf(che, 4)).toEqual(['c'])
    for (const r of [shi, che])
      expect(
        r.letters.slice(2).filter((u) => !r.targets.some((w) => w.includes(u))),
      ).toEqual([])
  })

  it('D5: no round holds both letters of its own digraph as singles; one alone may be dealt', () => {
    expect(huntRoundOf(['i', 'sh', ...'bhnps'])).toBeNull()
    for (const length of [3, 4] as const)
      for (const g of DIGRAPHS)
        for (const v of 'aeiou')
          for (const r of huntRounds(v, { digraph: g, length }))
            expect([...g].every((ch) => r.letters.includes(ch))).toBe(false)
    const shi = huntRounds('i', { digraph: 'sh' })
    expect(shi.some((r) => r.letters.includes('s'))).toBe(true)
    expect(
      huntRounds('i', { digraph: 'ng' }).some((r) => r.letters.includes('g')),
    ).toBe(true)
  })

  it('D5: the pair rule’s cost is Dave’s (sh-o 29 -> 28, th-o 25 -> 22)', () => {
    expect(daveRounds('o', 'sh', 3, { pairRule: false })).toHaveLength(29)
    expect(daveRounds('o', 'th', 3, { pairRule: false })).toHaveLength(25)
  })

  it('D10: exactly one digraph critter; a round with two is never dealt', () => {
    expect(huntRoundOf(['i', 'sh', 'ng', ...'bfp'])).toBeNull()
    for (const length of [3, 4] as const)
      for (const g of DIGRAPHS)
        for (const v of 'aeiou')
          for (const r of huntRounds(v, { digraph: g, length })) {
            expect(
              r.letters.filter((u) =>
                (DIGRAPHS as readonly string[]).includes(u),
              ),
            ).toEqual([g])
            expect(
              r.targets.some((w) => huntUnits(w, r.letters)!.includes(g)),
            ).toBe(true)
            expect(r.extras.length).toBeLessThanOrEqual(3)
            const need = r.targets.length - 1
            expect(huntComplete(r, r.targets.slice(0, need))).toBe(true)
            expect(huntComplete(r, r.targets.slice(0, need - 1))).toBe(false)
          }
  })
})

describe('D6: the lists (Dave D (C), as printed)', () => {
  it('the 13 clip words are Dave’s targets, extras and chest; each makes 3 critters (chest 4) with its one digraph', () => {
    expect([...HUNT_DIGRAPH_LATER].sort()).toEqual(
      [...DAVE_TARGETS, ...DAVE_EXTRAS, ...DAVE_TARGETS_FOUR].sort(),
    )
    for (const w of [...DAVE_TARGETS, ...DAVE_EXTRAS])
      expect(splits(w, [...CRITTER_LETTERS, ...DIGRAPHS], 3).length).toBe(1)
  })

  it('HUNT_DIGRAPH_QUIET is his three-seat quiet, rude and known rejects (62); HUNT_DIGRAPH_FOUR_REJECTS his four-seat rude and known (25)', () => {
    expect([...HUNT_DIGRAPH_QUIET].sort()).toEqual([...DAVE_REJECTS].sort())
    expect(HUNT_DIGRAPH_QUIET.size).toBe(62)
    expect([...HUNT_DIGRAPH_FOUR_REJECTS].sort()).toEqual(
      [...DAVE_REJECTS_FOUR].sort(),
    )
    expect(HUNT_DIGRAPH_FOUR_REJECTS.size).toBe(25)
    for (const w of HUNT_DIGRAPH_QUIET) {
      expect(splits(w, [...CRITTER_LETTERS, ...DIGRAPHS], 3)).toHaveLength(1)
      expect(critterRun(huntUnits(w, [...CRITTER_LETTERS, ...DIGRAPHS])!)).toBe(
        'quiet',
      )
    }
    for (const w of HUNT_DIGRAPH_FOUR_REJECTS)
      expect(splits(w, [...CRITTER_LETTERS, ...DIGRAPHS], 4)).toHaveLength(1)
  })

  it('shin shot wish are the only digraph extras any round deals; no dealt round spells a reject', () => {
    const extras = new Set<string>()
    for (const length of [3, 4] as const)
      for (const g of DIGRAPHS)
        for (const v of 'aeiou')
          for (const r of huntRounds(v, { digraph: g, length }))
            for (const w of r.extras)
              if (huntUnits(w, r.letters)!.includes(g)) extras.add(w)
    expect([...extras].sort()).toEqual(DAVE_EXTRAS)
  })

  it('the known words with no clip keep his counts: without them sh-i would deal 26 (3 spell dish) and ch-i 18 (8 spell inch and chin); the other pairs are unchanged', () => {
    // Dave D (C) says rejecting them changes no count; by critters it
    // does for these two pairs. With them, as he rules, his 23 and 10.
    const without = Object.fromEntries(
      THREE_PAIRS.map(([g, v]) => [
        `${g}-${v}`,
        daveRounds(v, g, 3, { known: false }).length,
      ]),
    )
    expect(without).toEqual({
      'sh-o': 28,
      'sh-i': 26,
      'sh-e': 15,
      'ch-i': 18,
      'th-o': 22,
      'ng-i': 24,
    })
    const extra = daveRounds('i', 'sh', 3, { known: false }).filter(
      (r) =>
        !huntRounds('i', { digraph: 'sh' }).some(
          (h) => h.letters.join() === r.letters.join(),
        ),
    )
    expect(extra.map((r) => r.letters.join(' '))).toEqual([
      'i sh d f g l',
      'i sh d f g p',
      'i sh d f g w',
    ])
    for (const r of extra)
      expect(huntUnits('dish', r.letters)).toEqual(['d', 'i', 'sh'])
  })
})

describe('D7: gating by Word Song step', () => {
  const at = (step: SkillNode) => {
    setKeyValueStore(new MapStore())
    return progressAtStep(step)
  }

  it('each digraph once its step is current or mastered: sh, ch, th, then ng at duck-words', () => {
    expect(huntDigraphs(null)).toEqual([])
    expect(huntDigraphs(at('cvc-words-short-o'))).toEqual([])
    expect(huntDigraphs(at('cvc-words-short-e'))).toEqual([])
    expect(huntDigraphs(at('digraphs-sh'))).toEqual(['sh'])
    expect(huntDigraphs(at('digraphs-ch'))).toEqual(['sh', 'ch'])
    expect(huntDigraphs(at('digraphs-th-voiceless'))).toEqual([
      'sh',
      'ch',
      'th',
    ])
    expect(huntDigraphs(at('sight-words'))).toEqual(['sh', 'ch', 'th'])
    expect(huntDigraphs(at('simple-sentences'))).toEqual(['sh', 'ch', 'th'])
    expect(huntDigraphs(at('duck-words'))).toEqual(['sh', 'ch', 'th', 'ng'])
    expect(huntDigraphs(at('goat-stories'))).toEqual(['sh', 'ch', 'th', 'ng'])
    // On digraphs-sh every CVC step is mastered: all five vowels deal.
    expect(huntVowels(at('digraphs-sh'))).toEqual(['a', 'o', 'u', 'i', 'e'])
  })

  it('learner B with no digraph step open gets no digraph round over 1,000 seeds, and the deal is today’s draw for draw', () => {
    const p = at('cvc-words-short-e')
    const vowels = huntVowels(p)
    const digraphs = huntDigraphs(p)
    expect(digraphs).toEqual([])
    for (const length of [3, 4] as const)
      for (let seed = 0; seed < 1000; seed++) {
        const r = huntDeal(vowels, seeded(seed), { length, digraphs })
        expect(digraphOf(r)).toBeUndefined()
        expect(r).toEqual(huntDeal(vowels, seeded(seed), { length }))
      }
  })

  it('without a digraph, huntRounds is today’s (three: a 182, o 92, u 127, i 8, e 82; four: a 110, o 29, u 38, i 0, e 19)', () => {
    const count = (length: HuntLength) =>
      Object.fromEntries(
        [...'aouie'].map((v) => [v, huntRounds(v, { length }).length]),
      )
    expect(count(3)).toEqual({ a: 182, o: 92, u: 127, i: 8, e: 82 })
    expect(count(4)).toEqual({ a: 110, o: 29, u: 38, i: 0, e: 19 })
    for (const v of 'aeiou')
      for (const length of [3, 4] as const)
        for (const r of huntRounds(v, { length }))
          expect(digraphOf(r)).toBeUndefined()
  })
})

describe('D8: the deal (Dave D (B))', () => {
  const ALL = [...'aouie']
  const share = (
    digraphs: HuntDigraph[],
    length: HuntLength,
    pick: (r: HuntRound) => boolean,
  ) => {
    let n = 0
    for (let seed = 0; seed < 10000; seed++)
      if (pick(huntDeal(ALL, seeded(seed), { length, digraphs }))) n++
    return n / 10000
  }

  it('only sh open: sh rounds are 50 % ± 2 % of three-seat deals and 0 % of four-seat deals', () => {
    const sh = (r: HuntRound) => digraphOf(r) === 'sh'
    expect(Math.abs(share(['sh'], 3, sh) - 0.5)).toBeLessThanOrEqual(0.02)
    expect(share(['sh'], 4, (r) => digraphOf(r) !== undefined)).toBe(0)
  })

  it('sh and ch open: ch-e is 50 % ± 2 % of four-seat deals; three seats split a third each', () => {
    expect(
      Math.abs(
        share(
          ['sh', 'ch'],
          4,
          (r) => digraphOf(r) === 'ch' && r.letters[0] === 'e',
        ) - 0.5,
      ),
    ).toBeLessThanOrEqual(0.02)
    for (const g of [undefined, 'sh', 'ch'])
      expect(
        Math.abs(share(['sh', 'ch'], 3, (r) => digraphOf(r) === g) - 1 / 3),
      ).toBeLessThanOrEqual(0.02)
  })

  it('then uniformly among her vowels with rounds for that pick: sh rounds are o, i and e a third each', () => {
    const counts: Record<string, number> = {}
    let n = 0
    for (let seed = 0; seed < 10000; seed++) {
      const r = huntDeal(ALL, seeded(seed), { digraphs: ['sh'] })
      if (digraphOf(r) !== 'sh') continue
      counts[r.letters[0]!] = (counts[r.letters[0]!] ?? 0) + 1
      n++
    }
    expect(Object.keys(counts).sort()).toEqual(['e', 'i', 'o'])
    for (const v of 'oie')
      expect(Math.abs(counts[v]! / n - 1 / 3)).toBeLessThanOrEqual(0.03)
  })

  it('never last’s letters; the same seed the same round; every dealt digraph round is its pair’s', () => {
    const last = HUNT_DIGRAPH_FALLBACK.sh!.i!
    for (let seed = 0; seed < 1000; seed++) {
      const r = huntDeal(['i'], seeded(seed), { last, digraphs: ['sh'] })
      expect(r.letters).not.toEqual(last)
      expect(huntDeal(['i'], seeded(seed), { last, digraphs: ['sh'] })).toEqual(
        r,
      )
      const g = digraphOf(r) as HuntDigraph | undefined
      expect(huntRounds('i', { digraph: g })).toContainEqual(r)
    }
  })
})

describe('D9: the digraph critters’ sounds', () => {
  it('CRITTER_SOUND_SOURCE gains sh {ship, 0}, ch {chip, 0}, th {thin, 0}, ng {ring, 2}, from their blends', () => {
    expect(CRITTER_SOUND_SOURCE.sh).toEqual({ word: 'ship', index: 0 })
    expect(CRITTER_SOUND_SOURCE.ch).toEqual({ word: 'chip', index: 0 })
    expect(CRITTER_SOUND_SOURCE.th).toEqual({ word: 'thin', index: 0 })
    expect(CRITTER_SOUND_SOURCE.ng).toEqual({ word: 'ring', index: 2 })
    for (const g of DIGRAPHS) {
      const [sounds, word] = CRITTER_DIGRAPH_BLENDS[g]!.split(' ... ')
      const src = CRITTER_SOUND_SOURCE[g]!
      expect(src.word).toBe(word)
      expect(sounds!.split(' - ')[src.index]).toBe(g)
    }
    // The 22 letters keep theirs.
    expect(Object.keys(CRITTER_SOUND_SOURCE)).toHaveLength(22 + 4)
  })
})

describe('D11: the counts (Dave D (C))', () => {
  /**
   * His table. `decoy` is his "rounds with a decoy", which counts a
   * consonant the way characters do (ship uses s); `critterDecoy` is D4's
   * count by critters on the same rounds (ship uses sh, not s).
   */
  const DAVE: Record<
    string,
    {
      rounds: number
      splits: Record<number, number>
      decoy: number
      critterDecoy: number
    }
  > = {
    'sh-o': {
      rounds: 28,
      splits: { 4: 5, 5: 13, 6: 8, 7: 2 },
      decoy: 11,
      critterDecoy: 13,
    },
    'sh-i': {
      rounds: 23,
      splits: { 4: 20, 5: 3 },
      decoy: 12,
      critterDecoy: 13,
    },
    'sh-e': { rounds: 15, splits: { 4: 15 }, decoy: 0, critterDecoy: 0 },
    'ch-i': { rounds: 10, splits: { 4: 10 }, decoy: 0, critterDecoy: 0 },
    'th-o': {
      rounds: 22,
      splits: { 4: 7, 5: 5, 6: 8, 7: 2 },
      decoy: 8,
      critterDecoy: 8,
    },
    'ng-i': { rounds: 24, splits: { 4: 23, 5: 1 }, decoy: 0, critterDecoy: 0 },
  }

  /** A round's consonants in no target, counting characters (his column). */
  const charDecoys = (r: HuntRound) =>
    r.letters.slice(1).filter((u) => !r.targets.some((w) => w.includes(u)))

  it('three seats: 122, per pair with his N splits; his decoy column by characters, D4’s by critters; every other pair 0', () => {
    let total = 0
    for (const g of DIGRAPHS)
      for (const v of 'aeiou') {
        const rounds = huntRounds(v, { digraph: g })
        const want = DAVE[`${g}-${v}`]
        total += rounds.length
        if (want === undefined) {
          expect([g, v, rounds.length]).toEqual([g, v, 0])
          continue
        }
        expect([g, v, rounds.length]).toEqual([g, v, want.rounds])
        expect(splitsOf(rounds)).toEqual(want.splits)
        expect(rounds.filter((r) => charDecoys(r).length > 0)).toHaveLength(
          want.decoy,
        )
        expect(rounds.filter((r) => decoysOf(r, 3).length > 0)).toHaveLength(
          want.critterDecoy,
        )
        for (const r of rounds) expect(r.extras.length).toBeLessThanOrEqual(3)
      }
    expect(total).toBe(122)
  })

  it('four seats: 22, all ch-e, N 4: 19, 5: 3; 12 with a decoy by characters (his), 18 by critters (D4)', () => {
    for (const g of DIGRAPHS)
      for (const v of 'aeiou')
        if (`${g}-${v}` !== 'ch-e')
          expect([g, v, huntRounds(v, { digraph: g, ...FOUR }).length]).toEqual(
            [g, v, 0],
          )
    const che = huntRounds('e', { digraph: 'ch', ...FOUR })
    expect(che).toHaveLength(22)
    expect(splitsOf(che)).toEqual({ 4: 19, 5: 3 })
    expect(che.filter((r) => charDecoys(r).length > 0)).toHaveLength(12)
    expect(che.filter((r) => decoysOf(r, 4).length > 0)).toHaveLength(18)
  })

  it('each digraph target’s slot count is his', () => {
    const slots = (g: HuntDigraph, v: string, w: string, length: HuntLength) =>
      huntRounds(v, { digraph: g, length }).filter((r) => r.targets.includes(w))
        .length
    expect(slots('sh', 'o', 'shop', 3)).toBe(28)
    expect(slots('sh', 'i', 'ship', 3)).toBe(23)
    expect(slots('sh', 'i', 'fish', 3)).toBe(13)
    expect(slots('sh', 'e', 'shed', 3)).toBe(15)
    expect(slots('ch', 'i', 'chip', 3)).toBe(10)
    expect(slots('th', 'o', 'moth', 3)).toBe(22)
    expect(slots('ng', 'i', 'wing', 3)).toBe(18)
    expect(slots('ng', 'i', 'sing', 3)).toBe(14)
    expect(slots('ng', 'i', 'ring', 3)).toBe(3)
    expect(slots('ch', 'e', 'chest', 4)).toBe(22)
  })
})

describe('D12: the pinned fallbacks (Dave D (C), "Kevin pins them")', () => {
  const PINNED: readonly [
    HuntDigraph,
    string,
    HuntLength,
    string,
    string,
    string,
  ][] = [
    ['sh', 'o', 3, 'o sh b f p x', 'box fox pop shop', 'bob off'],
    ['sh', 'i', 3, 'i sh b c n p', 'bib bin pin ship', 'nib nip shin'],
    ['sh', 'e', 3, 'e sh b d g l', 'bed egg leg shed', 'beg led'],
    ['ch', 'i', 3, 'i ch b f g p', 'bib chip fig pig', 'big fib gig'],
    ['th', 'o', 3, 'o th c d m t', 'cot dot mom moth', 'cod odd tot'],
    ['ng', 'i', 3, 'i ng b f g w', 'bib fig wig wing', 'big fib gig'],
    ['ch', 'e', 4, 'e ch c j n s t', 'chest jets nest tent', 'sent test'],
  ]

  it.each(PINNED)(
    '%s-%s (%s seats): %s, with his targets and extras, the pair’s first round',
    (g, v, length, letters, targets, extras) => {
      const table =
        length === 3 ? HUNT_DIGRAPH_FALLBACK : HUNT_DIGRAPH_FOUR_FALLBACK
      expect(table[g]![v]).toEqual(letters.split(' '))
      const r = huntRoundOf(letters.split(' '), { length })!
      expect(r).toEqual({
        letters: letters.split(' '),
        targets: targets.split(' '),
        extras: extras.split(' '),
      })
      expect(huntRounds(v, { digraph: g, length })[0]).toEqual(r)
    },
  )

  it('one entry per pair that deals, no more', () => {
    expect(
      Object.entries(HUNT_DIGRAPH_FALLBACK).flatMap(([g, byVowel]) =>
        Object.keys(byVowel).map((v) => `${g}-${v}`),
      ),
    ).toEqual(['sh-o', 'sh-i', 'sh-e', 'ch-i', 'th-o', 'ng-i'])
    expect(
      Object.entries(HUNT_DIGRAPH_FOUR_FALLBACK).flatMap(([g, byVowel]) =>
        Object.keys(byVowel).map((v) => `${g}-${v}`),
      ),
    ).toEqual(['ch-e'])
  })
})

/** The pack pictures the app bundles (as `playPlace.test.ts` reads them). */
function bundledPictures(): Set<string> {
  const registry = readFileSync(
    join(process.cwd(), 'mobile', 'src', 'assets', 'registry.ts'),
    'utf8',
  )
  const keys = registry.matchAll(
    /'\/(?:assets\/pictures\/picture-([a-z]+)\.svg|native\/pictures\/([a-z]+))'/g,
  )
  return new Set([...keys].map((m) => m[1] ?? m[2]!))
}

/** A Word Song step's `word.p*.correct` lines (read in the test only, K4). */
function lessonCorrect(step: string): string[] {
  const canon = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'public',
        'canon',
        'word-song',
        'level-1',
        `${step}.json`,
      ),
      'utf8',
    ),
  ) as { plan: { utterances: { id: string; text: string }[] } }
  return canon.plan.utterances
    .filter((u) => /^word\.p\d+\.correct$/.test(u.id))
    .map((u) => u.text)
}

describe('D13: pictures, praise and board order', () => {
  it('the 10 digraph targets with a bundled picture are pictured; shin shot wish are not', () => {
    const bundled = bundledPictures()
    expect(HUNT_DIGRAPH_PICTURE_WORDS).toEqual(
      HUNT_DIGRAPH_LATER.filter((w) => bundled.has(w)).sort(),
    )
    expect(HUNT_DIGRAPH_PICTURE_WORDS).toEqual(
      words('chest chip fish moth ring shed ship shop sing wing'),
    )
    for (const w of HUNT_DIGRAPH_PICTURE_WORDS)
      expect(critterHasPicture(w)).toBe(true)
    for (const w of DAVE_EXTRAS) expect(critterHasPicture(w)).toBe(false)
  })

  it('the 8 lesson words get their lesson’s own bundled praise; fish and sing none', () => {
    const lines = [
      'digraphs-sh',
      'digraphs-ch',
      'digraphs-th-voiceless',
      'duck-words',
    ].flatMap(lessonCorrect)
    expect(HUNT_DIGRAPH_LESSON_WORDS).toEqual(
      words('chest chip moth ring shed ship shop wing'),
    )
    for (const w of HUNT_DIGRAPH_LESSON_WORDS) {
      expect(critterPraise(w)).toBe(`Yes! That's a ${w}.`)
      expect(lines).toContain(critterPraise(w))
    }
    for (const w of ['fish', 'sing', ...DAVE_EXTRAS])
      expect(critterPraise(w)).toBeUndefined()
    expect(CRITTER_PRAISE_WORDS).toEqual(
      [
        ...CRITTER_PICTURE_WORDS,
        ...HUNT_FOUR_LESSON_WORDS,
        ...HUNT_DIGRAPH_LESSON_WORDS,
      ].sort(),
    )
    expect(CRITTER_PRAISE_WORDS).toHaveLength(64)
  })

  it('huntBoardOrder puts the digraph targets after the picture words a-z', () => {
    const order = (letters: string, length: HuntLength = 3) =>
      huntBoardOrder(huntRoundOf(letters.split(' '), { length })!)
    expect(order('i sh b c n p')).toEqual(words('bib bin pin ship'))
    expect(order('o th c d m t')).toEqual(words('cot dot mom moth'))
    expect(order('i ng b f g w')).toEqual(words('bib fig wig wing'))
    expect(order('e ch c j n s t', 4)).toEqual(words('chest jets nest tent'))
    for (const [g, v] of THREE_PAIRS)
      for (const r of huntRounds(v, { digraph: g })) {
        const board = huntBoardOrder(r)
        const pics = board.filter((w) => CRITTER_PICTURE_WORDS.includes(w))
        expect(board).toEqual([
          ...pics.sort(),
          ...board.filter((w) => !pics.includes(w)).sort(),
        ])
        expect(board.slice(0, pics.length)).toEqual(pics)
      }
  })
})
