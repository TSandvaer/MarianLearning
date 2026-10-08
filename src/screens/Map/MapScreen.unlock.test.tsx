/**
 * Map unlock / land beat (Emma's Path 9/10, ClickUp 123jpnbc3dt; spec
 * §6 steps 3–4). Timeline, line choice, one-shot marking.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import { MapScreen } from './MapScreen'
import type { MapLinePlayer } from './playMapLine'
import {
  defaultProgress,
  getSettings,
  type Progress,
} from '@marian/core/progress'
import { seedUnlocksCelebrated } from '@marian/core/progress/pathBeats'

/** Seeded before `sub-to-20` was mastered; `two-digit…no-regroup` (land 3's first step) just opened. */
function landUnlockDoc(showLevelToMarian = true): Progress {
  const base = defaultProgress()
  const seededList = seedUnlocksCelebrated(base)
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
    unlocksCelebrated: [...seededList, 'add-to-20'],
    parentSettings: { ...getSettings(base), showLevelToMarian },
  }
}

function setup(doc: Progress) {
  const player: MapLinePlayer & { play: ReturnType<typeof vi.fn> } = {
    play: vi.fn(() => Promise.resolve()),
    cancel: vi.fn(),
    unload: vi.fn(),
  }
  const sfxSrcs: string[] = []
  const markUnlockCelebrated = vi.fn()
  render(
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="always">
        <MapScreen
          world="math"
          progressDoc={doc}
          onBack={() => {}}
          createPlayer={() => player}
          createSfxFn={(opts: { src: string }) =>
            ({
              play: () => {
                sfxSrcs.push(opts.src)
                return true
              },
              unload: () => {},
            }) as never
          }
          markUnlockCelebrated={markUnlockCelebrated}
        />
      </MotionConfig>
    </LazyMotion>,
  )
  return { player, sfxSrcs, markUnlockCelebrated }
}

const at = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

const stop = (node: string) =>
  screen
    .getAllByTestId('map-stop')
    .find((el) => el.getAttribute('data-node') === node)!
const gate = (land: number) =>
  screen
    .getAllByTestId('map-gate')
    .find((el) => el.getAttribute('data-land') === String(land))!

beforeEach(() => {
  vi.useFakeTimers()
  // Give the path region a size so stops / gates / Emma render.
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

describe('map land beat (spec §6 step 4)', () => {
  it('walks bloom → hop → padlock pop → gate swing → line, and marks it celebrated on mount', async () => {
    const { player, sfxSrcs, markUnlockCelebrated } = setup(landUnlockDoc())
    const map = screen.getByTestId('map')
    expect(map).toHaveAttribute('data-beat', 'land')
    expect(markUnlockCelebrated).toHaveBeenCalledTimes(1)
    expect(markUnlockCelebrated).toHaveBeenCalledWith('math')

    // 0 ms: Emma on the just-mastered stop; the new stop still frosted;
    // its land's gate still closed; no line yet.
    expect(screen.getByTestId('map-emma')).toHaveAttribute(
      'data-node',
      'sub-to-20',
    )
    expect(stop('two-digit-addsub-no-regroup')).toHaveAttribute(
      'data-state',
      'locked',
    )
    expect(gate(3)).toHaveAttribute('data-open', 'false')
    expect(screen.queryByTestId('map-ribbon')).toBeNull()
    expect(player.play).not.toHaveBeenCalled()

    await at(400) // hop
    expect(map).toHaveAttribute('data-beat-phase', 'hop')
    expect(screen.getByTestId('map-emma')).toHaveAttribute(
      'data-node',
      'two-digit-addsub-no-regroup',
    )

    await at(700) // 1100: padlock pop
    expect(map).toHaveAttribute('data-beat-phase', 'pop')
    expect(screen.getByTestId('map-padlock-pop')).toBeInTheDocument()
    expect(stop('two-digit-addsub-no-regroup')).toHaveAttribute(
      'data-state',
      'current',
    )
    expect(sfxSrcs).toEqual(['/assets/sfx-chime-soft.mp3'])

    await at(400) // 1500: gate swings
    expect(map).toHaveAttribute('data-beat-phase', 'gate')
    expect(gate(3)).toHaveAttribute('data-open', 'true')
    expect(screen.getByTestId('map-gate-swing')).toBeInTheDocument()
    expect(sfxSrcs).toEqual([
      '/assets/sfx-chime-soft.mp3',
      '/assets/sfx-cheer.mp3',
    ])
    expect(player.play).not.toHaveBeenCalled()

    await at(600) // 2100: Emma cheers and names the land
    expect(map).toHaveAttribute('data-beat-phase', 'cheer')
    expect(screen.getByTestId('map-ribbon')).toHaveAttribute(
      'data-line-id',
      'end.land.math.3',
    )
    expect(screen.getByTestId('map-ribbon').textContent).toBe(
      'A new land! Land 3: Big numbers!',
    )
    expect(player.play.mock.calls.map((c) => c[0].id)).toEqual([
      'end.land.math.3',
    ])
  })

  it('showLevelToMarian=false uses the no-number land line', async () => {
    const { player } = setup(landUnlockDoc(false))
    await at(2100)
    expect(player.play.mock.calls.map((c) => c[0].id)).toEqual([
      'end.land.math.3.no-number',
    ])
    expect(screen.getByTestId('map-ribbon').textContent).toBe(
      'A new land: Big numbers!',
    )
  })

  it('taps wait for the line: a stop tap mid-beat says nothing', async () => {
    const { player } = setup(landUnlockDoc())
    await at(400)
    fireEvent.click(stop('add-to-10'))
    expect(player.play).not.toHaveBeenCalled()
    await at(1700)
    fireEvent.click(stop('add-to-10'))
    expect(player.play.mock.calls.map((c) => c[0].id)).toEqual([
      'end.land.math.3',
      'path.stop.add-to-10',
    ])
  })
})

describe('map unlock beat — Emma', () => {
  it('cheers while the line plays, then goes back to idle', async () => {
    const { player } = setup(landUnlockDoc())
    let finish: () => void = () => {}
    player.play.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve)),
    )
    await at(2100)
    expect(screen.getByTestId('map-emma')).toHaveAttribute(
      'data-pose',
      'cheering',
    )
    await act(async () => finish())
    expect(screen.getByTestId('map-emma')).toHaveAttribute('data-pose', 'idle')
  })
})

describe('map without a pending unlock', () => {
  it('plays the open line, no beat, marks nothing', () => {
    const base = defaultProgress()
    const { player, markUnlockCelebrated } = setup({
      ...base,
      unlocksCelebrated: seedUnlocksCelebrated(base),
    })
    expect(screen.getByTestId('map')).toHaveAttribute('data-beat', 'none')
    expect(markUnlockCelebrated).not.toHaveBeenCalled()
    expect(player.play.mock.calls.map((c) => c[0].id)).toEqual([
      'path.open.add-to-10',
    ])
  })
})
