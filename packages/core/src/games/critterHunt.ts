/**
 * Letter critters' word hunt, phase 1: three-letter rounds
 * (`design/native/critters-word-hunt.md` § 1; the rules are Dave's ruling
 * of 2026-10-25, `design/research/critters-word-hunt-2026-10-25.md`, cited
 * as "Dave (n)").
 *
 * Once blending sounds is current or mastered (`critterFunnyOpen`, the same
 * gate), the free meadow gives way to rounds: 6 critters (one of her taught
 * short vowels, then 5 consonants), the 5-8 words they spell that she
 * knows (the targets), and the rarer said words (the extras). A round is
 * complete at all but one target, Thomas's 95 % rounded down.
 *
 * Its one record, per learner, is the round in play (Dave (7)): its
 * letters, targets, extras and the words found in find order. Toy state
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
} from './playPlace'

/** The round's word length: phase 1 deals three-letter rounds only. */
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
 * picture. Exactly as Dave (1) prints them, 68.
 */
export const HUNT_FAMILIAR: ReadonlySet<string> = new Set(
  [
    'bad fat had lap mad pat ran sad sat wag wax and',
    'get let men met pet red set ten wet fed vet',
    'big bit did dig dip fin fit fix hid him hip hit lip lit mix pit rip sit six tin tip win',
    'dot fog got hop hog job jog lot nod not',
    'but cut dug fun hug hum mud mug mum pup rub run tug',
  ]
    .join(' ')
    .split(' '),
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
  /** The vowel, then the 5 consonants a-z (the meadow's order). */
  letters: string[]
  /** The words to find, a-z: 5-8 of them. */
  targets: string[]
  /** The other said words they spell, a-z: 0-3, never required. */
  extras: string[]
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])
/** The 17 consonants among the 22 critter letters. */
const CONSONANTS = [...'bcdfghjlmnprstvwx']

/**
 * The real words a round could ever build: a vowel at most once (it has no
 * twin) and a consonant at most twice (its twin, so dad, mom and pop
 * work). A word on it is spellable when every letter is in the round.
 */
const BUILDABLE: readonly (readonly [string, readonly string[]])[] = [
  ...CRITTER_REAL_WORDS,
]
  .filter(
    (w) =>
      w.length === HUNT_LENGTH &&
      [...w].every(
        (ch) =>
          [...w].filter((x) => x === ch).length <= (VOWELS.has(ch) ? 1 : 2),
      ),
  )
  .map((w) => [w, [...new Set(w)]] as const)

/** A target: a picture word, a said word with a picture, or familiar. */
const isTarget = (w: string) => critterHasPicture(w) || HUNT_FAMILIAR.has(w)

/**
 * The round `letters` deal (vowel first), or `null` when Dave (1)'s rules
 * reject it: no quiet word spellable; 5-8 targets, at least 3 with a
 * bundled picture; at most 3 extras; every consonant in a target; and,
 * with `probeGuard`, no probe-reserve word spellable.
 */
export function huntRoundOf(
  letters: readonly string[],
  { probeGuard = false }: { probeGuard?: boolean } = {},
): HuntRound | null {
  const set = new Set(letters)
  const words = BUILDABLE.filter(([, ls]) => ls.every((l) => set.has(l))).map(
    ([w]) => w,
  )
  if (words.some((w) => CRITTER_NOT_SAID.has(w))) return null
  if (probeGuard && words.some((w) => PROBE_RESERVE_WORDS.includes(w))) {
    return null
  }
  const targets = words.filter(isTarget).sort()
  const extras = words
    .filter((w) => !isTarget(w) && CRITTER_SAID_WORDS.includes(w))
    .sort()
  if (targets.length < HUNT_MIN_TARGETS || targets.length > HUNT_MAX_TARGETS)
    return null
  if (targets.filter(critterHasPicture).length < HUNT_MIN_PICTURES) return null
  if (extras.length > HUNT_MAX_EXTRAS) return null
  const consonants = letters.filter((l) => !VOWELS.has(l))
  if (!consonants.every((c) => targets.some((w) => w.includes(c)))) return null
  return { letters: [...letters], targets, extras }
}

/** Every 5 of `pool`, in order. */
function* fives(
  pool: readonly string[],
  from = 0,
  picked: string[] = [],
): Generator<string[]> {
  if (picked.length === HUNT_CONSONANTS) {
    yield [...picked]
    return
  }
  for (let i = from; i < pool.length; i++) {
    picked.push(pool[i]!)
    yield* fives(pool, i + 1, picked)
    picked.pop()
  }
}

const ROUNDS = new Map<string, readonly HuntRound[]>()

/**
 * Every round `vowel` deals, by its consonants in lexicographic order
 * (Dave (1) counts 184 in all: a 45, e 21, i 30, o 27, u 61, with every
 * picture bundled). Computed once per vowel and guard.
 */
export function huntRounds(
  vowel: string,
  { probeGuard = false }: { probeGuard?: boolean } = {},
): readonly HuntRound[] {
  const key = `${vowel}|${probeGuard}`
  const known = ROUNDS.get(key)
  if (known !== undefined) return known
  const out: HuntRound[] = []
  for (const cs of fives(CONSONANTS)) {
    const round = huntRoundOf([vowel, ...cs], { probeGuard })
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

const sameLetters = (a: readonly string[], b: readonly string[] | undefined) =>
  b !== undefined && a.length === b.length && a.every((l, i) => l === b[i])

/**
 * A fresh round (Dave (1)): one of her vowels, then one of that vowel's
 * rounds, each by `rng`; never the same letters as `last`. With
 * `probeGuard`, only rounds that spell no probe-reserve word. Picking
 * uniformly among the rounds that pass is draw-and-accept over the
 * consonant sets, with the draws done once. No vowels: _a_. The same
 * `rng` gives the same round.
 */
export function huntDeal(
  vowels: readonly string[],
  rng: () => number,
  {
    last,
    probeGuard = false,
  }: { last?: readonly string[]; probeGuard?: boolean } = {},
): HuntRound {
  const own = vowels.length > 0 ? vowels : ['a']
  const vowel = own[Math.floor(rng() * own.length)]!
  const rounds = huntRounds(vowel, { probeGuard }).filter(
    (r) => !sameLetters(r.letters, last),
  )
  if (rounds.length > 0) return rounds[Math.floor(rng() * rounds.length)]!
  return huntRoundOf(HUNT_FALLBACK[vowel] ?? HUNT_FALLBACK.a!)!
}

const foundTargets = (round: HuntRound, found: readonly string[]) =>
  round.targets.filter((w) => found.includes(w))

/**
 * True once `floor(0.95 × N)` targets are found: N − 1 for N 5-8 (Dave
 * (1), Thomas's 95 %). Extras never count.
 */
export function huntComplete(
  round: HuntRound,
  found: readonly string[],
): boolean {
  const need = Math.floor(0.95 * round.targets.length)
  return foundTargets(round, found).length >= need
}

/**
 * The word a hint plays: the first unfound target, picture words a-z
 * first (their blend clip sings each sound), then the other targets a-z.
 * `undefined` when every target is found.
 */
export function huntHintTarget(
  round: HuntRound,
  found: readonly string[],
): string | undefined {
  const left = round.targets.filter((w) => !found.includes(w)).sort()
  return (
    left.find((w) => CRITTER_PICTURE_WORDS.includes(w)) ??
    left.find((w) => !CRITTER_PICTURE_WORDS.includes(w))
  )
}

// ── The record (Dave (7)) ─────────────────────────────────────────────────

/** The stored round: `found` holds targets and extras in find order. */
export interface HuntRecord extends HuntRound {
  found: string[]
  complete: boolean
}

/** One of the learner's own keys (`learners/keys.ts` `LEARNER_KEYS`). */
export const HUNT_STORAGE_KEY = 'marian-tutor.critter-hunt.v1'

const isWords = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((w) => typeof w === 'string')

function isHuntRecord(v: unknown): v is HuntRecord {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    isWords(r.letters) &&
    r.letters.length === 1 + HUNT_CONSONANTS &&
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
export function loadHuntRecord(length = HUNT_LENGTH): HuntRecord | null {
  try {
    const r = readAll()[String(length)]
    return isHuntRecord(r) ? r : null
  } catch {
    return null
  }
}

/**
 * Writes the playing learner's round of `length` letters (a deal, a new
 * find, New letters). A storage failure is logged: play never waits on it.
 */
export function saveHuntRecord(record: HuntRecord, length = HUNT_LENGTH): void {
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
      JSON.stringify({ ...all, [String(length)]: record }),
    )
  } catch (err) {
    console.warn('[Critters] could not save the hunt round:', err)
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
