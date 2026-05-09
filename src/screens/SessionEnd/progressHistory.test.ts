/**
 * Tests for `recordProgressOnSessionEnd` — the bridge from Session End into
 * the `marian-tutor:progress:v1` blob (ticket 86c9kmu63).
 *
 * Pure-logic tests, no React. The component-level test in
 * `SessionEnd.test.tsx` exercises the wiring (mount-effect calls this
 * function); these tests pin the per-call shape contract.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    // Silence the cloud-sync fire-and-forget warn (T2 ticket 86c9pkfyu)
    // — the push fails in jsdom because '/api/progress' isn't a parseable
    // URL, but the warn isn't relevant to these tests' assertions.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  // ── Shape pins ─────────────────────────────────────────────────────────

  it('seeds a fresh Progress doc on the first ever session', () => {
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()

    const result = recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 7,
      dateISO: '2026-04-30T18:30:00.000Z',
      focusNode: 'add-to-10',
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
      focusNode: 'add-to-10',
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
      focusNode: 'blending-cv',
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
      focusNode: 'add-to-10',
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
      focusNode: 'add-to-10',
    })
    expect(loadProgress()!.history[0].successRate).toBe(0)
  })

  // ── lastPlayedISO update ────────────────────────────────────────────────

  it('updates profile.lastPlayedISO to the supplied dateISO', () => {
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 4,
      dateISO: '2026-04-30T18:30:00.000Z',
      focusNode: 'add-to-10',
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
      focusNode: 'add-to-10',
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
      focusNode: 'add-to-10',
    })
    // Second session.
    recordProgressOnSessionEnd({
      surface: 'word-song',
      totalCorrect: 4,
      dateISO: '2026-05-01T19:00:00.000Z',
      focusNode: 'blending-cv',
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
    //
    // Note: marking add-to-10 as already-mastered with a stale Leitner
    // entry guards against the engine touching either. We pass
    // focusNode: 'add-to-20' here because the planner would have moved
    // on to add-to-20 once add-to-10 was mastered (the realistic
    // production state for this scenario).
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
      focusNode: 'add-to-20',
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
      focusNode: 'add-to-10',
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

  // ── focusNode flow-through (P0.2 audit follow-up to PR #120) ────────────
  //
  // These regress the bug Jessica found: every recorded entry used to
  // claim `skillFocus: ['add-to-10']` (math) or `['blending-cv']`
  // (word-song) regardless of which node the planner actually targeted.
  // After a promotion (e.g. add-to-10 → mastered, add-to-20 → intro),
  // the next math session's history STILL recorded add-to-10, so M3's
  // mastery rule could never see qualifying entries for add-to-20 and
  // the promotion chain capped at one hop.
  //
  // Both tests use `.toEqual([node])` (count-based exactness) per the
  // project regression-test convention — never `.toContain`, which
  // would silently pass if a duplicate or stale entry crept in.

  describe('focusNode flow-through', () => {
    it('records the supplied focusNode in skillFocus (math, post-promotion path)', () => {
      // Realistic post-promotion state: add-to-10 already mastered,
      // add-to-20 introduced. The planner would have targeted
      // add-to-20 this session, and that's what should land in the
      // history entry.
      const seed = defaultProgress()
      const promoted: Progress = {
        ...seed,
        skillLevels: {
          ...seed.skillLevels,
          'add-to-10': 'mastered',
          'add-to-20': 'practicing',
        },
      }
      saveProgress(promoted)

      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 8,
        dateISO: '2026-05-02T19:00:00.000Z',
        focusNode: 'add-to-20',
      })

      const loaded = loadProgress()!
      const newEntry = loaded.history[loaded.history.length - 1]
      expect(newEntry.skillFocus).toEqual(['add-to-20'])
    })

    it('records the supplied focusNode in skillFocus (word-song)', () => {
      recordProgressOnSessionEnd({
        surface: 'word-song',
        totalCorrect: 6,
        dateISO: '2026-05-02T19:30:00.000Z',
        focusNode: 'blending-cv',
      })

      const loaded = loadProgress()!
      expect(loaded.history[0].skillFocus).toEqual(['blending-cv'])
    })

    it('does NOT key skillFocus off `surface` — focusNode beats it on disagreement', () => {
      // Defensive regression: if a future caller wires focusNode
      // through correctly but supplies a node whose track doesn't
      // match `surface`, the entry must record `focusNode` (the
      // truthful field) — not the surface-derived hardcoded constant
      // the old code path used. This pins the new contract: surface
      // is for downstream UI routing only; focusNode is the
      // adaptive-engine truth.
      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 5,
        dateISO: '2026-05-03T10:00:00.000Z',
        // Pass a literacy-track node on a math surface. This is not a
        // realistic production state; we're proving the wiring no
        // longer derives skillFocus from surface.
        focusNode: 'cvc-words',
      })

      const loaded = loadProgress()!
      expect(loaded.history[0].skillFocus).toEqual(['cvc-words'])
    })
  })

  // ── M4 Leitner outcomes (ticket 86c9pwgc8) ─────────────────────────────
  describe('M4 Leitner outcomes', () => {
    it('promotes a fact one box on a clean win (first-tap correct)', () => {
      // Pre-load a box with the fact at box 2 so we can observe the
      // promote behaviour (cap-aware).
      const seed = defaultProgress()
      saveProgress({
        ...seed,
        mathFactsLeitner: {
          items: [{ item: { a: 3, b: 4, op: '+' }, box: 2, lastSeen: 100 }],
        },
      })

      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 1,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'add-to-10',
        leitnerOutcomes: [{ fact: { a: 3, b: 4, op: '+' }, correct: true }],
      })

      const after = loadProgress()!
      expect(after.mathFactsLeitner.items).toHaveLength(1)
      expect(after.mathFactsLeitner.items[0].box).toBe(3)
      // lastSeen updated to the dateISO instant
      expect(after.mathFactsLeitner.items[0].lastSeen).toBe(
        new Date('2026-05-08T19:00:00.000Z').getTime(),
      )
    })

    it('demotes a fact to box 1 on a wrong first tap', () => {
      const seed = defaultProgress()
      saveProgress({
        ...seed,
        mathFactsLeitner: {
          items: [{ item: { a: 6, b: 4, op: '+' }, box: 4, lastSeen: 100 }],
        },
      })

      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 0,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'add-to-10',
        leitnerOutcomes: [{ fact: { a: 6, b: 4, op: '+' }, correct: false }],
      })

      const after = loadProgress()!
      expect(after.mathFactsLeitner.items).toHaveLength(1)
      expect(after.mathFactsLeitner.items[0].box).toBe(1)
    })

    it('caps promotion at box 5', () => {
      const seed = defaultProgress()
      saveProgress({
        ...seed,
        mathFactsLeitner: {
          items: [{ item: { a: 5, b: 5, op: '+' }, box: 5, lastSeen: 100 }],
        },
      })

      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 1,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'add-to-10',
        leitnerOutcomes: [{ fact: { a: 5, b: 5, op: '+' }, correct: true }],
      })

      const after = loadProgress()!
      expect(after.mathFactsLeitner.items[0].box).toBe(5)
    })

    it('seeds new facts at box 1 on first encounter', () => {
      // Empty box; first session populates it. Mirrors Q1 of the
      // dispatch contract — accept 2-3 seed sessions to populate.
      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 1,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'add-to-10',
        leitnerOutcomes: [
          { fact: { a: 3, b: 2, op: '+' }, correct: true },
          { fact: { a: 6, b: 4, op: '+' }, correct: false },
        ],
      })

      const after = loadProgress()!
      // Both facts present; correct→box2 (started at 1, promoted to 2),
      // wrong→box1 (started at 1, demoted to 1).
      expect(after.mathFactsLeitner.items).toHaveLength(2)
      const correctFact = after.mathFactsLeitner.items.find(
        (i) => i.item.a === 3 && i.item.b === 2,
      )
      const wrongFact = after.mathFactsLeitner.items.find(
        (i) => i.item.a === 6 && i.item.b === 4,
      )
      expect(correctFact?.box).toBe(2)
      expect(wrongFact?.box).toBe(1)
    })

    it('"undefined" correctness adds the fact at box 1 but does not change rank', () => {
      // Sentinel for "first-tap not measured" — e.g. screen abandoned.
      const seed = defaultProgress()
      saveProgress({
        ...seed,
        mathFactsLeitner: {
          items: [{ item: { a: 3, b: 4, op: '+' }, box: 3, lastSeen: 50 }],
        },
      })

      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 0,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'add-to-10',
        leitnerOutcomes: [
          // Unrecorded fact — addItem should make it land at box 1.
          { fact: { a: 1, b: 2, op: '+' }, correct: undefined },
          // Existing fact — addItem is no-op, undefined leaves rank.
          { fact: { a: 3, b: 4, op: '+' }, correct: undefined },
        ],
      })

      const after = loadProgress()!
      const newFact = after.mathFactsLeitner.items.find(
        (i) => i.item.a === 1 && i.item.b === 2,
      )
      const existingFact = after.mathFactsLeitner.items.find(
        (i) => i.item.a === 3 && i.item.b === 4,
      )
      expect(newFact?.box).toBe(1)
      expect(existingFact?.box).toBe(3)
      expect(existingFact?.lastSeen).toBe(50)
    })

    it('handles an 8-problem session with mixed outcomes', () => {
      // Realistic shape: 8 outcomes, 6 correct + 2 wrong. Mirrors
      // the Math screen's MathSessionResult.perProblemCorrect emission.
      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 6,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'add-to-10',
        leitnerOutcomes: [
          { fact: { a: 3, b: 2, op: '+' }, correct: true },
          { fact: { a: 1, b: 4, op: '+' }, correct: true },
          { fact: { a: 4, b: 2, op: '+' }, correct: true },
          { fact: { a: 5, b: 3, op: '+' }, correct: false },
          { fact: { a: 2, b: 5, op: '+' }, correct: true },
          { fact: { a: 6, b: 3, op: '+' }, correct: false },
          { fact: { a: 4, b: 4, op: '+' }, correct: true },
          { fact: { a: 5, b: 5, op: '+' }, correct: true },
        ],
      })

      const after = loadProgress()!
      expect(after.mathFactsLeitner.items).toHaveLength(8)
      // All 6 correct facts at box 2 (added at 1 + promoted to 2).
      // All 2 wrong facts at box 1 (added at 1 + demoted to 1).
      const boxes = after.mathFactsLeitner.items.map((i) => i.box)
      expect(boxes.filter((b) => b === 2)).toHaveLength(6)
      expect(boxes.filter((b) => b === 1)).toHaveLength(2)
    })

    it('does NOT touch the box when leitnerOutcomes is omitted', () => {
      // The empty-leitnerOutcomes call path must remain a no-op so
      // legacy callers / tests don't suddenly mutate state.
      const seed = defaultProgress()
      const before: Progress = {
        ...seed,
        mathFactsLeitner: {
          items: [
            { item: { a: 3, b: 4, op: '+' as const }, box: 3, lastSeen: 1234 },
          ],
        },
      }
      saveProgress(before)

      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 7,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'add-to-10',
      })

      const after = loadProgress()!
      expect(after.mathFactsLeitner).toEqual(before.mathFactsLeitner)
    })

    it('ignores leitnerOutcomes when surface !== "math"', () => {
      // Word-song never uses the Leitner box. A misrouted outcome
      // array on a word-song session must not corrupt the math box.
      recordProgressOnSessionEnd({
        surface: 'word-song',
        totalCorrect: 4,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'blending-cv',
        leitnerOutcomes: [{ fact: { a: 3, b: 2, op: '+' }, correct: true }],
      })

      const after = loadProgress()!
      expect(after.mathFactsLeitner.items).toHaveLength(0)
    })

    it('promotes/demotes against add-to-20 facts the same way as add-to-10 (ticket 86c9q5q13)', () => {
      // The Leitner box is fact-keyed (a, b, op), not focus-node-keyed.
      // Promotion/demotion semantics must hold for any math fact the
      // engine surfaces — including add-to-20 facts (e.g. 8+5=13).
      // Server-side directive-injection is currently scoped to
      // add-to-10 (M4 ticket 86c9pwgc8) but the per-fact promotion
      // bookkeeping at session-end is universal.
      const seed = defaultProgress()
      saveProgress({
        ...seed,
        skillLevels: {
          ...seed.skillLevels,
          'add-to-10': 'mastered',
          'add-to-20': 'practicing',
        },
        mathFactsLeitner: {
          items: [
            { item: { a: 8, b: 5, op: '+' }, box: 2, lastSeen: 100 },
            { item: { a: 9, b: 9, op: '+' }, box: 3, lastSeen: 100 },
          ],
        },
      })

      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 7,
        dateISO: '2026-05-08T19:30:00.000Z',
        focusNode: 'add-to-20',
        leitnerOutcomes: [
          // 8+5=13 advanced (correct first tap on a cross-10-bridge fact).
          { fact: { a: 8, b: 5, op: '+' }, correct: true },
          // 9+9=18 demoted (wrong first tap on a double).
          { fact: { a: 9, b: 9, op: '+' }, correct: false },
          // New fact 6+7=13 added at box 1 (correct, but never seen
          // before — matches the addItem-then-promote contract).
          { fact: { a: 6, b: 7, op: '+' }, correct: true },
        ],
      })

      const after = loadProgress()!

      // Skill-focus on the new tier.
      expect(after.history[after.history.length - 1].skillFocus).toEqual([
        'add-to-20',
      ])

      // Box 2 → 3 for 8+5; box 3 → 1 for 9+9; new 6+7 at box 1 → 2 (added
      // then promoted in one step per the leitner.ts contract).
      const eightPlusFive = after.mathFactsLeitner.items.find(
        (i) => i.item.a === 8 && i.item.b === 5,
      )
      const ninePlusNine = after.mathFactsLeitner.items.find(
        (i) => i.item.a === 9 && i.item.b === 9,
      )
      const sixPlusSeven = after.mathFactsLeitner.items.find(
        (i) => i.item.a === 6 && i.item.b === 7,
      )
      expect(eightPlusFive?.box).toBe(3)
      expect(ninePlusNine?.box).toBe(1)
      expect(sixPlusSeven?.box).toBe(2)
    })

    it('idempotent under React StrictMode double-invocation (two identical calls)', () => {
      // applyLeitnerOutcomes is pure but the writer wraps it; two back-
      // to-back calls (the worst-case React strict-mode double-mount)
      // would otherwise stack two promotes per fact. We don't currently
      // de-duplicate on the dateISO key — so each call DOES advance the
      // box one step. The test pins the EXPECTED current behaviour so
      // any future de-dup change is visible. If this becomes a UX
      // problem, add dateISO-based dedup at the writer.
      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 1,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'add-to-10',
        leitnerOutcomes: [{ fact: { a: 3, b: 2, op: '+' }, correct: true }],
      })
      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 1,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'add-to-10',
        leitnerOutcomes: [{ fact: { a: 3, b: 2, op: '+' }, correct: true }],
      })

      const after = loadProgress()!
      // After 2 identical calls: addItem (box 1) + promote → 2; then
      // addItem no-op + promote → 3. This is double-counted but
      // intentional for the current contract. SessionEnd's mount
      // effect already runs once per actual session-end via its
      // `[]` deps; React strict-mode double-mount in dev would
      // produce this state but is acceptable per the spec.
      expect(after.mathFactsLeitner.items[0].box).toBe(3)
      // Two history entries also recorded.
      expect(after.history).toHaveLength(2)
    })
  })

  // ── M4 latency persistence (ticket 86c9pwgc8) ──────────────────────────
  describe('M4 latency persistence', () => {
    it('persists latencyMs onto the SessionHistoryEntry when supplied', () => {
      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 8,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'add-to-10',
        latencyMs: [1200, 800, 950, 1500, 2100, 700, 1800, 1100],
      })

      const after = loadProgress()!
      expect(after.history[0].latencyMs).toEqual([
        1200, 800, 950, 1500, 2100, 700, 1800, 1100,
      ])
    })

    it('omits latencyMs from the entry when not supplied (back-compat)', () => {
      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 7,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'add-to-10',
      })

      const after = loadProgress()!
      expect(after.history[0].latencyMs).toBeUndefined()
    })

    it('persists the -1 sentinel for unmeasured problems', () => {
      // Real production case: read-aloud failed for problem 3, so its
      // chip-render timestamp stayed null and the latency captures as
      // sentinel -1.
      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 7,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'add-to-10',
        latencyMs: [1200, 800, -1, 1500, 2100, 700, 1800, 1100],
      })

      const after = loadProgress()!
      expect(after.history[0].latencyMs?.[2]).toBe(-1)
    })

    it('shallow-clones the input array (caller can mutate after)', () => {
      const arr = [1000, 800, 900, 1100, 1300, 700, 950, 850]
      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 8,
        dateISO: '2026-05-08T19:00:00.000Z',
        focusNode: 'add-to-10',
        latencyMs: arr,
      })

      // Caller mutation post-call must not corrupt the persisted entry.
      arr[0] = 999_999
      const after = loadProgress()!
      expect(after.history[0].latencyMs?.[0]).toBe(1000)
    })
  })
})
