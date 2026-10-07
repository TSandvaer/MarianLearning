/**
 * Map layout — pixel positions for the clay map (Redesign R3, ClickUp
 * 123jpnbc690; reference `design/emmas-path/redesign/real-art-check.html`,
 * map tab). Original geometry: Emma's Path 8/10 (123jpnbc3dr).
 *
 * Pure: (model, path-region size) → positions, so the geometry is unit-
 * testable and the screen only renders. Land 1 is the bottom band; the
 * path climbs bottom → top. Land 1 starts on the left and every land
 * starts on the side where the previous one ended, so the path snakes.
 * The climb between two lands goes through a garden-arch gate standing in
 * the gap between their bands, out at that side's edge (clear of the stop
 * column, the current stop's buds and Emma). Each land's pill sits in the
 * top corner of its start side (the far side for a one-stop land).
 *
 * Emma stands just above (behind) the current stop, all of her in view:
 * Thomas (2026-10-07) did not want the stop's art covering her body. Her
 * land's band is taller by the room she needs, so she stays inside it.
 */

import type { SkillNode } from '../../lib/progress'
import type { MapModel } from './mapModel'

/** Gap between two bands; the gate arch stands in it. */
export const BAND_GAP = 40
/** Smallest stop (and tap target), px. */
export const MIN_STOP = 88
/** Largest regular stop, px (the reference's 112). */
export const MAX_STOP = 112
/** The current stop is this much bigger than the others. */
export const CURRENT_SCALE = 1.2
/** Gate tap target (square), px. */
export const GATE_TAP = 88
/** Gate centre's distance from the region's side edge. */
export const GATE_INSET = 64
/** First / last stop centre's distance from the side edge. */
export const STOP_INSET = 190
/** Stop centre, as a fraction of the band height from the band top. */
const STOP_Y = 0.58
/** Band inset from the region's side edges. */
export const BAND_INSET = 16

export type Side = 'left' | 'right'

export interface Point {
  x: number
  y: number
}

export interface BandLayout {
  land: number
  top: number
  height: number
}

export interface StopLayout extends Point {
  node: SkillNode
  land: number
  /** Rendered size (square) — also the tap target. */
  size: number
}

export interface GateLayout extends Point {
  /** The land this gate leads into (≥ 2). */
  land: number
}

export interface PillLayout {
  land: number
  side: Side
  /** Top edge, px. */
  top: number
}

export interface StoneLayout extends Point {
  /** On the stretch already walked (up to the current stop). */
  walked: boolean
}

export interface MapLayout {
  bands: BandLayout[]
  stops: StopLayout[]
  gates: GateLayout[]
  pills: PillLayout[]
  stones: StoneLayout[]
  /** Regular stop size for this region (the current stop is bigger). */
  stopSize: number
}

/** Emma's square box is this much bigger than the stop she stands at. */
export const EMMA_SCALE = 1.25
/** Gap between the bottom of Emma's box and the top of her stop's box. */
const EMMA_FEET_GAP = 2
/** Room kept between the top of Emma's box and her band's top edge. */
const EMMA_HEAD_GAP = 4

/**
 * Emma's square box at a stop: standing just above it, the whole box clear
 * of the stop, so no part of her is behind the stop's art.
 */
export function emmaRect(stop: StopLayout): {
  left: number
  top: number
  size: number
} {
  const size = Math.round(stop.size * EMMA_SCALE)
  return {
    left: stop.x - size / 2,
    top: stop.y - stop.size / 2 - EMMA_FEET_GAP - size,
    size,
  }
}

/** Height Emma needs above the centre of a stop of `size`, to her band's top. */
function emmaRise(size: number): number {
  return (
    size / 2 + EMMA_FEET_GAP + Math.round(size * EMMA_SCALE) + EMMA_HEAD_GAP
  )
}

/**
 * Extra height Emma's band needs on top of `bandH` so that all of her,
 * standing above a stop of `size`, stays inside it.
 */
export function emmaRoom(size: number, bandH: number): number {
  return Math.max(0, emmaRise(size) - bandH * STOP_Y)
}

/**
 * Where Emma's figure is inside her box, across her map poses (alpha
 * bounds of the 1024² idle / attentive-pointing / cheering art): the rest
 * of the square is transparent.
 */
export function emmaFigure(stop: StopLayout): {
  left: number
  top: number
  right: number
  bottom: number
} {
  const e = emmaRect(stop)
  return {
    left: e.left + e.size * 0.18,
    top: e.top + e.size * 0.03,
    right: e.left + e.size * 0.78,
    bottom: e.top + e.size * 0.98,
  }
}

const STONE_STEP = 42

function stonesAlong(
  a: Point,
  b: Point,
  clearA: number,
  clearB: number,
  walked: boolean,
  out: StoneLayout[],
): void {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  const free = len - clearA - clearB
  if (free < STONE_STEP * 0.6) return
  const n = Math.max(1, Math.floor(free / STONE_STEP))
  const gap = free / n
  for (let t = 0; t < n; t++) {
    const d = clearA + gap * (t + 0.5)
    out.push({ x: a.x + (dx * d) / len, y: a.y + (dy * d) / len, walked })
  }
}

export function layoutMap(
  model: MapModel,
  width: number,
  height: number,
): MapLayout {
  const count = model.lands.length
  const widest = Math.max(...model.lands.map((l) => l.stops.length))
  const spacing = widest > 1 ? (width - 2 * STOP_INSET) / (widest - 1) : width
  const curScale = model.complete ? 1 : CURRENT_SCALE
  // Emma's land is `extra` taller; the stop size depends on the band height,
  // and her room on the stop size, so settle the two together.
  let extra = 0
  let bandH = 0
  let stopSize = 0
  for (let pass = 0; pass < 4; pass++) {
    bandH = (height - (count - 1) * BAND_GAP - extra) / count
    stopSize = Math.round(
      Math.max(
        MIN_STOP,
        Math.min(MAX_STOP, bandH * 0.52, spacing / ((1 + CURRENT_SCALE) / 2)),
      ),
    )
    extra = emmaRoom(Math.round(stopSize * curScale), bandH)
  }
  bandH = (height - (count - 1) * BAND_GAP - extra) / count
  const emmaLand = model.lands.findIndex((l) =>
    l.stops.some((s) => s.node === model.current),
  )
  const sizeOf = (node: SkillNode) =>
    node === model.current && !model.complete
      ? Math.round(stopSize * CURRENT_SCALE)
      : stopSize

  const bands: BandLayout[] = []
  const stops: StopLayout[] = []
  const gates: GateLayout[] = []
  const pills: PillLayout[] = []
  const xOf = (side: Side, k: number, n: number) => {
    if (n === 1) return side === 'left' ? STOP_INSET : width - STOP_INSET
    const span = width - 2 * STOP_INSET
    const slot = side === 'left' ? k : n - 1 - k
    return STOP_INSET + (span * slot) / (n - 1)
  }

  let side: Side = 'left'
  let bottom = height
  model.lands.forEach((land, i) => {
    const room = i === emmaLand ? extra : 0
    const bandHeight = bandH + room
    const top = bottom - bandHeight
    bottom = top - BAND_GAP
    bands.push({ land: land.number, top, height: bandHeight })
    if (i > 0) {
      gates.push({
        land: land.number,
        x: side === 'left' ? GATE_INSET : width - GATE_INSET,
        y: top + bandHeight + BAND_GAP / 2,
      })
    }
    const n = land.stops.length
    // A one-stop land leaves by the side it entered: its exit gate stands
    // in that top corner, so its pill goes to the other one.
    const pillSide: Side = n === 1 ? (side === 'left' ? 'right' : 'left') : side
    pills.push({ land: land.number, side: pillSide, top: top + 12 })
    const y = top + room + bandH * STOP_Y
    land.stops.forEach((stop, k) => {
      stops.push({
        node: stop.node,
        land: land.number,
        x: xOf(side, k, n),
        y,
        size: sizeOf(stop.node),
      })
    })
    if (n > 1) side = side === 'left' ? 'right' : 'left'
  })

  // Stepping stones along the path: stop → stop inside a land, last stop
  // → gate → first stop between lands. Walked = before the current stop.
  const ci = stops.findIndex((s) => s.node === model.current)
  const stones: StoneLayout[] = []
  // The sticker is ~84% of the stop box wide.
  const clear = (s: StopLayout) => s.size * 0.42 + 4
  for (let k = 0; k < stops.length - 1; k++) {
    const a = stops[k]!
    const b = stops[k + 1]!
    const walked = model.complete || k < ci
    if (a.land === b.land) {
      stonesAlong(a, b, clear(a), clear(b), walked, stones)
    } else {
      const g = gates.find((gt) => gt.land === b.land)!
      stonesAlong(a, g, clear(a), GATE_TAP / 2, walked, stones)
      stonesAlong(g, b, GATE_TAP / 2, clear(b), walked, stones)
    }
  }

  return { bands, stops, gates, pills, stones, stopSize }
}

/**
 * Landscape (an iPad sideways in Safari: 640-900 px tall). Laid out on the
 * real region, the bands come out so short that the current stop's bud
 * tray runs onto the stop below and Emma's land squeezes the others. In
 * landscape the path is laid out on a taller virtual region instead, with
 * bands of at least LANDSCAPE_BAND (plus Emma's room in hers), then scaled
 * down to fit — everything shrinks together, nothing overlaps.
 */
export const LANDSCAPE_BAND = 136
/** Virtual room below the bottom band for the current stop's bud tray. */
export const LANDSCAPE_TRAY_ROOM = 60

/** Scale (≤ 1) that fits `lands` landscape bands into `height` px. */
export function landscapeScale(lands: number, height: number): number {
  // Bands of LANDSCAPE_BAND hold MIN_STOP stops (0.52 × 136 < 88).
  const room = emmaRoom(Math.round(MIN_STOP * CURRENT_SCALE), LANDSCAPE_BAND)
  const need =
    lands * LANDSCAPE_BAND + (lands - 1) * BAND_GAP + room + LANDSCAPE_TRAY_ROOM
  return height > 0 ? Math.min(1, height / need) : 1
}
