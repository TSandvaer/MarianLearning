/**
 * Unit tests for the subitising scaffold trigger + fluency-fade gate
 * (ticket 86c9ur1zr).
 *
 * Pure-function coverage — no React, no DOM, no Math.tsx coupling. The
 * spec §2.3 fade-probability schedule + spec §2.2 first-encounter gate
 * are tested directly against `shouldScaffoldThisSession`; the per-
 * render combinator `shouldShowSubitisingScaffold` is tested against
 * spec §2.1 C1-C5; the `easyBandLeitnerMeanBox` calculator gets its
 * three edge cases (empty, single, partial); and the deterministic RNG
 * gets its seed-stability tests.
 *
 * Spec §6.5 drift-guard constants are pinned here too.
 */

import { describe, expect, it } from 'vitest'
import type { LeitnerBox, MathFact } from '../../lib/progress'
import {
  EASY_BAND_FACTS,
  FADE_PROB_LOW,
  FADE_PROB_MEDIUM,
  FADE_THRESHOLD_FULL,
  FADE_THRESHOLD_MEDIUM,
  FADE_THRESHOLD_OFF,
  FIRST_ENCOUNTER_SESSIONS,
  SCAFFOLD_FOCUS_NODE,
  SCAFFOLD_SESSIONS_OBSERVED_CAP,
  bumpSubitisingScaffoldSessionsObserved,
  createSubitisingRng,
  easyBandLeitnerMeanBox,
  readSubitisingScaffoldSessionsObserved,
  shouldScaffoldThisSession,
  shouldShowSubitisingScaffold,
} from './subitisingScaffold'
import type { MathProblem } from './sessionPlans'

// ── Test fixtures ────────────────────────────────────────────────────────

function problem(
  addendA: number,
  addendB: number,
  op: '+' | '-' = '+',
): MathProblem {
  return {
    index: 1,
    addendA,
    addendB,
    correct: op === '+' ? addendA + addendB : addendA - addendB,
    op,
    utterances: {
      read: 'placeholder',
      correct: 'placeholder',
      reprompt: 'placeholder',
      hint: 'placeholder',
      giveAnswer: 'placeholder',
    },
  }
}

function box(
  items: ReadonlyArray<{ fact: MathFact; box: 1 | 2 | 3 | 4 | 5 }>,
): LeitnerBox<MathFact> {
  return {
    items: items.map(({ fact, box: b }) => ({
      item: fact,
      box: b,
      lastSeen: 0,
    })),
  }
}

/**
 * Stub RNG that returns a fixed value. Spec §6.2 test table uses
 * specific cutoffs (0.0 / 0.99 / 0.5 / 0.7) to land on either side of
 * the 0.66 and 0.33 thresholds.
 */
function fixedRng(value: number): () => number {
  return () => value
}

// ── shouldScaffoldThisSession — spec §2.2 + §2.3 ─────────────────────────

describe('shouldScaffoldThisSession — first-encounter gate (spec §2.2)', () => {
  it('returns true on session 0 (counter = 0) regardless of mean / RNG', () => {
    // Mean is intentionally HIGH so any leak past the gate would
    // surface as FALSE — but the first-encounter gate fires first.
    expect(shouldScaffoldThisSession(5.0, 0, fixedRng(0.99))).toBe(true)
  })

  it('returns true on session 1 (counter = 1)', () => {
    expect(shouldScaffoldThisSession(5.0, 1, fixedRng(0.99))).toBe(true)
  })

  it('returns true on session 2 (counter = 2)', () => {
    expect(shouldScaffoldThisSession(5.0, 2, fixedRng(0.99))).toBe(true)
  })

  it('graduates at session 3 (counter = FIRST_ENCOUNTER_SESSIONS)', () => {
    // At counter === FIRST_ENCOUNTER_SESSIONS, the first-encounter gate
    // is OFF — control flow proceeds to the Leitner-mean schedule. With
    // mean 5.0 (>= FADE_THRESHOLD_OFF), the schedule returns FALSE.
    expect(shouldScaffoldThisSession(5.0, 3, fixedRng(0.0))).toBe(false)
  })

  it('caps the gate at the threshold — counter 100 still uses the fade rule', () => {
    // Defensive: counter values past the cap should follow the fade rule,
    // not loop back to first-encounter behaviour. Mean 5.0 -> FALSE.
    expect(shouldScaffoldThisSession(5.0, 100, fixedRng(0.0))).toBe(false)
  })
})

describe('shouldScaffoldThisSession — fluency-fade schedule (spec §2.3)', () => {
  // All tests below assume sessionsObserved >= FIRST_ENCOUNTER_SESSIONS
  // so the first-encounter gate is OFF and the fade rule is in play.
  const PAST_FIRST_ENCOUNTER = FIRST_ENCOUNTER_SESSIONS // === 3

  it('mean < 2.0 always fires regardless of RNG', () => {
    // Below FADE_THRESHOLD_FULL — P=1.0, RNG ignored.
    expect(
      shouldScaffoldThisSession(1.0, PAST_FIRST_ENCOUNTER, fixedRng(0.99)),
    ).toBe(true)
    expect(
      shouldScaffoldThisSession(1.99, PAST_FIRST_ENCOUNTER, fixedRng(0.99)),
    ).toBe(true)
  })

  it('mean exactly 2.0 lands in the [2.0, 3.0) band — P=0.66', () => {
    // Spec §2.3 schedule row: `[2.0, 3.0)` -> rng < 0.66.
    // rng < 0.66 -> TRUE; rng >= 0.66 -> FALSE.
    expect(
      shouldScaffoldThisSession(2.0, PAST_FIRST_ENCOUNTER, fixedRng(0.0)),
    ).toBe(true)
    expect(
      shouldScaffoldThisSession(2.0, PAST_FIRST_ENCOUNTER, fixedRng(0.65)),
    ).toBe(true)
    expect(
      shouldScaffoldThisSession(2.0, PAST_FIRST_ENCOUNTER, fixedRng(0.66)),
    ).toBe(false)
    expect(
      shouldScaffoldThisSession(2.0, PAST_FIRST_ENCOUNTER, fixedRng(0.99)),
    ).toBe(false)
  })

  it('mean 2.5 lands in the [2.0, 3.0) band', () => {
    expect(
      shouldScaffoldThisSession(2.5, PAST_FIRST_ENCOUNTER, fixedRng(0.5)),
    ).toBe(true)
    expect(
      shouldScaffoldThisSession(2.5, PAST_FIRST_ENCOUNTER, fixedRng(0.7)),
    ).toBe(false)
  })

  it('mean exactly 3.0 transitions to the [3.0, 4.0) band — P=0.33', () => {
    expect(
      shouldScaffoldThisSession(3.0, PAST_FIRST_ENCOUNTER, fixedRng(0.0)),
    ).toBe(true)
    expect(
      shouldScaffoldThisSession(3.0, PAST_FIRST_ENCOUNTER, fixedRng(0.32)),
    ).toBe(true)
    expect(
      shouldScaffoldThisSession(3.0, PAST_FIRST_ENCOUNTER, fixedRng(0.33)),
    ).toBe(false)
    expect(
      shouldScaffoldThisSession(3.0, PAST_FIRST_ENCOUNTER, fixedRng(0.5)),
    ).toBe(false)
  })

  it('mean 3.99 lands in the [3.0, 4.0) band (boundary just below 4.0)', () => {
    expect(
      shouldScaffoldThisSession(3.99, PAST_FIRST_ENCOUNTER, fixedRng(0.0)),
    ).toBe(true)
    expect(
      shouldScaffoldThisSession(3.99, PAST_FIRST_ENCOUNTER, fixedRng(0.34)),
    ).toBe(false)
  })

  it('mean exactly 4.0 disables the scaffold permanently (P=0.0)', () => {
    // At FADE_THRESHOLD_OFF, even rng = 0.0 returns false — the
    // schedule is unconditional.
    expect(
      shouldScaffoldThisSession(4.0, PAST_FIRST_ENCOUNTER, fixedRng(0.0)),
    ).toBe(false)
    expect(
      shouldScaffoldThisSession(5.0, PAST_FIRST_ENCOUNTER, fixedRng(0.0)),
    ).toBe(false)
  })

  it('NaN mean falls back to TRUE (defensive — spec §2.3 conservative)', () => {
    // Pathological input — a NaN slipping through (e.g. divide-by-zero
    // somewhere upstream) should leave the scaffold ON rather than
    // silently disabled. Number.isFinite catches NaN AND Infinity.
    expect(
      shouldScaffoldThisSession(NaN, PAST_FIRST_ENCOUNTER, fixedRng(0.99)),
    ).toBe(true)
    expect(
      shouldScaffoldThisSession(Infinity, PAST_FIRST_ENCOUNTER, fixedRng(0.99)),
    ).toBe(true)
  })
})

// ── shouldShowSubitisingScaffold — spec §2.1 C1-C5 + render combinator ───

describe('shouldShowSubitisingScaffold — per-render gate (spec §2.1)', () => {
  it('returns false when focus node is not add-to-10 (C1 fails)', () => {
    expect(shouldShowSubitisingScaffold('sub-to-10', problem(2, 3), true)).toBe(
      false,
    )
    expect(shouldShowSubitisingScaffold('add-to-20', problem(2, 3), true)).toBe(
      false,
    )
    expect(shouldShowSubitisingScaffold('cvc-words', problem(2, 3), true)).toBe(
      false,
    )
  })

  it('returns false when scaffoldActiveThisSession is false (per-session gate)', () => {
    // C1, C2 both pass — but per-session decision was negative.
    expect(
      shouldShowSubitisingScaffold(SCAFFOLD_FOCUS_NODE, problem(2, 3), false),
    ).toBe(false)
  })

  it('returns false when addends fail the dot-card scope predicate (C2 fails)', () => {
    // 6+1, 1+6 — at least one addend > MAX_PIPS_PER_CELL.
    expect(
      shouldShowSubitisingScaffold(SCAFFOLD_FOCUS_NODE, problem(6, 1), true),
    ).toBe(false)
    expect(
      shouldShowSubitisingScaffold(SCAFFOLD_FOCUS_NODE, problem(1, 6), true),
    ).toBe(false)
  })

  it('returns false on subtraction even when operands ≤ 5 (op-gate from dotCard)', () => {
    // The dot-card op-gate (dotCard.ts) catches subtraction; the
    // subitising wrapper delegates that check, so subtraction never
    // fires regardless of focusNode / scaffold-active. The current
    // production path doesn't route `op === '-'` through the
    // SCAFFOLD_FOCUS_NODE, but the predicate is structural — belt
    // and braces.
    expect(
      shouldShowSubitisingScaffold(
        SCAFFOLD_FOCUS_NODE,
        problem(5, 5, '-'),
        true,
      ),
    ).toBe(false)
  })

  it('returns true when all gates pass (spec §2.1 conjunction holds)', () => {
    // Canonical Marian observation case: 3+2 on add-to-10 with
    // scaffold active.
    expect(
      shouldShowSubitisingScaffold(SCAFFOLD_FOCUS_NODE, problem(3, 2), true),
    ).toBe(true)
    // Lower bound 1+1.
    expect(
      shouldShowSubitisingScaffold(SCAFFOLD_FOCUS_NODE, problem(1, 1), true),
    ).toBe(true)
    // Upper bound 5+5 (spec §7.1 — Thomas-confirmed IN-scope; the
    // dot-card structural rule accepts it).
    expect(
      shouldShowSubitisingScaffold(SCAFFOLD_FOCUS_NODE, problem(5, 5), true),
    ).toBe(true)
  })
})

// ── easyBandLeitnerMeanBox — spec §2.3 formula + edge cases ──────────────

describe('easyBandLeitnerMeanBox', () => {
  it('returns 0 on empty seen-set (no EASY-band facts encountered yet)', () => {
    // Sentinel below FADE_THRESHOLD_FULL — see module-level doc on the
    // "no signal" branch. Pathological case (first encounter window
    // passed but Marian hasn't seen any EASY-band facts yet); the
    // conservative behaviour is to keep the scaffold on.
    expect(easyBandLeitnerMeanBox(box([]))).toBe(0)
  })

  it('returns the single fact box on a single-fact seen-set', () => {
    // One EASY-band fact at box 3 → mean is 3.
    expect(
      easyBandLeitnerMeanBox(box([{ fact: { a: 2, b: 3, op: '+' }, box: 3 }])),
    ).toBe(3)
  })

  it('partial seen-set: mean over seen facts only, NOT padded with unseen', () => {
    // 3 EASY-band facts at boxes 2, 3, 4 → mean (2+3+4)/3 = 3.
    // Crucially, the other 6 EASY-band facts are NOT included as
    // synthetic box-1 entries — that would deflate the mean and delay
    // the fade. Spec §2.3 — "un-seen facts are excluded so a partially-
    // explored band doesn't deflate the mean."
    const partial = box([
      { fact: { a: 1, b: 2, op: '+' }, box: 2 },
      { fact: { a: 2, b: 3, op: '+' }, box: 3 },
      { fact: { a: 3, b: 2, op: '+' }, box: 4 },
    ])
    expect(easyBandLeitnerMeanBox(partial)).toBe(3)
  })

  it('all 9 EASY-band facts at box 5 → mean is 5', () => {
    const full = box(EASY_BAND_FACTS.map((fact) => ({ fact, box: 5 as const })))
    expect(easyBandLeitnerMeanBox(full)).toBe(5)
  })

  it('excludes non-EASY-band facts from the mean', () => {
    // Box contains a mix of EASY-band facts and HARD-band facts (7+3
    // etc.). Only EASY-band facts should be averaged.
    const mixed = box([
      // EASY-band:
      { fact: { a: 1, b: 2, op: '+' }, box: 2 },
      { fact: { a: 2, b: 3, op: '+' }, box: 4 },
      // NOT in EASY_BAND_FACTS (sum > 5):
      { fact: { a: 7, b: 3, op: '+' }, box: 1 },
      { fact: { a: 4, b: 5, op: '+' }, box: 1 },
    ])
    // Only (2+4)/2 = 3 — the box-1 hard-band facts are ignored.
    expect(easyBandLeitnerMeanBox(mixed)).toBe(3)
  })

  it('excludes wrong-op facts (subtraction at the same operand pair)', () => {
    // Defensive: a future planner regression that put `2-3` in the
    // Leitner box must not pollute the add mean.
    const subtractionPollution = box([
      { fact: { a: 1, b: 2, op: '+' }, box: 5 },
      // op === '-' — NOT in EASY_BAND_FACTS.
      { fact: { a: 2, b: 3, op: '-' }, box: 1 },
    ])
    expect(easyBandLeitnerMeanBox(subtractionPollution)).toBe(5)
  })
})

// ── createSubitisingRng — deterministic seeding ──────────────────────────

describe('createSubitisingRng — seed determinism', () => {
  it('returns the same stream for identical (sessionStartISO, focusNode)', () => {
    const rngA = createSubitisingRng('2026-05-16T12:00:00.000Z', 'add-to-10')
    const rngB = createSubitisingRng('2026-05-16T12:00:00.000Z', 'add-to-10')
    // Compare a 5-deep prefix — Mulberry32's state evolution is
    // sensitive to seed, so a 5-deep match is overwhelmingly stable.
    for (let i = 0; i < 5; i++) {
      expect(rngA()).toBe(rngB())
    }
  })

  it('returns DIFFERENT streams for different sessionStartISO', () => {
    const rngEarly = createSubitisingRng(
      '2026-05-16T08:00:00.000Z',
      'add-to-10',
    )
    const rngLate = createSubitisingRng('2026-05-16T20:00:00.000Z', 'add-to-10')
    // At least one of the first 5 outputs must differ. With Mulberry32
    // any 1-bit seed diff avalanches across the output; collision on
    // 5 consecutive values is astronomically unlikely.
    const earlyOut = [
      rngEarly(),
      rngEarly(),
      rngEarly(),
      rngEarly(),
      rngEarly(),
    ]
    const lateOut = [rngLate(), rngLate(), rngLate(), rngLate(), rngLate()]
    expect(earlyOut).not.toEqual(lateOut)
  })

  it('returns DIFFERENT streams for different focusNode (forward-compat)', () => {
    // §8.1 follow-up — when subitising extends to other tiers, each
    // focus node gets its own stream so two parallel tiers don't
    // accidentally synchronise their "today is a dots day" calls.
    const rngAdd = createSubitisingRng('2026-05-16T12:00:00.000Z', 'add-to-10')
    const rngSub = createSubitisingRng('2026-05-16T12:00:00.000Z', 'sub-to-10')
    const addOut = [rngAdd(), rngAdd(), rngAdd(), rngAdd(), rngAdd()]
    const subOut = [rngSub(), rngSub(), rngSub(), rngSub(), rngSub()]
    expect(addOut).not.toEqual(subOut)
  })

  it('emits values in the [0, 1) range', () => {
    const rng = createSubitisingRng('2026-05-16T12:00:00.000Z', 'add-to-10')
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

// ── bumpSubitisingScaffoldSessionsObserved — counter + cap ──────────────

describe('bumpSubitisingScaffoldSessionsObserved', () => {
  it('starts a fresh counter at 1 when current is undefined', () => {
    expect(bumpSubitisingScaffoldSessionsObserved(undefined)).toBe(1)
  })

  it('increments a 0 counter to 1', () => {
    expect(bumpSubitisingScaffoldSessionsObserved(0)).toBe(1)
  })

  it('walks 0 → 1 → 2 → 3 → 4 (cap) on successive bumps', () => {
    expect(bumpSubitisingScaffoldSessionsObserved(0)).toBe(1)
    expect(bumpSubitisingScaffoldSessionsObserved(1)).toBe(2)
    expect(bumpSubitisingScaffoldSessionsObserved(2)).toBe(3)
    expect(bumpSubitisingScaffoldSessionsObserved(3)).toBe(4)
  })

  it('caps at SCAFFOLD_SESSIONS_OBSERVED_CAP (4) — does not exceed', () => {
    expect(
      bumpSubitisingScaffoldSessionsObserved(SCAFFOLD_SESSIONS_OBSERVED_CAP),
    ).toBe(SCAFFOLD_SESSIONS_OBSERVED_CAP)
    // Defensive: a corrupted blob carrying a value past the cap stays
    // at the cap rather than continuing to climb.
    expect(bumpSubitisingScaffoldSessionsObserved(99)).toBe(
      SCAFFOLD_SESSIONS_OBSERVED_CAP,
    )
  })

  it('defaults non-finite / negative inputs to 0 before bumping', () => {
    expect(bumpSubitisingScaffoldSessionsObserved(NaN)).toBe(1)
    expect(bumpSubitisingScaffoldSessionsObserved(-1)).toBe(1)
    expect(bumpSubitisingScaffoldSessionsObserved(Infinity)).toBe(1)
  })

  it('floors non-integer inputs before bumping', () => {
    expect(bumpSubitisingScaffoldSessionsObserved(1.7)).toBe(2)
  })
})

// ── readSubitisingScaffoldSessionsObserved — read-path defaulter ────────

describe('readSubitisingScaffoldSessionsObserved', () => {
  function progressWith(counter: number | undefined) {
    return {
      schemaVersion: 1 as const,
      profile: {
        childName: 'Marian',
        character: 'melody' as const,
        lastPlayedISO: null,
        subitisingScaffoldSessionsObserved: counter,
      },
      // Filler fields the read path doesn't touch — typed loosely
      // because the unit test only exercises one field.
    } as unknown as import('../../lib/progress').Progress
  }

  it('returns 0 when the field is undefined (pre-86c9ur1zr blob)', () => {
    expect(
      readSubitisingScaffoldSessionsObserved(progressWith(undefined)),
    ).toBe(0)
  })

  it('returns the persisted value when valid and within range', () => {
    expect(readSubitisingScaffoldSessionsObserved(progressWith(2))).toBe(2)
  })

  it('clamps values past the cap to SCAFFOLD_SESSIONS_OBSERVED_CAP', () => {
    expect(readSubitisingScaffoldSessionsObserved(progressWith(99))).toBe(
      SCAFFOLD_SESSIONS_OBSERVED_CAP,
    )
  })

  it('returns 0 on negative / non-finite values (defensive)', () => {
    expect(readSubitisingScaffoldSessionsObserved(progressWith(-1))).toBe(0)
    expect(readSubitisingScaffoldSessionsObserved(progressWith(NaN))).toBe(0)
  })
})

// ── §6.5 drift-guard — pin constants against silent regression ──────────

describe('fluency-fade schedule constants (spec §6.5)', () => {
  it('FADE_THRESHOLD_FULL = 2.0', () => {
    expect(FADE_THRESHOLD_FULL).toBe(2.0)
  })
  it('FADE_THRESHOLD_MEDIUM = 3.0', () => {
    expect(FADE_THRESHOLD_MEDIUM).toBe(3.0)
  })
  it('FADE_THRESHOLD_OFF = 4.0', () => {
    expect(FADE_THRESHOLD_OFF).toBe(4.0)
  })
  it('FADE_PROB_MEDIUM = 0.66', () => {
    expect(FADE_PROB_MEDIUM).toBeCloseTo(0.66, 2)
  })
  it('FADE_PROB_LOW = 0.33', () => {
    expect(FADE_PROB_LOW).toBeCloseTo(0.33, 2)
  })
  it('FIRST_ENCOUNTER_SESSIONS = 3', () => {
    expect(FIRST_ENCOUNTER_SESSIONS).toBe(3)
  })
  it('SCAFFOLD_SESSIONS_OBSERVED_CAP = 4', () => {
    expect(SCAFFOLD_SESSIONS_OBSERVED_CAP).toBe(4)
  })
  it('SCAFFOLD_FOCUS_NODE = "add-to-10"', () => {
    expect(SCAFFOLD_FOCUS_NODE).toBe('add-to-10')
  })
  it('EASY_BAND_FACTS contains exactly 9 facts (spec §2.1 C3 count)', () => {
    expect(EASY_BAND_FACTS).toHaveLength(9)
  })
  it('every EASY_BAND_FACTS entry has both addends ≤ 5 and op = +', () => {
    for (const fact of EASY_BAND_FACTS) {
      expect(fact.a).toBeLessThanOrEqual(5)
      expect(fact.b).toBeLessThanOrEqual(5)
      expect(fact.a).toBeGreaterThanOrEqual(1)
      expect(fact.b).toBeGreaterThanOrEqual(1)
      expect(fact.op).toBe('+')
    }
  })
})
