/**
 * Content wave 4's Word Song canon, written deterministically: bee words
 * and car words (`design/native/content-wave-4.md` § 3.2, § 4.2) in the
 * land-6 template, and sheep stories (§ 6.2) in wave 3's story format.
 * Number Garden's more-and-less is `spliceContentWave4MathCanon.ts`'s.
 *
 * Why a splice, not a Haiku bake: every line is fixed by the spec (the
 * big-words template of `bigWordsCanonCheck.ts`, the story rows of
 * `LITTLE_STORIES`), so a script writes it exactly and spends no Anthropic
 * credit, as waves 2 and 3 did. The three steps are in
 * `PENDING_CANON_NODES`, so an ordinary bake never draws them.
 *
 * - Bee and car words: `expectedBigWordsLines(step)`, held to the spec by
 *   `bigWordsCanonViolations`; `session.end.*`: duck words' lines (every
 *   word step's recap says "reading words").
 * - Sheep stories: wave 3's `spliceStoryStep` (the story lines, duck words'
 *   session end with the "reading stories" recap, the taught-words lint),
 *   plus § 6.2's own rules (`sheepStoryViolations`). The taught words read
 *   the committed canon, so bee and car words are written first: their 16
 *   targets become taught words.
 *
 * Audio: a text that another Word Song canon file already carries reuses
 * those bytes when its ElevenLabs request is the same (`renderElevenLabsText`
 * with that file's tier): "Hmm... try again?", the shared session-end lines,
 * and the sh step's 8 lines for sheep and shark ("Read the sheep.", "Yes!
 * That's a sheep.", "Let's look. Sheep.", "This one is sheep.", shark's 4),
 * which are word for word the bee and car lines (§ 8.1). A new text gets an
 * empty `audio.base64`: awaiting its Lily render, which
 * `npx tsx scripts/revoiceCanonLily.ts --unrendered` fills without touching
 * any other clip. Until then the native app walks that line's caption
 * silently.
 *
 * Idempotent: a second run (also after the render) writes the same bytes.
 *
 * Run: npx tsx scripts/spliceContentWave4Canon.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BIG_WORDS_STEPS,
  type BigWordsStep,
} from '@marian/core/wordSong/bigWordsSteps'
import {
  storiesOf,
  storySentences,
  storyWordKey,
  type LittleStory,
} from '@marian/core/wordSong/littleStories'
import { renderElevenLabsText } from '../api/_tts_elevenlabs.js'
import {
  BIG_WORDS_RECAP_FOCUS,
  bigWordsCanonViolations,
  expectedBigWordsLines,
} from './bigWordsCanonCheck.ts'
import { tierFor } from './lilyCanonLib.ts'
import {
  WAVE_3_STORY_STEPS,
  WORD_CANON_DIR,
  awaitingRender,
  spliceStoryStep,
  taughtWords,
  type CanonDoc,
} from './spliceContentWave3Canon.ts'

export { awaitingRender, type CanonDoc }

/** The two word steps this script writes, in tree order. */
export const WAVE_4_WORD_STEPS = ['bee-words', 'car-words'] as const
export type Wave4WordStep = (typeof WAVE_4_WORD_STEPS)[number]

/** The story step this script writes, after the word steps. */
export const WAVE_4_STORY_STEP = 'sheep-stories' as const

export type Wave4Step = Wave4WordStep | typeof WAVE_4_STORY_STEP

/** The file whose `session.end.*` lines the word steps take. */
const SESSION_END_SOURCE = 'duck-words'

type AudioLine = CanonDoc['utterances'][number]

const readDoc = (stem: string): CanonDoc =>
  JSON.parse(readFileSync(join(WORD_CANON_DIR, `${stem}.json`), 'utf8'))

const tierOf = (stem: string): string | undefined =>
  tierFor(`word-song/level-1/${stem}.json`)

/**
 * ElevenLabs request → bytes over every Word Song canon file but this
 * wave's (the first rendered copy), so a re-run keeps each file's own bytes
 * only through `ownAudio`.
 */
function audioIndex(): Map<string, string> {
  const skip = new Set<string>([...WAVE_4_WORD_STEPS, WAVE_4_STORY_STEP])
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

/** text → bytes of the step's committed file (empty when there is none). */
function ownAudio(step: Wave4Step): Map<string, string> {
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

const label = (step: Wave4Step) =>
  `${step
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')} — Level 1`

/** A word step's file (its plan, then its audio-bearing lines). */
function spliceWordStep(step: Wave4WordStep): CanonDoc {
  const audio = audioIndex()
  const keep = ownAudio(step)
  const line = (id: string, text: string): AudioLine => ({
    id,
    text,
    audio: {
      kind: 'inline',
      base64:
        audio.get(renderElevenLabsText(text, tierOf(step))) ??
        keep.get(text) ??
        '',
      mime: 'audio/mpeg',
    },
  })
  const utterances: AudioLine[] = expectedBigWordsLines(step).map((u) =>
    line(u.id, u.text),
  )
  for (const u of readDoc(SESSION_END_SOURCE).utterances)
    if (u.id.startsWith('session.end.')) utterances.push(line(u.id, u.text))
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

/** The 16 bee-words and car-words targets (§ 3.2, § 4.2). */
const BEE_CAR_WORDS: ReadonlySet<string> = new Set(
  WAVE_4_WORD_STEPS.flatMap((s: BigWordsStep) =>
    BIG_WORDS_STEPS[s].map((r) => r.word),
  ),
)

/**
 * § 6.2's own rules for the sheep stories, beyond wave 3's lint: 2
 * sentences of 10–14 words in all; the sheep in every story; at least 2 of
 * the 16 bee and car words in each, and each of the 16 somewhere; no
 * "she" (in wave 3 she is always the hen); questions ≤ 23 characters.
 */
export function sheepStoryViolations(
  rows: readonly LittleStory[] = storiesOf(WAVE_4_STORY_STEP),
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of rows) {
    const sentences = storySentences(s.story)
    const words = sentences.flat().map(storyWordKey)
    if (sentences.length !== 2) out.push(`${s.id}: not 2 sentences`)
    if (words.length < 10 || words.length > 14)
      out.push(`${s.id}: ${words.length} words`)
    if (!words.includes('sheep')) out.push(`${s.id}: no sheep`)
    if (words.includes('she')) out.push(`${s.id}: "she"`)
    const team = new Set(words.filter((w) => BEE_CAR_WORDS.has(w)))
    for (const w of team) seen.add(w)
    if (team.size < 2) out.push(`${s.id}: fewer than 2 bee or car words`)
    if (s.question.length > 23)
      out.push(`${s.id}: question of ${s.question.length} characters`)
  }
  for (const w of BEE_CAR_WORDS)
    if (!seen.has(w)) out.push(`"${w}" is in no sheep story`)
  return out
}

/**
 * A step's file. Sheep stories read bee and car words' committed files,
 * and take the wave-3 story files' bytes for a shared request (the
 * "reading stories" recap), which wave 3's splice does not index.
 */
export function spliceWave4Step(
  step: Wave4Step,
  taught: ReadonlySet<string> = taughtWords(),
): CanonDoc {
  if (step !== WAVE_4_STORY_STEP) return spliceWordStep(step)
  const broken = sheepStoryViolations()
  if (broken.length > 0)
    throw new Error(`sheep stories break § 6.2:\n  ${broken.join('\n  ')}`)
  const doc = spliceStoryStep(step, taught)
  const stories = new Map<string, string>()
  for (const stem of WAVE_3_STORY_STEPS)
    for (const u of readDoc(stem).utterances) {
      const request = renderElevenLabsText(u.text, tierOf(stem))
      if (u.audio.base64 !== '' && !stories.has(request))
        stories.set(request, u.audio.base64)
    }
  for (const u of doc.utterances)
    if (u.audio.base64 === '')
      u.audio.base64 =
        stories.get(renderElevenLabsText(u.text, tierOf(step))) ?? ''
  return doc
}

function main(): void {
  const seen = new Set<string>()
  const report = (step: Wave4Step, doc: CanonDoc) => {
    const waiting = awaitingRender(doc).filter((t) => !seen.has(t))
    for (const t of waiting) seen.add(t)
    console.log(
      `wrote ${step}; ${waiting.length} new texts awaiting their render ` +
        `(${waiting.reduce((n, t) => n + t.length, 0)} characters):`,
    )
    for (const t of waiting) console.log(`  ${t.length}\t${t}`)
  }
  for (const step of WAVE_4_WORD_STEPS) {
    const doc = spliceWave4Step(step)
    writeFileSync(join(WORD_CANON_DIR, `${step}.json`), JSON.stringify(doc))
    report(step, doc)
  }
  // After the word steps: their targets are taught words now.
  const doc = spliceWave4Step(WAVE_4_STORY_STEP, taughtWords())
  writeFileSync(
    join(WORD_CANON_DIR, `${WAVE_4_STORY_STEP}.json`),
    JSON.stringify(doc),
  )
  report(WAVE_4_STORY_STEP, doc)
  const chars = [...seen].reduce((n, t) => n + t.length, 0)
  console.log(`${seen.size} new texts, ${chars} characters`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
