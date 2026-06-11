// Server-side TTS using Azure Speech REST.
//
// Why this exists
// ---------------
// PR #25 (ticket 86c9gqprh) shipped pre-recorded MP3s for the four fixed
// Greet lines via the Python `edge-tts` CLI. Math, Word Song, and any
// future per-session utterance is dynamic (Claude-generated per session)
// and cannot be pre-recorded. This module renders those dynamic lines at
// session-start time using the same voice config as Greet (defined in
// `api/_session.ts` → `EMMA_VOICE_CONFIG`).
//
// HISTORY
// -------
//  - 86c9gr385 (Path A — server-side TTS pipeline): first impl reused the
//    free Edge Read-Aloud WSS endpoint
//    (wss://speech.platform.bing.com/...) — the same protocol the Python
//    `edge-tts` package speaks. The choice was empirically wrong: from
//    Vercel's serverless egress (arn1/iad1) the WSS handshake times out at
//    8000ms across cold and warm invocations, plan sizes, and retries. Root
//    cause is most likely a Vercel plan-level outbound WSS restriction or a
//    Microsoft block-list on Vercel egress IPs. Either way the failure
//    class is structural — no amount of timeout tuning fixes it.
//    See ticket 86c9gv8um for the diagnostic write-up.
//  - 86c9gvgjk (Plan B lock-in): swap the entire transport layer to Azure
//    Speech REST. Initial Azure voice was en-US-AnaNeural (Microsoft's
//    "Cute" child female), output format audio-24khz-48kbitrate-mono-mp3,
//    same wire shape exposed to the caller (Uint8Array MP3 bytes). Plain
//    HTTPS — no WSS, no Sec-MS-GEC token, no reverse-engineered protocol.
//    Cost: $0/month within Azure F0 free tier.
//  - 86c9hjnq1 (Phase 3a, 2026-04-28): voice swap to
//    en-US-EmmaMultilingualNeural. The audit branch
//    (audit/86c9hjnq1-ssml-prosody-samples / PR #96) A/B confirmed Ana's
//    prosody predictor produces metallic question intonation regardless
//    of SSML strategy; Emma multilingual produces natural prosody on the
//    same SSML body. Same wire shape, same output format. Voice config
//    declared in api/_session.ts (EMMA_VOICE_CONFIG); see that file's
//    header for full rationale. Phase 3b ships the visual pivot
//    (manhwa-style art) and the broader rename of "Melody" symbols.
//
// IMPORTANT: this is a server-side module ONLY. It reads
// `process.env.AZURE_SPEECH_KEY` and `process.env.AZURE_SPEECH_REGION`.
// Never import from the browser bundle — `tsconfig.api.json` keeps it
// scoped to `api/`.

import { createHash } from 'node:crypto'

const AZURE_TTS_PATH = '/cognitiveservices/v1'

/** Output format header value. Matches what the Greet pre-recorded MP3s use
 *  and what the client decoder expects. Do not change without coordinating
 *  with the iPad audio path. */
const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'

/** User-Agent — Azure logs reject empty/clearly-bot UAs on some regions.
 *  The value itself doesn't matter for billing; this just identifies us in
 *  the Azure portal's diagnostic logs. */
const USER_AGENT = 'marian-tutor/1.0 (+marian-learning.vercel.app)'

/** Default per-utterance hard timeout. 8s matches the prior WSS contract;
 *  Azure REST typically responds in <1s so this is comfortable headroom. */
const DEFAULT_TIMEOUT_MS = 8_000

/** Voice config for a single utterance. */
export interface TtsRequest {
  /** Plain text to synthesize. Will be XML-escaped before embedding in SSML. */
  text: string
  /** Voice short-name, e.g. `en-US-EmmaMultilingualNeural`. */
  voice: string
  /** Prosody rate, e.g. `'-10%'`, `'+0%'`, `'+5%'`. */
  rate: string
  /** Prosody pitch, e.g. `'+0Hz'`, `'+5Hz'`. */
  pitch: string
  /** Prosody volume, e.g. `'+0%'`. */
  volume: string
  /**
   * Optional tier filter for tier-aware `PHONEME_OVERRIDES`
   * substitutions (Wave 7 Track A7 — Amendment 1 of ticket
   * 86c9y49cd). Source-of-truth focus-node tier the utterance comes
   * from (e.g. `'letter-sounds'`, `'cvc-words'`). When set, only
   * `PHONEME_OVERRIDES` entries whose `tiers` array is undefined
   * (global) OR includes this tier are activated. When omitted, only
   * global entries activate (back-compat — existing CVC-tier callers
   * keep their pre-Amendment-1 behaviour because their wrapped words
   * like `four` are unconstrained on `tiers`).
   */
  tier?: string
}

export interface TtsResult {
  /** MP3 audio bytes (audio/mpeg). */
  audio: Uint8Array
}

/** Server-side env-var snapshot. Pulled at synthesize-time so a deploy that
 *  forgot to set the vars fails loud per request rather than at module-load
 *  (where it would mask the cold-start error in `/api/claude` behind a
 *  generic FUNCTION_INVOCATION_FAILED). */
export interface AzureCredentials {
  key: string
  region: string
}

/** Read Azure credentials from process.env. Exported for unit tests; the
 *  production path calls this implicitly inside synthesizeUtterance. */
export function readAzureCredentials(
  env: NodeJS.ProcessEnv = process.env,
): AzureCredentials {
  const key = env.AZURE_SPEECH_KEY
  const region = env.AZURE_SPEECH_REGION
  if (!key || typeof key !== 'string') {
    throw new Error(
      'tts misconfigured: AZURE_SPEECH_KEY is not set in the function environment',
    )
  }
  if (!region || typeof region !== 'string') {
    throw new Error(
      'tts misconfigured: AZURE_SPEECH_REGION is not set in the function environment',
    )
  }
  return { key, region }
}

/** Build the Azure TTS endpoint URL for a given region. */
export function buildAzureEndpoint(region: string): string {
  return `https://${region}.tts.speech.microsoft.com${AZURE_TTS_PATH}`
}

/** XML-escape a string for safe embedding in SSML. */
export function escapeSsml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Per-word IPA pronunciation overrides for Azure Neural TTS.
 *
 * Why this exists (ticket 86c9kj2um)
 * ----------------------------------
 * Thomas reported that on production iPad, en-US-EmmaMultilingualNeural
 * pronounces "four" as the homophone "for" (i.e. with the unstressed,
 * shortened /fɚ/-ish realization rather than the long-vowel /fɔːr/).
 * Marian, an English-as-a-second-language 8-year-old, hears the wrong
 * sound and the math problem is unparseable.
 *
 * Pivot history: PR #114 tried Option B (carrier prefix — prepending
 * "Okay." before each problem to defeat a hypothesised
 * leading-position-triggered homophone selection). That hypothesis was
 * empirically wrong: with the carrier in place, Thomas confirmed
 * "four" still sounded like "for" AND the leading "Okay." was annoying
 * background noise on every problem. PR #114 stays parked.
 *
 * Pivot to Option C: explicit IPA phoneme override via
 * `<phoneme alphabet="ipa" ph="...">word</phoneme>`. Azure's neural
 * voices honour the W3C SSML 1.0 phoneme element and use the supplied
 * IPA string instead of running the word through the voice's lexicon.
 * That is deterministic — no hidden context-sensitive realization.
 *
 * IPA values picked
 * -----------------
 *  - "four" → /fɔːr/ (American English long-vowel rhotacised
 *    realization; THE_OPEN_O + LENGTH_MARK + R). This is the canonical
 *    dictionary form and what every native speaker hears as "the
 *    number four", clearly distinct from "for" /fɚ/ or /fɔr/.
 *
 * What about "two"?
 * -----------------
 * The first iteration of this PR also wrapped "two" in
 * `<phoneme alphabet="ipa" ph="tuː">` for defensive symmetry against
 * the "to"/"too" homophone family. Thomas's iPad listening pass on
 * the preview deploy showed the "four" → /fɔːr/ override worked, but
 * "two" → /tuː/ was NOT honored by the en-US-EmmaMultilingualNeural
 * voice — the leading "Two" in "Two plus two" still rendered short
 * (closer to "to") despite the IPA. Same observed shape as the
 * original "four" issue but for a different IPA value, in this voice.
 *
 * Decision: ship the "four" win now and iterate on the right notation
 * for "two" in a follow-up ticket. The helper machinery (regex builder
 * from `Object.keys`, applyPhonemeOverrides, the SSML composition) is
 * unchanged — only the data shrinks. Adding "two" back is a one-line
 * edit once we have an IPA / SSML construction the voice respects.
 *
 * Why ONLY "four" and not e.g. "one" / "three"
 * --------------------------------------------
 *  - "one" /wʌn/ has no homophone the voice could plausibly select.
 *  - "three" /θriː/ likewise — no high-frequency English word collides.
 *  - The override has a real cost: it disables Azure's contextual
 *    prosody for the wrapped word (the phoneme element is its own
 *    prosody scope). So we only inject it where the homophone risk
 *    has been observed empirically AND the override has been
 *    listening-confirmed to actually move the voice.
 *
 * Word-boundary safety
 * --------------------
 * The regex uses `\b` so substring matches do not fire:
 *   "fourteen", "fourth", "afternoon" — leave alone.
 * Case is preserved in the output (matched substring is reused
 * verbatim inside the tag), so "Four" stays "Four" while still being
 * voiced from the IPA. The IPA itself is identical regardless of
 * casing — Azure ignores the visible word once `ph=` is set, but
 * keeping casing consistent helps debugging when reading the SSML.
 */
/**
 * One phoneme-override entry. Pre-Wave-7 the table was
 * `Record<string, string>` (a bare word→IPA map). Wave 7 Track A7
 * (ticket 86c9y49cd, Amendment 1) widened it to also carry an
 * optional `tiers` array — the **tier-filter** that gates whether an
 * entry activates on a given utterance.
 *
 * Why the widening
 * ----------------
 * The letter-sounds tier emits canon utterances like
 * `"Which letter says mmm?"` (mnemonic English-letter approximations
 * of isolated phonemes per `design/word-song/letter-sounds-
 * content.md §2.3`). These mnemonics MUST be wrapped in
 * `<phoneme alphabet="ipa" ph="m">mmm</phoneme>` at render time so
 * Azure voices the phoneme correctly — but if the wrap fires
 * globally, real English words containing the mnemonic as a
 * substring or as a word-boundary token (`m` in "math", `o` in
 * "Read the dog", `a` in "Read the cat") would also be wrapped and
 * mispronounce CVC-tier utterances. The tier-filter scopes the wrap:
 * an entry with `tiers: ['letter-sounds']` activates ONLY when the
 * caller passes `tier: 'letter-sounds'` on `TtsRequest`.
 *
 * Back-compat shape
 * -----------------
 * Existing entries (e.g. `four`) carry `{ ipa: 'fɔːr' }` with NO
 * `tiers` field — `tiers === undefined` is the "global, activate on
 * every tier" sentinel. Pre-Amendment-1 callers that don't set
 * `TtsRequest.tier` keep their existing behaviour because:
 *   1. Global entries (no `tiers`) always activate.
 *   2. Tier-scoped entries only activate when `tier` matches — an
 *      undefined-tier caller never matches a tier-scoped entry.
 * So adding letter-sounds entries to the table is safe: existing
 * Math / CVC callers neither lose `four` nor gain spurious mnemonic
 * wraps.
 */
export interface PhonemeOverrideEntry {
  /** IPA pronunciation Azure will speak instead of the lexicon entry
   *  for the mnemonic word. Single ASCII-safe string with no XML
   *  metacharacters — placed verbatim inside `ph="..."`. */
  ipa: string
  /**
   * Optional tier-filter. When set, the entry activates ONLY when
   * the current `TtsRequest.tier` is one of these literals. When
   * undefined, the entry is global (activates on every tier — the
   * pre-Wave-7 behaviour, preserved for `four`).
   */
  tiers?: readonly string[]
}

const PHONEME_OVERRIDES: Record<string, PhonemeOverrideEntry> = {
  // Pre-Wave-7 entry — global (no `tiers`). Original ticket
  // 86c9kj2um docstring above explains the `four → /fɔːr/` rationale.
  // Stays back-compat under the widened shape: `tiers === undefined`
  // means "activate on every tier", which is exactly what the bare-
  // string `Record<string, string>` shape produced before.
  four: { ipa: 'fɔːr' },

  // "row" — global (no `tiers`). Voice-QA baseline fix (ticket
  // 86ca7u3gr, GitHub issue #372, cluster 1). en-GB-OliviaNeural reads
  // "row" in the "X in a row! Wow!" streak lines as /raʊ/ ("a row" = a
  // quarrel/argument) instead of /rəʊ/ ("a row" = a line of things).
  // The override pins the GOOSE/non-rhotic-British realisation /rəʊ/
  // so the streak praise reads as "a line of correct answers". Same
  // mechanism that fixed "four"; the hyphen-and-word-boundary guard in
  // applyPhonemeOverrides keeps it from firing inside larger words.
  row: { ipa: 'rəʊ' },

  // Letter-sounds tier mnemonic→IPA mappings (Wave 7 Track A7 —
  // Amendment 1 of ticket 86c9y49cd, per `design/word-song/letter-
  // sounds-content.md §2.3` table). Every entry carries
  // `tiers: ['letter-sounds']` so the wrap fires ONLY on
  // letter-sounds tier canon (where the utterance text is
  // `"Which letter says mmm?"`-shaped) and NEVER on other tiers
  // (where `mmm`, `o`, `a`, etc. could be substrings or word tokens
  // in real English content).
  //
  // Continuant consonants (sustained articulation — mnemonic is a
  // triplet so the visible word hints at sustained voicing):
  mmm: { ipa: 'm', tiers: ['letter-sounds'] },
  nnn: { ipa: 'n', tiers: ['letter-sounds'] },
  sss: { ipa: 's', tiers: ['letter-sounds'] },
  fff: { ipa: 'f', tiers: ['letter-sounds'] },
  // /v/ is a VOICED fricative — round-2 (Dave straggler spec) added a
  // schwa /ə/ tail so Olivia gives it an audible voiced run-out (a bare
  // /v/ rendered as a cold, near-silent onset). S/F/H (voiceless fric)
  // stay bare — they get their run-up from the flowing "says it" text
  // lead-in instead.
  //
  // ROUND-2 STRONGER (ticket 86ca7y0hj): the schwa tail (`və`) was not
  // enough — Thomas re-tested the current bytes and still heard "vvv is
  // still very scratchy" across all four /v/ slots (read/correct/hint/
  // giveAnswer). The residual scratch is the HARD ONSET: Olivia attacks a
  // bare /v/ as a loud, clipped buzz. A length mark on the fricative
  // (`vːə`) makes Olivia SUSTAIN the voiced labiodental into a smooth run
  // rather than a clipped burst, so the energy is spread over time instead
  // of front-loaded into a buzzy attack. Paired with the vvv-specific
  // softening prosody below (deeper rate + reduced volume) which tames the
  // loudness of the onset directly. Length-marked consonants are valid W3C
  // IPA and Olivia honours `<phoneme>` (the voice that ignores `<emphasis>`
  // still respects phoneme + prosody — see this file's history).
  vvv: { ipa: 'vːə', tiers: ['letter-sounds'] },
  lll: { ipa: 'l', tiers: ['letter-sounds'] },
  rrr: { ipa: 'r', tiers: ['letter-sounds'] },
  hhh: { ipa: 'h', tiers: ['letter-sounds'] },
  // Stop consonants. Round-2 (Dave straggler spec): MOST stops need a
  // schwa /ə/ release on Olivia — a bare stop rendered nearly silent
  // (Thomas's "B-silent" report generalised). Only the ALVEOLAR /t/
  // survives bare. Round-1 gave b/d/g the schwa (GREEN); round-2 adds
  // the schwa to the bilabial pair p/b and the velar pair k/g, leaving
  // /t/ as the sole bare stop.
  //   - /p/ /b/ (bilabial) → pə / bə
  //   - /t/        (alveolar) → t   (bare — survives)
  //   - /d/        (alveolar voiced) → də  (round-1 GREEN, kept)
  //   - /k/ /ɡ/ (velar)    → kə / ɡə
  // Keep U+0261 ɡ (script g), NOT ASCII g, on /ɡ/.
  //
  // K-KEY CONFLICT (Dave finding #5): `kuh` is a SINGLE override key
  // feeding BOTH the green K-read AND the broken K hint/correct/give.
  // Changing kuh → kə changes ALL K slots' render. Decision: apply
  // kə to the single key (no key-split, no read-text churn) and flag
  // K-read for re-audition on kə. Splitting into a read-only `k` key
  // would require the K-read mnemonic to differ from the other slots'
  // mnemonic text (same word "kuh" everywhere → cannot distinguish by
  // token within one tier), which would mean changing the read text
  // away from "kuh" — a bigger, more surprising change than letting
  // Thomas confirm K-read on kə. If kə regresses K-read, the follow-up
  // is a read-only key with a distinct read mnemonic.
  puh: { ipa: 'pə', tiers: ['letter-sounds'] },
  buh: { ipa: 'bə', tiers: ['letter-sounds'] },
  tuh: { ipa: 't', tiers: ['letter-sounds'] },
  duh: { ipa: 'də', tiers: ['letter-sounds'] },
  kuh: { ipa: 'kə', tiers: ['letter-sounds'] },
  guh: { ipa: 'ɡə', tiers: ['letter-sounds'] },
  // Vowels — TRIPLET mnemonics (NOT bare single letters). The triplet
  // is the load-bearing fix for the vowel double-wrap collision: the
  // letter-sounds canon emits BOTH the mnemonic AND the letter-NAME in
  // the same utterance (e.g. correct slot "Yes A says aaa."). With a
  // bare single-letter vowel key, the case-insensitive `\b`-bounded
  // regex matched BOTH the mnemonic "a" AND the letter-name "A" → both
  // rendered /æ/ → Thomas heard "Yes ahh says ahh" instead of "Yes
  // A[ay] says ahh[/æ/]". Consonants never collided (mnemonic "mmm" ≠
  // letter "M"); only vowels collided because the bare mnemonic equalled
  // the single-letter name. The triplet `aaa` ≠ the single letter-name
  // "A", so only the triplet is wrapped; the letter-name "A" stays bare
  // prose and Azure renders it as its native letter NAME ("ay").
  //
  // Sound-neutral: inside `<phoneme ph="æ">aaa</phoneme>` Azure uses
  // the `ph`, so "aaa" sounds identical to the bare "a" Thomas approved.
  // This restores Dave's Option 1 (triplet vowel mnemonics) from PR #355
  // that the British rollout (#356, branched from main) lost.
  //
  // Bare phonemes, no stress/length marks (the British Olivia treatment).
  // A and O are FROZEN (Thomas-approved): æ / ɒ. Round-2 (Dave straggler
  // spec) re-points u/i/e to en-GB lexical-set realisations because
  // Olivia mis-realises the bare phonemic /ʌ/ /ɪ/ /ɛ/:
  //   - /ʌ/ → ə   (STRUT vowel; fallback ɐ if ə regresses)
  //   - /ɪ/ → ɘ   (KIT — Dave flags this as the stubborn one; if I/E
  //                 still merge after this, next step is a lexicon probe)
  //   - /ɛ/ → e   (DRESS realised as cardinal e on en-GB Olivia)
  // All HYPOTHESIS pending Thomas's ear.
  aaa: { ipa: 'æ', tiers: ['letter-sounds'] },
  ooo: { ipa: 'ɒ', tiers: ['letter-sounds'] },
  uuu: { ipa: 'ə', tiers: ['letter-sounds'] },
  iii: { ipa: 'ɘ', tiers: ['letter-sounds'] },
  eee: { ipa: 'e', tiers: ['letter-sounds'] },
  // Round-3 (Dave round-3): EXAMPLE-WORD ANCHORING for the central/lax
  // vowels Olivia can't separate from bare IPA (ʌ/ə/ɘ collapse toward
  // æ; ɪ/ɘ merge). The "Primary" candidate pairs a short ISOLATE lead
  // (`uh` /ʌ/, `ih` /ɪ/) with a PLAIN-TEXT anchor word ("like in cup",
  // "like in ink"). Only the isolate lead is phoneme-wrapped here.
  //
  // CRITICAL: the anchor words `cup` and `ink` are deliberately
  // UN-WRAPPED — do NOT add them to this table. Their entire value is
  // Olivia's native lexicon voicing them correctly; wrapping them in a
  // <phoneme> would defeat the anchoring. The structured-literacy
  // pattern is "the sound, like in <real word the learner knows>".
  uh: { ipa: 'ʌ', tiers: ['letter-sounds'] },
  ih: { ipa: 'ɪ', tiers: ['letter-sounds'] },
}

/**
 * Wrap whole-word matches of `PHONEME_OVERRIDES` keys in
 * `<phoneme alphabet="ipa" ph="...">match</phoneme>`. Returns a string
 * that is partially-SSML — i.e. the matched-word regions contain raw
 * SSML markup, while the in-between plain regions are XML-escaped.
 *
 * Order of operations matters: we cannot escape the whole input first
 * (that would corrupt the phoneme markup we then inject) and we cannot
 * inject markup first then escape (that would escape our own tags
 * back into entity references). The function therefore alternates:
 * tokenise on word-boundary, escape plain segments, wrap target words.
 *
 * Word-boundary handling
 * ----------------------
 * The alternation pattern is built from active entries' keys.
 * JavaScript's `\b` is the standard ASCII word-boundary, which is
 * exactly the right primitive here:
 *   - "fourteen"      → "four" is followed by "t" (word char) → no \b
 *                       at the right edge → no match. Correct.
 *   - "fourth"        → same. Correct.
 *   - "afternoon"     → "four" not at a left word-boundary. Correct.
 *   - " four,"        → "four" is bordered by space and ",". Both are
 *                       non-word chars → both \b's fire → match.
 *   - "Four"          → at start of string (left \b is implicit) and
 *                       followed by space → match. Case-insensitive.
 *
 * The case-insensitive flag means we look up the entry via
 * `match.toLowerCase()` so the lookup table only needs lowercase keys.
 *
 * Tier filter (Wave 7 Track A7 — Amendment 1 of ticket 86c9y49cd)
 * ---------------------------------------------------------------
 * The optional `tierFilter` argument is the active utterance's tier
 * (e.g. `'letter-sounds'`, `'cvc-words'`). The alternation pattern
 * is built from ONLY those entries whose `tiers` field is undefined
 * (global) OR includes `tierFilter`. Tier-scoped entries with a
 * different tier (or `tierFilter` undefined) are silently skipped at
 * pattern-build time — they never reach the regex, so they cannot
 * match. This is the architectural seam that keeps the letter-sounds
 * mnemonics (`mmm`, `buh`, `o`, etc.) from polluting CVC-tier
 * renderings while still letting the legacy `four` override fire
 * globally.
 */
/**
 * Tier-scoped mnemonics that Olivia renders with a "scratchy" isolated
 * onset (ticket 86ca7u3gr cluster 5 — Thomas's ear). A bare short
 * phoneme on en-GB-OliviaNeural can come out as a hard, buzzy burst.
 * Slowing the phoneme region slightly with `<prosody rate>` softens the
 * onset/offset without changing the sound's identity. Activation is
 * opt-in per call (`softenScratchy`) because the same mnemonic is NOT
 * scratchy in every slot — e.g. "aaa" was clean in the read/hint slots
 * ("Which letter says aaa.", "Listen. aaa.") but scratchy in the
 * correct/giveAnswer slots where it trails its own letter-name. The
 * caller (`renderLetterSoundsInnerText`) decides per-slot whether to
 * pass the flag, so passing-baseline slots stay byte-identical.
 */
const SCRATCHY_MNEMONICS = new Set(['vvv', 'aaa', 'ooo'])
const SCRATCHY_PROSODY_RATE = '-12%'

/**
 * Per-mnemonic scratchy-softening prosody (ticket 86ca7y0hj — round-2
 * stronger). Round-1 (86ca7u3gr) wrapped EVERY scratchy mnemonic in a
 * single shared `<prosody rate="-12%">`. That GREENED aaa/ooo to Thomas's
 * ear but the /v/ slots were re-tested against the shipped bytes and STILL
 * came back "very scratchy" ×4. The /v/ scratch is louder/harder than the
 * vowel scratch (a voiced fricative attacks as a buzz, a vowel just needs
 * gentle slowing), so vvv needs a STRONGER prosody than the vowels:
 *
 *   • deeper rate (`-20%` vs `-12%`) — stretches the sustained `vːə` run
 *     so the smoothed onset has room to ramp instead of bursting.
 *   • reduced volume (`-12%`) — directly tames the loud buzzy attack that
 *     is the residual scratch; Olivia honours `<prosody volume>` (same
 *     attribute the top-level EMMA_VOICE_CONFIG sets at the speak root).
 *
 * aaa/ooo are LEFT on the `-12%`-rate / no-volume treatment so their
 * Thomas-approved (round-1 GREEN) bytes are preserved byte-for-byte — only
 * vvv's render changes. A mnemonic absent from this map falls back to the
 * shared rate-only prosody.
 */
interface ScratchyProsody {
  rate: string
  /** Optional `<prosody volume>`; omitted → no volume attribute (the
   *  round-1 aaa/ooo shape, kept byte-identical). */
  volume?: string
}
const SCRATCHY_PROSODY_BY_MNEMONIC: Record<string, ScratchyProsody> = {
  vvv: { rate: '-20%', volume: '-12%' },
}

export function applyPhonemeOverrides(
  text: string,
  tierFilter?: string,
  prependBreakMs?: number,
  softenScratchy = false,
): string {
  // Build the alternation pattern from ACTIVE entries: every entry
  // whose `tiers` is undefined (global) OR includes the supplied
  // tierFilter. New entries in PHONEME_OVERRIDES become matchable
  // automatically; tier-scoped entries never pollute callers that
  // pass a different tier.
  const activeEntries = Object.entries(PHONEME_OVERRIDES).filter(([, entry]) =>
    entry.tiers === undefined
      ? true
      : tierFilter !== undefined && entry.tiers.includes(tierFilter),
  )
  if (activeEntries.length === 0) return escapeSsml(text)
  const activeKeys = activeEntries.map(([key]) => key)
  // Lowercase keys that are TIER-SCOPED (carry a `tiers` array) — these
  // are the isolated-phoneme letter-sounds mnemonics (mmm, buh, aaa, …)
  // that need the prosodic-reset break. GLOBAL keys (four, row) are NOT
  // in this set, so they never receive the break (see breakTag below).
  const tierScopedKeys = new Set(
    activeEntries
      .filter(([, entry]) => entry.tiers !== undefined)
      .map(([key]) => key.toLowerCase()),
  )

  // Word boundary that ALSO treats a hyphen as a boundary character on
  // BOTH edges. Plain `\b` treats `-` as a non-word char, so `\bfour\b`
  // WRONGLY matches the "four" inside "twenty-four" — Azure then voices
  // "twenty" + a separate <phoneme>four</phoneme> with its own prosody
  // scope, producing the audible gap Thomas flagged (ticket 86ca7u3gr
  // cluster 3). Anchoring on `(?<![\w-])…(?![\w-])` keeps every existing
  // boundary guarantee (fourteen / fourth / Bartholomew still don't
  // match) AND stops a target word from firing as the tail/head of a
  // hyphenated compound, so "twenty-four" is voiced as one number.
  const pattern = new RegExp(
    `(?<![\\w-])(${activeKeys.join('|')})(?![\\w-])`,
    'gi',
  )

  // Walk the string emitting alternating escaped-plain and
  // phoneme-wrapped segments. We can't use replaceAll because plain
  // segments still need XML-escaping, which the replacer-callback
  // shape doesn't compose cleanly with (the surrounding non-match
  // text is passed through raw).
  const out: string[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = pattern.exec(text)) !== null) {
    // Plain segment before this match: XML-escape.
    if (m.index > lastIndex) {
      out.push(escapeSsml(text.slice(lastIndex, m.index)))
    }
    // Matched word: keep original casing inside the tag for log
    // readability. The IPA string is ASCII-clean (no XML
    // metacharacters) so no escaping needed on `ph=`.
    const original = m[0]
    const entry = PHONEME_OVERRIDES[original.toLowerCase()]!
    // `<break>` reset ONLY before a TIER-SCOPED isolated-phoneme
    // mnemonic (the letter-sounds reads/correct/hints). A GLOBAL word
    // like `four` / `row` that happens to appear in a letter-sounds
    // session-end line ("You earned four stars!", "Four in a row!
    // Wow!") must NOT get the break — the 300ms gap before "four"
    // made the streak/recap lines sound clipped/wrong-speed (ticket
    // 86ca7u3gr cluster 4a). Gating the break on tierScopedKeys keeps
    // the prosodic reset where it belongs (isolated phonemes) and
    // leaves connected prose flowing.
    const breakTag =
      prependBreakMs !== undefined &&
      prependBreakMs > 0 &&
      tierScopedKeys.has(original.toLowerCase())
        ? `<break time="${prependBreakMs}ms"/>`
        : ''
    // Scratchy-mnemonic softening (cluster 5): wrap the phoneme in a
    // gentle rate-slowing prosody so the isolated short sound doesn't
    // render as a hard buzzy burst. Opt-in per call AND per matched key
    // — only the scratchy classes (vvv/aaa/ooo) and only when the slot
    // caller asked for it. The prosody is per-mnemonic (round-2,
    // 86ca7y0hj): vvv gets a STRONGER rate + volume cut than the vowels,
    // which stay on the round-1 rate-only shape (byte-identical).
    const lower = original.toLowerCase()
    const soften = softenScratchy && SCRATCHY_MNEMONICS.has(lower)
    const phonemeTag = `<phoneme alphabet="ipa" ph="${entry.ipa}">${escapeSsml(original)}</phoneme>`
    if (soften) {
      const p = SCRATCHY_PROSODY_BY_MNEMONIC[lower] ?? {
        rate: SCRATCHY_PROSODY_RATE,
      }
      const volAttr = p.volume !== undefined ? ` volume="${p.volume}"` : ''
      out.push(
        `${breakTag}<prosody rate="${p.rate}"${volAttr}>${phonemeTag}</prosody>`,
      )
    } else {
      out.push(`${breakTag}${phonemeTag}`)
    }
    lastIndex = m.index + original.length
  }
  // Tail.
  if (lastIndex < text.length) {
    out.push(escapeSsml(text.slice(lastIndex)))
  }
  return out.join('')
}

/**
 * Letter-sounds tier inner-text rendering (en-GB-OliviaNeural).
 *
 * The base treatment is `applyPhonemeOverrides(text, 'letter-sounds',
 * 300)` — a 300ms break before each isolated-phoneme mnemonic so the
 * sound gets a clean prosodic reset. Two voice-QA-baseline refinements
 * layer on top (ticket 86ca7u3gr); both are SLOT-SHAPE-GATED so they
 * only touch the utterances Thomas flagged and leave every
 * passing-baseline slot byte-identical:
 *
 *   • Cluster 2 — pause after the leading "This one is <L>." sentence in
 *     the FRICATIVE giveAnswer shape ("This one is S. S says it. sss?").
 *     Olivia ran the letter sentence straight into "<L> says it…" with
 *     no audible beat despite the period. The plain non-fricative
 *     giveAnswer ("This one is M. mmm.") was clean on the baseline, so
 *     the break is gated to the "… says it." shape (S/F/H/V), NOT every
 *     giveAnswer.
 *
 *   • Cluster 5 — soften the scratchy vowel mnemonics (aaa/ooo) in the
 *     correct/giveAnswer slots where the mnemonic trails its own
 *     letter-name ("Yes. A. aaa.", "This one is A. aaa."), plus all four
 *     /v/ slots (vvv was scratchy in every slot). The read/hint slots
 *     for a/o were clean on the baseline, so they do NOT get softened.
 *
 * Slot is inferred from the text shape (no id is threaded to this
 * layer): the leading carrier word distinguishes correct ("Yes.") from
 * giveAnswer ("This one is") from read/hint.
 */
export function renderLetterSoundsInnerText(
  text: string,
  tierFilter: string,
): string {
  // Slot inference from the leading carrier.
  const isCorrect = /^Yes\. /.test(text) // "Yes. A. aaa." / "Yes. V says it. vvv?"
  const isGiveAnswer = /^This one is /.test(text)

  // Scratchy-softening is gated to the EXACT (slot × mnemonic) combos
  // Thomas flagged on the baseline — softening a passing slot would
  // re-render it and violate the targeted-only invariant. The combos:
  //   • vvv — scratchy in EVERY slot (read/correct/hint/giveAnswer all
  //           flagged) → soften whenever vvv is present.
  //   • aaa — scratchy in correct AND giveAnswer ("Yes. A. aaa.",
  //           "This one is A. aaa.") but CLEAN in read/hint → soften only
  //           in those two slots.
  //   • ooo — scratchy in correct ONLY ("Yes. O. ooo."); the O
  //           giveAnswer / read / hint all PASSED → soften only correct.
  const hasVvv = /\bvvv\b/.test(text)
  const hasAaa = /\baaa\b/.test(text)
  const hasOoo = /\booo\b/.test(text)
  const softenScratchy =
    hasVvv || (hasAaa && (isCorrect || isGiveAnswer)) || (hasOoo && isCorrect)

  // Post-"This one is <L>." break (cluster 2). Gated to the flagged
  // giveAnswer shapes only:
  //   • FRICATIVE giveAnswer "This one is <L>. <L> says it. <mnem>?"
  //     (S/F/H/V — the "<L> says it." second clause is the tell).
  //   • the scratchy-A giveAnswer "This one is A. aaa." (Thomas: "need a
  //     little break after This one is"). The O giveAnswer "This one is
  //     O. ooo." (same plain shape) PASSED, so the break is gated to the
  //     aaa mnemonic, NOT every plain-vowel giveAnswer.
  // Plain non-flagged giveAnswers (M/L/B/O/N/…) get NO break and stay
  // byte-identical to the baseline.
  const fricativeGiveAnswer = /^This one is ([A-Z])\.\s+\1 says it\./.test(text)
  const needsLeadBreak = fricativeGiveAnswer || (isGiveAnswer && hasAaa)

  if (needsLeadBreak) {
    // Split off the leading "This one is <L>." sentence and inject a
    // 350ms break before the remainder. Render each half independently
    // so the phoneme wrap + escaping compose.
    const lead = text.slice(0, text.indexOf('.') + 1) // "This one is S."
    const rest = text.slice(lead.length).replace(/^\s+/, '')
    return (
      `${applyPhonemeOverrides(lead, tierFilter)}` +
      `<break time="350ms"/>` +
      `${applyPhonemeOverrides(rest, tierFilter, 300, softenScratchy)}`
    )
  }

  return applyPhonemeOverrides(text, tierFilter, 300, softenScratchy)
}

/**
 * Letter-NAMES tier scratchy-hint softening (ticket 86ca7u3gr cluster
 * 5). The "Let's look. <L>." hint ends on an isolated letter NAME;
 * Olivia renders the terminal "e" with a clipped drum-beat and "O" with
 * a scratchy onset. Returns the softened inner-text when the utterance
 * is a flagged "Let's look. <e|O>." hint, or `null` to fall through to
 * the normal path (every other letter-names utterance — and the 6
 * passing hints C/G/J/b/W/d — render unchanged).
 *
 * The fix: a short lead `<break>` (clean prosodic reset before the
 * letter) + a gentle `<prosody rate>` around the final letter so it is
 * spoken a touch slower and softer. The letter glyph stays bare prose
 * so Azure still voices it as its NAME ("ee", "oh"), not a phoneme.
 *
 * ROUND-2 STRONGER (ticket 86ca7y0hj): on a re-test of the shipped bytes,
 * "e" GREENED at the round-1 `-12%` rate but "O" came back "still slightly
 * scratchy". The O letter-name ("oh") has a harder onset than "e" ("ee"),
 * so it needs a stronger softening: a deeper rate (`-18%`) plus a small
 * volume cut (`-8%`) to take the edge off the onset (Olivia honours
 * `<prosody volume>`). "e" is LEFT on the round-1 `-12%`-rate / no-volume
 * shape so its Thomas-approved bytes stay byte-for-byte identical — the
 * stronger treatment is gated to the O letter only.
 */
const LETTER_NAMES_SCRATCHY_PROSODY: Record<
  string,
  { rate: string; volume?: string }
> = {
  // Lowercase-keyed; "e" keeps the round-1 rate-only shape (byte-identical),
  // "O" gets the stronger round-2 rate + volume.
  e: { rate: '-12%' },
  o: { rate: '-18%', volume: '-8%' },
}
export function renderLetterNamesScratchyHint(
  text: string,
  tierFilter?: string,
): string | null {
  if (tierFilter !== 'letter-names') return null
  // Match exactly "Let's look. <L>." where <L> is a flagged letter.
  // Case-sensitive on the letter so only "e" (lowercase) and "O"
  // (uppercase) — the two Thomas flagged — are softened; the passing
  // hints carry different letters.
  const m = /^(Let's look\.)\s+([eO])\.\s*$/.exec(text)
  if (!m) return null
  const lead = m[1]! // "Let's look."
  const letter = m[2]! // "e" or "O"
  const p = LETTER_NAMES_SCRATCHY_PROSODY[letter.toLowerCase()] ?? {
    rate: '-12%',
  }
  const volAttr = p.volume !== undefined ? ` volume="${p.volume}"` : ''
  return (
    `${escapeSsml(lead)}` +
    `<break time="250ms"/>` +
    `<prosody rate="${p.rate}"${volAttr}>${escapeSsml(letter)}.</prosody>`
  )
}

/**
 * number-recog "Four comes after three." hint (ticket 86ca7u3gr cluster
 * 4b). Restores stress on the de-stressed mid-sentence "Four" so Olivia
 * gives it the long-vowel realisation instead of collapsing it to "for".
 *
 * NOTE: `<emphasis level="strong">` was tried first and Azure
 * en-GB-OliviaNeural IGNORED it — the re-render produced byte-identical
 * audio (same class as the parked `two → /tuː/` override that Olivia also
 * ignored, per the PHONEME_OVERRIDES history). `<prosody>` IS honoured by
 * this voice (it drives the question-prosody + scratchy-soften paths), so
 * we stress "Four" with prosody instead of emphasis.
 *
 * ROUND-2 STRONGER (ticket 86ca7y0hj): round-1 used rate `-18%` + a 200ms
 * lead break + the `fɔːr` phoneme. Thomas re-tested the shipped bytes and
 * still heard "for comes after three" — the override IS applying, but the
 * de-stressed mid-sentence position keeps collapsing the vowel toward the
 * reduced "for". Rate-slowing alone lengthens the vowel but does NOT
 * restore the PROMINENCE that distinguishes a stressed "four" from a
 * reduced "for". The acoustic correlate of lexical stress is primarily
 * PITCH (f0) prominence — so round-2 adds a pitch lift on the word, the
 * lever that actually separates stressed from reduced:
 *
 *   • pitch `+12%` — the dominant cue; lifts "Four" out of the
 *     carrier's flat de-stressed contour (Olivia honours `<prosody pitch>`
 *     — it drives the question-prosody path's `pitch="+8%"`).
 *   • rate `-25%` (deeper than round-1's -18%) — lengthens the long open-O
 *     so `fɔːr` reads as a full long vowel, not a clipped reduced one.
 *   • break `250ms` (up from 200ms) — fully isolates "Four" from the
 *     de-stressing "Look." carrier so the prosody reset lands cleanly.
 *
 * Text-shape-gated to this exact hint string so every other
 * (baseline-passing) "four" utterance renders unchanged. Returns the
 * full inner SSML for the match, or `null` to fall through.
 */
export function renderFourSubjectHint(
  text: string,
  tierFilter?: string,
): string | null {
  // Math tier only (tierFilter undefined). Match the exact hint text.
  if (tierFilter !== undefined) return null
  if (text !== 'Look. Four comes after three.') return null
  return (
    'Look. ' +
    '<break time="250ms"/>' +
    '<prosody pitch="+12%" rate="-25%">' +
    '<phoneme alphabet="ipa" ph="fɔːr">Four</phoneme>' +
    '</prosody>' +
    ' comes after three.'
  )
}

/** Render the inner-text region of the SSML body — the bit between
 *  `<prosody>` and `</prosody>`. Plain text is XML-escaped; if the
 *  utterance is a trailing interrogative (ends with `?`), the trailing
 *  clause is wrapped in `<emphasis level="moderate">` to nudge Azure
 *  Neural TTS into question prosody.
 *
 *  Why this exists (ticket 86c9gxup4)
 *  ----------------------------------
 *  Thomas reported that Math's hint utterance —
 *      "Look. {n}. And {m} more. How many now?"
 *  sounds robotic on "How many now?" when synthesized by
 *  `en-US-AnaNeural`. The trailing `?` reaches Azure intact, but Azure's
 *  prosody predictor doesn't reliably flip into question intonation on a
 *  short interrogative that follows a numeric clause. Wrapping the
 *  trailing clause in `<emphasis level="moderate">` is the canonical
 *  Azure recipe for this — voice-and-region-stable, no namespace
 *  declarations required (standard W3C SSML 1.0).
 *
 *  Detection rule
 *  --------------
 *  - Text trimmed to end in `?`              → wrap trailing clause.
 *  - Anything else (declarative, exclamation) → escape unchanged.
 *
 *  "Trailing clause" = the substring after the last sentence-ending
 *  punctuation (`.`, `!`, `?`) followed by whitespace, or the entire
 *  string if there is no such boundary. The leading portion (everything
 *  before the trailing clause) and the clause itself are escaped
 *  independently and joined with the raw SSML tags around the clause.
 *
 *  SSML strategy (updated after `<emphasis>` alone proved insufficient):
 *  1. `<break time="250ms"/>` before the clause — resets the prosody
 *     predictor so it doesn't carry flat numeric intonation forward.
 *  2. `<prosody pitch="+8%" rate="-5%">` — raises pitch and slows
 *     slightly, forcing rising question intonation.
 *  The combination reliably produces natural question prosody on
 *  AnaNeural for patterns like "Three plus two. How many?" where
 *  `<emphasis>` alone left the trailing clause flat/robotic.
 *
 *  Backward-compat
 *  ---------------
 *  Declaratives (which is every non-hint utterance Math/WordSong emits
 *  today: greetings, problem reads, correct/reprompt/giveAnswer lines)
 *  are unchanged on the wire. The only utterances affected are those
 *  ending with `?` — that is the bug class. */
export function renderSsmlInnerText(text: string, tierFilter?: string): string {
  // Letter-sounds tier (British-voice rollout): the question-prosody
  // wrapper (`<break/><prosody pitch="+8%" rate="-5%">`) is DELIBERATELY
  // NOT applied here, even when the read line ends with `?`. Per the
  // ear-test cycle, letter-sounds reads carry their intonation cue via
  // the sound-class-dependent terminal punctuation already baked into
  // the canon text (declarative for voiced sounds, question for
  // voiceless), and en-GB-OliviaNeural renders that natively. Layering
  // the +8% pitch / -5% rate question-prosody on top scratched the
  // isolated phoneme. Instead, letter-sounds gets a 300ms `<break>`
  // injected immediately before each mnemonic phoneme (inside
  // applyPhonemeOverrides) for a clean prosodic reset. The
  // question-prosody wrapper stays in force for EVERY OTHER tier
  // (math "How many?", word-song reprompts, etc.) via the fall-through
  // below.
  if (tierFilter === 'letter-sounds') {
    return renderLetterSoundsInnerText(text, tierFilter)
  }
  // Letter-NAMES tier (ticket 86ca7u3gr cluster 5): the "Let's look.
  // <L>." hint ends on an isolated letter NAME. Olivia renders the
  // terminal "e" with a clipped drum-beat pressure and "O" with a
  // scratchy onset (Thomas's ear). A short lead break + a gentle
  // rate-slow prosody around the final letter softens both. Gated to
  // the EXACT flagged letters (e, O) so the 6 passing letter-names
  // hints (C/G/J/b/W/d) stay byte-identical.
  const lnHint = renderLetterNamesScratchyHint(text, tierFilter)
  if (lnHint !== null) return lnHint
  // number-recog "Four comes after three." hint (ticket 86ca7u3gr
  // cluster 4b; round-2 stronger in 86ca7y0hj): on en-GB-OliviaNeural
  // (non-rhotic) the mid-sentence, de-stressed "Four" collapses toward
  // unstressed "for" — even with the global fɔːr phoneme override, because
  // the rhotic /r/ the override leans on is not realised as a consonant on
  // this voice and the de-stressed position robs the vowel of length.
  // Sentence-FINAL fours ("Two plus four.") stayed clear on Thomas's
  // baseline because the question break + final position keep them
  // stressed. We restore stress with a <prosody pitch+rate> wrap (NOT
  // <emphasis> — Olivia ignores emphasis on this voice; see
  // renderFourSubjectHint's doc). Text-shape-gated to this single hint
  // string so every other "four" utterance (all baseline-passing) stays
  // byte-identical.
  const fourSubjectHint = renderFourSubjectHint(text, tierFilter)
  if (fourSubjectHint !== null) return fourSubjectHint
  // Use the original text for boundary detection (we want to operate on
  // un-escaped characters). Trailing whitespace doesn't matter for the
  // ends-in-? check.
  const trimmed = text.replace(/\s+$/, '')
  if (!trimmed.endsWith('?')) {
    // Plain text path: applyPhonemeOverrides handles escaping AND
    // wraps target words in <phoneme> tags so Azure picks the
    // designed pronunciation deterministically. tierFilter gates
    // tier-scoped entries (Wave 7 Track A7 — Amendment 1).
    return applyPhonemeOverrides(text, tierFilter)
  }
  // Find the last sentence-ending boundary BEFORE the trailing clause.
  // Pattern matches `. ` / `! ` / `? ` — punctuation followed by
  // whitespace. We only consider boundaries inside the trimmed region;
  // if none exist, the whole utterance is the trailing clause.
  const boundary = /[.!?]\s+/g
  let lastEnd = -1
  let m: RegExpExecArray | null
  while ((m = boundary.exec(trimmed)) !== null) {
    // Skip a match whose punctuation is the very last char of trimmed —
    // that is the trailing `?` itself with no clause after it.
    if (m.index + m[0].length >= trimmed.length) break
    lastEnd = m.index + m[0].length
  }
  // Preserve any trailing whitespace from the original input by appending
  // it after the closing tag (it doesn't affect prosody but keeps round-
  // trippability for callers that compare strings).
  const trailingWs = text.slice(trimmed.length)
  const QUESTION_WRAP_OPEN =
    '<break time="250ms"/><prosody pitch="+8%" rate="-5%">'
  const QUESTION_WRAP_CLOSE = '</prosody>'
  // Both the lead clause and the trailing-question clause are run
  // through applyPhonemeOverrides so any tier-scoped or global
  // mnemonic landing in either half is voiced from IPA. The phoneme
  // element nests cleanly inside the prosody element per the Azure
  // SSML grammar.
  if (lastEnd === -1) {
    return `${QUESTION_WRAP_OPEN}${applyPhonemeOverrides(trimmed, tierFilter)}${QUESTION_WRAP_CLOSE}${trailingWs}`
  }
  const lead = trimmed.slice(0, lastEnd)
  const clause = trimmed.slice(lastEnd)
  return `${applyPhonemeOverrides(lead, tierFilter)}${QUESTION_WRAP_OPEN}${applyPhonemeOverrides(clause, tierFilter)}${QUESTION_WRAP_CLOSE}${trailingWs}`
}

/** Build the SSML body sent to Azure. All four prosody attribute fields
 *  (voice/rate/pitch/volume) are XML-escaped in addition to `text`. Today
 *  these all come from the hardcoded `EMMA_VOICE_CONFIG`, but the
 *  function is exported and `TtsRequest` accepts arbitrary strings —
 *  escaping is cheap defense-in-depth against a future caller passing
 *  user-derived prosody values into a single-quoted attribute slot.
 *
 *  `xml:lang="en-US"` is set on the speak element per Azure docs; the
 *  service is more strict about this than the old Edge endpoint was.
 *
 *  Inner-text rendering goes through `renderSsmlInnerText` so that
 *  trailing-interrogative utterances pick up an `<emphasis>` prosody
 *  hint (see that function's doc for the full rationale, ticket
 *  86c9gxup4). */
export function buildSsmlBody(req: TtsRequest): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">` +
    `<voice name="${escapeSsml(req.voice)}">` +
    `<prosody pitch="${escapeSsml(req.pitch)}" rate="${escapeSsml(req.rate)}" volume="${escapeSsml(req.volume)}">` +
    `${renderSsmlInnerText(req.text, req.tier)}` +
    `</prosody></voice></speak>`
  )
}

/** Map an upstream non-2xx into a stable, named Error. The outer
 *  `_session.ts` and `claude.ts` both wrap this in the public `tts-failed`
 *  response shape; the message text is preserved for log diagnosis but is
 *  not user-facing and does not echo any secret value. */
export function describeAzureFailure(status: number, bodyHint: string): Error {
  const trimmed = bodyHint.trim().slice(0, 200)
  // 401 is almost always a stale or wrong AZURE_SPEECH_KEY. 403 likewise
  // (region/key mismatch counts as auth-shaped). 429 is rate-limit (F0
  // tier ceiling or burst control). 5xx is upstream — retry-class.
  if (status === 401 || status === 403) {
    return new Error(`tts auth failed (${status}): check AZURE_SPEECH_KEY`)
  }
  if (status === 429) {
    return new Error(`tts rate limited (429): Azure throttled the request`)
  }
  if (status >= 500 && status < 600) {
    return new Error(
      `tts upstream error (${status}): Azure returned 5xx${trimmed ? ` — ${trimmed}` : ''}`,
    )
  }
  return new Error(`tts http error (${status})${trimmed ? `: ${trimmed}` : ''}`)
}

/** Test seam — a fetch-shaped function. Defaults to `globalThis.fetch`. */
export type FetchFn = typeof fetch

/**
 * Backoff/retry policy for transient Azure failures (429 + 5xx). Tunables
 * exposed for testability — production callers use the defaults.
 *
 * Rationale (ticket 86c9kjdh2)
 * ----------------------------
 * As of 2026-05-01 the production session-start path was 100% failing on
 * the very first 429 from Azure F0. The fix is twofold:
 *   - Retry transient failures (429 with Retry-After or default backoff;
 *     5xx single retry).
 *   - Soft-fail at the session level (api/_session.ts) so a per-utterance
 *     final failure leaves the rest of the batch intact.
 *
 * 5 retries × cap=3000ms => worst-case ~6s of wall time for one utterance
 * (200 + 400 + 800 + 1600 + 3000). That is acceptable on a single
 * rendering and is bounded above by the per-utterance hard timeout.
 */
export interface BackoffPolicy {
  /** Max retry attempts beyond the initial request. Default 5. */
  maxAttempts?: number
  /** Base delay for the exponential schedule, in ms. Default 200. */
  baseDelayMs?: number
  /** Cap on a single backoff delay, in ms. Default 3000. */
  maxDelayMs?: number
  /** ± random jitter applied per delay, in ms. Default 50. */
  jitterMs?: number
  /** Test seam: sleep for `ms`. Defaults to a real setTimeout-backed sleep. */
  sleepFn?: (ms: number) => Promise<void>
  /** Test seam: random number generator returning [0, 1). Default Math.random. */
  randomFn?: () => number
}

/** Resolved policy with all defaults applied. Internal. */
interface ResolvedBackoffPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  jitterMs: number
  sleepFn: (ms: number) => Promise<void>
  randomFn: () => number
}

const DEFAULT_BACKOFF: ResolvedBackoffPolicy = {
  maxAttempts: 5,
  baseDelayMs: 200,
  maxDelayMs: 3_000,
  jitterMs: 50,
  sleepFn: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  randomFn: Math.random,
}

function resolveBackoff(p: BackoffPolicy = {}): ResolvedBackoffPolicy {
  return {
    maxAttempts: p.maxAttempts ?? DEFAULT_BACKOFF.maxAttempts,
    baseDelayMs: p.baseDelayMs ?? DEFAULT_BACKOFF.baseDelayMs,
    maxDelayMs: p.maxDelayMs ?? DEFAULT_BACKOFF.maxDelayMs,
    jitterMs: p.jitterMs ?? DEFAULT_BACKOFF.jitterMs,
    sleepFn: p.sleepFn ?? DEFAULT_BACKOFF.sleepFn,
    randomFn: p.randomFn ?? DEFAULT_BACKOFF.randomFn,
  }
}

/**
 * Parse an Azure `Retry-After` header value (RFC 7231). Returns the
 * number of milliseconds to wait, or null if the header is absent /
 * malformed.
 *
 * Two formats per spec:
 *   - `Retry-After: <seconds>` (e.g. `Retry-After: 1`)
 *   - `Retry-After: <HTTP-date>` (e.g. `Retry-After: Wed, 21 Oct 2026 07:28:00 GMT`)
 *
 * For the date form we compute `target - now`. A negative or zero result
 * is treated as "ready immediately" → 0ms (don't sleep). Anything we can't
 * parse returns null so the caller falls back to the exponential default.
 */
export function parseRetryAfterMs(
  header: string | null,
  now: number = Date.now(),
): number | null {
  if (header === null) return null
  const trimmed = header.trim()
  if (trimmed === '') return null
  // Pure non-negative seconds form (integer or decimal). Use a strict
  // regex first so we don't mis-interpret `-1` as a year ordinal in
  // Date.parse (which on some platforms returns a valid epoch ms for
  // single-digit "year" inputs).
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const asNumber = Number(trimmed)
    if (Number.isFinite(asNumber) && asNumber >= 0) {
      return Math.round(asNumber * 1000)
    }
  }
  // HTTP-date form. Date.parse returns NaN for most unparseable strings,
  // but it's lenient enough to accept some non-date inputs (e.g. single
  // digits as year ordinals on some platforms). Require at least one
  // alphabetic character — every legitimate HTTP-date carries a weekday
  // or month name (RFC 7231 §7.1.1.1) — to gate the date-parse path.
  if (!/[A-Za-z]/.test(trimmed)) return null
  const asDate = Date.parse(trimmed)
  if (Number.isFinite(asDate)) {
    const delta = asDate - now
    return delta > 0 ? delta : 0
  }
  return null
}

/**
 * Compute the backoff delay (ms) for a given retry attempt under the
 * exponential schedule. `attempt` is 1-indexed for the first retry.
 *
 *   attempt=1 → base × 2^0 = base
 *   attempt=2 → base × 2^1 = 2×base
 *   attempt=N → base × 2^(N-1), capped at maxDelayMs
 *
 * Jitter is applied as ±jitterMs uniform; final value is clamped to
 * [0, maxDelayMs + jitterMs] to avoid pathological negatives.
 */
export function computeBackoffDelayMs(
  attempt: number,
  policy: BackoffPolicy = {},
): number {
  const p = resolveBackoff(policy)
  const exp = p.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1))
  const capped = Math.min(exp, p.maxDelayMs)
  const jitter = (p.randomFn() * 2 - 1) * p.jitterMs
  const delay = capped + jitter
  return Math.max(0, Math.round(delay))
}

/**
 * Issue a fetch with retry on Azure transient failures.
 *
 * Behaviour
 * ---------
 *  - 429: parse `Retry-After`. If present and parseable, sleep for that
 *    duration (capped at maxDelayMs to avoid huge waits if Azure tells us
 *    "come back in 30s"). If absent/malformed, fall back to the
 *    exponential schedule with jitter.
 *  - 5xx (500-599): retry with the exponential schedule. Capped at one
 *    retry — if Azure's edge is flaky, a single retry usually clears it;
 *    a sustained 5xx storm should propagate as a hard error.
 *  - 2xx / other 4xx: return the response as-is. The caller maps non-2xx
 *    to named errors via `describeAzureFailure`.
 *  - Network errors (fetch throws): propagate without retry. Timeouts
 *    are owned by the caller's AbortController.
 *
 * Returns the final Response (success or terminal failure). Caller is
 * responsible for the non-2xx → Error mapping.
 */
export async function fetchWithBackoff(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
  policy: BackoffPolicy = {},
): Promise<Response> {
  const p = resolveBackoff(policy)
  let attempt = 0
  let serverErrorRetried = false

  // First attempt + up to maxAttempts retries.
  // Loop bound: maxAttempts + 1 total network calls.
  // We deliberately do not retry on network exceptions — those are owned
  // by the caller's timeout / AbortController seam.

  while (true) {
    const response = await fetchFn(url, init)

    // 2xx — done.
    if (response.status < 400) return response

    // 429 — rate limited.
    if (response.status === 429) {
      attempt += 1
      if (attempt > p.maxAttempts) return response

      const retryAfterMs = parseRetryAfterMs(
        response.headers.get('Retry-After'),
      )
      // Drain the body so the underlying connection can be reused.
      try {
        await response.text()
      } catch {
        // best-effort drain
      }

      const delay =
        retryAfterMs !== null
          ? Math.min(retryAfterMs, p.maxDelayMs)
          : computeBackoffDelayMs(attempt, p)
      if (delay > 0) await p.sleepFn(delay)
      continue
    }

    // 5xx — retry once with exponential cadence. After that, propagate.
    if (response.status >= 500 && response.status < 600) {
      if (serverErrorRetried) return response
      serverErrorRetried = true
      attempt += 1
      if (attempt > p.maxAttempts) return response

      try {
        await response.text()
      } catch {
        // best-effort drain
      }

      const delay = computeBackoffDelayMs(attempt, p)
      if (delay > 0) await p.sleepFn(delay)
      continue
    }

    // Other 4xx — terminal, no retry.
    return response
  }
}

export interface SynthesizeOptions {
  /** Test seam: fetch implementation. Defaults to `globalThis.fetch`. */
  fetchFn?: FetchFn
  /** Hard timeout for a single utterance in ms. Defaults to 8s. */
  timeoutMs?: number
  /** Test seam: schedule a timeout. Defaults to setTimeout. */
  setTimeoutFn?: (cb: () => void, ms: number) => unknown
  /** Test seam: cancel a timeout. Defaults to clearTimeout. */
  clearTimeoutFn?: (handle: unknown) => void
  /** Test seam: env snapshot. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv
  /** Backoff policy for 429/5xx retries. Defaults to the exponential
   *  schedule documented on `BackoffPolicy`. Set
   *  `{ maxAttempts: 0 }` to disable retries entirely (some test paths
   *  want the legacy single-shot behavior). */
  backoff?: BackoffPolicy
}

/**
 * Synthesize one utterance via Azure Speech REST. POSTs an SSML body to
 * `https://{region}.tts.speech.microsoft.com/cognitiveservices/v1` with
 * `Ocp-Apim-Subscription-Key` auth and the standard 24kHz/48kbps mono MP3
 * output format header. Resolves with the response body bytes; rejects on
 * non-2xx with a named error (`describeAzureFailure`) or on timeout.
 *
 * One HTTPS call per utterance — same dispatch shape as the prior WSS
 * implementation. The fan-out / concurrency cap lives in `_session.ts`.
 */
export async function synthesizeUtterance(
  req: TtsRequest,
  opts: SynthesizeOptions = {},
): Promise<TtsResult> {
  const fetchFn = opts.fetchFn ?? globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const scheduleTimeout = opts.setTimeoutFn ?? ((cb, ms) => setTimeout(cb, ms))
  const cancelTimeout =
    opts.clearTimeoutFn ??
    ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))

  if (typeof fetchFn !== 'function') {
    throw new Error(
      'tts misconfigured: globalThis.fetch is not available — is this running on the Vercel Node runtime?',
    )
  }

  const { key, region } = readAzureCredentials(opts.env)
  const endpoint = buildAzureEndpoint(region)
  const body = buildSsmlBody(req)

  // Diagnostic instrumentation (ticket 86c9hjnn8 follow-up). Logs the
  // SSML body fingerprint to Vercel function logs so we can correlate
  // a "client played silently" iPad capture with whatever SSML the
  // server actually rendered. No client-side gate — this is on Vercel
  // logs which are private and only carry text we constructed (no PII;
  // every input here is non-user content from the static session
  // plan). Fields:
  //   - ssmlPreview: first 200 chars of the SSML body
  //   - ssmlSha256: full SHA256 hash of the body — lets us check if
  //     two utterances rendered the same SSML, and lets us match a
  //     server log to a client cache hit.
  //   - ssmlLength: total length so a "got 800B back, expected ~3KB"
  //     mismatch is one-shot diagnosable.
  //   - voice / rate / pitch: the per-utterance prosody combo.
  // The log line is structured (single console.log of an object) so
  // Vercel's log explorer keeps it queryable.
  //
  // Suppressed under `NODE_ENV === 'test'` so the existing _tts test
  // suite doesn't gain ~37 noisy log lines per run. Vercel's
  // serverless runtime sets NODE_ENV='production', so the log fires
  // exactly where we want it (real /api/_tts invocations). We read
  // process.env directly here (not opts.env) — opts.env is the Azure
  // credential override, but the test-suppression flag is a runtime
  // property of the host node process, which is what NODE_ENV
  // actually reflects.
  const suppressLog = process.env.NODE_ENV === 'test'
  if (!suppressLog) {
    console.log({
      event: 'tts-render',
      voice: req.voice,
      rate: req.rate,
      pitch: req.pitch,
      ssmlLength: body.length,
      ssmlPreview: body.slice(0, 200),
      ssmlSha256: createHash('sha256').update(body).digest('hex'),
    })
  }

  // AbortController gives us a cancellation handle the fetch implementation
  // honours natively. We wrap it in the existing setTimeout/clearTimeout
  // seam so the timeout test can run synchronously without real timers.
  const controller = new AbortController()
  let timedOut = false
  const timeoutHandle = scheduleTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  let response: Response
  try {
    response = await fetchWithBackoff(
      fetchFn,
      endpoint,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          // `; charset=utf-8` is the root-cause fix for ticket 86c9qhr91.
          // Without an explicit charset, Azure's SSML endpoint sometimes
          // decodes the request bytes as Windows-1252, which then re-encodes
          // through UTF-8 on the way to the synthesizer and produces classic
          // mojibake — em-dash (U+2014, UTF-8 `E2 80 94`) ends up vocalized
          // as the bytes `c3 a2 e2 82 ac e2 80 9d` ("â€"" rendered as
          // letters → "asesinati"-shaped gibberish). Pinning charset=utf-8
          // forces a single, correct UTF-8 decode on Azure's side regardless
          // of host default. Defense-in-depth alongside the canon-lint rule
          // that bans non-ASCII characters at bake-time (ticket 86c9qhr9k);
          // the lint stays as the primary gate, this header makes the bake
          // pipeline correct so unicode punctuation is safe to re-introduce
          // in the future without producing TTS gibberish.
          'Content-Type': 'application/ssml+xml; charset=utf-8',
          'X-Microsoft-OutputFormat': AZURE_OUTPUT_FORMAT,
          'User-Agent': USER_AGENT,
        },
        body,
        signal: controller.signal,
      },
      opts.backoff,
    )
  } catch (err) {
    cancelTimeout(timeoutHandle)
    if (timedOut) {
      throw new Error(`tts timeout after ${timeoutMs}ms`, { cause: err })
    }
    throw err instanceof Error ? err : new Error(String(err), { cause: err })
  }

  cancelTimeout(timeoutHandle)

  if (!response.ok) {
    // Drain the body so the underlying socket can be reused; capture the
    // first 200 chars for the named-error message but never log the auth
    // header value.
    let bodyHint = ''
    try {
      bodyHint = await response.text()
    } catch {
      // best-effort
    }
    throw describeAzureFailure(response.status, bodyHint)
  }

  const buf = await response.arrayBuffer()
  return { audio: new Uint8Array(buf) }
}

/** Encode a Uint8Array as base64. Server-side only — uses Node's Buffer. */
export function uint8ToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}
