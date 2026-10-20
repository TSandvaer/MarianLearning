/**
 * The Play-place games' frame (play-place spec § 1.7): the lesson's Math
 * frame as it is (`mathLayout`): the clay back disc, an empty HUD row (no
 * beads, no stardust pill, no streak), App's Emma at `layout.emma` (her
 * poses come up through `onPoseChange`), the caption ribbon walking each
 * line, and the game filling `A`, the problem and chip regions together.
 *
 * It runs what both games share: one line player (`playLines.ts`), the
 * effects, and beats that Back clears and that wait while the app is
 * hidden. Back (the disc, or Android back) returns to the Play place at
 * once, silent: mid-line, mid-drag or mid-crossing. A background or a new
 * layout springs a drag in flight home. Separate from Math, Word Song and
 * the flower bed's `GameScreen`, and it writes nothing: no progress,
 * stardust, streak, history, Leitner, cloud call or network call (§ 1.6).
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import type { PlayGameId } from '@marian/core/games/playPlace'
import type { Progress } from '@marian/core/progress'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { BackHandler, StyleSheet, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated'
import type { TapClipPlayer } from '../../audio/tapClip'
import { CaptionRibbon } from '../../components/CaptionRibbon'
import type { MathLayout } from '../../layout/mathLayout'
import {
  appVisibility,
  type AppVisibility,
} from '../../lifecycle/appVisibility'
import { colors, FILL } from '../../theme'
import { BackButton } from '../math/MathHud'
import { LetterCritters } from './LetterCritters'
import { backRect, playArea } from './playGeometry'
import {
  createPlaySfx,
  unloadPlaySfx,
  type GameKit,
  type PlaySfx,
} from './playKit'
import {
  createPlayLinePlayer,
  PLAY_LINE_MANIFEST,
  type PlayLineId,
  type PlayLinePlayer,
} from './playLines'
import { RaftCrossing } from './RaftCrossing'

/** The game's fade in and out (§ 1.4). */
export const PLAY_GAME_FADE_MS = 200

export interface PlayGameScreenProps {
  layout: MathLayout
  game: PlayGameId
  /** Back, or the natural stop: App returns to the Play place, silent. */
  onExit: () => void
  onPoseChange?: (pose: EmmaPose) => void
  /** Test seams. */
  linePlayer?: PlayLinePlayer
  sfx?: PlaySfx
  visibility?: AppVisibility
  rng?: () => number
  /** Raft: the first shore's weights (default `raftShore(rng)`). */
  shore?: readonly number[]
  /** Critters: the tap-sound player, and the learner's progress. */
  sounds?: TapClipPlayer
  progress?: Progress | null
}

export function PlayGameScreen({
  layout,
  game,
  onExit,
  onPoseChange,
  linePlayer,
  sfx: sfxProp,
  visibility = appVisibility,
  rng: rngProp,
  shore,
  sounds,
  progress,
}: PlayGameScreenProps) {
  const reducedMotion = useReducedMotion()
  const [player] = useState<PlayLinePlayer>(
    () => linePlayer ?? createPlayLinePlayer(),
  )
  const [sfx] = useState<PlaySfx>(() => sfxProp ?? createPlaySfx())
  const [rng] = useState(() => rngProp ?? Math.random)
  const [pose, setPose] = useState<EmmaPose>('idle')
  const [caption, setCaption] = useState({ text: '', revealed: 0, key: 0 })
  const hidden = useSyncExternalStore(
    visibility.subscribe,
    visibility.getIsHidden,
  )

  const tokenRef = useRef(0)
  const exitedRef = useRef(false)
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())
  /** Beats that fell due while the app was hidden, in order. */
  const pendingRef = useRef<(() => void)[]>([])
  const onExitRef = useRef(onExit)
  const onPoseChangeRef = useRef(onPoseChange)
  useLayoutEffect(() => {
    onExitRef.current = onExit
    onPoseChangeRef.current = onPoseChange
  })

  useEffect(() => {
    onPoseChangeRef.current?.(pose)
  }, [pose])

  const exit = () => {
    if (exitedRef.current) return
    exitedRef.current = true
    timersRef.current.forEach(clearTimeout)
    timersRef.current.clear()
    pendingRef.current = []
    tokenRef.current += 1
    player.cancelActive()
    onExitRef.current()
  }
  const exitRef = useRef(exit)
  useLayoutEffect(() => {
    exitRef.current = exit
  })

  // The kit is fixed for the mount; its functions read refs.
  const kitBase = useMemo(() => {
    const later = (fn: () => void, ms: number) => {
      const timer = setTimeout(() => {
        timersRef.current.delete(timer)
        if (!exitedRef.current) fn()
      }, ms)
      timersRef.current.add(timer)
    }
    const advance = (fn: () => void, ms: number) =>
      later(() => {
        if (visibility.getIsHidden()) pendingRef.current.push(fn)
        else fn()
      }, ms)
    const speak = (id: PlayLineId): Promise<boolean> => {
      if (exitedRef.current) return Promise.resolve(false)
      player.cancelActive()
      const token = ++tokenRef.current
      setCaption({ text: PLAY_LINE_MANIFEST[id].text, revealed: 0, key: token })
      return player
        .playLine(id, {
          onWordTick: (i) => {
            if (tokenRef.current !== token) return
            setCaption((c) =>
              c.key === token
                ? { ...c, revealed: Math.max(c.revealed, i + 1) }
                : c,
            )
          },
        })
        .then(() => !exitedRef.current && tokenRef.current === token)
    }
    const cutLine = () => {
      tokenRef.current += 1
      player.cancelActive()
    }
    return {
      speak,
      cutLine,
      later,
      advance,
      setPose: (p: EmmaPose) => {
        if (!exitedRef.current) setPose(p)
      },
      done: () => exitRef.current(),
    }
  }, [player, visibility])

  // Unmount: silence, timers cleared, players freed.
  useEffect(() => {
    exitedRef.current = false
    const timers = timersRef.current
    return () => {
      exitedRef.current = true
      timers.forEach(clearTimeout)
      timers.clear()
      player.cancelActive()
      player.unload()
      unloadPlaySfx(sfx)
    }
  }, [player, sfx])

  // Android back = Back.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exitRef.current()
      return true
    })
    return () => sub.remove()
  }, [])

  // Back from the background: the beats that fell due run.
  useEffect(
    () =>
      visibility.subscribe(() => {
        if (visibility.getIsHidden()) return
        const due = pendingRef.current
        pendingRef.current = []
        for (const fn of due) if (!exitedRef.current) fn()
      }),
    [visibility],
  )

  const A = playArea(layout)
  const frameKey = `${A.x},${A.y},${A.width},${A.height}`
  const kit: GameKit = {
    ...kitBase,
    area: A,
    tablet: layout.tablet,
    landscape: layout.landscape,
    reducedMotion,
    sfx,
    rng,
    cancelKey: `${frameKey}|${hidden ? 'hidden' : 'shown'}`,
  }

  const back = backRect(layout)
  const { ribbon } = layout
  return (
    <>
      <Animated.View
        testID="play-game-background"
        entering={FadeIn.duration(PLAY_GAME_FADE_MS)}
        exiting={FadeOut.duration(PLAY_GAME_FADE_MS)}
        style={styles.background}
      />
      <Animated.View
        testID="play-game"
        entering={FadeIn.duration(PLAY_GAME_FADE_MS)}
        exiting={FadeOut.duration(PLAY_GAME_FADE_MS)}
        style={styles.foreground}
      >
        {game === 'raft' ? (
          <RaftCrossing kit={kit} shore={shore} />
        ) : (
          <LetterCritters
            key="critters"
            kit={kit}
            sounds={sounds}
            progress={progress}
          />
        )}

        {caption.text !== '' && (
          <CaptionRibbon
            testID="play-game-ribbon"
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

        <View
          style={[
            styles.abs,
            {
              left: back.x,
              top: back.y,
              width: back.width,
              height: back.height,
            },
          ]}
        >
          <BackButton
            size={back.width}
            onPress={exit}
            testID="play-game-back"
          />
        </View>
      </Animated.View>
    </>
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
  abs: { position: 'absolute', zIndex: 3 },
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
