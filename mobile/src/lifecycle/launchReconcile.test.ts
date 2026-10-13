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
