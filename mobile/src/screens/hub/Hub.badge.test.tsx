/**
 * The Hub's learner badge (learner profiles § 2.1, ACs 29–30): none with
 * one learner; with 2+ the playing learner's picture top-left in a
 * 56 × 56 target; a tap chimes, stops Emma's line and opens the picker;
 * Emma's 3 s press still opens Parent Settings, and a 3 s press on (or
 * next to) the badge does not.
 */
import { setDayOffsetSource, setKeyValueStore } from '@marian/core'
import type { LearnerEntry } from '@marian/core/learners'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { hubLayout, type HubLayout } from '../../layout/hubLayout'
import type { Rect } from '../../layout/layout'
import { badgeExclusion, hubBadge } from '../../layout/pickerLayout'
import { AVATAR_COLORS } from '../picker/avatars'
import { Hub, type HubProps } from './Hub'
import { resetHubAudioForTests, type GuidancePlayer } from './hubAudio'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
const P = hubLayout({ width: 375, height: 667, insets: NO_INSETS })
const L = hubLayout({ width: 667, height: 375, insets: NO_INSETS })

const SAM: LearnerEntry = {
  id: '00000002-0000-4000-8000-000000000002',
  name: 'Sam',
  avatarId: 'owl',
  language: 'en',
  legacySlot: false,
  start: { math: 1, wordSong: 1 },
  createdAtISO: '2026-10-19T00:00:00.000Z',
}

function fakePlayer(): GuidancePlayer {
  return {
    playLine: jest.fn(() => new Promise<void>(() => {})),
    cancelActive: jest.fn(),
    unload: jest.fn(),
  }
}

async function mount(layout: HubLayout, props: Partial<HubProps> = {}) {
  const handlers = {
    onPickTree: jest.fn(),
    onOpenMap: jest.fn(),
    onParentLongPress: jest.fn(),
    onLearnerBadge: jest.fn(),
    plink: jest.fn(),
    chime: jest.fn(),
  }
  const player = fakePlayer()
  await render(
    <Hub
      layout={layout}
      player={player}
      clock={() => new Date(2026, 9, 10, 15)}
      wallClock={() => 1_000_000}
      {...handlers}
      {...props}
    />,
  )
  await act(async () => {})
  return { ...handlers, player }
}

/** A press-in at (x, y) on Emma's long-press target, then the 3 s hold. */
async function holdEmmaAt(x: number, y: number) {
  const target = screen.getByTestId('hub-emma-long-press')
  await fireEvent(target, 'pressIn', { nativeEvent: { pageX: x, pageY: y } })
  await fireEvent(target, 'longPress')
}

function overlap(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const r = Math.min(a.x + a.width, b.x + b.width)
  const btm = Math.min(a.y + a.height, b.y + b.height)
  return r > x && btm > y ? { x, y, width: r - x, height: btm - y } : null
}

beforeEach(() => {
  jest.useFakeTimers()
  const map = new Map<string, string>()
  setKeyValueStore({
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  })
  setDayOffsetSource(null)
  resetHubAudioForTests()
})
afterEach(() => {
  jest.useRealTimers()
})

it('AC 29: one learner, no badge', async () => {
  await mount(P)
  expect(screen.queryByTestId('hub-learner-badge')).toBeNull()
})

it.each([
  ['P', P],
  ['L', L],
])(
  'AC 30 (%s): the playing learner’s picture, top-left, in a 56 × 56 target',
  async (_form, layout) => {
    await mount(layout, { learnerBadge: SAM })
    const { hit } = hubBadge(layout)
    expect(screen.getByTestId('hub-learner-badge')).toHaveStyle({
      position: 'absolute',
      left: hit.x,
      top: hit.y,
      width: 56,
      height: 56,
    })
    expect(screen.getByTestId('hub-learner-badge-avatar')).toHaveStyle({
      width: 48,
      height: 48,
      backgroundColor: AVATAR_COLORS.owl,
    })
  },
)

it('AC 30: a tap chimes, stops Emma’s line and opens the picker, with no confirm', async () => {
  const h = await mount(P, { learnerBadge: SAM })
  expect(h.player.playLine).toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('hub-learner-badge'))
  expect(h.chime).toHaveBeenCalledTimes(1)
  expect(h.player.cancelActive).toHaveBeenCalled()
  expect(h.onLearnerBadge).toHaveBeenCalledTimes(1)
  // Leaving: a card tap now does nothing.
  await fireEvent.press(screen.getByTestId('hub-card-number-garden'))
  expect(h.onPickTree).not.toHaveBeenCalled()
})

it('AC 30: Emma’s 3 s press still opens Parent Settings with the badge on screen', async () => {
  const h = await mount(P, { learnerBadge: SAM })
  await holdEmmaAt(P.emma.x + P.emma.width / 2, P.emma.y + P.emma.height / 2)
  expect(h.onParentLongPress).toHaveBeenCalledTimes(1)
})

it('AC 30: a 3 s press on the badge does not open Parent Settings (nor the picker)', async () => {
  const h = await mount(L, { learnerBadge: SAM })
  await fireEvent(screen.getByTestId('hub-learner-badge'), 'longPress')
  expect(h.onParentLongPress).not.toHaveBeenCalled()
  expect(h.onLearnerBadge).not.toHaveBeenCalled()
})

it('AC 30 (L): a hold that starts on Emma’s frame within 8 pt of the badge is left out', async () => {
  // On L the badge sits over the transparent corner of Emma's frame.
  const shared = overlap(badgeExclusion(L), L.emma)
  expect(shared).not.toBeNull()
  const h = await mount(L, { learnerBadge: SAM })
  await holdEmmaAt(shared!.x + 1, shared!.y + 1)
  expect(h.onParentLongPress).not.toHaveBeenCalled()
  // Outside it, the hold opens Parent Settings as before.
  await holdEmmaAt(
    L.emma.x + L.emma.width / 2,
    L.emma.y + (L.emma.height * 3) / 4,
  )
  expect(h.onParentLongPress).toHaveBeenCalledTimes(1)
})
