// Session-plan generator for /api/claude.
//
// "Claude is the brain, not the mouth" — this module owns the one Anthropic
// call per session start. It returns a structured session plan (8 problems
// for math, 8 problems for word-song) as a flat list of utterance sources
// in the wire shape `{ id, text }[]` that `_session.renderSessionAudio`
// consumes for TTS rendering.
//
// Architecture decisions (ticket 86c9jdh39)
// -----------------------------------------
//  1. Model: pinned to `claude-haiku-4-5-20251001`. CLAUDE.md mandates
//     Haiku for session generation (Sonnet for stumble explanations). NOT
//     `claude-haiku-latest` — model swaps are deliberate code changes,
//     not surprises that show up in production.
//  2. Prompt caching: the system prompt (Marian profile + voice config +
//     output JSON schema description) carries `cache_control: ephemeral`
//     on its last block. The volatile per-call inputs (track, level,
//     childName) sit in the user message, which never enters the cache
//     prefix. See shared/prompt-caching.md for the invariant.
//
//     CAVEAT: the current prompt is ~600 tokens, well below Haiku 4.5's
//     4096-token minimum cacheable prefix — so the marker is a no-op
//     TODAY. It's left in place as a forward-compatible breakpoint: as
//     the prompt grows (curriculum levels 2-9, more examples, future
//     guard rails) and crosses 4096 tokens, caching activates
//     automatically with no code change. When that crossing happens,
//     verify via response.usage.cache_read_input_tokens in a smoke test.
//  3. Dependency injection: the SDK client is passed in, not constructed
//     inside this module. Tests mock the client; production wiring lives
//     in `api/claude.ts` (one place that reads the API key, one place that
//     constructs the SDK). This also means the planner has zero side
//     effects beyond what its caller orchestrates.
//  4. Track-aware branching: the system prompt includes track-specific
//     guidance (math curriculum vs phonics curriculum), and the user
//     message names the track explicitly. Same model, different prompts.
//  5. Output shape: flat `{ id, label, utterances: [{ id, text }] }`. The
//     browser rehydrates back into nested `MathSessionPlan` /
//     `WordSongSessionPlan` via existing adapters
//     (`mathSessionPlanFromWire`, `wordSongSessionPlanFromWire`). The
//     server doesn't need the nested shape — `_session` walks the flat
//     `utterances` array for TTS, and the response carries the flat plan
//     through to the client where rehydration happens.
//
// Cost note (sanity-check value, not a contract)
// ----------------------------------------------
// Haiku 4.5 pricing as of 2026-04: $1.00/1M input, $5.00/1M output. With
// prompt caching, a session-start is approximately:
//   - System prompt (~1500 tokens): cache HIT typical, ~0.10× rate → $0.00015
//   - User message (~50 tokens, varies): full rate → $0.00005
//   - Output (8 problems × ~5 utterances × ~10 tokens ≈ 400 tokens): $0.002
//   - Azure F0 free tier covers TTS (40 utterances within F0 budget)
// Total: ~$0.0022 per session start. At 10 sessions/day = ~$0.66/month.
// If the share-link leaks and gets hammered, the per-IP rate limit caps
// damage at 6 starts/IP/min × 8760 hr/yr × 60 min × $0.0022 ≈ $7K/yr per
// IP — still uncomfortable, hence the rate limit is necessary, not just
// nice-to-have.

import {
  WORD_SONG_TARGET_WORDS_FOR_PROMPT,
  WORD_SONG_DISTRACTOR_HINTS,
} from './_plannerWordList.js'
import { renderSessionAudio, type RenderSessionOptions } from './_session.js'
import type { SessionStartResponse } from './_types.js'

/** What kind of session we're generating. */
export type PlannerTrack = 'math' | 'word-song'

/** Minimal Anthropic SDK surface used by the planner. We define our own
 *  shape rather than importing `Anthropic` so that tests don't have to
 *  satisfy the full SDK type. The handler in `claude.ts` imports the real
 *  SDK and adapts. */
export interface PlannerAnthropicClient {
  messages: {
    create: (args: PlannerCreateArgs) => Promise<PlannerCreateResponse>
  }
}

export interface PlannerSystemBlock {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}

export interface PlannerUserMessage {
  role: 'user'
  content: string
}

export interface PlannerCreateArgs {
  model: string
  max_tokens: number
  system: PlannerSystemBlock[]
  messages: PlannerUserMessage[]
}

export interface PlannerCreateResponse {
  content: Array<{ type: string; text?: string }>
}

/**
 * Skill-tree node names accepted on the wire (M2 — ticket 86c9kmwba).
 * Mirrors `NumberGardenNode` ∪ `WordSongNode` from `src/lib/progress/types.ts`.
 *
 * Why duplicated here
 * -------------------
 * The api/ build runs under a server-only tsconfig. Importing the union
 * straight from `src/lib/progress/types.ts` would either drag the whole
 * progress module into the function bundle or require a shared package
 * — neither is worth it for a 17-string list. The static contract is
 * enforced by the unit test in `focusNode.test.ts` which pins the
 * client-side ordering, plus the regex check below which rejects any
 * unknown focus-node name at request-validation time. If a node is
 * added/renamed in `types.ts`, this list and the *_FOCUS_NODE_GUIDE
 * blocks below get a paired edit; the planner refuses unknown nodes so
 * a missed sync surfaces immediately as a request rejection, not as
 * silently-wrong content.
 */
export const VALID_MATH_FOCUS_NODES: readonly string[] = [
  'number-recog',
  'add-to-10',
  'add-to-20',
  'sub-to-10',
  'sub-to-20',
  'two-digit-addsub',
  'skip-counting',
  'mult-2-5-10',
  'mult-3-4',
  'mult-6-9',
]

export const VALID_WORD_SONG_FOCUS_NODES: readonly string[] = [
  'letter-names',
  'letter-sounds',
  'blending-cv',
  'cvc-words',
  'digraphs',
  'sight-words',
  'simple-sentences',
]

export interface GenerateSessionPlanArgs {
  /** Anthropic SDK client (or a test stub matching its surface). */
  client: PlannerAnthropicClient
  track: PlannerTrack
  /** 1-based curriculum level. Today, both tracks only support level 1
   *  (sums to 10 / CVC short-a). Future levels will branch the prompt
   *  further; for now level is a passthrough so the wire shape is forward-
   *  compatible. */
  level: number
  /** The child's name. Used for the friendly opening line ("Hi Marian!").
   *  Bounded: pre-validated upstream; we still escape on use. */
  childName: string
  /**
   * M2 (ticket 86c9kmwba). The skill node the browser thinks is the
   * current focus, computed from `Progress.skillLevels` via
   * `pickFocusNode()`. When supplied, the user message names the node
   * by string and the planner generates problems for that slice of the
   * curriculum. When omitted, falls back to the level-1 default of the
   * track (math: `add-to-10`, word-song: `cvc-words`) — preserves
   * compatibility with existing browsers that don't yet ship this field.
   *
   * Validation: must be one of `VALID_MATH_FOCUS_NODES` (when track is
   * math) or `VALID_WORD_SONG_FOCUS_NODES` (when track is word-song),
   * or the planner throws PlannerError("invalid-request"). Cross-track
   * focus nodes (math focus on word-song track) are rejected for the
   * same reason — the prompt only enumerates one track's nodes at a time
   * to keep the cache prefix stable.
   */
  focusNode?: string
  /**
   * M2 (ticket 86c9kmwba). Last-3 mean success rate for the track,
   * 0..1, or `null` when there is no recent history. Surfaced to the
   * planner as a soft hint — the prompt phrases it as "recent score"
   * but does not branch on it; the model uses it to choose the
   * easier-vs-harder mix within the level. Volatile per call; lives in
   * the user message (NOT the cache prefix).
   */
  recentSuccessRate?: number | null
}

/** Plan shape returned by the planner — flat, wire-ready. Mirrors what
 *  `mathSessionPlanToUtteranceSources` / `wordSongSessionPlanToUtteranceSources`
 *  emit on the client. */
export interface PlannerPlan {
  id: string
  label: string
  utterances: PlannerUtteranceSource[]
}

export interface PlannerUtteranceSource {
  id: string
  text: string
}

/** Stable error codes for callers (api/claude.ts) to map onto the wire
 *  error envelope. */
export type PlannerErrorCode =
  | 'config-missing'
  | 'invalid-request'
  | 'invalid-response'
  | 'upstream-error'

export class PlannerError extends Error {
  readonly code: PlannerErrorCode
  constructor(code: PlannerErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.code = code
    this.name = 'PlannerError'
  }
}

/** Pinned Haiku model id. Per ticket 86c9jdh39 + memory
 *  `feedback_run_vitest_before_merge.md`: model swaps are deliberate code
 *  changes; never use a `*-latest` alias. As of 2026-04 the latest Haiku
 *  is `claude-haiku-4-5-20251001`. */
export const PLANNER_MODEL_ID = 'claude-haiku-4-5-20251001'

const SUPPORTED_TRACKS: readonly PlannerTrack[] = ['math', 'word-song']

/**
 * Generate a session plan via Haiku. See file header for architecture.
 *
 * @throws {PlannerError} on missing config, malformed request, malformed
 *   response, or upstream SDK failure.
 */
export async function generateSessionPlan(
  args: GenerateSessionPlanArgs,
): Promise<PlannerPlan> {
  // Defensive double-check; the handler in claude.ts also checks. This
  // means cron/CLI callers (future) get the same error class.
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new PlannerError(
      'config-missing',
      'ANTHROPIC_API_KEY is not set in the function environment',
    )
  }

  if (!SUPPORTED_TRACKS.includes(args.track)) {
    throw new PlannerError(
      'invalid-request',
      `unknown track: ${String(args.track)} (expected: math | word-song)`,
    )
  }

  // M2 (ticket 86c9kmwba). focusNode is optional; when present, it must
  // belong to the requested track — the prompt only enumerates one
  // track's focus-node universe at a time. A cross-track value (e.g.
  // {track: 'math', focusNode: 'cvc-words'}) is malformed input and
  // we reject loudly. Absent focusNode falls back to the track's level-1
  // default in buildUserMessage.
  if (args.focusNode !== undefined) {
    const allowed =
      args.track === 'math'
        ? VALID_MATH_FOCUS_NODES
        : VALID_WORD_SONG_FOCUS_NODES
    if (!allowed.includes(args.focusNode)) {
      throw new PlannerError(
        'invalid-request',
        `unknown focusNode for track ${args.track}: ${args.focusNode}`,
      )
    }
  }

  const system = buildSystemPrompt(args.track)
  const user = buildUserMessage(args)

  let response: PlannerCreateResponse
  try {
    response = await args.client.messages.create({
      model: PLANNER_MODEL_ID,
      // 8 problems × 5 utterance slots + 19 Session-End utterances = 59
      // utterances. At ~12 tokens per line plus JSON structural overhead
      // and Haiku's tendency to wrap in a markdown fence, a generous
      // upper bound is ~1500 tokens. We use 4000 to leave headroom for
      // longer utterance content (e.g. `two-digit-addsub` problems
      // spell out two-digit numbers, "Twenty-three plus four. How many?"
      // is ~14 tokens by itself; baking that combo with max_tokens=2000
      // truncated the response and surfaced as `invalid-response` —
      // see ticket 86c9kwhbc PR notes). 4000 is still far below Haiku's
      // 64K streamable cap, so no streaming needed; the higher cap only
      // affects truncation-prone combos and is otherwise free.
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: user }],
    })
  } catch (err) {
    // Don't let raw SDK errors (which may carry headers / request bodies
    // in their `.cause` chain) escape — wrap in a typed error and let
    // the handler decide what to surface. We do NOT include the raw
    // message in the wrapped error if it came from a network library
    // we don't control; truncate to a known-safe prefix.
    const msg = err instanceof Error ? err.message : String(err)
    throw new PlannerError(
      'upstream-error',
      `anthropic call failed: ${msg.slice(0, 200)}`,
      { cause: err instanceof Error ? err : undefined },
    )
  }

  const text = extractText(response)
  if (text === null) {
    throw new PlannerError(
      'invalid-response',
      'anthropic response had no text content block',
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripMarkdownFence(text))
  } catch (err) {
    throw new PlannerError(
      'invalid-response',
      `anthropic response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    )
  }

  if (!isPlannerPlan(parsed)) {
    throw new PlannerError(
      'invalid-response',
      'anthropic response did not match the expected session-plan shape',
    )
  }

  return parsed
}

/**
 * Args for the higher-level `generateSessionStartResponse` callable.
 * Combines `generateSessionPlan` inputs with optional render seams so the
 * canon-generator script (and tests) can inject mocks for both the
 * Anthropic SDK and the TTS synth without going through the HTTP handler.
 *
 * Added ticket 86c9kwhbc (D — pre-baked session canon). The callable
 * exists so the build-time canon-generator script can reuse the exact
 * same Haiku → SSML → Azure TTS pipeline the live request handler uses,
 * with one source of truth for both code paths.
 */
export interface GenerateSessionStartResponseArgs {
  /** Anthropic SDK client (or a test stub). REQUIRED — the caller owns
   *  construction so we have one place that reads the API key (the live
   *  handler in api/claude.ts) and one place that can inject a stub
   *  (tests / generator). */
  client: PlannerAnthropicClient
  track: PlannerTrack
  level: number
  childName: string
  focusNode?: string
  recentSuccessRate?: number | null
  /** Optional render-pipeline overrides. Production wiring leaves this
   *  empty — `_session.renderSessionAudio` resolves to the real Azure
   *  synth. Tests + the canon generator can swap in a fake synth or tune
   *  concurrency. */
  renderOptions?: RenderSessionOptions
}

/**
 * Generate a complete session-start response: Haiku-planned utterances
 * rendered to base64-encoded MP3 via Azure TTS.
 *
 * Why a callable
 * --------------
 * Pre-86c9kwhbc this composition lived inline inside the
 * `/api/claude` HTTP handler — `generateSessionPlan(...)` then
 * `renderSessionAudio(...)`. Pulling the pair into a single callable
 * lets the build-time canon-generator (`scripts/generateSessionCanon.ts`)
 * pre-bake every (track, level, focusNode) combo as a static blob
 * without spinning up an HTTP server. The HTTP handler now calls this
 * callable too, so live and pre-baked traffic share one code path.
 *
 * Error semantics
 * ---------------
 * - Planner failures (invalid JSON, upstream SDK error, etc.) propagate
 *   as `PlannerError` — same as `generateSessionPlan` raises. The HTTP
 *   handler distinguishes `config-missing` (→ 500) from everything else
 *   (→ 502 planner-failed) per its existing contract.
 * - Render failures propagate from `renderSessionAudio`. Per its own
 *   contract a partial render is a 200 OK with some utterances missing;
 *   only an unexpected exception (e.g. base64 encoder bug) escapes here,
 *   and the handler maps that to 502 tts-failed.
 *
 * Pure function (modulo `args.client` and `args.renderOptions.synth`):
 * no module-scope state is mutated, no env vars are read inside this
 * function (the planner double-checks `ANTHROPIC_API_KEY` itself).
 */
export async function generateSessionStartResponse(
  args: GenerateSessionStartResponseArgs,
): Promise<SessionStartResponse> {
  const plan = await generateSessionPlan({
    client: args.client,
    track: args.track,
    level: args.level,
    childName: args.childName,
    focusNode: args.focusNode,
    recentSuccessRate: args.recentSuccessRate,
  })
  return renderSessionAudio(plan, args.renderOptions)
}

/**
 * Strip a single surrounding markdown code fence from a model response.
 *
 * Empirically (ticket 86c9jrwb4), `claude-haiku-4-5-20251001` returns the
 * session-plan JSON wrapped in ```json\n...\n``` on every call, despite the
 * system prompt explicitly forbidding code fences. This helper unwraps the
 * fence so `JSON.parse` sees clean JSON. Three shapes covered:
 *   1. ```json\n{...}\n```  (most common — language tag)
 *   2. ```\n{...}\n```      (no language tag)
 *   3. {...}                 (already clean — pass through unchanged)
 *
 * The regex anchors to the start and end of the (trimmed) string and only
 * unwraps a *complete* fenced block — partial/torn fences in the middle of
 * the text fall through to the original string and let JSON.parse surface
 * the real error. Pure function; no side effects.
 */
export function stripMarkdownFence(text: string): string {
  // Anchored: start of string, optional whitespace, ``` , optional language
  // tag, optional newline, captured body, optional newline, optional
  // whitespace, ``` , optional whitespace, end of string. `[\s\S]*?` is the
  // dotall-equivalent for body content (newlines included).
  const match = text.match(/^\s*```(?:json)?\s*\n?([\s\S]*?)\n?\s*```\s*$/)
  return match ? match[1]! : text
}

/**
 * Walk a Message response and return the first text block's content, or
 * null if no text block exists. We intentionally don't concatenate
 * multiple text blocks — Haiku with structured-JSON instructions emits a
 * single block; if it doesn't, that's a malformed response.
 */
function extractText(response: PlannerCreateResponse): string | null {
  for (const block of response.content) {
    if (block.type === 'text' && typeof block.text === 'string') {
      return block.text
    }
  }
  return null
}

function isPlannerPlan(value: unknown): value is PlannerPlan {
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

/**
 * Build the cached system prompt. Two blocks: a stable preamble + a
 * track-specific block. The cache_control marker on the LAST block caches
 * everything before it (per shared/prompt-caching.md — render order is
 * tools → system → messages, marker on last block of a section caches the
 * whole section).
 *
 * We split into two text blocks (vs one) so future expansion (adding a
 * level-specific block, say) doesn't require renormalizing the preamble.
 */
function buildSystemPrompt(track: PlannerTrack): PlannerSystemBlock[] {
  return [
    { type: 'text', text: SYSTEM_PREAMBLE },
    {
      type: 'text',
      text: track === 'math' ? MATH_TRACK_GUIDE : WORD_SONG_TRACK_GUIDE,
      cache_control: { type: 'ephemeral' },
    },
  ]
}

/**
 * Default focus node when the caller doesn't supply one. Pre-M2 callers
 * (today's deployed browser) hit this fallback; the level-1 default of
 * each track matches what the planner used to generate before focusNode
 * existed — sums to 10 for math, CVC blending for word-song.
 */
function defaultFocusNodeForTrack(track: PlannerTrack): string {
  return track === 'math' ? 'add-to-10' : 'blending-cv'
}

/**
 * Word-song focus nodes the planner emits FIRST-CLASS content for today.
 * Anything else in `VALID_WORD_SONG_FOCUS_NODES` is valid input but falls
 * back to `blending-cv` content via `effectiveFocusNode` below
 * (stub-fallback — see header comment on `WORD_SONG_TRACK_GUIDE`).
 *
 * Step 2 of the planner-parser contract (ticket 86c9kxu07) added
 * `cvc-words` here. Future tier widenings (letter-sounds, digraphs,
 * sight-words, simple-sentences) come in their own paired
 * parser-first-then-planner widenings.
 */
const WORD_SONG_FIRST_CLASS_FOCUS_NODES: readonly string[] = [
  'blending-cv',
  'cvc-words',
]

/**
 * Resolve the focus node the planner actually generates for. Math honours
 * caller-supplied focusNode verbatim. Word-song honours first-class nodes
 * (`blending-cv`, `cvc-words`); valid-but-unsupported nodes
 * (`letter-sounds`, `digraphs`, `sight-words`, `simple-sentences`) fall
 * back to `blending-cv` content as a stub — the screen always renders,
 * even on tiers we haven't tuned yet. See `WORD_SONG_TRACK_GUIDE` for
 * the prompt-side handling.
 *
 * Validation (`generateSessionPlan` above) still rejects an invalid
 * cross-track or unknown focusNode for word-song before reaching here —
 * the fallback is for valid-but-untuned nodes only.
 */
function effectiveFocusNode(args: GenerateSessionPlanArgs): string {
  if (args.track === 'math') {
    return args.focusNode ?? defaultFocusNodeForTrack(args.track)
  }
  // word-song
  const requested = args.focusNode ?? defaultFocusNodeForTrack(args.track)
  if (WORD_SONG_FIRST_CLASS_FOCUS_NODES.includes(requested)) {
    return requested
  }
  // Stub fallback for untuned tiers.
  return 'blending-cv'
}

function buildUserMessage(args: GenerateSessionPlanArgs): string {
  // childName is escaped defensively. The system prompt instructs the
  // model to use it verbatim; without escaping, a name with a quote would
  // confuse the JSON output. In practice childName comes from the
  // browser's localStorage and is sanitized at sign-in, but defense in
  // depth is cheap here.
  const safeName = args.childName.replace(/[^\p{L}\p{N}\s'.-]/gu, '').trim()
  const trackLabel = args.track === 'math' ? 'Math' : 'Word Song'
  const focusNode = effectiveFocusNode(args)

  // Recent score line is included verbatim only when we have data —
  // otherwise the model would condition on a numeric value we made up.
  // The "no recent score" branch is short and explicit so Haiku doesn't
  // hallucinate a baseline from level alone.
  const recentScoreLine =
    typeof args.recentSuccessRate === 'number'
      ? `Recent score on this skill: ${args.recentSuccessRate.toFixed(2)} (0..1).`
      : `Recent score on this skill: no data yet — pick a balanced mix.`

  return [
    `Generate a session plan for the ${trackLabel} track at level ${args.level}.`,
    `Focus skill node: ${focusNode}.`,
    recentScoreLine,
    `Child's name: ${safeName || 'friend'}.`,
    `Return JSON only — no surrounding prose, no markdown fences.`,
  ].join('\n')
}

// ── Prompt copy ──────────────────────────────────────────────────────────

const SYSTEM_PREAMBLE = `You are Emma, a warm, calm, encouraging young teacher in a learning app for an 8-year-old child named Marian.

Marian's context:
- Speaks Tagalog primarily, with growing English. Use only common, concrete English words from a young learner's vocabulary (around 200 core words: numbers one-ten, simple verbs like "tap", "look", "try", "count", common nouns), plus the target phonics words for the lesson. No idioms, no abstract nouns, no compound sentences.
- Easily discouraged by error feedback. Never use shame, urgency, or "try again" nag language. The reprompt is always exactly "Hmm... try again?" — that wording was chosen by the UX designer specifically because the rising "Hmm..." reads as gentle puzzlement, not correction.

Output contract:
You MUST return a single JSON object — no prose, no code fences, no commentary. The shape is:

{
  "id": "<short kebab-case identifier for this plan, e.g. 'sums-to-10-warm-up'>",
  "label": "<short human-readable label for QA logs>",
  "utterances": [
    { "id": "<stable utterance id>", "text": "<short spoken line>" },
    ...
  ]
}

Rules:
- Exactly 8 problems per plan.
- Each problem has exactly 5 utterances with these slot names: read, correct, reprompt, hint, giveAnswer.
- Utterance ids follow the pattern "<track>.p<N>.<slot>" — e.g. "math.p1.read", "math.p1.correct", "word.p1.read", etc. The N is the 1-based problem index.
- Lines are spoken aloud by Emma's TTS voice. Keep them short (1 short sentence is ideal; 2 if needed for the hint). No abbreviations Emma can't read aloud naturally. No emoji. No exclamation marks beyond one per line.
- The "reprompt" line for every problem should be "Hmm... try again?" verbatim — that's the spec wording, intentionally repeated for cache locality.
- Never write "wrong", "incorrect", "X", or anything shaming.

Session-End utterances (REQUIRED — append to the same flat utterances array):
After the 8 × 5 problem utterances, append the following Session-End utterances. The Session-End screen looks them up by exact id at runtime and degrades gracefully on a miss, but every id below MUST be emitted so the celebration never falls back to silent captions.

  - "session.end.opener" — text: "You did it!"
  - "session.end.recap.1" through "session.end.recap.11" — one entry per N in 1..11. The N=1 line is "You earned one star!"; for N >= 2 the line is "You earned <number-word> stars!" with the number spelled out (one, two, three, four, five, six, seven, eight, nine, ten, eleven). Never use digits; never use "stars" with N=1.
  - "session.end.streak.3" through "session.end.streak.8" — one entry per N in 3..8. Each line is "<number-word> in a row! Wow!" with the number spelled out (three, four, five, six, seven, eight). Capitalise the leading word.
  - "session.end.goodbye" — text: "See you soon."

Total Session-End utterances: 1 opener + 11 recap + 6 streak + 1 goodbye = 19. The full flat utterances array therefore has 8 × 5 + 19 = 59 entries. Do not invent extra Session-End ids; do not skip any of the listed Session-End ids.`

const MATH_TRACK_GUIDE = `Track: Math.

The user message names a focus skill node. Generate problems specifically for that node. The full math focus-node menu is:

- number-recog: number recognition. Say a numeral, child taps it. Numerals 1-10. read: "Tap the <number>." e.g. "Tap the five."
- add-to-10: addition with sums 3-10. Both addends 1-9. read: "<addend-A> plus <addend-B>. How many?" e.g. "Three plus two. How many?" Prefer bridge-through-5 (3+2, 4+3), easy doubles (2+2, 4+4), and small near-doubles. Sums must be <= 10.
- add-to-20: addition with sums 11-20. Both addends 1-9 (or use a teen + 1). read: same template — "Seven plus six. How many?" Sums must be in 11-20 (never <=10 — that's add-to-10).
- sub-to-10: subtraction with both operands and answer in 1-10. read: "<A> minus <B>. How many?" e.g. "Seven minus three. How many?"
- sub-to-20: subtraction within 20. read: same template; the answer may be 1-19.
- two-digit-addsub: addition or subtraction with at least one two-digit addend. read: "Twenty-three plus four. How many?" Answer < 100, no carrying/borrowing in this slice.
- skip-counting: count by 2s, 5s, or 10s. read: "Two, four, six, ... what's next?" Answer is the next term.
- mult-2-5-10: multiplication by 2, 5, or 10. read: "Two times <X>. How many?" Answer is the product.
- mult-3-4: multiplication by 3 or 4. read: same template.
- mult-6-9: multiplication by 6, 7, 8, or 9. read: same template.

Per-problem utterance template (any focus node):
- read: see the focus-node-specific shape above.
- correct: "Yes! <answer>!" e.g. "Yes! Five!"
- reprompt: "Hmm... try again?"  (verbatim)
- hint: "Look. <gentle scaffold>." e.g. for add-to-10 — "Look. Three. And two more. How many now?"; for skip-counting — "Look. We added two each time."
- giveAnswer: "This one is <answer>." e.g. "This one is five."

Pick exactly 8 distinct problems for the focus node, ordered easier → slightly harder across problems 1-8. Spell numbers as words (one, two, ... ten, eleven, ... twenty), not digits. Capitalize the first word of each sentence. The "recent score" hint in the user message guides easier-vs-harder mix: low score → mostly the easiest end of the slice; high score → push the harder end.`

// Word-song planner system prompt — ticket 86c9kxu07 (planner-parser
// contract step 2). Two first-class content modes today:
//
//   - blending-cv  → "Tap the <word>." (match-picture-to-spoken-word)
//   - cvc-words    → "Read the <word>." (decode-printed-word)
//
// Both are gated by the browser parser (PR #132 widened it to dispatch
// on the read-line template). Other valid focus nodes
// (letter-sounds, digraphs, sight-words, simple-sentences) reach this
// prompt as `blending-cv` after `effectiveFocusNode`'s stub-fallback
// — the user message will name `blending-cv` for those. This is the
// "always render something" posture from the contract doc.
//
// Utterance ids ALWAYS use the "word." prefix regardless of content mode.
// The P0 incident (PR #117 → #118) was caused by `cvc.*` prefixes — the
// content-type discriminant lives on the read-line template, NOT the id
// namespace, by design (see design/word-song/parser-widening-plan.md
// §"Why no new id namespace").
const WORD_SONG_TRACK_GUIDE = `Track: Word Song.

The user message names a focus skill node. The planner emits content
matching that node. Two first-class content modes today:

  - blending-cv: "Tap the <word>." problems. Marian hears the word
    spoken and taps the matching picture chip from a trio. This is the
    earlier-tier content (matching pictures to spoken words).
  - cvc-words: "Read the <word>." problems. Marian sees the printed
    word and decodes it aloud, then the picture chip confirms. This is
    the next-tier content (decoding printed words). The wire shape and
    utterance ids are IDENTICAL to blending-cv; only the read-line
    template differs.

Pick 8 distinct target words from this list (do not invent new words, do
not use a target more than once). The same 14-word short-a CVC pool
serves both content modes:
${WORD_SONG_TARGET_WORDS_FOR_PROMPT}

Distractor guidance (Marian sees 3 picture chips per problem; one is the
target, two are distractors — but YOU are not authoring the distractors
here, only the spoken lines):
${WORD_SONG_DISTRACTOR_HINTS}

Order easier-recognise words (cat, bag, hat, dad) in problems 1-3 and
richer-rhyme/trap words (van, can, fan, man, pan, mat, bat, tag, cap, jam)
in problems 4-8.

Per-problem utterance template — the read line varies by focus node;
all other slots are content-mode-agnostic:

- read (varies by focus skill node):
    - blending-cv: "Tap the <word>." e.g. "Tap the cat."
    - cvc-words:   "Read the <word>." e.g. "Read the cat."
  Use lowercase target word; one short sentence; ends with a period.
  Use the EXACT verb for the focus node — "Tap" for blending-cv,
  "Read" for cvc-words. Do not mix templates within a single plan.
- correct: "Yes! <Word>." (capitalised target) e.g. "Yes! Cat."
- reprompt: "Hmm... try again?"  (verbatim — do not vary)
- hint: "Let's look. <Word>." e.g. "Let's look. Cat."
- giveAnswer: "This one is <word>." e.g. "This one is cat."

Utterance ids — REQUIRED:
Word-song problem utterance ids ALWAYS use the literal prefix "word.",
regardless of the focus node mentioned in the user message. Pattern:
"word.p<N>.<slot>" where N is the 1-based problem index (1..8) and <slot>
is one of read | correct | reprompt | hint | giveAnswer. Examples:
"word.p1.read", "word.p1.correct", "word.p2.read". Do NOT use "cvc.",
"blending.", "letter.", or any other prefix for problem utterances —
those will be rejected by the browser parser and the audio will fail to
play. The content-type discriminant lives on the read-line template, NOT
the id namespace. (Session-End ids keep the "session.end.*" prefix as
instructed in the system preamble.)

Pick exactly 8 distinct problems. The "recent score" hint in the user
message guides easier-vs-harder mix within the focus slice.`
