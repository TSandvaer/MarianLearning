/**
 * @vitest-environment node
 *
 * Unit tests for the session-plan generator (`generateSessionPlan`).
 *
 * The Anthropic SDK is dependency-injected so we can mock the
 * `messages.create` response and assert request shape (model, system prompt,
 * cache-control breakpoints) + response parsing in isolation. Real network
 * calls happen only in the manual smoke-test path, never in CI.
 *
 * What we DO test here:
 *   - Request shape: model is pinned to claude-haiku-4-5-20251001
 *   - Prompt caching: system prompt has cache_control on its last block
 *   - Track branching: math vs word-song use different prompts + shapes
 *   - Response parsing: well-formed JSON → typed plan
 *   - Bad-shape responses are rejected with a typed error
 *   - Missing API key is surfaced as a typed error (not an SDK throw)
 *
 * What we do NOT test here (covered by claude.test.ts integration tests):
 *   - End-to-end /api/claude POST flow
 *   - TTS rendering (renderSessionAudio is its own pure function)
 *   - Rate-limit middleware
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  generateSessionPlan,
  PlannerError,
  type GenerateSessionPlanArgs,
  type PlannerAnthropicClient,
} from './_planner.js'

/**
 * Factory for a mock Anthropic client. The SDK exposes `client.messages.create`
 * which returns a Message object; we narrow the surface to just what the
 * planner uses so the mock is shape-stable.
 */
function makeMockClient(
  responseText: string,
  opts: { capture?: { lastArgs?: unknown } } = {},
): PlannerAnthropicClient {
  return {
    messages: {
      create: vi.fn(async (args: unknown) => {
        if (opts.capture) opts.capture.lastArgs = args
        return {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: responseText }],
          model: 'claude-haiku-4-5-20251001',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        }
      }),
    },
  }
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
})

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
  vi.restoreAllMocks()
})

describe('generateSessionPlan — math track', () => {
  // A well-formed math plan response that the planner should accept and parse.
  // Mirrors the shape declared by mathSessionPlanToUtteranceSources: the model
  // returns an object with `id`, `label`, and `utterances: { id, text }[]`.
  const MATH_PLAN_RESPONSE = JSON.stringify({
    id: 'haiku-math-001',
    label: 'Sums to 10 — Haiku-generated',
    utterances: [
      { id: 'math.p1.read', text: 'Three plus two. How many?' },
      { id: 'math.p1.correct', text: 'Yes! Five!' },
      { id: 'math.p1.reprompt', text: 'Hmm... try again?' },
      { id: 'math.p1.hint', text: 'Look. Three. And two more. How many now?' },
      { id: 'math.p1.giveAnswer', text: 'This one is five.' },
    ],
  })

  it('calls Anthropic with the pinned Haiku model id', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
    })

    const args = capture.lastArgs as { model: string }
    // Pinned model id — never `claude-haiku-latest`, never an alias. Per the
    // ticket and `feedback_run_vitest_before_merge.md` style: model swaps are
    // a deliberate code change, not an at-runtime concern.
    expect(args.model).toBe('claude-haiku-4-5-20251001')
  })

  it('caches the system prompt (cache_control on the last system block)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
    })

    const args = capture.lastArgs as {
      system: Array<{ type: string; text: string; cache_control?: unknown }>
    }
    // System must be an array (not a bare string) so we can attach
    // cache_control. The LAST block carries the breakpoint (per
    // shared/prompt-caching.md — render order is tools → system → messages,
    // and a marker on the last system block caches everything before it).
    expect(Array.isArray(args.system)).toBe(true)
    expect(args.system.length).toBeGreaterThan(0)
    const last = args.system[args.system.length - 1]!
    expect(last.cache_control).toEqual({ type: 'ephemeral' })
  })

  it('parses a well-formed math plan response into utterance sources', async () => {
    const client = makeMockClient(MATH_PLAN_RESPONSE)

    const plan = await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
    })

    expect(plan.id).toBe('haiku-math-001')
    expect(plan.label).toBe('Sums to 10 — Haiku-generated')
    expect(plan.utterances).toHaveLength(5)
    expect(plan.utterances[0]).toEqual({
      id: 'math.p1.read',
      text: 'Three plus two. How many?',
    })
  })

  it('passes the track + level + childName into the user prompt', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 2,
      childName: 'Marian',
    })

    const args = capture.lastArgs as {
      messages: Array<{ role: string; content: string }>
    }
    expect(args.messages).toHaveLength(1)
    const userPrompt = args.messages[0]!.content
    // Volatile per-call inputs sit in the user message, not the system prompt
    // — keeps the prompt-cache prefix stable across calls.
    expect(userPrompt).toMatch(/math/i)
    expect(userPrompt).toMatch(/level\s*2/i)
    expect(userPrompt).toMatch(/Marian/)
  })
})

describe('generateSessionPlan — word-song track', () => {
  const WORDSONG_PLAN_RESPONSE = JSON.stringify({
    id: 'haiku-word-001',
    label: 'CVC short-a — Haiku-generated',
    utterances: [
      { id: 'word.p1.read', text: 'Tap the cat.' },
      { id: 'word.p1.correct', text: 'Yes! Cat.' },
      { id: 'word.p1.reprompt', text: 'Hmm... try again?' },
      { id: 'word.p1.hint', text: "Let's look. Cat." },
      { id: 'word.p1.giveAnswer', text: 'This one is cat.' },
    ],
  })

  it('parses a well-formed word-song plan response', async () => {
    const client = makeMockClient(WORDSONG_PLAN_RESPONSE)

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
    })

    expect(plan.id).toBe('haiku-word-001')
    expect(plan.utterances[0]!.id).toBe('word.p1.read')
  })

  it('uses a different prompt for word-song vs math', async () => {
    const captureMath: { lastArgs?: unknown } = {}
    const captureWord: { lastArgs?: unknown } = {}

    await generateSessionPlan({
      client: makeMockClient(
        JSON.stringify({
          id: 'm',
          label: 'm',
          utterances: [{ id: 'math.p1.read', text: 'one plus one' }],
        }),
        { capture: captureMath },
      ),
      track: 'math',
      level: 1,
      childName: 'Marian',
    })

    await generateSessionPlan({
      client: makeMockClient(
        JSON.stringify({
          id: 'w',
          label: 'w',
          utterances: [{ id: 'word.p1.read', text: 'tap the cat' }],
        }),
        { capture: captureWord },
      ),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
    })

    const mathSys = (
      captureMath.lastArgs as { system: Array<{ text: string }> }
    ).system
      .map((b) => b.text)
      .join('\n')
    const wordSys = (
      captureWord.lastArgs as { system: Array<{ text: string }> }
    ).system
      .map((b) => b.text)
      .join('\n')

    // Different track → different system prompt content. We don't assert on
    // exact prose (that would couple the test to copy edits), just that the
    // two prompts are not byte-identical.
    expect(mathSys).not.toBe(wordSys)
  })
})

describe('generateSessionPlan — error paths', () => {
  it('throws PlannerError("config-missing") when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY
    // The handler in claude.ts presence-checks the env BEFORE calling the
    // planner, but the planner double-checks defensively so any caller (e.g.
    // a future cron job) gets the same error class.
    const client = makeMockClient('{}')
    await expect(
      generateSessionPlan({
        client,
        track: 'math',
        level: 1,
        childName: 'Marian',
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: 'config-missing',
    })
  })

  it('throws PlannerError("invalid-response") when the model returns non-JSON', async () => {
    const client = makeMockClient('not json at all, sorry')
    await expect(
      generateSessionPlan({
        client,
        track: 'math',
        level: 1,
        childName: 'Marian',
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: 'invalid-response',
    })
  })

  it('throws PlannerError("invalid-response") when the JSON has a wrong shape', async () => {
    // Missing `utterances` field — server can't render audio without one.
    const client = makeMockClient(
      JSON.stringify({ id: 'x', label: 'y' /* no utterances */ }),
    )
    await expect(
      generateSessionPlan({
        client,
        track: 'math',
        level: 1,
        childName: 'Marian',
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: 'invalid-response',
    })
  })

  it('throws PlannerError("invalid-response") when an utterance is malformed', async () => {
    const client = makeMockClient(
      JSON.stringify({
        id: 'x',
        label: 'y',
        utterances: [{ id: 'p1.read' /* missing text */ }],
      }),
    )
    await expect(
      generateSessionPlan({
        client,
        track: 'math',
        level: 1,
        childName: 'Marian',
      }),
    ).rejects.toBeInstanceOf(PlannerError)
  })

  it('throws PlannerError("upstream-error") when the SDK call rejects', async () => {
    const client: PlannerAnthropicClient = {
      messages: {
        create: vi.fn(async () => {
          throw new Error('upstream 500')
        }),
      },
    }
    await expect(
      generateSessionPlan({
        client,
        track: 'math',
        level: 1,
        childName: 'Marian',
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: 'upstream-error',
    })
  })

  it('rejects unknown track values', async () => {
    const client = makeMockClient('{}')
    // Cast through `unknown` so TypeScript's narrowed PlannerTrack can't
    // catch this at compile time — the runtime guard inside
    // generateSessionPlan is what we're exercising. Real callers reach
    // this path only via raw HTTP into /api/claude with a malformed body.
    const args = {
      client,
      track: 'banana-track',
      level: 1,
      childName: 'Marian',
    } as unknown as GenerateSessionPlanArgs
    await expect(generateSessionPlan(args)).rejects.toMatchObject({
      name: 'PlannerError',
      code: 'invalid-request',
    })
  })
})
