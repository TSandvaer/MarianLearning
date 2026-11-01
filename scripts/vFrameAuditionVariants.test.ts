/**
 * @vitest-environment node
 *
 * Frame-fidelity tests for the /v/ in-FRAME audition.
 *
 * The load-bearing §4.4.7 guarantee of this audition is that each in-frame
 * candidate is rendered in the ACTUAL production utterance frame — same
 * lead/trailing prose, same 300ms reset break, same 350ms giveAnswer lead
 * break — so the A/B isolates ONLY the /v/ treatment. These tests lock that:
 * `buildInFrameInner(text, PROD_FLOOR_VVV_MARKUP)` must byte-match the real
 * production `renderSsmlInnerText(text, 'letter-sounds')` for all 4 slots.
 *
 * If `renderLetterSoundsInnerText` ever changes its break structure (or the
 * /v/ floor markup moves), this test fails and the audition frame must be
 * resynced before re-rendering — preventing a silent regression to the
 * bare-token-only failure mode that motivated this audition.
 */
import { describe, expect, it } from 'vitest'

import { renderSsmlInnerText } from '../api/_tts.ts'
import {
  V_SLOTS,
  V_CANDIDATES,
  buildInFrameInner,
  deQuestionText,
  PROD_FLOOR_VVV_MARKUP,
} from './vFrameAuditionVariants.ts'

describe('vFrameAudition — frame fidelity (§4.4.7)', () => {
  const inFrameSlots = V_SLOTS.filter((s) => !s.isolated)

  it('audits all 4 production slots in-frame plus 1 isolated reference', () => {
    expect(inFrameSlots.map((s) => s.key)).toEqual([
      'read',
      'correct',
      'hint',
      'giveAnswer',
    ])
    expect(V_SLOTS.filter((s) => s.isolated).map((s) => s.key)).toEqual([
      'isolated',
    ])
  })

  it.each(inFrameSlots)(
    'in-frame builder byte-matches production renderSsmlInnerText for slot "$key"',
    (slot) => {
      const production = renderSsmlInnerText(slot.text, 'letter-sounds')
      const handBuilt = buildInFrameInner(slot.text, PROD_FLOOR_VVV_MARKUP)
      // Substituting the production floor /v/ markup reproduces production
      // byte-for-byte — so candidates v1..v4 differ ONLY in the /v/ markup.
      expect(handBuilt).toEqual(production)
    },
  )

  it('every in-frame slot carries the 300ms mnemonic reset break', () => {
    for (const slot of inFrameSlots) {
      const built = buildInFrameInner(slot.text, PROD_FLOOR_VVV_MARKUP)
      expect(built).toContain('<break time="300ms"/>')
    }
  })

  it('the fricative-giveAnswer slot carries the extra 350ms lead break', () => {
    const give = inFrameSlots.find((s) => s.key === 'giveAnswer')!
    const built = buildInFrameInner(give.text, PROD_FLOOR_VVV_MARKUP)
    expect(built).toContain('<break time="350ms"/>')
    // Read/correct/hint do NOT get the 350ms lead break.
    for (const key of ['read', 'correct', 'hint']) {
      const slot = inFrameSlots.find((s) => s.key === key)!
      expect(buildInFrameInner(slot.text, PROD_FLOOR_VVV_MARKUP)).not.toContain(
        '<break time="350ms"/>',
      )
    }
  })
})

describe('vFrameAudition — de-question lever (v5)', () => {
  it('rewrites only the terminal ? to . on the question slots', () => {
    expect(deQuestionText('Which letter says vvv?')).toBe(
      'Which letter says vvv.',
    )
    expect(deQuestionText('It says vvv?')).toBe('It says vvv.')
    // Mid-string punctuation is untouched (no ? mid-string in these texts,
    // but the regex is anchored to the trailing ? defensively).
    expect(deQuestionText('Yes. V says it. vvv?')).toBe('Yes. V says it. vvv.')
  })

  it('leaves a non-question text unchanged', () => {
    expect(deQuestionText('vvv')).toBe('vvv')
  })
})

describe('vFrameAudition — candidate set', () => {
  it('runs v0..v5 with v0 (floor anchor) first and exactly two production-path candidates (v0, v5)', () => {
    expect(V_CANDIDATES.map((c) => c.id)).toEqual([
      'v0',
      'v1',
      'v2',
      'v3',
      'v4',
      'v5',
    ])
    expect(V_CANDIDATES[0]!.id).toBe('v0')
    const productionPath = V_CANDIDATES.filter((c) => c.buildVvvMarkup === null)
    expect(productionPath.map((c) => c.id)).toEqual(['v0', 'v5'])
    // v5 is the only de-question candidate.
    expect(V_CANDIDATES.filter((c) => c.deQuestion).map((c) => c.id)).toEqual([
      'v5',
    ])
  })

  it('every hand-built candidate (v1..v4) emits a phoneme-wrapped vvv token', () => {
    for (const c of V_CANDIDATES) {
      if (c.buildVvvMarkup === null) continue
      const markup = c.buildVvvMarkup()
      expect(markup).toContain('<phoneme alphabet="ipa"')
      expect(markup).toContain('>vvv</phoneme>')
      // No leading break — the frame builder injects the 300ms reset break.
      expect(markup.startsWith('<break')).toBe(false)
    }
  })
})
