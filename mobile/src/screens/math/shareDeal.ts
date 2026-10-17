/**
 * Sharing's deal, as data (`design/native/content-wave-2.md` § 2.4, § 2.5).
 * `ShareStage` keeps one {@link Flight} (or `null`: still in the pile) per
 * flower and asks these pure functions what each command does to them; the
 * flights then run on the UI thread (`withDelay`), with no JS timers.
 *
 * The deal rule: flower k (k = 0 … T−1) leaves the LAST occupied pile cell
 * (T−1−k) and lands on plate `k mod B`, in that plate's next free cell
 * (`floor(k / B)`). Each round puts one flower on every plate, left to
 * right, and the pile shrinks from its end. Flowers are always dealt in k
 * order, so the scheduled ones are a prefix of the plan.
 *
 * Times are ms on one monotonic clock (`performance.now()` in the app; the
 * tests pass their own `now`).
 */

/** P1–P3 deal on their own this long after the read ends (§ 2.4). */
export const AUTO_DEAL_DELAY_MS = 300
/** Normal deal: launch k at `k × 120 + floor(k / B) × 100` (a breath
 *  between rounds), each flight 320 ms. */
export const DEAL_STEP_MS = 120
export const DEAL_BREATH_MS = 100
export const DEAL_FLIGHT_MS = 320
/** Hint 2's round: one flower per plate, 300 ms apart. */
export const ROUND_STEP_MS = 300
/** Fast deal (a right tap with flowers left): every `min(40, 600 / left)`
 *  ms, 220 ms flights, no breath, so 20 left end at 19 × 30 + 220 = 790 ms
 *  (Kyle's call 4 on #587; the spec's first cut was `min(50, 900 / left)`). */
export const FAST_STEP_MAX_MS = 40
export const FAST_SPAN_MS = 600
export const FAST_FLIGHT_MS = 220
/** The given answer: every flower left moves at once, 200 ms, no arc. */
export const INSTANT_MS = 200
/** Reduce Motion: a pile flower fades out as its cell fades in. */
export const FADE_DEAL_MS = 120
/** Reduce Motion, fast deal and given answer: one crossfade for all. */
export const CROSSFADE_MS = 200
/** Hint 1: the flowers ripple in deal order. */
export const FLOWER_RIPPLE_STAGGER_MS = 60
/** The tags fill plate by plate, this far apart. */
export const TAG_FILL_STAGGER_MS = 80
/** A tag's "?" fades out this long before its numeral springs in. */
export const TAG_QUESTION_FADE_MS = 100
/** The numeral's spring (stiffness 260, damping 20) has settled by then. */
export const TAG_SPRING_SETTLE_MS = 300
/** The completed picture (every tag showing the share) holds this long
 *  before Math moves on (call 4). */
export const FILL_HOLD_MS = 400
/** Landing: 1 → 1.12 over 80 ms, then a spring back to 1. */
export const LAND_PEAK = 1.12
export const LAND_UP_MS = 80
export const LAND_SPRING = { stiffness: 300, damping: 14, mass: 1 }

/** Where flower k comes from and goes to. */
export interface DealTarget {
  /** Its pile cell (reading order): the last occupied one. */
  pileCell: number
  /** Its plate, 0-based, left to right. */
  plate: number
  /** Its cell on that plate (columns of 5, top to bottom). */
  plateCell: number
}

/** Flower k of a deal of `total` onto `plates` plates (§ 2.5). */
export function dealOrder(total: number, plates: number): DealTarget[] {
  return Array.from({ length: total }, (_, k) => ({
    pileCell: total - 1 - k,
    plate: k % plates,
    plateCell: Math.floor(k / plates),
  }))
}

/** A normal deal's launch of flower k, from the deal's start. */
export function normalLaunchMs(k: number, plates: number): number {
  return k * DEAL_STEP_MS + Math.floor(k / plates) * DEAL_BREATH_MS
}

/** One flower's move: it launches at `start` and lands `duration` later. */
export interface Flight {
  start: number
  duration: number
  /**
   * `deal`: an arc, `Easing.out(cubic)`, the landing bounce. `instant`:
   * straight, ease-out, no bounce. `fade`: Reduce Motion, no travel and no
   * scale (the pile copy fades out as the cell copy fades in).
   */
  motion: 'deal' | 'instant' | 'fade'
}

/** Every flower's flight, `null` while it is still in the pile. */
export type FlightPlan = readonly (Flight | null)[]

export function emptyPlan(total: number): FlightPlan {
  return Array.from({ length: total }, () => null)
}

/** It has left the pile (or is due to now). */
export function launched(f: Flight | null, now: number): f is Flight {
  return f !== null && f.start <= now
}

/** Flowers not scheduled yet. */
export function undealt(plan: FlightPlan): number {
  return plan.filter((f) => f === null).length
}

/** The commands that deal (§ 2.4): P1–P3's own deal and hint 3 (`normal`),
 *  hint 2 (`round`), a right tap (`fast`), the given answer (`instant`). */
export type DealMode = 'normal' | 'round' | 'fast' | 'instant'

/**
 * The plan after `mode` at `now`:
 *
 * - `normal`: every flower still in the pile, on the normal schedule from
 *   the first of them, after the flowers already scheduled (a deal in
 *   flight keeps its rounds and its breath).
 * - `round`: only when nothing is dealt yet; flowers 0 … B−1, 300 ms apart.
 * - `fast`: every flower that has not launched (scheduled or not),
 *   `min(50, 900 / left)` ms apart, 220 ms flights.
 * - `instant`: every flower that has not launched, all at once, 200 ms.
 *
 * Reduce Motion: `normal` and `round` keep their schedule as 120 ms fades;
 * `fast` and `instant` become one 200 ms crossfade.
 */
export function deal(
  plan: FlightPlan,
  mode: DealMode,
  now: number,
  plates: number,
  reducedMotion: boolean,
): FlightPlan {
  const next = [...plan]
  const motion = (normal: 'deal' | 'instant'): Flight['motion'] =>
    reducedMotion ? 'fade' : normal
  switch (mode) {
    case 'normal': {
      const k0 = next.findIndex((f) => f === null)
      if (k0 < 0) return plan
      const prev = k0 > 0 ? next[k0 - 1] : null
      const base =
        prev != null && prev.start > now
          ? prev.start +
            normalLaunchMs(k0, plates) -
            normalLaunchMs(k0 - 1, plates)
          : now
      for (let k = k0; k < next.length; k++) {
        next[k] = {
          start: base + normalLaunchMs(k, plates) - normalLaunchMs(k0, plates),
          duration: reducedMotion ? FADE_DEAL_MS : DEAL_FLIGHT_MS,
          motion: motion('deal'),
        }
      }
      return next
    }
    case 'round': {
      if (next.some((f) => f !== null)) return plan
      for (let k = 0; k < Math.min(plates, next.length); k++) {
        next[k] = {
          start: now + k * ROUND_STEP_MS,
          duration: reducedMotion ? FADE_DEAL_MS : DEAL_FLIGHT_MS,
          motion: motion('deal'),
        }
      }
      return next
    }
    case 'fast':
    case 'instant': {
      const left = next
        .map((f, k) => (launched(f, now) ? -1 : k))
        .filter((k) => k >= 0)
      if (left.length === 0) return plan
      const step =
        mode === 'fast' && !reducedMotion
          ? Math.min(FAST_STEP_MAX_MS, FAST_SPAN_MS / left.length)
          : 0
      left.forEach((k, j) => {
        next[k] = reducedMotion
          ? { start: now, duration: CROSSFADE_MS, motion: 'fade' }
          : mode === 'fast'
            ? {
                start: now + j * step,
                duration: FAST_FLIGHT_MS,
                motion: 'deal',
              }
            : { start: now, duration: INSTANT_MS, motion: 'instant' }
      })
      return next
    }
  }
}

/** How long until the last scheduled flower lands (0 when all have). */
export function msUntilLanded(plan: FlightPlan, now: number): number {
  let end = now
  for (const f of plan)
    if (f !== null) end = Math.max(end, f.start + f.duration)
  return end - now
}

/**
 * When the last plate tag has filled, in ms from the right answer (Kyle's
 * call 4 on #587): the deal's end (`msUntilLanded` after the fast deal; 0
 * when every flower has landed), then the last tag's "?" fade, its 80 ms
 * stagger per plate and the numeral's spring settle:
 * `dealEnd + 100 + 80 × (B − 1) + 300`. Reduce Motion: the tags crossfade,
 * `dealEnd + 80 × (B − 1) + 200`. A pure function of the schedule, never a
 * spring callback. Math holds the advance until this + {@link FILL_HOLD_MS}.
 */
export function shareFillEndMs(
  dealEndMs: number,
  plates: number,
  reducedMotion: boolean,
): number {
  const stagger = TAG_FILL_STAGGER_MS * Math.max(0, plates - 1)
  return reducedMotion
    ? dealEndMs + stagger + CROSSFADE_MS
    : dealEndMs + TAG_QUESTION_FADE_MS + stagger + TAG_SPRING_SETTLE_MS
}
