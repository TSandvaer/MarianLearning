/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest'
import {
  extractUtteranceTexts,
  EMMA_VOICE_CONFIG,
  renderSessionAudio,
} from './_session.js'
import type { TtsRequest } from './_tts.js'

describe('extractUtteranceTexts', () => {
  it('returns [] for non-object plans', () => {
    expect(extractUtteranceTexts(null)).toEqual([])
    expect(extractUtteranceTexts(undefined)).toEqual([])
    expect(extractUtteranceTexts('hello')).toEqual([])
    expect(extractUtteranceTexts(42)).toEqual([])
  })

  it('returns [] when plan has no utterances field', () => {
    expect(extractUtteranceTexts({ problems: [] })).toEqual([])
  })

  it('returns the well-formed utterance entries from the plan', () => {
    const plan = {
      utterances: [
        { id: 'p1.intro', text: 'Two plus three.' },
        { id: 'p1.hint', text: 'Try counting on your fingers.' },
        { id: 'malformed', text: 42 }, // dropped
        null, // dropped
        { id: 'p2.intro', text: 'Five plus four.' },
      ],
    }
    expect(extractUtteranceTexts(plan)).toEqual([
      { id: 'p1.intro', text: 'Two plus three.' },
      { id: 'p1.hint', text: 'Try counting on your fingers.' },
      { id: 'p2.intro', text: 'Five plus four.' },
    ])
  })
})

describe('EMMA_VOICE_CONFIG', () => {
  it('uses the British Olivia voice at -10% (British-voice rollout, 2026-06-06)', () => {
    // Voice swapped en-US-EmmaMultilingualNeural → en-GB-OliviaNeural on
    // 2026-06-06 (Thomas directive) — the US voice mangled isolated short-
    // vowel phonemes in the letter-sounds tier. See the constant's
    // docstring for full history. Rate / pitch / volume are unchanged
    // across the swap.
    expect(EMMA_VOICE_CONFIG).toEqual({
      voice: 'en-GB-OliviaNeural',
      rate: '-10%',
      pitch: '+0Hz',
      volume: '+0%',
    })
  })
})

describe('renderSessionAudio', () => {
  it('passes every utterance through synth with the Emma multilingual voice config', async () => {
    const synth = vi.fn(async (req: TtsRequest) => ({
      audio: new TextEncoder().encode(`audio-for-${req.text}`),
    }))
    const plan = {
      utterances: [
        { id: 'a', text: 'Hello.' },
        { id: 'b', text: 'World.' },
      ],
    }

    const out = await renderSessionAudio(plan, { synth })

    expect(out.kind).toBe('session-start')
    expect(out.ok).toBe(true)
    expect(out.plan).toBe(plan)
    expect(out.utterances).toHaveLength(2)
    expect(synth).toHaveBeenCalledTimes(2)

    for (const call of synth.mock.calls) {
      const req = call[0] as TtsRequest
      expect(req.voice).toBe('en-GB-OliviaNeural')
      expect(req.rate).toBe('-10%')
      expect(req.pitch).toBe('+0Hz')
      expect(req.volume).toBe('+0%')
    }
  })

  it('preserves utterance order even with parallel rendering', async () => {
    // Synth resolves out of order to prove the merge still keeps id order.
    const delays: Record<string, number> = {
      a: 30,
      b: 10,
      c: 20,
    }
    const synth = vi.fn(async (req: TtsRequest) => {
      const id = (req.text.match(/text-(\w)/) ?? ['', ''])[1]!
      await new Promise((r) => setTimeout(r, delays[id] ?? 0))
      return { audio: new TextEncoder().encode(req.text) }
    })

    const plan = {
      utterances: [
        { id: 'a', text: 'text-a' },
        { id: 'b', text: 'text-b' },
        { id: 'c', text: 'text-c' },
      ],
    }
    const out = await renderSessionAudio(plan, { synth, concurrency: 3 })

    expect(out.utterances.map((u) => u.id)).toEqual(['a', 'b', 'c'])
    expect(out.utterances.map((u) => u.text)).toEqual([
      'text-a',
      'text-b',
      'text-c',
    ])
  })

  it('encodes audio bytes as base64 with the correct mime', async () => {
    const synth = vi.fn(async () => ({
      audio: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
    }))
    const plan = { utterances: [{ id: 'x', text: 'hi' }] }
    const out = await renderSessionAudio(plan, { synth })
    expect(out.utterances[0]!.audio).toEqual({
      kind: 'inline',
      base64: '3q2+7w==',
      mime: 'audio/mpeg',
    })
  })

  it('returns an empty utterance list when the plan has no utterances', async () => {
    const synth = vi.fn()
    const out = await renderSessionAudio({}, { synth })
    expect(out.utterances).toEqual([])
    expect(synth).not.toHaveBeenCalled()
  })

  it('respects the concurrency cap (no more than N parallel synth calls)', async () => {
    let inFlight = 0
    let observedMax = 0
    const synth = vi.fn(async (req: TtsRequest) => {
      inFlight += 1
      observedMax = Math.max(observedMax, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight -= 1
      return { audio: new TextEncoder().encode(req.text) }
    })

    const plan = {
      utterances: Array.from({ length: 8 }, (_, i) => ({
        id: `u${i}`,
        text: `t${i}`,
      })),
    }
    await renderSessionAudio(plan, { synth, concurrency: 3 })
    expect(observedMax).toBeLessThanOrEqual(3)
    expect(synth).toHaveBeenCalledTimes(8)
  })

  // --- Soft-fail semantics (ticket 86c9kjdh2) ---------------------------
  //
  // Prior to ticket 86c9kjdh2, ANY synth rejection aborted the whole batch
  // and renderSessionAudio rejected → handler returned 502 tts-failed.
  // After 86c9kjdh2 the synth dependency is responsible for retrying
  // transient Azure failures (see _tts.fetchWithBackoff); when it still
  // rejects here, the failure is genuinely terminal for THAT utterance,
  // and the rest of the batch keeps rendering. The handler returns 200
  // with the partial set; the browser falls back to caption-only for
  // missing utterance ids.

  it('soft-fails a single utterance and keeps rendering the rest (200 with partial set)', async () => {
    // Two utterances: index 1 fails permanently. We expect index 0 to
    // render normally and the response to omit the failed slot.
    const synth = vi.fn(async (req: TtsRequest) => {
      if (req.text === 'fail-me') throw new Error('terminal-tts-failure')
      return { audio: new TextEncoder().encode(`audio-for-${req.text}`) }
    })
    const plan = {
      utterances: [
        { id: 'ok', text: 'render-me' },
        { id: 'bad', text: 'fail-me' },
        { id: 'ok2', text: 'render-me-too' },
      ],
    }
    const out = await renderSessionAudio(plan, { synth, concurrency: 1 })
    expect(out.ok).toBe(true)
    expect(out.kind).toBe('session-start')
    expect(out.utterances.map((u) => u.id)).toEqual(['ok', 'ok2'])
    expect(synth).toHaveBeenCalledTimes(3)
  })

  it('returns 200 OK with empty utterances when ALL utterances fail (no 502 escalation)', async () => {
    const synth = vi.fn(async () => {
      throw new Error('azure fully down')
    })
    const plan = {
      utterances: [
        { id: 'a', text: 't1' },
        { id: 'b', text: 't2' },
      ],
    }
    const out = await renderSessionAudio(plan, { synth })
    expect(out.ok).toBe(true)
    expect(out.utterances).toEqual([])
    expect(synth).toHaveBeenCalledTimes(2)
  })

  it('keeps draining the queue across failures (does NOT abort the pool)', async () => {
    // Regression guard for the prior abort-on-first-failure semantics.
    // Six utterances, concurrency 3, the SECOND synth call fails. All
    // six utterances must still be attempted.
    let callIndex = 0
    const synth = vi.fn(async (req: TtsRequest) => {
      const myIndex = callIndex++
      if (myIndex === 1) {
        await new Promise((r) => setTimeout(r, 5))
        throw new Error('mid-batch boom')
      }
      await new Promise((r) => setTimeout(r, 1))
      return { audio: new TextEncoder().encode(req.text) }
    })
    const plan = {
      utterances: Array.from({ length: 6 }, (_, i) => ({
        id: `u${i}`,
        text: `t${i}`,
      })),
    }
    const out = await renderSessionAudio(plan, { synth, concurrency: 3 })
    // All six were attempted; one failed; five rendered.
    expect(synth).toHaveBeenCalledTimes(6)
    expect(out.utterances).toHaveLength(5)
  })

  it('preserves utterance order across mixed success/failure', async () => {
    const synth = vi.fn(async (req: TtsRequest) => {
      if (req.text.includes('fail')) throw new Error('boom')
      // Vary the resolution order to prove the merge respects source order.
      const slowFor = req.text.includes('slow') ? 20 : 1
      await new Promise((r) => setTimeout(r, slowFor))
      return { audio: new TextEncoder().encode(req.text) }
    })
    const plan = {
      utterances: [
        { id: 'a', text: 'a-slow' },
        { id: 'b', text: 'b-fail' },
        { id: 'c', text: 'c-fast' },
        { id: 'd', text: 'd-fast' },
      ],
    }
    const out = await renderSessionAudio(plan, { synth, concurrency: 4 })
    expect(out.utterances.map((u) => u.id)).toEqual(['a', 'c', 'd'])
  })

  it('does not leak unhandled rejections when synth fails', async () => {
    // Even though we no longer escalate to a function-level rejection,
    // worker promises must still be settled cleanly so per-utterance
    // failures don't bubble up to UnhandledPromiseRejection.
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)

    try {
      const synth = vi.fn(async () => {
        throw new Error('fail-quietly')
      })
      const plan = {
        utterances: Array.from({ length: 6 }, (_, i) => ({
          id: `u${i}`,
          text: `t${i}`,
        })),
      }
      const out = await renderSessionAudio(plan, { synth, concurrency: 3 })
      expect(out.utterances).toEqual([])

      // Give any orphan rejections a tick to surface.
      await new Promise((r) => setTimeout(r, 20))
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('non-Error synth rejections still soft-fail with the stringified message', async () => {
    const synth = vi.fn(async () => {
      throw 'string-rejection'
    })
    const plan = { utterances: [{ id: 'a', text: 't' }] }
    const out = await renderSessionAudio(plan, { synth })
    // Soft-fail: empty utterances, 200 ok shape.
    expect(out.utterances).toEqual([])
  })
})
