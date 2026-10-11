/**
 * One Hub visit (`planHubVisit`): the composition the native Hub mounts
 * with. The same inputs give the web Hub's lines, glowing card and flower
 * slots; `src/screens/Hub/hubVisitParity.test.tsx` renders the web Hub
 * against it. Mockup screens: a (fresh), c (one flower sleeping), d (both
 * sleeping), a2 (next morning, the wake-up).
 */
import { describe, expect, it } from 'vitest'
import {
  defaultProgress,
  type Progress,
  type SessionHistoryEntry,
  type SkillLevels,
  type SkillNode,
} from '../progress'
import {
  emptySessionHistory,
  type SessionHistoryV2,
} from '../sessionEnd/sessionHistory'
import { planHubVisit, type HubVisitInput } from './hubVisit'

function withHistory(history: SessionHistoryEntry[]): Progress {
  const p = defaultProgress()
  const allLocked = Object.fromEntries(
    Object.keys(p.skillLevels).map((k) => [k, 'locked']),
  ) as SkillLevels
  return {
    ...p,
    skillLevels: {
      ...allLocked,
      'number-recog': 'practicing',
      'letter-names': 'practicing',
    },
    history,
  }
}

/** Day `d` of May 2026 at local noon. */
function entry(d: number, node: SkillNode): SessionHistoryEntry {
  return {
    dateISO: new Date(2026, 4, d, 12).toISOString(),
    skillFocus: [node],
    successRate: 1,
  }
}

const MAY = (d: number): string => `2026-05-${String(d).padStart(2, '0')}`
/** May 10, 3 pm. */
const NOW = new Date(2026, 4, 10, 15, 0)

function visit(
  history: SessionHistoryEntry[],
  extra: Partial<HubVisitInput> = {},
  lastSuggestion: SessionHistoryV2['lastSuggestion'] = null,
) {
  return planHubVisit({
    progress: withHistory(history),
    history: { ...emptySessionHistory(), lastSuggestion },
    now: NOW,
    seenWake: {},
    suppressed: false,
    ...extra,
  })
}

describe('planHubVisit', () => {
  it('a · fresh: Word Song glows on the tie, "Let\'s grow a flower in Word Song!"', () => {
    const v = visit([])
    expect(v.today).toBe(MAY(10))
    expect(v.suggestion).toBe('word-song')
    expect(v.lines).toEqual(['guide.grow.word-song'])
    expect(v.numberGarden.slots).toEqual(['empty', 'empty', 'empty'])
    expect(v.wake.wakeWorlds).toEqual([])
  })

  it('a · the tie alternates from lastSuggestion', () => {
    const v = visit([], {}, 'word-song')
    expect(v.suggestion).toBe('number-garden')
    expect(v.lines).toEqual(['guide.grow.number-garden'])
  })

  it('c · Number Garden\'s flower sleeps today: Word Song glows, "Your flower is sleeping"', () => {
    const v = visit([entry(10, 'number-recog')])
    expect(v.numberGarden.slots).toEqual(['sleeping', 'empty', 'empty'])
    expect(v.suggestion).toBe('word-song')
    expect(v.lines).toEqual(['guide.sleeping.word-song'])
  })

  it('d · both flowers sleep: no glow, "Both flowers are sleeping"', () => {
    const v = visit([entry(10, 'number-recog'), entry(10, 'letter-names')])
    expect(v.suggestion).toBeNull()
    expect(v.lines).toEqual(['guide.both-sleeping'])
    expect(v.wordSong.slots).toEqual(['sleeping', 'empty', 'empty'])
  })

  it('a2 · next morning: both buds open once, then the next action', () => {
    const v = visit([entry(9, 'number-recog'), entry(9, 'letter-names')])
    expect(v.wake.wakeWorlds).toEqual(['math', 'word-song'])
    expect(v.wake.wakeSlots).toEqual({ math: [0], 'word-song': [0] })
    expect(v.wake.next).toEqual({ math: MAY(9), 'word-song': MAY(9) })
    expect(v.lines).toEqual(['guide.woke-up', 'guide.grow.word-song'])
  })

  it('a2 · one flower from the unlock after a wake-up: "One more flower"', () => {
    const v = visit([entry(8, 'number-recog'), entry(9, 'number-recog')])
    expect(v.suggestion).toBe('number-garden')
    expect(v.wake.wakeSlots).toEqual({ math: [0, 1] })
    expect(v.lines).toEqual(['guide.hub.woke.one', 'guide.one-more'])
  })

  it('a flower already shown awake does not wake again', () => {
    const v = visit([entry(9, 'number-recog')], { seenWake: { math: MAY(9) } })
    expect(v.wake.wakeWorlds).toEqual([])
    expect(v.lines).toEqual(['guide.grow.number-garden'])
  })

  it('a return within 30 s: no lines, the same cards and glow', () => {
    const v = visit([entry(9, 'number-recog')], { suppressed: true })
    expect(v.lines).toEqual([])
    expect(v.suggestion).toBe('number-garden')
    expect(v.wake.wakeWorlds).toEqual(['math'])
  })
})
