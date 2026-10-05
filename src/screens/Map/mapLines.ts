/**
 * Map line picker — which Emma's Path line a map event speaks.
 * Spec: `design/emmas-path/emmas-path-spec.md` §4.1 (open / stop / gate)
 * and §4.2 (locked-stop requirement as a task). Ticket 123jpnbc3dr.
 *
 * Pure: model + event in, `PathLine` out. Lines come from the catalogue
 * in `src/lib/emmasPath/pathLines.ts`; a line whose `src` is `null`
 * (the deferred `locked-later` / `gate-locked` kinds, Thomas 2026-10-05)
 * is still returned — the player shows its caption and plays nothing.
 */

import { pathLine, type PathLine } from '../../lib/emmasPath/pathLines'
import { PREREQUISITES } from '../../lib/progress/prerequisites'
import type { SkillNode } from '../../lib/progress'
import type { MapLand, MapModel, MapStop } from './mapModel'

/** Look a catalogued line up; the ids built here all exist (mapLines.test). */
function line(id: string, fallbackId?: string): PathLine {
  const found = pathLine(id) ?? (fallbackId ? pathLine(fallbackId) : undefined)
  if (found === undefined) throw new Error(`No Emma's Path line '${id}'`)
  return found
}

/** Map opens: "Here is your path! You are on {name}." / path complete. */
export function openLine(model: MapModel): PathLine {
  return model.complete
    ? line(`path.open.done.${model.world}`)
    : line(`path.open.${model.current}`)
}

/**
 * Tap a stop. Open / mastered / current → its name. Locked → the
 * requirement: `next` when its single predecessor is the current step,
 * otherwise `later`, naming the step Marian can do now (spec §4.2).
 */
export function stopLine(model: MapModel, stop: MapStop): PathLine {
  if (stop.state !== 'locked') return line(`path.stop.${stop.node}`)
  const prereq: SkillNode | undefined = PREREQUISITES[stop.node][0]
  if (prereq === model.current) return line(`path.locked.next.${stop.node}`)
  // An out-of-order seed can leave no `later` line for this pair (the
  // current step after the stop); the stop's name is the safe fallback.
  return line(
    `path.locked.later.${stop.node}.${model.current}`,
    `path.stop.${stop.node}`,
  )
}

/** Tap a gate: open → "Land {n}: {land name}."; closed → requirement. */
export function gateLine(model: MapModel, land: MapLand): PathLine {
  const landId = `path.land.${model.world}.${land.number}`
  if (land.open) return line(landId)
  return line(
    `path.gate.locked.${model.world}.${land.number}.${model.current}`,
    landId,
  )
}
