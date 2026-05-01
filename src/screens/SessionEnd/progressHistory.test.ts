/**
 * Tests for `recordProgressOnSessionEnd` — the bridge from Session End into
 * the `marian-tutor:progress:v1` blob (ticket 86c9kmu63).
 *
 * Pure-logic tests, no React. The component-level test in
 * `SessionEnd.test.tsx` exercises the wiring (mount-effect calls this
 * function); these tests pin the per-call shape contract.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_SESSION_HISTORY,
  STORAGE_KEY,
  defaultProgress,
  isProgressV1,
  loadProgress,
  saveProgress,
  type Progress,
  type SessionHistoryEntry,
} from '../../lib/progress'
import { recordProgressOnSessionEnd } from './progressHistory'

describe('recordProgressOnSessionEnd', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  // ── Shape pins ─────────────────────────────────────────────────────────

  it('seeds a fresh Progress doc on the first ever session', () => {
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()

    const result = recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 7,
      dateISO: '2026-04-30T18:30:00.000Z',
    })

    // Returned value matches what landed on disk.
    const loaded = loadProgress()
    expect(loaded).toEqual(result)
    expect(isProgressV1(loaded)).toBe(true)
    expect(loaded?.schemaVersion).toBe(1)
  })

  it('writes a single history entry with the right shape (math)', () => {
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 5,
      dateISO: '2026-04-30T18:30:00.000Z',
    })

    const loaded = loadProgress()
    expect(loaded?.history).toHaveLength(1)

    const entry = loaded!.history[0]
    expect(entry).toEqual<SessionHistoryEntry>({
      dateISO: '2026-04-30T18:30:00.000Z',
      skillFocus: ['add-to-10'],
      successRate: 5 / 8,
    })
  })

  it('writes a single history entry with the right shape (word-song)', () => {
    recordProgressOnSessionEnd({
      surface: 'word-song',
      totalCorrect: 8,
      dateISO: '2026-04-30T18:31:00.000Z',
    })

    const entry = loadProgress()!.history[0]
    expect(entry).toEqual<SessionHistoryEntry>({
      dateISO: '2026-04-30T18:31:00.000Z',
      skillFocus: ['blending-cv'],
      successRate: 1,
    })
  })

  it('successRate is a float in [0, 1] and is NOT rounded', () => {
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 3,
      dateISO: '2026-04-30T00:00:00.000Z',
    })
    const entry = loadProgress()!.history[0]
    expect(entry.successRate).toBe(3 / 8) // 0.375 exact
    expect(entry.successRate).toBeGreaterThanOrEqual(0)
    expect(entry.successRate).toBeLessThanOrEqual(1)
  })

  it('zero correct → successRate = 0 (not skipped)', () => {
    // Sessions are always 8 problems; "zero attempts" doesn't apply at
    // session-end. zero CORRECT is a real outcome and should record.
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 0,
      dateISO: '2026-04-30T00:00:00.000Z',
    })
    expect(loadProgress()!.history[0].successRate).toBe(0)
  })

  // ── lastPlayedISO update ────────────────────────────────────────────────

  it('updates profile.lastPlayedISO to the supplied dateISO', () => {
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 4,
      dateISO: '2026-04-30T18:30:00.000Z',
    })
    expect(loadProgress()?.profile.lastPlayedISO).toBe(
      '2026-04-30T18:30:00.000Z',
    )
  })

  it('preserves the existing childName + character on the seeded profile', () => {
    const loaded = recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 4,
      dateISO: '2026-04-30T18:30:00.000Z',
    })
    expect(loaded.profile.childName).toBe('Marian')
    expect(loaded.profile.character).toBe('melody')
  })

  // ── Append behaviour ────────────────────────────────────────────────────

  it('appends to existing history rather than replacing', () => {
    // First session.
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 6,
      dateISO: '2026-04-30T18:30:00.000Z',
    })
    // Second session.
    recordProgressOnSessionEnd({
      surface: 'word-song',
      totalCorrect: 4,
      dateISO: '2026-05-01T19:00:00.000Z',
    })

    const loaded = loadProgress()!
    expect(loaded.history).toHaveLength(2)
    expect(loaded.history[0].skillFocus).toEqual(['add-to-10'])
    expect(loaded.history[1].skillFocus).toEqual(['blending-cv'])
    expect(loaded.profile.lastPlayedISO).toBe('2026-05-01T19:00:00.000Z')
  })

  it('does NOT touch skillLevels or mathFactsLeitner (deferred to engine)', () => {
    const seed = defaultProgress()

    // Drop a non-default mark on skillLevels + leitner so the test would
    // catch any accidental write.
    const before: Progress = {
      ...seed,
      skillLevels: { ...seed.skillLevels, 'add-to-10': 'mastered' },
      mathFactsLeitner: {
        items: [{ item: { a: 3, b: 4, op: '+' }, box: 3, lastSeen: 1234 }],
      },
    }
    saveProgress(before)

    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 7,
      dateISO: '2026-05-01T19:00:00.000Z',
    })

    const after = loadProgress()!
    expect(after.skillLevels).toEqual(before.skillLevels)
    expect(after.mathFactsLeitner).toEqual(before.mathFactsLeitner)
  })

  // ── Trim contract ──────────────────────────────────────────────────────

  it('honours MAX_SESSION_HISTORY trim on the 31st save', () => {
    // Pre-load history at MAX entries.
    const seed = defaultProgress()
    const filled: Progress = {
      ...seed,
      history: Array.from({ length: MAX_SESSION_HISTORY }, (_, i) => ({
        dateISO: new Date(2026, 0, 1 + i).toISOString(),
        skillFocus: ['add-to-10' as const],
        successRate: 0.5,
      })),
    }
    saveProgress(filled)
    expect(loadProgress()?.history).toHaveLength(MAX_SESSION_HISTORY)

    // Add the (MAX+1)th entry.
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8,
      dateISO: '2026-12-31T00:00:00.000Z',
    })

    const loaded = loadProgress()!
    expect(loaded.history).toHaveLength(MAX_SESSION_HISTORY)
    // The newest entry is preserved at the tail.
    expect(loaded.history[loaded.history.length - 1].dateISO).toBe(
      '2026-12-31T00:00:00.000Z',
    )
    // The oldest entry was dropped.
    expect(loaded.history[0].dateISO).toBe(new Date(2026, 0, 2).toISOString())
  })
})
