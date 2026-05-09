// /api/claude — Vercel Function. Server-side proxy for the Anthropic API.
//
// HISTORY
// -------
//  - 86c9gkm0c (initial) scaffolded the endpoint as a stub: validate the
//    body, presence-check the API key, return a placeholder.
//  - 86c9gr385 (Path A — server-side TTS pipeline) extends
//    `kind: 'session-start'` to optionally carry a session plan and have
//    every utterance rendered to MP3 server-side via Edge AnaNeural. The
//    stub success path is preserved for callers that don't pass a plan
//    (stumble-explanation, session-end, and any session-start that
//    pre-dates the real Claude prompt wiring).
//  - 86c9grnj4 (P1 hot-fix, round 1) removed a broken
//    `export const config = { runtime: 'nodejs' }` export. PR #32 merged
//    but production still 500'd FUNCTION_INVOCATION_FAILED on every
//    request — the round-1 hypothesis (runtime config shape) was wrong.
//  - 86c9grnj4 (P1 hot-fix, round 2) switched the default export from a
//    bare async function to `{ fetch: handler }` so `@vercel/node` would
//    route the Web `Request`/`Response` codepath instead of the legacy
//    `(IncomingMessage, ServerResponse)` fallback. Reading of the upstream
//    `shouldUseWebHandlers` dispatch logic
//    (https://github.com/vercel/vercel/blob/main/packages/node/src/serverless-functions/serverless-handler.mts)
//    confirmed the dispatch shape was correct. PR #34 merged but production
//    still 500'd — the dispatch shape was a real future-proofing fix but
//    not the actual root cause of the cold-start failure.
//  - 86c9grnj4 (P1 hot-fix, round 3 — THIS CHANGE) fixes the ACTUAL root
//    cause, identified empirically by reading Vercel function logs
//    (`vercel logs --status-code 500 --json --no-follow`) instead of by
//    further source-spelunking. The cold-start error reported by Node is
//    unambiguous:
//        Error [ERR_MODULE_NOT_FOUND]: Cannot find module
//        '/var/task/api/_types' imported from /var/task/api/claude.js
//    The function never reached the handler — it failed at module-load
//    when Node's ESM resolver tried to resolve the bare specifier
//    `'./_types'` from the compiled `claude.js`. With `"type": "module"`
//    in package.json, Vercel's `@vercel/node` builder emits ESM, and
//    Node ESM strict-resolution requires explicit file extensions on
//    relative imports — extension-less specifiers do NOT resolve. Source
//    code under `tsconfig.api.json`'s `moduleResolution: "bundler"` was
//    happy to write `'./_types'`, but the deployed runtime is not.
//
//    Fix: add `.js` to every relative import inside api/. TypeScript with
//    `moduleResolution: "bundler"` accepts the `.js` suffix and resolves
//    it back to the matching `.ts` source for type-checking. Vitest
//    (Vite-bundler resolution) accepts it too. So a single canonical
//    spelling — `'./_types.js'` — works in dev, test, and production.
//    Round 1 + round 2 changes are kept as defensive measures even
//    though neither was the root cause: the no-config-export silence is
//    the upstream-recommended shape, and `{ fetch: handler }` is the
//    correct dispatch hint going forward.
//
// ABSOLUTE RULE: ANTHROPIC_API_KEY is read here only. It must never reach
// the browser bundle. Do not echo, log, or include it in any response.
//
// Runtime: Web-standard fetch handler (the `fetch` export above is what
// triggers Vercel's Web `Request`/`Response` codepath, which in turn runs
// on the Node runtime by default for /api/*.ts entrypoints). The TTS
// pipeline imported from `_tts.ts` uses `globalThis.fetch` (Node 20+
// global), `Buffer` (Node global), and `process.env` (Node API) — all of
// which require Node. The runtime-assertion below catches the in-between
// case where Vercel's defaults flip to Edge in a future platform change
// but still resolve our imports (e.g. via Node-compat shims). It does
// NOT add coverage when the imports themselves fail under Edge — that's
// caught loudly at module-load anyway.
//
// Historical note: prior to ticket 86c9gvgjk the TTS pipeline imported
// the `ws` package to speak the Edge Read-Aloud WSS protocol. The Azure
// REST swap dropped that dependency from this codepath; the assertion's
// error message and the assertNodeRuntime() doc-comment were updated in
// the same PR to reflect the new dependency surface.

import Anthropic from '@anthropic-ai/sdk'

import {
  isClaudeRequest,
  type ClaudeErrorResponse,
  type ClaudeStubResponse,
  type SessionStartResponse,
} from './_types.js'
import { renderSessionAudio } from './_session.js'
import {
  generateSessionStartResponse,
  PlannerError,
  type LeitnerHintItem,
  type PlannerAnthropicClient,
  type PlannerTrack,
} from './_planner.js'
import { createRateLimiter, type RateLimiter } from './_rateLimit.js'
import {
  buildSessionCacheKey,
  createSessionCache,
  type SessionCache,
} from './_sessionCache.js'
import { getCanonEntry } from './_canon.js'
import { applyFirstEncounterGate } from './_firstEncounterGate.js'

/**
 * Cold-start runtime assertion. Throws at module load if the function is
 * not running on Node.
 *
 * Edge runtime: `globalThis.process` is undefined.
 * Node runtime: `process.versions.node` is always a string (e.g. "22.11.0").
 *
 * Caveat: this fires AFTER the static module imports above are resolved.
 * On a pure Edge runtime, `Buffer` and `process.env` accesses inside
 * `_tts.ts` would themselves fail first — so this assertion does NOT add
 * coverage there. What it DOES add coverage for is hybrid runtimes (Edge
 * with Node compat shims) or a future Vercel build target that resolves
 * the imports but still lacks `process.versions.node`. In those cases
 * the imports succeed but the function would later mis-behave; this
 * throw makes the failure loud and named at the top of the stack.
 *
 * Exported for unit-test coverage; the side effect is the runtime check
 * itself — calling `assertNodeRuntime()` from another file must produce
 * the same throw shape so the regression test is meaningful.
 */
export function assertNodeRuntime(): void {
  const nodeVersion = (
    globalThis as { process?: { versions?: { node?: string } } }
  ).process?.versions?.node
  if (typeof nodeVersion !== 'string') {
    throw new Error(
      '/api/claude must run on the Vercel Node runtime — `Buffer`, ' +
        '`process.env`, and `globalThis.fetch` (used by the TTS pipeline) ' +
        'all require Node. Check vercel.json and the Vercel project runtime ' +
        'setting; do not move this function to Edge.',
    )
  }
}

assertNodeRuntime()

// Origins allowed to hit this function. Local dev port + the Vercel
// deployment's own origin (provided as VERCEL_URL at runtime, without
// scheme — we add https://). Add additional origins via
// CLAUDE_API_EXTRA_ORIGINS (comma-separated) if needed in future.
function buildAllowedOrigins(): readonly string[] {
  const origins = new Set<string>(['http://localhost:5173'])

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) origins.add(`https://${vercelUrl}`)

  const extra = process.env.CLAUDE_API_EXTRA_ORIGINS
  if (extra) {
    for (const o of extra.split(',')) {
      const trimmed = o.trim()
      if (trimmed) origins.add(trimmed)
    }
  }

  return [...origins]
}

function corsHeaders(requestOrigin: string | null): Headers {
  const headers = new Headers()
  const allowed = buildAllowedOrigins()
  if (requestOrigin && allowed.includes(requestOrigin)) {
    headers.set('Access-Control-Allow-Origin', requestOrigin)
    headers.set('Vary', 'Origin')
  }
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Access-Control-Max-Age', '86400')
  return headers
}

function jsonResponse(
  body: ClaudeStubResponse | SessionStartResponse | ClaudeErrorResponse,
  status: number,
  baseHeaders: Headers,
): Response {
  const headers = new Headers(baseHeaders)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  // Belt-and-braces: the function never returns content that should be cached
  // by an intermediary or the browser.
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers })
}

/** Pull a session plan out of the payload, if one was provided. The plan
 *  is opaque here — `_session.extractUtteranceTexts` is the single point
 *  that knows how to find utterance text inside a plan. */
function extractPlan(payload: unknown): unknown | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>
  if (!('plan' in p)) return null
  return p.plan
}

/** Track-based session-start payload (added ticket 86c9jdh39, extended
 *  ticket 86c9kmwba for the optional `progress` block). When the caller
 *  doesn't ship a hand-built plan, they may instead ask the server to
 *  generate one via Haiku by passing { track, level, childName } plus an
 *  optional progress block carrying focus-node hints. */
interface TrackPayload {
  track: PlannerTrack
  level: number
  childName: string
  /** M2: optional adaptive-engine hints. Browser computes via
   *  `pickFocusNode` / `pickRecentSuccessRate` against
   *  `loadProgress()`. Absent for legacy clients — the planner falls
   *  back to the level-1 default focus node for the track. */
  focusNode?: string
  recentSuccessRate?: number | null
  /**
   * Graduation-session hint (ticket 86c9m3aec). Browser computes via
   * `isGraduationSessionPending(progress, focusNode, track)` at
   * session-start fetch time. When `true` AND the effective focus
   * node is `cvc-words`, the planner mixes 2–3 novel short-a probe
   * words into the 8-problem set. Other tracks / focus nodes ignore
   * the flag silently. Absent for legacy clients — server treats
   * undefined as `false`.
   */
  isGraduationSession?: boolean
  /**
   * Lifetime-first-encounter list (ticket 86c9q9ben — AC9f). Browser
   * reads `Progress.lifetimeFirstEncounters` and ships it for the
   * word-song track. Server consults this to gate the
   * `session.end.opener` rewrite:
   *  - focus node ∉ list → first encounter; canon's tier-specific
   *    contrast / scaffolding line is delivered as-is.
   *  - focus node ∈ list → already encountered; server rewrites the
   *    opener to vanilla "You did it!" using a sibling canon's
   *    vanilla audio.
   * Always shipped (even empty) when the browser has a Progress doc
   * and the track is `word-song`. Empty array means greenfield —
   * fire scaffolding on every tier's first encounter. Absent for
   * legacy clients / math track.
   */
  lifetimeFirstEncounters?: readonly string[]
  /**
   * Leitner-box hint (ticket 86c9pwgc8 — M4 Leitner wiring). Browser
   * computes via `buildLeitnerSessionHint(progress.mathFactsLeitner)`
   * at session-start fetch time and ships only when length > 0. Each
   * entry names one fact + its current box (1..5). The planner uses
   * the hint to weight box-1 (least familiar) facts toward problems
   * 4-8 in an 8-problem session, leaving the gentle-ramp problems
   * 1-3 unaffected.
   *
   * Active for math today (no Leitner box on the literacy track in
   * v1). Absent for legacy clients — server treats undefined as "no
   * hint" and the planner picks freely.
   */
  leitner?: LeitnerHintItem[]
}

const VALID_TRACKS: readonly PlannerTrack[] = ['math', 'word-song']

/**
 * Extract the track/level/childName triple if the payload carries one,
 * and the optional `progress` sub-block if present.
 *
 * Returns null if any required field is missing or wrongly typed — the
 * handler falls through to the legacy stub path in that case (no
 * breaking change for callers that still pass `{ plan }`).
 *
 * Sanity: childName is also bounded — anything longer than 64 chars is
 * suspicious enough to reject (real first names don't go that long; an
 * over-long value is most likely a prompt-injection attempt or a bug).
 * Level is restricted to 1-9 since today only level 1 is implemented and
 * the prompt is forward-compatible up to 9.
 *
 * The `progress` sub-block (M2 — ticket 86c9kmwba) is OPTIONAL. If
 * present, we extract `focusNode` (string) and `recentSuccessRate`
 * (number 0..1, or null/missing). Malformed sub-fields are silently
 * dropped rather than rejecting the whole request — a bad `progress`
 * block should not cripple a session start; the planner falls back to
 * the default focus node and reports "no recent score" to Haiku.
 *
 * Why-silent on malformed `progress`:
 *   - The browser's selector is the source of truth for these fields;
 *     if a future bug ships a malformed value, we'd rather degrade
 *     gracefully than 4xx the iPad mid-session.
 *   - The planner-side validation in `_planner.ts` still hard-rejects
 *     an unknown-but-typed `focusNode` (cross-track, made-up node), so
 *     coordinated attacks still surface as 4xx.
 */
function extractTrackPayload(payload: unknown): TrackPayload | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>
  const track = p.track
  const level = p.level
  const childName = p.childName
  if (
    typeof track !== 'string' ||
    !VALID_TRACKS.includes(track as PlannerTrack)
  )
    return null
  if (
    typeof level !== 'number' ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > 9
  )
    return null
  if (
    typeof childName !== 'string' ||
    childName.length === 0 ||
    childName.length > 64
  )
    return null

  const out: TrackPayload = {
    track: track as PlannerTrack,
    level,
    childName,
  }

  // Optional progress sub-block. Soft-validate.
  const progress = p.progress
  if (
    progress !== undefined &&
    progress !== null &&
    typeof progress === 'object'
  ) {
    const pr = progress as Record<string, unknown>
    if (
      typeof pr.focusNode === 'string' &&
      pr.focusNode.length > 0 &&
      pr.focusNode.length <= 64
    ) {
      out.focusNode = pr.focusNode
    }
    // recentSuccessRate may be:
    //  - a finite number in [0, 1]  → forwarded
    //  - null                       → forwarded (planner-side: "no data")
    //  - missing                    → omitted (planner-side: "no data")
    //  - anything else              → silently dropped
    if (pr.recentSuccessRate === null) {
      out.recentSuccessRate = null
    } else if (
      typeof pr.recentSuccessRate === 'number' &&
      Number.isFinite(pr.recentSuccessRate) &&
      pr.recentSuccessRate >= 0 &&
      pr.recentSuccessRate <= 1
    ) {
      out.recentSuccessRate = pr.recentSuccessRate
    }
    // isGraduationSession (ticket 86c9m3aec): boolean only.
    // Anything else silently dropped (same posture as the other
    // optional progress fields). The planner internally ignores the
    // flag for non-cvc-words focus / non-word-song tracks, so a
    // misrouted true is harmless beyond skipping a canon hit.
    if (typeof pr.isGraduationSession === 'boolean') {
      out.isGraduationSession = pr.isGraduationSession
    }
    // lifetimeFirstEncounters (ticket 86c9q9ben — AC9f): array of
    // string SkillNode ids. Soft-validate per-item: each must be a
    // non-empty string ≤64 chars. Reject the whole array on any
    // malformed item to avoid partial-list ambiguity (would the
    // gate fire or not? — the safe interpretation depends on the
    // pre-malformed state, which we don't have). Drop silently on
    // non-array. Server-side gate ignores the list entirely for
    // non-word-song tracks, so a misrouted list is harmless.
    if (Array.isArray(pr.lifetimeFirstEncounters)) {
      const validated: string[] = []
      let allValid = true
      for (const node of pr.lifetimeFirstEncounters) {
        if (typeof node !== 'string' || node.length === 0 || node.length > 64) {
          allValid = false
          break
        }
        validated.push(node)
      }
      if (allValid) {
        out.lifetimeFirstEncounters = validated
      }
    }
    // leitner (ticket 86c9pwgc8): array of {a, b, op, box}.
    // Soft-validate shape per item; reject the whole array if any item
    // is malformed (the alternative — partial drop — would silently
    // skew the priority list). Cap at LEITNER_MAX_ITEMS to bound payload.
    if (Array.isArray(pr.leitner)) {
      const valid = parseLeitnerHint(pr.leitner)
      if (valid !== null && valid.length > 0) {
        out.leitner = valid
      }
    }
  }

  return out
}

/**
 * Parse and validate the wire-shape Leitner hint. Returns the parsed
 * array on success (capped at `LEITNER_MAX_ITEMS`) or null on any
 * shape error in any item. Caller drops the whole field on null —
 * partial validity would silently skew the priority list and the
 * cost surface (canon bypass) is bounded either way.
 */
const LEITNER_MAX_ITEMS = 60
const VALID_OPS: ReadonlySet<string> = new Set(['+', '-', '*'])
function parseLeitnerHint(raw: unknown[]): LeitnerHintItem[] | null {
  if (raw.length > LEITNER_MAX_ITEMS) return null
  const out: LeitnerHintItem[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null
    const r = item as Record<string, unknown>
    const a = r.a
    const b = r.b
    const op = r.op
    const box = r.box
    if (
      typeof a !== 'number' ||
      !Number.isInteger(a) ||
      a < 0 ||
      a > 99 ||
      typeof b !== 'number' ||
      !Number.isInteger(b) ||
      b < 0 ||
      b > 99 ||
      typeof op !== 'string' ||
      !VALID_OPS.has(op) ||
      typeof box !== 'number' ||
      !Number.isInteger(box) ||
      box < 1 ||
      box > 5
    ) {
      return null
    }
    out.push({ a, b, op: op as '+' | '-' | '*', box: box as 1 | 2 | 3 | 4 | 5 })
  }
  return out
}

/**
 * Module-singleton rate limiter for session-start. Per-IP, in-memory.
 * Lives at module scope (not per-request) so that warm Vercel containers
 * accumulate state across invocations — see _rateLimit.ts header for the
 * limitation discussion (cold starts reset the bucket, multi-instance
 * deployments multiply the effective rate).
 *
 * Tunables: 6 requests / 60 seconds. Calibrated for the real "kid spams
 * F5 / brother runs the iPad in a loop" cases without inconveniencing the
 * legitimate "Marian started a session, was disrupted, restarted" case.
 */
const sessionStartLimiter: RateLimiter = createRateLimiter({
  limit: 6,
  windowMs: 60_000,
})

/**
 * Module-singleton response cache for track-based session-start (added
 * ticket 86c9kjdh2). 5-minute TTL matches Vercel's warm-container retention
 * window; cold containers reset the cache cleanly. Keyed on the
 * `(track, level, childName)` triple — see buildSessionCacheKey.
 *
 * Trade-off: a child replaying within the TTL gets the same problems
 * and chatter. For QA smokes that is desirable (deterministic). For
 * real session continuation it preserves continuity. If we ever want
 * mid-day randomisation, that's a planner-side concern, not a cache
 * concern.
 */
const sessionStartCache: SessionCache = createSessionCache({
  ttlMs: 5 * 60_000,
})

/** Best-effort source-IP extraction. Vercel sets `x-forwarded-for`. We
 *  fall back to `x-real-ip` and finally to a fixed string — a fixed
 *  fallback means all unidentifiable callers share one bucket, which is
 *  conservative (over-throttles) but safe. */
function extractSourceIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    // X-F-F can be a comma-separated chain; the leftmost is the original
    // client per the standard. Vercel adds its own proxy address last.
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

/** Build a real Anthropic SDK client wrapped in the planner's narrowed
 *  interface. Kept as a factory so tests can inject a stub via the
 *  exported handler-level seam below. */
function buildAnthropicClient(): PlannerAnthropicClient {
  // Anthropic SDK reads ANTHROPIC_API_KEY from env automatically; we
  // already presence-checked it above the planner call.
  const sdk = new Anthropic()
  return {
    messages: {
      create: async (args) => {
        const message = await sdk.messages.create({
          model: args.model,
          max_tokens: args.max_tokens,
          system: args.system,
          messages: args.messages,
        })
        // Narrow the SDK's typed content blocks down to what the planner's
        // PlannerCreateResponse interface promises (just `type` + optional
        // `text`). Unknown-type blocks pass through with no `text` field,
        // and the planner's `extractText` skips them.
        return {
          content: message.content.map((block) =>
            block.type === 'text'
              ? { type: 'text', text: block.text }
              : { type: block.type },
          ),
        }
      },
    },
  }
}

/** Handler-level seams. Tests use these to inject a mock SDK client and a
 *  pinned clock without monkey-patching internal state. Exported only for
 *  the test file in the same module folder. */
export interface HandlerOverrides {
  /** Override the Anthropic SDK adapter. Defaults to a real
   *  `@anthropic-ai/sdk` client. */
  anthropicClient?: PlannerAnthropicClient
  /** Override the rate limiter. Defaults to the module-singleton. */
  rateLimiter?: RateLimiter
  /** Override the response cache. Defaults to the module-singleton. */
  sessionCache?: SessionCache
  /** Override the clock for rate-limit windowing. Defaults to Date.now(). */
  now?: () => number
  /** Override the canon-read function. Defaults to the file-backed
   *  `getCanonEntry` from `_canon.ts`. Tests inject a stub so they can
   *  drive hit/miss without touching the filesystem. Added ticket
   *  86c9kwhbc (D — pre-baked session canon). */
  getCanonEntry?: (key: {
    track: PlannerTrack
    level: number
    focusNode: string
  }) => Awaited<ReturnType<typeof getCanonEntry>>
}

/** Default focus node when the caller doesn't supply one. Mirrors the
 *  same default the planner uses internally so canon lookups and live
 *  planner calls converge on the same key. Duplicated here (not
 *  imported) because the planner-side default is private to that
 *  module; if it ever changes, the planner test suite catches the
 *  drift on its prompt and this constant gets a paired edit. */
function defaultFocusNodeForTrack(track: PlannerTrack): string {
  return track === 'math' ? 'add-to-10' : 'blending-cv'
}

/**
 * The actual request handler. Exported as a named symbol so tests can
 * import it directly; the Vercel entrypoint is the `default` export
 * below, which wraps this in a `{ fetch }` object so Vercel routes the
 * Web `Request`/`Response` codepath (see top-of-file HISTORY).
 *
 * @param overrides Test seams. In production, omit — the function uses
 *   the module-singleton rate limiter and a real Anthropic SDK client.
 */
export async function handler(
  request: Request,
  overrides: HandlerOverrides = {},
): Promise<Response> {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  const limiter = overrides.rateLimiter ?? sessionStartLimiter
  const cache = overrides.sessionCache ?? sessionStartCache
  const now = overrides.now ?? Date.now

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (request.method !== 'POST') {
    headers.set('Allow', 'POST, OPTIONS')
    return jsonResponse({ error: 'method-not-allowed' }, 405, headers)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse(
      { error: 'invalid-json', message: 'Body must be valid JSON.' },
      400,
      headers,
    )
  }

  if (!isClaudeRequest(body)) {
    return jsonResponse(
      {
        error: 'invalid-body',
        message:
          'Body must be { kind: "session-start" | "stumble-explanation" | "session-end", payload: unknown }.',
      },
      400,
      headers,
    )
  }

  // Env check. Note: presence-only — never read or echo the value here.
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'config-missing' }, 500, headers)
  }

  // session-start branches:
  //   1. payload.plan present  → render TTS for the supplied plan
  //      (legacy v1 client path; preserved unchanged for backward compat).
  //   2. payload.track present → call Haiku to generate a plan, then
  //      render TTS (added ticket 86c9jdh39 — replaces the prior stub
  //      that produced silence on Math + WordSong in production).
  //   3. neither present       → legacy stub (200 with stub: true).
  //
  // Order matters: plan-attached requests bypass the rate limiter
  // entirely (no Claude call, just TTS — same cost surface as v1). Only
  // the new track-based path goes through the limiter, since that's the
  // one that costs Anthropic credits.
  if (body.kind === 'session-start') {
    const plan = extractPlan(body.payload)
    if (plan !== null) {
      try {
        const rendered = await renderSessionAudio(plan)
        return jsonResponse(rendered, 200, headers)
      } catch (err) {
        // Surface the failure in `vercel logs` so future tts-failed shapes
        // can be root-caused from stack traces instead of from the
        // response message alone (see ticket 86c9gwxah; the 86c9gwvn0 P0
        // investigation had to reason from message shape because this
        // catch path was silent). Log message + stack ONLY — never the
        // request body, payload, or any provider headers; the underlying
        // _tts module is responsible for never embedding the Azure key
        // in the error it throws, and we deliberately don't widen the
        // log surface here in case that contract ever slips.
        const message = err instanceof Error ? err.message : String(err)
        const stack = err instanceof Error ? err.stack : undefined
        console.error('[api/claude] tts-failed', { message, stack })

        // Don't leak provider internals — `tts-failed` is the stable
        // code; the browser falls back to a degraded session per
        // "Claude is the brain, not the mouth" / graceful-degradation
        // policy in CLAUDE.md.
        return jsonResponse(
          {
            error: 'tts-failed',
            message:
              err instanceof Error && err.message
                ? `tts pipeline failed: ${err.message}`
                : 'tts pipeline failed',
          },
          502,
          headers,
        )
      }
    }

    // Track-based branch: try the pre-baked canon first; fall through
    // to Haiku + Azure on a miss.
    const trackPayload = extractTrackPayload(body.payload)
    if (trackPayload !== null) {
      // Canon hit (ticket 86c9kwhbc, D — pre-baked session canon). We
      // pre-render every active (track, level, focusNode) combo at
      // build time as a static blob and ship it inside the function
      // bundle. A canon hit short-circuits both the Anthropic call and
      // the Azure synth — `<500ms cold-start` is the contract.
      //
      // childName is NOT part of the canon key. Per AC #3 of the
      // ticket, "Marian" is baked directly into the utterance text;
      // future multi-child support is a regen + caching strategy
      // change, not an API surface change.
      //
      // Order matters: canon-first runs BEFORE the rate limiter and
      // BEFORE the in-memory response cache. A canon hit is free —
      // no upstream cost — so neither gate applies. A canon miss
      // continues to the existing live pipeline, which still goes
      // through the limiter + 5-min TTL cache.
      //
      // Graduation-session bypass (ticket 86c9m3aec): a graduation
      // run needs novel-pool words mixed in, which the canon JSON
      // does NOT carry. Skip canon (and the in-memory cache for the
      // same reason) when the flag is set so the live planner runs
      // and emits the directive-aware plan.
      //
      // Leitner-hint bypass (ticket 86c9pwgc8 — M4): same posture.
      // Canon is keyed on (track, level, focusNode) only; serving a
      // cached non-Leitner-aware plan defeats the M4 contract that
      // the planner weights box-1 facts toward problems 4-8. The
      // hint only ships when the box has at least one item, so the
      // empty-box first-session case still hits canon (free).
      const canonResolver = overrides.getCanonEntry ?? getCanonEntry
      const hasLeitnerHint =
        trackPayload.leitner !== undefined && trackPayload.leitner.length > 0
      // Effective focus node for downstream gating. Same default-
      // resolution shape `effectiveFocusNode` uses inside the
      // planner; pulled out here so the first-encounter gate gets
      // the same answer the canon resolver does.
      const effectiveFocus =
        trackPayload.focusNode ?? defaultFocusNodeForTrack(trackPayload.track)
      if (trackPayload.isGraduationSession !== true && !hasLeitnerHint) {
        const canonHit = canonResolver({
          track: trackPayload.track,
          level: trackPayload.level,
          focusNode: effectiveFocus,
        })
        if (canonHit !== null) {
          // 86c9q9ben (AC9f): rewrite session.end.opener to vanilla
          // when the child has already encountered this focus node.
          // The gate is a no-op for non-gated nodes / first-encounter
          // sessions / missing vanilla source — pass-through.
          const gated = applyFirstEncounterGate(canonHit, {
            focusNode: effectiveFocus,
            lifetimeFirstEncounters: trackPayload.lifetimeFirstEncounters,
          })
          return jsonResponse(gated, 200, headers)
        }
      }

      // Cache check (added ticket 86c9kjdh2). Identical (track, level,
      // childName, focusNode) requests within the TTL serve from the
      // in-memory module cache — zero Azure calls and zero Anthropic
      // calls. M2 (ticket 86c9kmwba): focusNode is part of the key so
      // a {focusNode: 'add-to-10'} hit doesn't get served to a
      // {focusNode: 'add-to-20'} request. recentSuccessRate is NOT in
      // the key (continuously variable, would shred the hit rate).
      // The cache lives outside the rate-limit gate because a hit is
      // free (no upstream cost). See _sessionCache.ts for trade-offs.
      //
      // After D (canon-first), this in-memory cache only catches
      // canon-misses that recur within a function-instance lifetime
      // — e.g. a future-Marian focus node not yet in canon, or a
      // staging deploy where canon hasn't been regenerated yet.
      const cacheKey = buildSessionCacheKey({
        track: trackPayload.track,
        level: trackPayload.level,
        childName: trackPayload.childName,
        focusNode: trackPayload.focusNode,
      })
      // Graduation-session bypass (ticket 86c9m3aec): same reasoning
      // as the canon bypass above — graduation runs need their own
      // fresh planner output. Re-using a cached non-graduation
      // response on a graduation request would feed a canonical-only
      // plan into the dual-gate pipeline, defeating the probe.
      //
      // Leitner-hint bypass (ticket 86c9pwgc8 — M4): same posture.
      // The cache key doesn't include the Leitner state, so a cached
      // non-Leitner plan would win on a Leitner request, defeating
      // the box-1 weighting contract. Bypassing here means a Leitner-
      // active session always pays one Anthropic + Azure round-trip;
      // empty-box sessions still hit the cache.
      if (trackPayload.isGraduationSession !== true && !hasLeitnerHint) {
        const cached = cache.get(cacheKey, now())
        if (cached !== null) {
          // 86c9q9ben (AC9f): same gate as the canon-hit path. The
          // in-memory cache stores the pre-gate response so a single
          // cached entry can serve both first-encounter and
          // already-encountered requests correctly without
          // re-fetching from the planner.
          const gated = applyFirstEncounterGate(cached, {
            focusNode: effectiveFocus,
            lifetimeFirstEncounters: trackPayload.lifetimeFirstEncounters,
          })
          return jsonResponse(gated, 200, headers)
        }
      }

      // Canon-miss log (single line per miss). Lets us monitor coverage
      // — if production shows misses for combos we expected to bake,
      // the generator script needs a re-run or the combo set needs
      // extending. Logged BEFORE the rate-limit gate so we can tell
      // "miss + throttled" apart from "miss + served".
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[api/claude] canon-miss', {
          track: trackPayload.track,
          level: trackPayload.level,
          focusNode:
            trackPayload.focusNode ??
            defaultFocusNodeForTrack(trackPayload.track),
        })
      }

      // Per-IP rate limit. We honour the limiter BEFORE calling Anthropic
      // so a leaked share-link in a tight loop can't run up a bill.
      const ip = extractSourceIp(request)
      const result = limiter.check(ip, now())
      if (!result.allowed) {
        if (result.retryAfterSec !== undefined) {
          headers.set('Retry-After', String(result.retryAfterSec))
        }
        return jsonResponse(
          {
            error: 'rate-limited',
            message: 'too many session-start requests; please slow down',
          },
          429,
          headers,
        )
      }

      const client = overrides.anthropicClient ?? buildAnthropicClient()

      // Combined planner + TTS. Pre-86c9kwhbc this was two awaits in
      // a row (`generateSessionPlan` then `renderSessionAudio`); the
      // canon-generator script wanted the same composition without the
      // HTTP scaffolding so we extracted it into a single callable
      // (`generateSessionStartResponse`). The error-mapping below is
      // unchanged from the pre-D code path.
      try {
        const rendered = await generateSessionStartResponse({
          client,
          track: trackPayload.track,
          level: trackPayload.level,
          childName: trackPayload.childName,
          // M2 (ticket 86c9kmwba). When the browser provided a progress
          // block, route focusNode + recentSuccessRate into the planner
          // user message so Haiku targets the right curriculum slice and
          // tunes easier-vs-harder mix. Either field may be undefined —
          // the planner has its own defaults for that case.
          focusNode: trackPayload.focusNode,
          recentSuccessRate: trackPayload.recentSuccessRate,
          // Graduation-session flag (ticket 86c9m3aec). When true, the
          // planner mixes 2–3 novel short-a probe words into the
          // 8-problem set. Server-side filtering of which focus nodes
          // honour the flag lives in the planner's
          // `buildUserMessage` — passing the raw flag through is safe.
          isGraduationSession: trackPayload.isGraduationSession,
          // Leitner hint (ticket 86c9pwgc8 — M4). When non-empty, the
          // planner adds a directive to the user message so Haiku
          // weights box-1 facts toward problems 4-8. Server-side
          // filtering — only math + add-to-10 today — lives in
          // `buildUserMessage`; passing the raw array through is safe.
          leitner: trackPayload.leitner,
        })
        // Cache the rendered response under the track payload key. Even
        // partial renders (some utterances soft-failed) are cacheable —
        // re-running the same key would just hit Azure again with the
        // same probability of failure, which is what the cache is here
        // to avoid. The browser's missing-utterance fallback is the same
        // either way.
        //
        // Graduation-session bypass (ticket 86c9m3aec): do NOT cache a
        // graduation response under the standard key — the next regular
        // request for the same (track, level, focusNode) tuple would
        // serve a graduation plan, leaking novel-pool words into a
        // non-graduation session. The browser's session-end logic would
        // then mis-classify and the dual-gate accounting would shred.
        //
        // Leitner-hint bypass (ticket 86c9pwgc8): same — caching a
        // Leitner-weighted plan under the standard key would leak it
        // into a regular (or different-Leitner-state) session and the
        // box-1-priority contract would silently rotate.
        if (trackPayload.isGraduationSession !== true && !hasLeitnerHint) {
          // Cache the PRE-GATE response. The in-memory cache stores
          // the canon-shaped output (with the tier-specific opener
          // intact for first-encounter); the gate runs on the
          // serve-out path so a single cache entry serves both
          // first-encounter and already-encountered requests.
          cache.set(cacheKey, rendered, now())
        }
        // 86c9q9ben (AC9f): rewrite session.end.opener to vanilla
        // when the child has already encountered this focus node.
        const gated = applyFirstEncounterGate(rendered, {
          focusNode: effectiveFocus,
          lifetimeFirstEncounters: trackPayload.lifetimeFirstEncounters,
        })
        return jsonResponse(gated, 200, headers)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const stack = err instanceof Error ? err.stack : undefined
        // Distinguish planner errors from TTS errors in logs so the QA
        // sweep can attribute correctly. PlannerError comes from
        // `generateSessionPlan`; everything else is a render-pipeline
        // surprise (since `renderSessionAudio` swallows per-utterance
        // failures and only throws on bug-class issues like a base64
        // encoder bug).
        if (err instanceof PlannerError) {
          console.error('[api/claude] planner-failed', { message, stack })
          if (err.code === 'config-missing') {
            return jsonResponse({ error: 'config-missing' }, 500, headers)
          }
          return jsonResponse(
            {
              error: 'planner-failed',
              message: 'session plan generation failed',
            },
            502,
            headers,
          )
        }
        console.error('[api/claude] tts-failed', { message, stack })
        return jsonResponse(
          {
            error: 'tts-failed',
            message:
              err instanceof Error && err.message
                ? `tts pipeline failed: ${err.message}`
                : 'tts pipeline failed',
          },
          502,
          headers,
        )
      }
    }
  }

  // Stub success path (unchanged from the prior contract). Stumble-
  // explanation and session-end are out of scope for ticket 86c9jdh39
  // and remain stubbed; session-start with neither plan nor track also
  // returns the stub for backward compat.
  return jsonResponse(
    {
      ok: true,
      kind: body.kind,
      stub: true,
      note: 'Claude API call not yet wired — see follow-up tickets',
    },
    200,
    headers,
  )
}

/**
 * Vercel entrypoint. The `fetch` property — NOT a bare default function —
 * is what makes `@vercel/node` invoke `handler` with Web standard
 * `Request`/`Response` instead of the legacy `(IncomingMessage,
 * ServerResponse)` signature. See top-of-file HISTORY (round 2 fix) for
 * the full reasoning and the upstream source link.
 */
export default { fetch: handler }
