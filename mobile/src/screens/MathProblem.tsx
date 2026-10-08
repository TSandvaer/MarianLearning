/**
 * One Math problem from a live `/api/claude` session-start.
 *
 * Port of a thin slice of src/screens/Math/Math.tsx (3,829 lines): problem 1
 * of the plan, read-aloud on mount, three clay chips, the wrong path
 * (shake + puzzled-tilt + reprompt; hint after 2 wrongs) and the correct
 * path (celebration + "Yes! N!"). Never a red X: a wrong chip only shakes.
 *
 * Out of the slice: flower visuals (dots stand in), the remaining 7
 * problems, stardust/streak HUD, SFX, guided-answer flow, sparkle burst.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { prepareMathSession, type SessionSource } from '../api/sessionStart'
import {
  cancelSessionAudio,
  loadSessionAudio,
  playSessionText,
  releaseSessionAudio,
} from '../audio/sessionAudio'
import { CaptionRibbon } from '../components/CaptionRibbon'
import type { ScreenLayout } from '../layout'
import {
  CHIP_TAP_SPRING,
  HINT_AFTER_WRONG_COUNT,
  HINT_DELAY_AFTER_WRONG_MS,
  pickDistractors,
  POSE_HOLD_MS,
  WRONG_SHAKE_MS,
  type MathProblem as Problem,
} from '../reuse'
import { colors, FILL, fonts, type SpikePose } from '../theme'

const CLAY_SLAB = '#dba675'
const CLAY_INK = '#5a3524'

/** Same deterministic shuffle as Math.tsx's chip builder. */
function chipValues(problem: Problem): number[] {
  const [d1, d2] = pickDistractors(problem.correct, problem.index, 10, {
    op: problem.op,
    operands: [problem.addendA, problem.addendB] as const,
  })
  const values = [problem.correct, d1, d2]
  let s = (problem.index * 31 + problem.correct * 17 + 1) >>> 0
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return values
}

interface ChipProps {
  value: number
  size: number
  enabled: boolean
  shaking: boolean
  onPress: () => void
}

function Chip({ value, size, enabled, shaking, onPress }: ChipProps) {
  const reducedMotion = useReducedMotion()
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const opacity = useSharedValue(enabled ? 1 : 0.6)

  useEffect(() => {
    // Gate-open lift: calm 200 ms opacity tween, no spring (web 86ca84ukt).
    opacity.value = withTiming(enabled ? 1 : 0.6, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    })
  }, [enabled, opacity])

  useEffect(() => {
    if (!shaking || reducedMotion) return
    const step = WRONG_SHAKE_MS / 5
    const ease = Easing.out(Easing.ease)
    x.value = withSequence(
      ...[-6, 6, -4, 4, 0].map((v) =>
        withTiming(v, { duration: step, easing: ease }),
      ),
    )
  }, [shaking, reducedMotion, x])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }))
  const spring = {
    stiffness: CHIP_TAP_SPRING.stiffness,
    damping: CHIP_TAP_SPRING.damping,
    mass: 1,
  }

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          if (enabled) y.value = withSpring(4, spring)
        }}
        onPressOut={() => {
          y.value = withSpring(0, spring)
        }}
        disabled={!enabled}
        accessibilityRole="button"
        accessibilityLabel={`Answer ${value}`}
        style={[
          styles.chip,
          {
            width: size,
            height: size,
            borderRadius: size * 0.27,
            borderBottomWidth: Math.max(4, size * 0.05),
          },
        ]}
      >
        <Text style={[styles.chipText, { fontSize: size * 0.43 }]}>
          {value}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

function DotGroup({
  count,
  color,
  size,
}: {
  count: number
  color: string
  size: number
}) {
  return (
    <View style={styles.dotGroup}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  )
}

export interface MathProblemProps {
  layout: ScreenLayout
  onPoseChange: (pose: SpikePose) => void
  onDone: () => void
  onDebug: (line: string) => void
}

type Phase = 'loading' | 'ready'

export function MathProblemScreen({
  layout,
  onPoseChange,
  onDone,
  onDebug,
}: MathProblemProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [problem, setProblem] = useState<Problem | null>(null)
  const [source, setSource] = useState<SessionSource | null>(null)
  const [caption, setCaption] = useState<{ text: string; key: number } | null>(
    null,
  )
  const [revealed, setRevealed] = useState(0)
  const [chipGateOpen, setChipGateOpen] = useState(false)
  const [shakingChip, setShakingChip] = useState<number | null>(null)
  const [resolved, setResolved] = useState(false)

  const mountedRef = useRef(true)
  const wrongCountRef = useRef(0)
  const resolvedRef = useRef(false)
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())
  const captionKeyRef = useRef(0)

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id)
      fn()
    }, ms)
    timersRef.current.add(id)
  }, [])

  /** Play a line with its caption — the web's `speak(text)`. */
  const speak = useCallback(
    (text: string, onPlay?: () => void): Promise<void> => {
      captionKeyRef.current += 1
      setCaption({ text, key: captionKeyRef.current })
      setRevealed(0)
      const startedAt = Date.now()
      return playSessionText(text, {
        onPlay: () => {
          onDebug(`"${text}" onPlay +${Date.now() - startedAt} ms`)
          onPlay?.()
        },
        onWordTick: (i) => {
          if (mountedRef.current) setRevealed((n) => Math.max(n, i + 1))
        },
      }).catch(() => {
        // cancelled by a newer line — fine
      })
    },
    [onDebug],
  )

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false
    void (async () => {
      const t0 = Date.now()
      const session = await prepareMathSession()
      if (cancelled) return
      const p1 = session.plan.problems[0]
      const utterances = session.response.utterances.filter((u) =>
        u.id.startsWith('math.p1.'),
      )
      const t1 = Date.now()
      const written = loadSessionAudio(utterances)
      onDebug(
        `session: ${session.source}${session.fallbackReason ? ` (${session.fallbackReason})` : ''}, ` +
          `fetch ${session.fetchMs} ms, ${session.response.utterances.length} utterances; ` +
          `wrote ${written.files} mp3 / ${Math.round(written.bytes / 1024)} KB in ${Date.now() - t1} ms`,
      )
      setSource(session.source)
      setProblem(p1)
      setPhase('ready')
      // Read-aloud on mount. Chips open when the read STARTS (web chipGateOpen).
      void speak(p1.utterances.read, () => {
        if (!cancelled) setChipGateOpen(true)
      })
      onDebug(`math ready ${Date.now() - t0} ms after mount`)
    })()
    const timers = timersRef.current
    return () => {
      cancelled = true
      mountedRef.current = false
      for (const id of timers) clearTimeout(id)
      timers.clear()
      releaseSessionAudio()
    }
    // Mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleWrong = useCallback(
    (value: number, p: Problem) => {
      setShakingChip(value)
      later(() => setShakingChip(null), WRONG_SHAKE_MS)
      onPoseChange('puzzled-tilt')
      wrongCountRef.current += 1
      const showHint = wrongCountRef.current === HINT_AFTER_WRONG_COUNT
      void speak(p.utterances.reprompt).then(() => {
        if (!mountedRef.current || resolvedRef.current) return
        if (showHint && p.utterances.hint1) {
          later(() => {
            if (!resolvedRef.current) void speak(p.utterances.hint1!)
          }, HINT_DELAY_AFTER_WRONG_MS)
        }
      })
      later(() => {
        if (!resolvedRef.current) onPoseChange('idle')
      }, POSE_HOLD_MS['puzzled-tilt'] ?? 1500)
    },
    [later, onPoseChange, speak],
  )

  const handleCorrect = useCallback(
    (p: Problem) => {
      resolvedRef.current = true
      setResolved(true)
      onPoseChange('celebration')
      void speak(p.utterances.correct).then(() => {
        if (mountedRef.current) onPoseChange('idle')
      })
    },
    [onPoseChange, speak],
  )

  const onChipTap = useCallback(
    (value: number) => {
      if (!problem || resolvedRef.current || !chipGateOpen) return
      cancelSessionAudio()
      if (value === problem.correct) handleCorrect(problem)
      else handleWrong(value, problem)
    },
    [chipGateOpen, handleCorrect, handleWrong, problem],
  )

  const { emma, content, landscape, captionFontSize, tablet } = layout
  const chipSize = Math.min(
    120,
    (content.width - 48) / 3.4,
    content.height * 0.22,
  )
  const symbolSize = Math.round(
    Math.min(tablet ? 72 : 52, content.height * 0.12),
  )
  const dotSize = Math.round(symbolSize * 0.36)
  // Portrait: caption sits beside Emma's perch; landscape: content already
  // starts to the right of Emma.
  const captionInset = landscape ? 0 : emma.width + 12

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(250)}
      style={styles.root}
    >
      <View
        style={[
          styles.content,
          {
            left: content.x,
            top: content.y,
            width: content.width,
            height: content.height,
          },
        ]}
      >
        <View
          style={[
            styles.captionRow,
            {
              marginLeft: captionInset,
              minHeight: landscape ? undefined : emma.height,
            },
          ]}
        >
          {caption && (
            <CaptionRibbon
              lineKey={String(caption.key)}
              text={caption.text}
              revealedCount={revealed}
              fontSize={captionFontSize}
            />
          )}
        </View>

        {phase === 'loading' || !problem ? (
          <View style={styles.center}>
            <Text style={styles.loading}>…</Text>
          </View>
        ) : (
          <>
            <View style={styles.center}>
              <Text style={[styles.symbolic, { fontSize: symbolSize }]}>
                {problem.addendA} {problem.op} {problem.addendB} = ?
              </Text>
              <View style={styles.dotsRow}>
                <DotGroup
                  count={problem.addendA}
                  color={colors.myRose}
                  size={dotSize}
                />
                <DotGroup
                  count={problem.addendB}
                  color={colors.sparkle}
                  size={dotSize}
                />
              </View>
            </View>
            <View style={styles.chipsRow}>
              {chipValues(problem).map((v) => (
                <Chip
                  key={v}
                  value={v}
                  size={chipSize}
                  enabled={chipGateOpen && !resolved}
                  shaking={shakingChip === v}
                  onPress={() => onChipTap(v)}
                />
              ))}
            </View>
            <View style={styles.footer}>
              {resolved && (
                <Animated.View entering={FadeIn.delay(600).duration(300)}>
                  <Pressable
                    onPress={onDone}
                    accessibilityRole="button"
                    style={styles.doneBtn}
                  >
                    <Text style={styles.doneText}>Hub</Text>
                  </Pressable>
                </Animated.View>
              )}
              {source && <Text style={styles.sourceTag}>{source}</Text>}
            </View>
          </>
        )}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: { ...FILL, backgroundColor: colors.myCream },
  content: { position: 'absolute', gap: 12 },
  captionRow: { justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loading: { fontFamily: fonts.bold, fontSize: 40, color: colors.myRose },
  symbolic: { fontFamily: fonts.bold, color: colors.ink },
  dotsRow: { flexDirection: 'row', gap: 32 },
  dotGroup: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', maxWidth: 160 },
  chipsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 8,
  },
  chip: {
    backgroundColor: '#fff7ee',
    borderColor: CLAY_SLAB,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5a2d14',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 3,
  },
  chipText: { fontFamily: fonts.semibold, color: CLAY_INK },
  footer: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: colors.myRose,
  },
  doneText: { fontFamily: fonts.bold, fontSize: 22, color: colors.white },
  sourceTag: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.ink,
    opacity: 0.4,
  },
})
