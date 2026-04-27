import { useEffect, useRef, useState } from 'react'
import { m } from 'motion/react'
import {
  detectColdStart,
  markWarm,
  splashCapMs,
  WARM_CAP_MS,
} from './splashTiming'

/**
 * Screen 1 — Splash / Launch.
 *
 * Spec: design/session-1.md §"Screen 1 — Splash / Launch".
 *
 * Behaviour summary:
 *  - Silent. No TTS, no SFX.
 *  - Auto-advances after 1500ms (warm) or up to 3000ms (cold). No skip.
 *  - Logo: spring scale-in (stiffness 180, damping 18, opacity 0→1, scale
 *    0.9→1) per spec line 70. Reduced-motion fallback is handled globally
 *    via <MotionConfig reducedMotion="user"> at the App root: springs
 *    collapse to short fades, scale snaps to final value.
 *  - Three pulsing dots, ~150 ms stagger.
 *  - Background: --my-cream with subtle radial pink wash, full-bleed.
 *
 * Reduced-motion: the global MotionConfig collapses springs to fades and
 * removes pulsing on `repeat: Infinity` style loops. The unit test verifies
 * the static-fallback shape by mocking the media query.
 *
 * Path A note (post-86c9h3c57): the cold-start Web Speech voice warmup
 * was removed once the audio pipeline switched to pre-rendered MP3s
 * through Howler + server-side Azure Speech TTS. The old `lib/tts/`
 * module has been deleted entirely (ticket 86c9grn3n).
 */

export interface SplashProps {
  /** Called when the splash should hand off to the next screen. */
  onAdvance: () => void
  /** Test seam: override the cold-start detector. */
  detector?: () => boolean
}

const SPRING = { type: 'spring' as const, stiffness: 180, damping: 18 }
const FADE_OUT_MS = 250
const DOT_STAGGER_MS = 150

const DOT_VARIANTS = {
  initial: { opacity: 0.4 },
  pulse: {
    opacity: [0.4, 1, 0.4],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      repeatType: 'mirror' as const,
      ease: 'easeInOut' as const,
    },
  },
}

export default function Splash({
  onAdvance,
  detector = detectColdStart,
}: SplashProps) {
  // Capture the cap once on mount — flipping during the splash makes no sense.
  // Lazy-init useState so detectColdStart() runs exactly once.
  const [capMs] = useState(() => splashCapMs(detector()))
  const advancedRef = useRef(false)

  useEffect(() => {
    markWarm()

    const advance = () => {
      if (advancedRef.current) return
      advancedRef.current = true
      onAdvance()
    }

    const id = window.setTimeout(advance, capMs)
    return () => window.clearTimeout(id)
  }, [capMs, onAdvance])

  return (
    <m.main
      data-testid="splash"
      data-cap-ms={capMs}
      className="
        relative flex h-full w-full flex-col items-center justify-center
        bg-my-cream text-ink
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
      "
      style={{
        // Spec line 58: subtle radial gradient cream → my-pink @ 10%.
        backgroundImage:
          'radial-gradient(circle at 50% 45%, rgba(255,192,203,0.10) 0%, rgba(255,245,240,0) 60%)',
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: FADE_OUT_MS / 1000 } }}
      aria-label="Melody is waking up"
    >
      <m.img
        src="/assets/melody-logo.svg"
        alt="Melody"
        className="w-60 max-w-[60vw] select-none"
        draggable={false}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING}
      />

      <m.div
        role="presentation"
        className="mt-10 flex items-center gap-4"
        initial="initial"
        animate="pulse"
        transition={{ staggerChildren: DOT_STAGGER_MS / 1000 }}
        data-testid="splash-dots"
      >
        {[0, 1, 2].map((i) => (
          <m.span
            key={i}
            data-testid="splash-dot"
            variants={DOT_VARIANTS}
            className="block h-3 w-3 rounded-full bg-my-rose"
          />
        ))}
      </m.div>
    </m.main>
  )
}

export { WARM_CAP_MS, FADE_OUT_MS, DOT_STAGGER_MS }
