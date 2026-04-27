/**
 * Detect prefers-reduced-motion at mount and track live changes.
 *
 * We rely on the global `<MotionConfig reducedMotion="user">` for the
 * actual easing collapse inside Framer Motion, but this hook lets
 * screens turn OFF infinite-loop animations entirely, which Framer
 * Motion's built-in reduced-motion mode on its own doesn't always do
 * for `animate.x: [0, 10, 0]` style keyframe arrays.
 *
 * Previously duplicated in Greet, Math, and WordSong. Extracted here
 * as the single source of truth.
 */

import { useEffect, useState } from 'react'

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (ev: MediaQueryListEvent) => setReduced(ev.matches)
    if (mq.addEventListener) {
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    return undefined
  }, [])

  return reduced
}
