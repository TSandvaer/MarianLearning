/**
 * @vitest-environment node
 *
 * Tests for the composition-rule-spec lint (`scripts/compositionLint.ts`).
 *
 * Coverage strategy
 * -----------------
 * The lint is a pure function over a SessionStartResponse. We build canon
 * fixtures by category of violation:
 *   1. clean / current sub-to-10.json — passes
 *   2. pool-membership — fact outside the 16
 *   3. category-cap — doubles=2, generals=3
 *   4. band-by-slot — HARD at P3, MEDIUM at P2
 *   5. take-from-10-coverage — no take-from-10 anywhere
 *   6. no-duplicates — same fact twice
 *   7. unparseable-problem — read template malformed
 *   8. disk walker — write fixtures to a tmp dir, walk it, verify
 *      out-of-scope tier files are correctly skipped
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  CompositionLintError,
  SUB_TO_TEN_POOL,
  SUB_TO_TEN_RULES,
  assertSubToTenCompositionClean,
  formatCompositionLintReport,
  lintSubToTenComposition,
  parseSubToTenReadLine,
  resolveTierBinding,
  runCompositionLint,
} from './compositionLint.ts'
import type { SessionStartResponse, Utterance } from '../api/_types.js'

// ── fixture helpers ──────────────────────────────────────────────────────

/** Build a `math.p<N>.read` utterance with the "take away" template. */
function readUtterance(index: number, a: number, b: number): Utterance {
  return {
    id: `math.p${index}.read`,
    text: `${numberWord(a)} take away ${numberWord(b)}. How many are left?`,
    audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
  }
}

/** Build a `math.p<N>.read` utterance with custom raw text (for the
 *  unparseable-problem fixture). */
function rawReadUtterance(index: number, text: string): Utterance {
  return {
    id: `math.p${index}.read`,
    text,
    audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
  }
}

const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
] as const

function numberWord(n: number): string {
  return WORDS[n]!
}

/** Convenience: build a SessionStartResponse with the given 8 facts. */
function buildCanonResponse(
  facts: Array<[a: number, b: number]>,
): SessionStartResponse {
  const utterances: Utterance[] = facts.map(([a, b], i) =>
    readUtterance(i + 1, a, b),
  )
  return {
    ok: true,
    kind: 'session-start',
    plan: { id: 'test', label: 'test', utterances: [] },
    utterances,
  }
}

/** A canonically valid 8-fact session (mirrors the current
 *  public/canon/math/level-1/sub-to-10.json after PR #244). */
const CLEAN_FACTS_PR_244: ReadonlyArray<[number, number]> = [
  [7, 0], // P1 subtract-zero EASY
  [6, 3], // P2 doubles-halving EASY
  [9, 1], // P3 subtract-one EASY
  [10, 2], // P4 subtract-two MEDIUM
  [10, 3], // P5 take-from-10 MEDIUM
  [8, 3], // P6 general HARD
  [9, 4], // P7 general HARD
  [10, 7], // P8 take-from-10 MEDIUM
]

// ── parseSubToTenReadLine ────────────────────────────────────────────────

describe('parseSubToTenReadLine', () => {
  it('parses the "take away" template', () => {
    expect(
      parseSubToTenReadLine('Seven take away three. How many are left?'),
    ).toEqual({ a: 7, b: 3 })
  })

  it('parses the "minus" template', () => {
    expect(
      parseSubToTenReadLine('Ten minus seven. How many are left?'),
    ).toEqual({ a: 10, b: 7 })
  })

  it('parses zero operands', () => {
    expect(
      parseSubToTenReadLine('Seven take away zero. How many are left?'),
    ).toEqual({ a: 7, b: 0 })
    expect(
      parseSubToTenReadLine('Five minus zero. How many are left?'),
    ).toEqual({ a: 5, b: 0 })
  })

  it('is case-insensitive', () => {
    expect(
      parseSubToTenReadLine('seven TAKE AWAY three. how many are LEFT?'),
    ).toEqual({ a: 7, b: 3 })
  })

  it('returns null for addition template (out of scope for sub-to-10)', () => {
    expect(parseSubToTenReadLine('Seven plus three. How many?')).toBeNull()
  })

  it('returns null for unrecognised number words', () => {
    expect(
      parseSubToTenReadLine('Eleven take away three. How many are left?'),
    ).toBeNull()
  })

  it('returns null for completely off-shape text', () => {
    expect(parseSubToTenReadLine('Tap the cat.')).toBeNull()
    expect(parseSubToTenReadLine('')).toBeNull()
  })
})

// ── lintSubToTenComposition: pool, caps, bands, coverage, dedupe ─────────

describe('lintSubToTenComposition — clean canon passes', () => {
  it('returns 0 violations for the post-PR-244 sub-to-10 canon fact set', () => {
    const response = buildCanonResponse([...CLEAN_FACTS_PR_244])
    expect(lintSubToTenComposition(response)).toEqual([])
  })

  it('does not throw on the clean canon via assert helper', () => {
    const response = buildCanonResponse([...CLEAN_FACTS_PR_244])
    expect(() =>
      assertSubToTenCompositionClean('math/sub-to-10', response),
    ).not.toThrow()
  })
})

describe('lintSubToTenComposition — pool-membership rule', () => {
  it('fires when a fact is NOT in the 16-fact pool', () => {
    // 7-3 is NOT in the pool (the directive lists it as FORBIDDEN).
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [9, 1],
      [7, 3], // ← outside pool
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const poolViolations = violations.filter(
      (v) => v.rule === 'pool-membership',
    )
    expect(poolViolations).toHaveLength(1)
    expect(poolViolations[0]!.problemIndex).toBe(4)
    expect(poolViolations[0]!.factId).toBe('7-3')
    expect(poolViolations[0]!.message).toContain('NOT in the 16-fact')
  })

  it('fires on a manually-curated list of forbidden facts the directive calls out', () => {
    // Directive line 947 lists: 7-3, 7-2, 6-2, 8-5, 9-3, 9-2 as
    // explicitly FORBIDDEN. We sanity-check 3 of them.
    for (const [a, b] of [
      [7, 2],
      [6, 2],
      [8, 5],
    ] as const) {
      const facts: Array<[number, number]> = [
        [7, 0],
        [a, b], // forbidden
        [9, 1],
        [10, 2],
        [10, 3],
        [8, 3],
        [9, 4],
        [10, 7],
      ]
      const violations = lintSubToTenComposition(buildCanonResponse(facts))
      const pool = violations.filter((v) => v.rule === 'pool-membership')
      expect(
        pool,
        `expected pool-membership violation for ${a}-${b}`,
      ).toHaveLength(1)
      expect(pool[0]!.factId).toBe(`${a}-${b}`)
    }
  })
})

describe('lintSubToTenComposition — category-cap rule', () => {
  it('fires on doubles count > 1', () => {
    // Two doubles-halving facts: 10-5 and 8-4.
    const facts: Array<[number, number]> = [
      [10, 5], // doubles
      [8, 4], // doubles (cap busted)
      [9, 1],
      [10, 2],
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const cap = violations.filter((v) => v.rule === 'category-cap')
    expect(cap).toHaveLength(1)
    expect(cap[0]!.message).toContain('doubles-halving')
    expect(cap[0]!.message).toContain('cap is 1')
    expect(cap[0]!.message).toContain('canon has 2')
  })

  it('fires on general count > 2 (HARD cap)', () => {
    // Three HARD/general facts: 8-3, 9-4, 7-4 (also breaks band-by-slot
    // if any are below P5; we keep them all at P5-P8 to isolate the cap).
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [9, 1],
      [10, 3], // take-from-10
      [8, 3], // general 1
      [9, 4], // general 2
      [7, 4], // general 3 (cap busted)
      [10, 7], // take-from-10
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const cap = violations.filter((v) => v.rule === 'category-cap')
    expect(cap).toHaveLength(1)
    expect(cap[0]!.message).toContain('"general"')
    expect(cap[0]!.message).toContain('cap is 2')
    expect(cap[0]!.message).toContain('canon has 3')
  })

  it('does NOT fire on take-from-10 count of 2 (cap is 2)', () => {
    // 10-3 and 10-7 both in the session — at the cap, not over it.
    const facts: Array<[number, number]> = [...CLEAN_FACTS_PR_244]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(violations.filter((v) => v.rule === 'category-cap')).toEqual([])
  })

  it('fires when subtract-self appears twice (each pool fact would fail dedup too)', () => {
    // 5-5 and 8-8 in the same session. Note this ALSO fires no-duplicates
    // false ... actually NO — these are DIFFERENT (a,b) pairs, so dedup
    // wouldn't fire. But subtract-self cap is 1 → category-cap fires.
    const facts: Array<[number, number]> = [
      [5, 5], // subtract-self 1
      [8, 8], // subtract-self 2 (cap busted)
      [9, 1],
      [10, 2],
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const cap = violations.filter((v) => v.rule === 'category-cap')
    expect(cap).toHaveLength(1)
    expect(cap[0]!.message).toContain('subtract-self')
    // The two facts (5-5, 8-8) are distinct (a,b) pairs, so dedup does NOT fire.
    expect(violations.filter((v) => v.rule === 'no-duplicates')).toHaveLength(0)
  })

  it('fires when subtract-zero appears twice', () => {
    const facts: Array<[number, number]> = [
      [7, 0], // subtract-zero
      [9, 0], // subtract-zero (cap busted)
      [9, 1],
      [10, 2],
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(
      violations.find(
        (v) => v.rule === 'category-cap' && v.message.includes('subtract-zero'),
      ),
    ).toBeDefined()
  })

  it('fires when subtract-one appears twice (EASY 9-1 + MEDIUM 10-1)', () => {
    // Per directive line 939: 9-1 + 10-1 count toward the same cap.
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [9, 1], // subtract-one EASY
      [10, 1], // subtract-one MEDIUM (cap busted; one combined cap)
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(
      violations.find(
        (v) => v.rule === 'category-cap' && v.message.includes('subtract-one'),
      ),
    ).toBeDefined()
  })
})

describe('lintSubToTenComposition — band-by-slot rule', () => {
  it('fires when HARD-band general appears at P4 (P1-P4 forbid HARD)', () => {
    // Move 8-3 (HARD/general) to P4. CLEAN had 8-3 at P6.
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [9, 1],
      [8, 3], // HARD at P4 — band-by-slot violation
      [10, 3],
      [9, 4], // HARD at P6 (ok)
      [10, 2],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const band = violations.filter((v) => v.rule === 'band-by-slot')
    expect(band).toHaveLength(1)
    expect(band[0]!.problemIndex).toBe(4)
    expect(band[0]!.factId).toBe('8-3')
    expect(band[0]!.message).toContain('HARD')
  })

  it('fires when MEDIUM-band fact appears at P2 (P1-P3 EASY-only)', () => {
    const facts: Array<[number, number]> = [
      [7, 0], // EASY ok
      [10, 3], // MEDIUM at P2 — band-by-slot violation
      [9, 1], // EASY ok
      [10, 2],
      [8, 3],
      [9, 4],
      [10, 7],
      [6, 3],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const band = violations.filter((v) => v.rule === 'band-by-slot')
    // 6-3 at P8 is EASY which is fine.
    // Just the 10-3 at P2.
    expect(band).toHaveLength(1)
    expect(band[0]!.problemIndex).toBe(2)
    expect(band[0]!.factId).toBe('10-3')
  })

  it('does NOT fire when HARD facts are at P5-P8', () => {
    // CLEAN puts 8-3 at P6 and 9-4 at P7. Verify no band-by-slot violations.
    const facts: Array<[number, number]> = [...CLEAN_FACTS_PR_244]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(violations.filter((v) => v.rule === 'band-by-slot')).toEqual([])
  })
})

describe('lintSubToTenComposition — take-from-10-coverage rule', () => {
  it('fires when no take-from-10 fact appears in P4-P8', () => {
    // Replace both 10-3 and 10-7 with other facts.
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [9, 1],
      [10, 2], // subtract-two
      [10, 1], // subtract-one
      [8, 3], // HARD general
      [9, 4], // HARD general
      [7, 4], // HARD general — pushes general cap; we accept that, the
      //                       coverage test still must fire.
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(
      violations.find((v) => v.rule === 'take-from-10-coverage'),
    ).toBeDefined()
  })

  it('does NOT fire when ≥ 1 take-from-10 appears at P4-P8', () => {
    // CLEAN has take-from-10 at P5 and P8.
    const facts: Array<[number, number]> = [...CLEAN_FACTS_PR_244]
    expect(
      lintSubToTenComposition(buildCanonResponse(facts)).filter(
        (v) => v.rule === 'take-from-10-coverage',
      ),
    ).toEqual([])
  })

  it('does NOT fire when take-from-10 appears at P4-P8 even if also at P1-P3 (band-by-slot would catch the P1-P3 placement separately)', () => {
    // take-from-10 at P3 is a band-by-slot violation (P3 is EASY-only)
    // — but coverage is met because there's also one at P5.
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [10, 3], // MEDIUM at P3 — band-by-slot violation, but take-from-10 IS present
      [10, 2],
      [10, 7], // take-from-10 at P5 — satisfies coverage
      [8, 3],
      [9, 4],
      [9, 1],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(
      violations.filter((v) => v.rule === 'take-from-10-coverage'),
    ).toEqual([])
    // (band-by-slot does fire — verifies separation of concerns)
    expect(
      violations.find((v) => v.rule === 'band-by-slot' && v.problemIndex === 3),
    ).toBeDefined()
  })
})

describe('lintSubToTenComposition — no-duplicates rule', () => {
  it('fires when the same (a,b) pair appears twice', () => {
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [9, 1],
      [10, 2],
      [10, 3], // first 10-3
      [10, 3], // duplicate 10-3
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const dup = violations.filter((v) => v.rule === 'no-duplicates')
    expect(dup).toHaveLength(1)
    expect(dup[0]!.factId).toBe('10-3')
    expect(dup[0]!.message).toContain('appears 2 times')
  })

  it('does NOT confuse same-category different-fact (5-5 and 8-8 are different pairs)', () => {
    const facts: Array<[number, number]> = [
      [5, 5],
      [8, 8],
      [9, 1],
      [10, 2],
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(violations.filter((v) => v.rule === 'no-duplicates')).toEqual([])
  })
})

describe('lintSubToTenComposition — unparseable-problem rule', () => {
  it('fires when read text does not match either subtraction template', () => {
    const response: SessionStartResponse = {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        readUtterance(1, 7, 0),
        rawReadUtterance(2, 'Two plus three. How many?'), // ← addition (out of scope)
        readUtterance(3, 9, 1),
        readUtterance(4, 10, 2),
        readUtterance(5, 10, 3),
        readUtterance(6, 8, 3),
        readUtterance(7, 9, 4),
        readUtterance(8, 10, 7),
      ],
    }
    const violations = lintSubToTenComposition(response)
    const unp = violations.filter((v) => v.rule === 'unparseable-problem')
    expect(unp).toHaveLength(1)
    expect(unp[0]!.problemIndex).toBe(2)
  })

  it('still runs whole-session checks (coverage, dedup) on the parseable subset', () => {
    // Make P5 unparseable AND remove all take-from-10 facts so coverage
    // also fires — verifies the two rules run independently.
    const response: SessionStartResponse = {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        readUtterance(1, 7, 0),
        readUtterance(2, 6, 3),
        readUtterance(3, 9, 1),
        readUtterance(4, 10, 2),
        rawReadUtterance(5, 'garbage text'),
        readUtterance(6, 8, 3),
        readUtterance(7, 9, 4),
        readUtterance(8, 7, 4), // general (3rd HARD/general — also cap)
      ],
    }
    const violations = lintSubToTenComposition(response)
    expect(
      violations.find((v) => v.rule === 'unparseable-problem'),
    ).toBeDefined()
    expect(
      violations.find((v) => v.rule === 'take-from-10-coverage'),
    ).toBeDefined()
    expect(
      violations.find(
        (v) => v.rule === 'category-cap' && v.message.includes('general'),
      ),
    ).toBeDefined()
  })
})

// ── assertSubToTenCompositionClean ───────────────────────────────────────

describe('assertSubToTenCompositionClean', () => {
  it('does not throw on a clean canon', () => {
    const response = buildCanonResponse([...CLEAN_FACTS_PR_244])
    expect(() =>
      assertSubToTenCompositionClean('math/sub-to-10', response),
    ).not.toThrow()
  })

  it('throws CompositionLintError with the canon id + violations', () => {
    // 3 doubles in a row blows the cap and the band-by-slot is fine.
    const facts: Array<[number, number]> = [
      [10, 5], // doubles 1
      [8, 4], // doubles 2
      [6, 3], // doubles 3
      [10, 2],
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const response = buildCanonResponse(facts)
    try {
      assertSubToTenCompositionClean('math/sub-to-10', response)
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(CompositionLintError)
      const e = err as CompositionLintError
      expect(e.canonId).toBe('math/sub-to-10')
      expect(e.violations.length).toBeGreaterThanOrEqual(1)
      expect(e.message).toContain('math/sub-to-10')
    }
  })
})

// ── pool sanity (defends against accidental edits to SUB_TO_TEN_POOL) ────

describe('SUB_TO_TEN_POOL', () => {
  it('contains exactly 16 facts', () => {
    expect(SUB_TO_TEN_POOL).toHaveLength(16)
  })

  it('every fact has a unique id', () => {
    const ids = new Set(SUB_TO_TEN_POOL.map((f) => f.id))
    expect(ids.size).toBe(SUB_TO_TEN_POOL.length)
  })

  it('every fact id matches its (a, b) numerics', () => {
    for (const f of SUB_TO_TEN_POOL) {
      expect(f.id).toBe(`${f.a}-${f.b}`)
    }
  })

  it('every fact answer is in [0, 9]', () => {
    for (const f of SUB_TO_TEN_POOL) {
      const answer = f.a - f.b
      expect(answer).toBeGreaterThanOrEqual(0)
      expect(answer).toBeLessThanOrEqual(9)
    }
  })

  it('band counts match design spec §1.1: 8 EASY, 4 MEDIUM, 4 HARD', () => {
    const counts = SUB_TO_TEN_POOL.reduce(
      (acc, f) => {
        acc[f.band] = (acc[f.band] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
    expect(counts.EASY).toBe(8)
    expect(counts.MEDIUM).toBe(4)
    expect(counts.HARD).toBe(4)
  })

  it('category counts match design spec §1.1', () => {
    const counts = SUB_TO_TEN_POOL.reduce(
      (acc, f) => {
        acc[f.category] = (acc[f.category] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
    expect(counts['subtract-self']).toBe(2)
    expect(counts['subtract-zero']).toBe(2)
    expect(counts['doubles-halving']).toBe(3)
    expect(counts['subtract-one']).toBe(2)
    expect(counts['subtract-two']).toBe(1)
    expect(counts['take-from-10']).toBe(2)
    expect(counts['general']).toBe(4)
  })
})

// ── resolveTierBinding ───────────────────────────────────────────────────

describe('resolveTierBinding', () => {
  it('binds the canonical sub-to-10 path on this platform (handles both sep flavours)', () => {
    const binding = resolveTierBinding(
      'canon/math/level-1/sub-to-10.json'.replace(/\//g, sep),
    )
    expect(binding).not.toBeNull()
    expect(binding!.tier).toBe('sub-to-10')
  })

  it('binds a posix path as well', () => {
    expect(resolveTierBinding('canon/math/level-1/sub-to-10.json')?.tier).toBe(
      'sub-to-10',
    )
  })

  it('binds bare basename (used by some test paths)', () => {
    expect(resolveTierBinding('sub-to-10.json')?.tier).toBe('sub-to-10')
  })

  it('returns null for out-of-scope tier files', () => {
    expect(resolveTierBinding('canon/math/level-1/add-to-10.json')).toBeNull()
    expect(
      resolveTierBinding('canon/word-song/level-1/blending-cv.json'),
    ).toBeNull()
    expect(
      resolveTierBinding('canon/word-song/level-1/cvc-words-short-u.json'),
    ).toBeNull()
  })

  it('returns null for non-canon files (defensive)', () => {
    expect(resolveTierBinding('some/random/file.json')).toBeNull()
    expect(resolveTierBinding('')).toBeNull()
  })
})

// ── runCompositionLint: disk walker ──────────────────────────────────────

describe('runCompositionLint — disk walker', () => {
  let tmp: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'composition-lint-'))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  function writeCanon(path: string, body: SessionStartResponse): void {
    const abs = join(tmp, path)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, JSON.stringify(body, null, 2), 'utf8')
  }

  it('returns empty result when canonRoot does not exist', () => {
    const r = runCompositionLint(join(tmp, 'does-not-exist'))
    expect(r.filesScanned).toBe(0)
    expect(r.filesLinted).toBe(0)
    expect(r.totalViolations).toBe(0)
  })

  it('lints sub-to-10 and SKIPS out-of-scope tiers', () => {
    // In-scope.
    writeCanon(
      'math/level-1/sub-to-10.json',
      buildCanonResponse([...CLEAN_FACTS_PR_244]),
    )
    // Out-of-scope (these would fail OUR parser because they're addition,
    // but the lint MUST skip them).
    writeCanon('math/level-1/add-to-10.json', {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        {
          id: 'math.p1.read',
          text: 'Two plus three. How many?',
          audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
        },
      ],
    })
    writeCanon('word-song/level-1/blending-cv.json', {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        {
          id: 'word.p1.read',
          text: 'Tap the cat.',
          audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
        },
      ],
    })

    const r = runCompositionLint(tmp)
    expect(r.filesScanned).toBe(3)
    expect(r.filesLinted).toBe(1)
    expect(r.filesSkipped).toBe(2)
    expect(r.totalViolations).toBe(0)
    expect(r.findings).toEqual([])
  })

  it('records violations grouped by file', () => {
    // Bad canon: 3 doubles.
    writeCanon(
      'math/level-1/sub-to-10.json',
      buildCanonResponse([
        [10, 5],
        [8, 4],
        [6, 3],
        [10, 2],
        [10, 3],
        [8, 3],
        [9, 4],
        [10, 7],
      ]),
    )
    const r = runCompositionLint(tmp)
    expect(r.filesLinted).toBe(1)
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0]!.filePath).toContain('math/level-1/sub-to-10.json')
    expect(r.findings[0]!.tier).toBe('sub-to-10')
    expect(r.findings[0]!.violations.length).toBeGreaterThanOrEqual(1)
    expect(r.totalViolations).toBe(r.findings[0]!.violations.length)
  })

  it('records unparseable JSON without throwing', () => {
    // Manually write malformed JSON at the sub-to-10 path.
    const abs = join(tmp, 'math/level-1/sub-to-10.json')
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, '{ not json', 'utf8')
    const r = runCompositionLint(tmp)
    expect(r.unparseable).toHaveLength(1)
    expect(r.unparseable[0]!.filePath).toContain('sub-to-10.json')
  })

  it('records shape-mismatch (not a SessionStartResponse) as unparseable', () => {
    const abs = join(tmp, 'math/level-1/sub-to-10.json')
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, '{"hello":"world"}', 'utf8')
    const r = runCompositionLint(tmp)
    expect(r.unparseable).toHaveLength(1)
    expect(r.unparseable[0]!.reason).toBe('not a SessionStartResponse')
  })
})

// ── formatCompositionLintReport ──────────────────────────────────────────

describe('formatCompositionLintReport', () => {
  it('renders "no violations" cleanly', () => {
    const out = formatCompositionLintReport({
      filesScanned: 5,
      filesLinted: 1,
      filesSkipped: 4,
      totalViolations: 0,
      findings: [],
      unparseable: [],
    })
    expect(out).toContain('files scanned: 5')
    expect(out).toContain('files linted:  1')
    expect(out).toContain('files skipped: 4')
    expect(out).toContain('No composition violations')
  })

  it('renders each finding with rule, slot, and message', () => {
    const out = formatCompositionLintReport({
      filesScanned: 1,
      filesLinted: 1,
      filesSkipped: 0,
      totalViolations: 1,
      findings: [
        {
          filePath: 'math/level-1/sub-to-10.json',
          tier: 'sub-to-10',
          violations: [
            {
              rule: 'category-cap',
              problemIndex: null,
              message:
                'Category "doubles-halving" cap is 1; canon has 3 (slots P1, P2, P3).',
              factId: null,
            },
          ],
        },
      ],
      unparseable: [],
    })
    expect(out).toContain('math/level-1/sub-to-10.json')
    expect(out).toContain('sub-to-10')
    expect(out).toContain('category-cap')
    expect(out).toContain('slot=*')
    expect(out).toContain('Category "doubles-halving"')
  })

  it('lists unparseable files separately', () => {
    const out = formatCompositionLintReport({
      filesScanned: 1,
      filesLinted: 0,
      filesSkipped: 0,
      totalViolations: 0,
      findings: [],
      unparseable: [{ filePath: 'sub-to-10.json', reason: 'JSON parse error' }],
    })
    expect(out).toContain('Unparseable files:')
    expect(out).toContain('sub-to-10.json')
  })
})

// ── SUB_TO_TEN_RULES sanity (defends against accidental config edits) ────

describe('SUB_TO_TEN_RULES', () => {
  it('has totalProblems = 8', () => {
    expect(SUB_TO_TEN_RULES.totalProblems).toBe(8)
  })

  it('has take-from-10 cap of 2 (high-value category)', () => {
    expect(SUB_TO_TEN_RULES.categoryCaps['take-from-10']).toBe(2)
  })

  it('has general cap of 2 (HARD cap)', () => {
    expect(SUB_TO_TEN_RULES.categoryCaps['general']).toBe(2)
  })

  it('has all other category caps at 1', () => {
    expect(SUB_TO_TEN_RULES.categoryCaps['subtract-self']).toBe(1)
    expect(SUB_TO_TEN_RULES.categoryCaps['subtract-zero']).toBe(1)
    expect(SUB_TO_TEN_RULES.categoryCaps['doubles-halving']).toBe(1)
    expect(SUB_TO_TEN_RULES.categoryCaps['subtract-one']).toBe(1)
    expect(SUB_TO_TEN_RULES.categoryCaps['subtract-two']).toBe(1)
  })

  it('EASY allowed at all slots P1-P8', () => {
    expect(SUB_TO_TEN_RULES.bandAllowedSlots.EASY).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ])
  })

  it('MEDIUM allowed at P4-P8 only', () => {
    expect(SUB_TO_TEN_RULES.bandAllowedSlots.MEDIUM).toEqual([4, 5, 6, 7, 8])
  })

  it('HARD allowed at P5-P8 only', () => {
    expect(SUB_TO_TEN_RULES.bandAllowedSlots.HARD).toEqual([5, 6, 7, 8])
  })

  it('takeFromTenInP4ToP8Min = 1', () => {
    expect(SUB_TO_TEN_RULES.takeFromTenInP4ToP8Min).toBe(1)
  })
})
