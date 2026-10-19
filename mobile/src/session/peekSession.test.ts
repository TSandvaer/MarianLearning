/**
 * The Map peek's session start (native spec
 * `design/native/fast-track-native.md` §§ 6.1–6.2, 6.5): the request, the
 * acceptance rule, the 5 s budget, and the audio loaded beside the current
 * session.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO_ROOT } from '../../test/webSource'
import type { LoadedSessionAudio, PreparedSession } from '../audio'
import {
  buildPeekPayload,
  buildReplayPayload,
  peekPlanFromServer,
  PEEK_TIMEOUT_MS,
  replayPlanFromServer,
  requestPeek,
  requestReplay,
} from './peekSession'

function canonPlan(world: 'math' | 'word-song', node: string, count: number) {
  const canon = JSON.parse(
    readFileSync(
      join(REPO_ROOT, 'public', 'canon', world, 'level-1', `${node}.json`),
      'utf8',
    ),
  ) as { plan: { id: string; utterances: { id: string; text: string }[] } }
  const ns = world === 'math' ? 'math' : 'word'
  return {
    id: canon.plan.id,
    label: 'x',
    utterances: canon.plan.utterances.filter((u) => {
      const m = new RegExp(`^${ns}\\.p(\\d+)\\.`).exec(u.id)
      return m !== null && Number(m[1]) <= count
    }),
  }
}

const peekOf = (world: 'math' | 'word-song', node: string, count = 3) => ({
  ...canonPlan(world, node, count),
  id: `peek-${world}`,
})

function fakeAudio(): LoadedSessionAudio & { unload: jest.Mock } {
  return {
    sessionId: 's',
    unload: jest.fn(),
  } as unknown as LoadedSessionAudio & {
    unload: jest.Mock
  }
}

function fakeStart(plan: unknown, audio = fakeAudio()) {
  const start = jest.fn(
    async (args: { sessionId: string; signal?: AbortSignal }, deps?: unknown) =>
      ({
        sessionId: args.sessionId,
        track: 'math',
        plan,
        audio,
        fetchMs: 1,
        deps,
      }) as unknown as PreparedSession,
  )
  return { start, audio }
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('the payload names the step’s problems 1–3 and carries no progress hint', () => {
  expect(buildPeekPayload('math', 'sub-to-10')).toEqual({
    track: 'math',
    level: 1,
    childName: 'friend',
    peek: {
      blocks: [
        { node: 'sub-to-10', problem: 1 },
        { node: 'sub-to-10', problem: 2 },
        { node: 'sub-to-10', problem: 3 },
      ],
    },
  })
})

it('accepts only a peek- plan of exactly 3 readable problems', () => {
  const math = peekPlanFromServer('math', peekOf('math', 'sub-to-10'))
  expect(math.world).toBe('math')
  expect(math.plan.problems).toHaveLength(3)
  const word = peekPlanFromServer(
    'word-song',
    peekOf('word-song', 'digraphs-sh'),
  )
  expect(word.plan.problems).toHaveLength(3)
  // An older server answers with the forward plan: its id is not peek-.
  expect(() =>
    peekPlanFromServer('math', canonPlan('math', 'add-to-20', 8)),
  ).toThrow(/another plan/)
  expect(() =>
    peekPlanFromServer('math', peekOf('math', 'sub-to-10', 8)),
  ).toThrow(/exactly 3/)
  expect(() =>
    peekPlanFromServer('math', peekOf('math', 'sub-to-10', 2)),
  ).toThrow()
})

it('a story step peeks and replays from its canon (content wave 3 § 7: a story runs in full)', () => {
  for (const node of ['fox-stories', 'hen-stories', 'bug-stories']) {
    const peek = peekPlanFromServer('word-song', peekOf('word-song', node))
    if (peek.world !== 'word-song') throw new Error('expected a word-song peek')
    expect(peek.plan.problems.map((p) => p.contentType)).toEqual(
      Array(3).fill('little-story'),
    )
    const replay = replayPlanFromServer('word-song', {
      ...canonPlan('word-song', node, 8),
      id: 'replay-word-song',
    })
    if (replay.world !== 'word-song')
      throw new Error('expected a word-song replay')
    expect(replay.plan.problems).toHaveLength(8)
    expect(replay.plan.problems.every((p) => p.storyId !== undefined)).toBe(
      true,
    )
  }
})

it('requestPeek: loads beside the current session and resolves the plan', async () => {
  const { start, audio } = fakeStart(peekOf('math', 'sub-to-10'))
  const prepared = await requestPeek({
    world: 'math',
    node: 'sub-to-10',
    signal: new AbortController().signal,
    start,
    now: () => 7,
  })
  expect(start).toHaveBeenCalledTimes(1)
  const [args, deps] = start.mock.calls[0]!
  expect(args.sessionId).toBe('peek-sub-to-10-7')
  expect(deps).toEqual({ alongside: true })
  expect(prepared.node).toBe('sub-to-10')
  expect(prepared.world).toBe('math')
  expect(prepared.audio).toBe(audio)
  expect(audio.unload).not.toHaveBeenCalled()
})

it('requestPeek: a plan it cannot play rejects and unloads its audio', async () => {
  const { start, audio } = fakeStart(canonPlan('math', 'add-to-20', 8))
  await expect(
    requestPeek({
      world: 'math',
      node: 'sub-to-10',
      signal: new AbortController().signal,
      start,
    }),
  ).rejects.toThrow()
  expect(audio.unload).toHaveBeenCalledTimes(1)
})

it('requestPeek: no answer within 5 s aborts the request (the failure path)', async () => {
  let seen: AbortSignal | undefined
  const start = jest.fn(
    (args: { signal?: AbortSignal }) =>
      new Promise<PreparedSession>((_, reject) => {
        seen = args.signal
        args.signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        )
      }),
  )
  const pending = requestPeek({
    world: 'math',
    node: 'sub-to-10',
    signal: new AbortController().signal,
    start: start as never,
  })
  const settled = jest.fn()
  pending.catch(settled)
  jest.advanceTimersByTime(PEEK_TIMEOUT_MS - 1)
  await Promise.resolve()
  expect(seen?.aborted).toBe(false)
  jest.advanceTimersByTime(1)
  await expect(pending).rejects.toThrow('aborted')
  expect(PEEK_TIMEOUT_MS).toBe(5000)
})

it('requestPeek: the caller’s abort (Home) aborts the request', async () => {
  const outer = new AbortController()
  let seen: AbortSignal | undefined
  const start = jest.fn(
    (args: { signal?: AbortSignal }) =>
      new Promise<PreparedSession>((_, reject) => {
        seen = args.signal
        args.signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        )
      }),
  )
  const pending = requestPeek({
    world: 'math',
    node: 'sub-to-10',
    signal: outer.signal,
    start: start as never,
  })
  outer.abort()
  await expect(pending).rejects.toThrow('aborted')
  expect(seen?.aborted).toBe(true)
})

describe('the Map replay (map-tap-to-play § 3)', () => {
  const replayOf = (world: 'math' | 'word-song', node: string) => ({
    ...canonPlan(world, node, 8),
    id: `replay-${world}`,
  })

  it('the payload names the step and carries no progress hint', () => {
    expect(buildReplayPayload('word-song', 'cvc-words')).toEqual({
      track: 'word-song',
      level: 1,
      childName: 'friend',
      replay: { node: 'cvc-words' },
    })
  })

  it("a bee-words replay deals bee words' own chip rows (content wave 4 § 5)", () => {
    const replay = replayPlanFromServer(
      'word-song',
      replayOf('word-song', 'bee-words'),
      'bee-words',
    )
    if (replay.world !== 'word-song') throw new Error('a Word Song replay')
    expect(replay.plan.problems[3]!.target.word).toBe('sheep')
    expect(replay.plan.problems[3]!.chipRow?.trap).toEqual(['ship', 'jeep'])
    const peek = peekPlanFromServer(
      'word-song',
      peekOf('word-song', 'car-words'),
      'car-words',
    )
    if (peek.world !== 'word-song') throw new Error('a Word Song peek')
    expect(peek.plan.problems.map((p) => p.chipRow?.gentle)).toEqual([
      ['dog', 'pen'],
      ['hen', 'cup'],
      ['fox', 'pen'],
    ])
  })

  it('accepts only a replay- plan of exactly 8 readable problems', () => {
    expect(
      replayPlanFromServer('math', replayOf('math', 'add-to-10')).plan.problems,
    ).toHaveLength(8)
    expect(
      replayPlanFromServer('word-song', replayOf('word-song', 'cvc-words')).plan
        .problems,
    ).toHaveLength(8)
    // An older server ignores `replay` and answers with the forward plan.
    expect(() =>
      replayPlanFromServer('math', canonPlan('math', 'add-to-10', 8)),
    ).toThrow(/another plan/)
    // A peek's plan is not a replay.
    expect(() =>
      replayPlanFromServer('math', peekOf('math', 'add-to-10')),
    ).toThrow(/another plan/)
    expect(() =>
      replayPlanFromServer('math', {
        ...canonPlan('math', 'add-to-10', 3),
        id: 'replay-math',
      }),
    ).toThrow()
  })

  it('requestReplay: loads beside the current session; the result is a replay', async () => {
    const { start, audio } = fakeStart(replayOf('math', 'add-to-10'))
    const prepared = await requestReplay({
      world: 'math',
      node: 'add-to-10',
      signal: new AbortController().signal,
      start,
      now: () => 7,
    })
    const [args, deps] = start.mock.calls[0]!
    expect(args.sessionId).toBe('replay-add-to-10-7')
    expect(deps).toEqual({ alongside: true })
    expect(prepared).toMatchObject({
      mode: 'replay',
      world: 'math',
      node: 'add-to-10',
    })
    expect(prepared.plan.problems).toHaveLength(8)
    expect(prepared.audio).toBe(audio)
  })

  it('requestPeek still resolves a peek', async () => {
    const { start } = fakeStart(peekOf('math', 'sub-to-10'))
    const prepared = await requestPeek({
      world: 'math',
      node: 'sub-to-10',
      signal: new AbortController().signal,
      start,
    })
    expect(prepared.mode).toBe('peek')
  })
})
