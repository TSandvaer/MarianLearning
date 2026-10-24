/**
 * @vitest-environment node
 *
 * No-Claude plan phase 2 golden test (`design/native/no-claude-sizing.md`
 * § 4, row 2): the session the device builds (`@marian/core`
 * `composeSession` over the app's bundled canon text,
 * `mobile/assets/canon/canon-text.json`) equals the real `/api/claude`
 * handler's answer for the same payload, over the committed canon in
 * public/canon/: the same `plan`, the same spoken lines (id and text, in
 * order) and the same clip per line. The server is the reference.
 *
 * Covered: the canon session of every tree step (with and without a
 * progress block, the first-encounter opener on and off), reviews over
 * every canon block, the peek and the replay of every step, times mixes,
 * warm-ups, hints the planner ignores, the 400s, and a seeded sweep of
 * mixed payloads. The routing is checked both ways: a payload the device
 * builds never reaches the planner, and one it leaves to the server does.
 *
 * Nothing here calls Anthropic or a TTS: the planner client and the
 * renderer are spies that fail.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/_session.js', () => ({
  renderSessionAudio: vi.fn(async () => {
    throw new Error('the golden test never renders')
  }),
  EMMA_VOICE_CONFIG: {
    voice: 'en-GB-OliviaNeural',
    rate: '-10%',
    pitch: '+0Hz',
    volume: '+0%',
  },
  extractUtteranceTexts: vi.fn(() => []),
}))

import { handler } from '../../api/claude.js'
import { getCanonEntry } from '../../api/_canon.js'
import {
  VALID_MATH_FOCUS_NODES,
  VALID_WORD_SONG_FOCUS_NODES,
  type PlannerAnthropicClient,
} from '../../api/_planner.js'
import { createRateLimiter } from '../../api/_rateLimit.js'
import { createSessionCache } from '../../api/_sessionCache.js'
import type { SessionStartResponse } from '../../api/_types.js'
import { pickPeekBlocks } from '../../packages/core/src/map/peek.js'
import { defaultProgress } from '../../packages/core/src/progress/defaults.js'
import {
  LITERACY_TREE,
  MATH_TREE,
} from '../../packages/core/src/progress/mastery.js'
import { pickMixBlocks } from '../../packages/core/src/progress/reviewPlan.js'
import type { Progress } from '../../packages/core/src/progress/types.js'
import {
  canonTextKey,
  composeSession,
  type CanonText,
  type CanonTextResolver,
  type ComposedSession,
} from '../../packages/core/src/session/composeSession.js'
import { MIX_SOURCE_STEPS } from '../../packages/core/src/wire/types.js'
import bundle from '../../mobile/assets/canon/canon-text.json'

type Track = 'math' | 'word-song'
type Ref = { node: string; problem: number }
type Payload = Record<string, unknown>

const BUNDLE = bundle as unknown as Readonly<Record<string, CanonText>>
const bundled: CanonTextResolver = (key) =>
  Object.prototype.hasOwnProperty.call(BUNDLE, canonTextKey(key))
    ? BUNDLE[canonTextKey(key)]!
    : null

const STEPS: Record<Track, readonly string[]> = {
  math: MATH_TREE,
  'word-song': LITERACY_TREE,
}
const TRACKS: readonly Track[] = ['math', 'word-song']

const plannerCalls = vi.fn()
const planner: PlannerAnthropicClient = {
  messages: {
    create: async (...args: unknown[]) => {
      plannerCalls(...args)
      throw new Error('the golden test never calls Anthropic')
    },
  },
}

type Served = { status: number; body: Record<string, unknown> }

async function serve(
  payload: unknown,
  getCanon: typeof getCanonEntry = getCanonEntry,
): Promise<Served> {
  const response = await handler(
    new Request('https://example.test/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'session-start', payload }),
    }),
    {
      anthropicClient: planner,
      rateLimiter: createRateLimiter({ limit: 1_000_000, windowMs: 60_000 }),
      sessionCache: createSessionCache({ ttlMs: 60_000 }),
      getCanonEntry: (key) => getCanon(key),
    },
  )
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  }
}

/** Every canon clip by its text (canon has one clip per text). */
const clipOfText = new Map<string, string>()
function indexClips(entry: SessionStartResponse | null) {
  for (const u of entry?.utterances ?? []) {
    clipOfText.set(u.text, u.audio.base64)
  }
}

let savedKey: string | undefined
beforeAll(() => {
  savedKey = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
  for (const key of Object.keys(BUNDLE)) {
    const [track, level, tier] = key.split('/') as [Track, string, string]
    indexClips(
      getCanonEntry({
        track,
        level: Number(level.replace('level-', '')),
        focusNode: tier,
      }),
    )
  }
})
afterAll(() => {
  if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = savedKey
})

const base = (track: Track, progress?: Payload): Payload => ({
  track,
  level: 1,
  childName: 'friend',
  ...(progress !== undefined ? { progress } : {}),
})

/**
 * The device's session equals the server's 200: plan, lines, and each
 * line's clip is the canon clip of its text (the one the app bundles).
 */
async function expectSame(
  payload: unknown,
  resolve: CanonTextResolver = bundled,
  getCanon?: typeof getCanonEntry,
): Promise<Extract<ComposedSession, { kind: 'local' }>> {
  const calls = plannerCalls.mock.calls.length
  const served = await serve(payload, getCanon)
  const composed = composeSession(payload, resolve)
  expect(served.status, JSON.stringify(payload)).toBe(200)
  expect(composed.kind, JSON.stringify(payload)).toBe('local')
  if (composed.kind !== 'local') throw new Error('unreachable')
  const lines = served.body.utterances as SessionStartResponse['utterances']
  expect(composed.session.plan).toEqual(served.body.plan)
  expect(composed.session.utterances).toEqual(
    lines.map((u) => ({ id: u.id, text: u.text })),
  )
  expect(served.body.currentTargetVowel).toBeUndefined()
  if (getCanon === undefined) {
    for (const u of lines) {
      expect(clipOfText.get(u.text), u.text).toBe(u.audio.base64)
    }
  }
  expect(plannerCalls.mock.calls.length).toBe(calls)
  return composed
}

/** The device leaves it to the server, and the server runs the planner. */
async function expectServer(payload: unknown): Promise<void> {
  const calls = plannerCalls.mock.calls.length
  const composed = composeSession(payload, bundled)
  expect(composed.kind, JSON.stringify(payload)).toBe('server')
  // The failing planner spy makes the handler log `planner-failed`.
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await serve(payload)
  } finally {
    log.mockRestore()
  }
  expect(plannerCalls.mock.calls.length, JSON.stringify(payload)).toBe(
    calls + 1,
  )
}

/** Both answer the request as invalid (the server: a 400). */
async function expectInvalid(payload: unknown): Promise<void> {
  const served = await serve(payload)
  expect(served.status, JSON.stringify(payload)).toBe(400)
  expect(composeSession(payload, bundled).kind).toBe('invalid')
}

/** Every canon block of `track`, problem-major (p1 of every step, p2, ...). */
function allRefs(track: Track): Ref[] {
  const refs: Ref[] = []
  for (let problem = 1; problem <= 8; problem++) {
    for (const node of STEPS[track]) refs.push({ node, problem })
  }
  return refs
}

/** `refs` in groups of `size`, the last one filled from the start. */
function chunks<T>(refs: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < refs.length; i += size) {
    const group = refs.slice(i, i + size)
    for (let j = 0; group.length < size; j++) group.push(refs[j]!)
    out.push(group)
  }
  return out
}

describe('the step lists', () => {
  it('core walks the same steps the server accepts', () => {
    expect(MATH_TREE).toEqual(VALID_MATH_FOCUS_NODES)
    expect(LITERACY_TREE).toEqual(VALID_WORD_SONG_FOCUS_NODES)
  })

  it('the bundle holds every canon file the server serves, as text', () => {
    expect(Object.keys(BUNDLE).length).toBe(46)
    for (const track of TRACKS) {
      for (const node of STEPS[track]) {
        expect(bundled({ track, level: 1, focusNode: node }), node).not.toBe(
          null,
        )
      }
    }
  })
})

describe('the canon session of every step', () => {
  for (const track of TRACKS) {
    it(`${track}: no progress block (the default step)`, async () => {
      await expectSame(base(track))
    })
    for (const node of STEPS[track]) {
      it(`${track} ${node}`, async () => {
        const plain = await expectSame(base(track, { focusNode: node }))
        expect(plain.served).toBe('canon')
        // The full forward block the app sends, hints the server ignores.
        await expectSame(
          base(track, {
            focusNode: node,
            recentSuccessRate: 0.75,
            lifetimeFirstEncounters: [],
          }),
        )
      })
    }
  }

  it('a canon file outside the trees (the graduation probe file)', async () => {
    await expectSame(base('word-song', { focusNode: 'cvc-words-probe' }))
  })
})

describe('the first-encounter opener', () => {
  for (const track of TRACKS) {
    for (const node of STEPS[track]) {
      it(`${track} ${node}: met and not met`, async () => {
        await expectSame(
          base(track, { focusNode: node, lifetimeFirstEncounters: [node] }),
        )
        await expectSame(
          base(track, {
            focusNode: node,
            lifetimeFirstEncounters: ['letter-names', 'add-to-10'],
          }),
        )
      })
    }
  }

  it('a gated step whose opener differs is rewritten as the server does', async () => {
    // Today every gated canon already says "You did it!", so a rewrite does
    // not change the text. A sub-to-10 canon with its own opener shows it.
    const real = getCanonEntry({
      track: 'math',
      level: 1,
      focusNode: 'sub-to-10',
    })!
    const opener = (u: { id: string; text: string }) =>
      u.id === 'session.end.opener' ? { ...u, text: 'Take away, done!' } : u
    const synthetic: SessionStartResponse = {
      ...real,
      utterances: real.utterances.map(opener),
    }
    const getCanon: typeof getCanonEntry = (key) =>
      key.focusNode === 'sub-to-10' ? synthetic : getCanonEntry(key)
    const text = bundled({ track: 'math', level: 1, focusNode: 'sub-to-10' })!
    const resolve: CanonTextResolver = (key) =>
      key.focusNode === 'sub-to-10'
        ? { ...text, utterances: text.utterances.map(opener) }
        : bundled(key)
    const met = await expectSame(
      base('math', {
        focusNode: 'sub-to-10',
        lifetimeFirstEncounters: ['sub-to-10'],
      }),
      resolve,
      getCanon,
    )
    expect(
      met.session.utterances.find((u) => u.id === 'session.end.opener')?.text,
    ).toBe('You did it!')
    const first = await expectSame(
      base('math', { focusNode: 'sub-to-10', lifetimeFirstEncounters: [] }),
      resolve,
      getCanon,
    )
    expect(
      first.session.utterances.find((u) => u.id === 'session.end.opener')?.text,
    ).toBe('Take away, done!')
  })
})

describe('reviews', () => {
  for (const track of TRACKS) {
    it(`${track}: every canon block, 8 at a time across steps`, async () => {
      for (const blocks of chunks(allRefs(track), 8)) {
        const review = await expectSame({
          ...base(track, { focusNode: STEPS[track][1] }),
          review: { blocks },
        })
        expect(review.served).toBe('review')
      }
    })
  }
})

describe('Map peeks and replays', () => {
  for (const track of TRACKS) {
    it(`${track}: the peek and the replay of every step`, async () => {
      for (const node of STEPS[track]) {
        const peek = await expectSame({
          ...base(track),
          peek: { blocks: pickPeekBlocks(node as never) },
        })
        expect(peek.served).toBe('peek')
        const replay = await expectSame({ ...base(track), replay: { node } })
        expect(replay.served).toBe('replay')
      }
    })
  }
})

describe('times mixes', () => {
  const mixRefs: Ref[] = []
  for (let problem = 1; problem <= 8; problem++) {
    for (const node of MIX_SOURCE_STEPS) mixRefs.push({ node, problem })
  }

  it('every multiplication block, 8 at a time', async () => {
    for (const blocks of chunks(mixRefs, 8)) {
      const mix = await expectSame({
        ...base('math', { focusNode: 'mult-mix' }),
        mix: { blocks },
      })
      expect(mix.served).toBe('mix')
    }
  })

  it("core's mix picker, a new and a practised learner, with a warm-up", async () => {
    const fresh = defaultProgress('friend')
    const practised: Progress = {
      ...fresh,
      mathFactsLeitner: {
        ...fresh.mathFactsLeitner,
        items: [2, 3, 4, 5, 6, 7, 8, 9].map((a, i) => ({
          item: { a, b: 3, op: '*' as const },
          box: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
          lastSeen: Date.parse('2026-10-20T08:00:00.000Z'),
        })),
      },
    }
    const now = Date.parse('2026-10-24T08:00:00.000Z')
    for (const p of [fresh, practised]) {
      for (const seed of [0, 1, 7]) {
        const blocks = pickMixBlocks(p, now, seed, [])
        await expectSame({
          ...base('math', { focusNode: 'mult-mix' }),
          mix: { blocks },
        })
        await expectSame({
          ...base('math', { focusNode: 'mult-mix' }),
          mix: { blocks },
          warmup: { blocks: [{ node: 'mult-3-4', problem: 2 }] },
        })
      }
    }
  })
})

describe('warm-ups', () => {
  for (const track of TRACKS) {
    it(`${track}: 1, 2 and 3 warm-up blocks on a forward session`, async () => {
      const refs = allRefs(track)
      const focus = STEPS[track][STEPS[track].length - 1]!
      for (const size of [1, 2, 3]) {
        for (const blocks of chunks(refs, size).filter((_, i) => i % 5 === 0)) {
          await expectSame({
            ...base(track, { focusNode: focus, lifetimeFirstEncounters: [] }),
            warmup: { blocks },
          })
        }
      }
    })

    it(`${track}: a malformed warm-up is ignored, and a review ignores it`, async () => {
      const step = STEPS[track][2]!
      await expectSame({
        ...base(track, { focusNode: step }),
        warmup: { blocks: [{ node: step, problem: 9 }] },
      })
      await expectSame({
        ...base(track, { focusNode: step }),
        warmup: { blocks: [] },
      })
      await expectSame({
        ...base(track, { focusNode: step }),
        warmup: 'soon',
      })
      await expectSame({
        ...base(track),
        review: { blocks: allRefs(track).slice(0, 8) },
        warmup: { blocks: [{ node: step, problem: 1 }] },
      })
    })
  }
})

const leitnerItem = (a: number, b: number, op: string, box = 1) => ({
  a,
  b,
  op,
  box,
})
const slowFact = (a: number, b: number, op = '+') => ({
  fact: { a, b, op },
  attempts: 6,
  correctRate: 0.9,
  medianLatencyMs: 6200,
})
const vowels = (o: string, u = 'intro', i = 'intro', e = 'intro') => ({
  '/o/': o,
  '/u/': u,
  '/i/': i,
  '/e/': e,
})

describe('hints the planner ignores: still canon, built on the device', () => {
  it.each([
    [
      'Leitner on add-to-20',
      base('math', {
        focusNode: 'add-to-20',
        leitner: [leitnerItem(3, 4, '+')],
      }),
    ],
    [
      'Leitner of only times facts on add-to-10',
      base('math', {
        focusNode: 'add-to-10',
        leitner: [leitnerItem(2, 3, '*')],
      }),
    ],
    [
      'Leitner, times facts, on mult-3-4',
      base('math', {
        focusNode: 'mult-3-4',
        leitner: [leitnerItem(3, 4, '*')],
      }),
    ],
    [
      'a malformed Leitner box on add-to-10',
      base('math', {
        focusNode: 'add-to-10',
        leitner: [leitnerItem(3, 4, '+', 7)],
      }),
    ],
    [
      'slow facts on add-to-20',
      base('math', { focusNode: 'add-to-20', slowFacts: [slowFact(9, 8)] }),
    ],
    [
      'malformed slow facts on add-to-10',
      base('math', { focusNode: 'add-to-10', slowFacts: [{ fact: { a: 1 } }] }),
    ],
    [
      'an all-intro vowel map on letter-sounds',
      base('word-song', {
        focusNode: 'letter-sounds',
        letterSoundsVowelStates: vowels('intro'),
      }),
    ],
    [
      'a partial vowel map on letter-sounds',
      base('word-song', {
        focusNode: 'letter-sounds',
        letterSoundsVowelStates: { '/o/': 'practicing' },
      }),
    ],
    [
      'a vowel map on another step',
      base('word-song', {
        focusNode: 'cvc-words',
        letterSoundsVowelStates: vowels('practicing'),
      }),
    ],
    [
      'graduation false',
      base('word-song', { focusNode: 'cvc-words', isGraduationSession: false }),
    ],
    [
      'a client plan of null',
      { ...base('math', { focusNode: 'add-to-10' }), plan: null },
    ],
  ])('%s', async (_name, payload) => {
    await expectSame(payload)
  })
})

describe('sessions the device leaves to the server (phases 3–4)', () => {
  it.each([
    [
      'the add-to-10 Leitner box',
      base('math', {
        focusNode: 'add-to-10',
        leitner: [leitnerItem(3, 4, '+')],
      }),
    ],
    [
      'the default math step with a Leitner box',
      base('math', { leitner: [leitnerItem(3, 4, '+')] }),
    ],
    [
      'slow facts on add-to-10',
      base('math', { focusNode: 'add-to-10', slowFacts: [slowFact(9, 1)] }),
    ],
    [
      'slow facts on sub-to-10',
      base('math', {
        focusNode: 'sub-to-10',
        slowFacts: [slowFact(9, 3, '-')],
      }),
    ],
    [
      'a practising vowel map on letter-sounds',
      base('word-song', {
        focusNode: 'letter-sounds',
        letterSoundsVowelStates: vowels('practicing'),
      }),
    ],
    [
      'a mastered vowel map on letter-sounds',
      base('word-song', {
        focusNode: 'letter-sounds',
        letterSoundsVowelStates: vowels(
          'mastered',
          'mastered',
          'mastered',
          'mastered',
        ),
      }),
    ],
    [
      'a graduation flag',
      base('word-song', { focusNode: 'cvc-words', isGraduationSession: true }),
    ],
    [
      'a level without canon',
      { ...base('math', { focusNode: 'add-to-10' }), level: 2 },
    ],
  ])('%s', async (_name, payload) => {
    await expectServer(payload)
  })

  it('a payload without a track (the legacy stub)', async () => {
    const served = await serve({ childName: 'friend' })
    expect(served.body.stub).toBe(true)
    expect(composeSession({ childName: 'friend' }, bundled).kind).toBe('server')
  })
})

describe('requests both answer as invalid', () => {
  const math8 = allRefs('math').slice(0, 8)
  it.each([
    [
      'a review of 7 blocks',
      { ...base('math'), review: { blocks: math8.slice(0, 7) } },
    ],
    [
      'a review naming another track',
      { ...base('word-song'), review: { blocks: math8 } },
    ],
    [
      'a review of problem 9',
      {
        ...base('math'),
        review: {
          blocks: [...math8.slice(0, 7), { node: 'add-to-10', problem: 9 }],
        },
      },
    ],
    [
      'a peek over two steps',
      {
        ...base('math'),
        peek: {
          blocks: [
            { node: 'add-to-10', problem: 1 },
            { node: 'add-to-20', problem: 2 },
            { node: 'add-to-10', problem: 3 },
          ],
        },
      },
    ],
    ['a replay of no step', { ...base('math'), replay: { node: 'cvc-words' } }],
    [
      'a mix with an addition block',
      {
        ...base('math'),
        mix: {
          blocks: [
            ...allRefs('math')
              .filter((r) => r.node === 'mult-3-4')
              .slice(0, 7),
            { node: 'add-to-10', problem: 1 },
          ],
        },
      },
    ],
    ['a mix on Word Song', { ...base('word-song'), mix: { blocks: math8 } }],
    ['a client plan', { ...base('math'), plan: { id: 'x', utterances: [] } }],
  ])('%s', async (_name, payload) => {
    await expectInvalid(payload)
  })
})

describe('a seeded sweep of mixed payloads', () => {
  /** mulberry32 */
  function rng(seed: number) {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  it('300 payloads: the same routing, and the same session when built', async () => {
    const r = rng(20261024)
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
    const ref = (track: Track): Ref => ({
      node: pick(STEPS[track]),
      problem: 1 + Math.floor(r() * 8),
    })
    let local = 0
    for (let n = 0; n < 300; n++) {
      const track = pick(TRACKS)
      const progress: Payload = {}
      if (r() < 0.85) progress.focusNode = pick(STEPS[track])
      if (r() < 0.5) progress.lifetimeFirstEncounters = [pick(STEPS[track])]
      if (r() < 0.2) progress.leitner = [leitnerItem(3, 4, pick(['+', '*']))]
      if (r() < 0.15) progress.slowFacts = [slowFact(9, 2)]
      if (r() < 0.2) {
        progress.letterSoundsVowelStates = vowels(pick(['intro', 'practicing']))
      }
      if (r() < 0.1) progress.isGraduationSession = r() < 0.5
      const payload: Payload = base(track, progress)
      const kind = r()
      if (kind < 0.15) {
        payload.review = { blocks: Array.from({ length: 8 }, () => ref(track)) }
      } else if (kind < 0.25) {
        const node = pick(STEPS[track])
        payload.peek = { blocks: pickPeekBlocks(node as never) }
      } else if (kind < 0.3) {
        payload.replay = { node: pick(STEPS[track]) }
      } else if (kind < 0.4 && track === 'math') {
        payload.mix = {
          blocks: Array.from({ length: 8 }, () => ({
            node: pick(MIX_SOURCE_STEPS),
            problem: 1 + Math.floor(r() * 8),
          })),
        }
      }
      if (r() < 0.3) {
        payload.warmup = {
          blocks: Array.from({ length: 1 + Math.floor(r() * 3) }, () =>
            ref(track),
          ),
        }
      }
      const composed = composeSession(payload, bundled)
      if (composed.kind === 'local') {
        local += 1
        await expectSame(payload)
      } else if (composed.kind === 'server') {
        await expectServer(payload)
      } else {
        await expectInvalid(payload)
      }
    }
    // Most of the sweep is built on the device.
    expect(local).toBeGreaterThan(150)
  })
})
