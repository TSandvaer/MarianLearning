/**
 * Single source of truth for the `letter-sounds` tier's 19-letter pool
 * (Wave 7 Tier A5/A8b, ticket 86c9y6gea + 86c9y6gee).
 *
 * Why this module exists
 * ----------------------
 * Prior to ticket 86c9y6xkh the 19-letter pool was duplicated at two
 * sites — once as the value-set of `LETTER_SOUND_MNEMONIC_TO_LETTER` in
 * `planFromServer.ts` (used by the wire-parser for membership /
 * mnemonic→letter resolution) and once as a fresh `readonly string[]`
 * literal in `WordSong.tsx` (used by `pickSoundDistractors` to build
 * chip trios). The two were authored from the same Kyle A5 §1.1
 * specification but had no compile-time link — if the spec ever
 * widened, the parser and the render path could drift silently.
 *
 * Devon flagged this on PR #341 (Kevin's A8b letter-sounds
 * parser+screen widen) as an easy drift point; this module is the
 * resolution. Both call sites now import from here, and a drift
 * tripwire test (`letterSoundsPool.test.ts`) pins the pool against
 * the documented Kyle A5 §1.1 inventory.
 *
 * Pool contents (Kyle A5 §1.1, locked 2026-05-23)
 * -----------------------------------------------
 * - 14 mastered consonants: M N P B T D K G S H L R F V
 * - 5 short vowels: A O U I E (mastered /æ/ + four current-target /ɒ ʌ ɪ ɛ/)
 * - Excluded from v1: X, Q, Z, Y, W, J + voiced TH, ZH, NG
 *
 * Letter case
 * -----------
 * Pool entries are UPPERCASE. The canon's `correct` line shape
 * (`"Yes! M says mmm."`) emits uppercase target glyphs; the chip-tap
 * comparison is case-strict (see Kyle's A1 §3.5 — adopted by A5 per
 * §0 Q1 adoption table).
 *
 * Pure module: no React, no I/O, no side effects.
 */

/**
 * The 14 mastered-consonant letters in the letter-sounds tier pool.
 * Per Kyle A5 §1.1. Order matches the spec table (continuants first,
 * then stops) — relevant for any future band-aware distractor logic
 * that consults the order.
 */
export const LETTER_SOUNDS_CONSONANTS: readonly string[] = [
  // Continuants
  'M',
  'N',
  'S',
  'F',
  'V',
  'L',
  'R',
  'H',
  // Stops
  'P',
  'B',
  'T',
  'D',
  'K',
  'G',
]

/**
 * The 5 short-vowel letters in the letter-sounds tier pool. Per Kyle
 * A5 §1.1. Order follows the locked vowel sequence
 * (`/æ/ → /ɒ/ → /ʌ/ → /ɪ/ → /ɛ/`) so any future band-aware logic that
 * needs "the current-target vowel" can index by progression order.
 */
export const LETTER_SOUNDS_VOWELS: readonly string[] = ['A', 'O', 'U', 'I', 'E']

/**
 * The full 19-letter pool — 14 consonants + 5 short vowels. Source of
 * truth for both wire-side membership (parser) and render-side chip
 * pool (distractor picker). Mirrors Kyle A5 §1.1 documented inventory.
 */
export const LETTER_SOUNDS_POOL: readonly string[] = [
  ...LETTER_SOUNDS_CONSONANTS,
  ...LETTER_SOUNDS_VOWELS,
]

/**
 * Mnemonic → target-letter map for the `letter-sounds` tier (Wave 7
 * A8b, ticket 86c9y6gea). Source of truth: Kyle A5 §2.3 table.
 *
 * The canon emits read lines of shape `"Which letter says <MNEMONIC>?"`
 * where `<MNEMONIC>` is a plain-prose English approximation of the
 * target phoneme — e.g. `mmm` for /m/, `tuh` for /t/, `o` for short
 * /ɒ/. The TTS render pipeline (`api/_tts.ts` PHONEME_OVERRIDES
 * tier-aware substitution shipped via PR #337) wraps each mnemonic in
 * `<phoneme>` SSML at synthesize time so Azure produces the correct
 * phoneme — the canon text stays plain prose. The parser's job is to
 * extract the mnemonic and look up which letter glyph is the correct
 * answer.
 *
 * Pool size: 14 consonant mnemonics + 5 short-vowel mnemonics = 19
 * entries. Mirrors `LETTER_SOUNDS_POOL` on the value side.
 *
 * Letter case: target letters are always UPPERCASE per the canon's
 * `correct` line shape; case-strict matching is the chip-tap contract.
 */
export const LETTER_SOUND_MNEMONIC_TO_LETTER: Readonly<Record<string, string>> =
  {
    // Continuant consonants — mnemonic uses a triplet to hint sustained
    // articulation (`mmm`, `nnn`, `sss`, `fff`, `vvv`, `lll`, `rrr`,
    // `hhh`).
    mmm: 'M',
    nnn: 'N',
    sss: 'S',
    fff: 'F',
    vvv: 'V',
    lll: 'L',
    rrr: 'R',
    hhh: 'H',
    // Stop consonants — mnemonic carries the schwa epenthesis (`puh`,
    // `buh`, `tuh`, `duh`, `kuh`, `guh`) so Azure produces an audible
    // schwa-tailed stop rather than an inaudible isolated burst.
    puh: 'P',
    buh: 'B',
    tuh: 'T',
    duh: 'D',
    kuh: 'K',
    guh: 'G',
    // Short vowels — mnemonic is the bare vowel letter; SSML phoneme
    // wrap forces the short pronunciation. Mastered vowel /æ/ + 4
    // current-target vowels /ɒ/, /ʌ/, /ɪ/, /ɛ/.
    a: 'A',
    o: 'O',
    u: 'U',
    i: 'I',
    e: 'E',
  }

/**
 * Pool of all valid mnemonic tokens (for membership checks). Derived
 * from `LETTER_SOUND_MNEMONIC_TO_LETTER` so the two stay in lockstep.
 */
export const LETTER_SOUND_MNEMONIC_POOL: ReadonlySet<string> = new Set(
  Object.keys(LETTER_SOUND_MNEMONIC_TO_LETTER),
)

/**
 * Sentinel `pictureKey` prefix for synthetic letter-sound target
 * WordEntries (the `letter-sounds` tier — Wave 7 Track A8b, ticket
 * 86c9y6gea). Distinct from A4b's `letter:` prefix so a downstream
 * consumer can tell which tier emitted the entry at a glance. The
 * preferred dispatch is on `problem.contentType === 'letter-sounds'`,
 * but the sentinel is useful for diagnostic logging + test assertions.
 */
export const LETTER_SOUND_PICTURE_KEY_PREFIX = 'letter-sounds:'
