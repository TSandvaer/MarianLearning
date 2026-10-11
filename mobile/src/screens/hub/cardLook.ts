/**
 * The two worlds' clay looks (web `hubClay.css`): the slab (`.hub-card--*
 * > .hub-card-face`, rest and `.is-down`), the crown (mossy for Number
 * Garden, cloudy for Word Song) and the clay title colours. Lengths are
 * reference px × s.
 */
import type { SkillTreeId } from '@marian/core/sessionEnd/sessionHistory'

export const TITLES: Record<SkillTreeId, readonly [string, string]> = {
  'number-garden': ['Number', 'Garden'],
  'word-song': ['Word', 'Song'],
}

interface Slab {
  face: string
  /** Solid fallback under the gradient. */
  flat: string
  rest: (s: number) => string
  pressed: (s: number) => string
}

export const SLAB: Record<SkillTreeId, Slab> = {
  'number-garden': {
    face: 'linear-gradient(170deg, #d39a63 0%, #b97c47 55%, #a96d3c 100%)',
    flat: '#b97c47',
    rest: (s) =>
      `inset 0 ${6 * s}px 0 rgba(255, 255, 255, 0.25), inset 0 ${-10 * s}px 0 rgba(0, 0, 0, 0.12), 0 ${14 * s}px 0 #82532b, 0 ${26 * s}px ${34 * s}px rgba(60, 30, 10, 0.3)`,
    pressed: (s) =>
      `inset 0 ${6 * s}px 0 rgba(255, 255, 255, 0.25), 0 ${6 * s}px 0 #82532b, 0 ${12 * s}px ${18 * s}px rgba(60, 30, 10, 0.3)`,
  },
  'word-song': {
    face: 'linear-gradient(170deg, #ffd3e2 0%, #f9b7cd 55%, #f3a2bf 100%)',
    flat: '#f9b7cd',
    rest: (s) =>
      `inset 0 ${6 * s}px 0 rgba(255, 255, 255, 0.45), inset 0 ${-10 * s}px 0 rgba(0, 0, 0, 0.08), 0 ${14 * s}px 0 #d27b9c, 0 ${26 * s}px ${34 * s}px rgba(120, 40, 70, 0.25)`,
    pressed: (s) =>
      `inset 0 ${6 * s}px 0 rgba(255, 255, 255, 0.45), 0 ${6 * s}px 0 #d27b9c, 0 ${12 * s}px ${18 * s}px rgba(120, 40, 70, 0.25)`,
  },
}

/** Title colours: face, second line, light rim, dark extrusion, soft drop. */
export const TITLE: Record<
  SkillTreeId,
  { face: string; second: string; rim: string; dark: string; drop: string }
> = {
  'number-garden': {
    face: '#ffd54a',
    second: '#9ee070',
    rim: '#fff3b0',
    dark: '#8a5a1f',
    drop: 'rgba(0, 0, 0, 0.25)',
  },
  'word-song': {
    face: '#ff79a8',
    second: '#ffcf3d',
    rim: '#ffd0e2',
    dark: '#8f3c5f',
    drop: 'rgba(0, 0, 0, 0.2)',
  },
}

/** Crown bumps: radius x, radius y, centre x, centre y, colour. */
const BUMPS: Record<
  SkillTreeId,
  readonly [number, number, number, number, string][]
> = {
  'number-garden': [
    [40, 34, 40, 50, '#7cc95a'],
    [46, 38, 110, 30, '#86d063'],
    [48, 40, 200, 26, '#7cc95a'],
    [46, 38, 290, 32, '#86d063'],
    [40, 34, 355, 56, '#7cc95a'],
  ],
  'word-song': [
    [44, 36, 50, 46, '#ffffff'],
    [52, 42, 130, 26, '#ffffff'],
    [50, 40, 230, 24, '#fff6fb'],
    [44, 36, 320, 44, '#ffffff'],
  ],
}

const CROWN_BASE: Record<SkillTreeId, string> = {
  'number-garden': 'linear-gradient(#7cc95a, #6bb84d)',
  'word-song': 'linear-gradient(#ffffff, #ffeef6)',
}

export function crownBackground(tree: SkillTreeId, s: number): string {
  const bumps = BUMPS[tree].map(
    ([rx, ry, x, y, color]) =>
      // Web `<colour> 98%, #0000`: fade to the same colour, transparent.
      `radial-gradient(${rx * s}px ${ry * s}px at ${x * s}px ${y * s}px, ${color} 98%, ${color}00 100%)`,
  )
  return [...bumps, CROWN_BASE[tree]].join(', ')
}

export function crownShadow(tree: SkillTreeId, s: number): string {
  return tree === 'number-garden'
    ? `inset 0 ${5 * s}px 0 rgba(255, 255, 255, 0.3), inset 0 ${-8 * s}px 0 rgba(0, 0, 0, 0.12), 0 ${6 * s}px 0 #4f9437`
    : `inset 0 ${-8 * s}px 0 rgba(240, 170, 200, 0.35), 0 ${6 * s}px 0 #f0b6cd`
}
