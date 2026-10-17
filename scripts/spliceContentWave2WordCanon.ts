/**
 * Content wave 2's Word Song canon, tent words and cake words
 * (`design/native/content-wave-2.md` § 3.2, § 4.2, § 6.2), written
 * deterministically.
 *
 * Why a splice, not a Haiku bake: every line is fixed by the spec (four
 * lines per word, the land-6 template of `bigWordsCanonCheck.ts`), so a
 * script writes it exactly and spends no Anthropic credit, as
 * `spliceContentWave1Canon.ts` did for wave 1's math. Both steps are in
 * `PENDING_CANON_NODES`, so an ordinary bake never draws them.
 *
 * - The 8 problems: `expectedBigWordsLines(step)` (the words of
 *   `bigWordsSteps.ts` in canon order), held to the spec by
 *   `bigWordsCanonViolations` before anything is written.
 * - `session.end.*`: duck words' lines (the same texts: every land-6 recap
 *   says "reading words").
 *
 * Audio: a text that a Word Song canon file already carries reuses those
 * bytes when its ElevenLabs request is the same (`renderElevenLabsText`
 * with that file's tier from `lilyCanonLib.ts`'s `tierFor`, as
 * `scripts/revoiceCanonLily.ts` renders it): "Hmm... try again?" and the
 * shared session-end lines. A new text gets an
 * empty `audio.base64`: awaiting its Lily render, which
 * `npx tsx scripts/revoiceCanonLily.ts --unrendered` fills without touching
 * any other clip. Until then the native app walks that line's caption
 * silently (`mobile/src/audio/sessionAudio.ts`).
 *
 * Idempotent: a second run (also after the render) writes the same bytes.
 *
 * Run: npx tsx scripts/spliceContentWave2WordCanon.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderElevenLabsText } from '../api/_tts_elevenlabs.js'
import {
  BIG_WORDS_RECAP_FOCUS,
  bigWordsCanonViolations,
  expectedBigWordsLines,
} from './bigWordsCanonCheck.ts'
import { tierFor } from './lilyCanonLib.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const WORD_CANON_DIR = join(
  ROOT,
  'public',
  'canon',
  'word-song',
  'level-1',
)

/** The two steps this script writes, in tree order. */
export const WAVE_2_WORD_STEPS = ['tent-words', 'cake-words'] as const
export type Wave2WordStep = (typeof WAVE_2_WORD_STEPS)[number]

/** The file whose `session.end.*` lines the new files take. */
const SESSION_END_SOURCE = 'duck-words'

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

const readDoc = (stem: string): CanonDoc =>
  JSON.parse(readFileSync(join(WORD_CANON_DIR, `${stem}.json`), 'utf8'))

/** A Word Song canon file's production tier (the render's own mapping). */
const tierOf = (stem: string): string | undefined =>
  tierFor(`word-song/level-1/${stem}.json`)

/**
 * ElevenLabs request → bytes over every Word Song canon file (the first
 * rendered copy). Keyed on the request, not the text, so a line whose
 * request a tier transforms (letter-sounds' IPA, simple-sentences' gap) is
 * never reused for a plain line.
 */
function audioIndex(skip: ReadonlySet<string>): Map<string, string> {
  const index = new Map<string, string>()
  const stems = readdirSync(WORD_CANON_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((stem) => !skip.has(stem))
    .sort()
  for (const stem of stems)
    for (const u of readDoc(stem).utterances) {
      const request = renderElevenLabsText(u.text, tierOf(stem))
      if (u.audio.base64 !== '' && !index.has(request))
        index.set(request, u.audio.base64)
    }
  return index
}

const label = (step: Wave2WordStep) =>
  `${step
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')} — Level 1`

/**
 * A step's file (its plan, then its audio-bearing lines). The audio index
 * skips this script's own files, so a re-run after the render keeps each
 * file's own bytes only through `keep` (the committed file's audio).
 */
export function spliceWordStep(step: Wave2WordStep): CanonDoc {
  const audio = audioIndex(new Set(WAVE_2_WORD_STEPS))
  const keep = ownAudio(step)
  const line = (id: string, text: string): AudioLine => {
    const request = renderElevenLabsText(text, tierOf(step))
    return {
      id,
      text,
      audio: {
        kind: 'inline',
        base64: audio.get(request) ?? keep.get(text) ?? '',
        mime: 'audio/mpeg',
      },
    }
  }
  const utterances: AudioLine[] = expectedBigWordsLines(step).map((u) =>
    line(u.id, u.text),
  )
  for (const u of readDoc(SESSION_END_SOURCE).utterances) {
    if (!u.id.startsWith('session.end.')) continue
    utterances.push(line(u.id, u.text))
  }
  const drift = bigWordsCanonViolations(step, utterances)
  const recap = utterances.find((u) => u.id === 'session.end.recap.focus')
  if (recap?.text !== BIG_WORDS_RECAP_FOCUS)
    drift.push(`session.end.recap.focus is "${recap?.text}"`)
  if (drift.length > 0)
    throw new Error(`${step} splice drifted:\n  ${drift.join('\n  ')}`)
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: `${step}-level-1`,
      label: label(step),
      utterances: utterances.map(({ id, text }) => ({ id, text })),
    },
    utterances,
  }
}

/** text → bytes of the step's committed file (empty when there is none). */
function ownAudio(step: Wave2WordStep): Map<string, string> {
  const own = new Map<string, string>()
  let doc: CanonDoc
  try {
    doc = readDoc(step)
  } catch {
    return own
  }
  for (const u of doc.utterances)
    if (u.audio.base64 !== '' && !own.has(u.text))
      own.set(u.text, u.audio.base64)
  return own
}

/** The file's distinct texts whose audio is not rendered yet, in order. */
export function awaitingRender(doc: CanonDoc): string[] {
  return [
    ...new Set(
      doc.utterances.filter((u) => u.audio.base64 === '').map((u) => u.text),
    ),
  ]
}

function main(): void {
  for (const step of WAVE_2_WORD_STEPS) {
    const doc = spliceWordStep(step)
    writeFileSync(join(WORD_CANON_DIR, `${step}.json`), JSON.stringify(doc))
    const waiting = awaitingRender(doc)
    console.log(
      `wrote ${step}; ${waiting.length} new texts awaiting their render ` +
        `(${waiting.reduce((n, t) => n + t.length, 0)} characters):`,
    )
    for (const t of waiting) console.log(`  ${t.length}\t${t}`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
