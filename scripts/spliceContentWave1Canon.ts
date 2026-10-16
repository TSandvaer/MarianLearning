/**
 * Content wave 1's Number Garden canon (`design/native/content-wave-1.md`
 * § 1.8 and § 2.2), written deterministically.
 *
 * Why a splice, not a Haiku re-bake: a re-bake re-draws every problem
 * (`.claude/docs/planner-and-canon.md` § "A re-bake re-draws problem
 * content — splice, don't re-bake"), while § 1.8 keeps P1–P3, P5 and P7 of
 * both adding files with their audio, and every new line follows a fixed
 * template (§ 1.3, and the planner's generic-tier multiplication
 * templates, `api/_planner.ts`).
 *
 * - add-to-10 / add-to-20: the § 1.8 plans. A problem whose read line is
 *   already in the file keeps its 7 lines and their audio bytes, moved to
 *   its new position; a missing number gets the § 1.3 lines.
 * - mult-mix: a new file, the § 2.2 order, the generic-tier templates; its
 *   `session.end.*` lines are mult-6-9's (the same texts: both recaps say
 *   "counting in groups").
 *
 * Audio: a text some math canon file already carries reuses those bytes
 * (math lines render with no tier, so the ElevenLabs request and its bytes
 * are the same, `scripts/revoiceCanonLily.ts`). A new text gets an empty
 * `audio.base64`: awaiting its Lily render, which
 * `npx tsx scripts/revoiceCanonLily.ts --unrendered` fills without touching
 * any other clip. Until then the native app walks that line's caption
 * silently (`mobile/src/audio/sessionAudio.ts`).
 *
 * Idempotent: a second run writes the same bytes.
 *
 * Run: npx tsx scripts/spliceContentWave1Canon.ts
 * Then: npx tsx scripts/generateCanonMathFacts.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const MATH_CANON_DIR = join(ROOT, 'public', 'canon', 'math', 'level-1')

interface Line {
  id: string
  text: string
}
interface AudioLine extends Line {
  audio: { kind: 'inline'; base64: string; mime: 'audio/mpeg' }
}
interface CanonDoc {
  ok: true
  kind: 'session-start'
  plan: { id: string; label: string; utterances: Line[] }
  utterances: AudioLine[]
}

/** One problem of a target plan. */
export type Spec =
  | { kind: 'plain'; a: number; b: number }
  | { kind: 'missing'; given: number; total: number }
  | { kind: 'times'; a: number; b: number }

const plain = (a: number, b: number): Spec => ({ kind: 'plain', a, b })
const missing = (given: number, total: number): Spec => ({
  kind: 'missing',
  given,
  total,
})
const times = (a: number, b: number): Spec => ({ kind: 'times', a, b })

/** § 1.8 (add-to-10, add-to-20) and § 2.2 (mult-mix), problem 1..8. */
export const WAVE_1_PLANS = {
  'add-to-10': [
    plain(1, 2),
    plain(2, 2),
    plain(3, 2),
    missing(7, 10),
    plain(4, 4),
    missing(6, 10),
    plain(4, 5),
    missing(8, 10),
  ],
  'add-to-20': [
    plain(9, 2),
    plain(8, 3),
    plain(6, 6),
    missing(9, 13),
    plain(8, 5),
    missing(7, 12),
    plain(7, 8),
    missing(6, 11),
  ],
  'mult-mix': [
    times(5, 3),
    times(4, 5),
    times(6, 4),
    times(3, 5),
    times(7, 4),
    times(5, 5),
    times(8, 4),
    times(9, 4),
  ],
} as const satisfies Record<string, readonly Spec[]>

export type Wave1File = keyof typeof WAVE_1_PLANS

const WORDS = [
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
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty']

/** "seven", "twenty-eight" (0..59). */
export function word(n: number): string {
  if (n < 20) return WORDS[n]!
  const unit = n % 10
  const tens = TENS[Math.floor(n / 10)]!
  return unit === 0 ? tens : `${tens}-${WORDS[unit]}`
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const SLOTS = [
  'read',
  'correct',
  'reprompt',
  'hint1',
  'hint2',
  'hint3',
  'giveAnswer',
] as const

/**
 * A missing number's lines (§ 1.3): "Seven and what make ten?", "Yes!
 * Seven and three make ten!", the shared re-prompt and hint 1, "Seven
 * flowers.", "How many more make ten?", "This one is three.".
 */
export function missingNumberLines(given: number, total: number): string[] {
  const g = word(given)
  const b = word(total - given)
  const t = word(total)
  return [
    `${cap(g)} and what make ${t}?`,
    `Yes! ${cap(g)} and ${b} make ${t}!`,
    'Hmm... try again?',
    'Look at the flowers.',
    given === 1 ? 'One flower.' : `${cap(g)} flowers.`,
    `How many more make ${t}?`,
    `This one is ${b}.`,
  ]
}

/** The repeated-addition hint 2, case-split on the group count (planner). */
function groupsHint(a: number, b: number): string {
  const w = word(a)
  switch (b) {
    case 1:
      return `One group of ${w}.`
    case 2:
      return `${cap(w)} and ${w} more.`
    case 3:
      return `${cap(w)}, then ${w}, then ${w}.`
    default:
      return `${[cap(w), ...Array(b - 1).fill(w)].join(', ')}.`
  }
}

/** A multiplication's lines (the planner's generic-tier templates). */
export function timesLines(a: number, b: number): string[] {
  return [
    `${cap(word(a))} times ${word(b)}. How many?`,
    `Yes! ${cap(word(a * b))}!`,
    'Hmm... try again?',
    'Look at the groups.',
    groupsHint(a, b),
    'How many?',
    `This one is ${word(a * b)}.`,
  ]
}

const readDoc = (file: string): CanonDoc =>
  JSON.parse(readFileSync(join(MATH_CANON_DIR, `${file}.json`), 'utf8'))

/** text → bytes over every math canon file, `prefer` first. */
function audioIndex(prefer: CanonDoc | null): Map<string, string> {
  const index = new Map<string, string>()
  const docs = [
    ...(prefer ? [prefer] : []),
    ...readdirSync(MATH_CANON_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readDoc(f.replace(/\.json$/, ''))),
  ]
  for (const d of docs)
    for (const u of d.utterances)
      if (u.audio.base64 !== '' && !index.has(u.text))
        index.set(u.text, u.audio.base64)
  return index
}

/** The 7 lines of problem `index` of `doc` whose read is `read`, or null. */
function blockWithRead(doc: CanonDoc, read: string): AudioLine[] | null {
  const r = doc.utterances.find(
    (u) => /^math\.p\d+\.read$/.test(u.id) && u.text === read,
  )
  if (r === undefined) return null
  const prefix = r.id.slice(0, r.id.length - 'read'.length)
  return SLOTS.map((slot) => {
    const u = doc.utterances.find((x) => x.id === `${prefix}${slot}`)
    if (u === undefined) throw new Error(`${prefix}${slot} missing`)
    return u
  })
}

const linesOf = (spec: Spec): string[] =>
  spec.kind === 'missing'
    ? missingNumberLines(spec.given, spec.total)
    : spec.kind === 'times'
      ? timesLines(spec.a, spec.b)
      : [`${cap(word(spec.a))} plus ${word(spec.b)}. How many?`]

/** The file's new content (its plan, then its audio-bearing lines). */
export function spliceWave1(file: Wave1File): CanonDoc {
  const existing = file === 'mult-mix' ? null : readDoc(file)
  const ends = (existing ?? readDoc('mult-6-9')).utterances.filter((u) =>
    u.id.startsWith('session.end.'),
  )
  const audio = audioIndex(existing)
  const utterances: AudioLine[] = []
  WAVE_1_PLANS[file].forEach((spec: Spec, i) => {
    const n = i + 1
    const lines = linesOf(spec)
    const kept = existing === null ? null : blockWithRead(existing, lines[0]!)
    if (spec.kind === 'plain' && kept === null) {
      throw new Error(`${file}: plain problem "${lines[0]}" is not in canon`)
    }
    SLOTS.forEach((slot, k) => {
      const id = `math.p${n}.${slot}`
      if (kept !== null) {
        utterances.push({ ...kept[k]!, id })
        return
      }
      const text = lines[k]!
      utterances.push({
        id,
        text,
        audio: {
          kind: 'inline',
          base64: audio.get(text) ?? '',
          mime: 'audio/mpeg',
        },
      })
    })
  })
  utterances.push(...ends)
  const plan =
    existing?.plan ??
    ({
      id: 'mult-mix-level-1',
      label: 'Multiplication mix (all the groups) — Level 1',
      utterances: [],
    } as CanonDoc['plan'])
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: plan.id,
      label: plan.label,
      utterances: utterances.map(({ id, text }) => ({ id, text })),
    },
    utterances,
  }
}

/** Every line of the three files whose audio is not rendered yet. */
export function awaitingRender(
  docs: Record<Wave1File, CanonDoc>,
): { file: Wave1File; id: string; text: string }[] {
  return (Object.keys(docs) as Wave1File[]).flatMap((file) =>
    docs[file].utterances
      .filter((u) => u.audio.base64 === '')
      .map((u) => ({ file, id: u.id, text: u.text })),
  )
}

function main(): void {
  const files = Object.keys(WAVE_1_PLANS) as Wave1File[]
  // Read everything before writing anything: a moved block's bytes come
  // from the file as it was.
  const docs = Object.fromEntries(
    files.map((f) => [f, spliceWave1(f)]),
  ) as Record<Wave1File, CanonDoc>
  for (const f of files) {
    writeFileSync(join(MATH_CANON_DIR, `${f}.json`), JSON.stringify(docs[f]))
  }
  const waiting = awaitingRender(docs)
  console.log(
    `wrote ${files.join(', ')}; ${new Set(waiting.map((w) => w.text)).size} ` +
      `new texts awaiting their render (${waiting.length} lines).`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
