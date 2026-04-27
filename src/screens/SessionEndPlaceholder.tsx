import { m } from 'motion/react'

/**
 * Session-End placeholder screen.
 *
 * The full Session-End screen is specced (`design/screen-5-session-end.md`)
 * but its implementation is blocked on Thomas's CTA destination decision
 * (ClickUp 86c9gugm7 — Option A/B/C). Until that lands, this minimal
 * placeholder renders so Marian SEES the transition after problem 8 of
 * either Math or Word Song instead of being stuck on the resolved-but-
 * frozen problem view Thomas reported in his iPad test pass.
 *
 * Why ship a placeholder instead of waiting for the full screen?
 * - The user-visible bug is the missing transition; that bug is filed and
 *   needs a fix this sprint. Shipping nothing leaves the bug unfixed.
 * - The full Session-End impl is multi-week work (tree-flavored variants,
 *   audio recap, stardust ledger animation). It cannot land alongside
 *   this hot-fix.
 * - The placeholder uses ONLY data the spec already promises will be in
 *   the payload (`totalCorrect`, `totalStardust`, `finalStreak`,
 *   `earnedThisSession`, `surface`) so the full screen will be a drop-in
 *   replacement — no upstream callback shape change.
 *
 * Visual treatment is intentionally restrained: cream background, two
 * lines of copy, a single sparkle glyph echoing the in-game stardust.
 * No CTA, no nav — Marian can leave the app via the home button. This
 * matches Option C ("Come back soon" sleep splash) directionally without
 * presupposing Thomas's final pick.
 */

import type { ReactElement } from 'react'

export type SessionEndSurface = 'math' | 'word-song'

export interface SessionEndPayload {
  totalCorrect: number
  totalStardust: number
  finalStreak: number
  /** Stardust earned in THIS session — for the "you earned X today" line. */
  earnedThisSession: number
  /** Surface tag — disambiguates Math from Word Song handoffs. */
  surface: SessionEndSurface
}

export interface SessionEndPlaceholderProps {
  /**
   * The payload from `onSessionComplete` on the originating screen. Null
   * when the user reaches this route via direct URL or test harness
   * without a session having been played — the placeholder renders a
   * sensible empty-state message in that case (zeros-everywhere copy).
   */
  payload: SessionEndPayload | null
}

export default function SessionEndPlaceholder({
  payload,
}: SessionEndPlaceholderProps): ReactElement {
  // Default-zero shape when reached cold (e.g. ?route=session-end without
  // a preceding session). We DO NOT crash on null — Marian clicking around
  // in QA / direct-launch should still see a coherent screen.
  const earned = payload?.earnedThisSession ?? 0
  const total = payload?.totalStardust ?? 0
  const correct = payload?.totalCorrect ?? 0
  const surface: SessionEndSurface = payload?.surface ?? 'math'

  return (
    <m.main
      data-testid="session-end"
      data-surface={surface}
      data-earned={earned}
      data-total-stardust={total}
      data-total-correct={correct}
      className="
        relative flex h-full w-full flex-col items-center justify-center
        bg-my-cream text-ink
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
        overflow-hidden
      "
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Soft pink wash — same vibe as the originating screens so the
          transition feels continuous, not abrupt. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 35%, rgba(255,210,235,0.55) 0%, rgba(255,245,250,0) 60%), linear-gradient(180deg, #FFF5FA 0%, #FFF8F8 100%)',
        }}
      />

      <m.div
        className="flex flex-col items-center gap-6"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20, delay: 0.1 }}
      >
        <SparkleGlyph />
        <p
          data-testid="session-end-headline"
          className="font-display text-5xl text-my-rose"
        >
          Great job!
        </p>
        <p
          data-testid="session-end-stardust"
          className="font-display text-3xl text-ink"
        >
          {/* "You earned 5 stardust!" — number-led, low-vocab copy per
              the 200-word Melody cap. */}
          You earned {earned} stardust!
        </p>
      </m.div>
    </m.main>
  )
}

/** Inline-SVG sparkle glyph — same shape as Math/Word Song, sized large. */
function SparkleGlyph(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="120"
      height="120"
      role="presentation"
      aria-hidden
    >
      <path
        d="M12 2 L13.6 9.4 L21 11 L13.6 12.6 L12 20 L10.4 12.6 L3 11 L10.4 9.4 Z"
        fill="#FFD966"
        stroke="#E0B800"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}
