/**
 * Word Song screen — Path A live audio wiring.
 *
 * Sibling of `mathPathA.ts`. Bridges `/api/claude` (kind=`session-start`)
 * → `sessionAudio.ts` → `WordSong.tsx`'s `playUtterance` prop. Keeps
 * App.tsx thin and gives this logic a unit-test seam.
 *
 * Same shape, different content
 * -----------------------------
 * The flow is a near-clone of `prepareMathPathA`: flatten the plan to
 * the wire shape, POST to `/api/claude`, register Howls keyed by
 * utterance id, return a text-keyed `playUtterance`. The duplication
 * (~50 lines vs Math's mathPathA.ts) is intentional — the modules don't
 * share state, the contract is per-screen, and a shared abstraction
 * here would have to thread a generic plan/wire-shape through every
 * call site. The screens don't share an audio bundle session-side
 * either (Math + Word Song each fetch their own), so the duplication
 * matches the actual independence.
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
  wordSongSessionPlanToUtteranceSources,
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

export interface PreparedWordSongPathA {
  /** Stable function ref — pass to `<WordSong playUtterance>`. */
  playUtterance: PlayWordSongUtteranceFn
  /** Map of utterance texts to their resolved howl ids. */
  textToId: ReadonlyMap<string, string>
  /** Number of utterances loaded. */
  utteranceCount: number
  /** Tear down all loaded Howls. */
  unload: () => void
}

export type PrepareWordSongPathAErrorCode =
  | 'config-missing'
  | 'tts-failed'
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
 * Fetch the session audio for a Word Song plan, register howls, and
 * return a text-keyed `playUtterance` ready to drop onto `<WordSong>`.
 *
 * Throws `PrepareWordSongPathAError` on any failure path. App.tsx catches
 * and falls back to the silent default by omitting the `playUtterance`
 * prop — same fallback contract as Math.
 */
export async function prepareWordSongPathA(
  plan: WordSongSessionPlan,
  sessionId: string,
  opts: PrepareWordSongPathAOptions = {},
): Promise<PreparedWordSongPathA> {
  const fetchImpl = opts.fetch ?? globalThis.fetch
  const loadAudio = opts.loadSessionAudio ?? defaultLoadSessionAudio
  const playSession = opts.playSessionUtterance ?? defaultPlaySessionUtterance
  const unloadAudio = opts.unloadSessionAudio ?? defaultUnloadSessionAudio

  const wireUtterances = wordSongSessionPlanToUtteranceSources(plan)

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
  await loadAudio(sessionId, sessionResponse.utterances)

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

  return {
    playUtterance,
    textToId,
    utteranceCount: sessionResponse.utterances.length,
    unload: () => unloadAudio(),
  }
}
