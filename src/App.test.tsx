import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// Splash imports tts.cancel — give it a no-op so jsdom doesn't trip over
// the absent speechSynthesis global. Also stub speak() to a never-resolving
// promise so Greet can mount without firing real TTS in jsdom.
// loadVoices / primeVoices are no-ops in tests; Splash calls them on mount
// as part of the iPad TTS warmup.
vi.mock('./lib/tts', () => ({
  speak: vi.fn(() => new Promise<void>(() => {})),
  cancel: vi.fn(),
  loadVoices: vi.fn(() => Promise.resolve([])),
  primeVoices: vi.fn(),
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

const ORIGINAL_LOCATION = window.location

function setSearch(search: string): void {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...ORIGINAL_LOCATION, search },
  })
}

function restoreSearch(): void {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: ORIGINAL_LOCATION,
  })
}

describe('App routing skeleton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    restoreSearch()
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

  describe('debug overlay', () => {
    // The overlay is gated on `?debug=1`. Without it, normal sessions never
    // see (or pay for) the panel — critical because we ship debug to prod and
    // rely on the URL flag as the only opt-in.
    it('does NOT mount the debug overlay without ?debug=1', () => {
      setSearch('')
      render(<App />)
      expect(screen.queryByTestId('debug-overlay')).toBeNull()
    })

    it('mounts the debug overlay when ?debug=1 is present', () => {
      setSearch('?debug=1')
      render(<App />)
      expect(screen.getByTestId('debug-overlay')).toBeInTheDocument()
    })

    it('does NOT mount the overlay for any other debug value', () => {
      setSearch('?debug=true')
      render(<App />)
      expect(screen.queryByTestId('debug-overlay')).toBeNull()
    })
  })
})
