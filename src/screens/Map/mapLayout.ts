/**
 * Map layout — pixel positions for bands, stops, gates and the trail.
 * Spec: `design/emmas-path/emmas-path-spec.md` §3.1 "Bands and path".
 * Ticket 123jpnbc3dr (Emma's Path 8/10).
 *
 * Pure: (model, path-region size) → positions, so the geometry is unit-
 * testable and the screen only renders. Land 1 is the bottom band; the
 * path climbs bottom → top. Stops run left→right on odd lands and
 * right→left on even lands, so the trail snakes upward. A 40px gate strip
 * sits between every pair of bands.
 */

import type { SkillNode } from '../../lib/progress'
import type { MapModel } from './mapModel'

export const GATE_STRIP = 40
export const STOP_SIZE = 72
export const STOP_TAP = 88

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
}

export interface GateLayout extends Point {
  /** The land this gate leads into (≥ 2). */
  land: number
}

export interface MapLayout {
  bands: BandLayout[]
  stops: StopLayout[]
  gates: GateLayout[]
  /** Land-number pebbles at each band's start side. */
  pebbles: (Point & { land: number })[]
  /** Trail through every stop and gate in path order. */
  trail: Point[]
  /** Leading part of `trail`, up to and including the current stop. */
  walked: Point[]
}

export function layoutMap(
  model: MapModel,
  width: number,
  height: number,
): MapLayout {
  const count = model.lands.length
  const bandH = (height - (count - 1) * GATE_STRIP) / count
  const bands: BandLayout[] = []
  const stops: StopLayout[] = []
  const gates: GateLayout[] = []
  const pebbles: (Point & { land: number })[] = []
  const trail: Point[] = []
  let walkedLen = 0

  model.lands.forEach((land, i) => {
    const top = height - (i + 1) * bandH - i * GATE_STRIP
    bands.push({ land: land.number, top, height: bandH })
    // Stop centre sits a little below the band's middle: Emma (112px)
    // stands on the stop and may overlap upward; buds hang 8px under it.
    const y = top + bandH * 0.56
    const n = land.stops.length
    const leftToRight = land.number % 2 === 1
    const xs = land.stops.map((_, k) => {
      const slot = leftToRight ? k : n - 1 - k
      return (width * (slot + 0.5)) / n
    })

    if (i > 0) {
      const prev = stops[stops.length - 1]!
      const gate: GateLayout = {
        land: land.number,
        x: (prev.x + xs[0]!) / 2,
        y: top + bandH + GATE_STRIP / 2,
      }
      gates.push(gate)
      trail.push(gate)
    }

    pebbles.push({ land: land.number, x: leftToRight ? 18 : width - 18, y })

    land.stops.forEach((stop, k) => {
      const s: StopLayout = { node: stop.node, land: land.number, x: xs[k]!, y }
      stops.push(s)
      trail.push(s)
      if (stop.node === model.current) walkedLen = trail.length
    })
  })

  return {
    bands,
    stops,
    gates,
    pebbles,
    trail,
    walked: trail.slice(0, walkedLen),
  }
}
