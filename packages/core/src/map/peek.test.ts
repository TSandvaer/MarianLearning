/**
 * The Map peek's core half (native spec `design/native/fast-track-native.md`
 * §§ 6.1–6.2, AC 11): which stops peek, which canon blocks a peek plays,
 * and the plan parsers reading exactly 3 problems.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { progressAtStep } from '../debug/stepProgress'
import { mathSessionPlanFromServer } from '../math/planFromServer'
import { LITERACY_TREE, MATH_TREE } from '../progress/mastery'
import { wordSongSessionPlanFromServer } from '../wordSong/planFromServer'
import { PEEK_BLOCK_COUNT, PEEK_PLAN_ID_PREFIX } from '../wire/types'
import { buildMapModel, stopsInOrder } from './mapModel'
import { isPeekableStop, pickPeekBlocks } from './peek'

describe('pickPeekBlocks (AC 11)', () => {
  it('problems 1–3 of the step, the same 3 every time', () => {
    expect(PEEK_BLOCK_COUNT).toBe(3)
    expect(PEEK_PLAN_ID_PREFIX).toBe('peek-')
    expect(pickPeekBlocks('add-to-20')).toEqual([
      { node: 'add-to-20', problem: 1 },
      { node: 'add-to-20', problem: 2 },
      { node: 'add-to-20', problem: 3 },
    ])
    expect(pickPeekBlocks('digraphs-sh')).toEqual(pickPeekBlocks('digraphs-sh'))
  })
})

describe('isPeekableStop (§ 6.1)', () => {
  it('every stop after the current one that is not mastered, locked ones included', () => {
    const model = buildMapModel(progressAtStep('add-to-20'), 'math')
    const peekable = stopsInOrder(model)
      .filter((s) => isPeekableStop(model, s))
      .map((s) => s.node)
    expect(peekable).toEqual(
      MATH_TREE.slice(MATH_TREE.indexOf('add-to-20') + 1),
    )
    // Earlier (mastered) stops and the current one keep their name tap.
    for (const node of ['number-recog', 'add-to-10', 'add-to-20']) {
      const stop = stopsInOrder(model).find((s) => s.node === node)!
      expect(isPeekableStop(model, stop)).toBe(false)
    }
  })

  it('a later stop mastered out of order does not peek', () => {
    const p = progressAtStep('blending-cv')
    p.skillLevels['digraphs-sh'] = 'mastered'
    const model = buildMapModel(p, 'word-song')
    const sh = stopsInOrder(model).find((s) => s.node === 'digraphs-sh')!
    expect(isPeekableStop(model, sh)).toBe(false)
    const ch = stopsInOrder(model).find((s) => s.node === 'digraphs-ch')!
    expect(isPeekableStop(model, ch)).toBe(true)
  })

  it('a complete world has none', () => {
    const p = progressAtStep('crab-words')
    p.skillLevels['crab-words'] = 'mastered'
    const model = buildMapModel(p, 'word-song')
    expect(model.complete).toBe(true)
    expect(stopsInOrder(model).filter((s) => isPeekableStop(model, s))).toEqual(
      [],
    )
    expect(LITERACY_TREE.at(-1)).toBe('crab-words')
  })
})

/** A peek response's plan, as the server builds it from a canon file. */
function peekPlan(world: 'math' | 'word-song', node: string, count = 3) {
  const canon = JSON.parse(
    readFileSync(
      join(process.cwd(), 'public', 'canon', world, 'level-1', `${node}.json`),
      'utf8',
    ),
  ) as { plan: { utterances: { id: string; text: string }[] } }
  const ns = world === 'math' ? 'math' : 'word'
  const wanted = Array.from({ length: count }, (_, i) => `${ns}.p${i + 1}.`)
  return {
    id: `peek-${world}`,
    label: 'Peek',
    utterances: canon.plan.utterances.filter((u) =>
      wanted.some((w) => u.id.startsWith(w)),
    ),
  }
}

describe('the plan parsers read exactly 3 problems for a peek', () => {
  it('math: 3 problems with problemCount 3; a 4th or a missing 3rd is an error', () => {
    const plan = mathSessionPlanFromServer(peekPlan('math', 'add-to-20'), {
      extendedKinds: true,
      problemCount: 3,
    })
    expect(plan.problems.map((p) => p.index)).toEqual([1, 2, 3])
    expect(() =>
      mathSessionPlanFromServer(peekPlan('math', 'add-to-20', 4), {
        extendedKinds: true,
        problemCount: 3,
      }),
    ).toThrow(/expected exactly 3/)
    expect(() =>
      mathSessionPlanFromServer(peekPlan('math', 'add-to-20', 2), {
        extendedKinds: true,
        problemCount: 3,
      }),
    ).toThrow(/missing problem index 3/)
  })

  it('word song: 3 problems of a locked later step', () => {
    const plan = wordSongSessionPlanFromServer(
      peekPlan('word-song', 'digraphs-sh'),
      { problemCount: 3 },
    )
    expect(plan.problems).toHaveLength(3)
    expect(() =>
      wordSongSessionPlanFromServer(peekPlan('word-song', 'digraphs-sh', 8), {
        problemCount: 3,
      }),
    ).toThrow(/expected exactly 3/)
  })

  it('without the option the parsers keep reading 8 (web behaviour)', () => {
    expect(() =>
      mathSessionPlanFromServer(peekPlan('math', 'add-to-20')),
    ).toThrow(/missing problem index 4/)
  })
})
