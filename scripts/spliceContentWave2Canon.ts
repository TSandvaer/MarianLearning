/**
 * Content wave 2's Number Garden canon, sharing (`div-share`,
 * `design/native/content-wave-2.md` § 2.7), written deterministically.
 *
 * Why a splice, not a Haiku bake: every line is fixed by the spec (§ 2.7 is
 * binding), so a script writes it exactly and spends no Anthropic credit,
 * as `spliceContentWave1Canon.ts` did for wave 1's math. `div-share` is in
 * `PENDING_CANON_NODES`, so an ordinary bake never draws it.
 *
 * - The 8 problems: `SHARE_PLAN`'s lines (`shareCanonCheck.ts`), held to the
 *   § 2.7 rules before anything is written.
 * - `session.end.*`: every math file's lines (taken from mult-mix's), with
 *   the recap "You worked on sharing today!".
 *
 * Audio: a text some math canon file already carries reuses those bytes
 * (math lines render with no tier, so the ElevenLabs request and its bytes
 * are the same, `scripts/revoiceCanonLily.ts`): "Hmm... try again?", "Look
 * at the flowers.", "This one is two." … "This one is six." and the shared
 * session-end lines. A new text gets an empty `audio.base64`: awaiting its
 * Lily render, which `npx tsx scripts/revoiceCanonLily.ts --unrendered`
 * fills without touching any other clip. Until then the native app walks
 * that line's caption silently (`mobile/src/audio/sessionAudio.ts`).
 *
 * Idempotent: a second run (also after the render) writes the same bytes.
 *
 * Run: npx tsx scripts/spliceContentWave2Canon.ts
 * Then: npx tsx scripts/generateCanonMathFacts.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SHARE_PLAN,
  SHARE_RECAP_FOCUS,
  SHARE_SLOTS,
  shareCanonViolations,
  shareLines,
  shareRuleViolations,
} from './shareCanonCheck.ts'
import { MATH_CANON_DIR } from './spliceContentWave1Canon.ts'

export const SHARE_FILE = 'div-share'

interface Line {
  id: string
  text: string
}
interface AudioLine extends Line {
  audio: { kind: 'inline'; base64: string; mime: 'audio/mpeg' }
}
export interface CanonDoc {
  ok: true
  kind: 'session-start'
  plan: { id: string; label: string; utterances: Line[] }
  utterances: AudioLine[]
}

const readDoc = (file: string): CanonDoc =>
  JSON.parse(readFileSync(join(MATH_CANON_DIR, `${file}.json`), 'utf8'))

/** text → bytes over every math canon file (the first rendered copy). */
function audioIndex(): Map<string, string> {
  const index = new Map<string, string>()
  for (const f of readdirSync(MATH_CANON_DIR).filter((f) =>
    f.endsWith('.json'),
  ))
    for (const u of readDoc(f.replace(/\.json$/, '')).utterances)
      if (u.audio.base64 !== '' && !index.has(u.text))
        index.set(u.text, u.audio.base64)
  return index
}

/** The sharing file's content (its plan, then its audio-bearing lines). */
export function spliceShare(): CanonDoc {
  const broken = shareRuleViolations(SHARE_PLAN)
  if (broken.length > 0)
    throw new Error(`div-share plan breaks § 2.7:\n  ${broken.join('\n  ')}`)
  const audio = audioIndex()
  const line = (id: string, text: string): AudioLine => ({
    id,
    text,
    audio: {
      kind: 'inline',
      base64: audio.get(text) ?? '',
      mime: 'audio/mpeg',
    },
  })
  const utterances: AudioLine[] = SHARE_PLAN.flatMap((spec, i) => {
    const lines = shareLines(spec)
    return SHARE_SLOTS.map((slot, k) =>
      line(`math.p${i + 1}.${slot}`, lines[k]!),
    )
  })
  for (const u of readDoc('mult-mix').utterances) {
    if (!u.id.startsWith('session.end.')) continue
    utterances.push(
      u.id === 'session.end.recap.focus'
        ? line(u.id, SHARE_RECAP_FOCUS)
        : line(u.id, u.text),
    )
  }
  const drift = shareCanonViolations(utterances)
  if (drift.length > 0)
    throw new Error(`div-share splice drifted:\n  ${drift.join('\n  ')}`)
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: 'div-share-level-1',
      label: 'Sharing — Level 1',
      utterances: utterances.map(({ id, text }) => ({ id, text })),
    },
    utterances,
  }
}

/** The file's distinct texts whose audio is not rendered yet, in order. */
export function shareAwaitingRender(doc: CanonDoc): string[] {
  return [
    ...new Set(
      doc.utterances.filter((u) => u.audio.base64 === '').map((u) => u.text),
    ),
  ]
}

function main(): void {
  const doc = spliceShare()
  writeFileSync(join(MATH_CANON_DIR, `${SHARE_FILE}.json`), JSON.stringify(doc))
  const waiting = shareAwaitingRender(doc)
  console.log(
    `wrote ${SHARE_FILE}; ${waiting.length} new texts awaiting their render ` +
      `(${waiting.reduce((n, t) => n + t.length, 0)} characters):`,
  )
  for (const t of waiting) console.log(`  ${t.length}\t${t}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
