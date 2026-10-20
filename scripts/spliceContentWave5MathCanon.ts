/**
 * Content wave 5's Number Garden canon, written deterministically: zeros,
 * `hundreds-zeros` (`design/native/content-wave-5.md` § 2.7), from
 * `HUNDREDS_ZEROS_PLAN` (`hundredsZerosCanonCheck.ts`), and adding big
 * numbers, `add-two-digit` (§ 3.7), from `ADD_TWO_DIGIT_PLAN`
 * (`addTwoDigitCanonCheck.ts`). The Word Song half of the wave (snail
 * words, moon words, goat stories) has its own splice,
 * `spliceContentWave5Canon.ts`.
 *
 * Why a splice, not a Haiku bake: every line is fixed by § 2.7's and
 * § 3.7's tables, so a script writes it exactly and spends no Anthropic
 * credit, as waves 3 and 4 did. Both steps are in `PENDING_CANON_NODES`,
 * so an ordinary bake never draws them.
 *
 * - The 8 problems of each: the plan's lines, held to the spec's lint.
 * - `session.end.*`: every math file's lines (taken from hundreds'), with
 *   the step's recap ("You worked on zeros today!", "… adding big numbers
 *   today!").
 *
 * Audio: math lines render with no tier, so a text any math canon file
 * already carries reuses those bytes (wave 2's rule): "Hmm... try again?",
 * the "Look at the …" hints, "One more ten.", "How many?" and the
 * session-end lines. A new text gets an empty `audio.base64`: awaiting its
 * Lily render, which `npx tsx scripts/revoiceCanonLily.ts --unrendered`
 * fills without touching any other clip. Until then the native app walks
 * that line's caption silently.
 *
 * Idempotent: a second run (also after the render) writes the same bytes.
 *
 * Run: npx tsx scripts/spliceContentWave5MathCanon.ts
 * Then: npx tsx scripts/generateCanonMathFacts.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADD_TWO_DIGIT_PLAN,
  ADD_TWO_DIGIT_RECAP_FOCUS,
  addTwoDigitCanonViolations,
  addTwoDigitLines,
  addTwoDigitRuleViolations,
} from './addTwoDigitCanonCheck.ts'
import { HUNDREDS_SLOTS } from './hundredsCanonCheck.ts'
import {
  HUNDREDS_ZEROS_PLAN,
  HUNDREDS_ZEROS_RECAP_FOCUS,
  hundredsZerosCanonViolations,
  hundredsZerosLines,
  hundredsZerosRuleViolations,
} from './hundredsZerosCanonCheck.ts'
import { MATH_CANON_DIR } from './spliceContentWave1Canon.ts'
import { awaitingRender, type CanonDoc } from './spliceContentWave3Canon.ts'

/** Zeros' canon file stem (`math/level-1/hundreds-zeros.json`). */
export const HUNDREDS_ZEROS_FILE = 'hundreds-zeros'
/** Adding big numbers' canon file stem (`math/level-1/add-two-digit.json`). */
export const ADD_TWO_DIGIT_FILE = 'add-two-digit'

/** The math file whose `session.end.*` lines both steps take. */
const MATH_SESSION_END_SOURCE = 'hundreds'

type AudioLine = CanonDoc['utterances'][number]

const readMathDoc = (stem: string): CanonDoc =>
  JSON.parse(readFileSync(join(MATH_CANON_DIR, `${stem}.json`), 'utf8'))

/** text → bytes over every math canon file (the first rendered copy). Math
 *  lines render with no tier, so the same text is the same request. */
function mathAudioIndex(): Map<string, string> {
  const index = new Map<string, string>()
  for (const f of readdirSync(MATH_CANON_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort())
    for (const u of readMathDoc(f.replace(/\.json$/, '')).utterances)
      if (u.audio.base64 !== '' && !index.has(u.text))
        index.set(u.text, u.audio.base64)
  return index
}

/** One step's file: its 8 problems' lines, then the session-end lines with
 *  its recap. */
function spliceStep(
  stem: string,
  label: string,
  problemLines: readonly (readonly string[])[],
  recap: string,
  drift: (u: readonly AudioLine[]) => string[],
): CanonDoc {
  const audio = mathAudioIndex()
  const line = (id: string, text: string): AudioLine => ({
    id,
    text,
    audio: {
      kind: 'inline',
      base64: audio.get(text) ?? '',
      mime: 'audio/mpeg',
    },
  })
  const utterances: AudioLine[] = problemLines.flatMap((lines, i) =>
    HUNDREDS_SLOTS.map((slot, k) => line(`math.p${i + 1}.${slot}`, lines[k]!)),
  )
  for (const u of readMathDoc(MATH_SESSION_END_SOURCE).utterances) {
    if (!u.id.startsWith('session.end.')) continue
    utterances.push(
      line(u.id, u.id === 'session.end.recap.focus' ? recap : u.text),
    )
  }
  const broken = drift(utterances)
  if (broken.length > 0)
    throw new Error(`${stem} splice drifted:\n  ${broken.join('\n  ')}`)
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: `${stem}-level-1`,
      label,
      utterances: utterances.map(({ id, text }) => ({ id, text })),
    },
    utterances,
  }
}

/** The zeros file's content (§ 2.7). */
export function spliceHundredsZeros(): CanonDoc {
  const broken = hundredsZerosRuleViolations(HUNDREDS_ZEROS_PLAN)
  if (broken.length > 0)
    throw new Error(`zeros plan breaks § 2.7:\n  ${broken.join('\n  ')}`)
  return spliceStep(
    HUNDREDS_ZEROS_FILE,
    'Zeros — Level 1',
    HUNDREDS_ZEROS_PLAN.map(hundredsZerosLines),
    HUNDREDS_ZEROS_RECAP_FOCUS,
    hundredsZerosCanonViolations,
  )
}

/** The adding-big-numbers file's content (§ 3.7). */
export function spliceAddTwoDigit(): CanonDoc {
  const broken = addTwoDigitRuleViolations(ADD_TWO_DIGIT_PLAN)
  if (broken.length > 0)
    throw new Error(
      `adding-big-numbers plan breaks § 3.7:\n  ${broken.join('\n  ')}`,
    )
  return spliceStep(
    ADD_TWO_DIGIT_FILE,
    'Adding big numbers — Level 1',
    ADD_TWO_DIGIT_PLAN.map((spec, i) => addTwoDigitLines(spec, i + 1)),
    ADD_TWO_DIGIT_RECAP_FOCUS,
    addTwoDigitCanonViolations,
  )
}

function main(): void {
  for (const [stem, doc] of [
    [HUNDREDS_ZEROS_FILE, spliceHundredsZeros()],
    [ADD_TWO_DIGIT_FILE, spliceAddTwoDigit()],
  ] as const) {
    writeFileSync(join(MATH_CANON_DIR, `${stem}.json`), JSON.stringify(doc))
    const waiting = awaitingRender(doc)
    console.log(
      `wrote ${stem}; ${waiting.length} new texts awaiting their render ` +
        `(${waiting.reduce((n, t) => n + t.length, 0)} characters):`,
    )
    for (const t of waiting) console.log(`  ${t.length}\t${t}`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
