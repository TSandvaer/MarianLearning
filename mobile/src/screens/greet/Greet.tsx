/**
 * Screen 2, Greet: Marian meets Emma. Native port of `src/screens/Greet.tsx`
 * (web, the source of truth) with the calls in
 * `design/native/greet-math-native.md`.
 *
 * Kept from the web:
 * - **Wake** state: Emma slides in and breathes, the ready ring appears at
 *   +900 ms, nothing plays until a tap anywhere in the safe area. At 8 s
 *   without a tap, one nudge: the finger-tap icon and an ear-wiggle, no
 *   voice, never repeated.
 * - **Intro**: the tap starts "Hi!" at once (spec § 1: `onPlay` ≤ 250 ms
 *   after the tap; the 4 players are created on mount). The 4 lines play
 *   through core's `runGreetSequence` with 400 ms gaps, captions reveal
 *   word by word, the ear-wiggle fires on "Hi!", and the heart appears
 *   after line 3. 20 s after the heart appears without a tap, line 4 is
 *   replayed once.
 * - Heart tap: squish, ear-wiggle, Emma stops, Math 400 ms later. Silent.
 * - The ribbon keeps showing the last line ("Tap the heart when you're
 *   ready.") while the heart waits (the web renders `activeLine`).
 *
 * Dropped (web-only): the iPad Safari audio-unlock gate, its 6 s retry and
 * relock ring, and every Howler/WebKit probe. A line that fails to start
 * walks its caption and the sequence carries on (`greetSpeak.ts`).
 *
 * Emma herself is not rendered here: she is App's hoisted `EmmaStage`, so
 * she can spring to Math's frame. Greet reports her pose through
 * `onPoseChange`. Greet renders two layers around her: the background
 * (clouds, ring) below, and the foreground (ribbon, heart, nudge icon,
 * wake tap target) above; App gives Emma `zIndex: 1` between them.
 */
import {
  GREET_LINES,
  REPROMPT_AFTER_MS,
  REPROMPT_LINE_INDEX,
  runGreetSequence,
  speakReprompt,
  type GreetSequenceHandle,
} from '@marian/core/greet/greetSequence'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated, { FadeOut } from 'react-native-reanimated'
import {
  cancelGreetAudio,
  loadGreetAudio,
  playGreetLine,
  recordAudio,
  unloadGreetAudio,
} from '../../audio'
import { CaptionRibbon } from '../../components/CaptionRibbon'
import type { GreetLayout } from '../../layout/greetLayout'
import { FILL } from '../../theme'
import { Clouds } from './Clouds'
import { createGreetSpeaker, type PlayGreetLineFn } from './greetSpeak'
import { HeartButton } from './HeartButton'
import { ICON_TOTAL_MS, WakeNudgeIcon } from './WakeNudgeIcon'
import { WakeRing } from './WakeRing'

/** Spec: heart tap → Screen 3 within 400 ms. */
export const HEART_TAP_TRANSITION_MS = 400
/** Idle → celebration → idle on "Hi!", the nudge and the heart tap. */
export const EAR_WIGGLE_MS = 600
/** No tap for 8 s in Wake: the one nudge. */
export const WAKE_REPROMPT_AFTER_MS = 8_000
/** Greet fades out over 250 ms (web `exit`). */
export const GREET_EXIT_MS = 250
/** Emma's breath on Greet: 1.05 over 2.4 s (App passes it to EmmaStage). */
export const GREET_BREATH_SCALE = 1.05
export const GREET_BREATH_PERIOD_S = 2.4

export type GreetPose = 'idle' | 'celebration'
export type GreetScreenState = 'wake' | 'intro'

/** The 4 Greet clips. Test seam; defaults to the native engine. */
export interface GreetAudioPort {
  /** Create the players so the tap's line starts without a load. */
  load(): void
  play: PlayGreetLineFn
  /** Stop the Greet line in flight. */
  cancel(): void
  /** Release the players (Greet never comes back). */
  unload(): void
}

const ENGINE_AUDIO: GreetAudioPort = {
  load: loadGreetAudio,
  play: playGreetLine,
  cancel: cancelGreetAudio,
  unload: unloadGreetAudio,
}

const wordCount = (i: number): number =>
  (GREET_LINES[i] ?? '').split(/\s+/).filter(Boolean).length

export interface GreetProps {
  layout: GreetLayout
  onPoseChange: (pose: GreetPose) => void
  onAdvance: () => void
  audio?: GreetAudioPort
  /**
   * QA only (debug + `EXPO_PUBLIC_QA_AUTOTAP_MS`): the wake tap fires
   * itself this long after mount, for simulators nothing can tap.
   */
  qaAutoTapAfterMs?: number
}

export function Greet({
  layout,
  onPoseChange,
  onAdvance,
  audio = ENGINE_AUDIO,
  qaAutoTapAfterMs,
}: GreetProps) {
  const [screenState, setScreenState] = useState<GreetScreenState>('wake')
  const [showWakeIcon, setShowWakeIcon] = useState(false)
  const [activeLine, setActiveLine] = useState(0)
  const [lineGeneration, setLineGeneration] = useState(0)
  const [revealedByLine, setRevealedByLine] = useState<number[]>(() =>
    GREET_LINES.map(() => 0),
  )
  const [heartReady, setHeartReady] = useState(false)
  const [heartSquishing, setHeartSquishing] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  // The audio port is fixed at mount, and the callback props are read
  // through refs from long-lived callbacks (timers, the sequence), so a
  // re-render (a rotation, a new layout) never rebuilds any of them.
  const [port] = useState(audio)
  const [autoTapMs] = useState(qaAutoTapAfterMs)
  const wakeTapRef = useRef<() => void>(() => {})
  const [speaker] = useState(() => createGreetSpeaker(port.play))
  const onPoseChangeRef = useRef(onPoseChange)
  const onAdvanceRef = useRef(onAdvance)
  useLayoutEffect(() => {
    onPoseChangeRef.current = onPoseChange
    onAdvanceRef.current = onAdvance
  })
  const sequenceRef = useRef<GreetSequenceHandle | null>(null)
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())
  const earWiggleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeNudgeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repromptRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeTappedRef = useRef(false)
  const heartTappedRef = useRef(false)
  const repromptUsedRef = useRef(false)

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id)
      fn()
    }, ms)
    timersRef.current.add(id)
    return id
  }, [])

  const clearLater = useCallback((id: ReturnType<typeof setTimeout> | null) => {
    if (id === null) return
    clearTimeout(id)
    timersRef.current.delete(id)
  }, [])

  const earWiggle = useCallback(() => {
    onPoseChangeRef.current('celebration')
    clearLater(earWiggleRef.current)
    earWiggleRef.current = later(() => {
      earWiggleRef.current = null
      onPoseChangeRef.current('idle')
    }, EAR_WIGGLE_MS)
  }, [clearLater, later])

  const reveal = useCallback((line: number, count: number) => {
    setRevealedByLine((prev) => {
      if ((prev[line] ?? 0) >= count) return prev
      const next = prev.slice()
      next[line] = count
      return next
    })
  }, [])

  const scheduleReprompt = useCallback(() => {
    if (repromptUsedRef.current) return
    clearLater(repromptRef.current)
    repromptRef.current = later(() => {
      repromptRef.current = null
      if (heartTappedRef.current) return
      repromptUsedRef.current = true
      // Replay line 4 with a fresh word-by-word reveal.
      setActiveLine(REPROMPT_LINE_INDEX)
      setLineGeneration((g) => g + 1)
      setRevealedByLine((prev) => {
        const next = prev.slice()
        next[REPROMPT_LINE_INDEX] = 0
        return next
      })
      void speakReprompt({
        speak: speaker.speak,
        onBoundary: (ev) => reveal(REPROMPT_LINE_INDEX, ev.wordIndex + 1),
      })
    }, REPROMPT_AFTER_MS)
  }, [clearLater, later, reveal, speaker])

  // Mount: create the 4 players, arm the one Wake nudge. Unmount: stop
  // everything (the sequence, a caption walk, Emma's line) and free the
  // players.
  useEffect(() => {
    const timers = timersRef.current
    port.load()
    wakeNudgeRef.current = later(() => {
      wakeNudgeRef.current = null
      if (wakeTappedRef.current) return
      setShowWakeIcon(true)
      earWiggle()
      later(() => setShowWakeIcon(false), ICON_TOTAL_MS)
    }, WAKE_REPROMPT_AFTER_MS)
    if (autoTapMs !== undefined) later(() => wakeTapRef.current(), autoTapMs)
    return () => {
      sequenceRef.current?.cancel()
      sequenceRef.current = null
      speaker.cancelWalk()
      port.cancel()
      port.unload()
      for (const id of timers) clearTimeout(id)
      timers.clear()
    }
  }, [autoTapMs, earWiggle, later, port, speaker])

  const handleWakeTap = useCallback(() => {
    if (wakeTappedRef.current) return
    wakeTappedRef.current = true
    clearLater(wakeNudgeRef.current)
    wakeNudgeRef.current = null
    setShowWakeIcon(false)
    setScreenState('intro')
    const tappedAt = Date.now()

    const sequence = runGreetSequence({
      speak: speaker.speak,
      schedule: (cb, ms) => later(cb, ms),
      cancelSchedule: (h) => clearLater(h as ReturnType<typeof setTimeout>),
      onLineStart: (i) => setActiveLine(i),
      // Spec § 1 target: ≤ 250 ms. Logged to Metro with -debug 1.
      onLine0Start: () =>
        recordAudio({
          kind: 'onplay',
          label: 'greet tap → "Hi!"',
          ms: Date.now() - tappedAt,
        }),
      onWordBoundary: (i, ev) => {
        reveal(i, ev.wordIndex + 1)
        if (i === 0 && ev.word === 'Hi!') earWiggle()
      },
      onLineEnd: (i) => reveal(i, wordCount(i)),
      onHeartReady: () => {
        setHeartReady(true)
        scheduleReprompt()
      },
      // Only an unknown line text gets here (failed clips walk their
      // caption in greetSpeak). Never freeze: show the line and the heart.
      onLineError: (i) => {
        reveal(i, wordCount(i))
        setHeartReady(true)
        scheduleReprompt()
      },
    })
    sequenceRef.current = sequence
    // Synchronously, inside the tap: line 0 is requested in this tick.
    sequence.start()
  }, [clearLater, earWiggle, later, reveal, scheduleReprompt, speaker])

  useLayoutEffect(() => {
    wakeTapRef.current = handleWakeTap
  })

  const handleHeartTap = useCallback(() => {
    if (!heartReady || heartTappedRef.current) return
    heartTappedRef.current = true
    sequenceRef.current?.cancel()
    speaker.cancelWalk()
    port.cancel()
    clearLater(repromptRef.current)
    repromptRef.current = null
    earWiggle()
    setHeartSquishing(true)
    setAdvancing(true)
    later(() => onAdvanceRef.current(), HEART_TAP_TRANSITION_MS)
  }, [clearLater, earWiggle, heartReady, later, port, speaker])

  const {
    safe,
    ring,
    ringStroke,
    ribbonSlot,
    heart,
    captionFontSize,
    captionLineHeight,
    ribbonPadding,
  } = layout
  const showRibbon =
    screenState === 'intro' && revealedByLine.some((n) => n > 0)

  return (
    <>
      <Animated.View
        testID="greet"
        exiting={FadeOut.duration(GREET_EXIT_MS)}
        style={styles.background}
      >
        <Clouds />
        <WakeRing
          rect={ring}
          stroke={ringStroke}
          visible={screenState === 'wake'}
        />
      </Animated.View>

      <Animated.View
        testID="greet-foreground"
        exiting={FadeOut.duration(GREET_EXIT_MS)}
        style={styles.foreground}
      >
        {showRibbon && (
          <CaptionRibbon
            testID="greet-ribbon"
            text={GREET_LINES[activeLine] ?? ''}
            revealedCount={revealedByLine[activeLine] ?? 0}
            lineKey={`${activeLine}-${lineGeneration}`}
            fontSize={captionFontSize}
            lineHeight={captionLineHeight}
            padding={ribbonPadding}
            style={{
              position: 'absolute',
              left: ribbonSlot.x,
              top: ribbonSlot.y,
              width: ribbonSlot.width,
            }}
          />
        )}

        {heartReady && (
          <HeartButton
            rect={heart}
            squishing={heartSquishing}
            disabled={advancing}
            onPress={handleHeartTap}
            accessibilityLabel={GREET_LINES[GREET_LINES.length - 1]}
          />
        )}

        {showWakeIcon && (
          <WakeNudgeIcon
            cx={ring.x + ring.width / 2}
            cy={ring.y + ring.height / 2}
          />
        )}

        {screenState === 'wake' && (
          <Pressable
            testID="greet-wake-tap-target"
            accessibilityRole="button"
            accessibilityLabel="Tap to start"
            // Touch-down, not release: the line starts as the finger lands.
            onPressIn={handleWakeTap}
            onPress={handleWakeTap}
            style={[
              styles.tapTarget,
              {
                left: safe.x,
                top: safe.y,
                width: safe.width,
                height: safe.height,
              },
            ]}
          />
        )}
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  background: { ...FILL, zIndex: 0, pointerEvents: 'none' },
  foreground: { ...FILL, zIndex: 2, pointerEvents: 'box-none' },
  tapTarget: { position: 'absolute' },
})
