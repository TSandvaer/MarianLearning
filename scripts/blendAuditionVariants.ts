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
 * Candidate f ("lightly-released stops") FIXED the stop consonants. Pass-1
 * auditioned cat / dog / big / box / van — those 5 words only exercise stops,
 * the /v/, and the /ks/ cluster, so f's handling of the OTHER continuants and
 * the glide was never ear-checked.
 *
 * ── PASS 2 (this module's reason to exist) ────────────────────────────────
 * Candidate f leaves CONTINUANTS + the GLIDE + the AFFRICATE bare. Thomas's
 * re-test (voice-QA #467, 14 blend fails) shows the bare-continuant path now
 * scratches on a fresh set of phonemes that pass-1 never probed:
 *   • Fricatives bare-scratch: h (hat/hen/hot), f (fan/fig/fox), s (sip/sun),
 *     v (van).
 *   • Affricate j /dʒ/ (jam/jet/jug) — the stop-burst onset of the affricate
 *     scratches like a bare stop.
 *   • Glide w (web/wig) — heard as "U instead of W" (the bare /w/ IPA renders
 *     as the vowel /uː/, losing the glide onset).
 * STOPS STAY candidate-f and are NOT re-auditioned here — `cat` is carried
 * only as a STOP CONTROL so Thomas has a known-good anchor in the same frame.
 *
 * This is an AUDITION-FIRST pass: Thomas (or Dave's pass-2 phonics note) plays
 * the per-class candidates, picks ONE winner PER FAILING CLASS, and a SEPARATE
 * follow-up PR ports the winning treatment into `renderBlendInnerText` +
 * re-bakes the real canon. Do NOT wire this module into the runtime bundle,
 * and do NOT change production behaviour here.
 *
 * Per-class LEAD treatments (aligned to Dave's pass-2 phonics note,
 * design/research/cvc-blend-audio-phonics-pass2.md):
 *   • FRICATIVES f/s/h — LEAD is ORTHOGRAPHIC ELONGATION: letter REPETITION
 *     (fff / sss / hhh) inside `<prosody rate="-20%">`, NO vowel support.
 *     Continuants sustain; repetition forces sustained production better than a
 *     bare IPA tag, and the slow rate lets the steady-state friction dominate
 *     the buzzy turbulent onset that scratches when bare. /h/ leads with hhh
 *     too (Marian has native /h/), with a "huh" (`hə`) minimal vowel-support
 *     FALLBACK (`fric-rel`) if elongation fails.
 *   • AFFRICATE /dʒ/ — treat as a STOP, not a fricative: a clipped `dʒə`
 *     release ("juh", sub-syllabic) + pitch-down, the SAME class as the shipped
 *     stop fix. Do NOT elongate j ("jjj" is wrong — a stop onset can't sustain).
 *   • GLIDE /w/ — "wuh" (`wə`) vowel-support + pitch-down. The "U instead of W"
 *     is STRUCTURAL: a glide IS a vowel-onset transition, so bare /w/ holds as
 *     /uː/. Vowel support is CORRECT here, not the schwa anti-pattern.
 *   • /v/ — FLOORED. Dave: do NOT audition a /v/ render fix — it's a confirmed
 *     en-GB-Olivia floor AND absent from Tagalog (double jeopardy). `van` is
 *     presented WHOLE-WORD-ONLY (no segmented /v/) on EVERY candidate so the
 *     sponsor confirms the floor on the page. (The pass-3 impl adds a
 *     `BLEND_FLOOR_PHONEMES` routing table; here it's the `FLOOR_GRAPHEMES` set.)
 *
 * SYNTHETIC-PHONICS CONSTRAINT (Dave's phonics notes,
 * design/research/cvc-blend-audio-phonics.md + ...-pass2.md): the forbidden
 * thing is a FULL-SYLLABLE schwa ("kuh-a-tuh" / "fuh-a-nuh"), NOT a clipped,
 * inaudible release. The vowel-support candidates reuse the EXACT clipped-`ə`
 * mechanism the Thomas-approved stop fix already uses — proven sub-syllabic on
 * the stops. Note the asymmetry Dave draws: for CONTINUANTS (f/s/h) the
 * vowel-support is the FALLBACK and elongation is the lead (continuants don't
 * need a vowel to render); for the GLIDE /w/ the vowel-support is CORRECT and
 * primary (a glide is definitionally a transition INTO a vowel). Each
 * vowel-support candidate's acceptance test is the sponsor's ear: "does the
 * release stay inaudible as a syllable?" (surfaced on the page).
 *
 * The candidate set is intentionally an ARRAY of pure functions, and the
 * per-class candidates are TRIVIALLY EXTENSIBLE: Dave's pass-2 phonics note
 * (in flight) can add or veto a candidate by editing `BLEND_CANDIDATES` alone,
 * or scope an existing candidate to a different phoneme class by editing the
 * `*_GRAPHEMES` sets — the render script and page iterate generically.
 *
 * SSML returned here is the INNER-TEXT region only (the bit between the
 * speak-root `<prosody>` open/close). The render script wraps it in the
 * production speak/voice/prosody shell with the production voice config
 * (en-GB-OliviaNeural, rate -10%, pitch +0Hz, volume +0%) so each candidate
 * is auditioned in the same acoustic frame the app uses.
 */

/** Per-grapheme IPA — mirrors `BLEND_GRAPHEME_IPA` in api/_tts.ts EXACTLY so
 *  the baseline candidate reproduces the production render byte-for-byte and
 *  every other candidate explores ONLY the SSML envelope, never the IPA
 *  payload (synthetic-phonics purity constraint). `x` decodes as the cluster
 *  /ks/ (box/fox); every other grapheme is a single phoneme. */
export const BLEND_GRAPHEME_IPA: Readonly<Record<string, string>> = {
  // short vowels — EXACT mirror of api/_tts.ts (a→æ, o→ɒ, u→ə, i→ɘ, e→e; the
  // central/lax u/i picks match PHONEME_OVERRIDES's uuu/iii). These MUST stay
  // identical to production so candidate `a` is a byte-faithful A/B anchor.
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

/** Production constants (mirror api/_tts.ts so the baseline is byte-faithful).
 *  Candidate-f production = break AFTER each phoneme, NO whole-line rate wrap
 *  (the house -10% speak-root rate is correct). */
const PROD_GRAPHEME_BREAK_MS = 250
const PROD_WHOLE_WORD_BREAK_MS = 450

/** Stop consonants — the candidate-f set already shipped to production. These
 *  graphemes get the clipped `<stop>ə` release in EVERY pass-2 candidate too
 *  (we never regress the stop fix while auditioning the continuant fix). */
const STOP_GRAPHEMES: ReadonlySet<string> = new Set([
  'b',
  'c',
  'd',
  'g',
  'k',
  'p',
  't',
])

/** Fricative graphemes the pass-2 fricative candidates (elongate / vowel-
 *  support) target. /h/ /f/ /s/ are the unvoiced fricatives Thomas flagged
 *  (voice-QA #467). /v/ is intentionally NOT here — Dave FLOORED it (see
 *  `FLOOR_GRAPHEMES`), so the fricative candidates skip it and its word renders
 *  whole-only. Trivially extensible — add a grapheme to bring it into scope. */
const FRICATIVE_GRAPHEMES: ReadonlySet<string> = new Set(['h', 'f', 's'])

/** Affricate graphemes — /dʒ/ (the `j` grapheme). Its leading /d/ stop burst
 *  scratches like a bare stop. Candidate `j-clip` gives it the clipped
 *  release. (`ch` would join here if a digraph-CVCC blend tier ever ships.) */
const AFFRICATE_GRAPHEMES: ReadonlySet<string> = new Set(['j'])

/** Glide graphemes — /w/ (and /j/=`y`, not in the v1 CVC onset pool). Rendered
 *  bare, /w/ collapses to the vowel /uː/ ("U not W"). Candidate `w-support`
 *  gives it a "wuh" (wə) vowel to glide into + pitch-down. Trivially
 *  extensible. */
const GLIDE_GRAPHEMES: ReadonlySet<string> = new Set(['w', 'y'])

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

/** The PRODUCTION candidate-f release: STOP graphemes get a clipped `<stop>ə`;
 *  every other grapheme stays bare. This is the live render's per-grapheme
 *  IPA, reused as the baseline FOR THE STOPS in every pass-2 candidate so the
 *  stop fix never regresses while we audition the continuant/glide/affricate
 *  fix. */
function prodReleasedIpa(grapheme: string): string | undefined {
  const g = grapheme.toLowerCase()
  const ipa = BLEND_GRAPHEME_IPA[g]
  if (ipa === undefined) return undefined
  return STOP_GRAPHEMES.has(g) ? `${ipa}ə` : ipa
}

/** A single blend candidate (one SSML treatment, applied to every word). */
export interface BlendCandidate {
  /** Stable slug used in the manifest itemId + page row. */
  id: string
  /** Short human label shown on the page. */
  label: string
  /** Which failing phoneme CLASS this candidate targets (for the page
   *  grouping + so Dave's note can reason about coverage). 'baseline' is the
   *  A/B anchor; 'stop-control' is candidate-f carried unchanged. */
  targetClass:
    | 'baseline'
    | 'stop-control'
    | 'fricative'
    | 'affricate'
    | 'glide'
    | 'all'
  /** One-line description of the MECHANISM being tried (shown on the page). */
  mechanism: string
  /**
   * Build the SSML inner-text for this candidate from the target word.
   * Returns the raw inner-SSML (`<phoneme>`/`<prosody>`/`<break>` markup).
   */
  buildInner: (word: string) => string
}

/** Graphemes Dave's pass-2 note FLOORS — do NOT audition a segmented render
 *  fix; present the WORD whole-only so the sponsor confirms the floor decision.
 *  /v/ is a confirmed en-GB-Olivia floor AND absent from Tagalog (double
 *  jeopardy). The pass-3 impl adds a `BLEND_FLOOR_PHONEMES` routing table in
 *  `renderBlendInnerText`; here it just routes `van` to a whole-word render.
 *  Trivially extensible — add a grapheme to floor its word's segmentation. */
const FLOOR_GRAPHEMES: ReadonlySet<string> = new Set(['v'])

/** True if a word contains any FLOORed grapheme — its blend is rendered
 *  whole-word-only (no segmentation), per Dave's pass-2 floor decision. */
function wordIsFloored(word: string): boolean {
  return splitGraphemes(word).some((g) => FLOOR_GRAPHEMES.has(g.toLowerCase()))
}

/**
 * Per-grapheme render hook. Returns the SSML for ONE grapheme — either a
 * `<phoneme>` IPA tag (optionally with a transformed payload + per-phoneme
 * `<prosody>` wrap) OR raw orthographic text (e.g. `fff` for elongation). The
 * default is the production candidate-f render: STOPS get the clipped release,
 * everything else bare. A candidate overrides ONLY the graphemes in its target
 * class, leaving the production stop fix intact.
 */
type GraphemeRender = (grapheme: string) => string

/** Default grapheme render = production candidate-f (stop release, else bare).
 *  Every pass-2 candidate composes ON TOP of this so the stop fix never
 *  regresses while we audition the continuant / glide / affricate fix. */
function prodGrapheme(grapheme: string): string {
  return phonemeTagFor(grapheme, prodReleasedIpa(grapheme))
}

/**
 * Generic per-grapheme blend builder. Walks the word, applies `renderGrapheme`
 * to each grapheme, places a `<break>` AFTER each (candidate-f placement — the
 * stop releases into the pause), then voices the whole word naturally after a
 * longer break. No whole-line rate wrap (candidate-f: the house -10% speak-root
 * rate is correct). A FLOORED word (contains a /v/-class grapheme Dave floored)
 * is rendered WHOLE-WORD-ONLY — no segmentation — regardless of the candidate.
 */
function buildBlend(word: string, renderGrapheme: GraphemeRender): string {
  if (wordIsFloored(word)) {
    // Dave's floor: no segmented render for this word — Marian hears the whole
    // word slowly once, then naturally, with no isolated FLOORed phoneme.
    return (
      `<prosody rate="-15%">${esc(word)}</prosody>` +
      `<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>` +
      esc(word)
    )
  }
  const parts: string[] = []
  for (const g of splitGraphemes(word)) {
    parts.push(renderGrapheme(g))
    parts.push(`<break time="${PROD_GRAPHEME_BREAK_MS}ms"/>`)
  }
  parts.push(`<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>`)
  parts.push(esc(word))
  return parts.join('')
}

// ─────────────────────────────────────────────────────────────────────────
// CANDIDATE a — baseline (current production renderBlendInnerText, candidate f)
// ─────────────────────────────────────────────────────────────────────────
// STOPS get the clipped `<stop>ə` release; CONTINUANTS / glide / affricate /
// vowels stay BARE. Break AFTER each phoneme, no whole-line rate wrap. This is
// the LIVE render — it fixed the stops but left the now-failing bare
// continuants/glide/affricate (voice-QA #467). The A/B anchor + broken control.
const CANDIDATE_BASELINE: BlendCandidate = {
  id: 'a',
  targetClass: 'baseline',
  label: 'a — baseline (current live render, candidate f)',
  mechanism:
    'STOPS get the clipped <stop>ə release; continuants / w / j / vowels stay ' +
    'BARE. Break-after, no rate wrap. The LIVE render — fixed stops, but bare ' +
    'continuants/glide/affricate scratch (voice-QA #467). The A/B anchor and ' +
    'the BROKEN CONTROL for every class.',
  buildInner: (word) => buildBlend(word, prodGrapheme),
}

// ─────────────────────────────────────────────────────────────────────────
// FRICATIVE candidates (f / s / h) — Dave's pass-2 leads
// ─────────────────────────────────────────────────────────────────────────
// Dave's pass-2 note: for f/s the TOP approach is ORTHOGRAPHIC ELONGATION —
// letter REPETITION (fff / sss / hhh) inside <prosody rate="-20%">, NO vowel
// support (continuants sustain; repetition forces sustained production better
// than a bare IPA tag). /h/ leads with hhh too, with a "huh" minimal
// vowel-support FALLBACK (Marian has native /h/).

const FRIC_ELONG_REPEAT = 3 // fff / sss / hhh
const FRIC_ELONG_RATE = '-20%'

/** Render a fricative grapheme as REPEATED ORTHOGRAPHIC LETTERS (fff/sss/hhh)
 *  wrapped in <prosody rate="-20%"> — NO <phoneme> tag, NO vowel. Dave's TOP
 *  pass-2 approach for f/s/h: letter repetition makes Azure sustain the
 *  continuant longer than a bare IPA tag, and the slow rate gives the
 *  steady-state friction time to dominate the buzzy onset. */
function fricElongGrapheme(grapheme: string): string {
  const g = grapheme.toLowerCase()
  if (FRICATIVE_GRAPHEMES.has(g) && !FLOOR_GRAPHEMES.has(g)) {
    const repeated = esc(g.repeat(FRIC_ELONG_REPEAT))
    return `<prosody rate="${FRIC_ELONG_RATE}">${repeated}</prosody>`
  }
  return prodGrapheme(grapheme)
}

/** LEAD for f/s/h: orthographic elongation (fff/sss/hhh @ -20% rate). */
const CANDIDATE_FRIC_ELONGATE: BlendCandidate = {
  id: 'fric-elong',
  targetClass: 'fricative',
  label: 'fric-elong — orthographic elongation fff/sss/hhh @ -20% (Dave lead)',
  mechanism:
    'FRICATIVES f/s/h rendered as REPEATED LETTERS (fff / sss / hhh) inside ' +
    '<prosody rate="-20%"> — no <phoneme>, no vowel. Dave pass-2 TOP pick: ' +
    'repetition forces sustained continuant production; the slow rate lets the ' +
    'friction dominate the buzzy onset. Stops keep their <stop>ə.',
  buildInner: (word) => buildBlend(word, fricElongGrapheme),
}

/** /h/ FALLBACK (and a general fricative fallback): minimal vowel-support —
 *  the SAME clipped `<fric>ə` shape the stop fix uses ("huh"/"fuh" sub-syllabic
 *  release). Dave: add this for /h/ specifically; harmless for f/s as an A/B. */
function fricReleaseGrapheme(grapheme: string): string {
  const g = grapheme.toLowerCase()
  const ipa = BLEND_GRAPHEME_IPA[g]
  if (
    ipa !== undefined &&
    FRICATIVE_GRAPHEMES.has(g) &&
    !FLOOR_GRAPHEMES.has(g)
  ) {
    return phonemeTagFor(grapheme, `${ipa}ə`)
  }
  return prodGrapheme(grapheme)
}

/** FALLBACK for /h/ (+ f/s A/B): minimal vowel-support clipped release. */
const CANDIDATE_FRIC_RELEASE: BlendCandidate = {
  id: 'fric-rel',
  targetClass: 'fricative',
  label: 'fric-rel — minimal vowel-support fricatives (hə/fə/sə, /h/ fallback)',
  mechanism:
    'FRICATIVES f/s/h get the SAME clipped <fric>ə release the stops got ' +
    '(h→hə "huh", f→fə, s→sə). Dave pass-2: the FALLBACK for /h/ if hhh ' +
    'elongation fails; an A/B for f/s. Listen: does ə stay sub-syllabic?',
  buildInner: (word) => buildBlend(word, fricReleaseGrapheme),
}

// ─────────────────────────────────────────────────────────────────────────
// AFFRICATE candidate (j = /dʒ/) — Dave: treat as a STOP
// ─────────────────────────────────────────────────────────────────────────
// Dave pass-2: /dʒ/ is a STOP, not a fricative — "juh" clipped release +
// pitch-down (same class as the shipped stop fix). Do NOT elongate j (jjj is
// wrong — a stop onset can't sustain).

/** Clipped affricate release + pitch-down (Dave: treat /dʒ/ as a stop). The
 *  `dʒə` clip gives the leading /d/ burst a vowel to release into; the
 *  pitch-down de-emphasises the burst. Stops keep their release; rest baseline. */
function affricateGrapheme(grapheme: string): string {
  const g = grapheme.toLowerCase()
  const ipa = BLEND_GRAPHEME_IPA[g]
  if (ipa !== undefined && AFFRICATE_GRAPHEMES.has(g)) {
    return `<prosody pitch="-2st">${phonemeTagFor(grapheme, `${ipa}ə`)}</prosody>`
  }
  return prodGrapheme(grapheme)
}

/** LEAD for /dʒ/: clipped "juh" release + pitch-down (treat as a stop). */
const CANDIDATE_AFFR_RELEASE: BlendCandidate = {
  id: 'j-clip',
  targetClass: 'affricate',
  label: 'j-clip — clipped affricate release dʒə + pitch-down (Dave lead)',
  mechanism:
    'AFFRICATE /dʒ/ (j) treated as a STOP (Dave pass-2): clipped dʒə release ' +
    '("juh", sub-syllabic) wrapped in <prosody pitch="-2st"> to de-emphasise ' +
    'the /d/ burst. NOT elongated (a stop onset cannot sustain). Listen: clean ' +
    '/dʒ/ or a full "juh"?',
  buildInner: (word) => buildBlend(word, affricateGrapheme),
}

// ─────────────────────────────────────────────────────────────────────────
// GLIDE candidate (w) — Dave: "wuh" vowel-support + pitch-down (CORRECT here)
// ─────────────────────────────────────────────────────────────────────────
// Dave pass-2: the "U instead of W" is STRUCTURAL — a glide is a vowel-onset
// transition, so bare /w/ holds as /uː/. Vowel support is CORRECT here, not an
// anti-pattern. "wuh" (wə) + pitch-down.

/** Glide vowel-support + pitch-down (Dave: correct for /w/). `wə` supplies the
 *  formant transition that DEFINES the glide; pitch-down keeps the carrier
 *  un-salient. Stops keep their release; everything else at baseline. */
function glideGrapheme(grapheme: string): string {
  const g = grapheme.toLowerCase()
  const ipa = BLEND_GRAPHEME_IPA[g]
  if (ipa !== undefined && GLIDE_GRAPHEMES.has(g)) {
    return `<prosody pitch="-2st">${phonemeTagFor(grapheme, `${ipa}ə`)}</prosody>`
  }
  return prodGrapheme(grapheme)
}

/** LEAD for /w/: "wuh" vowel-support + pitch-down. */
const CANDIDATE_GLIDE_SUPPORT: BlendCandidate = {
  id: 'w-support',
  targetClass: 'glide',
  label: 'w-support — wuh vowel-support + pitch-down (Dave lead)',
  mechanism:
    'GLIDE /w/ gets a wə ("wuh") payload + <prosody pitch="-2st"> (Dave pass-2 ' +
    '— the "U not W" is STRUCTURAL; a glide is a vowel-onset transition, so ' +
    'vowel support is CORRECT, not an anti-pattern). Stops keep their release. ' +
    'Listen: clear /w/ onset, or still "oo"?',
  buildInner: (word) => buildBlend(word, glideGrapheme),
}

/** The candidate set, in display order. Baseline FIRST (the A/B anchor + broken
 *  control), then ONE LEAD per failing class aligned to Dave's pass-2 note,
 *  plus the /h/ vowel-support fallback. Trivially extensible — append a
 *  `BlendCandidate` to add a row, scope a class by editing the `*_GRAPHEMES`
 *  sets, FLOOR a phoneme via `FLOOR_GRAPHEMES`, or remove one to veto it. Dave's
 *  note may edit this array alone; the render script + page iterate generically.
 *
 *  Dave pass-2 lead-per-class mapping:
 *    • fricatives f/s/h → `fric-elong` (orthographic fff/sss/hhh @ -20%) LEAD
 *      + `fric-rel` (hə/fə/sə) as the /h/ fallback / f-s A/B.
 *    • affricate /dʒ/   → `j-clip` (dʒə clip + pitch-down; treat as a stop) LEAD.
 *    • glide /w/        → `w-support` (wə + pitch-down) LEAD.
 *    • /v/              → FLOORED (FLOOR_GRAPHEMES): `van` renders whole-word
 *      only on EVERY candidate so the sponsor confirms the floor on the page. */
export const BLEND_CANDIDATES: BlendCandidate[] = [
  CANDIDATE_BASELINE,
  // fricative-class (f / s / h) — Dave lead + /h/ fallback
  CANDIDATE_FRIC_ELONGATE,
  CANDIDATE_FRIC_RELEASE,
  // affricate-class (j = /dʒ/) — Dave lead
  CANDIDATE_AFFR_RELEASE,
  // glide-class (w) — Dave lead
  CANDIDATE_GLIDE_SUPPORT,
]

/** One auditioned word: the CVC target + why it's a representative hard case. */
export interface BlendWord {
  /** The target CVC word (also the slug). */
  word: string
  /** Why this word is in the set (the hard phoneme it probes). */
  context: string
}

/**
 * The pass-2 word set, spanning the failing phoneme classes + final stops.
 * Per the ticket: hat / fan / sip / jam / web / wig / fox / hen, with `cat`
 * carried as a STOP CONTROL (candidate-f's known-good anchor). Each word names
 * the failing phoneme it probes so Thomas can map a clip to a class.
 */
export const BLEND_WORDS: BlendWord[] = [
  {
    word: 'cat',
    context:
      'STOP CONTROL (NOT re-auditioned) — voiceless stops /k/ + /t/, fixed by ' +
      'candidate f. Carried as the known-good anchor: every candidate must ' +
      'keep this clean.',
  },
  {
    word: 'hat',
    context:
      'Fricative /h/ onset + /t/ stop coda. /h/ is bare aspiration with no ' +
      'place cue — near-silent-then-scratch when bare (voice-QA #467 hat).',
  },
  {
    word: 'hen',
    context:
      'Fricative /h/ onset + continuant /n/ coda. Isolates the bare-/h/ ' +
      'scratch without a coda stop (voice-QA #467 hen).',
  },
  {
    word: 'fan',
    context:
      'Fricative /f/ onset + continuant /n/ coda. The buzzy unvoiced-fricative ' +
      'onset Thomas flagged (voice-QA #467 fan).',
  },
  {
    word: 'fox',
    context:
      'Fricative /f/ onset + the /ks/ cluster grapheme (x). Probes /f/ AND ' +
      'whether the x=/ks/ cluster still releases cleanly (voice-QA #467 fox).',
  },
  {
    word: 'sip',
    context:
      'Fricative /s/ onset + /p/ stop coda. The sibilant /s/ + a final stop — ' +
      'two failing classes in one word (voice-QA #467 sip).',
  },
  {
    word: 'sun',
    context:
      'Fricative /s/ onset + continuant /n/ coda. Isolates the bare-/s/ ' +
      'sibilant scratch (voice-QA #467 sun).',
  },
  {
    word: 'van',
    context:
      'FLOOR CASE — /v/ onset is a confirmed en-GB-Olivia floor AND absent ' +
      'from Tagalog (Dave pass-2: do NOT audition a /v/ render fix). EVERY ' +
      'candidate renders `van` WHOLE-WORD-ONLY (no segmented /v/) so the ' +
      'sponsor confirms the floor decision on the page.',
  },
  {
    word: 'jam',
    context:
      'Affricate /dʒ/ onset (j) + continuant /m/ coda. The /d/ stop-burst of ' +
      'the affricate scratches like a bare stop (voice-QA #467 jam).',
  },
  {
    word: 'web',
    context:
      'Glide /w/ onset + /b/ stop coda. /w/ bare collapses to the vowel /uː/ ' +
      '("U instead of W") + a final voiced stop (voice-QA #467 web).',
  },
  {
    word: 'wig',
    context:
      'Glide /w/ onset + /ɡ/ stop coda. The "U not W" glide failure with a ' +
      'final voiced stop (voice-QA #467 wig).',
  },
]
