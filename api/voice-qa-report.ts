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
 *  the function can't be used as a spam amplifier — but the cap must clear
 *  the contract's full baseline. The audition page submits ALL verdicts
 *  (passes included) = 654 today (632 canon + 22 greet/hub); 2000 gives
 *  bounded headroom for content growth without inviting abuse. */
const MAX_VERDICTS = 2000
const MAX_STRING_LEN = 2000

const GITHUB_REPO = 'TSandvaer/MarianLearning'
const GITHUB_ISSUE_LABEL = 'voice-qa'
const GITHUB_API_VERSION = '2022-11-28'

/** GitHub's hard limit on an issue/comment body is 65,536 chars; a 422
 *  there becomes a 502 here with the whole batch lost. We keep every body
 *  we POST strictly under a SAFE budget below that ceiling — the gap
 *  absorbs the fenced-block wrapper + the `part i/N` label + a margin so we
 *  never tiptoe the absolute limit. */
const GITHUB_BODY_HARD_LIMIT = 65_536
/** Budget for a single body we author (issue body or one chunk comment).
 *  Comfortably under the hard limit; the headroom covers markdown wrapper
 *  text (fences, labels, summary prose) added around the JSON payload. */
const SAFE_BODY_BUDGET = 60_000

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

/** True iff `v` is a non-empty, length-capped string that ALSO parses as a
 *  real date. `submittedAt` drives the issue title's date; a value Date
 *  can't parse must be rejected up front (400) rather than silently falling
 *  back to "today" in the title while the body echoes the raw string. */
function isParseableTimestamp(v: unknown): v is string {
  return isNonEmptyString(v) && Number.isFinite(Date.parse(v))
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
  if (!isParseableTimestamp(r.submittedAt)) return false
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
  /**
   * Follow-up comment bodies carrying the FULL report JSON (passes
   * included), split so every one stays under the GitHub body limit. Empty
   * when the full JSON fits inline in the issue body (small batches). When
   * non-empty, the issue body says so and each comment is one fenced json
   * block labelled `part i/N` for the orchestrator to reassemble in order.
   */
  comments: string[]
}

/**
 * Build the GitHub issue title + body + (optional) follow-up comment
 * bodies from the report.
 *
 * Title:  Voice QA report — <YYYY-MM-DD> — <failCount> fails / <total> verdicts
 * Body:   human-readable fail summary grouped by category (notes + item ids)
 *         + the FAILS-ONLY JSON in a fenced block. The fails-only payload is
 *         bounded by MAX_VERDICTS but in practice tiny (most cells pass), so
 *         the issue body comfortably clears the GitHub limit. The FULL report
 *         JSON (passes included) is too large to inline at full baseline, so
 *         it ships in `comments` (see below).
 * Comments: when the full report JSON exceeds SAFE_BODY_BUDGET, it is split
 *         across N follow-up comments, each a single fenced ```json block
 *         labelled `<!-- voice-qa-report part i/N -->` so the orchestrator
 *         can concatenate the payloads back into the full report. Each
 *         comment body is guaranteed < GITHUB_BODY_HARD_LIMIT.
 */
export function buildIssue(report: VoiceQaReportRequest): BuiltIssue {
  const total = report.verdicts.length
  const fails = report.verdicts.filter((v) => v.verdict === 'fail')
  const failCount = fails.length
  const date = isoDateOnly(report.submittedAt)

  const title = `Voice QA report — ${date} — ${failCount} fails / ${total} verdicts`

  // The full machine-parseable payload (passes included), secret stripped.
  const fullJson = JSON.stringify(reportWithoutSecret(report), null, 2)
  // The fails-only payload that goes inline in the issue body. Bounded by
  // MAX_VERDICTS but small in practice; the abuse cap on note/string length
  // keeps even an all-fail batch under the body budget.
  const failsOnlyJson = JSON.stringify(
    { submittedAt: report.submittedAt, fails },
    null,
    2,
  )

  // Decide whether the full JSON fits inline. If it does, we still keep the
  // body within budget by embedding it directly; if not, it ships as chunked
  // comments and the body carries only the fails-only payload + a pointer.
  const inlineFull = fitsInline(date, failCount, total, fullJson)

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

  let comments: string[] = []
  if (inlineFull) {
    // Small batch: the full report fits in the issue body. No comments.
    // Fence adapts to any backtick run inside the JSON (notes can contain
    // backticks) so the block never closes prematurely.
    const fence = '`'.repeat(Math.max(3, longestBacktickRun(fullJson) + 1))
    lines.push(
      '<details><summary>Full report JSON (machine-parseable)</summary>',
    )
    lines.push('')
    lines.push(`${fence}json`)
    lines.push(fullJson)
    lines.push(fence)
    lines.push('')
    lines.push('</details>')
  } else {
    // Full baseline: the full report is too large to inline. Body carries
    // the fails-only JSON; the full report is split across follow-up
    // comments below.
    comments = buildReportComments(fullJson)
    lines.push(
      `_Full report JSON (incl. passes) is too large for the issue body; ` +
        `it is posted across **${comments.length}** follow-up comment(s) ` +
        `labelled \`part i/N\` for reassembly._`,
    )
    lines.push('')
    lines.push(
      '<details><summary>Fails-only JSON (machine-parseable)</summary>',
    )
    lines.push('')
    const failsFence = '`'.repeat(
      Math.max(3, longestBacktickRun(failsOnlyJson) + 1),
    )
    lines.push(`${failsFence}json`)
    lines.push(failsOnlyJson)
    lines.push(failsFence)
    lines.push('')
    lines.push('</details>')
  }

  return { title, body: lines.join('\n'), comments }
}

/** Strip the secret before it ever lands in the issue body JSON. */
function reportWithoutSecret(
  report: VoiceQaReportRequest,
): Omit<VoiceQaReportRequest, 'secret'> {
  return { submittedAt: report.submittedAt, verdicts: report.verdicts }
}

/** Does the full report JSON fit inline in the issue body within budget?
 *  Conservative: measure the wrapper-inclusive length and compare against
 *  SAFE_BODY_BUDGET. The wrapper here is an over-estimate of the real
 *  prose (summary, category groups) so a `true` answer is always safe. */
function fitsInline(
  date: string,
  failCount: number,
  total: number,
  fullJson: string,
): boolean {
  // Fixed wrapper allowance for title-echo, summary prose, fenced markers,
  // and the per-fail bullet list. 8 KB is generous headroom above the
  // realistic worst case (MAX_VERDICTS fails × bounded note length is
  // accounted by the JSON length itself; this is only the markdown prose).
  const WRAPPER_ALLOWANCE = 8_000
  void date
  void failCount
  void total
  return fullJson.length + WRAPPER_ALLOWANCE <= SAFE_BODY_BUDGET
}

/**
 * Split the full report JSON across N follow-up comment bodies, each a
 * single fenced ```json block under GITHUB_BODY_HARD_LIMIT.
 *
 * The split is on the RAW JSON STRING (byte/char ranges), not on verdict
 * boundaries — the orchestrator concatenates the inner payloads of each
 * `part i/N` block IN ORDER to recover the exact original JSON string, then
 * JSON.parse()s the whole. This keeps each comment trivially bounded and
 * avoids re-serialising sub-arrays (which would change formatting and make
 * reassembly lossy).
 *
 * Each comment is wrapped as:
 *   <!-- voice-qa-report part i/N -->
 *   ```json   (fence is ≥3 backticks, longer than any run inside the slice)
 *   <payload slice>
 *   ```
 * The HTML comment marker is machine-greppable and renders invisibly.
 *
 * FENCE SAFETY: a fail note may contain a literal triple-backtick, which
 * JSON.stringify passes through unescaped (verified). A fixed ```json fence
 * would be closed prematurely by such a run, corrupting reassembly. So the
 * fence length adapts: it is one backtick longer than the longest backtick
 * run anywhere in the FULL json (so the same fence is used for every part —
 * a run can't straddle a slice boundary and reopen a shorter fence in the
 * next part). The orchestrator reads the opening fence length from each
 * part and matches it on close. This keeps the payload bytes EXACT while
 * guaranteeing the fence never closes early.
 */
export function buildReportComments(fullJson: string): string[] {
  // Pick a fence longer than the longest backtick run in the whole payload,
  // and never shorter than 3 (markdown minimum). Same fence for all parts.
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(fullJson) + 1))

  const makeWrapper = (i: number, n: number, payload: string): string =>
    `<!-- voice-qa-report part ${i}/${n} -->\n${fence}json\n${payload}\n${fence}`

  // Per-comment overhead = the wrapper around the payload slice. Compute it
  // for the worst-case label width (i and N up to a few digits) so the
  // payload budget is always safe.
  const WRAPPER_MAX = makeWrapper(999, 999, '').length
  const payloadBudget = SAFE_BODY_BUDGET - WRAPPER_MAX

  const slices = sliceString(fullJson, payloadBudget)
  const n = slices.length
  const comments = slices.map((payload, idx) =>
    makeWrapper(idx + 1, n, payload),
  )

  // Defensive guarantee: no comment may exceed the GitHub hard limit. If the
  // (fixed, tiny) label growth from single- to triple-digit N ever pushed a
  // body over, re-slice with a tighter budget. In practice unreachable.
  if (comments.some((c) => c.length >= GITHUB_BODY_HARD_LIMIT)) {
    const tighter = sliceString(fullJson, payloadBudget - 2_000)
    const tn = tighter.length
    return tighter.map((payload, idx) => makeWrapper(idx + 1, tn, payload))
  }

  return comments
}

/** Length of the longest consecutive run of backtick chars in `s` (0 if
 *  none). Used to size the fenced-block markers so they can't be closed
 *  prematurely by backticks inside the payload. */
function longestBacktickRun(s: string): number {
  let max = 0
  let run = 0
  for (const ch of s) {
    if (ch === '`') {
      run += 1
      if (run > max) max = run
    } else {
      run = 0
    }
  }
  return max
}

/** Split `s` into chunks each at most `max` chars long, preserving order
 *  and exact content (concatenating the chunks reproduces `s`). */
function sliceString(s: string, max: number): string[] {
  if (max <= 0) throw new Error('sliceString: max must be positive')
  if (s.length <= max) return [s]
  const out: string[] = []
  for (let i = 0; i < s.length; i += max) {
    out.push(s.slice(i, i + max))
  }
  return out
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

/** Shared GitHub REST request headers (auth + content negotiation). */
function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'Content-Type': 'application/json',
    'User-Agent': 'marian-tutor-voice-qa/1.0 (+marian-learning.vercel.app)',
  }
}

/** What a successful issue-create yields: the human URL + the issue number
 *  needed to address follow-up comments at it. */
export interface CreatedIssue {
  htmlUrl: string
  number: number
}

/**
 * Create the GitHub issue. Returns the issue's `html_url` + `number`.
 * Throws on a non-2xx GitHub response (the handler maps that to a 502 — the
 * request was valid, the upstream failed). The GITHUB_TOKEN is sent in the
 * Authorization header only; it is never logged or returned.
 */
export async function createGithubIssue(
  issue: BuiltIssue,
  token: string,
  fetchImpl: FetchLike,
): Promise<CreatedIssue> {
  const res = await fetchImpl(
    `https://api.github.com/repos/${GITHUB_REPO}/issues`,
    {
      method: 'POST',
      headers: githubHeaders(token),
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

  const parsed = (await res.json()) as {
    html_url?: unknown
    number?: unknown
  }
  if (typeof parsed.html_url !== 'string' || parsed.html_url.length === 0) {
    throw new Error('github issue create succeeded but returned no html_url')
  }
  if (typeof parsed.number !== 'number' || !Number.isInteger(parsed.number)) {
    throw new Error(
      'github issue create succeeded but returned no issue number',
    )
  }
  return { htmlUrl: parsed.html_url, number: parsed.number }
}

/**
 * Post one follow-up comment carrying a chunk of the full report JSON.
 * Throws on a non-2xx response so the handler can map it to a 502. Token in
 * the Authorization header only; never logged or returned.
 */
export async function addGithubIssueComment(
  issueNumber: number,
  body: string,
  token: string,
  fetchImpl: FetchLike,
): Promise<void> {
  const res = await fetchImpl(
    `https://api.github.com/repos/${GITHUB_REPO}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      headers: githubHeaders(token),
      body: JSON.stringify({ body }),
    },
  )

  if (!res.ok) {
    const hint = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(
      `github issue comment failed: ${res.status} ${hint} (issue #${issueNumber})`,
    )
  }
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
    const created = await createGithubIssue(issue, githubToken, fetchImpl)
    // Post the full-report chunks (if any) as follow-up comments, in order.
    // Sequential (not parallel) so the `part i/N` comments land in sequence
    // and a mid-way GitHub failure surfaces as a 502 with the issue already
    // created — the orchestrator sees a partial thread and can re-trigger,
    // rather than racing N comments out of order.
    for (const commentBody of issue.comments) {
      await addGithubIssueComment(
        created.number,
        commentBody,
        githubToken,
        fetchImpl,
      )
    }
    return jsonResponse({ ok: true, issueUrl: created.htmlUrl }, 200, headers)
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
