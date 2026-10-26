/**
 * Letter critters' word hunt: three-letter rounds
 * (`design/native/critters-word-hunt.md` § 1; the rules are Dave's ruling
 * of 2026-10-25, `design/research/critters-word-hunt-2026-10-25.md`, cited
 * as "Dave (n)"), and four-letter rounds (`design/native/critters-four-letter.md`
 * § 1; Dave's ruling of 2026-10-26, (B), cited as "Dave 23 (B)").
 *
 * Once blending sounds is current or mastered (`critterFunnyOpen`, the same
 * gate), the free meadow gives way to rounds: 6 critters (one of her taught
 * short vowels, then 5 consonants), the 5-8 words they spell that she
 * knows (the targets), and the rarer said words (the extras). A round is
 * complete at all but one target, Thomas's 95 % rounded down.
 *
 * Four-letter rounds open at her first complete three-letter round: 7
 * critters (the vowel, then 6 consonants), the 4-6 `HUNT_FOUR_TARGETS`
 * words they spell, no extras, at most one decoy consonant.
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
  HUNT_FOUR_TARGETS,
} from './playPlace'

/** A round's word length: three letters, or four (critters four-letter § 1). */
export type HuntLength = 3 | 4

/** The default length: the three-letter round every learner starts on. */
export const HUNT_LENGTH = 3
/** Critters in a round: 1 vowel + 5 consonants (Dave (1)). */
export const HUNT_CONSONANTS = 5
/** Targets per round, at least this many with a bundled picture, extras. */
export const HUNT_MIN_TARGETS = 5
export const HUNT_MAX_TARGETS = 8
export const HUNT_MIN_PICTURES = 3
export const HUNT_MAX_EXTRAS = 3

/**
 * Dave's pinned familiar words (Dave (1)): words a 6-9 learner knows that
 * the critters spell, beyond the picture words and the said words with a
 * picture. Exactly as Dave (1) prints them, 68; and since the four-letter
 * phase gave them clips, _act add end ill its odd off_ (Dave 23 (B), "New
 * audio"; critters four-letter F7), 75.
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
 * Dave's rude four-letter words (Dave 23 (B)), as he prints them (he calls
 * them 17; the list has 18): no four-letter round deals letters that spell
 * one.
 */
export const HUNT_RUDE_FOUR: ReadonlySet<string> = new Set(
  'cunt shit piss twat slut crap turd damn hell butt slag prat bums tits cums fags gits guns'.split(
    ' ',
  ),
)

/**
 * Four-letter words a 6-9 learner knows that have no clip (Dave's Q21
 * answer, 2026-10-26): no four-letter round deals letters that spell one,
 * since it would sing and sit on a board with no slot for it. Dave (8)'s
 * words that no round dealt by his other rules.
 */
export const HUNT_FOUR_UNDEALT: ReadonlySet<string> = new Set(
  'crab trap grab slot lost slip snip spin twin grin swim crib list mist fist mint hint limp film snug stub mend send help held'.split(
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
  /** The vowel, then the 5 consonants (6 for four letters) a-z. */
  letters: string[]
  /** The words to find, a-z: 5-8 of them (4-6 for four letters). */
  targets: string[]
  /** The other said words they spell, a-z: 0-3, never required; none for four letters. */
  extras: string[]
}

/** Each length's deal rules: Dave (1) for three, Dave 23 (B) for four. */
const RULES: Readonly<
  Record<
    HuntLength,
    {
      consonants: number
      minTargets: number
      maxTargets: number
      minPictures: number
      /** Consonants in no target (a decoy's twin pops as usual). */
      maxDecoys: number
    }
  >
> = {
  3: {
    consonants: HUNT_CONSONANTS,
    minTargets: HUNT_MIN_TARGETS,
    maxTargets: HUNT_MAX_TARGETS,
    minPictures: HUNT_MIN_PICTURES,
    maxDecoys: 0,
  },
  4: {
    consonants: 6,
    minTargets: 4,
    maxTargets: 6,
    minPictures: 2,
    maxDecoys: 1,
  },
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])
/** The 17 consonants among the 22 critter letters. */
const CONSONANTS = [...'bcdfghjlmnprstvwx']

/**
 * The words of `words` a round could ever build, each with its letters: a
 * vowel at most once (it has no twin) and a consonant at most twice (its
 * twin, so dad, mom, pump and test work). A word on it is spellable when
 * every letter is in the round.
 */
const buildable = (
  words: Iterable<string>,
): readonly (readonly [string, readonly string[]])[] =>
  [...words]
    .filter((w) =>
      [...w].every(
        (ch) =>
          [...w].filter((x) => x === ch).length <= (VOWELS.has(ch) ? 1 : 2),
      ),
    )
    .map((w) => [w, [...new Set(w)]] as const)

/** The real three-letter words a round could ever build. */
const BUILDABLE = buildable(
  [...CRITTER_REAL_WORDS].filter((w) => w.length === HUNT_LENGTH),
)
/** The four-letter targets, and the words that reject a four-letter round. */
const BUILDABLE_FOUR = buildable(HUNT_FOUR_TARGETS)
const REJECTS_FOUR = buildable([...HUNT_RUDE_FOUR, ...HUNT_FOUR_UNDEALT])

const spelled = (
  words: readonly (readonly [string, readonly string[]])[],
  set: ReadonlySet<string>,
) => words.filter(([, ls]) => ls.every((l) => set.has(l))).map(([w]) => w)

/** A target: a picture word, a said word with a picture, or familiar. */
const isTarget = (w: string) => critterHasPicture(w) || HUNT_FAMILIAR.has(w)

/**
 * The round `letters` deal (vowel first), or `null` when the rules reject
 * it. Three letters (Dave (1)): no quiet word spellable; 5-8 targets, at
 * least 3 with a bundled picture; at most 3 extras; every consonant in a
 * target; and, with `probeGuard`, no probe-reserve word spellable. Four
 * letters (Dave 23 (B), F1): no `HUNT_RUDE_FOUR` or `HUNT_FOUR_UNDEALT`
 * word spellable; the targets are the `HUNT_FOUR_TARGETS` words spelled,
 * 4-6, at least 2 with a bundled picture; no extras; at most one consonant
 * in no target. The probe guard is a three-letter rule (its words are
 * three letters).
 */
export function huntRoundOf(
  letters: readonly string[],
  {
    probeGuard = false,
    length = HUNT_LENGTH,
  }: { probeGuard?: boolean; length?: HuntLength } = {},
): HuntRound | null {
  const set = new Set(letters)
  let targets: string[]
  let extras: string[]
  if (length === 4) {
    if (spelled(REJECTS_FOUR, set).length > 0) return null
    targets = spelled(BUILDABLE_FOUR, set).sort()
    extras = []
  } else {
    const words = spelled(BUILDABLE, set)
    if (words.some((w) => CRITTER_NOT_SAID.has(w))) return null
    if (probeGuard && words.some((w) => PROBE_RESERVE_WORDS.includes(w))) {
      return null
    }
    targets = words.filter(isTarget).sort()
    extras = words
      .filter((w) => !isTarget(w) && CRITTER_SAID_WORDS.includes(w))
      .sort()
    if (extras.length > HUNT_MAX_EXTRAS) return null
  }
  const rules = RULES[length]
  if (targets.length < rules.minTargets || targets.length > rules.maxTargets)
    return null
  if (targets.filter(critterHasPicture).length < rules.minPictures) return null
  const decoys = letters.filter(
    (l) => !VOWELS.has(l) && !targets.some((w) => w.includes(l)),
  )
  if (decoys.length > rules.maxDecoys) return null
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
 * Three letters: 439 in all (a 203, e 39, i 53, o 83, u 61), Dave (1)'s
 * count with the nine said later (F7); 184 before. Four letters
 * (`length: 4`): a 56, o 51, i 2, u 125, e 86 (Dave 23 (B) with Q21's
 * rule). Computed once per vowel, guard and length.
 */
export function huntRounds(
  vowel: string,
  {
    probeGuard = false,
    length = HUNT_LENGTH,
  }: { probeGuard?: boolean; length?: HuntLength } = {},
): readonly HuntRound[] {
  const guard = probeGuard && length === 3
  const key = `${vowel}|${guard}|${length}`
  const known = ROUNDS.get(key)
  if (known !== undefined) return known
  const out: HuntRound[] = []
  for (const cs of choose(CONSONANTS, RULES[length].consonants)) {
    const round = huntRoundOf([vowel, ...cs], { probeGuard: guard, length })
    if (round !== null) out.push(round)
  }
  ROUNDS.set(key, out)
  return out
}

/**
 * Pinned fallback rounds, one per vowel (never expected: each vowel deals
 * at least 21 rounds). Each passes the probe guard. `critterHunt.test.ts`
 * checks every one.
 */
export const HUNT_FALLBACK: Readonly<Record<string, readonly string[]>> = {
  a: ['a', 'b', 'g', 'h', 'p', 't'],
  e: ['e', 'j', 'n', 'p', 't', 'v'],
  i: ['i', 'b', 'f', 'g', 't', 'w'],
  o: ['o', 'b', 'h', 'p', 't', 'x'],
  u: ['u', 'b', 'g', 'j', 'n', 'r'],
}

/**
 * Dave's pinned four-letter fallbacks, one per vowel (Dave 23 (B); never
 * expected: each vowel deals at least 2 rounds). They deal camp clap damp
 * lamp, crop drop pond prop, clip flip gift lift, bulb club gulp plug and
 * belt best sled test. `critterHunt.test.ts` checks every one.
 */
export const HUNT_FOUR_FALLBACK: Readonly<Record<string, readonly string[]>> = {
  a: ['a', 'b', 'c', 'd', 'l', 'm', 'p'],
  e: ['e', 'b', 'c', 'd', 'l', 's', 't'],
  i: ['i', 'c', 'f', 'g', 'l', 'p', 't'],
  o: ['o', 'b', 'c', 'd', 'n', 'p', 'r'],
  u: ['u', 'b', 'c', 'd', 'g', 'l', 'p'],
}

const sameLetters = (a: readonly string[], b: readonly string[] | undefined) =>
  b !== undefined && a.length === b.length && a.every((l, i) => l === b[i])

/**
 * A fresh round (Dave (1)): one of her vowels, then one of that vowel's
 * rounds of `length` letters, each by `rng`; never the same letters as
 * `last`. With `probeGuard` (three letters only), only rounds that spell
 * no probe-reserve word. Picking uniformly among the rounds that pass is
 * draw-and-accept over the consonant sets, with the draws done once. No
 * vowels: _a_. The same `rng` gives the same round.
 */
export function huntDeal(
  vowels: readonly string[],
  rng: () => number,
  {
    last,
    probeGuard = false,
    length = HUNT_LENGTH,
  }: {
    last?: readonly string[]
    probeGuard?: boolean
    length?: HuntLength
  } = {},
): HuntRound {
  const own = vowels.length > 0 ? vowels : ['a']
  const vowel = own[Math.floor(rng() * own.length)]!
  const rounds = huntRounds(vowel, { probeGuard, length }).filter(
    (r) => !sameLetters(r.letters, last),
  )
  if (rounds.length > 0) return rounds[Math.floor(rng() * rounds.length)]!
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

/** The board's three bands (§ 15.2): 0 easiest. */
const boardBand = (word: string): number =>
  CRITTER_PICTURE_WORDS.includes(word) ? 0 : critterHasPicture(word) ? 1 : 2

/**
 * The targets in board order (`critters-word-hunt.md` § 15.2, Dave 23
 * (A).1): picture words (each has a blend clip) a-z, then the other
 * targets with a picture a-z, then the targets with no picture a-z. A
 * four-letter round has no picture word, so it is its pictured targets
 * a-z, then the rest (critters four-letter F5). Slot
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
 * value is by length, `{ "3": HuntRecord, "4": HuntRecord, "open": [3, 4] }`:
 * each length's round in play, and `open` once "4" has opened (Q24; F6).
 * Older values have no `open`: they read as `[3]`.
 */
export const HUNT_STORAGE_KEY = 'marian-tutor.critter-hunt.v1'

/** The field of the stored value that holds the open lengths. */
const OPEN_FIELD = 'open'

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
 * unreadable: a fresh deal follows).
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
