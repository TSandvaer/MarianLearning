/**
 * Native app root.
 *
 * Route state is core's route state machine (`./router/routes.ts`).
 * Phase 3 ports the screens one by one: Splash, Greet, Math, Word Song,
 * Session End, the Hub, the map and Parent Settings are real; only the
 * legacy `reward` route is still a placeholder.
 * Splash branches on the
 * persisted `sessionCount` through core's `nextAfterSplash()`, exactly
 * like the web; neither Splash nor Greet writes it (Session-End does).
 * Emma is one App-level view that springs between the routes' frames
 * (`./components/EmmaStage.tsx`); on Greet she breathes faster and stays
 * in the idle pose throughout; on Math she takes the screen's poses.
 *
 * Math's session start is App's, as on the web (`./session/mathSession.ts`):
 * kicked on Greet (or on Math for a returning child), its visible-wait
 * timer started on Math, torn down when the child leaves Math for the Hub
 * or leaves Session End. Math's result goes to Session End as the web's
 * `SessionEndPayload`; Session End's "All done" opens the map when an
 * unlock is waiting, else the Hub, and a not-yet day's "Again" starts the
 * next session (web `handleSessionEndAllDone` / `…Again`).
 *
 * Word Song's session start is App's too (`./session/wordSongSession.ts`):
 * kicked by the Hub's card tap (or on Word Song for the QA route and
 * "Again"), torn down (a request in flight aborted) when the child leaves
 * Word Song for the Hub or leaves Session End. Its result goes to Session
 * End as the web's `handleWordSongComplete` builds it. Word Song has no
 * mount-time write; Session End's one write keeps its payload guard.
 *
 * The Hub (`./screens/hub/Hub.tsx`) hands a card tap to Math (Number
 * Garden) or Word Song, a map button to that world's map and Emma's 3 s
 * press to Parent Settings. On Hub entry App prefetches the glowing
 * world's session (no glow: Word Song; web `hubSessionPrefetch.ts`); the
 * card tap kicks it, which adopts the prefetch, and records the world as
 * played today (`todayTreesTouched`, as the web's `handleHubPickTree`).
 * Emma fades in when the Hub is the first screen after Splash,
 * and wears her baked shadow on the Hub.
 *
 * At launch App reconciles progress with the cloud once, as the web's
 * boot effect does (`./lifecycle/launchReconcile.ts`): off without the
 * progress secret, never waited for, local kept on any failure.
 *
 * Learner profiles (`design/native/learner-profiles.md`): with 2 to 4
 * learners Splash opens "Who is playing?" (`./screens/picker/`), and so do
 * the Hub's badge, Session End's All done (and Back on the unlock Map it
 * opened), Parent Settings' Done after the learners changed, and a return
 * from 10 minutes in the background on Greet, the Hub, the Map or Session
 * End (`./lifecycle/pickerReturn.ts`). A pick switches the learner: the
 * route change already tore the kicked or prefetched session down; then
 * that learner's store is installed (`activateLearner`), the Hub's quiet
 * remount mark is cleared so their Hub speaks, their launch reconcile
 * starts (once per learner per launch), and the screens mount afresh at
 * their Greet or Hub (the QA jump's remount). One learner: none of this
 * shows.
 *
 * The map (`./screens/map/MapScreen.tsx`) opens with a handoff (`MapEntry`,
 * the world) from a Hub map button or Session End's "All done"; it may
 * write the unlock seen-marker on mount, so without a handoff (the QA
 * route, a placeholder's exit) the placeholder renders, and leaving the
 * map clears it. App's Emma is hidden there (the map draws her badge).
 *
 * Parent Settings (`./screens/parentSettings/ParentSettings.tsx`) opens
 * from Emma's 3 s press on the Hub and needs no handoff: it writes
 * nothing on mount, only on a control change, so the QA route and
 * re-entry are safe. Emma is not on it (a parent's screen), and Done /
 * Android back return to the Hub. In debug only, its "QA: jump to a step"
 * row opens the step picker; a jump (or "Back to Marian's real start")
 * writes the progress, then App mounts its screens afresh on the Hub, so
 * every once-per-mount read (Math's fallback focus node, plan and
 * scaffold decisions, Word Song's fallback plan) sees the new step, as a
 * relaunch would. The launch reconcile is App's and does not run again.
 *
 * Same-day review and daily warm-up (native spec
 * `design/native/review-mode-and-warmup-native.md`): the session controllers
 * pick them (core `sessionPlanKind`) and their snapshots say how the round
 * is made up (`review`, `warmupCount`, `problemNodes`), which App hands to
 * the screens and, at the end, to Session End's payload. Math reports the
 * CURRENT problem's kind, so a mixed round's frame follows each problem
 * (§ 3.4; only phone landscape differs).
 *
 * The Map peek (native spec `design/native/fast-track-native.md` § 6): a
 * tap on a later stop asks App for a peek (`./session/peekSession.ts`, its
 * audio loaded beside the Hub's prefetch). Once the server answered, the
 * route goes to `peek`, where Math or Word Song plays the step's 3 problems
 * in peek mode; the closer (or the back button) returns to the map, which
 * remounts quiet (`quietReturn`). A peek writes nothing: no Session End,
 * no session controller, no stardust, no history, no cloud push.
 *
 * Map tap-to-play (native spec `design/native/map-tap-to-play.md`): the
 * current stop starts exactly the Hub card's session for that world (the
 * same controller kick, so the same `sessionPlanKind`, and the world
 * recorded as played today); a mastered stop's replay is a peek of its 8
 * canon problems (`requestReplay`, the `peek` route, the replay's lines),
 * writing nothing. A session the Map started remembers it (`originRef`):
 * Back, and Session End's "All done", return to that world's map, quiet (a
 * pending unlock still plays its beat). Hub starts are unchanged.
 *
 * The side mini-games (native spec `design/native/mini-game-flower-bed.md`
 * § 1.3): a world Map's play door asks App for its game; the route goes to
 * `game`, keeping the Map's handoff, and the round's end or Back returns to
 * that Map, quiet, with the handoff it had (so its Home goes where it went
 * before). A game writes nothing and never reaches Session End.
 *
 * The Play place (native spec `design/native/play-place.md` § 1.4): the
 * Hub's Play disc opens `play-place` (the Hub's frames, so Emma stays put)
 * with its open line; a tile opens `play-game` with that game in App
 * state; a game's Back or natural stop returns to the place, silent; Home
 * returns to the Hub. Nothing there writes or calls the network.
 *
 * `@marian/core` is wired to the device before this module loads
 * (`./platform/boot.ts`, imported first by `index.ts`).
 */
import {
  BREATHING_PERIOD_S,
  BREATHING_SCALE_KEYFRAMES,
  type EmmaPose,
} from '@marian/core/character/emmaPose'
import {
  computeSuggestion,
  prefetchTrackFor,
} from '@marian/core/hub/hubSuggestion'
import type { GameId } from '@marian/core/games/miniGames'
import type { PlayGameId } from '@marian/core/games/playPlace'
import type { ExtendedMathProblem } from '@marian/core/math/extendedProblems'
import { pickStaticSessionPlan } from '@marian/core/math/sessionPlans'
import { pickStaticWordSongPlan } from '@marian/core/wordSong/wordSessionPlans'
import {
  loadProgress,
  type MasteryTrack,
  type SkillNode,
} from '@marian/core/progress'
import { now as progressNow } from '@marian/core/progress/clock'
import { pendingUnlock } from '@marian/core/progress/pathBeats'
import {
  activateLearner,
  activeLearner,
  installedLearnerList,
  nextAfterPick,
  type LearnerEntry,
} from '@marian/core/learners'
import { nextAfterSplash } from '@marian/core/router/nextAfterSplash'
import {
  readSessionHistoryForToday,
  recordTreeTouched,
  type SkillTreeId,
} from '@marian/core/sessionEnd/sessionHistory'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import {
  SafeAreaProvider,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { sessionPrefetcher, useAudioEngine } from './audio'
import { EmmaStage, type Breath } from './components/EmmaStage'
import { useAppFonts } from './fonts'
import type { Viewport } from './layout/layout'
import { greetLayout } from './layout/greetLayout'
import { hubLayout } from './layout/hubLayout'
import {
  extendedMathLayout,
  mathLayout,
  mathLayoutKind,
} from './layout/mathLayout'
import { mapScreenLayout } from './layout/mapScreenLayout'
import { parentSettingsLayout } from './layout/parentSettingsLayout'
import { wordSongLayout } from './layout/wordSongLayout'
import { playPlaceLayout } from './layout/playPlaceLayout'
import { layoutForRoute } from './layout/routeLayout'
import { sessionEndLayout } from './layout/sessionEndLayout'
import { pickerLayout } from './layout/pickerLayout'
import { useAppVisibilityChange } from './lifecycle/appVisibility'
import { reconcileOncePerLaunch } from './lifecycle/launchReconcile'
import { opensPickerOnReturn } from './lifecycle/pickerReturn'
import { readBuildEnv } from './platform/buildEnv'
import { getLaunchFlags } from './platform/launchFlags'
import {
  FIRST_ROUTE,
  nextRoute,
  ROUTE_EXITS,
  type Route,
} from './router/routes'
import {
  Greet,
  GREET_BREATH_PERIOD_S,
  GREET_BREATH_SCALE,
} from './screens/greet/Greet'
import { Hub } from './screens/hub/Hub'
import { GameScreen } from './screens/game/GameScreen'
import { PlayGameScreen } from './screens/play/PlayGameScreen'
import { PlayPlace } from './screens/play/PlayPlace'
import { clearHubUnmountMark } from './screens/hub/hubAudio'
import { MapScreen, type MapEntry } from './screens/map/MapScreen'
import type { MapDebugLog } from './screens/map/mapTapLog'
import { MathScreen } from './screens/math/Math'
import {
  ParentSettings,
  type ParentSettingsExit,
} from './screens/parentSettings/ParentSettings'
import { PickerScreen } from './screens/picker/PickerScreen'
import type { MathSessionResult } from './screens/math/mathTypes'
import { RoutePlaceholder } from './screens/RoutePlaceholder'
import { SessionEnd } from './screens/sessionEnd/SessionEnd'
import { Splash } from './screens/Splash'
import { WordSong } from './screens/wordSong/WordSong'
import type { WordSongSessionResult } from './screens/wordSong/wordSongTypes'
import {
  createMathSessionController,
  mathFallbackFocusNode,
  mathScaffoldDecisions,
} from './session/mathSession'
import {
  mathSessionEndPayload,
  wordSongSessionEndPayload,
  type SessionEndPayload,
} from './session/sessionEndPayload'
import {
  requestPeek,
  requestReplay,
  type PreparedPeek,
} from './session/peekSession'
import { createWordSongSessionController } from './session/wordSongSession'
import { colors } from './theme'

// Keep the OS splash up until the fonts are ready (module scope, so it
// runs before the first render).
void SplashScreen.preventAutoHideAsync()

/**
 * Greet's breath: `scale: [1, 1.05, 1]` over 2.4 s, faster than elsewhere so
 * she reads as awake (web Greet.tsx; Dave's consult rejected 1.015).
 */
const GREET_BREATH: Breath = {
  scale: GREET_BREATH_SCALE,
  periodS: GREET_BREATH_PERIOD_S,
}

/** EmmaCharacter's breath (Math, Hub, ...): 1.02 over 4 s. */
const BREATH: Breath = {
  scale: BREATHING_SCALE_KEYFRAMES[1],
  periodS: BREATHING_PERIOD_S,
}

/**
 * The routes Math's session audio survives on: Greet (the pre-warm), Math,
 * Session End (the web plays its lines from the same session).
 */
const MATH_AUDIO_ROUTES: ReadonlySet<Route> = new Set<Route>([
  'greet',
  'math',
  'session-end',
])

/**
 * The routes Word Song's session audio survives on: Word Song and Session
 * End (the web keeps it through Session End too). The Hub's prefetch is
 * the app's `sessionPrefetcher`, not this session.
 */
const WORD_SONG_AUDIO_ROUTES: ReadonlySet<Route> = new Set<Route>([
  'literacy',
  'session-end',
])

/** Debug builds only (`EXPO_PUBLIC_DEBUG=1`): the Map's tap log to Metro. */
const logMapLine: MapDebugLog = (line) => console.log(line)

/** Debug builds only: Word Song's `[story-cue]` lines to Metro. */
const logStoryCueLine = (line: string) => console.log(line)

/** Where a session was started (map-tap-to-play § 4): its Back and end return there. */
type SessionOrigin = 'hub' | 'map'

/**
 * Where the Map's Home goes: the Hub, or with 2+ learners the picker on a
 * Map Session End's All done opened (learner profiles § 2.4).
 */
type MapBack = 'hub' | 'picker'

/** The Hub card's tree of a map's world. */
const TREE_OF: Readonly<Record<MasteryTrack, SkillTreeId>> = {
  math: 'number-garden',
  'word-song': 'word-song',
}

/** Once per App mount, as on the web: the fallback plan + scaffold decisions. */
function mathSessionDefaults() {
  const focusNode = mathFallbackFocusNode()
  return {
    focusNode,
    plan: pickStaticSessionPlan(undefined, focusNode),
    scaffold: mathScaffoldDecisions(new Date().toISOString()),
  }
}

interface ShellProps {
  /** The first route; unset → Splash (or the debug QA route). */
  startRoute?: Route
  /** Debug only: a QA step jump was written; mount afresh on the Hub. */
  onQaJump: () => void
  /** A pick on "Who is playing?": App switches to that learner. */
  onPickLearner: (learner: LearnerEntry) => void
  /** The playing learner's data changed under the screens: mount afresh. */
  onRemount: (start: Route) => void
}

function Shell({ startRoute, onQaJump, onPickLearner, onRemount }: ShellProps) {
  // The provider's measured frame, not `useWindowDimensions()`: on Android
  // (API 37 emulator, edge-to-edge) the window height leaves out the
  // navigation bar (667×351) while the app draws under it (667×375) and
  // the bottom inset counts it again (24), so the layouts lost 24 pt.
  const { width, height } = useSafeAreaFrame()
  const insets = useSafeAreaInsets()
  // Only the system text scale (Parent Settings goes compact above 1.2).
  const { fontScale } = useWindowDimensions()
  const viewport = useMemo<Viewport>(
    () => ({ width, height, insets }),
    [width, height, insets],
  )
  const flags = getLaunchFlags()
  useEffect(() => {
    if (!flags.debug) return
    console.log(
      `[layout] frame ${Math.round(width)}×${Math.round(height)} insets t${insets.top} b${insets.bottom} l${insets.left} r${insets.right}`,
    )
  }, [flags.debug, width, height, insets])
  const env = readBuildEnv()
  const qaAutoTapMs = flags.debug ? parseQaAutoTap(env.qaAutoTapMs) : undefined
  const [route, setRoute] = useState<Route>(
    () => startRoute ?? (flags.debug ? parseQaRoute(env.qaRoute) : FIRST_ROUTE),
  )

  // Math: session start, result handoff, Emma's pose.
  const [mathDefaults] = useState(mathSessionDefaults)
  const [mathSession] = useState(() =>
    createMathSessionController({
      fallbackPlanId: () => mathDefaults.plan.id,
      prefetcher: sessionPrefetcher,
    }),
  )
  const mathState = useSyncExternalStore(
    mathSession.subscribe,
    mathSession.getSnapshot,
  )
  const [mathPose, setMathPose] = useState<EmmaPose>('idle')
  // The kind of the problem on screen (§ 3.4), with the server plan it was
  // reported for: a report about an earlier plan is ignored, so the frame
  // never lags a plan swap by a render. `null` until Math reports.
  const [reportedKind, setReportedKind] = useState<{
    plan: unknown
    kind: ExtendedMathProblem['kind']
  } | null>(null)
  const onMathProblemKind = useCallback(
    (kind: ExtendedMathProblem['kind']) =>
      setReportedKind({ plan: mathSession.getSnapshot().plan, kind }),
    [mathSession],
  )

  // Word Song: session start, result handoff, Emma's pose (as Math's).
  const [wordSongFallbackPlan] = useState(() => pickStaticWordSongPlan())
  const [wordSongSession] = useState(() =>
    createWordSongSessionController({
      fallbackPlanId: () => wordSongFallbackPlan.id,
      prefetcher: sessionPrefetcher,
    }),
  )
  const wordSongState = useSyncExternalStore(
    wordSongSession.subscribe,
    wordSongSession.getSnapshot,
  )
  const [wordSongPose, setWordSongPose] = useState<EmmaPose>('idle')
  const [sessionEnd, setSessionEnd] = useState<SessionEndPayload | null>(null)
  const [sessionEndPose, setSessionEndPose] = useState<EmmaPose>('idle')
  // The map's handoff: set by the two ways in, cleared on the way out.
  const [mapEntry, setMapEntry] = useState<MapEntry | null>(null)
  // The Map peek on screen (its plan and audio); set when the route goes
  // to `peek`, unloaded and cleared on the way out.
  const [peek, setPeek] = useState<PreparedPeek | null>(null)
  const peekRef = useRef<PreparedPeek | null>(null)
  const [peekPose, setPeekPose] = useState<EmmaPose>('idle')
  // The mini-game on screen and the Map handoff it came from (§ 1.3); set
  // when the route goes to `game`, cleared on the way out.
  const [game, setGame] = useState<{ id: GameId; map: MapEntry } | null>(null)
  const gameRef = useRef<{ id: GameId; map: MapEntry } | null>(null)
  const [gamePose, setGamePose] = useState<EmmaPose>('idle')
  // The Play place (play-place § 1.4): the game on screen, and whether the
  // place opens quiet (back from a game) or with its line (from the Hub).
  const [playGame, setPlayGame] = useState<PlayGameId | null>(null)
  const [playQuiet, setPlayQuiet] = useState(false)
  const [playPose, setPlayPose] = useState<EmmaPose>('idle')
  // Where the session on screen was started (map-tap-to-play § 4); set by
  // each way into a session, kept through Session End's "Again".
  const originRef = useRef<SessionOrigin>('hub')
  const mapBackRef = useRef<MapBack>('hub')
  // The learners, read per render (Parent Settings can change them).
  const learners = installedLearnerList()?.learners ?? []
  const several = learners.length >= 2

  // The web's tear-downs (`handleBackToHub`, `handleSessionEndAllDone` /
  // `…Again`, the leave-effect) run BEFORE the route flips: leaving
  // Session End, or leaving Greet / Math / Session End for anything else,
  // drops the Math session first. A Math screen must never mount on the
  // previous session: its stale read would set the read-aloud latch.
  const routeRef = useRef(route)
  const navigate = useCallback(
    (to: Route) => {
      const from = routeRef.current
      const next = nextRoute(from, to)
      if (next === from) return
      if (from === 'session-end' || !MATH_AUDIO_ROUTES.has(next)) {
        mathSession.tearDown()
      }
      // The next Math reports its own first problem.
      if (from === 'math' || from === 'peek') setReportedKind(null)
      // A peek's audio goes with it (it never became the session audio).
      if (from === 'peek') {
        peekRef.current?.audio.unload()
        peekRef.current = null
        setPeek(null)
      }
      if (from === 'game') {
        gameRef.current = null
        setGame(null)
      }
      if (from === 'play-game') setPlayGame(null)
      // Word Song's session likewise (a request in flight is aborted: it
      // must not outlive the screen).
      if (from === 'session-end' || !WORD_SONG_AUDIO_ROUTES.has(next)) {
        wordSongSession.tearDown()
      }
      // The Hub's prefetch is for the glowing world; it survives a map
      // visit (web parity) and goes on any other way out.
      if (
        from === 'hub' &&
        next !== 'math' &&
        next !== 'literacy' &&
        next !== 'map'
      ) {
        sessionPrefetcher.discard()
      }
      // Session End consumed its payload (the one write): a later arrival
      // without a new session gets the placeholder, never a second write.
      if (from === 'session-end') setSessionEnd(null)
      // Likewise the map: a later arrival needs a new handoff, so its
      // seen-marker write can never run on a stale one.
      if (from === 'map') setMapEntry(null)
      routeRef.current = next
      setRoute(next)
    },
    [mathSession, wordSongSession],
  )
  // A way into the map: the handoff first, then the route (only when the
  // map is an exit of the route we are on). `back` is where its Home goes.
  const openMap = useCallback(
    (world: MasteryTrack, back: MapBack = 'hub') => {
      if (nextRoute(routeRef.current, 'map') !== 'map') return
      mapBackRef.current = back
      setMapEntry({ world })
      navigate('map')
    },
    [navigate],
  )
  // Back to a world's map from a session the Map started, or a peek or a
  // replay (map-tap-to-play § 4, fast-track § 6.4): quiet, Emma has spoken.
  // Home keeps going where it went, unless Session End hands over (`back`).
  const returnToMap = useCallback(
    (world: MasteryTrack, back?: MapBack) => {
      if (nextRoute(routeRef.current, 'map') !== 'map') return
      if (back !== undefined) mapBackRef.current = back
      setMapEntry({ world, quietReturn: true })
      navigate('map')
    },
    [navigate],
  )
  const onSplashDone = useCallback(
    () => navigate(nextAfterSplash()),
    [navigate],
  )
  // Web `handleGreetAdvance`: the first-launch flow goes straight to Math.
  const onGreetDone = useCallback(() => {
    originRef.current = 'hub'
    navigate('math')
  }, [navigate])

  // Web kick-effect: kick on Greet / Math (latched until a tear-down).
  useEffect(() => {
    if (route === 'greet' || route === 'math') mathSession.kick()
  }, [route, mathSession])
  // Emma's Path 1/10: the hinted request's 5 s budget counts visible wait.
  useEffect(() => {
    if (route === 'math' && !mathState.audioReady) {
      mathSession.startWaitTimer()
    }
  }, [route, mathState.audioReady, mathSession])
  // Word Song's kick (QA route, "Again"; the Hub tap kicks it itself) and
  // its visible-wait timer, as Math's.
  useEffect(() => {
    if (route === 'literacy') wordSongSession.kick()
  }, [route, wordSongSession])
  useEffect(() => {
    if (route === 'literacy' && !wordSongState.audioReady) {
      wordSongSession.startWaitTimer()
    }
  }, [route, wordSongState.audioReady, wordSongSession])

  // Web `handleMathComplete`.
  const onMathComplete = useCallback(
    (result: MathSessionResult) => {
      const snapshot = mathSession.getSnapshot()
      setSessionEnd(
        mathSessionEndPayload(
          result,
          snapshot.plan ?? mathDefaults.plan,
          mathSession.sessionFocus,
          snapshot.plan !== null
            ? {
                review: snapshot.review,
                warmupCount: snapshot.warmupCount,
                mix: snapshot.mix,
              }
            : undefined,
        ),
      )
      setSessionEndPose('idle')
      navigate('session-end')
    },
    [mathDefaults, mathSession, navigate],
  )
  // Web `handleWordSongComplete`.
  const onWordSongComplete = useCallback(
    (result: WordSongSessionResult) => {
      const snapshot = wordSongSession.getSnapshot()
      setSessionEnd(
        wordSongSessionEndPayload(
          result,
          wordSongSession.currentTargetVowel,
          wordSongSession.sessionFocus,
          snapshot.plan !== null
            ? { review: snapshot.review, warmupCount: snapshot.warmupCount }
            : undefined,
        ),
      )
      setSessionEndPose('idle')
      navigate('session-end')
    },
    [wordSongSession, navigate],
  )
  // Web `handleSessionEndAllDone`: an unlock this world has not celebrated
  // yet opens the map (which plays it); otherwise the Hub. (The route
  // flip tears the Math session down, as the web's handler does.) A
  // session the Map started returns to its map, quiet; a pending unlock
  // plays its beat there all the same (map-tap-to-play § 4). With 2+
  // learners Session End hands the device over (learner profiles § 2.4):
  // the picker instead of the Hub, and that Map's Home opens the picker.
  const onSessionEndAllDone = useCallback(() => {
    const world: MasteryTrack =
      sessionEnd?.surface === 'word-song' ? 'word-song' : 'math'
    const home: MapBack = several ? 'picker' : 'hub'
    if (originRef.current === 'map') {
      returnToMap(world, home)
      return
    }
    const saved = loadProgress()
    if (saved !== null && pendingUnlock(saved, world) !== null) {
      openMap(world, home)
    } else navigate(home)
  }, [sessionEnd, several, navigate, openMap, returnToMap])
  // Web `handleSessionEndAgain` (not-yet day): another session, same world.
  const onSessionEndAgain = useCallback(
    () => navigate(sessionEnd?.surface === 'word-song' ? 'literacy' : 'math'),
    [sessionEnd, navigate],
  )
  // Web `handleBackToHub` (`navigate` tears the session down); a session
  // the Map started goes back to its map, quiet (map-tap-to-play § 4).
  const onMathExit = useCallback(() => {
    if (originRef.current === 'map') returnToMap('math')
    else navigate('hub')
  }, [navigate, returnToMap])
  const onWordSongExit = useCallback(() => {
    if (originRef.current === 'map') returnToMap('word-song')
    else navigate('hub')
  }, [navigate, returnToMap])

  // Hub entry: prefetch the glowing world's session (web
  // `useHubSessionPrefetch`; no glow → Word Song).
  useEffect(() => {
    if (route !== 'hub') return
    let suggestion: SkillTreeId | null
    try {
      const now = progressNow()
      suggestion = computeSuggestion(readSessionHistoryForToday(now), now)
    } catch {
      // Storage unavailable: no prefetch; the tap starts its own request.
      return
    }
    if (prefetchTrackFor(suggestion) === 'math') mathSession.prefetch()
    else wordSongSession.prefetch()
  }, [route, mathSession, wordSongSession])
  // Web `handleHubPickTree`. The kick takes the prefetch in the tap; then,
  // as on the web, the world is recorded as played today (after the Hub's
  // own suggestion write, before the route flips). The Map's current stop
  // starts the same session (map-tap-to-play § 1, D1).
  const startTree = useCallback(
    (tree: SkillTreeId, origin: SessionOrigin) => {
      originRef.current = origin
      if (tree === 'number-garden') mathSession.kick()
      else wordSongSession.kick()
      recordTreeTouched(tree, progressNow())
      navigate(tree === 'number-garden' ? 'math' : 'literacy')
    },
    [mathSession, wordSongSession, navigate],
  )
  const onHubPick = useCallback(
    (tree: SkillTreeId) => startTree(tree, 'hub'),
    [startTree],
  )
  // Web `handleHubOpenMap`; the map's Home is web `handleMapBack` (the
  // map stamps the Hub's rapid-remount clock, so the Hub stays quiet).
  const onHubMap = useCallback(
    (world: MasteryTrack) => openMap(world, 'hub'),
    [openMap],
  )
  const onMapHome = useCallback(() => navigate(mapBackRef.current), [navigate])
  // Fast-track spec § 6.1: a later stop's tap (a peek), and map-tap-to-play
  // § 3: a mastered stop's (a replay, the same route under the same rules).
  // The map waits (taps held) until this settles; `true` = it opened. Home
  // (a peek) or the map's unmount aborts `signal`.
  const mapWorld = mapEntry?.world
  const openMapSession = useCallback(
    async (
      request: typeof requestPeek,
      node: SkillNode,
      signal: AbortSignal,
    ): Promise<boolean> => {
      if (mapWorld === undefined) return false
      let prepared: PreparedPeek
      try {
        prepared = await request({ world: mapWorld, node, signal })
      } catch {
        return false
      }
      if (signal.aborted || routeRef.current !== 'map') {
        prepared.audio.unload()
        return false
      }
      peekRef.current = prepared
      setPeek(prepared)
      setPeekPose('idle')
      navigate('peek')
      return true
    },
    [mapWorld, navigate],
  )
  const onMapPeek = useCallback(
    (node: SkillNode, signal: AbortSignal) =>
      openMapSession(requestPeek, node, signal),
    [openMapSession],
  )
  const onMapReplay = useCallback(
    (node: SkillNode, signal: AbortSignal) =>
      openMapSession(requestReplay, node, signal),
    [openMapSession],
  )
  // Map tap-to-play § 1: the current stop starts the Hub card's session for
  // the map's world; `true` = the route changed.
  const onMapPlay = useCallback((): boolean => {
    if (mapWorld === undefined || routeRef.current !== 'map') return false
    startTree(TREE_OF[mapWorld], 'map')
    return routeRef.current !== 'map'
  }, [mapWorld, startTree])
  // § 6.3: the closer's end, or the back button: back to the same map,
  // which opens quiet (§ 6.4).
  const onPeekEnd = useCallback(() => {
    const current = peekRef.current
    if (current === null || routeRef.current !== 'peek') return
    returnToMap(current.world)
  }, [returnToMap])
  // Mini-game spec § 1.2: the play door; `true` = the route changed. The
  // Map's handoff goes with the game, so the way back keeps it.
  const onMapGame = useCallback(
    (id: GameId): boolean => {
      if (mapEntry === null || routeRef.current !== 'map') return false
      const entry = { id, map: mapEntry }
      gameRef.current = entry
      setGame(entry)
      setGamePose('idle')
      navigate('game')
      return routeRef.current !== 'map'
    },
    [mapEntry, navigate],
  )
  // § 1.3: the round's end or Back: the same Map, quiet, its handoff kept.
  const onGameExit = useCallback(() => {
    const current = gameRef.current
    if (current === null || routeRef.current !== 'game') return
    setMapEntry({ ...current.map, quietReturn: true })
    navigate('map')
  }, [navigate])
  // Play-place spec § 1.4: the Hub's Play disc opens the place with its
  // line; a tile opens a game; a game's Back or natural stop returns to
  // the place, silent; Home goes to the Hub. Nothing here writes.
  const onHubPlay = useCallback(() => {
    setPlayQuiet(false)
    navigate('play-place')
  }, [navigate])
  const onPlayHome = useCallback(() => navigate('hub'), [navigate])
  const onPlayPick = useCallback(
    (id: PlayGameId) => {
      if (routeRef.current !== 'play-place') return
      setPlayGame(id)
      setPlayPose('idle')
      navigate('play-game')
    },
    [navigate],
  )
  const onPlayGameExit = useCallback(() => {
    if (routeRef.current !== 'play-game') return
    setPlayQuiet(true)
    navigate('play-place')
  }, [navigate])
  const onPeekProblemKind = useCallback(
    (kind: ExtendedMathProblem['kind']) =>
      setReportedKind({ plan: peekRef.current?.plan ?? null, kind }),
    [],
  )
  const onHubParent = useCallback(() => navigate('parent-settings'), [navigate])
  // The Hub badge (learner profiles § 2.1).
  const onHubBadge = useCallback(() => navigate('picker'), [navigate])
  // Web `handleParentSettingsExit`. With the learners or the playing
  // learner changed (§ 3.1): the picker with 2+ learners, else that
  // learner's Greet or Hub, mounted afresh on their store. A moved start
  // of the playing learner remounts on the Hub, as a QA jump does.
  const onParentSettingsExit = useCallback(
    (exit?: ParentSettingsExit) => {
      const count = installedLearnerList()?.learners.length ?? 0
      const playing = activeLearner()
      if (exit?.learnersChanged && count >= 2) navigate('picker')
      else if (exit?.learnersChanged && playing !== null) {
        onRemount(nextAfterPick(playing))
      } else if (exit?.playingDocMoved) onRemount('hub')
      else navigate('hub')
    },
    [navigate, onRemount],
  )

  // Audio session (plays in silent mode, doNotMix), the voice channel's
  // background/interruption handling, and the boot-time cache sweep.
  useAudioEngine(flags.debug)

  // The web's visibilitychange use, natively. The audio engine subscribes
  // itself (above); the shell logs the edge in debug mode, and applies the
  // return rule (learner profiles § 2.2).
  const hiddenAtRef = useRef<number | null>(null)
  useAppVisibilityChange(
    useCallback(
      (hidden: boolean) => {
        if (flags.debug) {
          console.log(`[lifecycle] ${hidden ? 'hidden' : 'visible'}`)
        }
        if (hidden) {
          hiddenAtRef.current = Date.now()
          return
        }
        const since = hiddenAtRef.current
        hiddenAtRef.current = null
        if (since === null) return
        const count = installedLearnerList()?.learners.length ?? 0
        if (opensPickerOnReturn(routeRef.current, Date.now() - since, count)) {
          navigate('picker')
        }
      },
      [flags.debug, navigate],
    ),
  )

  const greet = route === 'greet' ? greetLayout(viewport) : null
  // The problem on screen picks the frame (number recognition, skip
  // counting and multiplication). A forward session's 8 share one kind; a
  // review or a warm-up may mix them, so Math reports each (§ 3.4).
  const mathKind =
    reportedKind !== null && reportedKind.plan === mathState.plan
      ? reportedKind.kind
      : mathLayoutKind(
          mathState.plan?.problems[0],
          mathState.problemNodes?.[0] ??
            (mathState.plan !== null
              ? mathSession.sessionFocus?.node
              : undefined),
        )
  const math = route === 'math' ? extendedMathLayout(viewport, mathKind) : null
  const wordSong = route === 'literacy' ? wordSongLayout(viewport) : null
  // The peek's screen: its world's frames; Math's follow the problem kind.
  const mathPeek = route === 'peek' && peek?.world === 'math' ? peek : null
  const wordPeek = route === 'peek' && peek?.world === 'word-song' ? peek : null
  const peekMath =
    mathPeek !== null
      ? extendedMathLayout(
          viewport,
          reportedKind !== null && reportedKind.plan === mathPeek.plan
            ? reportedKind.kind
            : mathLayoutKind(mathPeek.plan.problems[0], mathPeek.node),
        )
      : null
  const peekWord = wordPeek !== null ? wordSongLayout(viewport) : null
  // A mini-game wears the lesson's Math frame as it is (§ 1.4).
  const gameLayout =
    route === 'game' && game !== null ? mathLayout(viewport) : null
  // Session End needs a finished session; without one (the QA route, or
  // a later arrival after it consumed its payload) the placeholder renders
  // and nothing is written.
  const end =
    route === 'session-end' && sessionEnd !== null
      ? sessionEndLayout(viewport)
      : null
  const hub = route === 'hub' ? hubLayout(viewport) : null
  // The Play place keeps the Hub's frames; a game wears the Math frame.
  const place = route === 'play-place' ? playPlaceLayout(viewport) : null
  const playFrame =
    route === 'play-game' && playGame !== null ? mathLayout(viewport) : null
  // The map needs its handoff; without one, the placeholder (no write).
  const map =
    route === 'map' && mapEntry !== null ? mapScreenLayout(viewport) : null
  const parent =
    route === 'parent-settings'
      ? parentSettingsLayout(viewport, fontScale)
      : null
  // "Who is playing?" needs 2+ learners; otherwise the placeholder.
  const picker =
    route === 'picker' && several
      ? pickerLayout(viewport, learners.length)
      : null
  const layout =
    greet ??
    math ??
    peekMath ??
    wordSong ??
    peekWord ??
    gameLayout ??
    playFrame ??
    place?.hub ??
    end ??
    hub ??
    map ??
    picker ??
    layoutForRoute(route, viewport)

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {route === 'splash' ? (
        <Splash onAdvance={onSplashDone} />
      ) : (
        <>
          {greet ? (
            <Greet
              layout={greet}
              onAdvance={onGreetDone}
              qaAutoTapAfterMs={qaAutoTapMs}
            />
          ) : math ? (
            <MathScreen
              layout={math}
              plan={mathState.plan ?? mathDefaults.plan}
              playUtterance={mathState.playUtterance ?? undefined}
              audioReady={mathState.audioReady}
              focusNode={mathDefaults.focusNode}
              planFocusNode={
                mathState.plan !== null
                  ? mathSession.sessionFocus?.node
                  : undefined
              }
              subitisingScaffoldActive={mathDefaults.scaffold.add}
              subitisingSubScaffoldActive={mathDefaults.scaffold.sub}
              review={mathState.review}
              warmupCount={mathState.warmupCount}
              problemNodes={mathState.problemNodes ?? undefined}
              sessionIntro={mathState.intro}
              onProblemKindChange={onMathProblemKind}
              onSessionComplete={onMathComplete}
              onRequestExit={onMathExit}
              onPoseChange={setMathPose}
              qaAutoAnswerAfterMs={qaAutoTapMs}
            />
          ) : peekMath && mathPeek ? (
            <MathScreen
              key={`peek-${mathPeek.audio.sessionId}`}
              layout={peekMath}
              plan={mathPeek.plan}
              playUtterance={(text, opts) =>
                mathPeek.audio.playUtterance(text, opts)
              }
              audioReady
              focusNode={mathPeek.node}
              planFocusNode={mathPeek.node}
              problemNodes={mathPeek.plan.problems.map(() => mathPeek.node)}
              peek={mathPeek.node}
              replay={mathPeek.mode === 'replay'}
              onPeekEnd={onPeekEnd}
              onRequestExit={onPeekEnd}
              onProblemKindChange={onPeekProblemKind}
              onPoseChange={setPeekPose}
              qaAutoAnswerAfterMs={qaAutoTapMs}
            />
          ) : peekWord && wordPeek ? (
            <WordSong
              key={`peek-${wordPeek.audio.sessionId}`}
              layout={peekWord}
              plan={wordPeek.plan}
              playUtterance={(text, opts) =>
                wordPeek.audio.playUtterance(text, opts)
              }
              clipFor={(text) => wordPeek.audio.fileFor(text)}
              audioReady
              peek={wordPeek.node}
              replay={wordPeek.mode === 'replay'}
              onPeekEnd={onPeekEnd}
              onRequestExit={onPeekEnd}
              onPoseChange={setPeekPose}
              qaAutoAnswerAfterMs={qaAutoTapMs}
              debugLog={flags.debug ? logStoryCueLine : undefined}
            />
          ) : gameLayout && game ? (
            <GameScreen
              key={`game-${game.id}`}
              layout={gameLayout}
              game={game.id}
              onExit={onGameExit}
              onPoseChange={setGamePose}
            />
          ) : playFrame && playGame ? (
            <PlayGameScreen
              key={`play-${playGame}`}
              layout={playFrame}
              game={playGame}
              onExit={onPlayGameExit}
              onPoseChange={setPlayPose}
            />
          ) : place ? (
            <PlayPlace
              layout={place}
              quiet={playQuiet}
              onHome={onPlayHome}
              onPickGame={onPlayPick}
            />
          ) : wordSong ? (
            <WordSong
              layout={wordSong}
              plan={wordSongState.plan ?? wordSongFallbackPlan}
              playUtterance={wordSongState.playUtterance ?? undefined}
              clipFor={wordSongState.clipFor ?? undefined}
              audioReady={wordSongState.audioReady}
              crossVowelMixing={wordSongState.crossVowel}
              digraphsThNodeLevel={wordSongState.thLevel}
              digraphsThFirstEncounter={wordSongState.thFirstEncounter}
              review={wordSongState.review}
              warmupCount={wordSongState.warmupCount}
              sessionIntro={wordSongState.intro}
              onSessionComplete={onWordSongComplete}
              onRequestExit={onWordSongExit}
              onPoseChange={setWordSongPose}
              qaAutoAnswerAfterMs={qaAutoTapMs}
              debugLog={flags.debug ? logStoryCueLine : undefined}
            />
          ) : hub ? (
            <Hub
              layout={hub}
              onPickTree={onHubPick}
              onOpenMap={onHubMap}
              onParentLongPress={onHubParent}
              learnerBadge={several ? activeLearner() : null}
              onLearnerBadge={onHubBadge}
              onOpenPlay={onHubPlay}
            />
          ) : map && mapEntry ? (
            <MapScreen
              key={`map-${mapEntry.world}`}
              layout={map}
              world={mapEntry.world}
              onHome={onMapHome}
              onPeek={onMapPeek}
              onPlay={onMapPlay}
              onReplay={onMapReplay}
              onGame={onMapGame}
              quietReturn={mapEntry.quietReturn === true}
              debugLog={flags.debug ? logMapLine : undefined}
            />
          ) : parent ? (
            <ParentSettings
              layout={parent}
              onExit={onParentSettingsExit}
              // The step picker is debug-only, gated like the seeds.
              onQaJump={flags.debug ? onQaJump : undefined}
            />
          ) : picker ? (
            <PickerScreen
              layout={picker}
              learners={learners}
              onPick={onPickLearner}
            />
          ) : end ? (
            <SessionEnd
              layout={end}
              payload={sessionEnd}
              onAllDone={onSessionEndAllDone}
              onAgain={onSessionEndAgain}
              onPoseChange={setSessionEndPose}
            />
          ) : (
            <RoutePlaceholder
              key={route}
              route={route}
              layout={layout}
              flags={flags}
              onNavigate={navigate}
            />
          )}
          {/* The map draws her badge; Parent Settings is a parent's screen. */}
          {route !== 'map' && route !== 'parent-settings' && (
            <EmmaStage
              frame={layout.emma}
              // Calm through the whole Greet (native-only, Thomas 2026-10-09:
              // no celebration swap); Math and Session End drive her poses as
              // on the web.
              pose={
                route === 'math'
                  ? mathPose
                  : route === 'peek'
                    ? peekPose
                    : route === 'game'
                      ? gamePose
                      : route === 'play-game'
                        ? playPose
                        : wordSong
                          ? wordSongPose
                          : end
                            ? sessionEndPose
                            : 'idle'
              }
              // The web's Session End Emma is a still image (no breath). On
              // the picker she breathes as on Greet (learner profiles § 1.4).
              breath={
                route === 'greet' || picker ? GREET_BREATH : end ? null : BREATH
              }
              motion={route === 'greet' ? 'greet' : 'character'}
              // Read at mount: a returning launch lands on the Hub (or the
              // picker, in the Hub's frame), where she is already there (a
              // fade), not Greet's arrival.
              entrance={
                route === 'hub' || route === 'picker' ? 'fade' : 'slide'
              }
              shadow={
                route === 'hub' || route === 'play-place' || picker !== null
              }
            />
          )}
        </>
      )}
    </View>
  )
}

/** `EXPO_PUBLIC_QA_AUTOTAP_MS`: a non-negative integer, else ignored. */
function parseQaAutoTap(raw: string | undefined): number | undefined {
  if (raw === undefined || !/^\d+$/.test(raw)) return undefined
  return Number(raw)
}

/** `EXPO_PUBLIC_QA_ROUTE` (web `?route=`): a known route, else the first. */
function parseQaRoute(raw: string | undefined): Route {
  const known = Object.keys(ROUTE_EXITS) as Route[]
  return known.find((r) => r === raw?.trim()) ?? FIRST_ROUTE
}

export default function App() {
  const fontsReady = useAppFonts()
  // A QA step jump mounts the screens afresh on the Hub (debug only), and
  // a learner switch on that learner's Greet or Hub.
  const [shell, setShell] = useState<{ key: number; start?: Route }>({
    key: 0,
  })
  const onRemount = useCallback(
    (start: Route) => setShell((prev) => ({ key: prev.key + 1, start })),
    [],
  )
  const onQaJump = useCallback(() => onRemount('hub'), [onRemount])
  // A pick (learner profiles § 2.3): the route to the picker tore the
  // kicked session down, but a Hub prefetch survives a map visit, so the
  // return rule can reach the picker with it pending: drop it before their
  // store goes in (every way to the picker picks here). Install their
  // store, let their Hub speak, start their launch reconcile, and mount
  // afresh.
  const onPickLearner = useCallback(
    (learner: LearnerEntry) => {
      sessionPrefetcher.discard()
      const picked = activateLearner(learner.id)
      if (picked === null) return
      clearHubUnmountMark()
      void reconcileOncePerLaunch().then((result) => {
        if (getLaunchFlags().debug) {
          console.log(`[cloudSync] launch reconcile: ${result.kind}`)
        }
      })
      onRemount(nextAfterPick(picked))
    },
    [onRemount],
  )

  // The web's boot-time cloud reconcile: once per launch, from the first
  // mount, while Splash runs; nothing waits for it.
  useEffect(() => {
    void reconcileOncePerLaunch().then((result) => {
      if (getLaunchFlags().debug) {
        console.log(`[cloudSync] launch reconcile: ${result.kind}`)
      }
    })
  }, [])

  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync()
  }, [fontsReady])

  if (!fontsReady) return null
  return (
    <SafeAreaProvider>
      <Shell
        key={shell.key}
        startRoute={shell.start}
        onQaJump={onQaJump}
        onPickLearner={onPickLearner}
        onRemount={onRemount}
      />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.myCream },
})
