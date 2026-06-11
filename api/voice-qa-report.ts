// /api/voice-qa-report — Vercel Function. Receives the voice-QA verdict
// batch submitted from public/voice-qa.html (VQA.1) and files ONE
// structured GitHub issue (label `voice-qa`) in TSandvaer/MarianLearning
// for orchestrator pickup.
//
// VQA milestone — ticket 86ca7er73.
//
// WHY a server function (not a browser → GitHub call)
// ---------------------------------------------------
// The GitHub fine-grained PAT must NEVER reach the browser bundle, same
// posture as ANTHROPIC_API_KEY for /api/claude. The page POSTs a verdict
// batch + the shared secret here; this function validates the secret,
// then talks to the GitHub REST API with GITHUB_TOKEN read from the
// Vercel env. The token is read here only and is never echoed, logged,
// or returned.
//
// ABSOLUTE RULE (mirrors /api/claude): do NOT add
//   export const config = { runtime: 'nodejs' }
// to this file. That magic-string shape is the Next.js middleware
// convention, NOT recognised for /api/*.ts on Vercel — it 500'd every
// request on PR #34. The function runs on Vercel's Node runtime by
// default. See .claude/docs/planner-and-canon.md § "Runtime constraint".
//
// Runtime: Web-standard fetch handler. The `default` export is
// `{ fetch: handler }` — NOT a bare async function — so `@vercel/node`
// routes the Web `Request`/`Response` codepath (same shape as
// api/claude.ts). `timingSafeEqual` / `Buffer` / `globalThis.fetch` /
// `process.env` all require the Node runtime; `assertNodeRuntime()`
// throws loudly at module load if the function is ever flipped to Edge.

import { timingSafeEqual } from 'node:crypto'

import { createRateLimiter, type RateLimiter } from './_rateLimit.js'

/**
 * Cold-start runtime assertion. Throws at module load if not on Node.
 * Mirrors api/claude.ts:assertNodeRuntime — the GitHub REST call uses
 * `globalThis.fetch`, the secret compare uses `node:crypto`, and config
 * is read from `process.env`, all of which require the Node runtime.
 *
 * Exported for unit-test coverage; the side effect (the throw) is what
 * the regression test pins.
 */
export function assertNodeRuntime(): void {
  const nodeVersion = (
    globalThis as { process?: { versions?: { node?: string } } }
  ).process?.versions?.node
  if (typeof nodeVersion !== 'string') {
    throw new Error(
      '/api/voice-qa-report must run on the Vercel Node runtime — ' +
        '`node:crypto` (constant-time secret compare), `globalThis.fetch` ' +
        '(GitHub REST), and `process.env` all require Node. Do not move this ' +
        'function to Edge.',
    )
  }
}

assertNodeRuntime()

// ---------------------------------------------------------------------------
// Wire shapes (shared with VQA.1 page + VQA.3 e2e — names are the contract)
// ---------------------------------------------------------------------------

/** A single voice-QA verdict from the audition page. */
export interface VoiceQaVerdict {
  /** Stable id of the audited canon cell (e.g. utterance id + voice). */
  itemId: string
  /** sha256 of the audio bytes audited — ties the verdict to exact bytes. */
  audioHash: string
  verdict: 'pass' | 'fail'
  /** Only meaningful on a `fail`; the page may omit it. */
  category?: VoiceQaCategory
  /** Optional free-text note (human reviewer's words). */
  note?: string
  /** ISO timestamp the verdict was decided client-side. */
  decidedAt: string
}

export type VoiceQaCategory =
  | 'mispronounced'
  | 'wrong-speed'
  | 'clipped'
  | 'volume'
  | 'wrong-text'
  | 'other'

/** The POST body the page submits. */
export interface VoiceQaReportRequest {
  secret: string
  /** ISO timestamp the batch was submitted. */
  submittedAt: string
  verdicts: VoiceQaVerdict[]
}

/** Success envelope. */
export interface VoiceQaReportSuccess {
  ok: true
  issueUrl: string
}

/** Error envelope. */
export interface VoiceQaReportError {
  ok: false
  error: string
}

const VALID_CATEGORIES: ReadonlySet<string> = new Set<VoiceQaCategory>([
  'mispronounced',
  'wrong-speed',
  'clipped',
  'volume',
  'wrong-text',
  'other',
])

/** Stable category display order for the grouped fail summary. `other`
 *  always sorts last so it doesn't bury named categories. */
const CATEGORY_ORDER: readonly VoiceQaCategory[] = [
  'mispronounced',
  'wrong-speed',
  'clipped',
  'volume',
  'wrong-text',
  'other',
]

/** Caps. A leaked-link client could overshoot; bound the blast radius so
 *  the GitHub issue body stays sane and the function can't be used as a
 *  spam amplifier. */
const MAX_VERDICTS = 500
const MAX_STRING_LEN = 2000

const GITHUB_REPO = 'TSandvaer/MarianLearning'
const GITHUB_ISSUE_LABEL = 'voice-qa'
const GITHUB_API_VERSION = '2022-11-28'

// ---------------------------------------------------------------------------
// CORS + JSON helpers (mirror api/claude.ts shape)
// ---------------------------------------------------------------------------

/** Origins allowed to hit this function: local dev port + the Vercel
 *  deployment's own origin (VERCEL_URL, scheme-less) + comma-separated
 *  VOICE_QA_EXTRA_ORIGINS for any future preview/shared host. */
function buildAllowedOrigins(): readonly string[] {
  const origins = new Set<string>(['http://localhost:5173'])
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) origins.add(`https://${vercelUrl}`)
  const extra = process.env.VOICE_QA_EXTRA_ORIGINS
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
  body: VoiceQaReportSuccess | VoiceQaReportError,
  status: number,
  baseHeaders: Headers,
): Response {
  const headers = new Headers(baseHeaders)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers })
}

// ---------------------------------------------------------------------------
// Secret compare — constant time
// ---------------------------------------------------------------------------

/**
 * Constant-time string equality. Returns false on any length mismatch
 * (timingSafeEqual throws on unequal-length buffers, so we compare
 * lengths first — but that length check is itself non-constant-time; the
 * value it leaks is only the secret's LENGTH, which is not the secret).
 * For equal-length inputs the byte comparison is constant-time.
 */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ---------------------------------------------------------------------------
// Body validation
// ---------------------------------------------------------------------------

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= MAX_STRING_LEN
}

/** Validate a single verdict item. Returns true only for a fully
 *  well-formed entry. `category` is required-and-validated only on a
 *  `fail`; a `pass` may omit it (and if present it must still be valid). */
function isVoiceQaVerdict(v: unknown): v is VoiceQaVerdict {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  if (!isNonEmptyString(r.itemId)) return false
  if (!isNonEmptyString(r.audioHash)) return false
  if (r.verdict !== 'pass' && r.verdict !== 'fail') return false
  if (!isNonEmptyString(r.decidedAt)) return false
  if (r.category !== undefined) {
    if (typeof r.category !== 'string' || !VALID_CATEGORIES.has(r.category)) {
      return false
    }
  }
  if (r.note !== undefined) {
    // note is optional; if present it must be a string within the cap
    // (empty note string is allowed — reviewer cleared the field).
    if (typeof r.note !== 'string' || r.note.length > MAX_STRING_LEN) {
      return false
    }
  }
  return true
}

/** Validate the full report body. Secret presence is checked separately
 *  (so a missing secret yields 401, not 400). */
export function isVoiceQaReportBody(
  v: unknown,
): v is Omit<VoiceQaReportRequest, 'secret'> & { secret: unknown } {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  if (!isNonEmptyString(r.submittedAt)) return false
  if (!Array.isArray(r.verdicts)) return false
  if (r.verdicts.length < 1 || r.verdicts.length > MAX_VERDICTS) return false
  for (const item of r.verdicts) {
    if (!isVoiceQaVerdict(item)) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Issue body construction
// ---------------------------------------------------------------------------

/** YYYY-MM-DD (UTC) from an ISO timestamp; falls back to today on a
 *  malformed input (the body guard already enforced a non-empty string,
 *  but Date may still reject it). */
function isoDateOnly(iso: string): string {
  const d = new Date(iso)
  const ms = d.getTime()
  const safe = Number.isNaN(ms) ? new Date() : d
  return safe.toISOString().slice(0, 10)
}

/** Escape a fail note for safe inline Markdown — collapse newlines so a
 *  multi-line note can't break the bullet list, and neutralise backticks
 *  that could prematurely close an inline code span. */
function sanitizeNoteForMarkdown(note: string): string {
  return note.replace(/\r?\n/g, ' ').replace(/`/g, "'").trim()
}

export interface BuiltIssue {
  title: string
  body: string
}

/**
 * Build the GitHub issue title + body from the report.
 *
 * Title:  Voice QA report — <YYYY-MM-DD> — <failCount> fails / <total> verdicts
 * Body:   human-readable fail summary grouped by category (notes + item ids),
 *         then the FULL report JSON in a fenced ```json block.
 */
export function buildIssue(report: VoiceQaReportRequest): BuiltIssue {
  const total = report.verdicts.length
  const fails = report.verdicts.filter((v) => v.verdict === 'fail')
  const failCount = fails.length
  const date = isoDateOnly(report.submittedAt)

  const title = `Voice QA report — ${date} — ${failCount} fails / ${total} verdicts`

  const lines: string[] = []
  lines.push(`**Submitted:** ${report.submittedAt}`)
  lines.push('')
  lines.push(
    `**Verdicts:** ${total} total — ${failCount} fail, ${total - failCount} pass`,
  )
  lines.push('')

  if (failCount === 0) {
    lines.push('No failures reported — all audited cells passed. 🎉')
  } else {
    lines.push('## Failures by category')
    lines.push('')

    // Group fails by category (undefined category → 'other').
    const byCategory = new Map<VoiceQaCategory, VoiceQaVerdict[]>()
    for (const f of fails) {
      const cat: VoiceQaCategory = f.category ?? 'other'
      const bucket = byCategory.get(cat)
      if (bucket) bucket.push(f)
      else byCategory.set(cat, [f])
    }

    for (const cat of CATEGORY_ORDER) {
      const bucket = byCategory.get(cat)
      if (!bucket || bucket.length === 0) continue
      lines.push(`### ${cat} (${bucket.length})`)
      for (const f of bucket) {
        const note = f.note ? sanitizeNoteForMarkdown(f.note) : ''
        const noteSuffix = note ? ` — ${note}` : ''
        lines.push(`- \`${f.itemId}\` (audio \`${f.audioHash}\`)${noteSuffix}`)
      }
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')
  lines.push('<details><summary>Full report JSON (machine-parseable)</summary>')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify(reportWithoutSecret(report), null, 2))
  lines.push('```')
  lines.push('')
  lines.push('</details>')

  return { title, body: lines.join('\n') }
}

/** Strip the secret before it ever lands in the issue body JSON. */
function reportWithoutSecret(
  report: VoiceQaReportRequest,
): Omit<VoiceQaReportRequest, 'secret'> {
  return { submittedAt: report.submittedAt, verdicts: report.verdicts }
}

// ---------------------------------------------------------------------------
// GitHub issue creation
// ---------------------------------------------------------------------------

/** Minimal fetch signature for dependency injection in tests. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
  },
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}>

/**
 * Create the GitHub issue. Returns the issue's `html_url`. Throws on a
 * non-2xx GitHub response (the handler maps that to a 502 — the request
 * was valid, the upstream failed). The GITHUB_TOKEN is sent in the
 * Authorization header only; it is never logged or returned.
 */
export async function createGithubIssue(
  issue: BuiltIssue,
  token: string,
  fetchImpl: FetchLike,
): Promise<string> {
  const res = await fetchImpl(
    `https://api.github.com/repos/${GITHUB_REPO}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'Content-Type': 'application/json',
        'User-Agent': 'marian-tutor-voice-qa/1.0 (+marian-learning.vercel.app)',
      },
      body: JSON.stringify({
        title: issue.title,
        body: issue.body,
        labels: [GITHUB_ISSUE_LABEL],
      }),
    },
  )

  if (!res.ok) {
    // Truncate the GitHub error body so an unexpected payload can't bloat
    // logs; never include the token (it's in the request header, not the
    // response).
    const hint = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(`github issue create failed: ${res.status} ${hint}`)
  }

  const parsed = (await res.json()) as { html_url?: unknown }
  if (typeof parsed.html_url !== 'string' || parsed.html_url.length === 0) {
    throw new Error('github issue create succeeded but returned no html_url')
  }
  return parsed.html_url
}

// ---------------------------------------------------------------------------
// Rate limiter — module singleton, per-IP, 5 submissions / hour
// ---------------------------------------------------------------------------

/**
 * Per-IP submission limiter. 5 submissions / hour. Reuses the
 * /api/claude sliding-window limiter (api/_rateLimit.ts). Lives at module
 * scope so warm Vercel containers accumulate state across invocations.
 * The threat model is "a leaked QA-page link gets spammed", not a
 * professional adversary — same posture as the session-start limiter.
 */
const VOICE_QA_LIMIT = 5
const VOICE_QA_WINDOW_MS = 60 * 60_000 // 1 hour
const reportLimiter: RateLimiter = createRateLimiter({
  limit: VOICE_QA_LIMIT,
  windowMs: VOICE_QA_WINDOW_MS,
})

/** Best-effort source-IP extraction (mirrors api/claude.ts). */
function extractSourceIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/** Test seams: inject a stub fetch, a pinned clock, and an isolated
 *  limiter so the suite never hits real GitHub and never shares the
 *  module-singleton bucket across tests. */
export interface HandlerOverrides {
  fetchImpl?: FetchLike
  rateLimiter?: RateLimiter
  now?: () => number
}

/**
 * The request handler. Exported as a named symbol so tests can import it
 * directly; the Vercel entrypoint is the `{ fetch: handler }` default
 * export below.
 *
 * Status contract (ticket 86ca7er73 vocabulary):
 *   200 { ok: true, issueUrl }   — issue filed
 *   400 { ok: false, error }     — malformed body
 *   401 { ok: false, error }     — bad / missing secret
 *   405 { ok: false, error }     — non-POST
 *   429 { ok: false, error }     — rate limited (Retry-After header set)
 *   503 { ok: false, error }     — missing env config
 *   502 { ok: false, error }     — GitHub upstream failure
 *
 * Never throws unhandled — the GitHub call is wrapped in try/catch.
 */
export async function handler(
  request: Request,
  overrides: HandlerOverrides = {},
): Promise<Response> {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  const limiter = overrides.rateLimiter ?? reportLimiter
  const now = overrides.now ?? Date.now
  const fetchImpl: FetchLike =
    overrides.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (request.method !== 'POST') {
    headers.set('Allow', 'POST, OPTIONS')
    return jsonResponse(
      { ok: false, error: 'method-not-allowed' },
      405,
      headers,
    )
  }

  // Env check FIRST — a missing token/secret is a deployment-config error,
  // not a client error. 503 makes that unambiguous in logs. Presence-only;
  // the values are never read into the response or logged.
  const githubToken = process.env.GITHUB_TOKEN
  const expectedSecret = process.env.VOICE_QA_SECRET
  if (!githubToken || !expectedSecret) {
    return jsonResponse(
      {
        ok: false,
        error:
          'server not configured for voice-qa reporting (missing GITHUB_TOKEN or VOICE_QA_SECRET)',
      },
      503,
      headers,
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse(
      { ok: false, error: 'body must be valid JSON' },
      400,
      headers,
    )
  }

  // Secret check BEFORE body-shape validation so an unauthenticated caller
  // learns nothing about the body contract. The secret must be a non-empty
  // string AND match the configured value (constant-time).
  const providedSecret =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).secret
      : undefined
  if (
    typeof providedSecret !== 'string' ||
    !secretsMatch(providedSecret, expectedSecret)
  ) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401, headers)
  }

  if (!isVoiceQaReportBody(body)) {
    return jsonResponse(
      {
        ok: false,
        error:
          'malformed body: expected { secret, submittedAt: ISO, verdicts: [{ itemId, audioHash, verdict, category?, note?, decidedAt }] }',
      },
      400,
      headers,
    )
  }

  // Rate limit AFTER auth — only authenticated callers consume the bucket,
  // so a brute-force secret guesser can't exhaust the legitimate reviewer's
  // quota.
  const ip = extractSourceIp(request)
  const limit = limiter.check(ip, now())
  if (!limit.allowed) {
    if (limit.retryAfterSec !== undefined) {
      headers.set('Retry-After', String(limit.retryAfterSec))
    }
    return jsonResponse(
      { ok: false, error: 'too many voice-qa submissions; please slow down' },
      429,
      headers,
    )
  }

  // body is now a validated report with a verified secret.
  const report: VoiceQaReportRequest = {
    secret: providedSecret,
    submittedAt: body.submittedAt,
    verdicts: body.verdicts,
  }

  const issue = buildIssue(report)

  try {
    const issueUrl = await createGithubIssue(issue, githubToken, fetchImpl)
    return jsonResponse({ ok: true, issueUrl }, 200, headers)
  } catch (err) {
    // Surface in `vercel logs` for root-cause; message only, never the
    // token or the full request body.
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/voice-qa-report] github-failed', { message })
    return jsonResponse(
      { ok: false, error: 'failed to create GitHub issue' },
      502,
      headers,
    )
  }
}

/**
 * Vercel entrypoint. The `fetch` property — NOT a bare default function —
 * is what makes `@vercel/node` invoke `handler` with Web standard
 * `Request`/`Response`. See top-of-file ABSOLUTE RULE + api/claude.ts.
 */
export default { fetch: handler }
