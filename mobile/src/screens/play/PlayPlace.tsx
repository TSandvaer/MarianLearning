/**
 * The Play place (play-place spec `design/native/play-place.md` §§ 1.3-1.5):
 * the shared place for the games outside the path, reached from the Hub's
 * Play disc. The Hub's garden backdrop and frames as they are, so App's
 * Emma (idle, at the Hub's frame) does not move when it opens; the Map's
 * wood Home disc; one square clay tile per open game in the card columns.
 *
 * Which games are open is read once at mount (`openPlayGames`), through
 * whatever store is installed: the playing learner's. Entered from the
 * Hub, Emma says "What shall we play?" after the fade-in; back from a game
 * (`quiet`) she says nothing. She never names or suggests a game.
 *
 * A tile tap plinks, cuts her line, and about 200 ms after the release
 * App opens that game. Home (or Android back) cuts the line and returns to
 * the Hub. The place writes nothing.
 */
import { openPlayGames, type PlayGameId } from '@marian/core/games/playPlace'
import { loadProgress, type Progress } from '@marian/core/progress'
import { useEffect, useRef, useState } from 'react'
import { BackHandler, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { PathImage } from '../../components/PathImage'
import type { Rect } from '../../layout/layout'
import { playTiles, type PlayPlaceLayout } from '../../layout/playPlaceLayout'
import { FILL } from '../../theme'
import { PRESS_MS } from '../hub/clay'
import { playPlink } from '../hub/hubAudio'
import { HubBackdrop } from '../hub/HubBackdrop'
import { HubBubble } from '../hub/HubBubble'
import { MAP_BUTTON_LOOK as LOOK } from '../hub/mapButtonLook'
import { HomeButton } from '../map/mapChrome'
import {
  createPlayLinePlayer,
  PLAY_LINE_MANIFEST,
  PLAY_TILE_LABELS,
  type PlayLineId,
  type PlayLinePlayer,
} from './playLines'

/** The place's fade in and out (§ 1.4). */
export const PLAY_FADE_MS = 200
/** The open line: 300 ms after the 200 ms fade-in (§ 1.3). */
export const PLAY_OPEN_DELAY_MS = PLAY_FADE_MS + 300
/** A tile's release → the game (§ 1.4). */
export const PLAY_PICK_MS = 200

const OPEN_LINE: PlayLineId = 'guide.play.open'

/** Each game's tile: its world's clay and its clay piece (§ 1.3). */
const TILE = {
  raft: { look: LOOK.math, art: 'ui-raft' },
  critters: { look: LOOK['word-song'], art: 'ui-critters' },
} as const

export interface PlayPlaceProps {
  layout: PlayPlaceLayout
  /** Back from a game: no open line (§ 1.4). */
  quiet: boolean
  /** Home, or Android back: App returns to the Hub. */
  onHome: () => void
  /** A tile: App opens that game. */
  onPickGame: (game: PlayGameId) => void
  /** Test seams. */
  player?: PlayLinePlayer
  plink?: () => void
}

function readGames(): PlayGameId[] {
  let progress: Progress | null
  try {
    progress = loadProgress()
  } catch {
    progress = null
  }
  return openPlayGames(progress)
}

export function PlayPlace({
  layout,
  quiet,
  onHome,
  onPickGame,
  player: playerProp,
  plink = playPlink,
}: PlayPlaceProps) {
  const [games] = useState(readGames)
  const [player] = useState<PlayLinePlayer>(
    () => playerProp ?? createPlayLinePlayer(),
  )
  const [line, setLine] = useState<{ revealed: number } | null>(null)
  const leavingRef = useRef(false)
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())

  // The open line, from the Hub only. Unmount: silence, timers cleared.
  useEffect(() => {
    const timers = timersRef.current
    if (!quiet) {
      const timer = setTimeout(() => {
        timers.delete(timer)
        if (leavingRef.current) return
        setLine({ revealed: 0 })
        void player.playLine(OPEN_LINE, {
          onWordTick: (w) => {
            if (!leavingRef.current) setLine({ revealed: w + 1 })
          },
        })
      }, PLAY_OPEN_DELAY_MS)
      timers.add(timer)
    }
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
      player.cancelActive()
      player.unload()
    }
    // Mount-once: `quiet` and the player are fixed for the mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const home = () => {
    if (leavingRef.current) return
    leavingRef.current = true
    player.cancelActive()
    onHome()
  }
  const homeRef = useRef(home)
  useEffect(() => {
    homeRef.current = home
  })
  // Android back = Home.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      homeRef.current()
      return true
    })
    return () => sub.remove()
  }, [])

  const pick = (game: PlayGameId) => {
    if (leavingRef.current) return
    leavingRef.current = true
    plink()
    player.cancelActive()
    const timer = setTimeout(() => {
      timersRef.current.delete(timer)
      onPickGame(game)
    }, PLAY_PICK_MS)
    timersRef.current.add(timer)
  }

  const { hub } = layout
  const k = layout.home.width / 96
  const rects = playTiles(layout, games.length)
  return (
    <>
      <HubBackdrop layout={hub} />
      <Animated.View
        testID="play-place"
        entering={FadeIn.duration(PLAY_FADE_MS)}
        exiting={FadeOut.duration(PLAY_FADE_MS)}
        style={styles.foreground}
      >
        {line !== null && line.revealed > 0 && (
          <HubBubble
            testID="play-bubble"
            bubble={hub.bubble}
            text={PLAY_LINE_MANIFEST[OPEN_LINE].text}
            revealedCount={line.revealed}
            lineKey={OPEN_LINE}
          />
        )}
        {games.map((game, i) => (
          <PlayTile
            key={game}
            game={game}
            rect={rects[i]!}
            onPress={() => pick(game)}
          />
        ))}
        <HomeButton
          rect={layout.home}
          k={k}
          onPress={home}
          testID="play-home"
        />
      </Animated.View>
    </>
  )
}

/**
 * A game's tile (§ 1.3): a rounded square (radius 0.22 t) in its world's
 * clay with that look's shadow at s = t / 118, the game's clay piece at
 * 0.78 t inside; pressed, the face sinks 8 × s over 120 ms. No text, no
 * lock, no "new", no count, no idle motion.
 */
function PlayTile({
  game,
  rect,
  onPress,
}: {
  game: PlayGameId
  rect: Rect
  onPress: () => void
}) {
  const { look, art } = TILE[game]
  const t = rect.width
  const s = t / 118
  const sink = useSharedValue(0)
  const press = (down: boolean) =>
    sink.set(withTiming(down ? 8 * s : 0, { duration: PRESS_MS }))
  const pressed = useAnimatedStyle(() => ({
    transform: [{ translateY: sink.get() }],
  }))
  return (
    <Pressable
      testID={`play-tile-${game}`}
      accessibilityRole="button"
      accessibilityLabel={PLAY_TILE_LABELS[game]}
      onPressIn={() => press(true)}
      onPressOut={() => press(false)}
      onPress={onPress}
      style={[
        styles.abs,
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
      ]}
    >
      <Animated.View
        style={[
          styles.face,
          {
            borderRadius: 0.22 * t,
            backgroundColor: look.flat,
            experimental_backgroundImage: look.face,
            boxShadow: look.shadow(s),
          },
          pressed,
        ]}
      >
        <View pointerEvents="none">
          <PathImage
            id={art}
            px={Math.round(0.78 * t)}
            testID={`play-tile-${game}-art`}
          />
        </View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  foreground: { ...FILL, zIndex: 2, pointerEvents: 'box-none' },
  abs: { position: 'absolute' },
  face: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
