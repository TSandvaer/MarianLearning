/**
 * Hint-free sessions built on the device (no-Claude plan phase 2,
 * `design/native/no-claude-sizing.md` § 2, § 4 row 2).
 *
 * `startSessionLocalFirst` has `startSession`'s contract and result (a
 * `PreparedSession`: the server's plan shape and the session audio), so
 * the plan adapters and the screens are unchanged. For every payload the
 * server answers from canon (a step's canon session, a review, a Map peek
 * or replay, a times mix, a warm-up), core's `composeSession` builds the
 * same plan and lines from the bundled canon text
 * (`assets/canon/canon-text.json`, written by `npm run export-audio`), and
 * every line plays its bundled clip (phase 1). No network call, no wait.
 *
 * The rest goes to the server as today (`startSession`):
 * - a hint the planner uses (the add-to-10 Leitner box, a slow fact on
 *   add-to-10 or sub-to-10, a letter-sounds vowel map past greenfield),
 *   until phases 3–4 move them; their 5 s fallback is hint-free, so it is
 *   built here;
 * - a step this build has no canon for;
 * - a request the bundled canon cannot serve (a review naming a block the
 *   build lacks; the server may have it, else it answers 400 as before);
 * - a local build that throws (logged), so a bug here costs a request,
 *   not a session.
 */
import {
  canonTextKey,
  composeSession,
  type CanonText,
  type CanonTextResolver,
  type ComposedSession,
} from '@marian/core/session/composeSession'
import type { PlayableUtterance } from '@marian/core/wire/types'
import canonText from '../../assets/canon/canon-text.json'
import { recordAudio } from '../audio/audioLog'
import { loadSessionAudio } from '../audio/sessionAudio'
import {
  SessionStartError,
  startSession,
  type PreparedSession,
  type SessionStartArgs,
  type SessionStartDeps,
} from '../audio/sessionStart'

const CANON_TEXT = canonText as unknown as Readonly<Record<string, CanonText>>

/** A canon file's text from the app's bundle; `null`: this build has none. */
export const bundledCanonText: CanonTextResolver = (key) => {
  const path = canonTextKey(key)
  return Object.prototype.hasOwnProperty.call(CANON_TEXT, path)
    ? CANON_TEXT[path]!
    : null
}

export interface LocalSessionDeps extends SessionStartDeps {
  /** The canon text (default: the app's bundle). */
  resolveCanon?: CanonTextResolver
  /** The builder (default core's `composeSession`); a test seam. */
  compose?: (payload: unknown, resolve: CanonTextResolver) => ComposedSession
  /** The server path (default `startSession`). */
  startServer?: typeof startSession
}

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

export async function startSessionLocalFirst(
  args: SessionStartArgs,
  deps: LocalSessionDeps = {},
): Promise<PreparedSession> {
  const startServer = deps.startServer ?? startSession
  const now = deps.now ?? Date.now
  const t0 = now()
  let composed: ComposedSession
  try {
    composed = (deps.compose ?? composeSession)(
      args.payload,
      deps.resolveCanon ?? bundledCanonText,
    )
  } catch (err) {
    recordAudio({
      kind: 'note',
      label: 'session-local',
      detail: `build failed, asking the server: ${message(err)}`,
    })
    return startServer(args, deps)
  }
  if (composed.kind === 'server') return startServer(args, deps)
  if (composed.kind === 'invalid') {
    recordAudio({
      kind: 'note',
      label: 'session-local',
      detail: `not built (${composed.message}), asking the server`,
    })
    return startServer(args, deps)
  }
  if (args.signal?.aborted) {
    throw new SessionStartError('aborted', 'session-start aborted before load')
  }
  const utterances: PlayableUtterance[] = composed.session.utterances.map(
    (u) => ({
      id: u.id,
      text: u.text,
      audio: { kind: 'bundled', key: u.text },
    }),
  )
  const audio = loadSessionAudio(args.sessionId, utterances, deps)
  const ms = now() - t0
  // The step sweep reads the focus step from this row
  // (`scripts/maestroSweepVerdict.ts`): no request carries it to an API.
  const focus = (args.payload.progress as { focusNode?: unknown } | undefined)
    ?.focusNode
  recordAudio({
    kind: 'session-load',
    label: `session-local ${args.payload.track}`,
    ms,
    detail: `${composed.served} ${typeof focus === 'string' ? focus : '(none)'}, ${utterances.length} utterances`,
  })
  return {
    sessionId: args.sessionId,
    track: args.payload.track,
    plan: composed.session.plan,
    audio,
    fetchMs: ms,
  }
}
