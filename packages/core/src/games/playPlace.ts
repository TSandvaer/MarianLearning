/**
 * The Play place and its two games (`design/native/play-place.md` § 1.1,
 * § 2.1, § 3.1): which games are open for a learner, the raft's shore, and
 * the letter critters' words, letters and sounds.
 *
 * A game is open when its `opensAt` step is current or mastered in that
 * step's world, the flower bed's rule (`miniGames.ts` `openGames`). Nothing
 * here is persisted: no `Progress` field, no storage key, no migration, and
 * no Leitner or history read. The games count toward nothing.
 *
 * Runtime code never imports canon JSON (K4): the critters' words are
 * pinned here, and `playPlace.test.ts` checks them against the canon.
 */
import { currentStepOf } from '../hub/hubCardModel'
import { MATH_TREE, type MasteryTrack } from '../progress/mastery'
import type { Progress, SkillNode, WordSongNode } from '../progress/types'

/** The Play place's games, in tile order. */
export type PlayGameId = 'raft' | 'critters'

export const PLAY_GAMES: Readonly<
  Record<PlayGameId, { readonly opensAt: SkillNode }>
> = {
  raft: { opensAt: 'add-to-10' },
  critters: { opensAt: 'blending-cv' },
}

const worldOf = (node: SkillNode): MasteryTrack =>
  (MATH_TREE as readonly SkillNode[]).includes(node) ? 'math' : 'word-song'

/** `node` is mastered, or its world's current step. */
function currentOrMastered(progress: Progress, node: SkillNode): boolean {
  return (
    progress.skillLevels[node] === 'mastered' ||
    currentStepOf(progress, worldOf(node)) === node
  )
}

/** The open games, in `PLAY_GAMES` order; `null` progress gives `[]`. */
export function openPlayGames(progress: Progress | null): PlayGameId[] {
  if (progress === null) return []
  return (Object.keys(PLAY_GAMES) as PlayGameId[]).filter((id) =>
    currentOrMastered(progress, PLAY_GAMES[id].opensAt),
  )
}

// ── Raft crossing (§ 2.1) ─────────────────────────────────────────────────

/** What the raft carries, exactly. */
export const RAFT_LOAD = 10
/** Animals waiting on the shore. */
export const RAFT_SHORE_SIZE = 6
/** Crossings in a trip; the third is the natural stop. */
export const RAFT_CROSSINGS = 3

export type RaftWeight = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/**
 * Each weight's animal, small to big, so size hints at weight: the shipped
 * pack pictures (`mobile/assets/pictures/<animal>.webp`).
 */
export const RAFT_ANIMALS: Readonly<Record<RaftWeight, string>> = {
  1: 'bee',
  2: 'frog',
  3: 'hen',
  4: 'duck',
  5: 'cat',
  6: 'fox',
  7: 'dog',
  8: 'goat',
  9: 'pig',
}

/** The lesson's three canon bonds (7 + 3, 6 + 4, 8 + 2): the fallback shore. */
const CANON_SHORE: readonly number[] = [7, 3, 6, 4, 8, 2]
const MAX_DRAWS = 50

/**
 * Every set of shore positions whose weights sum to exactly `RAFT_LOAD`:
 * positions ascending within a set, the sets in lexicographic order.
 */
export function raftLoads(weights: readonly number[]): number[][] {
  const out: number[][] = []
  const walk = (from: number, picked: number[], sum: number) => {
    if (sum === RAFT_LOAD && picked.length > 0) {
      out.push([...picked])
      return
    }
    for (let i = from; i < weights.length; i++) {
      const w = weights[i]!
      if (sum + w > RAFT_LOAD) continue
      picked.push(i)
      walk(i + 1, picked, sum + w)
      picked.pop()
    }
  }
  walk(0, [], 0)
  return out
}

/** True when `total` is 1-9 and no set of `waiting` makes `10 − total`. */
export function raftStuck(waiting: readonly number[], total: number): boolean {
  if (total < 1 || total >= RAFT_LOAD) return false
  const gap = RAFT_LOAD - total
  let sums = new Set<number>([0])
  for (const w of waiting) {
    const next = new Set(sums)
    for (const s of sums) if (s + w <= gap) next.add(s + w)
    sums = next
  }
  return !sums.has(gap)
}

/** At least 2 loads, at least one of them a pair (§ 2.1, D3). */
function shoreOk(shore: readonly number[]): boolean {
  const loads = raftLoads(shore)
  return loads.length >= 2 && loads.some((l) => l.length === 2)
}

const drawWeight = (rng: () => number) => 1 + Math.floor(rng() * 9)

/** Fisher-Yates over a copy, with `rng`. */
function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * A fresh shore: one bond to ten plus 4 more weights in 1-9, accepted when
 * it has at least 2 loads, then shuffled. After 50 rejected draws (never
 * expected), the three canon bonds, shuffled.
 */
export function raftShore(rng: () => number): number[] {
  for (let draw = 0; draw < MAX_DRAWS; draw++) {
    const a = drawWeight(rng)
    const shore = [a, RAFT_LOAD - a]
    while (shore.length < RAFT_SHORE_SIZE) shore.push(drawWeight(rng))
    if (shoreOk(shore)) return shuffled(shore, rng)
  }
  return shuffled(CANON_SHORE, rng)
}

/**
 * The shore after a crossing: `waiting` in its order, then the newcomers
 * that bring it back to 6 (`result.slice(waiting.length)`), with the same
 * guarantee as `raftShore`. The newcomers are drawn for the empty places
 * only. Fallback: the complement of a waiting weight first, then any
 * weights; and last, the first passing set in order (never expected).
 */
export function raftRefill(
  waiting: readonly number[],
  rng: () => number,
): number[] {
  const empty = RAFT_SHORE_SIZE - waiting.length
  if (empty <= 0) return [...waiting]
  if (waiting.length === 0) return raftShore(rng)
  const tryWith = (first: number[]) => {
    const shore = [...waiting, ...first]
    while (shore.length < RAFT_SHORE_SIZE) shore.push(drawWeight(rng))
    return shoreOk(shore) ? shore : null
  }
  for (let draw = 0; draw < MAX_DRAWS; draw++) {
    const shore = tryWith([])
    if (shore) return shore
  }
  for (const w of waiting) {
    for (let draw = 0; draw < MAX_DRAWS; draw++) {
      const shore = tryWith([RAFT_LOAD - w])
      if (shore) return shore
    }
  }
  const newcomers = new Array<number>(empty).fill(1)
  for (;;) {
    const shore = [...waiting, ...newcomers]
    if (shoreOk(shore)) return shore
    let i = 0
    while (i < empty && newcomers[i] === 9) newcomers[i++] = 1
    if (i === empty) return shore // nothing passes: never expected
    newcomers[i]! += 1
  }
}

// ── Letter critters (§ 3.1) ───────────────────────────────────────────────

/**
 * Each CVC step's words: its canon blend words (`word.p*.blend` in
 * `public/canon/word-song/level-1/<step>.json`), sorted, minus
 * `CRITTER_LEFT_OUT`. Every one has a tuned blend clip with measured marks
 * and a pack picture.
 */
export const CRITTER_WORDS_BY_STEP: Readonly<
  Partial<Record<WordSongNode, readonly string[]>>
> = {
  'blending-cv': ['bag', 'cat', 'fan', 'hat', 'man', 'pan', 'tag', 'van'],
  'sounding-out': ['bat', 'can', 'cap', 'dad', 'fan', 'jam', 'man', 'mat'],
  'cvc-words': ['bag', 'cat', 'fan', 'hat', 'man', 'pan', 'tag', 'van'],
  'cvc-words-short-o': ['box', 'cot', 'dog', 'fox', 'hot', 'log', 'mop', 'pot'],
  'cvc-words-short-u': ['bug', 'bus', 'cup', 'jug', 'nut', 'rug', 'sun', 'tub'],
  'cvc-words-short-i': ['bib', 'bin', 'fig', 'lid', 'pig', 'pin', 'sip', 'wig'],
  'cvc-words-short-e': ['bed', 'hen', 'jet', 'leg', 'net', 'pen', 'web'],
}

/** Soft g before e is a later rule, so g always sings /g/ (D6). */
export const CRITTER_LEFT_OUT: readonly string[] = ['gem']

/**
 * The text-only list of real CVC words over the 22 critter letters (D5): a
 * run on it that is not a picture word sings and sits, never boings. No
 * clips, no pictures; nothing on it is said or shown. Pinned exactly as
 * § 3.1 prints it (C10), by vowel.
 */
export const CRITTER_REAL_WORDS: ReadonlySet<string> = new Set(
  [
    'bad bag ban bat cab can cap cat dab dad dam fad fag fan fat fax gag gap gas had hag ham has hat jab',
    'jam lab lad lag lap lax mad man map mat nab nag nap pad pal pan pat ram ran rap rat sad sag sap sat',
    'sax tab tag tan tap tax van vat wag was wax',
    'bed beg bet den fed gem get hem hen hex jet led leg let men met net peg pen pet red set sex ten vet',
    'vex web wed wet',
    'bib bid big bin bit dig dim din dip fib fig fin fit fix gig gin git hid him hip his hit jig lid lip',
    'lit mix nib nip pig pin pit rib rid rig rim rip sin sip sit six tin tip tit wig win wit',
    'bob bog box cob cod cog cop cot dog dot fog fox god got hob hog hop hot job jog jot lob log lot mob',
    'mop nod not pod pop pot rob rod rot sob son top tot won',
    'bud bug bum bun bus but cub cum cup cut dud dug fun gum gun gut hub hug hum hut jug jut lug mud mug',
    'mum nun nut pub pug pun pup pus put rub rug rum run rut sub sum sun tub tug',
  ]
    .join(' ')
    .split(' '),
)

/**
 * What a 3-letter run does: `'picture'` when it is one of the visit's
 * words (`critterSet(...).words`), `'real'` when it is only on
 * `CRITTER_REAL_WORDS`, `'funny'` otherwise. Picture words are checked
 * first, so a word on both pops once its step is reached and sits before.
 */
export function critterRun(
  run: string,
  words: readonly string[],
): 'picture' | 'real' | 'funny' {
  if (words.includes(run)) return 'picture'
  return CRITTER_REAL_WORDS.has(run) ? 'real' : 'funny'
}

/**
 * The words of every step in `CRITTER_WORDS_BY_STEP` that is current or
 * mastered for this learner, deduplicated and sorted. A step past the CVC
 * tiers adds none: its learner has them all mastered.
 */
export function critterWords(progress: Progress | null): string[] {
  if (progress === null) return []
  const words = new Set<string>()
  for (const [step, ws] of Object.entries(CRITTER_WORDS_BY_STEP)) {
    if (currentOrMastered(progress, step as WordSongNode)) {
      for (const w of ws!) words.add(w)
    }
  }
  return [...words].sort()
}

/** Most critters on the meadow at once (Decision 8). */
export const CRITTER_CAP = 16

const VOWELS: ReadonlySet<string> = new Set(['a', 'e', 'i', 'o', 'u'])

/** The meadow's order: vowels first, then consonants, each alphabetical. */
const meadowOrder = (letters: Iterable<string>) => {
  const all = [...new Set(letters)].sort()
  return [
    ...all.filter((l) => VOWELS.has(l)),
    ...all.filter((l) => !VOWELS.has(l)),
  ]
}

/**
 * This visit's letters (meadow order) and the words they spell. With 16
 * letters or fewer, all of them and all the words. Otherwise every vowel
 * the words use, then consonants word by word in `rng` order, a word added
 * only when all its letters still fit in 16; `words` is then every word
 * the chosen letters spell, so each critter can make at least one.
 */
export function critterSet(
  words: readonly string[],
  rng: () => number,
): { letters: string[]; words: string[] } {
  const used = new Set(words.join(''))
  if (used.size <= CRITTER_CAP) {
    return { letters: meadowOrder(used), words: [...words] }
  }
  const chosen = new Set([...used].filter((l) => VOWELS.has(l)))
  for (const word of shuffled(words, rng)) {
    const fresh = new Set([...word].filter((l) => !chosen.has(l)))
    if (chosen.size + fresh.size <= CRITTER_CAP) {
      for (const l of fresh) chosen.add(l)
    }
  }
  return {
    letters: meadowOrder(chosen),
    words: words.filter((w) => [...w].every((l) => chosen.has(l))),
  }
}

/** Every picture word, sorted: the sound sources' search order. */
const ALL_CRITTER_WORDS: readonly string[] = [
  ...new Set(Object.values(CRITTER_WORDS_BY_STEP).flatMap((ws) => ws!)),
].sort()

/**
 * Which clip and which of its sounds a letter sings alone (§ 3.4): a
 * consonant from the first word (alphabetically) it starts, a vowel from
 * the first word it sits in the middle of, and a letter that starts no word
 * (g, x) from the end of its first word.
 */
export const CRITTER_SOUND_SOURCE: Readonly<
  Record<string, { word: string; index: 0 | 1 | 2 }>
> = (() => {
  const out: Record<string, { word: string; index: 0 | 1 | 2 }> = {}
  const letters = meadowOrder(ALL_CRITTER_WORDS.join(''))
  for (const l of letters) {
    const at = (i: 0 | 1 | 2) => ALL_CRITTER_WORDS.find((w) => w[i] === l)
    const index: 0 | 1 | 2 = VOWELS.has(l) ? 1 : at(0) !== undefined ? 0 : 2
    out[l] = { word: at(index)!, index }
  }
  return out
})()
