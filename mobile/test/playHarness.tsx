/**
 * The Play-place games' test harness: `PlayGameScreen` with fake lines
 * (each resolves 10 ms after it starts, or at once when cut), fake
 * effects, a switchable visibility store, a seeded rng and a fake
 * tap-sound player whose sounds end after their window (a whole clip:
 * at its word's end + 200 ms). Touches go through the drag layer's
 * responder props.
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import type { PlayGameId } from '@marian/core/games/playPlace'
import { act, fireEvent, render, screen } from '@testing-library/react-native'

type ReactTestInstance = ReturnType<typeof screen.getByTestId>
import type { Sfx } from '../src/audio'
import type { TapClipPlayer } from '../src/audio/tapClip'
import type { Viewport } from '../src/layout/layout'
import { mathLayout } from '../src/layout/mathLayout'
import type { AppVisibility } from '../src/lifecycle/appVisibility'
import { resetDragForTests } from '../src/screens/play/dragLock'
import { PlayGameScreen } from '../src/screens/play/PlayGameScreen'
import type { Point } from '../src/screens/play/playGeometry'
import type { PlaySfx } from '../src/screens/play/playKit'
import type { PlayLinePlayer } from '../src/screens/play/playLines'

export const LINE_MS = 10
const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
export const PHONE_P: Viewport = { width: 375, height: 667, insets: NO_INSETS }
export const PHONE_L: Viewport = { width: 667, height: 375, insets: NO_INSETS }

export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function fakeLines(lineMs = LINE_MS) {
  const lines: string[] = []
  let pending: (() => void) | null = null
  const player: PlayLinePlayer = {
    playLine: jest.fn((id: string, opts) => {
      lines.push(id)
      return new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          pending = null
          resolve()
        }, lineMs)
        opts?.onWordTick?.(0)
        pending = () => {
          clearTimeout(timer)
          pending = null
          resolve()
        }
      })
    }),
    cancelActive: jest.fn(() => pending?.()),
    unload: jest.fn(),
  }
  return { player, lines }
}

function fakeSfx(): Sfx & { play: jest.Mock } {
  return {
    play: jest.fn(() => true),
    unload: jest.fn(),
    missedPlays: 0,
    loadFailed: false,
  }
}

export function fakePlaySfx() {
  return {
    plink: fakeSfx(),
    sparkle: fakeSfx(),
    cheer: fakeSfx(),
    splash: fakeSfx(),
    boing: fakeSfx(),
  } satisfies PlaySfx
}

export function fakeVisibility() {
  let hidden = false
  const subs = new Set<() => void>()
  const store: AppVisibility = {
    getIsHidden: () => hidden,
    subscribe: (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
  return {
    store,
    set(next: boolean) {
      hidden = next
      subs.forEach((fn) => fn())
    },
  }
}

export interface SoundCall {
  uri: string | number
  from: number
  to: number | null
}

export function fakeSounds(wholeMs: (uri: string | number) => number) {
  const calls: SoundCall[] = []
  let end: (() => void) | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const stop = () => {
    if (timer) clearTimeout(timer)
    timer = null
    const fn = end
    end = null
    fn?.()
  }
  const sounds: TapClipPlayer & { cut: jest.Mock } = {
    play: (uri, from, to, onEnd) => {
      stop()
      calls.push({ uri, from, to })
      end = onEnd ?? null
      const ms = (to ?? wholeMs(uri)) - from
      timer = setTimeout(stop, Math.max(0, ms))
    },
    cut: jest.fn(() => stop()),
    release: () => stop(),
    get playing() {
      return end !== null
    },
  }
  return { sounds, calls }
}

export async function mountGame(
  game: PlayGameId,
  opts: {
    viewport?: Viewport
    shore?: readonly number[]
    rng?: () => number
    words?: readonly string[]
    sounds?: TapClipPlayer
    hunt?: boolean
    /** How long each fake line lasts (default `LINE_MS`). */
    lineMs?: number
  } = {},
) {
  resetDragForTests()
  const lines = fakeLines(opts.lineMs)
  const sfx = fakePlaySfx()
  const visibility = fakeVisibility()
  const poses: EmmaPose[] = []
  const onExit = jest.fn()
  const viewport = opts.viewport ?? PHONE_P
  const props = {
    game,
    onExit,
    onPoseChange: (p: EmmaPose) => poses.push(p),
    linePlayer: lines.player,
    sfx,
    visibility: visibility.store,
    rng: opts.rng ?? seeded(3),
    shore: opts.shore,
    words: opts.words,
    sounds: opts.sounds,
    hunt: opts.hunt,
  }
  const view = await render(
    <PlayGameScreen
      layout={mathLayout(viewport)}
      viewport={viewport}
      {...props}
    />,
  )
  await act(async () => {})
  const relayout = async (v: Viewport) => {
    await view.rerender(
      <PlayGameScreen layout={mathLayout(v)} viewport={v} {...props} />,
    )
    await act(async () => {})
  }
  /** Leaving the game (Back, as App unmounts it). */
  const unmount = async () => {
    await act(async () => view.unmount())
  }
  return { ...lines, sfx, visibility, poses, onExit, relayout, unmount }
}

/**
 * Advances the fake clock in 10 ms steps, flushing promise callbacks
 * between steps (a line's end resolves a promise; its `.then` must run at
 * its time, as on a device, not after the whole jump).
 */
export async function advance(ms: number) {
  let left = ms
  while (left > 0) {
    const step = Math.min(10, left)
    left -= step
    await act(async () => {
      jest.advanceTimersByTime(step)
    })
  }
}

// One finger, as the native event carries it (the drag layer follows its
// `identifier`).
const touch = (p: Point) => {
  const t = { identifier: '1', pageX: p.x, pageY: p.y }
  return { nativeEvent: { ...t, changedTouches: [t], touches: [t] } }
}

/**
 * One responder event, straight to the piece's handler (RNTL's
 * `fireEvent` does not deliver the responder family here); each in its
 * own act, as the native responder system delivers them.
 */
async function send(el: ReactTestInstance, name: string, p: Point) {
  await act(async () => {
    const handler = el.props[name] as ((e: unknown) => void) | undefined
    if (
      name === 'onResponderGrant' &&
      el.props.onStartShouldSetResponder?.() !== true
    ) {
      return
    }
    handler?.(touch(p))
  })
}

export async function tap(el: ReactTestInstance) {
  await send(el, 'onResponderGrant', { x: 0, y: 0 })
  await send(el, 'onResponderRelease', { x: 0, y: 0 })
}

/** A drag whose finger starts at (0, 0) and lets go at `to`. */
export async function dragTo(el: ReactTestInstance, to: Point) {
  await dragStart(el, to)
  await dragRelease(el, to)
}

/** Starts a drag and leaves the finger down at `to`. */
export async function dragStart(el: ReactTestInstance, to: Point) {
  await send(el, 'onResponderGrant', { x: 0, y: 0 })
  await send(el, 'onResponderMove', { x: to.x / 2 + 20, y: to.y / 2 + 20 })
  await send(el, 'onResponderMove', to)
}

/** Lets go of a drag started with `dragStart`. */
export async function dragRelease(el: ReactTestInstance, at: Point) {
  await send(el, 'onResponderRelease', at)
}

export async function activate(el: ReactTestInstance, actionName = 'activate') {
  await fireEvent(el, 'accessibilityAction', { nativeEvent: { actionName } })
}

export const byId = (id: string) => screen.getByTestId(id)
export const has = (id: string) => screen.queryByTestId(id) !== null
