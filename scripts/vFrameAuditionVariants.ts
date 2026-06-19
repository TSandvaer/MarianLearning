/**
 * /v/ in-FRAME audition variant specs — letter-sound "vvv" scratch, round-6.
 *
 * ⚠️  NOT PRODUCTION CODE.  ⚠️
 * --------------------------------------------------------------------------
 * This module exists ONLY to drive `scripts/renderVFrameAudition.ts`, which
 * renders a grid of candidate /v/ treatments for the letter-sounds "vvv"
 * mnemonic. It is deliberately decoupled from the production
 * `api/_tts.ts::renderSsmlInnerText` for variants 1..N (the candidates explore
 * treatments beyond the rejected production floor), while variant v0 routes
 * THROUGH the production path so it is a byte-faithful A/B anchor.
 *
 * WHY THIS AUDITION EXISTS (the §4.4.7 representativeness lesson)
 * --------------------------------------------------------------------------
 * The earlier `voiceAuditionVariants.ts` /v/ pass auditioned ONLY the single
 * `p2.read` text "Which letter says vvv?", and its `wrapVvv` helper did NOT
 * reproduce the production 300ms break injected before the mnemonic. Its vv2
 * winner (`vːə`@-35%) won that BARE-TOKEN audition but STILL scratched in the
 * production sentence frame, so it was reverted and the /v/ floor (#446)
 * currently stands. Root-cause hypothesis: the production frame (the connected
 * sentence lead-in + the ~300ms prosodic-reset break + the trailing `?`) re-
 * introduces the scratch that an isolated token hides.
 *
 * So per testing-and-ci.md §4.4.7 (audition-frame representativeness), EVERY
 * candidate here is rendered in the ACTUAL production utterance frame, for all
 * FOUR production slots, through the SAME break/lead-break structure
 * `renderLetterSoundsInnerText` injects at bake time — AND, separately, as the
 * bare isolated "vvv" token for direct A/B. The 4 production slots + their real
 * canon texts (letter-sounds-audit.json#word.p2.*):
 *   • read       — "Which letter says vvv?"
 *   • correct    — "Yes. V says it. vvv?"
 *   • hint       — "It says vvv?"
 *   • giveAnswer — "This one is V. V says it. vvv?"
 *
 * The candidate winner (if any beats the floor in-frame) lands in
 * `renderSsmlInnerText` / `SCRATCHY_PROSODY_BY_MNEMONIC` via a SEPARATE
 * follow-up PR + canon re-bake. This PR is AUDITION-ONLY. Do NOT wire this
 * module into the runtime bundle and do NOT change production behaviour here.
 *
 * SSML returned by a candidate's `buildVvvMarkup` is the `vvv`-REGION markup
 * only (the `<prosody>`/`<phoneme>` that replaces the bare "vvv" token); the
 * render script wraps it in the production frame (lead/trailing prose +
 * 300ms reset break + giveAnswer 350ms lead break) and then in the production
 * speak/voice/prosody shell with the production voice config
 * (en-GB-OliviaNeural, rate -10%, pitch +0Hz, volume +0%) so each candidate is
 * auditioned in the identical acoustic frame the app uses; only the /v/
 * treatment differs.
 */

/** The lowercase mnemonic token wrapped in the canon text. The letter NAME is
 *  uppercase "V" and never collides with the lowercase "vvv" mnemonic. */
export const VVV_TOKEN = 'vvv'

/** Production frame constants — mirror `renderLetterSoundsInnerText` /
 *  `applyPhonemeOverrides` in api/_tts.ts EXACTLY so the in-frame candidates
 *  carry the production break structure and only the /v/ markup differs. */
export const PROD_MNEMONIC_BREAK_MS = 300
export const PROD_FRICATIVE_GIVEANSWER_LEAD_BREAK_MS = 350

/** XML-escape (mirrors api/_tts.ts escapeSsml — duplicated to keep this
 *  audition module free of any production-code import that could drift; the
 *  frame-fidelity test in vFrameAuditionVariants.test.ts asserts the result
 *  still byte-matches the production renderSsmlInnerText). */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Build the production-FRAME inner-SSML for a candidate, mirroring
 * `renderLetterSoundsInnerText` + `applyPhonemeOverrides` byte-structure:
 *
 *   <escaped lead><break 300ms/><vvv markup><escaped trailing>
 *
 * and for the fricative-giveAnswer shape ("This one is V. V says it. vvv?"),
 * the extra 350ms lead break after the first "This one is V." sentence:
 *
 *   <esc "This one is V."><break 350ms/><esc "V says it. "><break 300ms/><vvv markup><esc "?">
 *
 * `vvvMarkup` is the candidate's `<prosody>`/`<phoneme>` region (no leading
 * break — this function injects the 300ms reset break itself, exactly where
 * production does). The text is split on the lowercase "vvv" token.
 *
 * INVARIANT (tested): substituting the production floor /v/ markup
 * (`<prosody pitch="-3st" rate="-15%" volume="-20%"><phoneme ph="və">vvv
 * </phoneme></prosody>`) makes this byte-match `renderSsmlInnerText(text,
 * 'letter-sounds')` for all 4 in-frame slots. That is the §4.4.7 guarantee:
 * the in-frame candidates differ from the production floor ONLY in the /v/
 * treatment.
 */
export function buildInFrameInner(text: string, vvvMarkup: string): string {
  const idx = text.indexOf(VVV_TOKEN)
  if (idx < 0) throw new Error(`no "${VVV_TOKEN}" token in: ${text}`)
  const lead = text.slice(0, idx)
  const trailing = text.slice(idx + VVV_TOKEN.length)
  const breakTag = `<break time="${PROD_MNEMONIC_BREAK_MS}ms"/>`

  // Fricative-giveAnswer lead break (cluster 2): "This one is <L>. <L> says
  // it. <mnem>?" → 350ms break after the first sentence. Mirrors
  // renderLetterSoundsInnerText's fricativeGiveAnswer branch.
  const fricativeGiveAnswer = /^This one is ([A-Z])\.\s+\1 says it\./.test(text)
  if (fricativeGiveAnswer) {
    const firstStop = lead.indexOf('.') + 1 // end of "This one is V."
    const leadSentence = lead.slice(0, firstStop) // "This one is V."
    const restLead = lead.slice(firstStop) // " V says it. "
    return (
      `${esc(leadSentence)}` +
      `<break time="${PROD_FRICATIVE_GIVEANSWER_LEAD_BREAK_MS}ms"/>` +
      `${esc(restLead.replace(/^\s+/, ''))}` +
      `${breakTag}${vvvMarkup}${esc(trailing)}`
    )
  }

  return `${esc(lead)}${breakTag}${vvvMarkup}${esc(trailing)}`
}

/** Strip the terminal `?` → `.` (the v5 de-question lever). Only touches a
 *  trailing `?` (optionally followed by whitespace). */
export function deQuestionText(text: string): string {
  return text.replace(/\?(\s*)$/, '.$1')
}

/** The production floor /v/ markup — `və` + the round-5 scratchy prosody
 *  (SCRATCHY_PROSODY_BY_MNEMONIC.vvv in api/_tts.ts). Exported so the
 *  frame-fidelity test can substitute it and assert the byte-match against
 *  the production renderSsmlInnerText. */
export const PROD_FLOOR_VVV_MARKUP =
  '<prosody pitch="-3st" rate="-15%" volume="-20%">' +
  '<phoneme alphabet="ipa" ph="və">vvv</phoneme>' +
  '</prosody>'

/** A single /v/ candidate treatment. */
export interface VCandidate {
  /** Stable slug used in the manifest itemId + page row. */
  id: string
  /** Short human label shown on the page. */
  label: string
  /** One-line description of the MECHANISM being tried (shown on the page). */
  mechanism: string
  /**
   * Build the `vvv`-REGION markup for this candidate. Returns the
   * `<prosody>`/`<phoneme>` markup that REPLACES the bare "vvv" token; the
   * 300ms reset break is injected by the render script BEFORE this markup
   * (mirroring production), so the markup here must NOT include that break.
   *
   * `null` is the v0 sentinel: render the slot through the production
   * `synthesizeUtterance` path (byte-faithful floor anchor).
   */
  buildVvvMarkup: (() => string) | null
  /**
   * De-question lever (v5): when true, the render script renders the slot
   * text with every terminal `?` replaced by `.` BEFORE building the frame —
   * isolating whether the question intonation is the scratch trigger. The
   * /v/ treatment stays the production floor (so only the punctuation lever
   * moves). Default false.
   */
  deQuestion?: boolean
}

const phoneme = (ipa: string): string =>
  `<phoneme alphabet="ipa" ph="${ipa}">${VVV_TOKEN}</phoneme>`

// ─────────────────────────────────────────────────────────────────────────
// v0 — current production floor (the A/B anchor; rendered via production path)
// ─────────────────────────────────────────────────────────────────────────
// `və` + SCRATCHY_PROSODY_BY_MNEMONIC.vvv = {pitch:-3st, rate:-15%, vol:-20%}.
// This is the round-5 winner that #446 kept as the accepted floor.
const V0_FLOOR: VCandidate = {
  id: 'v0',
  label: 'v0 — production floor (current live render)',
  mechanism:
    'Production renderSsmlInnerText: `və` + <prosody pitch="-3st" rate="-15%" ' +
    'volume="-20%">, 300ms reset break before the phoneme. The accepted floor ' +
    '(#446) — your A/B anchor.',
  buildVvvMarkup: null,
}

// ─────────────────────────────────────────────────────────────────────────
// v1 — vːə @ -35% (the bare-token winner; KNOWN-FAILS-IN-FRAME reference)
// ─────────────────────────────────────────────────────────────────────────
// The reverted vv2 candidate: length-marked schwa-tail + deep volume cut. Won
// the bare-"vvv"-token audition, STILL scratched in the production frame. Here
// for direct confirmation that the frame re-introduces the scratch.
const V1_BARETOKEN_WINNER: VCandidate = {
  id: 'v1',
  label: 'v1 — vːə @ -35% vol (bare-token winner, known-fails-in-frame)',
  mechanism:
    'Length-marked schwa-tail `vːə` + <prosody rate="-15%" volume="-35%">. The ' +
    'reverted bare-token winner — included as the reference that won isolated ' +
    'but FAILED in-frame. If it scratches here, the frame is the culprit.',
  buildVvvMarkup: () =>
    `<prosody rate="-15%" volume="-35%">${phoneme('vːə')}</prosody>`,
}

// ─────────────────────────────────────────────────────────────────────────
// v2 — STRONGER pitch-drop on the length-marked schwa-tail (vv4-style lever)
// ─────────────────────────────────────────────────────────────────────────
// Pitch was the dominant softening lever in round-5 (a lower f0 voiced
// fricative buzzes less). The floor already drops -3st; v2 pushes the lever
// HARDER to -5st on the length-marked `vːə` (more vowel body to ride the buzz
// out). NOTE the empirical reason this is -5st not -3st: at -3st + vol-25%,
// Azure rendered byte-IDENTICAL to the floor IN-FRAME (the length-mark + 5%
// volume delta is acoustically inert in connected speech — verified during
// the bake; it DID differ when isolated). So -5st is required for v2 to be a
// genuine in-frame A/B against the floor rather than a no-op collapse — itself
// a §4.4.7 finding (the frame dominates the small-delta levers).
const V2_PITCH_LENGTH: VCandidate = {
  id: 'v2',
  label: 'v2 — vːə + STRONGER pitch-drop -5st (push the round-5 pitch lever)',
  mechanism:
    'Length-marked `vːə` + <prosody pitch="-5st" rate="-15%" volume="-25%">. ' +
    'Pushes the round-5 winning lever (pitch-drop) harder than the floor’s ' +
    '-3st. (-3st + vol-25% rendered byte-identical to the floor in-frame — the ' +
    'frame collapsed the small delta — so -5st is needed for a real A/B.)',
  buildVvvMarkup: () =>
    `<prosody pitch="-5st" rate="-15%" volume="-25%">${phoneme('vːə')}</prosody>`,
}

// ─────────────────────────────────────────────────────────────────────────
// v3 — labiodental APPROXIMANT /ʋ/ in place of the fricative /v/
// ─────────────────────────────────────────────────────────────────────────
// The scratch is the FRICATION of the voiced labiodental fricative /v/. The
// labiodental approximant /ʋ/ is the same place of articulation with NO
// frication — softer by construction, and close enough that an 8-year-old hears
// "the v sound". Carry the floor's softening prosody so only the IPA moves.
const V3_APPROXIMANT: VCandidate = {
  id: 'v3',
  label: 'v3 — labiodental approximant /ʋ/ (no frication)',
  mechanism:
    'Swap the fricative /v/ for the labiodental APPROXIMANT `ʋə` — same place ' +
    'of articulation, NO frication (the scratch IS the frication). Floor ' +
    'prosody kept (pitch -3st, rate -15%, vol -20%) so only the IPA moves.',
  buildVvvMarkup: () =>
    `<prosody pitch="-3st" rate="-15%" volume="-20%">${phoneme('ʋə')}</prosody>`,
}

// ─────────────────────────────────────────────────────────────────────────
// v4 — single sustained `vː` (drop the schwa AND the triple, one held v)
// ─────────────────────────────────────────────────────────────────────────
// Both the schwa tail and the "vvv" triple visual are aids the SOUND doesn't
// need — a single sustained voiced labiodental /vː/ is the pure phoneme. The
// schwa tail may be where the onset re-attacks in-frame; drop it and let one
// long /v/ carry the mnemonic. Floor softening prosody kept.
const V4_SUSTAINED: VCandidate = {
  id: 'v4',
  label: 'v4 — single sustained `vː` (no schwa, no triple)',
  mechanism:
    'One held `vː` — drop the schwa tail entirely so there is no schwa onset to ' +
    're-attack in connected speech. Floor prosody (pitch -3st, rate -15%, vol ' +
    '-20%). The pure-phoneme reading.',
  buildVvvMarkup: () =>
    `<prosody pitch="-3st" rate="-15%" volume="-20%">${phoneme('vː')}</prosody>`,
}

// ─────────────────────────────────────────────────────────────────────────
// v5 — DE-QUESTION (render the `?`-slots as statements with `.`)
// ─────────────────────────────────────────────────────────────────────────
// Diagnostic lever: keep the production floor /v/ treatment, but render the
// terminal `?` as `.` so the slot is a STATEMENT. Isolates whether the
// question intonation (Olivia's native terminal-`?` prosody on letter-sounds,
// which gets NO question-prosody wrapper but DOES carry the natural rise) is
// what re-attacks the buzz. If v5 is clean and v0 scratches, the `?` is the
// trigger and the follow-up is a canon-text change (out of THIS audition's
// scope, but a clear next step).
const V5_DEQUESTION: VCandidate = {
  id: 'v5',
  label: 'v5 — de-question (terminal ? → . , floor /v/ unchanged)',
  mechanism:
    'Production floor /v/ treatment, but every terminal `?` rendered as `.` so ' +
    'the slot is a STATEMENT. Isolates the question-intonation lever: if v5 is ' +
    'clean where v0 scratches, the `?` rise is re-attacking the buzz.',
  buildVvvMarkup: null,
  deQuestion: true,
}

/** The candidate set, in display order. v0 (floor anchor) FIRST. Trivially
 *  extensible — append a `VCandidate` to add a row. */
export const V_CANDIDATES: VCandidate[] = [
  V0_FLOOR,
  V1_BARETOKEN_WINNER,
  V2_PITCH_LENGTH,
  V3_APPROXIMANT,
  V4_SUSTAINED,
  V5_DEQUESTION,
]

/** One audition slot: a production frame (or the isolated bare token). */
export interface VSlot {
  /** Stable slug used in the manifest itemId + page group. */
  key: string
  /** Human title for the page group. */
  title: string
  /** `letter-sounds-audit#<id>` provenance, or `isolated` for the bare token. */
  canonItemId: string
  /** The exact production utterance text (asserted against live canon by the
   *  render script for the 4 in-frame slots; the isolated slot is bare). */
  text: string
  /** True for the bare isolated "vvv" token (no surrounding prose, no break,
   *  no `?`) — the direct A/B against the in-frame renders. */
  isolated: boolean
  /** Why this slot is here / what to listen for. */
  context: string
}

/** The 4 production slots (in-frame) + 1 isolated bare-token slot.
 *  Texts mirror letter-sounds-audit.json#word.p2.* verbatim. */
export const V_SLOTS: VSlot[] = [
  {
    key: 'read',
    title: 'read — "Which letter says vvv?"',
    canonItemId: 'letter-sounds-audit#word.p2.read',
    text: 'Which letter says vvv?',
    isolated: false,
    context:
      'The first thing Marian hears. "vvv" sits sentence-FINAL before the `?`, ' +
      'after a connected lead-in — the production frame the bare-token audition ' +
      'skipped.',
  },
  {
    key: 'correct',
    title: 'correct — "Yes. V says it. vvv?"',
    canonItemId: 'letter-sounds-audit#word.p2.correct',
    text: 'Yes. V says it. vvv?',
    isolated: false,
    context:
      '"vvv" trails its own letter NAME "V" and the "says it" clause — the densest ' +
      'in-frame context for the buzz to re-attack.',
  },
  {
    key: 'hint',
    title: 'hint — "It says vvv?"',
    canonItemId: 'letter-sounds-audit#word.p2.hint',
    text: 'It says vvv?',
    isolated: false,
    context:
      'Shortest in-frame lead-in ("It says ") before the `?`-terminated "vvv".',
  },
  {
    key: 'giveAnswer',
    title: 'giveAnswer — "This one is V. V says it. vvv?"',
    canonItemId: 'letter-sounds-audit#word.p2.giveAnswer',
    text: 'This one is V. V says it. vvv?',
    isolated: false,
    context:
      'Carries the extra 350ms FRICATIVE-giveAnswer lead break after "This one ' +
      'is V." — the longest frame, two sentence boundaries before "vvv?".',
  },
  {
    key: 'isolated',
    title: 'isolated — bare "vvv" token (A/B reference)',
    canonItemId: 'isolated',
    text: 'vvv',
    isolated: true,
    context:
      'The bare token, NO frame, NO break, NO `?`. This is what the earlier ' +
      'bare-token audition heard. A candidate that is clean here but scratches ' +
      'in the 4 frames above CONFIRMS the frame is the culprit (the whole point ' +
      'of §4.4.7).',
  },
]
