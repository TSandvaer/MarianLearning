/**
 * Audio check: a debug-only run of the engine end to end, for measuring
 * on a simulator / emulator / device before any screen is wired.
 *
 *   EXPO_PUBLIC_AUDIO_CHECK=1 EXPO_PUBLIC_MUTE=1 npx expo start --go --clear
 *
 * About 2 s after launch it plays, one after another, logging to Metro:
 *   1. a Greet line on a cold player, then on a preloaded one;
 *   2. a live `/api/claude` math session-start (fetch time, 76-file write);
 *   3. a session line on a cold player, then on a prewarmed one;
 *   4. two SFX (chime, sparkle);
 *   5. the eager-players alternative: create a player for every session
 *      file, time it, release them (the lazy-players decision's evidence).
 * Every row is `[audio] ...`; a summary line `[audio-check] done` ends it.
 *
 * The session-start is the same request the web's Math mount makes for a
 * first-session child (`track: 'math', level: 1, childName: 'Marian'`).
 */
import { readAudioLog, recordAudio } from '../audioLog'
import { audioEngine } from '../engine'
import { loadGreetAudio, playGreetLine } from '../greetAudio'
import { SFX_SOURCES, createSfx } from '../sfx'
import { startSession } from '../sessionStart'

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), ms))

export async function runAudioCheck(log = console.log): Promise<void> {
  const note = (label: string, detail: string) =>
    recordAudio({ kind: 'note', label, detail })
  try {
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

    // 5. Eager players: what creating all of them up front would cost.
    const ids = Array.from(new Set(texts.map((t) => s.textToId.get(t)!)))
    const t0 = Date.now()
    for (const text of texts) s.prewarm(text)
    recordAudio({
      kind: 'session-load',
      label: 'eager-players',
      ms: Date.now() - t0,
      detail: `${ids.length} players created (lazy default creates them on first play)`,
    })
    s.unload()

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
