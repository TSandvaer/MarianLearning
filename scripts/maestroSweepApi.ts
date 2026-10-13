/**
 * The every-step Maestro sweep's local `/api/claude`
 * (`mobile/maestro/run.sh --sweep`, `mobile/maestro/README.md`).
 *
 * Why the sweep needs one: the per-PR flows point the bundle at a closed
 * port, so EVERY session start fails and every step plays core's static
 * fallback plan. That can't tell a step whose server plan the app can play
 * from one it can't (Number Garden 8-11 today), and it can't show which
 * step a session was for. The sweep instead serves the session canon
 * committed under `public/canon/` through the production handler
 * (`api/claude.ts`), so each step gets exactly the response production
 * gives it.
 *
 * Nothing paid, nothing outbound, nothing in production:
 *
 *   - the handler's Anthropic client is a stub that throws (a canon miss
 *     answers 502 instead of calling Haiku),
 *   - `globalThis.fetch` throws in this process (the TTS providers' only
 *     way out), and every attempt is logged,
 *   - `assertNoCredentials` refuses to start with any credential in the
 *     environment; `ANTHROPIC_API_KEY` is set to a placeholder only
 *     because the handler checks that the variable is present,
 *   - `run.sh` starts it with `env -i` and binds it to 127.0.0.1.
 *
 * Every `/api/claude` request is reported to `record` as a
 * `SweepApiRecord` (the sweep's evidence of which step a session asked
 * for and what it got).
 */
import { getCanonEntry } from '../api/_canon.js'
import { handler } from '../api/claude.js'
import type { PlannerAnthropicClient } from '../api/_planner.js'
import type { SweepApiRecord } from './maestroSweepVerdict.ts'

/** The handler only checks that the variable is set; it is never sent. */
export const PLACEHOLDER_ANTHROPIC_KEY = 'maestro-sweep-placeholder-not-a-key'

/** Every credential the API reads (`grep process.env api/*.ts`). */
export const CREDENTIAL_ENV: readonly string[] = [
  'ANTHROPIC_API_KEY',
  'AZURE_SPEECH_KEY',
  'ELEVENLABS_API_KEY',
  'PROGRESS_API_SECRET',
  'VOICE_QA_SECRET',
  'GITHUB_TOKEN',
]

/**
 * Throws when a credential is set (an `ANTHROPIC_API_KEY` equal to the
 * placeholder is allowed).
 */
export function assertNoCredentials(
  env: Readonly<Record<string, string | undefined>>,
): void {
  const found = CREDENTIAL_ENV.filter((name) => {
    const value = env[name]
    if (value === undefined || value === '') return false
    return !(
      name === 'ANTHROPIC_API_KEY' && value === PLACEHOLDER_ANTHROPIC_KEY
    )
  })
  if (found.length > 0) {
    throw new Error(
      `the sweep API must run without credentials, but ${found.join(', ')} ` +
        'is set (start it through mobile/maestro/run.sh --sweep)',
    )
  }
}

/**
 * Replace `globalThis.fetch` with one that throws, reporting each attempt.
 * Returns the restore function.
 */
export function blockOutboundFetch(
  onAttempt: (url: string) => void,
): () => void {
  const original = globalThis.fetch
  const blocked = async (input: string | URL | Request): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    onAttempt(url)
    throw new Error(`maestro sweep API: outbound fetch blocked (${url})`)
  }
  globalThis.fetch = blocked as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

/** The handler's planner client: a canon miss must never reach Haiku. */
const refusingPlannerClient: PlannerAnthropicClient = {
  messages: {
    create: async () => {
      throw new Error('maestro sweep API: canon only, no live planner')
    },
  },
}

function field(obj: unknown, key: string): unknown {
  return typeof obj === 'object' && obj !== null
    ? (obj as Record<string, unknown>)[key]
    : undefined
}

function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

/** The request's kind, track and focus node, read as the handler does. */
export function describeRequest(
  body: unknown,
): Pick<SweepApiRecord, 'kind' | 'track' | 'focusNode'> {
  const payload = field(body, 'payload')
  return {
    kind: stringOrNull(field(body, 'kind')) ?? '(invalid)',
    track: stringOrNull(field(payload, 'track')),
    focusNode: stringOrNull(field(field(payload, 'progress'), 'focusNode')),
  }
}

export interface SweepApiDeps {
  record: (r: SweepApiRecord) => void
  /** Test seam: the canon lookup (default: the handler's own). */
  getCanonEntry?: typeof getCanonEntry
  /** Test seam: the planner client (default: one that throws). */
  plannerClient?: PlannerAnthropicClient
}

/** The sweep API's request handler (`serve` puts it on a socket). */
export function createSweepApi(
  deps: SweepApiDeps,
): (request: Request) => Promise<Response> {
  const lookup = deps.getCanonEntry ?? getCanonEntry
  const plannerClient = deps.plannerClient ?? refusingPlannerClient
  return async (request) => {
    if (new URL(request.url).pathname !== '/api/claude') {
      return new Response('not found', { status: 404 })
    }
    let body: unknown = null
    try {
      body = JSON.parse(await request.clone().text())
    } catch {
      // The handler answers invalid JSON itself (400); log it as such.
    }
    let source: SweepApiRecord['source'] = 'none'
    const response = await handler(request, {
      anthropicClient: plannerClient,
      getCanonEntry: (key) => {
        const hit = lookup(key)
        source = hit === null ? 'canon-miss' : 'canon-hit'
        return hit
      },
    })
    deps.record({ ...describeRequest(body), status: response.status, source })
    return response
  }
}
