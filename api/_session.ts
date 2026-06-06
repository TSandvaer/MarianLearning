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

// NOTE on `.js` extensions: this file is compiled to ESM and shipped to the
// Vercel Node runtime, where ESM strict-resolution requires explicit file
// extensions on relative imports. See HISTORY in api/claude.ts (round 3).
// Vitest tolerates the bare specifier locally because it uses Vite's
// bundler-resolution; the `.js` suffix breaks neither environment.
import {
  synthesizeUtterance,
  uint8ToBase64,
  type SynthesizeOptions,
  type TtsRequest,
} from './_tts.js'
import type { SessionStartResponse, Utterance } from './_types.js'

/**
 * Voice config used app-wide.
 *
 * History
 * -------
 * - PR #25 (ticket 86c9gqprh): Plan B locked `en-US-AnaNeural` rate `-10%`
 *   for both Greet's bundled MP3s and Path A session audio.
 * - Ticket 86c9hjnq1 (THIS CHANGE — Phase 3a, 2026-04-28): swap to
 *   `en-US-EmmaMultilingualNeural`. Rationale: the audit-branch A/B
 *   (`audit/86c9hjnq1-ssml-prosody-samples`, PR #96) confirmed Ana's
 *   prosody engine produces metallic question intonation regardless of
 *   SSML strategy; Emma multilingual produces natural prosody on the
 *   exact same body. Thomas approved 2026-04-28.
 *
 * The character is also being renamed Melody → Emma in this phase to
 * drop Sanrio IP. The visual pivot (manhwa-style art) is Phase 3b and
 * lands separately. Phase 3b (ticket 86c9jccp7, 2026-04-29) renames
 * this constant from `EMMA_VOICE_CONFIG` → `EMMA_VOICE_CONFIG` along
 * with the rest of the cascading symbol pass.
 *
 * - British-voice rollout (2026-06-06, Thomas directive): swap
 *   `en-US-EmmaMultilingualNeural` → `en-GB-OliviaNeural`. The US
 *   multilingual voice mangled isolated short-vowel phonemes
 *   (notably "o as in hot" rendered as "ah"/"jar") in the letter-
 *   sounds tier; a long ear-test cycle confirmed the en-GB female
 *   neural voice Olivia renders the short-vowel ladder and isolated
 *   consonant phonemes correctly, with a per-sound-class SSML
 *   treatment for letter-sounds reads/hints (see api/_tts.ts
 *   renderSsmlInnerText + the LETTER-SOUNDS UTTERANCE TEMPLATE in
 *   api/_planner.ts). All canon + bundled Greet/Hub MP3s re-baked on
 *   Olivia; CACHE_VERSION bumped to 4 to drop stale US-voice audio.
 */
export const EMMA_VOICE_CONFIG: Pick<
  TtsRequest,
  'voice' | 'rate' | 'pitch' | 'volume'
> = {
  voice: 'en-GB-OliviaNeural',
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
  /**
   * Tier filter for tier-aware `PHONEME_OVERRIDES` substitutions
   * (Wave 7 Track A7 — Amendment 1 of ticket 86c9y49cd). The
   * effective focus node passed by `generateSessionStartResponse`
   * (e.g. `'letter-sounds'`, `'cvc-words'`). Threaded into every
   * `synth()` call via `TtsRequest.tier`. When a `PHONEME_OVERRIDES`
   * entry has a `tiers?:` list and this value is set, the entry
   * activates ONLY when the current tier is in its list (tier-scoped
   * substitution); global entries (no `tiers` field) activate
   * regardless. Letter-sounds canon embeds isolated-phoneme mnemonics
   * (`mmm`, `buh`, `o`) that are wrapped in `<phoneme>` ONLY when
   * `tierFilter === 'letter-sounds'` — pollution into CVC tiers
   * (where the letter `m` would mispronounce real words like "math"
   * or "moth") is structurally impossible. See `api/_tts.ts
   * PHONEME_OVERRIDES` docstring + `design/word-song/letter-sounds-
   * content.md §2.4` for the substitution-table architecture.
   */
  tierFilter?: string
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
  // p-limit — the dependency cost outweighs the small pool implementation.
  //
  // Failure semantics (ticket 86c9kjdh2 — soft-fail per utterance):
  // ---------------------------------------------------------------
  // The synth dependency is responsible for retrying transient Azure
  // failures (429 with backoff, 5xx single retry — see
  // _tts.fetchWithBackoff). When it rejects here, retries are EXHAUSTED
  // and this utterance is genuinely unrenderable.
  //
  // Prior behaviour (pre-86c9kjdh2): ANY worker rejection set the shared
  // `aborted` flag, so siblings stopped pulling work, and the whole
  // session-start failed with `tts-failed`. With 40-59 utterances per
  // session, one transient failure tanked the entire batch.
  //
  // New behaviour: a per-utterance failure is recorded and the worker
  // pool keeps draining. The corresponding slot in `utterances` is left
  // empty and is filtered out before the response is assembled. The
  // browser's Path A loader treats a missing utterance ID as "fall back
  // to silent caption-only for that one phrase" — same blast-radius
  // shape as before, but localised to the single failed phrase instead
  // of the whole session.
  //
  // Failure threshold: even 0/N rendered utterances is returned as
  // 200 OK with an empty array. The browser already handles missing
  // audio gracefully; surfacing a 502 here would force the entire
  // session into silent fallback when partial recovery is more useful.
  // If Azure is fully down the user sees caption-only, which matches
  // the prior tts-failed silent-fallback degradation but at least
  // delivers the session plan.
  //
  // Promise.allSettled is no longer needed for failure-collation since
  // workers no longer throw; it is preserved so that any unexpected
  // worker-internal exception (e.g. a Buffer encoding bug) doesn't
  // surface as an UnhandledPromiseRejection on Vercel logs.
  const utterances: (Utterance | undefined)[] = new Array(sources.length)
  const failures: { id: string; message: string }[] = []
  let nextIndex = 0

  async function worker(): Promise<void> {
    // No early-abort. Each worker drains the queue independently; a
    // per-utterance failure is logged and the worker moves to the next.
    while (true) {
      const i = nextIndex++
      if (i >= sources.length) return
      const src = sources[i]!
      let result: { audio: Uint8Array }
      try {
        result = await synth(
          {
            text: src.text,
            ...EMMA_VOICE_CONFIG,
            ...(opts.tierFilter !== undefined ? { tier: opts.tierFilter } : {}),
          },
          opts.synthOptions,
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        failures.push({ id: src.id, message })
        // Vercel log surface — structured single-line for query-ability.
        // Suppressed under NODE_ENV === 'test' to keep test output clean.
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[api/_session] tts-utterance-failed', {
            id: src.id,
            message,
          })
        }
        continue
      }
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

  // Drain the worker pool. Workers no longer throw on per-utterance
  // failure (those are recorded in `failures` and skipped); a rejection
  // here would indicate a bug in worker() itself (e.g. base64 encoder
  // throws). Re-throw any such bug-class failure so it surfaces as
  // tts-failed at the handler layer rather than as a silent partial.
  const results = await Promise.allSettled(workers)
  const unexpectedRejection = results.find(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  )
  if (unexpectedRejection) {
    const reason = unexpectedRejection.reason
    throw reason instanceof Error ? reason : new Error(String(reason))
  }

  // Surface a single summary log when ANY utterance failed — easier to
  // grep than the per-utterance lines and gives an at-a-glance failure
  // rate for the Vercel log explorer.
  if (failures.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('[api/_session] tts-partial', {
      total: sources.length,
      failed: failures.length,
      rendered: sources.length - failures.length,
    })
  }

  // Filter out failed slots — the browser-side loader handles missing
  // utterance ids by falling back to silent caption-only for that
  // phrase. Order is preserved (Array.filter on a sparse-by-undefined
  // array keeps the relative order of the surviving entries).
  const rendered = utterances.filter((u): u is Utterance => u !== undefined)

  return {
    ok: true,
    kind: 'session-start',
    plan,
    utterances: rendered,
  }
}
