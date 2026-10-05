/**
 * Practice bud — one per good day under a stop (spec §3.4): an open pink
 * flower once banked, a small closed green bud before. Shared by the map
 * and the session-end bud beat (Emma's Path 9/10).
 */

import type { ReactElement } from 'react'

const ROSE = '#F48FB1'

export function Bud({
  open,
  size,
  testId = 'map-bud',
}: {
  open: boolean
  size: number
  testId?: string
}): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden
      data-testid={testId}
      data-open={open ? 'true' : 'false'}
    >
      {open ? (
        <g>
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse
              key={deg}
              cx="8"
              cy="4.6"
              rx="2.6"
              ry="3.4"
              fill={ROSE}
              transform={`rotate(${deg} 8 8)`}
            />
          ))}
          <circle cx="8" cy="8" r="2.2" fill="#FFEB3B" />
        </g>
      ) : (
        <g>
          <path d="M8 15 V9" stroke="#81C784" strokeWidth="1.4" />
          <ellipse cx="8" cy="7" rx="3" ry="4" fill="#A5D6A7" />
        </g>
      )}
    </svg>
  )
}
