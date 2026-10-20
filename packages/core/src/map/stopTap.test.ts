/**
 * Map tap-to-play's core half (native spec
 * `design/native/map-tap-to-play.md` § 1): what a stop's tap does — the
 * current stop plays the Hub card's session, a mastered stop replays, a
 * later stop peeks (unchanged).
 */
import { describe, expect, it } from 'vitest'
import { progressAtStep } from '../debug/stepProgress'
import { LITERACY_TREE, MATH_TREE } from '../progress/mastery'
import { REPLAY_BLOCK_COUNT, REPLAY_PLAN_ID_PREFIX } from '../wire/types'
import { buildMapModel, stopsInOrder } from './mapModel'
import { isPeekableStop } from './peek'
import { stopTapAction } from './stopTap'

const actions = (model: ReturnType<typeof buildMapModel>) =>
  Object.fromEntries(
    stopsInOrder(model).map((s) => [s.node, stopTapAction(model, s)]),
  )

describe('stopTapAction (map-tap-to-play § 1)', () => {
  it('the wire constants of a replay', () => {
    expect(REPLAY_BLOCK_COUNT).toBe(8)
    expect(REPLAY_PLAN_ID_PREFIX).toBe('replay-')
  })

  it('mastered stops replay, the current stop plays, later stops peek', () => {
    const model = buildMapModel(progressAtStep('add-to-20'), 'math')
    const at = MATH_TREE.indexOf('add-to-20')
    expect(actions(model)).toEqual(
      Object.fromEntries(
        MATH_TREE.map((node, i) => [
          node,
          i < at ? 'replay' : i === at ? 'play' : 'peek',
        ]),
      ),
    )
  })

  it('a peek is exactly what isPeekableStop says (§ 1: later stops unchanged)', () => {
    for (const step of ['add-to-10', 'mult-3-4', 'div-share'] as const) {
      const model = buildMapModel(progressAtStep(step), 'math')
      for (const stop of stopsInOrder(model)) {
        expect(stopTapAction(model, stop) === 'peek').toBe(
          isPeekableStop(model, stop),
        )
      }
    }
  })

  it('a later stop mastered out of order replays', () => {
    const p = progressAtStep('blending-cv')
    p.skillLevels['digraphs-sh'] = 'mastered'
    const model = buildMapModel(p, 'word-song')
    expect(actions(model)['digraphs-sh']).toBe('replay')
    expect(actions(model)['digraphs-ch']).toBe('peek')
    expect(actions(model)['blending-cv']).toBe('play')
  })

  it('a complete world: every tap is a replay', () => {
    const p = progressAtStep('goat-stories')
    p.skillLevels['goat-stories'] = 'mastered'
    const model = buildMapModel(p, 'word-song')
    expect(model.complete).toBe(true)
    expect(Object.values(actions(model))).toEqual(
      LITERACY_TREE.map(() => 'replay'),
    )
  })
})
