// Review and warm-up blocks for /api/claude session-start (native spec
// design/native/review-mode-and-warmup-native.md § 7.4).
//
// The native app's core picker (`packages/core/src/progress/reviewPlan.ts`)
// chooses canon problems by `(step, problem 1..8)`; this module only copies
// those blocks out of the committed canon files, with their own baked audio.
// No planner call, no TTS, no credits, and no choice made here: `api/` can
// import nothing from core but the import-free `wire/` modules.
//
// Why copy blocks instead of rendering a composed `payload.plan`: that path
// reuses canon audio keyed by `renderElevenLabsText(text, undefined)`, while
// letter-sounds and simple-sentence lines are keyed with their tier
// (`getCanonAudioIndex`). They would miss the canon and render live through
// ElevenLabs: credits, and possibly the wrong phonemes.
//
// - `payload.review = { blocks }` (exactly 8 refs): `buildReviewResponse`
//   answers with the 8 blocks renamed `<ns>.p1..p8.<slot>` and a plan id
//   starting `review-` (the client rejects any other id). It runs before the
//   canon lookup, the session cache and the rate limiter. A bad ref or a
//   missing canon entry is a 400.
// - `payload.warmup = { blocks }` (1..3 refs): `withWarmupBlocks` appends
//   the refs' blocks to a COPY of the forward response as `<ns>.w<i>.<slot>`,
//   where `i` is the ref's 1-based position in `blocks`. A ref that can't be
//   served is skipped (its number stays unused, so the client still maps
//   every block to its ref); a malformed `warmup` is ignored. The module-
//   cached canon entry is never mutated and the appended response is never
//   cached. The forward parsers skip `w` ids (their regexes are anchored on
//   `p<N>`), so an older client is unaffected.
// - `payload.peek = { blocks }` (exactly 3 refs, all one step: the Map peek,
//   native spec design/native/fast-track-native.md § 6.2): the review
//   responder generalised. `buildPeekResponse` answers with the 3 blocks
//   renamed `<ns>.p1..p3.<slot>` and a plan id starting `peek-` (label
//   `Peek`); same place in the handler, same 400 on a bad ref. A peek counts
//   toward nothing; the server never sees what the child does with it.

import {
  VALID_MATH_FOCUS_NODES,
  VALID_WORD_SONG_FOCUS_NODES,
} from './_planner.js'
import type { PlannerTrack } from './_planner.js'
import {
  PEEK_BLOCK_COUNT,
  PEEK_PLAN_ID_PREFIX,
  REVIEW_BLOCK_COUNT,
  REVIEW_PLAN_ID_PREFIX,
  WARMUP_BLOCK_MAX,
  type CanonBlockRef,
  type SessionStartResponse,
  type Utterance,
} from './_types.js'

/** The canon resolver's shape (`getCanonEntry`, or a test stub). */
export type CanonResolver = (key: {
  track: PlannerTrack
  level: number
  focusNode: string
}) => SessionStartResponse | null

interface PlanLine {
  id: string
  text: string
}

/** Utterance id namespace per track (`math.p1.read`, `word.p1.read`). */
function namespaceOf(track: PlannerTrack): 'math' | 'word' {
  return track === 'math' ? 'math' : 'word'
}

function stepsOf(track: PlannerTrack): readonly string[] {
  return track === 'math' ? VALID_MATH_FOCUS_NODES : VALID_WORD_SONG_FOCUS_NODES
}

/**
 * `{ blocks: [...] }` with `min..max` refs, each a step of `track` and a
 * problem 1..8; `null` on any shape error.
 */
function parseBlocks(
  raw: unknown,
  track: PlannerTrack,
  min: number,
  max: number,
): CanonBlockRef[] | null {
  if (typeof raw !== 'object' || raw === null) return null
  const blocks = (raw as Record<string, unknown>).blocks
  if (!Array.isArray(blocks)) return null
  if (blocks.length < min || blocks.length > max) return null
  const steps = stepsOf(track)
  const out: CanonBlockRef[] = []
  for (const b of blocks) {
    if (typeof b !== 'object' || b === null) return null
    const { node, problem } = b as Record<string, unknown>
    if (typeof node !== 'string' || !steps.includes(node)) return null
    if (
      typeof problem !== 'number' ||
      !Number.isInteger(problem) ||
      problem < 1 ||
      problem > 8
    ) {
      return null
    }
    out.push({ node, problem })
  }
  return out
}

function planLinesOf(entry: SessionStartResponse): PlanLine[] {
  const plan = entry.plan as { utterances?: unknown } | null
  const lines = Array.isArray(plan?.utterances) ? plan.utterances : []
  return lines.filter(
    (u): u is PlanLine =>
      typeof u === 'object' &&
      u !== null &&
      typeof (u as PlanLine).id === 'string' &&
      typeof (u as PlanLine).text === 'string',
  )
}

/** One canon block's lines, renamed from `<ns>.p<problem>.` to `<ns>.<to>.`. */
function copyBlock(
  entry: SessionStartResponse,
  ns: 'math' | 'word',
  problem: number,
  to: string,
): { plan: PlanLine[]; utterances: Utterance[] } {
  const from = `${ns}.p${problem}.`
  const rename = (id: string) => `${ns}.${to}.${id.slice(from.length)}`
  return {
    plan: planLinesOf(entry)
      .filter((u) => u.id.startsWith(from))
      .map((u) => ({ id: rename(u.id), text: u.text })),
    utterances: entry.utterances
      .filter((u) => u.id.startsWith(from))
      .map((u) => ({ ...u, id: rename(u.id) })),
  }
}

/** A request answered with copied canon blocks only: a review or a peek. */
interface BlockSession {
  /** The payload field naming the blocks. */
  field: 'review' | 'peek'
  /** Exactly this many refs. */
  count: number
  /** Every ref names the same step (the peek). */
  oneStep: boolean
  idPrefix: string
  label: string
}

const REVIEW: BlockSession = {
  field: 'review',
  count: REVIEW_BLOCK_COUNT,
  oneStep: false,
  idPrefix: REVIEW_PLAN_ID_PREFIX,
  label: 'Review',
}

const PEEK: BlockSession = {
  field: 'peek',
  count: PEEK_BLOCK_COUNT,
  oneStep: true,
  idPrefix: PEEK_PLAN_ID_PREFIX,
  label: 'Peek',
}

function hasField(payload: unknown, field: string): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as Record<string, unknown>)[field] !== undefined
  )
}

/** Does the payload ask for a review (`payload.review` present)? */
export function hasReviewRequest(payload: unknown): boolean {
  return hasField(payload, REVIEW.field)
}

/** Does the payload ask for a Map peek (`payload.peek` present)? */
export function hasPeekRequest(payload: unknown): boolean {
  return hasField(payload, PEEK.field)
}

/**
 * The review response for `payload.review`, or `null` when the request is
 * invalid (not exactly 8 refs, a step of another track, a problem outside
 * 1..8, a missing canon entry, a block with no lines): the handler answers
 * 400 `invalid-request`. Every other progress hint is ignored.
 */
export function buildReviewResponse(
  payload: unknown,
  track: PlannerTrack,
  resolve: CanonResolver,
): SessionStartResponse | null {
  return buildBlockSession(REVIEW, payload, track, resolve)
}

/**
 * The Map peek's response for `payload.peek` (fast-track spec § 6.2), or
 * `null` when the request is invalid (not exactly 3 refs, refs of two
 * steps, a step of another track, a problem outside 1..8, a missing canon
 * entry): the handler answers 400 `invalid-request`. Every other progress
 * hint is ignored.
 */
export function buildPeekResponse(
  payload: unknown,
  track: PlannerTrack,
  resolve: CanonResolver,
): SessionStartResponse | null {
  return buildBlockSession(PEEK, payload, track, resolve)
}

function buildBlockSession(
  kind: BlockSession,
  payload: unknown,
  track: PlannerTrack,
  resolve: CanonResolver,
): SessionStartResponse | null {
  const raw = (payload as Record<string, unknown>)[kind.field]
  const refs = parseBlocks(raw, track, kind.count, kind.count)
  if (refs === null) return null
  if (kind.oneStep && refs.some((r) => r.node !== refs[0]!.node)) return null
  const ns = namespaceOf(track)
  const plan: PlanLine[] = []
  const utterances: Utterance[] = []
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i]!
    const entry = resolve({ track, level: 1, focusNode: ref.node })
    if (entry === null) return null
    const block = copyBlock(entry, ns, ref.problem, `p${i + 1}`)
    if (block.plan.length === 0 || block.utterances.length === 0) return null
    plan.push(...block.plan)
    utterances.push(...block.utterances)
  }
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: `${kind.idPrefix}${track}`,
      label: kind.label,
      utterances: plan,
    },
    utterances,
  }
}

/**
 * `response` with `payload.warmup`'s blocks appended as `<ns>.w<i>.<slot>`
 * (i = the ref's position, 1-based), in both arrays, on a copy. Returns
 * `response` itself when there is no valid warm-up or nothing could be
 * served.
 */
export function withWarmupBlocks(
  response: SessionStartResponse,
  payload: unknown,
  track: PlannerTrack,
  resolve: CanonResolver,
): SessionStartResponse {
  if (typeof payload !== 'object' || payload === null) return response
  const raw = (payload as Record<string, unknown>).warmup
  if (raw === undefined) return response
  const refs = parseBlocks(raw, track, 1, WARMUP_BLOCK_MAX)
  if (refs === null) return response
  const ns = namespaceOf(track)
  const plan: PlanLine[] = []
  const utterances: Utterance[] = []
  refs.forEach((ref, i) => {
    const entry = resolve({ track, level: 1, focusNode: ref.node })
    if (entry === null) return
    const block = copyBlock(entry, ns, ref.problem, `w${i + 1}`)
    if (block.plan.length === 0 || block.utterances.length === 0) return
    plan.push(...block.plan)
    utterances.push(...block.utterances)
  })
  if (plan.length === 0) return response
  const base = (response.plan ?? {}) as Record<string, unknown>
  const baseLines: unknown[] = Array.isArray(base.utterances)
    ? base.utterances
    : []
  return {
    ...response,
    plan: { ...base, utterances: [...baseLines, ...plan] },
    utterances: [...response.utterances, ...utterances],
  }
}
