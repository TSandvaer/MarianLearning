// Shared request/response shapes for the /api/claude Vercel function.
// Imported by the function (server, through the `api/_types.ts`
// re-export), the browser-side client helper and the React Native app, so
// that the wire contract is defined in exactly one place.
//
// The deployed function loads this file as plain Node ESM (see
// `api/_types.ts`): keep it import-free, or give every relative import a
// `.js` extension.

/** The three points in a session where we call Claude. See CLAUDE.md. */
export type ClaudeKind = 'session-start' | 'stumble-explanation' | 'session-end'

/** POST body for /api/claude. The payload shape is per-kind and is defined
 *  in follow-up tickets that wire real prompts. Until then it is `unknown`. */
export interface ClaudeRequest {
  kind: ClaudeKind
  payload: unknown
}

/** Successful stub response. Once the real prompt is wired, the function
 *  will return the parsed Claude completion in addition to (or instead of)
 *  these fields. The `stub` flag lets callers light-touch detect the
 *  pre-wiring placeholder. */
export interface ClaudeStubResponse {
  ok: true
  kind: ClaudeKind
  stub: true
  note: string
}

// --- Session audio types -------------------------------------------------
//
// Added in ticket 86c9gr385 (Path A — server-side TTS pipeline). The
// session-start response carries pre-rendered MP3 audio per utterance so
// the iPad never depends on Web Speech for dynamic Claude-generated lines.
//
// Shape rationale
// ---------------
// `Utterance` is { id, text, audio }. The `id` is a stable string the
// caller (Math / Word Song screens) uses to look up the audio at playback
// time. `audio` is a discriminated union so we can extend later with a CDN
// URL variant (`{ kind: 'url'; href: string }`) without breaking the wire.
//
// We intentionally keep this scoped to the response payload; no shared
// session-plan type lives here yet because the consumer screens (Math,
// Word Song) don't exist. When they land, the broader session-plan shape
// will move into a shared module — for now we keep the surface narrow.

/** Inline base64 audio: the only kind the server sends. */
export type InlineAudioRef = {
  kind: 'inline'
  /** Base64-encoded audio bytes (no data: prefix). */
  base64: string
  /** Always `audio/mpeg` for the Edge-AnaNeural pipeline. */
  mime: 'audio/mpeg'
}

/**
 * A canon clip shipped inside the native app (no-Claude plan phase 1,
 * `design/native/no-claude-sizing.md` § 4): `mobile/scripts/export-audio.mjs`
 * bundles every `public/canon/**` clip, one per text. The device makes these
 * refs; the server never sends one.
 */
export type BundledAudioRef = {
  kind: 'bundled'
  /** The clip's key in the app's canon registry: the text it speaks. */
  key: string
}

/** A single audio reference. */
export type AudioRef = InlineAudioRef | BundledAudioRef

/** A line Melody speaks, paired with its pre-rendered audio. */
export interface Utterance {
  /** Stable identifier the consumer uses to look up + play this audio. */
  id: string
  /** Spoken text. The frontend's caption layer uses this; it MUST match
   *  what was synthesized. */
  text: string
  /** Audio bundle. The wire carries inline audio only. */
  audio: InlineAudioRef
}

/** A line the native app can play: a server line, or one bundled in the app. */
export interface PlayableUtterance extends Omit<Utterance, 'audio'> {
  audio: AudioRef
}

/** session-start response payload — the Claude session plan plus its
 *  rendered audio. The `plan` field's exact shape will be tightened in a
 *  follow-up ticket that wires the real Claude prompt; for now it's the
 *  raw plan blob from Claude (or a stub) plus the flat utterance list. */
export interface SessionStartResponse {
  ok: true
  kind: 'session-start'
  plan: unknown
  utterances: Utterance[]
  /**
   * Planner-derived letter-sounds current-target vowel, slash notation
   * (`'/o/'`, `'/u/'`, `'/i/'`, `'/e/'`) (Wave 9 W9.4 — ticket
   * 86c9ya3r9). Present ONLY on live letter-sounds responses where the
   * server derived the target from `letterSoundsVowelStates` via the
   * §1.4 algorithm. Absent on:
   *  - canon-served / cached letter-sounds responses (fallback /
   *    all-intro state — the canon's baked `/o/` default applies);
   *  - every non-letter-sounds response (math, other word-song tiers);
   *  - tier-mastered state (all four vowels mastered → no emission).
   *
   * The browser stamps this onto `SessionHistoryEntry.currentTargetVowel`
   * at session-end so the W9.3 per-vowel mastery rule tags the new entry
   * with the correct vowel WITHOUT re-deriving from progress — closing
   * the response→record loop. The slash notation matches
   * `LetterSoundsVowel` in `src/lib/progress/types.ts` exactly, so the
   * browser stamps it verbatim (no translation).
   */
  currentTargetVowel?: '/o/' | '/u/' | '/i/' | '/e/'
}

// --- Review and warm-up blocks --------------------------------------------
//
// Native spec `design/native/review-mode-and-warmup-native.md` § 7.4. Core's
// picker (`progress/reviewPlan.ts`) chooses canon problems; the session-start
// track payload names them, and the server copies those blocks out of the
// canon files with their baked audio (`api/_review.ts`): no planner, no TTS.

/** One canon problem: problem `problem` (1..8) of step `node`'s canon file. */
export interface CanonBlockRef {
  node: string
  problem: number
}

/** `payload.review.blocks` carries exactly this many refs. */
export const REVIEW_BLOCK_COUNT = 8

/** `payload.warmup.blocks` carries 1..this many refs. */
export const WARMUP_BLOCK_MAX = 3

/**
 * A review response's `plan.id` starts with this. The client accepts a
 * review only when it does: an older server ignores `payload.review` and
 * answers with a forward plan, which must not pass for a review.
 */
export const REVIEW_PLAN_ID_PREFIX = 'review-'

// --- Map peek ---------------------------------------------------------------
//
// Native spec `design/native/fast-track-native.md` § 6.2. The session-start
// track payload may carry `peek: { blocks: CanonBlockRef[] }`: exactly
// `PEEK_BLOCK_COUNT` refs, all one step of `track` (core `pickPeekBlocks`:
// that step's problems 1–3). The server answers it like a review (step 0,
// canon blocks copied with their baked audio, renamed `<ns>.p1..p3.`), with a
// plan id starting `PEEK_PLAN_ID_PREFIX`. A peek counts toward nothing.

/** `payload.peek.blocks` carries exactly this many refs. */
export const PEEK_BLOCK_COUNT = 3

/**
 * A peek response's `plan.id` starts with this. An older server ignores
 * `payload.peek` and answers with a forward plan, which the client must
 * take as the peek's failure path.
 */
export const PEEK_PLAN_ID_PREFIX = 'peek-'

// --- Map replay ---------------------------------------------------------------
//
// Native spec `design/native/map-tap-to-play.md` § 3. A tap on a mastered
// stop replays that step under the peek's rules: the session-start track
// payload carries `replay: { node }`, a step of `track`. The server answers
// it like a peek (step 0, before the canon lookup, the session cache and the
// rate limiter): the step's canon problems 1..`REPLAY_BLOCK_COUNT` copied
// with their baked audio, in canon order, with a plan id starting
// `REPLAY_PLAN_ID_PREFIX`. A replay counts toward nothing.

/** A replay plays this many problems: the step's canon P1–P8. */
export const REPLAY_BLOCK_COUNT = 8

/**
 * A replay response's `plan.id` starts with this. An older server ignores
 * `payload.replay` and answers with a forward plan, which the client must
 * take as the replay's failure path.
 */
export const REPLAY_PLAN_ID_PREFIX = 'replay-'

// --- Times mix ----------------------------------------------------------------
//
// Content wave 1 `design/native/content-wave-1.md` § 2.4. A session on the
// times-mix step (`mult-mix`) is composed by core (`pickMixBlocks`): the
// session-start track payload carries `mix: { blocks: CanonBlockRef[] }`,
// exactly `MIX_BLOCK_COUNT` refs, each a step of `MIX_SOURCE_STEPS`. The
// server answers it like a review (step 0, the blocks copied with their
// baked audio, renamed `math.p1..p8.`, plus mult-mix's `session.end.*`
// lines), with a plan id starting `MIX_PLAN_ID_PREFIX`. Warm-up refs are
// appended as for any forward response.

/** `payload.mix.blocks` carries exactly this many refs. */
export const MIX_BLOCK_COUNT = 8

/**
 * A times-mix response's `plan.id` starts with this. An older server
 * ignores `payload.mix` and serves mult-mix's own canon: still times mix,
 * the same 8 every day, which the client accepts too.
 */
export const MIX_PLAN_ID_PREFIX = 'mix-'

/** The steps whose canon blocks a times mix draws on, in pool order. */
export const MIX_SOURCE_STEPS: readonly string[] = [
  'mult-2-5-10',
  'mult-3-4',
  'mult-6-9',
  'mult-mix',
]

/** Error response shape. `error` is a stable machine-readable code; `message`
 *  is optional human-readable detail (never echoes the request body, never
 *  leaks env state). */
export interface ClaudeErrorResponse {
  ok?: false
  error:
    | 'method-not-allowed'
    | 'invalid-body'
    | 'invalid-json'
    | 'config-missing'
    | 'tts-failed'
    /** Per-IP rate limit hit on session-start (added ticket 86c9jdh39 — guards
     *  against runaway billing if the share-link leaks). Browser path A code
     *  treats this like other failure codes and falls back to silent mode. */
    | 'rate-limited'
    /** Anthropic planner call failed: model returned malformed JSON, the
     *  upstream SDK errored, or the request shape was rejected (e.g. unknown
     *  track). Distinct from `tts-failed` so logs can attribute correctly.
     *  Added ticket 86c9jdh39. */
    | 'planner-failed'
    /** A `payload.review` that names a block the server can't serve: not
     *  exactly 8 refs, a step of another track, a problem outside 1..8, or a
     *  missing canon entry (native spec review-mode-and-warmup-native.md
     *  § 7.4). Likewise a `payload.peek` that is not exactly 3 refs of one
     *  step of the track (fast-track-native.md § 6.2), a `payload.mix`
     *  that is not exactly 8 refs of `MIX_SOURCE_STEPS` (content wave 1
     *  § 2.4), and a `payload.replay` whose node is not a step of the
     *  track (map-tap-to-play.md § 3). */
    | 'invalid-request'
  message?: string
}

export type ClaudeResponse =
  | ClaudeStubResponse
  | SessionStartResponse
  | ClaudeErrorResponse

const VALID_KINDS: readonly ClaudeKind[] = [
  'session-start',
  'stumble-explanation',
  'session-end',
]

/** Type guard for ClaudeRequest. Strict — rejects extra-typed but
 *  malformed bodies (wrong kind string, missing payload key). */
export function isClaudeRequest(value: unknown): value is ClaudeRequest {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.kind !== 'string') return false
  if (!VALID_KINDS.includes(v.kind as ClaudeKind)) return false
  if (!('payload' in v)) return false
  return true
}

/** Type guard for SessionStartResponse — used by the browser client to
 *  pick the right success branch. */
export function isSessionStartResponse(
  value: unknown,
): value is SessionStartResponse {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (v.ok !== true || v.kind !== 'session-start') return false
  if (!Array.isArray(v.utterances)) return false
  for (const u of v.utterances) {
    if (!isUtterance(u)) return false
  }
  return true
}

export function isUtterance(value: unknown): value is Utterance {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.text !== 'string') return false
  const a = v.audio as Record<string, unknown> | undefined
  if (!a || typeof a !== 'object') return false
  if (a.kind !== 'inline') return false
  if (typeof a.base64 !== 'string') return false
  if (a.mime !== 'audio/mpeg') return false
  return true
}
