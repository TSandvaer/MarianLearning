/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest'
import {
  extractUtteranceTexts,
  MELODY_VOICE_CONFIG,
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

describe('MELODY_VOICE_CONFIG', () => {
  it('matches PR #25 Plan B Greet voice — AnaNeural at -10%', () => {
    expect(MELODY_VOICE_CONFIG).toEqual({
      voice: 'en-US-AnaNeural',
      rate: '-10%',
      pitch: '+0Hz',
      volume: '+0%',
    })
  })
})

describe('renderSessionAudio', () => {
  it('passes every utterance through synth with the AnaNeural voice config', async () => {
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
      expect(req.voice).toBe('en-US-AnaNeural')
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

  it('rejects (propagates) when synth throws — the function-level handler maps this to tts-failed', async () => {
    const synth = vi.fn(async () => {
      throw new Error('upstream blew up')
    })
    const plan = { utterances: [{ id: 'a', text: 't' }] }
    await expect(renderSessionAudio(plan, { synth })).rejects.toThrow(
      /upstream blew up/,
    )
  })

  it('aborts in-flight workers on first failure and does NOT leak unhandled rejections', async () => {
    // Mid-batch failure scenario: 6 utterances, concurrency 3. Worker that
    // picks up index 1 fails fast. The other two workers are mid-`await`
    // on slow synths. The fix: on first failure, sibling workers see the
    // shared `aborted` flag and short-circuit before pulling their next
    // utterance, so their pending awaits resolve cleanly. Promise.allSettled
    // observes every worker promise so no rejection escapes as unhandled.
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)

    try {
      let callIndex = 0
      const synth = vi.fn(async (req: TtsRequest) => {
        const myIndex = callIndex++
        if (myIndex === 1) {
          // Fail fast before the slow workers finish.
          await new Promise((r) => setTimeout(r, 5))
          throw new Error('mid-batch boom')
        }
        // Slow workers — finish AFTER the failure has propagated.
        await new Promise((r) => setTimeout(r, 30))
        return { audio: new TextEncoder().encode(req.text) }
      })

      const plan = {
        utterances: Array.from({ length: 6 }, (_, i) => ({
          id: `u${i}`,
          text: `t${i}`,
        })),
      }
      await expect(
        renderSessionAudio(plan, { synth, concurrency: 3 }),
      ).rejects.toThrow(/mid-batch boom/)

      // Give any orphan rejections a tick to surface.
      await new Promise((r) => setTimeout(r, 50))
      expect(unhandled).toEqual([])

      // Work was aborted: the in-flight slow workers each completed at most
      // their current iteration, and the queue did NOT continue draining.
      // (Concurrency 3 with 6 items: at most 3 calls are in-flight when the
      // boom hits; survivors complete their CURRENT item, not the queue.)
      expect(synth.mock.calls.length).toBeLessThan(6)
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('surfaces a non-Error rejection by wrapping it in an Error', async () => {
    // Defensive: a synth implementation that rejects with a non-Error
    // value (e.g. a string) shouldn't crash our Error-instanceof checks.
    const synth = vi.fn(async () => {
      throw 'string-rejection'
    })
    const plan = { utterances: [{ id: 'a', text: 't' }] }
    await expect(renderSessionAudio(plan, { synth })).rejects.toThrow(
      /string-rejection/,
    )
  })
})
