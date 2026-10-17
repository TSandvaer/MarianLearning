/**
 * @vitest-environment node
 *
 * Sharing's canon (`design/native/content-wave-2.md` § 2.7, AC 2) against
 * `scripts/spliceContentWave2Canon.ts` and `scripts/shareCanonCheck.ts`:
 *
 * - The committed `div-share.json` is what the splice writes (a hand edit
 *   or a Haiku re-bake fails here), and it equals § 2.7 line for line.
 * - All 8 reads parse as `divide` problems (the read-line row of the
 *   sibling-tier checklist), with § 2.7's pile, plates and share.
 * - The bake lint catches every § 2.7 rule a plan can break.
 * - The step is pending (never Haiku-baked) and voice-QA lists it.
 *
 * The file's 16 new texts have empty audio until their Lily render; that
 * red lives in `canonIntegrity.test.ts` (a) and
 * `spliceContentWave1Canon.test.ts` "no empty clip".
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import { PENDING_CANON_NODES } from './generateSessionCanon.ts'
import {
  SHARE_PLAN,
  SHARE_RECAP_FOCUS,
  shareCanonViolations,
  shareLines,
  shareRuleViolations,
  type ShareSpec,
} from './shareCanonCheck.ts'
import { MATH_CANON_DIR } from './spliceContentWave1Canon.ts'
import {
  SHARE_FILE,
  shareAwaitingRender,
  spliceShare,
} from './spliceContentWave2Canon.ts'

const committed = () =>
  JSON.parse(
    readFileSync(join(MATH_CANON_DIR, `${SHARE_FILE}.json`), 'utf8'),
  ) as ReturnType<typeof spliceShare>

/** § 2.7, row by row: pile, plates, share, read, correct. */
const TABLE: readonly [number, number, number, string, string][] = [
  [
    6,
    2,
    3,
    'Six flowers, two plates. How many on each plate?',
    'Yes! Three on each plate!',
  ],
  [
    8,
    2,
    4,
    'Eight flowers, two plates. How many on each plate?',
    'Yes! Four on each plate!',
  ],
  [
    10,
    2,
    5,
    'Ten flowers, two plates. How many on each plate?',
    'Yes! Five on each plate!',
  ],
  [
    12,
    3,
    4,
    'Twelve flowers, three plates. How many on each plate?',
    'Yes! Four on each plate!',
  ],
  [
    8,
    4,
    2,
    'Eight flowers, four plates. How many on each plate?',
    'Yes! Two on each plate!',
  ],
  [
    15,
    5,
    3,
    'Fifteen flowers, five plates. How many on each plate?',
    'Yes! Three on each plate!',
  ],
  [
    20,
    4,
    5,
    'Twenty flowers, four plates. How many on each plate?',
    'Yes! Five on each plate!',
  ],
  [
    18,
    3,
    6,
    'Eighteen flowers, three plates. How many on each plate?',
    'Yes! Six on each plate!',
  ],
]

describe('the div-share canon is the splice (§ 2.7, AC 2)', () => {
  it('the committed file equals spliceShare()', () => {
    expect(spliceShare()).toEqual(committed())
  })

  it('has § 2.7 line for line, and no other math line', () => {
    expect(shareCanonViolations(committed().utterances)).toEqual([])
    const lines = committed().utterances
    const text = (id: string) => lines.find((u) => u.id === id)?.text
    TABLE.forEach(([, , share, read, correct], i) => {
      const n = i + 1
      expect([
        text(`math.p${n}.read`),
        text(`math.p${n}.correct`),
        text(`math.p${n}.reprompt`),
        text(`math.p${n}.hint1`),
        text(`math.p${n}.hint2`),
        text(`math.p${n}.hint3`),
        text(`math.p${n}.giveAnswer`),
      ]).toEqual([
        read,
        correct,
        'Hmm... try again?',
        'Look at the flowers.',
        'One for each plate.',
        'How many on each plate?',
        `This one is ${['', 'one', 'two', 'three', 'four', 'five', 'six'][share]}.`,
      ])
    })
    expect(text('session.end.recap.focus')).toBe('You worked on sharing today!')
    // Every math file's session-end lines: 20 of them.
    expect(lines.filter((u) => u.id.startsWith('session.end.'))).toHaveLength(
      20,
    )
  })

  it('8/8 reads parse as divide problems with § 2.7 pile, plates and share', () => {
    const plan = mathSessionPlanFromServer(committed().plan, {
      extendedKinds: true,
    })
    expect(
      plan.problems.map((p) =>
        p.kind === 'divide' ? [p.total, p.plates, p.correct] : p.kind,
      ),
    ).toEqual(TABLE.map(([t, b, s]) => [t, b, s]))
  })

  it('reuses rendered audio for shared texts; 16 new texts (599 characters) await the render', () => {
    const doc = committed()
    const audioOf = (text: string) =>
      doc.utterances.find((u) => u.text === text)!.audio.base64
    for (const reused of [
      'Hmm... try again?',
      'Look at the flowers.',
      'This one is four.',
      'You did it!',
    ])
      expect([reused, audioOf(reused) !== '']).toEqual([reused, true])
    const waiting = shareAwaitingRender(doc)
    // Before the render: the § 6.2 count. After it: none.
    if (waiting.length > 0) {
      expect(waiting).toHaveLength(16)
      expect(waiting.reduce((n, t) => n + t.length, 0)).toBe(599)
      expect(waiting).toContain(SHARE_RECAP_FOCUS)
    }
  })
})

describe('the sharing bake lint (§ 2.7 rules)', () => {
  it('passes the spec table', () => {
    expect(shareRuleViolations(SHARE_PLAN)).toEqual([])
    expect(SHARE_PLAN.map((s) => [s.total, s.plates])).toEqual(
      TABLE.map(([t, b]) => [t, b]),
    )
  })

  const swap = (i: number, spec: ShareSpec): ShareSpec[] =>
    SHARE_PLAN.map((s, j) => (j === i ? spec : s))

  it.each<[string, ShareSpec[], string]>([
    [
      'an uneven share',
      swap(3, { total: 13, plates: 3 }),
      'P4: 13 does not share evenly onto 3 plates',
    ],
    ['six plates', swap(5, { total: 12, plates: 6 }), 'P6: 6 plates (2-5)'],
    [
      'a share of 7',
      swap(6, { total: 14, plates: 2 }),
      'P7: a share of 7 (2-6)',
    ],
    [
      '21 flowers',
      swap(7, { total: 21, plates: 3 }),
      'P8: 21 flowers (at most 20)',
    ],
    [
      '3 plates on P2',
      swap(1, { total: 9, plates: 3 }),
      'P2: 3 plates; P1-P3 have 2',
    ],
    [
      '2 plates on P5',
      swap(4, { total: 12, plates: 2 }),
      'P5: 2 plates; P4-P8 have 3-5',
    ],
    [
      'the share equals the plates',
      swap(3, { total: 9, plates: 3 }),
      'P4: the share 3 is the plate count',
    ],
    [
      'a repeated later share',
      swap(4, { total: 16, plates: 4 }),
      'P5: the share 4 repeats in P4-P8',
    ],
    [
      'a pair twice',
      swap(1, { total: 6, plates: 2 }),
      'P2: 6 on 2 plates again',
    ],
  ])('flags %s', (_name, plan, message) => {
    expect(shareRuleViolations(plan)).toContain(message)
  })

  it('flags a drifted line and a wrong recap', () => {
    const lines = committed().utterances.map(({ id, text }) => ({
      id,
      text:
        id === 'math.p4.hint2'
          ? 'Twelve flowers.'
          : id === 'session.end.recap.focus'
            ? 'You worked on counting in groups today!'
            : text,
    }))
    expect(shareCanonViolations(lines)).toEqual([
      'math.p4.hint2 is "Twelve flowers.", expected "One for each plate."',
      'session.end.recap.focus is "You worked on counting in groups today!", expected "You worked on sharing today!"',
    ])
  })

  it('writes the § 2.7 line templates', () => {
    expect(shareLines({ total: 20, plates: 4 })).toEqual([
      'Twenty flowers, four plates. How many on each plate?',
      'Yes! Five on each plate!',
      'Hmm... try again?',
      'Look at the flowers.',
      'One for each plate.',
      'How many on each plate?',
      'This one is five.',
    ])
  })
})

describe('sharing is never Haiku-baked, and voice-QA lists it', () => {
  it('div-share is pending', () => {
    expect(PENDING_CANON_NODES.has('div-share')).toBe(true)
  })

  it("voice-QA's CANON_FILES lists math/div-share", () => {
    const html = readFileSync(
      resolve(process.cwd(), 'public/voice-qa.html'),
      'utf8',
    )
    const block = html.slice(
      html.indexOf('const CANON_FILES'),
      html.indexOf('const GREET_FILES'),
    )
    expect(block).toContain("['math', 'div-share']")
  })
})
