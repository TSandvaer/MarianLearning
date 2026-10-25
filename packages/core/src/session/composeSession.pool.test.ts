/**
 * The closed math pools on the device (no-Claude plan phase 5a,
 * `design/native/no-claude-sizing.md` § 2 "How a pool grows"): the app's
 * bundled canon text carries every step's pool (problems 9..N), and
 * - a canon session, review, peek, replay or warm-up copies only the served
 *   session (problems 1–8), as the server does;
 * - the picker draws a pool block only once all its lines have a bundled
 *   clip (`playablePoolText`), so an unrendered block is never served.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  mathCompositionViolations,
  parseAddToTenReadLine,
  parseMissingNumberReadLine,
  parseSubToTenReadLine,
} from '../math/compositionRules'
import { localDateKey } from '../progress/clock'
import { servedCanon } from '../wire/canonPool'
import {
  composeSession,
  playablePoolText,
  type CanonText,
  type CanonTextResolver,
  type LocalSession,
} from './composeSession'
import type { MathPickRequest } from './mathPicker'

const BUNDLE = JSON.parse(
  readFileSync('mobile/assets/canon/canon-text.json', 'utf8'),
) as Record<string, CanonText>
const raw: CanonTextResolver = (key) =>
  BUNDLE[`${key.track}/level-${key.level}/${key.focusNode}`] ?? null

/** The texts the app bundles a clip for: every canon line with audio
 *  (`mobile/scripts/export-audio.mjs`; `audioRegistry.test.ts` holds the
 *  registry to it). Since the 5a render every pool line is voiced.
 *  `servedTexts`: the texts the served sessions (problems 1–8) voice, which
 *  is all a build without the pools' render has a clip for. */
const voicedTexts = new Set<string>()
const servedTexts = new Set<string>()
const walk = (dir: string) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.json')) {
      const doc = JSON.parse(readFileSync(p, 'utf8')) as {
        utterances: { text: string; audio?: { base64?: string } }[]
      }
      for (const u of doc.utterances) {
        if (u.audio?.base64) voicedTexts.add(u.text)
      }
      for (const u of servedCanon(doc).utterances) {
        if (u.audio?.base64) servedTexts.add(u.text)
      }
    }
  }
}
walk('public/canon')
const hasClip = (text: string) => voicedTexts.has(text)

const playable: CanonTextResolver = (key) => {
  const entry = raw(key)
  return entry === null ? null : playablePoolText(entry, hasClip)
}
const allVoiced: CanonTextResolver = (key) => {
  const entry = raw(key)
  return entry === null ? null : playablePoolText(entry, () => true)
}
const servedOnly: CanonTextResolver = (key) => {
  const entry = raw(key)
  return entry === null
    ? null
    : playablePoolText(entry, (text) => servedTexts.has(text))
}

const NOW = new Date('2026-10-24T09:00:00.000Z').getTime()
const request = (
  step: 'add-to-10' | 'sub-to-10',
  seed: number,
  box: MathPickRequest['leitner'] = { items: [] },
): MathPickRequest => ({
  step,
  leitner: box,
  seen: {},
  previous: null,
  slow: [],
  warmup: [],
  nowMs: NOW,
  today: localDateKey(new Date(NOW)),
  seed,
})
const math = (focusNode: string, extra: Record<string, unknown> = {}) => ({
  track: 'math',
  level: 1,
  childName: 'friend',
  progress: { focusNode },
  ...extra,
})
const session = (out: ReturnType<typeof composeSession>): LocalSession => {
  if (out.kind !== 'local') throw new Error(JSON.stringify(out))
  return out.session
}
const problemsOf = (entry: CanonText) =>
  new Set(
    entry.utterances.flatMap((u) => {
      const m = /^math\.p(\d+)\./.exec(u.id)
      return m === null ? [] : [Number(m[1])]
    }),
  )
const pickedReads = (s: LocalSession) =>
  s.utterances.filter((u) => /^math\.p\d\.read$/.test(u.id)).map((u) => u.text)

describe('the bundled math pools (phase 5a)', () => {
  it('bundles every pool block of the 9 closed steps', () => {
    const sizes: Record<string, number> = {
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
    for (const [stem, n] of Object.entries(sizes)) {
      expect(problemsOf(BUNDLE[`math/level-1/${stem}`]!).size, stem).toBe(n)
    }
  })

  it("serves a step's canon session without its pool, as the server does", () => {
    for (const step of ['add-to-10', 'sub-to-20', 'mult-6-9']) {
      const entry = BUNDLE[`math/level-1/${step}`]!
      const s = session(composeSession(math(step), raw))
      expect(s).toEqual({
        plan: servedCanon(entry).plan,
        utterances: servedCanon(entry).utterances,
      })
      expect(problemsOf(s as CanonText)).toEqual(
        new Set([1, 2, 3, 4, 5, 6, 7, 8]),
      )
    }
  })

  it('replays the served 8, never a pool block', () => {
    const s = session(
      composeSession(math('add-to-10', { replay: { node: 'add-to-10' } }), raw),
    )
    expect(s.utterances.map((u) => u.text)).toEqual(
      servedCanon(BUNDLE['math/level-1/add-to-10']!)
        .utterances.filter((u) => /^math\.p\d\./.test(u.id))
        .map((u) => u.text),
    )
  })
})

describe('playablePoolText', () => {
  const entry: CanonText = {
    plan: {
      id: 'x',
      label: 'X',
      utterances: [
        { id: 'math.p1.read', text: 'old' },
        { id: 'math.p9.read', text: 'new' },
        { id: 'math.p10.read', text: 'old' },
        { id: 'session.end.opener', text: 'end' },
      ],
    },
    utterances: [
      { id: 'math.p1.read', text: 'old' },
      { id: 'math.p9.read', text: 'new' },
      { id: 'math.p9.correct', text: 'old' },
      { id: 'math.p10.read', text: 'old' },
      { id: 'session.end.opener', text: 'end' },
    ],
  }

  it('drops a pool block with any line lacking a clip, from the plan too', () => {
    const out = playablePoolText(entry, (t) => t !== 'new')
    expect(out.utterances.map((u) => u.id)).toEqual([
      'math.p1.read',
      'math.p10.read',
      'session.end.opener',
    ])
    expect(
      (out.plan as { utterances: { id: string }[] }).utterances.map(
        (u) => u.id,
      ),
    ).toEqual(['math.p1.read', 'math.p10.read', 'session.end.opener'])
  })

  it('never drops the served session, voiced or not', () => {
    const out = playablePoolText(entry, () => false)
    expect(out.utterances.map((u) => u.id)).toEqual([
      'math.p1.read',
      'session.end.opener',
    ])
  })

  it('keeps every block when every line has a clip (the same object)', () => {
    expect(playablePoolText(entry, () => true)).toBe(entry)
  })
})

describe('the picker never serves an unrendered pool block', () => {
  it('a build with no pool clip rendered: every pick plays only the served 8', () => {
    for (const step of ['add-to-10', 'sub-to-10'] as const) {
      const served = new Set(
        servedCanon(BUNDLE[`math/level-1/${step}`]!)
          .utterances.filter((u) => u.id.endsWith('.read'))
          .map((u) => u.text),
      )
      for (let seed = 0; seed < 40; seed++) {
        const s = session(
          composeSession(math(step, { seed }), servedOnly, {
            mathPick: request(step, seed),
          }),
        )
        const reads = pickedReads(s)
        expect(reads).toHaveLength(8)
        expect(reads.filter((r) => !served.has(r))).toEqual([])
        expect(s.utterances.filter((u) => !servedTexts.has(u.text))).toEqual([])
      }
    }
  }, 30_000)

  it('once a pool block is voiced (this bundle, after the 5a render), the picker can draw it', () => {
    // Every fact due in box 1: P4–P8 take the most overdue first, which the
    // served 8 cannot all be.
    const due = {
      items: Array.from({ length: 9 }, (_, i) => ({
        item: { a: 1 + i, b: 9 - i, op: '+' as const },
        box: 1 as const,
        lastSeen: NOW - (10 + i) * 86_400_000,
      })),
    }
    const s = session(
      composeSession(math('add-to-10'), playable, {
        mathPick: request('add-to-10', 0, due),
      }),
    )
    const served = new Set(
      servedCanon(BUNDLE['math/level-1/add-to-10']!)
        .utterances.filter((u) => u.id.endsWith('.read'))
        .map((u) => u.text),
    )
    expect(pickedReads(s).some((r) => !served.has(r))).toBe(true)
  })
})

describe('after the render: picks over the whole pool keep the composition rules', () => {
  const POOL_FACTS = (step: 'add-to-10' | 'sub-to-10') =>
    BUNDLE[`math/level-1/${step}`]!.utterances.filter((u) =>
      /^math\.p\d+\.read$/.test(u.id),
    ).length

  it('every fact due in box 1 gets a block of it into the session, and every session passes', () => {
    for (const step of ['add-to-10', 'sub-to-10'] as const) {
      const entry = playablePoolText(
        BUNDLE[`math/level-1/${step}`]!,
        () => true,
      )
      const reads = entry.utterances.filter((u) =>
        /^math\.p\d+\.read$/.test(u.id),
      )
      expect(reads).toHaveLength(POOL_FACTS(step))
      const unreached: string[] = []
      for (const read of reads) {
        const pick = composeSession(math(step), allVoiced, {
          mathPick: request(step, 0, {
            items: [
              {
                item: factOfRead(step, read.text),
                box: 1,
                lastSeen: NOW - 9 * 86_400_000,
              },
            ],
          }),
        })
        const s = session(pick)
        expect(mathCompositionViolations(step, s)).toEqual([])
        // A plain sum to ten and its bond (7+3, 7 + ? = 10) are one fact:
        // either block serves it.
        const fact = JSON.stringify(factOfRead(step, read.text))
        const played = pickedReads(s).map((r) =>
          JSON.stringify(factOfRead(step, r)),
        )
        if (!played.includes(fact)) unreached.push(read.text)
      }
      expect(unreached).toEqual([])
    }
  }, 30_000)
})

/** The Leitner fact of a read line (a missing number's is given + missing). */
function factOfRead(
  step: 'add-to-10' | 'sub-to-10',
  read: string,
): MathPickRequest['leitner']['items'][number]['item'] {
  const m = parseMissingNumberReadLine(read)
  if (m !== null) return { a: m.given, b: m.missing, op: '+' }
  const f =
    step === 'add-to-10'
      ? parseAddToTenReadLine(read)
      : parseSubToTenReadLine(read)
  if (f === null) throw new Error(`unparseable ${read}`)
  return { a: f.a, b: f.b, op: step === 'add-to-10' ? '+' : '-' }
}
