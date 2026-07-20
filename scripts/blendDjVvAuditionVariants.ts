/**
 * /dʒ/-recovery + isolated-/v/ audition variant specs — ticket
 * devon/blend-dj-vv-audition (blend pass-7 follow-up).
 *
 * ⚠️  NOT PRODUCTION CODE.  ⚠️
 * --------------------------------------------------------------------------
 * This module drives `scripts/renderBlendDjVvAudition.ts`, which renders a
 * grid of candidate SSML treatments for TWO open scratch problems, both
 * auditioned through the real Azure pipeline (same voice config the app uses:
 * en-GB-OliviaNeural, rate -10%) and surfaced on a single A/B page. Thomas
 * ear-tests, picks a winner per group, and a SEPARATE follow-up PR ports the
 * winning treatment into production + re-bakes the real canon. Do NOT wire
 * this module into the runtime bundle, and do NOT change production behaviour
 * here.
 *
 * ════════════════════════════════════════════════════════════════════════
 * DELIVERABLE 1 — /dʒ/ blend recovery (jam / jet / jug)
 * ════════════════════════════════════════════════════════════════════════
 * Blend pass-7 (#479) recovered /v/ and /w/ from FLOOR to a held + schwa-tail
 * length-mark onset (`vːə`/`wːə` @ -25%). The ONLY blend floor left is /dʒ/
 * (grapheme `j`): jam/jet/jug currently render as the whole-word FLOOR shape
 * (Emma says the whole word, no segmentation) because the affricate can't be
 * "held" like a continuant, so the `ːə` trick doesn't directly apply.
 *
 * Baseline (candidate j0) = the current floored whole-word render
 * (`<prosody rate="-15%">jam</prosody>` + 450ms break + bare "jam"). Every
 * other candidate attempts an ACTUAL j-a-m segmentation so Marian hears the
 * onset sounded out. The IPA payloads for a/m/e/t/u/g are the EXACT
 * production blend IPA (mirror of BLEND_GRAPHEME_IPA in api/_tts.ts) so only
 * the /dʒ/ onset lever varies; stops (m is a continuant, t/g are stops) keep
 * the production `<stop>ə` release for stops and bare IPA for continuants/
 * vowels, exactly as the full-fidelity blend render does.
 *
 * The affricate levers (per the brief's starting directions + my own):
 *   • j1 d+ʒ split — `d` stop-burst (`də` release) then held `ʒ` + schwa tail
 *     (`ʒːə`). Models the affricate as its two component phonemes.
 *   • j2 IPA affricate + schwa tail — single `dʒːə` (held + schwa-tail length
 *     mark, the SAME trick that recovered /v/ + /w/ in pass-7).
 *   • j3 tie-bar affricate + schwa tail — `d͡ʒə` (U+0361 combining tie bar, the
 *     canonical single-affricate IPA) + schwa. Tests whether Olivia honours
 *     the tie-bar form better than the bare-digraph `dʒ`.
 *   • j4 brief stop + fricative tail, slowed — `dʒ` at the fricative-onset
 *     nested-prosody rate (-25%) like /f/+/s/+/v/+/w/ take, no extra schwa.
 *   • j5 ʒ-only held onset — drop the `d`, render the held `ʒːə` buzz alone
 *     (closest "j" buzz; tests whether dropping the stop burst removes the
 *     scratch source).
 *   • j6 d+ʒ split, held-and-slowed — `də` release + a nested-prosody held
 *     `ʒːə` @ -25% (combines j1's split with j4's slow envelope on the
 *     fricative half only).
 *
 * RUNTIME-REACHABILITY CAVEAT carried from pass-5/7: the graduation cvc-words
 * path renders blend lines LIVE at runtime, and the production runtime Azure
 * resource REJECTS (HTTP 400) the nested `<prosody><phoneme></prosody>` onset
 * shape that j4/j6 use. So even if a nested-onset candidate wins the ear-test,
 * it is BAKE-ONLY (full-fidelity); words with /dʒ/ never appear in the
 * graduation novel-probe pool (nap/rat/map/tap), so floored-at-runtime is
 * acceptable for the short-a tier. The follow-up impl PR must respect the
 * pass-5/7 runtime-safe split. (The live tweak handle #473 stays KEPT for
 * /dʒ/ if every candidate misses.)
 *
 * ════════════════════════════════════════════════════════════════════════
 * DELIVERABLE 2 — isolated letter-sound /v/ "vvv" cross-benefit
 * ════════════════════════════════════════════════════════════════════════
 * The 4 letter-sounds-audit /v/ clips (`letter-sounds-audit#word.p2.{read,
 * correct,hint,giveAnswer}`) were accepted as a model-FLOOR in #446 ("vvv
 * scratchy"). The current production render (round-5 winner v2) is
 * `<phoneme ph="və">vvv</phoneme>` wrapped in
 * `<prosody pitch="-3st" rate="-15%" volume="-20%">`. HYPOTHESIS (this
 * ticket): the proven held + schwa-tail `vːə` (or sustained `vː`) onset that
 * just recovered the BLEND /v/ in pass-7 may also clean up the ISOLATED
 * letter-sound /v/ — same voiced labiodental fricative, different context.
 *
 * Baseline (vv0) = the EXACT current production render (mirrors
 * renderLetterSoundsInnerText's softenScratchy path for vvv byte-for-byte).
 * The candidates re-try the pass-7 held-onset shape on the isolated mnemonic:
 *   • vv1 pass-7 held onset — `vːə` @ rate -25% (the EXACT blend pass-7 win,
 *     transplanted; NO pitch/volume cut — let the length-mark do the work).
 *   • vv2 pass-7 held onset + soft — `vːə` @ rate -25% + volume -20% (adds
 *     the round-5 loudness tame on top of the pass-7 length mark).
 *   • vv3 sustained vː (no schwa) — `vː` @ rate -25% (just the held
 *     fricative, no schwa tail — tests whether the schwa tail is needed in
 *     isolation or only helped the blend transition into the next phoneme).
 *   • vv4 pass-7 held onset + pitch — `vːə` @ pitch -3st + rate -25% (keeps
 *     the round-5 pitch lever — the one that greened it before — on the
 *     pass-7 IPA).
 *
 * All four /v/ candidates wrap ONLY the lowercase `vvv` token; the surrounding
 * prose (carrier sentence) is voiced by Olivia's lexicon exactly as production
 * does (the production path wraps only the mnemonic too). The utterance TEXT
 * is never changed (SSML-only).
 *
 * The candidate sets are intentionally ARRAYS of pure functions so a reviewer
 * or Thomas can add/veto a candidate by editing the arrays alone — the render
 * script and page iterate them generically.
 *
 * SSML returned here is the INNER-TEXT region only (between the speak-root
 * `<prosody>` open/close). The render script wraps it in the production
 * speak/voice/prosody shell with EMMA_VOICE_CONFIG so each candidate is
 * auditioned in the same acoustic frame the app uses.
 */

/** Per-grapheme IPA — mirrors `BLEND_GRAPHEME_IPA` in api/_tts.ts EXACTLY so
 *  the non-/dʒ/ phonemes in jam/jet/jug render identically to production and
 *  the audition isolates ONLY the /dʒ/ onset lever. */
const BLEND_GRAPHEME_IPA: Readonly<Record<string, string>> = {
  a: 'æ',
  o: 'ɒ',
  u: 'ə',
  i: 'ɘ',
  e: 'e',
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
  x: 'ks',
}

/** Production blend constants (mirror api/_tts.ts so the baseline is faithful). */
const PROD_GRAPHEME_BREAK_MS = 250
const PROD_WHOLE_WORD_BREAK_MS = 450
const PROD_FLOOR_RATE = '-15%'
/** Rate the pass-5/7 fricative/held onset uses (nested prosody, bake-only). */
const HELD_ONSET_RATE = '-25%'
/** Settle break after a held onset, before the candidate-f beat (mirror). */
const HELD_ONSET_SETTLE_BREAK_MS = 150

/** Stop consonants — get the clipped `<stop>ə` release (production candidate-f,
 *  voice-QA #463). For jam/jet/jug the relevant stops are t (jet) and g (jug);
 *  m (jam) is a continuant and stays bare. */
const STOP_GRAPHEMES: ReadonlySet<string> = new Set([
  'b',
  'c',
  'd',
  'g',
  'k',
  'p',
  't',
])

/** XML-escape (mirror api/_tts.ts escapeSsml — duplicated to keep this
 *  audition module free of any production import that could drift). */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Split a CVC word into single-char graphemes (the v1 /dʒ/ words jam/jet/jug
 *  have no multi-letter grapheme — `x` is the only one and never appears
 *  with `j`). */
function splitGraphemes(word: string): string[] {
  return word.toLowerCase().split('')
}

/** Build one `<phoneme>` tag for a NON-onset grapheme with the production
 *  full-fidelity treatment: STOP → clipped `<stop>ə` release; continuant /
 *  vowel → bare IPA. This is exactly what renderBlendInnerText emits for every
 *  grapheme that isn't the /dʒ/ onset under audition. */
function tailPhonemeTag(grapheme: string): string {
  const g = grapheme.toLowerCase()
  const ipa = BLEND_GRAPHEME_IPA[g]
  if (ipa === undefined) return esc(grapheme)
  const released = STOP_GRAPHEMES.has(g) ? `${ipa}ə` : ipa
  return `<phoneme alphabet="ipa" ph="${esc(released)}">${esc(grapheme)}</phoneme>`
}

/** A single /dʒ/ onset SSML fragment — the markup for the LEADING `j`
 *  grapheme only. The render assembles: <onset> + break + <tail phonemes each
 *  followed by break> + whole-word break + bare word. */
export interface DjCandidate {
  id: string
  label: string
  mechanism: string
  /** Build the /dʒ/ onset SSML fragment for the leading `j` grapheme. The
   *  grapheme glyph shown inside any `<phoneme>` tag is always "j". `null`
   *  is reserved for the baseline (j0), which renders the WHOLE word as the
   *  floor shape — no segmentation — and is built specially by the render
   *  script. */
  buildOnset: (() => string) | null
}

// ── /dʒ/ onset candidates ───────────────────────────────────────────────

const DJ_BASELINE: DjCandidate = {
  id: 'j0',
  label: 'j0 — baseline (current FLOOR — whole word, no segmentation)',
  mechanism:
    'The current production render for any /dʒ/ word: <prosody rate="-15%">' +
    'word</prosody> + 450ms break + bare word. NO j-a-m segmentation. The ' +
    'A/B anchor — Emma just says the whole word.',
  buildOnset: null,
}

const DJ_D_PLUS_ZH_SPLIT: DjCandidate = {
  id: 'j1',
  label: 'j1 — d + ʒ split (stop burst, then held ʒːə)',
  mechanism:
    'Render /dʒ/ as its two components: a clipped d-stop release (də) then a ' +
    'held ʒ + schwa tail (ʒːə). Models the affricate the way a phonics ' +
    'teacher segments it — d then the "zh" buzz.',
  buildOnset: () =>
    `<phoneme alphabet="ipa" ph="də">j</phoneme>` +
    `<phoneme alphabet="ipa" ph="ʒːə">j</phoneme>`,
}

const DJ_AFFRICATE_SCHWA: DjCandidate = {
  id: 'j2',
  label: 'j2 — dʒːə (held affricate + schwa tail, the pass-7 trick)',
  mechanism:
    'Single bare-digraph affricate dʒ with the pass-7 held + schwa-tail length ' +
    'mark (dʒːə) — the EXACT shape that recovered /v/ + /w/. Tests whether the ' +
    '"held continuant + schwa" lever generalises to the affricate.',
  buildOnset: () => `<phoneme alphabet="ipa" ph="dʒːə">j</phoneme>`,
}

const DJ_LONG_AFFRICATE: DjCandidate = {
  id: 'j3',
  label: 'j3 — dʒː (long affricate, NO schwa tail)',
  mechanism:
    'Length-marked affricate dʒː with NO schwa tail — give the affricate more ' +
    'duration to articulate cleanly while avoiding any "-uh" coloration. (The ' +
    'tie-bar d͡ʒə was tried and renders byte-identical to j2 — Azure normalises ' +
    'the U+0361 tie bar away — so this distinct length-only lever replaces it.)',
  buildOnset: () => `<phoneme alphabet="ipa" ph="dʒː">j</phoneme>`,
}

const DJ_SLOWED_NESTED: DjCandidate = {
  id: 'j4',
  label: 'j4 — dʒ slowed (nested -25% envelope, like /f/+/s/+/v/+/w/)',
  mechanism:
    'Bare affricate dʒ wrapped in the SAME nested <prosody rate="-25%"> + 150ms ' +
    'settle break that /f/+/s/+/v/+/w/ take in full-fidelity mode. No extra ' +
    'schwa — the slow envelope alone. BAKE-ONLY (runtime resource 400s nested onset).',
  buildOnset: () =>
    `<prosody rate="${HELD_ONSET_RATE}">` +
    `<phoneme alphabet="ipa" ph="dʒ">j</phoneme>` +
    `</prosody>` +
    `<break time="${HELD_ONSET_SETTLE_BREAK_MS}ms"/>`,
}

const DJ_ZH_ONLY: DjCandidate = {
  id: 'j5',
  label: 'j5 — ʒːə only (drop the d, held buzz alone)',
  mechanism:
    'Drop the d stop-burst entirely — render just the held ʒ + schwa tail (ʒːə), ' +
    'the closest "j" buzz without the stop. Tests whether the d burst is the ' +
    'scratch source (a stop with no vowel to lean on).',
  buildOnset: () => `<phoneme alphabet="ipa" ph="ʒːə">j</phoneme>`,
}

const DJ_SPLIT_SLOWED: DjCandidate = {
  id: 'j6',
  label: 'j6 — d + held-slowed ʒ (split + nested -25% on the buzz half)',
  mechanism:
    'j1’s d-release split, but the ʒ half gets the nested <prosody rate="-25%"> ' +
    '+ settle-break envelope (ʒːə slowed). Combines the component split with the ' +
    'pass-7 slow shape on the fricative half. BAKE-ONLY (nested onset).',
  buildOnset: () =>
    `<phoneme alphabet="ipa" ph="də">j</phoneme>` +
    `<prosody rate="${HELD_ONSET_RATE}">` +
    `<phoneme alphabet="ipa" ph="ʒːə">j</phoneme>` +
    `</prosody>` +
    `<break time="${HELD_ONSET_SETTLE_BREAK_MS}ms"/>`,
}

export const DJ_CANDIDATES: DjCandidate[] = [
  DJ_BASELINE,
  DJ_D_PLUS_ZH_SPLIT,
  DJ_AFFRICATE_SCHWA,
  DJ_LONG_AFFRICATE,
  DJ_SLOWED_NESTED,
  DJ_ZH_ONLY,
  DJ_SPLIT_SLOWED,
]

/** A /dʒ/ word to audition. The blend canon text shape is
 *  `"<g> - <g> - <g> ... <word>"`; here we store the bare word and rebuild
 *  the segmented render in the script. */
export interface DjWord {
  word: string
  context: string
}

/** The 3 /dʒ/ words (the only short-? CVC words with a leading `j`):
 *  jam (short-a, in the canonical 14-word pack), jet, jug. */
export const DJ_WORDS: DjWord[] = [
  {
    word: 'jam',
    context:
      '/dʒ/ + /æ/ + /m/. jam is in the canonical short-a pack (a real session ' +
      'target). m is a continuant (bare IPA); only the /dʒ/ onset is the open ' +
      'question. The canonical hard case.',
  },
  {
    word: 'jet',
    context:
      '/dʒ/ + /e/ + /t/. t is a voiceless stop (clipped tə release in ' +
      'production). Probes /dʒ/ onset into a short-e vowel.',
  },
  {
    word: 'jug',
    context:
      '/dʒ/ + /ə/(short-u) + /ɡ/. g is a voiced stop (clipped ɡə release). ' +
      'Probes /dʒ/ onset into a short-u vowel + voiced-stop coda.',
  },
]

/**
 * Build the full segmented blend inner-text for a /dʒ/ candidate on a word.
 * Mirrors renderBlendInnerText's full-fidelity assembly: each grapheme's
 * markup followed by a 250ms break, then a 450ms whole-word break, then the
 * bare word voiced naturally. The LEADING `j` uses the candidate's onset
 * fragment; every TAIL grapheme uses the production tail treatment. NO
 * whole-line <prosody rate> wrap (the house rate -10% governs), matching
 * production. Returns the inner-text region only.
 */
export function buildDjInner(word: string, candidate: DjCandidate): string {
  const graphemes = splitGraphemes(word)
  const parts: string[] = []
  for (let i = 0; i < graphemes.length; i++) {
    const g = graphemes[i]!
    if (i === 0) {
      // Leading /dʒ/ onset — the candidate fragment. (buildOnset is non-null
      // for every non-baseline candidate; the baseline is handled by the
      // render script via the floor path, never here.)
      parts.push(candidate.buildOnset!())
    } else {
      parts.push(tailPhonemeTag(g))
    }
    parts.push(`<break time="${PROD_GRAPHEME_BREAK_MS}ms"/>`)
  }
  parts.push(`<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>`)
  parts.push(esc(word))
  return parts.join('')
}

/**
 * The baseline (j0) whole-word FLOOR inner-text — mirrors
 * renderBlendFloorInnerText in api/_tts.ts byte-for-byte:
 * `<prosody rate="-15%">word</prosody>` + 450ms break + bare word.
 */
export function buildDjFloorInner(word: string): string {
  const w = esc(word)
  return (
    `<prosody rate="${PROD_FLOOR_RATE}">${w}</prosody>` +
    `<break time="${PROD_WHOLE_WORD_BREAK_MS}ms"/>${w}`
  )
}

// ════════════════════════════════════════════════════════════════════════
// DELIVERABLE 2 — isolated letter-sound /v/ "vvv"
// ════════════════════════════════════════════════════════════════════════

/** A single isolated-/v/ candidate. Wraps ONLY the lowercase `vvv` token. */
export interface VvvCandidate {
  id: string
  label: string
  mechanism: string
  /** The markup that REPLACES the lowercase `vvv` token (the rest of the
   *  carrier sentence is escaped plain, exactly as production does). */
  vvvMarkup: string
}

const VVV_BASELINE: VvvCandidate = {
  id: 'vv0',
  label: 'vv0 — baseline (current production render — accepted model-floor)',
  mechanism:
    'The EXACT live render (round-5 winner v2): <prosody pitch="-3st" rate="-15%" ' +
    'volume="-20%"><phoneme ph="və">vvv</phoneme></prosody>. The accepted ' +
    'model-floor (#446) — your A/B anchor.',
  vvvMarkup:
    '<prosody pitch="-3st" rate="-15%" volume="-20%">' +
    '<phoneme alphabet="ipa" ph="və">vvv</phoneme></prosody>',
}

const VVV_PASS7_HELD: VvvCandidate = {
  id: 'vv1',
  label: 'vv1 — pass-7 held onset (vːə @ rate -25%, no pitch/volume cut)',
  mechanism:
    'The EXACT blend pass-7 win transplanted: <prosody rate="-25%"><phoneme ' +
    'ph="vːə">vvv</phoneme></prosody>. Held fricative + schwa-tail length mark, ' +
    'let the IPA do the work (no pitch/volume lever).',
  vvvMarkup:
    '<prosody rate="-25%">' +
    '<phoneme alphabet="ipa" ph="vːə">vvv</phoneme></prosody>',
}

const VVV_DEEP_SLOW: VvvCandidate = {
  id: 'vv2',
  label: 'vv2 — deeper-slow held onset (vːə @ rate -35%)',
  mechanism:
    'pass-7 vːə at a DEEPER rate slow than vv1: <prosody rate="-35%">' +
    '<phoneme ph="vːə">vvv</phoneme></prosody>. Tests whether pushing the rate ' +
    'past the pass-7 -25% smooths the onset further. (A vv2 with volume="-20%" ' +
    'AND a vv2 with a double length-mark vːːə each rendered byte-identical to ' +
    'vv1 — Azure ignores volume on this wrap and caps the length mark — so this ' +
    'distinct rate lever replaces them.)',
  vvvMarkup:
    '<prosody rate="-35%">' +
    '<phoneme alphabet="ipa" ph="vːə">vvv</phoneme></prosody>',
}

const VVV_SUSTAINED_NO_SCHWA: VvvCandidate = {
  id: 'vv3',
  label: 'vv3 — sustained vː (no schwa tail) @ rate -25%',
  mechanism:
    'Just the held fricative, no schwa: <prosody rate="-25%"><phoneme ph="vː">' +
    'vvv</phoneme></prosody>. Tests whether the schwa tail is needed in isolation ' +
    'or only smoothed the blend transition into the next phoneme.',
  vvvMarkup:
    '<prosody rate="-25%">' +
    '<phoneme alphabet="ipa" ph="vː">vvv</phoneme></prosody>',
}

const VVV_PASS7_HELD_PITCH: VvvCandidate = {
  id: 'vv4',
  label: 'vv4 — pass-7 held onset + pitch (vːə @ pitch -3st + rate -25%)',
  mechanism:
    'pass-7 vːə kept with the round-5 PITCH lever (the one that greened it before): ' +
    '<prosody pitch="-3st" rate="-25%"><phoneme ph="vːə">vvv</phoneme></prosody>. ' +
    'Length mark + low f0, no volume cut.',
  vvvMarkup:
    '<prosody pitch="-3st" rate="-25%">' +
    '<phoneme alphabet="ipa" ph="vːə">vvv</phoneme></prosody>',
}

export const VVV_CANDIDATES: VvvCandidate[] = [
  VVV_BASELINE,
  VVV_PASS7_HELD,
  VVV_DEEP_SLOW,
  VVV_SUSTAINED_NO_SCHWA,
  VVV_PASS7_HELD_PITCH,
]

/** One isolated-/v/ slot to audition: the carrier text + provenance. The 4
 *  flagged /v/ clips are letter-sounds-audit#word.p2.{read,correct,hint,
 *  giveAnswer}; reprompt ("Hmm... try again?") is generic + shared, NOT
 *  /v/-specific, so it is omitted. */
export interface VvvSlot {
  /** Slug == the p2 slot name. */
  slot: string
  /** Provenance itemId in the committed canon. */
  canonItemId: string
  /** Exact canonical text (asserted against live canon by the render script). */
  text: string
  /** Why this slot is here. */
  context: string
}

export const VVV_SLOTS: VvvSlot[] = [
  {
    slot: 'read',
    canonItemId: 'letter-sounds-audit#word.p2.read',
    text: 'Which letter says vvv?',
    context:
      'The read prompt — vvv sits before a "?" so the carrier gets question ' +
      'prosody; the mnemonic itself is what scratched.',
  },
  {
    slot: 'correct',
    canonItemId: 'letter-sounds-audit#word.p2.correct',
    text: 'Yes. V says it. vvv?',
    context: 'The correct slot — vvv trails the letter-name "V" + "says it".',
  },
  {
    slot: 'hint',
    canonItemId: 'letter-sounds-audit#word.p2.hint',
    text: 'It says vvv?',
    context: 'The hint — shortest carrier, vvv near-isolated.',
  },
  {
    slot: 'giveAnswer',
    canonItemId: 'letter-sounds-audit#word.p2.giveAnswer',
    text: 'This one is V. V says it. vvv?',
    context:
      'The giveAnswer — fricative giveAnswer shape ("V says it."); production ' +
      'injects a 350ms lead break after "This one is V." before the rest.',
  },
]

/**
 * Build the isolated-/v/ inner-text for a candidate on a slot's carrier text.
 * Wraps ONLY the lowercase `vvv` token with the candidate markup; the rest is
 * escaped plain. Does NOT reproduce the production carrier-sentence prosody
 * (question wrap, 350ms giveAnswer lead break) — the audition isolates the
 * MNEMONIC render lever, and the carrier prose is identical across candidates,
 * so the A/B comparison is clean. (The follow-up impl PR ports only the
 * winning vvvMarkup into SCRATCHY_PROSODY_BY_MNEMONIC + the vvv PHONEME_OVERRIDE
 * IPA; the carrier-sentence handling in renderLetterSoundsInnerText is
 * unchanged.)
 */
export function buildVvvInner(text: string, candidate: VvvCandidate): string {
  const idx = text.indexOf('vvv')
  if (idx < 0) return esc(text)
  return (
    esc(text.slice(0, idx)) + candidate.vvvMarkup + esc(text.slice(idx + 3))
  )
}
