/**
 * `progressAtStep` for EVERY step of both trees, plus the jump write the
 * native picker and the `qaStep` launch flag share.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentStepOf } from '../hub/hubCardModel'
import {
  DEVICE_ID_STORAGE_KEY,
  LETTER_SOUNDS_VOWELS,
  LITERACY_TREE,
  MATH_TREE,
  STORAGE_KEY,
  applyMasteryRule,
  defaultProgress,
  getOrCreateDeviceId,
  isFirstEncounter,
  isProgressV1,
  loadProgress,
  pickFocusNode,
  reconcileWithCloud,
  type MasteryTrack,
  type Progress,
  type SkillNode,
  type WordSongNode,
} from '../progress'
import {
  getKeyValueStore,
  setKeyValueStore,
  type KeyValueStore,
} from '../platform/keyValueStore'
import { setDayOffsetSource } from '../progress/clock'
import {
  SESSION_HISTORY_KEY,
  emptySessionHistory,
  readSessionHistory,
  writeSessionHistory,
} from '../sessionEnd/sessionHistory'
import {
  QA_STEPS,
  applyQaStep,
  isStepNode,
  jumpToRealStart,
  jumpToStep,
  progressAtStep,
} from './stepProgress'

const CASES: readonly [SkillNode, MasteryTrack][] = [
  ...MATH_TREE.map((n): [SkillNode, MasteryTrack] => [n, 'math']),
  ...LITERACY_TREE.map((n): [SkillNode, MasteryTrack] => [n, 'word-song']),
]

const otherWorld = (w: MasteryTrack): MasteryTrack =>
  w === 'math' ? 'word-song' : 'math'
const treeOf = (w: MasteryTrack): readonly SkillNode[] =>
  w === 'math' ? MATH_TREE : LITERACY_TREE

describe('the step list', () => {
  it('covers every step of both trees, once, in tree order (13 + 17)', () => {
    expect(CASES).toHaveLength(30)
    expect(QA_STEPS.map((s) => s.node)).toEqual([
      ...MATH_TREE,
      ...LITERACY_TREE,
    ])
    expect(QA_STEPS.filter((s) => s.world === 'math')).toHaveLength(13)
    expect(QA_STEPS.filter((s) => s.world === 'word-song')).toHaveLength(17)
  })

  it('gives each step a distinct readable name and its position', () => {
    expect(new Set(QA_STEPS.map((s) => s.name)).size).toBe(30)
    expect(QA_STEPS.find((s) => s.node === 'cvc-words-short-o')).toEqual({
      node: 'cvc-words-short-o',
      world: 'word-song',
      position: 5,
      name: 'Dog words',
      land: 3,
    })
    expect(QA_STEPS.find((s) => s.node === 'mult-6-9')).toMatchObject({
      position: 11,
      name: 'Big groups',
    })
    expect(QA_STEPS.find((s) => s.node === 'mult-mix')).toMatchObject({
      position: 12,
      name: 'All the groups',
      land: 4,
    })
    // Content wave 2 § 1: sharing, the 5th stop of land 4.
    expect(QA_STEPS.find((s) => s.node === 'div-share')).toMatchObject({
      position: 13,
      name: 'Sharing',
      land: 4,
    })
  })

  it('isStepNode accepts the 30 steps and nothing else', () => {
    expect(QA_STEPS.filter((s) => isStepNode(s.node))).toHaveLength(30)
    expect(
      ['', 'digraphs', 'two-digit-addsub', 'banana'].filter(isStepNode),
    ).toEqual([])
  })
})

describe.each(CASES)('progressAtStep(%s)', (node, world) => {
  const p = progressAtStep(node)
  const tree = treeOf(world)
  const at = tree.indexOf(node)

  it('is the current step of its world', () => {
    expect(currentStepOf(p, world)).toBe(node)
  })

  it('passes the strict progress guard, before and after a JSON round trip', () => {
    expect(isProgressV1(p)).toBe(true)
    expect(isProgressV1(JSON.parse(JSON.stringify(p)))).toBe(true)
  })

  it('is where the focus pick lands, at any session count', () => {
    for (const sessionCount of [0, 1, 5, 10]) {
      expect(pickFocusNode(p, world, sessionCount)).toEqual({
        node,
        mode: 'forward',
      })
    }
  })

  it('masters every earlier step, opens the step at intro, locks every later one', () => {
    expect(tree.map((n) => p.skillLevels[n])).toEqual(
      tree.map((_, i) => (i < at ? 'mastered' : i === at ? 'intro' : 'locked')),
    )
  })

  it("leaves the other world at Marian's defaults", () => {
    const other = otherWorld(world)
    const defaults = defaultProgress()
    expect(treeOf(other).map((n) => p.skillLevels[n])).toEqual(
      treeOf(other).map((n) => defaults.skillLevels[n]),
    )
    expect(currentStepOf(p, other)).toBe(currentStepOf(defaults, other))
  })

  it('masters the four letter-sounds vowels only past letter-sounds', () => {
    const past =
      world === 'word-song' && at > LITERACY_TREE.indexOf('letter-sounds')
    expect(
      LETTER_SOUNDS_VOWELS.map((v) => p.literacy?.letterSoundsVowelStates?.[v]),
    ).toEqual(LETTER_SOUNDS_VOWELS.map(() => (past ? 'mastered' : 'intro')))
  })

  it('has met the earlier Word Song steps, and not this one', () => {
    expect(p.lifetimeFirstEncounters).toEqual(
      world === 'word-song' ? LITERACY_TREE.slice(0, at) : [],
    )
    if (world === 'word-song') {
      expect(isFirstEncounter(p, node as WordSongNode)).toBe(true)
    }
  })

  it('starts the step fresh: no history, no good days, no pending unlock or promotion, latch unset', () => {
    expect(p.history).toEqual([])
    expect(p.goodDays).toEqual({})
    expect(p.unlocksCelebrated).toBeUndefined()
    expect(p.pendingPromotion).toBeUndefined()
    expect(p.cvcGraduationSessionFired).toBe(false)
  })

  it('is a fixed point of the mastery rule (nothing promotes before she plays)', () => {
    const after = applyMasteryRule(p)
    expect(after.skillLevels).toEqual(p.skillLevels)
    expect(after.literacy).toEqual(p.literacy)
    expect(after.pendingPromotion).toBeUndefined()
  })
})

describe('progressAtStep, invalid input', () => {
  it('throws for a name outside both trees', () => {
    expect(() => progressAtStep('digraphs' as SkillNode)).toThrow(
      "progressAtStep: 'digraphs' is not a step of either tree",
    )
  })
})

describe('the jump write', () => {
  const NOW = new Date('2026-10-13T09:30:00.000Z')
  /** An in-memory store recording every write's key, in order. */
  const map = new Map<string, string>()
  const writes: string[] = []
  const memory: KeyValueStore = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(k)
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
  let previous: KeyValueStore | null = null

  beforeEach(() => {
    previous = getKeyValueStore()
    setKeyValueStore(memory)
    map.clear()
    writes.length = 0
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
    setDayOffsetSource(null)
    setKeyValueStore(previous)
    vi.restoreAllMocks()
  })

  const progressWrites = () => writes.filter((k) => k === STORAGE_KEY).length

  it('jumpToStep: one progress write, loaded back on the step, stamped with the progress clock', () => {
    setDayOffsetSource(() => '2')
    jumpToStep('mult-6-9')
    expect(progressWrites()).toBe(1)
    const loaded = loadProgress()!
    expect(currentStepOf(loaded, 'math')).toBe('mult-6-9')
    expect(loaded.skillLevels).toEqual(progressAtStep('mult-6-9').skillLevels)
    expect(loaded.profile.lastPlayedISO).toBe('2026-10-15T09:30:00.000Z')
  })

  it('clears today from the session history, keeps the rest, and routes a fresh install to the Hub', () => {
    writeSessionHistory({
      ...emptySessionHistory(),
      sessionCount: 7,
      lastSessionCompletedAt: '2026-10-13T08:00:00.000Z',
      cumulativeStardust: 40,
      dayStreak: 3,
      todayTreesTouched: {
        date: '2026-10-13',
        trees: ['number-garden', 'word-song'],
      },
      lastSuggestion: 'word-song',
      consecutiveOverrides: 2,
      suggestionCooldownUntil: 123,
    })
    jumpToStep('simple-sentences')
    expect(readSessionHistory()).toEqual({
      ...emptySessionHistory(),
      sessionCount: 7,
      lastSessionCompletedAt: '2026-10-13T08:00:00.000Z',
      cumulativeStardust: 40,
      dayStreak: 3,
    })

    map.clear()
    jumpToStep('simple-sentences')
    expect(readSessionHistory().sessionCount).toBe(1)
  })

  it('never touches the device ID', () => {
    const id = getOrCreateDeviceId()
    writes.length = 0
    jumpToStep('cvc-words')
    jumpToRealStart()
    expect(writes).toEqual([
      STORAGE_KEY,
      SESSION_HISTORY_KEY,
      STORAGE_KEY,
      SESSION_HISTORY_KEY,
    ])
    expect(map.get(DEVICE_ID_STORAGE_KEY)).toBe(id)
  })

  it("jumpToRealStart writes Marian's defaults (stamped)", () => {
    jumpToStep('digraphs-ch')
    jumpToRealStart()
    const loaded = loadProgress()!
    expect(loaded.skillLevels).toEqual(defaultProgress().skillLevels)
    expect(currentStepOf(loaded, 'math')).toBe('add-to-10')
    expect(currentStepOf(loaded, 'word-song')).toBe('letter-sounds')
    expect(loaded.profile.lastPlayedISO).toBe(NOW.toISOString())
  })

  it('applyQaStep: a step is jumped to; an unknown name warns once and writes nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(applyQaStep('banana')).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('Unknown step: "banana"')
    expect(writes).toEqual([])

    expect(applyQaStep('sight-words')).toBe(true)
    expect(currentStepOf(loadProgress()!, 'word-song')).toBe('sight-words')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('with cloud sync on, the next reconcile pushes the jump over an older cloud blob (the stamp)', async () => {
    const deviceId = getOrCreateDeviceId()
    const cloudBlob = progressAtStep('add-to-20')
    const older = '2026-10-12T20:00:00.000Z'
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, blob: cloudBlob, lastModifiedISO: older }),
    })) as unknown as typeof fetch
    const pushImpl = vi.fn(async () => 'sent' as const)
    const install = vi.fn()

    jumpToStep('mult-6-9')
    const outcome = await reconcileWithCloud(deviceId, loadProgress(), {
      fetchImpl,
      authSecret: 's3cret',
      pushImpl,
      installLocally: install,
    })
    expect(outcome).toEqual({ kind: 'pushed-to-cloud' })
    expect(install).not.toHaveBeenCalled()
    expect(pushImpl).toHaveBeenCalledTimes(1)
    const [, pushed] = pushImpl.mock.calls[0]! as unknown as [string, Progress]
    expect(currentStepOf(pushed, 'math')).toBe('mult-6-9')
  })
})
