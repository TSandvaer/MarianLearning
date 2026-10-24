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
 * A letter-sounds vowel map past greenfield is built here too (phase 4),
 * with the `currentTargetVowel` the server stamps for the session-end
 * write.
 *
 * Phase 3: a math session the device picks (`args.mathPick`, the add-to-10
 * / sub-to-10 sessions that used to send the Leitner or slow-fact hint) is
 * built here too, from core's picker (`composeSession`'s `mathPick`).
 *
 * The rest goes to the server as today (`startSession`):
 * - a step this build has no canon for;
 * - a request the bundled canon cannot serve (a review naming a block the
 *   build lacks; the server may have it, else it answers 400 as before);
 * - a local build that throws (logged), so a bug here costs a request,
 *   not a session. A pick that throws sends its hint-free payload: the
 *   server answers with the step's canon session.
 * A server request never carries the vowel map or the seed (`toServer`),
 * a pick's fallback included: the device builds vowel sessions, so the
 * server answers from canon.
 */
import {
  canonTextKey,
  composeSession,
  type CanonText,
  type CanonTextResolver,
  type ComposeOptions,
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
  type SessionStartPayload,
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
  compose?: (
    payload: unknown,
    resolve: CanonTextResolver,
    options?: ComposeOptions,
  ) => ComposedSession
  /** The server path (default `startSession`). */
  startServer?: typeof startSession
}

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

/**
 * `args` for the server: without the device-only fields, the vowel map
 * (the server would run the planner for it) and the vowel session's seed.
 */
function toServer(args: SessionStartArgs): SessionStartArgs {
  const progress = args.payload.progress
  const hasMap =
    typeof progress === 'object' &&
    progress !== null &&
    'letterSoundsVowelStates' in progress
  if (!('seed' in args.payload) && !hasMap) return args
  const payload: SessionStartPayload = { ...args.payload }
  delete payload.seed
  if (hasMap) {
    const rest: Record<string, unknown> = { ...progress }
    delete rest.letterSoundsVowelStates
    payload.progress = rest
  }
  return { ...args, payload }
}

export async function startSessionLocalFirst(
  args: SessionStartArgs,
  deps: LocalSessionDeps = {},
): Promise<PreparedSession> {
  const startServer = (a: SessionStartArgs, d: SessionStartDeps) =>
    (deps.startServer ?? startSession)(toServer(a), d)
  const now = deps.now ?? Date.now
  const t0 = now()
  let composed: ComposedSession
  try {
    composed = (deps.compose ?? composeSession)(
      args.payload,
      deps.resolveCanon ?? bundledCanonText,
      args.mathPick !== undefined ? { mathPick: args.mathPick } : {},
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
    ...(composed.currentTargetVowel !== undefined
      ? { currentTargetVowel: composed.currentTargetVowel }
      : {}),
    audio,
    fetchMs: ms,
  }
}
