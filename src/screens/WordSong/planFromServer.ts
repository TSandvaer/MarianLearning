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
import {
  SIMPLE_SENTENCE_TARGET_SET,
  TARGET_WORDS,
  getWordEntry,
  sceneIdForFrame,
  type WordEntry,
} from './wordPack'
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

/**
 * Simple-sentences tier (Wave 13, ticket 86ca8e6fr) — the LAST Word Song
 * content tier. THIS TIER BREAKS THE "capture the read token, look it up"
 * pattern every prior tier uses (Kyle spec §1.2 — the HIGH-RISK SEAM).
 *
 * The read line is `"Finish the sentence: <sentence>."` where `<sentence>`
 * carries the gap word replaced by the literal token `___` (three ASCII
 * underscores). Emma must NOT say the answer aloud (cloze), so the read
 * line does NOT carry the target — it carries `___` at the gap. The target
 * is therefore resolved from the `correct` utterance (`"Yes! <Word>."`),
 * mirroring every tier's stable target encoding.
 *
 * So unlike `parseReadLine` (which returns `{entry, contentType}` from the
 * read alone), the simple-sentence path needs BOTH the `read` (for the
 * `Finish the sentence:` discriminant + the `sentenceFrame` + the derived
 * `sceneId`) AND the `correct` (for the target word). It runs at the
 * per-problem assembly level where both slots are in hand.
 */

/** Discriminant: matches `"Finish the sentence: <sentence>."`. Group 1 is
 *  the full `<sentence>` (gap token preserved). The verb phrase
 *  `Finish the sentence:` is distinct from `Tap the` / `Read the` /
 *  `Which letter says` / `Find the word:`, so dispatch order is NOT
 *  load-bearing — same property the `sight-word` template has. The
 *  sentence may end in `.` or `?` (Template-D question frames). */
const SIMPLE_SENTENCE_READ_PATTERN =
  /^\s*finish\s+the\s+sentence:\s+(.+?[.?])\s*$/i

/** Discriminant: matches the `correct` template `"Yes! <Word>."` — the
 *  capitalised target with a trailing period (identical shape to the
 *  sight-words / CVC `correct`). Group 1 is the target word. */
const SIMPLE_SENTENCE_CORRECT_PATTERN = /^\s*yes!\s+([a-z]+)\.?\s*$/i

/** The literal gap token in the displayed `sentenceFrame` (three ASCII
 *  underscores). The cloze invariant (Kyle §1.2) is EXACTLY ONE per
 *  sentence; zero or two+ is a malformed cloze → throw. */
const SIMPLE_SENTENCE_GAP_TOKEN = '___'

/** Count `___` gap-token occurrences in a sentence frame. */
function countGapTokens(frame: string): number {
  return frame.split(SIMPLE_SENTENCE_GAP_TOKEN).length - 1
}

/**
 * The parsed result of a simple-sentence problem: the target entry
 * (resolved from `correct`), plus the per-problem display carriers
 * (`sentenceFrame` with `___` preserved, derived `sceneId`).
 */
interface ParsedSimpleSentence {
  entry: WordEntry
  sentenceFrame: string
  sceneId: string | undefined
}

/**
 * The number of gentle-phase problems at the head of a simple-sentences
 * session (Dave's dosage: problems 1–3 are gentle — Templates A/B, scene
 * present; problems 4–8 are trap — no scene). Mirrors `GENTLE_RAMP_THROUGH`
 * in `wordDistractors.ts`.
 */
const SIMPLE_SENTENCE_GENTLE_THROUGH = 3

/**
 * Parse a simple-sentence problem from its `read` + `correct` slots.
 *
 * @param index 1-based problem index — gates the gentle-phase scene
 *   derivation (only problems 1–3 carry a scene, Dave's ruling). A trap
 *   problem (4–8) whose frame happens to match a gentle scene's frame
 *   (some frames recur across phases with different gaps) MUST NOT inherit
 *   that scene — the index gate is the disambiguator the frame alone can't
 *   provide.
 * @throws {PlanFromServerError} if the read isn't a `Finish the sentence:`
 *   line, the frame doesn't carry EXACTLY ONE `___` gap, the `correct`
 *   isn't a `Yes! <Word>.` line, or the target word isn't a known wordPack
 *   target.
 */
function parseSimpleSentenceProblem(
  read: string,
  correct: string,
  index: number,
): ParsedSimpleSentence {
  const readMatch = read.match(SIMPLE_SENTENCE_READ_PATTERN)
  if (!readMatch) {
    throw new PlanFromServerError(
      `word-song simple-sentence read line "${read}" did not match the ` +
        `"Finish the sentence: <sentence>." template`,
    )
  }
  const sentenceFrame = readMatch[1]!.trim()

  // Cloze invariant — EXACTLY ONE gap token. A blending-cv stub read
  // ("Tap the cat.") carries ZERO; a malformed double-gap carries 2+.
  const gapCount = countGapTokens(sentenceFrame)
  if (gapCount !== 1) {
    throw new PlanFromServerError(
      `word-song simple-sentence frame "${sentenceFrame}" must contain ` +
        `exactly one "${SIMPLE_SENTENCE_GAP_TOKEN}" gap token, found ${gapCount}`,
    )
  }

  // Target resolution — from `correct`, NEVER the gapped read line
  // (Kyle §1.2). This is the load-bearing parser divergence.
  const correctMatch = correct.match(SIMPLE_SENTENCE_CORRECT_PATTERN)
  if (!correctMatch) {
    throw new PlanFromServerError(
      `word-song simple-sentence correct line "${correct}" did not match ` +
        `the "Yes! <Word>." template — the target word is resolved from ` +
        `correct (the read line gaps the answer), so this is required`,
    )
  }
  const word = correctMatch[1]!.toLowerCase()
  // Membership is by the SIMPLE-SENTENCE pool, NOT the CVC `TARGET_WORD_SET`
  // — several valid gap targets (e.g. `sat`) are distractor-only entries in
  // their home tier but legitimate targets here (Kyle §1.2, wordPack note).
  if (!SIMPLE_SENTENCE_TARGET_SET.has(word)) {
    throw new PlanFromServerError(
      `word-song simple-sentence correct line "${correct}" yielded ` +
        `non-target word "${word}"`,
    )
  }
  let entry: WordEntry
  try {
    entry = getWordEntry(word)
  } catch (err) {
    throw new PlanFromServerError(
      `word-song simple-sentence wordPack lookup failed for "${word}": ` +
        `${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // Derive the gentle-phase sceneId from the frame (Kyle §1.3 — the wire
  // is utterance-only, so the parser derives it). ONLY problems 1–3 (the
  // gentle window) carry a scene; trap problems (4–8) are text-only by
  // Dave's ruling. The index gate is load-bearing: some frames recur
  // across phases with a different gap (e.g. "The dog ran ___." is gentle
  // with gap "in" but also a trap row with gap "there"), so a frame-only
  // lookup would wrongly attach the gentle scene to the trap problem. A
  // scene is derived only when BOTH the problem is gentle AND the frame is
  // registered; otherwise undefined → text-only (trap phase OR missing
  // scene — one predicate downstream).
  const sceneId =
    index <= SIMPLE_SENTENCE_GENTLE_THROUGH
      ? sceneIdForFrame(sentenceFrame)
      : undefined

  return { entry, sentenceFrame, sceneId }
}

/** Does a read line carry the `Finish the sentence:` discriminant? Used at
 *  the assembly level to route to the simple-sentence path before the
 *  generic `parseReadLine`. */
function isSimpleSentenceRead(read: string): boolean {
  return SIMPLE_SENTENCE_READ_PATTERN.test(read)
}

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

    // Simple-sentence tier (Wave 13) breaks the read-only target pattern:
    // the read gaps the answer, so the target comes from `correct` and the
    // frame + sceneId are derived from the read. Route to the dedicated
    // path before the generic `parseReadLine` (Kyle spec §1.2).
    if (isSimpleSentenceRead(utterances.read)) {
      const { entry, sentenceFrame, sceneId } = parseSimpleSentenceProblem(
        utterances.read,
        utterances.correct,
        index,
      )
      problems.push({
        index,
        target: entry,
        utterances,
        contentType: 'simple-sentence',
        sentenceFrame,
        sceneId,
      })
      continue
    }

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
    // `Which letter says <MNEMONIC><TERM>` — mnemonic is a plain-prose
    // token (lowercase, 1-3 letters). The token is membership-checked
    // against `LETTER_SOUND_MNEMONIC_POOL` (19 entries) below; the
    // regex's job is structural-shape filtering only. `[a-z]+` matches
    // the mnemonic body case-insensitively — but real canon emits
    // lowercase.
    //
    // <TERM> is `[.?]` — the British-voice rollout (2026-06-06) made the
    // read line's terminal punctuation SOUND-CLASS-DEPENDENT: VOICELESS
    // sounds (s, f, h, voiceless stops p/t/k) keep the question form
    // `"...?"`, while VOICED sounds (nasals, liquids, voiced fricatives,
    // voiced stops, ALL vowels) emit the DECLARATIVE form `"...."`. The
    // pre-rollout parser only accepted `?`, so declarative voiced reads
    // like `"Which letter says mmm."` were rejected → Path A silent
    // fallback ("Tap the cat"). This is the planner↔parser contract
    // (`project_planner_parser_contract` memory): the browser parser
    // MUST accept every read shape the canon emits.
    //
    // Round-3 (example-word anchoring, LOCKED): the read MAY carry an
    // optional `, like in <word>` anchor suffix for the central/lax
    // vowels U/I, e.g. `"Which letter says uh, like in cup?"` (the
    // Thomas-approved Primary form). Group 1 captures ONLY the leading
    // mnemonic token (`uh`/`ih`), which IS in the main pool; the anchor
    // phrase (cup/ink) is consumed by the optional non-capturing group.
    // The terminal stays anchored so prose like "Which letter says mmm
    // in cat?" does NOT match. (The rejected Anchor-only candidate used
    // a bare-letter `u`/`i` leading token; that path was removed.)
    pattern:
      /^\s*which\s+letter\s+says\s+([a-z]+)(?:,\s*like\s+in\s+[a-z]+)?\s*[.?]\s*$/i,
    label: '"Which letter says <MNEMONIC>[, like in <word>]." / "...?"',
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
  {
    contentType: 'sight-word',
    // Sight-words tier (Wave 11, ticket 86ca7xmr8). Distinct verb
    // ("find the word:") — no greedy-match overlap with the `tap the` /
    // `read the` word-tier templates, so order among the word-tier
    // templates is not load-bearing. The captured target is
    // membership-checked against `TARGET_WORD_SET` and resolved via
    // `getWordEntry` exactly like the CVC tiers (sight words are real
    // `wordPack.ts` entries, NOT synthesized sentinels). Whole-word
    // RECOGNITION, not decoding — see the `WordSongContentType` docstring
    // in `wordSessionPlans.ts`. The colon in "Find the word:" is part of
    // the verb phrase; `[a-z]+` captures the single target token after it.
    pattern: /^\s*find\s+the\s+word:\s+([a-z]+)\s*\.\s*$/i,
    label: '"Find the word: <word>."',
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
 *   - "Which letter says <MNEMONIC>." / "...?" → contentType:
 *     'letter-sounds' (Wave 7 A8b, ticket 86c9y6gea; terminal
 *     punctuation widened in the 2026-06-06 British-voice rollout).
 *     `<MNEMONIC>` is a plain-prose English approximation of an
 *     isolated phoneme (e.g. `mmm`, `tuh`, `o`). The terminal is `.`
 *     for VOICED sounds (declarative) and `?` for VOICELESS sounds
 *     (question) — both are accepted. The token is membership-checked
 *     against
 *     `LETTER_SOUND_MNEMONIC_POOL` and mapped to a target letter via
 *     `LETTER_SOUND_MNEMONIC_TO_LETTER`; the parser synthesizes a
 *     sentinel `WordEntry` (no wordPack lookup; letter glyphs are not
 *     in `wordPack.ts`).
 *   - "Tap the <word>." → contentType: 'blending-cv'
 *   - "Read the <word>." → contentType: 'cvc-word' (parser-only today;
 *     planner does not emit this until step 2 — see file header)
 *   - "Find the word: <word>." → contentType: 'sight-word' (Wave 11,
 *     ticket 86ca7xmr8). `<word>` is a high-frequency sight word
 *     (the, a, was, said, ...) membership-checked against
 *     `TARGET_WORD_SET` and resolved via `getWordEntry` exactly like the
 *     CVC tiers — sight words are real `wordPack.ts` entries, NOT
 *     synthesized sentinels. Whole-word RECOGNITION, not decoding.
 *
 * For the three word-tier templates (blending-cv / cvc-word /
 * sight-word), the word is membership-checked against the wordPack
 * target set so distractor-only entries (`bus`, `sun`, etc.) cannot slip
 * through. For the letter-tier templates the pool check is tier-specific
 * — `LETTER_GLYPH_POOL` (52-glyph ASCII set)
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
    // membership (canon real emits lowercase; defensive). Group 1 is the
    // LEADING token only; any round-3 `, like in <word>` anchor suffix
    // was consumed by the regex's optional non-capturing group.
    if (template.contentType === 'letter-sounds') {
      const mnemonic = match[1]!.toLowerCase()
      // Resolution against the 21-mnemonic pool (14 consonants + 5
      // triplet vowels + the round-3 isolate leads uh/ih). The LOCKED
      // anchored U/I reads lead with `uh`/`ih`, which ARE in the pool —
      // so the optional `, like in <word>` anchor suffix never needs a
      // separate bare-letter fallback. (The rejected Anchor-only
      // candidate's bare `u`/`i` fallback was removed.)
      const letter = LETTER_SOUND_MNEMONIC_TO_LETTER[mnemonic]
      if (letter === undefined) {
        throw new PlanFromServerError(
          `word-song letter-sounds read line "${read}" yielded mnemonic "${mnemonic}" outside the mnemonic pool ` +
            `(accepted: ${Object.keys(LETTER_SOUND_MNEMONIC_TO_LETTER).join(', ')})`,
        )
      }
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
