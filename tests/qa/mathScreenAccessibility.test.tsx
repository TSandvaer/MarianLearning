/**
 * Build-time guard — the Math screen's three accessibility hooks are wired.
 *
 * Why this lives in tests/qa/ and not in src/screens/Math/__tests__/
 * ------------------------------------------------------------------
 * This test exercises a CONTRACT — the three aria attributes the spec
 * mandates and that downstream tooling (screen readers, the eventual
 * accessibility audit) depends on. It complements the per-feature tests
 * in `src/screens/Math/Math.test.tsx` (which assert behaviour and copy)
 * by locking the aria surface against silent removal.
 *
 * Provenance
 * ----------
 * Bundled with ticket 86c9gumhp (math QA automation gaps backfill, item #6).
 * PR #40 ships all three hooks; Jessica's QA pass verified them by manual
 * grep at Math.tsx:791, 887-888, 962 (line numbers shift over time — the
 * load-bearing surface is the attributes, not the line numbers, and this
 * test asserts attributes via rendered output rather than file location).
 *
 * What we check
 * -------------
 *  1. Every chip has aria-label="Answer N" where N is its data-value.
 *     Spec source: design/screen-3-math.md §"Accessibility"; renders as a
 *     screen-reader-readable label since the chip's visible text is just
 *     the digit and "Answer N" gives it parsing context.
 *  2. The caption ribbon has role="status" + aria-live="polite". Spec
 *     source: design/screen-3-math.md §"Audio integration / Caption
 *     rendering". Polite announcement so the chip hover doesn't preempt
 *     the read-aloud line.
 *  3. The stardust counter has an aria-label="Stardust: N" matching its
 *     data-total. The visible glyph is a sparkle plus the digit; the
 *     aria-label spells it out so the value is parseable by tooling.
 *
 * What we deliberately don't check
 * --------------------------------
 *  - axe-core / full WCAG sweep. Out of scope for a CI guard; that's
 *    part of the in-house accessibility audit when we ship to a wider
 *    audience than Marian's iPad.
 *  - Focus management / keyboard navigation. The Math screen is touch-
 *    primary; keyboard tab order matters but is not part of the v1
 *    spec contract. Follow-up if/when we add keyboard QA.
 *  - aria-hidden on decorative SVG. Spec calls for aria-hidden on the
 *    sparkle glyph and visual-flower groups; that's verified by Math.test.tsx
 *    indirectly (no glyph text bleeds into the rendered text content).
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

/*
 * NOTE on `__testInitiallyAudioUnlocked` threaded through every render below:
 *
 * PR #83 (ticket 86c9guh4y) gates chips behind a `disabled={!readAloudPlayed}`
 * attribute. jsdom + React 19 silently swallows `fireEvent.click` on
 * `<button disabled>`, so the seam pre-arms the gate so chips render
 * tappable on first paint. Production callers never pass this. See
 * `src/screens/Math/Math.test.tsx` for the full rationale.
 */

// Stub the SFX factory so jsdom never tries to construct a real Howl.
// Same pattern as Math.test.tsx — tests don't need real audio output, just
// a no-op handle that won't blow up Howler at module load.
vi.mock('../../src/lib/sfx', () => ({
  createSfx: vi.fn(() => ({
    play: vi.fn(() => true),
    unload: vi.fn(),
    missedPlays: 0,
    loadFailed: false,
  })),
}))

import MathScreen from '../../src/screens/Math/Math'
import type { PlayMathUtteranceFn } from '../../src/screens/Math/Math'
import type { MathSessionPlan } from '../../src/screens/Math/sessionPlans'
import type { StorageAdapter } from '../../src/screens/_shared/stardust'

function withMotion(node: ReactNode) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

/** A fixed plan for tests — first problem is 3 + 2 = 5 (deterministic). */
function fixedPlan(): MathSessionPlan {
  return {
    id: 'a11y-test-plan',
    label: 'Accessibility test plan',
    problems: [
      {
        index: 1,
        addendA: 3,
        addendB: 2,
        correct: 5,
        utterances: {
          read: 'Three plus two. How many?',
          correct: 'Yes! Five!',
          reprompt: 'Hmm... try again?',
          hint: 'Look. Three. And two more. How many now?',
          giveAnswer: 'This one is five.',
        },
      },
      ...Array.from({ length: 7 }, (_, i) => ({
        index: i + 2,
        addendA: 1,
        addendB: 1,
        correct: 2,
        utterances: {
          read: 'One plus one. How many?',
          correct: 'Yes! Two!',
          reprompt: 'Hmm... try again?',
          hint: 'Look. One. And one more. How many now?',
          giveAnswer: 'This one is two.',
        },
      })),
    ],
  }
}

function makeMemoryStorage(): StorageAdapter {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
  }
}

/** Silent play harness — captions tick, no real audio. Same shape as Math.test.tsx. */
function makeSilentPlay(): PlayMathUtteranceFn {
  return vi.fn(async (text, playOpts) => {
    return await new Promise<void>((resolve) => {
      playOpts?.onPlay?.()
      const words = text.split(/\s+/).filter(Boolean)
      for (let i = 0; i < words.length; i++) {
        playOpts?.onWordTick?.(i)
      }
      Promise.resolve().then(() => resolve())
    })
  })
}

describe('Math screen accessibility contract (build-time guard, ticket 86c9gumhp)', () => {
  // Suppress the SFX-load warn that fires under jsdom; not relevant to a11y.
  vi.spyOn(console, 'warn').mockImplementation(() => {})

  it('every chip has an aria-label="Answer N" matching its data-value', () => {
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={makeSilentPlay()}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('math-chip')
    expect(chips.length).toBeGreaterThan(0)
    for (const chip of chips) {
      const value = chip.getAttribute('data-value')
      expect(value, 'chip is missing data-value').not.toBeNull()
      expect(chip).toHaveAttribute('aria-label', `Answer ${value}`)
    }
  })

  it('caption ribbon has role="status" + aria-live="polite"', async () => {
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={makeSilentPlay()}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // The ribbon mounts only when a caption is visible. The first chip-tap
    // unlocks audio; the read-aloud effect then fires `speak()` which sets
    // captionVisible=true via the harness's synchronous onPlay. We tap the
    // correct chip (which itself calls speak() for the celebration line),
    // which guarantees the ribbon is mounted by the time we assert.
    const correctChip = screen
      .getAllByTestId('math-chip')
      .find((c) => c.getAttribute('data-value') === '5')!

    await act(async () => {
      fireEvent.click(correctChip)
      // Drain the microtask queue so speak()'s onPlay callback runs and
      // setCaptionVisible(true) commits.
      await Promise.resolve()
      await Promise.resolve()
    })

    const ribbon = screen.getByTestId('math-ribbon')
    expect(ribbon).toHaveAttribute('role', 'status')
    expect(ribbon).toHaveAttribute('aria-live', 'polite')
  })

  it('stardust counter exposes the value via aria-label="Stardust: N"', () => {
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={makeSilentPlay()}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // The stardust container carries data-total; the inner span carries
    // the aria-label. Find the span by its aria-label prefix to keep this
    // test resilient to future class/style refactors.
    const counter = screen.getByTestId('math-stardust')
    const total = counter.getAttribute('data-total')
    expect(total, 'math-stardust is missing data-total').not.toBeNull()

    const labelled = counter.querySelector(`[aria-label="Stardust: ${total}"]`)
    expect(
      labelled,
      `expected an element with aria-label="Stardust: ${total}" inside math-stardust`,
    ).not.toBeNull()
  })
})
