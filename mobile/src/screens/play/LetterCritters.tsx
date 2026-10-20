/**
 * Letter critters (play-place spec § 3): the letters the learner knows are
 * round creatures in burrows on a meadow; she drags 2-3 of them onto a
 * log's seats and they sing their sounds. Three that spell one of her
 * picture words play that word's tuned blend clip, each critter bouncing on
 * its sound, and the picture pops. Three that make another real word sing
 * and sit together, quietly (D5). Three that make no word sing, boing and
 * tumble, and Emma giggles (two giggle lines a visit at most). A real word
 * is never a mistake, and no run is ever spoken as a word unless it is a
 * picture word.
 *
 * Every sound is a bundled Word Song blend clip (`/native/blend/<word>.mp3`,
 * marks straight from `BLEND_MARKS`, K2): a word plays its whole clip; a
 * letter plays the lesson's tap window of its `CRITTER_SOUND_SOURCE`
 * segment. The game makes no network call and writes nothing. It has no
 * rounds and no end of its own: she leaves with Back.
 *
 * Reduce Motion (§ 3.7): no bounce, hop, spring or tumble; the singing
 * letter lights, the picture fades, a non-word dims. Dragging still
 * follows the finger.
 */
import {
  CRITTER_SOUND_SOURCE,
  critterRun,
  critterSet,
  critterWords,
} from '@marian/core/games/playPlace'
import { loadProgress, type Progress } from '@marian/core/progress'
import { Image } from 'expo-image'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { pictureAsset } from '../../assets'
import { letterWindow, MARK_LEAD_MS } from '../../audio/blendMarks'
import { audioForWebPath } from '../../audio/bundledAudio'
import { audioEngine } from '../../audio/engine'
import { createTapClipPlayer, type TapClipPlayer } from '../../audio/tapClip'
import type { Rect } from '../../layout/layout'
import { colors, fonts } from '../../theme'
import {
  blendClipPath,
  blendSegments,
  EMPTY_SEATS,
  seatAt,
  seatedRun,
  swapSeats,
  unseat,
  type Seats,
} from './critterModel'
import { DragPiece } from './DragPiece'
import { contains, critterScene, grow, type Point } from './playGeometry'
import type { GameKit } from './playKit'
import { critterLabel, crittersFunnyLine, PLAY_LABELS } from './playLines'

/** The open line: 300 ms after the 200 ms fade-in (§ 3.3). */
export const CRITTERS_OPEN_DELAY_MS = 500
/** The last seat change → the song (§ 3.3). */
export const SING_AFTER_MS = 400
/** Between one critter's sound and the next (the blend clips' rhythm). */
export const SOUND_GAP_MS = 300
/** A picture word: clip end → the picture floats away (500 ms). */
export const PICTURE_HOLD_MS = 2400
export const PICTURE_LEAVE_MS = 500
/** At most two giggle lines a visit. */
export const MAX_GIGGLES = 2

const HONEY = '#f2c27a'
const HONEY_LEDGE = '#b27b37'
const LETTER = '#6b3f1f'
const PUPIL = '#3d2112'
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

export interface LetterCrittersProps {
  kit: GameKit
  /** Test seams: the tap-sound player, and the learner's progress. */
  sounds?: TapClipPlayer
  progress?: Progress | null
}

function readProgress(): Progress | null {
  try {
    return loadProgress()
  } catch {
    return null
  }
}

/** A letter's own sound: its source clip and tap window (§ 3.4). */
function letterSound(letter: string) {
  const source = CRITTER_SOUND_SOURCE[letter]
  if (source === undefined) return null
  const segments = blendSegments(source.word)
  const clip = audioForWebPath(blendClipPath(source.word))
  if (segments === null || typeof clip !== 'number') return null
  return { clip, window: letterWindow(segments[source.index]!) }
}

type Outcome = 'pair' | 'real' | 'funny'

export function LetterCritters({ kit, sounds, progress }: LetterCrittersProps) {
  const { reducedMotion, sfx } = kit
  const [visit] = useState(() =>
    critterSet(
      critterWords(progress === undefined ? readProgress() : progress),
      kit.rng,
    ),
  )
  const [player] = useState<TapClipPlayer>(
    () => sounds ?? createTapClipPlayer(audioEngine),
  )
  const scene = critterScene(
    kit.area,
    kit.tablet,
    kit.landscape,
    visit.letters.length,
  )
  const sceneRef = useRef(scene)
  useLayoutEffect(() => {
    sceneRef.current = scene
  })

  const [seats, setSeatsState] = useState<Seats>(EMPTY_SEATS)
  const seatsRef = useRef<Seats>(EMPTY_SEATS)
  /** A picture word is up: the board waits; Back stays live. */
  const [locked, setLocked] = useState(false)
  const lockedRef = useRef(false)
  const [picture, setPicture] = useState<{
    word: string
    leaving: boolean
  } | null>(null)
  /** Bounce counters: per seat, and per meadow letter. */
  const [seatBounce, setSeatBounce] = useState([0, 0, 0])
  const [meadowHop, setMeadowHop] = useState<Record<string, number>>({})
  const [tumble, setTumble] = useState(0)
  const [lean, setLean] = useState(false)
  const [twin, setTwin] = useState<string | null>(null)
  const draggingRef = useRef(false)
  const songRef = useRef(0)
  const singDueRef = useRef(false)
  const gigglesRef = useRef(0)

  const setSeats = (next: Seats) => {
    seatsRef.current = next
    setSeatsState(next)
  }
  const lock = (on: boolean) => {
    lockedRef.current = on
    setLocked(on)
  }

  // The open line; unmount: the sound in flight stops, the player is freed.
  useEffect(() => {
    kit.later(() => {
      kit.setPose('listening')
      void kit.speak('guide.play.critters.open').then((ok) => {
        if (ok) kit.setPose('idle')
      })
    }, CRITTERS_OPEN_DELAY_MS)
    return () => {
      songRef.current += 1
      player.release()
    }
    // Mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The app goes to the background: the sound stops (it never resumes).
  useEffect(() => {
    if (kit.cancelKey.endsWith('hidden')) {
      songRef.current += 1
      player.cut()
    }
  }, [kit.cancelKey, player])

  const bounceSeat = (i: number) =>
    setSeatBounce((b) => b.map((n, k) => (k === i ? n + 1 : n)))

  /** Plays `letter`'s own sound; `onEnd` once it stops. */
  const singLetter = (letter: string, onEnd?: () => void) => {
    const sound = letterSound(letter)
    if (sound === null) {
      onEnd?.()
      return
    }
    player.play(sound.clip, sound.window.from, sound.window.to, onEnd)
  }

  /** A seat change: any song stops; the run sings 400 ms after the last. */
  const changed = (next: Seats) => {
    setSeats(next)
    setLean(false)
    songRef.current += 1
    player.cut()
    scheduleSing()
  }
  const scheduleSing = () => {
    const token = ++songRef.current
    singDueRef.current = true
    kit.advance(() => {
      if (songRef.current !== token) return
      if (draggingRef.current) return
      singDueRef.current = false
      sing()
    }, SING_AFTER_MS)
  }

  const sing = () => {
    const current = seatsRef.current
    const run = seatedRun(current)
    if (run === null) return
    const letters = run.map((i) => current[i]!)
    const word = letters.join('')
    const kind = run.length === 3 ? critterRun(word, visit.words) : null
    if (kind === 'picture') pictureWord(word, run)
    else song(run, letters, kind === null ? 'pair' : kind)
  }

  const pictureWord = (word: string, run: number[]) => {
    const segments = blendSegments(word)
    const clip = audioForWebPath(blendClipPath(word))
    if (segments === null || typeof clip !== 'number') {
      song(
        run,
        run.map((i) => seatsRef.current[i]!),
        'real',
      )
      return
    }
    const token = ++songRef.current
    lock(true)
    kit.cutLine()
    kit.setPose('listening')
    const at = (ms: number, fn: () => void) =>
      kit.later(
        () => {
          if (songRef.current === token) fn()
        },
        Math.max(0, ms - MARK_LEAD_MS),
      )
    run.forEach((seat, k) => at(segments[k]![0], () => bounceSeat(seat)))
    at(segments[3]![0], () => {
      run.forEach(bounceSeat)
      setPicture({ word, leaving: false })
      sfx.sparkle.play()
      kit.setPose('celebration')
    })
    player.play(clip, 0, null, () => {
      if (songRef.current !== token) return
      kit.advance(() => {
        setPicture({ word, leaving: true })
        kit.advance(
          () => {
            setPicture(null)
            kit.setPose('idle')
            lock(false)
          },
          reducedMotion ? 300 : PICTURE_LEAVE_MS,
        )
      }, PICTURE_HOLD_MS)
    })
  }

  const song = (run: number[], letters: string[], outcome: Outcome) => {
    const token = ++songRef.current
    kit.cutLine()
    kit.setPose('listening')
    const next = (k: number) => {
      if (songRef.current !== token) return
      if (k === letters.length) {
        after(run, outcome)
        return
      }
      bounceSeat(run[k]!)
      singLetter(letters[k]!, () => {
        if (songRef.current !== token) return
        kit.later(() => next(k + 1), SOUND_GAP_MS)
      })
    }
    next(0)
  }

  const after = (run: number[], outcome: Outcome) => {
    if (outcome === 'pair') {
      setLean(true)
      kit.setPose('idle')
      return
    }
    if (outcome === 'real') {
      run.forEach(bounceSeat)
      setLean(true)
      kit.setPose('idle')
      return
    }
    sfx.boing.play()
    setTumble((t) => t + 1)
    if (gigglesRef.current >= MAX_GIGGLES) {
      kit.setPose('idle')
      return
    }
    gigglesRef.current += 1
    kit.setPose('cheering')
    void kit
      .speak(crittersFunnyLine(gigglesRef.current as 1 | 2))
      .then((ok) => {
        if (ok) kit.setPose('idle')
      })
  }

  // --- Moves -------------------------------------------------------------

  const seatAtPoint = (p: Point): number => {
    const { seats: rects, c } = sceneRef.current
    return rects.findIndex((r) => contains(grow(r, 0.2 * c), p))
  }

  const onMeadowTap = (letter: string) => {
    if (lockedRef.current) return
    kit.cutLine()
    setMeadowHop((h) => ({ ...h, [letter]: (h[letter] ?? 0) + 1 }))
    singLetter(letter)
  }

  const onMeadowActivate = (letter: string) => {
    if (lockedRef.current) return
    kit.cutLine()
    const free = seatsRef.current.indexOf(null)
    if (free < 0) singLetter(letter)
    else changed(seatAt(seatsRef.current, free, letter))
  }

  const onMeadowDrop = (letter: string, p: Point): boolean => {
    const seat = seatAtPoint(p)
    if (seat < 0 || lockedRef.current) return false
    changed(seatAt(seatsRef.current, seat, letter))
    return true
  }

  const onSeatTap = (seat: number) => {
    if (lockedRef.current) return
    const letter = seatsRef.current[seat]
    if (letter === null || letter === undefined) return
    kit.cutLine()
    bounceSeat(seat)
    singLetter(letter)
  }

  const onSeatDrop = (seat: number, p: Point): boolean => {
    if (lockedRef.current) return false
    const to = seatAtPoint(p)
    if (to === seat) return false
    if (to >= 0) {
      changed(swapSeats(seatsRef.current, seat, to))
      return true
    }
    if (contains(grow(sceneRef.current.logBand, 0.2 * sceneRef.current.c), p)) {
      return false
    }
    changed(unseat(seatsRef.current, seat))
    return true
  }

  const onLogTap = () => {
    if (lockedRef.current) return
    kit.cutLine()
    songRef.current += 1
    player.cut()
    sing()
  }

  const dragStart = (letter?: string) => {
    kit.cutLine()
    draggingRef.current = true
    if (letter !== undefined) setTwin(letter)
  }
  const dragEnd = () => {
    draggingRef.current = false
    setTwin(null)
    if (singDueRef.current) scheduleSing()
  }

  // --- Drawing -----------------------------------------------------------

  const { c } = scene
  const run = seatedRun(seats)
  return (
    <View testID="letter-critters" pointerEvents="box-none" style={styles.fill}>
      <Pressable
        testID="critter-log"
        accessibilityRole="button"
        accessibilityLabel={PLAY_LABELS.log}
        onPress={onLogTap}
        style={[styles.abs, rectStyle(scene.logBand)]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.log,
            {
              left: 0,
              top: scene.log.y - scene.logBand.y,
              width: scene.log.width,
              height: scene.log.height,
              borderRadius: scene.log.height / 2,
            },
          ]}
        />
      </Pressable>

      <Tumble count={tumble} c={c} reducedMotion={reducedMotion}>
        {seats.map((letter, i) => {
          if (letter === null) return null
          const r = scene.seats[i]!
          const inRun = lean && run !== null && run.includes(i)
          const leanDeg = inRun
            ? i === run![0]
              ? 6
              : i === run![run!.length - 1]
                ? -6
                : 0
            : 0
          return (
            <DragPiece
              key={`seat-${i}-${letter}`}
              testID={`critter-seat-${i}`}
              rect={r}
              accessibilityLabel={critterLabel(letter, true)}
              disabled={locked}
              reducedMotion={reducedMotion}
              cancelKey={kit.cancelKey}
              onTap={() => onSeatTap(i)}
              onActivate={() => {
                if (!lockedRef.current) changed(unseat(seatsRef.current, i))
              }}
              onDragStart={() => dragStart()}
              onDragEnd={dragEnd}
              onDrop={(p) => onSeatDrop(i, p)}
            >
              <Seated reducedMotion={reducedMotion}>
                <Critter
                  letter={letter}
                  size={r.width}
                  bounce={seatBounce[i]!}
                  reducedMotion={reducedMotion}
                  leanDeg={leanDeg}
                />
              </Seated>
            </DragPiece>
          )
        })}
      </Tumble>

      {visit.letters.map((letter, i) => {
        const r = scene.cells[i]!
        return (
          <View key={letter} pointerEvents="box-none" style={styles.fill}>
            <View
              pointerEvents="none"
              style={[
                styles.burrow,
                {
                  left: r.x + 0.1 * c,
                  top: r.y + 0.78 * c,
                  width: 0.8 * c,
                  height: 0.26 * c,
                  borderRadius: 0.13 * c,
                },
              ]}
            />
            {twin === letter && (
              <View
                testID={`critter-twin-${letter}`}
                pointerEvents="none"
                style={[styles.abs, rectStyle(r)]}
              >
                <Pop reducedMotion={reducedMotion}>
                  <Critter
                    letter={letter}
                    size={c}
                    bounce={0}
                    reducedMotion={reducedMotion}
                  />
                </Pop>
              </View>
            )}
            <DragPiece
              testID={`critter-${letter}`}
              rect={r}
              accessibilityLabel={critterLabel(letter, false)}
              accessibilityActions={[{ name: 'hear', label: 'Hear' }]}
              onAccessibilityAction={(name) => {
                if (name === 'hear') onMeadowTap(letter)
              }}
              disabled={locked}
              reducedMotion={reducedMotion}
              cancelKey={kit.cancelKey}
              onTap={() => onMeadowTap(letter)}
              onActivate={() => onMeadowActivate(letter)}
              onDragStart={() => dragStart(letter)}
              onDragEnd={dragEnd}
              onDrop={(p) => onMeadowDrop(letter, p)}
            >
              <Critter
                letter={letter}
                size={c}
                bounce={meadowHop[letter] ?? 0}
                reducedMotion={reducedMotion}
              />
            </DragPiece>
          </View>
        )
      })}

      {picture !== null && (
        <PictureCard
          key={picture.word}
          word={picture.word}
          rect={scene.picture}
          leaving={picture.leaving}
          reducedMotion={reducedMotion}
        />
      )}
    </View>
  )
}

const rectStyle = (r: Rect) => ({
  left: r.x,
  top: r.y,
  width: r.width,
  height: r.height,
})

/**
 * A critter (§ 3.2): a round body, honey for consonants and pink for
 * vowels, on a ledge; two eyes in the top third, two small feet; its
 * letter, lower case, on its belly. A bounce (0.15 size, 250 ms) and the
 * lit pulse (1 → 1.2 → 1, 400 ms) on each new `bounce`; Reduce Motion: the
 * letter lights (120 ms in, 200 ms out), no pulse.
 */
function Critter({
  letter,
  size,
  bounce,
  reducedMotion,
  leanDeg = 0,
}: {
  letter: string
  size: number
  bounce: number
  reducedMotion: boolean
  leanDeg?: number
}) {
  const vowel = VOWELS.has(letter)
  const face = vowel ? colors.myPink : HONEY
  const ledge = vowel ? colors.myRose : HONEY_LEDGE
  const y = useSharedValue(0)
  const lit = useSharedValue(1)
  const glow = useSharedValue(0)
  const tilt = useSharedValue(0)
  useEffect(() => {
    if (bounce === 0) return
    if (reducedMotion) {
      glow.set(
        withSequence(
          withTiming(1, { duration: 120 }),
          withTiming(0, { duration: 200 }),
        ),
      )
      return
    }
    y.set(
      withSequence(
        withTiming(-0.15 * size, { duration: 125 }),
        withTiming(0, { duration: 125 }),
      ),
    )
    lit.set(
      withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(1, { duration: 200 }),
      ),
    )
  }, [bounce, reducedMotion, size, y, lit, glow])
  useEffect(() => {
    tilt.set(reducedMotion ? 0 : withTiming(leanDeg, { duration: 200 }))
  }, [leanDeg, reducedMotion, tilt])
  const body = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }, { rotate: `${tilt.get()}deg` }],
  }))
  const letterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: lit.get() }],
    textShadowRadius: 8 * glow.get(),
  }))
  const eye = 0.18 * size
  const pupil = 0.08 * size
  const foot = 0.22 * size
  return (
    <Animated.View pointerEvents="none" style={[styles.fillBox, body]}>
      {[0.22, 0.78].map((f) => (
        <View
          key={f}
          style={[
            styles.abs,
            {
              left: f * size - foot / 2,
              top: size - foot * 0.55,
              width: foot,
              height: foot * 0.55,
              borderRadius: foot / 2,
              backgroundColor: ledge,
            },
          ]}
        />
      ))}
      <View
        style={[
          styles.body,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: face,
            boxShadow: `0 2px 0 ${ledge}`,
          },
        ]}
      >
        {[0.32, 0.68].map((f) => (
          <View
            key={f}
            style={[
              styles.eye,
              {
                left: f * size - eye / 2,
                top: 0.16 * size,
                width: eye,
                height: eye,
                borderRadius: eye / 2,
              },
            ]}
          >
            <View
              style={{
                width: pupil,
                height: pupil,
                borderRadius: pupil / 2,
                backgroundColor: PUPIL,
              }}
            />
          </View>
        ))}
        <Animated.Text
          allowFontScaling={false}
          style={[
            styles.letter,
            {
              fontSize: 0.5 * size,
              lineHeight: 0.6 * size,
              marginTop: 0.28 * size,
            },
            letterStyle,
          ]}
        >
          {letter}
        </Animated.Text>
      </View>
    </Animated.View>
  )
}

/** A seated critter grows in (spring 300 / 22); Reduce Motion: a fade. */
function Seated({
  reducedMotion,
  children,
}: {
  reducedMotion: boolean
  children: ReactNode
}) {
  const s = useSharedValue(reducedMotion ? 1 : 0.8)
  useEffect(() => {
    if (!reducedMotion) s.set(withSpring(1, { stiffness: 300, damping: 22 }))
    // Mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }))
  return (
    <Animated.View
      entering={reducedMotion ? FadeIn.duration(150) : undefined}
      style={[styles.fillBox, style]}
    >
      {children}
    </Animated.View>
  )
}

/** The burrow's twin pops up (scale 0 → 1, 200 ms); Reduce Motion: at once. */
function Pop({
  reducedMotion,
  children,
}: {
  reducedMotion: boolean
  children: ReactNode
}) {
  const s = useSharedValue(reducedMotion ? 1 : 0)
  useEffect(() => {
    if (!reducedMotion) s.set(withTiming(1, { duration: 200 }))
    // Mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }))
  return (
    <Animated.View style={[styles.fillBox, style]}>{children}</Animated.View>
  )
}

/**
 * Three that are no word tumble (−12° → +12° → 0 with a 0.1 c drop,
 * 500 ms) and sit back up; Reduce Motion: they dim (1 → 0.6 → 1, 300 ms).
 */
function Tumble({
  count,
  c,
  reducedMotion,
  children,
}: {
  count: number
  c: number
  reducedMotion: boolean
  children: ReactNode
}) {
  const r = useSharedValue(0)
  const y = useSharedValue(0)
  const o = useSharedValue(1)
  useEffect(() => {
    if (count === 0) return
    if (reducedMotion) {
      o.set(
        withSequence(
          withTiming(0.6, { duration: 150 }),
          withTiming(1, { duration: 150 }),
        ),
      )
      return
    }
    r.set(
      withSequence(
        withTiming(-12, { duration: 165 }),
        withTiming(12, { duration: 170 }),
        withTiming(0, { duration: 165 }),
      ),
    )
    y.set(
      withSequence(
        withTiming(0.1 * c, { duration: 250 }),
        withTiming(0, { duration: 250 }),
      ),
    )
  }, [count, c, reducedMotion, r, y, o])
  const style = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [{ translateY: y.get() }, { rotate: `${r.get()}deg` }],
  }))
  return (
    <Animated.View pointerEvents="box-none" style={[styles.fill, style]}>
      {count > 0 && !reducedMotion && <View testID="critter-tumble" />}
      {count > 0 && reducedMotion && <View testID="critter-dim" />}
      {children}
    </Animated.View>
  )
}

/**
 * The picture word's card (§ 3.2, § 3.3): the pack picture on Word Song's
 * white card, springing up over the meadow (scale 0 → 1 on a 260 / 16
 * spring with a 150 ms fade); leaving, it floats up 0.3 p and fades over
 * 500 ms. Reduce Motion: fades in over 200 ms and out over 300 ms.
 */
function PictureCard({
  word,
  rect,
  leaving,
  reducedMotion,
}: {
  word: string
  rect: Rect
  leaving: boolean
  reducedMotion: boolean
}) {
  const s = useSharedValue(reducedMotion ? 1 : 0)
  const o = useSharedValue(0)
  const y = useSharedValue(0)
  useEffect(() => {
    if (reducedMotion) o.set(withTiming(1, { duration: 200 }))
    else {
      s.set(withSpring(1, { stiffness: 260, damping: 16 }))
      o.set(withTiming(1, { duration: 150 }))
    }
    // Mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!leaving) return
    if (reducedMotion) {
      o.set(withTiming(0, { duration: 300 }))
      return
    }
    y.set(withTiming(-0.3 * rect.height, { duration: PICTURE_LEAVE_MS }))
    o.set(withDelay(0, withTiming(0, { duration: PICTURE_LEAVE_MS })))
  }, [leaving, reducedMotion, rect.height, o, y])
  const style = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [{ translateY: y.get() }, { scale: s.get() }],
  }))
  return (
    <Animated.View
      testID="critter-picture"
      pointerEvents="none"
      style={[
        styles.abs,
        styles.card,
        rectStyle(rect),
        { borderRadius: 0.12 * rect.width },
        style,
      ]}
    >
      <Image
        testID={`critter-picture-${word}`}
        source={pictureAsset(word)}
        contentFit="contain"
        accessible={false}
        style={{ width: 0.86 * rect.width, height: 0.86 * rect.height }}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  fillBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
  log: {
    position: 'absolute',
    backgroundColor: '#c98a55',
    borderWidth: 2,
    borderColor: '#7d4a26',
  },
  burrow: { position: 'absolute', backgroundColor: 'rgba(61, 33, 18, 0.35)' },
  body: { alignItems: 'center', overflow: 'hidden' },
  eye: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontFamily: fonts.bold, color: LETTER, textShadowColor: '#ffffff' },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    boxShadow: '0 6px 14px rgba(60, 30, 10, 0.18)',
  },
})
