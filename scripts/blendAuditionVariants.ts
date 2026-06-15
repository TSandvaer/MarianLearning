/**
 * Blend-audition variant specs — ticket 86ca8n... (CVC phoneme-blend scratch).
 *
 * ⚠️  NOT PRODUCTION CODE.  ⚠️
 * --------------------------------------------------------------------------
 * This module exists ONLY to drive `scripts/renderBlendAudition.ts`, which
 * renders a grid of candidate SSML treatments for the CVC phoneme-blend
 * `blend` slot. The production `renderBlendInnerText` (api/_tts.ts) voices
 * each consonant as a BARE IPA phoneme with a `<break>` BEFORE it, the whole
 * line wrapped in `<prosody rate="-12%">`. Thomas ear-tested ~37/40 baked
 * blend clips as FAIL ("scratch no C, then AT then CAT", "scratchy and no
 * b... bag", voice-QA #463). Azure neural cannot articulate isolated,
 * unreleased stop consonants, and the rate-slow over-articulates the onset.
 *
 * This is an AUDITION-FIRST pass: Thomas plays the candidates, picks ONE
 * winner, and a SEPARATE follow-up PR ports the winning treatment into
 * `renderBlendInnerText` + re-bakes the real canon. Do NOT wire this module
 * into the runtime bundle, and do NOT change production behaviour here.
 *
 * Investigation lever (why the blend scratches but letter-sounds doesn't):
 *   • The ACCEPTED letter-sounds path also puts a `<break>` before each
 *     isolated phoneme — but its IPA payloads are CONTINUANTS (m/s/f, which
 *     sustain in isolation) or SCHWA-RELEASED stops (pə/bə/kə). The blend
 *     path applies the same break to BARE UNRELEASED stops (k/t/b/d/p),
 *     which Azure can't voice — they come out as a scratch/click.
 *   • The `-12%` rate wrap is the second suspect. The file's own round-5
 *     audition (ticket 86ca8c3t7, baked into _tts.ts) found that for
 *     isolated phonemes "the residual scratch is a hard, buzzy ONSET, not a
 *     duration problem — the rate-slow OVER-articulates the onset." The
 *     winning lever there was PITCH-drop + volume-cut, NOT a rate-slow.
 *
 * SYNTHETIC-PHONICS CONSTRAINT (refined by Dave's phonics note,
 * design/research/cvc-blend-audio-phonics.md): the forbidden thing is a
 * FULL-SYLLABLE schwa ("kuh-a-tuh"), NOT a clipped, inaudible release. So:
 *   • Candidates a–e keep BARE consonant IPA (no schwa at all) — the most
 *     conservative "pure" reading, and the faithful A/B anchor (a).
 *   • Candidate f ("lightly-released stops") is Dave's TOP-ranked treatment:
 *     each STOP consonant (b/c/k/d/g/p/t) gets a clipped `<stop>ə` release
 *     that is INAUDIBLE as a syllable but gives Azure the coarticulation a
 *     real en-GB synthetic-phonics teacher uses; CONTINUANTS (f/v/s/m/n/l/r/
 *     w/y/z/h/j) stay BARE. Its acceptance test is the sponsor's ear: "does
 *     the release stay inaudible as a syllable?" (surfaced on the page).
 *   • Candidate g applies the RCT-backed pacing tweak (Gonzalez-Frey/Ehri
 *     2021: 250ms segmented phonation makes beginning readers FORGET the
 *     initial phoneme before they blend) — 150ms inter-phoneme break +
 *     -20% rate — so the sponsor can A/B the pacing against the slower
 *     baseline directly.
 * The levers across the set are break PLACEMENT, the rate wrap, pitch/volume,
 * the clipped-stop release, and pacing.
 *
 * The candidate set is intentionally an ARRAY of pure functions so Dave's
 * phonics note (design/research/cvc-blend-audio-phonics.md, in flight) can
 * add or veto a candidate by editing `BLEND_CANDIDATES` alone — the render
 * script and page iterate it generically.
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

/** Production constants (mirror api/_tts.ts so the baseline is byte-faithful). */
const PROD_GRAPHEME_BREAK_MS = 250
const PROD_WHOLE_WORD_BREAK_MS = 450
const PROD_BLEND_RATE = '-12%'

/** RCT-backed tightened pacing (Dave's note — Gonzalez-Frey/Ehri 2021):
 *  a shorter inter-phoneme break + a slower whole-line rate so the segmented
 *  phonation doesn't outrun a beginning reader's phonemic memory. */
const TIGHT_GRAPHEME_BREAK_MS = 150
const TIGHT_BLEND_RATE = '-20%'

/** Stop consonants — the graphemes whose isolated phoneme is unreleased and
 *  scratches on Azure neural. These are the ONLY graphemes that get the
 *  clipped `<stop>ə` release in candidate f; every other grapheme (continuant
 *  consonant or vowel) stays bare. `c`/`k` both decode to /k/; `x`=/ks/ ends
 *  in a stop but is a cluster — left BARE (the cluster's /s/ tail releases it
 *  naturally, and a `ksə` would read as "kss-uh"). */
const STOP_GRAPHEMES: ReadonlySet<string> = new Set([
  'b',
  'c',
  'd',
  'g',
  'k',
  'p',
  't',
])

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

/** Build one `<phoneme>` tag for a grapheme, or the bare escaped glyph if the
 *  grapheme is unmapped (defensive — every CVC grapheme is mapped). */
function phonemeTag(grapheme: string): string {
  const ipa = BLEND_GRAPHEME_IPA[grapheme.toLowerCase()]
  if (ipa === undefined) return esc(grapheme)
  return `<phoneme alphabet="ipa" ph="${esc(ipa)}">${esc(grapheme)}</phoneme>`
}

/** Build one `<phoneme>` tag with Dave's clipped-release treatment: a STOP
 *  grapheme's IPA gets a trailing `ə` (an inaudible coarticulation release,
 *  NOT a full "kuh" syllable); a continuant or vowel stays bare. Candidate f. */
function releasedPhonemeTag(grapheme: string): string {
  const g = grapheme.toLowerCase()
  const ipa = BLEND_GRAPHEME_IPA[g]
  if (ipa === undefined) return esc(grapheme)
  const released = STOP_GRAPHEMES.has(g) ? `${ipa}ə` : ipa
  return `<phoneme alphabet="ipa" ph="${esc(released)}">${esc(grapheme)}</phoneme>`
}

/** A single blend candidate (one SSML treatment, applied to every word). */
export interface BlendCandidate {
  /** Stable slug used in the manifest itemId + page row. */
  id: string
  /** Short human label shown on the page. */
  label: string
  /** One-line description of the MECHANISM being tried (shown on the page). */
  mechanism: string
  /**
   * Build the SSML inner-text for this candidate from the target word.
   * Returns the raw inner-SSML (`<phoneme>`/`<prosody>`/`<break>` markup).
   * `null` is reserved for an A/B baseline that should render through the
   * production path — but the blend audition builds even the baseline by
   * hand (the production `renderBlendInnerText` is a pure function we mirror
   * exactly), so no candidate here returns null.
   */
  buildInner: (word: string) => string
}

// ─────────────────────────────────────────────────────────────────────────
// CANDIDATE a — baseline (current production renderBlendInnerText)
// ─────────────────────────────────────────────────────────────────────────
// Break BEFORE each phoneme, whole line wrapped in <prosody rate="-12%">.
// This is the REJECTED render — the A/B anchor every other candidate is
// compared against.
const CANDIDATE_BASELINE: BlendCandidate = {
  id: 'a',
  label: 'a — baseline (current live render)',
  mechanism:
    'Break BEFORE each bare phoneme + whole line in <prosody rate="-12%">. ' +
    'The REJECTED production render (~37/40 FAIL, voice-QA #463).',
  buildInner: (word) => {
    const parts: string[] = []
    for (const g of splitGraphemes(word)) {
      parts.push(`<break time="${PROD_GRAPHEME_BREAK_MS}ms"/>`)
      parts.push(phonemeTag(g))
    }
    parts.push(`<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>`)
    parts.push(esc(word))
    return `<prosody rate="${PROD_BLEND_RATE}">${parts.join('')}</prosody>`
  },
}

// ─────────────────────────────────────────────────────────────────────────
// CANDIDATE b — break AFTER each phoneme (still -12% rate)
// ─────────────────────────────────────────────────────────────────────────
// Moving the pause to FOLLOW each phoneme lets a stop RELEASE into the
// silence instead of being preceded by a dead gap that forces an unreleased,
// scratchy onset. Keeps the -12% rate so this isolates the break-placement
// lever from the rate lever.
const CANDIDATE_BREAK_AFTER: BlendCandidate = {
  id: 'b',
  label: 'b — break AFTER each phoneme',
  mechanism:
    'Phoneme THEN break (stop releases into the pause) + same -12% rate wrap. ' +
    'Isolates the break-placement lever from the rate lever.',
  buildInner: (word) => {
    const parts: string[] = []
    for (const g of splitGraphemes(word)) {
      parts.push(phonemeTag(g))
      parts.push(`<break time="${PROD_GRAPHEME_BREAK_MS}ms"/>`)
    }
    parts.push(`<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>`)
    parts.push(esc(word))
    return `<prosody rate="${PROD_BLEND_RATE}">${parts.join('')}</prosody>`
  },
}

// ─────────────────────────────────────────────────────────────────────────
// CANDIDATE c — no -12% prosody (house rate), break-after
// ─────────────────────────────────────────────────────────────────────────
// Drop the whole-line rate wrap entirely — render at the speak-root house
// rate (-10%). Per the round-5 letter-name/scratchy audition (86ca8c3t7),
// the rate-slow OVER-articulates the isolated-phoneme onset. Pairs with
// break-after (the better placement) so this tests "remove the rate lever".
const CANDIDATE_NO_RATE: BlendCandidate = {
  id: 'c',
  label: 'c — no -12% rate (house rate), break-after',
  mechanism:
    'No whole-line <prosody rate> — phonemes at the house rate (-10%), each ' +
    'followed by a break. Tests removing the rate lever the round-5 audition ' +
    'found over-articulates isolated onsets (86ca8c3t7).',
  buildInner: (word) => {
    const parts: string[] = []
    for (const g of splitGraphemes(word)) {
      parts.push(phonemeTag(g))
      parts.push(`<break time="${PROD_GRAPHEME_BREAK_MS}ms"/>`)
    }
    parts.push(`<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>`)
    parts.push(esc(word))
    return parts.join('')
  },
}

// ─────────────────────────────────────────────────────────────────────────
// CANDIDATE d — letter-sounds-tier treatment (pure phonemes)
// ─────────────────────────────────────────────────────────────────────────
// Reuse the EXACT accepted letter-sounds SSML envelope: a 300ms break BEFORE
// each phoneme, no whole-line rate wrap (house rate). The letter-sounds tier
// is mostly Thomas-ACCEPTED with the SAME break-before-phoneme machinery —
// the only difference is its IPA payloads are continuants/schwa-released.
// Here we apply its envelope to the PURE blend phonemes (no schwa). If this
// sounds clean, the break-before placement was never the problem and the
// -12% rate wrap was the culprit.
const LETTER_SOUNDS_BREAK_MS = 300
const CANDIDATE_LETTER_SOUNDS: BlendCandidate = {
  id: 'd',
  label: 'd — letter-sounds envelope (300ms break-before, no rate wrap)',
  mechanism:
    'Exact accepted letter-sounds shape: 300ms break BEFORE each phoneme, no ' +
    'whole-line rate wrap. Same break-before machinery the accepted ' +
    'letter-sounds tier uses, applied to PURE blend phonemes.',
  buildInner: (word) => {
    const parts: string[] = []
    for (const g of splitGraphemes(word)) {
      parts.push(`<break time="${LETTER_SOUNDS_BREAK_MS}ms"/>`)
      parts.push(phonemeTag(g))
    }
    parts.push(`<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>`)
    parts.push(esc(word))
    return parts.join('')
  },
}

// ─────────────────────────────────────────────────────────────────────────
// CANDIDATE e — round-5 winning lever: pitch-drop + volume-cut, no rate
// ─────────────────────────────────────────────────────────────────────────
// The file's own round-5 audition (86ca8c3t7) found the winning lever for
// isolated-phoneme scratch was a LOWER PITCH + volume cut, NOT a rate-slow.
// Port that to blend: each phoneme wrapped in <prosody pitch="-2st"
// volume="-15%"> (the f0-prominence drop that read as "soft" for vvv/O),
// break-after, no whole-line rate wrap. Still PURE phonemes (no schwa).
const CANDIDATE_PITCH_SOFT: BlendCandidate = {
  id: 'e',
  label: 'e — pitch-drop + volume-cut per phoneme (round-5 lever)',
  mechanism:
    'Each phoneme in <prosody pitch="-2st" volume="-15%"> (the round-5 ' +
    'audition winner lever for isolated-phoneme scratch), break-after, no ' +
    'rate wrap. Drops the buzzy onset f0 the rate-slow over-articulated.',
  buildInner: (word) => {
    const parts: string[] = []
    for (const g of splitGraphemes(word)) {
      parts.push(
        `<prosody pitch="-2st" volume="-15%">${phonemeTag(g)}</prosody>`,
      )
      parts.push(`<break time="${PROD_GRAPHEME_BREAK_MS}ms"/>`)
    }
    parts.push(`<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>`)
    parts.push(esc(word))
    return parts.join('')
  },
}

// ─────────────────────────────────────────────────────────────────────────
// CANDIDATE f — lightly-released stops (Dave's TOP-ranked treatment)
// ─────────────────────────────────────────────────────────────────────────
// Each STOP consonant (b/c/k/d/g/p/t) gets a clipped `<stop>ə` release that
// is INAUDIBLE as a syllable (NOT "kuh") but gives Azure the coarticulation a
// real en-GB synthetic-phonics teacher uses; continuants + vowels stay BARE.
// This is structurally what synthetic-phonics teaching does. Break-after (the
// better placement), no whole-line rate wrap. Acceptance test the page
// surfaces: "does the stop release stay inaudible as a syllable, or does it
// drift toward 'kuh-a-tuh'?"
const CANDIDATE_RELEASED_STOPS: BlendCandidate = {
  id: 'f',
  label: 'f — lightly-released stops (Dave top pick)',
  mechanism:
    'STOPS (b/c/k/d/g/p/t) get a clipped <stop>ə release (inaudible as a ' +
    'syllable, NOT "kuh"); continuants + vowels stay bare. Break-after, no ' +
    'rate wrap. Listen: does the release stay sub-syllabic?',
  buildInner: (word) => {
    const parts: string[] = []
    for (const g of splitGraphemes(word)) {
      parts.push(releasedPhonemeTag(g))
      parts.push(`<break time="${PROD_GRAPHEME_BREAK_MS}ms"/>`)
    }
    parts.push(`<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>`)
    parts.push(esc(word))
    return parts.join('')
  },
}

// ─────────────────────────────────────────────────────────────────────────
// CANDIDATE g — RCT-backed tightened pacing (150ms break, -20% rate)
// ─────────────────────────────────────────────────────────────────────────
// Same structure as the baseline (break-before, rate wrap) but with Dave's
// RCT-backed pacing: a 150ms inter-phoneme break (down from 250ms) and a -20%
// rate (down from -12%). Gonzalez-Frey/Ehri 2021: a 250ms segmented
// phonation makes beginning readers FORGET the initial phoneme before they
// blend. Included so the sponsor can A/B the PACING against the slower
// baseline directly (lever = pacing, IPA + placement held at baseline).
const CANDIDATE_TIGHT_PACING: BlendCandidate = {
  id: 'g',
  label: 'g — tightened pacing (150ms break, -20% rate)',
  mechanism:
    'Baseline structure (break-before + rate wrap) at the RCT-backed pacing: ' +
    '150ms inter-phoneme break + -20% rate (Gonzalez-Frey/Ehri 2021 — 250ms ' +
    'outruns a beginner’s phonemic memory). A/B the pacing vs baseline.',
  buildInner: (word) => {
    const parts: string[] = []
    for (const g of splitGraphemes(word)) {
      parts.push(`<break time="${TIGHT_GRAPHEME_BREAK_MS}ms"/>`)
      parts.push(phonemeTag(g))
    }
    parts.push(`<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>`)
    parts.push(esc(word))
    return `<prosody rate="${TIGHT_BLEND_RATE}">${parts.join('')}</prosody>`
  },
}

/** The candidate set, in display order. Baseline FIRST (the A/B anchor).
 *  Trivially extensible — append a `BlendCandidate` to add a row, or remove
 *  one to veto it. Dave's phonics note may edit this array alone. */
export const BLEND_CANDIDATES: BlendCandidate[] = [
  CANDIDATE_BASELINE,
  CANDIDATE_BREAK_AFTER,
  CANDIDATE_NO_RATE,
  CANDIDATE_LETTER_SOUNDS,
  CANDIDATE_PITCH_SOFT,
  CANDIDATE_RELEASED_STOPS,
  CANDIDATE_TIGHT_PACING,
]

/** One auditioned word: the CVC target + why it's a representative hard case. */
export interface BlendWord {
  /** The target CVC word (also the slug). */
  word: string
  /** Why this word is in the set (the hard phoneme it probes). */
  context: string
}

/** The 5 representative words spanning the hard cases (per the ticket):
 *  cat / dog / big / box (the /ks/ grapheme) / van (the /v/). */
export const BLEND_WORDS: BlendWord[] = [
  {
    word: 'cat',
    context:
      'Voiceless stops /k/ + /t/ — the classic "scratch no C, then AT then ' +
      'CAT" failure (voice-QA #463). The canonical hard case.',
  },
  {
    word: 'dog',
    context:
      'Voiced stops /d/ + /ɡ/ — voiced stops also need a vowel release Azure ' +
      'cannot give them bare.',
  },
  {
    word: 'big',
    context:
      'Voiced stops /b/ + /ɡ/ around a short /ɪ/ — "scratchy and no b... bag" ' +
      'class of failure on the leading voiced stop.',
  },
  {
    word: 'box',
    context:
      'The /ks/ cluster grapheme — /b/ stop onset + the x=/ks/ two-phoneme ' +
      'grapheme. Probes whether the cluster IPA itself scratches in isolation.',
  },
  {
    word: 'van',
    context:
      'The voiced labiodental fricative /v/ — flagged scratchy ×4 in the ' +
      'letter-sounds audit (the round-5 pitch lever is what greened it there).',
  },
]
