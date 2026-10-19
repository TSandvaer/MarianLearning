/**
 * Content wave 5's Word Song canon, written deterministically: snail words
 * and moon words (`design/native/content-wave-5.md` § 4.2, § 5.2) in the
 * land-6 template, and goat stories (§ 7.2) in wave 3's story format.
 * Number Garden's zeros and adding big numbers are
 * `spliceContentWave5MathCanon.ts`'s.
 *
 * Why a splice, not a Haiku bake: every line is fixed by the spec (the
 * big-words template of `bigWordsCanonCheck.ts`, the story rows of
 * `LITTLE_STORIES`), so a script writes it exactly and spends no Anthropic
 * credit, as waves 2 to 4 did. The three steps are in
 * `PENDING_CANON_NODES`, so an ordinary bake never draws them.
 *
 * - Snail and moon words: `expectedBigWordsLines(step)`, held to the spec
 *   by `bigWordsCanonViolations` and to § 5.3's lead-cue lint
 *   (`leadCueViolations`); `session.end.*`: duck words' lines (every word
 *   step's recap says "reading words").
 * - Goat stories: wave 3's `spliceStoryStep` (the story lines, duck words'
 *   session end with the "reading stories" recap, the taught-words lint),
 *   plus § 7.2's own rules (`goatStoryViolations`). The taught words read
 *   the committed canon, so snail and moon words are written first: their
 *   16 targets become taught words.
 *
 * Audio: a text that another Word Song canon file already carries reuses
 * those bytes when its ElevenLabs request is the same (`renderElevenLabsText`
 * with that file's tier): "Hmm... try again?", the shared session-end lines
 * and the reading-stories recap. No target collides with a shipped word
 * this wave (K4), so every word line is new. A new text gets an empty
 * `audio.base64`: awaiting its Lily render, which
 * `npx tsx scripts/revoiceCanonLily.ts --unrendered` fills without touching
 * any other clip. Until then the native app walks that line's caption
 * silently.
 *
 * Idempotent: a second run (also after the render) writes the same bytes.
 *
 * Run: npx tsx scripts/spliceContentWave5Canon.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BIG_WORDS_STEPS,
  bigWordsOf,
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
import { WAVE_4_STORY_STEP } from './spliceContentWave4Canon.ts'

export { awaitingRender, type CanonDoc }

/** The two word steps this script writes, in tree order. */
export const WAVE_5_WORD_STEPS = ['snail-words', 'moon-words'] as const
export type Wave5WordStep = (typeof WAVE_5_WORD_STEPS)[number]

/** The story step this script writes, after the word steps. */
export const WAVE_5_STORY_STEP = 'goat-stories' as const

export type Wave5Step = Wave5WordStep | typeof WAVE_5_STORY_STEP

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
  const skip = new Set<string>([...WAVE_5_WORD_STEPS, WAVE_5_STORY_STEP])
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
function ownAudio(step: Wave5Step): Map<string, string> {
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

const label = (step: Wave5Step) =>
  `${step
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')} — Level 1`

/**
 * § 4.3 and § 5.3's lint on the words the leads light at P1: snail words'
 * P1 ends in its team (the ending-pair cue lights the last two cells), and
 * moon words' P1 holds "oo" (the team-pair cue lights it). `words` are the
 * steps' words in canon order (the table's by default; a test passes its
 * own).
 */
export function leadCueViolations(
  words: Readonly<Record<Wave5WordStep, readonly string[]>> = {
    'snail-words': bigWordsOf('snail-words'),
    'moon-words': bigWordsOf('moon-words'),
  },
): string[] {
  const out: string[] = []
  const snail = words['snail-words'][0] ?? ''
  if (!/(ai|ay|oa)$/.test(snail))
    out.push(`snail-words P1 "${snail}" does not end in ai, ay or oa`)
  const moon = words['moon-words'][0] ?? ''
  if (!moon.includes('oo')) out.push(`moon-words P1 "${moon}" holds no "oo"`)
  return out
}

/** A word step's file (its plan, then its audio-bearing lines). */
function spliceWordStep(step: Wave5WordStep): CanonDoc {
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
  const drift = [
    ...bigWordsCanonViolations(step, utterances),
    ...leadCueViolations(),
  ]
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

/** The 16 snail-words and moon-words targets (§ 4.2, § 5.2). */
const SNAIL_MOON_WORDS: ReadonlySet<string> = new Set(
  WAVE_5_WORD_STEPS.flatMap((s: BigWordsStep) =>
    BIG_WORDS_STEPS[s].map((r) => r.word),
  ),
)

/** § 7.2: only these problems may have the goat as their answer. */
const GOAT_ANSWER_PROBLEMS: ReadonlySet<number> = new Set([1, 7])

/**
 * § 7.2's own rules for the goat stories, beyond wave 3's lint: 2
 * sentences of 10–14 words in all; the goat in every story; at least 2 of
 * the 16 snail and moon words in each, and each of the 16 somewhere; no
 * "she" (in wave 3 she is always the hen); questions ≤ 23 characters; the
 * goat answers P1 and P7 only.
 */
export function goatStoryViolations(
  rows: readonly LittleStory[] = storiesOf(WAVE_5_STORY_STEP),
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  rows.forEach((s, i) => {
    const sentences = storySentences(s.story)
    const words = sentences.flat().map(storyWordKey)
    if (sentences.length !== 2) out.push(`${s.id}: not 2 sentences`)
    if (words.length < 10 || words.length > 14)
      out.push(`${s.id}: ${words.length} words`)
    if (!words.includes('goat')) out.push(`${s.id}: no goat`)
    if (words.includes('she')) out.push(`${s.id}: "she"`)
    const team = new Set(words.filter((w) => SNAIL_MOON_WORDS.has(w)))
    for (const w of team) seen.add(w)
    if (team.size < 2) out.push(`${s.id}: fewer than 2 snail or moon words`)
    if (s.question.length > 23)
      out.push(`${s.id}: question of ${s.question.length} characters`)
    if (s.answer === 'goat' && !GOAT_ANSWER_PROBLEMS.has(i + 1))
      out.push(`${s.id}: the goat answers (only P1 and P7 may)`)
  })
  for (const w of SNAIL_MOON_WORDS)
    if (!seen.has(w)) out.push(`"${w}" is in no goat story`)
  return out
}

/**
 * A step's file. Goat stories read snail and moon words' committed files,
 * and take the earlier story files' bytes for a shared request (the
 * "reading stories" recap), which wave 3's splice does not index.
 */
export function spliceWave5Step(
  step: Wave5Step,
  taught: ReadonlySet<string> = taughtWords(),
): CanonDoc {
  if (step !== WAVE_5_STORY_STEP) return spliceWordStep(step)
  const broken = goatStoryViolations()
  if (broken.length > 0)
    throw new Error(`goat stories break § 7.2:\n  ${broken.join('\n  ')}`)
  const doc = spliceStoryStep(step, taught)
  const stories = new Map<string, string>()
  for (const stem of [...WAVE_3_STORY_STEPS, WAVE_4_STORY_STEP])
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
  const report = (step: Wave5Step, doc: CanonDoc) => {
    const waiting = awaitingRender(doc).filter((t) => !seen.has(t))
    for (const t of waiting) seen.add(t)
    console.log(
      `wrote ${step}; ${waiting.length} new texts awaiting their render ` +
        `(${waiting.reduce((n, t) => n + t.length, 0)} characters):`,
    )
    for (const t of waiting) console.log(`  ${t.length}\t${t}`)
  }
  for (const step of WAVE_5_WORD_STEPS) {
    const doc = spliceWave5Step(step)
    writeFileSync(join(WORD_CANON_DIR, `${step}.json`), JSON.stringify(doc))
    report(step, doc)
  }
  // After the word steps: their targets are taught words now.
  const doc = spliceWave5Step(WAVE_5_STORY_STEP, taughtWords())
  writeFileSync(
    join(WORD_CANON_DIR, `${WAVE_5_STORY_STEP}.json`),
    JSON.stringify(doc),
  )
  report(WAVE_5_STORY_STEP, doc)
  const chars = [...seen].reduce((n, t) => n + t.length, 0)
  console.log(`${seen.size} new texts, ${chars} characters`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
