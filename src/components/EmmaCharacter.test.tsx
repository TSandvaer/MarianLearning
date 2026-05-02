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
  CELEBRATION_DURATION_MS,
  CELEBRATION_HOLD_MS,
  CELEBRATION_TILT_EASES,
  CELEBRATION_TILT_KEYFRAMES,
  CELEBRATION_TILT_TIMES,
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

  it('TILT_SPRING_BY_POSE matches the brief: 260/20 default, 220/22 celebration (keyframe fallback), 220/20 puzzled-tilt', () => {
    expect(TILT_SPRING_BY_POSE.idle).toEqual({ stiffness: 260, damping: 20 })
    // Celebration's spring config is documentation / fallback only —
    // the active path is the keyframed tilt-out → hold → tilt-back
    // (see CELEBRATION_* constants). Iteration #2 raised the firmness
    // back from 200 → 220 because the hold beat is doing the
    // visibility work; the spring just needs to feel deliberate if
    // anything ever falls back to it.
    expect(TILT_SPRING_BY_POSE.celebration).toEqual({
      stiffness: 220,
      damping: 22,
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

  // ── Celebration keyframe contract (iteration #2, ticket 86c9kxmqb) ──
  //
  // The hold beat is what fixes "I hardly see the second pose" — pin
  // the keyframe shape, hold duration, and total motion duration so a
  // future drift fails loudly. Thomas's apex-visibility ask is a
  // testable contract here, not a vibe.

  it('CELEBRATION_HOLD_MS is 250 — the apex-visibility window per iter #2', () => {
    expect(CELEBRATION_HOLD_MS).toBe(250)
  })

  it('CELEBRATION_DURATION_MS is 700 — within the 700-800ms target band', () => {
    expect(CELEBRATION_DURATION_MS).toBe(700)
    // Sanity: total motion must stay in the 700-800ms band the
    // dispatch contract spec'd. Below 700 reads snappy (the iter #1
    // failure mode), above 800 reads laggy.
    expect(CELEBRATION_DURATION_MS).toBeGreaterThanOrEqual(700)
    expect(CELEBRATION_DURATION_MS).toBeLessThanOrEqual(800)
  })

  it('CELEBRATION_TILT_KEYFRAMES is [0, -6, -6, 0] — out, hold, hold, return', () => {
    expect(CELEBRATION_TILT_KEYFRAMES).toEqual([0, -6, -6, 0])
    // Apex value matches TILT_BY_POSE.celebration so the shared-spec
    // -6° rotation arc is consistent across the keyframe and tilt-map.
    expect(CELEBRATION_TILT_KEYFRAMES[1]).toBe(TILT_BY_POSE.celebration)
    expect(CELEBRATION_TILT_KEYFRAMES[2]).toBe(TILT_BY_POSE.celebration)
  })

  it('CELEBRATION_TILT_TIMES bracket the hold to ~250ms within 700ms total', () => {
    expect(CELEBRATION_TILT_TIMES).toEqual([0, 0.286, 0.643, 1])
    // The hold segment is times[1] → times[2]. Verify it actually
    // resolves to ~CELEBRATION_HOLD_MS in real time. Allow ±5ms
    // tolerance for the rounding to 3-decimal time-fractions.
    const holdSegment = CELEBRATION_TILT_TIMES[2] - CELEBRATION_TILT_TIMES[1]
    const holdMs = holdSegment * CELEBRATION_DURATION_MS
    expect(holdMs).toBeGreaterThanOrEqual(CELEBRATION_HOLD_MS - 5)
    expect(holdMs).toBeLessThanOrEqual(CELEBRATION_HOLD_MS + 5)
  })

  it('CELEBRATION_TILT_EASES are easeOut → linear → easeInOut for the three segments', () => {
    // Segment 1 (tilt-out): easeOut so the apex lands with deceleration.
    // Segment 2 (hold): linear because rotation isn't changing — the
    // ease here is irrelevant motion-wise but explicit for clarity.
    // Segment 3 (tilt-back): easeInOut so the return reads as deliberate.
    expect(CELEBRATION_TILT_EASES).toEqual(['easeOut', 'linear', 'easeInOut'])
  })
})
