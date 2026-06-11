/**
 * @vitest-environment node
 *
 * Unit tests for /api/voice-qa-report (ticket 86ca7er73).
 *
 * Covers the status contract from the vocabulary spec:
 *   200 happy path (GitHub fetch mocked), 400 malformed body, 401 bad
 *   secret, 405 non-POST, 429 rate-limited, 503 missing env, 502 GitHub
 *   upstream failure — plus the issue-body builder, the constant-time
 *   secret compare, and the Vercel cold-start runtime assertion.
 *
 * No real GitHub call is ever made — `fetchImpl` is injected via the
 * handler's override seam.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import voiceQaEntrypoint, {
  addGithubIssueComment,
  assertNodeRuntime,
  buildIssue,
  buildReportComments,
  createGithubIssue,
  handler,
  isVoiceQaReportBody,
  secretsMatch,
  type FetchLike,
  type VoiceQaCategory,
  type VoiceQaReportRequest,
  type VoiceQaVerdict,
} from './voice-qa-report.js'
import { createRateLimiter } from './_rateLimit.js'

/** GitHub's hard limit on an issue/comment body. Mirrors the constant in
 *  the endpoint; the chunking guarantee is "every body we POST < this". */
const GITHUB_BODY_HARD_LIMIT = 65_536

const SECRET = 'super-secret-qa-token'

/** Build a POST Request with a JSON body. */
function makeRequest(body: unknown, init: RequestInit = {}): Request {
  return new Request('https://example.test/api/voice-qa-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  })
}

/** A stub fetch that returns a successful GitHub issue-create response.
 *  Records both the LAST call (back-compat) and EVERY call (for chunked
 *  comment assertions). Issue-create returns html_url + number; comment
 *  POSTs return a benign 201. */
interface FetchCall {
  url: string
  init?: unknown
}
function makeGithubSuccessFetch(
  htmlUrl = 'https://github.com/TSandvaer/MarianLearning/issues/42',
  capture: { lastUrl?: string; lastInit?: unknown; calls?: FetchCall[] } = {},
  issueNumber = 42,
): FetchLike {
  capture.calls = capture.calls ?? []
  return vi.fn(async (url, init) => {
    capture.lastUrl = url
    capture.lastInit = init
    capture.calls!.push({ url, init })
    const isCommentPost = url.endsWith('/comments')
    return {
      ok: true,
      status: 201,
      json: async () =>
        isCommentPost ? { id: 1 } : { html_url: htmlUrl, number: issueNumber },
      text: async () => '',
    }
  })
}

/** A fresh limiter per test so the module-singleton bucket never leaks. */
function freshLimiter() {
  return createRateLimiter({ limit: 5, windowMs: 60 * 60_000 })
}

/**
 * Extract the fenced ```json payload from ONE chunk comment the way a real
 * consumer (the orchestrator) MUST: read the OPENING fence length, then match
 * the SAME-length closing fence. A naive `/```json\n([\s\S]*?)\n```/` is
 * structurally wrong — when the endpoint widens the fence past 3 backticks to
 * survive a literal ``` inside a note, OR when a payload slice ends in
 * trailing backticks adjacent to the closing fence, the non-greedy 3-backtick
 * match closes early and corrupts reassembly (Devon's NIT). This helper reads
 * the actual emitted fence and slices structurally, so the tests mirror real
 * reassembly rather than a fragile shortcut.
 *
 * Comment shape (from the endpoint):
 *   <!-- voice-qa-report part i/N -->\n<fence>json\n<payload>\n<fence>
 */
function extractFencedJsonPayload(comment: string): string {
  // The opening fence is the first run of backticks at a line start that is
  // immediately followed by `json\n`. Read its exact length.
  const open = comment.match(/(^|\n)(`{3,})json\n/)
  if (!open) {
    throw new Error('extractFencedJsonPayload: no opening ```json fence found')
  }
  const fence = open[2]!
  const payloadStart = open.index! + open[0].length
  // The closing fence is a run of EXACTLY `fence.length` backticks on its own
  // line: preceded by '\n', and at end-of-string or followed by '\n'. Using
  // the captured fence length (not a fixed 3) is the structural fix — a
  // payload ending in fewer-than-fence backticks can't be mistaken for the
  // close, and a shorter run inside the payload is ignored.
  const closeRe = new RegExp(`\\n(\`{${fence.length}})(?:\\n|$)`)
  const rest = comment.slice(payloadStart)
  const close = rest.match(closeRe)
  if (!close) {
    throw new Error(
      'extractFencedJsonPayload: no matching closing fence of the opening length',
    )
  }
  return rest.slice(0, close.index!)
}

const SAMPLE_VERDICTS: VoiceQaVerdict[] = [
  {
    itemId: 'math.add-to-10.p1.read',
    audioHash: 'a1b2c3',
    verdict: 'fail',
    category: 'mispronounced',
    note: 'says "for" instead of "four"',
    decidedAt: '2026-06-11T09:00:00.000Z',
  },
  {
    itemId: 'math.add-to-10.p2.read',
    audioHash: 'd4e5f6',
    verdict: 'pass',
    decidedAt: '2026-06-11T09:01:00.000Z',
  },
]

const SAMPLE_REPORT: VoiceQaReportRequest = {
  secret: SECRET,
  submittedAt: '2026-06-11T09:05:00.000Z',
  verdicts: SAMPLE_VERDICTS,
}

/** Deterministic 64-hex audio hash for index `n` (real sha256 length). */
function fakeAudioHash(n: number): string {
  // 64 hex chars; vary the leading bytes by index so they're all distinct.
  const head = (n >>> 0).toString(16).padStart(8, '0')
  return (head + 'a3f9c1e07b2d4856').repeat(4).slice(0, 64)
}

const FAIL_CATEGORIES: VoiceQaCategory[] = [
  'mispronounced',
  'wrong-speed',
  'clipped',
  'volume',
  'wrong-text',
  'other',
]

/**
 * Build a realistic full-baseline batch: `total` verdicts, every Nth a fail
 * with a category + a human note, the rest passes. Real-length 64-hex
 * audioHashes + ISO timestamps. Mirrors what the audition page submits
 * (passes included) — the contract's full set is 654 (632 canon + 22
 * greet/hub).
 */
function makeFullBaseline(total: number): VoiceQaReportRequest {
  const verdicts: VoiceQaVerdict[] = []
  const base = Date.parse('2026-06-11T08:00:00.000Z')
  for (let i = 0; i < total; i++) {
    const decidedAt = new Date(base + i * 1500).toISOString()
    // ~1 in 7 fails, so a realistic minority of the batch.
    const isFail = i % 7 === 3
    if (isFail) {
      verdicts.push({
        itemId: `canon.cell.${i.toString().padStart(4, '0')}.read`,
        audioHash: fakeAudioHash(i),
        verdict: 'fail',
        category: FAIL_CATEGORIES[i % FAIL_CATEGORIES.length]!,
        note: `cell ${i}: clipped final phoneme, sounds like it cuts at ~0.8s — re-bake`,
        decidedAt,
      })
    } else {
      verdicts.push({
        itemId: `canon.cell.${i.toString().padStart(4, '0')}.read`,
        audioHash: fakeAudioHash(i),
        verdict: 'pass',
        decidedAt,
      })
    }
  }
  return {
    secret: SECRET,
    submittedAt: '2026-06-11T09:05:00.000Z',
    verdicts,
  }
}

/**
 * Build a HIGH-FAIL batch — the worst case for body overflow (a bad re-bake
 * breaking hundreds of cells). `total` verdicts of which `failCount` are
 * fails, each fail carrying a MAX_STRING_LEN-length note (input cap) so the
 * machine-parseable JSON and the human detail are at their largest. This is
 * the fixture that overflowed the issue body at ~130 fails before the fix.
 */
function makeHighFailBatch(
  total: number,
  failCount: number,
): VoiceQaReportRequest {
  if (failCount > total) throw new Error('failCount cannot exceed total')
  // 2000-char note (the input cap MAX_STRING_LEN). Build it once; vary the
  // head so reassembly can't dedupe-by-accident.
  const maxNote = (i: number) =>
    `cell ${i}: `.padEnd(2000, `x clipped tail re-bake needed `).slice(0, 2000)
  const verdicts: VoiceQaVerdict[] = []
  const base = Date.parse('2026-06-11T08:00:00.000Z')
  for (let i = 0; i < total; i++) {
    const decidedAt = new Date(base + i * 1500).toISOString()
    const isFail = i < failCount
    if (isFail) {
      verdicts.push({
        itemId: `canon.cell.${i.toString().padStart(4, '0')}.read`,
        audioHash: fakeAudioHash(i),
        verdict: 'fail',
        category: FAIL_CATEGORIES[i % FAIL_CATEGORIES.length]!,
        note: maxNote(i),
        decidedAt,
      })
    } else {
      verdicts.push({
        itemId: `canon.cell.${i.toString().padStart(4, '0')}.read`,
        audioHash: fakeAudioHash(i),
        verdict: 'pass',
        decidedAt,
      })
    }
  }
  return {
    secret: SECRET,
    submittedAt: '2026-06-11T09:05:00.000Z',
    verdicts,
  }
}

beforeEach(() => {
  process.env.GITHUB_TOKEN = 'ghp_test_not_real'
  process.env.VOICE_QA_SECRET = SECRET
})

afterEach(() => {
  delete process.env.GITHUB_TOKEN
  delete process.env.VOICE_QA_SECRET
  vi.restoreAllMocks()
})

describe('runtime assertion (Vercel cold-start tripwire)', () => {
  it('does not throw when running on Node', () => {
    expect(() => assertNodeRuntime()).not.toThrow()
  })

  it('exports the Vercel { fetch } entrypoint shape', () => {
    expect(typeof voiceQaEntrypoint.fetch).toBe('function')
  })
})

describe('secretsMatch (constant-time compare)', () => {
  it('returns true for identical secrets', () => {
    expect(secretsMatch(SECRET, SECRET)).toBe(true)
  })

  it('returns false for a different secret of the same length', () => {
    expect(secretsMatch('abcdef', 'abcxef')).toBe(false)
  })

  it('returns false for a length mismatch (no throw)', () => {
    expect(secretsMatch('short', 'a-much-longer-secret')).toBe(false)
  })

  it('returns false for an empty provided secret', () => {
    expect(secretsMatch('', SECRET)).toBe(false)
  })
})

describe('isVoiceQaReportBody', () => {
  it('accepts a well-formed report', () => {
    expect(isVoiceQaReportBody(SAMPLE_REPORT)).toBe(true)
  })

  it('accepts a pass verdict with no category', () => {
    expect(
      isVoiceQaReportBody({
        submittedAt: '2026-06-11T09:05:00.000Z',
        verdicts: [
          {
            itemId: 'x',
            audioHash: 'h',
            verdict: 'pass',
            decidedAt: '2026-06-11T09:00:00.000Z',
          },
        ],
      }),
    ).toBe(true)
  })

  it('rejects a non-object', () => {
    expect(isVoiceQaReportBody(null)).toBe(false)
    expect(isVoiceQaReportBody('nope')).toBe(false)
  })

  it('rejects a missing submittedAt', () => {
    expect(isVoiceQaReportBody({ verdicts: SAMPLE_VERDICTS })).toBe(false)
  })

  it('rejects a submittedAt that does not parse as a date', () => {
    expect(
      isVoiceQaReportBody({
        submittedAt: 'not-a-real-date',
        verdicts: SAMPLE_VERDICTS,
      }),
    ).toBe(false)
  })

  it('accepts MAX_VERDICTS-sized batch but rejects one over (cap clears 654 baseline)', () => {
    // 654 (the contract's full baseline) must be accepted.
    expect(isVoiceQaReportBody(makeFullBaseline(654))).toBe(true)
    // 2000 (the cap) is accepted; 2001 is rejected.
    expect(isVoiceQaReportBody(makeFullBaseline(2000))).toBe(true)
    expect(isVoiceQaReportBody(makeFullBaseline(2001))).toBe(false)
  })

  it('rejects an empty verdicts array', () => {
    expect(
      isVoiceQaReportBody({
        submittedAt: '2026-06-11T09:05:00.000Z',
        verdicts: [],
      }),
    ).toBe(false)
  })

  it('rejects a verdict with an invalid verdict value', () => {
    expect(
      isVoiceQaReportBody({
        submittedAt: '2026-06-11T09:05:00.000Z',
        verdicts: [
          {
            itemId: 'x',
            audioHash: 'h',
            verdict: 'maybe',
            decidedAt: '2026-06-11T09:00:00.000Z',
          },
        ],
      }),
    ).toBe(false)
  })

  it('rejects a verdict with an unknown category', () => {
    expect(
      isVoiceQaReportBody({
        submittedAt: '2026-06-11T09:05:00.000Z',
        verdicts: [
          {
            itemId: 'x',
            audioHash: 'h',
            verdict: 'fail',
            category: 'garbled',
            decidedAt: '2026-06-11T09:00:00.000Z',
          },
        ],
      }),
    ).toBe(false)
  })

  it('rejects a verdict missing audioHash', () => {
    expect(
      isVoiceQaReportBody({
        submittedAt: '2026-06-11T09:05:00.000Z',
        verdicts: [
          {
            itemId: 'x',
            verdict: 'pass',
            decidedAt: '2026-06-11T09:00:00.000Z',
          },
        ],
      }),
    ).toBe(false)
  })
})

describe('buildIssue', () => {
  it('builds the title with date, fail count, and total', () => {
    const { title } = buildIssue(SAMPLE_REPORT)
    expect(title).toBe('Voice QA report — 2026-06-11 — 1 fails / 2 verdicts')
  })

  it('groups fails by category with counts + item ids and notes', () => {
    const { body } = buildIssue(SAMPLE_REPORT)
    // Per-category COUNT line (bounded summary).
    expect(body).toContain('## Failures by category')
    expect(body).toContain('- **mispronounced**: 1')
    // Bounded detail list carries the item id + note.
    expect(body).toContain('## Failure detail')
    expect(body).toContain('`math.add-to-10.p1.read`')
    expect(body).toContain('says "for" instead of "four"')
  })

  it('embeds the full report JSON in a fenced json block WITHOUT the secret', () => {
    const { body } = buildIssue(SAMPLE_REPORT)
    expect(body).toContain('```json')
    // The fenced JSON must be parseable and must NOT carry the secret.
    const match = body.match(/```json\n([\s\S]*?)\n```/)
    expect(match).not.toBeNull()
    const parsed = JSON.parse(match![1]!)
    expect(parsed.secret).toBeUndefined()
    expect(parsed.verdicts).toHaveLength(2)
    expect(parsed.submittedAt).toBe('2026-06-11T09:05:00.000Z')
    expect(body).not.toContain(SECRET)
  })

  it('reports a clean pass when there are no fails', () => {
    const report: VoiceQaReportRequest = {
      secret: SECRET,
      submittedAt: '2026-06-11T09:05:00.000Z',
      verdicts: [
        {
          itemId: 'x',
          audioHash: 'h',
          verdict: 'pass',
          decidedAt: '2026-06-11T09:00:00.000Z',
        },
      ],
    }
    const { title, body } = buildIssue(report)
    expect(title).toBe('Voice QA report — 2026-06-11 — 0 fails / 1 verdicts')
    expect(body).toContain('No failures reported')
  })

  it('buckets a category-less fail into "other"', () => {
    const report: VoiceQaReportRequest = {
      secret: SECRET,
      submittedAt: '2026-06-11T09:05:00.000Z',
      verdicts: [
        {
          itemId: 'y',
          audioHash: 'h2',
          verdict: 'fail',
          decidedAt: '2026-06-11T09:00:00.000Z',
        },
      ],
    }
    const { body } = buildIssue(report)
    expect(body).toContain('- **other**: 1')
    expect(body).toContain('`other` `y`')
  })

  it('neutralises backticks and newlines in notes', () => {
    const report: VoiceQaReportRequest = {
      secret: SECRET,
      submittedAt: '2026-06-11T09:05:00.000Z',
      verdicts: [
        {
          itemId: 'z',
          audioHash: 'h3',
          verdict: 'fail',
          category: 'other',
          note: 'line one\nline `two`',
          decidedAt: '2026-06-11T09:00:00.000Z',
        },
      ],
    }
    const { body } = buildIssue(report)
    expect(body).toContain("line one line 'two'")
  })

  it('inlines the full report JSON for a small batch (no comments)', () => {
    const { body, comments } = buildIssue(SAMPLE_REPORT)
    expect(comments).toEqual([])
    // The full JSON (passes included) is present inline.
    const match = body.match(/```json\n([\s\S]*?)\n```/)
    expect(match).not.toBeNull()
    const parsed = JSON.parse(match![1]!)
    expect(parsed.verdicts).toHaveLength(2)
  })
})

/**
 * The blocking-#2 fix: full-baseline submission (654 verdicts, passes
 * included) must NOT overflow GitHub's 65,536-char body limit. The issue
 * body carries only the fail summary + fails-only JSON; the FULL report
 * ships across `part i/N` follow-up comments, each under the limit, and the
 * chunks reassemble losslessly to the exact full-report JSON.
 */
describe('buildIssue — full-baseline chunking (654 verdicts)', () => {
  const REPORT = makeFullBaseline(654)

  it('keeps the issue body well under the GitHub 65,536-char limit', () => {
    const { body } = buildIssue(REPORT)
    expect(body.length).toBeLessThan(GITHUB_BODY_HARD_LIMIT)
  })

  it('ships the full report across follow-up comments, not the body', () => {
    const { body, comments } = buildIssue(REPORT)
    expect(comments.length).toBeGreaterThan(0)
    // Body must NOT contain the full report (which includes passes) — only
    // the bounded summary + (here) the fails-only payload + a pointer.
    expect(body).toContain('follow-up comment')
    expect(body).toContain('Fails-only JSON')
    // Body's inline JSON is fails-only; every entry is a fail. Parse the fence
    // structurally (Devon's NIT) — the same way a real consumer must.
    const failsOnly = JSON.parse(extractFencedJsonPayload(body)) as {
      fails: VoiceQaVerdict[]
    }
    expect(failsOnly.fails.every((f) => f.verdict === 'fail')).toBe(true)
    expect(failsOnly.fails.length).toBeGreaterThan(0)
    expect(failsOnly.fails.length).toBeLessThan(REPORT.verdicts.length)
  })

  it('every comment body is under the GitHub 65,536-char limit', () => {
    const { comments } = buildIssue(REPORT)
    for (const c of comments) {
      expect(c.length).toBeLessThan(GITHUB_BODY_HARD_LIMIT)
    }
  })

  it('labels each comment part i/N in order', () => {
    const { comments } = buildIssue(REPORT)
    const n = comments.length
    comments.forEach((c, idx) => {
      expect(c).toContain(`voice-qa-report part ${idx + 1}/${n}`)
    })
  })

  it('reassembles the chunk payloads into the exact full-report JSON', () => {
    const { comments } = buildIssue(REPORT)
    // Extract the fenced ```json payload from each part and concatenate in
    // order — this is exactly what the orchestrator does on reassembly. Parse
    // the fence STRUCTURALLY (opening fence length → same-length close), not
    // with a fragile fixed-3-backtick regex (Devon's NIT).
    const payloads = comments.map((c) => extractFencedJsonPayload(c))
    const reassembled = payloads.join('')
    const parsed = JSON.parse(reassembled) as {
      submittedAt: string
      verdicts: VoiceQaVerdict[]
    }
    expect(parsed.submittedAt).toBe(REPORT.submittedAt)
    expect(parsed.verdicts).toHaveLength(654)
    // Round-trips the full set incl. passes; secret absent.
    expect((parsed as Record<string, unknown>).secret).toBeUndefined()
    expect(
      parsed.verdicts.filter((v) => v.verdict === 'pass').length,
    ).toBeGreaterThan(0)
    // And it equals the canonical full JSON the endpoint would have built.
    const canonical = JSON.stringify(
      { submittedAt: REPORT.submittedAt, verdicts: REPORT.verdicts },
      null,
      2,
    )
    expect(reassembled).toBe(canonical)
  })

  it('handler posts the issue + every chunk comment, all under the limit', async () => {
    const capture: { calls?: FetchCall[] } = {}
    const fetchImpl = makeGithubSuccessFetch(undefined, capture, 314)
    const res = await handler(makeRequest(REPORT), {
      fetchImpl,
      rateLimiter: freshLimiter(),
    })
    expect(res.status).toBe(200)
    const calls = capture.calls!
    // First call creates the issue; the rest post comments to issue #314.
    expect(calls[0]!.url).toBe(
      'https://api.github.com/repos/TSandvaer/MarianLearning/issues',
    )
    const commentCalls = calls.slice(1)
    expect(commentCalls.length).toBeGreaterThan(0)
    for (const call of commentCalls) {
      expect(call.url).toBe(
        'https://api.github.com/repos/TSandvaer/MarianLearning/issues/314/comments',
      )
      const init = call.init as { body: string }
      const postedBody = JSON.parse(init.body).body as string
      expect(postedBody.length).toBeLessThan(GITHUB_BODY_HARD_LIMIT)
    }
  })
})

/**
 * The RE-BLOCK fix (Devon's delta re-review): when `fitsInline` is false the
 * issue BODY must STILL stay under GitHub's 65,536-char limit no matter how
 * many fails the batch carries. Before the fix the body carried an UNBOUNDED
 * per-fail bullet list + the inline fails-only JSON, so a high-fail batch
 * (bad re-bake breaking hundreds of cells — the highest-signal report) crossed
 * 65,536 at ~130 fails → GitHub 422 → 502 → whole batch lost. These tests
 * exercise the worst case: 500+ fails with MAX_STRING_LEN notes, and the
 * MAX_VERDICTS (2000) cap. They fail RED against the old unbounded body.
 */
describe('buildIssue — high-fail body is bounded by construction', () => {
  it('keeps the BODY under the GitHub limit at 500 fails / 654 (max-length notes)', () => {
    const report = makeHighFailBatch(654, 500)
    const { body } = buildIssue(report)
    // The body itself — the thing that 422'd — must clear the hard limit.
    expect(body.length).toBeLessThan(GITHUB_BODY_HARD_LIMIT)
    // And it stays within our self-imposed SAFE budget, not just the ceiling.
    expect(body.length).toBeLessThanOrEqual(60_000)
  })

  it('keeps the BODY under the limit at the MAX_VERDICTS cap (2000 verdicts, 1700 fails, max notes)', () => {
    const report = makeHighFailBatch(2000, 1700)
    const { body, comments } = buildIssue(report)
    expect(body.length).toBeLessThan(GITHUB_BODY_HARD_LIMIT)
    // The full report ships across comments; each stays under the limit.
    expect(comments.length).toBeGreaterThan(0)
    for (const c of comments) {
      expect(c.length).toBeLessThan(GITHUB_BODY_HARD_LIMIT)
    }
  })

  it('caps the body detail list at MAX_BODY_FAIL_DETAIL with an "…and X more" pointer', () => {
    const report = makeHighFailBatch(654, 500)
    const { body } = buildIssue(report)
    // The detail header announces the truncation, and the pointer is present.
    expect(body).toContain('## Failure detail (first 40 of 500)')
    expect(body).toContain('…and 460 more')
    // Per-category COUNTS still reflect the TRUE total (not the shown 40).
    // 500 fails round-robin across 6 categories → 84 or 83 per category.
    expect(body).toMatch(/- \*\*mispronounced\*\*: \d+/)
  })

  it('omits the inline fails-only JSON when it would overflow the body budget', () => {
    const report = makeHighFailBatch(2000, 1700)
    const { body } = buildIssue(report)
    // At 1700 max-length-note fails the fails-only JSON is far too large to
    // inline; the body must say so and point at the comment parts instead of
    // embedding it (every fail is still in the full-report comments).
    expect(body).toContain('Fails-only JSON omitted from the body')
    expect(body).not.toContain('<summary>Fails-only JSON')
  })

  it('handler POSTs an issue body + comments all under the limit at 500 fails', async () => {
    const report = makeHighFailBatch(654, 500)
    const capture: { calls?: FetchCall[] } = {}
    const fetchImpl = makeGithubSuccessFetch(undefined, capture, 777)
    const res = await handler(makeRequest(report), {
      fetchImpl,
      rateLimiter: freshLimiter(),
    })
    expect(res.status).toBe(200)
    const calls = capture.calls!
    // The issue-create POST body (the one that 422'd before the fix).
    const issueInit = calls[0]!.init as { body: string }
    const issueBody = JSON.parse(issueInit.body).body as string
    expect(issueBody.length).toBeLessThan(GITHUB_BODY_HARD_LIMIT)
    // Every comment POST body too.
    for (const call of calls.slice(1)) {
      const init = call.init as { body: string }
      const postedBody = JSON.parse(init.body).body as string
      expect(postedBody.length).toBeLessThan(GITHUB_BODY_HARD_LIMIT)
    }
  })
})

describe('buildReportComments (chunk-splitter unit)', () => {
  it('returns a single comment when the JSON is small', () => {
    const comments = buildReportComments('{"x":1}')
    expect(comments).toHaveLength(1)
    expect(comments[0]).toContain('voice-qa-report part 1/1')
  })

  it('splits a large JSON string into multiple bounded comments', () => {
    const big = 'x'.repeat(150_000)
    const comments = buildReportComments(big)
    expect(comments.length).toBeGreaterThan(1)
    for (const c of comments) {
      expect(c.length).toBeLessThan(GITHUB_BODY_HARD_LIMIT)
    }
    // Reassemble the raw payload slices — must equal the original string.
    // Structural fence parse (Devon's NIT), not the fragile fixed-3 regex.
    const reassembled = comments
      .map((c) => extractFencedJsonPayload(c))
      .join('')
    expect(reassembled).toBe(big)
  })

  it('uses a fence longer than any backtick run so notes with ``` survive', () => {
    // Full report containing a note with a literal triple-backtick. A fixed
    // ```json fence would close early and corrupt reassembly; the adaptive
    // fence (4+ backticks here) must keep the payload intact.
    const payload = JSON.stringify({
      submittedAt: '2026-06-11T09:05:00.000Z',
      verdicts: [
        {
          itemId: 'x',
          audioHash: 'h',
          verdict: 'fail',
          note: 'reviewer pasted ``` a code fence ``` into the note',
          decidedAt: '2026-06-11T09:00:00.000Z',
        },
      ],
    })
    const comments = buildReportComments(payload)
    expect(comments).toHaveLength(1)
    // The fence opener must be ≥4 backticks (longest run inside is 3).
    const fenceMatch = comments[0]!.match(/^<!--[^>]*-->\n(`{4,})json\n/)
    expect(fenceMatch).not.toBeNull()
    const fence = fenceMatch![1]!
    // Reassemble using the actual fence length and confirm exact bytes.
    const inner = comments[0]!.match(
      new RegExp(`${fence}json\\n([\\s\\S]*?)\\n${fence}`),
    )![1]!
    expect(inner).toBe(payload)
    expect(JSON.parse(inner).verdicts[0].note).toContain('``` a code fence ```')
  })

  it('parses the fence STRUCTURALLY when the payload contains a `\\n```\\n` run, where the naive fixed-3 regex breaks (Devon NIT)', () => {
    // The genuine break case: the payload itself contains a line that is a
    // 3-backtick run (`\n```\n`), so the endpoint WIDENS the fence to 4. A
    // consumer that assumes a fixed 3-backtick fence — /```json\n(.*?)\n```/ —
    // finds the "```json" substring INSIDE the 4-backtick opener, then closes
    // at the payload's INTERNAL "\n```" run, truncating the slice. The
    // structural parser reads the OPENING fence length (4) and matches a
    // same-length close, so it skips the internal 3-run and recovers the exact
    // bytes. This is the trailing/adjacent-backtick fragility the NIT flagged.
    const payload = [
      '{',
      '  "note": "code:",',
      '```',
      'fenced',
      '```',
      '}',
    ].join('\n')
    const comments = buildReportComments(payload)
    expect(comments).toHaveLength(1)
    // Fence widened to 4 backticks (longest internal run is 3).
    expect(comments[0]).toContain('`'.repeat(4) + 'json\n')

    // Structural extraction reproduces the payload BYTE-EXACT.
    const extracted = extractFencedJsonPayload(comments[0]!)
    expect(extracted).toBe(payload)

    // Prove the naive fixed-3 regex gets it WRONG here: it stops at the
    // payload's internal "\n```", capturing a truncated slice ≠ the payload.
    const naive = comments[0]!.match(/```json\n([\s\S]*?)\n```/)
    expect(naive).not.toBeNull()
    expect(naive![1]).not.toBe(payload)
  })
})

describe('createGithubIssue', () => {
  it('POSTs to the issues endpoint with the voice-qa label and returns html_url + number', async () => {
    const capture: { lastUrl?: string; lastInit?: unknown } = {}
    const fetchImpl = makeGithubSuccessFetch(
      'https://github.com/TSandvaer/MarianLearning/issues/7',
      capture,
      7,
    )
    const created = await createGithubIssue(
      { title: 'T', body: 'B', comments: [] },
      'ghp_test',
      fetchImpl,
    )
    expect(created.htmlUrl).toBe(
      'https://github.com/TSandvaer/MarianLearning/issues/7',
    )
    expect(created.number).toBe(7)
    expect(capture.lastUrl).toBe(
      'https://api.github.com/repos/TSandvaer/MarianLearning/issues',
    )
    const init = capture.lastInit as {
      method: string
      headers: Record<string, string>
      body: string
    }
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer ghp_test')
    const payload = JSON.parse(init.body)
    expect(payload.labels).toEqual(['voice-qa'])
  })

  it('throws on a non-2xx GitHub response', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({}),
      text: async () => 'Validation failed',
    }))
    await expect(
      createGithubIssue(
        { title: 'T', body: 'B', comments: [] },
        'ghp_test',
        fetchImpl,
      ),
    ).rejects.toThrow(/github issue create failed: 422/)
  })

  it('throws when GitHub returns no html_url', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ number: 1 }),
      text: async () => '',
    }))
    await expect(
      createGithubIssue(
        { title: 'T', body: 'B', comments: [] },
        'ghp_test',
        fetchImpl,
      ),
    ).rejects.toThrow(/no html_url/)
  })

  it('throws when GitHub returns no issue number', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ html_url: 'https://github.com/x/y/issues/1' }),
      text: async () => '',
    }))
    await expect(
      createGithubIssue(
        { title: 'T', body: 'B', comments: [] },
        'ghp_test',
        fetchImpl,
      ),
    ).rejects.toThrow(/no issue number/)
  })
})

describe('addGithubIssueComment', () => {
  it('POSTs to the issue comments endpoint with the chunk body', async () => {
    const capture: { lastUrl?: string; lastInit?: unknown } = {}
    const fetchImpl = makeGithubSuccessFetch(undefined, capture, 9)
    await addGithubIssueComment(9, 'chunk body', 'ghp_test', fetchImpl)
    expect(capture.lastUrl).toBe(
      'https://api.github.com/repos/TSandvaer/MarianLearning/issues/9/comments',
    )
    const init = capture.lastInit as { method: string; body: string }
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).body).toBe('chunk body')
  })

  it('throws on a non-2xx GitHub response', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({}),
      text: async () => 'Validation failed',
    }))
    await expect(
      addGithubIssueComment(9, 'chunk body', 'ghp_test', fetchImpl),
    ).rejects.toThrow(/github issue comment failed: 422/)
  })
})

describe('handler — status contract', () => {
  it('200: happy path files the issue and returns { ok, issueUrl }', async () => {
    const fetchImpl = makeGithubSuccessFetch()
    const res = await handler(makeRequest(SAMPLE_REPORT), {
      fetchImpl,
      rateLimiter: freshLimiter(),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; issueUrl: string }
    expect(json.ok).toBe(true)
    expect(json.issueUrl).toBe(
      'https://github.com/TSandvaer/MarianLearning/issues/42',
    )
  })

  it('405: non-POST method is rejected', async () => {
    const res = await handler(
      new Request('https://example.test/api/voice-qa-report', {
        method: 'GET',
      }),
      { fetchImpl: makeGithubSuccessFetch(), rateLimiter: freshLimiter() },
    )
    expect(res.status).toBe(405)
    expect(res.headers.get('Allow')).toBe('POST, OPTIONS')
    const json = (await res.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
  })

  it('204: OPTIONS preflight returns no content', async () => {
    const res = await handler(
      new Request('https://example.test/api/voice-qa-report', {
        method: 'OPTIONS',
      }),
      { fetchImpl: makeGithubSuccessFetch(), rateLimiter: freshLimiter() },
    )
    expect(res.status).toBe(204)
  })

  it('503: missing GITHUB_TOKEN', async () => {
    delete process.env.GITHUB_TOKEN
    const res = await handler(makeRequest(SAMPLE_REPORT), {
      fetchImpl: makeGithubSuccessFetch(),
      rateLimiter: freshLimiter(),
    })
    expect(res.status).toBe(503)
    const json = (await res.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/GITHUB_TOKEN|VOICE_QA_SECRET/)
  })

  it('503: missing VOICE_QA_SECRET', async () => {
    delete process.env.VOICE_QA_SECRET
    const res = await handler(makeRequest(SAMPLE_REPORT), {
      fetchImpl: makeGithubSuccessFetch(),
      rateLimiter: freshLimiter(),
    })
    expect(res.status).toBe(503)
  })

  it('400: malformed JSON body', async () => {
    const res = await handler(makeRequest('{ not valid json', {}), {
      fetchImpl: makeGithubSuccessFetch(),
      rateLimiter: freshLimiter(),
    })
    expect(res.status).toBe(400)
    const json = (await res.json()) as { ok: boolean; error: string }
    expect(json.error).toMatch(/valid JSON/)
  })

  it('401: bad secret', async () => {
    const res = await handler(
      makeRequest({ ...SAMPLE_REPORT, secret: 'wrong-secret-value!!' }),
      { fetchImpl: makeGithubSuccessFetch(), rateLimiter: freshLimiter() },
    )
    expect(res.status).toBe(401)
    const json = (await res.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toBe('unauthorized')
  })

  it('401: missing secret field', async () => {
    const res = await handler(
      makeRequest({
        submittedAt: SAMPLE_REPORT.submittedAt,
        verdicts: SAMPLE_VERDICTS,
      }),
      { fetchImpl: makeGithubSuccessFetch(), rateLimiter: freshLimiter() },
    )
    expect(res.status).toBe(401)
  })

  it('400: authenticated but submittedAt does not parse as a date', async () => {
    const res = await handler(
      makeRequest({
        secret: SECRET,
        submittedAt: 'yesterday-ish',
        verdicts: SAMPLE_VERDICTS,
      }),
      { fetchImpl: makeGithubSuccessFetch(), rateLimiter: freshLimiter() },
    )
    expect(res.status).toBe(400)
    const json = (await res.json()) as { ok: boolean; error: string }
    expect(json.error).toMatch(/malformed body/)
  })

  it('400: well-authenticated but malformed body (bad verdict)', async () => {
    const res = await handler(
      makeRequest({
        secret: SECRET,
        submittedAt: SAMPLE_REPORT.submittedAt,
        verdicts: [
          { itemId: 'x', audioHash: 'h', verdict: 'maybe', decidedAt: 'd' },
        ],
      }),
      { fetchImpl: makeGithubSuccessFetch(), rateLimiter: freshLimiter() },
    )
    expect(res.status).toBe(400)
    const json = (await res.json()) as { ok: boolean; error: string }
    expect(json.error).toMatch(/malformed body/)
  })

  it('does NOT call GitHub on a bad secret', async () => {
    const fetchImpl = makeGithubSuccessFetch()
    await handler(
      makeRequest({ ...SAMPLE_REPORT, secret: 'nope-wrong-length-x' }),
      {
        fetchImpl,
        rateLimiter: freshLimiter(),
      },
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('429: rate-limited after 5 submissions in the window', async () => {
    const limiter = freshLimiter()
    const fetchImpl = makeGithubSuccessFetch()
    let t = 1_000
    const now = () => t
    // 5 allowed
    for (let i = 0; i < 5; i++) {
      t += 1000
      const res = await handler(makeRequest(SAMPLE_REPORT), {
        fetchImpl,
        rateLimiter: limiter,
        now,
      })
      expect(res.status).toBe(200)
    }
    // 6th blocked
    t += 1000
    const blocked = await handler(makeRequest(SAMPLE_REPORT), {
      fetchImpl,
      rateLimiter: limiter,
      now,
    })
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0)
    const json = (await blocked.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
  })

  it('rate limit consumes the bucket only AFTER auth (bad secret never counts)', async () => {
    const limiter = freshLimiter()
    const fetchImpl = makeGithubSuccessFetch()
    let t = 1_000
    const now = () => t
    // 10 bad-secret attempts — none should consume the bucket.
    for (let i = 0; i < 10; i++) {
      t += 1000
      const res = await handler(
        makeRequest({ ...SAMPLE_REPORT, secret: 'definitely-wrong-x' }),
        { fetchImpl, rateLimiter: limiter, now },
      )
      expect(res.status).toBe(401)
    }
    // A valid request should still be admitted.
    t += 1000
    const ok = await handler(makeRequest(SAMPLE_REPORT), {
      fetchImpl,
      rateLimiter: limiter,
      now,
    })
    expect(ok.status).toBe(200)
  })

  it('502: GitHub upstream failure is mapped, never thrown', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => 'boom',
    }))
    const res = await handler(makeRequest(SAMPLE_REPORT), {
      fetchImpl,
      rateLimiter: freshLimiter(),
    })
    expect(res.status).toBe(502)
    const json = (await res.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/GitHub issue/)
  })

  it('does not leak the GitHub token in the response on upstream failure', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => 'boom',
    }))
    const res = await handler(makeRequest(SAMPLE_REPORT), {
      fetchImpl,
      rateLimiter: freshLimiter(),
    })
    const text = await res.text()
    expect(text).not.toContain('ghp_test_not_real')
  })
})
