/**
 * The Hub's Play disc (play-place spec § 1.2, AC N2): shown exactly when
 * `openPlayGames(progress)` is non-empty, decided once at mount; a still
 * cream clay disc holding `ui-play` at `layout.play`; a tap plinks, cuts
 * Emma's line and calls `onOpenPlay` once; a 3 s hold that starts on it
 * (plus 8 pt) never opens Parent Settings; no Hub line changes.
 */
import { setDayOffsetSource, setKeyValueStore } from '@marian/core'
import { openPlayGames } from '@marian/core/games/playPlace'
import {
  defaultProgress,
  saveProgress,
  type SkillLevels,
} from '@marian/core/progress'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import {
  hubLayout,
  playExclusion,
  type HubLayout,
} from '../../layout/hubLayout'
import { Hub, type HubProps } from './Hub'
import { resetHubAudioForTests, type GuidancePlayer } from './hubAudio'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
const P = hubLayout({ width: 375, height: 667, insets: NO_INSETS })
const L = hubLayout({ width: 667, height: 375, insets: NO_INSETS })

function fakePlayer(): GuidancePlayer {
  return {
    playLine: jest.fn(() => new Promise<void>(() => {})),
    cancelActive: jest.fn(),
    unload: jest.fn(),
  }
}

/** The default profile: adding to ten current, so the raft is open. */
function seedDefault() {
  saveProgress(defaultProgress())
}

/** On numbers and letter names: no game open. */
function seedNoGame() {
  const p = defaultProgress()
  const locked = Object.fromEntries(
    Object.keys(p.skillLevels).map((k) => [k, 'locked']),
  ) as SkillLevels
  saveProgress({
    ...p,
    skillLevels: {
      ...locked,
      'number-recog': 'practicing',
      'letter-names': 'practicing',
    },
  })
}

async function mount(layout: HubLayout, props: Partial<HubProps> = {}) {
  const handlers = {
    onPickTree: jest.fn(),
    onOpenMap: jest.fn(),
    onParentLongPress: jest.fn(),
    onOpenPlay: jest.fn(),
    plink: jest.fn(),
  }
  const player = fakePlayer()
  await render(
    <Hub
      layout={layout}
      player={player}
      clock={() => new Date(2026, 9, 20, 15)}
      wallClock={() => 1_000_000}
      {...handlers}
      {...props}
    />,
  )
  await act(async () => {})
  return { ...handlers, player }
}

async function holdEmmaAt(x: number, y: number) {
  const target = screen.getByTestId('hub-emma-long-press')
  await fireEvent(target, 'pressIn', { nativeEvent: { pageX: x, pageY: y } })
  await fireEvent(target, 'longPress')
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

it('N2: no open game, no Play disc', async () => {
  seedNoGame()
  await mount(P)
  expect(screen.queryByTestId('hub-play')).toBeNull()
})

it.each([
  ['P', P],
  ['L', L],
])(
  'N2 (%s): an open game shows the disc at layout.play, holding ui-play',
  async (_form, layout) => {
    seedDefault()
    expect(openPlayGames(defaultProgress())).toEqual(['raft'])
    await mount(layout)
    const disc = screen.getByTestId('hub-play')
    expect(disc).toHaveStyle({
      position: 'absolute',
      left: layout.play.x,
      top: layout.play.y,
      width: layout.play.width,
      height: layout.play.height,
    })
    expect(disc.props.accessibilityRole).toBe('button')
    expect(disc.props.accessibilityLabel).toBe('Play')
    expect(screen.getAllByTestId('hub-play-art')).toHaveLength(1)
  },
)

it('N2: a tap plinks, cuts Emma’s line and calls onOpenPlay once', async () => {
  seedDefault()
  const h = await mount(P)
  expect(h.player.playLine).toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('hub-play'))
  await fireEvent.press(screen.getByTestId('hub-play'))
  expect(h.plink).toHaveBeenCalledTimes(1)
  expect(h.player.cancelActive).toHaveBeenCalled()
  expect(h.onOpenPlay).toHaveBeenCalledTimes(1)
  // Leaving: a card tap now does nothing.
  await fireEvent.press(screen.getByTestId('hub-card-number-garden'))
  expect(h.onPickTree).not.toHaveBeenCalled()
})

it('N2: a 3 s hold that starts on the disc (or 8 pt from it) does not open Parent Settings', async () => {
  seedDefault()
  const h = await mount(L)
  const ex = playExclusion(L)
  expect(ex).toEqual({
    x: L.play.x - 8,
    y: L.play.y - 8,
    width: L.play.width + 16,
    height: L.play.height + 16,
  })
  await holdEmmaAt(L.play.x + L.play.width / 2, L.play.y + L.play.height / 2)
  await holdEmmaAt(ex.x + 1, ex.y + 1)
  expect(h.onParentLongPress).not.toHaveBeenCalled()
  await holdEmmaAt(L.emma.x + L.emma.width / 2, L.emma.y + L.emma.height / 2)
  expect(h.onParentLongPress).toHaveBeenCalledTimes(1)
})

it('N2: no Hub line changes, and none names Play', async () => {
  seedNoGame()
  const without = await mount(P)
  const linesWithout = (without.player.playLine as jest.Mock).mock.calls.map(
    (c) => c[0],
  )
  screen.unmount()
  resetHubAudioForTests()
  seedDefault()
  const withDisc = await mount(P)
  const linesWith = (withDisc.player.playLine as jest.Mock).mock.calls.map(
    (c) => c[0],
  )
  expect(screen.getByTestId('hub-play')).toBeTruthy()
  for (const id of [...linesWith, ...linesWithout]) {
    expect(String(id)).not.toMatch(/play/i)
  }
})
