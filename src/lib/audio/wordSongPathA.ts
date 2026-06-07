/**
 * Word Song screen — Path A live audio wiring.
 *
 * Sibling of `mathPathA.ts`. Bridges `/api/claude` (kind=`session-start`,
 * track-based payload) → `sessionAudio.ts` → `WordSong.tsx`'s
 * `playUtterance` prop. Keeps App.tsx thin and gives this logic a
 * unit-test seam.
 *
 * Same shape, different content
 * -----------------------------
 * The flow is a near-clone of `prepareMathPathA`: send track-based
 * payload, parse the server's plan via `wordSongSessionPlanFromServer`,
 * register Howls keyed by utterance id, return a text-keyed
 * `playUtterance`. The duplication (~50 lines vs Math's mathPathA.ts) is
 * intentional — the modules don't share state, the contract is
 * per-screen, and a shared abstraction here would have to thread a
 * generic plan/wire-shape through every call site. The screens don't
 * share an audio bundle session-side either (Math + Word Song each
 * fetch their own), so the duplication matches the actual independence.
 *
 * If a future screen (Session-end? Greet? a 4th literacy surface?) wants
 * the same shape, that's the moment to refactor to a generic
 * `prepareSessionPathA<TPlan>` — not now.
 *
 * Text-keyed lookup, duplicate-text howls
 * ---------------------------------------
 * Per spec (`design/screen-4-word-song.md` §"Audio integration contract"),
 * the server renders one MP3 per problem × slot — even when text is
 * identical (e.g. `Hmm... try again?` is the reprompt for all 8
 * problems). All 8 are byte-identical (deterministic TTS for same
 * input), so the lookup picks the first matching id and plays that.
 */

import {
  loadSessionAudio as defaultLoadSessionAudio,
  playSessionUtterance as defaultPlaySessionUtterance,
  unloadSessionAudio as defaultUnloadSessionAudio,
} from './sessionAudio'
import type { HowlLike, PlaySessionUtteranceOptions } from './sessionAudio'
import type {
  PlayWordSongUtteranceFn,
  PlayWordSongUtteranceOptions,
} from '../../screens/WordSong'
import {
  WordSongPlanFromServerError,
  wordSongSessionPlanFromServer,
  type WordSongSessionPlan,
} from '../../screens/WordSong'
import {
  isSessionStartResponse,
  type ClaudeRequest,
  type SessionStartResponse,
  type Utterance,
} from '../../../api/_types'

/** The endpoint App.tsx POSTs to. Same as Math's. */
export const CLAUDE_ENDPOINT = '/api/claude'

export interface PrepareWordSongPathAOptions {
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
  /** Optional AbortSignal. */
  signal?: AbortSignal
}

export interface PrepareWordSongPathAArgs {
  /** Curriculum level (1..9). Currently only level 1 is implemented. */
  level: number
  /** Child's display name — used by Haiku for the friendly opening line. */
  childName: string
  /** Stable id used to key the IndexedDB audio cache. */
  sessionId: string
  /**
   * M2 (ticket 86c9kmwba). Optional adaptive-engine hint computed from
   * `loadProgress()` via `pickFocusNode(progress, 'word-song')`.
   * Omitted on legacy / no-progress paths — server falls back to
   * `cvc-words`.
   */
  focusNode?: string
  /**
   * M2 (ticket 86c9kmwba). Optional last-3 mean success rate, 0..1, or
   * `null` for "no recent data". Computed via
   * `pickRecentSuccessRate(progress, 'word-song')`.
   */
  recentSuccessRate?: number | null
  /**
   * Graduation-session hint (ticket 86c9m3aec). Computed by the
   * caller via `isGraduationSessionPending(progress, focusNode,
   * 'word-song')` at session-start fetch time. When `true` AND the
   * server-side effective focus node is `cvc-words`, the planner
   * mixes 2–3 novel short-a probe words into the 8-problem set
   * for a generalization probe. Defaults to `false` when omitted.
   */
  isGraduationSession?: boolean
  /**
   * Lifetime-first-encounter list (ticket 86c9q9ben — AC9f). Read
   * from `Progress.lifetimeFirstEncounters` for the word-song track.
   * Server consults this to decide whether to fire tier-specific
   * first-encounter scaffolding on `session.end.opener`:
   *   - focus node ∉ list → first encounter; canon's contrast/scaffolding
   *     line is delivered as-is.
   *   - focus node ∈ list → already encountered; server rewrites the
   *     opener to vanilla "You did it!" using a sibling canon's
   *     vanilla audio.
   * Always shipped (even when empty) for the word-song track when
   * progress exists; `[]` is meaningful (greenfield Marian).
   */
  lifetimeFirstEncounters?: readonly string[]
  /**
   * Per-vowel letter-sounds sub-mastery map (Wave 9 W9.4 — ticket
   * 86c9ya3r9). Read from `Progress.literacy.letterSoundsVowelStates`
   * by the caller, shipped ONLY when the picked focus node is
   * `letter-sounds`. Keys are IPA-slash notation (`'/o/'`, `'/u/'`,
   * `'/i/'`, `'/e/'`); values are `'intro' | 'practicing' | 'mastered'`.
   * The server derives the current-target vowel via the §1.4 algorithm
   * and bypasses canon/cache only on non-greenfield state. Omitted for
   * non-letter-sounds focus / no-progress paths — the server falls back
   * to the Wave-7 directive-level approximation.
   */
  letterSoundsVowelStates?: Record<string, string>
}

export interface PreparedWordSongPathA {
  /** The session plan rehydrated from the server's response. App.tsx
   *  passes this to `<WordSong plan={...} />` so the picture chips match
   *  the spoken target. */
  plan: WordSongSessionPlan
  /** Stable function ref — pass to `<WordSong playUtterance>`. */
  playUtterance: PlayWordSongUtteranceFn
  /** Map of utterance texts to their resolved howl ids. */
  textToId: ReadonlyMap<string, string>
  /** Number of utterances loaded. */
  utteranceCount: number
  /**
   * Planner-derived letter-sounds current-target vowel, slash notation
   * (`'/o/'`, `'/u/'`, `'/i/'`, `'/e/'`) (Wave 9 W9.4 — ticket
   * 86c9ya3r9). Present only on live letter-sounds responses where the
   * server derived the target from `letterSoundsVowelStates`. The caller
   * (App.tsx) freezes this for the session lifetime and forwards it into
   * `recordProgressOnSessionEnd` so the W9.3 per-vowel mastery rule tags
   * the session-end history entry without re-deriving. `undefined` on
   * canon-served / cached / fallback / tier-mastered responses — the
   * Wave-7 composite-tier mastery path applies for those.
   */
  currentTargetVowel?: '/o/' | '/u/' | '/i/' | '/e/'
  /** Tear down all loaded Howls. */
  unload: () => void
}

/**
 * One-line distinct error code surface. The `rate-limited` and
 * `planner-failed` codes were added with the track-based switchover
 * (ticket 86c9jteud, subsumed 86c9jrwqd) — they were already on the wire
 * from PR #105 but the browser previously couldn't trigger them because
 * it was sending plan-attached payloads.
 */
export type PrepareWordSongPathAErrorCode =
  | 'config-missing'
  | 'tts-failed'
  | 'rate-limited'
  | 'planner-failed'
  | 'invalid-response'
  | 'network-error'
  | 'aborted'

export class PrepareWordSongPathAError extends Error {
  readonly code: PrepareWordSongPathAErrorCode
  constructor(code: PrepareWordSongPathAErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'PrepareWordSongPathAError'
  }
}

/**
 * Fetch the session audio for a Word Song session, register howls, and
 * return a `{ plan, playUtterance, ... }` ready to drop onto `<WordSong>`.
 *
 * Throws `PrepareWordSongPathAError` on any failure path. App.tsx catches
 * and falls back to a static plan + silent default by omitting the
 * `playUtterance` prop — same fallback contract as Math.
 */
export async function prepareWordSongPathA(
  args: PrepareWordSongPathAArgs,
  opts: PrepareWordSongPathAOptions = {},
): Promise<PreparedWordSongPathA> {
  const fetchImpl = opts.fetch ?? globalThis.fetch
  const loadAudio = opts.loadSessionAudio ?? defaultLoadSessionAudio
  const playSession = opts.playSessionUtterance ?? defaultPlaySessionUtterance
  const unloadAudio = opts.unloadSessionAudio ?? defaultUnloadSessionAudio

  // M2 (ticket 86c9kmwba): optionally include `progress.focusNode` +
  // `progress.recentSuccessRate`. See mathPathA.ts for the full
  // architectural rationale (same shape, same contract).
  // 86c9m3aec: extended to optionally carry `isGraduationSession`.
  // 86c9q9ben: extended to optionally carry `lifetimeFirstEncounters`.
  const hasProgress =
    args.focusNode !== undefined ||
    args.recentSuccessRate !== undefined ||
    args.isGraduationSession !== undefined ||
    args.lifetimeFirstEncounters !== undefined ||
    args.letterSoundsVowelStates !== undefined
  const progressBlock = hasProgress
    ? {
        progress: {
          ...(args.focusNode !== undefined
            ? { focusNode: args.focusNode }
            : {}),
          ...(args.recentSuccessRate !== undefined
            ? { recentSuccessRate: args.recentSuccessRate }
            : {}),
          ...(args.isGraduationSession !== undefined
            ? { isGraduationSession: args.isGraduationSession }
            : {}),
          ...(args.lifetimeFirstEncounters !== undefined
            ? {
                lifetimeFirstEncounters: [...args.lifetimeFirstEncounters],
              }
            : {}),
          // Wave 9 W9.4 (ticket 86c9ya3r9): per-vowel letter-sounds
          // sub-mastery map. Shipped only when the picked focus node is
          // `letter-sounds` (caller-gated). Server derives the
          // current-target vowel + round-trips it on the response.
          ...(args.letterSoundsVowelStates !== undefined
            ? { letterSoundsVowelStates: { ...args.letterSoundsVowelStates } }
            : {}),
        },
      }
    : {}

  const body: ClaudeRequest = {
    kind: 'session-start',
    payload: {
      track: 'word-song',
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
      throw new PrepareWordSongPathAError('aborted', 'Path A fetch aborted')
    }
    throw new PrepareWordSongPathAError(
      'network-error',
      `Path A fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch (err) {
    throw new PrepareWordSongPathAError(
      'invalid-response',
      `Path A response was not JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!response.ok) {
    const obj = parsed as { error?: unknown } | null
    const errCode = typeof obj?.error === 'string' ? obj.error : ''
    if (errCode === 'config-missing') {
      throw new PrepareWordSongPathAError(
        'config-missing',
        'ANTHROPIC_API_KEY missing on the server',
      )
    }
    if (errCode === 'tts-failed') {
      throw new PrepareWordSongPathAError(
        'tts-failed',
        'Server TTS pipeline failed',
      )
    }
    if (errCode === 'rate-limited') {
      throw new PrepareWordSongPathAError(
        'rate-limited',
        'Server rate-limited the session-start request',
      )
    }
    if (errCode === 'planner-failed') {
      throw new PrepareWordSongPathAError(
        'planner-failed',
        'Server-side Haiku planner failed to produce a valid plan',
      )
    }
    throw new PrepareWordSongPathAError(
      'invalid-response',
      `Path A returned ${response.status}`,
    )
  }

  if (!isSessionStartResponse(parsed)) {
    throw new PrepareWordSongPathAError(
      'invalid-response',
      'Path A response did not match SessionStartResponse',
    )
  }

  const sessionResponse: SessionStartResponse = parsed

  // Rehydrate the nested WordSongSessionPlan. See mathPathA.ts for the
  // rationale on routing this failure to 'invalid-response' (not
  // 'planner-failed').
  let plan: WordSongSessionPlan
  try {
    plan = wordSongSessionPlanFromServer(sessionResponse.plan)
  } catch (err) {
    if (err instanceof WordSongPlanFromServerError) {
      throw new PrepareWordSongPathAError(
        'invalid-response',
        `Path A plan rehydration failed: ${err.message}`,
      )
    }
    throw err
  }

  await loadAudio(args.sessionId, sessionResponse.utterances)

  const textToId = new Map<string, string>()
  for (const u of sessionResponse.utterances) {
    if (!textToId.has(u.text)) textToId.set(u.text, u.id)
  }

  const playUtterance: PlayWordSongUtteranceFn = async (
    text: string,
    playOpts?: PlayWordSongUtteranceOptions,
  ): Promise<void> => {
    const id = textToId.get(text)
    if (!id) {
      // Fail-soft: tick caption so the screen still ticks, then resolve
      // silently. Better than throwing mid-gesture.
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
  // Diagnostic tag (ticket 86c9hjnn8 follow-up). See `mathPathA.ts` for
  // the rationale — Math/WordSong read this via `getPlayerKind()` to
  // attribute the dispatch row in the audioCtxLog.
  ;(
    playUtterance as PlayWordSongUtteranceFn & { __playerKind?: 'real' }
  ).__playerKind = 'real'

  // Wave 9 W9.4 (ticket 86c9ya3r9): read the server-derived
  // current-target vowel off the response envelope. Validated
  // defensively here (the `isSessionStartResponse` guard treats the
  // field as additive/optional and doesn't check it) — only one of the
  // four ladder vowels in slash notation is accepted; anything else is
  // dropped to undefined so the browser falls back to the W9.3
  // composite-tier mastery path.
  const rawVowel = (sessionResponse as { currentTargetVowel?: unknown })
    .currentTargetVowel
  const currentTargetVowel: '/o/' | '/u/' | '/i/' | '/e/' | undefined =
    rawVowel === '/o/' ||
    rawVowel === '/u/' ||
    rawVowel === '/i/' ||
    rawVowel === '/e/'
      ? rawVowel
      : undefined

  return {
    plan,
    playUtterance,
    textToId,
    utteranceCount: sessionResponse.utterances.length,
    currentTargetVowel,
    unload: () => unloadAudio(),
  }
}
