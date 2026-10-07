/**
 * Emma's "you are here" badge on the map: a round clay badge with her head
 * and shoulders, and a tail pointing down at the current stop.
 *
 * Thomas (2026-10-07) chose it over the standing figure: the idle art is
 * cropped mid-thigh ("she has no legs so this doesnt work"), and the
 * stop's pot hid her when she stood behind it. The face is cropped from
 * the existing pose art (no new files): the 1024² art's crop square is
 * scaled into the badge's window.
 *
 * Poses map onto the badge:
 *   - idle               → idle face
 *   - cheering           → cheering face (open-mouth smile, arms up) and a
 *                          brief scale pop
 *   - attentive-pointing → idle face, the badge does a curious head-tilt
 *                          (the pointing art wears another cardigan, so a
 *                          face swap would read as a different person at
 *                          this size)
 * The unlock hop is two small arcs, as before. Reduced motion: no hop, no
 * pop, no tilt; the face swap is a plain cross-fade.
 */

import { AnimatePresence, m } from 'motion/react'
import type { ReactElement } from 'react'
import type { EmmaPose } from '../../lib/character/emmaPose'

type Face = 'idle' | 'cheering'

/** Crop square in the 1024² pose art: left, top, side (px). */
const CROP: Record<Face, readonly [number, number, number]> = {
  idle: [312, 14, 400],
  cheering: [330, 80, 400],
}

const ART = 1024

function faceOf(pose: EmmaPose): Face {
  return pose === 'cheering' ? 'cheering' : 'idle'
}

export function EmmaBadge({
  size,
  height,
  pose,
  hopping,
  reduceMotion,
}: {
  /** Circle diameter, px. */
  size: number
  /** Circle + tail, px. */
  height: number
  pose: EmmaPose
  hopping: boolean
  reduceMotion: boolean
}): ReactElement {
  const face = faceOf(pose)
  const [cx, cy, cs] = CROP[face]
  const rim = Math.max(5, Math.round(size * 0.075))
  const tail = height - size
  const tailW = Math.round(size * 0.42)
  const motion = !reduceMotion
  return (
    <m.div
      data-testid="map-emma-bob"
      className="absolute inset-0"
      // Pivots at the tail's tip, on the stop.
      style={{ transformOrigin: '50% 100%' }}
      animate={{
        y: hopping && motion ? [0, -28, 0, -18, 0] : 0,
        scale: pose === 'cheering' && motion ? [1, 1.18, 0.95, 1.05, 1] : 1,
        rotate: pose === 'attentive-pointing' && motion ? -9 : 0,
      }}
      transition={{
        y: { duration: 0.7, ease: 'easeInOut' },
        scale: { duration: 0.6, ease: 'easeOut' },
        rotate: { type: 'spring', stiffness: 300, damping: 16 },
      }}
    >
      {/* Tail: a clay pointer from the badge down to the stop. */}
      <svg
        aria-hidden
        data-testid="map-emma-tail"
        className="absolute"
        width={tailW}
        height={tail + rim * 2}
        viewBox="0 0 42 40"
        preserveAspectRatio="none"
        style={{
          left: (size - tailW) / 2,
          bottom: 0,
          overflow: 'visible',
          filter: 'drop-shadow(0 3px 2px rgba(60,30,10,0.3))',
        }}
      >
        <path
          d="M0 0 H42 L24.5 37.5 Q21 41 17.5 37.5 Z"
          fill="#a86c3c"
          stroke="#7d4a26"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Rim: chunky warm-brown clay ring with soft depth. */}
      <span
        data-testid="map-emma-badge"
        className="absolute left-0 top-0 rounded-full"
        style={{
          width: size,
          height: size,
          background:
            'radial-gradient(circle at 38% 30%, #e7b07a 0, #c98a55 55%, #a86c3c 100%)',
          boxShadow:
            'inset 0 4px 0 rgba(255,255,255,0.3), 0 6px 0 #7d4a26, 0 12px 16px rgba(60,30,10,0.3)',
        }}
      >
        {/* Window: soft cream fill, her head and shoulders. */}
        <span
          className="absolute overflow-hidden rounded-full"
          style={{
            inset: rim,
            background:
              'radial-gradient(circle at 45% 35%, #fffdf8 0, #fff1dc 60%, #f6dfbd 100%)',
            boxShadow: 'inset 0 3px 6px rgba(90,50,20,0.3)',
          }}
        >
          <AnimatePresence initial={false}>
            <m.img
              key={face}
              data-testid="map-emma-face"
              data-face={face}
              src={`/assets/emma-${face}.svg`}
              alt="Emma"
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                width: `${(ART / cs) * 100}%`,
                left: `${(-cx / cs) * 100}%`,
                top: `${(-cy / cs) * 100}%`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          </AnimatePresence>
          {/* Clay gloss over the window, top-left light. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(ellipse at 30% 18%, rgba(255,255,255,0.35) 0, rgba(255,255,255,0) 45%)',
            }}
          />
        </span>
      </span>
    </m.div>
  )
}
