/**
 * No-Claude plan phase 3 on the device (`design/native/no-claude-sizing.md`
 * § 1 rows 1–2): the add-to-10 and sub-to-10 sessions whose request used to
 * carry the Leitner or slow-fact hint are picked by core and built from
 * the bundled canon, with no network call; their request carries no hint;
 * a pick that cannot be built asks the server with that hint-free request,
 * and says so in the audio log.
 */
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import { setApiBase } from '@marian/core/platform/apiUrl'
import {
  saveProgress,
  type LeitnerBoxIndex,
  type MathFact,
  type Progress,
  type SessionHistoryEntry,
  type SkillNode,
} from '@marian/core/progress'
import type { CanonTextResolver } from '@marian/core/session/composeSession'
import canonText from '../../assets/canon/canon-text.json'
import { fakePlayerFactory, resetFakePlayers } from '../../test/fakeAudio'
import { _resetAudioLogForTests, readAudioLog } from '../audio/audioLog'
import { createAudioEngine } from '../audio/engine'
import { createSessionPrefetcher } from '../audio/sessionPrefetch'
import { currentSessionAudio } from '../audio/sessionAudio'
import { bundledCanonText, startSessionLocalFirst } from './localSession'
import {
  buildMathSessionPayload,
  createMathSessionController,
  readMathProgressHints,
} from './mathSession'

const offline = globalThis.fetch as jest.Mock

beforeEach(() => {
  const map = new Map<string, string>()
  setKeyValueStore({
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  })
  resetFakePlayers()
  _resetAudioLogForTests()
  currentSessionAudio()?.unload()
  offline.mockClear()
  setApiBase('https://example.test')
})

afterEach(() => setKeyValueStore(null))

/** A weak session on `node` today: no daily warm-up and no review. */
const today = (node: SkillNode): SessionHistoryEntry => ({
  dateISO: new Date().toISOString(),
  skillFocus: [node],
  successRate: 3 / 8,
})

function seed(
  node: SkillNode,
  facts: [MathFact, LeitnerBoxIndex][],
  history: SessionHistoryEntry[] = [],
): Progress {
  const p: Progress = {
    ...progressAtStep(node),
    history: [...history, today(node)],
    mathFactsLeitner: {
      items: facts.map(([item, box]) => ({ item, box, lastSeen: 0 })),
    },
  }
  saveProgress(p)
  return p
}

/** Five slow sessions on `node`: right, 8 s per problem. */
function slow(node: SkillNode, facts: MathFact[]): SessionHistoryEntry[] {
  return [1, 2, 3, 4, 5].map((d) => ({
    dateISO: new Date(Date.now() - d * 86_400_000).toISOString(),
    skillFocus: [node],
    successRate: 1,
    mathFacts: facts,
    latencyMs: facts.map(() => 8000),
  }))
}

async function microtasks() {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

describe('add-to-10 / sub-to-10 with a Leitner box or slow facts: built on the device', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('add-to-10, a due Leitner fact: picked, no hint in the request, no network call', async () => {
    seed('add-to-10', [[{ a: 6, b: 4, op: '+' }, 1]])
    const hints = readMathProgressHints()
    expect(hints.mathPick?.step).toBe('add-to-10')
    const payload = buildMathSessionPayload(hints)
    expect(payload).not.toHaveProperty('progress.leitner')
    expect(payload).not.toHaveProperty('progress.slowFacts')

    const math = createMathSessionController({ fallbackPlanId: () => 'x' })
    math.kick()
    await microtasks()
    const snap = math.getSnapshot()
    expect(snap.audioReady).toBe(true)
    expect(snap.plan?.id).toBe('pick-add-to-10')
    expect(snap.plan?.problems).toHaveLength(8)
    // The due fact 6 + ? = 10 leads P4 (Dave § 2.2).
    expect(snap.plan?.problems[3]).toMatchObject({
      kind: 'missing-addend',
      addendA: 6,
      correct: 4,
    })
    expect(snap.playUtterance).not.toBeNull()
    expect(offline).not.toHaveBeenCalled()
    math.tearDown()
  })

  it('sub-to-10, slow facts: picked, no hint in the request, no network call', async () => {
    const facts: MathFact[] = [
      { a: 9, b: 1, op: '-' },
      { a: 8, b: 2, op: '-' },
    ]
    seed(
      'sub-to-10',
      facts.map((f) => [f, 3]),
      slow('sub-to-10', facts),
    )
    const hints = readMathProgressHints()
    expect(hints.mathPick?.step).toBe('sub-to-10')
    expect(hints.mathPick?.slow).toHaveLength(2)
    expect(buildMathSessionPayload(hints)).not.toHaveProperty(
      'progress.slowFacts',
    )

    const math = createMathSessionController({ fallbackPlanId: () => 'x' })
    math.kick()
    await microtasks()
    expect(math.getSnapshot()).toMatchObject({ audioReady: true })
    expect(math.getSnapshot().plan?.id).toBe('pick-sub-to-10')
    expect(offline).not.toHaveBeenCalled()
    math.tearDown()
  })

  it('the Hub prefetch builds the same pick, and the tap adopts it: still no network call', async () => {
    seed('add-to-10', [[{ a: 8, b: 2, op: '+' }, 2]])
    const prefetcher = createSessionPrefetcher()
    const math = createMathSessionController({
      fallbackPlanId: () => 'x',
      prefetcher,
    })
    math.prefetch()
    await microtasks()
    math.kick()
    await microtasks()
    expect(math.getSnapshot().plan?.id).toBe('pick-add-to-10')
    expect(readAudioLog()).toContainEqual(
      expect.objectContaining({ detail: 'adopting the Hub prefetch' }),
    )
    expect(offline).not.toHaveBeenCalled()
    math.tearDown()
  })

  it('every other math step stays on its canon session (no pick)', () => {
    seed('add-to-20', [[{ a: 9, b: 2, op: '+' }, 1]])
    expect(readMathProgressHints().mathPick).toBeUndefined()
    seed('add-to-10', [[{ a: 2, b: 3, op: '*' }, 1]]) // a "*" fact only
    expect(readMathProgressHints().mathPick).toBeUndefined()
  })
})

describe('a pick that cannot be built', () => {
  it('asks the server with the hint-free request, and says so', async () => {
    seed('add-to-10', [[{ a: 6, b: 4, op: '+' }, 1]])
    const hints = readMathProgressHints()
    const canon = canonText as unknown as Record<
      string,
      { plan: unknown; utterances: { id: string; text: string }[] }
    >
    // This build's add-to-10 canon lost a block: the pick throws.
    const broken: CanonTextResolver = (key) => {
      const entry = bundledCanonText(key)
      if (entry === null || key.focusNode !== 'add-to-10') return entry
      const file = canon['math/level-1/add-to-10']!
      return {
        plan: file.plan,
        utterances: file.utterances.filter((u) => !u.id.startsWith('math.p3.')),
      }
    }
    const server = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: false }),
    }))
    await startSessionLocalFirst(
      {
        sessionId: 'p1',
        payload: buildMathSessionPayload(hints),
        mathPick: hints.mathPick!,
      },
      {
        fetch: server as never,
        engine: createAudioEngine({ createPlayer: fakePlayerFactory }),
        resolveCanon: broken,
      },
    ).catch(() => undefined)
    expect(server).toHaveBeenCalledTimes(1)
    const body = JSON.parse(
      (server.mock.calls[0] as unknown as [string, { body: string }])[1].body,
    ) as { payload: Record<string, unknown> }
    expect(body.payload).not.toHaveProperty('progress.leitner')
    expect(body.payload).not.toHaveProperty('mathPick')
    expect(readAudioLog()).toContainEqual(
      expect.objectContaining({
        label: 'session-local',
        detail: expect.stringContaining('build failed, asking the server'),
      }),
    )
  })
})
