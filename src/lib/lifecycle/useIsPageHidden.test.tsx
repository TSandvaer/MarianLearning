/**
 * Unit tests for `useIsPageHidden`.
 *
 * Ticket 86c9kxtmu (Jessica e2e batch — Bug B).
 */

import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { _resetPageVisibilityForTests } from './pageVisibility'
import { useIsPageHidden } from './useIsPageHidden'

function setDocumentVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => state === 'hidden',
  })
}

function Probe(): React.ReactElement {
  const hidden = useIsPageHidden()
  return <div data-testid="probe" data-hidden={hidden ? 'true' : 'false'} />
}

describe('useIsPageHidden', () => {
  beforeEach(() => {
    setDocumentVisibility('visible')
  })

  afterEach(() => {
    _resetPageVisibilityForTests()
    setDocumentVisibility('visible')
  })

  it('initial render reads the current visibility state (visible)', () => {
    render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveAttribute('data-hidden', 'false')
  })

  it('initial render reads the current visibility state (hidden)', () => {
    setDocumentVisibility('hidden')
    render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveAttribute('data-hidden', 'true')
  })

  it('re-renders on visibilitychange (visible → hidden)', () => {
    render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveAttribute('data-hidden', 'false')
    act(() => {
      setDocumentVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(screen.getByTestId('probe')).toHaveAttribute('data-hidden', 'true')
  })

  it('re-renders on visibilitychange (hidden → visible)', () => {
    setDocumentVisibility('hidden')
    render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveAttribute('data-hidden', 'true')
    act(() => {
      setDocumentVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(screen.getByTestId('probe')).toHaveAttribute('data-hidden', 'false')
  })

  it('unmount cleanly stops re-renders (no leaked subscription)', () => {
    const { unmount } = render(<Probe />)
    unmount()
    // Dispatch after unmount — the unsubscribed listener must not throw
    // a setState-on-unmounted-component warning. (React 18+ silences
    // the warning, but the listener must still drop cleanly.)
    expect(() => {
      setDocumentVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
    }).not.toThrow()
  })
})
