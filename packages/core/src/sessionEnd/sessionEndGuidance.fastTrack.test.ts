/**
 * Session End on the fast-track day (native spec
 * `design/native/fast-track-native.md` § 4.1, acceptance criteria 7 and 8):
 * the docs come from the real session-end write, so the tray is the one the
 * mastery rule and `nodeProgress` produce.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../progress/cloudSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../progress/cloudSync')>()),
  pushProgressToCloud: vi.fn(() => Promise.resolve('skipped')),
}))

import { progressAtStep } from '../debug/stepProgress'
import { DEFAULT_PARENT_SETTINGS } from '../progress/parentSettings'
import { sessionEndBeat } from '../progress/pathBeats'
import { loadProgress, saveProgress } from '../progress/storage'
import type { Progress, SkillNode } from '../progress/types'
import { recordProgressOnSessionEnd } from './progressHistory'
import { sessionEndGuidance } from './sessionEndGuidance'

const ALL = Array<boolean>(8).fill(true)
const SEVEN = [false, ...Array<boolean>(7).fill(true)]
const on = (day: number) => new Date(2026, 9, day, 10).toISOString()

function end(node: SkillNode, day: number, firstTap: readonly boolean[]) {
  const before = loadProgress()!
  const after = recordProgressOnSessionEnd({
    surface:
      node.startsWith('add') || node.startsWith('mult') ? 'math' : 'word-song',
    totalCorrect: firstTap.filter(Boolean).length,
    dateISO: on(day),
    focusNode: node,
    firstTapCorrect: firstTap,
  })
  const totalCorrect = firstTap.filter(Boolean).length
  return sessionEndGuidance({
    before,
    after,
    node,
    beat: sessionEndBeat(before, after, node),
    totalCorrect,
    today: `2026-10-${day}`,
    nudgeSaidToday: false,
  })
}

const ids = (g: ReturnType<typeof end>) => g.lines.map((l) => l.id)

beforeEach(() => window.localStorage.clear())
afterEach(() => window.localStorage.clear())

describe('AC7 the fast-track Tuesday', () => {
  it('today’s flower lands in slot 1, slot 2 grows as the bonus; the unlock lines', () => {
    saveProgress(progressAtStep('add-to-10'))
    const mon = end('add-to-10', 12, ALL)
    expect(mon.countText).toBe('1 of 3')
    expect(mon.bonusSlots).toEqual([])
    const g = end('add-to-10', 13, ALL)
    expect(g.day).toBe('unlock')
    expect(g.newSlot).toBe(1)
    expect(g.bonusSlots).toEqual([2])
    expect(g.slotsBefore).toEqual(['grown', 'empty', 'empty'])
    expect(g.slotsAfter).toEqual(['grown', 'grown', 'grown'])
    expect(g.countText).toBe('3 of 3!')
    expect(ids(g)).toEqual([
      'guide.end.right.8',
      'guide.end.fast-track',
      'guide.end.count.3',
      'guide.end.path-opens',
    ])
    expect(g.lines[1]!.text).toBe('You know this! All your flowers grew!')
    expect(g.lines[1]!.beat).toBe('flower')
  })

  it('a normal 2nd good day is unchanged: no bonus, "You got a flower!", sleeps', () => {
    saveProgress(progressAtStep('add-to-10'))
    end('add-to-10', 12, ALL)
    const g = end('add-to-10', 13, SEVEN)
    expect(g.day).toBe('good-day')
    expect(g.newSlot).toBe(1)
    expect(g.bonusSlots).toEqual([])
    expect(g.slotsAfter).toEqual(['grown', 'sleeping', 'empty'])
    expect(ids(g)).toEqual([
      'guide.end.right.7',
      'guide.end.flower',
      'guide.end.count.2',
      'guide.end.sleeps',
    ])
  })

  it('a world’s last step: world-done', () => {
    saveProgress(progressAtStep('mult-mix'))
    end('mult-mix', 12, ALL)
    const g = end('mult-mix', 13, ALL)
    expect(g.day).toBe('world-done')
    expect(g.bonusSlots).toEqual([2])
    expect(ids(g)).toEqual([
      'guide.end.right.8',
      'guide.end.fast-track',
      'guide.end.count.3',
      'guide.end.world-done',
    ])
  })

  it('cvc-words before its check: good-day, full row, nothing sleeps', () => {
    saveProgress(progressAtStep('cvc-words'))
    end('cvc-words', 12, ALL)
    const g = end('cvc-words', 13, ALL)
    expect(g.day).toBe('good-day')
    expect(g.bonusSlots).toEqual([2])
    expect(g.slotsAfter).toEqual(['grown', 'grown', 'grown'])
    expect(ids(g)).toEqual([
      'guide.end.right.8',
      'guide.end.fast-track',
      'guide.end.count.3',
    ])
  })

  it('autoPromote off: good-day with the full row', () => {
    const p: Progress = {
      ...progressAtStep('add-to-10'),
      parentSettings: { ...DEFAULT_PARENT_SETTINGS, autoPromote: false },
    }
    saveProgress(p)
    end('add-to-10', 12, ALL)
    const g = end('add-to-10', 13, ALL)
    expect(g.day).toBe('good-day')
    expect(g.bonusSlots).toEqual([2])
    expect(g.slotsAfter).toEqual(['grown', 'grown', 'grown'])
  })
})

describe('AC8 80% / 2', () => {
  it('2 secure days master through the normal rule, with no bonus', () => {
    const preset = { percent: 0.8, sessions: 2 }
    saveProgress({
      ...progressAtStep('add-to-10'),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: { math: preset, 'word-song': preset },
      },
    })
    end('add-to-10', 12, ALL)
    const g = end('add-to-10', 13, ALL)
    expect(g.day).toBe('unlock')
    expect(g.newSlot).toBe(1)
    expect(g.bonusSlots).toEqual([])
    expect(ids(g)).toContain('guide.end.flower')
  })
})
