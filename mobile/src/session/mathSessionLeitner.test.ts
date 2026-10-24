/**
 * No multiplication fact reaches a non-multiplication session start.
 *
 * The native app records `op: '*'` facts for multiplication sessions
 * (spec `design/native/math-skip-counting-multiplication-native.md` § 8),
 * and the planner's Leitner directive (`api/_planner.ts`) ran for
 * add-to-10 with whatever Box-1 facts it was sent. Since no-Claude phase 3
 * no math request carries a Leitner hint at all: the device picks the
 * add-to-10 session from that step's own blocks, and only a due fact the
 * step allows (`leitnerFactAllowedForFocus`) makes it a picked session.
 */
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import {
  saveProgress,
  type LeitnerBoxIndex,
  type MathFact,
  type SkillNode,
} from '@marian/core/progress'
import { buildMathSessionPayload, readMathProgressHints } from './mathSession'

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
})

afterEach(() => setKeyValueStore(null))

/** `node` as the current step, with these facts in the Leitner box, all
 *  due (never shown). A weak session on `node` today keeps the daily
 *  warm-up (first session of the day) and the review (a good day today)
 *  out of these cases: the warm-up's share of the cap has its own test
 *  (`reviewSession.test.ts`). */
function seed(
  node: SkillNode,
  facts: [number, number, MathFact['op'], LeitnerBoxIndex][],
) {
  saveProgress({
    ...progressAtStep(node),
    history: [
      {
        dateISO: new Date().toISOString(),
        skillFocus: [node],
        successRate: 3 / 8,
      },
    ],
    mathFactsLeitner: {
      items: facts.map(([a, b, op, box]) => ({
        item: { a, b, op },
        box,
        lastSeen: 0,
      })),
    },
  })
}

/** Three due "*" facts in Box 1, ahead of two "+" facts in Box 2. */
const FACTS: [number, number, MathFact['op'], LeitnerBoxIndex][] = [
  [2, 3, '*', 1],
  [3, 2, '*', 1],
  [6, 2, '*', 1],
  [3, 4, '+', 2],
  [5, 2, '+', 2],
]

const progressOf = (payload: unknown) =>
  (payload as { progress?: Record<string, unknown> }).progress ?? {}

it('add-to-10 with "*" facts due in Box 1: no Leitner hint goes; the device picks from its "+" facts', () => {
  seed('add-to-10', FACTS)
  const hints = readMathProgressHints()
  expect(hints.focusNode).toBe('add-to-10')
  expect(progressOf(buildMathSessionPayload(hints))).not.toHaveProperty(
    'leitner',
  )
  // The pick decision reads the due box narrowed to the step (core
  // `forwardLeitnerHint`): the two "+" facts make it a picked session.
  expect(hints.mathPick?.step).toBe('add-to-10')
})

it('add-to-10 with only "*" facts due: no hint, no pick (the canon session)', () => {
  seed(
    'add-to-10',
    FACTS.filter(([, , op]) => op === '*'),
  )
  const hints = readMathProgressHints()
  expect(progressOf(buildMathSessionPayload(hints))).not.toHaveProperty(
    'leitner',
  )
  expect(hints.mathPick).toBeUndefined()
})

it('mult-6-9: no Leitner hint goes either (the server never used it there)', () => {
  seed('mult-6-9', FACTS)
  const hints = readMathProgressHints()
  expect(hints.focusNode).toBe('mult-6-9')
  expect(progressOf(buildMathSessionPayload(hints))).not.toHaveProperty(
    'leitner',
  )
  expect(hints.mathPick).toBeUndefined()
})
