/**
 * The session-start answers `/api/claude` gives from canon, built on the
 * device (no-Claude plan phase 2, `design/native/no-claude-sizing.md` § 2
 * and § 4): a step's canon session, a review, a Map peek or replay, a
 * times mix and a warm-up, with the first-encounter opener rewrite and
 * the step's `session.end.*` lines.
 *
 * In: the `session-start` payload the app posts, and the canon's text
 * (`resolve`: a step's canon file, its plan and its lines without audio).
 * Out, one of:
 * - `local`: what the server answers, without audio: `plan` and the
 *   spoken lines (`{ id, text }`) in the server's order. The caller plays
 *   each line's bundled clip (phase 1). A letter-sounds vowel map past
 *   greenfield, which the server sends to the planner, is built here too
 *   (phase 4, `./letterSoundsSession.ts`), with the server's
 *   `currentTargetVowel`.
 * - `server`: the server would not answer from canon. A hint the planner
 *   uses (the add-to-10 Leitner box, a slow fact on add-to-10 or
 *   sub-to-10, a graduation flag), a step without a canon file, or a
 *   payload without a track. Phase 3 moves the math hints onto the device.
 * - `invalid`: the server would answer 400 (a review, peek, replay or mix
 *   it cannot serve, or a client-built plan).
 *
 * The server is the reference. `api/` imports nothing from core, so this
 * is a port of its canon branches (`api/claude.ts` `handler`,
 * `api/_review.ts`, `api/_firstEncounterGate.ts`, `api/_canon.ts`
 * `canonFileTierFor`), and `tests/noClaude/localSessionParity.test.ts`
 * runs the real handler on the canon to require the same plan and lines
 * for every kind and step.
 *
 * Pure: no I/O, no clock.
 */
import { LITERACY_TREE, MATH_TREE } from '../progress/mastery'
import { leitnerFactAllowedForFocus } from '../wire/leitnerFocus'
import {
  LETTER_SOUNDS_VOWEL_LADDER,
  deriveCurrentTargetVowel,
  type LetterSoundsVowelSlash,
  type VowelSubMasteryState,
} from '../wire/letterSoundsVowel'
import {
  MIX_BLOCK_COUNT,
  MIX_PLAN_ID_PREFIX,
  MIX_SOURCE_STEPS,
  PEEK_BLOCK_COUNT,
  PEEK_PLAN_ID_PREFIX,
  REPLAY_BLOCK_COUNT,
  REPLAY_PLAN_ID_PREFIX,
  REVIEW_BLOCK_COUNT,
  REVIEW_PLAN_ID_PREFIX,
  WARMUP_BLOCK_MAX,
  type CanonBlockRef,
} from '../wire/types'
import { composeLetterSoundsSession } from './letterSoundsSession'

export type SessionTrack = 'math' | 'word-song'

/** A plan line or a spoken line, without audio. */
export interface CanonLine {
  id: string
  text: string
}

/**
 * One canon file's text: `plan` as the file holds it (`{ id, label,
 * utterances }`) and its spoken lines. The two line lists are not always
 * equal (cvc-words-short-u's `session.end.recap.focus`), so both travel.
 */
export interface CanonText {
  plan: unknown
  utterances: readonly CanonLine[]
}

/** A canon lookup, the server's `getCanonEntry` key. */
export interface CanonKey {
  track: SessionTrack
  level: number
  focusNode: string
}

export type CanonTextResolver = (key: CanonKey) => CanonText | null

/** The server's response without audio. */
export interface LocalSession {
  plan: unknown
  utterances: CanonLine[]
}

/** Which server branch the session copies (`vowel`: the planner's). */
export type LocalSessionKind =
  | 'canon'
  | 'review'
  | 'peek'
  | 'replay'
  | 'mix'
  | 'vowel'

export type ComposedSession =
  | {
      kind: 'local'
      served: LocalSessionKind
      session: LocalSession
      /** The letter-sounds vowel the server stamps (`SessionStartResponse`
       *  `currentTargetVowel`); absent wherever the server omits it. */
      currentTargetVowel?: LetterSoundsVowelSlash
    }
  | { kind: 'server'; reason: string }
  | { kind: 'invalid'; message: string }

/**
 * The canon file tier of a step (`api/_canon.ts` `canonFileTierFor`): the
 * no-regroup two-digit step kept the old file name.
 */
export function canonFileTierFor(focusNode: string): string {
  if (focusNode === 'two-digit-addsub-no-regroup') return 'two-digit-addsub'
  return focusNode
}

/** A canon file's path under `public/canon/`, without `.json`. */
export function canonTextKey(key: CanonKey): string {
  return `${key.track}/level-${key.level}/${canonFileTierFor(key.focusNode)}`
}

// --- The payload, as the server reads it (`extractTrackPayload`) ---------

/** The fields that decide how the server answers. */
interface TrackPayload {
  track: SessionTrack
  level: number
  focusNode?: string
  isGraduationSession?: boolean
  lifetimeFirstEncounters?: readonly string[]
  leitner?: readonly { op: string }[]
  slowFacts?: readonly unknown[]
  letterSoundsVowelStates?: Readonly<
    Record<LetterSoundsVowelSlash, VowelSubMasteryState>
  >
}

const TRACKS: readonly SessionTrack[] = ['math', 'word-song']
const OPS: ReadonlySet<string> = new Set(['+', '-', '*'])
const LEITNER_MAX_ITEMS = 60
const SLOW_FACT_MAX_ITEMS = 16
const VOWEL_STATES: ReadonlySet<string> = new Set([
  'intro',
  'practicing',
  'mastered',
])

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const isFact = (r: Record<string, unknown>) =>
  isInt(r.a, 0, 99) &&
  isInt(r.b, 0, 99) &&
  typeof r.op === 'string' &&
  OPS.has(r.op)

/** `api/claude.ts` `parseLeitnerHint`: every item valid, else none. */
function parseLeitner(raw: unknown[]): { op: string }[] | null {
  if (raw.length > LEITNER_MAX_ITEMS) return null
  const out: { op: string }[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null
    const r = item as Record<string, unknown>
    if (!isFact(r) || !isInt(r.box, 1, 5)) return null
    out.push({ op: r.op as string })
  }
  return out
}

/** `api/claude.ts` `parseSlowFactHint`: every item valid, else none. */
function parseSlowFacts(raw: unknown[]): unknown[] | null {
  if (raw.length > SLOW_FACT_MAX_ITEMS) return null
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null
    const r = item as Record<string, unknown>
    if (typeof r.fact !== 'object' || r.fact === null) return null
    if (
      !isFact(r.fact as Record<string, unknown>) ||
      !isInt(r.attempts, 1, 1000) ||
      !isNum(r.correctRate, 0, 1) ||
      !isNum(r.medianLatencyMs, 0, 600_000)
    ) {
      return null
    }
  }
  return raw
}

/** `api/_planner.ts` `parseLetterSoundsVowelStates`: all four vowels. */
function parseVowelStates(
  raw: unknown,
): Record<LetterSoundsVowelSlash, VowelSubMasteryState> | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const out = {} as Record<LetterSoundsVowelSlash, VowelSubMasteryState>
  for (const vowel of LETTER_SOUNDS_VOWEL_LADDER) {
    const state = r[vowel]
    if (typeof state !== 'string' || !VOWEL_STATES.has(state)) return null
    out[vowel] = state as VowelSubMasteryState
  }
  return out
}

function readTrackPayload(payload: unknown): TrackPayload | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>
  if (typeof p.track !== 'string' || !TRACKS.includes(p.track as SessionTrack))
    return null
  if (!isInt(p.level, 1, 9)) return null
  if (
    typeof p.childName !== 'string' ||
    p.childName.length === 0 ||
    p.childName.length > 64
  )
    return null
  const out: TrackPayload = { track: p.track as SessionTrack, level: p.level }
  const pr = p.progress
  if (pr === undefined || pr === null || typeof pr !== 'object') return out
  const r = pr as Record<string, unknown>
  if (
    typeof r.focusNode === 'string' &&
    r.focusNode.length > 0 &&
    r.focusNode.length <= 64
  ) {
    out.focusNode = r.focusNode
  }
  if (typeof r.isGraduationSession === 'boolean') {
    out.isGraduationSession = r.isGraduationSession
  }
  if (
    Array.isArray(r.lifetimeFirstEncounters) &&
    r.lifetimeFirstEncounters.every(
      (n) => typeof n === 'string' && n.length > 0 && n.length <= 64,
    )
  ) {
    out.lifetimeFirstEncounters = r.lifetimeFirstEncounters as string[]
  }
  if (Array.isArray(r.leitner)) {
    const leitner = parseLeitner(r.leitner)
    if (leitner !== null && leitner.length > 0) out.leitner = leitner
  }
  if (Array.isArray(r.slowFacts)) {
    const slowFacts = parseSlowFacts(r.slowFacts)
    if (slowFacts !== null && slowFacts.length > 0) out.slowFacts = slowFacts
  }
  if (r.letterSoundsVowelStates !== undefined) {
    const states = parseVowelStates(r.letterSoundsVowelStates)
    if (states !== null) out.letterSoundsVowelStates = states
  }
  return out
}

/** The server's default step when the payload names none. */
function defaultFocusNode(track: SessionTrack): string {
  return track === 'math' ? 'add-to-10' : 'blending-cv'
}

/**
 * Why the server would run the live planner for this forward request
 * instead of its canon (`bypassCanonAndCache`), or `null`. The predicates
 * are `api/_planner.ts` `isLeitnerDirectiveActive` and
 * `isSlowFactDirectiveActive`; the Leitner box is narrowed to its focus
 * first (`withLeitnerForFocus`). The vowel map is `vowelMapTarget`'s.
 */
function plannerHint(p: TrackPayload, focus: string): string | null {
  if (p.isGraduationSession === true) return 'graduation flag'
  const leitner = (p.leitner ?? []).filter((f) =>
    leitnerFactAllowedForFocus(f.op, focus),
  )
  if (p.track === 'math' && focus === 'add-to-10' && leitner.length > 0) {
    return 'Leitner hint'
  }
  if (
    p.track === 'math' &&
    (focus === 'add-to-10' || focus === 'sub-to-10') &&
    (p.slowFacts?.length ?? 0) > 0
  ) {
    return 'slow-fact hint'
  }
  return null
}

/**
 * A letter-sounds request whose vowel map is past greenfield: the vowel
 * the server asks the planner for (`api/claude.ts`, `api/_planner.ts`
 * `letterSoundsStatesAreNonFallback`), as `{ vowel }`. `vowel: null`: the
 * derivation names none (a mastered tier, or the /e/ guard with nothing
 * mastered), so the planner uses its default /o/ and nothing is stamped.
 * `null`: no such map (all-intro derives the canon's own /o/, so canon
 * serves it).
 */
function vowelMapTarget(
  p: TrackPayload,
  focus: string,
): { vowel: LetterSoundsVowelSlash | null } | null {
  const states = p.letterSoundsVowelStates
  if (p.track !== 'word-song' || focus !== 'letter-sounds') return null
  if (states === undefined) return null
  if (LETTER_SOUNDS_VOWEL_LADDER.every((v) => states[v] === 'intro')) {
    return null
  }
  return { vowel: deriveCurrentTargetVowel(states) }
}

/**
 * The payload's `seed` (the session count at kick time, as the review
 * picker's): it varies a vowel session's letters. The server ignores it.
 */
function seedOf(payload: unknown): number {
  const seed = (payload as Record<string, unknown>).seed
  return isInt(seed, 0, Number.MAX_SAFE_INTEGER) ? seed : 0
}

// --- Canon blocks (`api/_review.ts`) -------------------------------------

/** Utterance id namespace per track (`math.p1.read`, `word.p1.read`). */
function namespaceOf(track: SessionTrack): 'math' | 'word' {
  return track === 'math' ? 'math' : 'word'
}

function stepsOf(track: SessionTrack): readonly string[] {
  return track === 'math' ? MATH_TREE : LITERACY_TREE
}

function hasField(payload: unknown, field: string): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as Record<string, unknown>)[field] !== undefined
  )
}

/** `{ blocks }` with `min..max` refs, each a step of `track`, problem 1..8. */
function parseBlocks(
  raw: unknown,
  track: SessionTrack,
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
    if (!isInt(problem, 1, 8)) return null
    out.push({ node, problem })
  }
  return out
}

function planLinesOf(entry: { plan: unknown }): CanonLine[] {
  const plan = entry.plan as { utterances?: unknown } | null
  const lines = Array.isArray(plan?.utterances) ? plan.utterances : []
  return lines.filter(
    (u): u is CanonLine =>
      typeof u === 'object' &&
      u !== null &&
      typeof (u as CanonLine).id === 'string' &&
      typeof (u as CanonLine).text === 'string',
  )
}

type Lines = { plan: CanonLine[]; utterances: CanonLine[] }

/** One canon block's lines, renamed from `<ns>.p<problem>.` to `<ns>.<to>.`. */
function copyBlock(
  entry: CanonText,
  ns: 'math' | 'word',
  problem: number,
  to: string,
): Lines {
  const from = `${ns}.p${problem}.`
  const rename = (id: string) => `${ns}.${to}.${id.slice(from.length)}`
  const copy = (lines: readonly CanonLine[]) =>
    lines
      .filter((u) => u.id.startsWith(from))
      .map((u) => ({ id: rename(u.id), text: u.text }))
  return { plan: copy(planLinesOf(entry)), utterances: copy(entry.utterances) }
}

/** `refs`' blocks renamed `<ns>.p1..pN.`, or `null` if one can't be served. */
function copyRefs(
  refs: readonly CanonBlockRef[],
  track: SessionTrack,
  resolve: CanonTextResolver,
): Lines | null {
  const ns = namespaceOf(track)
  const out: Lines = { plan: [], utterances: [] }
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i]!
    const entry = resolve({ track, level: 1, focusNode: ref.node })
    if (entry === null) return null
    const block = copyBlock(entry, ns, ref.problem, `p${i + 1}`)
    if (block.plan.length === 0 || block.utterances.length === 0) return null
    out.plan.push(...block.plan)
    out.utterances.push(...block.utterances)
  }
  return out
}

function blockSession(id: string, label: string, lines: Lines): LocalSession {
  return {
    plan: { id, label, utterances: lines.plan },
    utterances: lines.utterances,
  }
}

/** A review (8 refs) or a peek (3 refs of one step). */
function buildBlockSession(
  field: 'review' | 'peek',
  payload: unknown,
  track: SessionTrack,
  resolve: CanonTextResolver,
): LocalSession | null {
  const review = field === 'review'
  const count = review ? REVIEW_BLOCK_COUNT : PEEK_BLOCK_COUNT
  const raw = (payload as Record<string, unknown>)[field]
  const refs = parseBlocks(raw, track, count, count)
  if (refs === null) return null
  if (!review && refs.some((r) => r.node !== refs[0]!.node)) return null
  const lines = copyRefs(refs, track, resolve)
  if (lines === null) return null
  return review
    ? blockSession(`${REVIEW_PLAN_ID_PREFIX}${track}`, 'Review', lines)
    : blockSession(`${PEEK_PLAN_ID_PREFIX}${track}`, 'Peek', lines)
}

/** A Map replay: the step's canon problems 1–8, in canon order. */
function buildReplay(
  payload: unknown,
  track: SessionTrack,
  resolve: CanonTextResolver,
): LocalSession | null {
  const raw = (payload as Record<string, unknown>).replay
  if (typeof raw !== 'object' || raw === null) return null
  const node = (raw as Record<string, unknown>).node
  if (typeof node !== 'string' || !stepsOf(track).includes(node)) return null
  const refs = Array.from({ length: REPLAY_BLOCK_COUNT }, (_, i) => ({
    node,
    problem: i + 1,
  }))
  const lines = copyRefs(refs, track, resolve)
  return lines === null
    ? null
    : blockSession(`${REPLAY_PLAN_ID_PREFIX}${track}`, 'Replay', lines)
}

/** The step whose `session.end.*` lines a times mix carries. */
const MIX_STEP = 'mult-mix'

/** A times mix: core's 8 blocks plus mult-mix's `session.end.*` lines. */
function buildMix(
  payload: unknown,
  track: SessionTrack,
  resolve: CanonTextResolver,
): LocalSession | null {
  if (track !== 'math') return null
  const raw = (payload as Record<string, unknown>).mix
  const refs = parseBlocks(raw, track, MIX_BLOCK_COUNT, MIX_BLOCK_COUNT)
  if (refs === null) return null
  if (refs.some((r) => !MIX_SOURCE_STEPS.includes(r.node))) return null
  const lines = copyRefs(refs, track, resolve)
  const own = resolve({ track, level: 1, focusNode: MIX_STEP })
  if (lines === null || own === null) return null
  const isEnd = (u: CanonLine) => u.id.startsWith('session.end.')
  return blockSession(`${MIX_PLAN_ID_PREFIX}${track}`, 'Times mix', {
    plan: [...lines.plan, ...planLinesOf(own).filter(isEnd)],
    utterances: [...lines.utterances, ...own.utterances.filter(isEnd)],
  })
}

/**
 * `session` with `payload.warmup`'s blocks appended as `<ns>.w<i>.<slot>`
 * (i = the ref's 1-based position; a ref that can't be served leaves its
 * number unused). A malformed `warmup` is ignored.
 */
function withWarmupBlocks(
  session: LocalSession,
  payload: unknown,
  track: SessionTrack,
  resolve: CanonTextResolver,
): LocalSession {
  const raw = (payload as Record<string, unknown>).warmup
  if (raw === undefined) return session
  const refs = parseBlocks(raw, track, 1, WARMUP_BLOCK_MAX)
  if (refs === null) return session
  const ns = namespaceOf(track)
  const added: Lines = { plan: [], utterances: [] }
  refs.forEach((ref, i) => {
    const entry = resolve({ track, level: 1, focusNode: ref.node })
    if (entry === null) return
    const block = copyBlock(entry, ns, ref.problem, `w${i + 1}`)
    if (block.plan.length === 0 || block.utterances.length === 0) return
    added.plan.push(...block.plan)
    added.utterances.push(...block.utterances)
  })
  if (added.plan.length === 0) return session
  const base = (session.plan ?? {}) as Record<string, unknown>
  const baseLines: unknown[] = Array.isArray(base.utterances)
    ? base.utterances
    : []
  return {
    plan: { ...base, utterances: [...baseLines, ...added.plan] },
    utterances: [...session.utterances, ...added.utterances],
  }
}

// --- First-encounter opener (`api/_firstEncounterGate.ts`) ---------------

/** Steps whose canon may carry a first-encounter `session.end.opener`. */
const FIRST_ENCOUNTER_GATED_NODES: ReadonlySet<string> = new Set([
  'cvc-words-short-o',
  'sub-to-10',
])

/** The vanilla "You did it!" opener's source: the short-a canon. */
const VANILLA_OPENER_SOURCE: CanonKey = {
  track: 'word-song',
  level: 1,
  focusNode: 'cvc-words',
}

const OPENER_ID = 'session.end.opener'

/**
 * A gated step the learner has met gets the vanilla opener line, text and
 * audio from the short-a canon. Only the spoken lines change, as on the
 * server; the plan keeps its own opener.
 */
function applyFirstEncounterGate(
  session: LocalSession,
  focus: string,
  met: readonly string[] | undefined,
  resolve: CanonTextResolver,
): LocalSession {
  if (!FIRST_ENCOUNTER_GATED_NODES.has(focus)) return session
  if (met === undefined || !met.includes(focus)) return session
  const vanilla = resolve(VANILLA_OPENER_SOURCE)?.utterances.find(
    (u) => u.id === OPENER_ID,
  )
  if (vanilla === undefined) return session
  if (!session.utterances.some((u) => u.id === OPENER_ID)) return session
  return {
    ...session,
    utterances: session.utterances.map((u) =>
      u.id === OPENER_ID ? { id: OPENER_ID, text: vanilla.text } : u,
    ),
  }
}

// --- The handler's session-start branches ----------------------------------

const local = (
  served: LocalSessionKind,
  session: LocalSession,
): ComposedSession => ({ kind: 'local', served, session })

/** A canon entry as a session (a fresh copy: callers may not mutate canon). */
function sessionOf(entry: CanonText): LocalSession {
  return {
    plan: entry.plan,
    utterances: entry.utterances.map((u) => ({ id: u.id, text: u.text })),
  }
}

/**
 * The session `/api/claude` would answer `payload` with from canon, or
 * why it would not (see the header). The payload is read as the server
 * receives it, after a JSON round trip. Same branch order as the handler:
 * a client plan, the track payload, review, peek, replay, mix, the
 * planner hints, the canon hit with its first-encounter gate, and the
 * warm-up blocks on a mix or a canon hit. The vowel map, the one planner
 * hint built here, comes after the others, as `bypassCanonAndCache` ORs
 * them: any other hint still goes to the server.
 */
export function composeSession(
  sent: unknown,
  resolve: CanonTextResolver,
): ComposedSession {
  if (sent === undefined) return { kind: 'server', reason: 'no payload' }
  const payload: unknown = JSON.parse(JSON.stringify(sent))
  // `extractPlan`: any `plan` but null is rejected.
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'plan' in payload &&
    (payload as Record<string, unknown>).plan !== null
  ) {
    return { kind: 'invalid', message: 'a client-built plan' }
  }
  const p = readTrackPayload(payload)
  if (p === null) return { kind: 'server', reason: 'no track payload' }
  const { track } = p
  if (hasField(payload, 'review')) {
    const review = buildBlockSession('review', payload, track, resolve)
    return review === null
      ? { kind: 'invalid', message: 'review must name 8 canon blocks' }
      : local('review', review)
  }
  if (hasField(payload, 'peek')) {
    const peek = buildBlockSession('peek', payload, track, resolve)
    return peek === null
      ? { kind: 'invalid', message: 'peek must name 3 blocks of one step' }
      : local('peek', peek)
  }
  if (hasField(payload, 'replay')) {
    const replay = buildReplay(payload, track, resolve)
    return replay === null
      ? { kind: 'invalid', message: 'replay must name one step' }
      : local('replay', replay)
  }
  if (hasField(payload, 'mix')) {
    const mix = buildMix(payload, track, resolve)
    return mix === null
      ? { kind: 'invalid', message: 'mix must name 8 times-mix blocks' }
      : local('mix', withWarmupBlocks(mix, payload, track, resolve))
  }
  const focus = p.focusNode ?? defaultFocusNode(track)
  const hint = plannerHint(p, focus)
  if (hint !== null) return { kind: 'server', reason: hint }
  const target = vowelMapTarget(p, focus)
  if (target !== null) {
    const built = composeLetterSoundsSession(
      target.vowel ?? '/o/',
      seedOf(payload),
      resolve,
      p.level,
    )
    if (built === null) {
      return { kind: 'server', reason: 'no letter-sounds canon' }
    }
    const gated = applyFirstEncounterGate(
      built,
      focus,
      p.lifetimeFirstEncounters,
      resolve,
    )
    return {
      ...local('vowel', withWarmupBlocks(gated, payload, track, resolve)),
      ...(target.vowel !== null ? { currentTargetVowel: target.vowel } : {}),
    }
  }
  const entry = resolve({ track, level: p.level, focusNode: focus })
  if (entry === null) return { kind: 'server', reason: `no canon for ${focus}` }
  const gated = applyFirstEncounterGate(
    sessionOf(entry),
    focus,
    p.lifetimeFirstEncounters,
    resolve,
  )
  return local('canon', withWarmupBlocks(gated, payload, track, resolve))
}
