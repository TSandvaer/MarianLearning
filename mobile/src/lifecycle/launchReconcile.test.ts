import { setKeyValueStore } from '@marian/core'
import {
  activateLearner,
  activeLearner,
  addLearner,
  ensureLearnerList,
  resetLearnersForTests,
} from '@marian/core/learners'
import type { LaunchReconcileResult } from '@marian/core/progress'
import {
  reconcileOncePerLaunch,
  resetLaunchReconcileForTests,
} from './launchReconcile'

beforeEach(() => {
  resetLaunchReconcileForTests()
})

it('runs once per launch: later calls share the first run', async () => {
  const run = jest.fn(
    async (): Promise<LaunchReconcileResult> => ({ kind: 'off' }),
  )
  const first = reconcileOncePerLaunch(run)
  const second = reconcileOncePerLaunch(run)
  expect(second).toBe(first)
  await expect(first).resolves.toEqual({ kind: 'off' })
  expect(run).toHaveBeenCalledTimes(1)
})

it('a new launch (the test reset) runs it again', async () => {
  const run = jest.fn(
    async (): Promise<LaunchReconcileResult> => ({ kind: 'pushed-to-cloud' }),
  )
  await reconcileOncePerLaunch(run)
  resetLaunchReconcileForTests()
  await reconcileOncePerLaunch(run)
  expect(run).toHaveBeenCalledTimes(2)
})

describe('learner profiles: one run per learner per launch (§ 2.3 step 4)', () => {
  const memory = () => {
    const map = new Map<string, string>()
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    }
  }

  afterEach(() => {
    resetLearnersForTests()
    setKeyValueStore(null)
  })

  it("a switch starts the next learner's run; a switch back gets the first", async () => {
    setKeyValueStore(memory())
    ensureLearnerList()
    const one = activeLearner()!
    const sam = addLearner({
      name: 'Sam',
      avatarId: 'owl',
      start: { math: 1, wordSong: 1 },
    })
    const run = jest.fn(
      async (): Promise<LaunchReconcileResult> => ({ kind: 'off' }),
    )
    const samRun = reconcileOncePerLaunch(run)
    expect(reconcileOncePerLaunch(run)).toBe(samRun)
    activateLearner(one.id)
    const oneRun = reconcileOncePerLaunch(run)
    expect(oneRun).not.toBe(samRun)
    activateLearner(sam.id)
    expect(reconcileOncePerLaunch(run)).toBe(samRun)
    expect(run).toHaveBeenCalledTimes(2)
    await Promise.all([samRun, oneRun])
  })
})
