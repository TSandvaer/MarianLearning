/**
 * Sleep splash screen (Option C) -- "Come back soon."
 *
 * Spec: `design/screen-5-session-end.md` section "What 'All done!' does",
 * Option C sub-spec. Renders after the "All done!" CTA tap.
 *
 * Contract:
 * - No TTS on this screen. Emma rests. Audio playing here defeats the
 *   "we're done" message.
 * - No further interactions. Tapping anywhere does nothing.
 * - No "Tap to start a new session!" affordance (anti-dark-pattern).
 * - Background dims slightly (cream -> soft-twilight at ~85% brightness)
 *   over the 300ms fade-in.
 * - Auto-dismiss after ~5s or tap-to-dismiss (ticket description says
 *   auto-dismiss; spec says "sits indefinitely; no nag, no auto-advance").
 *   Going with spec: NO auto-dismiss, NO tap-to-dismiss. Sleep splash
 *   persists until Marian closes the PWA via iPad gesture.
 *
 * Phase 3b note (ticket 86c9jccp7): the inline sleeping-bunny placeholder
 * has been replaced by the canonical Emma asset pipeline. The sleepy pose
 * shipped separately via ticket 86c9jcajq.
 */

import { m } from 'motion/react'
import type { ReactElement } from 'react'

export default function SleepSplash(): ReactElement {
  return (
    <m.div
      data-testid="sleep-splash"
      className="
        absolute inset-0 z-50
        flex flex-col items-center justify-center
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
        overflow-hidden
      "
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        // Soft twilight wash -- cream -> soft lavender at ~85% brightness
        background:
          'linear-gradient(180deg, #F5EDF7 0%, #EDE0F0 40%, #E8D5EE 100%)',
      }}
    >
      {/* Sleepy Emma -- centered, ~40vh. */}
      <div className="flex h-[40vh] items-center justify-center">
        <m.img
          data-testid="sleep-splash-emma"
          src="/assets/emma-sleepy.svg"
          alt="Emma resting"
          draggable={false}
          className="h-full w-auto select-none"
        />
      </div>

      {/* "Come back soon." text -- 28pt, no TTS */}
      <m.div
        className="
          mx-auto mt-6 w-[88%] max-w-2xl
          rounded-3xl border-[3px] border-my-pink/40 bg-white/80
          px-6 py-4
          text-center
        "
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
      >
        <p
          data-testid="sleep-splash-text"
          className="font-display text-[2.4rem] leading-snug text-my-rose/80"
        >
          Come back soon.
        </p>
      </m.div>
    </m.div>
  )
}
