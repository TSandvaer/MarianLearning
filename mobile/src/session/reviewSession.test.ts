/**
 * The review / warm-up session starts and Session End's outcomes (native
 * spec `design/native/review-mode-and-warmup-native.md` § 7.4–7.5, AC 6,
 * 14, 15): what the request carries, how a response becomes the round, and
 * the one Leitner outcome per fact. The progress clock is pinned with fake
 * timers to Tuesday 2026-10-13 08:00 local; `startSession` is faked.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import {
  defaultProgress,
  saveProgress,
  type Progress,
  type SessionHistoryEntry,
} from '@marian/core/progress'
import { REPO_ROOT } from '../../test/webSource'
import type { LoadedSessionAudio, PreparedSession } from '../audio'
import type { MathSessionResult } from '../screens/math/mathTypes'
import {
  buildMathSessionPayload,
  createMathSessionController,
  mathPrefetchKey,
  mathRoundFromServer,
  readMathProgressHints,
} from './mathSession'
import { sessionIntroFor } from './reviewSession'
import { mathSessionEndPayload } from './sessionEndPayload'
import { forwardLeitnerOutcomes } from './sessionEndWrite'
import {
  buildWordSongSessionPayload,
  readWordSongProgressHints,
  readWordSongSessionExtras,
} from './wordSongHints'

interface Line {
  id: string
  text: string
}
interface Plan {
  id: string
  label: string
  utterances: Line[]
}

const canonPlan = (track: string, file: string): Plan =>
  (
    JSON.parse(
      readFileSync(
        resolve(REPO_ROOT, 'public', 'canon', track, 'level-1', `${file}.json`),
        'utf8',
      ),
    ) as { plan: Plan }
  ).plan

/** Canon block `problem` of `file`, renamed `math.<to>.*` (the server's copy). */
function block(file: string, problem: number, to: string): Line[] {
  const from = `math.p${problem}.`
  return canonPlan('math', file)
    .utterances.filter((u) => u.id.startsWith(from))
    .map((u) => ({ ...u, id: `math.${to}.${u.id.slice(from.length)}` }))
}

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m)
const MON = 12
const TUE = 13

function entry(
  node: Progress['history'][number]['skillFocus'][number],
  when: Date,
  correct: number,
): SessionHistoryEntry {
  return {
    dateISO: when.toISOString(),
    skillFocus: [node],
    successRate: correct / 8,
  }
}

beforeEach(() => {
  jest.useFakeTimers({ now: at(TUE, 8) })
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
})
afterEach(() => {
  setKeyValueStore(null)
  jest.useRealTimers()
})

/**
 * The spec's § 7.2 warm-up example: defaults, Monday's session, Tuesday
 * 08:00, on the content wave 1 canon (its box-2 fact is 7+3, add-to-10 #4
 * "Seven and what make ten?", where 2+4 was).
 */
function seedWarmupExample() {
  saveProgress({
    ...defaultProgress(),
    history: [entry('add-to-10', at(MON, 18, 10), 6)],
    mathFactsLeitner: {
      items: [
        {
          item: { a: 3, b: 2, op: '+' },
          box: 1,
          lastSeen: at(MON, 18).getTime(),
        },
        {
          item: { a: 4, b: 5, op: '+' },
          box: 1,
          lastSeen: at(MON, 18, 5).getTime(),
        },
        {
          item: { a: 7, b: 3, op: '+' },
          box: 2,
          lastSeen: at(MON, 17).getTime(),
        },
      ],
    },
  })
}

type Leitner = { a: number; b: number; op: string; box: number }[]
const leitnerOf = (payload: unknown): Leitner =>
  ((payload as { progress?: { leitner?: Leitner } }).progress?.leitner ??
    []) as Leitner

describe('warm-up request (§ 7.4, AC 6)', () => {
  it('the refs ride on the request, which carries no hint; the pick shares the cap with the warm-up facts', () => {
    seedWarmupExample()
    const hints = readMathProgressHints()
    expect(hints.planKind).toEqual({
      kind: 'forward',
      warmup: [
        { node: 'add-to-10', problem: 4 },
        { node: 'add-to-10', problem: 3 },
      ],
    })
    const payload = buildMathSessionPayload(hints)
    expect(payload.warmup).toEqual({
      blocks: [
        { node: 'add-to-10', problem: 4 },
        { node: 'add-to-10', problem: 3 },
      ],
    })
    expect(payload).not.toHaveProperty('review')
    expect(leitnerOf(payload)).toEqual([])
    // The due box minus the warm-up's facts still holds 4 + 5 (the hint
    // this used to send), so the device picks the session; the picker
    // counts the two warm-up facts against the cap of 3.
    expect(hints.mathPick?.warmup).toEqual([
      { a: 7, b: 3, op: '+' },
      { a: 3, b: 2, op: '+' },
    ])
    expect(mathPrefetchKey(hints)).toEqual({
      track: 'math',
      node: 'add-to-10',
      mode: 'forward+warmup',
    })
  })

  it('a second session today sends no warm-up and no hint, and is picked', () => {
    seedWarmupExample()
    saveProgress({
      ...defaultProgress(),
      history: [entry('add-to-10', at(TUE, 7), 6)],
      mathFactsLeitner: {
        items: [
          { item: { a: 3, b: 2, op: '+' }, box: 1, lastSeen: 0 },
          { item: { a: 4, b: 5, op: '+' }, box: 1, lastSeen: 0 },
        ],
      },
    })
    const hints = readMathProgressHints()
    const payload = buildMathSessionPayload(hints)
    expect(payload).not.toHaveProperty('warmup')
    expect(leitnerOf(payload)).toEqual([])
    expect(hints.mathPick).toMatchObject({ step: 'add-to-10', warmup: [] })
  })
})

describe('review request', () => {
  const seedReview = () =>
    saveProgress({
      ...progressAtStep('sub-to-10'),
      history: [entry('sub-to-10', at(TUE, 7), 7)],
      mathFactsLeitner: {
        items: [{ item: { a: 9, b: 2, op: '+' }, box: 1, lastSeen: 0 }],
      },
    })

  it('8 blocks and the focus node; no Leitner, no fallback; key mode "review"', () => {
    seedReview()
    const hints = readMathProgressHints()
    expect(hints.planKind.kind).toBe('review')
    const payload = buildMathSessionPayload(hints)
    expect(payload).toEqual({
      track: 'math',
      level: 1,
      childName: 'friend',
      progress: { focusNode: 'sub-to-10' },
      review: {
        blocks: hints.planKind.kind === 'review' ? hints.planKind.blocks : [],
      },
    })
    expect((payload.review as { blocks: unknown[] }).blocks).toHaveLength(8)
    expect(hints.mathPick).toBeUndefined()
    expect(mathPrefetchKey(hints).mode).toBe('review')
  })

  it('AC15: a forward plan answering a review request is a failure: no plan, not a review', async () => {
    seedReview()
    const hints = readMathProgressHints()
    const audio = { unload: jest.fn() } as unknown as LoadedSessionAudio
    const start = jest.fn(
      (): Promise<PreparedSession> =>
        Promise.resolve({
          sessionId: 'x',
          track: 'math',
          plan: canonPlan('math', 'sub-to-10'),
          audio,
          fetchMs: 1,
        }),
    )
    const session = createMathSessionController({
      start,
      readHints: () => hints,
      fallbackPlanId: () => 'static',
      now: () => 1,
    })
    session.kick()
    await jest.runAllTimersAsync()
    expect(start).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot()).toMatchObject({
      plan: null,
      audioReady: true,
      review: false,
      warmupCount: 0,
    })
    expect(audio.unload).toHaveBeenCalledTimes(1)
  })

  it('a review plan reads as 8 problems with their source steps', () => {
    const refs = [
      { node: 'add-to-20' as const, problem: 6 },
      { node: 'add-to-10' as const, problem: 6 },
      { node: 'add-to-20' as const, problem: 7 },
      { node: 'add-to-10' as const, problem: 7 },
      { node: 'add-to-20' as const, problem: 8 },
      { node: 'add-to-10' as const, problem: 8 },
      { node: 'add-to-20' as const, problem: 1 },
      { node: 'add-to-10' as const, problem: 1 },
    ]
    const plan: Plan = {
      id: 'review-math',
      label: 'Review',
      utterances: refs.flatMap((r, i) => block(r.node, r.problem, `p${i + 1}`)),
    }
    const round = mathRoundFromServer(plan, {
      planKind: { kind: 'review', blocks: refs },
    })
    expect(round.review).toBe(true)
    expect(round.plan.problems).toHaveLength(8)
    expect(round.problemNodes).toEqual(refs.map((r) => r.node))
    expect(round.plan.problems[0]!.utterances.read).toBe(
      block('add-to-20', 6, 'p1').find((u) => u.id === 'math.p1.read')!.text,
    )
  })
})

describe('warm-up round and its Leitner outcomes (AC 14)', () => {
  const WARMUP = [
    { node: 'add-to-10' as const, problem: 4 }, // 7 + ? = 10 (bond 7+3)
    { node: 'add-to-10' as const, problem: 3 }, // 3+2
  ]
  const forward = canonPlan('math', 'add-to-10')
  const response: Plan = {
    ...forward,
    utterances: [
      ...forward.utterances,
      ...block('add-to-10', 4, 'w1'),
      ...block('add-to-10', 3, 'w2'),
    ],
  }

  it('the repeats stay: 2 hearts + 8 scored, the warm-up blocks first', () => {
    const round = mathRoundFromServer(response, {
      planKind: { kind: 'forward', warmup: WARMUP },
    })
    expect(round.warmupCount).toBe(2)
    expect(round.plan.problems).toHaveLength(10)
    expect(round.problemNodes).toEqual([
      'add-to-10',
      'add-to-10',
      ...Array(8).fill(null),
    ])
    expect(round.plan.problems[0]!.utterances.read).toBe(
      'Seven and what make ten?',
    )
  })

  it('each repeated fact gets exactly one outcome, the warm-up first tap, even when the scored repeat differs', () => {
    const round = mathRoundFromServer(response, {
      planKind: { kind: 'forward', warmup: WARMUP },
    })
    // Warm-up: 7 + ? = 10 wrong first, 3+2 right. Scored (canon add-to-10,
    // in order 1+2, 2+2, 3+2, 7 + ? = 10, ...): all right, but the repeats
    // differ.
    const result: MathSessionResult = {
      totalCorrect: 8,
      totalStardust: 20,
      finalStreak: 8,
      earnedThisSession: 13,
      perProblemCorrect: [true, true, false, true, true, true, true, true],
      latencyMs: Array(8).fill(900),
      subitisingScaffoldRendered: false,
      subitisingScaffoldSubRendered: false,
      perProblemAnswerValue: Array(8).fill(null),
      perProblemDistractorClass: Array(8).fill(null),
      warmupCorrect: [false, true],
      firstTapCorrect: [true, true, false, true, true, true, true, true],
    }
    const payload = mathSessionEndPayload(
      result,
      round.plan,
      { node: 'add-to-10', mode: 'forward' },
      { review: false, warmupCount: 2 },
    )
    expect(payload.mathFacts).toHaveLength(8)
    expect(payload.warmupFacts).toEqual([
      { a: 7, b: 3, op: '+' },
      { a: 3, b: 2, op: '+' },
    ])
    expect(payload).not.toHaveProperty('review')
    const outcomes = forwardLeitnerOutcomes(payload)!
    expect(outcomes).toHaveLength(8)
    const keys = outcomes.map((o) => `${o.fact.a}${o.fact.op}${o.fact.b}`)
    expect(new Set(keys).size).toBe(8)
    expect(keys.filter((k) => k === '7+3')).toHaveLength(1)
    expect(keys.filter((k) => k === '3+2')).toHaveLength(1)
    expect(
      outcomes.find((o) => o.fact.a === 7 && o.fact.b === 3)!.correct,
    ).toBe(false)
    expect(
      outcomes.find((o) => o.fact.a === 3 && o.fact.b === 2)!.correct,
    ).toBe(true)
    // Warm-up outcomes come first.
    expect(keys.slice(0, 2)).toEqual(['7+3', '3+2'])
  })
})

describe('Word Song review / warm-up requests', () => {
  it('a review: 8 blocks, cross-vowel off; a first session: 2 warm-up refs from cvc-words', () => {
    saveProgress({
      ...progressAtStep('cvc-words-short-o'),
      history: [entry('cvc-words-short-o', at(TUE, 7), 8)],
    })
    const review = readWordSongProgressHints()
    expect(review.planKind.kind).toBe('review')
    const payload = buildWordSongSessionPayload(review, true)
    expect((payload.review as { blocks: unknown[] }).blocks).toHaveLength(8)
    expect(payload).not.toHaveProperty('progress.isGraduationSession')
    expect(readWordSongSessionExtras(review).crossVowel).toBe(false)

    saveProgress({
      ...progressAtStep('cvc-words-short-o'),
      history: [entry('cvc-words-short-o', at(MON, 18), 8)],
    })
    const first = readWordSongProgressHints()
    expect(first.planKind.kind).toBe('forward')
    const blocks = (
      buildWordSongSessionPayload(first, false).warmup as {
        blocks: { node: string }[]
      }
    ).blocks
    expect(blocks).toHaveLength(2)
    expect(blocks.every((b) => b.node === 'cvc-words')).toBe(true)
  })
})

describe('the step intro lead line (content wave 1 § 6.1)', () => {
  const FWD = { kind: 'forward' as const, warmup: [] }
  it('a step without an intro, a review and a missing focus get none', () => {
    const p = defaultProgress()
    expect(sessionIntroFor(p, 'add-to-10', FWD)).toBeNull()
    expect(sessionIntroFor(p, undefined, FWD)).toBeNull()
    expect(
      sessionIntroFor(p, 'add-to-10', { kind: 'review', blocks: [] }),
    ).toBeNull()
  })

  it('times mix: its intro until it is mastered', () => {
    const p = progressAtStep('mult-mix')
    expect(sessionIntroFor(p, 'mult-mix', FWD)).toBe(
      'guide.session.intro.mult-mix',
    )
    const done = progressAtStep('mult-mix')
    done.skillLevels['mult-mix'] = 'mastered'
    expect(sessionIntroFor(done, 'mult-mix', FWD)).toBeNull()
  })

  it('reaches the Math screen: a forward session on times mix carries it', () => {
    saveProgress(progressAtStep('mult-mix'))
    expect(readMathProgressHints().intro).toBe('guide.session.intro.mult-mix')
    saveProgress(progressAtStep('mult-6-9'))
    expect(readMathProgressHints().intro).toBeNull()
  })
})
