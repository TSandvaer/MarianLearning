/**
 * ElevenLabs TTS backend for Emma (voice migration, plan:
 * design/voice-migration-elevenlabs.md, ClickUp 123jpnbc33e).
 *
 * Why: isolated phonics sounds never rendered reliably on Azure even with
 * per-class SSML workarounds. In the 2026-10-04 ear-test bake-off,
 * ElevenLabs `eleven_v4` + the voice Lily, given inline IPA, won 40/40 rows
 * (isolated sounds, CVC blends, everyday lines) against production Azure.
 *
 * Shape: ElevenLabs takes plain text, not SSML. Phonics sounds are sent as
 * inline IPA wrapped in slashes (`/vː/`), which `eleven_v4` reads as a
 * pronunciation. The IPA is a render-time substitution only: canon `text`
 * and on-screen captions keep the mnemonic spelling ("vvv").
 *
 * Not wired as the default yet: `synthesizeUtterance` in `_tts.ts` routes
 * here only when `TTS_PROVIDER=elevenlabs`, so production stays on Azure
 * until the re-voice (4/6) and live-path (5/6) tickets land.
 */
import type { BackoffPolicy, FetchFn, TtsRequest, TtsResult } from './_tts.js'
import {
  fetchWithBackoff,
  parseBlendText,
  substituteSentenceGap,
} from './_tts.js'

/** Lily — British female, "informative/educational" (ElevenLabs premade). */
export const ELEVENLABS_VOICE_ID = 'pFZP5JQG7iQjIQuC4Bku'
/** Pinned explicitly: the API key has no `models_read`, and a silent model
 *  change would alter every phonics sound the ear-test approved. */
export const ELEVENLABS_MODEL_ID = 'eleven_v4'
/** Mono 64 kbps — nearest available to Azure's 24 kHz / 48 kbps canon. */
export const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_64'
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1/text-to-speech'
const DEFAULT_TIMEOUT_MS = 15_000

/**
 * Letter-sound mnemonics (as spelled in canon text) → IPA for `eleven_v4`.
 * Continuants are held (`ː`); stops and affricates are bare — no added
 * schwa, which is exactly what Azure could not do.
 * Ear-approved 2026-10-04 (bake-off rounds 1, 3 and 3b): short vowels
 * (not held), bare stops (no schwa), held l/m/n/z. /h/ failed one confirm
 * take and passed on a retake, so takes vary: re-take flagged clips rather
 * than changing the IPA. /r/'s confirm line only passed as an exclamation
 * ("Yes! R says /ɹː/!"), which is a wording change (ClickUp 123jpnbc33g).
 * Approvals: ClickUp 123jpnbc33f.
 */
export const LETTER_SOUND_IPA: Readonly<Record<string, string>> = {
  aaa: 'æ',
  buh: 'b',
  kuh: 'k',
  duh: 'd',
  eee: 'e',
  fff: 'fː',
  guh: 'ɡ',
  hhh: 'h',
  iii: 'ɪ',
  juh: 'dʒ',
  lll: 'lː',
  mmm: 'mː',
  nnn: 'nː',
  ooo: 'ɒ',
  puh: 'p',
  rrr: 'ɹː',
  sss: 'sː',
  tuh: 't',
  uuu: 'ʌ',
  // U/I anchored canon forms ("uh, like in cup", "ih, like in ink").
  uh: 'ʌ',
  ih: 'ɪ',
  vvv: 'vː',
  www: 'wː',
  yuh: 'j',
  zzz: 'zː',
  ththth: 'θː',
  shhh: 'ʃː',
  chuh: 'tʃ',
}

/** CVC blend graphemes → IPA. Onset continuants are held like the
 *  isolated sounds; vowels are the short vowels the CVC tiers teach. */
export const BLEND_GRAPHEME_IPA: Readonly<Record<string, string>> = {
  a: 'æ',
  e: 'e',
  i: 'ɪ',
  o: 'ɒ',
  u: 'ʌ',
  b: 'b',
  c: 'k',
  k: 'k',
  d: 'd',
  f: 'fː',
  g: 'ɡ',
  h: 'h',
  j: 'dʒ',
  l: 'lː',
  m: 'mː',
  n: 'n',
  p: 'p',
  r: 'ɹ',
  s: 'sː',
  t: 't',
  v: 'vː',
  w: 'wː',
  x: 'ks',
  y: 'j',
  z: 'zː',
}

/** Whole words whose CVC onset `g` is soft (/dʒ/), not the default hard
 *  /ɡ/. Ear-approved for "gem" 2026-10-04 (Azure rendered it hard). */
export const SOFT_G_WORDS: ReadonlySet<string> = new Set(['gem', 'gel', 'gym'])

const MNEMONIC_PATTERN = new RegExp(
  `\\b(${Object.keys(LETTER_SOUND_IPA)
    .sort((a, b) => b.length - a.length)
    .join('|')})\\b`,
  'gi',
)

/** Render a CVC blend line ("v - a - n ... van") as segmented IPA
 *  ("/vː/ - /æ/ - /n/ ... van"). Returns null when the text is not a blend
 *  or contains a grapheme with no IPA mapping (falls back to plain text). */
export function renderElevenLabsBlend(text: string): string | null {
  const parsed = parseBlendText(text)
  if (parsed === null || parsed.graphemes.length < 2) return null
  const segments: string[] = []
  const softG = SOFT_G_WORDS.has(parsed.word.toLowerCase())
  for (const [i, g] of parsed.graphemes.entries()) {
    const ipa =
      i === 0 && softG && g.toLowerCase() === 'g'
        ? 'dʒ'
        : BLEND_GRAPHEME_IPA[g.toLowerCase()]
    if (ipa === undefined) return null
    segments.push(`/${ipa}/`)
  }
  return `${segments.join(' - ')} ... ${parsed.word}`
}

/** Text sent to ElevenLabs for one utterance. Plain text plus inline IPA;
 *  never SSML (`eleven_v4` does not support SSML break tags). */
export function renderElevenLabsText(text: string, tier?: string): string {
  if (tier === 'simple-sentences') return substituteSentenceGap(text, tier)
  const blend = renderElevenLabsBlend(text)
  if (blend !== null) return blend
  if (tier === 'letter-sounds') {
    return text.replace(
      MNEMONIC_PATTERN,
      (m) => `/${LETTER_SOUND_IPA[m.toLowerCase()]}/`,
    )
  }
  return text
}

export function readElevenLabsKey(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = env.ELEVENLABS_API_KEY
  if (!key || typeof key !== 'string') {
    throw new Error(
      'tts misconfigured: ELEVENLABS_API_KEY is not set in the function environment',
    )
  }
  return key
}

export interface ElevenLabsOptions {
  fetchFn?: FetchFn
  timeoutMs?: number
  env?: NodeJS.ProcessEnv
  backoff?: BackoffPolicy
}

/** Synthesize one utterance with ElevenLabs. `req.voice/rate/pitch/volume`
 *  are Azure prosody fields and are ignored here: the voice is pinned to
 *  Lily and prosody comes from the model. */
export async function synthesizeElevenLabs(
  req: TtsRequest,
  opts: ElevenLabsOptions = {},
): Promise<TtsResult> {
  const fetchFn = opts.fetchFn ?? globalThis.fetch
  const key = readElevenLabsKey(opts.env)
  const controller = new AbortController()
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const handle = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetchWithBackoff(
      fetchFn,
      `${ELEVENLABS_BASE}/${ELEVENLABS_VOICE_ID}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`,
      {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: renderElevenLabsText(req.text, req.tier),
          model_id: ELEVENLABS_MODEL_ID,
        }),
        signal: controller.signal,
      },
      opts.backoff,
    )
  } catch (err) {
    clearTimeout(handle)
    if (controller.signal.aborted) {
      throw new Error(`tts timeout after ${timeoutMs}ms`, { cause: err })
    }
    throw err instanceof Error ? err : new Error(String(err), { cause: err })
  }
  clearTimeout(handle)
  if (!response.ok) {
    let hint = ''
    try {
      hint = (await response.text()).slice(0, 200)
    } catch {
      // best-effort
    }
    throw new Error(`elevenlabs tts failed: HTTP ${response.status} ${hint}`)
  }
  return { audio: new Uint8Array(await response.arrayBuffer()) }
}
