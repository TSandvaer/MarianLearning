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
  // Global (no `tiers`). Original ticket 86c9kj2um introduced `four → /fɔːr/`
  // (rhotic long-O) to defeat the "for" homophone on the US Emma voice.
  //
  // ROUND-5 AUDITION WINNER (variant f2 "Centring diphthong", ticket
  // 86ca8c3t7): on en-GB-OliviaNeural (NON-rhotic) the rhotic `/r/` in
  // `fɔːr` is not realised as a consonant, and the bare long-O still
  // collapsed toward the reduced "for" in de-stressed positions (issue
  // #417: "four stars" → "for stars"; "Four comes after three" → "for…").
  // The audition page proved the centring diphthong `/fɔə/` gives the vowel
  // more body and reads distinct from "for" — Thomas's f2 pick. Switching
  // the GLOBAL override to `fɔə` makes EVERY "four" inherit the diphthong
  // (recap "four stars", streak "Four in a row", math reads), so the fix is
  // structural, not per-utterance. The mid-sentence de-stress case still
  // needs a stress lift on top — see renderFourSubjectHint.
  four: { ipa: 'fɔə' },

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
  // ROUND-5 AUDITION WINNER (variant v2 "Pitch-lowered", ticket 86ca8c3t7):
  // rounds 1 (`və` + rate-12%) and 2 (`vːə` + rate-20%/vol-12%) were BOTH
  // rejected ×4 — the residual was a hard, buzzy ONSET on the voiced
  // labiodental. The voice-audition page (scripts/voiceAuditionVariants.ts)
  // explored several mechanisms; Thomas picked v2: the bare schwa-tail
  // phoneme `və` (NO length mark) paired with a PITCH-LOWERED prosody
  // (`pitch="-3st"`). A lower f0 voiced fricative buzzes less harshly — the
  // length-mark sustain (round-2) attacked duration but not the onset
  // harshness; dropping the pitch attacks the buzz directly. Rate `-15%` +
  // volume `-20%` complete the softening. IPA reverts to `və`; the per-
  // mnemonic prosody below carries the pitch/rate/volume.
  vvv: { ipa: 'və', tiers: ['letter-sounds'] },
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
 * Per-mnemonic scratchy-softening prosody. Round-1 (86ca7u3gr) wrapped
 * EVERY scratchy mnemonic in a single shared `<prosody rate="-12%">`. That
 * GREENED aaa/ooo but the /v/ slots stayed "very scratchy" ×4 through two
 * more rounds.
 *
 * ROUND-5 AUDITION WINNER (variant v2 "Pitch-lowered", ticket 86ca8c3t7):
 * the residual /v/ scratch is a hard, buzzy ONSET, not a duration problem.
 * Round-2's deeper rate + volume cut on a length-marked `vːə` did not move
 * it. The winning lever is PITCH: a lower f0 voiced fricative buzzes less.
 *
 *   • pitch (`-3st`) — the NEW dominant cue; drops the f0 of the buzz so
 *     the onset reads soft instead of harsh. Olivia honours `<prosody
 *     pitch>` (it drives the question-prosody + four-stress paths).
 *   • rate (`-15%`) — gentle slowing, lighter than round-2's `-20%`.
 *   • volume (`-20%`) — tames the loud attack directly.
 *
 * aaa/ooo are LEFT on the `-12%`-rate / no-volume treatment so their
 * Thomas-approved (round-1 GREEN) bytes are preserved byte-for-byte — only
 * vvv's render changes. A mnemonic absent from this map falls back to the
 * shared rate-only prosody.
 */
interface ScratchyProsody {
  /** Optional `<prosody pitch>`; omitted → no pitch attribute. */
  pitch?: string
  rate: string
  /** Optional `<prosody volume>`; omitted → no volume attribute (the
   *  round-1 aaa/ooo shape, kept byte-identical). */
  volume?: string
}
const SCRATCHY_PROSODY_BY_MNEMONIC: Record<string, ScratchyProsody> = {
  vvv: { pitch: '-3st', rate: '-15%', volume: '-20%' },
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
      // Attribute ORDER is pitch → rate → volume (mirrors the speak-root
      // EMMA_VOICE_CONFIG prosody order) so emitted SSML reads consistently.
      const pitchAttr = p.pitch !== undefined ? ` pitch="${p.pitch}"` : ''
      const volAttr = p.volume !== undefined ? ` volume="${p.volume}"` : ''
      out.push(
        `${breakTag}<prosody${pitchAttr} rate="${p.rate}"${volAttr}>${phonemeTag}</prosody>`,
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
 * ROUND-2 STRONGER (ticket 86ca7y0hj): "e" GREENED at the round-1 `-12%`
 * rate but "O" came back "still slightly scratchy"; round-2 deepened O's
 * rate to `-18%` + a `-8%` volume cut. Thomas re-tested and STILL heard
 * "weird pressure on O" (issue #417) — the rate-slow was OVER-articulating
 * the onset.
 *
 * ROUND-5 AUDITION WINNER (variant o3 "Lower pitch + soft", ticket
 * 86ca8c3t7): the voice-audition page proved the "pressure" was an f0
 * prominence artefact of the rate-slow, not duration. The winning o3
 * treatment DROPS the rate change entirely and instead lowers PITCH
 * (`-2st`) at a natural rate, with a `-12%` volume cut and a shorter 200ms
 * lead break. Because o3 changes the prosody structure (no rate attr, the
 * period sits OUTSIDE the prosody, 200ms break), the O branch is emitted
 * separately from the "e" branch — "e" keeps its Thomas-approved round-1
 * shape byte-for-byte (250ms break, rate `-12%`, period inside).
 */
const LETTER_E_SCRATCHY_RATE = '-12%'
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
  if (letter === 'O') {
    // Round-5 audition winner o3 — break OUTSIDE the lead-space, pitch-drop
    // prosody around the bare letter, period OUTSIDE the prosody. Matches
    // scripts/voiceAuditionVariants.ts `O_LETTER` variant o3 exactly so the
    // baked bytes reproduce Thomas's approved audition render.
    return (
      `${escapeSsml(lead)} ` +
      `<break time="200ms"/>` +
      `<prosody pitch="-2st" volume="-12%">O</prosody>` +
      `${escapeSsml('.')}`
    )
  }
  // "e" — unchanged round-1 shape (byte-identical to the Thomas-approved
  // render): no space, 250ms break, rate-only prosody, period inside.
  return (
    `${escapeSsml(lead)}` +
    `<break time="250ms"/>` +
    `<prosody rate="${LETTER_E_SCRATCHY_RATE}">${escapeSsml(letter)}.</prosody>`
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
 * ROUND-2 STRONGER (ticket 86ca7y0hj): round-1 (`fɔːr` + rate-18%) and
 * round-2 (`fɔːr` + pitch+12% + rate-25% + 250ms break) were BOTH rejected
 * — Thomas still heard "for comes after three". The rhotic `fɔːr` leans on
 * an `/r/` consonant en-GB-OliviaNeural does not realise, and pitch/rate
 * alone did not separate the de-stressed vowel from the reduced "for".
 *
 * ROUND-5 AUDITION WINNER (variant f2 "Centring diphthong", ticket
 * 86ca8c3t7): the voice-audition page proved the fix is the VOWEL SHAPE.
 * The centring diphthong `/fɔə/` (non-rhotic — the actual en-GB
 * realisation) gives "Four" more body and is audibly distinct from "for".
 * The global `four` override now carries `fɔə` (see PHONEME_OVERRIDES), so
 * the only extra work here is the stress lift that rescues the mid-sentence
 * de-stress: a light `pitch="+8%"` (the f2 audition value, NOT the rejected
 * `+12%`). No rate change — the diphthong itself carries the length.
 *
 * LIVE-TEXT NOTE: the canon hint text is now "Four comes after three."
 * (sentence-INITIAL "Four", no "Look." carrier — the legacy
 * "Look. Four comes after three." / math.p6.hint was removed in #413, this
 * is math.p6.hint2). Sentence-initial "Four" needs no lead break (nothing
 * precedes it to reset from). The legacy "Look."-prefixed string is still
 * matched defensively (harmless; emits the audition's break+lead shape).
 *
 * ROUND-6 STRONGER (GitHub issue #446): round-5's f2 winner
 * (`fɔə` + pitch+8%) was re-tested on the LIVE bytes and STILL read as "for
 * comes after three" — the round-5 audition was run on the OLD "Look."-
 * prefixed text, but the live canon is the sentence-initial "Four comes after
 * three." (changed in #413), where "Four" runs straight into "comes" with no
 * carrier-break before it and is swallowed into the connected-speech onset.
 * Diagnosis (probed via ssml_probe): the override IS emitting `fɔə`+pitch into
 * the baked SSML; the IPA/pitch values just aren't separating the word from
 * "for" in this connected position. Round-6 adds the audition's untested
 * stronger levers together: (a) a LENGTHENED diphthong `fɔːə` for more vowel
 * body, (b) a steeper pitch lift (+12%) + slight rate-slow (-12%) to give the
 * word its own stress island, and (c) a 120ms break AFTER "Four" so the word
 * decays before "comes" instead of being clipped into it. Still text-shape-
 * gated; every baseline-passing "four" stays on the plain global `fɔə`.
 *
 * Text-shape-gated to these exact hint strings so every other
 * (baseline-passing) "four" utterance renders on the plain global `fɔə`
 * override. Returns the full inner SSML for the match, or `null`.
 */
export function renderFourSubjectHint(
  text: string,
  tierFilter?: string,
): string | null {
  // Math tier only (tierFilter undefined).
  if (tierFilter !== undefined) return null
  // Live text (math.p6.hint2): sentence-initial "Four", no lead carrier.
  if (text === 'Four comes after three.') {
    return (
      '<prosody pitch="+12%" rate="-12%">' +
      '<phoneme alphabet="ipa" ph="fɔːə">Four</phoneme>' +
      '</prosody>' +
      '<break time="120ms"/>' +
      ' comes after three.'
    )
  }
  // Legacy "Look."-prefixed text (removed from canon in #413) — matched
  // defensively with the f2 audition's lead-break shape.
  if (text === 'Look. Four comes after three.') {
    return (
      'Look. ' +
      '<break time="200ms"/>' +
      '<prosody pitch="+8%">' +
      '<phoneme alphabet="ipa" ph="fɔə">Four</phoneme>' +
      '</prosody>' +
      ' comes after three.'
    )
  }
  return null
}

/**
 * Session-end recap-4 line "You earned four stars!" (GitHub issue #446 —
 * `wrong-speed` + de-stress collapse).
 *
 * Thomas's ear: "it sounds like she is saying 'you earned for stars' not
 * '..four stars'". Two coupled defects on this ONE line:
 *   1. De-stress collapse — mid-sentence "four" between "earned" and "stars"
 *      reduces to "for" on non-rhotic Olivia, exactly like the math
 *      "Four comes after three." case. The global `fɔə` override alone (the
 *      only thing this line gets today) does not separate it.
 *   2. `wrong-speed` — the line reads rushed. There is no per-line rate
 *      treatment on session-end recaps today; the whole line rides the
 *      default rate-10%.
 *
 * Both are fixed in one wrap: stress-lift + lengthened diphthong on "four"
 * (the math-hint mechanism), nested inside a whole-line rate-slow that
 * un-rushes the delivery. The line is short and celebratory, so a -10%
 * line-level slow on top of the global -10% reads as warm, not sluggish.
 *
 * Text-shape-gated to the exact recap-4 string. The other recap lines
 * (recap.1 "You earned one star!" … recap.11) are NOT touched — they passed
 * Thomas's baseline and stay byte-identical on the global path.
 */
export function renderRecapFourStars(text: string): string | null {
  // Session-end utterances render with tierFilter = the owning file stem
  // for word-song tiers (e.g. 'letter-sounds') and undefined for math.
  // The recap line is byte-shared across all 24 tier files, so it can
  // arrive under ANY tierFilter. Gate on the text only.
  if (text !== 'You earned four stars!') return null
  return (
    '<prosody rate="-10%">' +
    'You earned ' +
    '<prosody pitch="+12%">' +
    '<phoneme alphabet="ipa" ph="fɔːə">four</phoneme>' +
    '</prosody>' +
    ' stars!' +
    '</prosody>'
  )
}

/**
 * Session-end streak-4 line "Four in a row! Wow!" (GitHub issue #446 —
 * `mispronounced` "row").
 *
 * Thomas's ear: "Emma should say 'Rou' like a line of something. But she says
 * 'Rau' as in an argument." This is the GOAT-vs-MOUTH split: "row" (a line)
 * is /rəʊ/, "row" (a quarrel) is /raʊ/. The global `row → rəʊ` override
 * (added round-4, ticket 86ca7u3gr) IS emitting into the baked SSML
 * (verified via ssml_probe: `<phoneme ph="rəʊ">row</phoneme>`) — but Olivia
 * is STILL landing the /aʊ/ realisation. The bare schwa-onset diphthong isn't
 * pulling her far enough toward GOAT.
 *
 * Round-6 strengthens the GOAT realisation specifically on this line: the IPA
 * uses the fuller GOAT nucleus `əʊ` with a lengthened offglide `əʊː` plus a
 * light stress-lift so the diphthong is articulated rather than reduced, and
 * the "Four" gets the same lengthened-diphthong rescue as the other two clips
 * (it shares the de-stress risk in sentence-initial position before "in").
 *
 * The global `row → rəʊ` override stays in PHONEME_OVERRIDES for every OTHER
 * "row" context; this helper is text-shape-gated to the streak-4 line only,
 * so the other streak lines (streak.3/5/6/7/8) stay byte-identical.
 */
export function renderStreakFourRow(text: string): string | null {
  if (text !== 'Four in a row! Wow!') return null
  return (
    '<phoneme alphabet="ipa" ph="fɔːə">Four</phoneme>' +
    ' in a ' +
    '<prosody pitch="+6%" rate="-10%">' +
    '<phoneme alphabet="ipa" ph="ɹəʊː">row</phoneme>' +
    '</prosody>' +
    '! Wow!'
  )
}

/**
 * Phonologically-weak sight words that de-stress to an inaudible schwa as
 * bare TTS tokens (Dave's W11-01 ruling, ticket 86ca7xmr8). On the iPad
 * speaker "Find the word: the." or "Look. The." swallows the target word
 * to near-silence unless the target token is stressed. Dave prescribed
 * `<emphasis level="strong">` — but en-GB-OliviaNeural IGNORES `<emphasis>`
 * (byte-identical re-render; documented in planner-and-canon.md
 * §"SSML-on-Olivia findings" + PR #384). Olivia DOES honour `<prosody>`,
 * so we implement Dave's INTENT via a pitch-lift + slight rate-slow on the
 * target token — the same mechanism `renderFourSubjectHint` uses to rescue
 * the de-stressed mid-sentence "Four". Pitch is the stress lever on this
 * voice (PR #384).
 */
const SIGHT_WORDS_WEAK_TOKENS: ReadonlySet<string> = new Set([
  'the',
  'a',
  'of',
  'in',
  'to',
])

/** Stress prosody for a weak sight-word target token. Pitch-lift restores
 *  audible stress; the small rate-slow lengthens the vowel so the word
 *  isn't swallowed by the carrier. Slightly stronger lift than the
 *  question-prosody (+8% / -5%) because these tokens start from a
 *  de-stressed schwa and need more rescue. */
const SIGHT_WORD_STRESS_OPEN = '<prosody pitch="+10%" rate="-10%">'
const SIGHT_WORD_STRESS_CLOSE = '</prosody>'

/**
 * Sight-words tier inner-text rendering (ticket 86ca7xmr8, Wave 11). The
 * sight-words mechanic uses three utterance shapes whose TARGET token sits
 * at a fixed position:
 *   - read:    "Find the word: <word>."   → target after the colon
 *   - hint:    "Look. <Word>."            → target after "Look."
 *   - correct: "Yes! <Word>."             → target after "Yes!"
 * When the target token is one of the phonologically-weak words
 * (the/a/of/in/to) it is wrapped in the stress prosody above so it stays
 * audible on the iPad speaker. Crucially, ONLY the TARGET token is
 * wrapped — the carrier "the" in "Find the word:" stays bare prose, so a
 * read line "Find the word: the." stresses only the second "the".
 *
 * Returns the rendered inner SSML for a matched sight-words utterance, or
 * `null` to fall through to the default plain-text path (which handles
 * non-weak targets — "was", "said", "go", etc. — unchanged, since those
 * are not in SIGHT_WORDS_WEAK_TOKENS and need no stress fix).
 *
 * The canon utterance TEXT stays plain ("Find the word: the.") — the
 * stress is a bake-time render detail, transparent to the browser parser
 * (which never sees the SSML). This mirrors the letter-sounds
 * mnemonic-wrap architecture: text plain, audio shaped.
 */
export function renderSightWordsInnerText(
  text: string,
  tierFilter?: string,
): string | null {
  if (tierFilter !== 'sight-words') return null
  // Each pattern captures: group 1 = the carrier prefix (escaped as-is),
  // group 2 = the target token, group 3 = the trailing terminal + ws.
  const shapes: ReadonlyArray<RegExp> = [
    /^(Find the word:\s+)([A-Za-z]+)(\.\s*)$/,
    /^(Look\.\s+)([A-Za-z]+)(\.\s*)$/,
    /^(Yes!\s+)([A-Za-z]+)(\.\s*)$/,
  ]
  for (const shape of shapes) {
    const m = shape.exec(text)
    if (m === null) continue
    const prefix = m[1]!
    const token = m[2]!
    const tail = m[3]!
    if (!SIGHT_WORDS_WEAK_TOKENS.has(token.toLowerCase())) {
      // Strong-enough target (was/said/go/...) — no stress fix needed.
      // Fall through to the default plain-text path for byte-stability.
      return null
    }
    return (
      `${escapeSsml(prefix)}` +
      `${SIGHT_WORD_STRESS_OPEN}${escapeSsml(token)}${SIGHT_WORD_STRESS_CLOSE}` +
      `${escapeSsml(tail)}`
    )
  }
  return null
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
/**
 * Simple-sentences tier (Wave 13, ticket 86ca8e6fr) — gap-token render
 * substitution. The canon read TEXT carries the literal `___` gap token
 * (three ASCII underscores) so the browser parser can split it out to
 * build the displayed `sentenceFrame` (Kyle §1.2, §4). But Azure must
 * SPEAK the word "blank" at the gap (it cannot vocalise underscores). So
 * at synthesize time we substitute `___` → "blank" — text-plain, audio
 * shaped, exactly the letter-sounds / sight-words bake-time pattern (the
 * stored canon text is unaffected; only the SSML the voice reads changes).
 *
 * Returns the gap-substituted text (for the simple-sentences tier) so the
 * caller continues through the normal prosody/escape path — the
 * substitution is purely a token swap on the un-escaped text. For any
 * other tier returns the text unchanged.
 */
export function substituteSentenceGap(
  text: string,
  tierFilter?: string,
): string {
  if (tierFilter !== 'simple-sentences') return text
  // Replace every run of EXACTLY three underscores with the spoken word
  // "blank", padded so it sits as its own word in the flow. The canon
  // invariant is one gap per read line, but replaceAll is defensive.
  return text.replace(/_{3}/g, 'blank')
}

// ── CVC phoneme-blend prompt render (ticket 86c9qa6n3) ──────────────────────
//
// The `blend` utterance (CVC tiers only — the 6th word-song slot) sounds the
// word out grapheme-by-grapheme, then says it whole: "c — a — t … cat". The
// stored canon `text` is the human-readable segmented form; this transform
// segments it, voices each grapheme as its PHONEME (IPA `<phoneme>` wrap —
// the same machinery the letter-sounds tier uses), injects `<break>`s between
// graphemes and before the whole word, voices the whole word NATURALLY (no
// phoneme wrap — Marian hears the blended target), and slows the whole line
// to rate -12% ("let's slow down and sound it out").
//
// CANON-TEXT SEPARATOR — ASCII-7, NOT em-dash. Kyle's spec §"Blend-audio
// utterances" / Q2 proposes em-dash `—` + ellipsis `…` separators. But
// `scripts/canonLint.ts` rejects ALL non-ASCII codepoints in canon `text`
// (em-dash U+2014, ellipsis U+2026 both trip `RE_NON_ASCII`; see
// `.claude/docs/planner-and-canon.md` §"Stick to ASCII-7 punctuation" — the
// PR #192 em-dash mojibake). So the canonical STORED form is ASCII-7:
//
//     <g1> - <g2> - <g3> ... <word>    e.g.  "c - a - t ... cat"
//
// (space-hyphen-space between graphemes; space-3dots-space before the whole
// word). This transform splits on EITHER the ASCII form OR Kyle's em-dash
// form defensively, so a future canon that ships the em-dash form still
// renders — but the lint-clean ASCII form is the one to bake. Flagged back to
// Kyle/Thomas as the Q2 resolution (the caption-ribbon display is a separate
// presentation concern — WordSong can prettify ` - ` → ` — ` at render time
// without touching the lint-gated canon text).
//
// `/ks/` GRAPHEME — `box`/`fox` decode `x` as the cluster /ks/ as ONE grapheme
// token. The blend canon text carries `b - o - x ... box`; the synth wraps the
// `x` grapheme in `<phoneme ph="ks">`. Token count stays wordLength+1 (4).
//
// Grapheme → IPA. CVC graphemes only. Short vowels use the en-GB realisations
// the letter-sounds tier settled on (a→æ, o→ɒ; the central/lax u/i/e use the
// same lexical-set picks as `PHONEME_OVERRIDES`'s uuu/iii/eee). Consonants
// map to their bare IPA; `x` is the /ks/ cluster. A grapheme absent from the
// map is voiced bare (defensive — should never happen for CVC content).
const BLEND_GRAPHEME_IPA: Record<string, string> = {
  // short vowels (mirror PHONEME_OVERRIDES aaa/ooo/uuu/iii/eee)
  a: 'æ',
  o: 'ɒ',
  u: 'ə',
  i: 'ɘ',
  e: 'e',
  // consonants (bare IPA; voiced/voiceless as the letter-sounds tier voices
  // isolated phonemes)
  b: 'b',
  c: 'k',
  d: 'd',
  f: 'f',
  g: 'ɡ',
  h: 'h',
  // /dʒ/ (affricate). Pass-8 (Thomas, ear-test of audition j2, 2026-06-18):
  // recovered the LAST blend FLOOR. The winning lever is the SAME held +
  // schwa-tail length mark that recovered /v/+/w/ in pass-7 — but applied as a
  // BARE `<phoneme>` (NOT the nested `<prosody rate="-25%">` wrap /f/+/s/+/v/+/w/
  // take). The affricate cannot be "held" the way a continuant is, but the
  // length-mark + schwa tail (`dʒːə`) gives Olivia enough duration to articulate
  // the stop-burst-into-fricative cleanly instead of scratching. Because it is a
  // bare phoneme (no nested prosody), it ALSO renders on the production runtime
  // Azure resource that 400s the nested onset — so /dʒ/ is NOT runtime-floored
  // (unlike /f/+/s/+/v/+/w/, which stay bake-only). j is therefore NO LONGER in
  // BLEND_FLOOR_GRAPHEMES (which is now empty). See the audition j2 candidate in
  // scripts/blendDjVvAuditionVariants.ts (origin/devon/blend-dj-vv-audition).
  j: 'dʒːə',
  k: 'k',
  l: 'l',
  m: 'm',
  n: 'n',
  p: 'p',
  r: 'r',
  s: 's',
  t: 't',
  v: 'v',
  w: 'w',
  y: 'j',
  z: 'z',
  // two-phoneme grapheme — x decodes as the cluster /ks/ (box, fox)
  x: 'ks',
}

/** Inter-grapheme pause (ms) — short beat AFTER each sounded phoneme (the stop
 *  releases into this silence rather than being preceded by a dead gap that
 *  forces an unreleased, scratchy onset). Candidate-f placement. */
const BLEND_GRAPHEME_BREAK_MS = 250
/** Pre-whole-word pause (ms) — the "…" beat where the blend resolves. */
const BLEND_WHOLE_WORD_BREAK_MS = 450

/** Stop consonants — the graphemes whose isolated phoneme is unreleased and
 *  scratches on Azure neural. These are the ONLY graphemes that get the clipped
 *  `<stop>ə` release (candidate f, Thomas-approved 2026-06-15, voice-QA #463);
 *  every other grapheme (continuant consonant or vowel) stays bare IPA.
 *  `c`/`k` both decode to /k/; `x`=/ks/ ends in a stop but is a cluster — left
 *  BARE (the cluster's /s/ tail releases it naturally, and a `ksə` would read
 *  as "kss-uh"). The trailing `ə` is an INAUDIBLE coarticulation release a real
 *  en-GB synthetic-phonics teacher uses, NOT a full "kuh" syllable. */
const BLEND_STOP_GRAPHEMES: ReadonlySet<string> = new Set([
  'b',
  'c',
  'd',
  'g',
  'k',
  'p',
  't',
])

// ── pass-5 full-fidelity fricative + floor treatment ────────────────────────
//
// Pass-4 ear-test (Thomas, 2026-06-15) settled the per-CLASS isolated-phoneme
// renders. The candidate-f baseline above (stop `<stop>ə` release, everything
// else BARE) cleared the stop scratch but two fricative classes still needed
// bespoke shaping, and three voiced onsets scratched in isolation no matter the
// treatment. Pass-5 baked /f/+/s/ held-fricatives and FLOORED /v/+/dʒ/+/w/.
// Pass-7 (Thomas, 2026-06-17) RECOVERED /v/ and /w/ with the SAME held +
// schwa-tail length-mark shape that won /f/+/s/ (`vːə`/`wːə` @ -25%).
// Pass-8 (Thomas, 2026-06-18) RECOVERED the LAST floor, /dʒ/, via audition j2
// (`dʒːə` — the same held + schwa-tail length mark, but as a BARE `<phoneme>`,
// NOT the nested `<prosody>` wrap the fricative onsets take). The affricate
// can't be "held" like a continuant, yet the length mark + schwa tail gives
// Olivia enough duration to articulate the burst-into-fricative cleanly.
// BLEND_FLOOR_GRAPHEMES is now EMPTY. Net per-class:
//
//   • /h/  → `hə` (fric-rel)  — the pass-2 form Thomas accepted for hat/hen.
//   • /f/  → a length-marked, rate-slowed onset: a one-level
//            `<prosody rate="-25%"><phoneme ph="fːə">f</phoneme></prosody>`
//            followed by a 150ms settle break, THEN the candidate-f beat.
//   • /s/  → the same nested-prosody onset shape with `ph="sːə"`.
//   • /v/  → the same shape with `ph="vːə"` (pass-7; recovered from FLOOR).
//   • /w/  → the same shape with `ph="wːə"` (pass-7; held glide + schwa tail).
//   • /dʒ/(j) → a BARE `<phoneme ph="dʒːə">j</phoneme>` (pass-8; recovered from
//            FLOOR). Lives in BLEND_GRAPHEME_IPA, NOT the nested fricative-onset
//            table — so unlike /f/+/s/+/v/+/w/ it is ALSO runtime-safe (the bare
//            phoneme renders on the production resource that 400s the nested
//            onset). No word is floored anymore.
//
// RUNTIME-REACHABILITY (the reason this is opt-in). The graduation cvc-words
// path renders blend lines LIVE at runtime (cache-miss, no canon) — see
// audio-system.md `wordSongPathA` graduation branch + planner-and-canon.md
// graduation bypass. The production Vercel runtime Azure resource REJECTS the
// nested-prosody-around-a-phoneme onset shape `/f/`,`/s/` use with HTTP 400
// (bare phonemes 200; the `<prosody><phoneme></prosody>` onset 400s). The BAKE
// resource (local westeurope creds, pass-4: 0 rejections) ACCEPTS it. So the
// full-fidelity render is OPT-IN, taken ONLY by the canon bake; the runtime
// default is the plain whole-word floor, which carries no nested prosody and no
// `<phoneme>` and therefore always renders on the rejecting resource.

/** Held-onset graphemes that get the length-marked, rate-slowed nested-prosody
 *  onset in FULL-FIDELITY mode. `/f/`+`/s/` are fricatives; `/v/`+`/w/` are a
 *  voiced fricative + glide that the pass-7 ear-test recovered with the SAME
 *  held + schwa-tail length-mark shape. `/h/` is handled separately (`hə`
 *  fric-rel, no nested prosody). Each maps to the length-marked IPA used in the
 *  onset wrap. NOTE: all of these use the nested `<prosody><phoneme></prosody>`
 *  shape the production runtime resource 400s — so they are full-fidelity (bake)
 *  ONLY; the runtime default is the plain whole-word floor for every word. */
const BLEND_FRICATIVE_ONSET_IPA: Record<string, string> = {
  f: 'fːə',
  s: 'sːə',
  v: 'vːə',
  w: 'wːə',
}
/** Rate slow applied to the fricative onset's nested `<prosody>` (FULL-FIDELITY
 *  only). NOTE: this is the nested shape the production runtime resource 400s. */
const BLEND_FRICATIVE_ONSET_RATE = '-25%'
/** Settle break (ms) after a fricative onset, before the candidate-f beat. */
const BLEND_FRICATIVE_SETTLE_BREAK_MS = 150
/** `/h/` fric-rel release (pass-2 form Thomas accepted for hat/hen). */
const BLEND_H_FRIC_REL_IPA = 'hə'

/** Onsets that scratch in isolation on every treatment, EVEN with the best
 *  available lever. In FULL-FIDELITY mode a word containing ANY of these renders
 *  as the whole-word FLOOR shape (no per-grapheme segmentation).
 *
 *  EMPTY as of pass-8 (Thomas, 2026-06-18). /dʒ/ (`j`) was the last floored
 *  grapheme; the audition j2 candidate (`dʒːə` bare held + schwa-tail length
 *  mark — the same lever that recovered /v/+/w/ in pass-7) cleared the scratch,
 *  so `j` moved from FLOOR into BLEND_GRAPHEME_IPA as a normal segmented onset.
 *  The set is retained (not deleted) so a future class that genuinely cannot be
 *  recovered has a typed home; `wordIsFloored` returns false for every word
 *  while it is empty. */
const BLEND_FLOOR_GRAPHEMES: ReadonlySet<string> = new Set([])

/** Whole-word floor rate-slow — the runtime-safe shape's leading `<prosody>`
 *  (PLAIN text inside, no `<phoneme>`, no nesting). */
const BLEND_FLOOR_RATE = '-15%'

/** True if a parsed blend word must take the whole-word FLOOR render in
 *  full-fidelity mode (its graphemes include a scratchy voiced onset). */
function wordIsFloored(graphemes: readonly string[]): boolean {
  return graphemes.some((g) => BLEND_FLOOR_GRAPHEMES.has(g.toLowerCase()))
}

/** The whole-word floor inner-text: `<prosody rate>word</prosody>` + break +
 *  bare word. PLAIN text only — no `<phoneme>`, no nested prosody — so it
 *  renders on the production runtime Azure resource that 400s the fricative
 *  onset. This is BOTH the runtime-safe default render AND the per-word fallback
 *  for floored voiced onsets in full-fidelity mode. */
function renderBlendFloorInnerText(word: string): string {
  const w = escapeSsml(word)
  return (
    `<prosody rate="${BLEND_FLOOR_RATE}">${w}</prosody>` +
    `<break time="${BLEND_WHOLE_WORD_BREAK_MS}ms"/>${w}`
  )
}

/**
 * Parse a stored blend canon text into `{ graphemes, word }`, or `null` if
 * the text isn't blend-shaped. Accepts BOTH the lint-clean ASCII form
 * (`"c - a - t ... cat"`) and Kyle's em-dash/ellipsis form
 * (`"c — a — t … cat"`) defensively. The grapheme/word split:
 *   - segments are separated by ` - ` (ASCII) or ` — ` (em-dash);
 *   - the whole word follows ` ... ` (ASCII) or ` … ` (ellipsis).
 * Returns the leading graphemes (each a 1-char grapheme except the `x`
 * cluster which stays one token) and the trailing whole word.
 */
export function parseBlendText(
  text: string,
): { graphemes: string[]; word: string } | null {
  const trimmed = text.trim()
  // Split off the whole word on the ellipsis separator (ASCII "..." or "…").
  const wholeWordSplit = trimmed.split(/\s*(?:\.\.\.|…)\s*/)
  if (wholeWordSplit.length !== 2) return null
  const [segmentPart, word] = wholeWordSplit
  if (!segmentPart || !word || /\s/.test(word.trim())) return null
  // Split the grapheme segment on the inter-grapheme separator (" - " or
  // " — "). A bare single grapheme (no separator) is still valid (degenerate).
  const graphemes = segmentPart
    .split(/\s*(?:-|—)\s*/)
    .map((g) => g.trim())
    .filter(Boolean)
  if (graphemes.length === 0) return null
  return { graphemes, word: word.trim() }
}

/** CVC tiers whose `blend` utterances get the phoneme-segmented render. The
 *  set is the CVC-words family (short-a through short-e) — `effectiveFocusNode`
 *  passes these as the `tierFilter`. Digraph / non-CVC tiers never emit a
 *  `blend` slot, so they never reach this transform. */
const BLEND_CVC_TIERS: ReadonlySet<string> = new Set([
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
])

/**
 * Render a CVC phoneme-blend prompt to SSML inner-text, or `null` if the
 * text isn't a blend line (so the caller falls through to the normal path).
 *
 * TWO RENDER MODES (pass-5, ticket 86ca…blend-pass5; Thomas-decided 2026-06-16):
 *
 * 1. RUNTIME-SAFE (DEFAULT, `blendFullFidelity` falsy) — render the ENTIRE word
 *    as the whole-word FLOOR shape: `<prosody rate="-15%">word</prosody>` +
 *    break + bare word. NO segmentation, NO nested prosody, NO `<phoneme>`.
 *    Plain text only, so it always renders on the production runtime Azure
 *    resource that REJECTS (HTTP 400) the full-fidelity fricative onset. The
 *    graduation cvc-words path renders blend lines LIVE at runtime (cache-miss),
 *    so the default MUST be the resource-safe shape. Fail-safe by construction.
 *
 * 2. FULL-FIDELITY (OPT-IN, `blendFullFidelity === true`) — the per-class
 *    segmented render the canon BAKE takes (the bake resource accepts the nested
 *    onset; pass-4 proved 0 rejections). Per grapheme:
 *      • STOP consonants (b/c/k/d/g/p/t) → clipped `<stop>ə` IPA release
 *        (candidate-f, voice-QA #463). INAUDIBLE coarticulation, NOT "kuh".
 *      • /f/, /s/, /v/, /w/ HELD onsets → a length-marked, rate-slowed nested
 *        onset `<prosody rate="-25%"><phoneme ph="fːə"/sːə"/vːə"/wːə">…</phoneme>
 *        </prosody>` + a 150ms settle break (the nested shape the runtime
 *        resource 400s — which is exactly why mode 1 exists). /v/+/w/ recovered
 *        from FLOOR in pass-7 (Thomas, 2026-06-17).
 *      • /h/ → `hə` fric-rel (pass-2 form Thomas accepted for hat/hen).
 *      • CONTINUANTS (m/n/l/r/y/z) + VOWELS → BARE IPA (sustain in isolation).
 *      • `x` = /ks/ cluster → BARE (its /s/ tail self-releases).
 *      • /dʒ/(j) → a BARE `<phoneme ph="dʒːə">j</phoneme>` held + schwa-tail
 *        onset (pass-8, audition j2). Recovered from FLOOR; rides the normal
 *        bare-IPA path (BLEND_GRAPHEME_IPA), so BLEND_FLOOR_GRAPHEMES is empty
 *        and `wordIsFloored` returns false for every word.
 *    Break placed AFTER each phoneme so the stop releases into the silence; no
 *    whole-LINE `<prosody rate>` wrap (the house rate -10% governs).
 *
 * Gated by tier (the CVC tiers) so a CVC `read`/`correct`/`hint` line that
 * happens to contain a hyphen or ellipsis never accidentally renders as a
 * blend — `parseBlendText` only matches the segmented `<g> ... <word>` shape,
 * and the caller additionally gates on the utterance being the `blend` slot
 * via the tier filter + the shape match.
 */
export function renderBlendInnerText(
  text: string,
  tierFilter?: string,
  blendFullFidelity = false,
): string | null {
  if (tierFilter === undefined || !BLEND_CVC_TIERS.has(tierFilter)) return null
  const parsed = parseBlendText(text)
  if (parsed === null) return null

  // RUNTIME-SAFE default: whole-word floor render. No segmentation, no nested
  // prosody, no <phoneme> — survives the production runtime resource that 400s
  // the full-fidelity fricative onset. The graduation live-render path lands
  // here (it never sets blendFullFidelity).
  if (!blendFullFidelity) {
    return renderBlendFloorInnerText(parsed.word)
  }

  // FULL-FIDELITY (bake-only). A word whose graphemes include any FLOOR onset
  // floors WHOLE — the segmented render is skipped entirely. As of pass-8 the
  // floor set is EMPTY (/v/+/w/ recovered pass-7; /dʒ/ recovered pass-8 via the
  // bare `dʒːə` onset), so this never fires today. The guard stays so a future
  // genuinely-unrecoverable class can be re-floored by adding its grapheme to
  // BLEND_FLOOR_GRAPHEMES alone.
  if (wordIsFloored(parsed.graphemes)) {
    return renderBlendFloorInnerText(parsed.word)
  }

  const parts: string[] = []
  for (const grapheme of parsed.graphemes) {
    const g = grapheme.toLowerCase()
    const fricativeOnset = BLEND_FRICATIVE_ONSET_IPA[g]
    if (fricativeOnset !== undefined) {
      // /f/, /s/, /v/, /w/ → length-marked, rate-slowed NESTED-PROSODY onset,
      // then a short settle break. This is the shape the runtime resource
      // rejects; only the bake (full-fidelity) ever emits it.
      parts.push(
        `<prosody rate="${BLEND_FRICATIVE_ONSET_RATE}">` +
          `<phoneme alphabet="ipa" ph="${escapeSsml(fricativeOnset)}">${escapeSsml(grapheme)}</phoneme>` +
          `</prosody>` +
          `<break time="${BLEND_FRICATIVE_SETTLE_BREAK_MS}ms"/>`,
      )
      // Then the candidate-f beat (break AFTER) like every other grapheme.
      parts.push(`<break time="${BLEND_GRAPHEME_BREAK_MS}ms"/>`)
      continue
    }
    const ipa = BLEND_GRAPHEME_IPA[g]
    if (ipa !== undefined) {
      // /h/ → `hə` fric-rel; STOPs → clipped `<stop>ə`; continuants + vowels
      // stay bare. The grapheme glyph is visible inside the tag; Azure uses `ph=`.
      let released = ipa
      if (g === 'h') {
        released = BLEND_H_FRIC_REL_IPA
      } else if (BLEND_STOP_GRAPHEMES.has(g)) {
        released = `${ipa}ə`
      }
      parts.push(
        `<phoneme alphabet="ipa" ph="${escapeSsml(released)}">${escapeSsml(grapheme)}</phoneme>`,
      )
    } else {
      // Defensive: an unmapped grapheme is voiced bare (escaped).
      parts.push(escapeSsml(grapheme))
    }
    // Break AFTER each phoneme (candidate f) — the stop releases into the pause.
    parts.push(`<break time="${BLEND_GRAPHEME_BREAK_MS}ms"/>`)
  }
  // The whole word: a longer break, then the word voiced NATURALLY (no
  // phoneme wrap) so Marian hears the blended target as one word.
  parts.push(`<break time="${BLEND_WHOLE_WORD_BREAK_MS}ms"/>`)
  parts.push(escapeSsml(parsed.word))

  // No whole-line <prosody rate> wrap — candidate f renders at the speak-root
  // house rate (-10%); the -12% rate-slow over-articulated the onset.
  return parts.join('')
}

export function renderSsmlInnerText(
  text: string,
  tierFilter?: string,
  blendFullFidelity = false,
): string {
  // Session-end recap-4 / streak-4 lines (GitHub issue #446). These two
  // utterances are byte-SHARED across all 24 tier files
  // (every track ends with the same SessionEnd sequence), so the failing
  // itemId is owned by whichever file sorts first in the voice-QA dedup —
  // `letter-sounds#session.end.recap.4` / `.streak.4`. That means they
  // render under `tierFilter === 'letter-sounds'`, which hits the
  // letter-sounds EARLY-RETURN below before any "four"/"row" fix could run.
  // They are text-shape-gated and tier-agnostic, so they MUST be checked
  // FIRST — before the simple-sentences gap-substitution and the
  // letter-sounds early-return — or the fix never reaches the flagged
  // bytes. Both helpers return null for every other utterance, so this is
  // a no-op for the entire rest of the canon.
  const recapFour = renderRecapFourStars(text)
  if (recapFour !== null) return recapFour
  const streakFour = renderStreakFourRow(text)
  if (streakFour !== null) return streakFour
  // Simple-sentences tier (Wave 13, ticket 86ca8e6fr): the canon read text
  // carries the `___` gap token (so the browser parser can build the
  // displayed `sentenceFrame`); substitute it to the spoken word "blank"
  // BEFORE any prosody/escape processing so Azure voices "blank" at the
  // gap, never "underscore underscore underscore". The `?`-terminated
  // deferral frames ("___ is the cat?") still get the question-prosody
  // wrapper via the fall-through below. Text-plain, audio-shaped — same
  // bake-time pattern as letter-sounds mnemonic-wrap + sight-words stress.
  if (tierFilter === 'simple-sentences') {
    text = substituteSentenceGap(text, tierFilter)
    // Fall through to the normal path with the gap-substituted text (the
    // tier filter is intentionally NOT re-passed below to avoid re-entry;
    // simple-sentences has no PHONEME_OVERRIDES entries, so the plain /
    // question-prosody path is correct from here).
    tierFilter = undefined
  }
  // CVC phoneme-blend prompt (ticket 86c9qa6n3): the `blend` slot's text is
  // the segmented "c - a - t ... cat" form. `renderBlendInnerText` returns
  // the phoneme-wrapped, break-injected, rate-slowed render for a CVC-tier
  // blend line, or `null` for every OTHER CVC utterance (read/correct/
  // reprompt/hint/giveAnswer never match `parseBlendText`'s segmented shape),
  // so the normal CVC path is unaffected. Checked here (after simple-sentences,
  // before letter-sounds) so the blend render owns the line whole.
  const blend = renderBlendInnerText(text, tierFilter, blendFullFidelity)
  if (blend !== null) return blend
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
  // Sight-words tier (ticket 86ca7xmr8): phonologically-weak target words
  // (the/a/of/in/to) get a stress prosody on the TARGET token so they
  // stay audible on the iPad speaker. Strong targets (was/said/go/...)
  // and non-sight-words tiers return null and fall through unchanged.
  const sightWord = renderSightWordsInnerText(text, tierFilter)
  if (sightWord !== null) return sightWord
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
 *  86c9gxup4).
 *
 *  `opts.blendFullFidelity` (pass-5) opts the CVC `blend` slot into the
 *  full per-class segmented render (fricative nested-prosody onset + stop
 *  release). It is set ONLY by the canon BAKE path; the runtime handler
 *  leaves it falsy so the blend renders as the resource-safe whole-word
 *  floor (the production runtime Azure resource 400s the nested onset). */
export interface BuildSsmlOptions {
  /** Opt the CVC `blend` slot into the full-fidelity per-class render.
   *  Bake-only — default false renders the runtime-safe whole-word floor. */
  blendFullFidelity?: boolean
}

export function buildSsmlBody(
  req: TtsRequest,
  opts: BuildSsmlOptions = {},
): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">` +
    `<voice name="${escapeSsml(req.voice)}">` +
    `<prosody pitch="${escapeSsml(req.pitch)}" rate="${escapeSsml(req.rate)}" volume="${escapeSsml(req.volume)}">` +
    `${renderSsmlInnerText(req.text, req.tier, opts.blendFullFidelity ?? false)}` +
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
  /**
   * Pass-5 blend-fidelity flag (ticket 86ca…blend-pass5). When `true`, a CVC
   * `blend` utterance renders through the FULL per-class segmented path
   * (fricative nested-prosody onset, stop `<stop>ə` release, /h/ fric-rel,
   * voiced-onset whole-word floor). Set ONLY by the canon BAKE path —
   * `scripts/generateSessionCanon.ts` threads `renderOptions.synthOptions =
   * { blendFullFidelity: true }`. The runtime handler (`api/_session.ts` via
   * the cache-miss / graduation live-render) leaves it UNSET so the blend
   * renders as the resource-safe whole-word floor: the production runtime
   * Azure resource REJECTS (HTTP 400) the full-fidelity fricative onset, but
   * accepts plain whole-word text. Default = false (fail-safe).
   */
  blendFullFidelity?: boolean
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
  const body = buildSsmlBody(req, {
    blendFullFidelity: opts.blendFullFidelity ?? false,
  })

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
