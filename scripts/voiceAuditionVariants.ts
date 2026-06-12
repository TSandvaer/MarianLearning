/**
 * Voice-audition variant specs — ticket 86ca7yh5k.
 *
 * ⚠️  NOT PRODUCTION CODE.  ⚠️
 * --------------------------------------------------------------------------
 * This module exists ONLY to drive `scripts/renderVoiceAudition.ts`, which
 * renders a grid of candidate SSML treatments for three sounds that have now
 * REJECTED TWO production fix rounds each (PR #375 round-1, PR #384/ticket
 * 86ca7y0hj round-2). It is deliberately decoupled from
 * `api/_tts.ts::renderSsmlInnerText` because the whole point of the audition
 * is to explore treatments BEYOND the ones already baked into (and rejected
 * from) that production path.
 *
 * The WINNING treatment per sound — picked by Thomas's ear on the audition
 * page — must later be ported into `renderSsmlInnerText` (the production-
 * coherence rule, planner-and-canon.md §"SSML fixes must live in
 * renderSsmlInnerText"). That porting is a SEPARATE follow-up PR; this PR is
 * audition-only. Do NOT wire this module into the runtime bundle.
 *
 * Mechanism reference — what's ALREADY been rejected (do not re-propose):
 *   • vvv  — `<phoneme ph="vːə">` + `<prosody rate="-20%" volume="-12%">`
 *            (round-2, REJECTED ×4); `<phoneme ph="və">` + rate `-12%`
 *            (round-1, REJECTED).
 *   • O    — `<break 250ms/>` + `<prosody rate="-18%" volume="-8%">` on the
 *            bare letter (round-2, REJECTED — "weird pressure"); rate `-12%`
 *            (round-1, REJECTED).
 *   • four — `<break 250ms/>` + `<prosody pitch="+12%" rate="-25%">` +
 *            `<phoneme ph="fɔːr">` (round-2, REJECTED — "for comes after
 *            three"); rate `-18%` + 200ms break (round-1, REJECTED).
 *
 * Each variant below picks a DIFFERENT MECHANISM, not a parameter micro-step.
 * The utterance TEXT is never changed (SSML-only — ticket out-of-scope fence).
 *
 * SSML returned here is the INNER-TEXT region only (the bit between the
 * speak-root `<prosody>` open/close). The render script wraps it in the
 * production speak/voice/prosody shell with the production voice config
 * (en-GB-OliviaNeural, rate -10%, pitch +0Hz, volume +0%) so each variant is
 * auditioned in the same acoustic frame the app uses.
 */

/** A single audition variant for one sound. */
export interface AuditionVariant {
  /** Stable slug used in the manifest itemId + page row. */
  id: string
  /** Short human label shown on the page. */
  label: string
  /** One-line description of the MECHANISM being tried (shown on the page). */
  mechanism: string
  /**
   * Build the SSML inner-text for this variant from the canonical utterance
   * text. Returns the raw inner-SSML (may contain `<phoneme>`, `<prosody>`,
   * `<break>` markup). `null` means "use the production renderSsmlInnerText
   * path" — reserved for variant 0 (the current live render baseline).
   */
  buildInner: (text: string) => string | null
}

/** One auditioned sound: a canon utterance + its candidate variants. */
export interface AuditionSound {
  /** Stable slug (vvv / o-letter-name / four). */
  key: string
  /** Human title for the page group. */
  title: string
  /** The dedup-group canonical itemId in the committed canon (provenance). */
  canonItemId: string
  /** Exact canonical text — asserted against the live canon by the render
   *  script so a text drift fails loudly rather than auditioning stale text. */
  text: string
  /** Production tierFilter for variant-0 baseline rendering. */
  tierFilter: string | undefined
  /** Why this sound is here (round history). */
  context: string
  variants: AuditionVariant[]
}

/** XML-escape (mirrors api/_tts.ts escapeSsml — duplicated to keep this
 *  audition module free of any production-code import that could drift). */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Variant 0 sentinel — render through the production renderSsmlInnerText. */
const BASELINE: AuditionVariant['buildInner'] = () => null

// ─────────────────────────────────────────────────────────────────────────
// SOUND 1 — "vvv" (letter-sounds-audit#word.p2.*) — "still very scratchy" ×4
// ─────────────────────────────────────────────────────────────────────────
// Rejected: vːə length-mark + rate-20% + vol-12%. The residual complaint is
// a hard, buzzy ONSET on the voiced labiodental fricative. New mechanisms:
//   • Much deeper volume cuts (-30%+) — attack the loudness directly, past
//     the rejected -12%.
//   • Pitch-lowered — a lower f0 voiced fricative buzzes less harshly.
//   • Slow + break-isolated — give the run-out room with a longer break.
//   • Alternative IPA shapes — syllabic /v̩/, doubled /vv/, schwa-tail-only
//     /əv/ (lead-in schwa instead of trailing), bare /v/ with strong soften.
//
// The "vvv" mnemonic appears inside the text; we wrap ONLY that token and
// leave the surrounding prose to Olivia's lexicon. Slot texts vary
// ("Which letter says vvv?", "Yes. V says it. vvv?", etc.) so the builder
// finds-and-wraps the lowercase "vvv" token wherever it sits.

/** Wrap the lowercase `vvv` token in `inner`, escaping the rest. The token is
 *  always lowercase + word-bounded in the canon text (the letter NAME is "V"
 *  uppercase, never collides). */
function wrapVvv(text: string, vvvMarkup: string): string {
  const idx = text.indexOf('vvv')
  if (idx < 0) return esc(text)
  return esc(text.slice(0, idx)) + vvvMarkup + esc(text.slice(idx + 3))
}

const VVV: AuditionSound = {
  key: 'vvv',
  title: 'vvv — letter-sound /v/ (scratchy ×4)',
  canonItemId: 'letter-sounds-audit#word.p2.read',
  text: 'Which letter says vvv?',
  tierFilter: 'letter-sounds',
  context:
    'Voiced labiodental fricative. Rejected twice: schwa-tail (və, round-1) ' +
    'and length-mark+rate-20%+vol-12% (vːə, round-2). Residual = hard buzzy onset.',
  variants: [
    {
      id: 'v0',
      label: 'Variant 0 — current live render',
      mechanism:
        'Production renderSsmlInnerText (vːə + rate-20% + vol-12%). The REJECTED baseline.',
      buildInner: BASELINE,
    },
    {
      id: 'v1',
      label: 'Deep volume cut',
      mechanism:
        'vːə phoneme, rate-15%, volume -35% — attack loudness directly, far past the rejected -12%.',
      buildInner: (t) =>
        wrapVvv(
          t,
          '<prosody rate="-15%" volume="-35%"><phoneme alphabet="ipa" ph="vːə">vvv</phoneme></prosody>',
        ),
    },
    {
      id: 'v2',
      label: 'Pitch-lowered',
      mechanism:
        'Bare /v/ + ə tail, pitch -3st, volume -20% — a lower f0 voiced fricative buzzes less.',
      buildInner: (t) =>
        wrapVvv(
          t,
          '<prosody pitch="-3st" rate="-15%" volume="-20%"><phoneme alphabet="ipa" ph="və">vvv</phoneme></prosody>',
        ),
    },
    {
      id: 'v3',
      label: 'Break-isolated + long run',
      mechanism:
        '350ms lead break, vːː extra-long fricative, rate-30%, no volume cut — give the run-out room, isolate the onset.',
      buildInner: (t) =>
        wrapVvv(
          t,
          '<break time="350ms"/><prosody rate="-30%"><phoneme alphabet="ipa" ph="vːːə">vvv</phoneme></prosody>',
        ),
    },
    {
      id: 'v4',
      label: 'Syllabic /v̩/',
      mechanism:
        'Syllabic consonant v̩ (no schwa) + pitch -2st + volume -25% — alternative IPA shape Olivia may render smoother.',
      buildInner: (t) =>
        wrapVvv(
          t,
          '<prosody pitch="-2st" volume="-25%"><phoneme alphabet="ipa" ph="v̩ː">vvv</phoneme></prosody>',
        ),
    },
    {
      id: 'v5',
      label: 'Leading-schwa onset ramp',
      mechanism:
        'əv (schwa BEFORE the fricative) + rate-20% + volume -28% — ramp INTO the buzz instead of front-loading it.',
      buildInner: (t) =>
        wrapVvv(
          t,
          '<prosody rate="-20%" volume="-28%"><phoneme alphabet="ipa" ph="əvː">vvv</phoneme></prosody>',
        ),
    },
    {
      id: 'v6',
      label: 'Soft + deep, no length mark',
      mechanism:
        'Plain /v/ (no length mark), rate-25%, pitch -2st, volume -30% — let prosody do all the smoothing, not the IPA.',
      buildInner: (t) =>
        wrapVvv(
          t,
          '<prosody pitch="-2st" rate="-25%" volume="-30%"><phoneme alphabet="ipa" ph="v">vvv</phoneme></prosody>',
        ),
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────
// SOUND 2 — "O" letter-NAME (letter-names#word.p5.hint) — "weird pressure"
// ─────────────────────────────────────────────────────────────────────────
// Text: "Let's look. O." — the terminal isolated letter NAME "O" ("oh") has
// a scratchy/pressured onset. Rejected: rate-12% (round-1); rate-18% +
// vol-8% + 250ms break (round-2 — Thomas: "weird pressure on O"). The
// "pressure" complaint suggests the rate-slowing is OVER-articulating the
// onset. New mechanisms:
//   • Lower pitch + softer volume + SLOWER ATTACK combos (gentler, not just
//     slower).
//   • A plain UNWRAPPED render (let Olivia's native lexicon voice the bare
//     letter with no prosody at all — maybe the wrap itself is the pressure).
//   • Phoneme-pinned long /əʊ/ (the GOOSE/GOAT diphthong) so Olivia stops
//     treating it as a stressed clipped vowel.
//   • A trailing micro-break (let the vowel decay naturally instead of
//     getting cut).

/** Replace the terminal "O." in "Let's look. O." with `letterMarkup`. */
function buildOHint(text: string, letterMarkup: string): string {
  // text is exactly "Let's look. O."
  const m = /^(Let's look\.)\s+(O)\.\s*$/.exec(text)
  if (!m) return esc(text)
  return esc(m[1]!) + ' ' + letterMarkup + esc('.')
}

const O_LETTER: AuditionSound = {
  key: 'o-letter-name',
  title: 'O — letter NAME "oh" (weird pressure)',
  canonItemId: 'letter-names#word.p5.hint',
  text: "Let's look. O.",
  tierFilter: 'letter-names',
  context:
    'Isolated terminal letter NAME. Rejected twice: rate-12% (round-1), ' +
    'rate-18%+vol-8%+250ms break (round-2 — "weird pressure on O").',
  variants: [
    {
      id: 'o0',
      label: 'Variant 0 — current live render',
      mechanism:
        'Production renderSsmlInnerText (250ms break + rate-18% + vol-8% on bare letter). The REJECTED baseline.',
      buildInner: BASELINE,
    },
    {
      id: 'o1',
      label: 'Plain unwrapped',
      mechanism:
        'No break, no prosody — let Olivia voice the bare letter natively. Tests whether the WRAP itself is the pressure.',
      buildInner: (t) => buildOHint(t, esc('O')),
    },
    {
      id: 'o2',
      label: 'Gentle: soft volume only',
      mechanism:
        '200ms break + volume -14% ONLY (no rate change) — soften without the rate-slow that over-articulates the onset.',
      buildInner: (t) =>
        buildOHint(
          t,
          '<break time="200ms"/><prosody volume="-14%">O</prosody>',
        ),
    },
    {
      id: 'o3',
      label: 'Lower pitch + soft',
      mechanism:
        '200ms break + pitch -2st + volume -12% — drop the f0 prominence that reads as "pressure", keep the rate natural.',
      buildInner: (t) =>
        buildOHint(
          t,
          '<break time="200ms"/><prosody pitch="-2st" volume="-12%">O</prosody>',
        ),
    },
    {
      id: 'o4',
      label: 'Phoneme-pinned /əʊ/',
      mechanism:
        '250ms break + <phoneme əʊ> (the GOAT diphthong) + volume -10% — pin the letter-name vowel so Olivia stops clipping it.',
      buildInner: (t) =>
        buildOHint(
          t,
          '<break time="250ms"/><prosody volume="-10%"><phoneme alphabet="ipa" ph="əʊ">O</phoneme></prosody>',
        ),
    },
    {
      id: 'o5',
      label: 'Trailing decay break',
      mechanism:
        '150ms lead break + rate-8% + a 120ms break AFTER the letter — let the vowel decay instead of being cut at the period.',
      buildInner: (t) => {
        const m = /^(Let's look\.)\s+(O)\.\s*$/.exec(t)
        if (!m) return esc(t)
        return (
          esc(m[1]!) +
          ' <break time="150ms"/><prosody rate="-8%">O</prosody>' +
          esc('.') +
          '<break time="120ms"/>'
        )
      },
    },
    {
      id: 'o6',
      label: 'Low + slow attack, no break',
      mechanism:
        'No lead break, pitch -3st + rate-10% + volume -16% — a gentle continuous onset rather than a break-then-stress.',
      buildInner: (t) =>
        buildOHint(
          t,
          '<prosody pitch="-3st" rate="-10%" volume="-16%">O</prosody>',
        ),
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────
// SOUND 3 — "four comes after three" (number-recog#math.p6.hint)
// ─────────────────────────────────────────────────────────────────────────
// Text: "Look. Four comes after three." On en-GB-OliviaNeural (non-rhotic)
// the mid-sentence de-stressed "Four" collapses toward the reduced "for".
// Rejected: rate-18% + 200ms break + fɔːr (round-1); pitch+12% + rate-25% +
// 250ms break + fɔːr (round-2 — "for comes after three"). The phoneme leans
// on a rhotic /r/ Olivia doesn't realise; pitch+rate alone didn't restore
// prominence. New mechanisms:
//   • Full-word IPA without the rhotic — /fɔː/ (non-rhotic long open-O, the
//     ACTUAL en-GB realisation) instead of the rhotic /fɔːr/.
//   • say-as interpret-as cardinal/ordinal — force the NUMBER reading.
//   • Pre/post breaks isolating "Four" more aggressively + larger pitch
//     contour via stepped <prosody> (contour attribute).
//   • Diphthong-style /fɔə/ (centring diphthong — gives the vowel more body).
//   • A bare stressed prosody with NO phoneme (let Olivia's lexicon pick the
//     number reading once it's prominent enough).

/** Replace "Four" in "Look. Four comes after three." with `fourMarkup`. */
function buildFourHint(
  text: string,
  prefix: string,
  fourMarkup: string,
  suffix: string,
): string {
  // text is exactly "Look. Four comes after three."
  if (text !== 'Look. Four comes after three.') return esc(text)
  return prefix + fourMarkup + suffix
}

const FOUR: AuditionSound = {
  key: 'four',
  title: '"Four comes after three" (sounds like "for")',
  canonItemId: 'number-recog#math.p6.hint',
  text: 'Look. Four comes after three.',
  tierFilter: undefined,
  context:
    'Mid-sentence de-stressed "Four" collapses to "for" on non-rhotic Olivia. ' +
    'Rejected twice: rate-18%+fɔːr (round-1), pitch+12%+rate-25%+fɔːr (round-2).',
  variants: [
    {
      id: 'f0',
      label: 'Variant 0 — current live render',
      mechanism:
        'Production renderSsmlInnerText (250ms break + pitch+12% + rate-25% + fɔːr). The REJECTED baseline.',
      buildInner: BASELINE,
    },
    {
      id: 'f1',
      label: 'Non-rhotic /fɔː/',
      mechanism:
        '250ms break + pitch+10% + <phoneme fɔː> (NO rhotic r — the actual en-GB realisation Olivia can voice).',
      buildInner: (t) =>
        buildFourHint(
          t,
          esc('Look. ') + '<break time="250ms"/>',
          '<prosody pitch="+10%" rate="-15%"><phoneme alphabet="ipa" ph="fɔː">Four</phoneme></prosody>',
          esc(' comes after three.'),
        ),
    },
    {
      id: 'f2',
      label: 'Centring diphthong /fɔə/',
      mechanism:
        '<phoneme fɔə> centring diphthong + pitch+8% — more vowel body than a flat long-O, distinct from "for".',
      buildInner: (t) =>
        buildFourHint(
          t,
          esc('Look. ') + '<break time="200ms"/>',
          '<prosody pitch="+8%"><phoneme alphabet="ipa" ph="fɔə">Four</phoneme></prosody>',
          esc(' comes after three.'),
        ),
    },
    {
      id: 'f3',
      label: 'Pitch-contour rise',
      mechanism:
        'Stepped <prosody contour> (rise to +18% mid-word) + fɔː + rate-18% — a moving f0 contour reads as deliberate number-naming, not flat de-stressed "for".',
      buildInner: (t) =>
        buildFourHint(
          t,
          esc('Look. ') + '<break time="250ms"/>',
          '<prosody contour="(0%,+8%) (50%,+18%) (100%,+6%)" rate="-18%"><phoneme alphabet="ipa" ph="fɔː">Four</phoneme></prosody>',
          esc(' comes after three.'),
        ),
    },
    {
      id: 'f4',
      label: 'Hard isolation (pre+post break)',
      mechanism:
        '300ms break BEFORE + 150ms break AFTER "Four" + pitch+12% — fully isolate the word so it carries its own stress island.',
      buildInner: (t) =>
        buildFourHint(
          t,
          esc('Look.') + '<break time="300ms"/>',
          '<prosody pitch="+12%" rate="-20%"><phoneme alphabet="ipa" ph="fɔː">Four</phoneme></prosody>',
          '<break time="150ms"/>' + esc(' comes after three.'),
        ),
    },
    {
      id: 'f5',
      label: 'Bare stress, no phoneme',
      mechanism:
        'NO phoneme — just pitch+14% + rate-15% + volume+6% on the lexicon word. Tests if prominence alone picks the number reading.',
      buildInner: (t) =>
        buildFourHint(
          t,
          esc('Look. ') + '<break time="250ms"/>',
          '<prosody pitch="+14%" rate="-15%" volume="+6%">Four</prosody>',
          esc(' comes after three.'),
        ),
    },
    {
      id: 'f6',
      label: 'Long /fɔːː/ + steep rise',
      mechanism:
        'Extra-long <phoneme fɔːː> + steep pitch rise (+16%) + rate-22% — maximal length AND prominence past the rejected -25%/+12%.',
      buildInner: (t) =>
        buildFourHint(
          t,
          esc('Look. ') + '<break time="280ms"/>',
          '<prosody pitch="+16%" rate="-22%"><phoneme alphabet="ipa" ph="fɔːː">Four</phoneme></prosody>',
          esc(' comes after three.'),
        ),
    },
  ],
}

export const AUDITION_SOUNDS: AuditionSound[] = [VVV, O_LETTER, FOUR]
