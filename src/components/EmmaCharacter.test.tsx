/**
 * Tests for `EmmaCharacter` — the shared character render component
 * that consumes the Phase 3b motion brief (ticket 86c9kwh66 / wired
 * here in 86c9kwvza).
 *
 * Spec source-of-truth: `design/character/motion-brief.md` §3.2-§3.5.
 *
 * These tests pin the contract that every consumer screen depends on:
 *
 *   - The rendered `<m.img>` carries the right `src` per pose.
 *   - `data-pose` and `data-wiggling` attributes match the pose state
 *     (data-wiggling = motion-active and pose != idle).
 *   - The transformOrigin is set to `'50% 100%'` (feet) per the brief
 *     §3.5 pivot resolution.
 *   - `prefers-reduced-motion` collapses the rotateZ + breathing while
 *     leaving the pose-swap visible (different SVG renders).
 *   - layoutId, className, alt, and the data-* + event-handler spread
 *     all flow through cleanly.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'
import EmmaCharacter from './EmmaCharacter'
import {
  TILT_BY_POSE,
  TILT_SPRING_BY_POSE,
  BREATHING_PERIOD_S,
  BREATHING_SCALE_KEYFRAMES,
} from '../lib/character/emmaPose'

function withMotion(node: ReactNode) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

/** Force the matchMedia query for prefers-reduced-motion. */
function stubReducedMotion(matches: boolean) {
  return vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: matches && query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }))
}

describe('EmmaCharacter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Pose / src wiring ────────────────────────────────────────────────

  it('renders the pose-keyed SVG for idle', () => {
    render(withMotion(<EmmaCharacter pose="idle" data-testid="emma-test" />))
    const img = screen.getByTestId('emma-test')
    expect(img.getAttribute('src')).toBe('/assets/emma-idle.svg')
    expect(img.getAttribute('data-pose')).toBe('idle')
  })

  it('renders the pose-keyed SVG for celebration', () => {
    render(
      withMotion(<EmmaCharacter pose="celebration" data-testid="emma-test" />),
    )
    const img = screen.getByTestId('emma-test')
    expect(img.getAttribute('src')).toBe('/assets/emma-celebration.svg')
    expect(img.getAttribute('data-pose')).toBe('celebration')
  })

  it('renders the pose-keyed SVG for puzzled-tilt', () => {
    render(
      withMotion(<EmmaCharacter pose="puzzled-tilt" data-testid="emma-test" />),
    )
    const img = screen.getByTestId('emma-test')
    expect(img.getAttribute('src')).toBe('/assets/emma-puzzled-tilt.svg')
    expect(img.getAttribute('data-pose')).toBe('puzzled-tilt')
  })

  it('honours the `src` override (rare — used for one-shot screens)', () => {
    render(
      withMotion(
        <EmmaCharacter
          pose="cheering"
          src="/assets/emma-custom.svg"
          data-testid="emma-test"
        />,
      ),
    )
    expect(screen.getByTestId('emma-test').getAttribute('src')).toBe(
      '/assets/emma-custom.svg',
    )
  })

  it('defaults alt text to "Emma" and accepts an override', () => {
    const { rerender } = render(
      withMotion(<EmmaCharacter pose="idle" data-testid="emma-test" />),
    )
    expect(screen.getByTestId('emma-test').getAttribute('alt')).toBe('Emma')

    rerender(
      withMotion(
        <EmmaCharacter pose="idle" alt="Emma waving" data-testid="emma-test" />,
      ),
    )
    expect(screen.getByTestId('emma-test').getAttribute('alt')).toBe(
      'Emma waving',
    )
  })

  // ── data-wiggling ────────────────────────────────────────────────────

  it('data-wiggling is "false" on idle (motion enabled)', () => {
    stubReducedMotion(false)
    render(withMotion(<EmmaCharacter pose="idle" data-testid="emma-test" />))
    expect(screen.getByTestId('emma-test')).toHaveAttribute(
      'data-wiggling',
      'false',
    )
  })

  it('data-wiggling is "true" on celebration (motion enabled)', () => {
    stubReducedMotion(false)
    render(
      withMotion(<EmmaCharacter pose="celebration" data-testid="emma-test" />),
    )
    expect(screen.getByTestId('emma-test')).toHaveAttribute(
      'data-wiggling',
      'true',
    )
  })

  it('data-wiggling is "true" on puzzled-tilt (motion enabled)', () => {
    stubReducedMotion(false)
    render(
      withMotion(<EmmaCharacter pose="puzzled-tilt" data-testid="emma-test" />),
    )
    expect(screen.getByTestId('emma-test')).toHaveAttribute(
      'data-wiggling',
      'true',
    )
  })

  it('data-wiggling is "false" under prefers-reduced-motion (even on celebration)', () => {
    stubReducedMotion(true)
    render(
      withMotion(<EmmaCharacter pose="celebration" data-testid="emma-test" />),
    )
    expect(screen.getByTestId('emma-test')).toHaveAttribute(
      'data-wiggling',
      'false',
    )
  })

  // ── transformOrigin ──────────────────────────────────────────────────

  it('sets transformOrigin to "50% 100%" (feet) per motion brief §3.5', () => {
    render(withMotion(<EmmaCharacter pose="idle" data-testid="emma-test" />))
    const img = screen.getByTestId('emma-test')
    // jsdom serialises style.transformOrigin to a CSS string. The
    // matcher is loose because Framer Motion may add other properties
    // (e.g. transform-origin via style attribute), but the assertion
    // is a substring match for the value we set.
    expect(img.getAttribute('style')).toMatch(/transform-origin:\s*50%\s*100%/)
  })

  it('caller-supplied style merges over the default transformOrigin only when they collide', () => {
    render(
      withMotion(
        <EmmaCharacter
          pose="idle"
          data-testid="emma-test"
          style={{ marginTop: '12px' }}
        />,
      ),
    )
    const img = screen.getByTestId('emma-test')
    // Default transformOrigin still present.
    expect(img.getAttribute('style')).toMatch(/transform-origin:\s*50%\s*100%/)
    // Caller's custom style merges in.
    expect(img.getAttribute('style')).toMatch(/margin-top:\s*12px/)
  })

  // ── Pass-through ─────────────────────────────────────────────────────

  it('forwards layoutId, className, and arbitrary HTML/data attributes', () => {
    render(
      withMotion(
        <EmmaCharacter
          pose="idle"
          layoutId="emma"
          data-testid="emma-test"
          className="h-[26vh] w-auto"
          data-something="custom"
        />,
      ),
    )
    const img = screen.getByTestId('emma-test')
    // layoutId is consumed by Framer Motion (not rendered as a DOM
    // attribute), but className + custom data-* are.
    expect(img.className).toContain('h-[26vh]')
    expect(img.className).toContain('w-auto')
    expect(img.getAttribute('data-something')).toBe('custom')
  })

  it('forwards pointer event handlers via spread (used by Hub long-press)', () => {
    const onPointerDown = vi.fn()
    render(
      withMotion(
        <EmmaCharacter
          pose="idle"
          data-testid="emma-test"
          onPointerDown={onPointerDown}
        />,
      ),
    )
    const img = screen.getByTestId('emma-test')
    img.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
    )
    expect(onPointerDown).toHaveBeenCalledTimes(1)
  })

  // ── Spec-config sanity ────────────────────────────────────────────────
  //
  // These pin the values exported from `emmaPose.ts` against the motion
  // brief so a future drift in TILT_BY_POSE / TILT_SPRING_BY_POSE /
  // BREATHING_* fails the test loudly.

  it('TILT_BY_POSE matches the brief: celebration -6, puzzled-tilt +10, idle 0', () => {
    expect(TILT_BY_POSE.idle).toBe(0)
    expect(TILT_BY_POSE.celebration).toBe(-6)
    expect(TILT_BY_POSE['puzzled-tilt']).toBe(10)
  })

  it('TILT_SPRING_BY_POSE matches the brief: 260/20 default, 220/20 for puzzled-tilt', () => {
    expect(TILT_SPRING_BY_POSE.idle).toEqual({ stiffness: 260, damping: 20 })
    expect(TILT_SPRING_BY_POSE.celebration).toEqual({
      stiffness: 260,
      damping: 20,
    })
    expect(TILT_SPRING_BY_POSE['puzzled-tilt']).toEqual({
      stiffness: 220,
      damping: 20,
    })
  })

  it('BREATHING_SCALE_KEYFRAMES is [1, 1.02, 1] with 4-second period', () => {
    expect(BREATHING_SCALE_KEYFRAMES).toEqual([1, 1.02, 1])
    expect(BREATHING_PERIOD_S).toBe(4)
  })
})
