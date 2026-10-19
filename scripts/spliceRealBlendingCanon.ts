/**
 * Real blending's Word Song canon, written deterministically: blending
 * sounds' replaced file (`'listen-blend'`: "Listen.", Emma says the sounds)
 * and sounding out's new one (`'sound-out'`: "What is it?", the learner
 * taps the letters), `design/native/real-blending.md` § 6.
 *
 * Why a splice, not a Haiku bake: every line is fixed by § 6's tables, so a
 * script writes it exactly and spends no Anthropic credit. Both steps are in
 * `PENDING_CANON_NODES`, so an ordinary bake never draws them, and a
 * `--force` bake can't rewrite blending-cv's file with Haiku's "Tap the
 * <word>." plan (Decision 4).
 *
 * - Lines: each problem is the shipped five slots plus `blend`; the read is
 *   the step's (`LISTEN_BLEND_READ` / `SOUND_OUT_READ`), every reprompt
 *   "Hmm... try again?". `session.end.*`: the shipped blending-cv block,
 *   copied verbatim; sounding out's with its own recap.
 * - Chips are not in canon: the deal gives them by position from
 *   `TARGET_PAIRINGS` (gentle on P1–P3, trap on P4–P8). § 6's chips column
 *   is what the deal must produce, so the lints check it.
 *
 * Audio: the index of existing bytes is built from every Word Song canon
 * file BEFORE either file is written, keyed by its ElevenLabs request
 * (`renderElevenLabsText` with that file's tier), the other files first,
 * then the two this script writes. So stop 1's 8 blends and their lines take
 * cvc-words' bytes, and the old blending-cv.json's "Yes! Dad!", "Let's look.
 * Can." and the rest carry into sounding-out.json with theirs. A new text
 * gets an empty `audio.base64`: awaiting its Lily render, which
 * `npx tsx scripts/revoiceCanonLily.ts --unrendered` fills without touching
 * any other clip. Until then the native app walks that line's caption
 * silently.
 *
 * Lints (§ 6; the script throws on any): every blend has the planner's CVC
 * shape "<g1> - <g2> - <g3> ... <word>" (ASCII only, word length + 1
 * tokens, letters in spelling order); a problem's correct, hint and
 * giveAnswer lines name its blend's word and no other target; no novel
 * probe word is a target or a chip; the deal gives § 6's chips, with no
 * `FORBIDDEN_PAIRS` pair in a trio and f and v never in one trio; both
 * files parse 8/8 with the native options.
 *
 * Idempotent: a second run (also after the render) writes the same bytes.
 *
 * Run: npx tsx scripts/spliceRealBlendingCanon.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LISTEN_BLEND_READ,
  SOUND_OUT_READ,
  wordSongSessionPlanFromServer,
} from '@marian/core/wordSong/planFromServer'
import { buildWordChipOrder } from '@marian/core/wordSong/wordChips'
import { TARGET_WORDS, isForbiddenPair } from '@marian/core/wordSong/wordPack'
import { renderElevenLabsText } from '../api/_tts_elevenlabs.js'
import { WORD_SONG_NOVEL_PROBE_WORDS } from '../api/_plannerWordList.js'
import { tierFor } from './lilyCanonLib.ts'
import {
  WORD_CANON_DIR,
  awaitingRender,
  type CanonDoc,
} from './spliceContentWave3Canon.ts'

export { awaitingRender, type CanonDoc }

/** The two steps this script writes, in tree order. */
export const REAL_BLENDING_STEPS = ['blending-cv', 'sounding-out'] as const
export type RealBlendingStep = (typeof REAL_BLENDING_STEPS)[number]

/** § 6's rows: the word, then the deal's chips with the word first. */
const TABLE: Record<
  RealBlendingStep,
  ReadonlyArray<readonly [string, readonly [string, string]]>
> = {
  // Continuant onsets first (f, m, v, h), then stops; cvc-words' 8 words,
  // so every blend reuses cvc-words' bytes and marks.
  'blending-cv': [
    ['fan', ['dog', 'bus']],
    ['man', ['cup', 'log']],
    ['van', ['pen', 'cup']],
    ['hat', ['cat', 'bag']],
    ['cat', ['bat', 'cap']],
    ['bag', ['tag', 'bat']],
    ['pan', ['fan', 'man']],
    ['tag', ['bag', 'bat']],
  ],
  // Two words from stop 1 while the learner learns the taps, then six new.
  'sounding-out': [
    ['fan', ['dog', 'bus']],
    ['man', ['cup', 'log']],
    ['mat', ['pen', 'dog']],
    ['bat', ['cat', 'hat']],
    ['can', ['fan', 'man']],
    ['cap', ['cat', 'bag']],
    ['dad', ['bag', 'bat']],
    ['jam', ['bag', 'pan']],
  ],
}

const READ: Record<RealBlendingStep, string> = {
  'blending-cv': LISTEN_BLEND_READ,
  'sounding-out': SOUND_OUT_READ,
}

const CONTENT_TYPE: Record<RealBlendingStep, string> = {
  'blending-cv': 'listen-blend',
  'sounding-out': 'sound-out',
}

/** Plan id and label: blending-cv's are kept. */
const PLAN: Record<RealBlendingStep, readonly [string, string]> = {
  'blending-cv': ['blending-cv-level-1', 'Word Song Blending CV Level 1'],
  'sounding-out': ['sounding-out-level-1', 'Word Song Sounding Out Level 1'],
}

const RECAP: Record<RealBlendingStep, string> = {
  'blending-cv': 'You worked on blending sounds today!',
  'sounding-out': 'You worked on sounding out today!',
}

/** dad and jam keep the shipped blending-cv lines' short form. */
const SHORT_CORRECT: ReadonlySet<string> = new Set(['dad', 'jam'])

const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

/** "f - a - n ... fan": the planner's CVC blend shape. */
const blendOf = (word: string) => `${[...word].join(' - ')} ... ${word}`

type Line = { id: string; text: string }
type AudioLine = CanonDoc['utterances'][number]

const readDoc = (stem: string): CanonDoc =>
  JSON.parse(readFileSync(join(WORD_CANON_DIR, `${stem}.json`), 'utf8'))

const tierOf = (stem: string): string | undefined =>
  tierFor(`word-song/level-1/${stem}.json`)

/** The step's problem lines (§ 6), slot order as cvc-words'. */
function problemLines(step: RealBlendingStep): Line[] {
  return TABLE[step].flatMap(([word], i) => {
    const p = `word.p${i + 1}`
    return [
      { id: `${p}.read`, text: READ[step] },
      {
        id: `${p}.correct`,
        text: SHORT_CORRECT.has(word)
          ? `Yes! ${capitalize(word)}!`
          : `Yes! That's a ${word}.`,
      },
      { id: `${p}.reprompt`, text: 'Hmm... try again?' },
      { id: `${p}.hint`, text: `Let's look. ${capitalize(word)}.` },
      { id: `${p}.giveAnswer`, text: `This one is ${word}.` },
      { id: `${p}.blend`, text: blendOf(word) },
    ]
  })
}

/** The shipped session end (blending-cv's), with the step's recap. */
function sessionEndLines(step: RealBlendingStep): Line[] {
  return readDoc('blending-cv')
    .utterances.filter((u) => u.id.startsWith('session.end.'))
    .map((u) => ({
      id: u.id,
      text: u.id === 'session.end.recap.focus' ? RECAP[step] : u.text,
    }))
}

/**
 * ElevenLabs request → bytes over every Word Song canon file, the other
 * files first (the first rendered copy), then the two this script writes:
 * on the first run the old blending-cv.json gives can, dad and jam their
 * bytes; on a re-run sounding-out.json does.
 */
export function realBlendingAudioIndex(): Map<string, string> {
  const own = new Set<string>(REAL_BLENDING_STEPS)
  const stems = readdirSync(WORD_CANON_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
  const ordered = [
    ...stems.filter((s) => !own.has(s)).sort(),
    ...REAL_BLENDING_STEPS.filter((s) => stems.includes(s)),
  ]
  const index = new Map<string, string>()
  for (const stem of ordered)
    for (const u of readDoc(stem).utterances) {
      const request = renderElevenLabsText(u.text, tierOf(stem))
      if (u.audio.base64 !== '' && !index.has(request))
        index.set(request, u.audio.base64)
    }
  return index
}

/** A step's file; `audio` is the index built before anything is written. */
export function spliceRealBlendingStep(
  step: RealBlendingStep,
  audio: ReadonlyMap<string, string> = realBlendingAudioIndex(),
): CanonDoc {
  const line = ({ id, text }: Line): AudioLine => ({
    id,
    text,
    audio: {
      kind: 'inline',
      base64: audio.get(renderElevenLabsText(text, tierOf(step))) ?? '',
      mime: 'audio/mpeg',
    },
  })
  const utterances = [...problemLines(step), ...sessionEndLines(step)].map(line)
  const [id, label] = PLAN[step]
  const doc: CanonDoc = {
    ok: true,
    kind: 'session-start',
    plan: {
      id,
      label,
      utterances: utterances.map(({ id, text }) => ({ id, text })),
    },
    utterances,
  }
  const broken = realBlendingViolations(step, doc)
  if (broken.length > 0)
    throw new Error(`${step} splice breaks § 6:\n  ${broken.join('\n  ')}`)
  return doc
}

/** The picture targets (a sight word such as "is" is no picture). */
const TARGETS: ReadonlySet<string> = new Set(
  TARGET_WORDS.filter((w) => w.sightWord !== true).map((w) => w.word),
)
const PROBES: ReadonlySet<string> = new Set(WORD_SONG_NOVEL_PROBE_WORDS)

/** The words of a line, lower-cased. */
const wordsOf = (text: string): string[] =>
  text.toLowerCase().match(/[a-z]+/g) ?? []

/** § 6's lints over a step's file; empty = clean. */
export function realBlendingViolations(
  step: RealBlendingStep,
  doc: CanonDoc,
): string[] {
  const out: string[] = []
  const text = (id: string) =>
    doc.plan.utterances.find((u) => u.id === id)?.text
  TABLE[step].forEach(([word, wrong], i) => {
    const p = `P${i + 1}`
    const blend = text(`word.p${i + 1}.blend`) ?? ''
    // The planner's CVC blend shape (api/_planner.ts, the phoneme-blend
    // prompt): ASCII, the letters in spelling order, then the word.
    if (!/^[\x20-\x7e]+$/.test(blend)) out.push(`${p}: blend is not ASCII`)
    const tokens = blend.split(/\s+/).filter((t) => !/^(?:-|\.\.\.)$/.test(t))
    if (tokens.length !== word.length + 1)
      out.push(`${p}: blend "${blend}" has ${tokens.length} tokens`)
    if (blend !== blendOf(word))
      out.push(`${p}: blend "${blend}" is not "${blendOf(word)}"`)
    // The three lines that name a word name the blend's, and no other target.
    for (const slot of ['correct', 'hint', 'giveAnswer']) {
      const words = wordsOf(text(`word.p${i + 1}.${slot}`) ?? '')
      if (!words.includes(word))
        out.push(`${p}: ${slot} doesn't name "${word}"`)
      for (const w of words)
        if (w !== word && TARGETS.has(w))
          out.push(`${p}: ${slot} names another target "${w}"`)
    }
    for (const w of [word, ...wrong])
      if (PROBES.has(w)) out.push(`${p}: "${w}" is a novel probe word`)
  })
  // The deal, on the native parser (Devon's NATIVE_PARSE adds blendReads).
  let problems
  try {
    problems = wordSongSessionPlanFromServer(doc.plan, {
      littleStories: true,
      blendReads: true,
    }).problems
  } catch (err) {
    return [...out, `does not parse: ${(err as Error).message}`]
  }
  problems.forEach((problem, i) => {
    const p = `P${i + 1}`
    const [word, wrong] = TABLE[step][i]!
    if (problem.contentType !== CONTENT_TYPE[step])
      out.push(`${p}: parses as ${problem.contentType}`)
    if (problem.target.word !== word)
      out.push(`${p}: target "${problem.target.word}", not "${word}"`)
    const chips = buildWordChipOrder(problem, false).map((e) => e.word)
    if ([...chips].sort().join() !== [word, ...wrong].sort().join())
      out.push(`${p}: the deal gives ${chips.join(', ')}`)
    for (let a = 0; a < chips.length; a++)
      for (let b = a + 1; b < chips.length; b++)
        if (isForbiddenPair(chips[a]!, chips[b]!))
          out.push(`${p}: forbidden pair ${chips[a]}–${chips[b]}`)
    const onsets = new Set(chips.map((w) => w[0]))
    if (onsets.has('f') && onsets.has('v'))
      out.push(`${p}: f and v share a trio`)
  })
  return out
}

function main(): void {
  // Built once, before either file is written (§ 6 "Audio").
  const audio = realBlendingAudioIndex()
  const docs = REAL_BLENDING_STEPS.map(
    (step) => [step, spliceRealBlendingStep(step, audio)] as const,
  )
  const seen = new Set<string>()
  for (const [step, doc] of docs) {
    writeFileSync(join(WORD_CANON_DIR, `${step}.json`), JSON.stringify(doc))
    const waiting = awaitingRender(doc).filter((t) => !seen.has(t))
    for (const t of waiting) seen.add(t)
    console.log(
      `wrote ${step}; ${waiting.length} new texts awaiting their render ` +
        `(${waiting.reduce((n, t) => n + t.length, 0)} characters):`,
    )
    for (const t of waiting) console.log(`  ${t.length}\t${t}`)
  }
  const chars = [...seen].reduce((n, t) => n + t.length, 0)
  const sent = [...seen].reduce((n, t) => n + renderElevenLabsText(t).length, 0)
  console.log(`${seen.size} new texts, ${chars} characters (${sent} as sent)`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
