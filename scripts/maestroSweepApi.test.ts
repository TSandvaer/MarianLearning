/**
 * @vitest-environment node
 *
 * The every-step sweep's local `/api/claude` (`scripts/maestroSweepApi.ts`):
 * the committed canon through the production handler, with no paid or
 * outbound path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PlannerAnthropicClient } from '../api/_planner.js'
import {
  PLACEHOLDER_ANTHROPIC_KEY,
  assertNoCredentials,
  blockOutboundFetch,
  createSweepApi,
  describeRequest,
} from './maestroSweepApi.ts'
import type { SweepApiRecord } from './maestroSweepVerdict.ts'

function sessionStart(track: string, focusNode?: string): Request {
  return new Request('http://127.0.0.1:8398/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'session-start',
      payload: {
        track,
        level: 1,
        childName: 'Marian',
        ...(focusNode ? { progress: { focusNode } } : {}),
      },
    }),
  })
}

describe('createSweepApi', () => {
  let savedKey: string | undefined
  beforeEach(() => {
    savedKey = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = PLACEHOLDER_ANTHROPIC_KEY
    // The handler logs a canon miss's planner failure with console.error.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = savedKey
  })

  function spyClient(): PlannerAnthropicClient & { calls: number } {
    const client = {
      calls: 0,
      messages: {
        create: async () => {
          client.calls += 1
          throw new Error('planner reached')
        },
      },
    }
    return client
  }

  it('serves a step from the committed canon and records it', async () => {
    const records: SweepApiRecord[] = []
    const client = spyClient()
    const api = createSweepApi({
      record: (r) => records.push(r),
      plannerClient: client,
    })
    const response = await api(sessionStart('math', 'add-to-20'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { plan: { id: string } }
    expect(body.plan.id).toBe('add-to-20-balanced-intro')
    expect(records).toEqual([
      {
        kind: 'session-start',
        track: 'math',
        focusNode: 'add-to-20',
        status: 200,
        source: 'canon-hit',
      },
    ])
    expect(client.calls).toBe(0)
  })

  it('answers a canon miss with an error, from the stub planner', async () => {
    const records: SweepApiRecord[] = []
    const client = spyClient()
    const api = createSweepApi({
      record: (r) => records.push(r),
      getCanonEntry: () => null,
      plannerClient: client,
    })
    const response = await api(sessionStart('math', 'add-to-20'))
    expect(response.status).toBe(502)
    expect(records).toEqual([
      {
        kind: 'session-start',
        track: 'math',
        focusNode: 'add-to-20',
        status: 502,
        source: 'canon-miss',
      },
    ])
    expect(client.calls).toBe(1)
  })

  it('never reaches the planner with the default client', async () => {
    const records: SweepApiRecord[] = []
    const api = createSweepApi({
      record: (r) => records.push(r),
      getCanonEntry: () => null,
    })
    const response = await api(sessionStart('word-song', 'cvc-words'))
    expect(response.status).toBe(502)
    expect(records[0]?.source).toBe('canon-miss')
  })

  it('answers 404 off /api/claude and records nothing', async () => {
    const records: SweepApiRecord[] = []
    const api = createSweepApi({ record: (r) => records.push(r) })
    const response = await api(
      new Request('http://127.0.0.1:8398/api/progress'),
    )
    expect(response.status).toBe(404)
    expect(records).toEqual([])
  })
})

describe('describeRequest', () => {
  it('reads kind, track and progress.focusNode', () => {
    expect(
      describeRequest({
        kind: 'session-start',
        payload: { track: 'math', progress: { focusNode: 'mult-3-4' } },
      }),
    ).toEqual({ kind: 'session-start', track: 'math', focusNode: 'mult-3-4' })
  })

  it('gives nulls for what a request lacks', () => {
    expect(describeRequest({ kind: 'session-end', payload: {} })).toEqual({
      kind: 'session-end',
      track: null,
      focusNode: null,
    })
    expect(describeRequest('nonsense')).toEqual({
      kind: '(invalid)',
      track: null,
      focusNode: null,
    })
  })
})

describe('blockOutboundFetch', () => {
  it('makes fetch throw, reports the URL, and restores', async () => {
    const original = globalThis.fetch
    const onAttempt = vi.fn()
    const restore = blockOutboundFetch(onAttempt)
    try {
      await expect(
        fetch('https://api.anthropic.com/v1/messages'),
      ).rejects.toThrow(/outbound fetch blocked/)
      expect(onAttempt).toHaveBeenCalledTimes(1)
      expect(onAttempt).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
      )
    } finally {
      restore()
    }
    expect(globalThis.fetch).toBe(original)
  })
})

describe('assertNoCredentials', () => {
  it('passes with no credential, or only the placeholder key', () => {
    expect(() => assertNoCredentials({ PATH: '/usr/bin' })).not.toThrow()
    expect(() =>
      assertNoCredentials({ ANTHROPIC_API_KEY: PLACEHOLDER_ANTHROPIC_KEY }),
    ).not.toThrow()
  })

  it('throws naming every credential it finds', () => {
    expect(() =>
      assertNoCredentials({
        ANTHROPIC_API_KEY: 'sk-ant-real',
        ELEVENLABS_API_KEY: 'x',
        PROGRESS_API_SECRET: '',
      }),
    ).toThrow(/ANTHROPIC_API_KEY, ELEVENLABS_API_KEY is set/)
  })
})
