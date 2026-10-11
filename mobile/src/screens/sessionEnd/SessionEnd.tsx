/**
 * Screen 5, Session End, with the guidance layer: native port of
 * `src/screens/SessionEnd/SessionEnd.tsx` (web, the source of truth:
 * Guidance G2 #513, caption fix #521; team/DECISIONS.md 2026-10-06
 * "Guidance layer approved; stars are feedback only"), laid out by
 * `../../layout/sessionEndLayout.ts`.
 *
 * Emma carries the child through core's beat order (`sessionEndGuidance`):
 * effort praise; on a good day today's flower pops in and flies into its
 * slot ("You got a flower!"), then "N of 3"; then what comes next and when
 * ("It sleeps tonight. Come back tomorrow for one more." / "A new path
 * opens. Look!" / "You grew your whole garden!"). A not-yet day gets warm
 * praise, an untouched tray, "Play again to get today's flower." once a
 * day per world, and Again + Home. A same-day replay is praised practice
 * with no new flower. Never a negative beat, never a red X; no stardust
 * total (stars are one per right answer, never counted).
 *
 * Kept from the web, behaviour for behaviour: the one write on mount
 * (`../../session/sessionEndWrite.ts`), so the celebration never replays;
 * each line waits for its clip to end, floored at the clip's real length
 * and given up 1.5 s after it; 300 ms between lines; the buttons come up
 * with Emma's last line (20 s fallback); the flower flies at 650 ms and
 * lands at 1450 ms with the sparkle; a button plays the chime and leaves
 * 300 ms later, once.
 *
 * Dropped (web-only): the legacy Sleep splash (the web shows it only when
 * no `onAllDone` is wired, i.e. in unit tests; App always wires it), the
 * deprecated `playUtteranceFn` prop and the `data-*` QA attributes.
 *
 * Emma is App's hoisted `EmmaStage`; this screen reports her pose
 * (`cheering` on a flower day, else `idle`) through `onPoseChange`.
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import type {
  EndBeat,
  EndLine,
} from '@marian/core/sessionEnd/sessionEndGuidance'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated'
import {
  createPathLinePlayer,
  createSfx,
  SFX_SOURCES,
  type PathLinePlayer,
  type Sfx,
} from '../../audio'
import {
  flowerFlight,
  type SessionEndLayout,
} from '../../layout/sessionEndLayout'
import type { SessionEndPayload } from '../../session/sessionEndPayload'
import {
  normalizeSessionEndPayload,
  writeSessionEnd,
  type SessionEndResult,
} from '../../session/sessionEndWrite'
import { FILL } from '../../theme'
import { SessionEndView, type FlowerStage } from './SessionEndView'

/** Pause between Emma's lines. */
export const BEAT_GAP_MS = 300
/** A clip that never ends is given up on this long after its length. */
export const LINE_SLACK_MS = 1500
/** The flower pops in, holds, then flies (lands ≈ the end of "You got a flower!"). */
export const FLOWER_FLY_AT_MS = 650
export const FLOWER_LAND_AT_MS = 1450
/** Reduce Motion: no flight, the flower is in its slot this soon. */
export const FLOWER_REDUCED_LAND_MS = 300
/** The buttons appear at the latest this long after mount. */
export const FALLBACK_CTA_MS = 20_000
/** A button tap leaves this long after the chime. */
export const LEAVE_DELAY_MS = 300
/** The chime (0.57 s) outlives the screen by this much. */
export const CHIME_TAIL_MS = 600
/** Web: fade in 0.4 s, out 0.25 s. */
export const SESSION_END_ENTER_MS = 400
export const SESSION_END_EXIT_MS = 250

/** The two effects, with the web's volumes. Test seam. */
export interface SessionEndSfx {
  chime: Sfx
  sparkle: Sfx
}

function createSessionEndSfx(): SessionEndSfx {
  return {
    chime: createSfx({ src: SFX_SOURCES.chime, volume: 0.85 }),
    sparkle: createSfx({ src: SFX_SOURCES.sparkle, volume: 0.7 }),
  }
}

type Phase = 'pending' | EndBeat | 'settled'

export interface SessionEndProps {
  layout: SessionEndLayout
  /** What the finished session handed over; null = a zero math session. */
  payload: SessionEndPayload | null
  /** "All done" (and "Home" on a not-yet day). App picks the map or the Hub. */
  onAllDone: () => void
  /** Not-yet day "Again": another session in the same world. */
  onAgain?: () => void
  /** Emma's pose, for App's `EmmaStage`. */
  onPoseChange?: (pose: EmmaPose) => void
  /** Test seams. */
  sfx?: SessionEndSfx
  createPlayer?: () => PathLinePlayer
  clock?: () => Date
}

export function SessionEnd({
  layout,
  payload,
  onAllDone,
  onAgain,
  onPoseChange,
  sfx: sfxProp,
  createPlayer = createPathLinePlayer,
  clock,
}: SessionEndProps) {
  const reducedMotion = useReducedMotion()
  const [p] = useState(() => normalizeSessionEndPayload(payload))
  const [sfx] = useState<SessionEndSfx>(() => sfxProp ?? createSessionEndSfx())
  const [player] = useState<PathLinePlayer>(() => createPlayer())

  const [result, setResult] = useState<SessionEndResult | null>(null)
  const resultRef = useRef<SessionEndResult | null>(null)
  const [phase, setPhase] = useState<Phase>('pending')
  const [caption, setCaption] = useState('')
  const [showCta, setShowCta] = useState(false)
  const [flower, setFlower] = useState<FlowerStage | 'hidden' | 'landed'>(
    'hidden',
  )
  const leavingRef = useRef(false)
  // The beats run once, so `phase` only feeds the view's test id.

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const addTimer = useCallback((cb: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id)
      cb()
    }, ms)
    timersRef.current.push(id)
    return id
  }, [])

  // ── The one write, before the first paint (so the tray never flashes
  //    empty) and once per mount (a ref, so a re-run cannot write twice).
  useLayoutEffect(() => {
    if (resultRef.current !== null) return
    resultRef.current = writeSessionEnd(p, clock ? { clock } : {})
    setResult(resultRef.current)
  }, [p, clock])

  const flowerDay = result?.guidance.newSlot != null
  const onPoseChangeRef = useRef(onPoseChange)
  useLayoutEffect(() => {
    onPoseChangeRef.current = onPoseChange
  })
  useEffect(() => {
    if (result === null) return
    onPoseChangeRef.current?.(flowerDay ? 'cheering' : 'idle')
  }, [result, flowerDay])

  // ── One line: the clip's end, never before its length, at most its
  //    length + slack (web `speak`).
  const speak = useCallback(
    (line: EndLine): Promise<void> =>
      new Promise<void>((resolve) => {
        let audioDone = false
        let floorDone = false
        let finished = false
        const finish = () => {
          if (finished) return
          finished = true
          resolve()
        }
        addTimer(() => {
          floorDone = true
          if (audioDone) finish()
        }, line.seconds * 1000)
        addTimer(finish, line.seconds * 1000 + LINE_SLACK_MS)
        void player.play(line).then(() => {
          audioDone = true
          if (floorDone) finish()
        })
      }),
    [addTimer, player],
  )

  // ── The beats, once, on mount.
  useEffect(() => {
    let cancelled = false
    const fallback = addTimer(() => setShowCta(true), FALLBACK_CTA_MS)
    const run = async () => {
      const g = resultRef.current?.guidance ?? null
      if (g === null) {
        setShowCta(true)
        return
      }
      for (let i = 0; i < g.lines.length; i++) {
        if (cancelled) return
        const line = g.lines[i]!
        if (i > 0) {
          await new Promise<void>((r) => addTimer(r, BEAT_GAP_MS))
          if (cancelled) return
        }
        setPhase(line.beat)
        setCaption(line.text)
        // The buttons come with her last line: heard, never holding her.
        if (i === g.lines.length - 1) setShowCta(true)
        if (line.beat === 'flower' && g.newSlot !== null) {
          setFlower('pop')
          if (reducedMotion) {
            addTimer(() => setFlower('landed'), FLOWER_REDUCED_LAND_MS)
          } else {
            addTimer(() => setFlower('fly'), FLOWER_FLY_AT_MS)
            addTimer(() => {
              setFlower('landed')
              sfx.sparkle.play()
            }, FLOWER_LAND_AT_MS)
          }
        }
        await speak(line)
      }
      if (cancelled) return
      clearTimeout(fallback)
      setPhase('settled')
      setShowCta(true)
    }
    void run()
    return () => {
      cancelled = true
      for (const id of timersRef.current) clearTimeout(id)
      timersRef.current = []
      player.cancel()
    }
    // Mount-once, as the web: the sequence never restarts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Release on unmount; the chime may still be ringing out.
  useEffect(
    () => () => {
      sfx.sparkle.unload()
      player.unload()
      const { chime } = sfx
      setTimeout(() => chime.unload(), CHIME_TAIL_MS)
    },
    [sfx, player],
  )

  const leave = useCallback(
    (to: (() => void) | undefined) => {
      if (leavingRef.current || to === undefined) return
      leavingRef.current = true
      sfx.chime.play()
      player.cancel()
      addTimer(to, LEAVE_DELAY_MS)
    },
    [sfx, player, addTimer],
  )

  const g = result?.guidance ?? null
  // Layers, as Math: the garden below Emma (App's stage, zIndex 1), the
  // panel, buttons and caption above her.
  return (
    <>
      <Animated.View
        testID="session-end-garden"
        entering={FadeIn.duration(SESSION_END_ENTER_MS)}
        exiting={FadeOut.duration(SESSION_END_EXIT_MS)}
        style={styles.garden}
      />
      <Animated.View
        testID="session-end"
        entering={FadeIn.duration(SESSION_END_ENTER_MS)}
        exiting={FadeOut.duration(SESSION_END_EXIT_MS)}
        style={styles.foreground}
      >
        <SessionEndView
          layout={layout}
          guidance={g}
          phase={phase}
          totalCorrect={p.totalCorrect}
          caption={caption}
          showCta={showCta}
          flower={flower === 'pop' || flower === 'fly' ? flower : null}
          landed={flower === 'landed'}
          flight={
            g !== null && g.newSlot !== null
              ? flowerFlight(layout.inner, g.newSlot, g.slotsAfter.length)
              : null
          }
          reducedMotion={reducedMotion}
          onAllDone={() => leave(onAllDone)}
          onAgain={onAgain ? () => leave(onAgain) : undefined}
        />
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  // Web `.se-garden`: sky into meadow into path, two hedges, two blossoms.
  garden: {
    ...FILL,
    zIndex: 0,
    pointerEvents: 'none',
    backgroundColor: '#cdebb4',
    experimental_backgroundImage: [
      'radial-gradient(60px 60px at 8% 95%, #ffb3c9 0%, #ffb3c900 70%)',
      'radial-gradient(80px 80px at 93% 93%, #ffc7d6 0%, #ffc7d600 70%)',
      'radial-gradient(520px 260px at 15% 36%, #a6d98d 0%, #a6d98d00 70%)',
      'radial-gradient(520px 260px at 88% 36%, #9fd488 0%, #9fd48800 70%)',
      'linear-gradient(#bfe6ff 0%, #dff2ff 30%, #cdebb4 38%, #b9e19e 60%, #e9dcc4 88%, #e0cfb2 100%)',
    ].join(', '),
  },
  foreground: { ...FILL, zIndex: 2, pointerEvents: 'box-none' },
})
