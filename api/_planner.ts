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
  WORD_SONG_TARGET_WORDS_SHORT_O,
  WORD_SONG_TARGET_WORDS_SHORT_U,
  WORD_SONG_TARGET_WORDS_SHORT_I,
  WORD_SONG_TARGET_WORDS_SHORT_E,
  WORD_SONG_TARGET_WORDS_DIGRAPHS_SH,
  WORD_SONG_TARGET_WORDS_DIGRAPHS_SH_HYBRID,
  WORD_SONG_TARGET_WORDS_DIGRAPHS_CH,
  WORD_SONG_TARGET_WORDS_DIGRAPHS_TH,
  WORD_SONG_TARGET_WORDS_DIGRAPHS_TH_HYBRID,
  WORD_SONG_DISTRACTOR_HINTS,
  WORD_SONG_NOVEL_PROBE_WORDS_FOR_PROMPT,
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
  // Wave 5 (ticket 86c9y0bvc) sibling-tier split of
  // `'two-digit-addsub'`. The no-regroup tier preserves the existing
  // pool + canon + prompt block (`MATH_TRACK_GUIDE` still defines a
  // single `two-digit-addsub:` heading — PR B renames it in lockstep
  // with canon rebake). The with-regroup tier is accepted on the
  // wire but has no first-class content yet — a session request for
  // it would currently fall through to Anthropic with no matching
  // prompt block, so the focus picker should not surface it until
  // PR B wires the canon + prompt. Marian's `defaultProgress` has
  // with-regroup at `'locked'`, so the picker never returns it in
  // v1 anyway.
  'two-digit-addsub-no-regroup',
  'two-digit-addsub-with-regroup',
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
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
  // Digraphs split into 3 sequential sibling nodes per PR #211. The
  // dead single `digraphs` literal is dropped — no canon shipped and
  // no real user ever sent it on a request. The three new nodes fall
  // through to the `blending-cv` stub via `effectiveFocusNode` until
  // their content tier ships (planner step in the §5 11-PR plan).
  'digraphs-sh',
  'digraphs-ch',
  'digraphs-th-voiceless',
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
  /**
   * Graduation-session hint (ticket 86c9m3aec). When `true` AND the
   * effective focus node is `cvc-words`, the planner instructs Haiku
   * to mix 2–3 novel short-a probe words (`nap, rat, map, tap`) into
   * the 8-problem set so the mastery engine can verify Marian
   * generalises her decoding beyond the canonical 14-word pack. Other
   * focus nodes ignore the flag — graduation is currently
   * cvc-words-only.
   *
   * Volatile per call: lives in the user message, not the system
   * prompt. Two graduation-on calls share the same system text as a
   * graduation-off call so the prompt-cache prefix stays stable.
   *
   * Defaults to `false` when omitted (back-compat with pre-86c9m3aec
   * callers).
   */
  isGraduationSession?: boolean
  /**
   * Leitner hint (ticket 86c9pwgc8 — M4). Sorted box-ascending list of
   * the math facts in the child's `Progress.mathFactsLeitner` box.
   * When supplied AND the effective focus node is `add-to-10`, the
   * planner instructs Haiku to weight box-1 (least familiar) facts
   * toward problems 4-8 in the 8-problem session. Other focus nodes
   * ignore the hint — Leitner-driven generation is currently
   * add-to-10-only.
   *
   * Volatile per call: lives in the user message, not the system
   * prompt. Two Leitner-on calls share the same system text as a
   * Leitner-off call so the prompt-cache prefix stays stable.
   *
   * Caller responsibility: ship only when non-empty. Empty / absent
   * lets the planner pick freely from the focus-node fact pool.
   */
  leitner?: LeitnerHintItem[]
  /**
   * Slow-fact hint (M4.x — follow-up to 86c9pwgc8). List of
   * "accurate but slow" facts: Marian gets these right reliably
   * (≥80% over ≥5 attempts) but answers slowly (median latency
   * ≥5000ms). The planner adds a directive instructing Haiku to
   * dose these back in for automaticity-building practice.
   *
   * Active only on math + add-to-10 — same gating posture as the
   * Leitner hint above. Other focus nodes / tracks ignore the field
   * silently. Volatile per call: lives in the user message, not the
   * system prompt. Two slow-fact-on calls share the same cached
   * system prefix as a slow-fact-off call.
   *
   * Caller responsibility: ship only when non-empty. Empty / absent
   * lets the planner pick freely from the focus-node fact pool.
   */
  slowFacts?: SlowFactHintItem[]
  /**
   * Letter-sounds current-target vowel hint (Wave 7 Track A7 — ticket
   * 86c9y49cd). Active only when the effective focus node is
   * `letter-sounds`. The hint is passed verbatim into the user message
   * via `buildLetterSoundsDirective` so Dave's directive (in
   * `WORD_SONG_TRACK_GUIDE`) can cycle through the locked vowel ladder
   * `/æ (mastered)/ → /ɒ/ → /ʌ/ → /ɪ/ → /ɛ/`. When omitted, the
   * directive falls back to `/ɒ/` (Marian's next-vowel-to-master per
   * `phonics-sequence-marian.md` §Q1).
   *
   * Why a hint, not derived state
   * -----------------------------
   * Wave 7 (Option B composite — per `design/word-song/letter-sounds-
   * content.md` §5.3 + §7 Q4 RESOLVED 2026-05-23) ships against the
   * existing `progress` shape unchanged — no `progress.literacy.
   * letterSoundsVowelStates` migration. The vowel cadence is fixed
   * cycling; the planner accepts the IPA hint as a passthrough so the
   * caller (or canon-bake script) controls which vowel is current-
   * target. Wave 8 Option A will derive the value from per-vowel
   * sub-mastery state when that migration ships; until then, omit
   * the field to bake against the safe default.
   *
   * Wire shape: a single IPA string, one of `'ɒ'`, `'ʌ'`, `'ɪ'`,
   * `'ɛ'` (the four short-vowel current-target candidates per the
   * ladder). `/æ/` is the MASTERED anchor and is never a "current-
   * target" — it's the mid-tier review-mode vowel in every session.
   * Unrecognised values fall through to the `/ɒ/` default (defensive
   * — the directive's own ADJACENT-VOWEL-BAN SELF-CHECK enforces the
   * acoustic-similarity ban anyway).
   *
   * Lives in the user message (volatile per call). The cache prefix
   * (system prompt) is unchanged so two letter-sounds calls with
   * different current-target vowels share the same prompt-cache hits.
   */
  currentTargetVowel?: string
}

/**
 * One Leitner-box fact, ready for the planner directive (ticket
 * 86c9pwgc8 — M4 Leitner wiring). Mirrors the browser-side wire
 * shape (`LeitnerSessionHintItem` in `src/lib/progress/leitner.ts`).
 *
 * Browser → server: shipped on `/api/claude` payload as
 * `progress.leitner: LeitnerHintItem[]`. Server → browser: not
 * round-tripped — this is purely an input directive.
 */
export interface LeitnerHintItem {
  a: number
  b: number
  op: '+' | '-' | '*'
  box: 1 | 2 | 3 | 4 | 5
}

/**
 * One slow-fact hint, ready for the planner directive (M4.x
 * follow-up to 86c9pwgc8). Mirrors the browser-side wire shape
 * (`SlowFactHint` in `src/lib/progress/slowFacts.ts`).
 *
 * Browser → server: shipped on `/api/claude` payload as
 * `progress.slowFacts: SlowFactHintItem[]`. Server → browser: not
 * round-tripped — this is purely an input directive.
 *
 * Wire is verbose (attempts/correctRate/medianLatencyMs alongside
 * the fact triple) so the directive copy can read naturally
 * ("4+2 — answers ~6.2s; over 7 attempts, 100% correct.") without
 * the server re-deriving stats.
 */
export interface SlowFactHintItem {
  fact: { a: number; b: number; op: '+' | '-' | '*' }
  attempts: number
  correctRate: number
  medianLatencyMs: number
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
  /** Graduation-session hint (ticket 86c9m3aec). See
   *  `GenerateSessionPlanArgs.isGraduationSession`. */
  isGraduationSession?: boolean
  /** Leitner hint (ticket 86c9pwgc8 — M4). See
   *  `GenerateSessionPlanArgs.leitner`. */
  leitner?: LeitnerHintItem[]
  /** Slow-fact hint (M4.x — follow-up to 86c9pwgc8). See
   *  `GenerateSessionPlanArgs.slowFacts`. */
  slowFacts?: SlowFactHintItem[]
  /** Letter-sounds current-target vowel hint (Wave 7 Track A7 — ticket
   *  86c9y49cd). See `GenerateSessionPlanArgs.currentTargetVowel`. */
  currentTargetVowel?: string
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
    isGraduationSession: args.isGraduationSession,
    leitner: args.leitner,
    slowFacts: args.slowFacts,
    currentTargetVowel: args.currentTargetVowel,
  })
  // Letter-sounds canon utterances embed isolated-phoneme mnemonics
  // (`mmm`, `buh`, `o`, etc.) that the render path wraps in
  // `<phoneme alphabet="ipa" ph="...">` via the tier-aware
  // PHONEME_OVERRIDES extension in `api/_tts.ts` (Wave 7 Track A7 —
  // Amendment 1 of ticket 86c9y49cd). The tier filter is passed to
  // `renderSessionAudio` so the substitution activates ONLY on
  // letter-sounds canon — pollution into other tiers (e.g. wrapping
  // the letter `m` in every CVC utterance like "math" or "moth") is
  // structurally impossible. See `api/_tts.ts PHONEME_OVERRIDES`
  // docstring + `design/word-song/letter-sounds-content.md §2.4` for
  // the substitution-table architecture rationale.
  const effectiveTier =
    args.track === 'word-song'
      ? effectiveFocusNode({ track: args.track, focusNode: args.focusNode })
      : undefined
  const renderOpts: RenderSessionOptions = {
    ...args.renderOptions,
    tierFilter: effectiveTier ?? args.renderOptions?.tierFilter,
  }
  return renderSessionAudio(plan, renderOpts)
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
 * `cvc-words` here. Future tier widenings (letter-sounds,
 * digraphs-th-voiceless, sight-words, simple-sentences) come in their
 * own paired parser-first-then-planner widenings. The digraph split
 * (PR #211) drops the dead `digraphs` literal from
 * `VALID_WORD_SONG_FOCUS_NODES`; `digraphs-sh` went FIRST-CLASS first
 * (its content tier wired the `/ʃ/` digraph pool + the hybridMode
 * problem-type gate). `digraphs-ch` went FIRST-CLASS second — its
 * content tier wired the `/tʃ/` digraph pool. Unlike
 * `digraphs-sh`, the ch-tier ships ZERO hybridMode words — every
 * ch-word is fully decodable (Dave addendum §3d / Kyle spec §6.1 /
 * AC12), so there is no ch-tier hybridMode problem-type gate.
 * `digraphs-th-voiceless` is now ALSO FIRST-CLASS — its content tier
 * (this PR) wires the voiceless-/θ/ digraph pool. Like `digraphs-sh`
 * (and unlike `digraphs-ch`), the th-tier ships TWO hybridMode words
 * — `thick` (double-digraph `th` + `ck`) and `cloth` (`/kl/` onset
 * blend) — so it REUSES the sh-tier hybridMode problem-type gate
 * (Dave th-addendum §3e / §3f, Kyle spec §6.2).
 *
 * Wave 7 Track A3 (ticket 86c9y4983) added `letter-names` as the FIRST
 * literacy tier to go first-class (it sits at the head of
 * WORD_SONG_NODES_IN_ORDER before letter-sounds / blending-cv). The
 * tier ships zero picture-pack assets — letter glyphs are rendered as
 * text in the chip frame — so the bake adds only a canon JSON + this
 * literal addition + the iteration-set update in
 * `scripts/generateSessionCanon.ts`. See
 * `design/word-song/letter-names-content.md` (Kyle A1) +
 * `WORD_SONG_TRACK_GUIDE` letter-names block (Dave A2, PR #329).
 */
const WORD_SONG_FIRST_CLASS_FOCUS_NODES: readonly string[] = [
  'letter-names',
  'letter-sounds',
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
  'digraphs-sh',
  'digraphs-ch',
  'digraphs-th-voiceless',
]

/**
 * Resolve the focus node the planner actually generates for. Math honours
 * caller-supplied focusNode verbatim. Word-song honours first-class nodes
 * (`letter-names`, `letter-sounds`, `blending-cv`, `cvc-words`, the four
 * short-vowel sibling tiers, `digraphs-sh`, `digraphs-ch`, and
 * `digraphs-th-voiceless`); valid-but-unsupported nodes (`sight-words`,
 * `simple-sentences`) fall back to `blending-cv` content as a stub — the
 * screen always renders, even on tiers we haven't tuned yet. See
 * `WORD_SONG_TRACK_GUIDE` for the prompt-side handling.
 *
 * Validation (`generateSessionPlan` above) still rejects an invalid
 * cross-track or unknown focusNode for word-song before reaching here —
 * the fallback is for valid-but-untuned nodes only.
 */
function effectiveFocusNode(args: {
  track: PlannerTrack
  focusNode?: string
}): string {
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

  // Graduation-session directive (ticket 86c9m3aec). Only fires when
  // the caller explicitly flags the session AND the effective focus
  // node is `cvc-words` — the gate is currently cvc-words-only. Other
  // tracks / focus nodes ignore the flag silently.
  //
  // Lives in the user message (volatile per call) so two graduation
  // calls share the same cached system prefix as a regular call.
  const isGraduation =
    args.isGraduationSession === true &&
    args.track === 'word-song' &&
    focusNode === 'cvc-words'
  const graduationLine = isGraduation ? buildGraduationDirective() : null

  // Leitner directive (ticket 86c9pwgc8 — M4). Only fires when the
  // caller supplied a non-empty array AND the effective focus node is
  // `add-to-10` — Leitner-driven session generation is currently
  // add-to-10-only (matches the only Leitner box that exists in v1
  // progress shape). Other focus nodes / tracks ignore the array
  // silently.
  //
  // Lives in the user message (volatile per call). The cache prefix
  // (system prompt) is unchanged so two Leitner-on calls share the
  // same prompt-cache hits as a Leitner-off call.
  const isLeitnerActive =
    args.track === 'math' &&
    focusNode === 'add-to-10' &&
    args.leitner !== undefined &&
    args.leitner.length > 0
  const leitnerLine = isLeitnerActive
    ? buildLeitnerDirective(args.leitner!)
    : null

  // Slow-fact directive (M4.x — follow-up to 86c9pwgc8). Math retrieval
  // tiers (`add-to-10` and `sub-to-10` — Kyle's sub-to-10 content tier
  // spec §8) + non-empty array. Surfaces accurate-but-slow facts so
  // Haiku can dose them in for automaticity practice. The sub-to-10
  // gate fires post-warmup only — `buildSlowFactSessionHint` returns
  // [] for the first 5 sub-to-10 sessions so the wire field is
  // omitted entirely on the cold-start path. Lives in the user
  // message; cache prefix unchanged.
  const isSlowFactsActive =
    args.track === 'math' &&
    (focusNode === 'add-to-10' || focusNode === 'sub-to-10') &&
    args.slowFacts !== undefined &&
    args.slowFacts.length > 0
  const slowFactsLine = isSlowFactsActive
    ? buildSlowFactDirective(args.slowFacts!)
    : null

  // Letter-sounds directive (Wave 7 Track A7 — ticket 86c9y49cd). Only
  // fires when the effective focus node is `letter-sounds` (word-song
  // track only). Injects the `current-target-vowel=<IPA>` hint that
  // Dave's directive in `WORD_SONG_TRACK_GUIDE` reads to pick which
  // short vowel to make the lift of THIS session.
  //
  // Vowel ladder (locked, per `phonics-sequence-marian.md` §Q1 and
  // `design/word-song/letter-sounds-content.md §1.4`):
  //     /æ/ (mastered) → /ɒ/ → /ʌ/ → /ɪ/ → /ɛ/
  // /æ/ is the anchor (NOT a current-target candidate). The four
  // candidate IPAs are /ɒ/, /ʌ/, /ɪ/, /ɛ/. When omitted or
  // unrecognised, falls back to /ɒ/ (Marian's next-vowel-to-master).
  //
  // Lives in the user message (volatile per call). The cache prefix
  // (system prompt) is unchanged so two letter-sounds calls with
  // different current-target vowels share the same prompt-cache hits.
  const isLetterSoundsActive =
    args.track === 'word-song' && focusNode === 'letter-sounds'
  const letterSoundsLine = isLetterSoundsActive
    ? buildLetterSoundsDirective(args.currentTargetVowel)
    : null

  const lines = [
    `Generate a session plan for the ${trackLabel} track at level ${args.level}.`,
    `Focus skill node: ${focusNode}.`,
    recentScoreLine,
    ...(letterSoundsLine !== null ? [letterSoundsLine] : []),
    ...(graduationLine !== null ? [graduationLine] : []),
    ...(leitnerLine !== null ? [leitnerLine] : []),
    ...(slowFactsLine !== null ? [slowFactsLine] : []),
    `Child's name: ${safeName || 'friend'}.`,
    `Return JSON only — no surrounding prose, no markdown fences.`,
  ]
  return lines.join('\n')
}

/**
 * Build the Leitner-weighting directive that goes into the user
 * message (ticket 86c9pwgc8 — M4 Leitner wiring). Spelled out as a
 * multi-line block so Haiku has unambiguous guidance on which fact
 * pairs to surface and which problems they should land in.
 *
 * The directive carries every fact in the box, grouped by box level.
 * Box 1 = "least familiar / due for review" (top priority for
 * problems 4-8); boxes 3-5 = "long review" (drop in occasionally).
 * Problems 1-3 stay unaffected by the directive — those keep their
 * gentle-ramp role per Kyle's spec / Dave's research §6 P1, so a
 * cold-start session never opens with a stumble fact.
 *
 * The fact list is passed verbatim — no per-fact text generation
 * here. Haiku's existing per-focus-node template ("Three plus two.
 * How many?") handles the surface text from the chosen pair.
 */
function buildLeitnerDirective(items: readonly LeitnerHintItem[]): string {
  const byBox = new Map<number, LeitnerHintItem[]>()
  for (const item of items) {
    if (!byBox.has(item.box)) byBox.set(item.box, [])
    byBox.get(item.box)!.push(item)
  }
  const formatPair = (i: LeitnerHintItem): string => `${i.a}${i.op}${i.b}`
  const boxLines: string[] = []
  for (let b = 1; b <= 5; b++) {
    const list = byBox.get(b)
    if (!list || list.length === 0) continue
    boxLines.push(`Box ${b}: ${list.map(formatPair).join(', ')}.`)
  }
  return [
    `LEITNER PRIORITY DIRECTIVE (ticket 86c9pwgc8). The child has`,
    `practiced these specific facts before. Box 1 = least familiar /`,
    `most due for review. Box 5 = long-review (well known).`,
    ...boxLines,
    `When picking the 8 problems for this session, OBEY THIS RULE:`,
    `- Problems 1-3 stay easy / gentle-ramp; pick freely from the`,
    `  focus-node fact pool (Box-1 facts are FORBIDDEN here so the`,
    `  child does not open the session on a known-stumble fact).`,
    `- Problems 4-8 should LEAN INTO Box-1 facts — at least 2 of`,
    `  these 5 problems must use a fact from the Box-1 list above`,
    `  when at least 2 Box-1 facts exist; if fewer Box-1 facts exist,`,
    `  use all of them. Fill the remainder with Box 2-3 facts when`,
    `  available, and any focus-node fact otherwise. Sprinkle one`,
    `  Box 4-5 fact for spaced review when possible.`,
    `- Do not repeat any fact within the 8-problem set.`,
    `- Number-word and read-line templates remain unchanged.`,
  ].join('\n')
}

/**
 * Build the slow-fact directive that goes into the user message (M4.x
 * — follow-up to 86c9pwgc8). Surfaces "accurate but slow" facts so
 * Haiku can dose them in for automaticity-building practice — the
 * canary for finger-counting dependency per Dave's research § 6 P3.
 *
 * The directive carries every supplied entry as a bullet line: fact
 * + ~latency + accuracy summary. Haiku is instructed to weave 1-2
 * of these into the 8-problem set, with mild preference for the
 * shorter-latency-but-still-slow facts (closer to the
 * counting → retrieval flip than the deeply-counting facts).
 *
 * Distinct from the Leitner directive — Leitner targets correctness
 * gaps (wrong / box-1 facts); slow-facts targets latency gaps
 * (correct but slow). Both can fire on the same session; they
 * shouldn't conflict on fact selection because the Leitner box-1
 * predicate (low correctness) and the slow-fact predicate
 * (≥80% correctness) are mutually exclusive by construction.
 */
function buildSlowFactDirective(items: readonly SlowFactHintItem[]): string {
  const formatItem = (i: SlowFactHintItem): string => {
    const seconds = (i.medianLatencyMs / 1000).toFixed(1)
    const pct = Math.round(i.correctRate * 100)
    const fact = `${i.fact.a}${i.fact.op}${i.fact.b}`
    return `- ${fact} — answers ~${seconds}s; over ${i.attempts} attempts, ${pct}% correct.`
  }
  const bullets = items.map(formatItem)
  return [
    `SLOW-FACT DIRECTIVE (M4.x). The child has practiced these facts to`,
    `accuracy but is still SLOW on them — the canary for finger-counting`,
    `dependency. Practice list (accurate but slow):`,
    ...bullets,
    `When picking the 8 problems for this session, OBEY THIS RULE:`,
    `- Include 1 to 2 facts from the slow list above when choosing the`,
    `  problems for this session, mixed in with the rest of the focus-`,
    `  node fact pool. Prefer the shorter-latency-but-still-slow facts`,
    `  (closer to the counting → retrieval flip) over the deepest-`,
    `  counting facts.`,
    `- These slow facts are CORRECT-but-slow. They are not stumbles —`,
    `  do not use the hint or giveAnswer slot copy as if Marian is`,
    `  expected to fail. Use the standard "<addend-A> plus <addend-B>.`,
    `  How many?" template.`,
    `- The slow-fact picks count toward the no-repeat rule (do not`,
    `  emit the same fact twice in one session, including across the`,
    `  Leitner directive's picks if both directives fire).`,
  ].join('\n')
}

/**
 * Build the graduation-session directive that goes into the user
 * message (ticket 86c9m3aec). Spelled out as a multi-line block so
 * Haiku has unambiguous guidance on which words count as novel and
 * how many to mix in.
 *
 * Note: the directive uses the SAME read-line template as a regular
 * cvc-words session — `"Read the <word>."` — and the same utterance
 * id namespace (`word.p<N>.<slot>`). The browser parser doesn't need
 * to know which problems were novel; the screen renders them
 * identically to canonical problems, with picture chips drawn from
 * the per-target `TARGET_PAIRINGS`. The split-aware accounting
 * happens at session-end inside `recordProgressOnSessionEnd`.
 */
function buildGraduationDirective(): string {
  return [
    `GRADUATION SESSION — novel-word generalization probe (ticket 86c9m3aec).`,
    `This session must mix 2 or 3 problems whose target word is drawn`,
    `from the NOVEL pool below — these are NOT in the canonical 14-word`,
    `list. The remaining 5 or 6 problems use canonical pool words as`,
    `usual. Place the novel-pool problems anywhere in problems 1–8 (do`,
    `not cluster all novel words at the end).`,
    `Novel pool: ${WORD_SONG_NOVEL_PROBE_WORDS_FOR_PROMPT}.`,
    `Use the same "Read the <word>." template for novel words as for`,
    `canonical words. The word.p<N>.<slot> id namespace and all other`,
    `slot copy rules apply to novel-word problems unchanged.`,
  ].join('\n')
}

/**
 * The four candidate current-target vowel IPAs for the letter-sounds
 * tier. /æ/ is intentionally NOT a candidate — it's the MASTERED
 * anchor vowel (every session emits at least 1 of it in the mid-tier
 * window per `WORD_SONG_TRACK_GUIDE` letter-sounds composition rules)
 * but never the "current-target" of a session. The locked ladder is
 *     /æ (mastered)/ → /ɒ/ → /ʌ/ → /ɪ/ → /ɛ/
 * (`phonics-sequence-marian.md` §Q1, `design/word-song/letter-sounds-
 * content.md §1.4`). Unrecognised IPA strings fall through to the
 * /ɒ/ default — Marian's next-vowel-to-master.
 */
const LETTER_SOUNDS_VOWEL_CANDIDATES: readonly string[] = ['ɒ', 'ʌ', 'ɪ', 'ɛ']
const LETTER_SOUNDS_DEFAULT_VOWEL = 'ɒ'

/**
 * Build the letter-sounds directive that goes into the user message
 * (Wave 7 Track A7 — ticket 86c9y49cd, Amendment 2 — Devon NOF on
 * PR #332). Injects the `current-target-vowel=<IPA>` hint that Dave's
 * directive in `WORD_SONG_TRACK_GUIDE` reads (search "current-target-
 * vowel=<IPA>" inside the LETTER-SOUNDS SESSION COMPOSITION RULES
 * block) to pick which short vowel is the LIFT of THIS session.
 *
 * Without this hint, the directive falls back to its safe default
 * (`/ɒ/`) on every session, and Marian never progresses past short-o.
 * The directive's own VOWEL-LADDER SELF-CHECK + ADJACENT-VOWEL-BAN
 * SELF-CHECK gate the picked vowel against the locked ladder.
 *
 * Wave 7 ships Option B (composite-tier mastery — see `design/word-
 * song/letter-sounds-content.md` §5.3 + §7 Q4 RESOLVED 2026-05-23);
 * the caller is responsible for cycling the vowel across sessions.
 * Wave 8 Option A (per-vowel sub-mastery) will derive the value from
 * `progress.literacy.letterSoundsVowelStates` and the picker will
 * cycle automatically.
 *
 * Pure formatter; no I/O. Returns a single-line directive whose
 * presence is the cheap drift-guard test anchor.
 */
function buildLetterSoundsDirective(
  currentTargetVowel: string | undefined,
): string {
  const ipa =
    typeof currentTargetVowel === 'string' &&
    LETTER_SOUNDS_VOWEL_CANDIDATES.includes(currentTargetVowel)
      ? currentTargetVowel
      : LETTER_SOUNDS_DEFAULT_VOWEL
  return [
    `LETTER-SOUNDS DIRECTIVE (Wave 7 Track A7 — ticket 86c9y49cd).`,
    `current-target-vowel=${ipa}`,
    `This session's LIFT vowel is ${ipa}. Apply the LETTER-SOUNDS`,
    `SESSION COMPOSITION RULES from the system prompt: at least 2 and`,
    `at most 3 of the 8 problems must have this vowel as the target`,
    `sound; the mastered vowel /æ/ anchors the mid-tier window (P4 or`,
    `P5); P1-P3 are mastered-consonant gentle-ramp. The directive's`,
    `ADJACENT-VOWEL-BAN SELF-CHECK applies — do NOT emit both /ɪ/ and`,
    `/ɛ/ as targets in the same session regardless of which one is`,
    `current-target.`,
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

export const MATH_TRACK_GUIDE = `Track: Math.

The user message names a focus skill node. Generate problems specifically for that node. The full math focus-node menu is:

- number-recog: number recognition. Say a numeral, child taps it. Numerals 1-10. read: "Tap the <number>." e.g. "Tap the five."
- add-to-10: addition with sums 3-10. Both addends 1-9. <drift-guard>RULE_IDENTITY=add-to-10-composition; SPEC=design/math/add-to-10-content.md§2; LINT=scripts/compositionLint.ts:704 (ADD_TO_TEN_RULES) + 594 (ADD_TO_TEN_POOL) + 764 (lintAddToTenComposition). Do NOT rename, re-band, re-cap, or substitute facts under any seed.</drift-guard> read: "<addend-A> plus <addend-B>. How many?" e.g. "Three plus two. How many?" Prefer bridge-through-5 (3+2, 4+3), easy doubles (2+2, 4+4), and small near-doubles. Sums must be <= 10.

  FACT POOL (44 facts; pick exactly 8 distinct ordered pairs from this pool per session; commutative pairs are DISTINCT facts — "2+3" and "3+2" are separate pool entries). Each fact maps to EXACTLY ONE category per the priority order sums-to-10 -> doubles -> plus-one -> near-doubles -> general:
  - EASY band (sum 3-5; 9 facts):
    · plus-one: 1+2, 2+1, 1+3, 3+1, 1+4, 4+1
    · doubles: 2+2
    · near-doubles: 2+3, 3+2
  - MEDIUM band (sum 6-8; 18 facts):
    · plus-one: 1+5, 5+1, 1+6, 6+1, 1+7, 7+1
    · doubles: 3+3, 4+4
    · near-doubles: 3+4, 4+3
    · general: 2+4, 4+2, 2+5, 5+2, 2+6, 6+2, 3+5, 5+3
  - HARD band (sum 9-10; 17 facts):
    · sums-to-10: 1+9, 9+1, 2+8, 8+2, 3+7, 7+3, 4+6, 6+4, 5+5
    · plus-one: 1+8, 8+1
    · near-doubles: 4+5, 5+4
    · general: 2+7, 7+2, 3+6, 6+3
  POOL-MEMBERSHIP SELF-CHECK <rule band="hard">apply before emitting every problem</rule>: verify the chosen (a, b) ordered pair appears verbatim above. Sums below 3 or above 10 are FORBIDDEN; neither addend may be 0; neither addend may exceed 9. <self-check>If a candidate (a, b) is NOT on the 44-pair list — e.g. 0+3, 5+6 (sum > 10), or 4+4 read as a sum-9 fact — REJECT and re-pick from the pool above.</self-check>

  CATEGORY-MIX BUDGET <rule band="hard">apply BEFORE selecting any facts — this is the FIRST rule because Haiku's prior empirically saturates ONE category at a time when the cap is buried late in the rule list</rule>:
     · sums-to-10:   AT MOST 2. (Pool has 9 facts: 1+9, 9+1, 2+8, 8+2, 3+7, 7+3, 4+6, 6+4, 5+5. High-leverage anchor — Marian's diagnostic flags this category as top priority — but doubles + plus-one + general MUST also fit in the 8-slot session.)
     · doubles:      AT MOST 2. (Pool has 3 facts: 2+2, 3+3, 4+4 — 5+5 is sums-to-10 by category priority. Doubles-prior is the EMPIRICALLY-OBSERVED failure mode for add-to-10 — see FAILURE MODES below.)
     · plus-one:     AT MOST 2. (Pool has 14 facts: 1+2, 2+1, 1+3, 3+1, 1+4, 4+1, 1+5, 5+1, 1+6, 6+1, 1+7, 7+1, 1+8, 8+1. Largest category by pool size — STRUCTURAL saturation risk if discriminate-tier loses headroom.)
     · near-doubles: AT MOST 3. (Pool has 6 facts: 2+3, 3+2, 3+4, 4+3, 4+5, 5+4. Slightly relaxed cap because the doubles-plus-one derivation IS a productive bridge strategy.)
     · general:      AT MOST 2. (Pool has 12 facts: 2+4, 4+2, 2+5, 5+2, 2+6, 6+2, 3+5, 5+3, 2+7, 7+2, 3+6, 6+3. Retrieval-pathway facts; ≤2 keeps focus on the structured categories.)
  The five caps SUM TO 11; an 8-slot session has 3 slots of slack. Pick a category layout that respects ALL FIVE caps BEFORE assigning facts to slots — typical layouts are (1 plus-one + 1 doubles + 2 near-doubles + 2 sums-to-10 + 2 general) or (2 plus-one + 2 doubles + 1 near-doubles + 2 sums-to-10 + 1 general). <self-check>After selecting all 8 facts, count facts in each category. If ANY count exceeds its cap, REJECT and SWAP the surplus for a fact in a different (under-cap) category at that slot.</self-check>
  FAILURE MODES BOTH WAYS — the EMPIRICALLY-OBSERVED failure during PR #266 attempts 1 + 2 was the doubles-prior (full doubles trifecta: 2+2 + 3+3 + 4+4 in the same session — composition-lint caught both bakes pre-disk). The LATENT failure mode is plus-one-saturation — the plus-one pool is the LARGEST (14 facts) and Haiku's attention drifts there when other caps bind. The cap on EACH category corrects ONE failure mode; do NOT max one category at the expense of the others.

  WORKED EXAMPLE — a clean 8-problem session that respects ALL caps (use this as a template, NOT a verbatim copy):
     P1=1+2 [EASY/plus-one]      (plus-one #1; EASY ramp anchor — counting-on-one is the easiest retrieval path)
     P2=2+2 [EASY/doubles]       (doubles #1 — opens the doubles budget early; doubles strategy anchor)
     P3=3+2 [EASY/near-doubles]  (near-doubles #1; bridges to doubles-plus-one — end of gentle ramp)
     P4=2+4 [MEDIUM/general]     (general #1; first discriminate-tier problem at MEDIUM — HARD still forbidden at P4)
     P5=4+4 [MEDIUM/doubles]     (doubles #2 — AT CAP; doubles-prior anchor satisfied)
     P6=5+5 [HARD/sums-to-10]    (sums-to-10 #1 — the make-10 anchor, highest-leverage fact in the pool)
     P7=3+7 [HARD/sums-to-10]    (sums-to-10 #2 — AT CAP; second make-10 fact)
     P8=4+5 [HARD/near-doubles]  (near-doubles #2; doubles-plus-one derivation in HARD band)
  Counts: plus-one=1 (under cap of 2), doubles=2 (AT CAP), near-doubles=2 (under cap of 3), sums-to-10=2 (AT CAP), general=1 (under cap of 2). Total = 8. EASY at P1-P3, MEDIUM at P4-P5, HARD at P6-P8. Sums-to-10 coverage in P4-P8 satisfied with 2 (P6, P7). No duplicates. This is the canonical mix-and-spacing the directive is designed to produce.

  SESSION COMPOSITION RULES (apply IN ORDER, AFTER the CATEGORY-MIX BUDGET above):
  1. Problems 1-3 (gentle ramp): EXCLUSIVELY EASY-band facts (sum 3-5). Read each fact's band before placing it at P1, P2, or P3. ONLY the 9 EASY-band facts above are eligible for these slots.
  2. NEGATIVE ANCHOR — P1, P2, P3 PLACEMENT BANS (any one of these is a hard rule violation):
     · DO NOT place any MEDIUM-band fact (sum 6-8) at P1, P2, or P3. MEDIUM-band only appears at P4 or later.
     · DO NOT place any HARD-band fact (sum 9-10) at P1, P2, or P3. HARD-band only appears at P5 or later.
     · The ONLY facts allowed at P1, P2, P3 are: 1+2, 2+1, 1+3, 3+1, 1+4, 4+1, 2+2, 2+3, 3+2.
  3. Problems 4-8 (discriminate): draw from MEDIUM + HARD bands. Recent-score modulation: low score (< 0.5) -> bias toward MEDIUM and avoid HARD-band sums-to-10; high score (>= 0.85) -> push into HARD and ensure a sums-to-10 anchor; mid score -> balanced mix. HARD-band facts (sum 9-10) appear at P5 or later only.
  4. HIGH-LEVERAGE COVERAGE RULE <rule band="hard">: at least one sums-to-10 fact (1+9, 9+1, 2+8, 8+2, 3+7, 7+3, 4+6, 6+4, 5+5) MUST appear somewhere in problems 4-8. This is the highest-leverage category — Marian's April diagnostic flags sums-to-10 automaticity as the top priority; it bridges to add-to-20's make-10 mental model. <self-check>Scan P4, P5, P6, P7, P8. If zero have category=sums-to-10, REJECT and SWAP one P4-P8 fact for a sums-to-10 fact (respecting the sums-to-10 cap of 2 and band-by-slot rules — sums-to-10 facts are HARD band, so they fit P5-P8 only).</self-check>
  5. NO duplicate (a, b) ordered pairs within the 8-problem set. "2+3" and "3+2" are NOT duplicates — they are distinct ordered pairs.
  6. DOUBLES-CAP SELF-CHECK <rule band="hard">re-statement of CATEGORY-MIX BUDGET above</rule>: AT MOST TWO problems across the 8-problem session may carry the doubles category (drawn from {2+2, 3+3, 4+4}). CATEGORY-CARVE-OUT — 5+5 is sums-to-10 by priority, NOT doubles; do NOT count 5+5 toward the doubles cap. Before emitting a third doubles fact, REJECT it. NEGATIVE ANCHOR: it is FORBIDDEN to place 2+2 AND 3+3 AND 4+4 in the same session (the full doubles trifecta — known failure mode per PR #266 attempts 1-2, both bakes shipped all three before composition-lint caught them). <self-check>After placing all 8 facts, count {2+2, 3+3, 4+4} occurrences. If > 2, REJECT and SWAP the surplus for a sums-to-10 or near-doubles fact at the same slot.</self-check>
  7. SUMS-TO-10-CAP SELF-CHECK <rule band="hard">re-statement</rule>: AT MOST TWO problems across the 8-problem session may carry the sums-to-10 category (drawn from {1+9, 9+1, 2+8, 8+2, 3+7, 7+3, 4+6, 6+4, 5+5}). Before emitting a third sums-to-10 fact, REJECT it. This cap interacts with the HIGH-LEVERAGE COVERAGE RULE above: place EXACTLY 1 or 2 sums-to-10 facts in P5-P8; never 0 (violates coverage rule), never 3+ (violates this cap).
  8. PLUS-ONE-CAP SELF-CHECK <rule band="hard">re-statement</rule>: AT MOST TWO problems across the 8-problem session may carry the plus-one category. The plus-one pool is the LARGEST (14 facts: 1+2, 2+1, 1+3, 3+1, 1+4, 4+1, 1+5, 5+1, 1+6, 6+1, 1+7, 7+1, 1+8, 8+1) so Haiku's attention drifts there when other caps bind — this cap is load-bearing against plus-one-saturation. Before emitting a third plus-one fact, REJECT it.
  9. Category caps (across the 8-problem session — restatement of CATEGORY-MIX BUDGET for cross-reference): at most 2 doubles, at most 2 plus-one, at most 3 near-doubles, at most 2 sums-to-10, at most 2 general. Each fact maps to exactly one category per the priority order above.

  BAND-BY-SLOT (canonical restatement of rules 1-3):
  - EASY (sum 3-5): allowed at any slot P1-P8 (gentle-ramp anchor; also permitted in discriminate-tier as a confidence-preservation fallback when recent score is low).
  - MEDIUM (sum 6-8): allowed at P4-P8.
  - HARD (sum 9-10): allowed at P5-P8 only.

  PER-PROBLEM SHAPE for add-to-10: every problem MUST emit op: "+" on the wire. Utterance ids MUST use the literal "math." prefix (NOT "add-to-10."): "math.p1.read", "math.p1.correct", ..., "math.p8.giveAnswer". Per-slot utterance templates:
  - read: "<addend-A> plus <addend-B>. How many?" e.g. "Five plus three. How many?"
  - correct: "Yes! <answer>!" e.g. "Yes! Eight!"
  - reprompt: "Hmm... try again?" (verbatim)
  - hint: "Look. <addend-A>. And <addend-B> more. How many now?" e.g. "Look. Five. And three more. How many now?"
  - giveAnswer: "This one is <answer>." e.g. "This one is eight."

  PROSODY: numbers are spelled out as words ("one", "two", ... "ten"). Capitalize the first word of each sentence. The "plus" template renders cleanly on en-US-EmmaMultilingualNeural rate -10%; no SSML overrides required for any value in [1, 10].
- add-to-20: addition with sums STRICTLY in [11, 20] and BOTH addends in [1, 9]. NO TEN-PLUS-SINGLE (10+n, n+10 FORBIDDEN — that's two-digit-addsub territory); NO sums <= 10 (that's add-to-10's territory). read: "<addend-A> plus <addend-B>. How many?" e.g. "Eight plus five. How many?"

  SUM-RANGE SELF-CHECK (apply before emitting every problem): for chosen (addendA a, addendB b), COMPUTE a + b and CONFIRM that 11 <= a + b <= 18. (V1 pool excludes 19 and 20 — see addend range below.) If the sum is < 11, the problem belongs in add-to-10 and is FORBIDDEN here; if > 18, the (a, b) pair is OUT of the v1 pool. Worked example: 8+3=11 is OK (11 in range). 5+5=10 is FORBIDDEN (sum < 11). 9+10=19 is FORBIDDEN (addend = 10 violates next check).

  ADDEND-RANGE SELF-CHECK (apply before emitting every problem): for chosen (a, b), CONFIRM that a in [1, 9] AND b in [1, 9]. If either addend is 10 or greater, the problem is FORBIDDEN (belongs in a future two-digit tier). Worked example: 9+8=17 is OK (both addends in [1, 9]). 10+8=18 is FORBIDDEN (a = 10). 12+5=17 is FORBIDDEN (a > 9).

  FACT POOL (22 facts; pick exactly 8 distinct ordered pairs from this pool per session, no duplicates; commutative pairs are DISTINCT facts — e.g. "9+2" and "2+9" are separate pool entries):
  Each fact is annotated with [BAND/category]. Categories: make-ten-bridge (the actual learning target of this tier — child decomposes one addend to reach 10 first); doubles (retrieved; do NOT over-pick — see DOUBLES-CAP SELF-CHECK below); near-doubles (doubles-plus-one derivation; requires doubles to be retrieved).
  - Easy band (P1-P3 eligible, also P4-P8 fallback):
    · 9+2=11  [EASY/make-ten-bridge]
    · 2+9=11  [EASY/make-ten-bridge]
    · 8+3=11  [EASY/make-ten-bridge]
    · 3+8=11  [EASY/make-ten-bridge]
    · 9+3=12  [EASY/make-ten-bridge]
    · 6+6=12  [EASY/doubles]
  - Medium band (P4-P8 eligible):
    · 9+4=13  [MEDIUM/make-ten-bridge]
    · 4+9=13  [MEDIUM/make-ten-bridge]
    · 8+5=13  [MEDIUM/make-ten-bridge]
    · 5+8=13  [MEDIUM/make-ten-bridge]
    · 6+7=13  [MEDIUM/near-doubles]
    · 7+6=13  [MEDIUM/near-doubles]
    · 7+7=14  [MEDIUM/doubles]
    · 9+5=14  [MEDIUM/make-ten-bridge]
  - Hard band (P5-P8 eligible):
    · 7+8=15  [HARD/near-doubles]
    · 8+7=15  [HARD/near-doubles]
    · 9+6=15  [HARD/make-ten-bridge]
    · 9+7=16  [HARD/make-ten-bridge]
    · 8+8=16  [HARD/doubles]
    · 9+8=17  [HARD/make-ten-bridge]
    · 8+9=17  [HARD/near-doubles]
    · 9+9=18  [HARD/doubles]
  POOL-MEMBERSHIP SELF-CHECK: before emitting each problem, verify the chosen (a, b) pair appears verbatim above. The 22 listed ordered pairs are the ONLY allowed facts. Common FORBIDDEN candidates to REJECT (valid by sum and addend range but NOT in v1 pool): 4+7, 7+4, 5+6, 6+5, 4+8, 8+4, 5+7, 7+5, 6+8, 8+6, 5+9 (and any other (a, b) with a in [1,9], b in [1,9], 11 <= a+b <= 20 not on the list above). These are deferred to a future pool widening; not part of v1.

  CATEGORY-MIX BUDGET (apply BEFORE selecting any facts — this is the FIRST rule because Haiku's prior empirically saturates make-ten-bridge OR doubles when the cap is buried late in the rule list). An 8-problem session has THREE category budgets that MUST all be respected:
     · make-ten-bridge: AT LEAST 3, AT MOST 5. (Pool has 13 facts; cap is the bound on its dominance.)
     · doubles:         AT MOST 2. (Pool has 4 facts: 6+6, 7+7, 8+8, 9+9.)
     · near-doubles:    AT MOST 2. (Pool has 5 facts: 6+7, 7+6, 7+8, 8+7, 8+9.)
  The three caps SUM TO 9, so an 8-problem session has 1 slot of slack — typical layouts are (5 make-ten-bridge + 2 near-doubles + 1 doubles) or (4 make-ten-bridge + 2 near-doubles + 2 doubles) or (5 make-ten-bridge + 1 near-doubles + 2 doubles). Pick the layout FIRST, then assign facts to slots second.
  FAILURE MODES BOTH WAYS — the previous canon shipped 4-of-8 doubles (doubles-prior failure), an early correction attempt produced 8-of-8 make-ten-bridge (make-ten-bridge-saturation failure). Both are real; the cap on EACH category corrects ONE failure mode. Do NOT max one category at the expense of the other two.

  SESSION COMPOSITION RULES (apply IN ORDER, AFTER the CATEGORY-MIX BUDGET above):
  1. Problems 1-3 (gentle ramp): draw EXCLUSIVELY from the easy band. Calibration window.
  2. NEGATIVE ANCHOR — P1, P2, P3 PLACEMENT BANS (any one of these is a hard rule violation):
     · DO NOT place any MEDIUM-band fact at P1, P2, or P3. MEDIUM-band only appears at P4 or later.
     · DO NOT place any HARD-band fact at P1, P2, P3, or P4. HARD-band only appears at P5 or later.
     · The ONLY facts allowed at P1, P2, P3 are: 9+2, 2+9, 8+3, 3+8, 9+3, 6+6.
  3. Problem 4: MEDIUM-band only (HARD-band still forbidden at P4).
  4. Problems 5-8 (discriminate): draw from medium + hard bands. Recent-score modulation: low score (< 0.5) -> bias toward medium and REDUCE doubles to <= 1 across the session; high score (>= 0.85) -> push toward hard with >= 1 make-ten-bridge in P5-P8; mid score -> balanced.
  5. HIGH-LEVERAGE COVERAGE RULE: at least one make-ten-bridge fact MUST appear in P5-P8 (drawn from: 9+4, 4+9, 8+5, 5+8, 9+5, 9+6, 9+7, 9+8). This is the actual learning target of the tier; Dave's sub-to-20 research § 1.2 frames cross-10-bridge as parallel to take-from-decade for sub-to-20.
  6. DOUBLES-CAP SELF-CHECK (re-statement of CATEGORY-MIX BUDGET above): AT MOST TWO problems across the 8-problem session may carry the doubles category. Before emitting a third doubles fact, REJECT it. NEGATIVE ANCHOR — it is FORBIDDEN to place 6+6, 7+7, 8+8, AND 9+9 in the same session.
  7. NEAR-DOUBLES-CAP SELF-CHECK (re-statement): AT MOST TWO problems across the 8-problem session may carry the near-doubles category. Before emitting a third near-doubles fact, REJECT it.
  7a. MAKE-TEN-BRIDGE-CAP SELF-CHECK (re-statement): AT MOST FIVE problems across the 8-problem session may carry the make-ten-bridge category. Before emitting a sixth make-ten-bridge fact, REJECT it and SWAP for a doubles or near-doubles fact. NEGATIVE ANCHOR — make-ten-bridge IS the learning target, but an 8-problem session with 6 or more make-ten-bridge facts crowds out the doubles + near-doubles strategies the discriminate tier (P4-P8) is meant to mix. CONCRETE NUMERIC GUARDS — if you have selected 5 make-ten-bridge facts already, every remaining slot MUST be doubles or near-doubles; if you have selected 6 or more, the canon will be REJECTED by lint and the bake fails.
  8. NO duplicate (a, b) ordered pairs within the 8-problem set. "9+2" and "2+9" are NOT duplicates — they are distinct ordered pairs with distinct read-line text.
  9. GENERAL-CATEGORY BAN: the v1 pool contains ZERO general-category facts by design. Do NOT invent or emit any fact whose category is "general" — the pool-membership self-check above already rejects any (a, b) outside the 22 listed pairs, and EVERY listed pair maps to make-ten-bridge, doubles, or near-doubles. If a future pool widening introduces general facts, this rule gets a positive cap (currently structurally zero).
  10. DUAL-EXPOSURE RULE (forward-compat scaffold): never pair an addition fact and its subtraction inverse in the same session. E.g. if 8+5=13 is included, 13-5=8 and 13-8=5 are both FORBIDDEN (vacuously satisfied in pure-+ v1 sessions; rule binds once mixed +/- sessions arrive). This rule is forward-compatible with future add-to-20 / sub-to-20 fact-family interleaving.

  WORKED EXAMPLE — a clean 8-problem session that respects all caps (use this as a template, not a verbatim copy):
     P1=9+2 [EASY/make-ten-bridge]   (make-ten-bridge #1, EASY ramp anchor)
     P2=8+3 [EASY/make-ten-bridge]   (make-ten-bridge #2)
     P3=6+6 [EASY/doubles]           (doubles #1 — opens the doubles budget early)
     P4=9+4 [MEDIUM/make-ten-bridge] (make-ten-bridge #3 — P4 is MEDIUM-only)
     P5=8+5 [MEDIUM/make-ten-bridge] (make-ten-bridge #4 — P5-P8 high-leverage anchor)
     P6=6+7 [MEDIUM/near-doubles]    (near-doubles #1)
     P7=7+8 [HARD/near-doubles]      (near-doubles #2 — at cap)
     P8=9+8 [HARD/make-ten-bridge]   (make-ten-bridge #5 — at cap)
  Counts: make-ten-bridge=5 (at cap), doubles=1 (under cap of 2), near-doubles=2 (at cap). Total = 8. EASY 1-3, MEDIUM 4-6, HARD 7-8. P5-P8 carries 2 make-ten-bridge facts (high-leverage rule satisfied with 1 to spare). This is the canonical mix-and-spacing the directive is designed to produce.

  DISTRACTOR-COVERAGE SELF-CHECK (for problems 4-8): the render pipeline (src/screens/Math/Math.tsx) uses Class 1 (off-by-one) for every op:'+' P4-P8 problem and does NOT apply a Class 2 (wrong-op) or Class B (dropped-carry) trap — see design/math/add-to-20-content.md §3.3 and §3.4. No coverage self-check needed for distractor classes; the high-leverage coverage rule (Rule 5 above) carries the pedagogical-coverage burden for this tier.

  PER-PROBLEM SHAPE for add-to-20: every problem MUST emit op: "+" on the wire. Utterance ids MUST use the literal "math." prefix (NOT "add-to-20."): "math.p1.read", "math.p1.correct", ..., "math.p8.giveAnswer". Per-slot utterance templates:
  - read: "<addend-A> plus <addend-B>. How many?" e.g. "Eight plus five. How many?"
  - correct: "Yes! <answer>!" e.g. "Yes! Thirteen!"
  - reprompt: "Hmm... try again?" (verbatim)
  - hint: "Look. <addend-A>. And <addend-B> more. How many now?" e.g. "Look. Eight. And five more. How many now?"
  - giveAnswer: "This one is <answer>." e.g. "This one is thirteen."

  PROSODY: numbers are spelled out as words ("one", "two", ... "nine", "ten", "eleven", ... "eighteen"). Capitalize the first word of each sentence. The "plus" template renders cleanly on en-US-EmmaMultilingualNeural rate -10% for all values in [1, 18]; no SSML overrides required (validated by sub-to-20 §4 for the same teen-number range). Do NOT verbally decompose the addends (e.g. do NOT say "eight plus two plus three" instead of "eight plus five") — per Dave § 2 (L2 context note, sub-to-20 research), verbal decomposition adds L2 cognitive load without pedagogical benefit. The decomposition IS the mental work Marian does to bridge; it stays internal.
- sub-to-10: subtraction with both operands in 0-10 and answer in 0-10. read: "<minuend> minus <subtrahend>. How many are left?" e.g. "Seven minus three. How many are left?"

  FIRST-SESSION READ-LINE — SESSION-LEVEL TEMPLATE CHOICE (not per-problem). Make this choice ONCE for the entire 8-problem session:
    · IF this is the very first session on this node (lifetimeFirstEncounters['sub-to-10'] not yet set) → choose the "take away" template: "<minuend> take away <subtrahend>. How many are left?" e.g. "Eight take away three. How many are left?"
    · ELSE → choose the "minus" template: "<minuend> minus <subtrahend>. How many are left?" e.g. "Seven minus three. How many are left?"
  Then USE THE CHOSEN TEMPLATE ACROSS ALL 8 PROBLEMS. DO NOT mix "take away" and "minus" within a single session. DO NOT switch templates partway through. The "take away" framing matches Marian's mental model from counting back (physical removal); subsequent sessions revert to "minus". Emma's voice config is unchanged — the SSML and prosody pipeline does not change for this tier.

  FACT POOL (22 facts total — this is the ONLY allowed pool. Pick exactly 8 distinct facts FROM THIS LIST per session. No duplicates. DO NOT invent facts outside this list; e.g. 7-2, 8-5, 9-3, 9-2, 5-3, 4-3, 5-4 are NOT in the pool and are FORBIDDEN). EVERY FACT IS LABELED INLINE WITH ITS BAND AND CATEGORY, and annotated with (a+b) = the wrong-op trap value used at render time. IN means the trap is <= 10 (a usable in-range wrong-op distractor); OOR means the trap is > 10 (silently downgrades to off-by-one at render time per design/math/sub-to-10-content.md §3.2); ALIAS means the trap aliases the correct answer (forbidden, downgrades). Preserve the BAND/CATEGORY binding when composing the session:
    · 5-5=0   [EASY/subtract-self]   (a+b=10 IN — boundary)
    · 8-8=0   [EASY/subtract-self]   (a+b=16 OOR)
    · 7-0=7   [EASY/subtract-zero]   (a+b=7 ALIAS — forbidden)
    · 9-0=9   [EASY/subtract-zero]   (a+b=9 ALIAS — forbidden)
    · 10-5=5  [EASY/doubles-halving] (a+b=15 OOR)
    · 8-4=4   [EASY/doubles-halving] (a+b=12 OOR)
    · 6-3=3   [EASY/doubles-halving] (a+b=9 IN)
    · 9-1=8   [EASY/subtract-one]    (a+b=10 IN — boundary)
    · 10-1=9  [MEDIUM/subtract-one]  (a+b=11 OOR)
    · 8-1=7   [MEDIUM/subtract-one]  (a+b=9 IN)
    · 7-1=6   [MEDIUM/subtract-one]  (a+b=8 IN)
    · 10-2=8  [MEDIUM/subtract-two]  (a+b=12 OOR)
    · 8-2=6   [MEDIUM/subtract-two]  (a+b=10 IN — boundary, strongest "makes ten" lure)
    · 6-2=4   [MEDIUM/subtract-two]  (a+b=8 IN)
    · 10-3=7  [MEDIUM/take-from-10]  (a+b=13 OOR)
    · 10-7=3  [MEDIUM/take-from-10]  (a+b=17 OOR)
    · 9-4=5   [HARD/general]         (a+b=13 OOR)
    · 8-3=5   [HARD/general]         (a+b=11 OOR)
    · 7-4=3   [HARD/general]         (a+b=11 OOR)
    · 9-6=3   [HARD/general]         (a+b=15 OOR)
    · 7-3=4   [HARD/general]         (a+b=10 IN — boundary, strongest "makes ten" lure)
    · 6-4=2   [HARD/general]         (a+b=10 IN — boundary, widest correct-vs-trap separation in pool)
  POOL-MEMBERSHIP SELF-CHECK: before emitting each problem, verify the chosen (a, b) pair appears verbatim above. If 7-2, 8-5, 9-3, 9-2, 5-3, 4-3, 5-4, or any other pair NOT listed is your candidate, REJECT it and pick another from the 22-fact list.
  GENERAL-CATEGORY CAP SELF-CHECK: across the entire 8-problem session, AT MOST TWO problems may be tagged [HARD/general] (i.e. drawn from {9-4, 8-3, 7-4, 9-6, 7-3, 6-4}). Before emitting a third HARD-band fact, REJECT it. The HARD-band pool was widened from 4 facts to 6 facts post-PR #252 (added 7-3, 6-4); the per-session CAP IS UNCHANGED at TWO — picking 7-3 + 6-4 EXHAUSTS the general cap, so 9-4, 8-3, 7-4, and 9-6 are then ALL FORBIDDEN for the rest of the session. Symmetrically: picking any two of {9-4, 8-3, 7-4, 9-6, 7-3, 6-4} exhausts the cap; the remaining four HARD facts are all FORBIDDEN. Walk through the P5-P8 slots once and STOP at the second HARD-band fact, regardless of which two you chose.
  DOUBLES-CAP SELF-CHECK: across the entire 8-problem session, AT MOST ONE problem may be tagged [EASY/doubles-halving] (i.e. drawn from {10-5, 8-4, 6-3}). Before emitting a second doubles-halving fact, REJECT it. The three doubles-halving facts share a single slot — pick one and only one. NEGATIVE ANCHOR: it is FORBIDDEN to place 10-5 AND 8-4 in the same session; FORBIDDEN to place 10-5 AND 6-3; FORBIDDEN to place 8-4 AND 6-3. Two consecutive EASY-band doubles in the gentle ramp (P1-P3) is a known failure mode and is explicitly disallowed.
  SUBTRACT-ONE-CAP SELF-CHECK: across the entire 8-problem session, AT MOST ONE problem may carry the subtract-one category — that is, AT MOST ONE fact drawn from {9-1, 10-1, 8-1, 7-1} (the EASY 9-1 and the three MEDIUM facts share a single combined cap). Before emitting a second subtract-one fact, REJECT it. NEGATIVE ANCHOR: it is FORBIDDEN to place 9-1 AND 10-1 in the same session; FORBIDDEN to place 9-1 AND 8-1; FORBIDDEN to place 9-1 AND 7-1; FORBIDDEN to place 10-1 AND 8-1; FORBIDDEN to place 10-1 AND 7-1; FORBIDDEN to place 8-1 AND 7-1. Pick one subtract-one fact and only one. (Known failure mode: P2=9-1 + P4=8-1 was a category-cap violation in two consecutive bakes during PR #253 pool widening.)
  SUBTRACT-TWO-CAP SELF-CHECK: across the entire 8-problem session, AT MOST ONE problem may carry the subtract-two category — that is, AT MOST ONE fact drawn from {10-2, 8-2, 6-2}. Before emitting a second subtract-two fact, REJECT it. NEGATIVE ANCHOR: it is FORBIDDEN to place 10-2 AND 8-2 in the same session; FORBIDDEN to place 10-2 AND 6-2; FORBIDDEN to place 8-2 AND 6-2. Pick one subtract-two fact and only one.
  DISTRACTOR-COVERAGE SELF-CHECK (for problems 4-8): the render pipeline (src/screens/Math/Math.tsx) attempts a wrong-op trap (a+b) on every op:'-' P4-P8 problem and silently downgrades to off-by-one when the trap is OOR or aliases the correct answer. To deliver >= 2 in-range wrong-op traps across P4-P8 (Kyle's spec target), bias the P4-P8 selection toward facts annotated "IN" above. IN-annotated MEDIUM facts: 8-1, 7-1, 8-2, 6-2 (any one subtract-one and any one subtract-two — category caps still binding). IN-annotated HARD/general facts: 7-3, 6-4 (the general cap of 2 lets BOTH co-occur in one session). NEGATIVE ANCHOR: it is FORBIDDEN to fill P4-P8 entirely with OOR facts when >= 2 IN-annotated facts (from any band combination) are still available; before finalising the 5-problem P4-P8 set, count the IN-annotated facts in the set and if it is < 2 AND >= 2 IN-annotated facts are still available within category caps, SWAP one OOR fact for an IN-annotated one. Category caps are still binding: if you pick 8-1=7 (subtract-one IN), you may not also pick 10-1=9 or 7-1=6; if you pick 8-2=6 or 6-2=4 (subtract-two IN), you may not also pick 10-2=8. The maximum achievable IN-count in P4-P8 is 4 — one MEDIUM/subtract-one IN-fact, one MEDIUM/subtract-two IN-fact, AND both HARD/general IN-facts (7-3 + 6-4). The >= 2 target is structurally achievable from HARD/general alone (7-3 + 6-4) under the general cap, so even MEDIUM-light high-recent-score sessions meet the target. Aim for >= 2 IN; do not artificially cap at 2 if more IN-facts fit within category caps and other rules.

  SESSION COMPOSITION RULES (apply IN ORDER):
  1. Problems 1-3 (gentle ramp): EXCLUSIVELY EASY-band facts. Read each fact's [EASY/...] tag before placing it at P1, P2, or P3. ONLY facts tagged [EASY/...] above are eligible for these slots — that is 8 specific facts: 5-5, 8-8, 7-0, 9-0, 10-5, 8-4, 6-3, 9-1.
  2. NEGATIVE ANCHOR — P1, P2, P3 PLACEMENT BANS (any one of these is a hard rule violation):
     · DO NOT place 8-3, 9-4, 7-4, 9-6, 7-3, or 6-4 at P1, P2, or P3. These are HARD-band facts; HARD-band only appears at P5 or later.
     · DO NOT place 10-1, 8-1, 7-1, 10-2, 8-2, 6-2, 10-3, or 10-7 at P1, P2, or P3. These are MEDIUM-band facts; MEDIUM-band only appears at P4 or later.
     · The ONLY facts allowed at P1, P2, P3 are: 5-5, 8-8, 7-0, 9-0, 10-5, 8-4, 6-3, 9-1.
  3. Problems 4-8 (discriminate): draw from MEDIUM + HARD bands. Recent-score modulation: low score (< 0.5) → bias toward MEDIUM; high score (>= 0.85) → bias toward HARD; mid score → balanced. HARD-band facts (8-3, 9-4, 7-4, 9-6, 7-3, 6-4) appear at P5 or later only.
  4. At least one take-from-10 fact (10-3 or 10-7) MUST appear somewhere in problems 4-8.
  5. DUAL-EXPOSURE RULE: never pair a subtraction fact and its addition inverse in the same session. E.g. if 10-7=3 is included, 7+3=10 (or 3+7=10) is FORBIDDEN. This rule is forward-compatible — when Marian later moves to mixed add+sub sessions, this rule remains in force per Dave's research on inverse-principle interference.
  6. NO duplicate facts within the 8-problem set. Before emitting P2 through P8, scan all prior problems' (a, b) pairs and reject any candidate already used. E.g. if P1 is 8-3, then 8-3 is FORBIDDEN at P2 through P8.
  7. Category cap: at most one each of subtract-self, subtract-zero, doubles, subtract-one, subtract-two; at most two of take-from-10; at most two of general.

  PER-PROBLEM SHAPE for sub-to-10: every problem MUST emit op: "-" on the wire (the screen renders the operator glyph from op). Wrong-answer chip selection is handled entirely at render time in src/screens/Math/Math.tsx — "distractorClass" is a RENDER-TIME default (set client-side per focus node), NOT a planner-emitted field; the canon JSON wire is utterance-only {id, text} and carries no per-problem distractor tag. The planner's role for distractor delivery is FACT-POOL COMPOSITION: by guaranteeing >= 2 a+b=10 IN-annotated facts across P4-P8 (the DISTRACTOR-COVERAGE SELF-CHECK above), the planner ensures the render-time "wrong-op" trap (Class 2 = a+b) has an in-range target on >= 2 problems before pickDistractors' OOR/alias silent-downgrade fires. Per-tier render defaults today (see src/screens/Math/Math.tsx::buildChipOrder and src/screens/Math/distractors.ts::pickTier): sub-to-10 leans on "wrong-op" (Class 2) for every op:"-" P4-P8 problem; add-to-10 (and any non-subtraction tier) leans on "gentle" for P1-P3 and "offByOne" for P4-P8 via pickTier alone, with no "distractorClass" override. Emit only the fields listed below. Utterance ids MUST use the literal "math." prefix (NOT "sub-to-10."): "math.p1.read", "math.p1.correct", ..., "math.p8.giveAnswer". The id namespace is the track name, NOT the focus-node name. Per-slot utterance templates:
  - read: use the SESSION-LEVEL chosen template (see FIRST-SESSION READ-LINE above) across all 8 problems — either "<minuend> minus <subtrahend>. How many are left?" OR the first-session "<minuend> take away <subtrahend>. How many are left?" variant. Do NOT switch templates mid-session.
  - correct: "Yes! <answer>!" e.g. "Yes! Eight!" (for correct=0 → "Yes! Zero!")
  - reprompt: "Hmm... try again?" (verbatim)
  - hint: "Look. <minuend>. Take away <subtrahend>. How many now?" e.g. "Look. Ten. Take away two. How many now?" (use "take away" framing in the hint regardless of read-line variant — the hint is a scaffold, not a primary read)
  - giveAnswer: "This one is <answer>." e.g. "This one is eight." (for correct=0 → "This one is zero.")

  PROSODY: numbers are spelled out as words ("zero", "one", "two", ... "ten"). Capitalize the first word of each sentence. The "minus" / "take away" template renders cleanly on en-US-EmmaMultilingualNeural rate -10%; no SSML overrides required for any value in [0, 10].
- sub-to-20: subtraction with minuend in [11, 19] and subtrahend in [1, 9] and result in [10, 18]. NO BORROW — the ones-digit of the minuend MUST be >= subtrahend. read: "<minuend> minus <subtrahend>. How many are left?" e.g. "Seventeen minus five. How many are left?"

  NO-BORROW SELF-CHECK (apply before emitting every problem): for chosen (minuend a, subtrahend b), COMPUTE ones-digit(a) = a mod 10 and CONFIRM that ones-digit(a) >= b. If ones-digit(a) < b, the problem is a BORROW fact and is FORBIDDEN; reject and pick another from the pool. Worked example: 14-3=11 is no-borrow (ones-digit(14)=4 >= 3 → OK). 14-7=7 is BORROW (ones-digit(14)=4 < 7 → FORBIDDEN). 18-9=9 is BORROW (ones-digit(18)=8 < 9 → FORBIDDEN). The pool below has been pre-filtered; this self-check is a defense-in-depth assertion against drift.

  FACT POOL (22 facts; pick exactly 8 distinct facts from this pool per session, no duplicates):
  Each fact is annotated with [BAND/category] and DEC = the decade-anchor-miss trap value used at render time. ALIAS means the trap aliases the correct answer (forbidden, downgrades to off-by-one). BOUNDARY means the trap is off-by-one from correct (degenerate, downgrades). CLEAN means the trap is in range, distinct from correct, and >=2 separation (a usable Class B distractor).
  - Easy band (P1-P3 only, no Class B fires here):
    · 11-1=10  [EASY/subtract-one]    (DEC=10 ALIAS)
    · 12-2=10  [EASY/doubles-anchor]  (DEC=10 ALIAS)
    · 13-3=10  [EASY/take-to-decade]  (DEC=10 ALIAS)
    · 12-1=11  [EASY/subtract-one]    (DEC=10 BOUNDARY — degenerate, downgrades)
    · 13-2=11  [EASY/subtract-two]    (DEC=10 BOUNDARY — degenerate, downgrades)
    · 13-1=12  [EASY/subtract-one]    (DEC=10 CLEAN — separation 2)
  - Medium band (P4-P8 eligible):
    · 14-4=10  [MEDIUM/take-to-decade] (DEC=10 ALIAS)
    · 14-3=11  [MEDIUM/general]        (DEC=10 BOUNDARY — degenerate)
    · 14-2=12  [MEDIUM/subtract-two]   (DEC=10 CLEAN — separation 2)
    · 15-5=10  [MEDIUM/take-to-decade] (DEC=10 ALIAS)
    · 15-4=11  [MEDIUM/general]        (DEC=10 BOUNDARY — degenerate)
    · 15-3=12  [MEDIUM/subtract-three] (DEC=10 CLEAN — separation 2)
    · 15-2=13  [MEDIUM/subtract-two]   (DEC=10 CLEAN — separation 3)
    · 16-6=10  [MEDIUM/take-to-decade] (DEC=10 ALIAS)
    · 16-5=11  [MEDIUM/general]        (DEC=10 BOUNDARY — degenerate)
    · 16-4=12  [MEDIUM/general]        (DEC=10 CLEAN — separation 2)
  - Hard band (P5-P8 eligible):
    · 17-7=10  [HARD/take-to-decade]   (DEC=10 ALIAS)
    · 17-5=12  [HARD/general]          (DEC=10 CLEAN — separation 2)
    · 18-8=10  [HARD/take-to-decade]   (DEC=10 ALIAS)
    · 18-6=12  [HARD/general]          (DEC=10 CLEAN — separation 2)
    · 19-9=10  [HARD/take-to-decade]   (DEC=10 ALIAS)
    · 19-7=12  [HARD/general]          (DEC=10 CLEAN — separation 2)
  POOL-MEMBERSHIP SELF-CHECK: before emitting each problem, verify the chosen (a, b) pair appears verbatim above. The 22 listed pairs are the ONLY allowed facts. Common BORROW candidates to REJECT (NOT in the pool, all violate the NO-BORROW SELF-CHECK above): 11-2, 11-3, ... 11-9; 12-3, 12-4, ... 12-9; 13-4, ... 13-9; 14-5, 14-6, 14-7, 14-8, 14-9; 15-6, 15-7, 15-8, 15-9; 16-7, 16-8, 16-9; 17-8, 17-9; 18-9. NOTE that 19-9=10 IS in the pool (ones-digit(19) = 9 >= 9 = subtrahend → no-borrow). Also REJECT any pair where ones-digit(a) >= b but the pair is simply outside the 22-fact curation (e.g. 15-1=14, 16-2=14, 19-5=14 — valid no-borrow facts that are not in the v1 pool).

  SESSION COMPOSITION RULES (apply IN ORDER):
  1. Problems 1-3 (gentle ramp): EXCLUSIVELY EASY-band facts. Calibration window; no Class B fires yet. ONLY facts tagged [EASY/...] above are eligible for these slots — that is 6 specific facts: 11-1, 12-2, 13-3, 12-1, 13-2, 13-1.
  2. NEGATIVE ANCHOR — P1, P2, P3 PLACEMENT BANS (any one of these is a hard rule violation):
     · DO NOT place any MEDIUM-band fact at P1, P2, or P3. MEDIUM-band only appears at P4 or later.
     · DO NOT place any HARD-band fact at P1, P2, or P3. HARD-band only appears at P5 or later.
     · The ONLY facts allowed at P1, P2, P3 are: 11-1, 12-2, 13-3, 12-1, 13-2, 13-1.
  3. Problems 4-8 (discriminate): draw from MEDIUM + HARD bands. Recent-score modulation: low score (< 0.5) → bias toward MEDIUM; high score (>= 0.85) → push toward HARD with >=1 take-to-decade in P5-P8; mid score → balanced. HARD-band facts (17-7, 17-5, 18-8, 18-6, 19-9, 19-7) appear at P5 or later only.
  4. At least one take-to-decade fact MUST appear in P4-P8 (drawn from: 14-4, 15-5, 16-6, 17-7, 18-8, 19-9). Highest-leverage facts; Dave § 4.2 names these as memorable anchors.
  5. DUAL-EXPOSURE RULE: never pair a subtraction fact and its addition inverse in the same session. E.g. if 16-4=12 is included, 4+12=16 (or 12+4=16) is FORBIDDEN. This rule is forward-compatible with future add-to-20 / sub-to-20 fact-family interleaving.
  6. NO duplicate facts within the 8-problem set.
  7. Category caps (across the 8-problem session, summed across ALL 8 slots P1-P8):
     · subtract-one    ≤ 1  (pool: 11-1, 12-1, 13-1, 10-1 — NOTE 10-1 is NOT in this pool; only 11-1, 12-1, 13-1)
     · doubles-anchor  ≤ 1  (pool: 12-2)
     · subtract-two    ≤ 1  (pool: 13-2, 14-2, 15-2)
     · subtract-three  ≤ 1  (pool: 15-3)
     · take-to-decade  ≤ 2  (pool: 13-3, 14-4, 15-5, 16-6, 17-7, 18-8, 19-9 — high-value, relaxed cap of 2)
     · general         ≤ 2  (pool: 14-3, 15-4, 16-5, 16-4, 17-5, 18-6, 19-7 — HARD cap of 2)

  CATEGORY-CAP SELF-CHECK (apply BEFORE finalising the 8-problem set, after every other rule):
     For each category above, count the facts you have selected for the WHOLE session (P1-P8 inclusive — yes, this means EASY P1-P3 facts count toward their category cap too). If any count exceeds the cap, REJECT the set and SWAP the surplus fact for one in a different category.
     Worked rejection examples (these are the EXACT failure modes you must NOT emit):
     · P1=11-1 AND P3=13-1 → subtract-one count = 2 → CAP VIOLATION (cap=1). Swap one of {11-1, 13-1} for a different EASY category at that slot (12-2 doubles-anchor, 13-3 take-to-decade, 13-2 subtract-two).
     · P3=13-3 AND P5=15-5 AND P8=18-8 → take-to-decade count = 3 → CAP VIOLATION (cap=2). Swap one of the take-to-decade facts for a different category at that slot (a general fact at MEDIUM/HARD; a non-take-to-decade EASY fact at P3).
     · P1=11-1, P2=12-1, P3=13-1 → subtract-one count = 3 → CAP VIOLATION. Three slots cannot all be subtract-one; vary the categories within P1-P3 — the gentle-ramp doesn't require category monotony.
     · P3=13-3 (EASY/take-to-decade) AND P4=14-4 AND P5=15-5 → take-to-decade count = 3 → CAP VIOLATION. EASY take-to-decade at P3 COUNTS toward the cap of 2; if 13-3 is at P3, at most ONE take-to-decade fact may appear in P4-P8.
     Note: rule 4 (>=1 take-to-decade in P4-P8) interacts with this cap. If P3 is NOT a take-to-decade fact (which is most of the time — there are 5 other EASY facts to pick), P4-P8 may safely carry up to 2 take-to-decade facts. If P3 IS 13-3 (take-to-decade), P4-P8 may carry AT MOST 1 take-to-decade fact (to stay under the cap of 2 while satisfying rule 4). Plan P3 first when choosing how many take-to-decade slots remain.

  BAND-BY-SLOT (canonical restatement of rules 1-3):
  - EASY (result band, P1-P3 only): allowed at slots P1-P3.
  - MEDIUM (result band): allowed at P4-P8.
  - HARD (result band): allowed at P5-P8 only.

  DISTRACTOR-COVERAGE SELF-CHECK (for problems 4-8): the render pipeline (src/screens/Math/Math.tsx) attempts a Class B (decade-anchor miss) trap on every op:'-' P4-P8 problem when focusNode === 'sub-to-20', and silently downgrades to Class A (off-by-one) when the trap aliases correct, aliases off-by-one, or falls out of [minAnswer, maxAnswer]. To deliver >=2 in-range Class B traps across P4-P8 (Kyle's spec target), bias the P4-P8 selection toward CLEAN-annotated facts above. CLEAN-annotated MEDIUM facts: 14-2, 15-3, 15-2, 16-4 (any one each of subtract-two and subtract-three; subtract-two cap is <=1 so 14-2 and 15-2 compete; general cap is <=2 so 16-4 can co-occur with at most one other general). CLEAN-annotated HARD/general facts: 17-5, 18-6, 19-7 (any two — the general cap of 2 lets two co-occur). NEGATIVE ANCHOR: it is FORBIDDEN to fill P4-P8 entirely with ALIAS- or BOUNDARY-annotated facts when >=2 CLEAN-annotated facts (from any band combination) are still available within category caps. Before finalising the 5-problem P4-P8 set, count the CLEAN-annotated facts in the set; if it is < 2 AND >=2 CLEAN-annotated facts are still available within category caps, SWAP an ALIAS/BOUNDARY fact for a CLEAN one. Maximum achievable CLEAN-count in P4-P8 is 5 (one MEDIUM/subtract-two CLEAN + one MEDIUM/subtract-three CLEAN + one MEDIUM/general CLEAN + two HARD/general CLEAN).

  PER-PROBLEM SHAPE for sub-to-20: every problem MUST emit op: "-" on the wire (the screen renders the operator glyph from op). Wrong-answer chip selection is handled entirely at render time in src/screens/Math/Math.tsx — "distractorClass" is a RENDER-TIME default (set client-side per focus node), NOT a planner-emitted field; the canon JSON wire is utterance-only {id, text} and carries no per-problem distractor tag. The planner's role for distractor delivery is FACT-POOL COMPOSITION: by guaranteeing >=2 CLEAN-annotated facts across P4-P8 (the DISTRACTOR-COVERAGE SELF-CHECK above), the planner ensures the render-time Class B trap (decade-anchor miss) has an in-range target on >=2 problems before pickDistractors silent-downgrades. Emit only the fields listed below. Utterance ids MUST use the literal "math." prefix (NOT "sub-to-20."): "math.p1.read", "math.p1.correct", ..., "math.p8.giveAnswer". The id namespace is the track name, NOT the focus-node name. Per-slot utterance templates:
  - read: "<minuend> minus <subtrahend>. How many are left?" e.g. "Fifteen minus three. How many are left?"
    READ-LINE NEGATIVE ANCHOR: the read-line MUST use the word "minus" verbatim — DO NOT substitute "take away" here. The "take away" phrasing belongs in the hint scaffold ONLY (see below). Emitting "Eleven take away one. How many are left?" as a read-line is a hard rule violation; the spec uses "minus" from session 1 onwards for sub-to-20 (see design/math/sub-to-20-content.md §4.3 + §7.2 — no first-session take-away variant for this tier). Every "math.pN.read" utterance text MUST match the pattern: capitalised teen number word, then " minus ", then a lowercased number word, then ". How many are left?".
  - correct: "Yes! <answer>!" e.g. "Yes! Twelve!"
  - reprompt: "Hmm... try again?" (verbatim)
  - hint: "Look. <minuend>. Take away <subtrahend>. How many now?" e.g. "Look. Fifteen. Take away three. How many now?" (use "take away" framing in the hint regardless of the "minus" read-line — the hint is a scaffold, not a primary read)
  - giveAnswer: "This one is <answer>." e.g. "This one is twelve."

  PROSODY: numbers are spelled out as words ("ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"). Capitalize the first word of each sentence. The "minus" template renders cleanly on en-US-EmmaMultilingualNeural rate -10% for all teen values; no SSML overrides required. Do NOT verbally decompose the minuend (e.g. do NOT say "ten and seven, minus five" or "ten plus seven minus five") — per Dave § 2 (L2 context note), verbal decomposition adds L2 cognitive load without pedagogical benefit. Emma says the numeral name plainly.
- two-digit-addsub-no-regroup: addition OR subtraction within one mixed-op session, no regrouping. For ADDITION: one OR both operands two-digit, the other one-digit (or both two-digit per the two-digit-plus-two-digit pool slice below), units column sums to AT MOST 9 (no carrying). For SUBTRACTION: minuend is two-digit, subtrahend is one-digit, minuend's units digit >= subtrahend (no borrowing), result >= 12. read for "+": "<addend-A> plus <addend-B>. How many?" e.g. "Twenty-three plus four. How many?". read for "-": "<minuend> minus <subtrahend>. How many are left?" e.g. "Forty-eight minus seven. How many are left?".

  NO-REGROUP SELF-CHECK (apply BEFORE emitting every problem):
  - For "+" facts: COMPUTE (a mod 10) + (b mod 10) and CONFIRM <= 9. If > 9, the fact requires CARRYING and is FORBIDDEN (regroup territory, deferred). Worked example: 23+4 -> units 3+4=7 OK. 27+6 -> units 7+6=13 FORBIDDEN.
  - For "-" facts: COMPUTE (a mod 10) and CONFIRM (a mod 10) >= b. If <, the fact requires BORROWING and is FORBIDDEN. Worked example: 28-5 -> units 8>=5 OK. 32-5 -> units 2<5 FORBIDDEN.
  - For "-" facts: COMPUTE a - b and CONFIRM result >= 12. If < 12, the result has slipped below the two-digit range and is FORBIDDEN (belongs in sub-to-20 or sub-to-10). Worked example: 18-4=14 OK. 13-5=8 FORBIDDEN.

  OPERAND-RANGE SELF-CHECK (apply BEFORE emitting every problem):
  - First operand a in [10, 99].
  - Second operand b in [1, 9] for the SINGLE-DIGIT-SECOND-OPERAND mainline; OR b in [10, 99] ONLY for the explicit "two-digit-plus-two-digit" pool entries listed below.
  - For two-digit-plus-two-digit "+" facts: BOTH units AND tens columns add without carrying — (a mod 10) + (b mod 10) <= 9 AND ((a div 10) + (b div 10)) <= 9 AND result <= 99. Worked example: 23+14 -> units 3+4=7 OK, tens 2+1=3 OK, result 37 OK. 45+27 -> units 5+7=12 FORBIDDEN.

  FACT POOL (36 ordered triples; pick exactly 8 distinct (a, b, op) triples per session, no duplicates. The op flag is part of the fact identity — "25-3" and "22+3" are DISTINCT triples but FORBIDDEN to co-occur per the DUAL-EXPOSURE RULE below):
  Each fact is annotated with [BAND/op/category]. Categories:
  - round-ten-anchor: first operand ends in zero (e.g. 20+3); units operation trivial. CAPPED TIGHT at 1.
  - mid-decade-units-shift: place-value-preserving operation on a non-round operand (e.g. 23+4 -> 27); THE actual learning target.
  - near-boundary-no-cross: units operation lands at or near 9 (for "+") or 0 (for "-") WITHOUT crossing — the cycle-5-regroup-prep diagnostic. High-leverage.
  - tens-doubles-echo: first operand has matching tens and units digits (e.g. 22+5); doubles intuition lightly carries from add-to-10.
  - two-digit-plus-two-digit: BOTH operands two-digit (e.g. 23+14); "+" only.
  - EASY band (P1-P3 eligible; also P4-P8 fallback):
    · 20+3=23  [EASY/+/round-ten-anchor]
    · 30+5=35  [EASY/+/round-ten-anchor]
    · 40+2=42  [EASY/+/round-ten-anchor]
    · 25+4=29  [EASY/+/near-boundary-no-cross]
    · 33+4=37  [EASY/+/mid-decade-units-shift]
    · 22+5=27  [EASY/+/tens-doubles-echo]
    · 15-3=12  [EASY/-/mid-decade-units-shift]
    · 28-5=23  [EASY/-/mid-decade-units-shift]
    · 19-7=12  [EASY/-/mid-decade-units-shift]
  - MEDIUM band (P4-P8 eligible):
    · 21+3=24  [MEDIUM/+/mid-decade-units-shift]
    · 34+5=39  [MEDIUM/+/near-boundary-no-cross]
    · 42+3=45  [MEDIUM/+/mid-decade-units-shift]
    · 54+4=58  [MEDIUM/+/mid-decade-units-shift]
    · 36+2=38  [MEDIUM/+/mid-decade-units-shift]
    · 44+3=47  [MEDIUM/+/tens-doubles-echo]
    · 18-4=14  [MEDIUM/-/mid-decade-units-shift]
    · 25-3=22  [MEDIUM/-/mid-decade-units-shift]
    · 37-4=33  [MEDIUM/-/mid-decade-units-shift]
    · 26-5=21  [MEDIUM/-/near-boundary-no-cross]
  - HARD band (P5-P8 eligible):
    · 23+6=29  [HARD/+/near-boundary-no-cross]
    · 41+8=49  [HARD/+/near-boundary-no-cross]
    · 32+7=39  [HARD/+/near-boundary-no-cross]
    · 55+4=59  [HARD/+/near-boundary-no-cross]
    · 27+2=29  [HARD/+/near-boundary-no-cross]
    · 35-4=31  [HARD/-/near-boundary-no-cross]
    · 48-7=41  [HARD/-/near-boundary-no-cross]
    · 52-1=51  [HARD/-/near-boundary-no-cross]
    · 64-3=61  [HARD/-/near-boundary-no-cross]
    · 66+3=69  [HARD/+/tens-doubles-echo]
    · 47+2=49  [HARD/+/near-boundary-no-cross]
    · 23+14=37 [HARD/+/two-digit-plus-two-digit]
    · 42+31=73 [HARD/+/two-digit-plus-two-digit]
    · 25+14=39 [HARD/+/two-digit-plus-two-digit]
    · 31+26=57 [HARD/+/two-digit-plus-two-digit]
    · 52+13=65 [HARD/+/two-digit-plus-two-digit]
    · 34+22=56 [HARD/+/two-digit-plus-two-digit]
  POOL-MEMBERSHIP SELF-CHECK: before emitting each problem, verify the chosen (a, b, op) triple appears verbatim above. The 36 listed triples are the ONLY allowed facts. Common FORBIDDEN candidates to REJECT (valid by operand/no-regroup constraints but NOT in v1 pool): 73+4 (decade out of v1 range), 81-6 (same), 50+7 (round-ten outside the 3 pool entries), 47-23 (two-digit subtrahend, deferred), 13-5 (result < 12), 27+6 (carry required), 32-5 (borrow required).

  CATEGORY-MIX BUDGET (apply BEFORE selecting any facts — this is the FIRST rule because Haiku's prior empirically saturates round-ten-anchor or mid-decade-units-shift when the cap is buried late in the rule list). An 8-problem session has FIVE category budgets that MUST all be respected:
     · round-ten-anchor:         AT MOST 1.   (Pool has 3 facts: 20+3, 30+5, 40+2. Haiku's empirical prior, left uncapped, saturates this category — placing 2 or 3 round-ten facts in a single 8-problem session crowds out the near-boundary-no-cross learning target. The cap pins it to 1.)
     · mid-decade-units-shift:   AT MOST 4.   (Pool has 11 facts.)
     · near-boundary-no-cross:   AT MOST 5.   (Pool has 12 facts. Generous because this IS the learning target.)
     · tens-doubles-echo:        AT MOST 1.   (Pool has 3 facts: 22+5, 44+3, 66+3.)
     · two-digit-plus-two-digit: AT MOST 2.   (Pool has 6 facts.)
  The five caps SUM TO 13, so an 8-problem session has 5 slots of slack. FAILURE MODES BOTH WAYS — Haiku's uncapped prior over-pulls round-ten-anchor (the round-ten-prior failure, easily 2-3-of-8 if unguarded); a correction over-attempt could produce 6-of-8 mid-decade-units-shift (mid-decade-saturation, the symmetric failure). Both are real. Pick a layout with EACH cap respected before assigning facts to slots.

  SESSION COMPOSITION RULES (apply IN ORDER, AFTER the CATEGORY-MIX BUDGET above):
  1. Problems 1-3 (gentle ramp): draw EXCLUSIVELY from the EASY band. Calibration window.
  2. NEGATIVE ANCHOR — P1, P2, P3, P4 PLACEMENT BANS (any one of these is a hard rule violation):
     · DO NOT place any MEDIUM-band fact at P1, P2, or P3. MEDIUM-band only appears at P4 or later.
     · DO NOT place any HARD-band fact at P1, P2, P3, or P4. HARD-band only appears at P5 or later.
     · The ONLY facts allowed at P1, P2, P3 are: 20+3, 30+5, 40+2, 25+4, 33+4, 22+5, 15-3, 28-5, 19-7.
  3. P1 IS ALWAYS "+". Hard rule — session opener carries onset anxiety; the more confident operation enters first. Allowed P1 facts: 20+3, 30+5, 40+2, 25+4, 33+4, 22+5.
  4. OP-MIX RULES (mandatory):
     · The 8-problem session MUST contain AT LEAST 5 problems with op = "+" AND AT LEAST 2 problems with op = "-".
     · Allowed mixes: 5+/3- (default), 6+/2-.
     · FORBIDDEN mixes: 8+/0-, 7+/1-, 4+/4-, 3+/5-.
  5. Problem 4: MEDIUM-band only (HARD-band still forbidden at P4).
  6. Problems 5-8 (discriminate): draw from MEDIUM + HARD bands. Recent-score modulation: low score (< 0.5) -> bias toward MEDIUM and REDUCE "-" count to exactly 2; high score (>= 0.85) -> push toward HARD with >= 1 near-boundary-no-cross in P5-P8; mid score -> balanced.
  7. HIGH-LEVERAGE COVERAGE RULE: at least one near-boundary-no-cross fact MUST appear in P5-P8 (drawn from: 23+6, 41+8, 32+7, 55+4, 27+2, 47+2, 35-4, 48-7, 52-1, 64-3, OR the MEDIUM-band near-boundary 34+5 or 26-5 if placed at P5+). This is the actual learning target of the tier — Marian must recognise that even when the units value is near 9 (or near 0), the operation does NOT cross the decade.
  8. ROUND-TEN-ANCHOR-CAP SELF-CHECK (re-statement of CATEGORY-MIX BUDGET): AT MOST ONE problem across the entire 8-problem session may carry the round-ten-anchor category (drawn from: 20+3, 30+5, 40+2). Before emitting a second round-ten-anchor, REJECT it. Haiku's uncapped prior empirically saturates this category — left unguarded, a bake can land 2 or 3 round-ten facts in the same 8-problem session (20+3 AND 30+5, or all three of 20+3/30+5/40+2), which is the failure mode this cap prevents. Pick at most 1; let the other two lie unused for this session. NEGATIVE ANCHOR: it is FORBIDDEN to place 20+3 AND 30+5 in the same session; FORBIDDEN to place 20+3 AND 40+2; FORBIDDEN to place 30+5 AND 40+2.
  9. MID-DECADE-UNITS-SHIFT-CAP SELF-CHECK (re-statement): AT MOST FOUR problems across the entire 8-problem session may carry the mid-decade-units-shift category. Before emitting a fifth, REJECT it and SWAP for a near-boundary-no-cross or round-ten-anchor or tens-doubles-echo fact. NEGATIVE ANCHOR — mid-decade-units-shift IS the largest pool category (11 facts), but an 8-problem session with 5 or more mid-decade-units-shift facts crowds out the near-boundary-no-cross learning target (rule 7). CONCRETE NUMERIC GUARD — if you have selected 4 mid-decade-units-shift facts already, every remaining slot MUST carry a DIFFERENT category; if you have selected 5 or more, the canon will be REJECTED by lint and the bake fails.
  10. NEAR-BOUNDARY-NO-CROSS-CAP SELF-CHECK (re-statement): AT MOST FIVE problems may carry the near-boundary-no-cross category. Before emitting a sixth, REJECT it. (Cap binds only on near-boundary-heavy sessions; typical sessions land at 3-4.)
  11. TENS-DOUBLES-ECHO-CAP SELF-CHECK (re-statement): AT MOST ONE problem may carry the tens-doubles-echo category. Before emitting a second, REJECT it. NEGATIVE ANCHOR: it is FORBIDDEN to place 22+5 AND 44+3 in the same session; FORBIDDEN to place 22+5 AND 66+3; FORBIDDEN to place 44+3 AND 66+3.
  12. TWO-DIGIT-PLUS-TWO-DIGIT-CAP SELF-CHECK (re-statement): AT MOST TWO problems may carry the two-digit-plus-two-digit category. Before emitting a third, REJECT it.
  13. NO duplicate (a, b, op) triples within the 8-problem set.
  14. DUAL-EXPOSURE RULE (LOAD-BEARING — this is the first tier where the rule binds in real (non-forward-compat) sense): never pair a "+" fact and its "-" inverse in the same session, where "inverse" means the same operand triple. E.g. if 25-3=22 is in the session, 22+3=25 is FORBIDDEN. For "+" facts like 23+4=27, the inverse 27-4=23 is FORBIDDEN. Walk through the session once at the end and check every (a, b, c) where a±b=c against the other 7 problems; if any inverse pair is present, SWAP one of the offending facts.

  WORKED EXAMPLE — a clean 8-problem session that respects all caps (use this as a template, not a verbatim copy):
     P1=20+3 [EASY/+/round-ten-anchor]   (round-ten-anchor #1 — at cap)
     P2=22+5 [EASY/+/tens-doubles-echo]  (tens-doubles-echo #1 — at cap)
     P3=15-3 [EASY/-/mid-decade-units-shift] (mid-decade-units-shift #1; "-" count 1/3)
     P4=42+3 [MEDIUM/+/mid-decade-units-shift] (mid-decade #2 — P4 is MEDIUM-only)
     P5=23+6 [HARD/+/near-boundary-no-cross] (near-boundary #1 — P5-P8 anchor)
     P6=48-7 [HARD/-/near-boundary-no-cross] (near-boundary #2; "-" count 2/3)
     P7=33+4 [EASY/+/mid-decade-units-shift] (mid-decade #3 — EASY at P7 allowed; balances op-mix)
     P8=25-3 [MEDIUM/-/mid-decade-units-shift] (mid-decade #4 — at cap; "-" count 3/3)
  Counts: round-ten-anchor=1 (at cap), mid-decade-units-shift=4 (at cap), near-boundary-no-cross=2 (under cap of 5), tens-doubles-echo=1 (at cap), two-digit-plus-two-digit=0. Total = 8. EASY at P1-P3 + P7, MEDIUM at P4 + P8, HARD at P5 + P6. P5-P8 carries 2 near-boundary-no-cross facts (high-leverage rule satisfied with 1 to spare). Op-mix 5+/3-, P1 is "+", no inverse pairs.

  PER-PROBLEM SHAPE for two-digit-addsub-no-regroup: every problem MUST emit op: "+" OR op: "-" on the wire (the screen renders the operator glyph from op). The op flag matches the chosen fact's [.../+/...] or [.../-/...] tag. Wrong-answer chip selection is handled entirely at render time — distractorClass is NOT a planner-emitted field; the canon JSON wire is utterance-only {id, text} and carries no per-problem distractor tag. Utterance ids MUST use the literal "math." prefix (NOT "two-digit-addsub."): "math.p1.read", "math.p1.correct", ..., "math.p8.giveAnswer". The id namespace is the track name, NOT the focus-node name. Per-slot utterance templates:
  - read (+): "<addend-A> plus <addend-B>. How many?" e.g. "Twenty-three plus four. How many?"
  - read (-): "<minuend> minus <subtrahend>. How many are left?" e.g. "Forty-eight minus seven. How many are left?"
    READ-LINE NEGATIVE ANCHOR ("-" only): the read-line MUST use the word "minus" verbatim AND end with the phrase "How many are left?" — DO NOT substitute "take away" for "minus", and DO NOT shorten the trailing phrase to "How many?". The "take away" phrasing belongs in the hint scaffold ONLY (see below). Emitting "Forty-eight minus seven. How many?" as a "-" read-line is a HARD RULE VIOLATION — the browser parser rejects that shape and the canon falls into silent static. Every "math.pN.read" utterance for an op:"-" problem MUST match the pattern: capitalised first-operand quantity word (possibly hyphenated), then " minus ", then a lowercased subtrahend word, then ". How many are left?". The "+" read-line uses "How many?" (NOT "How many are left?") — the trailing phrase distinguishes addition from subtraction in the wire-side parser.
  - correct: "Yes! <answer>!" e.g. "Yes! Twenty-seven!"
  - reprompt: "Hmm... try again?" (verbatim)
  - hint (+): "Look. <addend-A>. And <addend-B> more. How many now?" e.g. "Look. Twenty-three. And four more. How many now?"
  - hint (-): "Look. <minuend>. Take away <subtrahend>. How many now?" e.g. "Look. Forty-eight. Take away seven. How many now?" (use "take away" framing in the hint regardless of the "minus" read-line — the hint is a scaffold, not a primary read)
  - giveAnswer: "This one is <answer>." e.g. "This one is twenty-seven."

  PROSODY: numbers are spelled out as QUANTITY WORDS, not digit-by-digit. Two-digit numbers use the hyphenated quantity form ("twenty-three", "forty-five", "sixty-nine") — Emma renders these on en-US-EmmaMultilingualNeural rate -10% cleanly. Capitalize the first word of each sentence. Decade names ("twenty", "thirty", ... "ninety") are NOT hyphenated when emitted alone (e.g. "Twenty plus three", not "Twenty-zero plus three").

  PROSODY PROHIBITION (LOAD-BEARING): never render two-digit operands digit-by-digit. FORBIDDEN: "Two three plus one four. How many?" / "Two-three plus four. How many?" / "Two and three plus one and four. How many?". ALLOWED: "Twenty-three plus fourteen. How many?". Digit-by-digit TTS actively trains the concatenated-single-digit-processing error pattern this tier is designed to remediate. Quantity-word framing is the only correct form.

  STRATEGY PROHIBITION (LOAD-BEARING): never invoke or suggest the make-ten-bridge / cross-10-bridge decomposition strategy from add-to-20 in this tier. FORBIDDEN hint text: "Look. Twenty-three. Plus two is twenty-five, then plus two more is twenty-seven" (decomposes through a fictitious intermediate). ALLOWED hint text: "Look. Twenty-three. And four more. How many now?" — the count-on framing is decade-agnostic and does NOT compete with add-to-20's bridge strategy. The pedagogical job at this tier is place-value preservation; the strategy being taught is "the tens digit does not change when no carry/borrow occurs."

  Do NOT verbally decompose the two-digit operand (e.g. do NOT say "twenty and three plus four" instead of "twenty-three plus four"). The decomposition IS the mental work Marian does to preserve place value; it stays internal.
- two-digit-addsub-with-regroup: addition OR subtraction within one mixed-op session, WITH regrouping required. <drift-guard>RULE_IDENTITY=two-digit-addsub-with-regroup; SPEC=design/math/two-digit-addsub-with-regroup-content.md; LINT=scripts/compositionLint.ts:3104 (POOL) + 3416 (RULES) + 3938 (BINDING). Do NOT rename, re-band, re-cap, or substitute facts under any seed.</drift-guard> For ADDITION: first operand two-digit in [10, 60], second operand single-digit in [1, 9], units column sums to STRICTLY > 9 (carry REQUIRED). For SUBTRACTION: minuend two-digit in [10, 64], subtrahend single-digit in [1, 9], minuend's units digit STRICTLY < subtrahend (borrow REQUIRED), result two-digit in [17, 64]. read for "+": "<addend-A> plus <addend-B>. How many?" e.g. "Twenty-seven plus six. How many?". read for "-": "<minuend> minus <subtrahend>. How many are left?" e.g. "Thirty-two minus five. How many are left?".

  REGROUP-REQUIRED SELF-CHECK <rule band="hard">apply BEFORE emitting every problem</rule>:
  - For "+" facts: COMPUTE (a mod 10) + b and CONFIRM > 9. If <= 9, the fact is NO-REGROUP territory and is FORBIDDEN (belongs in two-digit-addsub-no-regroup). Worked example: 27+6 -> units 7+6=13 > 9 OK. 23+4 -> units 3+4=7 <= 9 FORBIDDEN.
  - For "-" facts: COMPUTE (a mod 10) and CONFIRM < b. If >=, the fact is NO-BORROW territory and is FORBIDDEN. Worked example: 32-5 -> units 2 < 5 OK. 28-5 -> units 8 >= 5 FORBIDDEN.
  - For "-" facts: COMPUTE a - b and CONFIRM result >= 17. If < 17, the result has slipped into sub-to-20 territory and is FORBIDDEN (single-digit results belong to sub-to-20). Worked example: 21-4=17 OK. 12-5=7 FORBIDDEN.
  - <self-check>Did I just emit a fact that satisfies the no-regroup constraint? If yes, REJECT — that fact belongs to two-digit-addsub-no-regroup, not here. Re-pick from the 30-fact pool below.</self-check>

  FACT POOL (30 ordered triples; pick exactly 8 distinct (a, b, op) triples per session, no duplicates):
  Each fact is annotated with [BAND/op/category]. Categories:
  - carry-from-units (+ only): the actual learning target on "+". Single-digit b where (a mod 10) + b > 9.
  - borrow-from-tens (- only): the actual learning target on "-". Single-digit b where (a mod 10) < b. Pool has 8 mid-decade-minuend facts.
  - round-ten-cross-down (- only): minuend ends in 0; units column starts at 0, so every subtrahend forces a borrow. SATURATION-PRIOR cap target (Haiku's empirical prior gravitates to round-ten anchors across bakes); pool has 3 facts (30-4, 40-7, 50-8).
  - EASY band (P1-P3 ONLY; 9 facts):
    · 15+8=23  [EASY/+/carry-from-units]
    · 17+5=22  [EASY/+/carry-from-units]
    · 19+4=23  [EASY/+/carry-from-units]
    · 13+9=22  [EASY/+/carry-from-units]
    · 16+6=22  [EASY/+/carry-from-units]
    · 14+7=21  [EASY/+/carry-from-units]
    · 21-4=17  [EASY/-/borrow-from-tens]
    · 22-5=17  [EASY/-/borrow-from-tens]
    · 23-6=17  [EASY/-/borrow-from-tens]
  - MEDIUM band (P4-P8 eligible; 11 facts):
    · 27+6=33  [MEDIUM/+/carry-from-units]
    · 25+8=33  [MEDIUM/+/carry-from-units]
    · 29+5=34  [MEDIUM/+/carry-from-units]
    · 35+7=42  [MEDIUM/+/carry-from-units]
    · 38+4=42  [MEDIUM/+/carry-from-units]
    · 46+7=53  [MEDIUM/+/carry-from-units]
    · 48+5=53  [MEDIUM/+/carry-from-units]
    · 32-5=27  [MEDIUM/-/borrow-from-tens]
    · 41-6=35  [MEDIUM/-/borrow-from-tens]
    · 53-8=45  [MEDIUM/-/borrow-from-tens]
    · 30-4=26  [MEDIUM/-/round-ten-cross-down]
  - HARD band (P5-P8 ONLY; 10 facts):
    · 45+8=53  [HARD/+/carry-from-units]
    · 47+6=53  [HARD/+/carry-from-units]
    · 49+4=53  [HARD/+/carry-from-units]
    · 55+9=64  [HARD/+/carry-from-units]
    · 58+6=64  [HARD/+/carry-from-units]
    · 52-7=45  [HARD/-/borrow-from-tens]
    · 61-8=53  [HARD/-/borrow-from-tens]
    · 64-9=55  [HARD/-/borrow-from-tens]
    · 40-7=33  [HARD/-/round-ten-cross-down]
    · 50-8=42  [HARD/-/round-ten-cross-down]
  POOL-MEMBERSHIP SELF-CHECK <rule band="hard">: before emitting each problem, verify the chosen (a, b, op) triple appears verbatim above. The 30 listed triples are the ONLY allowed facts. Common FORBIDDEN candidates to REJECT (valid by operand range but NOT in v1 pool): 12-5 (result < 17, single-digit, sub-to-20 territory), 73+8 (operand outside v1 decade range [10, 64]), 20+3 (no-carry, two-digit-addsub-no-regroup territory), 26-8 (borrow OK but not curated in v1 pool).

  CATEGORY-CAP BUDGET <rule band="hard">apply BEFORE selecting any facts — this is the FIRST rule because Haiku's prior empirically saturates round-ten-cross-down when the cap is buried late in the rule list</rule>:
  - carry-from-units:     AT MOST 5.   (Pool has 18 facts; generous because this IS the "+" learning target.)
  - borrow-from-tens:     AT MOST 3.   (Pool has 9 facts; matches the "-" cap from op-mix.)
  - round-ten-cross-down: AT MOST 1.   (Pool has 3 facts: 30-4, 40-7, 50-8. SATURATION-PRIOR cap — load-bearing.) NEGATIVE ANCHOR: it is FORBIDDEN to place 30-4 AND 40-7 in the same session; FORBIDDEN to place 30-4 AND 50-8; FORBIDDEN to place 40-7 AND 50-8. AT MOST ONE round-ten-cross-down fact per session — pick at most one of {30-4, 40-7, 50-8}; let the other two lie unused. <self-check>After placing all 8 facts, count round-ten-cross-down occurrences. If > 1, REJECT and SWAP the surplus for a borrow-from-tens fact at the same slot.</self-check>
  The three caps SUM TO 9, giving an 8-problem session 1 slot of slack. <self-check>Pick a category layout that respects ALL THREE caps BEFORE assigning facts to slots — Haiku attention drifts to round-ten-cross-down on bake-2+ when the cap is buried; pin the count to 1 at the START of fact selection.</self-check>

  SESSION COMPOSITION RULES (apply IN ORDER, AFTER the CATEGORY-CAP BUDGET above):
  1. Problems 1-3 (gentle ramp): draw EXCLUSIVELY from the EASY band. Calibration window.
  2. NEGATIVE ANCHOR — P1, P2, P3, P4 PLACEMENT BANS (any one of these is a hard rule violation):
     · DO NOT place any MEDIUM-band fact at P1, P2, or P3. MEDIUM-band only appears at P4 or later.
     · DO NOT place any HARD-band fact at P1, P2, P3, or P4. HARD-band only appears at P5 or later.
     · The ONLY facts allowed at P1, P2, P3 are: 15+8, 17+5, 19+4, 13+9, 16+6, 14+7, 21-4, 22-5, 23-6.
  3. P1 IS ALWAYS "+". Hard rule — session opener carries onset anxiety; the more confident operation enters first. Allowed P1 facts: 15+8, 17+5, 19+4, 13+9, 16+6, 14+7.
  4. OP-MIX RULES <rule band="hard">mandatory; lint rejects any other mix</rule>:
     · The 8-problem session MUST contain EXACTLY 5 OR 6 problems with op = "+" AND EXACTLY 2 OR 3 problems with op = "-".
     · Allowed mixes: 5+/3- (default), 6+/2- (low-score modulation).
     · FORBIDDEN mixes: 8+/0-, 7+/1-, 4+/4-, 3+/5-, 2+/6-, 1+/7-, 0+/8-. <self-check>Count "+" and "-" across all 8 slots. If add-count ∉ {5, 6} OR sub-count ∉ {2, 3}, REJECT and rebalance.</self-check>
  5. Problem 4: MEDIUM-band only (HARD-band still FORBIDDEN at P4).
  6. Problems 5-8 (discriminate): draw from MEDIUM + HARD bands. Recent-score modulation: low score (< 0.5) -> bias toward MEDIUM and use op-mix 6+/2-; high score (>= 0.85) -> push toward HARD with >= 2 borrow-from-tens facts in P5-P8; mid score -> balanced.
  7. HIGH-LEVERAGE COVERAGE RULE <rule band="hard">: at least one borrow-from-tens fact MUST appear in P5-P8 (drawn from: 32-5, 41-6, 53-8, 52-7, 61-8, 64-9, OR the MEDIUM-band borrow-from-tens facts placed at P5+). The "+" side is satisfied trivially because every "+" fact in the pool IS a carry-from-units fact. <self-check>Scan P5, P6, P7, P8. If zero have category=borrow-from-tens, REJECT and SWAP one P5-P8 fact for a borrow-from-tens fact (respecting the op-mix and category caps).</self-check>
  8. ROUND-TEN-CROSS-DOWN-CAP SELF-CHECK <rule band="hard">re-statement</rule>: AT MOST ONE problem across the entire 8-problem session may carry the round-ten-cross-down category (drawn from: 30-4, 40-7, 50-8). Before emitting a second round-ten-cross-down, REJECT it and SWAP for a mid-decade borrow-from-tens fact. NEGATIVE ANCHOR: it is FORBIDDEN to place 30-4 AND 40-7 in the same session; FORBIDDEN to place 30-4 AND 50-8; FORBIDDEN to place 40-7 AND 50-8. Haiku's empirical prior at sibling Wave-4 two-digit-addsub saturated round-ten-anchor (the "+" sibling of round-ten-cross-down) across multiple bakes until the cap was hoisted to the top of the rule list. Wave 5 inherits this prior — the cap MUST be respected from bake-1.
  9. CARRY-FROM-UNITS-CAP SELF-CHECK <rule band="hard">re-statement</rule>: AT MOST FIVE problems may carry the carry-from-units category. Before emitting a sixth, REJECT it. (Cap binds only on "+"-heavy sessions; the 6+/2- op-mix uses exactly 5 carry-from-units + 1 round-ten-cross-down OR 5 carry-from-units + 1 borrow-from-tens — never 6 carry-from-units.)
  10. BORROW-FROM-TENS-CAP SELF-CHECK <rule band="hard">re-statement</rule>: AT MOST THREE problems may carry the borrow-from-tens category. Before emitting a fourth, REJECT it. (Cap matches the "-" count cap from op-mix; every "-" problem in a default 5+/3- mix IS a borrow problem.)
  11. NO duplicate (a, b, op) triples within the 8-problem set.
  12. DUAL-EXPOSURE RULE <rule band="hard">: never pair a "+" fact and its "-" inverse in the same session, where "inverse" means the same operand triple. E.g. if 32-5=27 is in the session, 27+5=32 is FORBIDDEN. Walk through the session once at the end and check every (a, b, c) where a±b=c against the other 7 problems; if any inverse pair is present, SWAP one of the offending facts. AUDIT NOTE: in the v1 pool, ZERO in-pool cross-op collisions exist (every "+" fact's inverse falls outside the curated pool); the rule remains in force for forward-compat with v2 widening.

  WORKED EXAMPLE — a clean 8-problem session that respects ALL caps (use this as a template, NOT a verbatim copy):
     P1=15+8 [EASY/+/carry-from-units]    (carry-from-units #1; "+" count 1)
     P2=17+5 [EASY/+/carry-from-units]    (carry-from-units #2; "+" count 2)
     P3=21-4 [EASY/-/borrow-from-tens]    (borrow-from-tens #1; "-" count 1)
     P4=27+6 [MEDIUM/+/carry-from-units]  (carry-from-units #3; "+" count 3; P4 is MEDIUM-only)
     P5=41-6 [MEDIUM/-/borrow-from-tens]  (borrow-from-tens #2; "-" count 2; P5-P8 borrow-from-tens anchor)
     P6=38+4 [MEDIUM/+/carry-from-units]  (carry-from-units #4; "+" count 4)
     P7=30-4 [MEDIUM/-/round-ten-cross-down] (round-ten-cross-down #1 — at cap; "-" count 3)
     P8=55+9 [HARD/+/carry-from-units]    (carry-from-units #5 — at cap; "+" count 5)
  Counts: carry-from-units=5 (at cap), borrow-from-tens=2 (under cap of 3), round-ten-cross-down=1 (at cap). Total = 8. EASY at P1-P3, MEDIUM at P4-P7, HARD at P8. P5-P8 carries 1 borrow-from-tens + 1 round-ten-cross-down (high-leverage rule satisfied). Op-mix 5+/3-, P1 is "+", no inverse pairs, no duplicates.

  PER-PROBLEM SHAPE for two-digit-addsub-with-regroup: every problem MUST emit op: "+" OR op: "-" on the wire (the screen renders the operator glyph from op). The op flag matches the chosen fact's [.../+/...] or [.../-/...] tag. Wrong-answer chip selection is handled entirely at render time — distractorClass is NOT a planner-emitted field; the canon JSON wire is utterance-only {id, text} and carries no per-problem distractor tag. The render-time helpers (forgottenCarryDistractors on "+", smallerFromLargerDistractors on "-", borrowNoDecrementDistractors on "-" P5-P8) consume the parsed (a, b, op) from the read-line — the planner's job is FACT-POOL COMPOSITION, not trap selection. Utterance ids MUST use the literal "math." prefix (NOT "two-digit-addsub-with-regroup."): "math.p1.read", "math.p1.correct", ..., "math.p8.giveAnswer". The id namespace is the track name, NOT the focus-node name. Per-slot utterance templates:
  - read (+): "<addend-A> plus <addend-B>. How many?" e.g. "Twenty-seven plus six. How many?"
  - read (-): "<minuend> minus <subtrahend>. How many are left?" e.g. "Thirty-two minus five. How many are left?"
    READ-LINE NEGATIVE ANCHOR ("-" only) <rule band="hard">: the read-line MUST use the word "minus" verbatim AND end with the phrase "How many are left?" — DO NOT substitute "take away" for "minus", and DO NOT shorten the trailing phrase to "How many?". The "take away" phrasing belongs in the hint scaffold ONLY (see below). Emitting "Thirty-two minus five. How many?" as a "-" read-line is a HARD RULE VIOLATION — the browser parser rejects that shape and the canon falls into silent static. Every "math.pN.read" utterance for an op:"-" problem MUST match the pattern: capitalised first-operand quantity word (possibly hyphenated), then " minus ", then a lowercased subtrahend word, then ". How many are left?". The "+" read-line uses "How many?" (NOT "How many are left?") — the trailing phrase distinguishes addition from subtraction in the wire-side parser.
  - correct: "Yes! <answer>!" e.g. "Yes! Thirty-three!"
  - reprompt: "Hmm... try again?" (verbatim)
  - hint (+): "Look. <addend-A>. And <addend-B> more. How many now?" e.g. "Look. Twenty-seven. And six more. How many now?"
  - hint (-): "Look. <minuend>. Take away <subtrahend>. How many now?" e.g. "Look. Thirty-two. Take away five. How many now?" (use "take away" framing in the hint regardless of the "minus" read-line — the hint is a scaffold, not a primary read)
  - giveAnswer: "This one is <answer>." e.g. "This one is thirty-three."

  PROSODY: numbers are spelled out as QUANTITY WORDS, not digit-by-digit. Two-digit numbers use the hyphenated quantity form ("twenty-seven", "thirty-three", "forty-two", "fifty-three", "sixty-four") — Emma renders these on en-US-EmmaMultilingualNeural rate -10% cleanly. Capitalize the first word of each sentence. Decade names ("twenty", "thirty", "forty", "fifty", "sixty") are NOT hyphenated when emitted alone (e.g. "Thirty minus four", not "Thirty-zero minus four").

  PROSODY PROHIBITION <rule band="hard">LOAD-BEARING, carried forward from two-digit-addsub-no-regroup unchanged</rule>: never render two-digit operands digit-by-digit. FORBIDDEN: "Two seven plus six. How many?" / "Two-seven plus six. How many?" / "Three and two minus five. How many are left?". ALLOWED: "Twenty-seven plus six. How many?". Digit-by-digit TTS at the regrouping tier trains the concatenated-with-carry-suppression error pattern — the child hears the operands as independent digits, then fails to integrate the carry across them. Quantity-word framing is the only correct form. <self-check>After composing each "+" or "-" read-line, scan for any space-or-hyphen-separated single-digit pair within an operand (e.g. "two seven", "three-two"). If present, REJECT and re-emit as a quantity word.</self-check>

  STRATEGY PROHIBITION <rule band="hard">NEW for Wave 5; spec §1.6</rule>: the read-line MUST NOT verbally pre-execute the regroup. FORBIDDEN: "Twenty-seven plus six. Carry the one to thirty. How many?" (gives the answer scaffold-first). FORBIDDEN: "Thirty-two minus five. Borrow from the thirty. How many are left?" (same). The regroup procedure IS the conceptual learning target — verbalising it pre-emptively short-circuits the diagnostic. The hint slot (NOT the read slot) carries the scaffold per the existing hint template. <self-check>After composing each read-line, scan for any of the strings "carry", "borrow", "regroup", or any clause-after-the-operand explaining the operation. If present in the read slot, REJECT and strip back to the bare operand-operator-operand-question template.</self-check>

  Do NOT verbally decompose the two-digit operand (e.g. do NOT say "twenty and seven plus six" instead of "twenty-seven plus six"). The decomposition IS the mental work Marian does to execute the regroup; verbalising it short-circuits the diagnostic.
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
// contract step 2) + ticket 86c9m3ae3 (short-o pool sibling tier) +
// ticket 86c9q9ben (short-u pool sibling tier) + ticket 86c9qdba4
// (short-i pool sibling tier) + ticket 86c9teua2 (short-e pool sibling
// tier — final single-vowel tier) + the digraphs-sh content tier (FIRST
// digraph tier) + the digraphs-ch content tier (SECOND digraph tier) +
// the digraphs-th content tier (THIRD and final digraph tier).
// Nine first-class content modes today:
//
//   - blending-cv          → "Tap the <word>." (match-picture-to-spoken-word)
//   - cvc-words            → "Read the <word>." (decode-printed-word, short-a)
//   - cvc-words-short-o    → "Read the <word>." (decode-printed-word, short-o)
//   - cvc-words-short-u    → "Read the <word>." (decode-printed-word, short-u)
//   - cvc-words-short-i    → "Read the <word>." (decode-printed-word, short-i)
//   - cvc-words-short-e    → "Read the <word>." (decode-printed-word, short-e)
//   - digraphs-sh          → "Read the <word>." (decode /ʃ/-digraph words)
//   - digraphs-ch          → "Read the <word>." (decode /tʃ/-digraph words)
//   - digraphs-th-voiceless → "Read the <word>." (decode voiceless /θ/-digraph words)
//
// All gated by the browser parser (PR #132 widened it to dispatch on
// the read-line template). Other valid focus nodes (letter-sounds,
// sight-words, simple-sentences) reach this prompt as `blending-cv`
// after `effectiveFocusNode`'s stub-fallback — the user message will
// name `blending-cv` for those. This is the "always render something"
// posture from the contract doc.
//
// Utterance ids ALWAYS use the "word." prefix regardless of content mode.
// The P0 incident (PR #117 → #118) was caused by `cvc.*` prefixes — the
// content-type discriminant lives on the read-line template, NOT the id
// namespace, by design (see design/word-song/parser-widening-plan.md
// §"Why no new id namespace"). cvc-words / cvc-words-short-o /
// cvc-words-short-u / cvc-words-short-i / cvc-words-short-e /
// digraphs-sh / digraphs-ch / digraphs-th-voiceless all share the
// "Read the <word>." template; the focus-node name in the user message
// is what tells the planner which word pool to draw from.
//
// hybridMode problem-type gate (digraphs-sh AND digraphs-th tiers) —
// Kyle's sh spec §6.1 + Dave addendum §Q7d, and Kyle's th spec §6.2 +
// Dave th-addendum §3e/§3f. Three of the seven sh-tier words (`shoe`,
// `sheep`, `shark`) carry a long / r-controlled vowel OUTSIDE Marian's
// formal short-vowel phonics tiers. Two of the seven th-tier words
// (`thick`, `cloth`) carry a different structural complication —
// `thick` is a double-digraph (`th` target onset + `ck` not-yet-taught
// coda); `cloth` carries a `/kl/` onset blend beyond CVC scope. Their
// `wordPack.ts` entries are flagged `hybridMode: true`. The planner
// directive below names those words explicitly and instructs Haiku to
// keep them chip-tap recognition ONLY — no segmentation, no spelling,
// no decode-from-phoneme prompt shapes. The conventional sh-CVC words
// (`ship, shell, shed, shop`) and the 5 fully-decodable th-words
// (`thin, path, bath, math, moth`) take the full decode treatment. The
// lists are sourced from `WORD_SONG_TARGET_WORDS_DIGRAPHS_SH_HYBRID`
// and `WORD_SONG_TARGET_WORDS_DIGRAPHS_TH_HYBRID` in
// `_plannerWordList.ts`, which mirror the `hybridMode: true` rows in
// `wordPack.ts`. The th tier REUSES the exact sh-tier gate pattern —
// same suppression behaviour, no new infrastructure; only the REASON
// for the flag differs (Dave th-addendum Non-obvious finding 5).
//
// digraphs-ch tier — ZERO hybridMode words. The ch-tier directive
// (digraphs-ch block in WORD_SONG_TRACK_GUIDE below) does NOT inherit
// the hybridMode problem-type gate: all 7 ch-words (`chin, chip, chop,
// chat, chest, chug, chick`) are fully decodable short-vowel words, so
// there is no `WORD_SONG_TARGET_WORDS_DIGRAPHS_CH_HYBRID` list and no
// per-word problem-type suppression. This is a deliberate structural
// divergence from the sh AND th tiers, stated explicitly per Dave's
// `digraph-ch-addendum.md` §3d / non-obvious finding #1 + Kyle's
// `digraphs-ch-word-list.md` §6.1 / AC12 — the short-vowel ch word
// stock is rich enough that long-vowel inclusions are never necessary,
// so the hybridMode pattern must NOT be misapplied to ch. The ch-tier
// directive instead carries the c-says-/k/ orthographic-trap framing
// (Dave §1c, non-obvious finding #2): Marian already knows `c` says
// /k/, so `ch` saying /tʃ/ requires explicit naming.
//
// digraphs-th tier — voiceless /θ/ ONLY, plus a mandatory articulation
// scaffold. The th-tier directive (digraphs-th-voiceless block in
// WORD_SONG_TRACK_GUIDE below) carries TWO teaching points neither sh
// nor ch needed: (1) the tongue-between-teeth articulation cue — /θ/
// has NO L1 anchor for a Tagalog-L1 learner and the /θ/→/t/
// substitution is the most systematic of the three digraphs, so Emma
// must explicitly name "put your tongue between your teeth and blow"
// (Dave th-addendum §1a/§1b/§5b, Recommendation 4); (2) the voiced/θ/
// vs voiceless /ð/ disambiguation — `th` spells BOTH sounds, and the
// voiced /ð/ words (`the, this, that, they, them, then, than, there`)
// are EXCLUDED from this tier entirely (Dave th-addendum §2a/§2b/§4a;
// Kyle th spec §1.4). The mouth-at-teeth VISUAL is a design
// requirement owned by the WordSong screen — the planner cannot render
// a visual, but its opener copy must pair with it.
//
// Short-u first-encounter scaffolding — STRIPPED (ticket 86c9qkf3v,
// 2026-05-11). Three successive fix iterations (PR #174 slash-IPA,
// PR #194 English-letter spellouts, PR #192 inline IPA) all produced
// Azure gibberish. The pattern is dead per the orthography-independent
// failure mode documented in `.claude/docs/planner-and-canon.md`
// §"The failure mode is orthography-independent". Future phoneme
// teaching must use a different surface (Dave ticket 86c9qkbvk).
// The opener for cvc-words-short-u is now the same vanilla
// "You did it!" that every other tier gets.
//
// Short-i first-encounter scaffolding — DEFERRED (ticket 86c9qdba4)
// -----------------------------------------------------------------
// Per `design/word-song/short-i-pool-expansion.md` §4 + Dave's research
// at `design/research/short-u-minimal-pair-and-future-vowel-openers.md`
// §3.1, the first short-i session SHOULD open with an explicit `/i/`
// vs. `/ɪ/` minimal-pair contrast line ("Listen carefully: 'sit' — not
// 'seat.'"). This is documented in the spec as load-bearing
// scaffolding for both L1 Tagalog interference AND intra-English
// short-vowel confusion (Marian's diagnostic flagged `/ɪ/` as her
// weakest vowel).
//
// The contrast opener is INTENTIONALLY OUT OF SCOPE for this PR per
// the dispatch contract (ticket 86c9qdba4 brief). The contract scoped
// the lifetime-first-encounter gate as "NOT needed for short-i (no
// /ks/ opener-line equivalent; that was short-o box/fox-specific)" —
// a scoping decision made by the orchestrator. The vanilla "You did
// it!" opener ships with this PR's canon; the contrast-opener
// scaffolding is filed as a follow-up ticket (TBD — Matt to file once
// the short-i tier is shipping and Marian's first short-i session is
// imminent). When that follow-up lands, it adds:
//   - a SHORT-I FIRST-ENCOUNTER SCAFFOLDING block to this prompt,
//     mirroring the short-u block below;
//   - `cvc-words-short-i` to `FIRST_ENCOUNTER_GATED_NODES` in
//     `api/_firstEncounterGate.ts`;
//   - a canon re-bake to pick up the new opener.
const WORD_SONG_TRACK_GUIDE = `Track: Word Song.

The user message names a focus skill node. The planner emits content
matching that node. Nine first-class content modes today:

  - letter-names: "Tap the letter <NAME>." problems. Marian sees a
    trio of LETTER GLYPHS (the alphabet, uppercase + lowercase — no
    pictures) and taps the one named in the read line. This is the
    FIRST literacy tier in tree order, REVIEW MODE by design: Marian's
    alphabet is mastered with a minor residual b/d/p/q confusion. The
    chip is the letter itself rendered as text; no picture-pack assets
    apply. Wire shape and utterance ids are IDENTICAL to blending-cv
    (utterance-only "word." namespace, 8 problems × 5 slots); only the
    read-line template + the chip-content discipline (letter glyph,
    not picture) differ. See the LETTER-NAMES SESSION COMPOSITION
    RULES block below.
  - letter-sounds: "Which letter says <SOUND>?" problems. Marian hears
    Emma voice an isolated short-vowel or consonant phoneme and taps
    the LETTER GLYPH that maps to that sound (no pictures). This is
    the SECOND literacy tier in tree order (between letter-names and
    blending-cv): phoneme → grapheme mapping. Marian's consonant sounds
    are mastered and her short /a/ sound is mastered (per CLAUDE.md
    current-levels table); the lift of this tier is the short-vowel
    ladder /ɒ/ → /ʌ/ → /ɪ/ → /ɛ/ (per design/research/phonics-sequence-
    marian.md §Q1, locked 2026-04-26). The chip is the letter itself
    rendered as text; no picture-pack assets apply. Wire shape and
    utterance ids match every other word-song tier (utterance-only
    "word." namespace, 8 problems × 5 slots). The read-line template,
    the chip-content discipline (letter glyph, not picture), and the
    isolated-phoneme utterance shape diverge from cvc-words — see the
    LETTER-SOUNDS SESSION COMPOSITION RULES block below and the
    LETTER-SOUNDS UTTERANCE TEMPLATE block below.
  - blending-cv: "Tap the <word>." problems. Marian hears the word
    spoken and taps the matching picture chip from a trio. This is the
    earlier-tier content (matching pictures to spoken words).
  - cvc-words: "Read the <word>." problems with SHORT-A target words.
    Marian sees the printed word and decodes it aloud, then the picture
    chip confirms. This is the next-tier content (decoding printed
    words). The wire shape and utterance ids are IDENTICAL to
    blending-cv; only the read-line template differs.
  - cvc-words-short-o: "Read the <word>." problems with SHORT-O target
    words. Same wire shape and templates as cvc-words; only the word
    pool differs (short-o instead of short-a). This is the next-vowel
    sibling tier — Marian arrives here after she's mastered short-a.
  - cvc-words-short-u: "Read the <word>." problems with SHORT-U target
    words. Same wire shape and templates as cvc-words; only the word
    pool differs (short-u instead of short-a/short-o). The third
    vowel-tier sibling — Marian arrives here after she's mastered
    short-o.
  - cvc-words-short-i: "Read the <word>." problems with SHORT-I target
    words. Same wire shape and templates as cvc-words; only the word
    pool differs (short-i instead of short-a/short-o/short-u). The
    fourth vowel-tier sibling — Marian arrives here after she's
    mastered short-u.
  - cvc-words-short-e: "Read the <word>." problems with SHORT-E target
    words. Same wire shape and templates as cvc-words; only the word
    pool differs (short-e instead of short-a/short-o/short-u/short-i).
    The fifth and FINAL single-vowel tier in the o → u → i → e
    canonical arc — Marian arrives here after she's mastered short-i.
  - digraphs-sh: "Read the <word>." problems with sh-DIGRAPH target
    words — all begin with the consonant digraph "sh" (the /ʃ/ sound,
    two letters making one sound). Same wire shape and templates as
    cvc-words. This is the FIRST digraph tier — Marian arrives here
    after she's mastered short-e. See the HYBRIDMODE PROBLEM-TYPE GATE
    block below: three of the seven words are chip-tap recognition only.
  - digraphs-ch: "Read the <word>." problems with ch-DIGRAPH target
    words — all begin with the consonant digraph "ch" (the /tʃ/ sound,
    two letters making one sound). Same wire shape and templates as
    cvc-words. This is the SECOND digraph tier — Marian arrives here
    after she's mastered digraphs-sh. Unlike digraphs-sh, ALL 7 ch-words
    are fully decodable short-vowel words — there is NO hybridMode gate
    for the ch tier. The ch tier has one teaching point sh did not: the
    c-says-/k/ orthographic trap (Marian already knows "c" says /k/ from
    cat / cup / cap, so "ch" saying /tʃ/ must be named explicitly). See
    the CH-DIGRAPH C-SAYS-/k/ FRAMING block below.
  - digraphs-th-voiceless: "Read the <word>." problems with voiceless
    th-DIGRAPH target words — the consonant digraph "th" making the
    voiceless /θ/ sound (the breath sound in "thin" and "bath", NOT the
    voiced sound in "the"). Two letters making one sound. Same wire
    shape and templates as cvc-words. This is the THIRD and final
    digraph tier — Marian arrives here after she's mastered digraphs-ch.
    Two of the seven th-words (thick, cloth) are hybridMode — see the
    HYBRIDMODE PROBLEM-TYPE GATE block below. The th tier carries TWO
    teaching points sh and ch did not: the tongue-between-teeth
    articulation cue, and the voiceless-vs-voiced disambiguation. See
    the TH-DIGRAPH VOICELESS-/θ/ FRAMING block below.

Pick 8 distinct target items from the focus-node-specific pool below
(do not invent new entries, do not use a target more than once).
"Items" are WORDS for blending-cv / cvc-words / cvc-words-short-* /
digraphs-* tiers, LETTER GLYPHS for letter-names, and SOUND→LETTER
PAIRS for letter-sounds. The letter-names tier composition has its own
additional case-mix + confusion-band caps — see the LETTER-NAMES
SESSION COMPOSITION RULES block below. The letter-sounds tier
composition has its own additional category-mix budget and
vowel-ladder gating — see the LETTER-SOUNDS SESSION COMPOSITION RULES
block below.

EXCEPTION for digraphs-sh, digraphs-ch AND digraphs-th-voiceless: each
digraph-tier pool has only 7 words, so 8 distinct words is impossible.
For a digraphs-sh, digraphs-ch, OR digraphs-th-voiceless session, use
each of the 7 pool words at least once and repeat exactly ONE word for
the 8th problem. For digraphs-sh, prefer repeating a conventional
sh-CVC word (ship, shell, shed, or shop) for the 8th slot — NOT a
hybridMode word (shoe / sheep / shark), so the repeated decode practice
lands on a fully-decodable word. For digraphs-ch, all 7 words are fully
decodable, so any ch-word may be repeated for the 8th slot — but prefer
a short-i, short-o, short-a, or short-u word (chin, chip, chop, chat,
chug, chick) over the short-e word (chest), since short-e is Marian's
emerging vowel. For digraphs-th-voiceless, prefer repeating one of the
5 fully-decodable th-words (thin, path, bath, math, moth) for the 8th
slot — NOT a hybridMode word (thick / cloth), so the repeated decode
practice lands on a fully-decodable word. digraphs-sh, digraphs-ch, and
digraphs-th-voiceless are the only focus nodes where a target may
legitimately appear twice in a session.

Pool for letter-names (52 glyphs — 26 uppercase + 26 lowercase). Each
letter carries its inline confusion-band tag; see the LETTER-NAMES
SESSION COMPOSITION RULES block below for tag-driven distractor rules.
The full pool (do NOT emit any item not in this list):
  Uppercase: A [CLEAN] B [CLEAN] C [CLEAN] D [CLEAN] E [CLEAN]
    F [CLEAN] G [CLEAN] H [CLEAN] I [VERTICAL-STICK] J [CLEAN]
    K [CLEAN] L [CLEAN] M [DOUBLE-HUMP] N [DOUBLE-HUMP]
    O [CIRCLE-FAMILY] P [CLEAN] Q [CIRCLE-FAMILY] R [CLEAN]
    S [CLEAN] T [CLEAN] U [CLEAN] V [CLEAN] W [DOUBLE-HUMP]
    X [CLEAN] Y [CLEAN] Z [CLEAN]
  Lowercase: a [CLEAN] b [CIRCLE-STICK] c [CLEAN] d [CIRCLE-STICK]
    e [CLEAN] f [CLEAN] g [CLEAN] h [CLEAN] i [VERTICAL-STICK]
    j [VERTICAL-STICK] k [CLEAN] l [VERTICAL-STICK] m [DOUBLE-HUMP]
    n [DOUBLE-HUMP] o [CIRCLE-FAMILY] p [CIRCLE-STICK]
    q [CIRCLE-STICK] r [CLEAN] s [CLEAN] t [CLEAN]
    u [DOUBLE-HUMP] v [CLEAN] w [DOUBLE-HUMP] x [CLEAN]
    y [CLEAN] z [CLEAN]
Bands: CIRCLE-STICK (lowercase b/d/p/q — the load-bearing
trap class, Marian's residual confusion); DOUBLE-HUMP (M/W/N + m/n/u/w);
CIRCLE-FAMILY (O/Q/o); VERTICAL-STICK (I + i/l/j); CLEAN (everything
else — the visually-distinct pool).

Pool for blending-cv and cvc-words (14-word short-a CVC):
${WORD_SONG_TARGET_WORDS_FOR_PROMPT}

Pool for cvc-words-short-o (11-word short-o CVC):
${WORD_SONG_TARGET_WORDS_SHORT_O}

Pool for cvc-words-short-u (11-word short-u CVC):
${WORD_SONG_TARGET_WORDS_SHORT_U}

Pool for cvc-words-short-i (8-word short-i CVC):
${WORD_SONG_TARGET_WORDS_SHORT_I}

Pool for cvc-words-short-e (9-word short-e CVC):
${WORD_SONG_TARGET_WORDS_SHORT_E}

Pool for digraphs-sh (7-word sh-digraph):
${WORD_SONG_TARGET_WORDS_DIGRAPHS_SH}

Pool for digraphs-ch (7-word ch-digraph):
${WORD_SONG_TARGET_WORDS_DIGRAPHS_CH}

Pool for digraphs-th-voiceless (7-word voiceless-th-digraph):
${WORD_SONG_TARGET_WORDS_DIGRAPHS_TH}

Pool for letter-sounds (16 active sounds per session — 14 mastered
consonants + 1 mastered vowel + 1 current-target vowel). Each sound
carries its inline [BAND/sub-class] tag; see the LETTER-SOUNDS SESSION
COMPOSITION RULES block below for tag-driven gentle-ramp + trap-window
rules. The four short-vowels not currently in-play (the unintroduced
vowels later than current-target in the locked ladder /æ/ → /ɒ/ → /ʌ/
→ /ɪ/ → /ɛ/) are OFF-POOL as targets — they MAY appear as distractor
chips on consonant-target problems, but MAY NEVER be the target sound
(see SHORT-VOWEL-NOT-YET-INTRODUCED ANCHOR below).
  Mastered consonants — continuant sub-class (sustained articulation;
    no voiced/unvoiced trap partner in the consonant pool, except
    /f/-/v/ and /s/-/z/ where /z/ is OFF-POOL):
      /m/ [MASTERED-CONSONANT/continuant]    → letter m, mnemonic mmm
      /n/ [MASTERED-CONSONANT/continuant]    → letter n, mnemonic nnn
      /s/ [MASTERED-CONSONANT/continuant]    → letter s, mnemonic sss
      /f/ [MASTERED-CONSONANT/voiceless-pair-f-v] → letter f, mnemonic fff
      /v/ [MASTERED-CONSONANT/voiced-pair-f-v]    → letter v, mnemonic vvv
      /l/ [MASTERED-CONSONANT/continuant]    → letter l, mnemonic lll
      /r/ [MASTERED-CONSONANT/continuant]    → letter r, mnemonic rrr
      /h/ [MASTERED-CONSONANT/continuant]    → letter h, mnemonic hhh
  Mastered consonants — stop sub-class (cannot voice without epenthesis
    schwa tail; voiced/unvoiced trap-pair structure):
      /p/ [MASTERED-CONSONANT/voiceless-pair-p-b] → letter p, mnemonic puh
      /b/ [MASTERED-CONSONANT/voiced-pair-p-b]    → letter b, mnemonic buh
      /t/ [MASTERED-CONSONANT/voiceless-pair-t-d] → letter t, mnemonic tuh
      /d/ [MASTERED-CONSONANT/voiced-pair-t-d]    → letter d, mnemonic duh
      /k/ [MASTERED-CONSONANT/voiceless-pair-k-g] → letter k, mnemonic kuh
      /g/ [MASTERED-CONSONANT/voiced-pair-k-g]    → letter g, mnemonic guh
  Mastered vowel (always in-pool — anchor):
      /æ/ [MASTERED-VOWEL/short-a]                → letter a, mnemonic a
  Current-target short vowel (EXACTLY ONE per session — the lift; pick
    per the user-message current-target-vowel=<IPA> hint or default to
    /ɒ/ per VOWEL-LADDER SELF-CHECK below):
      /ɒ/ [CURRENT-TARGET-VOWEL/short-o]          → letter o, mnemonic o
      /ʌ/ [CURRENT-TARGET-VOWEL/short-u]          → letter u, mnemonic u
      /ɪ/ [CURRENT-TARGET-VOWEL/short-i]          → letter i, mnemonic i
      /ɛ/ [CURRENT-TARGET-VOWEL/short-e]          → letter e, mnemonic e
  Voiced/unvoiced trap pairs (within MASTERED-CONSONANT band — the
    pedagogically-grounded auditory confusion class per spec §3.1):
      p ↔ b   t ↔ d   k ↔ g   f ↔ v
    /s/-/z/ is a real pair but /z/ is OFF-POOL (see §1.1 exclusion);
    /h, l, r, m, n/ have NO voiced/unvoiced partner in pool and are
    clean-distinct targets only.
  Sounds OFF-POOL (NOT eligible as target or as distractor — REJECT
    on sight): long-a /eɪ/, long-o /oʊ/, long-u /u:/, long-i /aɪ/,
    long-e /i:/, voiced-th /ð/, /ʒ/, /ŋ/, semi-vowels /w/ and /y/,
    /ks/ (the x-grapheme — two-phoneme), /kw/ (the q-grapheme — almost
    never standalone), /z/ (rare in Marian's CVC corpus, deferred to
    v2). Per design/word-song/letter-sounds-content.md §1.1.

HYBRIDMODE PROBLEM-TYPE GATE (digraphs-sh AND digraphs-th-voiceless
tiers): three of the seven sh-words —
${WORD_SONG_TARGET_WORDS_DIGRAPHS_SH_HYBRID.join(', ')} — are
sight-word-hybrids. Their inside vowel is a long or r-controlled vowel
OUTSIDE the short-vowel phonics tiers Marian has been taught. Two of
the seven th-words — ${WORD_SONG_TARGET_WORDS_DIGRAPHS_TH_HYBRID.join(', ')} —
are also hybridMode, for a different structural reason: thick is a
double-digraph (the "th" target plus a "ck" ending Marian has not been
formally taught), and cloth carries a consonant blend at its start
("cl") that is beyond the simple-word scope. For ALL of these words
(sh: shoe, sheep, shark; th: thick, cloth), generate ONLY chip-tap
recognition problems (Emma says the word, Marian taps the matching
picture chip) — the same "Read the <word>." template every digraph word
uses. You MUST NOT generate any segmentation prompt ("tell me the
sounds in s-h-e-e-p"), spelling-from-phoneme prompt, or
decode-from-letters prompt for shoe, sheep, shark, thick, or cloth. The
picture and Emma's audio carry the complicated part; the child is never
asked to produce or decode it. The conventional sh-CVC words (ship,
shell, shed, shop) and the 5 fully-decodable th-words (thin, path,
bath, math, moth) take the normal decode treatment. (In v1 the only
problem type for the whole digraph tier set is chip-tap "Read the
<word>." recognition, so the practical effect is uniform; the gate is
forward-compatible guidance for when segmentation / spelling problem
types are introduced for other tiers.)

NO HYBRIDMODE GATE for digraphs-ch: all 7 ch-words (chin, chip, chop,
chat, chest, chug, chick) use short vowels Marian has formally covered
(short-i, -o, -a, -e, -u). They are all fully decodable — there is no
ch-tier equivalent of the sh-tier's shoe / sheep / shark hybrids (or
the th-tier's thick / cloth hybrids) and no per-word problem-type
suppression for the ch tier.

CH-DIGRAPH C-SAYS-/k/ FRAMING (digraphs-ch tier only): the ch tier has
one teaching point the sh tier did not. Marian already knows the
letter "c" says /k/ (from cat, cup, cap). When she meets "ch", her
existing knowledge generates a competing hypothesis — that "ch" might
say /k/. So for digraphs-ch sessions, Emma must name this once and
clearly. Open the digraphs-ch session's FIRST problem read-flow with
this concept reminder framing baked into the hint/scaffold copy: "c"
and "h" together make a brand-new sound — "ch" — NOT the /k/ sound like
in "cat". Keep it in natural spoken English (this text is read aloud by
Azure TTS — do NOT write phonetic notation, slashes, or IPA characters
into utterance text; write "the ch sound" and "the k sound like in
cat", not "/tʃ/" or "/k/"). For the per-item lines on chop and chip
specifically, you MAY reference the sh-tier minimal pairs Marian
already knows ("ch-op — that's different from shop"; "ch-ip — that's
different from ship") since she practiced ship and shop in the sh tier.
This framing is informational scaffolding inside the standard "Read the
<word>." problem flow — it does NOT change the wire shape, the
utterance ids, or the problem type.

TH-DIGRAPH VOICELESS-/θ/ FRAMING (digraphs-th-voiceless tier only): the
th tier carries TWO teaching points neither sh nor ch needed.

(1) The tongue-between-teeth articulation cue. The voiceless "th" sound
is the hardest of the three digraphs for Marian: her first language
(Tagalog) has no equivalent sound at all, and the natural error is to
say "t" instead (thin becomes "tin", thick becomes "tick"). So Emma
must name HOW the sound is made, not just THAT it is one sound. Open
the digraphs-th-voiceless session's FIRST problem read-flow with this
articulation cue baked into the hint/scaffold copy: "th" is a special
new sound — put your tongue between your teeth and blow softly. It is
NOT the "t" sound like in "top". A static mouth-with-tongue-at-teeth
picture is shown alongside Emma's audio by the screen — your opener
copy must pair with that visual ("look at my mouth — my tongue is
between my teeth").

(2) The voiceless-vs-voiced disambiguation, one line only. The letters
"th" can spell two different sounds: the breath sound in "thin" and
"bath" (this tier), and a different sound in words like "the" and
"this" (NOT this tier). Emma names this once: the "th" in our words is
a quiet breath sound; some other "th" words sound different and we will
learn those later. Do NOT teach the voiced sound here — just flag that
it exists so Marian is not confused later.

Keep ALL of this in natural spoken English. This text is read aloud by
Azure TTS — do NOT write phonetic notation, slashes, IPA characters, or
letter-sound spellouts into utterance text. Write "the th sound" and
"the t sound like in top", never "/θ/" or "/t/" or "th-th-th". For the
per-item lines on thin and thick specifically, you MAY name the t-word
that Marian might confuse it with ("thin — not tin"; "thick — not
tick") since the t-contrast is the core discrimination this tier
teaches. This framing is informational scaffolding inside the standard
"Read the <word>." problem flow — it does NOT change the wire shape,
the utterance ids, or the problem type.

LETTER-NAMES SESSION COMPOSITION RULES (letter-names tier ONLY; apply
IN ORDER, AFTER the CONFUSION-CLASS BUDGET block immediately below).
<drift-guard RULE_IDENTITY=letter-names-pool-and-composition
SPEC=design/word-song/letter-names-content.md§1
LINT=scripts/compositionLint.ts:letter-names-binding-TBD-A3>

CONFUSION-CLASS BUDGET (apply BEFORE selecting any letter — this is the
FIRST rule because the b/d/p/q confusion is the load-bearing
pedagogical concept for this tier and the natural Haiku failure mode is
to under-probe it OR over-drill it. An 8-problem session has TWO class
budgets that MUST both be respected):
  · CIRCLE-STICK (b/d/p/q lowercase): AT LEAST 1, AT MOST 2.
    The "at least 1" is the tier's load-bearing assessment anchor —
    Marian's residual confusion is the literal subject of this tier and
    a session of 8 trivial-grade items teaches nothing. The "at most 2"
    cap prevents over-drilling — Marian's CVC tiers handle b/d residue
    naturally via word-context; this tier surfaces it once or twice per
    session, not constantly.
  · CLEAN-band (visually distinct, see pool tags above): AT LEAST 4.
    Maintains the session's overall "review mode" feel for an
    alphabet-mastered learner. The first 3 problems (gentle ramp) plus
    at least 1 of P4-P5 must be CLEAN-band targets.
FAILURE MODES BOTH WAYS — a session with ZERO b/d/p/q items fails to
do the tier's job (the assessment never fires); a session with 3 OR
MORE b/d/p/q items feels like a remediation drill. Neither extreme is
acceptable.

CASE-MIX BUDGET (apply in the same pass as the CONFUSION-CLASS BUDGET):
  · AT LEAST 2 of the 8 target letters MUST be uppercase.
  · AT LEAST 2 of the 8 target letters MUST be lowercase.
A pure-uppercase or pure-lowercase session breaks the implicit promise
that the tier covers both glyph systems. Mixed-case sessions are the
norm; the floor of 2 each leaves flexibility on the other 4 slots.

SESSION COMPOSITION RULES (apply IN ORDER, AFTER the two budgets above):

1. Problems 1-3 (gentle ramp): EXCLUSIVELY CLEAN-band targets. Read
   each candidate's band tag from the pool above before placing it at
   P1, P2, or P3. ONLY letters tagged [CLEAN] in the pool are eligible
   for these slots.

2. NEGATIVE ANCHOR — P1, P2, P3 PLACEMENT BANS (any one of these is a
   hard rule violation):
   · DO NOT place any CIRCLE-STICK target (b, d, p, q lowercase) at
     P1, P2, or P3. CIRCLE-STICK targets only appear at P4 or later.
   · DO NOT place any DOUBLE-HUMP target (M, W, N upper; m, n, u, w
     lower) at P1, P2, or P3. DOUBLE-HUMP targets only appear at P4
     or later.
   · DO NOT place any CIRCLE-FAMILY target (O, Q upper; o lower) at
     P1, P2, or P3.
   · DO NOT place any VERTICAL-STICK target (I upper; i, l, j lower)
     at P1, P2, or P3.

3. Problems 4-5 (transition window): at least ONE non-CLEAN-band
   target allowed; the b/d/p/q exposure may start here. Other targets
   in these slots stay CLEAN-band.

4. Problems 6-8 (trap window): AT LEAST ONE of these 3 problems MUST
   have a CIRCLE-STICK target (b, d, p, or q). This is the "ensure the
   tier does its job" anchor — composition is meaningless if every
   session is 8 gentle items. Other trap-window targets MAY draw from
   any non-CLEAN band (CIRCLE-FAMILY, VERTICAL-STICK, DOUBLE-HUMP) to
   probe other shape confusions.

5. B/D/P/Q-CAP SELF-CHECK (re-statement of CONFUSION-CLASS BUDGET): AT
   MOST TWO problems across the 8-problem session may carry a
   CIRCLE-STICK target. Before emitting a third b/d/p/q target,
   REJECT it. NEGATIVE ANCHOR — it is FORBIDDEN to place b, d, AND p
   in the same session; it is FORBIDDEN to place all four of b, d, p,
   q in the same session.

6. POOL-MEMBERSHIP SELF-CHECK: before emitting each problem, verify
   the chosen letter appears in the 52-glyph pool above. No digits
   (the character 0 for capital O, the character 1 for capital I —
   FORBIDDEN). No non-ASCII letters. No punctuation. The pool is
   exactly 26 × 2 = 52 entries.

7. NO duplicate target within the 8-problem set. A target is the
   (letter-glyph + case) pair: uppercase A and lowercase a are
   DISTINCT targets in this tier's bookkeeping even though they
   share the spoken letter name. A session may emit BOTH A and a
   as targets in different problems; what it may NOT do is emit the
   same (glyph + case) pair twice.

8. SAME-LETTER-DIFFERENT-CASE BAN (within a single problem's 3-chip
   trio): NEVER place the same letter-name in both target and a
   distractor across the trio — e.g. target A with distractors
   "a, S" is FORBIDDEN. The chip authoring lives in the screen, not
   the planner, so this rule is informational for the directive — but
   the canon's read-line + correct utterance pair must NEVER refer to
   a case variant that could collide with a distractor at render time.

DISTRACTOR-CLASS HINT (for the screen-side chip render — not emitted by
the planner). The screen picks 2 distractors per problem from the same
band as the target when in the trap window (P6-P8) — e.g. target b
gets distractors "d, p" or "d, q". The planner does NOT author
distractor letters; the screen's existing pickDistractors extension
handles it. This hint is documentary only; the planner's job is the
target letter, the read-line, and the 5 utterance slots.

PER-PROBLEM SHAPE for letter-names: every problem MUST emit a target
letter from the 52-glyph pool. Utterance ids MUST use the literal
"word." prefix (NOT "letter." or "letter-names." — see the utterance-id
rule near the end of this guide): "word.p1.read", "word.p1.correct",
..., "word.p8.giveAnswer". Per-slot utterance templates for letter-
names diverge from the cvc-words default — see the per-slot template
list near the bottom of this guide.

NO SSML / NO PHONEME WRAPPING in letter-names utterance text. Azure
Speech (en-US-EmmaMultilingualNeural) pronounces the ASCII alphabet
correctly out of the box — "the letter M" renders as "the letter em"
without any SSML override. Do NOT wrap individual letters in
phoneme tags, do NOT use slash-IPA notation, do NOT spell out
letter names phonetically ("em" / "kyoo" / "double-yoo"). Per
project_audio_phoneme_overrides memory, defensive SSML wrapping on
words the engine already handles correctly can DEGRADE pronunciation.

NO LETTER-SOUND TEACHING in letter-names utterance text. Do NOT write
"M says mmm" or "the letter M makes the mmm sound" or any phoneme-
association content. This tier teaches GLYPH RECOGNITION (does Marian
map the shape to the spoken letter name?), NOT phoneme association —
phoneme association is the next-in-order letter-sounds tier's job.
Cross-tier scaffolding ahead of the curriculum is OUT OF SCOPE.

WORKED EXAMPLE — a clean 8-problem session that respects all rules
(use as a template, NOT a verbatim copy — vary letter choices across
re-bakes):
   P1=t [CLEAN, lower]      (CLEAN ramp anchor)
   P2=a [CLEAN, lower]      (CLEAN ramp anchor)
   P3=K [CLEAN, upper]      (CLEAN ramp anchor, uppercase pivot)
   P4=S [CLEAN, upper]      (CLEAN, mixed-case bookkeeping)
   P5=O [CIRCLE-FAMILY, upper]   (first non-CLEAN target, gentle trap)
   P6=b [CIRCLE-STICK, lower]    (CIRCLE-STICK #1, trap window opens)
   P7=W [DOUBLE-HUMP, upper]     (rotation-pair trap)
   P8=d [CIRCLE-STICK, lower]    (CIRCLE-STICK #2 — at cap)
Counts: CIRCLE-STICK=2 (at cap), CLEAN=4 (at floor), uppercase=4,
lowercase=4. P1-P3 all CLEAN. P6-P8 has 2 CIRCLE-STICK items (b, d) —
satisfies "at least 1 b/d/p/q in trap window" with one to spare. No
duplicates. This is the canonical mix the directive is designed to
produce.

</drift-guard>

LETTER-SOUNDS SESSION COMPOSITION RULES (letter-sounds tier ONLY; apply
IN ORDER, AFTER the CATEGORY-MIX BUDGET block immediately below).
<drift-guard RULE_IDENTITY=letter-sounds-pool
SPEC=design/word-song/letter-sounds-content.md§1
LINT=scripts/compositionLint.ts:letter-sounds-binding-TBD-A7>

CATEGORY-MIX BUDGET (apply BEFORE selecting any sound — this is the
FIRST rule because the consonant-vs-vowel mix is the load-bearing
pedagogical concept for this tier and the natural Haiku failure mode is
to under-rep the current-target vowel OR drill it to exhaustion. An
8-problem session has THREE category budgets that MUST all be
respected):
  · MASTERED-CONSONANT targets: AT LEAST 4 of 8 problems. The first 3
    problems (gentle ramp) plus at least 1 of P4-P5 must be mastered-
    consonant targets. Maintains the session's overall "review mode"
    feel for a consonant-mastered learner and prevents the lift vowel
    from dominating.
  · CURRENT-TARGET VOWEL: AT LEAST 2, AT MOST 3 of 8 problems.
    The "at least 2" is the tier's load-bearing assessment anchor —
    the current-target vowel IS the lift of every session and a session
    that emits 0-1 instances of it teaches nothing new. The "at most 3"
    cap prevents single-vowel drill feel — even when Marian is
    introducing /ɒ/ she sees only 2-3 /ɒ/ problems, not 5-6.
  · MASTERED-VOWEL /æ/ (short-a): AT LEAST 1 of 8 problems, placed in
    the mid-tier window (P4 or P5). The anchor vowel that gives Marian
    a "you know this one" reset in the session's middle.
FAILURE MODES BOTH WAYS — a session with ZERO current-target-vowel
items fails to do the tier's job (the lift never fires); a session
with 4 OR MORE current-target-vowel items feels like a single-vowel
drill. Neither extreme is acceptable.

VOWEL-LADDER SELF-CHECK (apply BEFORE picking the current-target
vowel for any session — this is the hard sequencing rule that gates
WHICH vowel is in play). The user message names the focus skill node
(letter-sounds); the current-target vowel for THIS session is named
explicitly in the user message via a "current-target-vowel=<IPA>"
hint. If that hint is absent, the planner defaults to /ɒ/ (short-o) —
Marian's next-vowel-to-master per the locked ladder
/æ (mastered) → /ɒ/ → /ʌ/ → /ɪ/ → /ɛ/.

ADJACENT-VOWEL-BAN SELF-CHECK (HARD GATE, NO EXCEPTIONS):
  · If current-target-vowel = /ɪ/ (short-i): the sound /ɛ/ (short-e)
    MAY NOT appear as a target in this session. /ɪ/ and /ɛ/ are the
    most acoustically similar English short-vowel pair (per
    phonics-sequence-marian.md §Q1) and Marian's diagnostic showed
    /ɪ/ as her weakest vowel — introducing /ɛ/ adjacent risks merging
    the two in her memory.
  · If current-target-vowel = /ɛ/ (short-e): the sound /ɪ/ (short-i)
    MAY NOT appear as a target in this session.
  · If current-target-vowel = /ɒ/ or /ʌ/: the sounds /ɪ/ and /ɛ/ MAY
    NOT appear as targets either — they are not yet introduced in
    Marian's ladder when /ɒ/ or /ʌ/ is current-target.
NEGATIVE ANCHOR — it is FORBIDDEN to emit BOTH /ɪ/ and /ɛ/ as targets
in the same 8-problem session, regardless of which one is current-
target. This is the load-bearing acoustic-similarity ban for this
tier.

SHORT-VOWEL-NOT-YET-INTRODUCED ANCHOR (apply when picking each
target slot): only the MASTERED vowel /æ/ and the CURRENT-TARGET
vowel may appear as TARGETS. Future-ladder vowels (vowels later
than current-target in /æ/ → /ɒ/ → /ʌ/ → /ɪ/ → /ɛ/) MAY appear as
LETTER chips for distractor purposes but MAY NOT be the target
sound. E.g. when current-target = /ɒ/, the letters i, e, u may
appear as distractor chips on consonant-target problems but
NEVER as the target sound of any problem.

SESSION COMPOSITION RULES (apply IN ORDER, AFTER the budget blocks
above):

1. Problems 1-3 (gentle ramp): EXCLUSIVELY MASTERED-CONSONANT
   targets. Pull each of P1, P2, P3 from the 14-sound mastered-
   consonant pool: /m/, /n/, /p/, /b/, /t/, /d/, /k/, /g/, /s/,
   /h/, /l/, /r/, /f/, /v/. NEGATIVE ANCHOR: do NOT place any
   vowel target (neither /æ/ nor the current-target vowel) at P1,
   P2, or P3 — vowel mapping is the LIFT, not the warmup.

2. Problems 4-5 (mid-tier window): EXACTLY ONE of P4 or P5 MUST
   carry the MASTERED-VOWEL /æ/ (short-a) target — letter chip
   a. The other mid-tier slot MAY carry a mastered consonant
   that participates in a voiced/unvoiced trap pair (e.g. /b/
   with d and p as distractors). Mid-tier introduces the
   mastered vowel as a "you know this" anchor before the lift
   vowel arrives.

3. Problems 6-8 (trap window — the LIFT): AT LEAST TWO of these 3
   problems MUST have the CURRENT-TARGET VOWEL as the target
   sound. This is the "ensure the tier does its job" anchor —
   composition is meaningless if every session is 8 review items.
   The remaining trap slot (1 of P6-P8) MAY carry a mastered-
   consonant target whose voiced/unvoiced partner is included as
   a distractor (b/p, d/t, g/k, v/f — within-class trap, see
   DISTRACTOR-CLASS HINT below).

4. CATEGORY-MIX SELF-CHECK (re-statement of CATEGORY-MIX BUDGET):
   AT MOST 3 problems across the 8-problem session may carry the
   current-target vowel as the target. Before emitting a fourth
   current-target-vowel target, REJECT it. AT LEAST 4 problems
   across the session must carry mastered-consonant targets;
   before placing fewer than 4, REJECT the composition and re-
   draw.

5. POOL-MEMBERSHIP SELF-CHECK: before emitting each problem,
   verify the chosen target sound appears in this tier's
   16-sound active pool (14 mastered consonants + /æ/ +
   current-target vowel). No long-vowel sounds (long-a /eɪ/,
   long-o /oʊ/, long-u /u:/, long-i /aɪ/, long-e /i:/). No
   voiced-th /ð/, /ʒ/, /ŋ/. No /ks/ (x), /kw/ (q), /z/ — these
   are out of scope for v1 (per design/word-song/letter-sounds-
   content.md §1.1).

6. ADJACENT-VOWEL-BAN SELF-CHECK (re-statement of the hard gate
   above): before emitting any vowel target, verify it is either
   the MASTERED /æ/ or the CURRENT-TARGET vowel. If the chosen
   target would result in BOTH /ɪ/ and /ɛ/ appearing as targets
   in the session, REJECT it. NEGATIVE ANCHOR — it is FORBIDDEN
   to place /ɪ/ AND /ɛ/ in the same session as targets.

7. NO duplicate target sound within the 8-problem set. Each of
   the 8 target sounds must be distinct. EXCEPTION: when
   current-target = vowel and the 2-emission floor (rule 3) and
   the 3-emission cap (rule 4) together force a repeat (e.g.
   current-target = /ɒ/ + only one canonical letter 'o'), the
   floor of 2 distinct /ɒ/-target problems may share the same
   sound across two slots. The deduplication rule yields to the
   2-emission floor; planner SHOULD prefer a 2-vowel + 1-trap-
   consonant trap-window composition (rule 3) to avoid the
   collision entirely.

8. SAME-LETTER-DIFFERENT-CASE BAN (within a single problem's
   3-chip trio): NEVER author a read-line + correct utterance
   pair whose target letter could collide with a distractor at
   render time. Letter-sounds renders chips in LOWERCASE by
   default (consistent with CVC tier rendering); the screen owns
   chip case discipline, but the planner's utterance text must
   reference letters in their lowercase glyph form in the read
   line, and in their uppercase glyph form ONLY in the correct
   and giveAnswer utterance slots (where the uppercase glyph
   triggers Azure to read the letter NAME — see the LETTER-
   SOUNDS UTTERANCE TEMPLATE block below).

DISTRACTOR-CLASS HINT (for the screen-side chip render — not emitted
by the planner). The screen picks 2 distractors per problem from one
of three classes depending on target type:
  · TARGET is a voiced/unvoiced consonant pair member (/b/, /p/,
    /d/, /t/, /g/, /k/, /v/, /f/): at least one distractor SHOULD
    be the voiced/unvoiced partner letter (target /b/ → distractor
    p; target /d/ → distractor t; target /g/ → distractor k;
    target /v/ → distractor f). The other distractor is from the
    clean-distinct consonant pool.
  · TARGET is the current-target VOWEL: at least one distractor
    SHOULD be a vowel letter — either the mastered /æ/ letter a
    or another short-vowel letter NOT on the forbidden side of
    the /ɪ/↔/ɛ/ ban. When current-target = /ɪ/, the letter e is
    BANNED as a distractor on /ɪ/-target problems (soft
    discrimination scope — per spec §3.2). When current-target =
    /ɛ/, the letter i is BANNED as a distractor on /ɛ/-target
    problems. The other distractor is a consonant from the clean-
    distinct pool.
  · TARGET is a mastered consonant with NO voiced/unvoiced
    partner in pool (/m/, /n/, /s/, /h/, /l/, /r/): both
    distractors are clean-distinct consonants — different
    articulation place AND different voicing from target.
The planner does NOT author distractor letters; the screen's
existing pickDistractors extension (extended at A7 for letter-sounds)
handles it. This hint is documentary only; the planner's job is the
target sound→letter pair, the read-line, and the 5 utterance slots.

PER-PROBLEM SHAPE for letter-sounds: every problem MUST emit a
target SOUND from the 16-sound active pool (14 mastered consonants +
/æ/ + current-target vowel) paired with its single canonical letter
glyph. Utterance ids MUST use the literal "word." prefix (NOT
"sound." or "letter-sounds." — see the utterance-id rule near the
end of this guide): "word.p1.read", "word.p1.correct", ...,
"word.p8.giveAnswer". Per-slot utterance templates for letter-sounds
diverge from the cvc-words default — see the LETTER-SOUNDS
UTTERANCE TEMPLATE block immediately below.

LETTER-SOUNDS UTTERANCE TEMPLATE (letter-sounds tier ONLY; OVERRIDES
the default per-slot templates in the per-problem section near the
end of this guide).

PHONEME→MNEMONIC SUBSTITUTION TABLE — every utterance slot whose
content IS the isolated phoneme MUST emit the MNEMONIC English-
letter word from the table below in the utterance TEXT. The
mnemonic is NOT wrapped in any SSML in the canon — the canon stays
plain text. Wrapping into <phoneme alphabet="ipa" ph="..."> is
performed at render time by the tier-aware extension of
PHONEME_OVERRIDES in api/_tts.ts (added by Wave 7 Track A7 — see
design/word-song/letter-sounds-content.md §2.4 and §8 obs #3 for
why inline-SSML-in-canon is BLOCKED by escapeSsml at
api/_tts.ts:117 and the substitution-table is the only viable
path). DO NOT write inline <phoneme> tags, slash-IPA notation,
or raw IPA characters into utterance text. Write the mnemonic.

Sound → mnemonic (the literal string to emit in utterance text):
  Continuant consonants (sustained articulation):
    /m/ → mmm     /n/ → nnn     /s/ → sss
    /f/ → fff     /v/ → vvv     /l/ → lll
    /r/ → rrr     /h/ → hhh
  Stop consonants (with schwa epenthesis tail):
    /p/ → puh     /b/ → buh     /t/ → tuh
    /d/ → duh     /k/ → kuh     /g/ → guh
  Mastered vowel:
    /æ/ → a
  Current-target short vowels:
    /ɒ/ → o       /ʌ/ → u       /ɪ/ → i       /ɛ/ → e

NEGATIVE ANCHOR — DO NOT spell out letter NAMES phonetically in
utterance text. "em", "kyoo", "double-yoo", "see" are FORBIDDEN.
DO NOT use slash-IPA notation. DO NOT use raw IPA characters in
utterance text. DO NOT use inline SSML tags. The mnemonic word is
the canonical surface form; the render-time substitution does the
phoneme conversion. (Rationale: per project_audio_phoneme_overrides
memory, defensive SSML wrapping on words the engine already
handles correctly DEGRADES pronunciation. The tier-aware
PHONEME_OVERRIDES extension at A7 is the single SSML construction
site; the canon stays plain text and the substitution activates
ONLY for letter-sounds tier utterances per the tier-filter
parameter.)

Per-slot templates (letter-sounds tier; <SOUND-MNEMONIC> is the
substituted word from the table above; <LETTER-UPPER> is the
uppercase letter glyph for the target):

- read: "Which letter says <SOUND-MNEMONIC>?"
    e.g. "Which letter says mmm?" (target letter: m)
    e.g. "Which letter says o?"   (target letter: o, sound /ɒ/)
    e.g. "Which letter says buh?" (target letter: b, sound /b/)
- correct: "Yes! <LETTER-UPPER> says <SOUND-MNEMONIC>."
    e.g. "Yes! M says mmm."
    e.g. "Yes! O says o."
    e.g. "Yes! B says buh."
  The <LETTER-UPPER> in correct/giveAnswer is the UPPERCASE letter
  glyph (M, O, B) — read by Azure as the letter NAME ("em", "oh",
  "bee") rather than the phoneme. The letter-name pronunciation is
  INTENTIONAL: only the <SOUND-MNEMONIC> (mmm, o, buh) is wrapped
  in <phoneme> at render time; the letter-name reference stays
  plain prose and Azure renders it as its native letter name. This
  separates the two concepts (the letter has a NAME and a SOUND)
  cleanly in Marian's hearing.
- reprompt: "Hmm... try again?"  (verbatim — SAME as every other
  word-song tier)
- hint: "Listen. <SOUND-MNEMONIC>."
    e.g. "Listen. mmm."
    e.g. "Listen. o."
    e.g. "Listen. buh."
  The hint slot voices ONLY the sound — gives Marian a clean
  second listen with no other framing.
- giveAnswer: "This one is <LETTER-UPPER>. <LETTER-UPPER> says <SOUND-MNEMONIC>."
    e.g. "This one is M. M says mmm."
    e.g. "This one is O. O says o."
    e.g. "This one is B. B says buh."

NO ARTICLE-LED FALLBACK for letter-sounds — the "Yes! That's a
<word>." article-led default (used by blending-cv / cvc-words /
cvc-words-short-* / digraphs-*) is INCORRECT for letter-sounds.
Letters are not nouns and sounds are not nouns; the correct
template uses the LETTER as the subject ("M says mmm.") and the
giveAnswer uses the demonstrative ("This one is M."). NEVER write
"Yes! That's a m." or "Yes! That's an mmm." for letter-sounds.

NO CROSS-TIER SCAFFOLDING in letter-sounds utterance text. Do NOT
write CVC words ("M says mmm like in mat"), do NOT reference the
sh/ch/th digraphs, do NOT cross-link the letter NAME tier ("M is
the letter M and it says mmm"). This tier teaches the isolated
phoneme → letter mapping ONLY — every other tier handles its own
content.

WORKED EXAMPLE — a clean 8-problem session with current-target
vowel = /ɒ/ that respects all rules (use as a template, NOT a
verbatim copy — vary sound choices across re-bakes):
   P1: target /m/ → m  (MASTERED-CONSONANT, gentle ramp)
       read: "Which letter says mmm?"
       correct: "Yes! M says mmm."
   P2: target /h/ → h  (MASTERED-CONSONANT, gentle ramp)
       read: "Which letter says hhh?"
       correct: "Yes! H says hhh."
   P3: target /n/ → n  (MASTERED-CONSONANT, gentle ramp)
       read: "Which letter says nnn?"
       correct: "Yes! N says nnn."
   P4: target /æ/ → a  (MASTERED-VOWEL anchor at mid-tier)
       read: "Which letter says a?"
       correct: "Yes! A says a."
   P5: target /b/ → b  (MASTERED-CONSONANT with voiced/unvoiced
                        trap; distractors include p, d)
       read: "Which letter says buh?"
       correct: "Yes! B says buh."
   P6: target /ɒ/ → o  (CURRENT-TARGET vowel #1 — lift fires)
       read: "Which letter says o?"
       correct: "Yes! O says o."
   P7: target /g/ → g  (MASTERED-CONSONANT, voiced/unvoiced trap
                        with k as distractor — gives the
                        trap window a non-vowel item between the
                        two /ɒ/ slots)
       read: "Which letter says guh?"
       correct: "Yes! G says guh."
   P8: target /ɒ/ → o  (CURRENT-TARGET vowel #2 — at floor of 2)
       read: "Which letter says o?"
       correct: "Yes! O says o."
Counts: MASTERED-CONSONANT=6 (above floor of 4), MASTERED-VOWEL
/æ/=1 (at floor), CURRENT-TARGET /ɒ/=2 (at floor of 2). P1-P3
all mastered-consonant. P4 carries mastered vowel /æ/. P6 and P8
carry current-target /ɒ/ (2 distinct slots; rule 7 deduplication
yields to rule 3 floor). No /ɪ/ or /ɛ/ targets (current-target is
/ɒ/). This is the canonical mix the directive is designed to
produce.

</drift-guard>

GRADUATION-SESSION EXCEPTION: when the user message contains the
"GRADUATION SESSION" directive, that directive supplies an additional
NOVEL pool of words (e.g. nap, rat, map, tap) to be mixed with the
canonical pool for that session only. In that case the directive's
novel words are also valid targets — pick the 2-3 specified novel
problems from the directive's pool and the remaining 5-6 from the
canonical pool above. The "do not invent new words" rule still
forbids any word that is in NEITHER pool.

Distractor guidance (Marian sees 3 picture chips per problem; one is the
target, two are distractors — but YOU are not authoring the distractors
here, only the spoken lines):
${WORD_SONG_DISTRACTOR_HINTS}

Order easier-recognise words (cat, bag, hat, dad for short-a; dog, mom,
pot, log for short-o; sun, cup, bus for short-u; pig, bin, lid for
short-i; bed, hen, leg for short-e; ship, shell, shoe for digraphs-sh;
chin, chip, chick for digraphs-ch; thin, bath, math for
digraphs-th-voiceless) in problems 1-3 and richer-rhyme/trap words
(van, can, fan, man, pan, mat, bat, tag, cap, jam for short-a; mop,
box, fox, hot, cot, top, pop for short-o; bug, jug, rug, nut, hut, bun,
gum, tub for short-u; pin, wig, bib, fig, sip for short-i; pen, web,
net, jet, gem, egg for short-e; sheep, shark, shed, shop for
digraphs-sh; chop, chat, chug, chest for digraphs-ch; path, moth,
thick, cloth for digraphs-th-voiceless) in problems 4-8. For
digraphs-ch, place chest (Marian's emerging short-e vowel) toward the
later problems — it is the conservatively-weighted entry in the ch
pool. For digraphs-th-voiceless, introduce the two word-initial th
words (thin, thick) before the word-final th words — Marian meets "th"
at the START of a word first, then sees it at the END. thin is the
clean word-initial decode anchor (place it early); thick is hybridMode
(place it in the trap window, problems 4-8). Spread the 3 word-final
short-a words (path, bath, math) across the session — do NOT cluster
all three back-to-back.

Per-problem utterance template — the read line varies by focus node;
all other slots are content-mode-agnostic:

- read (varies by focus skill node):
    - letter-names: "Tap the letter <NAME>." e.g. "Tap the letter M."
      The <NAME> substitution is the SINGLE-CHARACTER LETTER GLYPH
      itself with its case preserved (uppercase M for an uppercase
      target; lowercase b for a lowercase target). Do NOT spell out
      the letter-name phonetically (no "em", "kyoo", "double-yoo").
      Azure renders "the letter M" as "the letter em" natively — see
      the NO SSML / NO PHONEME WRAPPING rule above. The chip Marian
      taps shows the SAME case as the glyph in the read line; chip
      case discipline is the screen's responsibility, but the
      directive's read-line + correct utterance MUST be internally
      consistent on case.
    - letter-sounds: "Which letter says <SOUND-MNEMONIC>?" e.g.
      "Which letter says mmm?" — see the LETTER-SOUNDS UTTERANCE
      TEMPLATE block above for the phoneme→mnemonic substitution
      table (mmm, buh, o, a, etc.) and the no-inline-SSML rule.
    - blending-cv: "Tap the <word>." e.g. "Tap the cat."
    - cvc-words:   "Read the <word>." e.g. "Read the cat."
    - cvc-words-short-o: "Read the <word>." e.g. "Read the dog."
    - cvc-words-short-u: "Read the <word>." e.g. "Read the sun."
    - cvc-words-short-i: "Read the <word>." e.g. "Read the pig."
    - cvc-words-short-e: "Read the <word>." e.g. "Read the bed."
    - digraphs-sh: "Read the <word>." e.g. "Read the ship."
    - digraphs-ch: "Read the <word>." e.g. "Read the chin."
    - digraphs-th-voiceless: "Read the <word>." e.g. "Read the thin."
  For non-letter-names / non-letter-sounds tiers: use lowercase target
  word; one short sentence; ends with a period. Use the EXACT verb for
  the focus node — "Tap" for blending-cv AND letter-names, "Which
  letter says" for letter-sounds, "Read" for cvc-words /
  cvc-words-short-o / cvc-words-short-u / cvc-words-short-i /
  cvc-words-short-e / digraphs-sh / digraphs-ch /
  digraphs-th-voiceless.
  Do not mix templates within a single plan.
- correct (letter-names tier): "Yes! That's the letter <NAME>." e.g.
  "Yes! That's the letter M." — uses the SAME case-preserved
  single-character <NAME> as the read line. NEVER use the
  "Yes! That's a <word>." article-led default for letter-names —
  letters are not nouns. The "letter" word in the template is what
  carries the grammatical role; the case of <NAME> is preserved from
  the read line.
- correct (letter-sounds tier): "Yes! <LETTER-UPPER> says <SOUND-MNEMONIC>."
  e.g. "Yes! M says mmm." — see LETTER-SOUNDS UTTERANCE TEMPLATE
  block above. NEVER use the article-led "Yes! That's a <word>."
  default for letter-sounds — letters and sounds are not nouns.
- correct (all other word-song tiers): default template is "Yes! That's a <word>." (lowercase target
  after the article) e.g. "Yes! That's a cat."
  EXCEPTION — chip words that cannot take an indefinite article
  (relational nouns: mom, dad; mass nouns: jam, gum; adjectives: hot,
  thin, thick; non-count domain noun: math; vowel-initial nouns: egg)
  fall back to "Yes! <Word>!" (capitalised, trailing bang, no article)
  e.g. "Yes! Mom!" / "Yes! Dad!" / "Yes! Jam!" / "Yes! Gum!" /
  "Yes! Hot!" / "Yes! Egg!" / "Yes! Thin!" / "Yes! Thick!" /
  "Yes! Math!"
  The exception list is exactly: mom, dad, jam, gum, hot, egg, thin,
  thick, math. Apply the fallback ONLY for these nine words; every
  other chip word in every focus pool uses the default
  "Yes! That's a <word>." template.
  Rationale for the egg addition (ticket 86c9teua2): the article-led
  template would produce "Yes! That's a egg." which is grammatically
  wrong English; rather than introduce an a/an switch for one word,
  the bang-fallback shape lands egg in the same prosodic environment
  as the other exceptions.
  Rationale for the thin / thick / math additions (digraphs-th tier):
  thin and thick are adjectives and math is a non-count domain noun —
  "That's a thin." / "That's a thick." / "That's a math." are all
  ungrammatical English. The other 4 th-words (path, bath, moth,
  cloth) are ordinary count nouns and use the default article-led
  template.
  Rationale: the article-led declarative ramp lands the chip word in
  the same prosodic environment as "Read the <word>." which Azure
  renders naturally. The bare "Yes! <Word>." template triggered
  list-final / declarative-tag intonation (clipped sound) regardless
  of final phoneme class.
- reprompt: "Hmm... try again?"  (verbatim — do not vary; SAME for
  letter-names, letter-sounds, and every other word-song tier)
- hint (letter-names tier): "Let's look. <NAME>." e.g.
  "Let's look. M." — <NAME> case-preserved from the read line.
- hint (letter-sounds tier): "Listen. <SOUND-MNEMONIC>." e.g.
  "Listen. mmm." — see LETTER-SOUNDS UTTERANCE TEMPLATE block above.
- hint (all other word-song tiers): "Let's look. <Word>." e.g.
  "Let's look. Cat."
- giveAnswer (letter-names tier): "This one is the letter <NAME>."
  e.g. "This one is the letter M." — <NAME> case-preserved.
- giveAnswer (letter-sounds tier): "This one is <LETTER-UPPER>. <LETTER-UPPER> says <SOUND-MNEMONIC>."
  e.g. "This one is M. M says mmm." — see LETTER-SOUNDS UTTERANCE
  TEMPLATE block above.
- giveAnswer (all other word-song tiers): "This one is <word>."
  e.g. "This one is cat."

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
