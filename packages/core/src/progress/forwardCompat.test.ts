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
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
