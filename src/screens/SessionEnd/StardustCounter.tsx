/**
 * Animated stardust counter for Session End.
 *
 * Spec: `design/screen-5-session-end.md` section "Visual layout" and
 * "Motion" table. Ticks up from 0 to `totalStardust` over `durationMs`.
 * Each tick fires a per-tick pop (scale 1 -> 1.05 -> 1 over 150ms) and
 * optionally plays a plink SFX. The star glyph is at 32pt, the numeral
 * at 64pt.
 *
 * When `totalStardust === 0`, the counter still renders (showing "0")
 * but no tick-up animation plays -- the spec says the recap utterance
 * is skipped, and the counter stays at 0.
 */

import { useEffect, useRef, useState } from 'react'
import { m } from 'motion/react'
import type { Sfx } from '../../lib/sfx'
import type { ReactElement } from 'react'

export interface StardustCounterProps {
  /** Target stardust to count up to. 0-19 in v1. */
  totalStardust: number
  /** Duration of the tick-up in ms. Spec default ~1800ms. */
  durationMs?: number
  /** When true, start the tick-up animation. */
  active: boolean
  /** Optional plink SFX per tick. */
  plink?: Sfx
  /** True when reduced motion is preferred. */
  reducedMotion?: boolean
}

export default function StardustCounter({
  totalStardust,
  durationMs = 1800,
  active,
  plink,
  reducedMotion = false,
}: StardustCounterProps): ReactElement {
  const [displayValue, setDisplayValue] = useState(0)
  const [popping, setPopping] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!active || totalStardust <= 0) return

    // Both reduced-motion (instant jump) and full-motion (tick-up) use
    // the same interval-based pattern. For reduced motion we use a single
    // immediate tick via setTimeout(0) to satisfy the lint rule that
    // effects should schedule state updates via subscriptions, not call
    // setState synchronously.
    if (reducedMotion) {
      const id = setTimeout(() => {
        setDisplayValue(totalStardust)
        plink?.play()
      }, 0)
      return () => clearTimeout(id)
    }

    const intervalMs = durationMs / totalStardust
    let current = 0

    timerRef.current = setInterval(() => {
      current += 1
      setDisplayValue(current)

      // Pop animation per tick
      setPopping(true)
      if (popTimerRef.current !== null) clearTimeout(popTimerRef.current)
      popTimerRef.current = setTimeout(() => {
        setPopping(false)
        popTimerRef.current = null
      }, 150)

      // Plink SFX per tick
      plink?.play()

      if (current >= totalStardust) {
        if (timerRef.current !== null) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }
    }, intervalMs)

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (popTimerRef.current !== null) {
        clearTimeout(popTimerRef.current)
        popTimerRef.current = null
      }
    }
  }, [active, totalStardust, durationMs, plink, reducedMotion])

  return (
    <div
      data-testid="stardust-counter"
      className="flex items-center justify-center gap-3"
    >
      {/* Star glyph at 32pt */}
      <StarGlyph />
      <m.span
        data-testid="stardust-counter-value"
        className="font-display text-ink"
        style={{ fontSize: '64pt', lineHeight: 1 }}
        animate={popping ? { scale: 1.05 } : { scale: 1 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        {displayValue}
      </m.span>
    </div>
  )
}

/** Inline star-filled SVG glyph at 32pt. */
function StarGlyph(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden
      style={{ width: '32pt', height: '32pt' }}
    >
      <path
        d="M12 2 L14.09 8.26 L20.82 9.27 L15.91 13.14 L17.18 19.82 L12 16.77 L6.82 19.82 L8.09 13.14 L3.18 9.27 L9.91 8.26 Z"
        fill="#FFD966"
        stroke="#E0B800"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}
