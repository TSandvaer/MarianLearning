/**
 * Warm-up block parsers (native spec
 * `design/native/review-mode-and-warmup-native.md` § 7.4): the server
 * appends `<ns>.w<N>.<slot>` copies of canon blocks to a forward response;
 * core reads them with the `p` parsers' slot sets and builders, and the `p`
 * parsers keep ignoring them.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  mathSessionPlanFromServer,
  mathWarmupFromServer,
} from './planFromServer'
import {
  wordSongSessionPlanFromServer,
  wordSongWarmupFromServer,
} from '../wordSong/planFromServer'

interface Plan {
  id: string
  label: string
  utterances: { id: string; text: string }[]
}

const canonPlan = (track: string, file: string): Plan =>
  (
    JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'public',
          'canon',
          track,
          'level-1',
          `${file}.json`,
        ),
        'utf8',
      ),
    ) as { plan: Plan }
  ).plan

/** `plan` with canon problem `from`'s block appended as warm-up block `w`. */
function withWarmup(
  plan: Plan,
  ns: 'math' | 'word',
  source: Plan,
  from: number,
  w: number,
): Plan {
  const prefix = `${ns}.p${from}.`
  return {
    ...plan,
    utterances: [
      ...plan.utterances,
      ...source.utterances
        .filter((u) => u.id.startsWith(prefix))
        .map((u) => ({ ...u, id: `${ns}.w${w}.${u.id.slice(prefix.length)}` })),
    ],
  }
}

describe('mathWarmupFromServer', () => {
  const add10 = canonPlan('math', 'add-to-10')
  const sub10 = canonPlan('math', 'sub-to-10')

  it('reads w blocks in order, with the p builder (kind, operands, slots)', () => {
    const plan = withWarmup(
      withWarmup(sub10, 'math', add10, 4, 1),
      'math',
      add10,
      3,
      2,
    )
    const warmup = mathWarmupFromServer(plan)
    expect(warmup).toHaveLength(2)
    expect(warmup.map((w) => w.block)).toEqual([1, 2])
    // add-to-10 #4 is a missing number since content wave 1 (§ 1.7: a
    // warm-up heart can be one).
    expect(warmup[0]!.problem).toMatchObject({
      kind: 'missing-addend',
      addendA: 7,
      total: 10,
      correct: 3,
    })
    expect(warmup[0]!.problem.utterances.read).toBe('Seven and what make ten?')
    expect(warmup[1]!.problem).toMatchObject({ addendA: 3, addendB: 2 })
  })

  it('the forward parser ignores w ids: the same 8 problems as without them', () => {
    const plain = mathSessionPlanFromServer(sub10, { extendedKinds: true })
    const mixed = mathSessionPlanFromServer(
      withWarmup(sub10, 'math', add10, 4, 1),
      { extendedKinds: true },
    )
    expect(mixed).toEqual(plain)
  })

  it('drops a block that does not parse, keeps the rest; none without w ids', () => {
    const broken = withWarmup(sub10, 'math', add10, 4, 1)
    broken.utterances = broken.utterances.filter((u) => u.id !== 'math.w1.read')
    const plan = withWarmup(broken, 'math', add10, 3, 2)
    expect(mathWarmupFromServer(plan).map((w) => w.block)).toEqual([2])
    expect(mathWarmupFromServer(sub10)).toEqual([])
    expect(mathWarmupFromServer(null)).toEqual([])
  })
})

describe('wordSongWarmupFromServer', () => {
  const cvc = canonPlan('word-song', 'cvc-words')
  const shortO = canonPlan('word-song', 'cvc-words-short-o')

  it('reads w blocks with the p builder; the forward plan is unchanged', () => {
    const plan = withWarmup(
      withWarmup(shortO, 'word', cvc, 6, 1),
      'word',
      cvc,
      7,
      2,
    )
    const warmup = wordSongWarmupFromServer(plan)
    expect(warmup).toHaveLength(2)
    const forward = wordSongSessionPlanFromServer(plan)
    expect(forward).toEqual(wordSongSessionPlanFromServer(shortO))
    const six = wordSongSessionPlanFromServer(cvc).problems[5]!
    expect(warmup[0]!.problem.target).toEqual(six.target)
    expect(warmup[0]!.problem.contentType).toBe(six.contentType)
    expect(warmup[0]!.problem.index).toBe(1)
  })
})
