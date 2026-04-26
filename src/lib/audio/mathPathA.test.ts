import { describe, expect, it, vi } from 'vitest'
import {
  CLAUDE_ENDPOINT,
  PrepareMathPathAError,
  prepareMathPathA,
} from './mathPathA'
import type { HowlLike, PlaySessionUtteranceOptions } from './sessionAudio'
import {
  STATIC_SESSION_PLANS,
  mathSessionPlanToUtteranceSources,
  type MathSessionPlan,
} from '../../screens/Math'
import type { SessionStartResponse, Utterance } from '../../../api/_types'

/** Build a successful SessionStartResponse for the given plan. */
function buildServerResponse(plan: MathSessionPlan): SessionStartResponse {
  const sources = mathSessionPlanToUtteranceSources(plan)
  const utterances: Utterance[] = sources.map((s, i) => ({
    id: s.id,
    text: s.text,
    audio: {
      kind: 'inline',
      // Distinct base64 per utterance so tests can confirm the right one was
      // picked. Just `00` plus the index, padded — content never decoded by
      // the test seams below.
      base64: `data-${i}`,
      mime: 'audio/mpeg',
    },
  }))
  return {
    ok: true,
    kind: 'session-start',
    plan: { id: plan.id, label: plan.label, utterances: sources },
    utterances,
  }
}

/** A jsonResponse-like Response object — `Response.json` isn't reliably
 *  available across all Node versions vitest runs against, so we hand-build. */
function jsonResp(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

/** Build a typed fetch mock — explicit parameter typing keeps
 *  `mock.calls[0]` typed as `[input: RequestInfo, init?: RequestInit]`
 *  rather than the no-param `[]` inference that `async () => ...` defaults to. */
type FetchSpy = ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>

function makeFetchMock(impl: () => Promise<Response>): FetchSpy {
  return vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >(async () => impl())
}

describe('prepareMathPathA — happy path', () => {
  it('POSTs the wire-shape plan to /api/claude with kind=session-start', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(plan)),
    )

    await prepareMathPathA(plan, plan.id, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map()),
      playSessionUtterance: vi.fn(async () => {}),
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(CLAUDE_ENDPOINT)
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    expect(body.kind).toBe('session-start')
    const payload = body.payload as Record<string, unknown>
    const wirePlan = payload.plan as {
      id: string
      utterances: { id: string; text: string }[]
    }
    expect(wirePlan.id).toBe(plan.id)
    // 8 problems × 5 slots.
    expect(wirePlan.utterances).toHaveLength(40)
    expect(wirePlan.utterances[0]).toEqual({
      id: 'math.p1.read',
      text: plan.problems[0]!.utterances.read,
    })
  })

  it('calls loadSessionAudio with the rehydrated utterances', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const response = buildServerResponse(plan)
    const fetchMock = makeFetchMock(async () => jsonResp(response))
    const loadMock = vi.fn<
      (
        sessionId: string,
        utterances: Utterance[],
      ) => Promise<Map<string, HowlLike>>
    >(async () => new Map<string, HowlLike>())

    await prepareMathPathA(plan, plan.id, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: loadMock,
      playSessionUtterance: vi.fn(async () => {}),
    })

    expect(loadMock).toHaveBeenCalledOnce()
    const [sessionId, utterances] = loadMock.mock.calls[0]!
    expect(sessionId).toBe(plan.id)
    expect(utterances).toHaveLength(response.utterances.length)
  })

  it('returned playUtterance plays by id matched from text', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(plan)),
    )
    const playMock = vi.fn<
      (id: string, opts?: PlaySessionUtteranceOptions) => Promise<void>
    >(async () => {})

    const prepared = await prepareMathPathA(plan, plan.id, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map()),
      playSessionUtterance: playMock,
    })

    // Speak problem 1's read line.
    const text = plan.problems[0]!.utterances.read
    await prepared.playUtterance(text)

    expect(playMock).toHaveBeenCalledOnce()
    const [id] = playMock.mock.calls[0]!
    expect(id).toBe('math.p1.read')
  })

  it('forwards onPlay and onWordTick callbacks through to playSessionUtterance', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = vi.fn(async () => jsonResp(buildServerResponse(plan)))
    const playMock = vi.fn(
      async (_id: string, opts?: PlaySessionUtteranceOptions) => {
        opts?.onPlay?.()
        opts?.onWordTick?.(0)
        opts?.onWordTick?.(1)
      },
    )
    const prepared = await prepareMathPathA(plan, plan.id, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map()),
      playSessionUtterance: playMock,
    })

    const onPlay = vi.fn()
    const onWordTick = vi.fn()
    await prepared.playUtterance(plan.problems[0]!.utterances.correct, {
      onPlay,
      onWordTick,
    })
    expect(onPlay).toHaveBeenCalledOnce()
    expect(onWordTick).toHaveBeenCalledTimes(2)
    expect(onWordTick).toHaveBeenNthCalledWith(1, 0)
    expect(onWordTick).toHaveBeenNthCalledWith(2, 1)
  })

  it('handles duplicate-text utterances by picking the first matching id', async () => {
    // The reprompt text is identical across all 8 problems — must resolve
    // to math.p1.reprompt (first-wins).
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = vi.fn(async () => jsonResp(buildServerResponse(plan)))
    const playMock = vi.fn(async () => {})
    const prepared = await prepareMathPathA(plan, plan.id, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map()),
      playSessionUtterance: playMock,
    })

    await prepared.playUtterance('Hmm... try again?')
    expect(playMock).toHaveBeenCalledWith('math.p1.reprompt', expect.anything())
  })

  it('returns utteranceCount and a textToId map for diagnostics', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = vi.fn(async () => jsonResp(buildServerResponse(plan)))

    const prepared = await prepareMathPathA(plan, plan.id, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map()),
      playSessionUtterance: vi.fn(async () => {}),
    })

    expect(prepared.utteranceCount).toBe(40)
    expect(prepared.textToId.get('Hmm... try again?')).toBe('math.p1.reprompt')
  })

  it('unload() forwards to unloadSessionAudio', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = vi.fn(async () => jsonResp(buildServerResponse(plan)))
    const unloadMock = vi.fn()

    const prepared = await prepareMathPathA(plan, plan.id, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map()),
      playSessionUtterance: vi.fn(async () => {}),
      unloadSessionAudio: unloadMock,
    })

    prepared.unload()
    expect(unloadMock).toHaveBeenCalledOnce()
  })
})

describe('prepareMathPathA — failure paths', () => {
  it('throws config-missing when /api/claude returns the config-missing error', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = vi.fn(async () =>
      jsonResp({ error: 'config-missing' }, { status: 500 }),
    )

    await expect(
      prepareMathPathA(plan, plan.id, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      }),
    ).rejects.toMatchObject({
      name: 'PrepareMathPathAError',
      code: 'config-missing',
    })
  })

  it('throws tts-failed when the server emits tts-failed', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = vi.fn(async () =>
      jsonResp({ error: 'tts-failed' }, { status: 502 }),
    )

    await expect(
      prepareMathPathA(plan, plan.id, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      }),
    ).rejects.toMatchObject({
      code: 'tts-failed',
    })
  })

  it('throws invalid-response when the server returns malformed JSON', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = vi.fn(
      async () =>
        new Response('not-json-at-all', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    await expect(
      prepareMathPathA(plan, plan.id, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      }),
    ).rejects.toMatchObject({
      code: 'invalid-response',
    })
  })

  it('throws invalid-response when the response shape is wrong', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = vi.fn(async () =>
      jsonResp({ ok: true, kind: 'session-start', stub: true, note: 'hi' }),
    )

    await expect(
      prepareMathPathA(plan, plan.id, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('throws network-error when fetch itself rejects', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = vi.fn(async () => {
      throw new TypeError('network down')
    })

    await expect(
      prepareMathPathA(plan, plan.id, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      }),
    ).rejects.toMatchObject({ code: 'network-error' })
  })

  it('throws aborted when fetch is aborted via signal', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = vi.fn(async () => {
      const err = new DOMException('aborted', 'AbortError')
      throw err
    })

    const controller = new AbortController()
    controller.abort()

    await expect(
      prepareMathPathA(plan, plan.id, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        signal: controller.signal,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      }),
    ).rejects.toMatchObject({ code: 'aborted' })
  })
})

describe('prepareMathPathA — playUtterance edge cases', () => {
  it('ticks captions and resolves silently when text has no matching utterance', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = vi.fn(async () => jsonResp(buildServerResponse(plan)))
    const playMock = vi.fn(async () => {})
    const prepared = await prepareMathPathA(plan, plan.id, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map()),
      playSessionUtterance: playMock,
    })

    const onPlay = vi.fn()
    const onWordTick = vi.fn()
    await prepared.playUtterance('text the server never rendered', {
      onPlay,
      onWordTick,
    })

    // playSessionUtterance NEVER called for unmatched text.
    expect(playMock).not.toHaveBeenCalled()
    // Caption still ticks so the screen doesn't freeze.
    expect(onPlay).toHaveBeenCalledOnce()
    expect(onWordTick).toHaveBeenCalledTimes(5) // 5 words in the fallback text
  })
})

describe('PrepareMathPathAError', () => {
  it('preserves code and message', () => {
    const err = new PrepareMathPathAError('tts-failed', 'kaboom')
    expect(err.code).toBe('tts-failed')
    expect(err.message).toBe('kaboom')
    expect(err.name).toBe('PrepareMathPathAError')
    expect(err).toBeInstanceOf(Error)
  })
})
