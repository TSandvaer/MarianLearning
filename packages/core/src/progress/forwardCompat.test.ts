/**
 * Forward compatibility of the persisted Progress doc.
 *
 * Wave 1 adds new steps (SkillNodes). A doc written by a build that knows
 * a step must load on a build that does not, because Thomas's iPad and
 * iPhone can run different builds while the cloud copy is shared. The
 * step names below are deliberately NOT in this build's `SkillNode`
 * union: they stand for "a step a newer build knows".
 *
 * Contract pinned here:
 *  - one unknown step never rejects the whole doc (local load or cloud
 *    install);
 *  - unknown steps are kept where they are inert (skill levels, history,
 *    first encounters, day counters, step lists), so a load + save on this
 *    build hands them back to the newer build intact;
 *  - an unknown `pendingPromotion` is dropped: this build cannot show or
 *    confirm a step it does not know, and the newer build re-queues it;
 *  - real corruption (a non-string where a step name belongs) still
 *    rejects.
 *
 * Content wave 3 (`design/native/content-wave-3.md` § 2, G) adds the
 * same for recorded answers: hundreds records answers such as 234, so a
 * `perProblemAnswerValue` entry is any whole number from 0 up, while the
 * `mathFacts` bounds stay 0..99.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordProgressOnSessionEnd } from '../sessionEnd/progressHistory'
import { reconcileWithCloud, type ReconcileOutcome } from './cloudSync'
import { defaultProgress } from './defaults'
import { pickFocusNode } from './focusNode'
import { isProgressV1 } from './guards'
import { applyMasteryRule } from './mastery'
import { STORAGE_KEY, loadProgress, saveProgress } from './storage'
import type { Progress } from './types'

const VALID_UUID = '11111111-2222-4333-8444-555555555555'
const SECRET = 'test-secret'

/** Steps a newer build knows and this one does not. */
const FUTURE_MATH_STEP = 'times-mix'
const FUTURE_WORD_STEP = 'duck-words'
const FUTURE_WORD_STEP_2 = 'frog-words'

type Doc = Record<string, unknown>

/** A doc as a newer build would write it after Marian played its steps. */
function futureDoc(): Doc {
  const seed = defaultProgress('Marian')
  return {
    ...seed,
    profile: { ...seed.profile, lastPlayedISO: '2026-10-15T09:00:00.000Z' },
    skillLevels: {
      ...seed.skillLevels,
      [FUTURE_MATH_STEP]: 'practicing',
      [FUTURE_WORD_STEP]: 'intro',
      [FUTURE_WORD_STEP_2]: 'locked',
    },
    history: [
      {
        dateISO: '2026-10-14T09:00:00.000Z',
        skillFocus: ['add-to-10'],
        successRate: 0.875,
      },
      {
        dateISO: '2026-10-15T09:00:00.000Z',
        skillFocus: [FUTURE_MATH_STEP],
        successRate: 1,
      },
    ],
    lifetimeFirstEncounters: ['cvc-words', FUTURE_WORD_STEP],
    pendingPromotion: FUTURE_MATH_STEP,
    goodDays: { [FUTURE_MATH_STEP]: ['2026-10-15'] },
    secureDays: { [FUTURE_MATH_STEP]: ['2026-10-15'] },
    paceHold: [FUTURE_WORD_STEP],
    unlocksCelebrated: [FUTURE_MATH_STEP],
  }
}

function store(doc: Doc): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
}

function storedRaw(): Doc {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) throw new Error('nothing stored')
  return JSON.parse(raw) as Doc
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('loadProgress — doc from a build that knows more steps', () => {
  it('loads the doc instead of rejecting it', () => {
    store(futureDoc())
    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(isProgressV1(loaded)).toBe(true)
    // Known state is intact, not reset to defaults.
    expect(loaded!.profile.lastPlayedISO).toBe('2026-10-15T09:00:00.000Z')
    expect(loaded!.history).toHaveLength(2)
  })

  // Each field on its own, so a regression names the field.
  it.each([
    [
      'history[].skillFocus',
      (d: Doc) => ({
        ...d,
        history: [
          {
            dateISO: '2026-10-15T09:00:00.000Z',
            skillFocus: [FUTURE_MATH_STEP],
            successRate: 1,
          },
        ],
      }),
    ],
    [
      'lifetimeFirstEncounters',
      (d: Doc) => ({ ...d, lifetimeFirstEncounters: [FUTURE_WORD_STEP] }),
    ],
    [
      'pendingPromotion',
      (d: Doc) => ({ ...d, pendingPromotion: FUTURE_WORD_STEP }),
    ],
    [
      'skillLevels key',
      (d: Doc) => ({
        ...d,
        skillLevels: {
          ...(d.skillLevels as Doc),
          [FUTURE_WORD_STEP]: 'practicing',
        },
      }),
    ],
    [
      'goodDays / secureDays keys',
      (d: Doc) => ({
        ...d,
        goodDays: { [FUTURE_WORD_STEP]: ['2026-10-15'] },
        secureDays: { [FUTURE_WORD_STEP]: ['2026-10-15'] },
      }),
    ],
    [
      'paceHold / unlocksCelebrated',
      (d: Doc) => ({
        ...d,
        paceHold: [FUTURE_WORD_STEP],
        unlocksCelebrated: [FUTURE_WORD_STEP],
      }),
    ],
  ])('one unknown step in %s does not reject the doc', (_field, mutate) => {
    store(mutate(defaultProgress('Marian') as unknown as Doc))
    expect(loadProgress()).not.toBeNull()
  })

  it('keeps the inert unknown steps, so load + save hands them back intact', () => {
    store(futureDoc())
    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    saveProgress(loaded!)

    const saved = storedRaw()
    const levels = saved.skillLevels as Doc
    expect(levels[FUTURE_MATH_STEP]).toBe('practicing')
    expect(levels[FUTURE_WORD_STEP]).toBe('intro')
    expect(levels[FUTURE_WORD_STEP_2]).toBe('locked')
    expect(
      (saved.history as { skillFocus: string[] }[]).map((h) => h.skillFocus),
    ).toEqual([['add-to-10'], [FUTURE_MATH_STEP]])
    expect(saved.lifetimeFirstEncounters).toEqual([
      'cvc-words',
      FUTURE_WORD_STEP,
    ])
    expect((saved.goodDays as Doc)[FUTURE_MATH_STEP]).toEqual(['2026-10-15'])
    expect((saved.secureDays as Doc)[FUTURE_MATH_STEP]).toEqual(['2026-10-15'])
    expect(saved.paceHold).toEqual([FUTURE_WORD_STEP])
    expect(saved.unlocksCelebrated).toEqual([FUTURE_MATH_STEP])
  })

  it('drops an unknown pendingPromotion (this build cannot show or confirm it)', () => {
    store(futureDoc())
    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded!.pendingPromotion).toBeUndefined()
    expect('pendingPromotion' in loaded!).toBe(false)
  })

  it('keeps a known pendingPromotion', () => {
    store({ ...futureDoc(), pendingPromotion: 'add-to-10' })
    expect(loadProgress()!.pendingPromotion).toBe('add-to-10')
  })

  it.each([
    [
      'a non-string skillFocus entry',
      (d: Doc) => ({
        ...d,
        history: [
          {
            dateISO: '2026-10-15T09:00:00.000Z',
            skillFocus: [42],
            successRate: 1,
          },
        ],
      }),
    ],
    [
      'a non-string pendingPromotion',
      (d: Doc) => ({ ...d, pendingPromotion: 7 }),
    ],
    [
      'a non-string lifetimeFirstEncounters entry',
      (d: Doc) => ({ ...d, lifetimeFirstEncounters: [null] }),
    ],
  ])('still rejects %s (real corruption)', (_what, mutate) => {
    store(mutate(defaultProgress('Marian') as unknown as Doc))
    expect(loadProgress()).toBeNull()
  })

  it('the engine runs on the loaded doc without touching the unknown steps', () => {
    store(futureDoc())
    const loaded = loadProgress()!
    const promoted = applyMasteryRule(loaded)
    const levels = promoted.skillLevels as unknown as Doc
    expect(levels[FUTURE_MATH_STEP]).toBe('practicing')
    expect(levels[FUTURE_WORD_STEP]).toBe('intro')
    // The focus picker walks only the steps this build knows.
    expect(pickFocusNode(loaded, 'math').node).not.toBe(FUTURE_MATH_STEP)
    expect(pickFocusNode(loaded, 'word-song').node).not.toBe(FUTURE_WORD_STEP)
  })
})

describe('reconcileWithCloud — cloud doc from a build that knows more steps', () => {
  function fetchReturning(blob: unknown, lastModifiedISO: string) {
    return vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, blob, lastModifiedISO }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as unknown as typeof fetch
  }

  async function installFutureDoc(): Promise<{
    outcome: ReconcileOutcome
    installed: Progress[]
  }> {
    const local: Progress = {
      ...defaultProgress('Marian'),
      profile: {
        ...defaultProgress('Marian').profile,
        lastPlayedISO: '2026-10-14T09:00:00.000Z',
      },
    }
    const installed: Progress[] = []
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: fetchReturning(futureDoc(), '2026-10-15T09:00:00.000Z'),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl: vi.fn(async () => 'sent' as const),
    })
    return { outcome, installed }
  }

  it('installs the newer cloud doc instead of rejecting it', async () => {
    const { outcome, installed } = await installFutureDoc()
    expect(outcome.kind).toBe('installed-from-cloud')
    expect(installed).toHaveLength(1)
    expect(isProgressV1(installed[0]!)).toBe(true)
  })

  it('keeps the inert unknown steps and drops the unknown pendingPromotion, as a local load does', async () => {
    const { installed } = await installFutureDoc()
    const doc = installed[0]!
    const levels = doc.skillLevels as unknown as Doc
    expect(levels[FUTURE_MATH_STEP]).toBe('practicing')
    expect(doc.history.map((h) => h.skillFocus as string[])).toEqual([
      ['add-to-10'],
      [FUTURE_MATH_STEP],
    ])
    expect(doc.lifetimeFirstEncounters).toEqual(['cvc-words', FUTURE_WORD_STEP])
    expect(doc.pendingPromotion).toBeUndefined()

    store(futureDoc())
    const loaded = loadProgress()!
    expect(doc.skillLevels).toEqual(loaded.skillLevels)
    expect(doc.lifetimeFirstEncounters).toEqual(loaded.lifetimeFirstEncounters)
    expect(doc.pendingPromotion).toEqual(loaded.pendingPromotion)
  })
})

describe('recorded answers above 99 (content wave 3, G)', () => {
  /** A hundreds session as a newer build records it: 3-digit answers, a
   *  `null` where no chip was tapped, and 1000 for step 15. */
  const WIDE_ANSWERS = [234, null, 999, 1000, 362, 0, 99, 100]
  const OLD_ANSWERS = [3, 5, null, 7, 9, 10, 8, 6]

  /** A doc a hundreds build wrote: an older entry in 0..99 plus a
   *  hundreds entry (a step this build does not know). */
  function wideDoc(): Doc {
    const seed = defaultProgress('Marian')
    return {
      ...seed,
      profile: { ...seed.profile, lastPlayedISO: '2026-10-15T09:00:00.000Z' },
      history: [
        {
          dateISO: '2026-10-14T09:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.875,
          mathFacts: [{ a: 4, b: 3, op: '+' }],
          perProblemAnswerValue: OLD_ANSWERS,
        },
        {
          dateISO: '2026-10-15T09:00:00.000Z',
          skillFocus: ['hundreds'],
          successRate: 1,
          perProblemAnswerValue: WIDE_ANSWERS,
        },
      ],
    }
  }

  function answersOn(
    history: readonly { dateISO: string; perProblemAnswerValue?: unknown }[],
    dateISO: string,
  ): unknown {
    return history.find((h) => h.dateISO === dateISO)?.perProblemAnswerValue
  }

  function withAnswers(values: unknown[]): Doc {
    return {
      ...defaultProgress('Marian'),
      history: [
        {
          dateISO: '2026-10-15T09:00:00.000Z',
          skillFocus: ['hundreds'],
          successRate: 1,
          perProblemAnswerValue: values,
        },
      ],
    }
  }

  function withFact(fact: unknown): Doc {
    return {
      ...defaultProgress('Marian'),
      history: [
        {
          dateISO: '2026-10-15T09:00:00.000Z',
          skillFocus: ['add-to-20'],
          successRate: 1,
          mathFacts: [fact],
        },
      ],
    }
  }

  describe('local load and save', () => {
    it('loads a doc whose answers go above 99', () => {
      store(wideDoc())
      const loaded = loadProgress()
      expect(loaded).not.toBeNull()
      expect(isProgressV1(loaded)).toBe(true)
      expect(loaded!.profile.lastPlayedISO).toBe('2026-10-15T09:00:00.000Z')
      expect(answersOn(loaded!.history, '2026-10-15T09:00:00.000Z')).toEqual(
        WIDE_ANSWERS,
      )
    })

    it('a 362 survives load + save unchanged', () => {
      store(wideDoc())
      const loaded = loadProgress()
      expect(loaded).not.toBeNull()
      saveProgress(loaded!)

      const saved = storedRaw()
      expect(saved.history).toEqual(wideDoc().history)
      const answers = answersOn(
        saved.history as { dateISO: string }[],
        '2026-10-15T09:00:00.000Z',
      ) as number[]
      expect(answers.filter((n) => n === 362)).toEqual([362])
    })

    it('a session end on this build keeps the 3-digit answers (no fresh start, no rollback)', () => {
      store(wideDoc())
      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 8,
        dateISO: '2026-10-16T09:00:00.000Z',
        focusNode: 'add-to-10',
        perProblemAnswerValue: [3, 4, 5, 6, 7, 8, 9, 10],
      })
      const after = loadProgress()
      expect(after).not.toBeNull()
      expect(after!.history.map((h) => h.dateISO)).toEqual([
        '2026-10-14T09:00:00.000Z',
        '2026-10-15T09:00:00.000Z',
        '2026-10-16T09:00:00.000Z',
      ])
      expect(answersOn(after!.history, '2026-10-15T09:00:00.000Z')).toEqual(
        WIDE_ANSWERS,
      )
    })

    it('an old doc (answers in 0..99, or none) loads and saves back unchanged', () => {
      const old: Doc = {
        ...wideDoc(),
        history: [
          (wideDoc().history as Doc[])[0]!,
          {
            dateISO: '2026-10-15T09:00:00.000Z',
            skillFocus: ['cvc-words'],
            successRate: 0.75,
          },
        ],
      }
      store(old)
      const loaded = loadProgress()
      expect(loaded).not.toBeNull()
      saveProgress(loaded!)
      expect(storedRaw()).toEqual(old)
    })
  })

  describe('the guard', () => {
    it.each([
      ['-1', -1],
      ['2.5', 2.5],
      ["'7'", '7'],
      ['NaN', NaN],
      ['Infinity', Infinity],
      ['2^53 (not a safe integer)', 2 ** 53],
    ])('still rejects an answer of %s', (_what, bad) => {
      expect(isProgressV1(withAnswers([234, bad]))).toBe(false)
    })

    it.each([
      ['a: 100', { a: 100, b: 2, op: '+' }],
      ['b: 100', { a: 3, b: 100, op: '-' }],
      ['a: -1', { a: -1, b: 2, op: '+' }],
      ['a: 2.5', { a: 2.5, b: 2, op: '*' }],
    ])('mathFacts keep 0..99: still rejects %s', (_what, fact) => {
      expect(isProgressV1(withFact(fact))).toBe(false)
    })

    it('mathFacts at 99 still pass', () => {
      expect(isProgressV1(withFact({ a: 99, b: 99, op: '-' }))).toBe(true)
    })
  })

  describe('cloud sync', () => {
    function fetchReturning(blob: unknown, lastModifiedISO: string) {
      return vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: true, blob, lastModifiedISO }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ) as unknown as typeof fetch
    }

    it('installs a newer cloud doc with 3-digit answers and merges local ones', async () => {
      const local: Progress = {
        ...defaultProgress('Marian'),
        profile: {
          ...defaultProgress('Marian').profile,
          lastPlayedISO: '2026-10-13T09:00:00.000Z',
        },
        history: [
          {
            dateISO: '2026-10-13T09:00:00.000Z',
            skillFocus: [
              'hundreds',
            ] as unknown as Progress['history'][number]['skillFocus'],
            successRate: 1,
            perProblemAnswerValue: [512, 362],
          },
        ],
      }
      const installed: Progress[] = []
      const outcome = await reconcileWithCloud(VALID_UUID, local, {
        fetchImpl: fetchReturning(wideDoc(), '2026-10-15T09:00:00.000Z'),
        authSecret: SECRET,
        installLocally: (p) => installed.push(p),
        pushImpl: vi.fn(async () => 'sent' as const),
      })
      expect(outcome.kind).toBe('installed-from-cloud')
      expect(installed).toHaveLength(1)
      const doc = installed[0]!
      expect(isProgressV1(doc)).toBe(true)
      expect(answersOn(doc.history, '2026-10-13T09:00:00.000Z')).toEqual([
        512, 362,
      ])
      expect(answersOn(doc.history, '2026-10-15T09:00:00.000Z')).toEqual(
        WIDE_ANSWERS,
      )
    })

    it('a loaded doc with 3-digit answers is pushed as is when it is newer', async () => {
      store(wideDoc())
      const local = loadProgress()
      expect(local).not.toBeNull()
      const pushImpl = vi.fn(async () => 'sent' as const)
      const outcome = await reconcileWithCloud(VALID_UUID, local, {
        fetchImpl: fetchReturning(
          defaultProgress('Marian'),
          '2026-10-14T09:00:00.000Z',
        ),
        authSecret: SECRET,
        installLocally: vi.fn(),
        pushImpl,
      })
      expect(outcome.kind).toBe('pushed-to-cloud')
      expect(pushImpl).toHaveBeenCalledTimes(1)
      const pushed = (pushImpl.mock.calls[0] as unknown[])[1] as Progress
      expect(answersOn(pushed.history, '2026-10-15T09:00:00.000Z')).toEqual(
        WIDE_ANSWERS,
      )
    })
  })
})
