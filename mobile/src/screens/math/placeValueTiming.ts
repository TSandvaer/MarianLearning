/**
 * The place-value stage's shared timings (`PlaceValueStage.tsx`), kept out
 * of the component file so Math and the tests can read them: the build's
 * stagger and landing, zeros' hint-1 build (content wave 5 § 2.4, D3), and
 * adding big numbers' drop and bundle (§ 3.5).
 */
import {
  PLACE_PARTS,
  placeDigits,
  type PlacePart,
} from '@marian/core/math/extendedProblems'

/** A tray's blocks enter this far apart (content wave 3 § 3.5). */
export const BUILD_STAGGER_MS = 90
/** The tray fades in at once with Reduce Motion. */
export const TRAY_FADE_MS = 150
/** About when a dropped block has landed (the spring settles later). */
export const LAND_MS = 300
/** A fast drop's landing (a right tap's stiffer spring, 300 / 22). */
export const LAND_FAST_MS = 150
/** A drop-in's Reduce Motion crossfade, and a lift-out's fade (wave 4). */
export const CHANGE_REDUCED_MS = 200

/** The bundle's phases (content wave 5 § 3.5): waiting for its cue, the
 *  four beats, its Reduce Motion fade, its end state. */
export type BundlePhase =
  | 'idle'
  | 'gather'
  | 'fuse'
  | 'carry'
  | 'settle'
  | 'fade'
  | 'done'

/** The bundle's beats (§ 3.5): about 1.1 s in all. */
export const BUNDLE_MS = { gather: 300, fuse: 150, carry: 450, settle: 200 }
/** A fast right tap's bundle: all four beats in 250 ms. */
export const BUNDLE_FAST_MS = 250
export const BUNDLE_FAST_STEPS = {
  gather: 70,
  fuse: 35,
  carry: 100,
  settle: 45,
}
/** Reduce Motion's bundle: one 200 ms fade. */
export const BUNDLE_REDUCED_MS = 200

/**
 * How long zeros' hint-1 build of a name read takes to land (content wave
 * 5 § 2.4, D3): its blocks drop in place order, `BUILD_STAGGER_MS` apart,
 * and the last lands `LAND_MS` later; with Reduce Motion the trays fade in
 * (`TRAY_FADE_MS`). Math waits this long before "Look at the ones." plays,
 * and the empty tray ripples then. 0 for any other problem.
 */
export function placeValueHintBuildMs(
  problem: { kind: string } & Partial<Record<PlacePart, number>> & {
      form?: string
    },
  reducedMotion: boolean,
): number {
  if (problem.kind !== 'place-value' || problem.form !== 'name') return 0
  if (reducedMotion) return TRAY_FADE_MS
  const blocks = PLACE_PARTS.reduce((n, p) => n + (problem[p] ?? 0), 0)
  return Math.max(0, blocks - 1) * BUILD_STAGGER_MS + LAND_MS
}

/** How long adding big numbers' second-number drop takes to land: its
 *  blocks `BUILD_STAGGER_MS` apart, the last landing `LAND_MS` later (a
 *  fast tap's stiffer spring sooner; Reduce Motion's 200 ms crossfade). */
export function sumDropMs(
  problem: { addendB: number },
  mode: 'normal' | 'fast' | 'reduced' = 'normal',
): number {
  const b = placeDigits(problem.addendB)
  const n = b.tens + b.ones
  const land =
    mode === 'fast'
      ? LAND_FAST_MS
      : mode === 'reduced'
        ? CHANGE_REDUCED_MS
        : LAND_MS
  return Math.max(0, n - 1) * BUILD_STAGGER_MS + land
}
