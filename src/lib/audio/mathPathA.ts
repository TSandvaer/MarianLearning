/**
 * Math screen — Path A live audio wiring.
 *
 * Bridges `/api/claude` (kind=`session-start`, track-based payload) →
 * `sessionAudio.ts` → `Math.tsx`'s `playUtterance` prop. Keeps App.tsx
 * thin and gives this logic a unit-test seam.
 *
 * Flow (post-86c9jteud, track-based)
 * ----------------------------------
 * 1. App.tsx calls {@link prepareMathPathA} with the curriculum level,
 *    Marian's name, and a stable session id.
 * 2. We POST `{ kind: 'session-start', payload: { track: 'math', level,
 *    childName } }` to `/api/claude`. The server (api/claude.ts) routes
 *    the request to the Haiku planner (api/_planner.ts), generates an
 *    8-problem plan, renders TTS for every utterance, and returns
 *    `SessionStartResponse` carrying the rebuilt plan + inline base64
 *    MP3s.
 * 3. We rebuild a `MathSessionPlan` from the server's flat plan via
 *    {@link mathSessionPlanFromServer} (parses addends out of the `read`
 *    text), register Howls keyed by utterance id, and return the
 *    rehydrated plan + a text-keyed `playUtterance` ready to drop onto
 *    `<Math>`.
 * 4. On any failure path (network, abort, malformed response, planner-
 *    failed, rate-limited, tts-failed, config-missing), the wiring
 *    throws `PrepareMathPathAError`. App.tsx catches and falls back to
 *    a static plan + the silent-but-captioned default `playUtterance`
 *    — Marian sees text. No error chime, no retry nag.
 *
 * Why we no longer pre-pick a local plan
 * --------------------------------------
 * Before 86c9jteud the browser sent its locally-built `MathSessionPlan`
 * to the server, which only rendered TTS for its utterance texts. The
 * server is now the source of truth for problem selection — Haiku
 * picks the addends — so we ship `{track, level, childName}` and parse
 * the returned plan back into our nested shape. This is the actual
 * "Claude is the brain" contract from CLAUDE.md.
 *
 * Text-keyed lookup, duplicate-text howls
 * ---------------------------------------
 * Per spec (`design/screen-3-math.md` §"Audio integration contract"), the
 * server renders one MP3 per problem × slot — even when text is identical
 * (e.g. `Hmm... try again?` is rendered 8 times, once per problem, for
 * cache-locality). All 8 are byte-identical (deterministic TTS for same
 * input), so the lookup picks the first matching id and plays that howl
 * regardless of which problem the chip-tap came from. Acoustically
 * identical to picking the "right" one, ~7 unused howls in memory; the
 * trade-off is preserving Math.tsx's text-only contract without leaking
 * id awareness into the screen.
 *
 * Why not change Math.tsx to play by id
 * -------------------------------------
 * `Math.tsx` reads `problem.utterances.read` etc. as plain strings inside
 * the gesture-driven state machine. Re-keying every callsite by id would
 * be a much larger change than this adapter; the screen's contract is
 * "give me a function that takes text + emits onPlay/onWordTick/Promise".
 * The wiring layer here honours that contract.
 */

import {
  loadSessionAudio as defaultLoadSessionAudio,
  playSessionUtterance as defaultPlaySessionUtterance,
  unloadSessionAudio as defaultUnloadSessionAudio,
} from './sessionAudio'
import type { HowlLike, PlaySessionUtteranceOptions } from './sessionAudio'
import type {
  PlayMathUtteranceFn,
  PlayMathUtteranceOptions,
} from '../../screens/Math'
import {
  MathPlanFromServerError,
  mathSessionPlanFromServer,
  type MathSessionPlan,
} from '../../screens/Math'
import {
  isSessionStartResponse,
  type ClaudeRequest,
  type SessionStartResponse,
  type Utterance,
} from '../../../api/_types'
import type { LeitnerSessionHintItem, SlowFactHint } from '../progress'

/** The endpoint App.tsx POSTs to. Lifted to a constant so tests can stub
 *  fetch by URL match. */
export const CLAUDE_ENDPOINT = '/api/claude'

export interface PrepareMathPathAOptions {
  /** Test seam — replaces `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch
  /** Test seam — replaces `loadSessionAudio` from `./sessionAudio`. */
  loadSessionAudio?: (
    sessionId: string,
    utterances: Utterance[],
  ) => Promise<Map<string, HowlLike>>
  /** Test seam — replaces `playSessionUtterance` from `./sessionAudio`. */
  playSessionUtterance?: (
    utteranceId: string,
    opts?: PlaySessionUtteranceOptions,
  ) => Promise<void>
  /** Test seam — replaces `unloadSessionAudio` from `./sessionAudio`. */
  unloadSessionAudio?: () => void
  /** Optional AbortSignal — App.tsx can cancel the in-flight fetch when
   *  the user navigates away from Math before the request resolves. */
  signal?: AbortSignal
}

export interface PrepareMathPathAArgs {
  /** Curriculum level (1..9). Currently only level 1 is implemented; the
   *  field is forward-compatible per the planner contract. */
  level: number
  /** Child's display name — used by Haiku for the friendly opening line. */
  childName: string
  /** Stable id used to key the IndexedDB audio cache. App.tsx uses a
   *  per-app-mount id; tests can pin a string for determinism. */
  sessionId: string
  /**
   * M2 (ticket 86c9kmwba). Optional adaptive-engine hint computed from
   * `loadProgress()` via `pickFocusNode(progress, 'math')`. When present,
   * the server's planner generates problems for this skill node instead
   * of the level-1 default. Omitted on legacy / no-progress paths — the
   * server falls back to `add-to-10`.
   */
  focusNode?: string
  /**
   * M2 (ticket 86c9kmwba). Optional last-3 mean success rate, 0..1, or
   * `null` for "no recent data". Computed via
   * `pickRecentSuccessRate(progress, 'math')`.
   */
  recentSuccessRate?: number | null
  /**
   * M4 (ticket 86c9pwgc8). Optional Leitner hint — a flat list of
   * `{a, b, op, box}` for every fact in `progress.mathFactsLeitner`,
   * sorted box-ascending. The server's planner reads it from
   * `progress.leitner` and weights box-1 (least familiar) facts toward
   * problems 4-8 in the 8-problem session, leaving the gentle-ramp
   * problems 1-3 unaffected.
   *
   * Caller policy: omit (i.e. leave undefined) when the box is empty
   * so the canon-served free path stays active. Once the box has at
   * least one item, ship it — the server bypasses canon AND the in-
   * memory cache because canon is keyed without Leitner state and
   * serving a non-Leitner-aware plan would defeat the M4 contract.
   * Same posture as `isGraduationSession`. See `App.tsx`'s
   * `readProgressHintsForTrack` for the gate.
   */
  leitner?: LeitnerSessionHintItem[]
  /**
   * M4.x slow-fact directive (follow-up to 86c9pwgc8). Optional list
   * of "accurate but slow" facts — Marian gets these right reliably
   * but answers slowly (median latency ≥ threshold), the canary for
   * finger-counting dependency. The server's planner reads from
   * `progress.slowFacts` and dosed-back for automaticity-building
   * practice in the 8-problem session.
   *
   * Caller policy: omit (i.e. leave undefined) when no fact qualifies
   * (greenfield Marian, or every fact still under the latency floor).
   * Empty list is mapped to undefined upstream in
   * `readProgressHintsForTrack` so the canon-served free path stays
   * active. Same posture as `leitner` and `isGraduationSession`.
   */
  slowFacts?: SlowFactHint[]
  /**
   * Lifetime-first-encounter list (sub-to-10 content tier — Kyle §4.3,
   * 2026-05-15). Read from `Progress.lifetimeFirstEncounters`. Server
   * consults this via `applyFirstEncounterGate` to decide whether to
   * fire tier-specific scaffolding on `session.end.opener` for gated
   * math nodes (`'sub-to-10'` is on the gated list as infrastructure-
   * ready; the rewrite is a runtime no-op until session-end
   * append-on-math is wired — Wave 3.4 widened the schema to
   * `SkillNode[]`, the producer change is the remaining follow-up).
   * Always shipped (even when empty) for the math track when progress
   * exists; `[]` is meaningful (greenfield Marian).
   */
  lifetimeFirstEncounters?: readonly string[]
}

export interface PreparedMathPathA {
  /** The session plan rehydrated from the server's response. App.tsx
   *  passes this to `<Math plan={...} />` so the addends/visuals match
   *  the audio Marian hears. */
  plan: MathSessionPlan
  /** Stable function ref — pass to `<Math playUtterance>`. */
  playUtterance: PlayMathUtteranceFn
  /** Map of all utterance texts to their resolved howl ids — useful for
   *  debugging and tests. */
  textToId: ReadonlyMap<string, string>
  /** Number of utterances loaded. */
  utteranceCount: number
  /** Tear down all loaded Howls. App.tsx calls this when leaving Math. */
  unload: () => void
}

/**
 * One-line distinct error code surface so callers can branch (and so the
 * QA log can attribute fallbacks to a cause). All paths land us in the
 * silent-default fallback today; the codes are diagnostic, not control-flow.
 *
 * The `rate-limited` and `planner-failed` codes were added with the
 * track-based switchover (ticket 86c9jteud, subsumed 86c9jrwqd). They
 * were already on the wire from PR #105 but the browser previously
 * couldn't trigger them because it was sending plan-attached payloads
 * (which bypass both the rate limiter and the planner).
 */
export type PrepareMathPathAErrorCode =
  | 'config-missing'
  | 'tts-failed'
  | 'rate-limited'
  | 'planner-failed'
  | 'invalid-response'
  | 'network-error'
  | 'aborted'

export class PrepareMathPathAError extends Error {
  readonly code: PrepareMathPathAErrorCode
  constructor(code: PrepareMathPathAErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'PrepareMathPathAError'
  }
}

/**
 * Fetch the session audio for a Math session, register howls, and return
 * a `{ plan, playUtterance, ... }` ready to drop onto `<Math>`.
 *
 * Throws `PrepareMathPathAError` on any failure path. App.tsx catches and
 * falls back to a static plan + silent default by omitting the
 * `playUtterance` prop.
 */
export async function prepareMathPathA(
  args: PrepareMathPathAArgs,
  opts: PrepareMathPathAOptions = {},
): Promise<PreparedMathPathA> {
  const fetchImpl = opts.fetch ?? globalThis.fetch
  const loadAudio = opts.loadSessionAudio ?? defaultLoadSessionAudio
  const playSession = opts.playSessionUtterance ?? defaultPlaySessionUtterance
  const unloadAudio = opts.unloadSessionAudio ?? defaultUnloadSessionAudio

  // Track-based payload (ticket 86c9jteud). The server's _planner.ts
  // generates the plan via Haiku; api/claude.ts feeds the plan into the
  // same TTS pipeline the legacy plan-attached path uses.
  //
  // M2 (ticket 86c9kmwba): optionally include `progress.focusNode` and
  // `progress.recentSuccessRate`. The server's planner uses focusNode
  // to pick the curriculum slice (e.g. add-to-10 vs add-to-20) and
  // includes recentSuccessRate as a soft hint to tune easier/harder
  // mix. Both are computed by App.tsx from `loadProgress()` before
  // calling this function — keeping the storage read out of this
  // module preserves the unit-test seam (tests inject the values
  // directly without needing to set up localStorage).
  // M4 (ticket 86c9pwgc8): forward `leitner` when the caller supplied a
  // non-empty array. Empty / absent leaves the canon-served free path
  // active — same posture as graduation-session.
  // M4.x slow-fact directive (follow-up to 86c9pwgc8): same posture for
  // `slowFacts` — only ship when the upstream caller supplied a non-
  // empty list.
  const hasLeitner = args.leitner !== undefined && args.leitner.length > 0
  const hasSlowFacts = args.slowFacts !== undefined && args.slowFacts.length > 0
  // sub-to-10 content tier (Kyle §4.3, 2026-05-15): ship the lifetime-
  // first-encounter list for math too. Empty array is meaningful
  // (greenfield Marian); undefined means the caller had no progress at
  // all (legacy / first-launch path).
  const hasLifetimeFirstEncounters = args.lifetimeFirstEncounters !== undefined
  const progressBlock =
    args.focusNode !== undefined ||
    args.recentSuccessRate !== undefined ||
    hasLeitner ||
    hasSlowFacts ||
    hasLifetimeFirstEncounters
      ? {
          progress: {
            ...(args.focusNode !== undefined
              ? { focusNode: args.focusNode }
              : {}),
            ...(args.recentSuccessRate !== undefined
              ? { recentSuccessRate: args.recentSuccessRate }
              : {}),
            ...(hasLeitner ? { leitner: args.leitner } : {}),
            ...(hasSlowFacts ? { slowFacts: args.slowFacts } : {}),
            ...(hasLifetimeFirstEncounters
              ? { lifetimeFirstEncounters: [...args.lifetimeFirstEncounters!] }
              : {}),
          },
        }
      : {}

  const body: ClaudeRequest = {
    kind: 'session-start',
    payload: {
      track: 'math',
      level: args.level,
      childName: args.childName,
      ...progressBlock,
    },
  }

  let response: Response
  try {
    response = await fetchImpl(CLAUDE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts.signal,
    })
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === 'AbortError' || err.name === 'TimeoutError')
    ) {
      throw new PrepareMathPathAError('aborted', 'Path A fetch aborted')
    }
    throw new PrepareMathPathAError(
      'network-error',
      `Path A fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch (err) {
    throw new PrepareMathPathAError(
      'invalid-response',
      `Path A response was not JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!response.ok) {
    // The server's error envelope is `{ error: code, message? }` — look for
    // known codes for clearer attribution.
    const obj = parsed as { error?: unknown } | null
    const errCode = typeof obj?.error === 'string' ? obj.error : ''
    if (errCode === 'config-missing') {
      throw new PrepareMathPathAError(
        'config-missing',
        'ANTHROPIC_API_KEY missing on the server',
      )
    }
    if (errCode === 'tts-failed') {
      throw new PrepareMathPathAError(
        'tts-failed',
        'Server TTS pipeline failed',
      )
    }
    if (errCode === 'rate-limited') {
      throw new PrepareMathPathAError(
        'rate-limited',
        'Server rate-limited the session-start request',
      )
    }
    if (errCode === 'planner-failed') {
      throw new PrepareMathPathAError(
        'planner-failed',
        'Server-side Haiku planner failed to produce a valid plan',
      )
    }
    throw new PrepareMathPathAError(
      'invalid-response',
      `Path A returned ${response.status}`,
    )
  }

  if (!isSessionStartResponse(parsed)) {
    throw new PrepareMathPathAError(
      'invalid-response',
      'Path A response did not match SessionStartResponse',
    )
  }

  const sessionResponse: SessionStartResponse = parsed

  // Rehydrate the nested MathSessionPlan from the server's flat plan blob.
  // If the model drifted off the prompt template (read line, slot ids, problem
  // count), this throws — and we surface as 'invalid-response' so the
  // caller's silent-fallback path fires cleanly. The structural failure is
  // not "the planner errored on the server" (that would be 502
  // planner-failed); it's "the server returned a plan that we can't
  // make sense of locally", which is closer to malformed wire data.
  let plan: MathSessionPlan
  try {
    plan = mathSessionPlanFromServer(sessionResponse.plan)
  } catch (err) {
    if (err instanceof MathPlanFromServerError) {
      throw new PrepareMathPathAError(
        'invalid-response',
        `Path A plan rehydration failed: ${err.message}`,
      )
    }
    throw err
  }

  // Register howls keyed by utterance id.
  await loadAudio(args.sessionId, sessionResponse.utterances)

  // Build a text → first-matching-id lookup. See file header for the
  // duplicate-text discussion.
  const textToId = new Map<string, string>()
  for (const u of sessionResponse.utterances) {
    if (!textToId.has(u.text)) textToId.set(u.text, u.id)
  }

  const playUtterance: PlayMathUtteranceFn = async (
    text: string,
    playOpts?: PlayMathUtteranceOptions,
  ): Promise<void> => {
    const id = textToId.get(text)
    if (!id) {
      // Text we never rendered. Should not happen if the plan/wire stay
      // in sync, but fail soft — fire onPlay/onWordTick so the caption
      // ribbon still ticks, then resolve silently. Better than throwing
      // mid-gesture.
      playOpts?.onPlay?.()
      const words = text.split(/\s+/).filter(Boolean)
      for (let i = 0; i < words.length; i++) playOpts?.onWordTick?.(i)
      return
    }
    return playSession(id, {
      onPlay: playOpts?.onPlay,
      onWordTick: playOpts?.onWordTick,
    })
  }
  // Diagnostic tag (ticket 86c9hjnn8 follow-up). Lets Math.tsx tell apart
  // "real Path A player wired" from "silent fallback" without === ref
  // comparison against the default — the `===` approach is brittle when
  // React re-creates closures for memoization. The tag is read by
  // `getPlayerKind()` in `lib/debug/playerKind.ts`.
  ;(
    playUtterance as PlayMathUtteranceFn & { __playerKind?: 'real' }
  ).__playerKind = 'real'

  return {
    plan,
    playUtterance,
    textToId,
    utteranceCount: sessionResponse.utterances.length,
    unload: () => unloadAudio(),
  }
}
