import { m } from 'motion/react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

/**
 * "Getting ready" placeholder (Emma's Path 1/10, ClickUp 123jpnbc3dh).
 *
 * Fills the problem-area slot on Math / Word Song while the session-start
 * fetch is still in flight, so the screen never reads as blank. Emma
 * herself switches to her existing `listening` pose in the screen (no new
 * art). Purely visual — no caption, no voice line: three soft dots pulse
 * in sequence. Reduced motion → static dots.
 */
export function GettingReady({ testId }: { testId: string }) {
  const reducedMotion = usePrefersReducedMotion()
  return (
    <div
      data-testid={testId}
      role="status"
      aria-label="Getting ready"
      className="mt-4 flex flex-1 items-center justify-center gap-4"
    >
      {[0, 1, 2].map((i) => (
        <m.span
          key={i}
          aria-hidden
          className="block h-6 w-6 rounded-full bg-my-rose"
          initial={{ opacity: 0.35, scale: 0.8 }}
          animate={
            reducedMotion
              ? { opacity: 0.6, scale: 1 }
              : { opacity: [0.35, 1, 0.35], scale: [0.8, 1.15, 0.8] }
          }
          transition={
            reducedMotion
              ? { duration: 0.2 }
              : {
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.2,
                }
          }
        />
      ))}
    </div>
  )
}
