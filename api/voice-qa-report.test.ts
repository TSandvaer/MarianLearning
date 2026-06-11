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
  assertNodeRuntime,
  buildIssue,
  createGithubIssue,
  handler,
  isVoiceQaReportBody,
  secretsMatch,
  type FetchLike,
  type VoiceQaReportRequest,
  type VoiceQaVerdict,
} from './voice-qa-report.js'
import { createRateLimiter } from './_rateLimit.js'

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

/** A stub fetch that returns a successful GitHub issue-create response. */
function makeGithubSuccessFetch(
  htmlUrl = 'https://github.com/TSandvaer/MarianLearning/issues/42',
  capture: { lastUrl?: string; lastInit?: unknown } = {},
): FetchLike {
  return vi.fn(async (url, init) => {
    capture.lastUrl = url
    capture.lastInit = init
    return {
      ok: true,
      status: 201,
      json: async () => ({ html_url: htmlUrl }),
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
})

describe('createGithubIssue', () => {
  it('POSTs to the issues endpoint with the voice-qa label and returns html_url', async () => {
    const capture: { lastUrl?: string; lastInit?: unknown } = {}
    const fetchImpl = makeGithubSuccessFetch(
      'https://github.com/TSandvaer/MarianLearning/issues/7',
      capture,
    )
    const url = await createGithubIssue(
      { title: 'T', body: 'B' },
      'ghp_test',
      fetchImpl,
    )
    expect(url).toBe('https://github.com/TSandvaer/MarianLearning/issues/7')
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
      createGithubIssue({ title: 'T', body: 'B' }, 'ghp_test', fetchImpl),
    ).rejects.toThrow(/github issue create failed: 422/)
  })

  it('throws when GitHub returns no html_url', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({}),
      text: async () => '',
    }))
    await expect(
      createGithubIssue({ title: 'T', body: 'B' }, 'ghp_test', fetchImpl),
    ).rejects.toThrow(/no html_url/)
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
