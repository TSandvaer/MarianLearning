/**
 * Content wave 4's Number Garden canon, written deterministically: more
 * and less, `hundreds-addsub` (`design/native/content-wave-4.md` § 2.7),
 * from `HUNDREDS_ADDSUB_PLAN` (`hundredsAddsubCanonCheck.ts`). The Word
 * Song half of the wave (bee words, car words, sheep stories) has its own
 * splice, `spliceContentWave4Canon.ts`.
 *
 * Why a splice, not a Haiku bake: every line is fixed by § 2.7's table, so
 * a script writes it exactly and spends no Anthropic credit, as wave 3's
 * did for hundreds. The step is in `PENDING_CANON_NODES`, so an ordinary
 * bake never draws it.
 *
 * - The 8 problems: `HUNDREDS_ADDSUB_PLAN`'s lines, held to § 2.7's lint
 *   (`hundredsAddsubCanonViolations`).
 * - `session.end.*`: every math file's lines (taken from hundreds'), with
 *   the recap "You worked on more and less today!".
 *
 * Audio: math lines render with no tier, so a text any math canon file
 * already carries reuses those bytes (wave 2's rule): "Hmm... try again?",
 * "Look at the hundreds.", "Look at the tens." and the session-end lines.
 * A new text gets an empty `audio.base64`: awaiting its Lily render, which
 * `npx tsx scripts/revoiceCanonLily.ts --unrendered` fills without touching
 * any other clip. Until then the native app walks that line's caption
 * silently.
 *
 * Idempotent: a second run (also after the render) writes the same bytes.
 *
 * Run: npx tsx scripts/spliceContentWave4MathCanon.ts
 * Then: npx tsx scripts/generateCanonMathFacts.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HUNDREDS_ADDSUB_PLAN,
  HUNDREDS_ADDSUB_RECAP_FOCUS,
  hundredsAddsubCanonViolations,
  hundredsAddsubLines,
  hundredsAddsubRuleViolations,
} from './hundredsAddsubCanonCheck.ts'
import { HUNDREDS_SLOTS } from './hundredsCanonCheck.ts'
import { MATH_CANON_DIR } from './spliceContentWave1Canon.ts'
import { awaitingRender, type CanonDoc } from './spliceContentWave3Canon.ts'

/** More and less's canon file stem (`math/level-1/hundreds-addsub.json`). */
export const HUNDREDS_ADDSUB_FILE = 'hundreds-addsub'

/** The math file whose `session.end.*` lines more and less takes. */
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

/** The more-and-less file's content (its plan, then its audio-bearing
 *  lines). */
export function spliceHundredsAddsub(): CanonDoc {
  const broken = hundredsAddsubRuleViolations(HUNDREDS_ADDSUB_PLAN)
  if (broken.length > 0)
    throw new Error(
      `more-and-less plan breaks § 2.7:\n  ${broken.join('\n  ')}`,
    )
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
  const utterances: AudioLine[] = HUNDREDS_ADDSUB_PLAN.flatMap((spec, i) => {
    const lines = hundredsAddsubLines(spec)
    return HUNDREDS_SLOTS.map((slot, k) =>
      line(`math.p${i + 1}.${slot}`, lines[k]!),
    )
  })
  for (const u of readMathDoc(MATH_SESSION_END_SOURCE).utterances) {
    if (!u.id.startsWith('session.end.')) continue
    utterances.push(
      line(
        u.id,
        u.id === 'session.end.recap.focus'
          ? HUNDREDS_ADDSUB_RECAP_FOCUS
          : u.text,
      ),
    )
  }
  const drift = hundredsAddsubCanonViolations(utterances)
  if (drift.length > 0)
    throw new Error(`more-and-less splice drifted:\n  ${drift.join('\n  ')}`)
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: `${HUNDREDS_ADDSUB_FILE}-level-1`,
      label: 'More and less — Level 1',
      utterances: utterances.map(({ id, text }) => ({ id, text })),
    },
    utterances,
  }
}

function main(): void {
  const doc = spliceHundredsAddsub()
  writeFileSync(
    join(MATH_CANON_DIR, `${HUNDREDS_ADDSUB_FILE}.json`),
    JSON.stringify(doc),
  )
  const waiting = awaitingRender(doc)
  console.log(
    `wrote ${HUNDREDS_ADDSUB_FILE}; ${waiting.length} new texts awaiting ` +
      `their render (${waiting.reduce((n, t) => n + t.length, 0)} ` +
      `characters):`,
  )
  for (const t of waiting) console.log(`  ${t.length}\t${t}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
