import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultProgress } from '../progress/defaults'
import { LITERACY_TREE, MATH_TREE } from '../progress/mastery'
import type { Progress, SkillNode, WordSongNode } from '../progress/types'
import * as PlayPlace from './playPlace'
import {
  CRITTER_CAP,
  CRITTER_FUNNY_FROM,
  CRITTER_LEFT_OUT,
  CRITTER_NEVER_SAY,
  CRITTER_NOT_SAID,
  CRITTER_PICTURE_WORDS,
  CRITTER_REAL_WORDS,
  CRITTER_SAID_PICTURE_WORDS,
  CRITTER_SAID_WORDS,
  CRITTER_SOUND_SOURCE,
  CRITTER_WORDS_BY_STEP,
  critterFunnyOpen,
  critterRun,
  critterSet,
  openPlayGames,
  PLAY_GAMES,
  RAFT_ANIMALS,
  RAFT_CROSSINGS,
  RAFT_LOAD,
  RAFT_SHORE_SIZE,
  raftLoads,
  raftRefill,
  raftShore,
  raftStuck,
} from './playPlace'

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

function withLevels(levels: Partial<Record<SkillNode, string>>): Progress {
  const p = defaultProgress()
  return {
    ...p,
    skillLevels: { ...p.skillLevels, ...levels } as Progress['skillLevels'],
  }
}

/** Every step before `current` in its tree mastered, `current` practicing. */
function currentAt(current: SkillNode): Partial<Record<SkillNode, string>> {
  const tree: readonly SkillNode[] = (
    MATH_TREE as readonly SkillNode[]
  ).includes(current)
    ? MATH_TREE
    : LITERACY_TREE
  const i = tree.indexOf(current)
  return {
    ...Object.fromEntries(tree.slice(0, i).map((n) => [n, 'mastered'])),
    [current]: 'practicing',
  }
}

const allMastered = (tree: readonly SkillNode[]) =>
  Object.fromEntries(tree.map((n) => [n, 'mastered']))

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])
const CRITTER_LETTERS = 'abcdefghijlmnoprstuvwx'.split('')

describe('PLAY_GAMES and openPlayGames (play-place spec § 1.1)', () => {
  it('has the raft at adding to ten and the critters at letter names, in tile order (Thomas 2026-10-22)', () => {
    expect(PLAY_GAMES).toEqual({
      raft: { opensAt: 'add-to-10' },
      critters: { opensAt: 'letter-names' },
    })
    expect(Object.keys(PLAY_GAMES)).toEqual(['raft', 'critters'])
  })

  it('C1: the critters open at Word Song’s first step, so every learner has them', () => {
    expect(LITERACY_TREE[0]).toBe(PLAY_GAMES.critters.opensAt)
  })

  it('C1: the default profile opens both', () => {
    expect(openPlayGames(defaultProgress())).toEqual(['raft', 'critters'])
  })

  it('C1: both open once letter sounds is mastered, and once both steps are mastered', () => {
    expect(openPlayGames(withLevels({ 'letter-sounds': 'mastered' }))).toEqual([
      'raft',
      'critters',
    ])
    expect(
      openPlayGames(
        withLevels({
          ...allMastered(MATH_TREE),
          ...allMastered(LITERACY_TREE),
        }),
      ),
    ).toEqual(['raft', 'critters'])
    expect(
      openPlayGames(
        withLevels({
          ...currentAt('sub-to-10'),
          ...currentAt('cvc-words-short-o'),
        }),
      ),
    ).toEqual(['raft', 'critters'])
  })

  it('C1: a learner on letter names or letter sounds has the critters (Thomas 2026-10-22)', () => {
    expect(
      openPlayGames(
        withLevels({ ...currentAt('add-to-10'), ...currentAt('letter-names') }),
      ),
    ).toEqual(['raft', 'critters'])
    expect(
      openPlayGames(
        withLevels({
          'number-recog': 'practicing',
          ...currentAt('letter-sounds'),
        }),
      ),
    ).toEqual(['critters'])
  })

  it('C1: the critters only, with numbers not mastered', () => {
    expect(
      openPlayGames(
        withLevels({
          'number-recog': 'practicing',
          ...currentAt('blending-cv'),
        }),
      ),
    ).toEqual(['critters'])
  })

  it('C1: the critters for a learner with every step locked; nothing for null', () => {
    const locked = Object.fromEntries(
      [...MATH_TREE, ...LITERACY_TREE].map((n) => [n, 'locked']),
    )
    expect(openPlayGames(withLevels(locked))).toEqual(['critters'])
    expect(openPlayGames(null)).toEqual([])
  })
})

describe('the raft (§ 2.1)', () => {
  const sum = (ws: readonly number[]) => ws.reduce((n, w) => n + w, 0)
  const pairLoads = (ws: readonly number[]) =>
    raftLoads(ws).filter((l) => l.length === 2)

  it('has the constants and the nine animals, small to big', () => {
    expect([RAFT_LOAD, RAFT_SHORE_SIZE, RAFT_CROSSINGS]).toEqual([10, 6, 3])
    expect(RAFT_ANIMALS).toEqual({
      1: 'bee',
      2: 'frog',
      3: 'hen',
      4: 'duck',
      5: 'cat',
      6: 'fox',
      7: 'dog',
      8: 'goat',
      9: 'pig',
    })
  })

  it('C3: raftLoads finds every set of positions that makes exactly ten', () => {
    expect(raftLoads([7, 3, 6, 4, 8, 2])).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ])
    expect(raftLoads([1, 2, 7, 9, 5, 5])).toEqual([
      [0, 1, 2],
      [0, 3],
      [4, 5],
    ])
    expect(raftLoads([9, 9])).toEqual([])
    expect(raftLoads([])).toEqual([])
    for (const load of raftLoads([1, 2, 3, 4, 5, 6])) {
      expect(sum(load.map((i) => [1, 2, 3, 4, 5, 6][i]!))).toBe(10)
    }
  })

  it('C3: raftStuck is true only when no waiting set fills the gap to ten', () => {
    expect(raftStuck([2, 5, 7, 9], 6)).toBe(true)
    expect(raftStuck([2, 5, 7, 9], 5)).toBe(false)
    expect(raftStuck([1, 3, 5, 9], 6)).toBe(false)
    for (const w of [[], [1], [2, 5, 7, 9], [9, 9, 9]]) {
      expect(raftStuck(w, 0)).toBe(false)
      expect(raftStuck(w, 10)).toBe(false)
    }
    expect(raftStuck([], 3)).toBe(true)
  })

  it('C2: raftShore gives 6 weights in 1-9 with at least 2 loads, one a pair, over 1,000 seeds', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const shore = raftShore(seeded(seed))
      expect(shore).toHaveLength(6)
      for (const w of shore) {
        expect(Number.isInteger(w)).toBe(true)
        expect(w).toBeGreaterThanOrEqual(1)
        expect(w).toBeLessThanOrEqual(9)
      }
      expect(raftLoads(shore).length).toBeGreaterThanOrEqual(2)
      expect(pairLoads(shore).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('C2: the same seed gives the same shore', () => {
    for (const seed of [1, 7, 42, 999]) {
      expect(raftShore(seeded(seed))).toEqual(raftShore(seeded(seed)))
    }
  })

  it('C2: raftRefill keeps the waiting weights in order and returns 6 with the same guarantee', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = seeded(seed)
      const n = 2 + Math.floor(rng() * 4)
      const waiting = Array.from({ length: n }, () => 1 + Math.floor(rng() * 9))
      const shore = raftRefill(waiting, rng)
      expect(shore).toHaveLength(6)
      expect(shore.slice(0, n)).toEqual(waiting)
      for (const w of shore) {
        expect(w).toBeGreaterThanOrEqual(1)
        expect(w).toBeLessThanOrEqual(9)
      }
      expect(raftLoads(shore).length).toBeGreaterThanOrEqual(2)
      expect(pairLoads(shore).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('C2: raftRefill passes the hard waiting sets (all one weight, no pair possible among them)', () => {
    for (const waiting of [
      [9, 9, 9, 9, 9],
      [1, 1, 1, 1, 1],
      [5, 5, 5, 5, 5],
      [9],
      [],
    ]) {
      const shore = raftRefill(waiting, seeded(3))
      expect(shore).toHaveLength(6)
      expect(shore.slice(0, waiting.length)).toEqual(waiting)
      expect(raftLoads(shore).length).toBeGreaterThanOrEqual(2)
      expect(pairLoads(shore).length).toBeGreaterThanOrEqual(1)
    }
  })
})

/** The `word.p*.blend` words of a canon step file (K4: read in the test only). */
function canonBlendWords(step: WordSongNode): string[] {
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
    .filter((u) => /^word\.p\d+\.blend$/.test(u.id))
    .map((u) => u.text.split('...').pop()!.trim())
}

/**
 * The pack pictures the app bundles: the picture keys of
 * `mobile/src/assets/registry.ts`, the map `pictureAsset(key)` reads.
 */
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

const CVC_STEPS: readonly WordSongNode[] = [
  'blending-cv',
  'sounding-out',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
]

const ALL_45 = [
  ...new Set(Object.values(CRITTER_WORDS_BY_STEP).flatMap((ws) => ws!)),
].sort()

/** The words of the CVC steps up to and including `last`, sorted. */
const wordsThrough = (last: WordSongNode) =>
  [
    ...new Set(
      CVC_STEPS.slice(0, CVC_STEPS.indexOf(last) + 1).flatMap(
        (s) => CRITTER_WORDS_BY_STEP[s]!,
      ),
    ),
  ].sort()

describe('the critters (§ 3.1)', () => {
  it('C4: each step’s words are its canon blend words, minus gem', () => {
    expect(CRITTER_LEFT_OUT).toEqual(['gem'])
    expect(Object.keys(CRITTER_WORDS_BY_STEP)).toEqual(CVC_STEPS)
    for (const step of CVC_STEPS) {
      const canon = canonBlendWords(step)
      expect(canon).toHaveLength(8)
      expect(CRITTER_WORDS_BY_STEP[step]).toEqual(
        canon.filter((w) => !CRITTER_LEFT_OUT.includes(w)).sort(),
      )
    }
    expect(ALL_45).toHaveLength(45)
  })

  it('C4: § 3.1’s table, row by row', () => {
    expect(CRITTER_WORDS_BY_STEP).toEqual({
      'blending-cv': ['bag', 'cat', 'fan', 'hat', 'man', 'pan', 'tag', 'van'],
      'sounding-out': ['bat', 'can', 'cap', 'dad', 'fan', 'jam', 'man', 'mat'],
      'cvc-words': ['bag', 'cat', 'fan', 'hat', 'man', 'pan', 'tag', 'van'],
      'cvc-words-short-o': [
        'box',
        'cot',
        'dog',
        'fox',
        'hot',
        'log',
        'mop',
        'pot',
      ],
      'cvc-words-short-u': [
        'bug',
        'bus',
        'cup',
        'jug',
        'nut',
        'rug',
        'sun',
        'tub',
      ],
      'cvc-words-short-i': [
        'bib',
        'bin',
        'fig',
        'lid',
        'pig',
        'pin',
        'sip',
        'wig',
      ],
      'cvc-words-short-e': ['bed', 'hen', 'jet', 'leg', 'net', 'pen', 'web'],
    })
  })

  it('C5: CRITTER_PICTURE_WORDS is all 45 words, sorted, over the 22 letters, with no step gate (Thomas 2026-10-22)', () => {
    expect(CRITTER_PICTURE_WORDS).toEqual(ALL_45)
    expect(CRITTER_PICTURE_WORDS).toHaveLength(45)
    expect(new Set(CRITTER_PICTURE_WORDS.join('')).size).toBe(22)
    // The step gate is gone: no learner-dependent word list is exported.
    expect(Object.keys(PlayPlace)).not.toContain('critterWords')
    // § 3.1's per-step shapes still hold for the step table itself.
    const shapes: [WordSongNode, number, number][] = [
      ['blending-cv', 8, 11],
      ['cvc-words', 14, 13],
      ['cvc-words-short-o', 22, 16],
      ['cvc-words-short-u', 30, 19],
      ['cvc-words-short-i', 38, 21],
      ['cvc-words-short-e', 45, 22],
    ]
    for (const [step, words, letters] of shapes) {
      expect(wordsThrough(step)).toHaveLength(words)
      expect(new Set(wordsThrough(step).join('')).size).toBe(letters)
    }
  })

  it('C5: critterSet keeps at most 16 letters, every vowel, only words they spell, a word per consonant', () => {
    expect(CRITTER_CAP).toBe(16)
    for (const words of [
      wordsThrough('cvc-words-short-u'),
      wordsThrough('cvc-words-short-i'),
      CRITTER_PICTURE_WORDS,
    ]) {
      const vowels = [...new Set(words.join(''))].filter((l) => VOWELS.has(l))
      for (let seed = 1; seed <= 1000; seed++) {
        const set = critterSet(words, seeded(seed))
        expect(set.letters.length).toBeLessThanOrEqual(16)
        expect(new Set(set.letters).size).toBe(set.letters.length)
        for (const v of vowels) expect(set.letters).toContain(v)
        const have = new Set(set.letters)
        expect(set.words).toEqual(
          words.filter((w) => [...w].every((l) => have.has(l))),
        )
        for (const c of set.letters.filter((l) => !VOWELS.has(l))) {
          expect(set.words.some((w) => w.includes(c))).toBe(true)
        }
      }
    }
  })

  it('C5: the meadow needs no Word Song step: any learner’s visit has 16 critters and words to build (Thomas 2026-10-22)', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const set = critterSet(CRITTER_PICTURE_WORDS, seeded(seed))
      expect(set.letters).toHaveLength(CRITTER_CAP)
      expect(set.words.length).toBeGreaterThan(0)
      for (const w of set.words) expect(critterRun(w)).toBe('picture')
    }
  })

  it('C5 (Thomas 2026-10-23, build 20): with no cap (a tablet), critterSet keeps all 22 letters and all 45 words on every visit, no rotation', () => {
    const meadow = [
      ...'aeiou',
      ...CRITTER_LETTERS.filter((l) => !VOWELS.has(l)),
    ]
    for (let seed = 1; seed <= 1000; seed++) {
      const set = critterSet(CRITTER_PICTURE_WORDS, seeded(seed), {
        cap: Infinity,
      })
      expect(set.letters).toEqual(meadow)
      expect(set.words).toEqual(CRITTER_PICTURE_WORDS)
    }
    // With no option, still the phone's cap.
    expect(critterSet(CRITTER_PICTURE_WORDS, seeded(1)).letters).toHaveLength(
      CRITTER_CAP,
    )
  })

  it('C5: with 16 letters or fewer, critterSet keeps them all, vowels first, then alphabetical', () => {
    const words = wordsThrough('cvc-words-short-o')
    const set = critterSet(words, seeded(5))
    expect(set.letters).toEqual([
      'a',
      'o',
      'b',
      'c',
      'd',
      'f',
      'g',
      'h',
      'j',
      'l',
      'm',
      'n',
      'p',
      't',
      'v',
      'x',
    ])
    expect(set.words).toEqual(words)
  })

  it('C6: CRITTER_SOUND_SOURCE follows § 3.4’s rule and equals its table', () => {
    const table = {
      a: { word: 'bag', index: 1 },
      e: { word: 'bed', index: 1 },
      i: { word: 'bib', index: 1 },
      o: { word: 'box', index: 1 },
      u: { word: 'bug', index: 1 },
      b: { word: 'bag', index: 0 },
      c: { word: 'can', index: 0 },
      d: { word: 'dad', index: 0 },
      f: { word: 'fan', index: 0 },
      h: { word: 'hat', index: 0 },
      j: { word: 'jam', index: 0 },
      l: { word: 'leg', index: 0 },
      m: { word: 'man', index: 0 },
      n: { word: 'net', index: 0 },
      p: { word: 'pan', index: 0 },
      r: { word: 'rug', index: 0 },
      s: { word: 'sip', index: 0 },
      t: { word: 'tag', index: 0 },
      v: { word: 'van', index: 0 },
      w: { word: 'web', index: 0 },
      g: { word: 'bag', index: 2 },
      x: { word: 'box', index: 2 },
    }
    expect(CRITTER_SOUND_SOURCE).toEqual(table)
    // The rule, recomputed from the 45 words.
    const ruled: Record<string, { word: string; index: number }> = {}
    for (const l of CRITTER_LETTERS) {
      const at = (i: number) => ALL_45.find((w) => w[i] === l)
      const index = VOWELS.has(l) ? 1 : at(0) !== undefined ? 0 : 2
      ruled[l] = { word: at(index)!, index }
    }
    expect(ruled).toEqual(table)
    for (const [l, src] of Object.entries(CRITTER_SOUND_SOURCE)) {
      expect(ALL_45).toContain(src.word)
      expect(src.word[src.index]).toBe(l)
    }
  })
})

/** § 3.1's printed list, as printed (C10: pinned exactly). */
const PRINTED_REAL_WORDS = `
bad bag ban bat cab can cap cat dab dad dam fad fag fan fat fax gag gap gas had hag ham has hat jab
jam lab lad lag lap lax mad man map mat nab nag nap pad pal pan pat ram ran rap rat sad sag sap sat
sax tab tag tan tap tax van vat wag was wax
bed beg bet den fed gem get hem hen hex jet led leg let men met net peg pen pet red set sex ten vet
vex web wed wet
bib bid big bin bit dig dim din dip fib fig fin fit fix gig gin git hid him hip his hit jig lid lip
lit mix nib nip pig pin pit rib rid rig rim rip sin sip sit six tin tip tit wig win wit
bob bog box cob cod cog cop cot dog dot fog fox god got hob hog hop hot job jog jot lob log lot mob
mop nod not pod pop pot rob rod rot sob son top tot won
bud bug bum bun bus but cub cum cup cut dud dug fun gum gun gut hub hug hum hut jug jut lug mud mug
mum nun nut pub pug pun pup pus put rub rug rum run rut sub sum sun tub tug
`
  .trim()
  .split(/\s+/)

describe('CRITTER_REAL_WORDS and critterRun (§ 3.1, D5)', () => {
  it('C10: is exactly § 3.1’s 220 words', () => {
    expect([...CRITTER_REAL_WORDS].sort()).toEqual(
      [...PRINTED_REAL_WORDS].sort(),
    )
    expect(CRITTER_REAL_WORDS.size).toBe(220)
    const perVowel: Record<string, number> = {}
    for (const w of CRITTER_REAL_WORDS)
      perVowel[w[1]!] = (perVowel[w[1]!] ?? 0) + 1
    expect(perVowel).toEqual({ a: 61, e: 29, i: 47, o: 39, u: 44 })
  })

  it('C10: each is a consonant, a short vowel and a consonant from the 22 critter letters', () => {
    for (const w of CRITTER_REAL_WORDS) {
      expect(w).toMatch(/^[a-z]{3}$/)
      for (const l of w) expect(CRITTER_LETTERS).toContain(l)
      expect(VOWELS.has(w[0]!)).toBe(false)
      expect(VOWELS.has(w[1]!)).toBe(true)
      expect(VOWELS.has(w[2]!)).toBe(false)
    }
  })

  it('C10: holds all 45 picture words and gem', () => {
    expect(ALL_45.filter((w) => !CRITTER_REAL_WORDS.has(w))).toEqual([])
    expect(CRITTER_REAL_WORDS.has('gem')).toBe(true)
  })

  it('C10: CRITTER_NEVER_SAY and CRITTER_NOT_SAID are Dave’s lists, real words, no picture word (Dave 2026-10-22)', () => {
    expect([...CRITTER_NEVER_SAY].sort()).toEqual([
      'bum',
      'cum',
      'dam',
      'fag',
      'git',
      'god',
      'gun',
      'hag',
      'sex',
      'tit',
    ])
    expect([...CRITTER_NOT_SAID].sort()).toEqual([
      'gem',
      'gin',
      'has',
      'his',
      'put',
      'rum',
      'son',
      'was',
      'won',
    ])
    for (const w of [...CRITTER_NEVER_SAY, ...CRITTER_NOT_SAID]) {
      expect(CRITTER_REAL_WORDS.has(w)).toBe(true)
      expect(ALL_45).not.toContain(w)
    }
    expect(
      [...CRITTER_NEVER_SAY].filter((w) => CRITTER_NOT_SAID.has(w)),
    ).toEqual([])
  })

  it('C10: CRITTER_SAID_WORDS is every other real word that is not a picture word: 156, sorted', () => {
    expect(CRITTER_SAID_WORDS).toHaveLength(156)
    expect(CRITTER_SAID_WORDS).toEqual([...CRITTER_SAID_WORDS].sort())
    expect(new Set(CRITTER_SAID_WORDS).size).toBe(156)
    expect([...CRITTER_SAID_WORDS].sort()).toEqual(
      [...CRITTER_REAL_WORDS]
        .filter(
          (w) =>
            !ALL_45.includes(w) &&
            !CRITTER_NEVER_SAY.has(w) &&
            !CRITTER_NOT_SAID.has(w),
        )
        .sort(),
    )
    // 220 = 45 pictures + 10 never said + 9 not said + 156 said.
    expect(45 + CRITTER_NEVER_SAY.size + CRITTER_NOT_SAID.size + 156).toBe(220)
    for (const w of ['map', 'cab', 'ham', 'sat', 'hop', 'six', 'win'])
      expect(CRITTER_SAID_WORDS).toContain(w)
  })

  it('C10 (Thomas 2026-10-23, build 20): CRITTER_SAID_PICTURE_WORDS is exactly the said words with a bundled pack picture: 9, sorted', () => {
    const bundled = bundledPictures()
    // The registry read works: every picture word's picture is found.
    for (const w of ALL_45) expect(bundled.has(w)).toBe(true)
    expect(CRITTER_SAID_PICTURE_WORDS).toEqual([
      'bun',
      'gum',
      'hut',
      'map',
      'nap',
      'pop',
      'rat',
      'tap',
      'top',
    ])
    expect(CRITTER_SAID_PICTURE_WORDS).toEqual(
      CRITTER_SAID_WORDS.filter((w) => bundled.has(w)),
    )
    for (const w of CRITTER_SAID_PICTURE_WORDS)
      expect(critterRun(w)).toBe('word')
  })

  it('C10: critterRun: picture for all 45 (no step gate), word, quiet, funny', () => {
    for (const w of ALL_45) expect(critterRun(w)).toBe('picture')
    for (const w of ['map', 'cab', 'ham', 'sat', 'hop'])
      expect(critterRun(w)).toBe('word')
    for (const w of CRITTER_SAID_WORDS) expect(critterRun(w)).toBe('word')
    for (const w of [...CRITTER_NEVER_SAY, ...CRITTER_NOT_SAID])
      expect(critterRun(w)).toBe('quiet')
    for (const w of ['tup', 'baf', 'gub', 'vop'])
      expect(critterRun(w)).toBe('funny')
  })

  it('C10 (Dave’s safeguard, Thomas 2026-10-22): with funny false, a non-word is quiet; every other run is unchanged', () => {
    const off = { funny: false }
    for (const w of ['tup', 'baf', 'gub', 'vop'])
      expect(critterRun(w, off)).toBe('quiet')
    for (const w of ALL_45) expect(critterRun(w, off)).toBe('picture')
    for (const w of CRITTER_SAID_WORDS) expect(critterRun(w, off)).toBe('word')
    for (const w of [...CRITTER_NEVER_SAY, ...CRITTER_NOT_SAID])
      expect(critterRun(w, off)).toBe('quiet')
    expect(critterRun('tup', { funny: true })).toBe('funny')
  })

  it('C10 (Dave’s safeguard): non-words are funny from blending sounds on, quiet before it and for null', () => {
    expect(CRITTER_FUNNY_FROM).toBe('blending-cv')
    expect(critterFunnyOpen(null)).toBe(false)
    expect(critterFunnyOpen(withLevels(currentAt('letter-names')))).toBe(false)
    expect(critterFunnyOpen(withLevels(currentAt('letter-sounds')))).toBe(false)
    expect(critterFunnyOpen(defaultProgress())).toBe(false)
    expect(critterFunnyOpen(withLevels(currentAt('blending-cv')))).toBe(true)
    expect(critterFunnyOpen(withLevels(currentAt('cvc-words-short-e')))).toBe(
      true,
    )
    expect(critterFunnyOpen(withLevels(allMastered(LITERACY_TREE)))).toBe(true)
  })
})
