/**
 * `composeSession`'s phase-3 branch: with a `mathPick` request an
 * add-to-10 / sub-to-10 forward session is the device's own pick over the
 * bundled canon (`./mathPicker.ts`); without one, nothing changes (the
 * parity test, `tests/noClaude/localSessionParity.test.ts`, holds the
 * rest to the server).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { servedCanon } from '../wire/canonPool'
import { localDateKey } from '../progress/clock'
import {
  PICK_PLAN_ID_PREFIX,
  composeSession,
  type CanonText,
  type CanonTextResolver,
  type LocalSession,
} from './composeSession'
import type { MathPickRequest } from './mathPicker'

const CANON = JSON.parse(
  readFileSync('mobile/assets/canon/canon-text.json', 'utf8'),
) as Record<string, CanonText>
// The served 8 of each step: what the device draws until a pool block
// (problem 9+) is voiced (no-Claude plan phase 5a, composeSession.pool.test.ts).
const resolve: CanonTextResolver = (key) => {
  const entry = CANON[`${key.track}/level-${key.level}/${key.focusNode}`]
  return entry === undefined ? null : servedCanon(entry)
}

const NOW = new Date('2026-10-24T09:00:00.000Z').getTime()

function request(over: Partial<MathPickRequest> = {}): MathPickRequest {
  return {
    step: 'add-to-10',
    leitner: {
      items: [
        { item: { a: 6, b: 4, op: '+' }, box: 1, lastSeen: NOW - 86_400_000 },
      ],
    },
    seen: {},
    previous: null,
    slow: [],
    warmup: [],
    nowMs: NOW,
    today: localDateKey(new Date(NOW)),
    seed: 0,
    ...over,
  }
}

const math = (focusNode: string, extra: Record<string, unknown> = {}) => ({
  track: 'math',
  level: 1,
  childName: 'friend',
  progress: { focusNode },
  ...extra,
})

const local = (out: ReturnType<typeof composeSession>): LocalSession => {
  if (out.kind !== 'local') throw new Error(JSON.stringify(out))
  return out.session
}
const reads = (s: LocalSession) =>
  s.utterances.filter((u) => /^math\.p\d\.read$/.test(u.id)).map((u) => u.text)

describe('composeSession with a math pick', () => {
  it('builds the pick: the step’s blocks in the picker’s order, its session.end lines, a pick- plan id', () => {
    const out = composeSession(math('add-to-10'), resolve, {
      mathPick: request(),
    })
    expect(out.kind === 'local' && out.served).toBe('pick')
    const s = local(out)
    expect((s.plan as { id: string }).id).toBe(
      `${PICK_PLAN_ID_PREFIX}add-to-10`,
    )
    // 6 + ? = 10 is due: it leads P4.
    expect(reads(s)[3]).toBe('Six and what make ten?')
    const canon = CANON['math/level-1/add-to-10']!
    const ends = (lines: readonly { id: string }[]) =>
      lines.filter((u) => u.id.startsWith('session.end.')).map((u) => u.id)
    expect(ends(s.utterances)).toEqual(ends(canon.utterances))
    // Every problem keeps all of its lines, renamed.
    for (let n = 1; n <= 8; n++) {
      expect(
        s.utterances.filter((u) => u.id.startsWith(`math.p${n}.`)),
      ).toHaveLength(7)
    }
    // The plan carries the same problem lines.
    const plan = (s.plan as { utterances: { id: string; text: string }[] })
      .utterances
    expect(
      plan.filter((u) => /^math\.p\d\.read$/.test(u.id)).map((u) => u.text),
    ).toEqual(reads(s))
  })

  it('without a pick request the session is the canon one (phase 2, unchanged)', () => {
    const out = composeSession(math('add-to-10'), resolve)
    expect(out.kind === 'local' && out.served).toBe('canon')
    expect(local(out).plan).toEqual(
      servedCanon(CANON['math/level-1/add-to-10']!).plan,
    )
  })

  it('a pick for another step leaves the session alone', () => {
    const out = composeSession(math('add-to-20'), resolve, {
      mathPick: request(),
    })
    expect(out.kind === 'local' && out.served).toBe('canon')
  })

  it('keeps the warm-up blocks and the first-encounter opener, as for the canon session', () => {
    const out = composeSession(
      math('sub-to-10', {
        progress: {
          focusNode: 'sub-to-10',
          lifetimeFirstEncounters: ['sub-to-10'],
        },
        warmup: { blocks: [{ node: 'add-to-20', problem: 1 }] },
      }),
      resolve,
      {
        mathPick: request({
          step: 'sub-to-10',
          leitner: { items: [] },
          slow: [{ a: 9, b: 1, op: '-' }],
          warmup: [{ a: 9, b: 2, op: '+' }],
        }),
      },
    )
    const s = local(out)
    expect(s.utterances.some((u) => u.id === 'math.w1.read')).toBe(true)
    expect(s.utterances.find((u) => u.id === 'session.end.opener')?.text).toBe(
      'You did it!',
    )
  })

  it('drops a warm-up block whose + fact is the inverse of a − problem that plays (dual exposure)', () => {
    // add-to-10 p4 is 7 + ? = 10: the inverse of sub-to-10's 10 - 3 and 10 - 7.
    const out = composeSession(
      math('sub-to-10', {
        warmup: {
          blocks: [
            { node: 'add-to-20', problem: 1 },
            { node: 'add-to-10', problem: 4 },
          ],
        },
      }),
      resolve,
      {
        mathPick: request({
          step: 'sub-to-10',
          leitner: { items: [] },
          slow: [{ a: 9, b: 1, op: '-' }],
          warmup: [
            { a: 9, b: 2, op: '+' },
            { a: 7, b: 3, op: '+' },
          ],
        }),
      },
    )
    const ids = local(out).utterances.map((u) => u.id)
    expect(ids.some((id) => id.startsWith('math.w1.'))).toBe(true)
    expect(ids.some((id) => id.startsWith('math.w2.'))).toBe(false)
  })

  it('throws when the pick cannot be built, so the app asks the server', () => {
    const broken: CanonTextResolver = (key) => {
      const entry = resolve(key)
      if (entry === null || key.focusNode !== 'add-to-10') return entry
      return {
        plan: entry.plan,
        utterances: entry.utterances.filter(
          (u) => !u.id.startsWith('math.p2.'),
        ),
      }
    }
    expect(() =>
      composeSession(math('add-to-10'), broken, { mathPick: request() }),
    ).toThrow()
  })
})
