/**
 * Adapt a server-generated `PlannerPlan` (flat) into a
 * `WordSongSessionPlan` (nested). Sibling of `screens/Math/planFromServer.ts`
 * — same parsing strategy, different domain.
 *
 * Why this lives here
 * -------------------
 * Ticket 86c9jteud — see the Math planFromServer header for the full
 * rationale. tl;dr: the track-based switchover makes the server the
 * source of truth for which target words appear in a session, and we
 * need to reverse-engineer the per-problem `target: WordEntry` from the
 * `read` text so `WordSong.tsx` can render its picture chips.
 *
 * Parsing strategy
 * ----------------
 * The Haiku prompt (api/_planner.ts:WORD_SONG_TRACK_GUIDE) constrains the
 * `read` line to a recognised content-type template; this parser
 * dispatches on the template shape:
 *
 *   - "Tap the <word>."  → `contentType: 'blending-cv'` (v1 default).
 *     Marian taps the matching picture chip from a trio. The current
 *     planner emits this template exclusively; existing plans continue
 *     to parse as `blending-cv` with zero behaviour change.
 *
 *   - "Read the <word>." → `contentType: 'cvc-word'` (next-tier, ticket
 *     86c9kxp08). The planner does NOT emit this template yet — that's
 *     planner-parser contract step 2. This parser accepts the shape now
 *     so the planner widening is a one-side change later, eliminating
 *     the bundling failure mode that produced the P0 in PR #117 → #118.
 *     See `design/word-song/parser-widening-plan.md`.
 *
 * In both content types the word is looked up against the client-side
 * `wordPack`. If the word isn't a known target — either the model
 * drifted, or the wordPack drifted out of sync with the server's
 * embedded list — throw `PlanFromServerError`. Caller falls back to
 * silent mode + a static plan.
 *
 * Out-of-namespace ids (skip-not-throw)
 * -------------------------------------
 * The server response can carry utterances whose ids fall outside the
 * `word.p<N>.<slot>` template — e.g. the `session.end.*` family added in
 * 86c9kj2u6. Those are loaded into the singleton howl-map for cross-screen
 * consumption (SessionEnd reads them via `playSessionUtterance`) but they
 * don't belong in the nested per-problem plan this parser produces. The
 * loop below SKIPS such ids rather than throwing, so additive emissions
 * upstream don't cascade into a silent-fallback regression for WordSong.
 * Malformed-but-namespaced ids (e.g. `word.p1.bogus`) are also skipped
 * here, but the per-problem completeness check downstream still catches
 * them — the bucket for problem 1 will be missing a slot and we throw
 * the clearer `missing slot "<slot>"` error.
 *
 * Pure module: no React, no I/O, no side effects.
 */

import {
  type WordSongContentType,
  type WordSongProblem,
  type WordSongProblemUtterances,
  type WordSongSessionPlan,
  type WordSongUtteranceSlot,
} from './wordSessionPlans'
import { TARGET_WORDS, getWordEntry, type WordEntry } from './wordPack'
import {
  LETTER_SOUND_MNEMONIC_POOL,
  LETTER_SOUND_MNEMONIC_TO_LETTER,
  LETTER_SOUND_PICTURE_KEY_PREFIX,
} from './letterSoundsPool'

// Re-export the shared letter-sounds tier constants so existing
// callers (notably `planFromServer.test.ts`) keep their import path
// unchanged. `letterSoundsPool.ts` is the single source of truth as of
// ticket 86c9y6xkh — see that file's header for rationale.
export {
  LETTER_SOUND_MNEMONIC_POOL,
  LETTER_SOUND_MNEMONIC_TO_LETTER,
  LETTER_SOUND_PICTURE_KEY_PREFIX,
}

/**
 * The 52-glyph ASCII letter pool for the `letter-names` tier (Wave 7 A4b,
 * ticket 86c9y6nc7). Mirrors Kyle's A1 spec §1.1 — both cases of the 26
 * English letters are eligible targets. Source of truth at
 * `design/word-song/letter-names-content.md` §1.1. Pool is exposed for
 * the parser test suite to assert membership.
 */
export const LETTER_GLYPH_POOL: ReadonlySet<string> = new Set([
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'abcdefghijklmnopqrstuvwxyz',
])

/**
 * Sentinel `pictureKey` prefix for synthetic letter-target WordEntries
 * (the `letter-names` tier). Lets downstream consumers (e.g. WordSong.tsx)
 * detect "this is a letter, not a CVC word" without dragging the
 * `contentType` discriminant onto every chip-render branch — though the
 * preferred dispatch is on `problem.contentType === 'letter-names'`.
 */
export const LETTER_GLYPH_PICTURE_KEY_PREFIX = 'letter:'

/**
 * Build a synthetic `WordEntry` for a single letter glyph. Used by the
 * letter-names parser path so `WordSongProblem.target` stays typed
 * uniformly across content types. The entry's `word` field carries the
 * literal letter (case-preserved); `pictureKey` carries the
 * `letter:<X>` sentinel so a downstream consumer can identify the entry
 * without inspecting `contentType` again. `vowel` and `phoneme` are
 * intentionally omitted — the same-vowel distractor logic in
 * `wordDistractors.ts` is never consulted for letter-names (chip-order
 * for this tier is built by a dedicated letter-distractor path in
 * `WordSong.tsx`).
 */
function makeLetterTargetEntry(letter: string): WordEntry {
  return {
    word: letter,
    pictureKey: `${LETTER_GLYPH_PICTURE_KEY_PREFIX}${letter}`,
    // `category` is required on WordEntry. Letters are not nouns of any
    // existing category — `'object'` is the closest neutral bucket, and
    // chosen here because the letter-names render path NEVER consults
    // `category` (gentle-tier filtering is bypassed by the
    // letter-distractor builder in `WordSong.tsx`).
    category: 'object',
    isTarget: true,
  }
}

/**
 * Build a synthetic `WordEntry` for a single letter-sound target. Used
 * by the letter-sounds parser path so `WordSongProblem.target` stays
 * typed uniformly across content types.
 *
 * `word` carries the literal letter (uppercase, case-preserved from the
 * map) — this is what the chip-tap comparison reads when Marian taps a
 * chip. `pictureKey` carries the `letter-sounds:<X>` sentinel so a
 * downstream consumer can identify the entry without inspecting
 * `contentType` again. `vowel` and `phoneme` are intentionally omitted
 * — the same-vowel distractor logic in `wordDistractors.ts` is never
 * consulted for letter-sounds (chip-order for this tier is built by a
 * dedicated letter-sound-distractor path in `WordSong.tsx`).
 */
function makeLetterSoundTargetEntry(letter: string): WordEntry {
  return {
    word: letter,
    pictureKey: `${LETTER_SOUND_PICTURE_KEY_PREFIX}${letter}`,
    // `category` is required on WordEntry. Letters are not nouns of any
    // existing category — `'object'` is the closest neutral bucket, and
    // chosen here because the letter-sounds render path NEVER consults
    // `category` (gentle-tier filtering is bypassed by the
    // letter-sound-distractor builder in `WordSong.tsx`).
    category: 'object',
    isTarget: true,
  }
}

const ALL_SLOTS: readonly WordSongUtteranceSlot[] = [
  'read',
  'correct',
  'reprompt',
  'hint',
  'giveAnswer',
]

/** The 14 target words for level 1, lower-cased keyed for fast membership
 *  test. Mirrors `api/_plannerWordList.ts` and the `isTarget: true` rows
 *  in `wordPack.ts`. We cross-check against this set rather than against
 *  `getWordEntry` alone so distractor-only entries (bus, sun, etc.) can't
 *  slip through if the model misreads the prompt. */
const TARGET_WORD_SET: ReadonlySet<string> = new Set(
  TARGET_WORDS.map((w) => w.word),
)

/** Flat plan shape returned by /api/claude — mirrors `PlannerPlan` in
 *  api/_planner.ts. Re-declared here for the same reason as Math's
 *  planFromServer (no cross-module coupling to api/). */
export interface ServerPlan {
  id: string
  label: string
  utterances: ReadonlyArray<{ id: string; text: string }>
}

export class PlanFromServerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlanFromServerError'
  }
}

/**
 * Build a `WordSongSessionPlan` from a server-returned plan blob.
 *
 * @throws {PlanFromServerError} if the blob isn't shaped right or any
 *   `read` text fails to parse / yields a non-target word.
 */
export function wordSongSessionPlanFromServer(
  serverPlan: unknown,
): WordSongSessionPlan {
  if (!isServerPlan(serverPlan)) {
    throw new PlanFromServerError(
      'server plan did not match { id, label, utterances:[{id,text}] }',
    )
  }

  // Out-of-namespace ids (e.g. session.end.*) are skipped — see file
  // header. The per-problem completeness check below still catches any
  // genuine gaps in the word.p<N>.<slot> coverage.
  const byProblem = new Map<number, Partial<WordSongProblemUtterances>>()
  for (const u of serverPlan.utterances) {
    const parsedId = parseUtteranceId(u.id)
    if (parsedId === null) continue
    const { index, slot } = parsedId
    let bucket = byProblem.get(index)
    if (!bucket) {
      bucket = {}
      byProblem.set(index, bucket)
    }
    bucket[slot] = u.text
  }

  const problems: WordSongProblem[] = []
  for (let index = 1; index <= 8; index++) {
    const bucket = byProblem.get(index)
    if (!bucket) {
      throw new PlanFromServerError(
        `server plan missing problem index ${index}`,
      )
    }
    for (const slot of ALL_SLOTS) {
      if (typeof bucket[slot] !== 'string') {
        throw new PlanFromServerError(
          `server plan problem ${index} missing slot "${slot}"`,
        )
      }
    }
    const utterances = bucket as WordSongProblemUtterances
    const { entry: target, contentType } = parseReadLine(utterances.read)
    problems.push({
      index,
      target,
      utterances,
      contentType,
    })
  }

  return {
    id: serverPlan.id,
    label: serverPlan.label,
    problems,
  }
}

/**
 * Result of parsing a `read` line — the resolved target word entry plus
 * the content-type discriminant inferred from the line's template.
 */
export interface ParsedReadLine {
  entry: WordEntry
  contentType: WordSongContentType
}

/** Per-content-type read-line template config. Source of truth for which
 *  templates the parser accepts. Add a row here to widen further.
 *
 *  Order matters — letter-specific templates (`letter-names`,
 *  `letter-sounds`) MUST come before the generic word-tier templates
 *  (`blending-cv`, `cvc-word`). The letter-names template
 *  `"Tap the letter <X>."` would otherwise be greedy-matched by
 *  `blending-cv`'s `"Tap the <word>."` pattern (it would capture
 *  `letter` as the word and then fail the TARGET_WORD_SET membership
 *  check, surfacing the wrong error). The letter-names pattern requires
 *  the literal `letter` keyword followed by a single ASCII glyph, so it
 *  is strictly more specific. The `letter-sounds` template uses a
 *  distinct verb (`which letter says`, not `tap the` / `read the`) so
 *  no greedy-match overlap exists with the word-tier templates — listing
 *  it among the letter-specific block matches the A4b precedent and
 *  keeps the dispatch order predictable.
 */
const READ_LINE_TEMPLATES: ReadonlyArray<{
  contentType: WordSongContentType
  /** Anchored, case-insensitive, captures the target token in group 1. */
  pattern: RegExp
  /** Human-readable form for error messages. */
  label: string
}> = [
  {
    contentType: 'letter-names',
    // `letter` keyword + single ASCII letter (preserve case in the
    // capture group via the case-insensitive `i` flag stripping). The
    // capture is anchored to a single character so multi-character
    // tokens like `"Tap the letter ABC."` or `"Tap the letter cat."`
    // fall through to the next template (and ultimately fail).
    pattern: /^\s*tap\s+the\s+letter\s+([A-Za-z])\s*\.\s*$/i,
    label: '"Tap the letter <X>."',
  },
  {
    contentType: 'letter-sounds',
    // `Which letter says <MNEMONIC>?` — mnemonic is a plain-prose token
    // (lowercase, 1-3 letters). The token is membership-checked against
    // `LETTER_SOUND_MNEMONIC_POOL` (19 entries) below; the regex's job
    // is structural-shape filtering only. `[a-z]+` matches the
    // mnemonic body case-insensitively — but real canon emits
    // lowercase. Trailing `?` is anchored so prose like "Which letter
    // says mmm in cat?" does NOT match.
    pattern: /^\s*which\s+letter\s+says\s+([a-z]+)\s*\?\s*$/i,
    label: '"Which letter says <MNEMONIC>?"',
  },
  {
    contentType: 'blending-cv',
    pattern: /^\s*tap\s+the\s+([a-z]+)\s*\.\s*$/i,
    label: '"Tap the <word>."',
  },
  {
    contentType: 'cvc-word',
    pattern: /^\s*read\s+the\s+([a-z]+)\s*\.\s*$/i,
    label: '"Read the <word>."',
  },
]

const ACCEPTED_TEMPLATES_LABEL = READ_LINE_TEMPLATES.map((t) => t.label).join(
  ' | ',
)

/**
 * Parse a `read` line and return the target word entry + content type.
 *
 * Templates accepted:
 *   - "Tap the letter <X>." → contentType: 'letter-names' (Wave 7 A4b,
 *     ticket 86c9y6nc7). `<X>` is a single ASCII letter; case is
 *     preserved on the synthesized `WordEntry.word`. Membership is
 *     checked against `LETTER_GLYPH_POOL` (the 52-glyph A-Z + a-z pool
 *     from Kyle's A1 spec §1.1), NOT against `TARGET_WORD_SET`.
 *   - "Which letter says <MNEMONIC>?" → contentType: 'letter-sounds'
 *     (Wave 7 A8b, ticket 86c9y6gea). `<MNEMONIC>` is a plain-prose
 *     English approximation of an isolated phoneme (e.g. `mmm`, `tuh`,
 *     `o`). The token is membership-checked against
 *     `LETTER_SOUND_MNEMONIC_POOL` and mapped to a target letter via
 *     `LETTER_SOUND_MNEMONIC_TO_LETTER`; the parser synthesizes a
 *     sentinel `WordEntry` (no wordPack lookup; letter glyphs are not
 *     in `wordPack.ts`).
 *   - "Tap the <word>." → contentType: 'blending-cv'
 *   - "Read the <word>." → contentType: 'cvc-word' (parser-only today;
 *     planner does not emit this until step 2 — see file header)
 *
 * For the two word-tier templates, the word is membership-checked
 * against the wordPack target set so distractor-only entries (`bus`,
 * `sun`, etc.) cannot slip through. For the letter-tier templates the
 * pool check is tier-specific — `LETTER_GLYPH_POOL` (52-glyph ASCII set)
 * for letter-names, `LETTER_SOUND_MNEMONIC_POOL` (19 mnemonics) for
 * letter-sounds — and the parser synthesizes a sentinel `WordEntry`
 * (no wordPack lookup; letter glyphs do not exist in `wordPack.ts`).
 */
export function parseReadLine(read: string): ParsedReadLine {
  for (const template of READ_LINE_TEMPLATES) {
    const match = read.match(template.pattern)
    if (!match) continue

    // Letter-names branch — pool check + synthesize the target entry.
    if (template.contentType === 'letter-names') {
      const letter = match[1]!
      if (!LETTER_GLYPH_POOL.has(letter)) {
        throw new PlanFromServerError(
          `word-song letter-names read line "${read}" yielded letter "${letter}" outside the 52-glyph ASCII pool`,
        )
      }
      return {
        entry: makeLetterTargetEntry(letter),
        contentType: template.contentType,
      }
    }

    // Letter-sounds branch — mnemonic pool check + letter-glyph
    // synthesis. The mnemonic is lowercased for case-insensitive
    // membership (canon real emits lowercase; defensive).
    if (template.contentType === 'letter-sounds') {
      const mnemonic = match[1]!.toLowerCase()
      if (!LETTER_SOUND_MNEMONIC_POOL.has(mnemonic)) {
        throw new PlanFromServerError(
          `word-song letter-sounds read line "${read}" yielded mnemonic "${mnemonic}" outside the 19-mnemonic pool ` +
            `(accepted: ${Object.keys(LETTER_SOUND_MNEMONIC_TO_LETTER).join(', ')})`,
        )
      }
      const letter = LETTER_SOUND_MNEMONIC_TO_LETTER[mnemonic]!
      return {
        entry: makeLetterSoundTargetEntry(letter),
        contentType: template.contentType,
      }
    }

    // Word-tier branches — membership check + wordPack lookup.
    const word = match[1]!.toLowerCase()
    if (!TARGET_WORD_SET.has(word)) {
      throw new PlanFromServerError(
        `word-song read line "${read}" yielded non-target word "${word}"`,
      )
    }
    // getWordEntry throws if the word is missing entirely; we've already
    // membership-checked against the target set, so this should always
    // resolve. Defensive `try` keeps the error class stable in case the
    // wordPack drifts.
    try {
      return { entry: getWordEntry(word), contentType: template.contentType }
    } catch (err) {
      throw new PlanFromServerError(
        `word-song wordPack lookup failed for "${word}": ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
  throw new PlanFromServerError(
    `word-song read line "${read}" did not match any known template (accepted: ${ACCEPTED_TEMPLATES_LABEL})`,
  )
}

/**
 * Legacy entry point — extract the `WordEntry` only, discarding the
 * content-type discriminant.
 *
 * Kept as a thin wrapper over `parseReadLine` for back-compat with
 * callers (and the existing test suite) pinned to the original return
 * shape. Now accepts both `blending-cv` and `cvc-word` templates — the
 * stricter pre-widening behaviour ("only Tap the <word>." accepted) is
 * available via `parseReadLine` + a check on the returned `contentType`.
 *
 * New code should call `parseReadLine` directly.
 */
export function parseReadTarget(read: string): WordEntry {
  return parseReadLine(read).entry
}

/** Parse a `word.p<N>.<slot>` utterance id. */
function parseUtteranceId(
  id: string,
): { index: number; slot: WordSongUtteranceSlot } | null {
  const match = id.match(
    /^word\.p(\d+)\.(read|correct|reprompt|hint|giveAnswer)$/,
  )
  if (!match) return null
  const index = Number.parseInt(match[1]!, 10)
  if (!Number.isInteger(index) || index < 1) return null
  return { index, slot: match[2] as WordSongUtteranceSlot }
}

function isServerPlan(value: unknown): value is ServerPlan {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.label !== 'string') return false
  if (!Array.isArray(v.utterances)) return false
  for (const u of v.utterances) {
    if (typeof u !== 'object' || u === null) return false
    const r = u as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.text !== 'string') return false
  }
  return true
}
