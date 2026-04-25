import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// Splash imports tts.cancel — give it a no-op so jsdom doesn't trip over
// the absent speechSynthesis global.
vi.mock('./lib/tts', () => ({
  speak: vi.fn(),
  cancel: vi.fn(),
}))

describe('App routing skeleton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts on Splash and auto-advances to the Greet stub', async () => {
    render(<App />)
    expect(screen.getByTestId('splash')).toBeInTheDocument()
    expect(screen.queryByTestId('greet-stub')).toBeNull()

    // Cold start by default in jsdom — wait the cold cap.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    // AnimatePresence may keep the splash element in the tree briefly while
    // its exit animation runs; advance enough for that to finish too.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(screen.getByTestId('greet-stub')).toBeInTheDocument()
    expect(screen.getByText('Greet (TBD)')).toBeInTheDocument()
  })
})
