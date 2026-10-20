/**
 * The play screen of the side mini-games and game A, Fill the flower bed
 * (mini-game spec `design/native/mini-game-flower-bed.md` §§ 1.4-1.6, 2).
 *
 * The frame is the lesson's Math frame (`mathLayout`): the clay back disc,
 * one bead per bed (`MathHud` as a peek wears it: no stardust pill, no
 * streak; `GAME_HUD` test IDs), App's Emma at `layout.emma` (her poses come
 * up through `onPoseChange`), the caption ribbon walking each line, the bed
 * centred in `layout.problem` and three chips in `layout.chips`.
 *
 * A round, beat by beat (§ 2.4): "Ten flowers in every bed!", then per bed
 * "<N> and what make ten?" (the chips open at its onPlay; the bed then waits,
 * no timer, and a tap on it asks again). A right chip: sparkle and plink,
 * the chip bursts, Emma celebrates, the bead fills, the buds hop from the
 * chip into the empty holes and bloom, and "Yes! <N> and <m> make ten!";
 * after the line and the last bloom + 400 ms the bed slides out and the next
 * slides in (300 ms), its chips mount and it asks. After bed 6: Emma cheers,
 * "Ten every time! What a garden!", and the Map returns (`onExit`).
 *
 * A wrong chip (§ 2.6): poof, the chip shakes, Emma puzzled, "Hmm... try
 * again?"; nothing moves in the bed. The 1st pulses the empty holes at the
 * line's onPlay; after the 2nd's line the right chip glows, the others dim,
 * Emma points and says "This one is <m>.", and the glowing chip plays the
 * full right move. A chip tap during any line cuts it.
 *
 * It writes nothing (§ 1.5): no progress, stardust, streak, history,
 * Leitner or cloud call; there is no score and no first-tap record. A
 * separate screen, not a Math mode, so none of Math's session plumbing is
 * reachable. Back (the disc, or Android back) returns at once, silent. An
 * advance that falls due while the app is hidden waits for its return. A
 * new layout (rotation) keeps the round; a hop in flight ends at once.
 * Reduce Motion (§ 2.7): fades only, the same lines.
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import {
  flowerBedRound,
  type FlowerBedBed,
  type GameId,
} from '@marian/core/games/miniGames'
import { ANSWER_RANGE_MAX } from '@marian/core/math/distractors'
import { WRONG_SHAKE_MS } from '@marian/core/shared/gameplayConstants'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { BackHandler, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { createSfx, SFX_SOURCES, type Sfx } from '../../audio'
import { SESSION_GUIDE_GAP_MS } from '../../audio/sessionGuide'
import { CaptionRibbon } from '../../components/CaptionRibbon'
import type { MathLayout } from '../../layout/mathLayout'
import {
  appVisibility,
  type AppVisibility,
} from '../../lifecycle/appVisibility'
import { colors, FILL } from '../../theme'
import { AnswerChip } from '../math/AnswerChip'
import { buildChipOrder } from '../math/chipOrder'
import { EASE_OUT, FADE_MS } from '../math/extendedMotion'
import { BudGlyph } from '../math/glyphs'
import { GAME_HUD } from '../math/hudWorld'
import { MathHud } from '../math/MathHud'
import { FlowerBed } from './FlowerBed'
import {
  BED_VIEW_W,
  bedRect,
  bloomEndMs,
  chipCentre,
  SLOT_GLYPH_UNITS,
  slotCentre,
  type Point,
} from './flowerBedGeometry'
import {
  bedLines,
  createGameLinePlayer,
  GAME_LINE_MANIFEST,
  thisIsLine,
  type GameLineId,
  type GameLinePlayer,
} from './gameLines'

/** Route `game` → the open line (the screen's 200 ms fade-in first). */
export const GAME_OPEN_DELAY_MS = 200
/** A line's end → the next beat: the session guide's gap. */
export const GAME_STEP_GAP_MS = SESSION_GUIDE_GAP_MS
/** The bed slide between beds; then the next chips and ask. */
export const BED_CHANGE_MS = 300
/** Reduce Motion: the bed change is a crossfade. */
const REDUCED_BED_CHANGE_MS = FADE_MS
/** The screen's fade in and out. */
export const GAME_FADE_MS = 200
/** A bud's hop from the chip to its slot. */
export const HOP_MS = 360
/** Bud j leaves 80 × j ms after the tap (the lesson's bloom stagger). */
export const HOP_STAGGER_MS = 80
/** The hop's arc: this far above the straight line at its middle (pt). */
const HOP_ARC = 32
const EASE_IN = Easing.bezier(0.42, 0, 1, 1)

const OPEN_LINE: GameLineId = 'guide.game.bed.open'
const CLOSE_LINE: GameLineId = 'guide.game.bed.close'
const AGAIN_LINE: GameLineId = 'guide.game.again'

/** The lesson's effects at the lesson's volumes; no chime (no streak). */
export interface GameSfx {
  sparkle: Sfx
  plink: Sfx
  poof: Sfx
}

function createGameSfx(): GameSfx {
  return {
    sparkle: createSfx({ src: SFX_SOURCES.sparkle, volume: 0.55 }),
    plink: createSfx({ src: SFX_SOURCES.plink, volume: 0.3 }),
    poof: createSfx({ src: SFX_SOURCES.poof, volume: 0.45 }),
  }
}

/** Bud j lands this long after the right tap. */
const landMs = (j: number) => HOP_MS + HOP_STAGGER_MS * j

/** Bed k's chips (0-based k): the lesson's missing-number chips (§ 2.3). */
function chipsFor(k: number, bed: FlowerBedBed): readonly number[] {
  return buildChipOrder(
    {
      // Indices 4-9: every bed on the off-by-one tier (P4-P8's class).
      index: 3 + (k + 1),
      addendA: bed.given,
      addendB: bed.missing,
      correct: bed.missing,
      op: '+',
      utterances: {
        read: GAME_LINE_MANIFEST[bedLines(bed.given).ask].text,
        correct: GAME_LINE_MANIFEST[bedLines(bed.given).yes].text,
        reprompt: GAME_LINE_MANIFEST[AGAIN_LINE].text,
        giveAnswer: GAME_LINE_MANIFEST[thisIsLine(bed.missing)].text,
      },
    },
    ANSWER_RANGE_MAX,
    'add-to-10',
  ).values
}

export interface GameScreenProps {
  layout: MathLayout
  /** The game on screen (only Fill the flower bed in this build). */
  game: GameId
  /** The round's end, or Back: App returns to the same world's Map. */
  onExit: () => void
  onPoseChange?: (pose: EmmaPose) => void
  /** Test seams: the round (default `flowerBedRound(Math.random)`), the
   *  line player, the effects and the visibility store. */
  round?: readonly FlowerBedBed[]
  linePlayer?: GameLinePlayer
  sfx?: GameSfx
  visibility?: AppVisibility
}

interface Hops {
  from: Point
  to: Point[]
  size: number
}

export function GameScreen({
  layout,
  onExit,
  onPoseChange,
  round: roundProp,
  linePlayer,
  sfx: sfxProp,
  visibility = appVisibility,
}: GameScreenProps) {
  const reducedMotion = useReducedMotion()

  // Fixed at mount: the round, the line player, the effects.
  const [round] = useState<readonly FlowerBedBed[]>(
    () => roundProp ?? flowerBedRound(Math.random),
  )
  const [player] = useState<GameLinePlayer>(
    () => linePlayer ?? createGameLinePlayer(),
  )
  const [sfx] = useState<GameSfx>(() => sfxProp ?? createGameSfx())

  const [bed, setBed] = useState(0)
  /** The bed sliding out, while the next slides in. */
  const [leaving, setLeaving] = useState<number | null>(null)
  const [chipsUp, setChipsUp] = useState(true)
  const [gateOpen, setGateOpen] = useState(false)
  const [resolved, setResolved] = useState(false)
  const [guided, setGuided] = useState(false)
  const [shaking, setShaking] = useState<number | null>(null)
  const [filled, setFilled] = useState(false)
  const [hint, setHint] = useState(0)
  /** Beds done: the beads. */
  const [done, setDone] = useState(0)
  const [pose, setPose] = useState<EmmaPose>('idle')
  const [hops, setHops] = useState<Hops | null>(null)
  const [caption, setCaption] = useState({ text: '', revealed: 0, key: 0 })

  const bedRef = useRef(0)
  const resolvedRef = useRef(false)
  const guidedRef = useRef(false)
  const wrongsRef = useRef(0)
  /** The bed waits for her (no line, no move): a tap on it asks again. */
  const waitingRef = useRef(false)
  const speakingRef = useRef(false)
  const tokenRef = useRef(0)
  const exitedRef = useRef(false)
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())
  /** An advance that fell due while the app was hidden. */
  const pendingRef = useRef<(() => void) | null>(null)
  const onExitRef = useRef(onExit)
  const onPoseChangeRef = useRef(onPoseChange)
  useLayoutEffect(() => {
    onExitRef.current = onExit
    onPoseChangeRef.current = onPoseChange
  })

  useEffect(() => {
    onPoseChangeRef.current?.(pose)
  }, [pose])

  const current = round[bed]!
  const chipValues = useMemo(() => chipsFor(bed, current), [bed, current])
  const box = bedRect(layout.problem)
  const boxStyle = {
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
  }

  const later = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer)
      if (!exitedRef.current) fn()
    }, ms)
    timersRef.current.add(timer)
  }
  /** A beat that waits while the app is hidden (§ 1.6). */
  const advanceAfter = (fn: () => void, ms: number) =>
    later(() => {
      if (visibility.getIsHidden()) pendingRef.current = fn
      else fn()
    }, ms)

  /** Plays a line; resolves `true` when it ended as itself (not cut). */
  const speak = (id: GameLineId, onPlay?: () => void): Promise<boolean> => {
    const token = ++tokenRef.current
    speakingRef.current = true
    waitingRef.current = false
    setCaption({ text: GAME_LINE_MANIFEST[id].text, revealed: 0, key: token })
    return player
      .playLine(id, {
        onPlay: () => {
          if (tokenRef.current === token) onPlay?.()
        },
        onWordTick: (i) => {
          if (tokenRef.current !== token) return
          setCaption((c) =>
            c.key === token
              ? { ...c, revealed: Math.max(c.revealed, i + 1) }
              : c,
          )
        },
      })
      .then(() => {
        if (exitedRef.current || tokenRef.current !== token) return false
        speakingRef.current = false
        return true
      })
  }

  /** The line ended and nothing is moving: the bed waits for her. */
  const rest = () => {
    if (resolvedRef.current) return
    waitingRef.current = true
    setPose('idle')
  }

  const ask = (k: number) => {
    setPose('listening')
    void speak(bedLines(round[k]!.given).ask, () => setGateOpen(true)).then(
      (ok) => {
        if (ok) rest()
      },
    )
  }

  const exit = () => {
    if (exitedRef.current) return
    exitedRef.current = true
    timersRef.current.forEach(clearTimeout)
    timersRef.current.clear()
    pendingRef.current = null
    player.cancelActive()
    onExitRef.current()
  }
  const exitRef = useRef(exit)
  useLayoutEffect(() => {
    exitRef.current = exit
  })

  // The round: the open line 200 ms in, then bed 1's ask. Unmount: silence.
  useEffect(() => {
    exitedRef.current = false
    const timers = timersRef.current
    later(() => {
      void speak(OPEN_LINE).then((ok) => {
        if (ok) advanceAfter(() => ask(0), GAME_STEP_GAP_MS)
      })
    }, GAME_OPEN_DELAY_MS)
    return () => {
      exitedRef.current = true
      timers.forEach(clearTimeout)
      timers.clear()
      player.unload()
      sfx.sparkle.unload()
      sfx.plink.unload()
      sfx.poof.unload()
    }
    // Mount-once: the round, player and effects are fixed for the mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Android back = Back.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exitRef.current()
      return true
    })
    return () => sub.remove()
  }, [])

  // Back from the background: the advance that fell due runs.
  useEffect(
    () =>
      visibility.subscribe(() => {
        const fn = pendingRef.current
        if (fn === null || visibility.getIsHidden()) return
        pendingRef.current = null
        if (!exitedRef.current) fn()
      }),
    [visibility],
  )

  // A new layout (rotation): a hop in flight ends at once (§ 1.6).
  const { problem, chips } = layout
  const frameKey = `${problem.x},${problem.y},${problem.width},${problem.height},${chips.rect.x},${chips.rect.y}`
  const frameKeyRef = useRef(frameKey)
  useEffect(() => {
    if (frameKeyRef.current === frameKey) return
    frameKeyRef.current = frameKey
    setHops(null)
  }, [frameKey])

  /** After the yes line and the last bloom: the next bed, or the close. */
  const afterYes = (k: number) => {
    if (k < round.length - 1) {
      const next = k + 1
      setPose('idle')
      setHops(null)
      setLeaving(k)
      bedRef.current = next
      setBed(next)
      resolvedRef.current = false
      setResolved(false)
      guidedRef.current = false
      setGuided(false)
      wrongsRef.current = 0
      setShaking(null)
      setFilled(false)
      setHint(0)
      setGateOpen(false)
      setChipsUp(false)
      later(
        () => {
          setLeaving(null)
          setChipsUp(true)
          ask(next)
        },
        reducedMotion ? REDUCED_BED_CHANGE_MS : BED_CHANGE_MS,
      )
      return
    }
    setPose('cheering')
    void speak(CLOSE_LINE).then((ok) => {
      if (ok) advanceAfter(exit, GAME_STEP_GAP_MS)
    })
  }

  const right = (value: number) => {
    const k = bedRef.current
    const { given, missing } = round[k]!
    resolvedRef.current = true
    waitingRef.current = false
    setResolved(true)
    sfx.sparkle.play()
    sfx.plink.play()
    setPose('celebration')
    setDone(k + 1)
    setFilled(true)
    if (!reducedMotion) {
      const from = chipCentre(
        chips,
        chipValues.indexOf(value),
        chipValues.length,
      )
      setHops({
        from,
        to: Array.from({ length: missing }, (_, j) => {
          const c = slotCentre(given + j, box.width)
          return { x: box.x + c.x, y: box.y + c.y }
        }),
        size: (SLOT_GLYPH_UNITS * box.width) / BED_VIEW_W,
      })
    }
    let lineDone = false
    let bloomDone = false
    const next = () => {
      if (lineDone && bloomDone) {
        advanceAfter(() => afterYes(k), GAME_STEP_GAP_MS)
      }
    }
    later(
      () => {
        bloomDone = true
        next()
      },
      bloomEndMs(missing - 1, landMs(missing - 1), reducedMotion),
    )
    void speak(bedLines(given).yes).then(() => {
      if (exitedRef.current) return
      lineDone = true
      next()
    })
  }

  const wrong = (value: number) => {
    wrongsRef.current += 1
    const first = wrongsRef.current === 1
    sfx.poof.play()
    setShaking(value)
    later(() => setShaking((s) => (s === value ? null : s)), WRONG_SHAKE_MS)
    setPose('puzzled-tilt')
    void speak(
      AGAIN_LINE,
      first ? () => setHint((h) => h + 1) : undefined,
    ).then((ok) => {
      if (!ok) return
      if (first) {
        rest()
        return
      }
      // The 2nd wrong: the guided answer; the move stays hers.
      guidedRef.current = true
      setGuided(true)
      setPose('attentive-pointing')
      void speak(thisIsLine(round[bedRef.current]!.missing)).then((done) => {
        if (done) rest()
      })
    })
  }

  const onChipTap = (value: number) => {
    if (exitedRef.current || resolvedRef.current) return
    const { missing } = round[bedRef.current]!
    if (guidedRef.current && value !== missing) return
    // A tap during a line cuts it and plays its own response.
    player.cancelActive()
    if (value === missing) right(value)
    else wrong(value)
  }

  const onBedTap = () => {
    if (!waitingRef.current || speakingRef.current || resolvedRef.current) {
      return
    }
    ask(bedRef.current)
  }

  const { ribbon } = layout
  const changeMs = reducedMotion ? REDUCED_BED_CHANGE_MS : BED_CHANGE_MS
  return (
    <>
      <Animated.View
        testID="game-background"
        entering={FadeIn.duration(GAME_FADE_MS)}
        exiting={FadeOut.duration(GAME_FADE_MS)}
        style={styles.background}
      />
      <Animated.View
        testID="game"
        entering={FadeIn.duration(GAME_FADE_MS)}
        exiting={FadeOut.duration(GAME_FADE_MS)}
        style={styles.foreground}
      >
        <MathHud
          world={GAME_HUD}
          hud={layout.hud}
          landscape={layout.form === 'phone-landscape'}
          metrics={layout.hudMetrics}
          problemCount={round.length}
          problemIndex={done}
          stardust={0}
          streak={0}
          showStreak={false}
          streakFadingOut={false}
          celebrating={false}
          onBack={exit}
          peek
        />

        {caption.text !== '' && (
          <CaptionRibbon
            testID="game-ribbon"
            text={caption.text}
            revealedCount={caption.revealed}
            lineKey={`${caption.key}`}
            fontSize={layout.captionFontSize}
            lineHeight={layout.captionLineHeight}
            padding={layout.ribbonPadding}
            style={[
              styles.clayRibbon,
              { left: ribbon.x, top: ribbon.y, width: ribbon.width },
            ]}
          />
        )}

        {leaving !== null && (
          <BedLayer
            key={`leaving-${leaving}`}
            role="out"
            distance={layout.safe.width}
            ms={changeMs}
            reducedMotion={reducedMotion}
            testID={reducedMotion ? 'game-bed-crossfade' : 'game-bed-slide'}
          >
            <View style={[styles.abs, boxStyle]}>
              <FlowerBed
                width={box.width}
                given={10}
                testIDPrefix="game-bed-leaving"
              />
            </View>
          </BedLayer>
        )}
        <BedLayer
          key={`bed-${bed}`}
          role={bed === 0 ? 'still' : 'in'}
          distance={layout.safe.width}
          ms={changeMs}
          reducedMotion={reducedMotion}
        >
          <Pressable
            testID="game-bed"
            accessibilityRole="button"
            accessibilityLabel={
              GAME_LINE_MANIFEST[bedLines(current.given).ask].text
            }
            onPress={onBedTap}
            style={[styles.abs, boxStyle]}
          >
            <FlowerBed
              width={box.width}
              given={current.given}
              filled={filled}
              landMs={landMs}
              hint={hint}
            />
          </Pressable>
        </BedLayer>

        {chipsUp && (
          <Animated.View
            key={`chips-${bed}`}
            exiting={FadeOut.duration(150)}
            style={[
              styles.abs,
              styles.chips,
              {
                left: chips.rect.x,
                top: chips.rect.y,
                width: chips.rect.width,
                height: chips.rect.height,
                gap: chips.gap,
              },
            ]}
          >
            {chipValues.map((value) => {
              const isRight = value === current.missing
              return (
                <AnswerChip
                  key={value}
                  value={value}
                  size={chips.size}
                  font={chips.font}
                  radius={chips.radius}
                  gateOpen={gateOpen}
                  resolved={resolved}
                  dimForGuided={guided && !isRight}
                  glow={guided && isRight && !resolved}
                  shaking={shaking === value}
                  bursting={resolved && isRight}
                  onTap={onChipTap}
                />
              )
            })}
          </Animated.View>
        )}

        {hops !== null && (
          <View pointerEvents="none" style={styles.hops}>
            {hops.to.map((to, j) => (
              <HopBud
                key={j}
                testID={`game-hop-${j}`}
                from={hops.from}
                to={to}
                size={hops.size}
                delayMs={HOP_STAGGER_MS * j}
              />
            ))}
          </View>
        )}
      </Animated.View>
    </>
  )
}

/**
 * A bed's layer for the change between beds: the next slides in from the
 * right while the full one slides out to the left, by the safe width,
 * 300 ms ease-out; Reduce Motion: a 200 ms crossfade. Read at mount; a new
 * `distance` (rotation) jumps it to its end.
 */
function BedLayer({
  role,
  distance,
  ms,
  reducedMotion,
  testID,
  children,
}: {
  role: 'still' | 'in' | 'out'
  distance: number
  ms: number
  reducedMotion: boolean
  testID?: string
  children: ReactNode
}) {
  const [initial] = useState(() => ({ role, reducedMotion, distance }))
  const x = useSharedValue(
    initial.role === 'in' && !initial.reducedMotion ? distance : 0,
  )
  const opacity = useSharedValue(
    initial.role === 'in' && initial.reducedMotion ? 0 : 1,
  )
  useEffect(() => {
    const timing = { duration: ms, easing: EASE_OUT }
    if (initial.role === 'still') return
    if (initial.reducedMotion) {
      opacity.set(withTiming(initial.role === 'in' ? 1 : 0, timing))
    } else {
      x.set(withTiming(initial.role === 'in' ? 0 : -initial.distance, timing))
    }
    // Mount-once: the change starts when the layer mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (distance === initial.distance || initial.role === 'still') return
    // A rotation mid-change: the end state, at once.
    x.set(initial.role === 'out' && !initial.reducedMotion ? -distance : 0)
    opacity.set(initial.role === 'out' && initial.reducedMotion ? 0 : 1)
  }, [distance, initial, x, opacity])
  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: x.get() }],
  }))
  return (
    <Animated.View
      testID={testID}
      pointerEvents="box-none"
      style={[styles.layer, style]}
    >
      {children}
    </Animated.View>
  )
}

/**
 * One bud's hop (§ 2.4): from the chip's centre to its slot over 360 ms, x
 * linear, y on an arc 32 pt above the straight line at its middle (180 ms
 * up, ease-out; 180 ms down, ease-in), scale 0.5 → 1. It is gone the moment
 * it lands: the slot's own bud blooms there.
 */
function HopBud({
  from,
  to,
  size,
  delayMs,
  testID,
}: {
  from: Point
  to: Point
  size: number
  delayMs: number
  testID: string
}) {
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const scale = useSharedValue(0.5)
  const opacity = useSharedValue(0)
  useEffect(() => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const half = HOP_MS / 2
    opacity.set(
      withDelay(
        delayMs,
        withSequence(
          withTiming(1, { duration: 0 }),
          withDelay(HOP_MS, withTiming(0, { duration: 0 })),
        ),
      ),
    )
    x.set(
      withDelay(
        delayMs,
        withTiming(dx, { duration: HOP_MS, easing: Easing.linear }),
      ),
    )
    y.set(
      withDelay(
        delayMs,
        withSequence(
          withTiming(dy / 2 - HOP_ARC, { duration: half, easing: EASE_OUT }),
          withTiming(dy, { duration: half, easing: EASE_IN }),
        ),
      ),
    )
    scale.set(withDelay(delayMs, withTiming(1, { duration: HOP_MS })))
    // Mount-once: a hop flies once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { scale: scale.get() },
    ],
  }))
  return (
    <Animated.View
      testID={testID}
      style={[
        styles.abs,
        {
          left: from.x - size / 2,
          top: from.y - size / 2,
          width: size,
          height: size,
        },
        style,
      ]}
    >
      <BudGlyph size={size} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Math's: a soft pink glow at 50 % / 30 % over a cream gradient.
  background: {
    ...FILL,
    zIndex: 0,
    pointerEvents: 'none',
    backgroundColor: colors.myCream,
    experimental_backgroundImage:
      'radial-gradient(circle at 50% 30%, rgba(255, 224, 230, 0.55) 0%, rgba(255, 245, 240, 0) 60%), linear-gradient(180deg, #FFF5F0 0%, #FFF8F2 100%)',
  },
  foreground: { ...FILL, zIndex: 2, pointerEvents: 'box-none' },
  layer: { ...FILL },
  hops: { ...FILL },
  abs: { position: 'absolute' },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Math's `.clay-ribbon`: a cream clay speech slab, no outline.
  clayRibbon: {
    position: 'absolute',
    borderWidth: 0,
    borderRadius: 32,
    backgroundColor: '#fff7ee',
    experimental_backgroundImage: 'linear-gradient(#fffdf8, #fff1e2)',
    boxShadow:
      'inset 0 3px 0 #ffffff, 0 8px 0 #efcfb4, 0 14px 22px rgba(90, 45, 20, 0.16)',
  },
})
