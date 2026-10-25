/**
 * The device's word order (Dave 2026-10-25, 5b ruling (6e) and "SHUFFLE
 * NOW"; Thomas, build 22: "every cat word session starts with 'read the
 * hat'"). Each word step plays 20 consecutive sessions from a seeded doc,
 * through the real session-end write: P1 never repeats back to back, the
 * order never repeats, no word keeps its slot, the bands hold, the chips
 * follow the slot, and a check keeps its probes at 2, 5 and 7.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultProgress,
  isProgressV1,
  loadProgress,
  saveProgress,
  type Progress,
  type SessionHistoryEntry,
  type SkillNode,
} from '../progress'
import { servedCanon } from '../wire/canonPool'
import { recordProgressOnSessionEnd } from '../sessionEnd/progressHistory'
import {
  GRADUATION_PROBE_PROBLEMS,
  withGraduationProbes,
} from './graduationCheck'
import { GRADUATION_PROBE_WORDS } from './novelProbeWords'
import {
  wordSongSessionPlanFromServer,
  type ServerPlan,
} from './planFromServer'
import { pickDistractors } from './wordDistractors'
import { TARGET_PAIRINGS } from './wordPack'
import type { WordSongProblem } from './wordSessionPlans'
import {
  lastWordOrder,
  orderWordSession,
  pickWordOrder,
  withWordOrder,
  WORD_ORDER_STEPS,
} from './wordOrder'

const canonPlan = (step: string): ServerPlan =>
  servedCanon(
    JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'public',
          'canon',
          'word-song',
          'level-1',
          `${step}.json`,
        ),
        'utf8',
      ),
    ),
  ).plan as ServerPlan

const problemsOf = (
  plan: unknown,
  step: SkillNode,
): readonly WordSongProblem[] =>
  wordSongSessionPlanFromServer(plan, {
    littleStories: true,
    blendReads: true,
    step,
  }).problems

const wordsOf = (plan: unknown, step: SkillNode) =>
  problemsOf(plan, step).map((p) => p.target.word)

const STEPS = [...WORD_ORDER_STEPS]
const SESSIONS = 20

// The bands, written out again here from Dave's ruling (6e) rather than
// read from the module under test.
const CVC = new Set([
  'blending-cv',
  'sounding-out',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
])
const CONTINUANT = new Set('fvsmnlrhwy'.split(''))
const DIGRAPH_HYBRIDS = new Set(['shoe', 'sheep', 'shark', 'thick', 'cloth'])
const DIGRAPHS = new Set([
  'digraphs-sh',
  'digraphs-ch',
  'digraphs-th-voiceless',
])

/** The band violations of `words` (played order) against `canon`. */
function bandViolations(
  step: string,
  words: readonly string[],
  canon: readonly string[],
): string[] {
  const out: string[] = []
  const gentle = words.slice(0, 3)
  if (CVC.has(step)) {
    for (const w of gentle) {
      if (!CONTINUANT.has(w[0]!)) out.push(`${w} (stop onset) in P1-P3`)
    }
  }
  if (DIGRAPHS.has(step)) {
    for (const w of gentle) {
      if (DIGRAPH_HYBRIDS.has(w)) out.push(`hybrid ${w} in P1-P3`)
    }
  }
  const sameSet = (from: number, to: number) =>
    [...words.slice(from, to)].sort().join() ===
    [...canon.slice(from, to)].sort().join()
  if (step === 'letter-names') {
    if (!sameSet(0, 3)) out.push('a letter left gentle P1-P3')
    if (!sameSet(3, 5)) out.push('a letter left P4-P5')
    if (!sameSet(5, 8)) out.push('a letter left trap P6-P8')
  }
  if (step === 'simple-sentences') {
    if (!sameSet(0, 3)) out.push('a sentence left gentle P1-P3')
  }
  if (step === 'sight-words') {
    for (const w of gentle) {
      if (!['the', 'a', 'go', 'see', 'can'].includes(w)) {
        out.push(`${w} (not a safe opener) in P1-P3`)
      }
    }
  }
  if (!sameSet(0, 8)) out.push('the 8 words changed')
  words.forEach((w, i) => {
    if (i > 0 && words[i - 1] === w) out.push(`${w} twice in a row`)
  })
  return out
}

/** Problems whose chips are not the target's pair for their slot's band.
 *  Letter names deal letters by position, not a band (`wordChips.ts`). */
function chipViolations(problems: readonly WordSongProblem[]): string[] {
  const out: string[] = []
  for (const p of problems) {
    if (p.contentType === 'letter-names') continue
    const row = p.chipRow ?? TARGET_PAIRINGS[p.target.word]!
    const expected = p.index <= 3 ? row.gentle : row.trap
    const [d1, d2] = pickDistractors(p.target, p.index, { row: p.chipRow })
    if (d1.word !== expected[0] || d2.word !== expected[1]) {
      out.push(`P${p.index} ${p.target.word}: ${d1.word} ${d2.word}`)
    }
  }
  return out
}

const dayISO = (day: number) =>
  new Date(Date.UTC(2026, 9, 1 + day, 17, 0, 0)).toISOString()

/** A doc whose last session of `step` predates the stored order. */
function seededDoc(step: SkillNode): Progress {
  const progress = defaultProgress(dayISO(0))
  const old: SessionHistoryEntry = {
    dateISO: dayISO(0),
    skillFocus: [step],
    successRate: 0.625,
  }
  return {
    ...progress,
    skillLevels: { ...progress.skillLevels, [step]: 'practicing' },
    history: [old],
  }
}

describe('wordOrder: 20 consecutive sessions per word step', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it.each(STEPS)('%s', (step) => {
    const canon = canonPlan(step)
    const canonWords = wordsOf(canon, step)
    saveProgress(seededDoc(step))
    // The doc's only session of the step played the canon order.
    let previous: readonly string[] = canonWords
    const seen = new Set<string>()
    for (let s = 1; s <= SESSIONS; s++) {
      const progress = loadProgress()!
      const last = lastWordOrder(progress, step)
      expect(last).toEqual(s === 1 ? 'canon' : previous)
      // The session count as the seed (math sessions in between skip some).
      const seed = 40 + s * 2 + (s % 3)
      const plan = orderWordSession(canon, step, { seed, last })
      const problems = problemsOf(plan, step)
      const words = problems.map((p) => p.target.word)

      expect(words[0], `session ${s} P1`).not.toBe(previous[0])
      expect(words.join(' '), `session ${s} order`).not.toBe(previous.join(' '))
      expect(
        words.filter((w, i) => w === previous[i]),
        `session ${s}: words kept their slot`,
      ).toEqual([])
      expect(bandViolations(step, words, canonWords)).toEqual([])
      expect(chipViolations(problems)).toEqual([])
      seen.add(words[0]!)

      recordProgressOnSessionEnd({
        surface: 'word-song',
        totalCorrect: 5,
        dateISO: dayISO(s),
        focusNode: step,
        targetWords: words,
      })
      previous = words
    }
    // The first word varies across the sessions, not just between two.
    expect(seen.size).toBeGreaterThanOrEqual(3)
  })
})

describe('wordOrder: a check keeps its shape', () => {
  const PROBE = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'public',
        'canon',
        'word-song',
        'level-1',
        'cvc-words-probe.json',
      ),
      'utf8',
    ),
  ).plan as ServerPlan

  it('probes stay at problems 2, 5 and 7 and never at P1, over 20 sessions', () => {
    const canon = canonPlan('cvc-words')
    let last: readonly string[] | 'canon' = 'canon'
    for (let s = 1; s <= SESSIONS; s++) {
      const ordered = orderWordSession(canon, 'cvc-words', { seed: s, last })
      const probes = [...GRADUATION_PROBE_WORDS].slice(s % 3, (s % 3) + 3)
      const check = withGraduationProbes(ordered, PROBE, probes)
      expect(check, `session ${s}`).not.toBeNull()
      const problems = problemsOf(check, 'cvc-words')
      const words = problems.map((p) => p.target.word)
      expect(
        GRADUATION_PROBE_PROBLEMS.map((n) => words[n - 1]),
        `session ${s}`,
      ).toEqual(probes)
      expect(GRADUATION_PROBE_WORDS).not.toContain(words[0])
      // The practised words keep the ordered session's slots.
      const plain = wordsOf(ordered, 'cvc-words')
      words.forEach((w, i) => {
        if (!GRADUATION_PROBE_PROBLEMS.includes(i + 1)) {
          expect(w).toBe(plain[i])
        }
      })
      expect(chipViolations(problems)).toEqual([])
      last = words
    }
  })
})

describe('wordOrder: the first session and old docs', () => {
  it('a first session plays the canon order when it meets the bands', () => {
    const plan = canonPlan('sounding-out')
    const ordered = orderWordSession(plan, 'sounding-out', {
      seed: 7,
      last: null,
    })
    // Sounding out opens on two words met in blending sounds (Dave (6d)).
    expect(wordsOf(ordered, 'sounding-out').slice(0, 2)).toEqual(['fan', 'man'])
    expect(ordered).toBe(plan)
  })

  it('a first sh session moves the canon hybrid out of P3', () => {
    const plan = canonPlan('digraphs-sh')
    expect(wordsOf(plan, 'digraphs-sh')[2]).toBe('shoe')
    const words = wordsOf(
      orderWordSession(plan, 'digraphs-sh', { seed: 7, last: null }),
      'digraphs-sh',
    )
    expect(
      bandViolations('digraphs-sh', words, wordsOf(plan, 'digraphs-sh')),
    ).toEqual([])
  })

  it('reads the latest entry of the step; an entry without the order is the canon', () => {
    const base = defaultProgress(dayISO(0))
    const entry = (
      day: number,
      step: SkillNode,
      targetWords?: string[],
    ): SessionHistoryEntry => ({
      dateISO: dayISO(day),
      skillFocus: [step],
      successRate: 0.5,
      ...(targetWords !== undefined ? { targetWords } : {}),
    })
    expect(lastWordOrder(base, 'cvc-words')).toBeNull()
    expect(
      lastWordOrder(
        { history: [entry(1, 'cvc-words'), entry(2, 'add-to-10')] },
        'cvc-words',
      ),
    ).toBe('canon')
    expect(
      lastWordOrder(
        {
          history: [
            entry(3, 'cvc-words', ['fan']),
            entry(1, 'cvc-words', ['hat']),
          ],
        },
        'cvc-words',
      ),
    ).toEqual(['fan'])
  })

  it('a doc with or without the stored order loads; a malformed one does not', () => {
    const base = defaultProgress(dayISO(0))
    const withEntry = (extra: Record<string, unknown>) => ({
      ...base,
      history: [
        {
          dateISO: dayISO(1),
          skillFocus: ['cvc-words'],
          successRate: 0.875,
          ...extra,
        },
      ],
    })
    expect(isProgressV1(withEntry({}))).toBe(true)
    expect(isProgressV1(withEntry({ targetWords: ['fan', 'hat'] }))).toBe(true)
    expect(isProgressV1(withEntry({ targetWords: 'fan' }))).toBe(false)
    expect(isProgressV1(withEntry({ targetWords: ['fan', 3] }))).toBe(false)
  })
})

describe('pickWordOrder / withWordOrder', () => {
  const entries = (words: string) => words.split(' ').map((word) => ({ word }))

  it('keeps an sh-final word out of P1-P3', () => {
    const e = entries('ship shell fish shed dish shop shoe sheep')
    for (let seed = 0; seed < 30; seed++) {
      const order = pickWordOrder('digraphs-sh', e, null, seed)!
      const gentle = order.slice(0, 3).map((c) => e[c]!.word)
      expect(gentle).not.toContain('fish')
      expect(gentle).not.toContain('dish')
    }
  })

  it('is deterministic on the seed', () => {
    const e = entries('hat fan man van cat bag pan tag')
    const last = e.map((x) => x.word)
    expect(pickWordOrder('cvc-words', e, last, 12)).toEqual(
      pickWordOrder('cvc-words', e, last, 12),
    )
  })

  it('renames each block to its new slot and keeps every other line', () => {
    const plan: ServerPlan = {
      id: 'x',
      label: 'X',
      utterances: [
        { id: 'word.p1.read', text: 'Read the hat.' },
        { id: 'word.p1.correct', text: "Yes! That's a hat." },
        { id: 'word.p2.read', text: 'Read the fan.' },
        { id: 'word.p2.correct', text: "Yes! That's a fan." },
        { id: 'session.end.opener', text: 'You did it!' },
      ],
    }
    expect(withWordOrder(plan, [1, 0]).utterances).toEqual([
      { id: 'word.p1.read', text: 'Read the fan.' },
      { id: 'word.p1.correct', text: "Yes! That's a fan." },
      { id: 'word.p2.read', text: 'Read the hat.' },
      { id: 'word.p2.correct', text: "Yes! That's a hat." },
      { id: 'session.end.opener', text: 'You did it!' },
    ])
  })

  it('leaves a step it does not order, and an unreadable plan, as they are', () => {
    const plan = canonPlan('letter-sounds')
    expect(
      orderWordSession(plan, 'letter-sounds', { seed: 1, last: 'canon' }),
    ).toBe(plan)
    const bad = { id: 'x', label: 'X', utterances: [] }
    expect(orderWordSession(bad, 'cvc-words', { seed: 1, last: 'canon' })).toBe(
      bad,
    )
  })
})
