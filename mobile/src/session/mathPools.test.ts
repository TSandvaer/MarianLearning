/**
 * The closed math pools on the device (no-Claude plan phase 5a,
 * `design/native/no-claude-sizing.md` § 2 "How a pool grows"), after
 * their Lily render: the bundle carries every pool block (problems 9..N of
 * the 9 closed steps), and the device draws a block only when every one of
 * its lines has a bundled clip (`bundledCanonText`). Every block has its
 * clips, so the device serves every one.
 */
import { localDateKey } from '@marian/core/progress/clock'
import {
  composeSession,
  type CanonText,
  type LocalSession,
} from '@marian/core/session/composeSession'
import type { MathPickRequest } from '@marian/core/session/mathPicker'
import canonText from '../../assets/canon/canon-text.json'
import { canonClipFor } from '../audio/bundledAudio'
import { bundledCanonText } from './localSession'

const CANON = canonText as unknown as Readonly<Record<string, CanonText>>

const POOL_STEPS: Record<string, number> = {
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

const problemsOf = (entry: CanonText) =>
  [
    ...new Set(
      entry.utterances.flatMap((u) => {
        const m = /^math\.p(\d+)\./.exec(u.id)
        return m === null ? [] : [Number(m[1])]
      }),
    ),
  ].sort((a, b) => a - b)
const EIGHT = [1, 2, 3, 4, 5, 6, 7, 8]
const device = (focusNode: string) =>
  bundledCanonText({ track: 'math', level: 1, focusNode })!

const NOW = new Date('2026-10-24T09:00:00.000Z').getTime()
const DAY = 86_400_000

/** A Leitner box of `n` of the step's facts, all due in box 1. */
function dueBox(step: 'add-to-10' | 'sub-to-10', n: number, seed: number) {
  const facts =
    step === 'add-to-10'
      ? Array.from({ length: 9 }, (_, i) => ({ a: 1 + i, b: 9 - i, op: '+' }))
      : Array.from({ length: 9 }, (_, i) => ({ a: 10, b: 1 + i, op: '-' }))
  return {
    items: facts.slice(0, n).map((item, i) => ({
      item: item as MathPickRequest['leitner']['items'][number]['item'],
      box: (1 + ((seed + i) % 5)) as 1 | 2 | 3 | 4 | 5,
      lastSeen: NOW - (1 + ((seed * 7 + i) % 12)) * DAY,
    })),
  }
}

function pick(step: 'add-to-10' | 'sub-to-10', seed: number): LocalSession {
  const out = composeSession(
    {
      track: 'math',
      level: 1,
      childName: 'friend',
      progress: { focusNode: step },
      seed,
    },
    bundledCanonText,
    {
      mathPick: {
        step,
        leitner: dueBox(step, seed % 10, seed),
        seen: {},
        previous: null,
        slow: [],
        warmup: [],
        nowMs: NOW,
        today: localDateKey(new Date(NOW)),
        seed,
      },
    },
  )
  if (out.kind !== 'local') throw new Error(JSON.stringify(out))
  return out.session
}

describe('the closed math pools after their render (phase 5a)', () => {
  it('the bundle carries every pool block of the 9 closed steps', () => {
    for (const [step, n] of Object.entries(POOL_STEPS)) {
      expect(problemsOf(CANON[`math/level-1/${step}`]!)).toHaveLength(n)
    }
  })

  it('the device sees every pool block of the 9 closed steps: all are voiced', () => {
    for (const [step, n] of Object.entries(POOL_STEPS)) {
      const all = Array.from({ length: n }, (_, i) => i + 1)
      expect([step, problemsOf(device(step))]).toEqual([step, all])
      // Nothing to leave out: the bundled entry itself.
      expect(device(step)).toBe(CANON[`math/level-1/${step}`])
    }
  })

  it('every line the device can serve has its bundled clip', () => {
    const missing: string[] = []
    for (const path of Object.keys(CANON)) {
      const [track, level, focusNode] = path.split('/') as [
        'math' | 'word-song',
        string,
        string,
      ]
      const entry = bundledCanonText({
        track,
        level: Number(level.replace('level-', '')),
        focusNode,
      })!
      for (const u of entry.utterances) {
        if (canonClipFor(u.text) === undefined) missing.push(`${path} ${u.id}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('every picked add-to-10 / sub-to-10 session plays only bundled clips, and draws pool blocks', () => {
    for (const step of ['add-to-10', 'sub-to-10'] as const) {
      const served = new Set(
        device(step)
          .utterances.filter((u) => u.id.endsWith('.read'))
          .map((u) => u.text),
      )
      // The reads of problems 9+ (the pool), by text.
      const pool = new Set(
        device(step)
          .utterances.filter((u) => /^math\.p(9|\d{2,})\.read$/.test(u.id))
          .map((u) => u.text),
      )
      const drawn = new Set<string>()
      for (let seed = 0; seed < 60; seed++) {
        const s = pick(step, seed)
        const reads = s.utterances
          .filter((u) => /^math\.p\d\.read$/.test(u.id))
          .map((u) => u.text)
        expect(reads).toHaveLength(8)
        expect(reads.filter((r) => !served.has(r))).toEqual([])
        for (const r of reads) if (pool.has(r)) drawn.add(r)
        expect(
          s.utterances.filter((u) => canonClipFor(u.text) === undefined),
        ).toEqual([])
      }
      expect(drawn.size).toBeGreaterThan(0)
    }
  }, 30_000)

  it("a step's canon session is its served 8, pool or no pool", () => {
    for (const step of Object.keys(POOL_STEPS)) {
      const focusNode =
        step === 'two-digit-addsub' ? 'two-digit-addsub-no-regroup' : step
      const out = composeSession(
        {
          track: 'math',
          level: 1,
          childName: 'friend',
          progress: { focusNode },
        },
        bundledCanonText,
      )
      if (out.kind !== 'local') throw new Error(step)
      expect(problemsOf(out.session as CanonText)).toEqual(EIGHT)
      expect(out.session.utterances).toHaveLength(76)
    }
  })
})
