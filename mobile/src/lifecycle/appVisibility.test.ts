import { act, renderHook } from '@testing-library/react-native'
import {
  createAppVisibility,
  isHiddenAppState,
  useAppVisibilityChange,
  useIsAppHidden,
  type AppStateSource,
} from './appVisibility'

/** A controllable `AppState`. */
function fakeAppState(initial: string) {
  const listeners = new Set<(state: string) => void>()
  let attachCount = 0
  let current = initial
  const source: AppStateSource & {
    emit(state: string): void
    attachCount(): number
  } = {
    get currentState() {
      return current
    },
    addEventListener(_type, listener) {
      attachCount += 1
      listeners.add(listener)
      return { remove: () => listeners.delete(listener) }
    },
    emit(state) {
      current = state
      for (const l of listeners) l(state)
    },
    attachCount: () => attachCount,
  }
  return source
}

describe('isHiddenAppState', () => {
  it.each([
    ['background', true],
    ['active', false],
    ['inactive', false],
    ['unknown', false],
    [null, false],
  ])('%s → hidden %s', (state, hidden) => {
    expect(isHiddenAppState(state)).toBe(hidden)
  })
})

describe('createAppVisibility', () => {
  it('notifies on background and on return to active', () => {
    const appState = fakeAppState('active')
    const store = createAppVisibility(appState)
    const seen: boolean[] = []
    store.subscribe(() => seen.push(store.getIsHidden()))

    appState.emit('inactive')
    appState.emit('background')
    appState.emit('active')
    expect(seen).toEqual([true, false])
  })

  it('an active ↔ inactive flip (Control Center) notifies nobody', () => {
    const appState = fakeAppState('active')
    const store = createAppVisibility(appState)
    const listener = jest.fn()
    store.subscribe(listener)

    appState.emit('inactive')
    appState.emit('active')
    expect(listener).not.toHaveBeenCalled()
    expect(store.getIsHidden()).toBe(false)
  })

  it('attaches one AppState listener for any number of subscribers', () => {
    const appState = fakeAppState('active')
    const store = createAppVisibility(appState)
    const a = jest.fn()
    const b = jest.fn()
    store.subscribe(a)
    const unsubscribeB = store.subscribe(b)
    expect(appState.attachCount()).toBe(1)

    unsubscribeB()
    appState.emit('background')
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
  })

  it('a throwing subscriber does not starve the others', () => {
    const appState = fakeAppState('active')
    const store = createAppVisibility(appState)
    const after = jest.fn()
    store.subscribe(() => {
      throw new Error('consumer bug')
    })
    store.subscribe(after)
    appState.emit('background')
    expect(after).toHaveBeenCalledTimes(1)
  })
})

describe('hooks', () => {
  it('useIsAppHidden re-renders on hidden ↔ visible', async () => {
    const appState = fakeAppState('active')
    const store = createAppVisibility(appState)
    const { result } = await renderHook(() => useIsAppHidden(store))
    expect(result.current).toBe(false)
    await act(() => appState.emit('background'))
    expect(result.current).toBe(true)
    await act(() => appState.emit('active'))
    expect(result.current).toBe(false)
  })

  it('useAppVisibilityChange calls the latest callback with the hidden flag', async () => {
    const appState = fakeAppState('active')
    const store = createAppVisibility(appState)
    const first = jest.fn()
    const second = jest.fn()
    const { rerender, unmount } = await renderHook(
      ({ cb }: { cb: (hidden: boolean) => void }) =>
        useAppVisibilityChange(cb, store),
      { initialProps: { cb: first } },
    )
    await rerender({ cb: second })
    await act(() => appState.emit('background'))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(true)

    await unmount()
    await act(() => appState.emit('active'))
    expect(second).toHaveBeenCalledTimes(1)
  })
})
