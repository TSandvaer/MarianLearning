/**
 * A step's canon file holds two things (no-Claude plan phase 5a,
 * `design/native/no-claude-sizing.md` § 2 "How a pool grows"):
 * - the served session: problems 1–8 and the `session.end.*` lines, what
 *   `/api/claude` answers with from canon and the device's canon session;
 * - the pool: problems 9..N (`math.p9.*` on), the extra blocks only the
 *   device's picker draws, and only once their audio is bundled.
 *
 * `servedCanon` is the file without its pool. The server serves it
 * (`api/_canon.ts` `getCanonEntry`), so the frozen web, a review, a peek, a
 * replay and a warm-up see the same 8 problems they saw before the pool.
 *
 * No imports: the deployed functions load packages/core/src/wire as plain
 * Node ESM (see `api/_types.ts`).
 */

/** The problems of the served session: 1..this. */
export const SERVED_CANON_PROBLEMS = 8

const PROBLEM_ID = /^(?:math|word)\.p(\d+)\./

/** The canon problem a line belongs to (`math.p12.read` → 12), or `null`
 *  for a line of no problem (`session.end.*`, a renamed `w1` block). */
export function canonProblemOf(id: string): number | null {
  const m = PROBLEM_ID.exec(id)
  return m === null ? null : Number(m[1])
}

/** Is `id` a line of the pool (a problem past the served session)? */
export function isCanonPoolLineId(id: string): boolean {
  const problem = canonProblemOf(id)
  return problem !== null && problem > SERVED_CANON_PROBLEMS
}

const isPoolLine = (u: unknown): boolean => {
  const id = (u as { id?: unknown } | null)?.id
  return typeof id === 'string' && isCanonPoolLineId(id)
}

const planLines = (plan: unknown): unknown[] | null => {
  const lines = (plan as { utterances?: unknown } | null)?.utterances
  return Array.isArray(lines) ? lines : null
}

/** Does `doc` carry pool lines (problems past the served session)? */
export function hasCanonPool(doc: {
  plan?: unknown
  utterances: readonly unknown[]
}): boolean {
  return (
    doc.utterances.some(isPoolLine) ||
    (planLines(doc.plan)?.some(isPoolLine) ?? false)
  )
}

/**
 * `doc` without its pool: the plan's lines and the spoken lines of
 * problems 9+ dropped, every other field and line as it is, in order. A
 * file with no pool comes back as the same object.
 */
export function servedCanon<
  T extends { plan?: unknown; utterances: readonly unknown[] },
>(doc: T): T {
  if (!hasCanonPool(doc)) return doc
  const lines = planLines(doc.plan)
  const plan =
    lines === null
      ? doc.plan
      : {
          ...(doc.plan as Record<string, unknown>),
          utterances: lines.filter((u) => !isPoolLine(u)),
        }
  return {
    ...doc,
    plan,
    utterances: doc.utterances.filter((u) => !isPoolLine(u)),
  }
}
