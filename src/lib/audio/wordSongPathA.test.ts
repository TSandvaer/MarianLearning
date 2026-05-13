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

/** Build a successful SessionStartResponse from one of the static plans —
 *  same id/label, same utterances, same audio data. The track-based
 *  switchover (ticket 86c9jteud) means the browser asks for {track, level,
 *  childName} and the server returns whatever plan it generates; for
 *  tests we feed the static plan back through the wire so the round-trip
 *  rehydration via `wordSongSessionPlanFromServer` produces a known plan. */
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

const STD_ARGS = {
  level: 1,
  childName: 'Marian',
  sessionId: 'test-session-ws-1',
}

describe('prepareWordSongPathA — happy path', () => {
  it('POSTs the track-based payload to /api/claude with kind=session-start', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(plan)),
    )

    await prepareWordSongPathA(STD_ARGS, {
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
    // No progress fields on default STD_ARGS → no progress block on the
    // wire (backwards-compat with the pre-M2 server contract).
    expect(body.payload).toEqual({
      track: 'word-song',
      level: 1,
      childName: 'Marian',
    })
  })

  it('attaches a progress block when focusNode + recentSuccessRate are supplied (M2 — ticket 86c9kmwba)', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(plan)),
    )

    await prepareWordSongPathA(
      {
        ...STD_ARGS,
        focusNode: 'cvc-words',
        recentSuccessRate: 0.5,
      },
      {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      },
    )

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init?.body as string) as {
      payload: Record<string, unknown>
    }
    expect(body.payload).toEqual({
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      progress: {
        focusNode: 'cvc-words',
        recentSuccessRate: 0.5,
      },
    })
  })

  it('returns the rehydrated WordSongSessionPlan from the server response', async () => {
    const sourcePlan = STATIC_WORD_SONG_PLANS[1]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(sourcePlan)),
    )

    const prepared = await prepareWordSongPathA(STD_ARGS, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map()),
      playSessionUtterance: vi.fn(async () => {}),
    })

    expect(prepared.plan.id).toBe(sourcePlan.id)
    expect(prepared.plan.label).toBe(sourcePlan.label)
    expect(prepared.plan.problems).toHaveLength(8)
    expect(prepared.plan.problems[0]!.target.word).toBe(
      sourcePlan.problems[0]!.target.word,
    )
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

    await prepareWordSongPathA(STD_ARGS, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: loadMock,
      playSessionUtterance: vi.fn(async () => {}),
    })

    expect(loadMock).toHaveBeenCalledOnce()
    const [sessionId, utterances] = loadMock.mock.calls[0]!
    expect(sessionId).toBe(STD_ARGS.sessionId)
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

    const prepared = await prepareWordSongPathA(STD_ARGS, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map<string, HowlLike>()),
      playSessionUtterance: playMock,
    })

    // Play problem 1's read text.
    await prepared.playUtterance(prepared.plan.problems[0]!.utterances.read)
    expect(playMock).toHaveBeenCalledOnce()
    const [utteranceId] = playMock.mock.calls[0]!
    expect(utteranceId).toBe('word.p1.read')
  })

  it('falls soft when text is not found — fires onPlay + onWordTick + resolves', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(plan)),
    )

    const prepared = await prepareWordSongPathA(STD_ARGS, {
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

    const prepared = await prepareWordSongPathA(STD_ARGS, {
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

    const prepared = await prepareWordSongPathA(STD_ARGS, {
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
    const fetchMock = makeFetchMock(async () =>
      jsonResp({ error: 'config-missing' }, { status: 503 }),
    )

    await expect(
      prepareWordSongPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toMatchObject({ code: 'config-missing' })
  })

  it('throws tts-failed when server returns 502 with that error code', async () => {
    const fetchMock = makeFetchMock(async () =>
      jsonResp({ error: 'tts-failed' }, { status: 502 }),
    )

    await expect(
      prepareWordSongPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toMatchObject({ code: 'tts-failed' })
  })

  it('throws rate-limited when server returns 429 with that error code', async () => {
    const fetchMock = makeFetchMock(async () =>
      jsonResp(
        { error: 'rate-limited', message: 'too many starts' },
        { status: 429 },
      ),
    )

    await expect(
      prepareWordSongPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toMatchObject({
      name: 'PrepareWordSongPathAError',
      code: 'rate-limited',
    })
  })

  it('throws planner-failed when server returns 502 with that error code', async () => {
    const fetchMock = makeFetchMock(async () =>
      jsonResp({ error: 'planner-failed' }, { status: 502 }),
    )

    await expect(
      prepareWordSongPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toMatchObject({
      name: 'PrepareWordSongPathAError',
      code: 'planner-failed',
    })
  })

  it('throws network-error when fetch itself rejects', async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      throw new Error('network down')
    })

    await expect(
      prepareWordSongPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toMatchObject({ code: 'network-error' })
  })

  it('throws aborted when fetch raises AbortError', async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      throw new DOMException('aborted', 'AbortError')
    })

    await expect(
      prepareWordSongPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toMatchObject({ code: 'aborted' })
  })

  it('throws invalid-response when server response is not the expected shape', async () => {
    const fetchMock = makeFetchMock(async () =>
      jsonResp({ ok: true, kind: 'session-start' }),
    )

    await expect(
      prepareWordSongPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('throws invalid-response when the server plan fails to parse (non-target word)', async () => {
    const plan = STATIC_WORD_SONG_PLANS[0]!
    const good = buildServerResponse(plan)
    const broken: SessionStartResponse = {
      ...good,
      plan: {
        id: plan.id,
        label: plan.label,
        utterances: wordSongSessionPlanToUtteranceSources(plan).map((u) =>
          // Post the short-e promotion (ticket 86c9teua2), `pen` flipped
          // to `isTarget: true` and `DISTRACTOR_ONLY_WORDS` is empty.
          // Use `'ten'` — explicitly rejected from short-e §1 audit
          // (abstract number, no stable noun-form picture) — to exercise
          // the non-target rejection path.
          u.id === 'word.p1.read' ? { ...u, text: 'Tap the ten.' } : u,
        ),
      },
    }
    const fetchMock = makeFetchMock(async () => jsonResp(broken))

    await expect(
      prepareWordSongPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map<string, HowlLike>()),
        playSessionUtterance: vi.fn(async () => {}),
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

  it('PrepareWordSongPathAError preserves rate-limited code', () => {
    const err = new PrepareWordSongPathAError('rate-limited', 'slow down')
    expect(err.code).toBe('rate-limited')
  })

  it('PrepareWordSongPathAError preserves planner-failed code', () => {
    const err = new PrepareWordSongPathAError('planner-failed', 'haiku borked')
    expect(err.code).toBe('planner-failed')
  })
})
