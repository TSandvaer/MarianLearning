/**
 * The Map peek's session start (native spec
 * `design/native/fast-track-native.md` §§ 6.1–6.2, 6.5).
 *
 * - **Request**: `{ track, level: 1, childName, peek: { blocks } }` with
 *   core's `pickPeekBlocks(node)` (the step's problems 1–3). No progress
 *   hint: the server ignores them for a peek, and a peek reads nothing.
 * - **Accept** only a plan id starting `peek-` with exactly 3 readable
 *   problems (core's parsers with `problemCount: 3`); anything else — a
 *   network error, a 400, an older server's forward plan, a plan that does
 *   not read — rejects, and so does no answer within `PEEK_TIMEOUT_MS`.
 *   The caller (the map) then says the stop's name.
 * - **Audio** loads beside the current session (`alongside`), so the Hub's
 *   prefetch survives the peek, as it survives any map visit. The caller
 *   unloads it when the peek ends.
 *
 * The Map replay (`design/native/map-tap-to-play.md` § 3) is the same
 * request under the peek's rules: `{ track, level: 1, childName, replay:
 * { node } }`, accepted only as a `replay-` plan of exactly 8 readable
 * problems (the step's canon P1–P8), with the same 5 s budget, the same
 * `alongside` audio and the same failure path (the stop's name).
 *
 * Nothing here reads or writes progress. The Claude key never reaches the
 * app: `/api/claude` is the Vercel function.
 */
import type { ExtendedMathSessionPlan } from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import { pickPeekBlocks } from '@marian/core/map/peek'
import type { MasteryTrack, SkillNode } from '@marian/core/progress'
import {
  PEEK_BLOCK_COUNT,
  PEEK_PLAN_ID_PREFIX,
  REPLAY_BLOCK_COUNT,
  REPLAY_PLAN_ID_PREFIX,
} from '@marian/core/wire/types'
import { wordSongSessionPlanFromServer } from '@marian/core/wordSong/planFromServer'
import type { WordSongSessionPlan } from '@marian/core/wordSong/wordSessionPlans'
import {
  recordAudio,
  startSession,
  type LoadedSessionAudio,
  type SessionStartPayload,
} from '../audio'
import { wireRef } from './reviewSession'

/** § 6.1: no answer within this long is the failure path. */
export const PEEK_TIMEOUT_MS = 5000

/**
 * What a peek plays (the step's 3 problems) or a replay (its 8), in the
 * world's plan shape.
 */
export type PeekPlan =
  | { world: 'math'; plan: ExtendedMathSessionPlan }
  | { world: 'word-song'; plan: WordSongSessionPlan }

/** A peek (a later stop) or a replay (a mastered stop): the peek's rules. */
export type MapSessionMode = 'peek' | 'replay'

export type PreparedPeek = PeekPlan & {
  mode: MapSessionMode
  node: SkillNode
  audio: LoadedSessionAudio
}

/** The `session-start` payload of a peek on `node`. */
export function buildPeekPayload(
  world: MasteryTrack,
  node: SkillNode,
): SessionStartPayload {
  return {
    track: world,
    level: 1,
    childName: 'Marian',
    peek: { blocks: pickPeekBlocks(node).map(wireRef) },
  }
}

/** The `session-start` payload of a replay of `node` (§ 3). */
export function buildReplayPayload(
  world: MasteryTrack,
  node: SkillNode,
): SessionStartPayload {
  return { track: world, level: 1, childName: 'Marian', replay: { node } }
}

function hasPlanId(plan: unknown, prefix: string): boolean {
  return (
    typeof plan === 'object' &&
    plan !== null &&
    typeof (plan as { id?: unknown }).id === 'string' &&
    (plan as { id: string }).id.startsWith(prefix)
  )
}

/** Is `plan` a peek response's plan (`plan.id` starts `peek-`)? */
export function isPeekPlan(plan: unknown): boolean {
  return hasPlanId(plan, PEEK_PLAN_ID_PREFIX)
}

/** `serverPlan` read as exactly `count` problems of `world`'s plan shape. */
function blockPlanFromServer(
  world: MasteryTrack,
  serverPlan: unknown,
  count: number,
): PeekPlan {
  return world === 'math'
    ? {
        world,
        plan: mathSessionPlanFromServer(serverPlan, {
          extendedKinds: true,
          problemCount: count,
        }),
      }
    : {
        world,
        // The native app plays the little stories (content wave 3).
        plan: wordSongSessionPlanFromServer(serverPlan, {
          problemCount: count,
          littleStories: true,
        }),
      }
}

/** Read a peek response; throws on anything but a `peek-` plan of 3. */
export function peekPlanFromServer(
  world: MasteryTrack,
  serverPlan: unknown,
): PeekPlan {
  if (!isPeekPlan(serverPlan)) {
    throw new Error('the peek request was answered with another plan')
  }
  return blockPlanFromServer(world, serverPlan, PEEK_BLOCK_COUNT)
}

/** Read a replay response; throws on anything but a `replay-` plan of 8. */
export function replayPlanFromServer(
  world: MasteryTrack,
  serverPlan: unknown,
): PeekPlan {
  if (!hasPlanId(serverPlan, REPLAY_PLAN_ID_PREFIX)) {
    throw new Error('the replay request was answered with another plan')
  }
  return blockPlanFromServer(world, serverPlan, REPLAY_BLOCK_COUNT)
}

export interface RequestPeekArgs {
  world: MasteryTrack
  node: SkillNode
  /** The map's: Home (or the map leaving) aborts the request. */
  signal: AbortSignal
  /** Test seams. */
  start?: typeof startSession
  timeoutMs?: number
  now?: () => number
}

/**
 * Start a peek on `node`. Resolves with the plan and its audio (loaded
 * beside the current session); rejects on any failure, the 5 s timeout or
 * an abort, leaving no audio behind.
 */
export function requestPeek(args: RequestPeekArgs): Promise<PreparedPeek> {
  return requestMapSession('peek', args)
}

/**
 * Start a replay of `node` (map-tap-to-play § 3): as `requestPeek`, for the
 * step's 8 canon problems.
 */
export function requestReplay(args: RequestPeekArgs): Promise<PreparedPeek> {
  return requestMapSession('replay', args)
}

const MAP_SESSIONS: Record<
  MapSessionMode,
  {
    payload: (world: MasteryTrack, node: SkillNode) => SessionStartPayload
    read: (world: MasteryTrack, serverPlan: unknown) => PeekPlan
  }
> = {
  peek: { payload: buildPeekPayload, read: peekPlanFromServer },
  replay: { payload: buildReplayPayload, read: replayPlanFromServer },
}

async function requestMapSession(
  mode: MapSessionMode,
  {
    world,
    node,
    signal,
    start = startSession,
    timeoutMs = PEEK_TIMEOUT_MS,
    now = Date.now,
  }: RequestPeekArgs,
): Promise<PreparedPeek> {
  const session = MAP_SESSIONS[mode]
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal.aborted) abort()
  signal.addEventListener('abort', abort)
  const timer = setTimeout(abort, timeoutMs)
  try {
    const prepared = await start(
      {
        sessionId: `${mode}-${node}-${now()}`,
        payload: session.payload(world, node),
        signal: controller.signal,
      },
      { alongside: true },
    )
    try {
      if (controller.signal.aborted) throw new Error(`${mode} aborted`)
      const plan = session.read(world, prepared.plan)
      recordAudio({ kind: 'note', label: mode, detail: `ready (${node})` })
      return { ...plan, mode, node, audio: prepared.audio }
    } catch (err) {
      // A plan the peek cannot play: its audio must not stay on disk.
      prepared.audio.unload()
      throw err
    }
  } catch (err) {
    recordAudio({
      kind: 'note',
      label: mode,
      detail: `unavailable (${node}): ${err instanceof Error ? err.message : String(err)}`,
    })
    throw err
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}
