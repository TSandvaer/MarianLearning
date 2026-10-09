/**
 * Audio check: a debug-only run of the engine end to end, for measuring
 * on a simulator / emulator / device before any screen is wired.
 *
 *   EXPO_PUBLIC_AUDIO_CHECK=1 EXPO_PUBLIC_MUTE=1 npx expo start --go --clear
 *
 * About 2 s after launch it runs, one after another, logging to Metro:
 *   0. `[audio-probe]` the raw status stream of one player (muted, volume
 *      0, and under expo-audio's default session): tells "no onPlay" apart
 *      from "no status events" / "clock never moves" on a new OS or device;
 *   1. a Greet line on a cold player, then on a preloaded one;
 *   2. a live `/api/claude` math session-start (fetch, background writes);
 *   3. a session line on a cold player, then on a prewarmed one;
 *   4. two SFX (chime, sparkle);
 *   5. `[audio-limit]` how many players load at once before one fails
 *      (Android: one MP3 decoder per player). Runs last: exhausting the
 *      decoders breaks every player created after it for a while.
 * Every row is `[audio] ...`; a summary line `[audio-check] done` ends it.
 *
 * The session-start is the same request the web's Math mount makes for a
 * first-session child (`track: 'math', level: 1, childName: 'Marian'`).
 */
import { setAudioModeAsync } from 'expo-audio'
import { readAudioLog, recordAudio } from '../audioLog'
import { AUDIO_MODE } from '../lifecycle'
import { audioForWebPath } from '../bundledAudio'
import { audioEngine } from '../engine'
import {
  GREET_LINE_SOURCES,
  loadGreetAudio,
  playGreetLine,
} from '../greetAudio'
import { WEB_AUDIO_MODULES } from '../audioRegistry'
import { createExpoPlayer, disposePlayer, type PlayerLike } from '../playerPort'
import { SFX_SOURCES, createSfx } from '../sfx'
import { startSession } from '../sessionStart'

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), ms))

/**
 * Step 0: the raw status stream of one player, so "no onPlay" can be told
 * apart from "no status events" or "never loads" on a new device / OS.
 */
async function probeRawStatus(
  log: (line: string) => void,
  variant: 'factory' | 'volume0',
): Promise<void> {
  const source = audioForWebPath(GREET_LINE_SOURCES.hi)
  if (source === undefined) {
    log('[audio-probe] greet hi not bundled')
    return
  }
  const player = createExpoPlayer(source)
  if (variant === 'volume0') {
    // Silent without isMuted: tells a mute-specific stall from a dead route.
    player.muted = false
    player.volume = 0
  }
  log(
    `[audio-probe] variant=${variant} muted=${player.muted} volume=${player.volume}`,
  )
  let n = 0
  const sub = player.addListener('playbackStatusUpdate', (s) => {
    n += 1
    if (n <= 12 || s.didJustFinish || s.error) {
      const raw = s as unknown as Record<string, unknown>
      log(
        `[audio-probe] #${n} playing=${s.playing} loaded=${s.isLoaded} ` +
          `t=${s.currentTime.toFixed(3)} dur=${s.duration.toFixed(3)} ` +
          `tcs=${String(raw.timeControlStatus)} wait=${String(raw.reasonForWaitingToPlay)} ` +
          `finished=${s.didJustFinish} error=${String(s.error)}`,
      )
    }
  })
  await wait(1_000)
  log(
    `[audio-probe] before play: playing=${player.playing} t=${player.currentTime} dur=${player.duration}`,
  )
  player.play()
  await wait(1_500)
  log(
    `[audio-probe] +1.5 s: playing=${player.playing} t=${player.currentTime} dur=${player.duration} events=${n}`,
  )
  await wait(1_500)
  sub.remove()
  disposePlayer(player)
}

/** Resolves when a player reports loaded (true) / an error or 2 s (false). */
function waitLoaded(player: PlayerLike): Promise<string> {
  return new Promise((resolve) => {
    if (player.duration > 0) {
      resolve('ok')
      return
    }
    const timer = setTimeout(() => {
      sub.remove()
      resolve('timeout')
    }, 2_000)
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      if (s.error) {
        clearTimeout(timer)
        sub.remove()
        resolve(`error: ${s.error}`)
      } else if (s.isLoaded && s.duration > 0) {
        clearTimeout(timer)
        sub.remove()
        resolve('ok')
      }
    })
  })
}

/**
 * Step 0b: how many players can be live at once. On Android every
 * prepared player holds an MP3 decoder instance; the first failure here
 * is the ceiling the engine's player cap must stay under.
 */
async function probeDecoderLimit(log: (line: string) => void): Promise<void> {
  const paths = Object.keys(WEB_AUDIO_MODULES)
    .filter((p) => p.startsWith('/assets/audio/path/'))
    .slice(0, 40)
  const live: PlayerLike[] = []
  let firstFailure = -1
  for (let i = 0; i < paths.length; i++) {
    const player = createExpoPlayer(WEB_AUDIO_MODULES[paths[i]])
    live.push(player)
    const result = await waitLoaded(player)
    if (result !== 'ok') {
      firstFailure = i + 1
      log(`[audio-limit] player #${i + 1} failed (${result}); ${i} loaded fine`)
      break
    }
  }
  if (firstFailure < 0)
    log(`[audio-limit] ${live.length} players loaded, no failure`)
  for (const p of live) disposePlayer(p)
  await wait(1_500)
  const again = createExpoPlayer(WEB_AUDIO_MODULES[paths[0]])
  log(
    `[audio-limit] after dispose (remove + release): a fresh player -> ${await waitLoaded(again)}`,
  )
  disposePlayer(again)
  await wait(500)
}

export async function runAudioCheck(log = console.log): Promise<void> {
  const note = (label: string, detail: string) =>
    recordAudio({ kind: 'note', label, detail })
  try {
    await probeRawStatus(log, 'factory')
    await probeRawStatus(log, 'volume0')
    // Same silent probe under expo-audio's default session (mixWithOthers),
    // then back to the app's mode: tells our session config from the route.
    await setAudioModeAsync({
      ...AUDIO_MODE,
      interruptionMode: 'mixWithOthers',
    })
    log('[audio-probe] session -> mixWithOthers')
    await probeRawStatus(log, 'volume0')
    await setAudioModeAsync(AUDIO_MODE)
    log('[audio-probe] session -> app mode (doNotMix)')
    // 1. Greet: cold player, then preloaded.
    await playGreetLine('hi').catch((e: unknown) =>
      note('greet-cold', String(e)),
    )
    audioEngine.release('greet:hi')
    loadGreetAudio()
    await wait(1_000)
    await playGreetLine('hi').catch((e: unknown) =>
      note('greet-warm', String(e)),
    )
    await wait(400)

    // 2. Session-start: live fetch + eager file writes.
    const prepared = await startSession({
      sessionId: `audio-check-${Date.now()}`,
      payload: { track: 'math', level: 1, childName: 'Marian' },
    })
    const s = prepared.audio
    const texts = Array.from(s.textToId.keys())
    await s.ready
    note(
      'session',
      `${s.utteranceCount} utterances, ${texts.length} distinct, ${s.bytesWritten} bytes`,
    )

    // 3. Session lines: cold player, then a prewarmed one.
    await s
      .playUtterance(texts[0])
      .catch((e: unknown) => note('session-cold', String(e)))
    s.prewarm(texts[1])
    await wait(1_000)
    await s
      .playUtterance(texts[1])
      .catch((e: unknown) => note('session-warm', String(e)))
    await wait(400)

    // 4. SFX.
    const chime = createSfx({ src: SFX_SOURCES.chime, volume: 0.7 })
    const sparkle = createSfx({ src: SFX_SOURCES.sparkle, volume: 0.55 })
    await wait(800)
    chime.play()
    await wait(1_200)
    sparkle.play()
    await wait(1_200)
    chime.unload()
    sparkle.unload()

    s.unload()

    // Last: exhausting decoders poisons later players (Android does not
    // always free a removed player's decoder right away).
    await probeDecoderLimit(log)

    const onplay = readAudioLog().filter((r) => r.kind === 'onplay')
    log(
      `[audio-check] done: ${onplay
        .map((r) => `${r.label}=${Math.round((r as { ms: number }).ms)}ms`)
        .join(' ')}`,
    )
  } catch (err) {
    log(
      `[audio-check] failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}
