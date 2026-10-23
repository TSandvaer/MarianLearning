/**
 * Letter critters (play-place spec § 3): the letters the learner knows are
 * round creatures in burrows on a meadow; she drags 2-3 of them onto a
 * log's seats and they sing their sounds. Three that spell one of her
 * picture words play that word's tuned blend clip, each critter bouncing on
 * its sound, and the picture pops. Three that make another real word sing,
 * then, 300 ms after the last sound, Emma says the word (its Lily clip,
 * `critterWordLine`) and they bounce and sit together, with no praise,
 * sparkle or picture (Thomas 2026-10-22; Dave's safeguards). A word on
 * Dave's never-say or not-said list sings and sits, quietly (D5). Three
 * that make no word sing, boing and tumble, and Emma says one of three
 * non-word lines, in turn, every time (Thomas 2026-10-22); before blending
 * sounds (`critterFunnyOpen`, read once at mount) they sing and sit,
 * quietly, too (Dave's safeguard, Thomas 2026-10-22). A real word is
 * never a mistake, and no run is spoken as a word unless it is a picture
 * word or a said word.
 *
 * Every run of three ends with the shelf cleared (Thomas 2026-10-23,
 * Marian's play test): from its first sound the board waits; once the
 * outcome is over (the said word, the picture's leave, the tumble and the
 * line, or the sounds) the three drop home to their burrows and the log is
 * empty. A drag hint (the story cue's hand, dragging a critter up to the
 * log) comes with the open line, and again after `HINT_IDLE_MS` without a
 * drag, until her first run of three; Emma says the line with it twice at
 * most.
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
import { critterWordLine } from '@marian/core/emmasPath/guidanceLines'
import {
  CRITTER_PICTURE_WORDS,
  CRITTER_SOUND_SOURCE,
  critterFunnyOpen,
  critterRun,
  critterSet,
} from '@marian/core/games/playPlace'
import { loadProgress } from '@marian/core/progress'
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
  Easing,
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
  STORY_TAP_CUE_CANCEL_OUT_MS,
  storyTapCueSize,
} from '../wordSong/storyTapCueMotion'
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
import { DragHintHand, DRAG_HINT_MS } from './DragHintHand'
import { OVER_PIECE_Z } from './dragLock'
import { DragPiece } from './DragPiece'
import {
  centre,
  contains,
  critterScene,
  grow,
  type CritterScene,
  type Point,
} from './playGeometry'
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
/** The three bounce together (0.15 c, 250 ms); a tumble; a dim (§ 3.7). */
export const BOUNCE_MS = 250
export const TUMBLE_MS = 500
export const DIM_MS = 300
/** A run's outcome is over → the shelf drops home (Thomas 2026-10-23). */
export const SHELF_HOLD_MS = 400
/** The three fall to their burrows; Reduce Motion: they fade. */
export const SHELF_DROP_MS = 400
export const SHELF_FADE_MS = 300
/** No drag for this long → the drag hint again, until her first run. */
export const HINT_IDLE_MS = 8000
/** Emma says the open line with the hint at most this often a visit. */
export const HINT_LINES = 2

const HONEY = '#f2c27a'
const HONEY_LEDGE = '#b27b37'
const LETTER = '#6b3f1f'
const PUPIL = '#3d2112'
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

export interface LetterCrittersProps {
  kit: GameKit
  /**
   * Test seams: the tap-sound player, and the picture words the visit's
   * letters are drawn from (default all 45, `CRITTER_PICTURE_WORDS`).
   */
  sounds?: TapClipPlayer
  words?: readonly string[]
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

type Outcome = 'pair' | 'real' | 'word' | 'funny'

/** Whether a non-word boings for the playing learner; unreadable: quiet. */
function readFunny(): boolean {
  try {
    return critterFunnyOpen(loadProgress())
  } catch {
    return false
  }
}

export function LetterCritters({
  kit,
  sounds,
  words = CRITTER_PICTURE_WORDS,
}: LetterCrittersProps) {
  const { reducedMotion, sfx } = kit
  const [visit] = useState(() => critterSet(words, kit.rng))
  const [funny] = useState(readFunny)
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
  /** A run of three, until the shelf is clear: the board waits; Back stays live. */
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
  /** The shelf dropping home: who falls from which seat. */
  const [falling, setFalling] = useState<
    { letter: string; seat: number }[] | null
  >(null)
  const [hint, setHint] = useState<{ key: number; leaving: boolean } | null>(
    null,
  )
  const draggingRef = useRef(false)
  const songRef = useRef(0)
  const singDueRef = useRef(false)
  const gigglesRef = useRef(0)
  const droppingRef = useRef(false)
  /** She has made a run of three: no more hints this visit. */
  const ranRef = useRef(false)
  const hintRef = useRef(0)
  const hintLinesRef = useRef(0)
  const idleRef = useRef(0)

  const setSeats = (next: Seats) => {
    seatsRef.current = next
    setSeatsState(next)
  }
  const lock = (on: boolean) => {
    lockedRef.current = on
    setLocked(on)
  }

  // --- The drag hint (§ 3.3, Thomas 2026-10-23) --------------------------

  /** The hand, with Emma's open line the first `HINT_LINES` times. */
  const showHint = () => {
    if (ranRef.current) return
    const key = ++hintRef.current
    setHint({ key, leaving: false })
    kit.later(() => {
      if (hintRef.current !== key) return
      setHint(null)
      armIdle()
    }, DRAG_HINT_MS)
    if (hintLinesRef.current >= HINT_LINES) return
    hintLinesRef.current += 1
    kit.setPose('listening')
    void kit.speak('guide.play.critters.open').then((ok) => {
      if (ok) kit.setPose('idle')
    })
  }
  /** Her drag or her run: the hand fades out. */
  const endHint = () => {
    const key = ++hintRef.current
    setHint((h) => (h === null ? h : { ...h, leaving: true }))
    kit.later(() => {
      if (hintRef.current === key) setHint(null)
    }, STORY_TAP_CUE_CANCEL_OUT_MS)
  }
  /** `HINT_IDLE_MS` from now with no drag: the hint again. */
  const armIdle = () => {
    const token = ++idleRef.current
    if (ranRef.current) return
    kit.advance(() => {
      if (idleRef.current !== token || ranRef.current) return
      if (draggingRef.current || lockedRef.current) return
      showHint()
    }, HINT_IDLE_MS)
  }

  // --- A run of three and the shelf (Thomas 2026-10-23) -----------------

  /** From the run's first sound the board waits until the shelf is clear. */
  const startRun = () => {
    lock(true)
    ranRef.current = true
    idleRef.current += 1
    endHint()
  }
  /** The outcome is over: `after` ms on, the shelf drops home. */
  const settle = (token: number, after = 0) =>
    kit.advance(() => {
      if (songRef.current === token) dropShelf()
    }, after + SHELF_HOLD_MS)
  /** The seated critters fall to their burrows; the log is empty, ready. */
  const dropShelf = () => {
    if (droppingRef.current) return
    droppingRef.current = true
    const home = seatsRef.current.flatMap((letter, seat) =>
      letter === null ? [] : [{ letter, seat }],
    )
    setSeats(EMPTY_SEATS)
    setLean(false)
    setPicture(null)
    setSeatBounce([0, 0, 0])
    setFalling(home)
    kit.advance(
      () => {
        droppingRef.current = false
        setFalling(null)
        lock(false)
      },
      reducedMotion ? SHELF_FADE_MS : SHELF_DROP_MS,
    )
  }

  // The hint and its open line; unmount: the sound in flight stops, the
  // player is freed.
  useEffect(() => {
    kit.later(showHint, CRITTERS_OPEN_DELAY_MS)
    return () => {
      songRef.current += 1
      player.release()
    }
    // Mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The app goes to the background: the sound stops (it never resumes). A
  // run cut short still ends with the log empty, once she is back.
  useEffect(() => {
    if (kit.cancelKey.endsWith('hidden')) {
      songRef.current += 1
      player.cut()
      if (lockedRef.current) {
        kit.advance(() => {
          kit.setPose('idle')
          dropShelf()
        }, 0)
      }
    }
    // Only a new key cancels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    endHint()
    armIdle()
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
    const kind = run.length === 3 ? critterRun(word, { funny }) : null
    if (kind !== null) startRun()
    if (kind === 'picture') {
      pictureWord(word, run)
      return
    }
    song(
      run,
      letters,
      kind === null ? 'pair' : kind === 'quiet' ? 'real' : kind,
    )
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
        if (songRef.current !== token) return
        setPicture({ word, leaving: true })
        kit.advance(
          () => {
            if (songRef.current !== token) return
            setPicture(null)
            kit.setPose('idle')
            settle(token)
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
        after(run, letters.join(''), outcome, token)
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

  /**
   * Called `SOUND_GAP_MS` after the last sound ends. A run of three then
   * settles: the shelf drops home once its outcome is over.
   */
  const after = (
    run: number[],
    word: string,
    outcome: Outcome,
    token: number,
  ) => {
    if (outcome === 'pair') {
      setLean(true)
      kit.setPose('idle')
      return
    }
    const line = outcome === 'word' ? critterWordLine(word) : undefined
    const clip = line === undefined ? null : audioForWebPath(line.src)
    if (typeof clip === 'number') {
      // A said word (play-place § 3.3, Thomas 2026-10-22): Emma says it,
      // the three bounce together as it starts, then sit. No praise line,
      // no sparkle, no picture (Dave's safeguard 2).
      run.forEach(bounceSeat)
      setLean(true)
      player.play(clip, 0, null, () => {
        if (songRef.current !== token) return
        kit.setPose('idle')
        settle(token)
      })
      return
    }
    if (outcome === 'real' || outcome === 'word') {
      run.forEach(bounceSeat)
      setLean(true)
      kit.setPose('idle')
      settle(token, BOUNCE_MS)
      return
    }
    sfx.boing.play()
    setTumble((t) => t + 1)
    // Every non-word gets a line, the three in turn (Thomas 2026-10-22).
    gigglesRef.current = (gigglesRef.current % 3) + 1
    kit.setPose('cheering')
    // The shelf waits for both the tumble (or the dim) and the line.
    let left = 2
    const over = () => {
      left -= 1
      if (left === 0) settle(token)
    }
    kit.later(over, reducedMotion ? DIM_MS : TUMBLE_MS)
    void kit
      .speak(crittersFunnyLine(gigglesRef.current as 1 | 2 | 3))
      .then((ok) => {
        if (ok && songRef.current === token) kit.setPose('idle')
        over()
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
    if (lockedRef.current || draggingRef.current) return
    kit.cutLine()
    songRef.current += 1
    player.cut()
    sing()
  }

  const dragStart = (letter?: string) => {
    kit.cutLine()
    draggingRef.current = true
    endHint()
    armIdle()
    if (letter !== undefined) setTwin(letter)
  }
  const dragEnd = () => {
    draggingRef.current = false
    setTwin(null)
    armIdle()
    if (singDueRef.current && !lockedRef.current) scheduleSing()
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

      {falling?.map(({ letter, seat }) => (
        <Falling
          key={`fall-${seat}`}
          seat={seat}
          letter={letter}
          from={scene.seats[seat]!}
          to={scene.cells[visit.letters.indexOf(letter)]!}
          reducedMotion={reducedMotion}
        />
      ))}

      {hint !== null && (
        <DragHintHand
          key={hint.key}
          {...hintPath(scene, seats)}
          size={storyTapCueSize(kit.tablet)}
          reducedMotion={reducedMotion}
          leaving={hint.leaving}
        />
      )}

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
 * The drag hint's path: from the top row's critter nearest the log's
 * middle up to the first free seat.
 */
function hintPath(
  scene: CritterScene,
  seats: Seats,
): { from: Point; to: Point } {
  const top = Math.min(...scene.cells.map((r) => r.y))
  const mid = centre(scene.log).x
  const from = scene.cells
    .filter((r) => r.y === top)
    .reduce((a, b) =>
      Math.abs(centre(b).x - mid) < Math.abs(centre(a).x - mid) ? b : a,
    )
  const free = seats.indexOf(null)
  return { from: centre(from), to: centre(scene.seats[free < 0 ? 1 : free]!) }
}

/**
 * A seated critter dropping home when the shelf clears (Thomas 2026-10-23):
 * it falls from its seat to its burrow and shrinks to the meadow's size
 * (400 ms, ease-in), landing on the critter that sits there; Reduce Motion:
 * it fades where it sits (300 ms), the burrow's critter already home.
 */
function Falling({
  seat,
  letter,
  from,
  to,
  reducedMotion,
}: {
  seat: number
  letter: string
  from: Rect
  to: Rect
  reducedMotion: boolean
}) {
  const p = useSharedValue(0)
  const o = useSharedValue(1)
  useEffect(() => {
    if (reducedMotion) o.set(withTiming(0, { duration: SHELF_FADE_MS }))
    else {
      p.set(
        withTiming(1, {
          duration: SHELF_DROP_MS,
          easing: Easing.in(Easing.quad),
        }),
      )
    }
    // Mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Reduce Motion fades in place: no move, no shrink.
  const move = reducedMotion ? 0 : 1
  const dx = move * (centre(from).x - centre(to).x)
  const dy = move * (centre(from).y - centre(to).y)
  const grown = reducedMotion ? 1 : from.width / to.width
  const style = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [
      { translateX: (1 - p.get()) * dx },
      { translateY: (1 - p.get()) * dy },
      { scale: grown + (1 - grown) * p.get() },
    ],
  }))
  const at = reducedMotion ? from : to
  return (
    <Animated.View
      testID={`critter-${reducedMotion ? 'fade' : 'drop'}-${seat}`}
      pointerEvents="none"
      style={[styles.abs, styles.over, rectStyle(at), style]}
    >
      <Critter
        letter={letter}
        size={at.width}
        bounce={0}
        reducedMotion={reducedMotion}
      />
    </Animated.View>
  )
}

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
        styles.over,
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
  // Over every critter, the log and the drag layer (`dragLock.ts`).
  over: { zIndex: OVER_PIECE_Z },
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
