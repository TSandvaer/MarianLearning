/**
 * The native Hub against design/native/hub-native.md's acceptance list:
 * Emma speaks on mount with no tap, the bubble follows her words, a card
 * tap silences her before the history write and the route, the map plinks,
 * the 3 s press on Emma, the glow, the sleeping and waking flowers, and
 * the 30 s rapid-remount silence. The line player is a fake.
 */
import { setDayOffsetSource, setKeyValueStore } from '@marian/core'
import {
  FLOWER_WAKE_STORAGE_KEY,
  GUIDANCE_LINES,
  LINE_GAP_MS,
  type GuidanceLineId,
} from '@marian/core/hub/hubGuidance'
import {
  defaultProgress,
  saveProgress,
  type SessionHistoryEntry,
  type SkillLevels,
  type SkillNode,
} from '@marian/core/progress'
import { getKeyValueStore } from '@marian/core/platform/keyValueStore'
import { readSessionHistory } from '@marian/core/sessionEnd/sessionHistory'
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native'
import type { LineCallbacks } from '../../audio'
import { hubLayout } from '../../layout/hubLayout'
import { Hub, PARENT_LONG_PRESS_MS, type HubProps } from './Hub'
import {
  RAPID_REMOUNT_MS,
  resetHubAudioForTests,
  type GuidancePlayer,
} from './hubAudio'

const LAYOUT = hubLayout({
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
})
/** Oct 10 2026, 3 pm local. */
const DAY = (d: number) => new Date(2026, 9, d, 15, 0)

function entry(d: number, node: SkillNode): SessionHistoryEntry {
  return {
    dateISO: new Date(2026, 9, d, 12).toISOString(),
    skillFocus: [node],
    successRate: 1,
  }
}

function seed(history: SessionHistoryEntry[]) {
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
    history,
  })
}

/** A line player whose lines end when the test says so. */
function fakePlayer() {
  const log: string[] = []
  const live: { id: GuidanceLineId; opts: LineCallbacks; end: () => void }[] =
    []
  const player: GuidancePlayer = {
    playLine: jest.fn(
      (id: GuidanceLineId, opts: LineCallbacks = {}) =>
        new Promise<void>((end) => {
          log.push(`play ${id}`)
          live.push({ id, opts, end })
        }),
    ),
    cancelActive: jest.fn(() => {
      log.push('cancel')
      live.splice(0).forEach((l) => l.end())
    }),
    unload: jest.fn(() => log.push('unload')),
  }
  /** Tick every word of the current line, then end it. */
  async function speakAll() {
    const line = live.shift()!
    const words = GUIDANCE_LINES[line.id].text.split(/\s+/).length
    await act(async () => {
      line.opts.onPlay?.()
      for (let i = 0; i < words; i++) line.opts.onWordTick?.(i)
      line.end()
    })
  }
  return { player, log, live, speakAll }
}

/** Wall-clock ms the rapid-remount rule sees. */
let wallMs = 0

async function mount(props: Partial<HubProps> & { day?: number } = {}) {
  const f = fakePlayer()
  const handlers = {
    onPickTree: jest.fn(),
    onOpenMap: jest.fn(),
    onParentLongPress: jest.fn(),
    plink: jest.fn(),
  }
  const day = props.day ?? 10
  const view = await render(
    <Hub
      layout={LAYOUT}
      player={f.player}
      clock={() => DAY(day)}
      wallClock={() => wallMs}
      {...handlers}
      {...props}
    />,
  )
  await act(async () => {})
  return { ...f, ...handlers, view }
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
  wallMs = 1_000_000
})

afterEach(() => {
  jest.useRealTimers()
})

it('Emma speaks on mount with no tap; the bubble waits for her first word', async () => {
  seed([])
  const h = await mount()
  expect(h.log).toEqual(['play guide.grow.word-song'])
  expect(screen.queryByTestId('hub-bubble')).toBeNull()
  await h.speakAll()
  expect(screen.getByTestId('hub-bubble').props.accessibilityLabel).toBe(
    GUIDANCE_LINES['guide.grow.word-song'].text,
  )
  // Fresh start: a tie, Word Song glows; the other card is the same size.
  expect(screen.getByTestId('hub-card-suggested')).toBeOnTheScreen()
  expect(screen.getAllByTestId('hub-card-ring')).toHaveLength(1)
  expect(LAYOUT.cards[0].width).toBe(LAYOUT.cards[1].width)
})

it('next morning: the wake-up, 1.2 s, then the next action; the bubble keeps the last line', async () => {
  seed([entry(9, 'number-recog'), entry(9, 'letter-names')])
  const h = await mount()
  expect(screen.getAllByTestId('hub-slot-waking')).toHaveLength(2)
  expect(h.log).toEqual(['play guide.woke-up'])
  await h.speakAll()
  await act(async () => {
    jest.advanceTimersByTime(LINE_GAP_MS - 1)
  })
  expect(h.log).toHaveLength(1)
  await act(async () => {
    jest.advanceTimersByTime(1)
  })
  expect(h.log).toEqual(['play guide.woke-up', 'play guide.grow.word-song'])
  // A new line: the bubble re-enters with its first word.
  expect(screen.queryByTestId('hub-bubble')).toBeNull()
  await h.speakAll()
  expect(screen.getByTestId('hub-bubble').props.accessibilityLabel).toBe(
    GUIDANCE_LINES['guide.grow.word-song'].text,
  )
  // The wake is recorded at mount: the next visit shows no wake.
  expect(
    JSON.parse(getKeyValueStore()!.getItem(FLOWER_WAKE_STORAGE_KEY)!),
  ).toEqual({
    math: '2026-10-09',
    'word-song': '2026-10-09',
  })
})

it('a flower earned today sleeps; next day it wakes once; then it is just open', async () => {
  seed([entry(10, 'number-recog')])
  let h = await mount({ day: 10 })
  expect(screen.getByTestId('hub-slot-sleeping')).toBeOnTheScreen()
  expect(h.log).toEqual(['play guide.sleeping.word-song'])
  await h.view.unmount()
  wallMs += RAPID_REMOUNT_MS

  h = await mount({ day: 11 })
  expect(screen.getAllByTestId('hub-slot-waking')).toHaveLength(1)
  expect(h.log[0]).toBe('play guide.hub.woke.one')
  await h.view.unmount()
  wallMs += RAPID_REMOUNT_MS

  h = await mount({ day: 11 })
  expect(screen.queryByTestId('hub-slot-waking')).toBeNull()
  expect(screen.getAllByTestId('hub-slot-grown')).toHaveLength(1)
  expect(h.log).toEqual(['play guide.grow.number-garden'])
})

it('a card tap silences her at once, then writes the outcome, then routes', async () => {
  seed([])
  const h = await mount()
  h.onPickTree.mockImplementation(() => h.log.push('route'))
  await fireEvent.press(screen.getByTestId('hub-card-number-garden'))
  expect(h.log).toEqual(['play guide.grow.word-song', 'cancel', 'route'])
  expect(h.onPickTree).toHaveBeenCalledWith('number-garden')
  expect(readSessionHistory().lastSuggestion).toBe('word-song')
  expect(h.plink).not.toHaveBeenCalled()
  // No later line, even after the gap.
  await act(async () => {
    jest.advanceTimersByTime(LINE_GAP_MS * 2)
  })
  expect(h.player.playLine).toHaveBeenCalledTimes(1)
})

it('the map button plinks, silences her and opens the map, never the world', async () => {
  seed([])
  const h = await mount()
  await fireEvent.press(screen.getByTestId('hub-map-math'))
  expect(h.plink).toHaveBeenCalledTimes(1)
  expect(h.player.cancelActive).toHaveBeenCalledTimes(1)
  expect(h.onOpenMap).toHaveBeenCalledWith('math')
  expect(h.onPickTree).not.toHaveBeenCalled()
})

it('only a 3 s press on Emma opens Parent Settings; a tap or a 2 s press does nothing', async () => {
  seed([])
  const h = await mount()
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
  const target = screen.getByTestId('hub-emma-long-press')
  await user.press(target)
  await user.longPress(target, { duration: 2000 })
  expect(h.onParentLongPress).not.toHaveBeenCalled()
  await user.longPress(target, { duration: PARENT_LONG_PRESS_MS + 100 })
  expect(h.onParentLongPress).toHaveBeenCalledTimes(1)
  // A long press on a card never opens it (it starts the world on release).
  await user.longPress(screen.getByTestId('hub-card-word-song'), {
    duration: PARENT_LONG_PRESS_MS + 100,
  })
  expect(h.onParentLongPress).toHaveBeenCalledTimes(1)
  expect(h.onPickTree).toHaveBeenCalledWith('word-song')
})

it('a return within 30 s: no line and no bubble; after 30 s she speaks again', async () => {
  seed([])
  let h = await mount()
  await h.view.unmount()
  expect(h.log).toEqual(['play guide.grow.word-song', 'cancel', 'unload'])
  wallMs += RAPID_REMOUNT_MS - 1
  h = await mount()
  expect(h.log).toEqual([])
  expect(screen.queryByTestId('hub-bubble')).toBeNull()
  await h.view.unmount()
  wallMs += RAPID_REMOUNT_MS
  h = await mount()
  expect(h.log).toEqual(['play guide.grow.word-song'])
})

it('both flowers sleeping: no glow, "Both flowers are sleeping"', async () => {
  seed([entry(10, 'number-recog'), entry(10, 'letter-names')])
  const h = await mount()
  expect(screen.queryByTestId('hub-card-suggested')).toBeNull()
  expect(h.log).toEqual(['play guide.both-sleeping'])
})
