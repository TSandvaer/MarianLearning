/**
 * Component tests for `<DotCardOverlay />` — the lifecycle machine
 * (ticket 86c9q9p8w AC1, follow-up to PR #176).
 *
 * Pre-86c9q9p8w the lifecycle was covered only by the e2e suite
 * (`e2e/dot-card-affordance.spec.ts`). That left the phase-advance
 * timing (200/700/200ms), the `pageHidden` pause-and-resume
 * behaviour, and the `completedRef` idempotency latch as e2e-only
 * surfaces. This file pulls them into the unit layer with
 * `vi.useFakeTimers()` driving the timeline deterministically.
 *
 * Mirrors the structure of `DotCardCell.test.tsx` (the dice-pip
 * primitive's own component test) — same import / wrapper /
 * expectations vocabulary so future-Devon onboarding to the dot-card
 * code only has to learn one pattern.
 *
 * Spec: `design/screen-math-subitising-prompt.md` § "Motion".
 *
 * Wrapper note
 * ------------
 * The component renders an `<m.div>` from `motion/react`, so the
 * test tree wraps in `<LazyMotion features={domAnimation} strict>` +
 * `<MotionConfig reducedMotion="user">` — same shape as
 * `Math.test.tsx`'s `withMotion` helper. Without LazyMotion the
 * lowercase `<m.*>` motion components throw at render-time.
 *
 * Timer note
 * ----------
 * `vi.useFakeTimers({ toFake: [...] })` is intentionally surgical —
 * we only fake the timer functions the lifecycle uses. `Promise`,
 * `queueMicrotask`, etc. stay real so React's commit phase + effect
 * scheduling continue to work normally. Fully-faked timers can
 * deadlock React 19's strict-mode double-render in some cases.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import { DotCardOverlay } from './DotCardOverlay'
import {
  DOT_CARD_FADE_IN_MS,
  DOT_CARD_HOLD_MS,
  DOT_CARD_FADE_OUT_MS,
  DOT_CARD_REDUCED_MOTION_HOLD_MS,
} from './dotCard'

function withMotion(node: React.ReactNode): React.ReactElement {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

/**
 * Shared test setup: fake the four timer functions the lifecycle
 * uses. Promise / microtask scheduling stays real.
 */
function useLifecycleFakeTimers(): void {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
}

describe('<DotCardOverlay /> — lifecycle (full motion)', () => {
  beforeEach(() => {
    useLifecycleFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mounts in `fadingIn` phase when full motion is enabled', () => {
    render(
      withMotion(
        <DotCardOverlay
          pipsA={3}
          pipsB={2}
          pageHidden={false}
          reducedMotion={false}
        />,
      ),
    )
    const overlay = screen.getByTestId('math-dot-card')
    expect(overlay).toHaveAttribute('data-phase', 'fadingIn')
    expect(overlay).toHaveAttribute('data-paused', 'false')

    // Both cells render — `[3, 2]` pips at mount.
    const cells = screen.getAllByTestId('math-dot-card-cell')
    expect(cells).toHaveLength(2)
    expect(cells[0]).toHaveAttribute('data-pips', '3')
    expect(cells[1]).toHaveAttribute('data-pips', '2')
  })

  it('advances fadingIn → holding after DOT_CARD_FADE_IN_MS (200ms)', async () => {
    render(
      withMotion(
        <DotCardOverlay
          pipsA={3}
          pipsB={2}
          pageHidden={false}
          reducedMotion={false}
        />,
      ),
    )
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'fadingIn',
    )

    // Advance just under the boundary — phase should still be fadingIn.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_FADE_IN_MS - 1)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'fadingIn',
    )

    // Cross the boundary — phase flips to holding.
    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'holding',
    )
  })

  it('advances holding → fadingOut after DOT_CARD_HOLD_MS (700ms full-motion)', async () => {
    render(
      withMotion(
        <DotCardOverlay
          pipsA={3}
          pipsB={2}
          pageHidden={false}
          reducedMotion={false}
        />,
      ),
    )

    // Skip past fadingIn into holding.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_FADE_IN_MS)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'holding',
    )

    // Just under the holding boundary.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_HOLD_MS - 1)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'holding',
    )

    // Cross — flips to fadingOut.
    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'fadingOut',
    )
  })

  it('fires onComplete exactly once after the full timeline (200 + 700 + 200 = 1100ms)', async () => {
    const onComplete = vi.fn()
    render(
      withMotion(
        <DotCardOverlay
          pipsA={3}
          pipsB={2}
          pageHidden={false}
          reducedMotion={false}
          onComplete={onComplete}
        />,
      ),
    )

    // Walk through each phase in its own `act` so React commits the
    // `setPhase` re-render and arms the next phase's timer before
    // we advance again. Combining all three phases into one
    // `advanceTimersByTime` would consume the boundary before the
    // next effect arms its timer (React 19 concurrent commit + fake
    // timers).
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_FADE_IN_MS)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_HOLD_MS)
      await Promise.resolve()
    })
    expect(onComplete).toHaveBeenCalledTimes(0)

    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_FADE_OUT_MS)
      await Promise.resolve()
    })
    expect(onComplete).toHaveBeenCalledTimes(1)

    // Advancing further must NOT re-fire.
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

describe('<DotCardOverlay /> — lifecycle (reduced motion)', () => {
  beforeEach(() => {
    useLifecycleFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mounts directly in `holding` phase when reduced motion is on', () => {
    render(
      withMotion(
        <DotCardOverlay pipsA={4} pipsB={1} pageHidden={false} reducedMotion />,
      ),
    )
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'holding',
    )
  })

  it('uses the longer 900ms hold so the visible window stays ~1100ms', async () => {
    const onComplete = vi.fn()
    render(
      withMotion(
        <DotCardOverlay
          pipsA={4}
          pipsB={1}
          pageHidden={false}
          reducedMotion
          onComplete={onComplete}
        />,
      ),
    )

    // 700ms in — full-motion would be transitioning to fadingOut by
    // now, but reduced-motion holds for 900ms.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_HOLD_MS)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'holding',
    )

    // Cross the 900ms boundary — flips to fadingOut.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_REDUCED_MOTION_HOLD_MS - DOT_CARD_HOLD_MS)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'fadingOut',
    )

    // 200ms more for the fade-out → onComplete fires.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_FADE_OUT_MS)
      await Promise.resolve()
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

describe('<DotCardOverlay /> — pageHidden pause and resume', () => {
  beforeEach(() => {
    useLifecycleFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not advance phase or fire onComplete while pageHidden is true', async () => {
    const onComplete = vi.fn()
    const { rerender } = render(
      withMotion(
        <DotCardOverlay
          pipsA={3}
          pipsB={2}
          pageHidden
          reducedMotion={false}
          onComplete={onComplete}
        />,
      ),
    )

    // Initial mount under full-motion is `fadingIn` regardless of
    // pageHidden — pageHidden gates the lifecycle effect, not the
    // initial state.
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'fadingIn',
    )
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-paused',
      'true',
    )

    // Advance well past the entire 1100ms timeline. Phase must NOT
    // advance and onComplete must NOT fire — Marian's iPad is asleep.
    await act(async () => {
      vi.advanceTimersByTime(5000)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'fadingIn',
    )
    expect(onComplete).toHaveBeenCalledTimes(0)

    // Resume — pageHidden flips to false; lifecycle re-arms from the
    // current phase (fadingIn).
    rerender(
      withMotion(
        <DotCardOverlay
          pipsA={3}
          pipsB={2}
          pageHidden={false}
          reducedMotion={false}
          onComplete={onComplete}
        />,
      ),
    )
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-paused',
      'false',
    )

    // After the resume, advance through the remaining timeline. We
    // step phase-by-phase so React commits each `setPhase` before
    // the next timer advance — combining all 1100ms into one
    // `advanceTimersByTime` would consume the holding boundary
    // before the fadingOut effect arms its own timer.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_FADE_IN_MS)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_HOLD_MS)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_FADE_OUT_MS)
      await Promise.resolve()
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('pauses mid-holding and resumes the holding timer cleanly', async () => {
    const onComplete = vi.fn()
    const { rerender } = render(
      withMotion(
        <DotCardOverlay
          pipsA={3}
          pipsB={2}
          pageHidden={false}
          reducedMotion={false}
          onComplete={onComplete}
        />,
      ),
    )

    // Walk through fadingIn into holding.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_FADE_IN_MS)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'holding',
    )

    // Background — pageHidden flips to true.
    rerender(
      withMotion(
        <DotCardOverlay
          pipsA={3}
          pipsB={2}
          pageHidden
          reducedMotion={false}
          onComplete={onComplete}
        />,
      ),
    )

    // Even after a long sleep, phase stays at holding and onComplete
    // does not fire.
    await act(async () => {
      vi.advanceTimersByTime(60_000)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'holding',
    )
    expect(onComplete).toHaveBeenCalledTimes(0)

    // Resume — re-arms the holding timer from the current phase.
    // Implementation detail: the timer restarts with the FULL hold
    // window (no remaining-time bookkeeping) per the spec § "First-
    // read vs retry → What if Marian backgrounds…". The total post-
    // resume budget to onComplete is therefore HOLD_MS + FADE_OUT_MS.
    rerender(
      withMotion(
        <DotCardOverlay
          pipsA={3}
          pipsB={2}
          pageHidden={false}
          reducedMotion={false}
          onComplete={onComplete}
        />,
      ),
    )

    // Step holding → fadingOut, then fadingOut → onComplete in
    // separate acts so React commits each phase transition before
    // the next timer advances.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_HOLD_MS)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_FADE_OUT_MS)
      await Promise.resolve()
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

describe('<DotCardOverlay /> — completedRef latch idempotency', () => {
  beforeEach(() => {
    useLifecycleFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not re-fire onComplete when parent re-renders during fade-out', async () => {
    const onComplete = vi.fn()
    const { rerender } = render(
      withMotion(
        <DotCardOverlay
          pipsA={3}
          pipsB={2}
          pageHidden={false}
          reducedMotion={false}
          onComplete={onComplete}
        />,
      ),
    )

    // Walk to onComplete — phase-by-phase so React commits each
    // `setPhase` before the next timer fires.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_FADE_IN_MS)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_HOLD_MS)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_FADE_OUT_MS)
      await Promise.resolve()
    })
    expect(onComplete).toHaveBeenCalledTimes(1)

    // Force several parent re-renders with fresh inline-arrow
    // callbacks — the latch must hold even if the effect's deps
    // change (testing that the `completedRef` short-circuits).
    for (let i = 0; i < 3; i++) {
      const next = vi.fn()
      rerender(
        withMotion(
          <DotCardOverlay
            pipsA={3}
            pipsB={2}
            pageHidden={false}
            reducedMotion={false}
            onComplete={next}
          />,
        ),
      )
      await act(async () => {
        vi.advanceTimersByTime(2000)
        await Promise.resolve()
      })
      // Neither the original nor the new callback should fire — the
      // overlay has already completed once and the latch is sticky.
      expect(next).toHaveBeenCalledTimes(0)
    }
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('does not re-arm the lifecycle timer when an inline-arrow `onComplete` reference changes mid-window', async () => {
    // Regression for AC2 — pre-fix, an inline-arrow `onComplete`
    // recreated on every parent render would re-trigger the
    // lifecycle effect's dep array, clear the in-flight timer, and
    // re-arm a fresh one. With the `useLayoutEffect`-synced ref the
    // effect's dep array no longer includes `onComplete`, so the
    // single armed timer survives the parent's re-renders and fires
    // exactly once at the original boundary.
    const onComplete = vi.fn()
    const { rerender } = render(
      withMotion(
        <DotCardOverlay
          pipsA={3}
          pipsB={2}
          pageHidden={false}
          reducedMotion={false}
          onComplete={() => onComplete()}
        />,
      ),
    )

    // Walk fadingIn → holding so the holding timer is armed.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_FADE_IN_MS)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'holding',
    )

    // Halfway into holding, force a re-render with a fresh inline
    // arrow. Pre-AC2 fix this would have re-triggered the lifecycle
    // effect, cleared the in-flight holding timer, and re-armed a
    // fresh one — shifting the boundary by HOLD_MS / 2.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_HOLD_MS / 2)
      await Promise.resolve()
    })
    rerender(
      withMotion(
        <DotCardOverlay
          pipsA={3}
          pipsB={2}
          pageHidden={false}
          reducedMotion={false}
          onComplete={() => onComplete()}
        />,
      ),
    )

    // Advance EXACTLY the remaining HOLD budget. Post-fix the holding
    // timer's original boundary holds, so `setPhase('fadingOut')`
    // fires here. Pre-fix the timer would have been re-armed at
    // mid-window and would NOT fire until we'd advanced HOLD_MS / 2
    // MORE — which would surface as the assertion below failing.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_HOLD_MS / 2)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'fadingOut',
    )

    // FadingOut → onComplete fires after FADE_OUT_MS more.
    await act(async () => {
      vi.advanceTimersByTime(DOT_CARD_FADE_OUT_MS)
      await Promise.resolve()
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

describe('<DotCardOverlay /> — __testSkipLifecycle (FROZEN seam)', () => {
  beforeEach(() => {
    useLifecycleFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('FREEZES the phase, never fires onComplete, but renders cells', async () => {
    const onComplete = vi.fn()
    render(
      withMotion(
        <DotCardOverlay
          pipsA={3}
          pipsB={2}
          pageHidden={false}
          reducedMotion={false}
          onComplete={onComplete}
          __testSkipLifecycle
        />,
      ),
    )

    // Initial phase under full-motion is `fadingIn` — and stays
    // there because the lifecycle effect early-returns.
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'fadingIn',
    )

    // Cells render — count selectors can pin against them without
    // racing the dismissal cascade.
    expect(screen.getAllByTestId('math-dot-card-cell')).toHaveLength(2)

    // Advance well past the natural 1100ms timeline; nothing changes.
    await act(async () => {
      vi.advanceTimersByTime(10_000)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'fadingIn',
    )
    expect(onComplete).toHaveBeenCalledTimes(0)
  })

  it('FROZEN seam under reduced-motion still renders cells and never fires onComplete', async () => {
    const onComplete = vi.fn()
    render(
      withMotion(
        <DotCardOverlay
          pipsA={4}
          pipsB={1}
          pageHidden={false}
          reducedMotion
          onComplete={onComplete}
          __testSkipLifecycle
        />,
      ),
    )

    // Reduced-motion initial phase is `holding`; the seam keeps it
    // there indefinitely.
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'holding',
    )
    expect(screen.getAllByTestId('math-dot-card-cell')).toHaveLength(2)

    await act(async () => {
      vi.advanceTimersByTime(10_000)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math-dot-card')).toHaveAttribute(
      'data-phase',
      'holding',
    )
    expect(onComplete).toHaveBeenCalledTimes(0)
  })
})
