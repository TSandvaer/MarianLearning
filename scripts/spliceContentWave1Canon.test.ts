/**
 * @vitest-environment node
 *
 * Content wave 1's Number Garden canon (`design/native/content-wave-1.md`
 * § 1.8, § 2.2) against `scripts/spliceContentWave1Canon.ts`:
 *
 * - The committed files are what the splice writes (a hand edit, or a
 *   re-bake that re-drew the kept problems, fails here).
 * - The kept problems keep their bytes: P1–P3, P5 and P7 of add-to-10 and
 *   add-to-20 are main's blocks, audio included.
 * - Every math canon line has rendered audio. RED until the Lily render
 *   of the 40 new texts (`npx tsx scripts/revoiceCanonLily.ts --unrendered`):
 *   listed under "Expected red until assets" in the PR.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PENDING_CANON_NODES,
  activeCombos,
  combosToBakeFor,
} from './generateSessionCanon.ts'
import {
  MATH_CANON_DIR,
  WAVE_1_PLANS,
  missingNumberLines,
  spliceWave1,
  timesLines,
  word,
  type Wave1File,
} from './spliceContentWave1Canon'

const committed = (file: string) =>
  JSON.parse(readFileSync(join(MATH_CANON_DIR, `${file}.json`), 'utf8')) as {
    utterances: { id: string; text: string; audio: { base64: string } }[]
  }

describe('the content wave 1 math canon is the splice', () => {
  it.each(Object.keys(WAVE_1_PLANS) as Wave1File[])(
    '%s equals spliceWave1()',
    (file) => {
      expect(spliceWave1(file)).toEqual(committed(file))
    },
  )

  it('the line templates (§ 1.3; the planner generic-tier times lines)', () => {
    expect(missingNumberLines(7, 10)).toEqual([
      'Seven and what make ten?',
      'Yes! Seven and three make ten!',
      'Hmm... try again?',
      'Look at the flowers.',
      'Seven flowers.',
      'How many more make ten?',
      'This one is three.',
    ])
    expect(missingNumberLines(1, 10)[4]).toBe('One flower.')
    expect(timesLines(7, 4)).toEqual([
      'Seven times four. How many?',
      'Yes! Twenty-eight!',
      'Hmm... try again?',
      'Look at the groups.',
      'Seven, seven, seven, seven.',
      'How many?',
      'This one is twenty-eight.',
    ])
    expect(timesLines(5, 3)[4]).toBe('Five, then five, then five.')
    expect(timesLines(3, 5)[4]).toBe('Three, three, three, three, three.')
    expect(word(36)).toBe('thirty-six')
    expect(word(40)).toBe('forty')
  })
})

describe('the kept problems keep their lines and bytes (§ 1.8)', () => {
  /** main's files before the wave (frozen for the web e2e). */
  const before = (file: string) =>
    JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'e2e',
          'fixtures',
          'canon-web-plain-addition',
          `${file}.json`,
        ),
        'utf8',
      ),
    ) as { utterances: { id: string; text: string; audio: unknown }[] }

  const MOVES: [Wave1File, [to: number, from: number][]][] = [
    // new problem ← old problem
    [
      'add-to-10',
      [
        [1, 1],
        [2, 2],
        [3, 3],
        [5, 5],
        [7, 8],
      ],
    ],
    [
      'add-to-20',
      [
        [1, 1],
        [2, 2],
        [3, 3],
        [5, 5],
        [7, 7],
      ],
    ],
  ]
  it.each(MOVES)('%s', (file, moves) => {
    const now = committed(file).utterances
    const old = before(file).utterances
    for (const [to, from] of moves) {
      const strip = (id: string, n: number) => id.replace(`math.p${n}.`, '')
      const block = (us: typeof old, n: number) =>
        us
          .filter((u) => u.id.startsWith(`math.p${n}.`))
          .map((u) => ({ ...u, id: strip(u.id, n) }))
      expect(block(now, to)).toEqual(block(old, from))
      expect(block(now, to)).toHaveLength(7)
    }
    // The session-end lines are untouched.
    expect(now.filter((u) => u.id.startsWith('session.end.'))).toEqual(
      old.filter((u) => u.id.startsWith('session.end.')),
    )
  })
})

// The Vercel `prebuild` runs the incremental bake with the build env's
// keys on every preview build. These three files are spliced, never
// Haiku-baked: neither the prebuild nor a `--force` regen may touch them.
describe('the pending-canon gate keeps every bake off the spliced files', () => {
  const MINE = ['add-to-10', 'add-to-20', 'mult-mix']
  const combos = activeCombos()
  const math = (n: string) => combos.some((c) => c.focusNode === n)

  it('all three are combos, and pending', () => {
    for (const n of MINE) {
      expect(math(n)).toBe(true)
      expect(PENDING_CANON_NODES.has(n)).toBe(true)
    }
  })

  it('an incremental run with the files missing, and --force, bake none of them', () => {
    for (const force of [false, true]) {
      const baked = combosToBakeFor(
        combos,
        { force, includePending: false },
        () => false,
      ).map((c) => c.focusNode)
      expect(baked.filter((n) => MINE.includes(n))).toEqual([])
    }
  })

  it('with the files committed, even --include-pending bakes none of them (no --force)', () => {
    expect(
      combosToBakeFor(combos, { force: false, includePending: true }, (c) =>
        MINE.includes(c.focusNode),
      )
        .map((c) => c.focusNode)
        .filter((n) => MINE.includes(n)),
    ).toEqual([])
  })
})

describe('every math canon line has rendered audio', () => {
  it('no empty clip (RED until the Lily render of the new lines)', () => {
    const empty = readdirSync(MATH_CANON_DIR)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) =>
        committed(f.replace(/\.json$/, ''))
          .utterances.filter((u) => u.audio.base64 === '')
          .map((u) => `${f} ${u.id} "${u.text}"`),
      )
    expect(empty).toEqual([])
  })
})
