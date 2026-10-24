/**
 * A letter-sounds session for one target vowel, built on the device from
 * the baked canon (no-Claude plan phase 4, `design/native/no-claude-
 * sizing.md` § 1 row 3, § 4 row 4). It replaces the planner run the server
 * does for a vowel map past greenfield (`api/claude.ts`).
 *
 * The blocks come from two canon files that between them bake all 19 pool
 * letters: `letter-sounds` (M S L A B O N, the shipped /o/ session) and
 * `letter-sounds-audit` (F V H R P T K D G U I E). No new audio: every
 * line is a canon line.
 *
 * The slots follow the planner's LETTER-SOUNDS SESSION COMPOSITION RULES
 * (`api/_planner.ts` WORD_SONG_TRACK_GUIDE) and pass the bake-time lint
 * (`scripts/compositionLint.ts` `lintLetterSoundsComposition`):
 * - P1–P3, the gentle ramp: three mastered consonants;
 * - P4/P5: /æ/ (A) in one, a voiced/unvoiced-pair consonant in the other;
 * - P6 and P8: the target vowel (one canon block per vowel, so the floor
 *   of 2 repeats it, which rule 7 allows); P7: a consonant between them,
 *   as in the pinned /o/ session.
 * The consonants and the A slot vary with the seed; no letter repeats but
 * the vowel.
 *
 * /o/ is the canon's own session: the planner pins it (PINNED SESSION, m s
 * l a b o n o), so the server's live /o/ session is that session too.
 *
 * Pure: no I/O, no clock.
 */
import type { LetterSoundsVowelSlash } from '../wire/letterSoundsVowel'
import {
  LETTER_SOUNDS_CONSONANTS,
  LETTER_SOUND_MNEMONIC_TO_LETTER,
} from '../wordSong/letterSoundsPool'
import type {
  CanonLine,
  CanonText,
  CanonTextResolver,
  LocalSession,
} from './composeSession'

/** The canon file of the letter-sounds step, and the one with the rest. */
export const LETTER_SOUNDS_STEP = 'letter-sounds'
export const LETTER_SOUNDS_AUDIT_FILE = 'letter-sounds-audit'

const VOWEL_LETTER: Readonly<Record<LetterSoundsVowelSlash, string>> = {
  '/o/': 'O',
  '/u/': 'U',
  '/i/': 'I',
  '/e/': 'E',
}

/** The stops and fricatives with a voiced/unvoiced partner in the pool. */
const PAIRED_CONSONANTS: ReadonlySet<string> = new Set([
  'B',
  'P',
  'D',
  'T',
  'G',
  'K',
  'V',
  'F',
])

const RE_READ_ID = /^word\.p(\d+)\.read$/
const RE_READ_TEXT = /says\s+([a-z]+)\b/i

/** mulberry32: a small deterministic stream from the seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function planLines(entry: CanonText): CanonLine[] {
  const plan = entry.plan as { utterances?: unknown } | null
  const lines = Array.isArray(plan?.utterances) ? plan.utterances : []
  return lines.filter(
    (u): u is CanonLine =>
      typeof u === 'object' &&
      u !== null &&
      typeof (u as CanonLine).id === 'string' &&
      typeof (u as CanonLine).text === 'string',
  )
}

interface Block {
  entry: CanonText
  problem: number
}

/** The first canon block of each letter, over `entries` in order. */
function blocksByLetter(entries: readonly CanonText[]): Map<string, Block> {
  const out = new Map<string, Block>()
  for (const entry of entries) {
    for (const line of planLines(entry)) {
      const id = RE_READ_ID.exec(line.id)
      const said = RE_READ_TEXT.exec(line.text)
      if (id === null || said === null) continue
      const letter = LETTER_SOUND_MNEMONIC_TO_LETTER[said[1]!.toLowerCase()]
      if (letter === undefined || out.has(letter)) continue
      out.set(letter, { entry, problem: Number(id[1]) })
    }
  }
  return out
}

/** A block's plan and spoken lines, renamed `word.p<problem>.` → `word.p<n>.`. */
function copyBlock(block: Block, n: number) {
  const from = `word.p${block.problem}.`
  const copy = (lines: readonly CanonLine[]) =>
    lines
      .filter((u) => u.id.startsWith(from))
      .map((u) => ({
        id: `word.p${n}.${u.id.slice(from.length)}`,
        text: u.text,
      }))
  return {
    plan: copy(planLines(block.entry)),
    utterances: copy(block.entry.utterances),
  }
}

function sessionOf(entry: CanonText): LocalSession {
  return {
    plan: entry.plan,
    utterances: entry.utterances.map((u) => ({ id: u.id, text: u.text })),
  }
}

/**
 * The 8 target letters for `vowel` (not /o/): a seeded pick under the
 * slot rules in the header. `null` if the canon lacks a letter it needs.
 */
function pickLetters(
  vowel: string,
  have: ReadonlyMap<string, Block>,
  seed: number,
): string[] | null {
  if (!have.has(vowel) || !have.has('A')) return null
  const next = rng(seed)
  const used = new Set<string>()
  const take = (allowed: (letter: string) => boolean): string | null => {
    const pool = LETTER_SOUNDS_CONSONANTS.filter(
      (c) => have.has(c) && !used.has(c) && allowed(c),
    )
    if (pool.length === 0) return null
    const letter = pool[Math.floor(next() * pool.length)]!
    used.add(letter)
    return letter
  }
  const any = () => true
  const ramp = [take(any), take(any), take(any)]
  const aFirst = next() < 0.5
  const mid = take((c) => PAIRED_CONSONANTS.has(c))
  const trap = take(any)
  if (ramp.includes(null) || mid === null || trap === null) return null
  return [
    ...(ramp as string[]),
    aFirst ? 'A' : mid,
    aFirst ? mid : 'A',
    vowel,
    trap,
    vowel,
  ]
}

/**
 * The letter-sounds session practising `vowel`, from the canon at `level`,
 * or `null` if the canon cannot serve it (the caller asks the server).
 * Plan id `letter-sounds-short-<letter>`; the step's `session.end.*` lines
 * follow the 8 problems, as in the canon file.
 */
export function composeLetterSoundsSession(
  vowel: LetterSoundsVowelSlash,
  seed: number,
  resolve: CanonTextResolver,
  level: number,
): LocalSession | null {
  const step = resolve({
    track: 'word-song',
    level,
    focusNode: LETTER_SOUNDS_STEP,
  })
  if (step === null) return null
  if (vowel === '/o/') return sessionOf(step)
  const audit = resolve({
    track: 'word-song',
    level,
    focusNode: LETTER_SOUNDS_AUDIT_FILE,
  })
  if (audit === null) return null
  const letter = VOWEL_LETTER[vowel]
  const have = blocksByLetter([step, audit])
  const letters = pickLetters(letter, have, seed)
  if (letters === null) return null
  const plan: CanonLine[] = []
  const utterances: CanonLine[] = []
  letters.forEach((l, i) => {
    const block = copyBlock(have.get(l)!, i + 1)
    plan.push(...block.plan)
    utterances.push(...block.utterances)
  })
  const isEnd = (u: CanonLine) => u.id.startsWith('session.end.')
  return {
    plan: {
      id: `letter-sounds-short-${letter.toLowerCase()}`,
      label: `Letter Sounds: Short ${letter}`,
      utterances: [...plan, ...planLines(step).filter(isEnd)],
    },
    utterances: [
      ...utterances,
      ...step.utterances.filter(isEnd).map((u) => ({ id: u.id, text: u.text })),
    ],
  }
}
