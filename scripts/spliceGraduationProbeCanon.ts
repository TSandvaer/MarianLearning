/**
 * The cvc-words graduation check's probe lines (Thomas 2026-10-23: "App
 * builds the check itself"). There is one block per probe word, core's
 * `GRADUATION_PROBE_WORDS`: today's four (nap, rat, map, tap, p1-p4) and
 * the reserve's five new words (ham, cab, rag, ram, pad, p5-p9; Dave
 * 2026-10-24), in cvc-words' own slot texts, so a probe problem reads
 * exactly like a canon one. The device serves a word only once its five
 * lines have audio (core `renderedProbeWords`). The native app bundles
 * this file (`mobile/scripts/export-audio.mjs`) and swaps three of a
 * cvc-words session's problems for its blocks
 * (`@marian/core/wordSong/graduationCheck`).
 *
 * - Lines: cvc-words' problem 1 ("hat") with its word replaced: read,
 *   correct, hint, giveAnswer, and the blend "n - a - p ... nap". There is no
 *   reprompt: a swapped problem keeps the session's "Hmm... try again?".
 * - Never served: no focus node is `cvc-words-probe`, so the canon reader
 *   never resolves it.
 *
 * Audio is kept from the file while an id's text is unchanged. A new text
 * gets an empty `audio.base64`, awaiting its Lily render, which
 * `npx tsx scripts/revoiceCanonLily.ts --unrendered --only cvc-words-probe`
 * fills. Idempotent: a second run (also after the render) writes the same
 * bytes.
 *
 * Run: npx tsx scripts/spliceGraduationProbeCanon.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GRADUATION_PROBE_WORDS } from '@marian/core/wordSong/novelProbeWords'
import {
  WORD_CANON_DIR,
  awaitingRender,
  type CanonDoc,
} from './spliceContentWave3Canon.ts'

export const PROBE_STEM = 'cvc-words-probe'
export const PROBE_CANON_PATH = join(WORD_CANON_DIR, `${PROBE_STEM}.json`)

/** cvc-words' problem 1, whose lines are the template. */
const TEMPLATE_WORD = 'hat'
const SLOTS = ['read', 'correct', 'hint', 'giveAnswer', 'blend'] as const

type Line = { id: string; text: string }

const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

/** "n - a - p ... nap": the planner's CVC blend shape. */
const blendOf = (word: string) => `${[...word].join(' - ')} ... ${word}`

const readDoc = (path: string): CanonDoc =>
  JSON.parse(readFileSync(path, 'utf8'))

/** cvc-words' problem-1 `slot` line, its word replaced by `word`. */
function lineFor(
  canon: CanonDoc,
  slot: (typeof SLOTS)[number],
  word: string,
): string {
  const text = canon.plan.utterances.find(
    (u) => u.id === `word.p1.${slot}`,
  )?.text
  if (text === undefined) throw new Error(`cvc-words has no word.p1.${slot}`)
  if (slot === 'blend') {
    if (text !== blendOf(TEMPLATE_WORD)) {
      throw new Error(`cvc-words word.p1.blend "${text}" is not hat's blend`)
    }
    return blendOf(word)
  }
  const out = text.replace(/\bhat\b/, word).replace(/\bHat\b/, capitalize(word))
  if (out === text) {
    throw new Error(`cvc-words word.p1.${slot} "${text}" does not name hat`)
  }
  return out
}

/** The probe lines: `word.p<i>.<slot>`, word i of `GRADUATION_PROBE_WORDS`. */
export function probeLines(
  canon: CanonDoc = readDoc(join(WORD_CANON_DIR, 'cvc-words.json')),
): Line[] {
  return GRADUATION_PROBE_WORDS.flatMap((word, i) =>
    SLOTS.map((slot) => ({
      id: `word.p${i + 1}.${slot}`,
      text: lineFor(canon, slot, word),
    })),
  )
}

/** The file, keeping each line's audio while its text is unchanged. */
export function spliceProbeCanon(): CanonDoc {
  const prev = existsSync(PROBE_CANON_PATH) ? readDoc(PROBE_CANON_PATH) : null
  const kept = new Map(
    (prev?.utterances ?? []).map((u) => [`${u.id}|${u.text}`, u.audio.base64]),
  )
  const lines = probeLines()
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: PROBE_STEM,
      label: 'CVC Words Graduation Probe Words',
      utterances: lines,
    },
    utterances: lines.map((l) => ({
      ...l,
      audio: {
        kind: 'inline',
        base64: kept.get(`${l.id}|${l.text}`) ?? '',
        mime: 'audio/mpeg',
      },
    })),
  }
}

function main(): void {
  const doc = spliceProbeCanon()
  writeFileSync(PROBE_CANON_PATH, JSON.stringify(doc))
  const waiting = awaitingRender(doc)
  console.log(
    `${PROBE_STEM}: ${doc.utterances.length} lines, ${waiting.length} awaiting render`,
  )
  for (const t of waiting) console.log(`  ${t}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
