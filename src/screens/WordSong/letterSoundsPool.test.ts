import { describe, expect, it } from 'vitest'
import {
  LETTER_SOUNDS_CONSONANTS,
  LETTER_SOUNDS_POOL,
  LETTER_SOUNDS_VOWELS,
  LETTER_SOUND_MNEMONIC_POOL,
  LETTER_SOUND_MNEMONIC_TO_LETTER,
  LETTER_SOUND_PICTURE_KEY_PREFIX,
} from './letterSoundsPool'

/**
 * Drift tripwire for the shared `letter-sounds` tier pool.
 *
 * The constants in `letterSoundsPool.ts` are the single source of
 * truth for both the wire-parser (`planFromServer.ts`) and the chip
 * renderer (`WordSong.tsx`). Per ticket 86c9y6xkh these used to be
 * duplicated across the two sites, which made silent drift possible
 * if the Kyle A5 §1.1 spec ever widened. This spec pins the pool
 * against the documented inventory so a drift surfaces as a test
 * failure rather than a runtime parser/render disagreement.
 *
 * Authority: `design/word-song/letter-sounds-content.md` §1.1.
 */
describe('letterSoundsPool — shared single source of truth', () => {
  describe('LETTER_SOUNDS_POOL', () => {
    it('contains the documented 19 letters from Kyle A5 §1.1', () => {
      // Exact-letter pin against the spec inventory: 14 consonants + 5
      // short vowels = 19 letters. Order is consonants-then-vowels
      // (continuants then stops within consonants); the order matters
      // for any future band-aware logic so we pin it explicitly.
      expect([...LETTER_SOUNDS_POOL]).toEqual([
        // Continuant consonants
        'M',
        'N',
        'S',
        'F',
        'V',
        'L',
        'R',
        'H',
        // Stop consonants
        'P',
        'B',
        'T',
        'D',
        'K',
        'G',
        // Short vowels (locked progression order)
        'A',
        'O',
        'U',
        'I',
        'E',
      ])
    })

    it('has 19 entries — pool size matches Kyle A5 §1.1 (14 consonants + 5 vowels)', () => {
      expect(LETTER_SOUNDS_POOL.length).toBe(19)
    })

    it('contains no duplicate letters', () => {
      const seen = new Set<string>()
      for (const letter of LETTER_SOUNDS_POOL) {
        expect(seen.has(letter), `duplicate letter "${letter}"`).toBe(false)
        seen.add(letter)
      }
    })

    it('is the concatenation of consonants + vowels (no drift between the slices)', () => {
      expect([...LETTER_SOUNDS_POOL]).toEqual([
        ...LETTER_SOUNDS_CONSONANTS,
        ...LETTER_SOUNDS_VOWELS,
      ])
    })

    it('contains only single-character uppercase ASCII letters', () => {
      for (const letter of LETTER_SOUNDS_POOL) {
        expect(letter).toMatch(/^[A-Z]$/)
        expect(letter.length).toBe(1)
      }
    })

    it('excludes X, Q, Z, Y, W, J per Kyle A5 §1.1 exclusions table', () => {
      // Negative pin: these letters are explicitly deferred per the
      // spec exclusions table. If a future Wave widens the pool, this
      // assertion should be updated in lockstep with the spec.
      for (const excluded of ['X', 'Q', 'Z', 'Y', 'W', 'J']) {
        expect(LETTER_SOUNDS_POOL.includes(excluded)).toBe(false)
      }
    })
  })

  describe('LETTER_SOUNDS_CONSONANTS / LETTER_SOUNDS_VOWELS slices', () => {
    it('has exactly 14 consonants per Kyle A5 §1.1', () => {
      expect(LETTER_SOUNDS_CONSONANTS.length).toBe(14)
    })

    it('has exactly 5 short vowels per Kyle A5 §1.1', () => {
      expect(LETTER_SOUNDS_VOWELS.length).toBe(5)
    })

    it('lists short vowels in the locked progression order (A → O → U → I → E)', () => {
      // Per phonics-sequence-marian.md §Q1 (Dave, locked 2026-04-26) +
      // letter-sounds-content.md §1.4. The /i/ → /e/ ordering at the
      // end of the sequence is load-bearing for the acoustic-similarity
      // ban (§1.2).
      expect([...LETTER_SOUNDS_VOWELS]).toEqual(['A', 'O', 'U', 'I', 'E'])
    })

    it('consonant and vowel slices are disjoint', () => {
      const vowels = new Set(LETTER_SOUNDS_VOWELS)
      for (const consonant of LETTER_SOUNDS_CONSONANTS) {
        expect(
          vowels.has(consonant),
          `"${consonant}" appears in both slices`,
        ).toBe(false)
      }
    })
  })

  describe('LETTER_SOUND_MNEMONIC_TO_LETTER', () => {
    it('has exactly 19 entries (14 consonant mnemonics + 5 short-vowel mnemonics)', () => {
      expect(Object.keys(LETTER_SOUND_MNEMONIC_TO_LETTER).length).toBe(19)
    })

    it('maps every mnemonic to a target letter in LETTER_SOUNDS_POOL', () => {
      const pool = new Set(LETTER_SOUNDS_POOL)
      for (const [mnemonic, letter] of Object.entries(
        LETTER_SOUND_MNEMONIC_TO_LETTER,
      )) {
        expect(
          pool.has(letter),
          `mnemonic "${mnemonic}" maps to "${letter}" which is not in LETTER_SOUNDS_POOL`,
        ).toBe(true)
      }
    })

    it('maps every LETTER_SOUNDS_POOL letter from at least one mnemonic (round-trip surjection)', () => {
      const mappedLetters = new Set(
        Object.values(LETTER_SOUND_MNEMONIC_TO_LETTER),
      )
      for (const letter of LETTER_SOUNDS_POOL) {
        expect(
          mappedLetters.has(letter),
          `letter "${letter}" has no mnemonic mapping`,
        ).toBe(true)
      }
    })

    it('produces target letters that are uppercase single ASCII chars', () => {
      for (const letter of Object.values(LETTER_SOUND_MNEMONIC_TO_LETTER)) {
        expect(letter).toMatch(/^[A-Z]$/)
      }
    })

    it('uses lowercase mnemonic keys', () => {
      for (const mnemonic of Object.keys(LETTER_SOUND_MNEMONIC_TO_LETTER)) {
        expect(mnemonic).toBe(mnemonic.toLowerCase())
      }
    })
  })

  describe('LETTER_SOUND_MNEMONIC_POOL', () => {
    it('stays in lockstep with LETTER_SOUND_MNEMONIC_TO_LETTER keys', () => {
      const expected = new Set(Object.keys(LETTER_SOUND_MNEMONIC_TO_LETTER))
      expect(LETTER_SOUND_MNEMONIC_POOL.size).toBe(expected.size)
      for (const mnemonic of expected) {
        expect(LETTER_SOUND_MNEMONIC_POOL.has(mnemonic)).toBe(true)
      }
    })
  })

  describe('LETTER_SOUND_PICTURE_KEY_PREFIX', () => {
    it('is the documented sentinel prefix "letter-sounds:"', () => {
      expect(LETTER_SOUND_PICTURE_KEY_PREFIX).toBe('letter-sounds:')
    })
  })
})
