/**
 * Conditional streak summary band for Session End.
 *
 * Spec: `design/screen-5-session-end.md` section "Visual layout" and
 * "Motion" table. Only renders if `finalStreak >= 3`. Fades in with
 * `opacity 0->1 + y: 12->0` over 400ms. Fixed-height even when hidden
 * to prevent layout reflow.
 */

import { m, AnimatePresence } from 'motion/react'
import type { ReactElement } from 'react'

export interface StreakBandProps {
  /** Longest streak hit during this session. Band visible iff >= 3. */
  finalStreak: number
  /** When true, the band animates in. */
  visible: boolean
  /** True when reduced motion is preferred. */
  reducedMotion?: boolean
}

export default function StreakBand({
  finalStreak,
  visible,
  reducedMotion = false,
}: StreakBandProps): ReactElement {
  const show = visible && finalStreak >= 3

  return (
    <div
      data-testid="streak-band-slot"
      className="flex h-[10vh] items-center justify-center"
    >
      <AnimatePresence>
        {show && (
          <m.div
            key="streak-band"
            data-testid="streak-band"
            data-streak={finalStreak}
            className="flex items-center justify-center gap-2 font-display text-[1.8rem] text-my-rose"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <span aria-hidden>&#x1F525;</span>
            <span>{finalStreak} in a row!</span>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
