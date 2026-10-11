/**
 * Map visit + beat view (moved from the web map screen so the native map
 * shares them). Fixtures: the spec §6 stop unlock (add-to-20 opens) and
 * land unlock (land 3's first step opens).
 */
import { describe, expect, it } from 'vitest'
import { defaultProgress, getSettings, type Progress } from '../progress'
import { seedUnlocksCelebrated } from '../progress/pathBeats'
import { budHoleSize } from './mapLayout'
import { buildMapModel } from './mapModel'
import {
  beatModel,
  LOCKED_TAP_SFX,
  mapBeatView,
  planMapVisit,
  POINTING_MS,
  UNLOCK_SFX,
  type MapVisit,
} from './mapVisit'
import type { UnlockPhase } from './unlockBeat'

/** add-to-10 mastered since the marker was seeded: add-to-20 opened. */
function stopUnlockDoc(): Progress {
  const base = defaultProgress()
  return {
    ...base,
    skillLevels: {
      ...base.skillLevels,
      'add-to-10': 'mastered',
      'add-to-20': 'intro',
    },
    unlocksCelebrated: seedUnlocksCelebrated(base),
  }
}

/** sub-to-20 mastered: two-digit…no-regroup (land 3's first step) opened. */
function landUnlockDoc(): Progress {
  const base = defaultProgress()
  return {
    ...base,
    skillLevels: {
      ...base.skillLevels,
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'mastered',
      'sub-to-20': 'mastered',
      'two-digit-addsub-no-regroup': 'intro',
    },
    unlocksCelebrated: [...seedUnlocksCelebrated(base), 'add-to-20'],
    parentSettings: { ...getSettings(base), showLevelToMarian: true },
  }
}

const stopState = (visit: Pick<MapVisit, 'model'>, node: string) =>
  visit.model.lands.flatMap((l) => l.stops).find((s) => s.node === node)!.state
const gateOpen = (visit: Pick<MapVisit, 'model'>, land: number) =>
  visit.model.lands.find((l) => l.number === land)!.open

describe('planMapVisit', () => {
  it('no doc: the default map, no beat, the open line, Emma idle', () => {
    const visit = planMapVisit(null, 'math')
    expect(visit.model).toEqual(buildMapModel(null, 'math'))
    expect(visit.unlock).toBeNull()
    expect(visit.beat).toBe('none')
    expect(visit.phase).toBeNull()
    expect(visit.caption?.id).toBe(`path.open.${visit.model.current}`)
    expect(visit.restPose).toBe('idle')
    expect(visit.alsoBadged).toEqual([])
  })

  it('a doc without the seen-marker never plays a beat', () => {
    const doc = { ...stopUnlockDoc(), unlocksCelebrated: undefined }
    expect(planMapVisit(doc, 'math').beat).toBe('none')
  })

  it('a stop unlock: beat "unlock" from bloom, no caption until Emma speaks', () => {
    const visit = planMapVisit(stopUnlockDoc(), 'math')
    expect(visit.beat).toBe('unlock')
    expect(visit.phase).toBe('bloom')
    expect(visit.caption).toBeNull()
    expect(visit.unlock).toMatchObject({
      mastered: 'add-to-10',
      unlocked: 'add-to-20',
      land: null,
    })
    expect(visit.alsoBadged).toEqual(['add-to-10'])
  })

  it('a land unlock: beat "land"', () => {
    const visit = planMapVisit(landUnlockDoc(), 'math')
    expect(visit.beat).toBe('land')
    expect(visit.unlock?.land?.number).toBe(3)
  })

  it('the other world has nothing pending', () => {
    expect(planMapVisit(landUnlockDoc(), 'word-song').beat).toBe('none')
  })

  it('a complete world: the "path done" line and Emma cheering', () => {
    const base = defaultProgress()
    const all = Object.fromEntries(
      Object.keys(base.skillLevels).map((k) => [k, 'mastered']),
    ) as Progress['skillLevels']
    const visit = planMapVisit(
      {
        ...base,
        skillLevels: all,
        unlocksCelebrated: Object.keys(all) as never,
      },
      'word-song',
    )
    expect(visit.model.complete).toBe(true)
    expect(visit.caption?.id).toBe('path.open.done.word-song')
    expect(visit.restPose).toBe('cheering')
  })
})

describe('beatModel', () => {
  it('no unlock: the model itself', () => {
    const model = buildMapModel(null, 'math')
    expect(beatModel(model, null, null)).toBe(model)
  })

  it('the new stop stays frosted until the pop, the gate shut until the swing', () => {
    const visit = planMapVisit(landUnlockDoc(), 'math')
    const at = (phase: UnlockPhase) => ({
      model: beatModel(visit.model, visit.unlock, phase),
    })
    for (const phase of ['bloom', 'hop'] as const) {
      expect(stopState(at(phase), 'two-digit-addsub-no-regroup')).toBe('locked')
      const frosted = at(phase)
        .model.lands.flatMap((l) => l.stops)
        .find((s) => s.node === 'two-digit-addsub-no-regroup')!
      expect(frosted.buds).toEqual([])
      expect(frosted.nearlyThere).toBe(false)
    }
    expect(stopState(at('pop'), 'two-digit-addsub-no-regroup')).toBe('current')
    expect(gateOpen(at('pop'), 3)).toBe(false)
    expect(gateOpen(at('gate'), 3)).toBe(true)
    expect(beatModel(visit.model, visit.unlock, 'cheer')).toBe(visit.model)
  })
})

describe('mapBeatView', () => {
  const PHASES: (UnlockPhase | null)[] = [
    'bloom',
    'hop',
    'pop',
    'gate',
    'cheer',
    null,
  ]

  it('walks the land beat: Emma, taps, pops, swing, faded band', () => {
    const visit = planMapVisit(landUnlockDoc(), 'math')
    const rows = PHASES.map((phase) => {
      const v = mapBeatView(visit, phase)
      return [
        phase,
        v.emmaNode,
        v.tapsWait,
        v.hopping,
        v.poppingNode,
        v.swingingLand,
        v.fadedLand,
      ]
    })
    const NEW = 'two-digit-addsub-no-regroup'
    expect(rows).toEqual([
      ['bloom', 'sub-to-20', true, false, null, null, 3],
      ['hop', NEW, true, true, null, null, 3],
      ['pop', NEW, true, false, NEW, null, 3],
      ['gate', NEW, true, false, null, 3, null],
      ['cheer', NEW, false, false, null, null, null],
      [null, NEW, false, false, null, null, null],
    ])
    expect(mapBeatView(visit, 'cheer').bloomNode).toBe('sub-to-20')
  })

  it('a stop unlock never fades a band or swings a gate', () => {
    const visit = planMapVisit(stopUnlockDoc(), 'math')
    for (const phase of PHASES) {
      const v = mapBeatView(visit, phase)
      expect(v.fadedLand).toBeNull()
      expect(v.swingingLand).toBeNull()
    }
  })

  it('no beat: Emma on the current stop, taps never wait', () => {
    const visit = planMapVisit(null, 'word-song')
    const v = mapBeatView(visit, null)
    expect(v.model).toBe(visit.model)
    expect(v.emmaNode).toBe(visit.model.current)
    expect(v.tapsWait).toBe(false)
    expect(v.bloomNode).toBeNull()
  })
})

describe('map effects and bud trays', () => {
  it('keeps the web values', () => {
    expect(UNLOCK_SFX).toEqual({
      pop: { src: '/assets/sfx-chime-soft.mp3', volume: 0.85 },
      gate: { src: '/assets/sfx-cheer.mp3', volume: 0.7 },
    })
    expect(LOCKED_TAP_SFX).toEqual({
      src: '/assets/sfx-poof.mp3',
      volume: 0.45,
    })
    expect(POINTING_MS).toBe(1500)
  })

  it('bud holes: big for a short row, smaller for vowel groups', () => {
    const row = (n: number) => Array.from({ length: n }, () => false)
    expect(budHoleSize([row(3)])).toBe(42)
    expect(budHoleSize([row(4)])).toBe(42)
    expect(budHoleSize([row(5)])).toBe(30)
    expect(budHoleSize([row(2), row(2), row(2), row(2)])).toBe(30)
    expect(budHoleSize([row(3), row(3), row(3), row(3)])).toBe(22)
  })
})
