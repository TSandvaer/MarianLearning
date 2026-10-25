/**
 * Letter critters (play-place spec § 3): the letters the learner knows are
 * round creatures in burrows on a meadow; she drags 2-3 of them onto a
 * log's seats and they sing their sounds. A phone's meadow holds 16 (every
 * vowel, rotating consonants); a tablet where all of them fit both ways
 * holds every letter (Thomas 2026-10-23, build 20, `crittersFitBothWays`).
 * Three that spell one of her
 * picture words play that word's tuned blend clip, each critter bouncing on
 * its sound, and the picture pops. Three that make another real word sing,
 * then, 300 ms after the last sound, Emma says the word as her own line,
 * her caption with it, while they sit still; a said word with a pack
 * picture (`CRITTER_SAID_PICTURE_WORDS`) then pops it as a picture word
 * does (Thomas 2026-10-23, build 20). Every real word, picture or said,
 * then gets the joy beat: Emma cheers with the cheer, the three bounce
 * together and Word Song's burst leaves the middle seat; a picture word's
 * first build in a visit also gets the lesson's praise line ("Yes! That's
 * a fan.", Thomas 2026-10-25, Dave's ruling). A said word gets no praise
 * line and no sparkle. A word on
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
 * segment. The game makes no network call. Its one write is each word
 * Emma says, a picture word's or a said word's, to the learner's
 * seen-record (`./critterSeen.ts`; the cvc-words probe reserve skips a word
 * she met here). Before blending sounds it has no rounds and no end of its
 * own: she leaves with Back.
 *
 * From blending sounds (the same gate), the meadow is a word hunt
 * (`design/native/critters-word-hunt.md`, Dave's ruling of 2026-10-25):
 * six critters, her vowel (no twin, its burrow ringed while it is out)
 * and five consonants; a "3" on the log's end; and a board of empty slots,
 * one per word to find. A new word plays its outcome as above, then its
 * picture shrinks into the next empty slot and its letters fly up as
 * tiles; an extra joins the bonus chip; a repeat wiggles its slot. After
 * five runs without a new word, or 45 s without a drag, the first empty
 * slot glows: a tap plays the word to spell. At all but one word the
 * completion beat plays (each found word in turn, "You did it!", the
 * cheer and the burst), then New letters deals another round. The round
 * is kept per learner (`critterHunt.ts`): toy state, never progress.
 *
 * Reduce Motion (§ 3.7): no bounce, hop, spring, tumble or burst; the
 * singing letter lights (and at the joy beat the three light together),
 * the picture fades, a non-word dims. Dragging still follows the finger.
 */
import { critterWordLine } from '@marian/core/emmasPath/guidanceLines'
import {
  freshHuntRecord,
  HUNT_LENGTH,
  huntDeal,
  huntFind,
  huntHintTarget,
  huntProbeGuard,
  huntVowels,
  loadHuntRecord,
  saveHuntRecord,
  type HuntRecord,
} from '@marian/core/games/critterHunt'
import {
  CRITTER_CAP,
  CRITTER_PICTURE_WORDS,
  CRITTER_SAID_PICTURE_WORDS,
  CRITTER_SOUND_SOURCE,
  critterFunnyOpen,
  critterHasPicture,
  critterPictureKey,
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
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { pictureAsset } from '../../assets'
import { letterWindow, MARK_LEAD_MS, wordWindow } from '../../audio/blendMarks'
import { audioForWebPath } from '../../audio/bundledAudio'
import { audioEngine } from '../../audio/engine'
import { createTapClipPlayer, type TapClipPlayer } from '../../audio/tapClip'
import type { Rect } from '../../layout/layout'
import { chipInner } from '../../layout/wordSongLayout'
import { colors, fonts } from '../../theme'
import {
  STORY_TAP_CUE_CANCEL_OUT_MS,
  storyTapCueSize,
} from '../wordSong/storyTapCueMotion'
import { SPARKLE_BURST_MS, SparkleBurst } from '../wordSong/WordChip'
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
import { recordCritterWord } from './critterSeen'
import { DragHintHand, DRAG_HINT_MS } from './DragHintHand'
import { OVER_PIECE_Z } from './dragLock'
import { DragPiece } from './DragPiece'
import {
  BonusChip,
  FILL_LAND_MS,
  FILL_SETTLE_MS,
  FlyingTile,
  TILE_STAGGER_MS,
  NewLetters,
  NumeralDisc,
  Slot,
  VowelRing,
} from './HuntBoard'
import {
  centre,
  chipRect,
  chipTiles,
  contains,
  critterScene,
  crittersFitBothWays,
  grow,
  huntScene,
  type CritterScene,
  type HuntScene,
  type Point,
} from './playGeometry'
import type { GameKit } from './playKit'
import {
  bonusLabel,
  critterLabel,
  crittersFunnyLine,
  crittersPraiseLine,
  crittersWordLine,
  PLAY_LABELS,
  slotLabel,
} from './playLines'

/** The open line: 300 ms after the 200 ms fade-in (§ 3.3). */
export const CRITTERS_OPEN_DELAY_MS = 500
/** The last seat change → the song (§ 3.3). */
export const SING_AFTER_MS = 400
/** Between one critter's sound and the next (the blend clips' rhythm). */
export const SOUND_GAP_MS = 300
/** A picture word: clip end → the picture floats away (500 ms). */
export const PICTURE_HOLD_MS = 2400
export const PICTURE_LEAVE_MS = 500
/**
 * A real word's joy beat (Dave 2026-10-25): a picture word's comes 300 ms
 * after its clip, its first praise in a visit 1200 ms after (the cheer has
 * ended), and the picture leaves no sooner than 400 ms after the praise. A
 * said word's comes as her word line ends; without a picture Emma cheers
 * for 1200 ms (`POSE_HOLD_MS.cheering`).
 */
export const JOY_AFTER_MS = 300
export const PRAISE_AFTER_MS = 1200
export const PRAISE_TAIL_MS = 400
export const JOY_HOLD_MS = 1200
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
/**
 * The word hunt's hint (critters-word-hunt.md § 4.6, Dave (2)): after this
 * many runs of three with no new word, or this long with no drag start.
 */
export const HUNT_HINT_RUNS = 5
export const HUNT_HINT_IDLE_MS = 45000
/**
 * The completion beat (§ 5.1): the lap starts 300 ms after the shelf
 * clears; each word's end + 250 lights the next; the last word's end +
 * 300 "You did it!"; its end the cheer and burst; + 900 New letters.
 */
export const BEAT_LAP_AFTER_MS = 300
export const BEAT_LAP_GAP_MS = 250
export const BEAT_DONE_AFTER_MS = 300
export const BEAT_TAIL_MS = 900
/** New letters: the old board fades out, then the fresh deal fades in. */
export const DEAL_OUT_MS = 200
export const DEAL_IN_MS = 300

const HONEY = '#f2c27a'
const HONEY_LEDGE = '#b27b37'
const LETTER = '#6b3f1f'
const PUPIL = '#3d2112'
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

export interface LetterCrittersProps {
  kit: GameKit
  /**
   * Test seams: the tap-sound player; the picture words the free meadow's
   * letters are drawn from (default all 45, `CRITTER_PICTURE_WORDS`); and
   * the word hunt on or off (default: from blending sounds, as `funny`).
   */
  sounds?: TapClipPlayer
  words?: readonly string[]
  hunt?: boolean
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

/** A run of three in the hunt: a new or found target, a new or found extra. */
type HuntFind = 'new' | 'repeat' | 'extra' | 'extra-repeat'

interface Gate {
  /** A non-word boings (blending sounds is current or mastered). */
  funny: boolean
  /** The word hunt's vowels and probe guard, or null: the free meadow. */
  hunt: { vowels: string[]; probeGuard: boolean } | null
}

/**
 * The playing learner's gate, read once at mount (Dave's safeguard; the
 * hunt's gate is the same, critters-word-hunt.md § 8). Unreadable: quiet,
 * the free meadow. `hunt` forces the hunt on or off (a test seam).
 */
function readGate(hunt?: boolean): Gate {
  let gate: Gate = { funny: false, hunt: null }
  try {
    const progress = loadProgress()
    const funny = critterFunnyOpen(progress)
    gate = {
      funny,
      hunt: funny
        ? {
            vowels: huntVowels(progress),
            probeGuard: huntProbeGuard(progress),
          }
        : null,
    }
  } catch {
    // Quiet, the free meadow.
  }
  if (hunt === false) return { ...gate, hunt: null }
  if (hunt === true && gate.hunt === null) {
    return { ...gate, hunt: { vowels: ['a'], probeGuard: false } }
  }
  return gate
}

export function LetterCritters({
  kit,
  sounds,
  words = CRITTER_PICTURE_WORDS,
  hunt: huntProp,
}: LetterCrittersProps) {
  const { reducedMotion, sfx } = kit
  const [gate] = useState(() => readGate(huntProp))
  const { funny } = gate
  // The hunt's round (§ 6.4): the one in progress, else a fresh deal,
  // never the same letters as her last round. Written at mount.
  const [opening] = useState(() => {
    if (gate.hunt === null) return null
    const stored = loadHuntRecord()
    if (stored !== null && !stored.complete) {
      return { record: stored, dealt: false }
    }
    const round = huntDeal(gate.hunt.vowels, kit.rng, {
      last: stored?.letters,
      probeGuard: gate.hunt.probeGuard,
    })
    return { record: freshHuntRecord(round), dealt: true }
  })
  // The free meadow: every letter where all of them fit both ways (a
  // tablet), else the cap.
  const [free] = useState(() =>
    opening !== null
      ? null
      : critterSet(words, kit.rng, {
          cap: crittersFitBothWays(kit.viewport, new Set(words.join('')).size)
            ? Infinity
            : CRITTER_CAP,
        }),
  )
  const [player] = useState<TapClipPlayer>(
    () => sounds ?? createTapClipPlayer(audioEngine),
  )

  // --- The word hunt's state (critters-word-hunt.md) ----------------------

  const [record, setRecordState] = useState<HuntRecord | null>(
    opening?.record ?? null,
  )
  const recordRef = useRef(record)
  /** A new round or a find: kept, and written (Dave (7)). */
  const setRecord = (next: HuntRecord) => {
    recordRef.current = next
    setRecordState(next)
    saveHuntRecord(next, HUNT_LENGTH)
  }
  /** Found, but not on the board yet: the outcome is still playing. */
  const [pending, setPendingState] = useState<readonly string[]>([])
  const pendingRef = useRef<readonly string[]>([])
  const setPending = (next: readonly string[]) => {
    pendingRef.current = next
    setPendingState(next)
  }
  /** A found word's tiles (and picture) flying to its slot. */
  const [arriving, setArriving] = useState<{
    word: string
    slot: number
    run: number[]
    key: number
  } | null>(null)
  const arriveRef = useRef(0)
  /** Reduce Motion's fill: this word's slot fades in. */
  const [fresh, setFresh] = useState<string | null>(null)
  /** Lit-pulse and wiggle counters, per word. */
  const [lit, setLit] = useState<Record<string, number>>({})
  const [wiggle, setWiggle] = useState<Record<string, number>>({})
  /** The hint's glow on the first empty slot, and its ghost picture. */
  const [glow, setGlow] = useState<{ ghost: string | null } | null>(null)
  const glowRef = useRef(false)
  const glowDueRef = useRef(false)
  /** The lap of the completion beat: the slot lit now. */
  const [lap, setLap] = useState<string | null>(null)
  const [newLetters, setNewLetters] = useState(false)
  const [beatBurst, setBeatBurst] = useState<number | null>(null)
  /** Each New letters: the board and meadow cross-fade. */
  const [dealKey, setDealKey] = useState(0)
  /** The vowel is being dragged out of its burrow (it has no twin). */
  const [vowelDrag, setVowelDrag] = useState(false)
  const vowelShown = useSharedValue(1)
  /** Runs of three since the last new target; the idle timer's token. */
  const runsRef = useRef(0)
  const huntIdleRef = useRef(0)
  /** The beat plays; the completing find's shelf starts it. */
  const beatRef = useRef(false)
  const beatDueRef = useRef(false)
  /** The run of three in play: its word, how it counts, its seats. */
  const runHuntRef = useRef<{
    word: string
    kind: HuntFind
    run: number[]
  } | null>(null)

  const letters = record?.letters ?? free!.letters
  const vowel = record?.letters[0] ?? null
  const scene: CritterScene | HuntScene =
    record !== null
      ? huntScene(kit.area, kit.tablet, kit.landscape, record.targets.length)
      : critterScene(kit.area, kit.tablet, kit.landscape, letters.length)
  const hs = record !== null ? (scene as HuntScene) : null
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
    /** A new hunt word's card shrinks into its slot's picture box. */
    into?: Rect
  } | null>(null)
  /** Bounce counters: per seat, and per meadow letter. */
  const [seatBounce, setSeatBounce] = useState([0, 0, 0])
  const [meadowHop, setMeadowHop] = useState<Record<string, number>>({})
  const [tumble, setTumble] = useState(0)
  /** The joy beat's burst, keyed so each one starts afresh. */
  const [burst, setBurst] = useState<number | null>(null)
  const burstRef = useRef(0)
  /** The picture words praised this visit (not saved; Dave 2026-10-25). */
  const praisedRef = useRef(new Set<string>())
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

  // The hunt's glow, declared here: the background's landing (an effect)
  // reaches it.

  /** § 4.6: the first empty slot glows, silently; none after completion. */
  const showGlow = () => {
    glowDueRef.current = false
    const r = recordRef.current
    if (r === null || r.complete || glowRef.current || beatRef.current) return
    if (huntHintTarget(r, r.found) === undefined) return
    glowRef.current = true
    setGlow({ ghost: null })
  }
  const endGlow = () => {
    glowRef.current = false
    setGlow(null)
  }
  /** `HUNT_HINT_IDLE_MS` from now with no drag start: the glow. */
  const armHuntIdle = () => {
    const token = ++huntIdleRef.current
    if (recordRef.current === null || !ranRef.current) return
    kit.advance(() => {
      if (huntIdleRef.current !== token || draggingRef.current) return
      if (lockedRef.current) glowDueRef.current = true
      else showGlow()
    }, HUNT_HINT_IDLE_MS)
  }

  /** From the run's first sound the board waits until the shelf is clear. */
  const startRun = () => {
    lock(true)
    ranRef.current = true
    idleRef.current += 1
    endHint()
    armHuntIdle()
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
        // The completing find's shelf is clear: C0, the beat (§ 5.1).
        if (beatDueRef.current) {
          beatDueRef.current = false
          startBeat()
          return
        }
        lock(false)
        if (runsRef.current >= HUNT_HINT_RUNS || glowDueRef.current) {
          showGlow()
        }
      },
      reducedMotion ? SHELF_FADE_MS : SHELF_DROP_MS,
    )
  }
  /**
   * § 6.4: a run cut by the background never fills or joins the chip; once
   * she is back its find lands with no motion (the slot fades in, as Reduce
   * Motion's fill), before the shelf clears (Dave (3): never a lost find).
   */
  const landPending = () => {
    const r = recordRef.current
    const landing = pendingRef.current
    if (r === null || landing.length === 0) return
    setPending([])
    const target = landing.find((w) => r.targets.includes(w))
    if (target === undefined) return
    setFresh(target)
    endGlow()
    armHuntIdle()
  }

  // The hint and its open line; unmount: the sound in flight stops, the
  // player is freed.
  useEffect(() => {
    if (opening?.dealt) saveHuntRecord(opening.record, HUNT_LENGTH)
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
  // A new layout (rotation): a fill in flight jumps to its end (§ 6.4).
  const frame = kit.cancelKey.split('|')[0]
  const frameRef = useRef(frame)
  useEffect(() => {
    if (kit.cancelKey.endsWith('hidden')) {
      songRef.current += 1
      player.cut()
      // The beat's steps wait for her return (the shelf is already clear).
      if (lockedRef.current && !beatRef.current) {
        kit.advance(() => {
          kit.setPose('idle')
          landPending()
          dropShelf()
        }, 0)
      }
    }
    if (frameRef.current !== frame) {
      frameRef.current = frame
      arriveRef.current += 1
      setArriving(null)
      setPicture((p) => (p?.into === undefined ? p : null))
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
    if (kind !== null) {
      startRun()
      huntRun(word, run)
    }
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
    recordCritterWord(word)
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
      if (songRef.current === token) pictureEnds(word, run, token)
    })
  }

  /**
   * A picture word's clip has ended (Dave 2026-10-25): the joy beat; on
   * its first build in the visit, the lesson's praise line, Emma still
   * cheering; the picture leaves at the later of `PICTURE_HOLD_MS` and the
   * praise's end + `PRAISE_TAIL_MS`.
   */
  const pictureEnds = (word: string, run: number[], token: number) => {
    let waits = 1
    const ready = () => {
      waits -= 1
      if (waits === 0) pictureLeave(word, token)
    }
    kit.advance(() => {
      if (songRef.current === token) joy(run, word)
    }, JOY_AFTER_MS)
    kit.advance(ready, PICTURE_HOLD_MS)
    const praise = crittersPraiseLine(word)
    if (praise === undefined || praisedRef.current.has(word)) return
    waits += 1
    kit.advance(() => {
      if (songRef.current !== token) return
      praisedRef.current.add(word)
      void kit.speak(praise).then(() => {
        if (songRef.current === token) kit.advance(ready, PRAISE_TAIL_MS)
      })
    }, PRAISE_AFTER_MS)
  }

  /** The picture is up: it holds, floats away, then the shelf clears. */
  const pictureLeaves = (word: string, token: number) =>
    kit.advance(() => pictureLeave(word, token), PICTURE_HOLD_MS)
  /**
   * It floats away (Reduce Motion: fades), Emma `idle`, the shelf clears;
   * a new hunt word's picture goes into its slot instead (§ 4.1).
   */
  const pictureLeave = (word: string, token: number) => {
    if (songRef.current !== token) return
    if (isNew(word)) {
      fill(word, token)
      return
    }
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
  }

  /**
   * A real word's joy beat (Dave 2026-10-25): Emma cheers with the shipped
   * cheer, the three bounce together (Reduce Motion: their letters light),
   * and Word Song's burst leaves the middle seat (none on Reduce Motion).
   */
  const joy = (run: number[], word: string) => {
    kit.setPose('cheering')
    sfx.cheer.play()
    run.forEach(bounceSeat)
    // A word already on the board: its slot wiggles (§ 4.2).
    const found = runHuntRef.current
    if (found?.word === word && found.kind === 'repeat') bump(setWiggle, word)
    if (reducedMotion) return
    const key = ++burstRef.current
    setBurst(key)
    kit.later(() => {
      if (burstRef.current === key) setBurst(null)
    }, SPARKLE_BURST_MS)
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
    const line = outcome === 'word' ? crittersWordLine(word) : undefined
    if (line !== undefined) {
      // A said word (play-place § 3.3, Thomas 2026-10-23, build 20): Emma
      // says it as her own line, her caption with it, as the lesson's Emma
      // says a blend's word (`attentive-pointing`), while the three sit
      // still. As it ends, the joy beat, and a word with a pack picture pops
      // it (Dave 2026-10-25). No praise line, no sparkle sound.
      setLean(true)
      kit.setPose('attentive-pointing')
      recordCritterWord(word)
      void kit.speak(line).then(() => {
        if (songRef.current !== token) return
        joy(run, word)
        if (CRITTER_SAID_PICTURE_WORDS.includes(word)) {
          setPicture({ word, leaving: false })
          pictureLeaves(word, token)
        } else {
          kit.advance(() => {
            if (songRef.current !== token) return
            if (isNew(word)) {
              fill(word, token)
              return
            }
            joinChip(word)
            kit.setPose('idle')
            settle(token)
          }, JOY_HOLD_MS)
        }
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

  // --- The word hunt (critters-word-hunt.md § 4, § 5) ----------------------

  const bump = (
    set: (fn: (m: Record<string, number>) => Record<string, number>) => void,
    word: string,
  ) => set((m) => ({ ...m, [word]: (m[word] ?? 0) + 1 }))

  /** The targets on the board, in slot (find) order. */
  const boardWords = () => {
    const r = recordRef.current
    if (r === null) return []
    return r.found.filter(
      (w) => r.targets.includes(w) && !pendingRef.current.includes(w),
    )
  }
  const isNew = (word: string) =>
    runHuntRef.current?.word === word && runHuntRef.current.kind === 'new'

  /**
   * A run of three in the hunt: how it counts. A new target or extra is
   * kept at once (Dave (3): never a lost find), and reaches the board when
   * its outcome is over. A new target restarts the hint's run count.
   */
  const huntRun = (word: string, run: number[]) => {
    const r = recordRef.current
    runHuntRef.current = null
    if (r === null) return
    const seen = r.found.includes(word)
    const kind: HuntFind | null = r.targets.includes(word)
      ? seen
        ? 'repeat'
        : 'new'
      : r.extras.includes(word)
        ? seen
          ? 'extra-repeat'
          : 'extra'
        : null
    runsRef.current = kind === 'new' ? 0 : runsRef.current + 1
    if (kind === null) return
    runHuntRef.current = { word, kind, run }
    if (kind !== 'new' && kind !== 'extra') return
    const next = huntFind(r, word)
    if (kind === 'new' && next.complete && !r.complete) {
      beatDueRef.current = true
    }
    setPending([...pendingRef.current, word])
    setRecord(next)
  }

  /**
   * § 4.1: the outcome is over; the new target fills the next empty slot.
   * Its picture card shrinks into the slot's picture box and its three
   * tiles fly up from the seats (Reduce Motion: the card fades where it
   * is, the slot fades in); the shelf clears 400 ms after the last tile
   * lands. No sound, no line. The hint's glow goes and its counts restart.
   */
  const fill = (word: string, token: number) => {
    const slot = boardWords().length
    const run = runHuntRef.current?.run ?? [0, 1, 2]
    setPending(pendingRef.current.filter((w) => w !== word))
    endGlow()
    runsRef.current = 0
    armHuntIdle()
    kit.setPose('idle')
    if (reducedMotion) {
      setFresh(word)
      setPicture((p) => (p === null ? p : { ...p, leaving: true }))
      kit.advance(() => {
        if (songRef.current === token) setPicture(null)
      }, 300)
    } else {
      const key = ++arriveRef.current
      setArriving({ word, slot, run, key })
      const into = hs?.slots[slot]?.picture
      setPicture((p) => (p === null || into === undefined ? p : { ...p, into }))
      kit.advance(() => {
        if (arriveRef.current !== key) return
        setArriving(null)
        setPicture(null)
      }, FILL_LAND_MS + FILL_SETTLE_MS)
    }
    settle(token, FILL_LAND_MS)
  }

  /** § 4.5: a new extra joins the bonus chip; a found one lights there. */
  const joinChip = (word: string) => {
    const found = runHuntRef.current
    if (found?.word !== word) return
    if (found.kind === 'extra') {
      setPending(pendingRef.current.filter((w) => w !== word))
    } else if (found.kind === 'extra-repeat') bump(setLit, word)
  }

  /**
   * A found word's own sound (§ 4.3): a picture word's blend clip (the
   * word part, or `whole` for the hint), else Emma's word clip. Sound only:
   * no caption, no pose. `onEnd` once it stops.
   */
  const playWord = (word: string, whole: boolean, onEnd?: () => void) => {
    if (CRITTER_PICTURE_WORDS.includes(word)) {
      const segments = blendSegments(word)
      const clip = audioForWebPath(blendClipPath(word))
      if (segments !== null && typeof clip === 'number') {
        const w = whole ? { from: 0, to: null } : wordWindow(segments)
        player.play(clip, w.from, w.to, onEnd)
        return
      }
    } else {
      const src = critterWordLine(word)?.src ?? null
      const clip = src === null ? undefined : audioForWebPath(src)
      if (typeof clip === 'number') {
        player.play(clip, 0, null, onEnd)
        return
      }
    }
    onEnd?.()
  }

  /** § 4.3: a filled slot plays its word and lights its tiles. */
  const onSlotTap = (word: string) => {
    if (lockedRef.current) return
    kit.cutLine()
    bump(setLit, word)
    playWord(word, false)
  }

  /**
   * § 4.6: the glowing slot plays the word to find, whole and sound only,
   * Emma pointing; from the first tap its picture ghosts at 35 %.
   */
  const onHintTap = () => {
    if (lockedRef.current) return
    const r = recordRef.current
    const word = r === null ? undefined : huntHintTarget(r, r.found)
    if (word === undefined) return
    kit.cutLine()
    if (critterHasPicture(word)) setGlow({ ghost: word })
    kit.setPose('attentive-pointing')
    playWord(word, true, () => kit.setPose('idle'))
  }

  /**
   * § 5.1, the completion beat, at C0 (the completing find's shelf is
   * clear): the board stays locked, Emma celebrates, each found slot plays
   * its word in turn, then "You did it!", the cheer and the burst; New
   * letters comes 900 ms later. The same every time.
   */
  const startBeat = () => {
    beatRef.current = true
    endGlow()
    kit.setPose('celebration')
    const order = boardWords()
    const step = (i: number) => {
      if (!beatRef.current) return
      const w = order[i]
      if (w === undefined) {
        kit.advance(sayDone, BEAT_DONE_AFTER_MS)
        return
      }
      setLap(w)
      bump(setLit, w)
      playWord(w, false, () => {
        kit.advance(() => {
          setLap((l) => (l === w ? null : l))
          if (i + 1 < order.length) step(i + 1)
        }, BEAT_LAP_GAP_MS)
        if (i + 1 === order.length) kit.advance(sayDone, BEAT_DONE_AFTER_MS)
      })
    }
    kit.advance(() => step(0), BEAT_LAP_AFTER_MS)
  }
  const sayDone = () => {
    if (!beatRef.current) return
    kit.setPose('cheering')
    void kit.speak('guide.play.critters.done').then(() => {
      if (!beatRef.current) return
      sfx.cheer.play()
      if (!reducedMotion) {
        const key = ++burstRef.current
        setBeatBurst(key)
        kit.later(() => {
          if (burstRef.current === key) setBeatBurst(null)
        }, SPARKLE_BURST_MS)
      }
      kit.advance(() => {
        if (!beatRef.current) return
        beatRef.current = false
        kit.setPose('idle')
        lock(false)
        setNewLetters(true)
      }, BEAT_TAIL_MS)
    })
  }

  /**
   * § 5.3: New letters plinks, and a fresh round (never the same letters)
   * replaces the board: no line, no beat, no drag hint.
   */
  const onNewLetters = () => {
    const r = recordRef.current
    if (r === null || gate.hunt === null || lockedRef.current) return
    sfx.plink.play()
    kit.cutLine()
    setNewLetters(false)
    const round = huntDeal(gate.hunt.vowels, kit.rng, {
      last: r.letters,
      probeGuard: gate.hunt.probeGuard,
    })
    setPending([])
    setLit({})
    setWiggle({})
    setFresh(null)
    endGlow()
    runsRef.current = 0
    glowDueRef.current = false
    runHuntRef.current = null
    setRecord(freshHuntRecord(round))
    setDealKey((k) => k + 1)
    armHuntIdle()
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
    // The vowel has no twin: its burrow is empty from the drop's frame.
    if (letter === vowel) vowelShown.set(0)
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
    armHuntIdle()
    if (letter !== undefined && letter === vowel) setVowelDrag(true)
    else if (letter !== undefined) setTwin(letter)
  }
  const dragEnd = () => {
    draggingRef.current = false
    setTwin(null)
    setVowelDrag(false)
    armIdle()
    if (singDueRef.current && !lockedRef.current) scheduleSing()
  }

  // --- Drawing -----------------------------------------------------------

  const { c } = scene
  const run = seatedRun(seats)
  // The vowel out of its burrow: dragged, seated or falling home (§ 2.5).
  const vowelOut =
    vowel !== null &&
    (vowelDrag ||
      seats.includes(vowel) ||
      (falling?.some((f) => f.letter === vowel) ?? false))
  const vowelHidden = vowelOut && !vowelDrag
  useEffect(() => {
    vowelShown.set(vowelHidden ? 0 : 1)
  }, [vowelHidden, vowelShown])
  const vowelStyle = useAnimatedStyle(() => ({ opacity: vowelShown.get() }))
  const onBoard =
    record === null
      ? []
      : record.found.filter(
          (w) => record.targets.includes(w) && !pending.includes(w),
        )
  const bonus =
    record === null
      ? []
      : record.found.filter(
          (w) => record.extras.includes(w) && !pending.includes(w),
        )
  const glowAt = glow !== null ? onBoard.length : -1
  const deal = {
    entering:
      dealKey > 0 ? FadeIn.duration(DEAL_IN_MS).delay(DEAL_OUT_MS) : undefined,
    exiting: FadeOut.duration(DEAL_OUT_MS),
  }
  const k = kit.tablet ? 1.5 : 1
  return (
    <View testID="letter-critters" pointerEvents="box-none" style={styles.fill}>
      <Pressable
        testID="critter-log"
        accessibilityRole="button"
        accessibilityLabel={hs !== null ? PLAY_LABELS.huntLog : PLAY_LABELS.log}
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

      {hs !== null && (
        <Animated.View
          key={`board-${dealKey}`}
          {...deal}
          pointerEvents="box-none"
          style={styles.fill}
        >
          <NumeralDisc rect={hs.numeral} length={HUNT_LENGTH} />
          {hs.slots.map((parts, i) => {
            const word = arriving?.slot === i ? null : (onBoard[i] ?? null)
            const glowing = i === glowAt
            return (
              <Slot
                key={i}
                index={i}
                parts={parts}
                step={hs.step}
                tablet={kit.tablet}
                word={word}
                fadeIn={word !== null && word === fresh}
                glow={glowing}
                ghost={glowing ? glow!.ghost : null}
                lapRing={word !== null && lap === word}
                lit={word === null ? 0 : (lit[word] ?? 0)}
                wiggle={word === null ? 0 : (wiggle[word] ?? 0)}
                reducedMotion={reducedMotion}
                label={
                  word !== null
                    ? slotLabel(word)
                    : glowing
                      ? PLAY_LABELS.hint
                      : PLAY_LABELS.emptySlot
                }
                onPress={
                  word !== null
                    ? () => onSlotTap(word)
                    : glowing
                      ? onHintTap
                      : undefined
                }
              />
            )
          })}
          {bonus.length > 0 && (
            <BonusChip
              rect={chipRect(hs, bonus.length)}
              tiles={bonus.map((_, i) => chipTiles(hs, bonus.length, i))}
              words={bonus}
              lit={lit}
              reducedMotion={reducedMotion}
              label={bonusLabel(bonus)}
            />
          )}
        </Animated.View>
      )}

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

      <Animated.View
        key={`meadow-${dealKey}`}
        {...deal}
        pointerEvents="box-none"
        style={styles.fill}
      >
        {letters.map((letter, i) => {
          const r = scene.cells[i]!
          const isVowel = letter === vowel
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
              {isVowel && (
                <VowelRing cell={r} vowel={letter} shown={vowelOut} />
              )}
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
                disabled={locked || (isVowel && vowelHidden)}
                hidden={isVowel && vowelHidden}
                reducedMotion={reducedMotion}
                cancelKey={kit.cancelKey}
                onTap={() => onMeadowTap(letter)}
                onActivate={() => onMeadowActivate(letter)}
                onDragStart={() => dragStart(letter)}
                onDragEnd={dragEnd}
                onDrop={(p) => onMeadowDrop(letter, p)}
              >
                <Animated.View
                  style={[styles.fillBox, isVowel ? vowelStyle : null]}
                >
                  <Critter
                    letter={letter}
                    size={c}
                    bounce={meadowHop[letter] ?? 0}
                    reducedMotion={reducedMotion}
                  />
                </Animated.View>
              </DragPiece>
            </View>
          )
        })}
      </Animated.View>

      {burst !== null && (
        <View
          key={burst}
          testID="critter-burst"
          pointerEvents="none"
          style={[styles.abs, rectStyle(scene.seats[1]!)]}
        >
          <SparkleBurst
            testID="critter-sparkle-burst"
            distance={chipInner(scene.seats[1]!.width).burstDistance}
            glyph={chipInner(scene.seats[1]!.width).sparkle}
          />
        </View>
      )}

      {falling?.map(({ letter, seat }) => (
        <Falling
          key={`fall-${seat}`}
          seat={seat}
          letter={letter}
          from={scene.seats[seat]!}
          to={scene.cells[letters.indexOf(letter)]!}
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
          into={picture.into}
          reducedMotion={reducedMotion}
        />
      )}

      {arriving !== null &&
        hs !== null &&
        [...arriving.word].map((l, i) => {
          const to = hs.slots[arriving.slot]?.boxes[i]
          const from = scene.seats[arriving.run[i] ?? i]
          if (to === undefined || from === undefined) return null
          return (
            <FlyingTile
              key={`${arriving.key}-${i}`}
              letter={l}
              from={from}
              to={to}
              delay={i * TILE_STAGGER_MS}
              testID={`hunt-fly-${i}`}
            />
          )
        })}

      {beatBurst !== null && hs !== null && (
        <View
          key={beatBurst}
          testID="hunt-burst"
          pointerEvents="none"
          style={[styles.abs, styles.over, rectStyle(hs.board)]}
        >
          <SparkleBurst
            testID="hunt-sparkle-burst"
            distance={75 * k}
            glyph={16 * k}
          />
        </View>
      )}

      {newLetters && (
        <NewLetters
          rect={{
            ...kit.back,
            x: kit.back.x + kit.back.width + (kit.tablet ? 24 : 16),
          }}
          reducedMotion={reducedMotion}
          label={PLAY_LABELS.newLetters}
          onPress={onNewLetters}
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
 * The picture's card (§ 3.2, § 3.3), a picture word's or, after Emma says
 * it, a said word's with a pack picture: the pack picture on Word Song's
 * white card, springing up over the meadow (scale 0 → 1 on a 260 / 16
 * spring with a 150 ms fade); leaving, it floats up 0.3 p and fades over
 * 500 ms. Reduce Motion: fades in over 200 ms and out over 300 ms.
 */
function PictureCard({
  word,
  rect,
  leaving,
  into,
  reducedMotion,
}: {
  word: string
  rect: Rect
  leaving: boolean
  into?: Rect
  reducedMotion: boolean
}) {
  const s = useSharedValue(reducedMotion ? 1 : 0)
  const o = useSharedValue(0)
  const y = useSharedValue(0)
  const x = useSharedValue(0)
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
  // The word hunt's fill (§ 4.1): it shrinks into the slot's picture box
  // over 500 ms (ease in-out), replacing the float-away.
  useEffect(() => {
    if (into === undefined || reducedMotion) return
    const move = {
      duration: PICTURE_LEAVE_MS,
      easing: Easing.inOut(Easing.quad),
    }
    x.set(withTiming(centre(into).x - centre(rect).x, move))
    y.set(withTiming(centre(into).y - centre(rect).y, move))
    s.set(withTiming(into.width / rect.width, move))
    // A new target only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [into === undefined])
  const style = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { scale: s.get() },
    ],
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
        source={pictureAsset(critterPictureKey(word))}
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
