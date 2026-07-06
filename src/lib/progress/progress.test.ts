import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  LEITNER_DUE_PER_SESSION_CAP,
  LEITNER_HINT_MAX_ITEMS,
  LEITNER_REVIEW_INTERVAL_DAYS,
  MAX_SESSION_HISTORY,
  STORAGE_KEY,
  addItem,
  buildLeitnerSessionHint,
  clearProgress,
  defaultProgress,
  demote,
  dueLeitnerItems,
  emptyLeitner,
  findItem,
  isLiteracyProgress,
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

  it('round-trips a retired SkillNode literal in history[].skillFocus without nulling (P0-2)', () => {
    // P0-2 (2026-07-06): the K2 read-path remaps rewrite `skillLevels` KEYS
    // only, never `history[].skillFocus`. A returning user with real play
    // history on a since-renamed node ('digraphs', 'two-digit-addsub')
    // carries the retired literal in an OLD history entry. `isHistoryEntry`
    // must tolerate it — pre-fix it required SKILL_NODES membership, so the
    // whole blob was rejected, `loadProgress` returned null, and the user
    // was silently reset to defaults.
    const seed = defaultProgress('Marian')
    const history = [
      {
        dateISO: '2026-05-01T10:00:00.000Z',
        skillFocus: ['cvc-words'],
        successRate: 1,
      },
      // Retired literals — persisted from before the K2 splits.
      {
        dateISO: '2026-05-02T10:00:00.000Z',
        skillFocus: ['digraphs'],
        successRate: 0.875,
      },
      {
        dateISO: '2026-05-03T10:00:00.000Z',
        skillFocus: ['two-digit-addsub'],
        successRate: 0.75,
      },
    ] as unknown as SessionHistoryEntry[]
    const blob: Progress = { ...seed, history }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    // The whole blob survives — NOT nulled.
    expect(loaded).not.toBeNull()
    // The retired-literal entries round-trip verbatim (inert, never remapped).
    expect(loaded!.history.map((h) => h.skillFocus)).toEqual([
      ['cvc-words'],
      ['digraphs'],
      ['two-digit-addsub'],
    ])
    expect(isProgressV1(loaded)).toBe(true)
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
    // Explicit high cap to exercise the sort over all 4 items (the default
    // per-session cap of 3 is asserted separately).
    const out = buildLeitnerSessionHint(box, 60)
    expect(out.map((i) => i.box)).toEqual([1, 1, 2, 4])
  })

  it('defaults to the per-session cap (LEITNER_DUE_PER_SESSION_CAP = 3)', () => {
    // Ten all-box-1 facts; the default call caps the wire output at 3.
    const items = Array.from({ length: 10 }, (_, i) => ({
      item: { a: i, b: i + 1, op: '+' as const },
      box: 1 as const,
      lastSeen: 0,
    }))
    const out = buildLeitnerSessionHint({ items })
    expect(out).toHaveLength(LEITNER_DUE_PER_SESSION_CAP)
    expect(LEITNER_DUE_PER_SESSION_CAP).toBe(3)
  })

  it('caps the lowest-box facts when more than 3 are due (ordering preserved)', () => {
    // Mixed boxes. After the box-ascending sort the survivors must be the
    // three lowest-box facts (most fragile), not whichever came first.
    const box: LeitnerBox<MathFact> = {
      items: [
        { item: { a: 9, b: 1, op: '+' }, box: 5, lastSeen: 0 },
        { item: { a: 2, b: 2, op: '+' }, box: 2, lastSeen: 0 },
        { item: { a: 8, b: 1, op: '+' }, box: 4, lastSeen: 0 },
        { item: { a: 1, b: 1, op: '+' }, box: 1, lastSeen: 0 },
        { item: { a: 3, b: 3, op: '+' }, box: 3, lastSeen: 0 },
      ],
    }
    const out = buildLeitnerSessionHint(box)
    expect(out).toHaveLength(3)
    // Lowest-box-first within the cap: box 1, then 2, then 3.
    expect(out.map((i) => i.box)).toEqual([1, 2, 3])
    expect(out.map((i) => `${i.a}+${i.b}`)).toEqual(['1+1', '2+2', '3+3'])
  })

  it('keeps LEITNER_HINT_MAX_ITEMS (60) as the outer brake under an explicit higher cap', () => {
    // The per-session cap is the tight pedagogical bound; 60 is the separate
    // outer request-body brake. Overriding the per-session cap above 60
    // proves the 60-item brake still binds independently.
    const overflow = LEITNER_HINT_MAX_ITEMS + 5
    const items = Array.from({ length: overflow }, (_, i) => ({
      item: { a: i, b: i + 1, op: '+' as const },
      box: 1 as const,
      lastSeen: 0,
    }))
    const out = buildLeitnerSessionHint({ items }, overflow)
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

describe('dueLeitnerItems (spaced-review schedule — 86c9kmwf8)', () => {
  const MS_PER_DAY = 86_400_000
  // Fixed "now" so day-arithmetic is exact and timezone-free.
  const NOW = 1_700_000_000_000

  /** Build a single-item box at a given box index + lastSeen offset. */
  function boxAt(
    boxIndex: 1 | 2 | 3 | 4 | 5,
    lastSeen: number,
    fact: MathFact = { a: 3, b: 4, op: '+' },
  ): LeitnerBox<MathFact> {
    return { items: [{ item: fact, box: boxIndex, lastSeen }] }
  }

  it('returns an empty box (not null/undefined) on an empty input', () => {
    expect(dueLeitnerItems(emptyLeitner<MathFact>(), NOW)).toEqual({
      items: [],
    })
  })

  it('box-1 facts are ALWAYS due regardless of lastSeen (interval 0)', () => {
    // Just-promoted box-1 fact (lastSeen === now) is still due.
    const box = boxAt(1, NOW)
    expect(dueLeitnerItems(box, NOW).items).toHaveLength(1)
    // And a box-1 fact seen a microsecond from the future-ish edge.
    const box2 = boxAt(1, NOW - 1)
    expect(dueLeitnerItems(box2, NOW).items).toHaveLength(1)
  })

  it('box-2 fact is NOT due before 1 day, IS due at/after 1 day (tuned 2→1)', () => {
    // box2 tightened from 2→1 day (Backhaus overnight-consolidation window,
    // research #450). Seen 23 h ago → not yet due.
    const notYet = boxAt(2, NOW - (MS_PER_DAY - 3_600_000))
    expect(dueLeitnerItems(notYet, NOW).items).toHaveLength(0)
    // Seen exactly 1 day ago → due (>= boundary).
    const exact = boxAt(2, NOW - 1 * MS_PER_DAY)
    expect(dueLeitnerItems(exact, NOW).items).toHaveLength(1)
    // One ms short of 1 day → not due.
    const justShort = boxAt(2, NOW - 1 * MS_PER_DAY + 1)
    expect(dueLeitnerItems(justShort, NOW).items).toHaveLength(0)
  })

  it('box-3 fact is NOT due before 3 days, IS due at/after 3 days (tuned 4→3)', () => {
    // box3 tightened from 4→3 days (Cepeda 20% ratio, research #450).
    // Seen 2 days ago → not yet due.
    const notYet = boxAt(3, NOW - 2 * MS_PER_DAY)
    expect(dueLeitnerItems(notYet, NOW).items).toHaveLength(0)
    // Seen exactly 3 days ago → due (>= boundary).
    const exact = boxAt(3, NOW - 3 * MS_PER_DAY)
    expect(dueLeitnerItems(exact, NOW).items).toHaveLength(1)
    // One ms short of 3 days → not due.
    const justShort = boxAt(3, NOW - 3 * MS_PER_DAY + 1)
    expect(dueLeitnerItems(justShort, NOW).items).toHaveLength(0)
  })

  it('honours the full per-box schedule (box 4 → 7d, box 5 → 14d)', () => {
    expect(dueLeitnerItems(boxAt(4, NOW - 6 * MS_PER_DAY), NOW).items).toEqual(
      [],
    )
    expect(
      dueLeitnerItems(boxAt(4, NOW - 7 * MS_PER_DAY), NOW).items,
    ).toHaveLength(1)
    expect(dueLeitnerItems(boxAt(5, NOW - 13 * MS_PER_DAY), NOW).items).toEqual(
      [],
    )
    expect(
      dueLeitnerItems(boxAt(5, NOW - 14 * MS_PER_DAY), NOW).items,
    ).toHaveLength(1)
  })

  it('preserves item order so a downstream sort stays deterministic', () => {
    // Mixed box state, all due; order in → order out (filter is stable).
    const box: LeitnerBox<MathFact> = {
      items: [
        { item: { a: 5, b: 5, op: '+' }, box: 1, lastSeen: NOW },
        { item: { a: 3, b: 3, op: '+' }, box: 1, lastSeen: NOW },
        {
          item: { a: 2, b: 2, op: '+' },
          box: 2,
          lastSeen: NOW - 3 * MS_PER_DAY,
        },
      ],
    }
    const due = dueLeitnerItems(box, NOW)
    expect(due.items.map((i) => i.item)).toEqual([
      { a: 5, b: 5, op: '+' },
      { a: 3, b: 3, op: '+' },
      { a: 2, b: 2, op: '+' },
    ])
  })

  it('accepts a custom schedule override (tests do not depend on prod consts)', () => {
    // Make box-1 require 1 day; a just-seen box-1 fact is then NOT due.
    const custom = { ...LEITNER_REVIEW_INTERVAL_DAYS, 1: 1 }
    const box = boxAt(1, NOW)
    expect(dueLeitnerItems(box, NOW, custom).items).toHaveLength(0)
    expect(
      dueLeitnerItems(boxAt(1, NOW - 1 * MS_PER_DAY), NOW, custom).items,
    ).toHaveLength(1)
  })

  it('does not mutate the input box', () => {
    const original = boxAt(3, NOW - 1 * MS_PER_DAY)
    const snapshot = JSON.stringify(original)
    dueLeitnerItems(original, NOW)
    expect(JSON.stringify(original)).toBe(snapshot)
  })

  it('integration: a recently-promoted fact is EXCLUDED from buildLeitnerSessionHint, a stale one is INCLUDED', () => {
    // The end-to-end spaced-review contract the App relies on: filter the
    // box through dueLeitnerItems BEFORE buildLeitnerSessionHint. A box-3
    // fact promoted today (lastSeen === now) is not due for 4 days; a
    // box-3 fact last seen 5 days ago is overdue. Only the stale one ships.
    const recent: MathFact = { a: 6, b: 3, op: '+' } // promoted today
    const stale: MathFact = { a: 7, b: 2, op: '+' } // 5 days idle
    const box: LeitnerBox<MathFact> = {
      items: [
        { item: recent, box: 3, lastSeen: NOW },
        { item: stale, box: 3, lastSeen: NOW - 5 * MS_PER_DAY },
      ],
    }
    const hint = buildLeitnerSessionHint(dueLeitnerItems(box, NOW))
    expect(hint).toEqual([{ a: 7, b: 2, op: '+', box: 3 }])
  })

  it('integration: a flood of >3 due facts is capped to the 3 lowest-box facts', () => {
    // Overdue-flood protection (research #450 §6 — cap overdue items per
    // session regardless of how many have elapsed). Six facts, all overdue
    // for their box, mixed boxes. Through the real App seam
    // (dueLeitnerItems → buildLeitnerSessionHint) only the 3 lowest-box
    // (most-fragile) facts reach the planner, in box-ascending order.
    const box: LeitnerBox<MathFact> = {
      items: [
        {
          item: { a: 4, b: 4, op: '+' },
          box: 4,
          lastSeen: NOW - 30 * MS_PER_DAY,
        },
        {
          item: { a: 1, b: 1, op: '+' },
          box: 1,
          lastSeen: NOW - 30 * MS_PER_DAY,
        },
        {
          item: { a: 3, b: 3, op: '+' },
          box: 3,
          lastSeen: NOW - 30 * MS_PER_DAY,
        },
        {
          item: { a: 5, b: 5, op: '+' },
          box: 5,
          lastSeen: NOW - 30 * MS_PER_DAY,
        },
        {
          item: { a: 2, b: 2, op: '+' },
          box: 2,
          lastSeen: NOW - 30 * MS_PER_DAY,
        },
        {
          item: { a: 6, b: 4, op: '+' },
          box: 2,
          lastSeen: NOW - 30 * MS_PER_DAY,
        },
      ],
    }
    // All six are overdue, so dueLeitnerItems returns all six...
    expect(dueLeitnerItems(box, NOW).items).toHaveLength(6)
    // ...but the per-session cap trims to the 3 lowest-box facts.
    const hint = buildLeitnerSessionHint(dueLeitnerItems(box, NOW))
    expect(hint).toHaveLength(LEITNER_DUE_PER_SESSION_CAP)
    expect(hint.map((i) => i.box)).toEqual([1, 2, 2])
    expect(hint.map((i) => `${i.a}+${i.b}`)).toEqual(['1+1', '2+2', '6+4'])
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

  // ── perProblemDistractorClass additive field ───────────────────────────
  // (Kevin schema-first PR, 2026-05-22 — Wave 5 prereq pairing with
  // Dave's PR #300 two-digit add/sub WITH-regroup research.)
  it('accepts SessionHistoryEntry with valid perProblemDistractorClass', () => {
    const p = defaultProgress()
    const withClasses: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-05-22T12:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
          perProblemDistractorClass: [
            'forgotten-carry',
            'smaller-from-larger',
            'column-reversal',
            null,
            null,
            'forgotten-carry',
            null,
            'borrow-no-decrement',
          ],
        },
      ],
    }
    expect(isProgressV1(withClasses)).toBe(true)
  })

  it('accepts null entries inside perProblemDistractorClass', () => {
    const p = defaultProgress()
    const withNulls: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-05-22T12:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 1.0,
          perProblemDistractorClass: [
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        },
      ],
    }
    expect(isProgressV1(withNulls)).toBe(true)
  })

  it('rejects non-string entries inside perProblemDistractorClass', () => {
    const p = defaultProgress()
    const broken = {
      ...p,
      history: [
        {
          dateISO: '2026-05-22T12:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
          perProblemDistractorClass: ['forgotten-carry', 5, 'column-reversal'],
        },
      ],
    } as unknown
    expect(isProgressV1(broken)).toBe(false)
  })

  it('rejects non-array perProblemDistractorClass', () => {
    const p = defaultProgress()
    const broken = {
      ...p,
      history: [
        {
          dateISO: '2026-05-22T12:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
          perProblemDistractorClass: 'not-an-array',
        },
      ],
    } as unknown
    expect(isProgressV1(broken)).toBe(false)
  })

  it('omitted perProblemDistractorClass is fine (additive, back-compat)', () => {
    const p = defaultProgress()
    const noField: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-05-22T12:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.5,
        },
      ],
    }
    expect(isProgressV1(noField)).toBe(true)
  })

  // ── currentTargetVowel additive field (Wave 9 W9.3 — ticket
  //    86c9ya3m6) ──────────────────────────────────────────────────────
  it('accepts a letter-sounds entry with a valid currentTargetVowel', () => {
    const p = defaultProgress()
    const withVowel: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-06-07T12:00:00.000Z',
          skillFocus: ['letter-sounds'],
          successRate: 0.875,
          currentTargetVowel: '/o/',
        },
      ],
    }
    expect(isProgressV1(withVowel)).toBe(true)
  })

  it('rejects an invalid currentTargetVowel string', () => {
    const p = defaultProgress()
    const broken = {
      ...p,
      history: [
        {
          dateISO: '2026-06-07T12:00:00.000Z',
          skillFocus: ['letter-sounds'],
          successRate: 0.5,
          currentTargetVowel: '/a/', // /a/ is excluded (already mastered)
        },
      ],
    } as unknown
    expect(isProgressV1(broken)).toBe(false)
  })

  it('rejects a non-string currentTargetVowel', () => {
    const p = defaultProgress()
    const broken = {
      ...p,
      history: [
        {
          dateISO: '2026-06-07T12:00:00.000Z',
          skillFocus: ['letter-sounds'],
          successRate: 0.5,
          currentTargetVowel: 5,
        },
      ],
    } as unknown
    expect(isProgressV1(broken)).toBe(false)
  })

  it('omitted currentTargetVowel is fine (additive, back-compat)', () => {
    const p = defaultProgress()
    const noField: Progress = {
      ...p,
      history: [
        {
          dateISO: '2026-06-07T12:00:00.000Z',
          skillFocus: ['letter-sounds'],
          successRate: 0.5,
        },
      ],
    }
    expect(isProgressV1(noField)).toBe(true)
  })

  // ── literacy.letterSoundsVowelStates additive field (Wave 9 W9.2 —
  //    ticket 86c9ya3gd) ───────────────────────────────────────────────
  it('accepts a Progress with a fully-populated literacy.letterSoundsVowelStates', () => {
    const p = defaultProgress()
    const withLiteracy: Progress = {
      ...p,
      literacy: {
        letterSoundsVowelStates: {
          '/o/': 'practicing',
          '/u/': 'intro',
          '/i/': 'mastered',
          '/e/': 'intro',
        },
      },
    }
    expect(isProgressV1(withLiteracy)).toBe(true)
  })

  it('omitted literacy is fine (additive, back-compat)', () => {
    const p = defaultProgress()
    const noLiteracy: Record<string, unknown> = { ...p }
    delete noLiteracy.literacy
    expect(isProgressV1(noLiteracy)).toBe(true)
  })

  it('rejects literacy with an invalid per-vowel state on a KNOWN vowel', () => {
    const p = defaultProgress()
    const broken = {
      ...p,
      literacy: {
        letterSoundsVowelStates: { '/o/': 'super-mastered' },
      },
    } as unknown
    expect(isProgressV1(broken)).toBe(false)
  })

  it('rejects literacy that is not an object', () => {
    const p = defaultProgress()
    const broken = { ...p, literacy: 'nope' } as unknown
    expect(isProgressV1(broken)).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// isLiteracyProgress — Wave 9 W9.2 (ticket 86c9ya3gd)
// ──────────────────────────────────────────────────────────────────────────
describe('isLiteracyProgress', () => {
  it('accepts an empty literacy object (letterSoundsVowelStates absent)', () => {
    expect(isLiteracyProgress({})).toBe(true)
  })

  it('accepts a fully-populated per-vowel map', () => {
    expect(
      isLiteracyProgress({
        letterSoundsVowelStates: {
          '/o/': 'intro',
          '/u/': 'practicing',
          '/i/': 'mastered',
          '/e/': 'intro',
        },
      }),
    ).toBe(true)
  })

  it('accepts a PARTIAL per-vowel map (missing vowels tolerated — defaulter fills)', () => {
    expect(
      isLiteracyProgress({
        letterSoundsVowelStates: { '/o/': 'mastered' },
      }),
    ).toBe(true)
  })

  it('accepts each valid VowelSubMasteryState value', () => {
    for (const state of ['intro', 'practicing', 'mastered'] as const) {
      expect(
        isLiteracyProgress({ letterSoundsVowelStates: { '/o/': state } }),
      ).toBe(true)
    }
  })

  it('tolerates an extra (non-vowel) key on the map (forward-compat)', () => {
    // A stray key that isn't one of the four known vowels round-trips
    // silently — same boundary-loose posture as the rest of the module.
    expect(
      isLiteracyProgress({
        letterSoundsVowelStates: { '/o/': 'intro', '/y/': 'whatever' },
      }),
    ).toBe(true)
  })

  it('rejects an invalid state on a KNOWN vowel', () => {
    expect(
      isLiteracyProgress({
        letterSoundsVowelStates: { '/i/': 'locked' },
      }),
    ).toBe(false)
  })

  it('rejects a non-string state value on a KNOWN vowel', () => {
    expect(
      isLiteracyProgress({
        letterSoundsVowelStates: { '/e/': 3 },
      }),
    ).toBe(false)
  })

  it('rejects letterSoundsVowelStates that is not an object', () => {
    // `isObject` rejects arrays + non-objects → the map must be a plain
    // object when present.
    expect(isLiteracyProgress({ letterSoundsVowelStates: 'nope' })).toBe(false)
    expect(isLiteracyProgress({ letterSoundsVowelStates: [] })).toBe(false)
    expect(isLiteracyProgress({ letterSoundsVowelStates: null })).toBe(false)
  })

  it('rejects a non-object literacy value', () => {
    expect(isLiteracyProgress('nope')).toBe(false)
    expect(isLiteracyProgress(null)).toBe(false)
    expect(isLiteracyProgress([])).toBe(false)
  })
})
