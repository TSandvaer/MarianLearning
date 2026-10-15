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
 * Nothing here reads or writes progress. The Claude key never reaches the
 * app: `/api/claude` is the Vercel function.
 */
import type { ExtendedMathSessionPlan } from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import { pickPeekBlocks } from '@marian/core/map/peek'
import type { MasteryTrack, SkillNode } from '@marian/core/progress'
import { PEEK_BLOCK_COUNT, PEEK_PLAN_ID_PREFIX } from '@marian/core/wire/types'
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

/** What a peek plays: the step's 3 problems, in the world's plan shape. */
export type PeekPlan =
  | { world: 'math'; plan: ExtendedMathSessionPlan }
  | { world: 'word-song'; plan: WordSongSessionPlan }

export type PreparedPeek = PeekPlan & {
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

/** Is `plan` a peek response's plan (`plan.id` starts `peek-`)? */
export function isPeekPlan(plan: unknown): boolean {
  return (
    typeof plan === 'object' &&
    plan !== null &&
    typeof (plan as { id?: unknown }).id === 'string' &&
    (plan as { id: string }).id.startsWith(PEEK_PLAN_ID_PREFIX)
  )
}

/** Read a peek response; throws on anything but a `peek-` plan of 3. */
export function peekPlanFromServer(
  world: MasteryTrack,
  serverPlan: unknown,
): PeekPlan {
  if (!isPeekPlan(serverPlan)) {
    throw new Error('the peek request was answered with another plan')
  }
  return world === 'math'
    ? {
        world,
        plan: mathSessionPlanFromServer(serverPlan, {
          extendedKinds: true,
          problemCount: PEEK_BLOCK_COUNT,
        }),
      }
    : {
        world,
        plan: wordSongSessionPlanFromServer(serverPlan, {
          problemCount: PEEK_BLOCK_COUNT,
        }),
      }
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
export async function requestPeek({
  world,
  node,
  signal,
  start = startSession,
  timeoutMs = PEEK_TIMEOUT_MS,
  now = Date.now,
}: RequestPeekArgs): Promise<PreparedPeek> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal.aborted) abort()
  signal.addEventListener('abort', abort)
  const timer = setTimeout(abort, timeoutMs)
  try {
    const prepared = await start(
      {
        sessionId: `peek-${node}-${now()}`,
        payload: buildPeekPayload(world, node),
        signal: controller.signal,
      },
      { alongside: true },
    )
    try {
      if (controller.signal.aborted) throw new Error('peek aborted')
      const plan = peekPlanFromServer(world, prepared.plan)
      recordAudio({ kind: 'note', label: 'peek', detail: `ready (${node})` })
      return { ...plan, node, audio: prepared.audio }
    } catch (err) {
      // A plan the peek cannot play: its audio must not stay on disk.
      prepared.audio.unload()
      throw err
    }
  } catch (err) {
    recordAudio({
      kind: 'note',
      label: 'peek',
      detail: `unavailable (${node}): ${err instanceof Error ? err.message : String(err)}`,
    })
    throw err
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}
