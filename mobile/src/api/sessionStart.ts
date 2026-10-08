/**
 * Live `/api/claude` session-start for the Math track.
 *
 * Payload mirrors `src/lib/audio/mathPathA.ts` for a greenfield child (no
 * progress block): `{ kind: 'session-start', payload: { track: 'math',
 * level: 1, childName } }`. On the server that request is answered from the
 * pre-baked canon before the rate limiter and before any Anthropic call
 * (api/claude.ts "canon-first" branch) — see SPIKE.md for the cost note.
 *
 * Differences from the web:
 *  - absolute base URL (native has no same-origin `/api/claude`);
 *  - a bundled fixture as fallback, so the screen still renders offline and
 *    so iteration does not spend live calls. The web falls back to a static
 *    plan instead.
 */
import {
  isSessionStartResponse,
  mathSessionPlanFromServer,
  type ClaudeRequest,
  type MathSessionPlan,
  type SessionStartResponse,
} from '../reuse'

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? 'https://marian-learning.vercel.app'
/** `EXPO_PUBLIC_SESSION_SOURCE=fixture` skips the network entirely. */
const FORCE_FIXTURE = process.env.EXPO_PUBLIC_SESSION_SOURCE === 'fixture'
const TIMEOUT_MS = 15_000

export type SessionSource = 'live' | 'fixture'

export interface PreparedMathSession {
  source: SessionSource
  /** Why the fixture was used (undefined for live). */
  fallbackReason?: string
  plan: MathSessionPlan
  response: SessionStartResponse
  fetchMs: number
}

function loadFixture(): SessionStartResponse {
  const fixture: unknown = require('../../fixtures/session-start-math.json')
  if (!isSessionStartResponse(fixture)) {
    throw new Error('fixture does not match SessionStartResponse')
  }
  return fixture
}

async function fetchLive(signal: AbortSignal): Promise<SessionStartResponse> {
  const body: ClaudeRequest = {
    kind: 'session-start',
    payload: { track: 'math', level: 1, childName: 'Marian' },
  }
  const res = await fetch(`${API_BASE}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const parsed: unknown = await res.json()
  if (!res.ok) {
    const code =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : `http-${res.status}`
    throw new Error(code)
  }
  if (!isSessionStartResponse(parsed)) {
    throw new Error('invalid-response')
  }
  return parsed
}

export async function prepareMathSession(): Promise<PreparedMathSession> {
  const started = Date.now()
  if (!FORCE_FIXTURE) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetchLive(controller.signal)
      return {
        source: 'live',
        plan: mathSessionPlanFromServer(response.plan),
        response,
        fetchMs: Date.now() - started,
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      const response = loadFixture()
      return {
        source: 'fixture',
        fallbackReason: reason,
        plan: mathSessionPlanFromServer(response.plan),
        response,
        fetchMs: Date.now() - started,
      }
    } finally {
      clearTimeout(timer)
    }
  }
  const response = loadFixture()
  return {
    source: 'fixture',
    fallbackReason: 'EXPO_PUBLIC_SESSION_SOURCE=fixture',
    plan: mathSessionPlanFromServer(response.plan),
    response,
    fetchMs: Date.now() - started,
  }
}
