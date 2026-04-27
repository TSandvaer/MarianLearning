/**
 * Sleep splash screen (Option C) -- "Come back soon."
 *
 * Spec: `design/screen-5-session-end.md` section "What 'All done!' does",
 * Option C sub-spec. Renders after the "All done!" CTA tap.
 *
 * Contract:
 * - No TTS on this screen. Melody rests. Audio playing here defeats the
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
 * NOTE on the melody-sleepy SVG: the spec flags `melody-sleepy.svg` as
 * needed but not yet authored. We use an inline SVG placeholder (sleeping
 * bunny silhouette) per the task brief. Kyle will replace with canonical
 * art later.
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
      {/* Sleepy Melody -- centered, ~40vh */}
      <div className="flex h-[40vh] items-center justify-center">
        <SleepyMelodyPlaceholder />
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

/**
 * Inline SVG placeholder for melody-sleepy.svg.
 *
 * Simple sleeping bunny silhouette in soft pink. This is a temporary
 * placeholder following the same pattern as Math's inline sparkle/flower
 * glyphs. Kyle will replace with the canonical asset.
 */
function SleepyMelodyPlaceholder(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      className="h-full w-auto"
      role="img"
      aria-label="Melody sleeping"
    >
      <title>Melody sleeping</title>
      {/* Body - soft pink oval */}
      <ellipse cx="100" cy="130" rx="55" ry="50" fill="#FFB6C1" />
      {/* Head */}
      <circle cx="100" cy="80" r="40" fill="#FFB6C1" />
      {/* Hood/cap */}
      <ellipse cx="100" cy="68" rx="42" ry="30" fill="#FFFFFF" />
      {/* Left ear */}
      <ellipse
        cx="75"
        cy="35"
        rx="12"
        ry="25"
        fill="#FFB6C1"
        transform="rotate(-15 75 35)"
      />
      {/* Right ear - flopped down (sleeping) */}
      <ellipse
        cx="125"
        cy="40"
        rx="12"
        ry="22"
        fill="#FFB6C1"
        transform="rotate(25 125 40)"
      />
      {/* Closed eyes - curved lines */}
      <path
        d="M 85 82 Q 88 78 92 82"
        fill="none"
        stroke="#3D2B3D"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M 108 82 Q 111 78 115 82"
        fill="none"
        stroke="#3D2B3D"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Small smile */}
      <path
        d="M 95 92 Q 100 96 105 92"
        fill="none"
        stroke="#3D2B3D"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Blush spots */}
      <circle cx="82" cy="90" r="5" fill="#FF9BB3" opacity="0.4" />
      <circle cx="118" cy="90" r="5" fill="#FF9BB3" opacity="0.4" />
      {/* Zzz */}
      <text
        x="140"
        y="55"
        fontSize="16"
        fontFamily="sans-serif"
        fill="#C499CC"
        opacity="0.7"
      >
        z
      </text>
      <text
        x="150"
        y="42"
        fontSize="20"
        fontFamily="sans-serif"
        fill="#C499CC"
        opacity="0.5"
      >
        z
      </text>
      <text
        x="162"
        y="28"
        fontSize="24"
        fontFamily="sans-serif"
        fill="#C499CC"
        opacity="0.3"
      >
        z
      </text>
    </svg>
  )
}
