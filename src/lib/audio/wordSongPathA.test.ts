import { describe, expect, it, vi } from 'vitest'
import {
  CLAUDE_ENDPOINT,
  PrepareWordSongPathAError,
  prepareWordSongPathA,
} from './wordSongPathA'
import type { HowlLike, PlaySessionUtteranceOptions } from './sessionAudio'
import {
  STATIC_WORD_SONG_PLANS,
  wordSongSessionPlanToUtteranceSources,
  type WordSongSessionPlan,
} from '../../screens/WordSong'
import type { SessionStartResponse, Utterance } from '../../../api/_types'

/** Build a successful SessionStartResponse for the given plan. */
function buildServerResponse(plan: WordSongSessionPlan): SessionStartResponse {
  const sources = wordSongSessionPlanToUtteranceSources(plan)
  const utterances: Utterance[] = sources.map((s, i) => ({
    id: s.id,
    text: s.text,
    audio: {
      kind: 'inline',
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

function jsonResp(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

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

describe('prepareWordSongPathA — happy path', () => {
  it('POSTs the wire-shape plan to /api/claude with kind=session-start', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(plan)),
    )

    await prepareWordSongPathA(plan, plan.id, {
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
    expect(wirePlan.utterances).toHaveLength(40) // 8 × 5 slots
    expect(wirePlan.utterances[0]).toEqual({
      id: 'word.p1.read',
      text: plan.problems[0]!.utterances.read,
    })
  })

  it('calls loadSessionAudio with the rehydrated utterances', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const response = buildServerResponse(plan)
    const fetchMock = makeFetchMock(async () => jsonResp(response))
    const loadMock = vi.fn<
      (
        sessionId: string,
        utterances: Utterance[],
      ) => Promise<Map<string, HowlLike>>
    >(async () => new Map<string, HowlLike>())

    await prepareWordSongPathA(plan, plan.id, {
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
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(plan)),
    )
    const playMock = vi.fn<
      (utteranceId: string, opts?: PlaySessionUtteranceOptions) => Promise<void>
    >(async () => {})

    const prepared = await prepareWordSongPathA(plan, plan.id, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map<string, HowlLike>()),
      playSessionUtterance: playMock,
    })

    // Play problem 1's read text.
    await prepared.playUtterance(plan.problems[0]!.utterances.read)
    expect(playMock).toHaveBeenCalledOnce()
    const [utteranceId] = playMock.mock.calls[0]!
    expect(utteranceId).toBe('word.p1.read')
  })

  it('falls soft when text is not found — fires onPlay + onWordTick + resolves', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(plan)),
    )

    const prepared = await prepareWordSongPathA(plan, plan.id, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map<string, HowlLike>()),
      playSessionUtterance: vi.fn(async () => {}),
    })

    const onPlay = vi.fn()
    const onWordTick = vi.fn()
    await expect(
      prepared.playUtterance('Some text never rendered', {
        onPlay,
        onWordTick,
      }),
    ).resolves.toBeUndefined()

    expect(onPlay).toHaveBeenCalledOnce()
    expect(onWordTick).toHaveBeenCalled() // 4 words → 4 ticks
  })

  it('returns utteranceCount matching the server response', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const response = buildServerResponse(plan)
    const fetchMock = makeFetchMock(async () => jsonResp(response))

    const prepared = await prepareWordSongPathA(plan, plan.id, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map<string, HowlLike>()),
      playSessionUtterance: vi.fn(async () => {}),
    })

    expect(prepared.utteranceCount).toBe(response.utterances.length)
  })

  it('unload() invokes the supplied unloadSessionAudio', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(plan)),
    )
    const unloadMock = vi.fn()

    const prepared = await prepareWordSongPathA(plan, plan.id, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map<string, HowlLike>()),
      playSessionUtterance: vi.fn(async () => {}),
      unloadSessionAudio: unloadMock,
    })

    prepared.unload()
    expect(unloadMock).toHaveBeenCalledOnce()
  })
})

describe('prepareWordSongPathA — error paths', () => {
  it('throws config-missing when server returns 503 with that error code', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp({ error: 'config-missing' }, { status: 503 }),
    )

    await expect(
      prepareWordSongPathA(plan, plan.id, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toMatchObject({ code: 'config-missing' })
  })

  it('throws tts-failed when server returns 502 with that error code', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp({ error: 'tts-failed' }, { status: 502 }),
    )

    await expect(
      prepareWordSongPathA(plan, plan.id, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toMatchObject({ code: 'tts-failed' })
  })

  it('throws network-error when fetch itself rejects', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      throw new Error('network down')
    })

    await expect(
      prepareWordSongPathA(plan, plan.id, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toMatchObject({ code: 'network-error' })
  })

  it('throws aborted when fetch raises AbortError', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      throw new DOMException('aborted', 'AbortError')
    })

    await expect(
      prepareWordSongPathA(plan, plan.id, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toMatchObject({ code: 'aborted' })
  })

  it('throws invalid-response when server response is not the expected shape', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp({ ok: true, kind: 'session-start' }),
    )

    await expect(
      prepareWordSongPathA(plan, plan.id, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('PrepareWordSongPathAError carries a code', () => {
    const err = new PrepareWordSongPathAError(
      'network-error',
      'Path A fetch failed',
    )
    expect(err.code).toBe('network-error')
    expect(err.name).toBe('PrepareWordSongPathAError')
    expect(err.message).toContain('Path A fetch failed')
  })
})
