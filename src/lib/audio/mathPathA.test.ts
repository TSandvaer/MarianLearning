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

/** Build a successful SessionStartResponse from one of the static plans —
 *  same id/label, same utterances, same audio data. The track-based
 *  switchover (ticket 86c9jteud) means the browser asks for {track, level,
 *  childName} and the server returns whatever plan it generates; for
 *  tests we feed the static plan back through the wire so the round-trip
 *  rehydration via `mathSessionPlanFromServer` produces a known plan. */
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

const STD_ARGS = { level: 1, childName: 'Marian', sessionId: 'test-session-1' }

describe('prepareMathPathA — happy path', () => {
  it('POSTs the track-based payload to /api/claude with kind=session-start', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(plan)),
    )

    await prepareMathPathA(STD_ARGS, {
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
    // Default args (no progress fields) → no progress block on the wire.
    // Backwards-compat with the pre-M2 server contract: legacy clients
    // sending exactly `{track, level, childName}` must keep working.
    expect(body.payload).toEqual({
      track: 'math',
      level: 1,
      childName: 'Marian',
    })
  })

  it('attaches a progress block when focusNode + recentSuccessRate are supplied (M2 — ticket 86c9kmwba)', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(plan)),
    )

    await prepareMathPathA(
      {
        ...STD_ARGS,
        focusNode: 'add-to-20',
        recentSuccessRate: 0.66,
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
      track: 'math',
      level: 1,
      childName: 'Marian',
      progress: {
        focusNode: 'add-to-20',
        recentSuccessRate: 0.66,
      },
    })
  })

  it('forwards recentSuccessRate=null verbatim (planner needs to distinguish "no data" from 0.0)', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(plan)),
    )

    await prepareMathPathA(
      {
        ...STD_ARGS,
        focusNode: 'add-to-10',
        recentSuccessRate: null,
      },
      {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      },
    )

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init?.body as string) as {
      payload: { progress: { recentSuccessRate: unknown } }
    }
    // null is the explicit "no data" sentinel — must appear as null, not
    // dropped to undefined or coerced to 0.
    expect(body.payload.progress.recentSuccessRate).toBeNull()
  })

  it('returns the rehydrated MathSessionPlan from the server response', async () => {
    const sourcePlan = STATIC_SESSION_PLANS[1]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(sourcePlan)),
    )

    const prepared = await prepareMathPathA(STD_ARGS, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map()),
      playSessionUtterance: vi.fn(async () => {}),
    })

    expect(prepared.plan.id).toBe(sourcePlan.id)
    expect(prepared.plan.label).toBe(sourcePlan.label)
    expect(prepared.plan.problems).toHaveLength(8)
    expect(prepared.plan.problems[0]!.addendA).toBe(
      sourcePlan.problems[0]!.addendA,
    )
    expect(prepared.plan.problems[0]!.addendB).toBe(
      sourcePlan.problems[0]!.addendB,
    )
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

    await prepareMathPathA(STD_ARGS, {
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
    const plan = STATIC_SESSION_PLANS[0]!
    const fetchMock = makeFetchMock(async () =>
      jsonResp(buildServerResponse(plan)),
    )
    const playMock = vi.fn<
      (id: string, opts?: PlaySessionUtteranceOptions) => Promise<void>
    >(async () => {})

    const prepared = await prepareMathPathA(STD_ARGS, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map()),
      playSessionUtterance: playMock,
    })

    // Speak problem 1's read line.
    const text = prepared.plan.problems[0]!.utterances.read
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
    const prepared = await prepareMathPathA(STD_ARGS, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      loadSessionAudio: vi.fn(async () => new Map()),
      playSessionUtterance: playMock,
    })

    const onPlay = vi.fn()
    const onWordTick = vi.fn()
    await prepared.playUtterance(
      prepared.plan.problems[0]!.utterances.correct,
      {
        onPlay,
        onWordTick,
      },
    )
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
    const prepared = await prepareMathPathA(STD_ARGS, {
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

    const prepared = await prepareMathPathA(STD_ARGS, {
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

    const prepared = await prepareMathPathA(STD_ARGS, {
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
    const fetchMock = vi.fn(async () =>
      jsonResp({ error: 'config-missing' }, { status: 500 }),
    )

    await expect(
      prepareMathPathA(STD_ARGS, {
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
    const fetchMock = vi.fn(async () =>
      jsonResp({ error: 'tts-failed' }, { status: 502 }),
    )

    await expect(
      prepareMathPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      }),
    ).rejects.toMatchObject({
      code: 'tts-failed',
    })
  })

  it('throws rate-limited when the server emits the 429 rate-limited code', async () => {
    // Track-based payloads go through api/claude.ts:sessionStartLimiter;
    // the 429 envelope is `{ error: "rate-limited", message: ... }`.
    const fetchMock = vi.fn(async () =>
      jsonResp(
        { error: 'rate-limited', message: 'too many starts' },
        { status: 429 },
      ),
    )

    await expect(
      prepareMathPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      }),
    ).rejects.toMatchObject({
      name: 'PrepareMathPathAError',
      code: 'rate-limited',
    })
  })

  it('throws planner-failed when the server emits the 502 planner-failed code', async () => {
    // Distinct from tts-failed: planner-failed means Haiku itself
    // returned malformed JSON or the Anthropic call errored. The
    // browser falls back to silent mode either way; the code matters
    // for QA log attribution.
    const fetchMock = vi.fn(async () =>
      jsonResp({ error: 'planner-failed' }, { status: 502 }),
    )

    await expect(
      prepareMathPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      }),
    ).rejects.toMatchObject({
      name: 'PrepareMathPathAError',
      code: 'planner-failed',
    })
  })

  it('throws invalid-response when the server returns malformed JSON', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('not-json-at-all', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    await expect(
      prepareMathPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      }),
    ).rejects.toMatchObject({
      code: 'invalid-response',
    })
  })

  it('throws invalid-response when the response shape is wrong', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResp({ ok: true, kind: 'session-start', stub: true, note: 'hi' }),
    )

    await expect(
      prepareMathPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('throws invalid-response when the server plan fails to parse (drifted read line)', async () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const good = buildServerResponse(plan)
    // Drift problem-1's read line off template — planFromServer should
    // throw, and the wiring should surface as 'invalid-response'.
    const broken: SessionStartResponse = {
      ...good,
      plan: {
        id: plan.id,
        label: plan.label,
        utterances: mathSessionPlanToUtteranceSources(plan).map((u) =>
          u.id === 'math.p1.read'
            ? { ...u, text: 'How many is three plus two?' }
            : u,
        ),
      },
    }
    const fetchMock = vi.fn(async () => jsonResp(broken))

    await expect(
      prepareMathPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('throws network-error when fetch itself rejects', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('network down')
    })

    await expect(
      prepareMathPathA(STD_ARGS, {
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        loadSessionAudio: vi.fn(async () => new Map()),
        playSessionUtterance: vi.fn(async () => {}),
      }),
    ).rejects.toMatchObject({ code: 'network-error' })
  })

  it('throws aborted when fetch is aborted via signal', async () => {
    const fetchMock = vi.fn(async () => {
      const err = new DOMException('aborted', 'AbortError')
      throw err
    })

    const controller = new AbortController()
    controller.abort()

    await expect(
      prepareMathPathA(STD_ARGS, {
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
    const prepared = await prepareMathPathA(STD_ARGS, {
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

  it('preserves rate-limited code', () => {
    const err = new PrepareMathPathAError('rate-limited', 'slow down')
    expect(err.code).toBe('rate-limited')
  })

  it('preserves planner-failed code', () => {
    const err = new PrepareMathPathAError('planner-failed', 'haiku borked')
    expect(err.code).toBe('planner-failed')
  })
})
