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

/**
 * Math problem utterances in the Wave-12 THREE-HINT shape: the single
 * legacy `hint` slot is replaced by the `hint1`/`hint2`/`hint3` triple
 * (ticket 86ca8702v). Same read/correct/reprompt/giveAnswer text as the
 * legacy fixture — only the hint slot widens. Used by the W12-03 planner
 * round-trip test and (via {@link canonicalMathThreeHintSessionResponse})
 * by the W12-05 three-beat E2E spec.
 *
 * The legacy {@link mathUtterances} builder is intentionally retained so
 * the existing sub-to-10 / Leitner / distractor-class specs keep
 * exercising the back-compat single-hint path that W12-01's parser still
 * accepts.
 */
function mathThreeHintUtterances(): Utterance[] {
  const out: Utterance[] = []
  for (const p of MATH_PROBLEMS) {
    const aCap = capitalize(p.addendAWord)
    const sumCap = capitalize(p.sumWord)
    out.push(
      utt(`math.p${p.index}.read`, `${aCap} plus ${p.addendBWord}. How many?`),
      utt(`math.p${p.index}.correct`, `Yes! ${sumCap}!`),
      utt(`math.p${p.index}.reprompt`, 'Hmm... try again?'),
      utt(`math.p${p.index}.hint1`, 'Look at the flowers.'),
      utt(`math.p${p.index}.hint2`, `${aCap} flowers.`),
      utt(`math.p${p.index}.hint3`, `And ${p.addendBWord} more. How many now?`),
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

/**
 * Wave-12 three-hint variant of {@link canonicalMathSessionResponse}: each
 * math problem carries `math.p<N>.hint1`/`hint2`/`hint3` instead of the
 * single legacy `math.p<N>.hint` (ticket 86ca8702v). Read/correct/reprompt/
 * giveAnswer + session-end utterances are byte-identical to the legacy
 * fixture. Feeds the W12-05 three-beat E2E spec and the W12-03 round-trip
 * test that proves a three-hint plan parses through W12-01's widened parser.
 */
export function canonicalMathThreeHintSessionResponse(): SessionStartResponse {
  const problemUtterances = mathThreeHintUtterances()
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: 'sums-to-10-warm-up-three-hint',
      label: 'Sums to 10 — warm up (three-hint)',
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

// ── Three-hint (W12) fixtures — math hint scaffolding split ───────────────
//
// Wave 12 splits the single `math.p<N>.hint` utterance into three escalating
// utterances `hint1` / `hint2` / `hint3`. These builders produce the served
// `/api/claude` envelope for the W12-05 failing-first spec
// (`e2e/math-three-hint.spec.ts`).
//
// AUDIO-BYTES INJECTION — load-bearing. The default `SILENT_MP3_BASE64`
// placeholder above does NOT decode under a real chromium `AudioContext`
// reliably; specs that drive a real gesture-unlock chain (no
// `forceHowlerUnlock`) and assert on canon-specific caption text need REAL
// Azure-rendered MP3 bytes so `prepareMathPathA` does not reject and silently
// demote to the static fallback plan (see `.claude/docs/testing-and-ci.md`
// §4.1.2). Rather than hardcode ~25 KB of base64 here, the builders accept an
// `audioBytes` provider so the spec can inject bytes read from the on-disk
// math canon (`public/canon/math/level-1/<focus>.json`) at test time. The
// fixture text is what the spec asserts on; the bytes only have to decode.

/** A function returning the inline-MP3 base64 to stamp onto every utterance
 *  in a W12 fixture. Spec injects real on-disk canon bytes here. */
export type AudioBytesProvider = () => string

function uttWithBytes(id: string, text: string, base64: string): Utterance {
  return { id, text, audio: { kind: 'inline', base64, mime: 'audio/mpeg' } }
}

/**
 * The single math problem the three-hint spec drives. add-to-10 P1 is
 * `1 + 2 = 3` (matches the on-disk add-to-10 canon P1) so the spec can seed
 * Marian's default `add-to-10: 'practicing'` focus and land on this problem
 * without any chip-walk. Only P1 is exercised (2 wrong taps → hint sequence),
 * so a one-problem plan is sufficient — the screen never advances past P1.
 *
 * NOTE: a real session ships 8 problems + 19 session-end utterances. The
 * three-hint spec only taps P1 and never completes the session, so the plan
 * needs only P1's utterances plus session-end (kept for parser symmetry —
 * out-of-namespace ids are skipped, not required). Eight problems are emitted
 * so the focus-node-keyed planner contract is realistic and the read-aloud
 * gate behaves identically to production.
 */
const THREE_HINT_PROBLEM = {
  index: 1,
  aWord: 'One',
  bWord: 'two',
  sumWord: 'three',
  sumCap: 'Three',
  sum: 3,
} as const

/** The three escalating hint texts for the W12 add-to-10 P1 problem.
 *  Mirrors the W12-03 planner directive's per-step split
 *  (attention → quantity-A → add + question). Exported so the spec can pin
 *  the exact expected caption sequence. */
export const THREE_HINT_TEXTS_P1: readonly [string, string, string] = [
  'Look at the flowers.',
  'One flower.',
  'And two more. How many?',
]

/** The legacy composite single-hint text for the same problem (matches the
 *  on-disk add-to-10 canon's `math.p1.hint`). Back-compat regression-lock. */
export const LEGACY_HINT_TEXT_P1 = 'Look. One. And two more. How many now?'

function threeHintProblemUtterances(base64: string): Utterance[] {
  const p = THREE_HINT_PROBLEM
  return [
    uttWithBytes(
      `math.p${p.index}.read`,
      `${p.aWord} plus ${p.bWord}. How many?`,
      base64,
    ),
    uttWithBytes(`math.p${p.index}.correct`, `Yes! ${p.sumCap}!`, base64),
    uttWithBytes(`math.p${p.index}.reprompt`, 'Hmm... try again?', base64),
    uttWithBytes(`math.p${p.index}.hint1`, THREE_HINT_TEXTS_P1[0], base64),
    uttWithBytes(`math.p${p.index}.hint2`, THREE_HINT_TEXTS_P1[1], base64),
    uttWithBytes(`math.p${p.index}.hint3`, THREE_HINT_TEXTS_P1[2], base64),
    uttWithBytes(
      `math.p${p.index}.giveAnswer`,
      `This one is ${p.sumWord}.`,
      base64,
    ),
  ]
}

function legacyHintProblemUtterances(base64: string): Utterance[] {
  const p = THREE_HINT_PROBLEM
  return [
    uttWithBytes(
      `math.p${p.index}.read`,
      `${p.aWord} plus ${p.bWord}. How many?`,
      base64,
    ),
    uttWithBytes(`math.p${p.index}.correct`, `Yes! ${p.sumCap}!`, base64),
    uttWithBytes(`math.p${p.index}.reprompt`, 'Hmm... try again?', base64),
    uttWithBytes(`math.p${p.index}.hint`, LEGACY_HINT_TEXT_P1, base64),
    uttWithBytes(
      `math.p${p.index}.giveAnswer`,
      `This one is ${p.sumWord}.`,
      base64,
    ),
  ]
}

/**
 * Build the remaining P2..P8 utterances (legacy single-hint shape) so the
 * served plan is a realistic 8-problem session. The spec only taps P1, so
 * P2..P8 never render — they exist purely so the plan parses as a full
 * session and the focus-node contract is honoured. Reuses the canonical
 * MATH_PROBLEMS table for P2..P8.
 */
function tailProblemUtterances(base64: string): Utterance[] {
  const out: Utterance[] = []
  for (const p of MATH_PROBLEMS) {
    if (p.index === 1) continue // P1 is supplied by the W12 builders above
    const aCap = capitalize(p.addendAWord)
    const sumCap = capitalize(p.sumWord)
    out.push(
      uttWithBytes(
        `math.p${p.index}.read`,
        `${aCap} plus ${p.addendBWord}. How many?`,
        base64,
      ),
      uttWithBytes(`math.p${p.index}.correct`, `Yes! ${sumCap}!`, base64),
      uttWithBytes(`math.p${p.index}.reprompt`, 'Hmm... try again?', base64),
      uttWithBytes(
        `math.p${p.index}.hint`,
        `Look. ${aCap}. And ${p.addendBWord} more. How many now?`,
        base64,
      ),
      uttWithBytes(
        `math.p${p.index}.giveAnswer`,
        `This one is ${p.sumWord}.`,
        base64,
      ),
    )
  }
  return out
}

function sessionEndUtterancesWithBytes(base64: string): Utterance[] {
  return sessionEndUtterances().map((u) => uttWithBytes(u.id, u.text, base64))
}

/**
 * THREE-HINT positive-discriminator fixture. P1 carries `hint1/hint2/hint3`
 * (the W12 shape); P2..P8 carry legacy single `hint` (irrelevant — never
 * rendered). On today's `main` the parser regex rejects `hint1/2/3`
 * → `mathSessionPlanFromServer` throws → static fallback (single hint). After
 * W12-01 widens the parser this fixture parses; after W12-02 wires sequential
 * playback the three hints fire in order. The injected `audioBytes` (real
 * on-disk canon bytes) decode so the genuine gesture-unlock chain enables
 * chips without `forceHowlerUnlock`.
 */
export function threeHintMathSessionResponse(
  audioBytes: AudioBytesProvider,
): SessionStartResponse {
  const b = audioBytes()
  const problemUtterances = [
    ...threeHintProblemUtterances(b),
    ...tailProblemUtterances(b),
  ]
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: 'add-to-10-three-hint',
      label: 'Sums to 10 — three-hint scaffolding',
      utterances: [
        ...problemUtterances.map((u) => ({ id: u.id, text: u.text })),
        ...sessionEndUtterances().map((u) => ({ id: u.id, text: u.text })),
      ],
    },
    utterances: [...problemUtterances, ...sessionEndUtterancesWithBytes(b)],
  }
}

/**
 * LEGACY single-hint back-compat fixture. P1 carries a single `math.p1.hint`
 * with the composite text. This parses on today's `main` AND must keep
 * parsing after W12-01 widens the parser (W12-01 AC#4 mandates back-compat).
 * The regression-lock: after 2 wrongs exactly ONE hint caption text appears.
 * GREEN today, stays green post-stack. Frozen inline — independent of the
 * W12-04 canon re-bake so it cannot drift to three hints.
 */
export function legacyHintMathSessionResponse(
  audioBytes: AudioBytesProvider,
): SessionStartResponse {
  const b = audioBytes()
  const problemUtterances = [
    ...legacyHintProblemUtterances(b),
    ...tailProblemUtterances(b),
  ]
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: 'add-to-10-legacy-hint',
      label: 'Sums to 10 — legacy single hint',
      utterances: [
        ...problemUtterances.map((u) => ({ id: u.id, text: u.text })),
        ...sessionEndUtterances().map((u) => ({ id: u.id, text: u.text })),
      ],
    },
    utterances: [...problemUtterances, ...sessionEndUtterancesWithBytes(b)],
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
