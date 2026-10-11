/**
 * Web ↔ native parity for the map: the native map mounts from
 * `planMapVisit` / `mapBeatView` (`@marian/core/map/mapVisit`). This
 * renders the web map on the same doc and reads back what it shows at
 * mount and at every beat phase: stop states, gates, Emma's stop and
 * pose, the caption, the beat. It proves the web draws what core decides;
 * the decisions themselves are pinned by `mapVisit.test.ts` (core) and
 * `MapScreen.unlock.test.tsx` (the web beat, literal values).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import {
  defaultProgress,
  getSettings,
  type MasteryTrack,
  type Progress,
} from '@marian/core/progress'
import { seedUnlocksCelebrated } from '@marian/core/progress/pathBeats'
import { mapBeatView, planMapVisit } from '@marian/core/map/mapVisit'
import {
  unlockLine,
  unlockTimeline,
  type UnlockPhase,
} from '@marian/core/map/unlockBeat'
import { MapScreen } from './MapScreen'
import type { MapLinePlayer } from './playMapLine'

function withLevels(levels: Partial<Progress['skillLevels']>): Progress {
  const base = defaultProgress()
  return {
    ...base,
    skillLevels: { ...base.skillLevels, ...levels },
    unlocksCelebrated: seedUnlocksCelebrated(base),
  }
}

function allMastered(): Progress {
  const base = defaultProgress()
  const all = Object.fromEntries(
    Object.keys(base.skillLevels).map((k) => [k, 'mastered']),
  ) as Progress['skillLevels']
  return {
    ...base,
    skillLevels: all,
    unlocksCelebrated: Object.keys(all) as never,
  }
}

interface Case {
  name: string
  world: MasteryTrack
  doc: Progress | null
}

const CASES: Case[] = [
  { name: 'no doc', world: 'math', doc: null },
  { name: 'diagnostic baseline', world: 'math', doc: defaultProgress() },
  { name: 'baseline, Word Song', world: 'word-song', doc: defaultProgress() },
  {
    name: 'stop unlock',
    world: 'math',
    doc: withLevels({ 'add-to-10': 'mastered', 'add-to-20': 'intro' }),
  },
  {
    name: 'land unlock, numbers hidden',
    world: 'math',
    doc: {
      ...withLevels({
        'add-to-10': 'mastered',
        'add-to-20': 'mastered',
        'sub-to-10': 'mastered',
        'sub-to-20': 'mastered',
        'two-digit-addsub-no-regroup': 'intro',
      }),
      parentSettings: {
        ...getSettings(defaultProgress()),
        showLevelToMarian: false,
      },
    },
  },
  { name: 'complete world', world: 'word-song', doc: allMastered() },
]

/** What the web map shows right now. */
function shown() {
  const map = screen.getByTestId('map')
  const emma = screen.queryByTestId('map-emma')
  return {
    current: map.getAttribute('data-current'),
    complete: map.getAttribute('data-complete') === 'true',
    beat: map.getAttribute('data-beat'),
    stops: screen
      .getAllByTestId('map-stop')
      .map((el) => [
        el.getAttribute('data-node'),
        el.getAttribute('data-state'),
      ]),
    gates: screen
      .queryAllByTestId('map-gate')
      .map((el) => [
        el.getAttribute('data-land'),
        el.getAttribute('data-open'),
      ]),
    emmaNode: emma?.getAttribute('data-node') ?? null,
    pose: emma?.getAttribute('data-pose') ?? null,
    caption:
      screen.queryByTestId('map-ribbon')?.getAttribute('data-line-id') ?? null,
  }
}

/** What core says the map shows at `phase`. */
function expected(c: Case, phase: UnlockPhase | null) {
  const visit = planMapVisit(c.doc, c.world)
  const view = mapBeatView(visit, phase)
  return {
    current: view.model.current,
    complete: view.model.complete,
    beat: visit.beat,
    stops: view.model.lands.flatMap((l) =>
      l.stops.map((s) => [s.node, s.state]),
    ),
    gates: view.model.lands
      .filter((l) => l.number > 1)
      .map((l) => [String(l.number), String(l.open)]),
    emmaNode: view.emmaNode,
    pose: visit.restPose,
  }
}

function mount(c: Case) {
  const player: MapLinePlayer = {
    play: vi.fn(() => new Promise<void>(() => {})),
    cancel: vi.fn(),
    unload: vi.fn(),
  }
  render(
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="always">
        <MapScreen
          world={c.world}
          progressDoc={c.doc}
          onBack={() => {}}
          createPlayer={() => player}
          createSfxFn={() => ({ play: () => true, unload: () => {} }) as never}
          markUnlockCelebrated={() => {}}
        />
      </MotionConfig>
    </LazyMotion>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 820,
    height: 950,
    top: 0,
    left: 0,
    right: 820,
    bottom: 950,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('map parity: web map = core visit', () => {
  it.each(CASES)('$name: at mount', (c) => {
    mount(c)
    const visit = planMapVisit(c.doc, c.world)
    expect(shown()).toEqual({
      ...expected(c, visit.phase),
      caption: visit.caption?.id ?? null,
    })
  })

  it.each(CASES.filter((c) => planMapVisit(c.doc, c.world).unlock !== null))(
    '$name: every beat phase',
    async (c) => {
      mount(c)
      const visit = planMapVisit(c.doc, c.world)
      let clock = 0
      for (const { phase, at } of unlockTimeline(visit.unlock!)) {
        await act(async () => {
          vi.advanceTimersByTime(at - clock)
        })
        clock = at
        expect(screen.getByTestId('map')).toHaveAttribute(
          'data-beat-phase',
          phase,
        )
        const { caption, pose, ...rest } = shown()
        const { pose: restPose, ...want } = expected(c, phase)
        expect(rest).toEqual(want)
        // The ribbon waits for Emma's line; she cheers while saying it.
        expect(caption).toBe(
          phase === 'cheer'
            ? unlockLine(visit.unlock!, visit.model.showLandNumber).id
            : null,
        )
        expect(pose).toBe(phase === 'cheer' ? 'cheering' : restPose)
      }
    },
  )
})
