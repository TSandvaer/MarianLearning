/**
 * Math screen — Path A live audio wiring.
 *
 * Bridges `/api/claude` (kind=`session-start`) → `sessionAudio.ts` →
 * `Math.tsx`'s `playUtterance` prop. Keeps App.tsx thin and gives this
 * logic a unit-test seam.
 *
 * Flow
 * ----
 * 1. App.tsx picks the static `MathSessionPlan` for the current session.
 * 2. {@link prepareMathPathA} flattens it via
 *    `mathSessionPlanToUtteranceSources`, POSTs the wire shape to
 *    `/api/claude`, and on success calls `loadSessionAudio` to register
 *    Howls keyed by utterance id.
 * 3. The returned `playUtterance` is TEXT-keyed (matches Math.tsx's
 *    existing contract — see `Math.tsx:PlayMathUtteranceFn`). It looks up
 *    the Howl by text and delegates to `playSessionUtterance(id, opts)`.
 * 4. On failure, App.tsx omits the `playUtterance` prop on Math, which
 *    falls back to its silent-but-captioned default (165 wpm caption tick,
 *    no audio). No error chime, no retry nag — Marian sees text.
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
  mathSessionPlanToUtteranceSources,
  type MathSessionPlan,
} from '../../screens/Math'
import {
  isSessionStartResponse,
  type ClaudeRequest,
  type SessionStartResponse,
  type Utterance,
} from '../../../api/_types'

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

export interface PreparedMathPathA {
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
 */
export type PrepareMathPathAErrorCode =
  | 'config-missing'
  | 'tts-failed'
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
 * Fetch the session audio for a Math plan, register howls, and return a
 * text-keyed `playUtterance` ready to drop onto `<Math>`.
 *
 * Throws `PrepareMathPathAError` on any failure path. App.tsx catches and
 * falls back to the silent default by omitting the `playUtterance` prop.
 *
 * @param plan        The MathSessionPlan App.tsx is about to render with.
 * @param sessionId   A stable id used to key the IndexedDB cache. Reusing
 *                    the plan id is fine — every plan id is unique within
 *                    the rotation, and the cache is per-session anyway.
 */
export async function prepareMathPathA(
  plan: MathSessionPlan,
  sessionId: string,
  opts: PrepareMathPathAOptions = {},
): Promise<PreparedMathPathA> {
  const fetchImpl = opts.fetch ?? globalThis.fetch
  const loadAudio = opts.loadSessionAudio ?? defaultLoadSessionAudio
  const playSession = opts.playSessionUtterance ?? defaultPlaySessionUtterance
  const unloadAudio = opts.unloadSessionAudio ?? defaultUnloadSessionAudio

  const wireUtterances = mathSessionPlanToUtteranceSources(plan)

  // Build the wire-shape request body per `api/_types.ts:ClaudeRequest`
  // and `api/_session.ts:extractUtteranceTexts` — the server walks
  // `payload.plan.utterances` for the TTS fan-out.
  const body: ClaudeRequest = {
    kind: 'session-start',
    payload: {
      plan: {
        id: plan.id,
        label: plan.label,
        utterances: wireUtterances,
      },
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
  // Register howls keyed by utterance id.
  await loadAudio(sessionId, sessionResponse.utterances)

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

  return {
    playUtterance,
    textToId,
    utteranceCount: sessionResponse.utterances.length,
    unload: () => unloadAudio(),
  }
}
