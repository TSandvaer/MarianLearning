import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  LEITNER_HINT_MAX_ITEMS,
  MAX_SESSION_HISTORY,
  STORAGE_KEY,
  addItem,
  buildLeitnerSessionHint,
  clearProgress,
  defaultProgress,
  demote,
  emptyLeitner,
  findItem,
  isProgressV1,
  loadProgress,
  promote,
  saveProgress,
} from './index'
import { migrate } from './migrate'
import type {
  LeitnerBox,
  MathFact,
  Progress,
  SessionHistoryEntry,
} from './types'

const factKey = (f: MathFact) => `${f.a}${f.op}${f.b}`

describe('loadProgress', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('returns null when nothing is stored', () => {
    expect(loadProgress()).toBeNull()
  })

  it('returns null on corrupt JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json,,,')
    expect(loadProgress()).toBeNull()
  })

  it('returns null when JSON is valid but the shape is wrong', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, profile: { childName: 42 } }),
    )
    expect(loadProgress()).toBeNull()
  })

  it('round-trips a default Progress through save+load', () => {
    const initial = defaultProgress('Marian')
    saveProgress(initial)

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded).toEqual(initial)
    expect(loaded?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(isProgressV1(loaded)).toBe(true)
  })

  it('routes through migrate when stored schemaVersion is older', () => {
    // No older versions exist yet, so an "old" doc has no migration step.
    // The contract: loadProgress delegates to migrate(); migrate returns null.
    const older = { schemaVersion: 0, profile: { childName: 'Marian' } }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(older))

    const result = loadProgress()
    expect(result).toBeNull()
    // Sanity: migrate() called directly behaves the same way.
    expect(migrate(older)).toBeNull()
  })

  it('refuses future schema versions rather than guessing', () => {
    const future = { ...defaultProgress(), schemaVersion: 99 } as unknown
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(future))
    expect(loadProgress()).toBeNull()
  })
})

describe('saveProgress', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('writes under the documented key', () => {
    const p = defaultProgress()
    saveProgress(p)
    const raw = window.localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string).schemaVersion).toBe(1)
  })

  it('trims session history to MAX_SESSION_HISTORY', () => {
    const base = defaultProgress()
    const overflow = MAX_SESSION_HISTORY + 7
    const history: SessionHistoryEntry[] = Array.from(
      { length: overflow },
      (_, i) => ({
        dateISO: new Date(2026, 3, 1 + i).toISOString(),
        skillFocus: ['add-to-10'],
        successRate: 0.5,
      }),
    )

    saveProgress({ ...base, history })

    const loaded = loadProgress()
    expect(loaded?.history.length).toBe(MAX_SESSION_HISTORY)
    // We keep the most recent entries, not the oldest.
    expect(loaded?.history[0].dateISO).toBe(
      history[overflow - MAX_SESSION_HISTORY].dateISO,
    )
  })

  it('does not throw if localStorage.setItem throws (quota etc.)', () => {
    const spy = vi
      .spyOn(window.localStorage.__proto__, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

    expect(() => saveProgress(defaultProgress())).not.toThrow()
    expect(spy).toHaveBeenCalled()
  })
})

describe('clearProgress', () => {
  it('removes the stored doc', () => {
    saveProgress(defaultProgress())
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    clearProgress()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('migrate', () => {
  it('is identity for v1 input', () => {
    const p = defaultProgress()
    expect(migrate(p)).toEqual(p)
  })

  it('returns null when schemaVersion is missing', () => {
    expect(migrate({})).toBeNull()
    expect(migrate(null)).toBeNull()
    expect(migrate('nope')).toBeNull()
  })

  it('returns null when no migration step exists for an older version', () => {
    expect(migrate({ schemaVersion: 0 })).toBeNull()
  })

  it('returns null for future versions', () => {
    const future = { ...defaultProgress(), schemaVersion: 2 }
    expect(migrate(future)).toBeNull()
  })

  it('returns null when v1-shaped data fails validation', () => {
    const bad = { ...defaultProgress(), profile: { childName: 'M' } }
    expect(migrate(bad)).toBeNull()
  })
})

describe('Leitner box', () => {
  const fact: MathFact = { a: 3, b: 4, op: '+' }
  const otherFact: MathFact = { a: 7, b: 2, op: '-' }

  it('starts empty', () => {
    const box = emptyLeitner<MathFact>()
    expect(box.items).toEqual([])
  })

  it('addItem is idempotent on the same key', () => {
    let box = emptyLeitner<MathFact>()
    box = addItem(box, factKey, fact)
    box = addItem(box, factKey, fact)
    expect(box.items.length).toBe(1)
    expect(box.items[0].box).toBe(1)
    expect(box.items[0].lastSeen).toBe(0)
  })

  it('promote moves item one box and caps at 5', () => {
    let box = emptyLeitner<MathFact>()
    box = addItem(box, factKey, fact)
    for (let i = 0; i < 10; i++) {
      box = promote(box, factKey, fact, 1000 + i)
    }
    const found = findItem(box, factKey, fact)
    expect(found?.box).toBe(5)
    expect(found?.lastSeen).toBe(1009)
  })

  it('demote drops the item back to box 1', () => {
    let box = emptyLeitner<MathFact>()
    box = addItem(box, factKey, fact)
    box = promote(box, factKey, fact, 1)
    box = promote(box, factKey, fact, 2)
    expect(findItem(box, factKey, fact)?.box).toBe(3)
    box = demote(box, factKey, fact, 99)
    const found = findItem(box, factKey, fact)
    expect(found?.box).toBe(1)
    expect(found?.lastSeen).toBe(99)
  })

  it('promote / demote are no-ops when item is missing', () => {
    const box = emptyLeitner<MathFact>()
    expect(promote(box, factKey, fact, 1)).toBe(box)
    expect(demote(box, factKey, fact, 1)).toBe(box)
  })

  it('only mutates the matching item', () => {
    let box = emptyLeitner<MathFact>()
    box = addItem(box, factKey, fact)
    box = addItem(box, factKey, otherFact)
    box = promote(box, factKey, fact, 5)
    expect(findItem(box, factKey, fact)?.box).toBe(2)
    expect(findItem(box, factKey, otherFact)?.box).toBe(1)
    expect(findItem(box, factKey, otherFact)?.lastSeen).toBe(0)
  })
})

describe('buildLeitnerSessionHint', () => {
  it('returns empty array on an empty box', () => {
    expect(buildLeitnerSessionHint(emptyLeitner<MathFact>())).toEqual([])
  })

  it('flattens to {a,b,op,box} entries', () => {
    const box: LeitnerBox<MathFact> = {
      items: [
        { item: { a: 3, b: 4, op: '+' }, box: 1, lastSeen: 100 },
        { item: { a: 5, b: 5, op: '+' }, box: 3, lastSeen: 50 },
      ],
    }
    const out = buildLeitnerSessionHint(box)
    expect(out).toHaveLength(2)
    // Sorted box-ascending: box 1 first, then box 3.
    expect(out[0]).toEqual({ a: 3, b: 4, op: '+', box: 1 })
    expect(out[1]).toEqual({ a: 5, b: 5, op: '+', box: 3 })
  })

  it('sorts box-ascending (least familiar first)', () => {
    const box: LeitnerBox<MathFact> = {
      items: [
        { item: { a: 1, b: 1, op: '+' }, box: 4, lastSeen: 0 },
        { item: { a: 2, b: 2, op: '+' }, box: 1, lastSeen: 0 },
        { item: { a: 3, b: 3, op: '+' }, box: 2, lastSeen: 0 },
        { item: { a: 4, b: 4, op: '+' }, box: 1, lastSeen: 0 },
      ],
    }
    const out = buildLeitnerSessionHint(box)
    expect(out.map((i) => i.box)).toEqual([1, 1, 2, 4])
  })

  it('caps at LEITNER_HINT_MAX_ITEMS entries', () => {
    // Synthesize a box with twice the cap to verify truncation.
    const overflow = LEITNER_HINT_MAX_ITEMS + 5
    const items = Array.from({ length: overflow }, (_, i) => ({
      item: { a: i, b: i + 1, op: '+' as const },
      box: 1 as const,
      lastSeen: 0,
    }))
    const out = buildLeitnerSessionHint({ items })
    expect(out).toHaveLength(LEITNER_HINT_MAX_ITEMS)
  })

  it('does not mutate the input box', () => {
    const original: LeitnerBox<MathFact> = {
      items: [
        { item: { a: 3, b: 4, op: '+' }, box: 2, lastSeen: 100 },
        { item: { a: 1, b: 1, op: '+' }, box: 1, lastSeen: 50 },
      ],
    }
    const snapshot = JSON.stringify(original)
    buildLeitnerSessionHint(original)
    expect(JSON.stringify(original)).toBe(snapshot)
  })
})

describe('isProgressV1', () => {
  it('accepts default progress', () => {
    expect(isProgressV1(defaultProgress())).toBe(true)
  })

  it('rejects missing skill nodes', () => {
    const p = defaultProgress() as unknown as Progress
    const broken = {
      ...p,
      skillLevels: { ...p.skillLevels, 'add-to-10': undefined },
    }
    expect(isProgressV1(broken)).toBe(false)
  })

  it('rejects unknown character', () => {
    const p = defaultProgress()
    const broken = { ...p, profile: { ...p.profile, character: 'kitty' } }
    expect(isProgressV1(broken)).toBe(false)
  })

  it('rejects out-of-range Leitner box index', () => {
    const p = defaultProgress()
    const broken: Progress = {
      ...p,
      mathFactsLeitner: {
        items: [{ item: { a: 1, b: 1, op: '+' }, box: 9 as 5, lastSeen: 0 }],
      },
    }
    expect(isProgressV1(broken)).toBe(false)
  })

  // ── M4 latencyMs additive field (ticket 86c9pwgc8) ─────────────────────
  it('accepts SessionHistoryEntry with valid latencyMs', () => {
    const p = defaultProgress()
    const withLatency: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-05-08T19:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.875,
          latencyMs: [1200, 800, 950, 1500, 2100, 700, 1800, 1100],
        },
      ],
    }
    expect(isProgressV1(withLatency)).toBe(true)
  })

  it('accepts the -1 sentinel inside latencyMs', () => {
    const p = defaultProgress()
    const withSentinel: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-05-08T19:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
          latencyMs: [1000, -1, 800, -1, 900, -1, 1100, -1],
        },
      ],
    }
    expect(isProgressV1(withSentinel)).toBe(true)
  })

  it('rejects non-array latencyMs', () => {
    const p = defaultProgress()
    const broken = {
      ...p,
      history: [
        {
          dateISO: '2026-05-08T19:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
          latencyMs: 'not-an-array',
        },
      ],
    } as unknown
    expect(isProgressV1(broken)).toBe(false)
  })

  it('rejects non-numeric latencyMs entries', () => {
    const p = defaultProgress()
    const broken = {
      ...p,
      history: [
        {
          dateISO: '2026-05-08T19:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
          latencyMs: [1000, 'fast', 800],
        },
      ],
    } as unknown
    expect(isProgressV1(broken)).toBe(false)
  })

  it('omitted latencyMs is fine (additive, back-compat)', () => {
    const p = defaultProgress()
    const noLatency: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-05-08T19:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
        },
      ],
    }
    expect(isProgressV1(noLatency)).toBe(true)
  })

  // ── perProblemAnswerValue / perProblemAnswerWord additive fields ────────
  // (Kevin schema-first PR, 2026-05-21 — pairing with Dave's PR #284
  // two-digit add/sub research)
  it('accepts SessionHistoryEntry with valid perProblemAnswerValue', () => {
    const p = defaultProgress()
    const withAnswers: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-05-21T12:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.75,
          perProblemAnswerValue: [5, 6, 4, 8, 7, 9, 8, 10],
        },
      ],
    }
    expect(isProgressV1(withAnswers)).toBe(true)
  })

  it('accepts null entries inside perProblemAnswerValue (no chip tapped)', () => {
    const p = defaultProgress()
    const withNulls: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-05-21T12:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
          perProblemAnswerValue: [5, null, 6, null, 7, 8, 9, 10],
        },
      ],
    }
    expect(isProgressV1(withNulls)).toBe(true)
  })

  it('rejects non-integer perProblemAnswerValue entries', () => {
    const p = defaultProgress()
    const broken = {
      ...p,
      history: [
        {
          dateISO: '2026-05-21T12:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
          perProblemAnswerValue: [5, 6.5, 7],
        },
      ],
    } as unknown
    expect(isProgressV1(broken)).toBe(false)
  })

  it('rejects string entries inside perProblemAnswerValue', () => {
    const p = defaultProgress()
    const broken = {
      ...p,
      history: [
        {
          dateISO: '2026-05-21T12:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
          perProblemAnswerValue: [5, '6', 7],
        },
      ],
    } as unknown
    expect(isProgressV1(broken)).toBe(false)
  })

  it('rejects out-of-range perProblemAnswerValue entries (negative or > 99)', () => {
    const p = defaultProgress()
    const negative = {
      ...p,
      history: [
        {
          dateISO: '2026-05-21T12:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
          perProblemAnswerValue: [-1, 5],
        },
      ],
    } as unknown
    expect(isProgressV1(negative)).toBe(false)

    const tooLarge = {
      ...p,
      history: [
        {
          dateISO: '2026-05-21T12:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
          perProblemAnswerValue: [5, 100],
        },
      ],
    } as unknown
    expect(isProgressV1(tooLarge)).toBe(false)
  })

  it('rejects non-array perProblemAnswerValue', () => {
    const p = defaultProgress()
    const broken = {
      ...p,
      history: [
        {
          dateISO: '2026-05-21T12:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
          perProblemAnswerValue: 'not-an-array',
        },
      ],
    } as unknown
    expect(isProgressV1(broken)).toBe(false)
  })

  it('omitted perProblemAnswerValue is fine (additive, back-compat)', () => {
    const p = defaultProgress()
    const noField: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-05-21T12:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
        },
      ],
    }
    expect(isProgressV1(noField)).toBe(true)
  })

  it('accepts SessionHistoryEntry with valid perProblemAnswerWord', () => {
    const p = defaultProgress()
    const withWords: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-05-21T12:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.75,
          perProblemAnswerWord: [
            'cat',
            'bat',
            'mat',
            'hat',
            'rat',
            'pan',
            'fan',
            'man',
          ],
        },
      ],
    }
    expect(isProgressV1(withWords)).toBe(true)
  })

  it('accepts null entries inside perProblemAnswerWord', () => {
    const p = defaultProgress()
    const withNulls: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-05-21T12:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.5,
          perProblemAnswerWord: ['cat', null, 'bat', null],
        },
      ],
    }
    expect(isProgressV1(withNulls)).toBe(true)
  })

  it('rejects non-string entries inside perProblemAnswerWord', () => {
    const p = defaultProgress()
    const broken = {
      ...p,
      history: [
        {
          dateISO: '2026-05-21T12:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.5,
          perProblemAnswerWord: ['cat', 5, 'bat'],
        },
      ],
    } as unknown
    expect(isProgressV1(broken)).toBe(false)
  })

  it('omitted perProblemAnswerWord is fine (additive, back-compat)', () => {
    const p = defaultProgress()
    const noField: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-05-21T12:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.5,
        },
      ],
    }
    expect(isProgressV1(noField)).toBe(true)
  })
})
