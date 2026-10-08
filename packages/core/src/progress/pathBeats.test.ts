import { describe, expect, it } from 'vitest'
import { defaultProgress } from './defaults'
import { isProgressV1 } from './guards'
import {
  markUnlockCelebrated,
  mergeUnlocksCelebrated,
  pendingUnlock,
  seedUnlocksCelebrated,
  sessionEndBeat,
} from './pathBeats'
import type { Progress } from './types'

/** Diagnostic baseline with the marker seeded (nothing pending). */
function seeded(): Progress {
  const p = defaultProgress()
  return { ...p, unlocksCelebrated: seedUnlocksCelebrated(p) }
}

function withLevels(p: Progress, levels: Partial<Progress['skillLevels']>) {
  return { ...p, skillLevels: { ...p.skillLevels, ...levels } }
}

const goodDay = (node: string, day: number) => ({
  dateISO: new Date(2026, 9, day, 18, 0).toISOString(),
  skillFocus: [node] as Progress['history'][number]['skillFocus'],
  successRate: 1,
})

describe('unlock seen-marker (Emma’s Path 9/10)', () => {
  it('absent marker → nothing pending, whatever is open (pre-marker blobs never replay)', () => {
    const p = withLevels(defaultProgress(), { 'add-to-20': 'intro' })
    expect(p.unlocksCelebrated).toBeUndefined()
    expect(pendingUnlock(p, 'math')).toBeNull()
    expect(pendingUnlock(p, 'word-song')).toBeNull()
  })

  it('seeding counts every open step as celebrated; an existing list is kept as is', () => {
    const p = defaultProgress()
    const list = seedUnlocksCelebrated(p)
    expect(list).toContain('sub-to-10')
    expect(list).toContain('mult-2-5-10')
    expect(list).not.toContain('add-to-20')
    const kept = { ...p, unlocksCelebrated: ['add-to-10' as const] }
    expect(seedUnlocksCelebrated(kept)).toBe(kept.unlocksCelebrated)
  })

  it('a step that opens after seeding is pending — even with open steps past it (real baseline holes)', () => {
    const p = withLevels(seeded(), {
      'add-to-10': 'mastered',
      'add-to-20': 'intro',
    })
    expect(pendingUnlock(p, 'math')).toEqual({
      world: 'math',
      mastered: 'add-to-10',
      unlocked: 'add-to-20',
      land: null,
    })
    expect(pendingUnlock(p, 'word-song')).toBeNull()
  })

  it('the first step of a land reports the land (gate beat)', () => {
    const p = withLevels(seeded(), {
      'sub-to-20': 'mastered',
      'two-digit-addsub-no-regroup': 'intro',
    })
    const u = pendingUnlock(p, 'math')!
    expect(u.unlocked).toBe('two-digit-addsub-no-regroup')
    expect(u.mastered).toBe('sub-to-20')
    expect(u.land?.number).toBe(3)
    expect(u.land?.name).toBe('Big numbers')
  })

  it('marking celebrates once: pending clears and stays cleared; marking again is a no-op', () => {
    const p = withLevels(seeded(), {
      'add-to-10': 'mastered',
      'add-to-20': 'intro',
    })
    const marked = markUnlockCelebrated(p, 'math')
    expect(pendingUnlock(marked, 'math')).toBeNull()
    expect(markUnlockCelebrated(marked, 'math')).toBe(marked)
    // Marking one world leaves the other world's pending unlock alone.
    const both = withLevels(p, { 'cvc-words-short-o': 'intro' })
    const mathOnly = markUnlockCelebrated(both, 'math')
    expect(pendingUnlock(mathOnly, 'word-song')?.unlocked).toBe(
      'cvc-words-short-o',
    )
  })

  it('cloud merge unions the lists (a celebrated unlock stays celebrated)', () => {
    expect(mergeUnlocksCelebrated(undefined, ['add-to-10'])).toEqual([
      'add-to-10',
    ])
    const a = ['add-to-10' as const]
    expect(mergeUnlocksCelebrated(a, undefined)).toBe(a)
    expect(mergeUnlocksCelebrated(a, ['add-to-10'])).toBe(a)
    expect(mergeUnlocksCelebrated(a, ['add-to-20'])).toEqual([
      'add-to-10',
      'add-to-20',
    ])
  })

  it('the guard accepts the field (absent or a string list) and rejects a malformed one', () => {
    const p = seeded()
    expect(isProgressV1(p)).toBe(true)
    expect(isProgressV1(defaultProgress())).toBe(true)
    expect(isProgressV1({ ...p, unlocksCelebrated: 'add-to-10' })).toBe(false)
    expect(isProgressV1({ ...p, unlocksCelebrated: [1] })).toBe(false)
  })
})

describe('sessionEndBeat', () => {
  it('bud when the focus step banked a good day and nothing unlocked', () => {
    const before = { ...seeded(), history: [goodDay('add-to-10', 1)] }
    const after = {
      ...before,
      history: [...before.history, goodDay('add-to-10', 2)],
    }
    const beat = sessionEndBeat(before, after, 'add-to-10')
    expect(beat.kind).toBe('bud')
    if (beat.kind !== 'bud') return
    expect(beat.before.goodDays).toBe(1)
    expect(beat.after.goodDays).toBe(2)
  })

  it('none on a bad day, and none on a second good session the same day', () => {
    const before = { ...seeded(), history: [goodDay('add-to-10', 1)] }
    const bad = {
      ...before,
      history: [
        ...before.history,
        { ...goodDay('add-to-10', 2), successRate: 0.4 },
      ],
    }
    expect(sessionEndBeat(before, bad, 'add-to-10')).toEqual({ kind: 'none' })
    const sameDay = {
      ...before,
      history: [...before.history, goodDay('add-to-10', 1)],
    }
    expect(sessionEndBeat(before, sameDay, 'add-to-10')).toEqual({
      kind: 'none',
    })
  })

  it('unlock wins over bud', () => {
    const before = seeded()
    const after = withLevels(before, {
      'add-to-10': 'mastered',
      'add-to-20': 'intro',
    })
    const beat = sessionEndBeat(before, after, 'add-to-10')
    expect(beat.kind).toBe('unlock')
    if (beat.kind !== 'unlock') return
    expect(beat.unlock.unlocked).toBe('add-to-20')
  })
})
