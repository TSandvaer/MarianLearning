import { describe, expect, it } from 'vitest'
import { defaultProgress } from '../progress/defaults'
import { seedUnlocksCelebrated, sessionEndBeat } from '../progress/pathBeats'
import type { Progress, SkillNode } from '../progress'
import { END_CLIP_SECONDS, sessionEndGuidance } from './sessionEndGuidance'
import { markNudgeSaid, nudgeSaidToday } from './notYetNudge'
import { GUIDANCE_LINES } from '../emmasPath/guidanceLines'

const TODAY = '2026-10-06'

/** A history entry on 2026-10-<day> at 18:00 local. */
const entry = (node: SkillNode, day: number, successRate: number) => ({
  dateISO: new Date(2026, 9, day, 18, 0).toISOString(),
  skillFocus: [node] as Progress['history'][number]['skillFocus'],
  successRate,
})

/** A doc whose unlock marker is seeded from `seedLevels` (default: the
 *  baseline), so only steps opened past it count as pending unlocks. */
function doc(
  entries: ReturnType<typeof entry>[],
  levels: Partial<Progress['skillLevels']> = {},
  seedLevels: Partial<Progress['skillLevels']> = {},
): Progress {
  const p = defaultProgress()
  const seed = { ...p, skillLevels: { ...p.skillLevels, ...seedLevels } }
  return {
    ...p,
    skillLevels: { ...p.skillLevels, ...levels },
    history: entries as unknown as Progress['history'],
    unlocksCelebrated: seedUnlocksCelebrated(seed),
  }
}

function run(
  before: Progress,
  after: Progress,
  node: SkillNode,
  totalCorrect: number,
  nudgeSaid = false,
) {
  return sessionEndGuidance({
    before,
    after,
    node,
    beat: sessionEndBeat(before, after, node),
    totalCorrect,
    today: TODAY,
    nudgeSaidToday: nudgeSaid,
  })
}

const ids = (g: ReturnType<typeof run>) => g.lines.map((l) => l.id)

describe('sessionEndGuidance (Guidance G2)', () => {
  it('good day (1st flower → slot 2 of 3): praise, flower, "Two of three", sleeps tonight', () => {
    const d1 = entry('add-to-10', 4, 1)
    const today = entry('add-to-10', 6, 7 / 8)
    const g = run(doc([d1]), doc([d1, today]), 'add-to-10', 7)
    expect(g.day).toBe('good-day')
    expect(g.world).toBe('math')
    expect(g.slotsBefore).toEqual(['grown', 'empty', 'empty'])
    expect(g.slotsAfter).toEqual(['grown', 'sleeping', 'empty'])
    expect(g.newSlot).toBe(1)
    expect(g.countText).toBe('2 of 3')
    expect(ids(g)).toEqual([
      'guide.end.right.7',
      'guide.end.flower',
      'guide.end.count.2',
      'guide.end.sleeps',
    ])
    expect(g.lines.map((l) => l.beat)).toEqual([
      'praise',
      'flower',
      'count',
      'next',
    ])
    expect(g.lines[0]!.text).toBe('Seven right! You worked hard!')
    expect(g.lines[0]!.seconds).toBe(3.12)
  })

  it('3rd good day → unlock: "3 of 3!", all grown, "A new path opens. Look!"', () => {
    const d1 = entry('add-to-10', 3, 1)
    const d2 = entry('add-to-10', 4, 1)
    const today = entry('add-to-10', 6, 1)
    const before = doc([d1, d2])
    const after = doc([d1, d2, today], {
      'add-to-10': 'mastered',
      'add-to-20': 'intro',
    })
    const g = run(before, after, 'add-to-10', 8)
    expect(g.day).toBe('unlock')
    expect(g.slotsBefore).toEqual(['grown', 'grown', 'empty'])
    expect(g.slotsAfter).toEqual(['grown', 'grown', 'grown'])
    expect(g.newSlot).toBe(2)
    expect(g.countText).toBe('3 of 3!')
    expect(ids(g)).toEqual([
      'guide.end.right.8',
      'guide.end.flower',
      'guide.end.count.3',
      'guide.end.path-opens',
    ])
  })

  it('not-yet day (5/8): warm praise, tray unchanged, "Play again…" once', () => {
    const d1 = entry('add-to-10', 4, 1)
    const today = entry('add-to-10', 6, 5 / 8)
    const g = run(doc([d1]), doc([d1, today]), 'add-to-10', 5)
    expect(g.day).toBe('not-yet')
    expect(g.slotsBefore).toEqual(['grown', 'empty', 'empty'])
    expect(g.slotsAfter).toEqual(g.slotsBefore)
    expect(g.newSlot).toBeNull()
    expect(g.countText).toBeNull()
    expect(ids(g)).toEqual([
      'guide.end.not-yet.praise',
      'guide.end.not-yet.again',
    ])
  })

  it('second not-yet day the same day: the practice line only', () => {
    const today = entry('add-to-10', 6, 4 / 8)
    const g = run(doc([]), doc([today]), 'add-to-10', 4, true)
    expect(g.day).toBe('not-yet')
    expect(ids(g)).toEqual(['guide.end.not-yet.praise'])
  })

  it('same-day replay after today’s flower: practice praise, no new flower, today’s flower still asleep', () => {
    const d1 = entry('add-to-10', 4, 1)
    const earned = entry('add-to-10', 6, 1)
    const replay = entry('add-to-10', 6, 1)
    const g = run(doc([d1, earned]), doc([d1, earned, replay]), 'add-to-10', 8)
    expect(g.day).toBe('practice')
    expect(g.newSlot).toBeNull()
    expect(g.countText).toBeNull()
    expect(g.slotsAfter).toEqual(['grown', 'sleeping', 'empty'])
    expect(ids(g)).toEqual(['guide.end.not-yet.praise'])
  })

  it('same-day replay that scores low never says "Play again to get today’s flower"', () => {
    const earned = entry('add-to-10', 6, 1)
    const low = entry('add-to-10', 6, 3 / 8)
    const g = run(doc([earned]), doc([earned, low]), 'add-to-10', 3)
    expect(g.day).toBe('practice')
    expect(ids(g)).toEqual(['guide.end.not-yet.praise'])
  })

  it('finishing the last step of a world: "3 of 3!" then Emma says "You grew your whole garden!" with its clip', () => {
    const d1 = entry('mult-6-9', 3, 1)
    const d2 = entry('mult-6-9', 4, 1)
    const today = entry('mult-6-9', 6, 1)
    const open = { 'mult-6-9': 'practicing' } as const
    const before = doc([d1, d2], open, open)
    const after = doc([d1, d2, today], { 'mult-6-9': 'mastered' }, open)
    const g = run(before, after, 'mult-6-9', 8)
    expect(g.day).toBe('world-done')
    expect(g.countText).toBe('3 of 3!')
    const last = g.lines[g.lines.length - 1]!
    expect(ids(g)).toEqual([
      'guide.end.right.8',
      'guide.end.flower',
      'guide.end.count.3',
      'guide.end.world-done',
    ])
    expect(last.text).toBe('You grew your whole garden!')
    expect(last.src).toBe('/assets/audio/path/guide-end-world-done.mp3')
    expect(last.beat).toBe('next')
    expect(last.seconds).toBe(2.4)
  })

  it('a step already grown (review) is practice with a full tray', () => {
    const g = run(
      doc([], { 'add-to-10': 'mastered' }),
      doc([entry('add-to-10', 6, 4 / 8)], { 'add-to-10': 'mastered' }),
      'add-to-10',
      4,
    )
    expect(g.day).toBe('practice')
    expect(g.slotsAfter).toEqual(['grown', 'grown', 'grown'])
  })

  it('every session-end guidance line has its real clip length; nothing counts stars', () => {
    const endIds = GUIDANCE_LINES.filter((l) => l.id.startsWith('guide.end.'))
    expect(endIds.map((l) => l.id).sort()).toEqual(
      Object.keys(END_CLIP_SECONDS).sort(),
    )
  })
})

describe('notYetNudge — once a day per world', () => {
  function memStorage() {
    const m = new Map<string, string>()
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    }
  }

  it('marks per world and per day', () => {
    const s = memStorage()
    expect(nudgeSaidToday('math', TODAY, s)).toBe(false)
    markNudgeSaid('math', TODAY, s)
    expect(nudgeSaidToday('math', TODAY, s)).toBe(true)
    expect(nudgeSaidToday('word-song', TODAY, s)).toBe(false)
    expect(nudgeSaidToday('math', '2026-10-07', s)).toBe(false)
  })
})
