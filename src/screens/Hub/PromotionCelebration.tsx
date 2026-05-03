/**
 * PromotionCelebration — Hub overlay shown when Marian crosses into a new
 * skill node (ticket 86c9kwnkw, M3 audit follow-up).
 *
 * V1 placeholder per the dispatch contract: "single celebratory pose +
 * sparkle particle burst + Emma audio greeting tailored to the promotion
 * (...) For v1, use a placeholder if Kyle's spec hasn't landed by the time
 * you need it." Kyle's detailed celebration spec ships in a parallel
 * ticket — this component is the seam he can iterate against.
 *
 * Trigger contract
 * ----------------
 * Hub.tsx checks `progress.pendingPromotion` on every mount. When the
 * field is set (M3 mastery rule queued a promotion that the parent has not
 * yet confirmed via Parent Settings), Hub mounts this overlay instead of
 * the normal greeting. Once the celebration dismisses (auto-fade after
 * ~3.5s), Hub returns to its default render — the field stays set in
 * storage until the parent flips `autoPromote` back to `true` (re-entry
 * applies the queued promotion) OR the session-end re-runs the rule with
 * fresh history.
 *
 * V1 deliberate simplifications
 * -----------------------------
 *  - Audio: generic placeholder caption "You unlocked a new skill!" with
 *    the node label appended. Kyle's spec calls for per-node tailored
 *    audio ("You unlocked add-to-20!"); v1 ships node-name interpolation
 *    in the caption only — the audio binary work happens in a follow-up.
 *  - Sparkle burst: 8 inline-SVG sparkles arranged in a radial pattern
 *    with staggered scale/opacity in. No third-party particle lib (iPad
 *    bundle budget). Kyle's spec may replace this with a richer
 *    choreography.
 *  - Auto-dismiss: 3.5s, no manual dismiss control. Hub continues to
 *    function (skill-tree picker still tappable beneath the overlay).
 *
 * The contract Kyle iterates against is the prop shape — `node`, `label`,
 * `onDismiss`. Internal animation is replaceable without rewriting Hub.
 */

import { useEffect, type ReactElement } from 'react'
import { m } from 'motion/react'
import type { SkillNode } from '../../lib/progress'
import { EmmaCharacter } from '../../components/EmmaCharacter'

export interface PromotionCelebrationProps {
  /** The skill node that was just promoted. Drives the caption text. */
  node: SkillNode
  /** Display label for the node (human-readable). */
  label: string
  /**
   * Fires after the auto-dismiss timer elapses. Hub uses this to swap
   * back to its normal render — the overlay is one-shot per Hub mount.
   */
  onDismiss?: () => void
  /**
   * Auto-dismiss duration in ms. Defaults to 3500. Tests inject a smaller
   * value to keep timing tight.
   */
  durationMs?: number
}

const DEFAULT_DURATION_MS = 3500

/**
 * 8 sparkles arranged radially around Emma. Pure presentation — the
 * sparkles' positions are precomputed so we don't recompute on each
 * render. Coordinates are percentages of the overlay box; the burst
 * centres on Emma's chest (~50% / 35%).
 */
const SPARKLE_POSITIONS: ReadonlyArray<{
  x: string
  y: string
  delay: number
  size: number
}> = [
  { x: '50%', y: '12%', delay: 0.05, size: 28 },
  { x: '74%', y: '20%', delay: 0.1, size: 22 },
  { x: '82%', y: '40%', delay: 0.15, size: 26 },
  { x: '76%', y: '60%', delay: 0.2, size: 20 },
  { x: '50%', y: '66%', delay: 0.25, size: 30 },
  { x: '24%', y: '60%', delay: 0.2, size: 22 },
  { x: '18%', y: '40%', delay: 0.15, size: 26 },
  { x: '26%', y: '20%', delay: 0.1, size: 24 },
]

export default function PromotionCelebration({
  node,
  label,
  onDismiss,
  durationMs = DEFAULT_DURATION_MS,
}: PromotionCelebrationProps): ReactElement {
  // Auto-dismiss timer. Held simple — one timer per mount, cleared on
  // unmount. No visibility-aware pause (Hub's parent owns route flips).
  useEffect(() => {
    if (!onDismiss) return
    const id = window.setTimeout(() => {
      onDismiss()
    }, durationMs)
    return () => {
      window.clearTimeout(id)
    }
  }, [onDismiss, durationMs])

  return (
    <m.div
      data-testid="hub-promotion-celebration"
      data-node={node}
      role="status"
      aria-live="polite"
      className="
        pointer-events-none
        absolute inset-0 z-10
        flex flex-col items-center justify-start
        px-6 pt-[12vh]
      "
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Emma in celebration pose. Pinned to the same band as Hub's idle
          Emma (22vh), so the swap reads as "she lit up" not "a new
          screen" — same shared layoutId carries the bounding box. */}
      <div className="relative flex h-[28vh] w-full items-center justify-center">
        <EmmaCharacter
          pose="celebration"
          layoutId="emma"
          data-testid="hub-promotion-emma"
          className="h-full w-auto select-none"
        />

        {/* Sparkle burst — radial 8-point arrangement around Emma. Each
            sparkle scales-in with a staggered delay so the burst reads
            as energy radiating outward. No third-party particle lib —
            iPad bundle budget. */}
        {SPARKLE_POSITIONS.map((s, i) => (
          <m.span
            key={`sparkle-${i}`}
            data-testid="hub-promotion-sparkle"
            aria-hidden
            className="pointer-events-none absolute"
            style={{ left: s.x, top: s.y, transform: 'translate(-50%, -50%)' }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.2, 1, 1.1] }}
            transition={{
              duration: 1.6,
              delay: s.delay,
              ease: 'easeOut',
              times: [0, 0.25, 0.7, 1],
            }}
          >
            <svg
              width={s.size}
              height={s.size}
              viewBox="0 0 24 24"
              fill="#FFD966"
              stroke="#E0B800"
              strokeWidth="0.6"
            >
              <path d="M12 2 L13.6 9.4 L21 11 L13.6 12.6 L12 20 L10.4 12.6 L3 11 L10.4 9.4 Z" />
            </svg>
          </m.span>
        ))}
      </div>

      {/* Caption — node-tailored placeholder. Bordered ribbon matches
          Hub's existing welcome-back caption surface. */}
      <m.div
        data-testid="hub-promotion-caption"
        className="
          mt-2 rounded-3xl border-[3px] border-my-rose bg-white
          px-6 py-3
          shadow-[0_8px_24px_rgba(244,143,177,0.25)]
          text-center
        "
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2, ease: 'easeOut' }}
      >
        <p className="font-display text-[1.6rem] leading-snug text-ink">
          You unlocked{' '}
          <span data-testid="hub-promotion-node-label" className="text-my-rose">
            {label}
          </span>
          !
        </p>
      </m.div>
    </m.div>
  )
}
