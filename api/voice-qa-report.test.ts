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

  it('groups fails by category with item ids and notes', () => {
    const { body } = buildIssue(SAMPLE_REPORT)
    expect(body).toContain('## Failures by category')
    expect(body).toContain('### mispronounced (1)')
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
    expect(body).toContain('### other (1)')
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
    // the fails-only payload + a pointer to the comments.
    expect(body).toContain('follow-up comment')
    expect(body).toContain('Fails-only JSON')
    // Body's inline JSON is fails-only; every entry is a fail.
    const inline = body.match(/```json\n([\s\S]*?)\n```/)
    expect(inline).not.toBeNull()
    const failsOnly = JSON.parse(inline![1]!) as {
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
    // order — this is exactly what the orchestrator does on reassembly.
    const payloads = comments.map((c) => {
      const m = c.match(/```json\n([\s\S]*?)\n```/)
      expect(m).not.toBeNull()
      return m![1]!
    })
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
    const reassembled = comments
      .map((c) => c.match(/```json\n([\s\S]*?)\n```/)![1]!)
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
