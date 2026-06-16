// /api/blend-tweak — DEBUG-ONLY live onset-tuning render endpoint.
//
// WHY THIS EXISTS (ticket 86ca8t...; "stop guessing, build a handle")
// -------------------------------------------------------------------
// The CVC phoneme-blend prompt ("c - a - t ... cat" on a 2nd wrong tap)
// sounds out isolated consonants via Azure en-GB-OliviaNeural. Three
// audition passes (#465/#466 stops, #470 pass-2, #472 pass-3) FAILED to
// find a clean isolated render for the ONSET of /f/, /s/, /dʒ/, /w/
// (leading-vowel "ef"/"es" swallows the consonant; deep "juh"/"wuh" didn't
// land). Rather than guess a 4th candidate set, Thomas (the ear) drives the
// tuning himself via this live handle: he POSTs a candidate onset string +
// prosody from `/blend-tweak.html`, hears the FULL blend line rendered in
// context, and reports the winning params per class. The winners get baked
// into production `renderBlendInnerText` in a SEPARATE follow-up PR.
//
// IN CONTEXT, NOT IN ISOLATION
// ----------------------------
// The endpoint mirrors the SHIPPED production blend SSML structure exactly
// (api/_tts.ts `renderBlendInnerText`): the MEDIAL vowel + CODA + whole-word
// + inter-grapheme/whole-word breaks are rendered from the same production
// constants (`BLEND_GRAPHEME_IPA`, `BLEND_STOP_GRAPHEMES`, the break
// timings). ONLY the onset slot is parameterized:
//
//     <prosody rate="{ratePct}%" pitch="{pitchPct}%">{onsetText}</prosody>
//     <break time="{breakMs}ms"/>
//
// So a winning onset Thomas tunes here transfers directly to the real render
// — he hears the candidate against the production medial/coda, not a
// stripped-down isolated phoneme.
//
// SECURITY / SCOPE
// ----------------
//  - GATED NON-PRODUCTION: returns 404 when `VERCEL_ENV === 'production'`.
//    This debug endpoint must never serve on prod. It IS allowed on PR
//    preview deploys (where Thomas tunes) and local dev.
//  - The onset text is free-form sponsor input → `escapeSsml` before it
//    enters the SSML body (SSML-injection safety). Same for the word.
//  - Reuses a per-IP rate limiter (same posture as /api/claude) so a stuck
//    loop can't blast Azure billing.
//  - ANTHROPIC_API_KEY is NOT touched here — this path only renders TTS via
//    Azure (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION, read inside
//    synthesizeUtterance). No Anthropic, no Claude.
//
// Runtime/import conventions match the rest of api/ (see claude.ts HISTORY):
// explicit `.js` relative imports for Node ESM strict resolution; Node
// runtime (no `export const config`).

import {
  BLEND_GRAPHEME_BREAK_MS,
  BLEND_GRAPHEME_IPA,
  BLEND_STOP_GRAPHEMES,
  BLEND_WHOLE_WORD_BREAK_MS,
  escapeSsml,
  synthesizeUtterance,
  uint8ToBase64,
  type TtsRequest,
} from './_tts.js'
import { createRateLimiter, type RateLimiter } from './_rateLimit.js'
import { EMMA_VOICE_CONFIG } from './_session.js'

// ── CORS (mirrors claude.ts) ────────────────────────────────────────────
function buildAllowedOrigins(): readonly string[] {
  const origins = new Set<string>(['http://localhost:5173'])
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) origins.add(`https://${vercelUrl}`)
  const extra = process.env.CLAUDE_API_EXTRA_ORIGINS
  if (extra) {
    for (const o of extra.split(',')) {
      const trimmed = o.trim()
      if (trimmed) origins.add(trimmed)
    }
  }
  return [...origins]
}

function corsHeaders(requestOrigin: string | null): Headers {
  const headers = new Headers()
  const allowed = buildAllowedOrigins()
  if (requestOrigin && allowed.includes(requestOrigin)) {
    headers.set('Access-Control-Allow-Origin', requestOrigin)
    headers.set('Vary', 'Origin')
  }
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Access-Control-Max-Age', '86400')
  return headers
}

/** Best-effort source-IP extraction (mirrors claude.ts). */
function extractSourceIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

function jsonResponse(
  body: unknown,
  status: number,
  baseHeaders: Headers,
): Response {
  const headers = new Headers(baseHeaders)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers })
}

// ── Production-mirroring blend SSML with a parameterized onset slot ──────

/** Render a single grapheme's inner SSML the way production
 *  `renderBlendInnerText` does: stop consonants get the clipped `<stop>ə`
 *  release, continuants + vowels stay bare IPA; an unmapped grapheme is
 *  voiced bare. Used ONLY for the medial + coda (non-onset) graphemes so
 *  they stay byte-identical to what ships. */
function renderProductionGrapheme(grapheme: string): string {
  const g = grapheme.toLowerCase()
  const ipa = BLEND_GRAPHEME_IPA[g]
  if (ipa === undefined) return escapeSsml(grapheme)
  const released = BLEND_STOP_GRAPHEMES.has(g) ? `${ipa}ə` : ipa
  return `<phoneme alphabet="ipa" ph="${escapeSsml(released)}">${escapeSsml(grapheme)}</phoneme>`
}

/** Onset prosody params Thomas drives. Rate/pitch are percent integers
 *  (relative to the speak-root prosody); break is the post-onset pause. */
export interface BlendOnsetParams {
  onsetText: string
  ratePct: number
  pitchPct: number
  breakMs: number
}

/**
 * Build the FULL blend inner-text, mirroring production structure, with the
 * ONSET slot parameterized.
 *
 *   onset:  <prosody rate pitch>{onsetText}</prosody><break breakMs/>
 *   medial: <production grapheme render><break 250ms/>      (vowel)
 *   coda:   <production grapheme render><break 250ms/>      (final consonant)
 *   word:   <break 450ms/>{word}
 *
 * `graphemes` is the word split into single-grapheme tokens (the canon
 * `x`=/ks/ cluster stays one token). The first grapheme is the onset slot;
 * the rest render via the production helper. This guarantees the tuned onset
 * is heard against the exact medial/coda/whole-word bytes production ships.
 */
export function buildBlendInnerTextWithOnset(
  word: string,
  graphemes: readonly string[],
  onset: BlendOnsetParams,
): string {
  const parts: string[] = []

  // ── ONSET slot (parameterized) ──
  const rate = `${onset.ratePct >= 0 ? '+' : ''}${onset.ratePct}%`
  const pitch = `${onset.pitchPct >= 0 ? '+' : ''}${onset.pitchPct}%`
  parts.push(
    `<prosody rate="${escapeSsml(rate)}" pitch="${escapeSsml(pitch)}">` +
      `${escapeSsml(onset.onsetText)}` +
      `</prosody>`,
  )
  parts.push(`<break time="${onset.breakMs}ms"/>`)

  // ── MEDIAL + CODA (production-identical) ──
  for (let i = 1; i < graphemes.length; i++) {
    const grapheme = graphemes[i]
    if (grapheme === undefined) continue
    parts.push(renderProductionGrapheme(grapheme))
    parts.push(`<break time="${BLEND_GRAPHEME_BREAK_MS}ms"/>`)
  }

  // ── WHOLE WORD (production-identical: long break, then natural voicing) ──
  parts.push(`<break time="${BLEND_WHOLE_WORD_BREAK_MS}ms"/>`)
  parts.push(escapeSsml(word))

  return parts.join('')
}

/** Wrap inner-text in the production speak/voice/prosody envelope, mirroring
 *  `buildSsmlBody` but injecting our pre-built inner text (we bypass
 *  `renderSsmlInnerText` because the inner text is already the blend render).
 *  Uses the canonical EMMA_VOICE_CONFIG (en-GB-OliviaNeural, rate -10%). */
function buildSpeakBody(innerText: string): string {
  const { voice, rate, pitch, volume } = EMMA_VOICE_CONFIG
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">` +
    `<voice name="${escapeSsml(voice)}">` +
    `<prosody pitch="${escapeSsml(pitch)}" rate="${escapeSsml(rate)}" volume="${escapeSsml(volume)}">` +
    `${innerText}` +
    `</prosody></voice></speak>`
  )
}

// ── Request validation ──────────────────────────────────────────────────

interface BlendTweakRequest {
  word: string
  graphemes: string[]
  onsetText: string
  ratePct: number
  pitchPct: number
  breakMs: number
}

/** A grapheme token: 1-3 ASCII letters (covers single graphemes + the `x`
 *  cluster, which the page may send as a single "x" token; defensive upper
 *  bound). */
const GRAPHEME_RE = /^[a-z]{1,3}$/i
/** The onset text the sponsor types. Constrained to a short string of
 *  letters/spaces so a stray paste can't smuggle a huge body. `escapeSsml`
 *  still runs regardless — this is a size/shape guard, not the safety net. */
const ONSET_TEXT_RE = /^[a-z ]{1,12}$/i

function parseRequest(body: unknown): BlendTweakRequest | { error: string } {
  if (typeof body !== 'object' || body === null)
    return { error: 'body must be an object' }
  const b = body as Record<string, unknown>

  const word = b.word
  if (typeof word !== 'string' || !/^[a-z]{2,6}$/i.test(word)) {
    return { error: 'word must be a 2-6 letter string' }
  }

  if (
    !Array.isArray(b.graphemes) ||
    b.graphemes.length < 2 ||
    b.graphemes.length > 4
  ) {
    return { error: 'graphemes must be an array of 2-4 tokens' }
  }
  const graphemes: string[] = []
  for (const g of b.graphemes) {
    if (typeof g !== 'string' || !GRAPHEME_RE.test(g)) {
      return { error: 'each grapheme must be 1-3 letters' }
    }
    graphemes.push(g)
  }

  const onsetText = b.onsetText
  if (typeof onsetText !== 'string' || !ONSET_TEXT_RE.test(onsetText)) {
    return { error: 'onsetText must be 1-12 letters/spaces' }
  }

  const ratePct = b.ratePct
  if (
    typeof ratePct !== 'number' ||
    !Number.isFinite(ratePct) ||
    ratePct < -50 ||
    ratePct > 50
  ) {
    return { error: 'ratePct must be a number in [-50, 50]' }
  }
  const pitchPct = b.pitchPct
  if (
    typeof pitchPct !== 'number' ||
    !Number.isFinite(pitchPct) ||
    pitchPct < -50 ||
    pitchPct > 50
  ) {
    return { error: 'pitchPct must be a number in [-50, 50]' }
  }
  const breakMs = b.breakMs
  if (
    typeof breakMs !== 'number' ||
    !Number.isInteger(breakMs) ||
    breakMs < 0 ||
    breakMs > 1500
  ) {
    return { error: 'breakMs must be an integer in [0, 1500]' }
  }

  return { word, graphemes, onsetText, ratePct, pitchPct, breakMs }
}

// ── Rate limiter (module singleton, same tunables as /api/claude) ───────
const blendTweakLimiter: RateLimiter = createRateLimiter({
  limit: 12,
  windowMs: 60_000,
})

export interface BlendTweakOverrides {
  rateLimiter?: RateLimiter
  now?: () => number
  /** Override the env-gate read. Defaults to process.env.VERCEL_ENV. */
  vercelEnv?: string
  /** Test seam: synthesize implementation. Defaults to the real Azure path. */
  synthesize?: typeof synthesizeUtterance
}

export async function handler(
  request: Request,
  overrides: BlendTweakOverrides = {},
): Promise<Response> {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  const limiter = overrides.rateLimiter ?? blendTweakLimiter
  const now = overrides.now ?? Date.now
  const synthesize = overrides.synthesize ?? synthesizeUtterance

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  // ── HARD non-production gate. This debug endpoint must never serve on
  //    prod. VERCEL_ENV is 'production' on prod deploys, 'preview' on PR
  //    previews, 'development' locally. 404 (not 403) so prod looks like the
  //    route simply doesn't exist. ──
  const vercelEnv = overrides.vercelEnv ?? process.env.VERCEL_ENV
  if (vercelEnv === 'production') {
    return jsonResponse({ error: 'not-found' }, 404, headers)
  }

  if (request.method !== 'POST') {
    headers.set('Allow', 'POST, OPTIONS')
    return jsonResponse({ error: 'method-not-allowed' }, 405, headers)
  }

  // Rate-limit gate (per-IP).
  const ip = extractSourceIp(request)
  const rl = limiter.check(ip, now())
  if (!rl.allowed) {
    if (rl.retryAfterSec !== undefined) {
      headers.set('Retry-After', String(rl.retryAfterSec))
    }
    return jsonResponse({ error: 'rate-limited' }, 429, headers)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'invalid-json' }, 400, headers)
  }

  const parsed = parseRequest(body)
  if ('error' in parsed) {
    return jsonResponse({ error: parsed.error }, 400, headers)
  }

  const innerText = buildBlendInnerTextWithOnset(
    parsed.word,
    parsed.graphemes,
    {
      onsetText: parsed.onsetText,
      ratePct: parsed.ratePct,
      pitchPct: parsed.pitchPct,
      breakMs: parsed.breakMs,
    },
  )
  const ssml = buildSpeakBody(innerText)

  // Render via the real Azure path (retry/backoff/timeout/error-mapping all
  // reused). We pass our pre-built, already-escaped SSML through the
  // `ssmlOverride` seam so synthesizeUtterance does NOT re-run
  // renderSsmlInnerText (which would double-escape our markup). `req` is kept
  // only for the diagnostic log fields (voice/rate/pitch).
  const req: TtsRequest = {
    text: parsed.word, // unused for body (overridden), kept for logging
    ...EMMA_VOICE_CONFIG,
  }

  try {
    const result = await synthesize(req, { ssmlOverride: ssml })
    const base64 = uint8ToBase64(result.audio)
    return jsonResponse(
      { ok: true, ssml, base64, mime: 'audio/mpeg', word: parsed.word },
      200,
      headers,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/blend-tweak] render-failed', { message })
    return jsonResponse(
      { error: 'render-failed', detail: message },
      502,
      headers,
    )
  }
}

export default { fetch: handler }
