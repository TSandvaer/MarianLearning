/**
 * Blend-audition variant specs — ticket 86ca8n... (CVC phoneme-blend scratch).
 *
 * ⚠️  NOT PRODUCTION CODE.  ⚠️
 * --------------------------------------------------------------------------
 * This module exists ONLY to drive `scripts/renderBlendAudition.ts`, which
 * renders a grid of candidate SSML treatments for the CVC phoneme-blend
 * `blend` slot. The production `renderBlendInnerText` (api/_tts.ts) voices
 * each consonant as a BARE IPA phoneme with a `<break>` AFTER it (candidate f,
 * Thomas-approved 2026-06-15), the STOP consonants (b/c/k/d/g/p/t) getting a
 * clipped `<stop>ə` release.
 *
 * ── PASS 1 (merged, PR #466) ──────────────────────────────────────────────
 * Candidate f ("lightly-released stops") FIXED the stop consonants.
 *
 * ── PASS 2 (merged into this branch's parent, PR #470) ────────────────────
 * Pass-2 auditioned the bare CONTINUANTS / GLIDE / AFFRICATE that candidate-f
 * left bare. Thomas A/B'd the page and ruled:
 *   • LOCKED (do NOT re-audition): stops (shipped clipped release); /h/ =
 *     fric-rel (hə minimal vowel-support); /v/ = FLOOR (van whole-word only).
 *   • REJECTED, needs NEW candidates: /f/, /s/, /dʒ/ (j), /w/. The pass-2
 *     leads (fff/sss elongation; dʒə clip; wə support) did not land.
 *
 * ── PASS 3 (this module's reason to exist) ────────────────────────────────
 * Dave's pass-3 phonics ruling (design/research/cvc-blend-audio-phonics-pass3.md)
 * supplies a new candidate PER failing class. The lever change vs pass-2 is
 * ORTHOGRAPHIC ONSET TEXT, NO IPA — bare IPA produced a "soe" artifact, so the
 * onset is spelled phonetically as plain text inside a per-onset `<prosody>`
 * wrapper, with a 150ms break AFTER the onset (before the rest of the word's
 * segmented graphemes):
 *
 *   | Class | Words     | Onset text | Onset wrapper                          | break |
 *   |-------|-----------|------------|----------------------------------------|-------|
 *   | /f/   | fan, fox  | ef         | <prosody rate="-20%">ef</prosody>      | 150ms |
 *   | /s/   | sip, sun  | es         | <prosody rate="-20%">es</prosody>      | 150ms |
 *   | /dʒ/  | jam       | juh        | <prosody rate="-30%" pitch="-15%">juh  | 150ms |
 *   | /w/   | web, wig  | wuh        | <prosody rate="-25%" pitch="-20%">wuh  | 150ms |
 *
 * The /f/ + /s/ leads are LEADING-VOWEL spellings ("ef"/"es" = the letter
 * names) — the leading schwa+vowel gives Azure a steady carrier so the
 * fricative friction lands as the CODA of the onset syllable rather than a
 * bare turbulent burst. /dʒ/ + /w/ are phonetic syllable spellings ("juh"
 * "wuh") at a deeper pitch + slower rate so the onset reads as the target
 * consonant, not a vowel.
 *
 * AUDITION-FIRST: Thomas plays the candidate vs a whole-word-only FLOOR
 * baseline per word and picks accept (port the candidate) or reject (ship the
 * FLOOR). A SEPARATE pass-4 PR ports the winners into `renderBlendInnerText` +
 * re-bakes the real canon. Do NOT wire this module into the runtime bundle,
 * and do NOT change production behaviour here.
 *
 * NESTED-PROSODY NOTE (Dave's flagged pass-3 risk; verified — see PR body /
 * Self-Test Report). The per-onset `<prosody rate=...>` sits INSIDE the
 * speak-root `<prosody rate="-10%">` shell (buildSpeakBody in
 * renderBlendAudition.ts). Azure SSML `rate` is MULTIPLICATIVE across nested
 * prosody: an inner `rate="-20%"` inside an outer `rate="-10%"` yields an
 * effective ~0.72× speed (0.90 × 0.80), it does NOT override the outer to a
 * flat 0.80×. `pitch` offsets likewise COMPOUND (outer +0Hz here, so the inner
 * pitch is the net pitch). So the table's intended slow/deep onset DOES take
 * effect; no flattening / single-computed-rate workaround was needed.
 *
 * SYNTHETIC-PHONICS CONSTRAINT (Dave's phonics notes): the forbidden thing is
 * a FULL-SYLLABLE schwa drill ("kuh-a-tuh"). The /dʒ/ "juh" + /w/ "wuh" onsets
 * ARE single-syllable carriers BY DESIGN — Dave's pass-3 ruling accepts them
 * for these two classes specifically (a stop-burst affricate and a glide both
 * need a vowel to be audible at all; bare /dʒ/ scratches and bare /w/ collapses
 * to /uː/). The acceptance test is the sponsor's ear, surfaced on the page:
 * "is the onset identifiable as the target phoneme AND does the whole word
 * sound natural?" Reject → FLOOR (whole-word only).
 *
 * The candidate set is intentionally an ARRAY of pure functions and the
 * per-class onsets are a TABLE (`PASS3_ONSETS`) — trivially extensible /
 * vetoable by editing the table or the candidate array alone; the render
 * script and page iterate generically.
 *
 * SSML returned here is the INNER-TEXT region only (the bit between the
 * speak-root `<prosody>` open/close). The render script wraps it in the
 * production speak/voice/prosody shell with the production voice config
 * (en-GB-OliviaNeural, rate -10%, pitch +0Hz, volume +0%) so each candidate
 * is auditioned in the same acoustic frame the app uses.
 */

/** Per-grapheme IPA — mirrors `BLEND_GRAPHEME_IPA` in api/_tts.ts EXACTLY so
 *  the non-onset graphemes (the vowel + coda of each word) reproduce the
 *  production render byte-for-byte, and only the ONSET grapheme of a failing
 *  class is replaced by the pass-3 orthographic onset. `x` decodes as the
 *  cluster /ks/ (box/fox); every other grapheme is a single phoneme. */
export const BLEND_GRAPHEME_IPA: Readonly<Record<string, string>> = {
  // short vowels — EXACT mirror of api/_tts.ts (a→æ, o→ɒ, u→ə, i→ɘ, e→e; the
  // central/lax u/i picks match PHONEME_OVERRIDES's uuu/iii). These MUST stay
  // identical to production so the baseline anchor is byte-faithful.
  a: 'æ',
  o: 'ɒ',
  u: 'ə',
  i: 'ɘ',
  e: 'e',
  // consonants (bare IPA)
  b: 'b',
  c: 'k',
  d: 'd',
  f: 'f',
  g: 'ɡ',
  h: 'h',
  j: 'dʒ',
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

/** Production constants (mirror api/_tts.ts so the baseline + non-onset
 *  graphemes are byte-faithful). Candidate-f production = break AFTER each
 *  phoneme, NO whole-line rate wrap (the house -10% speak-root rate is
 *  correct). */
const PROD_GRAPHEME_BREAK_MS = 250
const PROD_WHOLE_WORD_BREAK_MS = 450

/** Break AFTER the pass-3 onset, before the rest of the word's graphemes (Dave
 *  pass-3 spec: 150ms). Distinct from the 250ms inter-grapheme break so the
 *  onset syllable sits a touch tighter against the following vowel. */
const PASS3_ONSET_BREAK_MS = 150

/** Stop consonants — the candidate-f set already shipped to production. These
 *  graphemes get the clipped `<stop>ə` release in EVERY candidate (we never
 *  regress the stop fix). LOCKED by Thomas's pass-2 ruling. */
const STOP_GRAPHEMES: ReadonlySet<string> = new Set([
  'b',
  'c',
  'd',
  'g',
  'k',
  'p',
  't',
])

/**
 * Pass-3 per-onset treatments — the failing classes ONLY (/f/ /s/ /dʒ/ /w/).
 * Keyed by the ONSET grapheme. Each entry is the orthographic onset text (NO
 * IPA — bare IPA produced the "soe" artifact) and its per-onset `<prosody>`
 * attributes (compounded inside the speak-root -10% shell — see NESTED-PROSODY
 * NOTE above). Trivially extensible: add a grapheme to bring a class into
 * scope, or edit a row to retune a class.
 *
 * Locked / out-of-scope onsets are deliberately ABSENT:
 *   • /h/ → Thomas locked fric-rel (hə) in pass-2; rendered via the production
 *     bare-IPA path here (NOT re-auditioned). [carried only as anchor context]
 *   • /v/ → FLOOR (van whole-word only).
 *   • stops → candidate-f clipped release (locked).
 */
interface Pass3Onset {
  /** Orthographic onset text, voiced as plain text (NO <phoneme>/IPA). */
  text: string
  /** Per-onset prosody rate (compounds inside the -10% speak-root). */
  rate: string
  /** Optional per-onset prosody pitch (compounds; absent = inherit). */
  pitch?: string
}

export const PASS3_ONSETS: Readonly<Record<string, Pass3Onset>> = {
  // /f/ — leading-vowel "ef" (the letter name): the leading e gives Azure a
  // steady carrier so the /f/ friction lands as the syllable coda, not a bare
  // turbulent burst. High-probability accept (Dave).
  f: { text: 'ef', rate: '-20%' },
  // /s/ — leading-vowel "es": same mechanism as /f/ for the sibilant.
  // High-probability accept (Dave).
  s: { text: 'es', rate: '-20%' },
  // /dʒ/ — phonetic syllable "juh" at deeper pitch + slower rate so the onset
  // reads as the affricate, not a vowel. May floor (Dave).
  j: { text: 'juh', rate: '-30%', pitch: '-15%' },
  // /w/ — phonetic syllable "wuh", deepest pitch so the glide onset is W not U.
  // May floor (Dave).
  w: { text: 'wuh', rate: '-25%', pitch: '-20%' },
}

/** Graphemes Dave FLOORS — no segmented onset render; the WORD is presented
 *  whole-word-only so the sponsor confirms the floor on the page. /v/ is a
 *  confirmed en-GB-Olivia floor AND absent from Tagalog (double jeopardy),
 *  locked by Thomas in pass-2. Trivially extensible. */
const FLOOR_GRAPHEMES: ReadonlySet<string> = new Set(['v'])

/** XML-escape (mirrors api/_tts.ts escapeSsml — duplicated to keep this
 *  audition module free of any production import that could drift). */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Split a target word into its blend graphemes. `box`/`fox` keep `x` as one
 *  token (the /ks/ cluster); every other CVC word is one char per grapheme. */
export function splitGraphemes(word: string): string[] {
  // The only multi-letter grapheme in the v1 CVC pools is `x` (box, fox),
  // which is its own single grapheme letter, so a plain char split is correct
  // — `x` maps to the /ks/ cluster in BLEND_GRAPHEME_IPA, one phoneme token.
  return word.toLowerCase().split('')
}

/** Build a `<phoneme>` tag for `grapheme` voicing the supplied `ipa` payload,
 *  or the bare escaped glyph if the grapheme is unmapped (defensive). */
function phonemeTagFor(grapheme: string, ipa: string | undefined): string {
  if (ipa === undefined) return esc(grapheme)
  return `<phoneme alphabet="ipa" ph="${esc(ipa)}">${esc(grapheme)}</phoneme>`
}

/** The PRODUCTION candidate-f release for a non-onset grapheme: STOP graphemes
 *  get a clipped `<stop>ə`; every other grapheme stays bare. Used for the
 *  vowel + coda of every word (and the onset of LOCKED classes), so the
 *  shipped stop fix never regresses while we audition the failing-class onset. */
function prodReleasedIpa(grapheme: string): string | undefined {
  const g = grapheme.toLowerCase()
  const ipa = BLEND_GRAPHEME_IPA[g]
  if (ipa === undefined) return undefined
  return STOP_GRAPHEMES.has(g) ? `${ipa}ə` : ipa
}

/** Production per-grapheme render (candidate-f): clipped stop release, else
 *  bare IPA. Drives every grapheme EXCEPT a pass-3 failing-class onset. */
function prodGrapheme(grapheme: string): string {
  return phonemeTagFor(grapheme, prodReleasedIpa(grapheme))
}

/** Render the pass-3 orthographic onset for a failing-class onset grapheme:
 *  plain onset text (NO IPA) inside its per-onset `<prosody>` wrapper. */
function pass3OnsetSsml(onset: Pass3Onset): string {
  const pitchAttr = onset.pitch ? ` pitch="${esc(onset.pitch)}"` : ''
  return `<prosody rate="${esc(onset.rate)}"${pitchAttr}>${esc(onset.text)}</prosody>`
}

/** A single blend candidate (one SSML treatment, applied to every word). */
export interface BlendCandidate {
  /** Stable slug used in the manifest itemId + page row. */
  id: string
  /** Short human label shown on the page. */
  label: string
  /** Which treatment this candidate represents (page grouping):
   *  - 'pass3'  : the new pass-3 orthographic-onset candidate.
   *  - 'floor'  : whole-word-only FLOOR baseline (what ships if rejected).
   *  - 'broken' : the pass-2 baseline (current live render) — A/B reference.
   */
  treatment: 'pass3' | 'floor' | 'broken'
  /** One-line description of the MECHANISM being tried (shown on the page). */
  mechanism: string
  /**
   * Build the SSML inner-text for this candidate from the target word.
   * Returns the raw inner-SSML (`<phoneme>`/`<prosody>`/`<break>` markup).
   */
  buildInner: (word: string) => string
}

/** True if a word's ONSET grapheme is FLOORed — the whole word is rendered
 *  whole-word-only (no segmentation), per Dave's floor decision. We check the
 *  onset (first grapheme) only: /v/ is an onset in this pool (van). */
function wordIsFloored(word: string): boolean {
  return splitGraphemes(word).some((g) => FLOOR_GRAPHEMES.has(g.toLowerCase()))
}

/**
 * PASS-3 candidate: the word's ONSET grapheme, if it's a pass-3 failing class,
 * is rendered as the orthographic onset (plain text + per-onset prosody +
 * 150ms break); every other grapheme (vowel, coda, and the onset of any
 * non-pass-3 class) is the production candidate-f render. A FLOORed word (van)
 * renders whole-word-only regardless. A word whose onset is NOT a pass-3 class
 * (e.g. `cat` stop-control, `hat`/`hen` /h/-locked) renders fully via the
 * production path — i.e. it is identical to the baseline, which is correct:
 * those classes are NOT being re-auditioned.
 */
function buildPass3Inner(word: string): string {
  if (wordIsFloored(word)) return buildFloorInner(word)
  const graphemes = splitGraphemes(word)
  const parts: string[] = []
  graphemes.forEach((g, idx) => {
    const lower = g.toLowerCase()
    const onset = idx === 0 ? PASS3_ONSETS[lower] : undefined
    if (onset) {
      parts.push(pass3OnsetSsml(onset))
      parts.push(`<break time="${PASS3_ONSET_BREAK_MS}ms"/>`)
    } else {
      parts.push(prodGrapheme(g))
      parts.push(`<break time="${PROD_GRAPHEME_BREAK_MS}ms"/>`)
    }
  })
  parts.push(`<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>`)
  parts.push(esc(word))
  return parts.join('')
}

/**
 * FLOOR baseline: NO segmentation. The word is voiced slowly once, a pause,
 * then naturally — exactly the production FLOOR shape for /v/. This is the clip
 * we ship if Thomas rejects the pass-3 candidate for that word's class.
 */
function buildFloorInner(word: string): string {
  return (
    `<prosody rate="-15%">${esc(word)}</prosody>` +
    `<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>` +
    esc(word)
  )
}

/**
 * BROKEN control (pass-2 baseline = current live render, candidate f): STOP
 * graphemes get the clipped release, every other grapheme (incl. the failing-
 * class onsets) stays BARE. This is the A/B reference so Thomas hears the
 * scratch the pass-3 onset is fixing. Cheap to keep (Dave: keep if cheap).
 */
function buildBrokenInner(word: string): string {
  if (wordIsFloored(word)) return buildFloorInner(word)
  const parts: string[] = []
  for (const g of splitGraphemes(word)) {
    parts.push(prodGrapheme(g))
    parts.push(`<break time="${PROD_GRAPHEME_BREAK_MS}ms"/>`)
  }
  parts.push(`<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>`)
  parts.push(esc(word))
  return parts.join('')
}

// ─────────────────────────────────────────────────────────────────────────
// CANDIDATES (display order per word): pass-3 candidate, FLOOR baseline,
// broken control. For FLOORed words (van) and locked-class words (cat / hat /
// hen) the pass-3 candidate == the production render; the page still shows the
// FLOOR + broken rows so the frame is uniform.
// ─────────────────────────────────────────────────────────────────────────

const CANDIDATE_PASS3: BlendCandidate = {
  id: 'pass3',
  treatment: 'pass3',
  label: 'pass3 — orthographic onset (ef/es/juh/wuh) + per-onset prosody',
  mechanism:
    'The ONSET of a failing class (/f/→"ef", /s/→"es", /dʒ/→"juh", /w/→"wuh") ' +
    'is voiced as PLAIN TEXT (no IPA — bare IPA gave the "soe" artifact) inside ' +
    'a per-onset <prosody> (f/s @ -20%; j @ -30%/-15st-style pitch; w @ ' +
    '-25%/-20%), then a 150ms break, then the rest of the word segmented as ' +
    'production. Stops keep their clipped release; /h/,/v/ unchanged. LISTEN: ' +
    'is the onset clearly the target phoneme AND the whole word natural?',
  buildInner: buildPass3Inner,
}

const CANDIDATE_FLOOR: BlendCandidate = {
  id: 'floor',
  treatment: 'floor',
  label: 'floor — whole-word only (the ship-if-rejected baseline)',
  mechanism:
    'NO segmentation: the word is voiced slowly once (<prosody rate="-15%">), ' +
    'a pause, then naturally. This is exactly what ships if the pass3 candidate ' +
    'is REJECTED for this class — the same FLOOR shape /v/ uses. The safe ' +
    'fallback A/B.',
  buildInner: buildFloorInner,
}

const CANDIDATE_BROKEN: BlendCandidate = {
  id: 'broken',
  treatment: 'broken',
  label: 'broken — current live render (pass-2 baseline, bare onset)',
  mechanism:
    'The CURRENT production render (candidate f): stops clipped, the failing- ' +
    'class onset BARE. This is the scratch the pass3 onset fixes — kept as the ' +
    'A/B reference so the improvement is audible. (For cat/hat/hen/van this ' +
    'equals pass3, since those classes are locked / not re-auditioned.)',
  buildInner: buildBrokenInner,
}

/** The candidate set, in per-word display order: pass-3 candidate FIRST, then
 *  the FLOOR baseline, then the broken control. Trivially extensible — append
 *  a `BlendCandidate`, retune a class via `PASS3_ONSETS`, or floor a phoneme
 *  via `FLOOR_GRAPHEMES`. The render script + page iterate generically. */
export const BLEND_CANDIDATES: BlendCandidate[] = [
  CANDIDATE_PASS3,
  CANDIDATE_FLOOR,
  CANDIDATE_BROKEN,
]

/** One auditioned word: the CVC target + why it's a representative hard case. */
export interface BlendWord {
  /** The target CVC word (also the slug). */
  word: string
  /** Which pass-3 failing class this word probes (page grouping + coverage). */
  phonemeClass: '/f/' | '/s/' | '/dʒ/' | '/w/' | 'stop-control' | 'floor'
  /** Why this word is in the set (the hard phoneme it probes). */
  context: string
}

// ═════════════════════════════════════════════════════════════════════════
// PASS 4 — IPA length-mark fricatives (/f/, /s/)
// ─────────────────────────────────────────────────────────────────────────
// Pass-3's orthographic-onset lever ("ef"/"es") was the WRONG knob for the
// two fricatives. On the #473 LIVE handle Devon proved the IPA LENGTH-MARK
// form — `<phoneme alphabet="ipa" ph="fː">f</phoneme>` (held /f/) and the /s/
// equivalent — DO render as a sustained held fricative on real Azure
// (westeurope: HTTP 200, audible held friction). The catch: the Vercel
// preview's Azure region REJECTS the length-mark at runtime (400), so Thomas
// can't ear-test them on the LIVE endpoint. The fix Thomas chose: bake them
// here as STATIC pre-baked clips (westeurope creds → base64 in the manifest →
// region-independent, plays on any preview).
//
// LEVER vs pass-3: the onset is an IPA `<phoneme alphabet="ipa" ph="...">`
// (the held length-mark form), NOT plain orthographic text. The onset
// `<phoneme>` sits inside a per-onset `<prosody rate=...>` (compounding inside
// the speak-root -10% shell, same nested-prosody math as pass-3), then the
// production 250ms break, then the rest of the word (vowel + coda + 450ms +
// whole word) rendered EXACTLY as production `renderBlendInnerText`
// (candidate-f: stop release + bare-IPA continuants/vowels + per-grapheme
// breaks). So only the ONSET grapheme differs from the shipped render.
//
// Candidates per fricative word: the held-fricative onset forms × two rates,
// PLUS the whole-word FLOOR baseline for A/B. Thomas reads off the winning
// `ph` + rate per class. The accepted (form, rate) is ported into
// `renderBlendInnerText` in a pass-5 PR (BUT NOTE: production must verify the
// runtime Azure region accepts the length-mark before shipping — these clips
// prove it SOUNDS right, not that the live endpoint will render it).
// ═════════════════════════════════════════════════════════════════════════

/** A held-fricative onset FORM (the IPA `ph=` payload) + a label for the page.
 *  `grapheme` is the visible glyph inside the `<phoneme>` tag. */
interface Pass4OnsetForm {
  /** Stable slug fragment used in the candidate id (e.g. `flen`, `flen-schwa`). */
  formId: string
  /** The IPA payload voiced as `ph=` (e.g. `fː`, `fːə`). */
  ph: string
  /** Short human label for the page (e.g. `fː (held)`, `fːə (held + schwa)`). */
  formLabel: string
}

/** Per-onset rate, compounded inside the speak-root -10% shell (same
 *  multiplicative math as pass-3 — see NESTED-PROSODY NOTE). */
interface Pass4Rate {
  /** Slug fragment for the candidate id (e.g. `r25`). */
  rateId: string
  /** The `<prosody rate=...>` value (e.g. `-25%`). */
  rate: string
}

/** Held-fricative onset forms per failing class. `fː` = the bare held
 *  length-mark; `fːə` = held length-mark + a schwa carrier tail (the pass-3
 *  leading-vowel intuition, but now AFTER the held friction so the friction
 *  leads). Two forms × two rates = 4 candidate clips per word + FLOOR. */
const PASS4_FRICATIVE_FORMS: Readonly<
  Record<string, readonly Pass4OnsetForm[]>
> = {
  f: [
    { formId: 'flen', ph: 'fː', formLabel: 'fː (held)' },
    { formId: 'flen-schwa', ph: 'fːə', formLabel: 'fːə (held + schwa tail)' },
  ],
  s: [
    { formId: 'slen', ph: 'sː', formLabel: 'sː (held)' },
    { formId: 'slen-schwa', ph: 'sːə', formLabel: 'sːə (held + schwa tail)' },
  ],
}

/** The two rates auditioned per onset form. -25% = a moderate stretch; -40% =
 *  a deep hold so the sustained friction is unmistakable. */
const PASS4_RATES: readonly Pass4Rate[] = [
  { rateId: 'r25', rate: '-25%' },
  { rateId: 'r40', rate: '-40%' },
]

/** Build the pass-4 IPA-held-fricative onset SSML: the held `<phoneme>` inside
 *  a per-onset `<prosody rate=...>`, exactly the production phoneme-tag shape
 *  but with the length-mark `ph` payload. */
function pass4OnsetSsml(
  grapheme: string,
  form: Pass4OnsetForm,
  rate: string,
): string {
  const tag = `<phoneme alphabet="ipa" ph="${esc(form.ph)}">${esc(grapheme)}</phoneme>`
  return `<prosody rate="${esc(rate)}">${tag}</prosody>`
}

/**
 * Build the pass-4 candidate inner-SSML for a fricative word at a given
 * (onset-form, rate): the held-fricative IPA onset + 150ms onset break, then
 * the rest of the word (vowel + coda) rendered EXACTLY as production
 * candidate-f (stop release / bare IPA + 250ms breaks), then the 450ms break +
 * the whole word voiced naturally. Only the ONSET grapheme differs from the
 * shipped `renderBlendInnerText`.
 */
function buildPass4Inner(
  word: string,
  form: Pass4OnsetForm,
  rate: string,
): string {
  const graphemes = splitGraphemes(word)
  const parts: string[] = []
  graphemes.forEach((g, idx) => {
    if (idx === 0) {
      parts.push(pass4OnsetSsml(g, form, rate))
      parts.push(`<break time="${PASS3_ONSET_BREAK_MS}ms"/>`)
    } else {
      parts.push(prodGrapheme(g))
      parts.push(`<break time="${PROD_GRAPHEME_BREAK_MS}ms"/>`)
    }
  })
  parts.push(`<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>`)
  parts.push(esc(word))
  return parts.join('')
}

/** A pass-4 auditioned word — same shape as BlendWord but the class is always
 *  a fricative and the candidates are generated (form × rate) + FLOOR. */
export interface BlendPass4Word {
  /** The fricative CVC probe word (also the slug). */
  word: string
  /** The fricative class this word probes (page grouping). */
  phonemeClass: '/f/' | '/s/'
  /** The ONSET grapheme whose held form is being auditioned (`f` or `s`). */
  onsetGrapheme: 'f' | 's'
  /** Why this word is in the set. */
  context: string
}

/** The pass-4 word set: two /f/ words (fan, fox) + two /s/ words (sip, sun),
 *  each probing the held-fricative onset against a different coda for
 *  cross-coda coverage. */
export const BLEND_PASS4_WORDS: BlendPass4Word[] = [
  {
    word: 'fan',
    phonemeClass: '/f/',
    onsetGrapheme: 'f',
    context:
      '/f/ onset + continuant /n/ coda. The held-fricative onset (fː / fːə) ' +
      'against a sustainable coda — isolates the onset friction with no coda ' +
      'stop to muddy it.',
  },
  {
    word: 'fox',
    phonemeClass: '/f/',
    onsetGrapheme: 'f',
    context:
      '/f/ onset + the /ks/ cluster grapheme (x). Probes the held /f/ AND that ' +
      'the x=/ks/ cluster still releases cleanly after the held onset.',
  },
  {
    word: 'sip',
    phonemeClass: '/s/',
    onsetGrapheme: 's',
    context:
      '/s/ onset + /p/ stop coda. The held sibilant (sː / sːə) against a final ' +
      'clipped stop — does the long /s/ resolve before the /p/ release?',
  },
  {
    word: 'sun',
    phonemeClass: '/s/',
    onsetGrapheme: 's',
    context:
      '/s/ onset + continuant /n/ coda. Isolates the held sibilant onset with ' +
      'no coda stop.',
  },
]

/** A pass-4 candidate spec (one (word × form × rate) clip, or the FLOOR). */
export interface BlendPass4Candidate {
  /** Stable id fragment, unique within the word (e.g. `flen-r25`, `floor`). */
  id: string
  /** Human label for the page row. */
  label: string
  /** pass4 (held-fricative candidate) | floor (whole-word A/B baseline). */
  treatment: 'pass4' | 'floor'
  /** One-line mechanism description for the page. */
  mechanism: string
  /** Build the inner-SSML for this candidate from the word. */
  buildInner: (word: string) => string
}

/**
 * Generate the pass-4 candidates for a word: every (onset-form × rate) clip,
 * in form-major / rate-minor order, then the whole-word FLOOR baseline last.
 * The FLOOR is the same shape pass-3 uses (the ship-if-rejected clip).
 */
export function pass4CandidatesFor(
  word: BlendPass4Word,
): BlendPass4Candidate[] {
  const forms = PASS4_FRICATIVE_FORMS[word.onsetGrapheme] ?? []
  const candidates: BlendPass4Candidate[] = []
  for (const form of forms) {
    for (const r of PASS4_RATES) {
      candidates.push({
        id: `${form.formId}-${r.rateId}`,
        treatment: 'pass4',
        label: `${form.formLabel} @ ${r.rate}`,
        mechanism:
          `Held-fricative IPA onset ph="${form.ph}" inside <prosody rate="${r.rate}"> ` +
          `(compounds inside the speak-root -10%), then a 150ms break, then the ` +
          `rest of the word rendered as production candidate-f. LISTEN: is the ` +
          `onset a clean sustained /${word.onsetGrapheme}/ AND the whole word natural?`,
        buildInner: (w: string) => buildPass4Inner(w, form, r.rate),
      })
    }
  }
  candidates.push({
    id: 'floor',
    treatment: 'floor',
    label: 'floor — whole-word only (ship if rejected)',
    mechanism:
      'NO segmentation: the word voiced slowly once (<prosody rate="-15%">), a ' +
      'pause, then naturally. The safe fallback A/B — what ships if every held- ' +
      'fricative onset is rejected for this class.',
    buildInner: buildFloorInner,
  })
  return candidates
}

/**
 * The pass-3 word set — the failing classes Thomas REJECTED in pass-2, two
 * words per fricative class for cross-coda coverage, one each for the affricate
 * + glide pair, plus the `cat` stop-control anchor and the `van` floor-confirm
 * anchor so Thomas has a known-good + known-floor in the same frame.
 */
export const BLEND_WORDS: BlendWord[] = [
  {
    word: 'cat',
    phonemeClass: 'stop-control',
    context:
      'STOP CONTROL (NOT re-auditioned) — voiceless stops /k/ + /t/, fixed by ' +
      'candidate f and LOCKED. pass3 == broken here. The known-good anchor: ' +
      'every candidate keeps it clean.',
  },
  {
    word: 'fan',
    phonemeClass: '/f/',
    context:
      '/f/ onset + continuant /n/ coda. The buzzy unvoiced-fricative onset ' +
      'Thomas rejected in pass-2. pass3 leads with "ef" @ -20% (high-prob ' +
      'accept — Dave).',
  },
  {
    word: 'fox',
    phonemeClass: '/f/',
    context:
      '/f/ onset + the /ks/ cluster grapheme (x). Probes "ef" onset AND that ' +
      'the x=/ks/ cluster still releases cleanly after the onset break.',
  },
  {
    word: 'sip',
    phonemeClass: '/s/',
    context:
      '/s/ onset + /p/ stop coda. The sibilant "es" onset against a final ' +
      'clipped stop (high-prob accept — Dave).',
  },
  {
    word: 'sun',
    phonemeClass: '/s/',
    context:
      '/s/ onset + continuant /n/ coda. Isolates the "es" sibilant onset ' +
      'without a coda stop.',
  },
  {
    word: 'jam',
    phonemeClass: '/dʒ/',
    context:
      'Affricate /dʒ/ onset (j) + continuant /m/ coda. pass3 onset "juh" @ ' +
      '-30%/pitch-down. MAY FLOOR (Dave) — listen: clean /dʒ/ or a full "juh"?',
  },
  {
    word: 'web',
    phonemeClass: '/w/',
    context:
      'Glide /w/ onset + /b/ stop coda. Bare /w/ collapses to /uː/ ("U not ' +
      'W"); pass3 onset "wuh" @ -25%/deep pitch. MAY FLOOR (Dave).',
  },
  {
    word: 'wig',
    phonemeClass: '/w/',
    context:
      'Glide /w/ onset + /ɡ/ stop coda. The "U not W" glide failure with a ' +
      'final voiced stop. pass3 onset "wuh". MAY FLOOR (Dave).',
  },
  {
    word: 'van',
    phonemeClass: 'floor',
    context:
      'FLOOR CONFIRM — /v/ onset is a confirmed en-GB-Olivia floor AND absent ' +
      'from Tagalog (Dave: do NOT audition a /v/ render fix; LOCKED pass-2). ' +
      'EVERY candidate renders `van` WHOLE-WORD-ONLY so the floor is confirmed ' +
      'on the page.',
  },
]
