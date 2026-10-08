/**
 * Screen 2 — Greet. Port of src/screens/Greet.tsx (1,639 lines).
 *
 * Kept: the 4-line sequence (reused `runGreetSequence` unchanged), word-tick
 * captions, "Hi!" ear-wiggle (idle -> celebration 600 ms), heart reveal
 * after line 3, 20 s re-prompt, heart squish + 400 ms hand-off, clouds.
 *
 * Dropped on purpose (web-only): the Wake state + full-screen tap target,
 * the ready ring, the 8 s finger-tap nudge, the audio-unlock gate and
 * relock retry, and all Howler/iOS-WebKit instrumentation (~1,000 lines).
 * Native audio needs no user gesture, so line 0 auto-starts after Emma's
 * slide-in lands (GREET_AUTOSTART_MS). This is the plan's Phase 0 exit
 * criterion "audio plays on cold launch, with no unlock tap"; dropping
 * the Wake state is a UX change Kyle should sign off before Phase 3.
 *
 * Emma herself is NOT rendered here — she lives in App's EmmaStage so she
 * can travel to Math. Greet drives her pose through `onPoseChange`.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeOut } from 'react-native-reanimated'
import { cancelGreetAudio, speakGreetLine } from '../audio/greetAudio'
import { CaptionRibbon } from '../components/CaptionRibbon'
import { Clouds } from '../components/Clouds'
import { HeartButton } from '../components/HeartButton'
import { heartSize, type ScreenLayout, type Viewport } from '../layout'
import {
  GREET_LINES,
  REPROMPT_AFTER_MS,
  runGreetSequence,
  speakReprompt,
  type GreetSequenceHandle,
} from '../reuse'
import { colors, FILL } from '../theme'
import type { SpikePose } from '../theme'

/** Emma's slide-in: 300 ms delay + ~700 ms spring (web delay 0.3 + 0.7). */
const GREET_AUTOSTART_MS = 1_000
const HEART_TAP_TRANSITION_MS = 400
const EAR_WIGGLE_MS = 600

export interface GreetProps {
  layout: ScreenLayout
  viewport: Viewport
  onPoseChange: (pose: SpikePose) => void
  onAdvance: () => void
  onDebug: (line: string) => void
}

export function Greet({
  layout,
  viewport,
  onPoseChange,
  onAdvance,
  onDebug,
}: GreetProps) {
  const [activeLine, setActiveLine] = useState(0)
  const [revealedByLine, setRevealedByLine] = useState<number[]>(() =>
    GREET_LINES.map(() => 0),
  )
  const [lineGeneration, setLineGeneration] = useState(0)
  const [heartReady, setHeartReady] = useState(false)
  const [heartSquishing, setHeartSquishing] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  const sequenceRef = useRef<GreetSequenceHandle | null>(null)
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())
  const earWiggleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repromptUsedRef = useRef(false)
  const tapHandledRef = useRef(false)
  const lineStartAtRef = useRef(0)

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id)
      fn()
    }, ms)
    timersRef.current.add(id)
    return id
  }, [])

  const triggerEarWiggle = useCallback(() => {
    onPoseChange('celebration')
    if (earWiggleRef.current !== null) clearTimeout(earWiggleRef.current)
    earWiggleRef.current = setTimeout(() => {
      earWiggleRef.current = null
      onPoseChange('idle')
    }, EAR_WIGGLE_MS)
  }, [onPoseChange])

  const reveal = useCallback((lineIndex: number, count: number) => {
    setRevealedByLine((prev) => {
      if (prev[lineIndex] >= count) return prev
      const next = prev.slice()
      next[lineIndex] = count
      return next
    })
  }, [])

  const scheduleReprompt = useCallback(() => {
    if (repromptUsedRef.current) return
    later(() => {
      if (tapHandledRef.current) return
      repromptUsedRef.current = true
      const lastIdx = GREET_LINES.length - 1
      setActiveLine(lastIdx)
      setLineGeneration((g) => g + 1)
      setRevealedByLine((prev) => {
        const next = prev.slice()
        next[lastIdx] = 0
        return next
      })
      void speakReprompt({
        speak: speakGreetLine,
        onBoundary: (ev) => reveal(lastIdx, ev.wordIndex + 1),
      })
    }, REPROMPT_AFTER_MS)
  }, [later, reveal])

  useEffect(() => {
    const sequence = runGreetSequence({
      speak: (text, opts) => {
        lineStartAtRef.current = Date.now()
        return speakGreetLine(text, {
          ...opts,
          onStart: () => {
            onDebug(
              `line "${text}" onPlay +${Date.now() - lineStartAtRef.current} ms after play()`,
            )
            opts?.onStart?.()
          },
        })
      },
      // Same timer seam as the web default; RN's globals are the timers.
      schedule: (cb, ms) => later(cb, ms),
      cancelSchedule: (h) => {
        clearTimeout(h as ReturnType<typeof setTimeout>)
        timersRef.current.delete(h as ReturnType<typeof setTimeout>)
      },
      onLineStart: (i) => setActiveLine(i),
      onWordBoundary: (lineIndex, ev) => {
        reveal(lineIndex, ev.wordIndex + 1)
        if (lineIndex === 0 && ev.word === 'Hi!') triggerEarWiggle()
      },
      onLineEnd: (i) => {
        reveal(i, GREET_LINES[i].split(/\s+/).filter(Boolean).length)
      },
      onHeartReady: () => {
        setHeartReady(true)
        scheduleReprompt()
      },
      onLineError: (i, err) => {
        // Web: relock ring + retry tap. Native has no gesture gate, so a
        // failure here is a real decode/file error. Never freeze Greet:
        // show the line and the heart so Marian can continue.
        onDebug(`line ${i} failed: ${err.message}`)
        reveal(i, GREET_LINES[i].split(/\s+/).filter(Boolean).length)
        setHeartReady(true)
      },
    })
    sequenceRef.current = sequence
    later(() => sequence.start(), GREET_AUTOSTART_MS)

    const timers = timersRef.current
    return () => {
      sequence.cancel()
      sequenceRef.current = null
      cancelGreetAudio()
      for (const id of timers) clearTimeout(id)
      timers.clear()
      if (earWiggleRef.current !== null) clearTimeout(earWiggleRef.current)
    }
    // Mount-once, like the web Greet's sequence effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleHeartTap = useCallback(() => {
    if (!heartReady || tapHandledRef.current) return
    tapHandledRef.current = true
    sequenceRef.current?.cancel()
    cancelGreetAudio()
    // Celebration on the way out (web: triggerEarWiggle). It is still
    // showing when App swaps to Math, which is the idle -> celebration
    // shared-transition beat.
    triggerEarWiggle()
    setHeartSquishing(true)
    setAdvancing(true)
    later(onAdvance, HEART_TAP_TRANSITION_MS)
  }, [heartReady, later, onAdvance, triggerEarWiggle])

  const heart = heartSize(viewport)
  const { content, landscape, captionFontSize } = layout
  const showRibbon = revealedByLine.some((n) => n > 0)

  return (
    <Animated.View exiting={FadeOut.duration(250)} style={styles.root}>
      <Clouds />
      <View
        style={[
          styles.content,
          {
            left: content.x,
            top: content.y,
            width: content.width,
            height: content.height,
            justifyContent: landscape ? 'center' : 'space-between',
          },
        ]}
      >
        <View style={styles.ribbonSlot}>
          {/* Mounted only once the first word ticks, so an empty ribbon
              never flashes (the web's iPad "empty rounded rectangle" bug). */}
          {showRibbon && (
            <CaptionRibbon
              lineKey={`${activeLine}-${lineGeneration}`}
              text={GREET_LINES[activeLine] ?? ''}
              revealedCount={revealedByLine[activeLine] ?? 0}
              fontSize={captionFontSize}
            />
          )}
        </View>
        <View style={[styles.heartSlot, { height: heart.height + 24 }]}>
          {heartReady && (
            <HeartButton
              width={heart.width}
              height={heart.height}
              squishing={heartSquishing}
              disabled={advancing}
              onPress={handleHeartTap}
              accessibilityLabel={GREET_LINES[GREET_LINES.length - 1]}
            />
          )}
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...FILL,
    backgroundColor: colors.myCream,
  },
  content: {
    position: 'absolute',
    alignItems: 'stretch',
    gap: 16,
  },
  ribbonSlot: {
    alignItems: 'center',
  },
  heartSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
