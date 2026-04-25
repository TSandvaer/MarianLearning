// Session-start TTS merge logic.
//
// Responsibility
// --------------
// Given a Claude-returned session plan, walk it to find every utterance the
// child will hear, fan out to the TTS endpoint to render each one as MP3,
// and assemble the wire-shape SessionStartResponse the browser consumes.
//
// This module is a PURE FUNCTION over its `synth` dependency — the actual
// network calls are injected from the caller. That keeps it trivially
// testable (mock `synth` and assert merged-shape correctness) and lets
// `api/claude.ts` call this with the production WSS factory.
//
// Plan-shape contract (interim)
// -----------------------------
// Until follow-up tickets wire the real Claude prompt, the plan is treated
// as opaque except for an `utterances` array of `{ id, text }` pairs. When
// the prompt lands, `extractUtteranceTexts` is the single point that
// changes.

import {
  synthesizeUtterance,
  uint8ToBase64,
  type SynthesizeOptions,
  type TtsRequest,
} from './_tts'
import type { SessionStartResponse, Utterance } from './_types'

/** Voice config used app-wide. Matches PR #25's Plan B Greet voice. */
export const MELODY_VOICE_CONFIG: Pick<
  TtsRequest,
  'voice' | 'rate' | 'pitch' | 'volume'
> = {
  voice: 'en-US-AnaNeural',
  rate: '-10%',
  pitch: '+0Hz',
  volume: '+0%',
}

/** What we extract from a session plan. The plan itself stays opaque to
 *  this module — only the utterance list matters for TTS rendering. */
export interface UtteranceSource {
  id: string
  text: string
}

/**
 * Walk a session plan and return a flat list of utterance sources to
 * render. Until the real Claude prompt lands, we accept any object with
 * a top-level `utterances: { id, text }[]` field; anything else returns
 * an empty list (no audio rendered, response still well-formed).
 */
export function extractUtteranceTexts(plan: unknown): UtteranceSource[] {
  if (typeof plan !== 'object' || plan === null) return []
  const p = plan as Record<string, unknown>
  if (!Array.isArray(p.utterances)) return []
  const out: UtteranceSource[] = []
  for (const u of p.utterances) {
    if (typeof u !== 'object' || u === null) continue
    const r = u as Record<string, unknown>
    if (typeof r.id === 'string' && typeof r.text === 'string') {
      out.push({ id: r.id, text: r.text })
    }
  }
  return out
}

export interface RenderSessionOptions {
  /** Test seam — defaults to the production `synthesizeUtterance`. */
  synth?: (
    req: TtsRequest,
    opts?: SynthesizeOptions,
  ) => Promise<{ audio: Uint8Array }>
  /** Per-utterance synthesize options (timeout, factory injection in tests). */
  synthOptions?: SynthesizeOptions
  /** Cap parallel TTS requests against the Edge endpoint. The free
   *  read-aloud service is not documented to enforce a strict limit, but
   *  empirically more than 6-8 concurrent connections from one IP gets
   *  rate-limited. Default 6 keeps us under that floor while still
   *  finishing 5-8 utterances within ~1.5s wall time. */
  concurrency?: number
}

/**
 * Render every utterance in a plan to MP3 and assemble the wire-shape
 * response. Concurrency-limited to avoid hammering the free Edge endpoint.
 */
export async function renderSessionAudio(
  plan: unknown,
  opts: RenderSessionOptions = {},
): Promise<SessionStartResponse> {
  const synth = opts.synth ?? synthesizeUtterance
  const concurrency = Math.max(1, opts.concurrency ?? 6)
  const sources = extractUtteranceTexts(plan)

  // Concurrency-limited fan-out. Promise.all without limit would open one
  // socket per utterance simultaneously; the Edge endpoint tolerates a
  // handful but not 30+. We use a tiny pool here rather than pulling in
  // p-limit — the dependency cost outweighs the 8 lines of pool code.
  const utterances: Utterance[] = new Array(sources.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++
      if (i >= sources.length) return
      const src = sources[i]!
      const result = await synth(
        { text: src.text, ...MELODY_VOICE_CONFIG },
        opts.synthOptions,
      )
      utterances[i] = {
        id: src.id,
        text: src.text,
        audio: {
          kind: 'inline',
          base64: uint8ToBase64(result.audio),
          mime: 'audio/mpeg',
        },
      }
    }
  }

  const workers: Promise<void>[] = []
  for (let i = 0; i < Math.min(concurrency, sources.length); i++) {
    workers.push(worker())
  }
  await Promise.all(workers)

  return {
    ok: true,
    kind: 'session-start',
    plan,
    utterances,
  }
}
