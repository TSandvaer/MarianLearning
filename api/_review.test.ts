/**
 * @vitest-environment node
 *
 * The review and warm-up branches of /api/claude session-start (native spec
 * `design/native/review-mode-and-warmup-native.md` § 7.4, AC 9–11), over
 * the committed canon in public/canon/.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./_session.js', () => ({
  renderSessionAudio: vi.fn(),
  EMMA_VOICE_CONFIG: {
    voice: 'en-GB-OliviaNeural',
    rate: '-10%',
    pitch: '+0Hz',
    volume: '+0%',
  },
  extractUtteranceTexts: vi.fn(),
}))

import { mathSessionPlanFromServer } from '../packages/core/src/math/planFromServer.js'
import { wordSongSessionPlanFromServer } from '../packages/core/src/wordSong/planFromServer.js'
import { handler } from './claude.js'
import { renderSessionAudio } from './_session.js'
import { getCanonEntry } from './_canon.js'
import { createRateLimiter, type RateLimiter } from './_rateLimit.js'
import { createSessionCache } from './_sessionCache.js'
import {
  VALID_MATH_FOCUS_NODES,
  VALID_WORD_SONG_FOCUS_NODES,
  type PlannerAnthropicClient,
} from './_planner.js'
import type { SessionStartResponse } from './_types.js'

const mockedRender = vi.mocked(renderSessionAudio)

interface Line {
  id: string
  text: string
}

function anthropicSpy(): PlannerAnthropicClient {
  return {
    messages: {
      create: vi.fn(async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: 'live-sub-to-10',
              label: 'Live',
              utterances: [
                {
                  id: 'math.p1.read',
                  text: 'Five minus two. How many are left?',
                },
              ],
            }),
          },
        ],
      })),
    },
  }
}

function limiterSpy(): RateLimiter & { check: ReturnType<typeof vi.fn> } {
  const real = createRateLimiter({ limit: 6, windowMs: 60_000 })
  return { check: vi.fn((key: string, now: number) => real.check(key, now)) }
}

function request(payload: unknown): Request {
  return new Request('https://example.test/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'session-start', payload }),
  })
}

const canon = (focusNode: string) =>
  getCanonEntry({ track: 'math', level: 1, focusNode })!

const planLines = (r: SessionStartResponse) =>
  (r.plan as { utterances: Line[] }).utterances

/** A canon block's lines (plan + audio), keyed by slot. */
function block(focusNode: string, problem: number) {
  const entry = canon(focusNode)
  const prefix = `math.p${problem}.`
  const slot = (id: string) => id.slice(prefix.length)
  return {
    plan: planLines(entry)
      .filter((u) => u.id.startsWith(prefix))
      .map((u) => [slot(u.id), u.text]),
    audio: entry.utterances
      .filter((u) => u.id.startsWith(prefix))
      .map((u) => [slot(u.id), u.text, u.audio.base64]),
  }
}

function blockOf(r: SessionStartResponse, id: string) {
  const prefix = `math.${id}.`
  const slot = (x: string) => x.slice(prefix.length)
  return {
    plan: planLines(r)
      .filter((u) => u.id.startsWith(prefix))
      .map((u) => [slot(u.id), u.text]),
    audio: r.utterances
      .filter((u) => u.id.startsWith(prefix))
      .map((u) => [slot(u.id), u.text, u.audio.base64]),
  }
}

const REVIEW_REFS = [
  { node: 'add-to-20', problem: 6 },
  { node: 'add-to-10', problem: 6 },
  { node: 'add-to-20', problem: 7 },
  { node: 'add-to-10', problem: 7 },
  { node: 'add-to-20', problem: 8 },
  { node: 'add-to-10', problem: 8 },
  { node: 'add-to-20', problem: 1 },
  { node: 'add-to-10', problem: 1 },
]

const base = { track: 'math', level: 1, childName: 'Marian' }

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
  mockedRender.mockReset()
})
afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
})

describe('review (payload.review)', () => {
  it('AC9: 8 refs → math.p1–p8 copied from the source canon blocks; no Anthropic, no TTS, no limiter', async () => {
    const anthropicClient = anthropicSpy()
    const rateLimiter = limiterSpy()
    const res = await handler(
      request({
        ...base,
        // Every other hint is ignored.
        progress: {
          focusNode: 'sub-to-10',
          leitner: [{ a: 1, b: 2, op: '+', box: 1 }],
        },
        review: { blocks: REVIEW_REFS },
      }),
      {
        anthropicClient,
        rateLimiter,
        sessionCache: createSessionCache({ ttlMs: 60_000 }),
      },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as SessionStartResponse
    expect((body.plan as { id: string }).id).toBe('review-math')
    expect((body.plan as { label: string }).label).toBe('Review')
    REVIEW_REFS.forEach((ref, i) => {
      const want = block(ref.node, ref.problem)
      expect(want.plan.length).toBeGreaterThanOrEqual(5)
      expect(blockOf(body, `p${i + 1}`)).toEqual(want)
    })
    const ids = new Set(body.utterances.map((u) => u.id))
    expect([...ids].every((id) => /^math\.p[1-8]\./.test(id))).toBe(true)
    expect(body.utterances).toHaveLength(
      REVIEW_REFS.reduce(
        (n, r) => n + block(r.node, r.problem).audio.length,
        0,
      ),
    )
    expect(anthropicClient.messages.create).not.toHaveBeenCalled()
    expect(mockedRender).not.toHaveBeenCalled()
    expect(rateLimiter.check).not.toHaveBeenCalled()
  })

  it('AC10: 7 refs, problem 9, or a step of the other track → 400 invalid-request', async () => {
    for (const blocks of [
      REVIEW_REFS.slice(0, 7),
      [...REVIEW_REFS.slice(0, 7), { node: 'add-to-10', problem: 9 }],
      [...REVIEW_REFS.slice(0, 7), { node: 'cvc-words', problem: 1 }],
      [...REVIEW_REFS.slice(0, 7), { node: '../../etc', problem: 1 }],
    ]) {
      const res = await handler(request({ ...base, review: { blocks } }), {
        anthropicClient: anthropicSpy(),
      })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ error: 'invalid-request' })
    }
  })

  it('a Word Song review copies word.p blocks', async () => {
    const refs = Array.from({ length: 8 }, (_, i) => ({
      node: i % 2 === 0 ? 'cvc-words' : 'blending-cv',
      problem: (i % 8) + 1,
    }))
    const res = await handler(
      request({
        track: 'word-song',
        level: 1,
        childName: 'Marian',
        review: { blocks: refs },
      }),
      { anthropicClient: anthropicSpy() },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as SessionStartResponse
    expect((body.plan as { id: string }).id).toBe('review-word-song')
    expect(new Set(planLines(body).map((u) => u.id.split('.')[1]))).toEqual(
      new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']),
    )
  })
})

describe('warm-up (payload.warmup)', () => {
  const WARMUP = {
    blocks: [
      { node: 'add-to-10', problem: 4 },
      { node: 'add-to-10', problem: 3 },
    ],
  }

  it('AC11: the canon forward plan plus math.w1/w2; the module canon entry is unchanged', async () => {
    const entry = canon('sub-to-10')
    const before = JSON.stringify(entry)
    const res = await handler(
      request({
        ...base,
        progress: { focusNode: 'sub-to-10' },
        warmup: WARMUP,
      }),
      { anthropicClient: anthropicSpy() },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as SessionStartResponse
    // The forward response, untouched...
    expect(planLines(body).filter((u) => !/^math\.w/.test(u.id))).toEqual(
      planLines(entry),
    )
    expect(body.utterances.filter((u) => !/^math\.w/.test(u.id))).toEqual(
      entry.utterances,
    )
    // ...plus the two blocks.
    expect(blockOf(body, 'w1')).toEqual(block('add-to-10', 4))
    expect(blockOf(body, 'w2')).toEqual(block('add-to-10', 3))
    expect(JSON.stringify(canon('sub-to-10'))).toBe(before)

    const again = await handler(
      request({ ...base, progress: { focusNode: 'sub-to-10' } }),
      { anthropicClient: anthropicSpy() },
    )
    const plain = (await again.json()) as SessionStartResponse
    expect(plain.utterances.some((u) => /^math\.w/.test(u.id))).toBe(false)
  })

  it('AC11: a live (cache-missing) response gets the blocks, the session cache does not', async () => {
    const sessionCache = createSessionCache({ ttlMs: 60_000 })
    mockedRender.mockResolvedValue({
      ok: true,
      kind: 'session-start',
      plan: {
        id: 'live-sub-to-10',
        label: 'Live',
        utterances: [
          { id: 'math.p1.read', text: 'Five minus two. How many are left?' },
        ],
      },
      utterances: [
        {
          id: 'math.p1.read',
          text: 'Five minus two. How many are left?',
          audio: { kind: 'inline', base64: 'AAAA', mime: 'audio/mpeg' },
        },
      ],
    })
    // The forward step misses the canon; the warm-up step is served.
    const resolver = (key: {
      track: 'math' | 'word-song'
      level: number
      focusNode: string
    }) => (key.focusNode === 'add-to-10' ? getCanonEntry(key) : null)
    const payload = { ...base, progress: { focusNode: 'sub-to-10' } }
    const first = await handler(request({ ...payload, warmup: WARMUP }), {
      anthropicClient: anthropicSpy(),
      sessionCache,
      getCanonEntry: resolver,
      now: () => 1000,
    })
    const live = (await first.json()) as SessionStartResponse
    expect(blockOf(live, 'w1')).toEqual(block('add-to-10', 4))

    const second = await handler(request(payload), {
      anthropicClient: anthropicSpy(),
      sessionCache,
      getCanonEntry: resolver,
      now: () => 2000,
    })
    const cached = (await second.json()) as SessionStartResponse
    expect(mockedRender).toHaveBeenCalledTimes(1) // the second was a cache hit
    expect(cached.utterances.map((u) => u.id)).toEqual(['math.p1.read'])
  })

  it('skips a ref it cannot serve (its w number stays unused); ignores a malformed warm-up', async () => {
    const resolver = (key: {
      track: 'math' | 'word-song'
      level: number
      focusNode: string
    }) => (key.focusNode === 'add-to-20' ? null : getCanonEntry(key))
    const res = await handler(
      request({
        ...base,
        progress: { focusNode: 'sub-to-10' },
        warmup: {
          blocks: [
            { node: 'add-to-20', problem: 1 },
            { node: 'add-to-10', problem: 3 },
          ],
        },
      }),
      { anthropicClient: anthropicSpy(), getCanonEntry: resolver },
    )
    const body = (await res.json()) as SessionStartResponse
    expect(blockOf(body, 'w1').plan).toEqual([])
    expect(blockOf(body, 'w2')).toEqual(block('add-to-10', 3))

    for (const warmup of [
      { blocks: [] },
      { blocks: [1, 2] },
      { blocks: Array(4).fill({ node: 'add-to-10', problem: 1 }) },
      'nope',
    ]) {
      const r = await handler(
        request({ ...base, progress: { focusNode: 'sub-to-10' }, warmup }),
        { anthropicClient: anthropicSpy() },
      )
      expect(r.status).toBe(200)
      const b = (await r.json()) as SessionStartResponse
      expect(b.utterances.some((u) => /^math\.w/.test(u.id))).toBe(false)
    }
  })
})

describe('Map peek (payload.peek, fast-track-native § 6.2)', () => {
  const PEEK_REFS = [
    { node: 'add-to-20', problem: 1 },
    { node: 'add-to-20', problem: 2 },
    { node: 'add-to-20', problem: 3 },
  ]

  it('AC12: 3 refs → peek-math, math.p1–p3 copied from the canon blocks; no Anthropic, no TTS, no limiter', async () => {
    const anthropicClient = anthropicSpy()
    const rateLimiter = limiterSpy()
    const res = await handler(
      request({
        ...base,
        // Every other hint is ignored.
        progress: {
          focusNode: 'add-to-10',
          leitner: [{ a: 1, b: 2, op: '+', box: 1 }],
        },
        peek: { blocks: PEEK_REFS },
      }),
      {
        anthropicClient,
        rateLimiter,
        sessionCache: createSessionCache({ ttlMs: 60_000 }),
      },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as SessionStartResponse
    expect((body.plan as { id: string }).id).toBe('peek-math')
    expect((body.plan as { label: string }).label).toBe('Peek')
    PEEK_REFS.forEach((ref, i) => {
      const want = block(ref.node, ref.problem)
      expect(want.plan.length).toBeGreaterThanOrEqual(5)
      expect(blockOf(body, `p${i + 1}`)).toEqual(want)
    })
    expect(body.utterances.every((u) => /^math\.p[1-3]\./.test(u.id))).toBe(
      true,
    )
    expect(body.utterances).toHaveLength(
      PEEK_REFS.reduce((n, r) => n + block(r.node, r.problem).audio.length, 0),
    )
    expect(anthropicClient.messages.create).not.toHaveBeenCalled()
    expect(mockedRender).not.toHaveBeenCalled()
    expect(rateLimiter.check).not.toHaveBeenCalled()
  })

  it('AC13: 2 refs, a ref of the other track, problem 9, refs of two steps or 4 refs → 400 invalid-request', async () => {
    for (const blocks of [
      PEEK_REFS.slice(0, 2),
      [...PEEK_REFS.slice(0, 2), { node: 'cvc-words', problem: 3 }],
      [...PEEK_REFS.slice(0, 2), { node: 'add-to-20', problem: 9 }],
      [...PEEK_REFS.slice(0, 2), { node: 'add-to-10', problem: 3 }],
      [...PEEK_REFS, { node: 'add-to-20', problem: 4 }],
    ]) {
      const res = await handler(request({ ...base, peek: { blocks } }), {
        anthropicClient: anthropicSpy(),
      })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ error: 'invalid-request' })
    }
  })

  it('every step of both worlds has a level-1 canon file a peek can be served from', async () => {
    const worlds = [
      ['math', VALID_MATH_FOCUS_NODES],
      ['word-song', VALID_WORD_SONG_FOCUS_NODES],
    ] as const
    const failed: string[] = []
    for (const [track, steps] of worlds) {
      for (const node of steps) {
        const res = await handler(
          request({
            track,
            level: 1,
            childName: 'Marian',
            peek: {
              blocks: [1, 2, 3].map((problem) => ({ node, problem })),
            },
          }),
          { anthropicClient: anthropicSpy() },
        )
        if (res.status !== 200) {
          failed.push(`${track}/${node} ${res.status}`)
          continue
        }
        // ...and the app's parser reads exactly 3 problems from it.
        const { plan } = (await res.json()) as SessionStartResponse
        try {
          const problems =
            track === 'math'
              ? mathSessionPlanFromServer(plan, {
                  extendedKinds: true,
                  problemCount: 3,
                }).problems
              : // As the native app reads it (the stories are native only).
                wordSongSessionPlanFromServer(plan, {
                  problemCount: 3,
                  littleStories: true,
                }).problems
          if (problems.length !== 3) failed.push(`${track}/${node} parse`)
        } catch (err) {
          failed.push(`${track}/${node} ${String(err)}`)
        }
      }
    }
    expect(failed).toEqual([])
  })

  it('a Word Song peek of a locked later step copies its word.p1–p3 blocks', async () => {
    const res = await handler(
      request({
        track: 'word-song',
        level: 1,
        childName: 'Marian',
        peek: {
          blocks: [1, 2, 3].map((problem) => ({
            node: 'digraphs-sh',
            problem,
          })),
        },
      }),
      { anthropicClient: anthropicSpy() },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as SessionStartResponse
    expect((body.plan as { id: string }).id).toBe('peek-word-song')
    expect(new Set(planLines(body).map((u) => u.id.split('.')[1]))).toEqual(
      new Set(['p1', 'p2', 'p3']),
    )
  })
})

describe('times mix (payload.mix, content wave 1 § 2.4)', () => {
  const MIX_REFS = [
    { node: 'mult-3-4', problem: 3 },
    { node: 'mult-2-5-10', problem: 5 },
    { node: 'mult-3-4', problem: 8 },
    { node: 'mult-6-9', problem: 5 },
    { node: 'mult-mix', problem: 2 },
    { node: 'mult-6-9', problem: 8 },
    { node: 'mult-mix', problem: 7 },
    { node: 'mult-2-5-10', problem: 3 },
  ]
  const ends = (r: SessionStartResponse) => ({
    plan: planLines(r).filter((u) => u.id.startsWith('session.end.')),
    audio: r.utterances
      .filter((u) => u.id.startsWith('session.end.'))
      .map((u) => [u.id, u.text, u.audio.base64]),
  })

  it("AC9: 8 refs → mix-math, math.p1–p8 copied from the canon blocks plus mult-mix's session-end lines; no Anthropic, no TTS, no limiter", async () => {
    const anthropicClient = anthropicSpy()
    const rateLimiter = limiterSpy()
    const res = await handler(
      request({
        ...base,
        progress: { focusNode: 'mult-mix' },
        mix: { blocks: MIX_REFS },
      }),
      {
        anthropicClient,
        rateLimiter,
        sessionCache: createSessionCache({ ttlMs: 60_000 }),
      },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as SessionStartResponse
    expect((body.plan as { id: string }).id).toBe('mix-math')
    expect((body.plan as { label: string }).label).toBe('Times mix')
    MIX_REFS.forEach((ref, i) => {
      const want = block(ref.node, ref.problem)
      expect(want.plan).toHaveLength(7)
      expect(blockOf(body, `p${i + 1}`)).toEqual(want)
    })
    const own = canon('mult-mix')
    expect(ends(body)).toEqual(ends(own))
    expect(ends(body).plan.length).toBeGreaterThan(10)
    // The plan reads as 8 multiplication problems.
    const plan = mathSessionPlanFromServer(body.plan, { extendedKinds: true })
    expect(plan.problems.map((p) => p.kind)).toEqual(Array(8).fill('multiply'))
    expect(anthropicClient.messages.create).not.toHaveBeenCalled()
    expect(mockedRender).not.toHaveBeenCalled()
    expect(rateLimiter.check).not.toHaveBeenCalled()
  })

  it('AC9: warm-up refs are appended as math.w<i>', async () => {
    const res = await handler(
      request({
        ...base,
        progress: { focusNode: 'mult-mix' },
        mix: { blocks: MIX_REFS },
        warmup: { blocks: [{ node: 'mult-6-9', problem: 1 }] },
      }),
      { anthropicClient: anthropicSpy() },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as SessionStartResponse
    expect((body.plan as { id: string }).id).toBe('mix-math')
    expect(blockOf(body, 'w1')).toEqual(block('mult-6-9', 1))
  })

  it('AC10: 7 refs, a step outside the times-mix sources, problem 9, or the Word Song track → 400 invalid-request', async () => {
    for (const [track, blocks] of [
      ['math', MIX_REFS.slice(0, 7)],
      ['math', [...MIX_REFS.slice(0, 7), { node: 'add-to-10', problem: 1 }]],
      ['math', [...MIX_REFS.slice(0, 7), { node: 'mult-6-9', problem: 9 }]],
      ['word-song', MIX_REFS],
    ] as const) {
      const res = await handler(request({ ...base, track, mix: { blocks } }), {
        anthropicClient: anthropicSpy(),
      })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ error: 'invalid-request' })
    }
  })

  it('without mix, a mult-mix request is served its own canon (an older client)', async () => {
    const res = await handler(
      request({ ...base, progress: { focusNode: 'mult-mix' } }),
      { anthropicClient: anthropicSpy() },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as SessionStartResponse
    expect(planLines(body)).toEqual(planLines(canon('mult-mix')))
  })
})

describe('Map replay (payload.replay, map-tap-to-play § 3)', () => {
  it('AC7: a node → replay-math, math.p1–p8 = the canon’s P1–P8 in order; no Anthropic, no TTS, no limiter', async () => {
    const anthropicClient = anthropicSpy()
    const rateLimiter = limiterSpy()
    const res = await handler(
      request({
        ...base,
        // Every other hint is ignored.
        progress: {
          focusNode: 'add-to-20',
          leitner: [{ a: 1, b: 2, op: '+', box: 1 }],
        },
        replay: { node: 'add-to-10' },
      }),
      {
        anthropicClient,
        rateLimiter,
        sessionCache: createSessionCache({ ttlMs: 60_000 }),
      },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as SessionStartResponse
    expect((body.plan as { id: string }).id).toBe('replay-math')
    expect((body.plan as { label: string }).label).toBe('Replay')
    for (let problem = 1; problem <= 8; problem++) {
      const want = block('add-to-10', problem)
      expect(want.plan.length).toBeGreaterThanOrEqual(5)
      expect(blockOf(body, `p${problem}`)).toEqual(want)
    }
    // Only the 8 blocks: no session-end lines, no warm-up.
    expect(body.utterances.every((u) => /^math\.p[1-8]\./.test(u.id))).toBe(
      true,
    )
    expect(planLines(body).every((u) => /^math\.p[1-8]\./.test(u.id))).toBe(
      true,
    )
    // The app's parser reads exactly the 8 canon problems.
    const plan = mathSessionPlanFromServer(body.plan, {
      extendedKinds: true,
      problemCount: 8,
    })
    expect(plan.problems).toHaveLength(8)
    expect(anthropicClient.messages.create).not.toHaveBeenCalled()
    expect(mockedRender).not.toHaveBeenCalled()
    expect(rateLimiter.check).not.toHaveBeenCalled()
  })

  it('AC7: a bad node → 400 invalid-request (unknown, the other track’s, not a string, none)', async () => {
    for (const replay of [
      { node: 'add-to-11' },
      { node: 'cvc-words' },
      { node: 3 },
      {},
      'add-to-10',
    ]) {
      const res = await handler(request({ ...base, replay }), {
        anthropicClient: anthropicSpy(),
      })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ error: 'invalid-request' })
    }
  })

  it('every step of both worlds can be replayed, and the app reads 8 problems from it', async () => {
    const worlds = [
      ['math', VALID_MATH_FOCUS_NODES],
      ['word-song', VALID_WORD_SONG_FOCUS_NODES],
    ] as const
    const failed: string[] = []
    for (const [track, steps] of worlds) {
      for (const node of steps) {
        const res = await handler(
          request({ track, level: 1, childName: 'Marian', replay: { node } }),
          { anthropicClient: anthropicSpy() },
        )
        if (res.status !== 200) {
          failed.push(`${track}/${node} ${res.status}`)
          continue
        }
        const { plan } = (await res.json()) as SessionStartResponse
        if ((plan as { id: string }).id !== `replay-${track}`) {
          failed.push(`${track}/${node} id`)
        }
        try {
          const problems =
            track === 'math'
              ? mathSessionPlanFromServer(plan, {
                  extendedKinds: true,
                  problemCount: 8,
                }).problems
              : // As the native app reads it (the stories are native only).
                wordSongSessionPlanFromServer(plan, {
                  problemCount: 8,
                  littleStories: true,
                }).problems
          if (problems.length !== 8) failed.push(`${track}/${node} parse`)
        } catch (err) {
          failed.push(`${track}/${node} ${String(err)}`)
        }
      }
    }
    expect(failed).toEqual([])
  })
})
