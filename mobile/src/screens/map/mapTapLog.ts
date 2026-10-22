/**
 * Debug-only Map tap log (map-tap-to-play device check, 2026-10-17): with
 * `EXPO_PUBLIC_DEBUG=1`, every stop tap logs one Metro line saying which
 * stop took the touch, its state, the path the tap took and where it
 * landed, and every stop logs its hit rect once on mount. Ground truth for
 * "which stop did the finger actually hit" on a device, where the map's
 * hit areas (hitSlop, the current stop's tray slop) can't be seen.
 *
 * Off (no `log`) in release builds and tests by default: App passes
 * `console.log` only when the launch flags say debug.
 */
import type { StopState } from '@marian/core/map/mapModel'

/** One Metro line. */
export type MapDebugLog = (line: string) => void

/** A stop's hit area in path-layer pt (its box grown by its hitSlop). */
export interface HitRect {
  x: number
  y: number
  width: number
  height: number
}

/** Where a tap landed: screen (page) and stop-local pt, and the stop's rect. */
export interface MapTapPoint {
  pageX: number
  pageY: number
  locationX: number
  locationY: number
  rect: HitRect
}

/**
 * The path a stop tap took: a mastered stop's replay, the current stop's
 * Hub-card session, a later stop's peek prompt (`peek-ask`; its button
 * logs `peek`, locked-stop-peek-prompt § 7), the stop's name only, or nothing
 * (`ignored(<why>)`: the 400 ms guard, the launch lock, the unlock beat, a
 * peek request out).
 */
export type MapTapPath =
  | 'replay'
  | 'hub-session'
  | 'peek-ask'
  | 'peek'
  | 'name-only'
  | 'ignored(arming)'
  | 'ignored(launch-lock)'
  | 'ignored(beat)'
  | 'ignored(peek-out)'

const n = (v: number) => String(Math.round(v))

/** `x,y,w×h` of a rect, rounded to whole pt. */
export function formatRect(r: HitRect): string {
  return `${n(r.x)},${n(r.y)},${n(r.width)}x${n(r.height)}`
}

/** `[map-tap] stop=… state=… path=… x,y=… local=… rect=…` */
export function formatMapTap(
  node: string,
  state: StopState,
  path: MapTapPath,
  tap: MapTapPoint | undefined,
): string {
  const at =
    tap === undefined
      ? 'x,y=? local=? rect=?'
      : `x,y=${n(tap.pageX)},${n(tap.pageY)} local=${n(tap.locationX)},${n(tap.locationY)} rect=${formatRect(tap.rect)}`
  return `[map-tap] stop=${node} state=${state} path=${path} ${at}`
}

/** `[map-stop] stop=… state=… rect=…` (once per stop, on mount). */
export function formatMapStop(
  node: string,
  state: StopState,
  rect: HitRect,
): string {
  return `[map-stop] stop=${node} state=${state} rect=${formatRect(rect)}`
}
