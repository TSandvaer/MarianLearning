/**
 * The closed math pools (no-Claude plan phase 5a,
 * `design/native/no-claude-sizing.md` § 2 "How a pool grows", § 3
 * scenario C, § 4 row 5a): every fact of the 9 closed math steps as canon
 * problems p9..pN of the step's canon file, written from today's line
 * templates. No Haiku: the lines are a pure function of the fact.
 *
 * The facts (scenario C, sizing § 3 "Closed pools behind C"):
 * - add-to-10: `ADD_TO_TEN_POOL` (44) and the 9 bonds to ten
 *   (`MISSING_NUMBER_RANGES`), 53 blocks;
 * - add-to-20: `ADD_TO_TWENTY_POOL` (22) and its 10 bonds (the whole 11–14);
 * - sub-to-10, sub-to-20: their 22-fact pools;
 * - two-digit-addsub (no regroup) 36, with regroup 30: their pools;
 * - mult-2-5-10, mult-3-4, mult-6-9: the table times 1–5 copies (the hint's
 *   case split, `api/_planner.ts` GENERIC-TIER HINT TEMPLATES), plus the
 *   commuted form when the table number fits as copies (canon mult-3-4 asks
 *   "Two times three"): 19, 14 and 20 blocks.
 *
 * The 0-miss check (`zeroMisses`): the templates must reproduce every
 * committed p1..p8 line of the step byte for byte, so the generated lines
 * are the lines a bake would write. `--check` (run by `yarn canon:lint`
 * and `scripts/generateMathPools.test.ts`, both in CI's fast gate) fails
 * on a miss or on a pool file that differs from what this script writes.
 *
 * Served session vs pool (`packages/core/src/wire/canonPool.ts`): problems
 * 1–8 and the `session.end.*` lines are untouched. The server serves the
 * file without its pool, and the device draws a pool block only once all
 * its lines have a bundled clip (`mobile/src/session/localSession.ts`).
 *
 * Audio: a pool line whose text a served canon line already voices takes
 * those bytes (the wave-2 splice rule; canon has one clip per text,
 * `mobile/scripts/export-audio.mjs`). A new text gets an empty
 * `audio.base64` until `npx tsx scripts/revoiceCanonLily.ts --unrendered`
 * renders it; a pool line keeps the audio it has. So a run before or after
 * the render writes the same bytes.
 *
 * Run: npx tsx scripts/generateMathPools.ts [--check]
 * Prints the render bill: new Lily characters through
 * `renderElevenLabsText` (`api/_tts_elevenlabs.ts`), once per request text,
 * against every line canon already serves; and the new lines, which are the
 * voice-QA rows to ear-test.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADD_TO_TEN_POOL,
  SUB_TO_TEN_POOL,
} from '@marian/core/math/compositionRules'
import type { MathFact } from '@marian/core/progress/types'
import { servedCanon } from '@marian/core/wire/canonPool'
import {
  MISSING_NUMBER_RANGES,
  missingNumberFits,
} from '@marian/core/wire/missingNumbers'
import { renderElevenLabsText } from '../api/_tts_elevenlabs.js'
import {
  ADD_TO_TWENTY_POOL,
  SUB_TO_TWENTY_POOL,
  TWO_DIGIT_ADDSUB_POOL,
  TWO_DIGIT_ADDSUB_WITH_REGROUP_POOL,
} from './compositionLint.js'
import { ROOT, canonFiles, tierFor } from './lilyCanonLib.js'

export const CANON_ROOT = join(ROOT, 'public', 'canon')
export const MATH_POOL_CANON_DIR = join(CANON_ROOT, 'math', 'level-1')

/** The 9 closed math steps, by canon file stem. */
export const MATH_POOL_STEPS = [
  'add-to-10',
  'add-to-20',
  'sub-to-10',
  'sub-to-20',
  'two-digit-addsub',
  'two-digit-addsub-with-regroup',
  'mult-2-5-10',
  'mult-3-4',
  'mult-6-9',
] as const

export type PoolStep = (typeof MATH_POOL_STEPS)[number]

/** A math problem's lines, in canon order. */
export const SLOTS = [
  'read',
  'correct',
  'reprompt',
  'hint1',
  'hint2',
  'hint3',
  'giveAnswer',
] as const

export interface Line {
  id: string
  text: string
}
export interface AudioLine extends Line {
  audio: { kind: 'inline'; base64: string; mime: string }
}
export interface CanonDoc {
  ok: true
  kind: 'session-start'
  plan: { id: string; label: string; utterances: Line[] }
  utterances: AudioLine[]
}

/** One block: its fact (a missing number's is given + missing) and its
 *  lines in `SLOTS` order. `dave`: also in Dave's pool (scenario D, his
 *  § 1 table), which leaves out the bond blocks, ×1 on mult-3-4 / mult-6-9
 *  and mult-2-5-10's commuted forms. */
export interface PoolBlock {
  fact: MathFact
  missing: boolean
  dave: boolean
  lines: readonly string[]
}

// --- Number words ---------------------------------------------------------

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy']

/** `n` as Emma says it: "seven", "twenty", "forty-two". */
function word(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= TENS.length * 10) {
    throw new Error(`no number word for ${n}`)
  }
  if (n < 20) return ONES[n]!
  const ones = n % 10
  return ones === 0
    ? TENS[n / 10]!
    : `${TENS[Math.floor(n / 10)]}-${ONES[ones]}`
}
const Word = (n: number) => word(n).charAt(0).toUpperCase() + word(n).slice(1)

// --- Line templates (today's p1..p8, the planner's per-step shapes) -------

/** The flower steps' hint1/hint2; the two-digit steps say only the number. */
type Hints = 'flowers' | 'bare'
const look = (h: Hints) => (h === 'flowers' ? 'Look at the flowers.' : 'Look.')
const first = (h: Hints, n: number) =>
  h === 'bare' ? `${Word(n)}.` : `${Word(n)} ${n === 1 ? 'flower' : 'flowers'}.`

const REPROMPT = 'Hmm... try again?'

function plus(a: number, b: number, h: Hints, dave = true): PoolBlock {
  return {
    fact: { a, b, op: '+' },
    missing: false,
    dave,
    lines: [
      `${Word(a)} plus ${word(b)}. How many?`,
      `Yes! ${Word(a + b)}!`,
      REPROMPT,
      look(h),
      first(h, a),
      `And ${word(b)} more. How many now?`,
      `This one is ${word(a + b)}.`,
    ],
  }
}

function minus(
  a: number,
  b: number,
  verb: 'take away' | 'minus',
  h: Hints,
): PoolBlock {
  return {
    fact: { a, b, op: '-' },
    missing: false,
    dave: true,
    lines: [
      `${Word(a)} ${verb} ${word(b)}. How many are left?`,
      `Yes! ${Word(a - b)}!`,
      REPROMPT,
      look(h),
      first(h, a),
      `Take away ${word(b)}. How many now?`,
      `This one is ${word(a - b)}.`,
    ],
  }
}

/** A missing number `given + ? = given + missing` (content wave 1 § 1.2). */
function bond(given: number, missing: number): PoolBlock {
  const whole = given + missing
  return {
    fact: { a: given, b: missing, op: '+' },
    missing: true,
    dave: false,
    lines: [
      `${Word(given)} and what make ${word(whole)}?`,
      `Yes! ${Word(given)} and ${word(missing)} make ${word(whole)}!`,
      REPROMPT,
      look('flowers'),
      first('flowers', given),
      `How many more make ${word(whole)}?`,
      `This one is ${word(missing)}.`,
    ],
  }
}

/** hint2's repeated-addition chain: `copies` copies of `a` (1..5). */
function chain(a: number, copies: number): string {
  const A = Word(a)
  const x = word(a)
  switch (copies) {
    case 1:
      return `One group of ${x}.`
    case 2:
      return `${A} and ${x} more.`
    case 3:
      return `${A}, then ${x}, then ${x}.`
    case 4:
      return `${A}, ${x}, ${x}, ${x}.`
    case 5:
      return `${A}, ${x}, ${x}, ${x}, ${x}.`
    default:
      throw new Error(`no hint chain for ${copies} copies`)
  }
}

function times(a: number, b: number, dave: boolean): PoolBlock {
  return {
    fact: { a, b, op: '*' },
    missing: false,
    dave,
    lines: [
      `${Word(a)} times ${word(b)}. How many?`,
      `Yes! ${Word(a * b)}!`,
      REPROMPT,
      'Look at the groups.',
      chain(a, b),
      'How many?',
      `This one is ${word(a * b)}.`,
    ],
  }
}

const range = (lo: number, hi: number) =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

function bonds(step: 'add-to-10' | 'add-to-20'): PoolBlock[] {
  const r = MISSING_NUMBER_RANGES[step]
  return range(r.givenMin, r.givenMax).flatMap((given) =>
    range(r.missingMin, r.missingMax)
      .filter((missing) => missingNumberFits(step, given, missing))
      .map((missing) => bond(given, missing)),
  )
}

/**
 * A times step: `tables` times 1–5 copies, then the commuted form when a
 * table number fits as copies (≤ 5) with 2–5 as the group. `dave(a, b)`:
 * in Dave's pool.
 */
function timesStep(
  tables: readonly number[],
  dave: (a: number, b: number) => boolean,
): PoolBlock[] {
  const out = new Map<string, PoolBlock>()
  const add = (a: number, b: number) => {
    if (!out.has(`${a}*${b}`)) out.set(`${a}*${b}`, times(a, b, dave(a, b)))
  }
  for (const a of tables) for (const b of range(1, 5)) add(a, b)
  for (const b of tables.filter((t) => t <= 5))
    for (const a of range(2, 5)) add(a, b)
  return [...out.values()]
}

const twoDigit = (f: { a: number; b: number; op: '+' | '-' }) =>
  f.op === '+' ? plus(f.a, f.b, 'bare') : minus(f.a, f.b, 'minus', 'bare')

const BLOCKS: Record<PoolStep, () => PoolBlock[]> = {
  'add-to-10': () => [
    ...ADD_TO_TEN_POOL.map((f) => plus(f.a, f.b, 'flowers')),
    ...bonds('add-to-10'),
  ],
  'add-to-20': () => [
    ...ADD_TO_TWENTY_POOL.map((f) => plus(f.a, f.b, 'flowers')),
    ...bonds('add-to-20'),
  ],
  'sub-to-10': () =>
    SUB_TO_TEN_POOL.map((f) => minus(f.a, f.b, 'take away', 'flowers')),
  'sub-to-20': () =>
    SUB_TO_TWENTY_POOL.map((f) => minus(f.a, f.b, 'minus', 'flowers')),
  'two-digit-addsub': () => TWO_DIGIT_ADDSUB_POOL.map(twoDigit),
  'two-digit-addsub-with-regroup': () =>
    TWO_DIGIT_ADDSUB_WITH_REGROUP_POOL.map(twoDigit),
  // Dave § 1: tables 2, 5, 10 × 1–5.
  'mult-2-5-10': () => timesStep([2, 5, 10], (a) => [2, 5, 10].includes(a)),
  // Dave § 1: {3,4} × {2..5}, both orders.
  'mult-3-4': () =>
    timesStep(
      [3, 4],
      (a, b) =>
        ([3, 4].includes(a) && b >= 2) || ([3, 4].includes(b) && a >= 2),
    ),
  // Dave § 1: {6..9} × {2..5}.
  'mult-6-9': () => timesStep([6, 7, 8, 9], (_, b) => b >= 2),
}

/** Every block of `step`'s pool, the served 8 included, in pool order. */
export function poolBlocks(step: PoolStep): PoolBlock[] {
  return BLOCKS[step]()
}

// --- The 0-miss check -----------------------------------------------------

const lineOf = (id: string, text: string): Line => ({ id, text })

/**
 * Every committed p1..p8 line of `doc` (`step`'s canon file) the templates
 * do not reproduce byte for byte, in the plan and in the spoken lines; a
 * read line that is no fact of the pool is one miss. `[]`: 0 misses.
 */
export function zeroMisses(step: PoolStep, doc: CanonDoc): string[] {
  const byRead = new Map(poolBlocks(step).map((b) => [b.lines[0]!, b]))
  const misses: string[] = []
  for (const [where, lines] of [
    ['plan', doc.plan.utterances],
    ['utterances', doc.utterances],
  ] as const) {
    for (let p = 1; p <= 8; p++) {
      const got = lines
        .filter((u) => u.id.startsWith(`math.p${p}.`))
        .map((u) => lineOf(u.id, u.text))
      const read = got.find((u) => u.id === `math.p${p}.read`)
      const block = read === undefined ? undefined : byRead.get(read.text)
      if (block === undefined) {
        misses.push(
          `${step} ${where} p${p}: read ${JSON.stringify(read?.text)} is no fact of the pool`,
        )
        continue
      }
      const want = SLOTS.map((slot, k) =>
        lineOf(`math.p${p}.${slot}`, block.lines[k]!),
      )
      for (let k = 0; k < Math.max(want.length, got.length); k++) {
        if (JSON.stringify(want[k]) !== JSON.stringify(got[k])) {
          misses.push(
            `${step} ${where} p${p}: want ${JSON.stringify(want[k])}, canon has ${JSON.stringify(got[k])}`,
          )
        }
      }
    }
  }
  return misses
}

// --- Audio ----------------------------------------------------------------

/** What canon's served lines already voice. */
export interface CanonAudioIndex {
  /** text → its clip (canon has one clip per text). */
  served: Map<string, string>
  /** text → the request text its clip was rendered from. */
  inputs: Map<string, string>
  /** Every request text a served line's clip was rendered from. */
  servedInputs: Set<string>
}

const readDoc = (path: string): CanonDoc =>
  JSON.parse(readFileSync(path, 'utf8')) as CanonDoc

/** The clips of every served canon line under `root` (pools left out). */
export function canonAudioIndex(root: string = CANON_ROOT): CanonAudioIndex {
  const out: CanonAudioIndex = {
    served: new Map(),
    inputs: new Map(),
    servedInputs: new Set(),
  }
  for (const path of canonFiles(root).sort()) {
    const tier = tierFor(relative(root, path).split('\\').join('/'))
    for (const u of servedCanon(readDoc(path)).utterances) {
      if (u.audio.base64 === '') continue
      const prev = out.served.get(u.text)
      if (prev !== undefined && prev !== u.audio.base64) {
        throw new Error(`canon line "${u.text}" has two different clips`)
      }
      const input = renderElevenLabsText(u.text, tier)
      out.served.set(u.text, u.audio.base64)
      out.inputs.set(u.text, input)
      out.servedInputs.add(input)
    }
  }
  return out
}

/** A math line's clip from `audio`, or `''` (awaiting its render). Throws
 *  when canon voices the text from another request: the clip would not be
 *  what a math render of the text sends. */
function servedClip(text: string, audio: CanonAudioIndex): string {
  const clip = audio.served.get(text)
  if (clip === undefined) return ''
  if (audio.inputs.get(text) !== renderElevenLabsText(text)) {
    throw new Error(`"${text}" is voiced from another request text`)
  }
  return clip
}

// --- The pool file --------------------------------------------------------

const problemOf = (id: string): number | null => {
  const m = /^math\.p(\d+)\./.exec(id)
  return m === null ? null : Number(m[1])
}

/** `lines` with `pool` after the last line of problems 1–8. */
function withPool<T extends Line>(
  lines: readonly T[],
  pool: readonly T[],
): T[] {
  let at = 0
  lines.forEach((u, i) => {
    if (problemOf(u.id) !== null) at = i + 1
  })
  return [...lines.slice(0, at), ...pool, ...lines.slice(at)]
}

/** The blocks of `step`'s pool past its served 8, in pool order. */
export function freshBlocks(step: PoolStep, doc: CanonDoc): PoolBlock[] {
  const served = new Set(
    servedCanon(doc)
      .utterances.filter((u) => /^math\.p\d+\.read$/.test(u.id))
      .map((u) => u.text),
  )
  return poolBlocks(step).filter((b) => !served.has(b.lines[0]!))
}

/**
 * `step`'s canon file with its pool: the served session of `doc` as it
 * is, and every other fact of the step as p9..pN after its p8. Throws on a
 * 0-miss failure.
 */
export function generatePoolFile(
  step: PoolStep,
  doc: CanonDoc,
  audio: CanonAudioIndex,
): CanonDoc {
  const base = servedCanon(doc)
  const misses = zeroMisses(step, base)
  if (misses.length > 0) {
    throw new Error(
      `${step}: ${misses.length} template misses:\n  ${misses.join('\n  ')}`,
    )
  }
  const had = new Map(doc.utterances.map((u) => [u.id, u]))
  const pool = freshBlocks(step, base).flatMap((b, i) =>
    SLOTS.map((slot, k) => lineOf(`math.p${9 + i}.${slot}`, b.lines[k]!)),
  )
  const voiced: AudioLine[] = pool.map((l) => {
    const prev = had.get(l.id)
    if (
      prev !== undefined &&
      prev.text === l.text &&
      prev.audio.base64 !== ''
    ) {
      return { ...l, audio: prev.audio }
    }
    return {
      ...l,
      audio: {
        kind: 'inline',
        base64: servedClip(l.text, audio),
        mime: 'audio/mpeg',
      },
    }
  })
  return {
    ...base,
    plan: { ...base.plan, utterances: withPool(base.plan.utterances, pool) },
    utterances: withPool(base.utterances, voiced),
  }
}

// --- The render bill ------------------------------------------------------

export interface StepBill {
  step: PoolStep
  /** New blocks (problems 9..N). */
  blocks: number
  /** New request texts this step adds first (= voice-QA rows). */
  lines: number
  /** Their characters through `renderElevenLabsText`. */
  chars: number
}

export interface RenderBill {
  steps: StepBill[]
  total: { blocks: number; lines: number; chars: number }
}

/**
 * What the Lily render of the pools costs: every pool line's request text
 * (`renderElevenLabsText(text)`, no tier for math) once, left out when a
 * served canon line was rendered from it. Steps in `MATH_POOL_STEPS` order;
 * a text two steps share counts for the first. `only` keeps the blocks it
 * accepts (the scenario-D subset); the rest add nothing.
 */
export function poolRenderBill(
  root: string = CANON_ROOT,
  only: (block: PoolBlock) => boolean = () => true,
): RenderBill {
  const { servedInputs } = canonAudioIndex(root)
  const billed = new Set<string>()
  const steps = MATH_POOL_STEPS.map((step): StepBill => {
    const doc = readDoc(join(root, 'math', 'level-1', `${step}.json`))
    const blocks = freshBlocks(step, doc).filter(only)
    let lines = 0
    let chars = 0
    for (const b of blocks) {
      for (const text of b.lines) {
        const input = renderElevenLabsText(text)
        if (servedInputs.has(input) || billed.has(input)) continue
        billed.add(input)
        lines += 1
        chars += input.length
      }
    }
    return { step, blocks: blocks.length, lines, chars }
  })
  const sum = (k: 'blocks' | 'lines' | 'chars') =>
    steps.reduce((n, s) => n + s[k], 0)
  return {
    steps,
    total: { blocks: sum('blocks'), lines: sum('lines'), chars: sum('chars') },
  }
}

function printBill(title: string, bill: RenderBill): void {
  console.log(title)
  console.log('step\tnew blocks\tnew lines\tnew chars')
  for (const s of bill.steps) {
    console.log(`${s.step}\t${s.blocks}\t${s.lines}\t${s.chars}`)
  }
  const t = bill.total
  console.log(`total\t${t.blocks}\t${t.lines}\t${t.chars}`)
}

function main(): void {
  const check = process.argv.includes('--check')
  const audio = canonAudioIndex()
  const stale: string[] = []
  for (const step of MATH_POOL_STEPS) {
    const path = join(MATH_POOL_CANON_DIR, `${step}.json`)
    const text = readFileSync(path, 'utf8')
    const want = JSON.stringify(generatePoolFile(step, readDoc(path), audio))
    if (want === text) continue
    if (check) stale.push(step)
    else writeFileSync(path, want)
  }
  if (stale.length > 0) {
    console.error(
      `math pools out of date (run npx tsx scripts/generateMathPools.ts): ${stale.join(', ')}`,
    )
    process.exit(1)
  }
  console.log(
    `math pools: 0 template misses on ${MATH_POOL_STEPS.length} steps; files ${check ? 'up to date' : 'written'}.`,
  )
  const all = poolRenderBill()
  printBill('Render bill (scenario C):', all)
  const dave = poolRenderBill(CANON_ROOT, (b) => b.dave)
  printBill(
    "Of which Dave's pools (scenario D's closed math, no div-share):",
    dave,
  )
  console.log(
    `C beyond D on its own: ${all.total.blocks - dave.total.blocks} blocks, ` +
      `${all.total.lines - dave.total.lines} lines, ${all.total.chars - dave.total.chars} chars`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
