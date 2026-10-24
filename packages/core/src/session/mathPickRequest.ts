/**
 * Which math sessions the device picks (no-Claude plan phase 3,
 * `design/native/no-claude-sizing.md` § 1 rows 1–2) and what the picker
 * reads from the learner's progress doc.
 *
 * The device picks exactly the sessions whose request carried a hint the
 * live planner used: an add-to-10 session with a due Leitner fact (the
 * hint `forwardLeitnerHint` built: due, narrowed to the step, the warm-up's
 * facts out, capped), and an add-to-10 or sub-to-10 session with a slow
 * fact (`buildSlowFactSessionHint`). Those requests no longer carry the
 * hints; every other math session stays on the step's canon (phase 2).
 *
 * Pure: no storage, no clock.
 */
import { buildSlowFactSessionHint } from '../progress/slowFacts'
import {
  forwardLeitnerHint,
  warmupFactsOf,
  type SessionPlanKind,
} from '../progress/reviewPlan'
import { seenItemsOf } from '../progress/seenItems'
import type { MathFact, Progress, SkillNode } from '../progress/types'
import type { MathPickRequest } from './mathPicker'

/** A session's problem count: the history entry of a full session. */
const PROBLEMS = 8

/** The facts of the learner's last session of `step`, P1–P8 (the history
 *  entry's per-problem facts, warm-ups left out), or `null`. */
export function previousSessionFacts(
  p: Pick<Progress, 'history'>,
  step: SkillNode,
): MathFact[] | null {
  for (let i = p.history.length - 1; i >= 0; i--) {
    const entry = p.history[i]!
    if (entry.skillFocus.length !== 1 || entry.skillFocus[0] !== step) continue
    const facts = entry.mathFacts
    if (facts === undefined || facts.length !== PROBLEMS) return null
    return facts.map((f) => ({ a: f.a, b: f.b, op: f.op }))
  }
  return null
}

/**
 * The picker's request for this forward session, or `null` when the
 * device does not pick it (no hint would have gone, a review, a times mix,
 * another step). `planKind` is the session's (`sessionPlanKind`), `seed`
 * the session count at kick time, `nowMs` / `today` the progress clock's.
 */
export function mathPickRequestFor(
  p: Progress,
  focus: SkillNode | undefined,
  planKind: SessionPlanKind,
  nowMs: number,
  today: string,
  seed: number,
): MathPickRequest | null {
  if (planKind.kind !== 'forward' || planKind.mix !== undefined) return null
  if (focus !== 'add-to-10' && focus !== 'sub-to-10') return null
  const leitner =
    focus === 'add-to-10'
      ? forwardLeitnerHint(p.mathFactsLeitner, nowMs, focus, planKind.warmup)
      : []
  const slow = buildSlowFactSessionHint(p)
  if (leitner.length === 0 && slow.length === 0) return null
  return {
    step: focus,
    leitner: p.mathFactsLeitner,
    seen: seenItemsOf(p),
    previous: previousSessionFacts(p, focus),
    // The old directive's preference: the shorter-latency slow facts,
    // closest to the counting → retrieval flip, first.
    slow: [...slow]
      .sort((x, y) => x.medianLatencyMs - y.medianLatencyMs)
      .map((s) => ({ ...s.fact })),
    warmup: warmupFactsOf(planKind.warmup),
    nowMs,
    today,
    seed,
  }
}
