/**
 * A times-mix session (`mult-mix`, content wave 1
 * `design/native/content-wave-1.md` § 2.4, AC 12): the request carries
 * core's 8 blocks and no Leitner hint; a `mix-` plan and a plain mult-mix
 * canon plan are both accepted; every problem is the times-mix step's
 * (chips, ceiling, tags); the session end records the 8 facts under
 * `mult-mix`. The progress clock is pinned to Tuesday 2026-10-13 08:00.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import { MULT_MIX_CHIP_CEILING } from '@marian/core/math/extendedDistractors'
import {
  loadProgress,
  saveProgress,
  type Progress,
} from '@marian/core/progress'
import { CANON_MATH_FACTS } from '@marian/core/progress/canonMathFacts.generated'
import { pickMixBlocks } from '@marian/core/progress/reviewPlan'
import { REPO_ROOT } from '../../test/webSource'
import { problemChips } from '../screens/math/problemChips'
import type { MathSessionResult } from '../screens/math/mathTypes'
import {
  buildMathSessionPayload,
  mathPrefetchKey,
  mathRoundFromServer,
  readMathProgressHints,
} from './mathSession'
import { mathSessionEndPayload } from './sessionEndPayload'
import { writeSessionEnd } from './sessionEndWrite'

interface Line {
  id: string
  text: string
}

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m)

const canonLines = (file: string): Line[] =>
  (
    JSON.parse(
      readFileSync(
        resolve(
          REPO_ROOT,
          'public',
          'canon',
          'math',
          'level-1',
          `${file}.json`,
        ),
        'utf8',
      ),
    ) as { plan: { utterances: Line[] } }
  ).plan.utterances

/** The server's mix response plan for `refs` (api/_review.ts). */
function mixPlan(refs: { node: string; problem: number }[]) {
  return {
    id: 'mix-math',
    label: 'Times mix',
    utterances: [
      ...refs.flatMap((r, i) =>
        canonLines(r.node)
          .filter((u) => u.id.startsWith(`math.p${r.problem}.`))
          .map((u) => ({
            ...u,
            id: `math.p${i + 1}.${u.id.slice(`math.p${r.problem}.`.length)}`,
          })),
      ),
      ...canonLines('mult-mix').filter((u) => u.id.startsWith('session.end.')),
    ],
  }
}

/** On the times-mix step, with a few boxed × facts (some due). */
function seedAtMix(): Progress {
  const p: Progress = {
    ...progressAtStep('mult-mix'),
    mathFactsLeitner: {
      items: [
        {
          item: { a: 3, b: 3, op: '*' },
          box: 3,
          lastSeen: at(12, 17).getTime(),
        },
        {
          item: { a: 7, b: 3, op: '*' },
          box: 1,
          lastSeen: at(12, 18).getTime(),
        },
        {
          item: { a: 9, b: 3, op: '*' },
          box: 1,
          lastSeen: at(12, 18).getTime(),
        },
      ],
    },
  }
  saveProgress(p)
  return p
}

beforeEach(() => {
  jest.useFakeTimers({ now: at(13, 8) })
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

describe('the times-mix request (AC 12)', () => {
  it('carries the 8 blocks core picks and no Leitner hint; no 5 s race', () => {
    const p = seedAtMix()
    const hints = readMathProgressHints()
    expect(hints.focusNode).toBe('mult-mix')
    expect(hints.planKind.kind).toBe('forward')
    const mix =
      hints.planKind.kind === 'forward' ? hints.planKind.mix : undefined
    // The first session today: a warm-up rides along, and the mix's due
    // picks share its cap (seed = the session count, 0).
    const warmup =
      hints.planKind.kind === 'forward' ? hints.planKind.warmup : []
    expect(warmup.length).toBeGreaterThan(0)
    expect(mix).toEqual(pickMixBlocks(p, at(13, 8).getTime(), 0, warmup))
    expect(mix).toHaveLength(8)
    const payload = buildMathSessionPayload(hints)
    expect(payload.mix).toEqual({ blocks: mix })
    expect(
      (payload as { progress?: { leitner?: unknown } }).progress?.leitner,
    ).toBeUndefined()
    // A times mix is not a picked session (its blocks are core's mix).
    expect(hints.mathPick).toBeUndefined()
    expect(mathPrefetchKey(hints)).toEqual({
      track: 'math',
      node: 'mult-mix',
      mode: 'forward+warmup+mix',
    })
  })

  it('a step other than times mix sends no mix', () => {
    saveProgress(progressAtStep('mult-6-9'))
    const hints = readMathProgressHints()
    expect(hints.planKind).toEqual({ kind: 'forward', warmup: [] })
    expect(buildMathSessionPayload(hints)).not.toHaveProperty('mix')
  })
})

describe('the times-mix round (AC 12)', () => {
  it('a mix- plan is the session: 8 multiplication problems, every one the times-mix step’s', () => {
    seedAtMix()
    const hints = readMathProgressHints()
    const refs = hints.planKind.kind === 'forward' ? hints.planKind.mix! : []
    const round = mathRoundFromServer(mixPlan(refs), hints)
    expect(round.mix).toBe(true)
    expect(round.plan.problems).toHaveLength(8)
    expect(round.plan.problems.every((p) => p.kind === 'multiply')).toBe(true)
    expect(round.problemNodes).toEqual(Array(8).fill('mult-mix'))
    // The chips use M = 40 on every problem.
    round.plan.problems.forEach((p, i) => {
      const chips = problemChips(
        round.plan.problems,
        i,
        'mult-mix',
        round.problemNodes,
      )
      expect(chips.values).toContain(p.correct)
      expect(Math.max(...chips.values)).toBeLessThanOrEqual(
        MULT_MIX_CHIP_CEILING,
      )
    })
  })

  it('a plain mult-mix canon plan (an older server) is accepted too', () => {
    seedAtMix()
    const hints = readMathProgressHints()
    const plan = {
      id: 'mult-mix-level-1',
      label: 'x',
      utterances: canonLines('mult-mix'),
    }
    const round = mathRoundFromServer(plan, hints)
    expect(round.mix).toBe(true)
    expect(round.plan.problems.map((p) => p.correct)).toEqual(
      CANON_MATH_FACTS['mult-mix'].map((f) => f!.a * f!.b),
    )
  })
})

describe('the times-mix session end (AC 12)', () => {
  it('8 non-null problemFacts; the history entry is mult-mix; each fact one Leitner outcome', () => {
    seedAtMix()
    const hints = readMathProgressHints()
    const refs = hints.planKind.kind === 'forward' ? hints.planKind.mix! : []
    const round = mathRoundFromServer(mixPlan(refs), hints)
    const result: MathSessionResult = {
      totalCorrect: 8,
      totalStardust: 11,
      finalStreak: 8,
      earnedThisSession: 11,
      perProblemCorrect: Array(8).fill(true),
      latencyMs: Array(8).fill(1200),
      subitisingScaffoldRendered: false,
      subitisingScaffoldSubRendered: false,
      perProblemAnswerValue: round.plan.problems.map((p) => p.correct),
      perProblemDistractorClass: Array(8).fill(null),
      warmupCorrect: [],
      firstTapCorrect: Array(8).fill(true),
    }
    const payload = mathSessionEndPayload(
      result,
      round.plan,
      { node: 'mult-mix', mode: 'forward' },
      { review: false, warmupCount: 0, mix: true },
    )
    expect(payload.problemFacts).toHaveLength(8)
    expect(payload.problemFacts!.every((f) => f !== null && f.op === '*')).toBe(
      true,
    )
    expect(payload).not.toHaveProperty('review')
    writeSessionEnd(payload, { clock: () => at(13, 9) })
    const after = loadProgress()!
    expect(after.history.at(-1)!.skillFocus).toEqual(['mult-mix'])
    for (const f of payload.problemFacts!) {
      expect(
        after.mathFactsLeitner.items.filter(
          (e) => e.item.a === f!.a && e.item.b === f!.b && e.item.op === '*',
        ),
      ).toHaveLength(1)
    }
  })
})
