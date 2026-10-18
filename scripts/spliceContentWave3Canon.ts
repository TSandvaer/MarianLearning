/**
 * Content wave 3's canon, written deterministically: the little stories,
 * fox stories, hen stories and bug stories (`design/native/content-wave-
 * 3.md` § 4.6, § 4.7, § 5.1) from `LITTLE_STORIES`, and Number Garden's
 * hundreds (§ 3.7) from `HUNDREDS_PLAN` (`hundredsCanonCheck.ts`).
 *
 * Why a splice, not a Haiku bake: every line is fixed by the spec (the
 * story, its question and its three answer lines; hundreds' § 3.7 table),
 * so a script writes it exactly and spends no Anthropic credit, as
 * `spliceContentWave2WordCanon.ts` did for tent and cake words. The four
 * steps are in `PENDING_CANON_NODES`, so an ordinary bake never draws them.
 *
 * - The 8 problems per step, in `LITTLE_STORIES` order (§ 4.6's wire):
 *   `read` = the question, `correct` = "Yes! The fox!" / "Yes! In the
 *   cup!", `reprompt` = "Hmm... try again?", `hint` = the story (Emma's
 *   2nd-wrong and reveal read, and the card's text), `giveAnswer` = "This
 *   one is the fox.".
 * - `session.end.*`: duck words' lines, but the recap "You worked on
 *   reading stories today!".
 *
 * Before anything is written, `storyCanonViolations` holds the lines to the
 * table and the taught-words rule (D2) to the committed canon.
 *
 * - Hundreds' 8 problems: `HUNDREDS_PLAN`'s lines, held to § 3.7's lint
 *   (`hundredsCanonViolations`); `session.end.*`: every math file's lines
 *   (taken from div-share's), with the recap "You worked on hundreds
 *   today!". Math lines render with no tier, so a text any math canon file
 *   already carries reuses those bytes (wave 2's rule): "Hmm... try
 *   again?" and the session-end lines.
 *
 * Audio: a text that a Word Song canon file already carries reuses those
 * bytes when its ElevenLabs request is the same (`renderElevenLabsText`
 * with that file's tier), as wave 2's splice: "Hmm... try again?" and the
 * shared session-end lines. A new text gets an empty `audio.base64`:
 * awaiting its Lily render, which `npx tsx scripts/revoiceCanonLily.ts
 * --unrendered` fills without touching any other clip. Until then the
 * native app walks that line's caption silently.
 *
 * Idempotent: a second run (also after the render) writes the same bytes.
 *
 * Run: npx tsx scripts/spliceContentWave3Canon.ts
 * Then: npx tsx scripts/generateCanonMathFacts.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LITTLE_STORIES,
  STORY_NODES,
  STORY_RECAP_FOCUS,
  storiesOf,
  storyCorrectLine,
  storyGiveAnswerLine,
  storySentences,
  storyWordKey,
  type LittleStory,
  type StoryNode,
} from '@marian/core/wordSong/littleStories'
import { renderElevenLabsText } from '../api/_tts_elevenlabs.js'
import {
  HUNDREDS_PLAN,
  HUNDREDS_RECAP_FOCUS,
  HUNDREDS_SLOTS,
  hundredsCanonViolations,
  hundredsLines,
  hundredsRuleViolations,
} from './hundredsCanonCheck.ts'
import { tierFor } from './lilyCanonLib.ts'
import { MATH_CANON_DIR } from './spliceContentWave1Canon.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const WORD_CANON_DIR = join(
  ROOT,
  'public',
  'canon',
  'word-song',
  'level-1',
)

/** The steps this script writes, in tree order (sheep stories, content
 *  wave 4, is `spliceContentWave4Canon.ts`'s). */
export const WAVE_3_STORY_STEPS: readonly StoryNode[] = [
  'fox-stories',
  'hen-stories',
  'bug-stories',
]

/** The file whose `session.end.*` lines the new files take. */
const SESSION_END_SOURCE = 'duck-words'

/** The re-prompt every Word Song problem shares (cache locality). */
export const STORY_REPROMPT = 'Hmm... try again?'

/** D2's three decodable extras, from mastered patterns. */
export const STORY_EXTRA_WORDS: readonly string[] = ['and', 'got', 'hid']

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

const tierOf = (stem: string): string | undefined =>
  tierFor(`word-song/level-1/${stem}.json`)

/** Every Word Song canon stem but the story steps', sorted. */
function otherStems(): string[] {
  return readdirSync(WORD_CANON_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((stem) => !(STORY_NODES as readonly string[]).includes(stem))
    .sort()
}

/** The 40 problem lines of a step, in canon order. */
export function expectedStoryLines(step: StoryNode): readonly Line[] {
  return storiesOf(step).flatMap((s, i) => {
    const n = i + 1
    return [
      { id: `word.p${n}.read`, text: s.question },
      { id: `word.p${n}.correct`, text: storyCorrectLine(s) },
      { id: `word.p${n}.reprompt`, text: STORY_REPROMPT },
      { id: `word.p${n}.hint`, text: s.story },
      { id: `word.p${n}.giveAnswer`, text: storyGiveAnswerLine(s) },
    ]
  })
}

/**
 * The words a story may use (§ 4.7, D2): a target word of a Word Song
 * canon file, a word read in the sight-words or simple-sentences canon, or
 * one of the 3 decodable extras.
 */
export function taughtWords(): Set<string> {
  const taught = new Set(STORY_EXTRA_WORDS)
  for (const stem of otherStems()) {
    const doc = readDoc(stem)
    for (const u of doc.plan.utterances) {
      if (stem === 'sight-words' || stem === 'simple-sentences') {
        if (!/\.read$/.test(u.id)) continue
        const sentence = u.text.replace(
          /^(Find the word|Finish the sentence):/,
          '',
        )
        for (const w of sentence.match(/[A-Za-z]+/g) ?? [])
          if (w !== 'blank') taught.add(w.toLowerCase())
        continue
      }
      const m = /\.read$/.test(u.id)
        ? /^(?:Read|Tap) the ([a-z]+)\.$/.exec(u.text)
        : null
      if (m) taught.add(m[1]!)
    }
    // Simple sentences' answers (the gap words) are read on the card too.
    if (stem === 'simple-sentences')
      for (const u of doc.plan.utterances) {
        const m = /\.correct$/.test(u.id)
          ? /^Yes! ([A-Za-z]+)\.?$/.exec(u.text)
          : null
        if (m) taught.add(m[1]!.toLowerCase())
      }
  }
  return taught
}

/**
 * Every way a step's lines depart from the table and § 4.7's rules. `rows`
 * are the stories the rules read (the table's by default; a test passes
 * its own bad rows).
 */
export function storyCanonViolations(
  step: StoryNode,
  utterances: readonly Line[],
  taught: ReadonlySet<string> = taughtWords(),
  rows: readonly LittleStory[] = storiesOf(step),
): string[] {
  const out: string[] = []
  const problem = utterances
    .filter((u) => u.id.startsWith('word.'))
    .map(({ id, text }) => ({ id, text }))
  const expected = expectedStoryLines(step)
  if (JSON.stringify(problem) !== JSON.stringify(expected))
    out.push(`${step}: the problem lines are not the table's`)
  for (const s of rows) {
    for (const w of storySentences(s.story).flat().map(storyWordKey))
      if (!taught.has(w)) out.push(`${s.id}: "${w}" is not a taught word`)
    if (/s\b/.test(s.story.replace(/\b(is|has|bus)\b/g, '')))
      out.push(`${s.id}: a plural or -s ending`)
    // seed: content wave 4's sheep stories (§ 6.2).
    if (/ed\b/.test(s.story.replace(/\b(bed|shed|red|seed)\b/g, '')))
      out.push(`${s.id}: an -ed ending`)
  }
  const recap = utterances.find((u) => u.id === 'session.end.recap.focus')
  if (recap?.text !== STORY_RECAP_FOCUS)
    out.push(`${step}: session.end.recap.focus is "${recap?.text}"`)
  return out
}

/**
 * ElevenLabs request → bytes over every other Word Song canon file (the
 * first rendered copy). Keyed on the request, not the text, so a line whose
 * request a tier transforms is never reused for a plain line.
 */
function audioIndex(): Map<string, string> {
  const index = new Map<string, string>()
  for (const stem of otherStems())
    for (const u of readDoc(stem).utterances) {
      const request = renderElevenLabsText(u.text, tierOf(stem))
      if (u.audio.base64 !== '' && !index.has(request))
        index.set(request, u.audio.base64)
    }
  return index
}

/** text → bytes of the step's committed file (empty when there is none). */
function ownAudio(step: StoryNode): Map<string, string> {
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

const label = (step: StoryNode) =>
  `${step
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')} — Level 1`

/** A step's file (its plan, then its audio-bearing lines). */
export function spliceStoryStep(
  step: StoryNode,
  taught: ReadonlySet<string> = taughtWords(),
): CanonDoc {
  const audio = audioIndex()
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
  const utterances: AudioLine[] = expectedStoryLines(step).map((u) =>
    line(u.id, u.text),
  )
  for (const u of readDoc(SESSION_END_SOURCE).utterances) {
    if (!u.id.startsWith('session.end.')) continue
    utterances.push(
      line(
        u.id,
        u.id === 'session.end.recap.focus' ? STORY_RECAP_FOCUS : u.text,
      ),
    )
  }
  const drift = storyCanonViolations(step, utterances, taught)
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

/** Hundreds' canon file stem (`math/level-1/hundreds.json`). */
export const HUNDREDS_FILE = 'hundreds'

/** The math file whose `session.end.*` lines hundreds takes. */
const MATH_SESSION_END_SOURCE = 'div-share'

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

/** The hundreds file's content (its plan, then its audio-bearing lines). */
export function spliceHundreds(): CanonDoc {
  const broken = hundredsRuleViolations(HUNDREDS_PLAN)
  if (broken.length > 0)
    throw new Error(`hundreds plan breaks § 3.7:\n  ${broken.join('\n  ')}`)
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
  const utterances: AudioLine[] = HUNDREDS_PLAN.flatMap((spec, i) => {
    const lines = hundredsLines(spec)
    return HUNDREDS_SLOTS.map((slot, k) =>
      line(`math.p${i + 1}.${slot}`, lines[k]!),
    )
  })
  for (const u of readMathDoc(MATH_SESSION_END_SOURCE).utterances) {
    if (!u.id.startsWith('session.end.')) continue
    utterances.push(
      line(
        u.id,
        u.id === 'session.end.recap.focus' ? HUNDREDS_RECAP_FOCUS : u.text,
      ),
    )
  }
  const drift = hundredsCanonViolations(utterances)
  if (drift.length > 0)
    throw new Error(`hundreds splice drifted:\n  ${drift.join('\n  ')}`)
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: 'hundreds-level-1',
      label: 'Hundreds — Level 1',
      utterances: utterances.map(({ id, text }) => ({ id, text })),
    },
    utterances,
  }
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
  const taught = taughtWords()
  const seen = new Set<string>()
  for (const step of WAVE_3_STORY_STEPS) {
    const doc = spliceStoryStep(step, taught)
    writeFileSync(join(WORD_CANON_DIR, `${step}.json`), JSON.stringify(doc))
    const waiting = awaitingRender(doc).filter((t) => !seen.has(t))
    for (const t of waiting) seen.add(t)
    console.log(
      `wrote ${step}; ${waiting.length} new texts awaiting their render ` +
        `(${waiting.reduce((n, t) => n + t.length, 0)} characters):`,
    )
    for (const t of waiting) console.log(`  ${t.length}\t${t}`)
  }
  console.log(`${LITTLE_STORIES.length} stories, ${seen.size} new texts`)
  const hundreds = spliceHundreds()
  writeFileSync(
    join(MATH_CANON_DIR, `${HUNDREDS_FILE}.json`),
    JSON.stringify(hundreds),
  )
  const waiting = awaitingRender(hundreds)
  console.log(
    `wrote ${HUNDREDS_FILE}; ${waiting.length} new texts awaiting their ` +
      `render (${waiting.reduce((n, t) => n + t.length, 0)} characters):`,
  )
  for (const t of waiting) console.log(`  ${t.length}\t${t}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
