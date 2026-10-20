/**
 * The map button's two clay looks (web `.hub-mapbtn`, per world): face
 * gradient, flat fallback and shadow at scale s. Shared with the Play
 * place's tiles (play-place § 1.3).
 */
import type { MasteryTrack } from '@marian/core/progress'

export const MAP_BUTTON_LOOK: Record<
  MasteryTrack,
  { face: string; flat: string; shadow: (s: number) => string }
> = {
  math: {
    face: 'radial-gradient(circle at 40% 32%, #e7b07a 0%, #c98a55 55%, #a86c3c 100%)',
    flat: '#c98a55',
    shadow: (s) =>
      `inset 0 ${5 * s}px 0 rgba(255, 255, 255, 0.3), inset 0 ${-6 * s}px 0 rgba(0, 0, 0, 0.18), 0 ${9 * s}px 0 #7d4a26, 0 ${14 * s}px ${18 * s}px rgba(60, 30, 10, 0.3)`,
  },
  'word-song': {
    face: 'radial-gradient(circle at 40% 32%, #ffe0a8 0%, #f2c27a 55%, #d9a159 100%)',
    flat: '#f2c27a',
    shadow: (s) =>
      `inset 0 ${5 * s}px 0 rgba(255, 255, 255, 0.4), inset 0 ${-6 * s}px 0 rgba(0, 0, 0, 0.12), 0 ${9 * s}px 0 #b27b37, 0 ${14 * s}px ${18 * s}px rgba(120, 60, 20, 0.25)`,
  },
}
