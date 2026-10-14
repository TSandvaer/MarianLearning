/**
 * No multiplication fact reaches a non-multiplication session start.
 *
 * The native app records `op: '*'` facts for multiplication sessions
 * (spec `design/native/math-skip-counting-multiplication-native.md` § 8),
 * and the planner's Leitner directive (`api/_planner.ts`) runs for
 * add-to-10 with whatever Box-1 facts it is sent. So the request built from
 * the persisted progress must carry no `*` fact unless the step is a
 * multiplication step.
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

type Leitner = { a: number; b: number; op: string; box: number }[]
const leitnerOf = (payload: unknown): Leitner =>
  ((payload as { progress?: { leitner?: Leitner } }).progress?.leitner ??
    []) as Leitner

it('add-to-10: the session-start payload has no "*" fact, with "*" facts due in Box 1', () => {
  seed('add-to-10', FACTS)
  const hints = readMathProgressHints()
  expect(hints.focusNode).toBe('add-to-10')
  const leitner = leitnerOf(buildMathSessionPayload(hints, true))
  expect(leitner.filter((f) => f.op === '*')).toHaveLength(0)
  expect(leitner.filter((f) => f.op === '+')).toHaveLength(2)
  expect(leitner).toEqual([
    { a: 3, b: 4, op: '+', box: 2 },
    { a: 5, b: 2, op: '+', box: 2 },
  ])
})

it('add-to-10 with only "*" facts due: no Leitner block at all', () => {
  seed(
    'add-to-10',
    FACTS.filter(([, , op]) => op === '*'),
  )
  const payload = buildMathSessionPayload(readMathProgressHints(), true)
  expect(payload).not.toHaveProperty('progress.leitner')
})

it('mult-6-9: the multiplication step still gets its "*" facts', () => {
  seed('mult-6-9', FACTS)
  const hints = readMathProgressHints()
  expect(hints.focusNode).toBe('mult-6-9')
  const leitner = leitnerOf(buildMathSessionPayload(hints, true))
  expect(leitner.filter((f) => f.op === '*')).toHaveLength(3)
})
