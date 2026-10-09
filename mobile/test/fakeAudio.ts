/**
 * A fake expo-audio player for the audio contract tests. `test/setup.ts`
 * mocks `expo-audio` with this module, so no jest run can reach a native
 * player (and none can make a sound); the engine tests also inject
 * `fakePlayerFactory` directly.
 *
 * The test drives the clock: `emit({ playing, currentTime, ... })` is what
 * expo-audio's `playbackStatusUpdate` would deliver every 50 ms.
 */
import type {
  PlayerFactory,
  PlayerLike,
  PlayerSource,
  PlayerStatus,
} from '../src/audio/playerPort'

export class FakePlayer implements PlayerLike {
  readonly source: PlayerSource
  readonly options: unknown
  playing = false
  currentTime = 0
  duration = 0
  muted = false
  volume = 1
  removed = false
  released = false
  readonly calls: string[] = []
  private listeners = new Set<(s: PlayerStatus) => void>()

  constructor(source: PlayerSource, options?: unknown) {
    this.source = source
    this.options = options
  }

  play(): void {
    this.calls.push('play')
  }
  pause(): void {
    this.calls.push('pause')
    this.playing = false
  }
  seekTo(seconds: number): Promise<void> {
    this.calls.push(`seekTo(${seconds})`)
    this.currentTime = seconds
    return Promise.resolve()
  }
  /** Registry entry dropped (expo-audio `remove()`); native player alive. */
  remove(): void {
    this.calls.push('remove')
    this.removed = true
  }
  /** Native player freed (`SharedObject.release()`). */
  release(): void {
    this.calls.push('release')
    this.released = true
    this.listeners.clear()
  }
  addListener(
    _event: 'playbackStatusUpdate',
    listener: (s: PlayerStatus) => void,
  ) {
    this.listeners.add(listener)
    return { remove: () => this.listeners.delete(listener) }
  }

  get listenerCount(): number {
    return this.listeners.size
  }

  /** Deliver one status update (fields default to the player's state). */
  emit(partial: Partial<PlayerStatus> = {}): void {
    const status: PlayerStatus = {
      playing: partial.playing ?? this.playing,
      currentTime: partial.currentTime ?? this.currentTime,
      duration: partial.duration ?? this.duration,
      didJustFinish: partial.didJustFinish ?? false,
      isLoaded: partial.isLoaded ?? true,
      error: partial.error ?? null,
    }
    this.playing = status.playing
    this.currentTime = status.currentTime
    this.duration = status.duration
    for (const l of Array.from(this.listeners)) l(status)
  }

  /** The OS (or a test) starts playback at t = 0. */
  start(duration: number): void {
    this.emit({ playing: true, currentTime: 0, duration })
  }

  /** Natural end. */
  finish(): void {
    this.emit({
      playing: false,
      currentTime: this.duration,
      didJustFinish: true,
    })
  }
}

/** Every fake created through the mock or the factory, in order. */
export const fakePlayers: FakePlayer[] = []

export const fakePlayerFactory: PlayerFactory = (source) => {
  const p = new FakePlayer(source)
  fakePlayers.push(p)
  return p
}

export function resetFakePlayers(): void {
  fakePlayers.length = 0
}

/** Lets pending promise callbacks (e.g. the rewind before play) run. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

// ── `expo-audio` module mock surface ────────────────────────────────────

export const createAudioPlayer = jest.fn(
  (source: PlayerSource, options?: unknown) => {
    const p = new FakePlayer(source, options)
    fakePlayers.push(p)
    return p
  },
)

export const setAudioModeAsync = jest.fn(() => Promise.resolve())
export const setIsAudioActiveAsync = jest.fn(() => Promise.resolve())
