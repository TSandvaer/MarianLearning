import { describe, expect, it } from 'vitest'
import { defaultProgress } from '../progress/defaults'
import { seedUnlocksCelebrated, sessionEndBeat } from '../progress/pathBeats'
import type { Progress, SkillNode } from '../progress'
import { END_CLIP_SECONDS, sessionEndGuidance } from './sessionEndGuidance'
import { markNudgeSaid, nudgeSaidToday } from './notYetNudge'
import {
  GUIDANCE_LINES,
  GUIDANCE_LINES_AWAITING_RENDER,
} from '../emmasPath/guidanceLines'

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

/** The doc with cat words' row kept full by the fold-in's migration. */
const kept = (p: Progress): Progress => ({ ...p, keptFullRows: ['cvc-words'] })

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
    const d1 = entry('add-two-digit', 3, 1)
    const d2 = entry('add-two-digit', 4, 1)
    const today = entry('add-two-digit', 6, 1)
    const open = { 'add-two-digit': 'practicing' } as const
    const before = doc([d1, d2], open, open)
    const after = doc([d1, d2, today], { 'add-two-digit': 'mastered' }, open)
    const g = run(before, after, 'add-two-digit', 8)
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

  it('a pass releases the held flower: the unlock day, the 3rd flower lands (check fold-in (2), (5))', () => {
    const days = [3, 4, 5].map((d) => entry('cvc-words', d, 1))
    const today = entry('cvc-words', 6, 1)
    const open = { 'cvc-words': 'practicing' } as const
    const before = doc(days, open, open)
    const after = doc(
      [...days, today],
      { 'cvc-words': 'mastered', 'cvc-words-short-o': 'intro' },
      open,
    )
    const g = run(before, after, 'cvc-words', 8)
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

  it('a pass with the row already full (a row the migration kept full): the unlock day, tray full, no flower, "A new path opens. Look!"', () => {
    // Build 21: the row was 3 of 3 before the check, so no flower could
    // land, and the passed check read as the not-yet day.
    const days = [3, 4, 5].map((d) => entry('cvc-words', d, 1))
    const today = entry('cvc-words', 6, 1)
    const open = { 'cvc-words': 'practicing' } as const
    const before = kept(doc(days, open, open))
    const after = doc(
      [...days, today],
      { 'cvc-words': 'mastered', 'cvc-words-short-o': 'intro' },
      open,
    )
    const g = run(before, kept(after), 'cvc-words', 8)
    expect(g.day).toBe('unlock')
    expect(g.world).toBe('word-song')
    expect(g.slotsBefore).toEqual(['grown', 'grown', 'grown'])
    expect(g.slotsAfter).toEqual(['grown', 'grown', 'grown'])
    expect(g.newSlot).toBeNull()
    expect(g.bonusSlots).toEqual([])
    expect(g.countText).toBeNull()
    expect(ids(g)).toEqual(['guide.end.right.8', 'guide.end.path-opens'])
    expect(g.lines.map((l) => l.beat)).toEqual(['praise', 'next'])
  })

  it('a full-row pass on a world’s last step: "You grew your whole garden!", no flower', () => {
    const days = [3, 4, 5].map((d) => entry('add-two-digit', d, 1))
    const today = entry('add-two-digit', 6, 1)
    const open = { 'add-two-digit': 'practicing' } as const
    const before = doc(days, open, open)
    const after = doc([...days, today], { 'add-two-digit': 'mastered' }, open)
    const g = run(before, after, 'add-two-digit', 7)
    expect(g.day).toBe('world-done')
    expect(g.newSlot).toBeNull()
    expect(g.slotsAfter).toEqual(['grown', 'grown', 'grown'])
    expect(ids(g)).toEqual(['guide.end.right.7', 'guide.end.world-done'])
  })

  it('an already-grown step replayed while its unlock is still uncelebrated stays practice', () => {
    // The beat is the map's pending unlock, not this session's: the step
    // grew on an earlier day, so nothing opens today.
    const days = [3, 4, 5].map((d) => entry('add-to-10', d, 1))
    const grown = { 'add-to-10': 'mastered', 'add-to-20': 'intro' } as const
    const before = doc(days, grown)
    const after = doc([...days, entry('add-to-10', 6, 1)], grown)
    expect(sessionEndBeat(before, after, 'add-to-10').kind).toBe('unlock')
    const g = run(before, after, 'add-to-10', 8)
    expect(g.day).toBe('practice')
    expect(g.slotsAfter).toEqual(['grown', 'grown', 'grown'])
    expect(ids(g)).toEqual(['guide.end.not-yet.praise'])
  })

  describe('the next step played while the unlock that opened it is still uncelebrated', () => {
    // The beat is the map's pending unlock (add-to-10 → add-to-20), not
    // this session's: add-to-20 did not grow, so nothing opens today.
    const open = { 'add-to-10': 'mastered', 'add-to-20': 'intro' } as const

    it('not-yet day (5/8): the not-yet day, not the unlock day', () => {
      const d1 = entry('add-to-20', 4, 1)
      const before = doc([d1], open)
      const after = doc([d1, entry('add-to-20', 6, 5 / 8)], open)
      expect(sessionEndBeat(before, after, 'add-to-20').kind).toBe('unlock')
      const g = run(before, after, 'add-to-20', 5)
      expect(g.day).toBe('not-yet')
      expect(g.slotsAfter).toEqual(['grown', 'empty', 'empty'])
      expect(ids(g)).toEqual([
        'guide.end.not-yet.praise',
        'guide.end.not-yet.again',
      ])
    })

    it('same-day replay after today’s flower: practice, the flower still sleeps', () => {
      const flower = entry('add-to-20', 6, 1)
      const before = doc([flower], open)
      const after = doc([flower, entry('add-to-20', 6, 1)], open)
      expect(sessionEndBeat(before, after, 'add-to-20').kind).toBe('unlock')
      const g = run(before, after, 'add-to-20', 8)
      expect(g.day).toBe('practice')
      expect(g.slotsAfter).toEqual(['sleeping', 'empty', 'empty'])
      expect(ids(g)).toEqual(['guide.end.not-yet.praise'])
    })
  })

  describe('a cvc-words row waiting on its check, not grown this session (check fold-in (5))', () => {
    // Part 1, a failed part 2, a held good day, the plain session after a
    // fail, retake part 1, a weak session: with the row one flower short
    // and the check not passed they end alike: the practice ending, effort
    // praise only. No session can promise the flower, so never "Play
    // again…".
    const open = { 'cvc-words': 'practicing' } as const
    const waiting = (dayList: number[], todayRate = 1) =>
      run(
        doc(
          dayList.map((d) => entry('cvc-words', d, 1)),
          open,
          open,
        ),
        doc(
          [
            ...dayList.map((d) => entry('cvc-words', d, 1)),
            entry('cvc-words', 6, todayRate),
          ],
          open,
          open,
        ),
        'cvc-words',
        Math.round(todayRate * 8),
      )

    it('the 3rd good day held: practice, the row stays 2 of 3, not the not-yet day', () => {
      const g = waiting([3, 4])
      expect(g.day).toBe('practice')
      expect(g.slotsBefore).toEqual(['grown', 'grown', 'empty'])
      expect(g.slotsAfter).toEqual(g.slotsBefore)
      expect(g.newSlot).toBeNull()
      expect(g.bonusSlots).toEqual([])
      expect(g.countText).toBeNull()
      expect(ids(g)).toEqual(['guide.end.not-yet.praise'])
    })

    it('a weak session at 2 of 3: practice, never "Play again…"', () => {
      const g = waiting([3, 4], 5 / 8)
      expect(g.day).toBe('practice')
      expect(ids(g)).toEqual(['guide.end.not-yet.praise'])
    })

    it('a good day held earlier today never sleeps (separate days on)', () => {
      const g = waiting([3, 4, 6])
      expect(g.day).toBe('practice')
      expect(g.slotsAfter).toEqual(['grown', 'grown', 'empty'])
      expect(ids(g)).toEqual(['guide.end.not-yet.praise'])
    })

    it('today’s 2nd flower, shown, still sleeps on a replay (separate days on)', () => {
      const g = waiting([4, 6])
      expect(g.day).toBe('practice')
      expect(g.slotsAfter).toEqual(['grown', 'sleeping', 'empty'])
      expect(ids(g)).toEqual(['guide.end.not-yet.praise'])
    })

    it('a weak session with fewer than 2 of 3 shown: the not-yet day as today', () => {
      const g = waiting([4], 5 / 8)
      expect(g.day).toBe('not-yet')
      expect(ids(g)).toEqual([
        'guide.end.not-yet.praise',
        'guide.end.not-yet.again',
      ])
    })

    it('a row the migration kept full: practice, every flower grown, no sleeping slot', () => {
      const days = [3, 4, 6].map((d) => entry('cvc-words', d, 1))
      const g = run(
        kept(doc(days, open, open)),
        kept(doc([...days, entry('cvc-words', 6, 1)], open, open)),
        'cvc-words',
        8,
      )
      expect(g.day).toBe('practice')
      expect(g.slotsAfter).toEqual(['grown', 'grown', 'grown'])
      expect(ids(g)).toEqual(['guide.end.not-yet.praise'])
    })
  })

  it('a full row on a step without the check, not grown (promotion waits on the parent): unchanged', () => {
    const days = [4, 5, 6].map((d) => entry('add-to-10', d, 1))
    const g = run(
      doc(days),
      doc([...days, entry('add-to-10', 6, 1)]),
      'add-to-10',
      8,
    )
    expect(g.day).toBe('practice')
    expect(g.slotsAfter).toEqual(['grown', 'grown', 'sleeping'])
    expect(ids(g)).toEqual(['guide.end.not-yet.praise'])
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
    // A line still awaiting its render has no clip yet: the render commit
    // adds its ffprobe length here and takes it off the awaiting list.
    const endIds = GUIDANCE_LINES.filter(
      (l) =>
        l.id.startsWith('guide.end.') &&
        !GUIDANCE_LINES_AWAITING_RENDER.includes(l.id),
    )
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
