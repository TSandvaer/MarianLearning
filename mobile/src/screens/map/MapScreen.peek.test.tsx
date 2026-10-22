/**
 * The Map peek's map half (native spec `design/native/fast-track-native.md`
 * §§ 6.1, 6.4; AC 16), behind the locked-stop peek prompt
 * (`design/native/locked-stop-peek-prompt.md`, ACs 4-9, 11, 12): a later
 * stop's tap names the stop and asks "Want to try it?", and a round button
 * starts the peek. Taps wait while the request is out, a failure says the
 * stop's name, Home aborts it, and the map back from a peek opens quiet.
 * The line player and the effects are fakes; no audio plays.
 */
import { setKeyValueStore } from '@marian/core'
import { pathLine, type PathLine } from '@marian/core/emmasPath/pathLines'
import {
  defaultProgress,
  getSettings,
  STORAGE_KEY,
  type Progress,
  type SkillNode,
} from '@marian/core/progress'
import { seedUnlocksCelebrated } from '@marian/core/progress/pathBeats'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { BackHandler } from 'react-native'
import type { Sfx } from '../../audio'
import { mapScreenLayout } from '../../layout/mapScreenLayout'
import type { MapLinePlayer } from './mapAudio'
import { MapScreen } from './MapScreen'
import { MAP_TAP_ARM_MS, PEEK_ASK_GAP_MS } from './useMapVisit'

const P = mapScreenLayout({
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
})

const LOCKED_ASK = 'This one is locked. Want to try it?'

/**
 * A line player whose line in flight the test ends (`end`). Like the real
 * one, a new line or a cancel resolves the line in flight.
 */
function fakePlayer() {
  let inFlight: (() => void) | null = null
  const resolveInFlight = () => {
    const resolve = inFlight
    inFlight = null
    resolve?.()
  }
  const player = {
    play: jest.fn<Promise<void>, [PathLine]>(() => {
      resolveInFlight()
      return new Promise<void>((resolve) => {
        inFlight = resolve
      })
    }),
    cancel: jest.fn(() => resolveInFlight()),
    unload: jest.fn(),
  } satisfies MapLinePlayer
  const ids = () => player.play.mock.calls.map(([l]) => l.id)
  const end = async () => {
    await act(async () => {
      resolveInFlight()
      for (let i = 0; i < 5; i++) await Promise.resolve()
    })
  }
  return { player, ids, end }
}

function fakeSfx() {
  const played: string[] = []
  const create = jest.fn((effect: { src: string; volume: number }) => {
    const sfx: Sfx = {
      play: jest.fn(() => {
        played.push(effect.src)
        return true
      }),
      unload: jest.fn(),
      missedPlays: 0,
      loadFailed: false,
    }
    return sfx
  })
  return { create, played }
}

/** A peek request the test settles by hand. */
function fakePeek() {
  const calls: {
    node: SkillNode
    signal: AbortSignal
    settle: (opened: boolean) => void
  }[] = []
  const peek = jest.fn(
    (node: SkillNode, signal: AbortSignal) =>
      new Promise<boolean>((settle) => {
        calls.push({ node, signal, settle })
      }),
  )
  return { peek, calls }
}

/** sub-to-20 mastered since the marker was seeded: land 3 opened. */
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

/** add-to-10 current; sub-to-10 open after it (a parent set its level). */
function openLaterDoc(): Progress {
  const base = defaultProgress()
  return {
    ...base,
    skillLevels: { ...base.skillLevels, 'sub-to-10': 'practicing' },
  }
}

async function mount(doc: Progress, opts: { quietReturn?: boolean } = {}) {
  const { player, ids, end } = fakePlayer()
  const sfx = fakeSfx()
  const fake = fakePeek()
  const onHome = jest.fn()
  const onPlay = jest.fn(() => true)
  const back = jest.spyOn(BackHandler, 'addEventListener')
  await render(
    <MapScreen
      layout={P}
      world="math"
      onHome={onHome}
      onPeek={fake.peek}
      onPlay={onPlay}
      quietReturn={opts.quietReturn}
      readProgress={() => doc}
      createPlayer={() => player}
      createSfx={sfx.create}
      markUnlockCelebrated={jest.fn()}
      markLeft={jest.fn()}
      wallClock={() => 42}
    />,
  )
  const androidBack = back.mock.calls.at(-1)![1] as () => boolean
  back.mockRestore()
  // Stop taps count once the map has been up 400 ms (map-tap-to-play § 5).
  await act(async () => {
    jest.advanceTimersByTime(MAP_TAP_ARM_MS)
  })
  return {
    player,
    ids,
    end,
    sfx,
    ...fake,
    onHome,
    onPlay,
    back: async () => {
      await act(async () => {
        androidBack()
      })
    },
  }
}

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

const settle = async (call: { settle: (b: boolean) => void }, ok: boolean) => {
  await act(async () => {
    call.settle(ok)
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
}

const tap = (node: SkillNode) =>
  fireEvent.press(screen.getByTestId(`map-stop-${node}`))
const button = () => screen.queryByTestId('map-peek-button')
const caption = () => screen.queryByTestId('map-caption')?.props.children
const nameOf = (node: SkillNode) => pathLine(`path.stop.${node}`)!.text

/** Tap a later stop, let its name end and the 250 ms beat pass. */
async function ask(h: Awaited<ReturnType<typeof mount>>, node: SkillNode) {
  await tap(node)
  await h.end()
  await advance(PEEK_ASK_GAP_MS)
}

/** Tap a later stop and say yes on the button. */
async function askAndPress(
  h: Awaited<ReturnType<typeof mount>>,
  node: SkillNode,
) {
  await ask(h, node)
  await fireEvent.press(screen.getByTestId('map-peek-button'))
}

beforeEach(() => {
  jest.useFakeTimers()
  const store = new Map<string, string>()
  setKeyValueStore({
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  })
})
afterEach(() => jest.useRealTimers())

describe('the locked-stop peek prompt', () => {
  it('AC 4: a locked stop says its name, then asks; no peek, no poof, no wiggle, no pointing', async () => {
    const h = await mount(defaultProgress())
    expect(h.ids()).toEqual(['path.open.add-to-10'])
    await tap('add-to-20')
    expect(h.player.cancel).toHaveBeenCalled()
    expect(h.ids()).toEqual(['path.open.add-to-10', 'path.stop.add-to-20'])
    // Both sentences on the slab from the tap.
    expect(caption()).toBe(`${nameOf('add-to-20')} ${LOCKED_ASK}`)
    expect(screen.getByTestId('map-line-peek-ask.add-to-20')).toBeOnTheScreen()
    await h.end()
    await advance(PEEK_ASK_GAP_MS - 1)
    expect(h.ids()).toHaveLength(2)
    await advance(1)
    expect(h.ids()).toEqual([
      'path.open.add-to-10',
      'path.stop.add-to-20',
      'guide.map.peek-ask.locked',
    ])
    expect(caption()).toBe(`${nameOf('add-to-20')} ${LOCKED_ASK}`)
    expect(h.peek).not.toHaveBeenCalled()
    expect(h.sfx.played).toEqual([])
    expect(screen.getByTestId('map-emma-idle')).toBeOnTheScreen()
  })

  it('AC 4 (§ 1): an open later stop asks without the locked sentence', async () => {
    const h = await mount(openLaterDoc())
    await ask(h, 'sub-to-10')
    expect(h.ids().slice(-2)).toEqual([
      'path.stop.sub-to-10',
      'guide.map.peek-ask',
    ])
    expect(caption()).toBe(`${nameOf('sub-to-10')} Want to try it?`)
    expect(button()).toBeOnTheScreen()
  })

  it('AC 5: the button is absent until the question starts, and present after', async () => {
    const h = await mount(defaultProgress())
    await tap('add-to-20')
    expect(button()).toBeNull()
    await h.end()
    expect(button()).toBeNull()
    await advance(PEEK_ASK_GAP_MS)
    expect(button()).toBeOnTheScreen()
    expect(button()!.props.accessibilityLabel).toBe('Try it')
    expect(screen.getByTestId('map-peek-button-art')).toBeOnTheScreen()
  })

  it('AC 6: the button starts exactly today’s peek; stop and gate taps wait while it is out', async () => {
    const h = await mount(defaultProgress())
    await ask(h, 'add-to-20')
    const cancels = h.player.cancel.mock.calls.length
    await fireEvent.press(screen.getByTestId('map-peek-button'))
    expect(h.peek).toHaveBeenCalledTimes(1)
    expect(h.calls[0]!.node).toBe('add-to-20')
    expect(h.player.cancel.mock.calls.length).toBeGreaterThan(cancels)
    const said = h.ids().length
    await tap('add-to-20')
    await tap('mult-6-9')
    await tap('add-to-10')
    await fireEvent.press(screen.getByTestId('map-gate-2'))
    expect(h.peek).toHaveBeenCalledTimes(1)
    expect(h.ids()).toHaveLength(said)
    expect(button()).toBeNull()
  })

  it('AC 7: another later stop replaces the prompt with its own', async () => {
    const h = await mount(defaultProgress())
    await ask(h, 'add-to-20')
    await tap('mult-6-9')
    expect(button()).toBeNull()
    expect(h.ids().at(-1)).toBe('path.stop.mult-6-9')
    expect(caption()).toBe(`${nameOf('mult-6-9')} ${LOCKED_ASK}`)
    await h.end()
    await advance(PEEK_ASK_GAP_MS)
    expect(button()).toBeOnTheScreen()
    await fireEvent.press(screen.getByTestId('map-peek-button'))
    expect(h.calls.map((c) => c.node)).toEqual(['mult-6-9'])
  })

  it('AC 7: a gate closes the prompt and says its land', async () => {
    const h = await mount(defaultProgress())
    await ask(h, 'add-to-20')
    await fireEvent.press(screen.getByTestId('map-gate-2'))
    expect(button()).toBeNull()
    expect(h.ids().at(-1)).toBe('path.land.math.2')
    expect(h.peek).not.toHaveBeenCalled()
  })

  it('AC 7: the current stop closes the prompt and starts its session', async () => {
    const h = await mount(defaultProgress())
    await ask(h, 'add-to-20')
    await tap('add-to-10')
    expect(button()).toBeNull()
    await advance(1000)
    expect(h.onPlay).toHaveBeenCalledWith('add-to-10')
    expect(h.peek).not.toHaveBeenCalled()
  })

  it('AC 7: a tap on the empty map closes the prompt silently: the line is cut, the caption clears', async () => {
    const h = await mount(defaultProgress())
    await ask(h, 'add-to-20')
    const said = h.ids().length
    const cancels = h.player.cancel.mock.calls.length
    await fireEvent.press(screen.getByTestId('map-pane-tap'))
    expect(button()).toBeNull()
    expect(screen.queryByTestId('map-ribbon')).toBeNull()
    expect(h.player.cancel.mock.calls.length).toBeGreaterThan(cancels)
    expect(h.ids()).toHaveLength(said)
    expect(h.peek).not.toHaveBeenCalled()
  })

  it('AC 7: Android back closes the prompt first; a second back goes Home', async () => {
    const h = await mount(defaultProgress())
    await ask(h, 'add-to-20')
    await h.back()
    expect(button()).toBeNull()
    expect(h.onHome).not.toHaveBeenCalled()
    expect(h.peek).not.toHaveBeenCalled()
    await h.back()
    expect(h.onHome).toHaveBeenCalledTimes(1)
  })

  it('AC 8: the same stop again replays the question only; the button and the caption stay', async () => {
    const h = await mount(defaultProgress())
    await ask(h, 'add-to-20')
    const before = caption()
    await tap('add-to-20')
    expect(button()).toBeOnTheScreen()
    expect(h.ids().slice(-2)).toEqual([
      'guide.map.peek-ask.locked',
      'guide.map.peek-ask.locked',
    ])
    expect(h.ids().filter((id) => id === 'path.stop.add-to-20')).toHaveLength(1)
    expect(caption()).toBe(before)
    await h.end()
    await advance(5000)
    expect(button()).toBeOnTheScreen()
    expect(h.peek).not.toHaveBeenCalled()
  })

  it('AC 8: the same stop during its name starts nothing; the question and the button still come', async () => {
    const h = await mount(defaultProgress())
    await tap('add-to-20')
    await tap('add-to-20')
    expect(h.ids()).toEqual(['path.open.add-to-10', 'path.stop.add-to-20'])
    expect(h.player.play).toHaveBeenCalledTimes(2)
    await h.end()
    await advance(PEEK_ASK_GAP_MS)
    expect(h.ids().at(-1)).toBe('guide.map.peek-ask.locked')
    expect(button()).toBeOnTheScreen()
    expect(h.peek).not.toHaveBeenCalled()
  })

  it('AC 9: a close during the name never starts the question nor shows the button', async () => {
    const h = await mount(defaultProgress())
    await tap('add-to-20')
    await fireEvent.press(screen.getByTestId('map-pane-tap'))
    await h.end()
    await advance(PEEK_ASK_GAP_MS * 4)
    expect(h.ids()).toEqual(['path.open.add-to-10', 'path.stop.add-to-20'])
    expect(button()).toBeNull()

    await tap('add-to-20')
    await h.back()
    await h.end()
    await advance(PEEK_ASK_GAP_MS * 4)
    expect(h.ids().filter((id) => id.startsWith('guide.map.'))).toEqual([])
    expect(button()).toBeNull()
  })

  it('AC 9: a close during the 250 ms beat never starts the question', async () => {
    const h = await mount(defaultProgress())
    await tap('add-to-20')
    await h.end()
    await advance(PEEK_ASK_GAP_MS / 2)
    await fireEvent.press(screen.getByTestId('map-gate-2'))
    await advance(PEEK_ASK_GAP_MS * 4)
    expect(h.ids().filter((id) => id.startsWith('guide.map.'))).toEqual([])
    expect(button()).toBeNull()
  })

  it('AC 11: waiting 30 s plays nothing more, and the button stays', async () => {
    const h = await mount(defaultProgress())
    await ask(h, 'add-to-20')
    await h.end()
    const said = h.ids().length
    await advance(30_000)
    expect(h.ids()).toHaveLength(said)
    expect(button()).toBeOnTheScreen()
    expect(h.peek).not.toHaveBeenCalled()
  })

  it('AC 12: a prompt closed without a peek writes nothing', async () => {
    const store = new Map<string, string>()
    const writes: string[] = []
    setKeyValueStore({
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        writes.push(k)
        store.set(k, v)
      },
      removeItem: (k) => void store.delete(k),
    })
    const doc = defaultProgress()
    store.set(STORAGE_KEY, JSON.stringify(doc))
    const before = store.get(STORAGE_KEY)
    const h = await mount(doc)
    await ask(h, 'add-to-20')
    await tap('add-to-20')
    await fireEvent.press(screen.getByTestId('map-pane-tap'))
    await ask(h, 'mult-6-9')
    await h.back()
    expect(store.get(STORAGE_KEY)).toBe(before)
    expect(writes).toEqual([])
  })

  it('unmounting with the beat pending clears its timer', async () => {
    const h = await mount(defaultProgress())
    await tap('add-to-20')
    await h.end()
    await screen.unmount()
    await advance(PEEK_ASK_GAP_MS * 4)
    expect(h.ids().filter((id) => id.startsWith('guide.map.'))).toEqual([])
  })
})

describe('the Map peek behind the prompt (fast-track § 6)', () => {
  it('AC 16: stop and gate taps wait while the request is out; success leaves the map quiet', async () => {
    const h = await mount(defaultProgress())
    await askAndPress(h, 'add-to-20')
    const said = h.ids()
    await tap('add-to-10')
    await fireEvent.press(screen.getByTestId('map-gate-2'))
    await tap('sub-to-10')
    expect(h.peek).toHaveBeenCalledTimes(1)
    expect(h.ids()).toEqual(said)
    await settle(h.calls[0]!, true)
    expect(h.ids()).toEqual(said)
  })

  it('AC 16: a failed request says the stop’s name, and taps resume; the prompt does not come back', async () => {
    const h = await mount(defaultProgress())
    await askAndPress(h, 'add-to-20')
    await settle(h.calls[0]!, false)
    expect(h.ids().at(-1)).toBe('path.stop.add-to-20')
    expect(caption()).toBe(pathLine('path.stop.add-to-20')!.text)
    await advance(5000)
    expect(button()).toBeNull()
    await tap('add-to-10')
    await advance(1000)
    expect(h.onPlay).toHaveBeenCalledWith('add-to-10')
  })

  it('AC 16: taps during the unlock beat are ignored; at her line a later stop asks', async () => {
    const h = await mount(landUnlockDoc())
    await advance(1000)
    await tap('mult-6-9')
    expect(h.ids()).toEqual([])
    await advance(1100) // 2100: Emma's line
    await ask(h, 'mult-6-9')
    expect(h.ids().slice(-2)).toEqual([
      'path.stop.mult-6-9',
      'guide.map.peek-ask.locked',
    ])
    await fireEvent.press(screen.getByTestId('map-peek-button'))
    expect(h.peek).toHaveBeenCalledTimes(1)
  })

  it('Home aborts the request in flight; its failure then says nothing', async () => {
    const h = await mount(defaultProgress())
    await askAndPress(h, 'add-to-20')
    const said = h.ids()
    await fireEvent.press(screen.getByTestId('map-home'))
    expect(h.onHome).toHaveBeenCalledTimes(1)
    expect(h.calls[0]!.signal.aborted).toBe(true)
    await settle(h.calls[0]!, false)
    expect(h.ids()).toEqual(said)
  })

  it('§ 6.4: back from a peek, no open line, an empty caption and no prompt', async () => {
    const h = await mount(defaultProgress(), { quietReturn: true })
    expect(h.ids()).toEqual([])
    expect(screen.queryByTestId('map-ribbon')).toBeNull()
    expect(button()).toBeNull()
    await advance(30_000)
    expect(h.ids()).toEqual([])
  })
})
