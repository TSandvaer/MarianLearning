import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// Splash imports tts.cancel — give it a no-op so jsdom doesn't trip over
// the absent speechSynthesis global. Also stub speak() to a never-resolving
// promise so Greet can mount without firing real TTS in jsdom.
vi.mock('./lib/tts', () => ({
  speak: vi.fn(() => new Promise<void>(() => {})),
  cancel: vi.fn(),
}))

// Greet creates a chime SFX on mount; jsdom has no audio backend. Stub the
// factory so we don't pay an XHR + console.warn on every test render.
vi.mock('./lib/sfx', () => ({
  createSfx: vi.fn(() => ({
    play: vi.fn(() => true),
    unload: vi.fn(),
    missedPlays: 0,
    loadFailed: false,
  })),
}))

describe('App routing skeleton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts on Splash and auto-advances to the Greet screen', async () => {
    render(<App />)
    expect(screen.getByTestId('splash')).toBeInTheDocument()
    expect(screen.queryByTestId('greet')).toBeNull()

    // Cold start by default in jsdom — wait the cold cap.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    // AnimatePresence may keep the splash element in the tree briefly while
    // its exit animation runs; advance enough for that to finish too.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(screen.getByTestId('greet')).toBeInTheDocument()
  })
})
