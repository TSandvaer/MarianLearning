/**
 * The Play place and its two games (`design/native/play-place.md` § 1.1,
 * § 2.1, § 3.1): which games are open for a learner, the raft's shore, and
 * the letter critters' words, letters and sounds.
 *
 * A game is open when its `opensAt` step is current or mastered in that
 * step's world, the flower bed's rule (`miniGames.ts` `openGames`). Nothing
 * here is persisted: no `Progress` field, no storage key, no migration, and
 * no Leitner or history read. The games count toward nothing. The
 * critters' word hunt keeps its round, toy state only, in `critterHunt.ts`.
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
  // Word Song's first step, always current or mastered: the critters are
  // open for every learner (Thomas 2026-10-22).
  critters: { opensAt: 'letter-names' },
}

const worldOf = (node: SkillNode): MasteryTrack =>
  (MATH_TREE as readonly SkillNode[]).includes(node) ? 'math' : 'word-song'

/** `node` is mastered, or its world's current step. */
export function currentOrMastered(
  progress: Progress,
  node: SkillNode,
): boolean {
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
/**
 * Animals waiting on the shore. A trip has no crossing cap: it ends at its
 * island's party or on Back (raft-island-goal § 6, Dave 23 (C)).
 */
export const RAFT_SHORE_SIZE = 6

export type RaftWeight = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/**
 * A raft's load (raft-island-goal § 11.1): the 10 raft, and the 20 raft
 * that a full 10 island opens (Dave (3)). Phase 2 adds 100.
 */
export type RaftTarget = 10 | 20

/** The rafts, small to big. */
export const RAFT_TARGETS: readonly RaftTarget[] = [10, 20]

/** Seats on each raft's deck (§ 4.1): 3 × 2, and 4 × 2. */
export const RAFT_SEATS: Readonly<Record<RaftTarget, number>> = {
  10: 6,
  20: 8,
}

/**
 * What a shore is dealt for: the raft's target, and the kinds its island
 * still lacks (`islandMissing` in `raftIsland.ts`). The defaults are today's
 * 10 raft with nothing to bring.
 */
export interface RaftShoreOptions {
  target?: RaftTarget
  missing?: readonly number[]
}

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
 * Every set of shore positions whose weights sum to exactly `target`:
 * positions ascending within a set, the sets in lexicographic order.
 */
export function raftLoads(
  weights: readonly number[],
  target: RaftTarget = RAFT_LOAD,
): number[][] {
  const out: number[][] = []
  const walk = (from: number, picked: number[], sum: number) => {
    if (sum === target && picked.length > 0) {
      out.push([...picked])
      return
    }
    for (let i = from; i < weights.length; i++) {
      const w = weights[i]!
      if (sum + w > target) continue
      picked.push(i)
      walk(i + 1, picked, sum + w)
      picked.pop()
    }
  }
  walk(0, [], 0)
  return out
}

/** Every sum up to `cap` that a set of `waiting` makes (0 among them). */
function sumsUpTo(waiting: readonly number[], cap: number): Set<number> {
  let sums = new Set<number>([0])
  for (const w of waiting) {
    const next = new Set(sums)
    for (const s of sums) if (s + w <= cap) next.add(s + w)
    sums = next
  }
  return sums
}

/**
 * True when `total` is 1 to `target − 1` and no set of `waiting` makes
 * `target − total`.
 */
export function raftStuck(
  waiting: readonly number[],
  total: number,
  target: RaftTarget = RAFT_LOAD,
): boolean {
  if (total < 1 || total >= target) return false
  const gap = target - total
  return !sumsUpTo(waiting, gap).has(gap)
}

/**
 * The stuck newcomer's weight (Dave (3), widened; Q4): `gap − s`, in 1-9,
 * for a sum `s` the waiting animals make, so the target is reachable
 * again. `s` is 0 when the gap is 9 or less (on the 10 raft always, so
 * that is today's `10 − total`); otherwise the smallest sum from
 * `gap − 9`, so the newcomer is the biggest that closes the gap.
 * Undefined when the raft is not stuck, or when no one animal can close
 * the gap. That never happens within a crossing from a shore with a load
 * to the target: the animals aboard and waiting then weigh at least the
 * target, so adding the waiting weights one by one (each 9 or less) passes
 * through `gap − 9` to `gap − 1`.
 */
export function raftNewcomer(
  waiting: readonly number[],
  total: number,
  target: RaftTarget,
): RaftWeight | undefined {
  if (!raftStuck(waiting, total, target)) return undefined
  const gap = target - total
  if (gap <= 9) return gap as RaftWeight
  const sums = sumsUpTo(waiting, gap)
  let s: number | undefined
  for (const x of sums) if (x >= gap - 9 && (s === undefined || x < s)) s = x
  return s === undefined ? undefined : ((gap - s) as RaftWeight)
}

/**
 * Some load to 20 is four animals that pair into ten and ten (Dave (3)):
 * a learner on adding to ten can always make 20.
 */
function hasTenAndTen(shore: readonly number[]): boolean {
  return raftLoads(shore, 20).some(
    (l) =>
      l.length === 4 &&
      [1, 2, 3].some((j) => shore[l[0]!]! + shore[l[j]!]! === RAFT_LOAD),
  )
}

/**
 * The plain guarantee: at least 2 loads, at least one of them a pair (§
 * 2.1, D3); on the 20 raft at least one of them ten and ten instead.
 */
function shoreOk(
  shore: readonly number[],
  target: RaftTarget = RAFT_LOAD,
): boolean {
  const loads = raftLoads(shore, target)
  if (loads.length < 2) return false
  return target === RAFT_LOAD
    ? loads.some((l) => l.length === 2)
    : hasTenAndTen(shore)
}

/**
 * Dave (1)'s shore guarantee: while the island lacks a kind, some load
 * holds one, so every crossing can bring a new kind.
 */
function bringsMissing(
  shore: readonly number[],
  target: RaftTarget,
  missing: readonly number[],
): boolean {
  return (
    missing.length === 0 ||
    raftLoads(shore, target).some((l) =>
      l.some((i) => missing.includes(shore[i]!)),
    )
  )
}

const guaranteed = (
  shore: readonly number[],
  target: RaftTarget,
  missing: readonly number[],
) => shoreOk(shore, target) && bringsMissing(shore, target, missing)

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
 * The canon shore, for either target (it has 3 loads to 20). When none of
 * the missing kinds is on it, the smallest takes 8 + 2's place with its
 * partner to ten (Dave (1), (3)).
 */
function fallbackShore(missing: readonly number[]): number[] {
  if (missing.length === 0 || missing.some((m) => CANON_SHORE.includes(m)))
    return [...CANON_SHORE]
  const m = Math.min(...missing)
  return [...CANON_SHORE.slice(0, 4), m, RAFT_LOAD - m]
}

/**
 * A fresh shore: one bond to ten (two for the 20 raft, Dave (3)) and more
 * weights in 1-9 up to 6, accepted when it has the plain guarantee and,
 * while the island lacks a kind, a load holding one (Dave (1)); then
 * shuffled. After 50 rejected draws (never expected), the canon shore with
 * a missing kind swapped in, shuffled. With no options it deals today's
 * shores, draw for draw.
 */
export function raftShore(
  rng: () => number,
  { target = RAFT_LOAD, missing = [] }: RaftShoreOptions = {},
): number[] {
  const bonds = target === RAFT_LOAD ? 1 : 2
  for (let draw = 0; draw < MAX_DRAWS; draw++) {
    const shore: number[] = []
    for (let b = 0; b < bonds; b++) {
      const a = drawWeight(rng)
      shore.push(a, RAFT_LOAD - a)
    }
    while (shore.length < RAFT_SHORE_SIZE) shore.push(drawWeight(rng))
    if (guaranteed(shore, target, missing)) return shuffled(shore, rng)
  }
  return shuffled(fallbackShore(missing), rng)
}

/**
 * The shore after a crossing: `waiting` in its order, then the newcomers
 * that bring it back to 6 (`result.slice(waiting.length)`), with the same
 * guarantees as `raftShore`. The newcomers are drawn for the empty places
 * only. Fallback: a missing kind and its partner to ten first (Dave (1)),
 * then the complement of a waiting weight, then any weights; and last,
 * every set in order: the first with every guarantee, else the first with
 * the plain one, else the first with a load. Some waiting sets cannot have
 * every guarantee (five pigs on the 20 raft: one place, no ten and ten).
 * With no options it deals today's refills, draw for draw, except where no
 * newcomer gives the plain guarantee (waiting 5, 6, 7, 8 and 9, after a
 * stuck newcomer): today's code returned the all-9 shore, with no load;
 * this one returns the first shore with a load (9 + 1), per Dave's rule
 * (2026-10-28: "else it keeps the plain guarantee (else a load to the
 * target)").
 */
export function raftRefill(
  waiting: readonly number[],
  rng: () => number,
  { target = RAFT_LOAD, missing = [] }: RaftShoreOptions = {},
): number[] {
  const empty = RAFT_SHORE_SIZE - waiting.length
  if (empty <= 0) return [...waiting]
  if (waiting.length === 0) return raftShore(rng, { target, missing })
  const tryWith = (first: readonly number[]) => {
    const shore = [...waiting, ...first.slice(0, empty)]
    while (shore.length < RAFT_SHORE_SIZE) shore.push(drawWeight(rng))
    return guaranteed(shore, target, missing) ? shore : null
  }
  for (let draw = 0; draw < MAX_DRAWS; draw++) {
    const shore = tryWith([])
    if (shore) return shore
  }
  for (const m of missing) {
    for (let draw = 0; draw < MAX_DRAWS; draw++) {
      const shore = tryWith([m, RAFT_LOAD - m])
      if (shore) return shore
    }
  }
  for (const w of waiting) {
    for (let draw = 0; draw < MAX_DRAWS; draw++) {
      const shore = tryWith([RAFT_LOAD - w])
      if (shore) return shore
    }
  }
  const newcomers = new Array<number>(empty).fill(1)
  let plain: number[] | null = null
  let someLoad: number[] | null = null
  for (;;) {
    const shore = [...waiting, ...newcomers]
    if (guaranteed(shore, target, missing)) return shore
    if (plain === null && shoreOk(shore, target)) plain = shore
    if (someLoad === null && raftLoads(shore, target).length > 0)
      someLoad = shore
    let i = 0
    while (i < empty && newcomers[i] === 9) newcomers[i++] = 1
    if (i === empty) return plain ?? someLoad ?? shore
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
 * Every picture word, sorted: the 45 words of `CRITTER_WORDS_BY_STEP`. All
 * of them pop with their picture for every learner, whatever her steps
 * (Thomas 2026-10-22), and they are the sound sources' search order.
 */
export const CRITTER_PICTURE_WORDS: readonly string[] = [
  ...new Set(Object.values(CRITTER_WORDS_BY_STEP).flatMap((ws) => ws!)),
].sort()

/** The three picture words whose lesson praise is not "Yes! That's a <w>.". */
const CRITTER_PRAISE_OWN: Readonly<Record<string, string>> = {
  dad: 'Yes! Dad!',
  hot: 'Yes! Hot.',
  jam: 'Yes! Jam!',
}

/**
 * The four-letter targets that crab words and tent words teach (Dave
 * 2026-10-26, (B)), sorted: each has the lesson's pack picture and its
 * praise ("Yes! That's a flag."). The lessons' other words (brick, swing,
 * clock, desk) are no critter target. _crab_ has been one since the
 * pictured-only boards (Dave 2026-10-27, (A)), which keep the praise to
 * these 11 (`critters-four-letter.md` § 15.3), so it has none.
 */
export const HUNT_FOUR_LESSON_WORDS: readonly string[] = [
  'belt',
  'drum',
  'flag',
  'frog',
  'gift',
  'hand',
  'lamp',
  'nest',
  'plum',
  'pond',
  'tent',
]

/**
 * A picture word's praise (Thomas 2026-10-25, Dave's ruling): the lesson's
 * own `word.p*.correct` line for it ("Yes! That's a fan."), which Emma says
 * the first time the word is built in a visit; since the four-letter
 * rounds (F9) also the 11 `HUNT_FOUR_LESSON_WORDS`. Every one is a bundled
 * canon clip, so it costs no render. Undefined for any other run.
 */
export function critterPraise(word: string): string | undefined {
  if (
    !CRITTER_PICTURE_WORDS.includes(word) &&
    !HUNT_FOUR_LESSON_WORDS.includes(word)
  )
    return undefined
  return CRITTER_PRAISE_OWN[word] ?? `Yes! That's a ${word}.`
}

/** Every word with a praise line, sorted: the 45 and the 11 four-letter. */
export const CRITTER_PRAISE_WORDS: readonly string[] = [
  ...CRITTER_PICTURE_WORDS,
  ...HUNT_FOUR_LESSON_WORDS,
].sort()

/**
 * The real 3-letter words over the 22 critter letters (D5): the CVC words,
 * by vowel, then the other 3-letter words (Dave 2026-10-25), since the
 * screen judges any run of three. A run on it that is not a picture word
 * is never a mistake: Emma says it after the sounds (`CRITTER_SAID_WORDS`,
 * Thomas 2026-10-22), unless it is on `CRITTER_NEVER_SAY` or
 * `CRITTER_NOT_SAID`. Pinned exactly as § 3.1 prints it (C10).
 */
export const CRITTER_REAL_WORDS: ReadonlySet<string> = new Set(
  [
    'bad bag ban bar bat cab can cap car cat dab dad dam fad fag fan far fat fax gag gap gas had hag ham',
    'has hat jab jam jar jaw lab lad lag lap lax mad man map mat nab nag nan nap pad pal pan pat paw rag',
    'ram ran rap rat raw sad sag sap sat saw sax tab tag tan tap tax van vat wag was wax',
    'bed beg bet den fed few gem get hem hen her hex jet led leg let men met net new peg pen pet red set',
    'sex ten vet vex web wed wet',
    'bib bid big bin bit did dig dim din dip fib fig fin fit fix gig gin git hid him hip his hit jig lid',
    'lip lit mix nib nip pig pin pit rib rid rig rim rip sin sip sir sis sit six tin tip tit wig win wit',
    'bob bog bow box cob cod cog cop cot cow dog dot fog for fox god got hob hog hop hot how job jog jot',
    'lob log lot low mob mom mop nod not now pod pop pot rob rod rot row sob son ton top tot won wow',
    'bud bug bum bun bus but cub cum cup cut dud dug fun fur gum gun gut hub hug huh hum hut jug jut lug',
    'mud mug mum nun nut pub pug pun pup pus put rub rug rum run rut sub sum sun tub tug',
    // The other 3-letter words (Dave 2026-10-25).
    'all and are ass bee eat egg one out pee poo see she the too two wee',
    // Dave's word hunt ruling (2026-10-25, § 6): owl, and the words a
    // child knows that his dictionary sweep found tumbling. Text only.
    'owl own old arm art ash who flu act add ant elf end ill its odd off',
  ]
    .join(' ')
    .split(' '),
)

/**
 * Real words Emma never says (Dave 2026-10-22): rude words, an insult, an
 * exclamation and a weapon; and, from the other 3-letter words, the toilet
 * words _poo_, _pee_ and _wee_ and the rude _ass_ (Dave 2026-10-25). They
 * sing their sounds and sit, as before.
 */
export const CRITTER_NEVER_SAY: ReadonlySet<string> = new Set([
  'bum',
  'cum',
  'fag',
  'git',
  'sex',
  'tit',
  'dam',
  'hag',
  'god',
  'gun',
  'poo',
  'pee',
  'wee',
  'ass',
])

/**
 * Real words Emma does not say because the critters' sounds do not spell
 * them (gem, gin: g sings /g/; has, his, was: s is /z/; son, won: o is
 * /ʌ/; put: u is /ʊ/) and _rum_, an adult drink (Dave 2026-10-22). Since
 * Dave 2026-10-25 also the CVC words whose letters don't sing the word's
 * vowel (car, for, bar, far, jar, her, sir, fur; cow, how, now, wow, bow,
 * row, low; saw, paw, jaw, raw; new, few; ton; huh) and eleven of the
 * other 3-letter words (the, see, she, bee, are, all, two, one, too, out,
 * eat). They sing their sounds and sit. Since Dave's word hunt ruling
 * (2026-10-25, § 6) also eight of his 17 text-only words, _owl_ among them;
 * the other nine left with their clips (`CRITTER_SAID_LATER`, critters
 * four-letter F7).
 */
export const CRITTER_NOT_SAID: ReadonlySet<string> = new Set([
  'gem',
  'gin',
  'has',
  'his',
  'was',
  'son',
  'won',
  'put',
  'rum',
  // Dave 2026-10-25: the CVC words whose letters don't sing the vowel.
  'car',
  'for',
  'bar',
  'far',
  'jar',
  'her',
  'sir',
  'fur',
  'cow',
  'how',
  'now',
  'wow',
  'bow',
  'row',
  'low',
  'saw',
  'paw',
  'jaw',
  'raw',
  'new',
  'few',
  'ton',
  'huh',
  // Dave 2026-10-25: the other 3-letter words that sing and sit.
  'the',
  'see',
  'she',
  'bee',
  'are',
  'all',
  'two',
  'one',
  'too',
  'out',
  'eat',
  // Dave's word hunt ruling (2026-10-25, § 6): owl (o-w sings /ɒ/ /w/,
  // as cow) and seven words the sounds don't spell. No hunt round deals
  // letters that spell one (`critterHunt.ts`).
  'owl',
  'own',
  'old',
  'arm',
  'art',
  'ash',
  'who',
  'flu',
])

/**
 * The words Emma says after the critters sing them, sorted: every real word
 * that is not a picture word, not on `CRITTER_NEVER_SAY` and not on
 * `CRITTER_NOT_SAID`. Each has a whole-word Lily clip
 * (`critterWordLine(word)` in `emmasPath/guidanceLines.ts`); the 33 on
 * `CRITTER_SAID_PICTURE_WORDS` also have a pack picture.
 */
export const CRITTER_SAID_WORDS: readonly string[] = [...CRITTER_REAL_WORDS]
  .filter(
    (w) =>
      !CRITTER_PICTURE_WORDS.includes(w) &&
      !CRITTER_NEVER_SAY.has(w) &&
      !CRITTER_NOT_SAID.has(w),
  )
  .sort()

/**
 * The said words with a bundled pack picture, sorted: after Emma says one,
 * its picture pops, holds and leaves as a picture word's does (Thomas
 * 2026-10-23, build 20: "No picture for 'rat'"). The probe reserve's
 * pictured said words (cab, ham, pad, ram) pop by the same rule (Thomas
 * 2026-10-24), and so do _mom_ (Word Song teaches it), _rag_ and _egg_
 * (Dave 2026-10-25); and, for the word hunt (Dave's ruling of
 * 2026-10-25, § 6), _mum_ with mom's picture and the new pack pictures
 * _mug_, _sad_, _mud_ and _hug_ (batch 19, Thomas's picks 2026-10-25);
 * and _ant_ and _elf_ (critters four-letter F7, pictures in #709); and
 * the pictured-only boards' eight (Dave 2026-10-27, (A); pictures in
 * #714): _dot peg red rod run six ten tug_; and the digraph critters'
 * _fog_ and _dig_ (Dave's digraph-critter ruling of 2026-10-27, (E);
 * pictures in #719). Pinned here, since core never reads the app's
 * registry; `playPlace.test.ts` checks them against it.
 */
export const CRITTER_SAID_PICTURE_WORDS: readonly string[] = [
  'ant',
  'bun',
  'cab',
  'dig',
  'dot',
  'egg',
  'elf',
  'fog',
  'gum',
  'ham',
  'hug',
  'hut',
  'map',
  'mom',
  'mud',
  'mug',
  'mum',
  'nap',
  'pad',
  'peg',
  'pop',
  'rag',
  'ram',
  'rat',
  'red',
  'rod',
  'run',
  'sad',
  'six',
  'tap',
  'ten',
  'top',
  'tug',
]

/**
 * The four-letter words: Dave's 82 CCVC and CVCC words (his ruling of
 * 2026-10-26, (B), "The targets, exact"; `design/native/critters-four-letter.md`
 * § 1), by vowel (a 18, o 15, i 7, u 19, e 23), and the pictured-only
 * boards' 15 (Dave 2026-10-27, (A); clips in #714): the 14 voiceless
 * plurals of pack words and _crab_. 97. Each has a whole-word Lily clip
 * (`critterWordLine(word)`). A four-letter round
 * (`huntRounds(vowel, { length: 4 })`) has the pictured ones it spells as
 * targets and the rest as extras (`critters-four-letter.md` § 15.2); a run
 * of four that spells one is `'word'` (F8).
 */
export const HUNT_FOUR_TARGETS: ReadonlySet<string> = new Set(
  [
    'flag hand lamp clap flap slap snap drag glad flat plan swam camp damp ramp band land sand',
    'frog pond stop spot plot drop crop flop plop prop trot blob cost soft from',
    'gift drip grip trip flip clip lift',
    'drum plum club plug slug spun stun jump bump dump lump pump dust must rust just hunt gulp bulb',
    'tent nest belt bend lend went sent rent bent dent best rest test vest west felt melt left step stem sled next text',
    'ants bats caps cats crab hats maps mats rats taps cots mops pots tops jets',
  ]
    .join(' ')
    .split(' '),
)

/**
 * The nine 3-letter words the four-letter phase gave a clip (Dave
 * 2026-10-26, (B), "New audio"). Since the four-letter core (F7) they are
 * said words: act, add, end, ill, its, odd and off are `HUNT_FAMILIAR`
 * targets, and ant and elf have pack pictures.
 */
export const CRITTER_SAID_LATER: readonly string[] = [
  'act',
  'add',
  'ant',
  'elf',
  'end',
  'ill',
  'its',
  'odd',
  'off',
]

/**
 * The 13 digraph-critter words that get a clip (Dave 2026-10-27, digraph
 * critters (C) and (D), "New Lily lines"): the three-seat targets ship
 * fish shed shop chip moth ring wing sing, the four-seat target chest and
 * the extras shin shot wish. Content only so far: none is dealt or said
 * (a run that spells one is not `'word'`) until the digraph core wires
 * them.
 */
export const HUNT_DIGRAPH_LATER: readonly string[] = [
  'chest',
  'chip',
  'fish',
  'moth',
  'ring',
  'shed',
  'shin',
  'ship',
  'shop',
  'shot',
  'sing',
  'wing',
  'wish',
]

/**
 * The digraph critters' sound sources (Dave 2026-10-27, digraph critters
 * (A), "Its sound"): one Lily blend clip per digraph, in the 4-segment
 * blend format, its marks exported with every blend's (`BLEND_MARKS`). No
 * lesson plays them; a critter sings the digraph's own window: sh, ch and
 * th the first sound, ng the third (no English word starts with ng). Not
 * in `CRITTER_SOUND_SOURCE` yet: the digraph core adds them.
 */
export const CRITTER_DIGRAPH_BLENDS: Readonly<Record<string, string>> = {
  sh: 'sh - i - p ... ship',
  ch: 'ch - i - p ... chip',
  th: 'th - i - n ... thin',
  ng: 'r - i - ng ... ring',
}

/**
 * Every word with a whole-word Lily clip, sorted: the said words (the nine
 * said later among them), the four-letter targets and the 13 digraph words
 * for later (`critterWordLine(word)`).
 */
export const CRITTER_CLIP_WORDS: readonly string[] = [
  ...new Set([
    ...CRITTER_SAID_WORDS,
    ...HUNT_FOUR_TARGETS,
    ...HUNT_DIGRAPH_LATER,
  ]),
].sort()

/** A word whose pack picture is another word's (Dave 2026-10-25, § 6). */
const CRITTER_PICTURE_ALIAS: Readonly<Record<string, string>> = { mum: 'mom' }

/** The pack picture key a critter word shows (`mum` shows `mom`). */
export const critterPictureKey = (word: string): string =>
  CRITTER_PICTURE_ALIAS[word] ?? word

/**
 * The four-letter words with a bundled pack picture, sorted: the 11
 * lesson words and the 14 of #709 (Dave 2026-10-26, (B), the starred
 * words), and the pictured-only boards' 16 (Dave 2026-10-27, (A);
 * `critters-four-letter.md` § 15.2, Q33): _step_ and the 14 plurals
 * (#714) and _crab_ (bundled before). 41. Pinned here, since core never
 * reads the app's registry; `playPlace.test.ts` checks them against it.
 */
export const HUNT_FOUR_PICTURE_WORDS: readonly string[] = [
  'ants',
  'bats',
  'belt',
  'bulb',
  'caps',
  'cats',
  'clap',
  'clip',
  'cots',
  'crab',
  'drip',
  'drop',
  'drum',
  'flag',
  'frog',
  'gift',
  'hand',
  'hats',
  'jets',
  'jump',
  'lamp',
  'maps',
  'mats',
  'mops',
  'nest',
  'plug',
  'plum',
  'pond',
  'pots',
  'pump',
  'ramp',
  'rats',
  'sand',
  'sled',
  'slug',
  'step',
  'stop',
  'taps',
  'tent',
  'tops',
  'vest',
]

/**
 * A picture word, a said word with a bundled pack picture, or a pictured
 * four-letter target.
 */
export const critterHasPicture = (word: string): boolean =>
  CRITTER_PICTURE_WORDS.includes(word) ||
  CRITTER_SAID_PICTURE_WORDS.includes(word) ||
  HUNT_FOUR_PICTURE_WORDS.includes(word)

/**
 * What a 3-letter run does: `'picture'` pops its clip and picture, `'word'`
 * sings its sounds and Emma says it (`CRITTER_SAID_WORDS`), `'quiet'` sings
 * and sits (a real word on `CRITTER_NEVER_SAY` or `CRITTER_NOT_SAID`), and
 * `'funny'` (not a word) boings and tumbles. With `funny: false` a non-word
 * is `'quiet'` too (`critterFunnyOpen`). A run of four (critters
 * four-letter F8) is `'word'` for a `HUNT_FOUR_TARGETS` word and `'quiet'`
 * for anything else: no four-letter word has a blend clip, and nothing
 * judges a four-letter miss.
 */
export type CritterRun = 'picture' | 'word' | 'quiet' | 'funny'

/** The step from which a non-word boings (Dave's safeguard, Thomas 2026-10-22). */
export const CRITTER_FUNNY_FROM: WordSongNode = 'blending-cv'

/**
 * Whether a non-word is `'funny'` for this learner: blending sounds is
 * current or mastered. Before it, joining sounds is not taught yet, so a
 * non-word sings and sits (Dave's safeguard, Thomas 2026-10-22). `null`
 * gives `false`.
 */
export function critterFunnyOpen(progress: Progress | null): boolean {
  return progress !== null && currentOrMastered(progress, CRITTER_FUNNY_FROM)
}

export function critterRun(
  run: string,
  { funny = true }: { funny?: boolean } = {},
): CritterRun {
  if (run.length === 4) return HUNT_FOUR_TARGETS.has(run) ? 'word' : 'quiet'
  if (CRITTER_PICTURE_WORDS.includes(run)) return 'picture'
  if (!CRITTER_REAL_WORDS.has(run)) return funny ? 'funny' : 'quiet'
  return CRITTER_NEVER_SAY.has(run) || CRITTER_NOT_SAID.has(run)
    ? 'quiet'
    : 'word'
}

/**
 * Most critters on a phone's meadow at once (Decision 8). A tablet where
 * every letter fits shows them all (Thomas 2026-10-23, build 20).
 */
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
 * This visit's letters (meadow order) and the words they spell. With `cap`
 * letters or fewer (default `CRITTER_CAP`; `Infinity`, no cap, on a tablet
 * where every letter fits), all of them and all the words. Otherwise every
 * vowel the words use, then consonants word by word in `rng` order, a word
 * added only when all its letters still fit in `cap`; `words` is then every
 * word the chosen letters spell, so each critter can make at least one.
 */
export function critterSet(
  words: readonly string[],
  rng: () => number,
  { cap = CRITTER_CAP }: { cap?: number } = {},
): { letters: string[]; words: string[] } {
  const used = new Set(words.join(''))
  if (used.size <= cap) {
    return { letters: meadowOrder(used), words: [...words] }
  }
  const chosen = new Set([...used].filter((l) => VOWELS.has(l)))
  for (const word of shuffled(words, rng)) {
    const fresh = new Set([...word].filter((l) => !chosen.has(l)))
    if (chosen.size + fresh.size <= cap) {
      for (const l of fresh) chosen.add(l)
    }
  }
  return {
    letters: meadowOrder(chosen),
    words: words.filter((w) => [...w].every((l) => chosen.has(l))),
  }
}

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
  const letters = meadowOrder(CRITTER_PICTURE_WORDS.join(''))
  for (const l of letters) {
    const at = (i: 0 | 1 | 2) => CRITTER_PICTURE_WORDS.find((w) => w[i] === l)
    const index: 0 | 1 | 2 = VOWELS.has(l) ? 1 : at(0) !== undefined ? 0 : 2
    out[l] = { word: at(index)!, index }
  }
  return out
})()
