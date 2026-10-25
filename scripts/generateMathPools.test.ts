/**
 * @vitest-environment node
 *
 * The closed math pools (no-Claude plan phase 5a,
 * `design/native/no-claude-sizing.md` § 3 scenario C, § 4 row 5a):
 * `scripts/generateMathPools.ts` writes every fact of the 9 closed math
 * steps as canon problems p9..pN from today's line templates, with no Haiku.
 *
 * - The 0-miss check: the generator reproduces every committed p1..p8
 *   line of those steps byte for byte (row 5a: "the 0-miss template check
 *   must run in CI").
 * - Every committed pool file is what the generator writes (a re-bake that
 *   drops a pool, or a hand edit, fails here).
 * - Scenario C's pools: 176 new blocks; each fact once.
 * - Audio: a pool line whose text canon already voices carries those
 *   bytes; a new text has its Lily render (the 5a render: none is empty).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { servedCanon } from '@marian/core/wire/canonPool'
import {
  MATH_POOL_CANON_DIR,
  MATH_POOL_STEPS,
  canonAudioIndex,
  generatePoolFile,
  poolBlocks,
  poolRenderBill,
  zeroMisses,
  type CanonDoc,
} from './generateMathPools'

/** These read and parse the pool files (~34 MB): an explicit budget
 *  (testing-and-ci.md § 1.1; the first, cold run took 3.1 s locally). */
const LOAD_BUDGET_MS = 30_000

const read = (step: string): CanonDoc =>
  JSON.parse(readFileSync(join(MATH_POOL_CANON_DIR, `${step}.json`), 'utf8'))

/** Scenario C (sizing :98): every block of each step, the served 8 included. */
const C_BLOCKS: Record<string, number> = {
  'add-to-10': 53,
  'add-to-20': 32,
  'sub-to-10': 22,
  'sub-to-20': 22,
  'two-digit-addsub': 36,
  'two-digit-addsub-with-regroup': 30,
  'mult-2-5-10': 19,
  'mult-3-4': 14,
  'mult-6-9': 20,
}

const problemIds = (doc: CanonDoc, n: number) =>
  doc.utterances.filter((u) => u.id.startsWith(`math.p${n}.`)).map((u) => u.id)

describe('generateMathPools (phase 5a, scenario C)', () => {
  it('covers the 9 closed math steps', () => {
    expect([...MATH_POOL_STEPS]).toEqual(Object.keys(C_BLOCKS))
  })

  it(
    'reproduces every committed p1..p8 line of the 9 steps: 0 misses',
    () => {
      let checked = 0
      for (const step of MATH_POOL_STEPS) {
        const doc = read(step)
        expect(zeroMisses(step, doc)).toEqual([])
        for (let p = 1; p <= 8; p++) checked += problemIds(doc, p).length
      }
      expect(checked).toBe(9 * 8 * 7)
    },
    LOAD_BUDGET_MS,
  )

  it('finds a miss: a changed line, a fact off the pool', () => {
    const doc = read('sub-to-10')
    const edit = (id: string, text: string): CanonDoc => ({
      ...doc,
      utterances: doc.utterances.map((u) => (u.id === id ? { ...u, text } : u)),
    })
    expect(
      zeroMisses('sub-to-10', edit('math.p2.hint3', 'Take three away.')),
    ).toHaveLength(1)
    expect(
      zeroMisses(
        'sub-to-10',
        edit('math.p2.read', 'Six take away five. How many are left?'),
      ),
    ).toHaveLength(1)
  })

  it('has every fact of scenario C once: 176 new blocks', () => {
    let added = 0
    for (const step of MATH_POOL_STEPS) {
      const blocks = poolBlocks(step)
      expect(blocks).toHaveLength(C_BLOCKS[step]!)
      expect(new Set(blocks.map((b) => b.lines[0])).size).toBe(blocks.length)
      added += blocks.length - 8
    }
    expect(added).toBe(176)
  })

  it(
    'writes each committed pool file exactly (p1..p8 untouched)',
    () => {
      const audio = canonAudioIndex()
      for (const step of MATH_POOL_STEPS) {
        const text = readFileSync(
          join(MATH_POOL_CANON_DIR, `${step}.json`),
          'utf8',
        )
        const doc = JSON.parse(text) as CanonDoc
        expect(JSON.stringify(generatePoolFile(step, doc, audio))).toBe(text)
        for (let p = 9; p <= C_BLOCKS[step]!; p++) {
          expect(problemIds(doc, p)).toHaveLength(7)
        }
        expect(problemIds(doc, C_BLOCKS[step]! + 1)).toEqual([])
      }
    },
    LOAD_BUDGET_MS,
  )

  it(
    'voices a pool line with the clip canon has for its text, else with its own render',
    () => {
      const audio = canonAudioIndex()
      let reused = 0
      let rendered = 0
      for (const step of MATH_POOL_STEPS) {
        const doc = read(step)
        const pool = doc.utterances.filter(
          (u) => !servedCanon(doc).utterances.includes(u),
        )
        for (const u of pool) {
          const known = audio.served.get(u.text)
          if (known !== undefined) {
            expect(u.audio.base64).toBe(known)
            reused++
          } else {
            expect(u.audio.base64).not.toBe('')
            rendered++
          }
        }
      }
      expect(reused).toBeGreaterThan(0)
      expect(rendered).toBeGreaterThan(0)
    },
    LOAD_BUDGET_MS,
  )

  it(
    'bills the new Lily characters once per request text, against every served line',
    () => {
      // Sizing § 3 C priced each step on its own (287 lines, 7,386 chars);
      // the render keys its jobs on the request text across all files
      // (`revoiceCanonLily.ts`), so the 17 texts two steps share bill once.
      const bill = poolRenderBill()
      expect(bill.total).toEqual({ blocks: 176, lines: 266, chars: 6970 })
      expect(
        bill.steps.map((s) => [s.step, s.blocks, s.lines, s.chars]),
      ).toEqual([
        ['add-to-10', 45, 54, 1351],
        ['add-to-20', 24, 32, 880],
        ['sub-to-10', 14, 16, 604],
        ['sub-to-20', 14, 17, 601],
        ['two-digit-addsub', 28, 76, 1803],
        ['two-digit-addsub-with-regroup', 22, 41, 1030],
        ['mult-2-5-10', 11, 10, 213],
        ['mult-3-4', 6, 4, 88],
        ['mult-6-9', 12, 16, 400],
      ])
    },
    LOAD_BUDGET_MS,
  )

  it(
    'the render voiced exactly the billed pool lines: none waits for audio',
    () => {
      // After the render: no pool line is empty, and the texts only the
      // pools voice (no served line has them) are the bill's lines.
      const { served } = canonAudioIndex()
      const own = new Set<string>()
      let empty = 0
      for (const step of MATH_POOL_STEPS) {
        const doc = read(step)
        const servedLines = new Set(servedCanon(doc).utterances)
        for (const u of doc.utterances) {
          if (u.audio.base64 === '') empty++
          if (!servedLines.has(u) && !served.has(u.text)) own.add(u.text)
        }
      }
      expect(empty).toBe(0)
      expect(own.size).toBe(poolRenderBill().total.lines)
    },
    LOAD_BUDGET_MS,
  )
})
