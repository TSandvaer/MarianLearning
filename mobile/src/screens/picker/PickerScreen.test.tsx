/**
 * "Who is playing?" (learner profiles § 1, ACs 27, 28, 38): the tiles in
 * add order with picture and name, one tap (chime, the chosen tile, the
 * route 400 ms later, later taps ignored), the line 300 ms after the tiles
 * land and once more 20 s after it ends, the bundled Lily clip on Emma's
 * channel, and nothing on a tile but the picture and the name.
 */
import type { AvatarId, LearnerEntry } from '@marian/core/learners'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { fakePlayers, flush, resetFakePlayers } from '../../../test/fakeAudio'
import { avatarAsset } from '../../assets'
import { audioEngine, type LineCallbacks } from '../../audio'
import { pickerLayout } from '../../layout/pickerLayout'
import { AVATAR_COLORS } from './avatars'
import {
  PICKER_LINE_ID,
  resetPickerAudioForTests,
  type PickerLinePlayer,
} from './pickerAudio'
import { PickerScreen } from './PickerScreen'
import {
  LINE_AFTER_TILES_MS,
  PICKER_REPROMPT_AFTER_MS,
  PICK_ROUTE_DELAY_MS,
  TILE_LAND_MS,
  TILE_STAGGER_MS,
  TILES_IN_AT_MS,
  pickerLineAt,
} from './pickerTiming'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }

function learner(n: number, name: string, avatarId: AvatarId): LearnerEntry {
  return {
    id: `0000000${n}-0000-4000-8000-00000000000${n}`,
    name,
    avatarId,
    language: 'en',
    legacySlot: n === 1,
    start: n === 1 ? 'legacy-default' : { math: 1, wordSong: 1 },
    createdAtISO: '2026-10-19T00:00:00.000Z',
  }
}

const MARIAN = learner(1, 'Marian', 'fox')
const SAM = learner(2, 'Sam', 'owl')
const ANA = learner(3, 'Ana', 'frog')

/** A line player whose line ends when the test says so. */
function fakeLinePlayer() {
  const live: { opts: LineCallbacks; end: () => void }[] = []
  const player: PickerLinePlayer = {
    playLine: jest.fn(
      (_id: typeof PICKER_LINE_ID, opts: LineCallbacks = {}) =>
        new Promise<void>((end) => live.push({ opts, end })),
    ),
    cancelActive: jest.fn(() => live.splice(0).forEach((l) => l.end())),
    unload: jest.fn(),
  }
  async function endLine() {
    const line = live.shift()!
    await act(async () => {
      line.opts.onPlay?.()
      for (let i = 0; i < 3; i++) line.opts.onWordTick?.(i)
      line.end()
    })
  }
  return { player, endLine }
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

async function mount(
  learners: readonly LearnerEntry[] = [MARIAN, SAM, ANA],
  withPlayer = true,
) {
  const f = fakeLinePlayer()
  const onPick = jest.fn()
  const chime = jest.fn()
  await render(
    <PickerScreen
      layout={pickerLayout(
        { width: 375, height: 667, insets: NO_INSETS },
        learners.length,
      )}
      learners={learners}
      onPick={onPick}
      player={withPlayer ? f.player : undefined}
      chime={chime}
    />,
  )
  return { ...f, onPick, chime }
}

beforeEach(() => {
  jest.useFakeTimers()
  resetFakePlayers()
  resetPickerAudioForTests()
})
afterEach(() => {
  jest.useRealTimers()
})

const TILE = /^picker-tile-(.+)$/
const tileIds = () =>
  screen
    .getAllByTestId(TILE)
    .map((t) => String(t.props.testID).replace(TILE, '$1'))

describe('AC 27: the tiles and a pick', () => {
  it('renders n tiles in add order, each with its picture and name', async () => {
    await mount()
    expect(tileIds()).toEqual([MARIAN.id, SAM.id, ANA.id])
    for (const l of [MARIAN, SAM, ANA]) {
      const tile = within(screen.getByTestId(`picker-tile-${l.id}`))
      expect(tile.getByTestId(`picker-name-${l.id}`)).toHaveTextContent(l.name)
      const disc = tile.getByTestId(`picker-avatar-${l.id}`)
      expect(disc).toHaveStyle({ backgroundColor: AVATAR_COLORS[l.avatarId] })
    }
  })

  it('§ 9: each tile’s disc carries its clay sticker, learner 1 the fox (T3)', async () => {
    await mount()
    for (const l of [MARIAN, SAM, ANA]) {
      const disc = within(screen.getByTestId(`picker-avatar-${l.id}`))
      const sticker = disc.getByTestId(`picker-avatar-${l.id}-sticker`)
      expect(avatarAsset(l.avatarId)).toBeDefined()
      // expo-image normalises `source` to a list.
      expect([sticker.props.source].flat()).toEqual([avatarAsset(l.avatarId)])
    }
    expect(MARIAN.avatarId).toBe('fox')
  })

  it('a tap: the chime and the chosen tile at once, the route 400 ms later; a second tap in that window is ignored', async () => {
    const h = await mount()
    await fireEvent.press(screen.getByTestId(`picker-tile-${SAM.id}`))
    expect(h.chime).toHaveBeenCalledTimes(1)
    expect(
      screen.getByTestId(`picker-tile-${SAM.id}`).props.accessibilityState,
    ).toMatchObject({ selected: true })
    expect(
      screen.getByTestId(`picker-tile-${MARIAN.id}`).props.accessibilityState,
    ).toMatchObject({ selected: false })
    await advance(PICK_ROUTE_DELAY_MS - 1)
    expect(h.onPick).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId(`picker-tile-${MARIAN.id}`))
    expect(h.chime).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(h.onPick).toHaveBeenCalledTimes(1)
    expect(h.onPick).toHaveBeenCalledWith(SAM)
    await advance(PICK_ROUTE_DELAY_MS)
    expect(h.onPick).toHaveBeenCalledTimes(1)
  })

  it('an unnamed learner: no name text, the line keeps its height', async () => {
    const unnamed = { ...MARIAN, name: '' }
    await mount([unnamed, SAM])
    expect(screen.queryByTestId(`picker-name-${unnamed.id}`)).toBeNull()
    expect(screen.getByTestId(`picker-name-${SAM.id}`)).toBeOnTheScreen()
  })
})

describe('AC 28: "Who is playing?"', () => {
  it('starts 300 ms after the last tile lands', () => {
    expect(pickerLineAt(3, false)).toBe(
      TILES_IN_AT_MS + 2 * TILE_STAGGER_MS + TILE_LAND_MS + LINE_AFTER_TILES_MS,
    )
    expect(LINE_AFTER_TILES_MS).toBe(300)
    expect(TILE_STAGGER_MS).toBe(60)
  })

  it('plays once when the tiles have landed, and once more 20 s after it ends without a tap', async () => {
    const h = await mount()
    const at = pickerLineAt(3, false)
    await advance(at - 1)
    expect(h.player.playLine).not.toHaveBeenCalled()
    await advance(1)
    expect(h.player.playLine).toHaveBeenCalledTimes(1)
    expect(h.player.playLine).toHaveBeenLastCalledWith(
      PICKER_LINE_ID,
      expect.anything(),
    )
    await h.endLine()
    // The caption keeps the line.
    expect(screen.getByTestId('picker-bubble')).toBeOnTheScreen()
    await advance(PICKER_REPROMPT_AFTER_MS - 1)
    expect(h.player.playLine).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(h.player.playLine).toHaveBeenCalledTimes(2)
    await h.endLine()
    await advance(5 * PICKER_REPROMPT_AFTER_MS)
    expect(h.player.playLine).toHaveBeenCalledTimes(2)
  })

  it('a tap before the re-prompt: no second line', async () => {
    const h = await mount()
    await advance(pickerLineAt(3, false))
    await h.endLine()
    await fireEvent.press(screen.getByTestId(`picker-tile-${ANA.id}`))
    await advance(PICKER_REPROMPT_AFTER_MS * 2)
    expect(h.player.playLine).toHaveBeenCalledTimes(1)
  })

  it('the bundled Lily clip plays on Emma’s channel', async () => {
    await mount(undefined, false)
    await advance(pickerLineAt(3, false))
    await act(async () => {
      await flush()
    })
    // One player for the line, on Emma's channel.
    expect(fakePlayers).toHaveLength(1)
    expect(audioEngine.voice.activeLabel).toBe('picker:guide.picker.who')
    await act(async () => {
      fakePlayers[0].start(1.28)
      await flush()
    })
    expect(screen.getByTestId('picker-bubble')).toBeOnTheScreen()
  })

  it('stops with the screen: no line after an unmount', async () => {
    const h = await mount()
    await screen.unmount()
    await advance(pickerLineAt(3, false) + PICKER_REPROMPT_AFTER_MS)
    expect(h.player.playLine).not.toHaveBeenCalled()
    expect(h.player.unload).toHaveBeenCalled()
  })
})

describe('AC 38: a tile is a picture and a name, nothing else', () => {
  it('renders no flower, star, level or count element', async () => {
    await mount()
    for (const l of [MARIAN, SAM, ANA]) {
      const ids = within(screen.getByTestId(`picker-tile-${l.id}`))
        .queryAllByTestId(/.*/)
        .map((el) => String(el.props.testID))
      expect(ids.sort()).toEqual(
        [
          `picker-avatar-${l.id}`,
          `picker-avatar-${l.id}-sticker`,
          `picker-name-${l.id}`,
        ].sort(),
      )
      const texts = within(screen.getByTestId(`picker-tile-${l.id}`))
        .queryAllByText(/./)
        .map((el) => el.props.children)
      expect(texts).toEqual([l.name])
    }
    expect(screen.queryByTestId(/flower|star|level|streak|count/)).toBeNull()
  })
})
