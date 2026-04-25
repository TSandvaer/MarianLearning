import { act, render, screen } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'

// Mock TTS module so Splash can call cancel() without touching the real
// speechSynthesis stub (which jsdom doesn't ship). We assert on the spy
// directly to verify "no audio fires" — both that nothing was queued and
// that cancel() was called defensively.
const ttsSpeakSpy = vi.fn()
const ttsCancelSpy = vi.fn()
vi.mock('../lib/tts', () => ({
  speak: (...args: unknown[]) => ttsSpeakSpy(...args),
  cancel: () => ttsCancelSpy(),
}))

import Splash from './Splash'
import { __WARM_FLAG_KEY } from './splashTiming'

function withMotion(node: ReactNode) {
  // Mirror App.tsx providers so <m.*> elements resolve their features.
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

describe('Splash', () => {
  let matchMediaSpy: MockInstance | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    window.sessionStorage.clear()
    ttsSpeakSpy.mockClear()
    ttsCancelSpy.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    matchMediaSpy?.mockRestore()
  })

  /** Stub matchMedia to reply with the requested prefers-reduced-motion value. */
  function stubReducedMotion(reduced: boolean) {
    matchMediaSpy = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation((query: string) => {
        const matches =
          query.includes('prefers-reduced-motion') &&
          query.includes('reduce') &&
          reduced
        return {
          matches,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(() => false),
        } as unknown as MediaQueryList
      })
  }

  it('renders the Melody logo and three pulsing dots', () => {
    stubReducedMotion(false)
    render(withMotion(<Splash onAdvance={vi.fn()} detector={() => false} />))

    expect(screen.getByAltText('Melody')).toBeInTheDocument()
    expect(screen.getAllByTestId('splash-dot')).toHaveLength(3)
  })

  it('renders only the "Melody" wordmark — no other text', () => {
    stubReducedMotion(false)
    render(withMotion(<Splash onAdvance={vi.fn()} detector={() => false} />))
    // The logo SVG carries the "Melody" alt text. No other visible text node.
    const splash = screen.getByTestId('splash')
    // Strip the alt text via the img and check the remaining textContent.
    splash.querySelectorAll('img').forEach((img) => img.remove())
    expect(splash.textContent?.trim()).toBe('')
  })

  it('uses the warm cap (1500 ms) when the detector reports a warm start', () => {
    stubReducedMotion(false)
    const onAdvance = vi.fn()
    render(withMotion(<Splash onAdvance={onAdvance} detector={() => false} />))

    expect(screen.getByTestId('splash')).toHaveAttribute('data-cap-ms', '1500')

    act(() => {
      vi.advanceTimersByTime(1499)
    })
    expect(onAdvance).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it('uses the cold cap (3000 ms) when the detector reports a cold start', () => {
    stubReducedMotion(false)
    const onAdvance = vi.fn()
    render(withMotion(<Splash onAdvance={onAdvance} detector={() => true} />))

    expect(screen.getByTestId('splash')).toHaveAttribute('data-cap-ms', '3000')

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onAdvance).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it('marks the session warm so a re-mount uses the warm cap', () => {
    stubReducedMotion(false)
    const { unmount } = render(
      withMotion(<Splash onAdvance={vi.fn()} detector={() => true} />),
    )
    expect(window.sessionStorage.getItem(__WARM_FLAG_KEY)).toBe('1')
    unmount()
  })

  it('calls tts.cancel() on mount and never queues TTS', () => {
    stubReducedMotion(false)
    render(withMotion(<Splash onAdvance={vi.fn()} detector={() => false} />))

    expect(ttsCancelSpy).toHaveBeenCalledTimes(1)
    // No audio fires from the splash itself.
    expect(ttsSpeakSpy).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(ttsSpeakSpy).not.toHaveBeenCalled()
  })

  it('clears its timer on unmount and does not call onAdvance', () => {
    stubReducedMotion(false)
    const onAdvance = vi.fn()
    const { unmount } = render(
      withMotion(<Splash onAdvance={onAdvance} detector={() => false} />),
    )

    act(() => {
      vi.advanceTimersByTime(500)
    })
    unmount()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('exposes no skip / tap-to-continue affordance', () => {
    stubReducedMotion(false)
    render(withMotion(<Splash onAdvance={vi.fn()} detector={() => false} />))

    // No buttons, no links, no role="button". Splash auto-advances only.
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('still advances when prefers-reduced-motion is set (a11y path)', () => {
    stubReducedMotion(true)
    const onAdvance = vi.fn()
    render(withMotion(<Splash onAdvance={onAdvance} detector={() => false} />))

    // Component still mounts cleanly under reduced motion. Motion library
    // collapses the spring/pulses internally; we verify the timer-driven
    // contract — auto-advance — is unchanged.
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onAdvance).toHaveBeenCalledTimes(1)
    // Dots still render (just static under reduced motion).
    expect(screen.getAllByTestId('splash-dot')).toHaveLength(3)
  })
})
