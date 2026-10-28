/**
 * The Play-place games' frame (play-place spec § 1.7): the lesson's Math
 * frame as it is (`mathLayout`): the clay back disc, an empty HUD row (no
 * beads, no stardust pill, no streak), App's Emma at `layout.emma` (her
 * poses come up through `onPoseChange`), the caption ribbon walking each
 * line, and the game filling `A`, the problem and chip regions together.
 * It stands in the Play place's garden, not the lesson's cream sheet
 * (play-games-restyle § 2 T1): the Hub's backdrop without Emma's light.
 *
 * It runs what both games share: one line player (`playLines.ts`), the
 * effects, and beats that Back clears and that wait while the app is
 * hidden. Back (the disc, or Android back) returns to the Play place at
 * once, silent: mid-line, mid-drag or mid-crossing; a game may take the
 * step first (Letter critters' rounds go back to their length picker,
 * critters-four-letter.md § 5.1). A background or a new
 * layout springs a drag in flight home. Separate from Math, Word Song and
 * the flower bed's `GameScreen`, and it writes nothing: no progress,
 * stardust, streak, history, Leitner, cloud call or network call (§ 1.6).
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import type { PlayGameId } from '@marian/core/games/playPlace'
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
import { hubLayout } from '../../layout/hubLayout'
import type { Viewport } from '../../layout/layout'
import type { MathLayout } from '../../layout/mathLayout'
import {
  appVisibility,
  type AppVisibility,
} from '../../lifecycle/appVisibility'
import { FILL } from '../../theme'
import { HubBackdrop } from '../hub/HubBackdrop'
import { BackButton } from '../math/MathHud'
import { CrittersGame } from './CrittersGame'
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
import { RaftGame } from './RaftGame'

/** The game's fade in and out (§ 1.4). */
export const PLAY_GAME_FADE_MS = 200
/** A line's caption fades out as the line ends (Thomas 2026-10-23). */
export const CAPTION_OUT_MS = 200

export interface PlayGameScreenProps {
  /** The Math frame, and the screen it is laid out from. */
  layout: MathLayout
  viewport: Viewport
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
  /** Critters: the tap-sound player, and the visit's picture words. */
  sounds?: TapClipPlayer
  words?: readonly string[]
  /** Critters: the word hunt on or off (default: from her steps). */
  hunt?: boolean
}

export function PlayGameScreen({
  layout,
  viewport,
  game,
  onExit,
  onPoseChange,
  linePlayer,
  sfx: sfxProp,
  visibility = appVisibility,
  rng: rngProp,
  shore,
  sounds,
  words,
  hunt,
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
  /** A game's own Back step (the critters' picker), else the exit. */
  const backRef = useRef<(() => boolean) | null>(null)
  const back = () => {
    if (exitedRef.current) return
    if (backRef.current?.() === true) return
    exit()
  }
  const backPressRef = useRef(back)
  useLayoutEffect(() => {
    backPressRef.current = back
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
    // A line's caption goes when the line ends or is cut, and changes when
    // the next starts (Thomas 2026-10-23, Marian's play test: "Is this a
    // word? ..." stayed up after Emma had finished).
    const clearCaption = () =>
      setCaption((c) => (c.text === '' ? c : { ...c, text: '', revealed: 0 }))
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
        .then(() => {
          const own = !exitedRef.current && tokenRef.current === token
          if (own) clearCaption()
          return own
        })
    }
    const cutLine = () => {
      tokenRef.current += 1
      player.cancelActive()
      clearCaption()
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
      setBack: (handler: (() => boolean) | null) => {
        backRef.current = handler
      },
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
      backPressRef.current()
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
  const backDisc = backRect(layout)
  const kit: GameKit = {
    ...kitBase,
    area: A,
    tablet: layout.tablet,
    landscape: layout.landscape,
    viewport,
    back: backDisc,
    ribbon: layout.ribbon,
    reducedMotion,
    sfx,
    rng,
    cancelKey: `${frameKey}|${hidden ? 'hidden' : 'shown'}`,
  }

  const { ribbon } = layout
  return (
    <>
      <HubBackdrop
        layout={hubLayout(viewport)}
        light={false}
        testID="play-game-background"
        fadeMs={PLAY_GAME_FADE_MS}
      />
      <Animated.View
        testID="play-game"
        entering={FadeIn.duration(PLAY_GAME_FADE_MS)}
        exiting={FadeOut.duration(PLAY_GAME_FADE_MS)}
        style={styles.foreground}
      >
        {game === 'raft' ? (
          <RaftGame kit={kit} shore={shore} />
        ) : (
          <CrittersGame
            key="critters"
            kit={kit}
            sounds={sounds}
            words={words}
            hunt={hunt}
          />
        )}

        {caption.text !== '' && (
          <CaptionRibbon
            testID="play-game-ribbon"
            text={caption.text}
            revealedCount={caption.revealed}
            lineKey={`${caption.key}`}
            exiting={FadeOut.duration(CAPTION_OUT_MS)}
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
              left: backDisc.x,
              top: backDisc.y,
              width: backDisc.width,
              height: backDisc.height,
            },
          ]}
        >
          <BackButton
            size={backDisc.width}
            onPress={back}
            testID="play-game-back"
          />
        </View>
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
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
