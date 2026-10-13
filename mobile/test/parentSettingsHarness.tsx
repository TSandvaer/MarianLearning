/**
 * Parent Settings component-test harness: fake deps (the web's
 * `ParentSettingsStorage` seam plus `share`), the phone-floor and tablet
 * layouts, and a mount helper. Nothing reaches the network, the clipboard
 * or audio.
 */
import {
  defaultProgress,
  type Progress,
  type PushResult,
  type ReconcileOutcome,
} from '@marian/core/progress'
import { emptySessionHistory } from '@marian/core/sessionEnd/sessionHistory'
import { act, render } from '@testing-library/react-native'
import { parentSettingsLayout } from '../src/layout/parentSettingsLayout'
import type { ParentSettingsDeps } from '../src/screens/parentSettings/parentSettingsDeps'
import { ParentSettings } from '../src/screens/parentSettings/ParentSettings'

export const DEVICE_ID = '3f2a9c1e-7b4d-4e8a-9c0f-1a2b3c4d5e6f'
export const OTHER_ID = '0b8f3f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }

/** 375×667 portrait: compact. */
export const PHONE = parentSettingsLayout(
  { width: 375, height: 667, insets: NO_INSETS },
  1,
)
/** 1180×820 tablet landscape: wide. */
export const TABLET = parentSettingsLayout(
  { width: 1180, height: 820, insets: { ...NO_INSETS, bottom: 20 } },
  1,
)

export interface FakeDeps {
  deps: ParentSettingsDeps
  saved: Progress[]
  current: () => Progress | null
  setStored: (p: Progress | null) => void
  /** Stores the last-sync time `readLastSync` returns (null: never). */
  setLastSync: (iso: string | null) => void
  mocks: {
    writeClipboard: jest.Mock
    share: jest.Mock
    getDeviceId: jest.Mock
    readLastSync: jest.Mock
    pushNow: jest.Mock
    restoreFromDeviceId: jest.Mock
  }
}

export function fakeDeps(
  initial: Progress | null = defaultProgress(),
): FakeDeps {
  let current = initial
  let lastSync: string | null = null
  const saved: Progress[] = []
  const mocks = {
    writeClipboard: jest.fn<Promise<void>, [string]>(async () => {}),
    share: jest.fn<Promise<void>, [string, number | null]>(async () => {}),
    getDeviceId: jest.fn(() => DEVICE_ID),
    readLastSync: jest.fn<string | null, []>(() => lastSync),
    pushNow: jest.fn<Promise<PushResult>, [Progress, AbortSignal]>(
      async () => 'sent',
    ),
    restoreFromDeviceId: jest.fn<
      Promise<ReconcileOutcome>,
      [string, AbortSignal]
    >(async () => ({ kind: 'noop', reason: 'equal' })),
  }
  const deps: ParentSettingsDeps = {
    load: () => current,
    save: (p) => {
      current = p
      saved.push(p)
    },
    loadSessionHistory: () => ({ ...emptySessionHistory(), sessionCount: 5 }),
    ...mocks,
  }
  return {
    deps,
    saved,
    current: () => current,
    setStored: (p) => {
      current = p
    },
    setLastSync: (iso) => {
      lastSync = iso
    },
    mocks,
  }
}

export async function mount(
  fake: FakeDeps = fakeDeps(),
  layout = PHONE,
  /** Debug only: App passes it when the debug launch flag is on. */
  onQaJump?: () => void,
) {
  const onExit = jest.fn()
  const releaseAudio = jest.fn()
  const utils = await render(
    <ParentSettings
      layout={layout}
      onExit={onExit}
      deps={fake.deps}
      releaseAudio={releaseAudio}
      onQaJump={onQaJump}
    />,
  )
  return { ...fake, onExit, releaseAudio, ...utils }
}

export async function advance(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

/** Settle pending promise callbacks. */
export async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** A promise with its resolve/reject handles. */
export function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** A flattened style prop. */
export function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(5).filter(Boolean))
}
