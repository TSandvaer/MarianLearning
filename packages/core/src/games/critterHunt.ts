/**
 * Letter critters' word hunt: three-letter rounds
 * (`design/native/critters-word-hunt.md` § 1; the rules are Dave's ruling
 * of 2026-10-25, `design/research/critters-word-hunt-2026-10-25.md`, cited
 * as "Dave (n)"), and four-letter rounds (`design/native/critters-four-letter.md`
 * § 1; Dave's ruling of 2026-10-26, (B), cited as "Dave 23 (B)"). Since
 * the pictured-only boards (Dave's ruling of 2026-10-27, (A),
 * `design/research/critters-pictured-boards-2026-10-27.md`, "Dave 27";
 * `critters-word-hunt.md` § 16, `critters-four-letter.md` § 15), every
 * target has a picture.
 *
 * Once blending sounds is current or mastered (`critterFunnyOpen`, the same
 * gate), the free meadow gives way to rounds: 6 critters (one of her taught
 * short vowels, then 5 consonants), the 4-8 words they spell that have a
 * picture (the targets), and the other said words (the extras, at most 3).
 * A round is complete at all but one target, Thomas's 95 % rounded down.
 *
 * Four-letter rounds open at her first complete three-letter round: 7
 * critters (the vowel, then 6 consonants), the 4-6 pictured
 * `HUNT_FOUR_TARGETS` words they spell, the rest as extras (at most 3),
 * at most one decoy consonant.
 *
 * Digraph rounds (`design/native/critters-digraph.md` § 11.1, D1-D13;
 * Dave's digraph ruling of 2026-10-27, (A)-(C),
 * `design/research/critters-digraph-2026-10-28.md`, "Dave D"): once a
 * digraph's Word Song step is current or mastered (`huntDigraphs`), a
 * round may hold one digraph critter ("sh"), one entry of its letters,
 * which fills one seat and one box. Everything counts critters, never
 * characters: spelling, the decoy, the run (sh-i-p is three critters).
 *
 * Its record, per learner, is the round in play of each length (Dave (7)):
 * its letters, targets, extras and the words found in find order, and the
 * lengths she has open. Toy state
 * only: no `Progress` field, mastery, Leitner, stardust, history, streak
 * or cloud sync. The key is one of the learner's own keys
 * (`learners/keys.ts`), so each learner keeps her own round.
 */
import { getKeyValueStore } from '../platform/keyValueStore'
import { currentStepOf } from '../hub/hubCardModel'
import type { Progress, WordSongNode } from '../progress/types'
import { PROBE_RESERVE_WORDS } from '../wordSong/novelProbeWords'
import {
  CRITTER_NOT_SAID,
  CRITTER_PICTURE_WORDS,
  CRITTER_REAL_WORDS,
  CRITTER_SAID_WORDS,
  critterHasPicture,
  currentOrMastered,
  HUNT_DIGRAPH_LATER,
  HUNT_DIGRAPH_QUIET,
  HUNT_DIGRAPHS,
  HUNT_FOUR_TARGETS,
  type HuntDigraph,
  type HuntUnit,
} from './playPlace'

/** A round's word length: three letters, or four (critters four-letter § 1). */
export type HuntLength = 3 | 4

/** The default length: the three-letter round every learner starts on. */
export const HUNT_LENGTH = 3
/** Critters in a round: 1 vowel + 5 consonants (Dave (1)). */
export const HUNT_CONSONANTS = 5
/** Targets per round (N 4-8 since Dave 27 (A)), and extras. */
export const HUNT_MIN_TARGETS = 4
export const HUNT_MAX_TARGETS = 8
export const HUNT_MAX_EXTRAS = 3

/**
 * Dave's pinned familiar words (Dave (1)): words a 6-9 learner knows that
 * the critters spell, beyond the picture words and the said words with a
 * picture. Exactly as Dave (1) prints them, 68; and since the four-letter
 * phase gave them clips, _act add end ill its odd off_ (Dave 23 (B), "New
 * audio"; critters four-letter F7), 75. Since Dave 27 (A) they are targets
 * only with a picture (_six ten red run tug_ and the like); the rest are
 * extras, as any said word without one.
 */
export const HUNT_FAMILIAR: ReadonlySet<string> = new Set(
  [
    'bad fat had lap mad pat ran sad sat wag wax and',
    'get let men met pet red set ten wet fed vet',
    'big bit did dig dip fin fit fix hid him hip hit lip lit mix pit rip sit six tin tip win',
    'dot fog got hop hog job jog lot nod not',
    'but cut dug fun hug hum mud mug mum pup rub run tug',
    'act add end ill its odd off',
  ]
    .join(' ')
    .split(' '),
)

/**
 * Dave's 18 rude four-letter words (Dave 23 (B)), as he prints them, and
 * _clit_ (Dave 27 (A): the old short-i fallback spelled it): no
 * four-letter round deals letters that spell one.
 */
export const HUNT_RUDE_FOUR: ReadonlySet<string> = new Set(
  'cunt shit piss twat slut crap turd damn hell butt slag prat bums tits cums fags gits guns clit'.split(
    ' ',
  ),
)

/**
 * Four-letter words a 6-9 learner knows that have no clip (Dave's Q21
 * answer, 2026-10-26): no four-letter round deals letters that spell one,
 * since it would sing and sit on a board with no slot for it. Dave (8)'s
 * words that no round dealt by his other rules, 25; _crab_ left it when
 * #714 gave it a clip and Dave 27 (A) made it a target, 24.
 */
export const HUNT_FOUR_UNDEALT: ReadonlySet<string> = new Set(
  'trap grab slot lost slip snip spin twin grin swim crib list mist fist mint hint limp film snug stub mend send help held'.split(
    ' ',
  ),
)

/**
 * The four-critter digraph words that reject a four-letter round (Dave
 * D (C)): his rude words (shits shags bitch) and the 22 a 6-9 learner
 * knows that have no clip. 25. Any other four-critter digraph run sits.
 */
export const HUNT_DIGRAPH_FOUR_REJECTS: ReadonlySet<string> = new Set(
  'shits shags bitch bench shelf brush ships chips swing crash flash smash trash fresh crush lunch punch bunch munch pinch chimp sting bring stung swung'.split(
    ' ',
  ),
)

/**
 * Each short vowel and the step that teaches it (Dave (1)): _a_ from
 * blending sounds, then _o_, _u_, _i_, _e_ from their CVC steps.
 */
const VOWEL_STEPS: readonly (readonly [string, WordSongNode])[] = [
  ['a', 'blending-cv'],
  ['o', 'cvc-words-short-o'],
  ['u', 'cvc-words-short-u'],
  ['i', 'cvc-words-short-i'],
  ['e', 'cvc-words-short-e'],
]

/**
 * Her taught short vowels, in teaching order: each once its step is
 * current or mastered. `[]` for `null` and before blending sounds.
 */
export function huntVowels(progress: Progress | null): string[] {
  if (progress === null) return []
  return VOWEL_STEPS.filter(([, step]) =>
    currentOrMastered(progress, step),
  ).map(([v]) => v)
}

/**
 * Each digraph critter and the step that teaches it (Dave D (B),
 * "Opening"): sh, ch and th from their own steps, ng from duck words.
 */
const DIGRAPH_STEPS: readonly (readonly [HuntDigraph, WordSongNode])[] = [
  ['sh', 'digraphs-sh'],
  ['ch', 'digraphs-ch'],
  ['th', 'digraphs-th-voiceless'],
  ['ng', 'duck-words'],
]

/**
 * Her open digraph critters, in teaching order (D7): each once its step
 * is current or mastered. `[]` for `null` and before digraphs-sh.
 */
export function huntDigraphs(progress: Progress | null): HuntDigraph[] {
  if (progress === null) return []
  return DIGRAPH_STEPS.filter(([, step]) =>
    currentOrMastered(progress, step),
  ).map(([g]) => g)
}

/**
 * The probe guard (Dave (1)): while cvc-words is her current step and not
 * mastered, no round spells a probe-reserve word, so the hunt does not use
 * up the check's fresh words.
 */
export function huntProbeGuard(progress: Progress | null): boolean {
  return (
    progress !== null &&
    progress.skillLevels['cvc-words'] !== 'mastered' &&
    currentStepOf(progress, 'word-song') === 'cvc-words'
  )
}

/** A dealt round: the meadow's letters and the words they spell. */
export interface HuntRound {
  /**
   * Its critters: the vowel, then the 5 consonants (6 for four letters)
   * a-z. A digraph round has the vowel, the digraph, then 4 (5) single
   * consonants a-z (Q41: Dave D (C)'s fallbacks print it so, and the
   * meadow draws it so).
   */
  letters: HuntUnit[]
  /** The words to find, a-z, each with a picture: 4-8 of them (4-6 for four letters). */
  targets: string[]
  /** The other said words they spell, a-z: 0-3, never required. */
  extras: string[]
}

/**
 * Each length's deal rules: Dave (1) for three, Dave 23 (B) for four, as
 * Dave 27 (A) amends both.
 */
const RULES: Readonly<
  Record<
    HuntLength,
    {
      consonants: number
      minTargets: number
      maxTargets: number
      /** Consonants in no target (a decoy's twin pops as usual). */
      maxDecoys: number
    }
  >
> = {
  3: {
    consonants: HUNT_CONSONANTS,
    minTargets: HUNT_MIN_TARGETS,
    maxTargets: HUNT_MAX_TARGETS,
    maxDecoys: 1,
  },
  4: {
    consonants: 6,
    minTargets: 4,
    maxTargets: 6,
    maxDecoys: 1,
  },
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])
/** The 17 consonants among the 22 critter letters. */
const CONSONANTS = [...'bcdfghjlmnprstvwx']

const isDigraph = (u: string): u is HuntDigraph =>
  (HUNT_DIGRAPHS as readonly string[]).includes(u)

/**
 * `word`'s critters among `letters`, in order (D2): a digraph critter
 * where the round has its two letters as one, else one critter a letter.
 * ship on i sh b c n p is sh i p. `null` when the round's critters do not
 * make it. By the pair rule (D5) a word a round spells has one split.
 */
export function huntUnits(
  word: string,
  letters: readonly HuntUnit[],
): HuntUnit[] | null {
  const from = (at: number): HuntUnit[] | null => {
    if (at === word.length) return []
    const pair = word.slice(at, at + 2)
    for (const unit of pair.length === 2 ? [pair, word[at]!] : [pair]) {
      if (!letters.includes(unit)) continue
      const rest = from(at + unit.length)
      if (rest !== null) return [unit, ...rest]
    }
    return null
  }
  return from(0)
}

/** A digraph-list word's critters, its digraph as one (wish: w i sh). */
const digraphCritters = (word: string): HuntUnit[] =>
  huntUnits(word, [...HUNT_DIGRAPHS, ...word])!

/** Each word a round could build, with its distinct critters. */
type Buildable = readonly (readonly [string, readonly HuntUnit[]])[]

/**
 * The words of `words` a round could ever build, each with its critters
 * (`critters`, one a letter by default): a vowel at most once (it has no
 * twin) and a consonant critter at most twice (its twin, so dad, mom,
 * pump and test work). A word on it is spellable when every critter is in
 * the round (D4).
 */
const buildable = (
  words: Iterable<string>,
  critters: (word: string) => readonly HuntUnit[] = (w) => [...w],
): Buildable =>
  [...words]
    .map((w) => [w, critters(w)] as const)
    .filter(([, cs]) =>
      cs.every(
        (c) => cs.filter((x) => x === c).length <= (VOWELS.has(c) ? 1 : 2),
      ),
    )
    .map(([w, cs]) => [w, [...new Set(cs)]] as const)

/** The real three-letter words a round could ever build. */
const BUILDABLE = buildable(
  [...CRITTER_REAL_WORDS].filter((w) => w.length === HUNT_LENGTH),
)
/** The digraph words of `n` critters (Dave D (C)). */
const digraphWords = (n: number) =>
  HUNT_DIGRAPH_LATER.filter((w) => digraphCritters(w).length === n)
/** The three-critter digraph words said, and those that reject a round. */
const BUILDABLE_DIGRAPH = buildable(digraphWords(3), digraphCritters)
const REJECTS_DIGRAPH = buildable(HUNT_DIGRAPH_QUIET, digraphCritters)
/** The four-letter targets and chest, and the words that reject a four-letter round. */
const BUILDABLE_FOUR = [
  ...buildable(HUNT_FOUR_TARGETS),
  ...buildable(digraphWords(4), digraphCritters),
]
const REJECTS_FOUR = [
  ...buildable([...HUNT_RUDE_FOUR, ...HUNT_FOUR_UNDEALT]),
  ...buildable(HUNT_DIGRAPH_FOUR_REJECTS, digraphCritters),
]

const spelled = (words: Buildable, set: ReadonlySet<string>): Buildable =>
  words.filter(([, cs]) => cs.every((c) => set.has(c)))

/**
 * The round `letters` deal (vowel first), or `null` when the rules reject
 * it. Three letters (Dave (1), Dave 27 (A); B1): no quiet word spellable;
 * the targets are the words spelled with a bundled picture, 4-8; the
 * extras the other said words spelled, at most 3; at most one consonant in
 * no target; and, with `probeGuard`, no probe-reserve word spellable. Four
 * letters (Dave 23 (B), Dave 27 (A); F23): no `HUNT_RUDE_FOUR` or
 * `HUNT_FOUR_UNDEALT` word spellable; the targets are the
 * `HUNT_FOUR_TARGETS` words spelled with a bundled picture, 4-6; the
 * extras the rest, at most 3; at most one consonant in no target. The
 * probe guard is a three-letter rule (its words are three letters).
 *
 * A digraph round (D1-D10, Dave D (B)) is spelled and judged by critters
 * (`buildable`): exactly one digraph critter, never with both its letters
 * as singles (the pair rule); no `HUNT_DIGRAPH_QUIET` word spellable
 * (three seats) or `HUNT_DIGRAPH_FOUR_REJECTS` word (four); its
 * `HUNT_DIGRAPH_LATER` words of that many critters join the plain ones,
 * pictured as targets and the rest as extras; a consonant critter is a
 * decoy when no target's critters hold it (s beside sh, though ship holds
 * the letter); and at least one target uses the digraph.
 */
export function huntRoundOf(
  letters: readonly string[],
  {
    probeGuard = false,
    length = HUNT_LENGTH,
  }: { probeGuard?: boolean; length?: HuntLength } = {},
): HuntRound | null {
  const set = new Set(letters)
  const digraphs = letters.filter(isDigraph)
  if (digraphs.length > 1) return null
  const digraph = digraphs[0]
  if (digraph !== undefined && [...digraph].every((ch) => set.has(ch)))
    return null
  let said: Buildable
  if (length === 4) {
    if (spelled(REJECTS_FOUR, set).length > 0) return null
    said = spelled(BUILDABLE_FOUR, set)
  } else {
    const all = spelled(BUILDABLE, set)
    if (all.some(([w]) => CRITTER_NOT_SAID.has(w))) return null
    if (spelled(REJECTS_DIGRAPH, set).length > 0) return null
    if (probeGuard && all.some(([w]) => PROBE_RESERVE_WORDS.includes(w))) {
      return null
    }
    said = [
      ...all.filter(
        ([w]) => critterHasPicture(w) || CRITTER_SAID_WORDS.includes(w),
      ),
      ...spelled(BUILDABLE_DIGRAPH, set),
    ]
  }
  const critters = new Map(said)
  const words = [...critters.keys()]
  const targets = words.filter(critterHasPicture).sort()
  const extras = words.filter((w) => !critterHasPicture(w)).sort()
  if (extras.length > HUNT_MAX_EXTRAS) return null
  const rules = RULES[length]
  if (targets.length < rules.minTargets || targets.length > rules.maxTargets)
    return null
  const used = (c: HuntUnit) =>
    targets.some((w) => critters.get(w)!.includes(c))
  const decoys = letters.filter((l) => !VOWELS.has(l) && !used(l))
  if (decoys.length > rules.maxDecoys) return null
  if (digraph !== undefined && !used(digraph)) return null
  return { letters: [...letters], targets, extras }
}

/** Every `k` of `pool`, in order. */
function* choose(
  pool: readonly string[],
  k: number,
  from = 0,
  picked: string[] = [],
): Generator<string[]> {
  if (picked.length === k) {
    yield [...picked]
    return
  }
  for (let i = from; i < pool.length; i++) {
    picked.push(pool[i]!)
    yield* choose(pool, k, i + 1, picked)
    picked.pop()
  }
}

const ROUNDS = new Map<string, readonly HuntRound[]>()

/**
 * Every round `vowel` deals, by its consonants in lexicographic order.
 * Three letters: 491 in all (a 182, o 92, u 127, i 8, e 82), Dave 27
 * (A)'s count with #714's eight pictures (B2) and _fog_ and _dig_ (Dave 27
 * (E), pictures in #719: o +16, i +2). Four letters (`length: 4`):
 * 196 (a 110, o 29, u 38, i 0, e 19; F25). With `digraph`, the rounds
 * that hold that digraph critter and single consonants a-z (D11, Dave
 * D (C)): three seats 122 (sh o 28, i 23, e 15; ch i 10; th o 22; ng i
 * 24), four seats 22 (ch e); every other pair 0. Computed once per vowel,
 * guard, length and digraph.
 */
export function huntRounds(
  vowel: string,
  {
    probeGuard = false,
    length = HUNT_LENGTH,
    digraph,
  }: { probeGuard?: boolean; length?: HuntLength; digraph?: HuntDigraph } = {},
): readonly HuntRound[] {
  const guard = probeGuard && length === 3
  const key = `${vowel}|${guard}|${length}|${digraph ?? ''}`
  const known = ROUNDS.get(key)
  if (known !== undefined) return known
  const out: HuntRound[] = []
  const lead = digraph === undefined ? [vowel] : [vowel, digraph]
  const singles = RULES[length].consonants + 1 - lead.length
  for (const cs of choose(CONSONANTS, singles)) {
    const round = huntRoundOf([...lead, ...cs], { probeGuard: guard, length })
    if (round !== null) out.push(round)
  }
  ROUNDS.set(key, out)
  return out
}

/**
 * Dave's pinned fallback rounds, one per vowel (Dave 27 (A), the first
 * round per vowel in his port; never expected: each vowel deals at least 6
 * rounds). They deal bag bat hat tag, box fox mom mop pop, bug gum jug mug
 * mum, bib fig pig wig and bed egg elf leg; the short-a one passes the
 * probe guard. `critterHunt.test.ts` checks every one.
 */
export const HUNT_FALLBACK: Readonly<Record<string, readonly string[]>> = {
  a: ['a', 'b', 'f', 'g', 'h', 't'],
  e: ['e', 'b', 'd', 'f', 'g', 'l'],
  i: ['i', 'b', 'f', 'g', 'p', 'w'],
  o: ['o', 'b', 'f', 'm', 'p', 'x'],
  u: ['u', 'b', 'c', 'g', 'j', 'm'],
}

/**
 * Dave's pinned four-letter fallbacks (Dave 27 (A); `critters-four-letter.md`
 * § 15.2). They deal ants bats cats sand, cots mops pots stop tops, bulb
 * jump plum pump and jets nest step tent. No i entry (Q36): short i deals
 * no four-letter round, so the deal skips it, and a missing entry falls
 * back to a's. `critterHunt.test.ts` checks every one.
 */
export const HUNT_FOUR_FALLBACK: Readonly<Record<string, readonly string[]>> = {
  a: ['a', 'b', 'c', 'd', 'n', 's', 't'],
  e: ['e', 'c', 'j', 'n', 'p', 's', 't'],
  o: ['o', 'b', 'c', 'm', 'p', 's', 't'],
  u: ['u', 'b', 'c', 'j', 'l', 'm', 'p'],
}

/**
 * Dave's pinned digraph fallbacks (Dave D (C), "Kevin pins them"): the
 * first round of each pair that deals, by digraph and vowel. They deal box
 * fox pop shop, bib bin pin ship, bed egg leg shed, bib chip fig pig, cot
 * dot mom moth and bib fig wig wing (three seats), and chest jets nest
 * tent (four). The deal never needs them: a pair is picked only with a
 * round to deal, and each that deals has at least 10.
 * `critterHuntDigraph.test.ts` checks every one.
 */
export const HUNT_DIGRAPH_FALLBACK: Readonly<
  Partial<Record<HuntDigraph, Readonly<Record<string, readonly HuntUnit[]>>>>
> = {
  sh: {
    o: ['o', 'sh', 'b', 'f', 'p', 'x'],
    i: ['i', 'sh', 'b', 'c', 'n', 'p'],
    e: ['e', 'sh', 'b', 'd', 'g', 'l'],
  },
  ch: { i: ['i', 'ch', 'b', 'f', 'g', 'p'] },
  th: { o: ['o', 'th', 'c', 'd', 'm', 't'] },
  ng: { i: ['i', 'ng', 'b', 'f', 'g', 'w'] },
}

/** The four-seat digraph fallback (Dave D (C)): ch-e, the only pair. */
export const HUNT_DIGRAPH_FOUR_FALLBACK: Readonly<
  Partial<Record<HuntDigraph, Readonly<Record<string, readonly HuntUnit[]>>>>
> = {
  ch: { e: ['e', 'ch', 'c', 'j', 'n', 's', 't'] },
}

const sameLetters = (a: readonly string[], b: readonly string[] | undefined) =>
  b !== undefined && a.length === b.length && a.every((l, i) => l === b[i])

/**
 * A fresh round (Dave (1)): one of her vowels, then one of that vowel's
 * rounds of `length` letters, each by `rng`; never the same letters as
 * `last`. Only her vowels with such a round are picked (Dave 27 (A), B6:
 * short i deals no four-letter round); the fallback deals only when none
 * has one. With `probeGuard` (three letters only), only rounds that spell
 * no probe-reserve word. Picking uniformly among the rounds that pass is
 * draw-and-accept over the consonant sets, with the draws done once. No
 * vowels: _a_. The same `rng` gives the same round.
 *
 * With her open `digraphs` (`huntDigraphs`; D8, Dave D (B), "The deal"):
 * first one of plain and each open digraph with such a round for one of
 * her vowels, uniformly; then her vowel and the round as above, among that
 * pick's. With only plain to pick (no digraph open, or none dealing at
 * this length) nothing is drawn for it, so the deal is draw for draw the
 * one without digraphs.
 */
export function huntDeal(
  vowels: readonly string[],
  rng: () => number,
  {
    last,
    probeGuard = false,
    length = HUNT_LENGTH,
    digraphs = [],
  }: {
    last?: readonly string[]
    probeGuard?: boolean
    length?: HuntLength
    digraphs?: readonly HuntDigraph[]
  } = {},
): HuntRound {
  const own = vowels.length > 0 ? vowels : ['a']
  const fresh = (v: string, digraph?: HuntDigraph) =>
    huntRounds(v, { probeGuard, length, digraph }).filter(
      (r) => !sameLetters(r.letters, last),
    )
  const picks = [undefined, ...digraphs].filter((g) =>
    own.some((v) => fresh(v, g).length > 0),
  )
  if (picks.length > 0) {
    const pick =
      picks.length === 1 ? picks[0] : picks[Math.floor(rng() * picks.length)]
    const dealing = own.filter((v) => fresh(v, pick).length > 0)
    const rounds = fresh(dealing[Math.floor(rng() * dealing.length)]!, pick)
    return rounds[Math.floor(rng() * rounds.length)]!
  }
  const vowel = own[Math.floor(rng() * own.length)]!
  const fallback = length === 4 ? HUNT_FOUR_FALLBACK : HUNT_FALLBACK
  return huntRoundOf(fallback[vowel] ?? fallback.a!, { length })!
}

const foundTargets = (round: HuntRound, found: readonly string[]) =>
  round.targets.filter((w) => found.includes(w))

/**
 * True once `floor(0.95 × N)` targets are found: N − 1 for N 4-8 (Dave
 * (1), Thomas's 95 %; Dave 23 (B)). Extras never count.
 */
export function huntComplete(
  round: HuntRound,
  found: readonly string[],
): boolean {
  const need = Math.floor(0.95 * round.targets.length)
  return foundTargets(round, found).length >= need
}

/**
 * The board's three bands (§ 15.2): 0 easiest. Since Dave 27 (A) no dealt
 * round has a third-band target; a round stored before it keeps its own
 * (Q30).
 */
const boardBand = (word: string): number =>
  CRITTER_PICTURE_WORDS.includes(word) ? 0 : critterHasPicture(word) ? 1 : 2

/**
 * The targets in board order (`critters-word-hunt.md` § 15.2, Dave 23
 * (A).1): picture words (each has a blend clip) a-z, then the other
 * targets with a picture a-z, then the targets with no picture a-z (only
 * in a round stored before Dave 27 (A), Q30). A four-letter round has no
 * picture word, so it is its targets a-z (critters four-letter F27). Slot
 * i holds word i from the deal. Derived, never stored: the record keeps
 * `found` in find order, so a round dealt before the board order reopens
 * with every find in its own slot (Q17).
 */
export function huntBoardOrder(round: HuntRound): string[] {
  return [...round.targets].sort(
    (x, y) => boardBand(x) - boardBand(y) || (x < y ? -1 : x > y ? 1 : 0),
  )
}

/**
 * The word a hint plays: the first empty slot's word, i.e. the first
 * unfound target in board order (§ 15.2). `undefined` when every target
 * is found.
 */
export function huntHintTarget(
  round: HuntRound,
  found: readonly string[],
): string | undefined {
  return huntBoardOrder(round).find((w) => !found.includes(w))
}

// ── The record (Dave (7)) ─────────────────────────────────────────────────

/** The stored round: `found` holds targets and extras in find order. */
export interface HuntRecord extends HuntRound {
  found: string[]
  complete: boolean
}

/**
 * One of the learner's own keys (`learners/keys.ts` `LEARNER_KEYS`). Its
 * value is by length, `{ "3": HuntRecord, "4": HuntRecord, "open": [3, 4],
 * "digraphLine": true }`: each length's round in play, `open` once "4" has
 * opened (Q24; F6), and `digraphLine` once Emma has said "Two letters, one
 * sound!" (D28). Older values have neither: they read as `[3]` and unsaid.
 */
export const HUNT_STORAGE_KEY = 'marian-tutor.critter-hunt.v1'

/** The field of the stored value that holds the open lengths. */
const OPEN_FIELD = 'open'
/** The field that marks the digraph critters' line said (D28). */
const DIGRAPH_LINE_FIELD = 'digraphLine'

const isWords = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((w) => typeof w === 'string')

function isHuntRecord(v: unknown, length: HuntLength): v is HuntRecord {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    isWords(r.letters) &&
    r.letters.length === 1 + RULES[length].consonants &&
    isWords(r.targets) &&
    r.targets.length > 0 &&
    isWords(r.extras) &&
    isWords(r.found) &&
    typeof r.complete === 'boolean'
  )
}

function readAll(): Record<string, unknown> {
  const raw = getKeyValueStore()?.getItem(HUNT_STORAGE_KEY) ?? null
  if (raw === null) return {}
  const parsed: unknown = JSON.parse(raw)
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {}
}

/**
 * The playing learner's round of `length` letters, or `null` (none, or
 * unreadable: a fresh deal follows). A round stored under an older rule
 * reopens as stored, its finds hers (Q30, Dave (3): never a lost find),
 * until New letters deals a fresh one.
 */
export function loadHuntRecord(
  length: HuntLength = HUNT_LENGTH,
): HuntRecord | null {
  try {
    const r = readAll()[String(length)]
    return isHuntRecord(r, length) ? r : null
  } catch {
    return null
  }
}

/**
 * Writes the playing learner's round of `length` letters (a deal, a new
 * find, New letters). With `unlock`, a complete three-letter round also
 * opens "4" in the same write (critters four-letter § 1, F6): the
 * completing find opens it, and Back during its beat still does. Once
 * open, it stays open. Only the screen that shows "4" passes `unlock`, so
 * a learner's first complete round before that ships opens nothing (the
 * roll-in waits for her next one). A storage failure is logged: play
 * never waits on it.
 */
export function saveHuntRecord(
  record: HuntRecord,
  length: HuntLength = HUNT_LENGTH,
  { unlock = false }: { unlock?: boolean } = {},
): void {
  const store = getKeyValueStore()
  if (store === null) return
  try {
    let all: Record<string, unknown> = {}
    try {
      all = readAll()
    } catch {
      // An unreadable record is replaced.
    }
    const opens = unlock && length === 3 && record.complete
    store.setItem(
      HUNT_STORAGE_KEY,
      JSON.stringify({
        ...all,
        [String(length)]: record,
        ...(opens ? { [OPEN_FIELD]: [3, 4] } : {}),
      }),
    )
  } catch (err) {
    console.warn('[Critters] could not save the hunt round:', err)
  }
}

/**
 * The lengths the playing learner has open (critters four-letter § 1,
 * F6): `[3]`, or `[3, 4]` from her first complete three-letter round
 * written with `unlock`. Never reverts. Unreadable reads as `[3]`.
 */
export function huntOpenLengths(): HuntLength[] {
  try {
    const open = readAll()[OPEN_FIELD]
    return Array.isArray(open) && open.includes(4) ? [3, 4] : [3]
  } catch {
    return [3]
  }
}

/**
 * Debug seeds only (`debug/seeds.ts`, the four-letter maestro flows F20 and
 * F21): sets the open lengths outright, `[3]` removing the field. Play
 * opens "4" only through `saveHuntRecord`'s `unlock`.
 */
export function setHuntOpenLengths(open: readonly HuntLength[]): void {
  const store = getKeyValueStore()
  if (store === null) return
  try {
    let all: Record<string, unknown> = {}
    try {
      all = readAll()
    } catch {
      // An unreadable record is replaced.
    }
    const rest = Object.fromEntries(
      Object.entries(all).filter(([k]) => k !== OPEN_FIELD),
    )
    store.setItem(
      HUNT_STORAGE_KEY,
      JSON.stringify(
        open.includes(4) ? { ...rest, [OPEN_FIELD]: [3, 4] } : rest,
      ),
    )
  } catch (err) {
    console.warn('[Critters] could not save the open lengths:', err)
  }
}

/**
 * Whether Emma has said "Two letters, one sound!" to the playing learner
 * (Dave's Q38 ruling, D28): one flag for all four digraph critters, said
 * the first time she taps or lifts one. Never reverts. Unreadable reads
 * as unsaid.
 */
export function huntDigraphLineSaid(): boolean {
  try {
    return readAll()[DIGRAPH_LINE_FIELD] === true
  } catch {
    return false
  }
}

/** Marks the line said, beside her rounds (D28). A failure is logged. */
export function markHuntDigraphLineSaid(): void {
  const store = getKeyValueStore()
  if (store === null) return
  try {
    let all: Record<string, unknown> = {}
    try {
      all = readAll()
    } catch {
      // An unreadable record is replaced.
    }
    store.setItem(
      HUNT_STORAGE_KEY,
      JSON.stringify({ ...all, [DIGRAPH_LINE_FIELD]: true }),
    )
  } catch (err) {
    console.warn('[Critters] could not save the digraph line:', err)
  }
}

/** A record for a fresh round, nothing found. */
export const freshHuntRecord = (round: HuntRound): HuntRecord => ({
  ...round,
  found: [],
  complete: false,
})

/**
 * `record` after finding `word` (a target or an extra) for the first
 * time: added in find order, and complete once `huntComplete`. A word
 * already found, or one the round does not spell, changes nothing.
 */
export function huntFind(record: HuntRecord, word: string): HuntRecord {
  const known = record.targets.includes(word) || record.extras.includes(word)
  if (!known || record.found.includes(word)) return record
  const found = [...record.found, word]
  return {
    ...record,
    found,
    complete: record.complete || huntComplete(record, found),
  }
}
