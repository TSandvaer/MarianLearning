/**
 * Unit tests for `useStorageSync`.
 *
 * Ticket 86c9kxtn1 (Jessica e2e batch — Bug C). Verifies the hook
 * subscribes to `storage` events, filters by key, and unsubscribes
 * cleanly on unmount.
 *
 * Note on the StorageEvent dispatch: the standard `storage` event
 * fires only on cross-tab same-origin writes; jsdom does not fire
 * it for same-window writes either. We therefore dispatch synthetic
 * StorageEvents directly — the hook treats them identically to
 * cross-tab events because it only consumes `event.key`.
 */

import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  PROGRESS_STORAGE_KEY,
  SESSION_HISTORY_STORAGE_KEY,
  useStorageSync,
} from './useStorageSync'

function dispatchStorageEvent({
  key,
  newValue,
  oldValue,
}: {
  key: string | null
  newValue?: string | null
  oldValue?: string | null
}): void {
  // jsdom rejects `storageArea: window.localStorage` because the
  // localStorage shim isn't an instance of jsdom's internal Storage
  // class. The hook only reads `key`/`newValue`/`oldValue`, so leaving
  // `storageArea` undefined is safe for the unit tests; the real DOM
  // dispatch (cross-tab same-origin write) populates it correctly,
  // which the e2e specs exercise.
  const event = new StorageEvent('storage', {
    key,
    newValue: newValue ?? null,
    oldValue: oldValue ?? null,
  })
  window.dispatchEvent(event)
}

interface ProbeProps {
  watchKey: string | null
  onChange: (event: StorageEvent) => void
}

function Probe({ watchKey, onChange }: ProbeProps): React.ReactElement {
  useStorageSync({ key: watchKey, onChange })
  return <div data-testid="probe" />
}

describe('useStorageSync', () => {
  afterEach(() => {
    // Storage event dispatches are scoped to window listeners. No
    // need for module reset — each `render` mounts a fresh hook
    // and `unmount` (or test teardown via React Testing Library's
    // afterEach in the project setup) drops the listener.
  })

  it('exports the canonical storage keys', () => {
    expect(PROGRESS_STORAGE_KEY).toBe('marian-tutor:progress:v1')
    expect(SESSION_HISTORY_STORAGE_KEY).toBe('marian-tutor.session-history.v1')
  })

  it('fires onChange when a matching storage event is dispatched', () => {
    const onChange = vi.fn()
    render(<Probe watchKey={SESSION_HISTORY_STORAGE_KEY} onChange={onChange} />)

    dispatchStorageEvent({
      key: SESSION_HISTORY_STORAGE_KEY,
      newValue: '{"sessionCount": 6}',
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]![0].key).toBe(SESSION_HISTORY_STORAGE_KEY)
  })

  it('does NOT fire onChange for a different key', () => {
    const onChange = vi.fn()
    render(<Probe watchKey={SESSION_HISTORY_STORAGE_KEY} onChange={onChange} />)

    dispatchStorageEvent({
      key: 'some-other-key',
      newValue: 'whatever',
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does NOT fire onChange on a null-key event when watching a specific key', () => {
    // `localStorage.clear()` fires `storage` with `key: null`. When
    // watching a specific key, we must filter that out.
    const onChange = vi.fn()
    render(<Probe watchKey={PROGRESS_STORAGE_KEY} onChange={onChange} />)

    dispatchStorageEvent({ key: null, newValue: null })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('passes the raw StorageEvent to the callback', () => {
    const onChange = vi.fn()
    render(<Probe watchKey={SESSION_HISTORY_STORAGE_KEY} onChange={onChange} />)

    dispatchStorageEvent({
      key: SESSION_HISTORY_STORAGE_KEY,
      newValue: 'new',
      oldValue: 'old',
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    const event = onChange.mock.calls[0]![0]
    expect(event.newValue).toBe('new')
    expect(event.oldValue).toBe('old')
  })

  it('unsubscribes cleanly on unmount', () => {
    const onChange = vi.fn()
    const { unmount } = render(
      <Probe watchKey={SESSION_HISTORY_STORAGE_KEY} onChange={onChange} />,
    )
    unmount()
    dispatchStorageEvent({
      key: SESSION_HISTORY_STORAGE_KEY,
      newValue: 'after-unmount',
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('a throwing onChange does not propagate out of the hook', () => {
    const throwingOnChange = vi.fn(() => {
      throw new Error('boom')
    })
    render(
      <Probe
        watchKey={SESSION_HISTORY_STORAGE_KEY}
        onChange={throwingOnChange}
      />,
    )
    expect(() => {
      dispatchStorageEvent({
        key: SESSION_HISTORY_STORAGE_KEY,
        newValue: 'x',
      })
    }).not.toThrow()
    expect(throwingOnChange).toHaveBeenCalledTimes(1)
  })

  it('supports two concurrent subscriptions on different keys', () => {
    const sessionOnChange = vi.fn()
    const progressOnChange = vi.fn()
    render(
      <>
        <Probe
          watchKey={SESSION_HISTORY_STORAGE_KEY}
          onChange={sessionOnChange}
        />
        <Probe watchKey={PROGRESS_STORAGE_KEY} onChange={progressOnChange} />
      </>,
    )

    dispatchStorageEvent({
      key: SESSION_HISTORY_STORAGE_KEY,
      newValue: 'session-blob',
    })
    expect(sessionOnChange).toHaveBeenCalledTimes(1)
    expect(progressOnChange).not.toHaveBeenCalled()

    dispatchStorageEvent({
      key: PROGRESS_STORAGE_KEY,
      newValue: 'progress-blob',
    })
    expect(sessionOnChange).toHaveBeenCalledTimes(1)
    expect(progressOnChange).toHaveBeenCalledTimes(1)
  })

  it('null watch key fires for ALL storage events (including null-key wipes)', () => {
    const onChange = vi.fn()
    render(<Probe watchKey={null} onChange={onChange} />)

    dispatchStorageEvent({ key: 'any-key', newValue: 'x' })
    dispatchStorageEvent({ key: null, newValue: null })

    expect(onChange).toHaveBeenCalledTimes(2)
  })
})
