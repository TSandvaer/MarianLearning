/**
 * The every-step Maestro sweep's verdict for one step
 * (`mobile/maestro/run.sh --sweep`, `mobile/maestro/README.md`).
 *
 * Pure. Its inputs are what the sweep collects per step:
 *
 *   - the step's slice of Metro's log (the device's console, as Expo CLI
 *     prints it: ` LOG  ...`, ` WARN  ...`, ` ERROR  ...`),
 *   - the step's slice of the sweep API's request log (one JSON record per
 *     `/api/claude` request, written by `scripts/maestroSweepApi.ts`),
 *   - whether the Maestro flow passed, and whether the step is on the
 *     expected-fail list.
 *
 * A step is healthy when all of these hold:
 *
 *   1. the Maestro flow passed: Hub → the world's card → one session with
 *      the QA autotap → Session End → Hub (a crash, a red box or a screen
 *      that never comes fails it),
 *   2. Metro's log has `[qaStep] jumped to "<step>"` (the launch flag
 *      applied, `mobile/src/platform/native.ts`),
 *   3. every session-start of the step's world asked the API for this
 *      step (`progress.focusNode`), and at least one did,
 *   4. no ` ERROR ` line in Metro's log,
 *   5. the session played the server's plan: `[audio] <track>-session
 *      ready (<plan id>)`, not `... unavailable, silent fallback: <why>`
 *      (`mobile/src/session/mathSession.ts`, `wordSongSession.ts`).
 *
 * An expected-fail step is XFAIL when its ONLY problem is the silent
 * fallback and the API did serve the step (HTTP 200 from canon): the
 * known gap is "the server answers, the app can't read the plan". If it
 * has no problem at all it is XPASS, which fails the sweep, so the list
 * can't go stale. Anything else is FAIL.
 */

export type SweepWorld = 'math' | 'word-song'
export type SweepVerdict = 'PASS' | 'XFAIL' | 'XPASS' | 'FAIL'

/** One `/api/claude` request the sweep API answered. */
export interface SweepApiRecord {
  /** The request's `kind` (`session-start`, `stumble-explanation`, ...). */
  kind: string
  /** `payload.track`, when the request has one. */
  track: string | null
  /** `payload.progress.focusNode`, when the request has one. */
  focusNode: string | null
  /** The handler's HTTP status. */
  status: number
  /** Whether the handler's canon lookup ran and hit. */
  source: 'canon-hit' | 'canon-miss' | 'none'
}

export interface StepEvidence {
  node: string
  world: SweepWorld
  expectedFail: boolean
  flowPassed: boolean
  /** The step's slice of Metro's log. */
  metroLog: string
  /** The step's slice of the sweep API's request log. */
  apiRecords: readonly SweepApiRecord[]
}

export interface StepResult {
  verdict: SweepVerdict
  detail: string
}

export const EXPECTED_FAIL_FILE = 'mobile/maestro/sweep/expected-fail.txt'

const FLOW_FAILED =
  'Maestro flow failed (crash, red box or a screen that never came)'

function sessionLabel(world: SweepWorld): string {
  return world === 'math' ? 'math-session' : 'word-song-session'
}

/** What the step's session did, from its `[audio] <label> ...` lines. */
function sessionOutcome(
  lines: readonly string[],
  world: SweepWorld,
):
  | { kind: 'ready'; planId: string }
  | { kind: 'fallback'; why: string }
  | null {
  const label = sessionLabel(world)
  const ready = `[audio] ${label} ready (`
  const fallback = `[audio] ${label} unavailable, silent fallback: `
  for (const line of lines) {
    const r = line.indexOf(ready)
    if (r !== -1) {
      const rest = line.slice(r + ready.length)
      return { kind: 'ready', planId: rest.split(/[,)]/)[0]!.trim() }
    }
    const f = line.indexOf(fallback)
    if (f !== -1) {
      return { kind: 'fallback', why: line.slice(f + fallback.length).trim() }
    }
  }
  return null
}

const ERROR_LINE = /^\s*ERROR\s+(.*)$/

export function classifyStep(e: StepEvidence): StepResult {
  const lines = e.metroLog.split(/\r?\n/)
  const problems: string[] = []

  if (!e.flowPassed) problems.push(FLOW_FAILED)

  if (!lines.some((l) => l.includes(`[qaStep] jumped to "${e.node}"`))) {
    problems.push(`no [qaStep] jump to ${e.node} in Metro log`)
  }

  const starts = e.apiRecords.filter(
    (r) => r.kind === 'session-start' && r.track === e.world,
  )
  if (starts.length === 0) {
    problems.push(`no ${e.world} session-start reached the sweep API`)
  } else {
    const wrong = [
      ...new Set(
        starts
          .filter((r) => r.focusNode !== e.node)
          .map((r) => r.focusNode ?? '(none)'),
      ),
    ]
    if (wrong.length > 0) {
      problems.push(
        `session-start asked for ${wrong.join(', ')}, not ${e.node}`,
      )
    }
  }

  const errors = lines
    .map((l) => ERROR_LINE.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
  if (errors.length > 0) {
    problems.push(
      `${errors.length} ERROR line(s) in Metro log, first: ${errors[0]![1]!.trim()}`,
    )
  }

  const outcome = sessionOutcome(lines, e.world)
  let fallbackProblem: string | null = null
  if (outcome === null) {
    problems.push(`${e.world} session never settled (no ready / fallback line)`)
  } else if (outcome.kind === 'fallback') {
    fallbackProblem = `silent fallback: ${outcome.why}`
    problems.push(fallbackProblem)
  }

  const planDetail =
    outcome?.kind === 'ready' ? `server plan ${outcome.planId}` : ''

  if (!e.expectedFail) {
    return problems.length === 0
      ? { verdict: 'PASS', detail: planDetail }
      : { verdict: 'FAIL', detail: problems.join('; ') }
  }

  if (problems.length === 0) {
    return {
      verdict: 'XPASS',
      detail: `${planDetail} (expected to fail: take it off ${EXPECTED_FAIL_FILE})`,
    }
  }
  if (problems.length === 1 && fallbackProblem !== null) {
    const forStep = starts.filter((r) => r.focusNode === e.node)
    const served = forStep.some(
      (r) => r.status === 200 && r.source === 'canon-hit',
    )
    if (served) return { verdict: 'XFAIL', detail: fallbackProblem }
    const last = forStep[forStep.length - 1]
    problems.push(
      `the sweep API did not serve ${e.node}` +
        (last ? ` (${last.status}, ${last.source})` : ''),
    )
  }
  return { verdict: 'FAIL', detail: problems.join('; ') }
}

const SOURCES: ReadonlySet<string> = new Set([
  'canon-hit',
  'canon-miss',
  'none',
])

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === 'string'
}

function isApiRecord(v: unknown): v is SweepApiRecord {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    typeof r.kind === 'string' &&
    isNullableString(r.track) &&
    isNullableString(r.focusNode) &&
    typeof r.status === 'number' &&
    typeof r.source === 'string' &&
    SOURCES.has(r.source)
  )
}

/** The sweep API's request log (JSON lines). Throws on a bad line. */
export function parseApiLog(text: string): SweepApiRecord[] {
  const out: SweepApiRecord[] = []
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.trim() === '') return
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      throw new Error(`sweep API log line ${i + 1} is not JSON: ${line}`)
    }
    if (!isApiRecord(parsed)) {
      throw new Error(
        `sweep API log line ${i + 1} is not a request record: ${line}`,
      )
    }
    out.push(parsed)
  })
  return out
}

/**
 * The expected-fail list: one step per line, `#` starts a comment. Throws
 * on a name that is not one of `steps`, because a typo would silently turn
 * a known gap into an unexpected FAIL, or hide a step from the list.
 */
export function parseExpectedFail(
  text: string,
  steps: readonly string[],
): Set<string> {
  const known = new Set(steps)
  const out = new Set<string>()
  for (const raw of text.split(/\r?\n/)) {
    const name = raw.replace(/#.*$/, '').trim()
    if (name === '') continue
    if (!known.has(name)) {
      throw new Error(
        `${EXPECTED_FAIL_FILE}: "${name}" is not a step (steps: ${steps.join(', ')})`,
      )
    }
    out.add(name)
  }
  return out
}
