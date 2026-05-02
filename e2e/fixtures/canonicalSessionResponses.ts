/**
 * Canonical /api/claude session-start responses for e2e tests.
 *
 * Ticket 86c9kwnmx (P0.1 from the 2026-05-02 polish audit).
 *
 * Shape contract
 * --------------
 * Mirrors `SessionStartResponse` from `api/_types.ts`. The plan field
 * follows `PlannerPlan` from `api/_planner.ts`:
 *   - `math.p<N>.<slot>` ids for math
 *   - `word.p<N>.<slot>` ids for word-song
 *   - `session.end.*` ids appended after the per-problem ids
 *
 * Audio
 * -----
 * Inline base64 carries a placeholder MP3 (1 silent frame). On real
 * Howler, this either decodes as a near-zero-duration silent buffer or
 * fires `loaderror`; either branch lands Math/WordSong on the silent
 * caption-walk fallback at 165 wpm. That is FINE for e2e — the tests
 * assert that the screen RENDERS and chips eventually become tappable.
 * They do not (and must not) assert audible playback; speakers in CI
 * runners are mute by definition.
 *
 * If a future spec needs to assert audio actually fires, swap this
 * placeholder for a captured-from-real-Azure response under
 * `e2e/fixtures/audio/` and add a per-spec opt-in flag.
 */

import type { SessionStartResponse, Utterance } from '../../api/_types'

/**
 * Tiny silent MP3 — single 144-byte frame at 32 kbps mono. Howler may or
 * may not decode this depending on the engine; both outcomes are tolerated
 * by Math/WordSong (silent fallback walks the caption at 165 wpm).
 *
 * Generated with: ffmpeg -f lavfi -i anullsrc=r=8000:cl=mono -t 0.05 -ac 1 -ab 32k silent.mp3 | base64
 */
const SILENT_MP3_BASE64 =
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAA8TEFNRTMuMTAwBLgAAAAAAAAAABRAJAUHQQAB4AAAAk8tnaAyAAAAAA=='

function audioPayload(): Utterance['audio'] {
  return {
    kind: 'inline',
    base64: SILENT_MP3_BASE64,
    mime: 'audio/mpeg',
  }
}

function utt(id: string, text: string): Utterance {
  return { id, text, audio: audioPayload() }
}

// ── Math problems — sums to 10, ordered easier → harder. ──────────────────

const MATH_PROBLEMS: ReadonlyArray<{
  index: number
  addendAWord: string
  addendBWord: string
  sumWord: string
  sum: number
}> = [
  { index: 1, addendAWord: 'one', addendBWord: 'one', sumWord: 'two', sum: 2 },
  {
    index: 2,
    addendAWord: 'two',
    addendBWord: 'one',
    sumWord: 'three',
    sum: 3,
  },
  { index: 3, addendAWord: 'two', addendBWord: 'two', sumWord: 'four', sum: 4 },
  {
    index: 4,
    addendAWord: 'three',
    addendBWord: 'two',
    sumWord: 'five',
    sum: 5,
  },
  { index: 5, addendAWord: 'four', addendBWord: 'two', sumWord: 'six', sum: 6 },
  {
    index: 6,
    addendAWord: 'three',
    addendBWord: 'four',
    sumWord: 'seven',
    sum: 7,
  },
  {
    index: 7,
    addendAWord: 'four',
    addendBWord: 'four',
    sumWord: 'eight',
    sum: 8,
  },
  {
    index: 8,
    addendAWord: 'five',
    addendBWord: 'four',
    sumWord: 'nine',
    sum: 9,
  },
]

function mathUtterances(): Utterance[] {
  const out: Utterance[] = []
  for (const p of MATH_PROBLEMS) {
    const aCap = capitalize(p.addendAWord)
    const sumCap = capitalize(p.sumWord)
    out.push(
      utt(`math.p${p.index}.read`, `${aCap} plus ${p.addendBWord}. How many?`),
      utt(`math.p${p.index}.correct`, `Yes! ${sumCap}!`),
      utt(`math.p${p.index}.reprompt`, 'Hmm... try again?'),
      utt(
        `math.p${p.index}.hint`,
        `Look. ${aCap}. And ${p.addendBWord} more. How many now?`,
      ),
      utt(`math.p${p.index}.giveAnswer`, `This one is ${p.sumWord}.`),
    )
  }
  return out
}

// ── Word-song problems — CVC short-a "Tap the <word>." ────────────────────

const WORD_SONG_PROBLEMS: ReadonlyArray<{ index: number; word: string }> = [
  { index: 1, word: 'cat' },
  { index: 2, word: 'bag' },
  { index: 3, word: 'hat' },
  { index: 4, word: 'van' },
  { index: 5, word: 'can' },
  { index: 6, word: 'mat' },
  { index: 7, word: 'tag' },
  { index: 8, word: 'jam' },
]

function wordSongUtterances(): Utterance[] {
  const out: Utterance[] = []
  for (const p of WORD_SONG_PROBLEMS) {
    const cap = capitalize(p.word)
    out.push(
      utt(`word.p${p.index}.read`, `Tap the ${p.word}.`),
      utt(`word.p${p.index}.correct`, `Yes! ${cap}.`),
      utt(`word.p${p.index}.reprompt`, 'Hmm... try again?'),
      utt(`word.p${p.index}.hint`, `Let's look. ${cap}.`),
      utt(`word.p${p.index}.giveAnswer`, `This one is ${p.word}.`),
    )
  }
  return out
}

// ── Session-end utterances (shared across both surfaces). ─────────────────

const RECAP_WORDS: Record<number, string> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
}

const STREAK_WORDS: Record<number, string> = {
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
}

function sessionEndUtterances(): Utterance[] {
  const out: Utterance[] = []
  out.push(utt('session.end.opener', 'You did it!'))
  for (let n = 1; n <= 11; n++) {
    const word = RECAP_WORDS[n]!
    const text = n === 1 ? 'You earned one star!' : `You earned ${word} stars!`
    out.push(utt(`session.end.recap.${n}`, text))
  }
  for (let n = 3; n <= 8; n++) {
    out.push(
      utt(`session.end.streak.${n}`, `${STREAK_WORDS[n]!} in a row! Wow!`),
    )
  }
  out.push(utt('session.end.goodbye', 'See you soon.'))
  return out
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1)
}

// ── Public fixtures ──────────────────────────────────────────────────────

export function canonicalMathSessionResponse(): SessionStartResponse {
  const problemUtterances = mathUtterances()
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: 'sums-to-10-warm-up',
      label: 'Sums to 10 — warm up',
      utterances: [
        ...problemUtterances.map((u) => ({ id: u.id, text: u.text })),
        ...sessionEndUtterances().map((u) => ({ id: u.id, text: u.text })),
      ],
    },
    utterances: [...problemUtterances, ...sessionEndUtterances()],
  }
}

export function canonicalWordSongSessionResponse(): SessionStartResponse {
  const problemUtterances = wordSongUtterances()
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: 'cvc-short-a-warm-up',
      label: 'CVC short-a — warm up',
      utterances: [
        ...problemUtterances.map((u) => ({ id: u.id, text: u.text })),
        ...sessionEndUtterances().map((u) => ({ id: u.id, text: u.text })),
      ],
    },
    utterances: [...problemUtterances, ...sessionEndUtterances()],
  }
}

/** Per-problem correct answers indexed by problem index (0-based). Tests
 *  use this to drive the math chip-tap sequence deterministically. */
export const MATH_CORRECT_ANSWERS: ReadonlyArray<number> = MATH_PROBLEMS.map(
  (p) => p.sum,
)

/** Per-problem target words (for word-song spec coverage). */
export const WORD_SONG_TARGETS: ReadonlyArray<string> = WORD_SONG_PROBLEMS.map(
  (p) => p.word,
)
