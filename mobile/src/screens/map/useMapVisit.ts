/**
 * The map's behaviour, without its look: the native port of the web
 * `MapScreen`'s state (`src/screens/Map/MapScreen.tsx`), over the rules it
 * shares with the web (`@marian/core/map/mapVisit`).
 *
 * - Mount: the visit is decided once from the stored progress (the final
 *   map, the unlock still to celebrate, the open line, Emma's rest pose).
 * - No beat: Emma says the open line at once ("Here is your path! You are
 *   on {name}."), its caption up from the first frame.
 * - Unlock beat (spec §6): the seen-marker is saved first (once per mount,
 *   a ref, so a re-run cannot write twice and leaving mid-beat never
 *   replays it), then bloom → hop (400 ms) → padlock pop + chime (1100) →
 *   [gate swing + cheer (1500)] → Emma cheers and says the unlock line,
 *   then rests. Taps wait until her line.
 * - Taps: a stop says its name; a locked stop poofs, wiggles, Emma points
 *   for 1.5 s and says what opens it; a gate says its land.
 * - Leave (`leave()`, Home or Android back, before the route flips): her
 *   line stops and the Hub's rapid-remount clock is stamped, so Home →
 *   Hub is quiet however long the map was open. The spec stamps it at
 *   unmount (map-native § 6), which natively is too late: the Hub reads
 *   the clock while it renders, before the map's unmount runs (the web's
 *   AnimatePresence "wait" ordered it the other way). Unmount stamps it
 *   too, and releases the map's clips and effects.
 *
 * Native-only, the Map peek (fast-track spec
 * `design/native/fast-track-native.md` § 6): a tap on a stop after the
 * current one that is not mastered (locked ones included) cuts the line in
 * flight and asks App for a peek (`peek`); stop and gate taps wait while
 * it is out, and Home aborts it. It replaces the locked response (poof,
 * wiggle, pointing, requirement line). On failure Emma says the stop's
 * name and taps resume; on success App leaves for the peek.
 *
 * Native-only, Map tap-to-play (`design/native/map-tap-to-play.md`
 * §§ 1, 2, 5): the current stop starts the Hub card's session (`play`), a
 * mastered stop a replay (`replay`). The release cuts the line in flight,
 * the sticker pops (`launching`) and the launch lock starts: every stop,
 * gate and Home tap is ignored until the route changes. `LAUNCH_DELAY_MS`
 * after the release App is asked; a replay that fails says the stop's name
 * and lifts the lock. A stop tap within `MAP_TAP_ARM_MS` of mount is
 * ignored (taps already wait for an unlock beat's cheer).
 *
 * A map that opens quiet (`quietReturn`: back from a peek, a replay or a
 * Map-started session) plays no open line and shows no caption: Emma has
 * just spoken. An unlock still to celebrate plays its beat regardless.
 *
 * Debug only (`debugLog`, `EXPO_PUBLIC_DEBUG=1`): every stop tap logs the
 * stop that took the touch, its state, the path taken and the tap point
 * (`./mapTapLog.ts`).
 *
 * Web-only parts not ported: the gesture → audio-unlock calls (native
 * audio needs no unlock, hub-native § 5).
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import type { PathLine } from '@marian/core/emmasPath/pathLines'
import { gateLine, stopLine, stopNameLine } from '@marian/core/map/mapLines'
import type { MapLand, MapStop } from '@marian/core/map/mapModel'
import { stopTapAction } from '@marian/core/map/stopTap'
import {
  LOCKED_TAP_SFX,
  mapBeatView,
  planMapVisit,
  POINTING_MS,
  UNLOCK_SFX,
  type MapBeatView,
  type MapVisit,
} from '@marian/core/map/mapVisit'
import {
  persistUnlockCelebrated,
  unlockLine,
  unlockTimeline,
  type UnlockPhase,
} from '@marian/core/map/unlockBeat'
import {
  loadProgress,
  type MasteryTrack,
  type Progress,
  type SkillNode,
} from '@marian/core/progress'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Sfx } from '../../audio'
import {
  createMapLinePlayer,
  createMapSfx,
  markMapLeft,
  type CreateMapSfx,
  type MapLinePlayer,
} from './mapAudio'
import {
  formatMapTap,
  type MapDebugLog,
  type MapTapPath,
  type MapTapPoint,
} from './mapTapLog'

/** Map tap-to-play § 2.3: the release → this long → App is asked. */
export const LAUNCH_DELAY_MS = 200

/** § 5: a stop tap within this long of the map mounting is ignored. */
export const MAP_TAP_ARM_MS = 400

export interface MapVisitOptions {
  world: MasteryTrack
  /** Test seams. */
  readProgress?: () => Progress | null
  createPlayer?: () => MapLinePlayer
  createSfx?: CreateMapSfx
  /** Saves the unlock seen-marker (default: progress storage + cloud). */
  markUnlockCelebrated?: (world: MasteryTrack) => void
  /** Stamps the Hub's rapid-remount clock on leave. */
  markLeft?: (nowMs: number) => void
  wallClock?: () => number
  /**
   * Fast-track spec § 6.1: start a peek on a later stop. Resolves `true`
   * once App has opened it, `false` on any failure; `signal` aborts when
   * the map is left. Without it a locked stop keeps the old response.
   */
  peek?: (node: SkillNode, signal: AbortSignal) => Promise<boolean>
  /**
   * Map tap-to-play § 1: the current stop's tap starts the Hub card's
   * session. Returns `true` once App has left for it. Without it the
   * current stop says its name.
   */
  play?: (node: SkillNode) => boolean
  /**
   * § 1, § 3: a mastered stop's tap starts its replay. Resolves `true`
   * once App has opened it, `false` on any failure; `signal` aborts when
   * the map unmounts. Without it a mastered stop says its name.
   */
  replay?: (node: SkillNode, signal: AbortSignal) => Promise<boolean>
  /**
   * Back from a peek, a replay or a Map-started session (fast-track § 6.4,
   * map-tap-to-play § 4): no open line, an empty caption slot.
   */
  quietReturn?: boolean
  /** Debug only: one Metro line per stop tap (`./mapTapLog.ts`). */
  debugLog?: MapDebugLog
}

export interface MapVisitState {
  visit: MapVisit
  /** The map at the current beat phase. */
  view: MapBeatView
  phase: UnlockPhase | null
  /** The line on the caption slab (null: none yet). */
  caption: PathLine | null
  pose: EmmaPose
  /** Locked-stop taps so far, per stop: one "not yet" wiggle each. */
  wiggles: Readonly<Partial<Record<string, number>>>
  /** The stop whose launch is under way (it pops), or null. */
  launching: SkillNode | null
  /** Does this stop's tap start a session (the press-in visual)? */
  launches: (stop: MapStop) => boolean
  /** The launch lock (§ 2.2): Home and Android back are ignored. */
  launchLocked: () => boolean
  /** `tap`: where the finger landed, for the debug log only. */
  tapStop: (stop: MapStop, tap?: MapTapPoint) => void
  tapGate: (land: MapLand) => void
  /** Call before leaving for the Hub. */
  leave: () => void
  /** Debug only: the Metro line logger (`./mapTapLog.ts`), or none. */
  debugLog?: MapDebugLog
}

function safeLoadProgress(): Progress | null {
  try {
    return loadProgress()
  } catch {
    return null
  }
}

export function useMapVisit({
  world,
  readProgress = safeLoadProgress,
  createPlayer = createMapLinePlayer,
  createSfx = createMapSfx,
  markUnlockCelebrated = persistUnlockCelebrated,
  markLeft = markMapLeft,
  wallClock = Date.now,
  peek,
  play,
  replay,
  quietReturn = false,
  debugLog,
}: MapVisitOptions): MapVisitState {
  const [visit] = useState(() => planMapVisit(readProgress(), world))
  const [player] = useState<MapLinePlayer>(() => createPlayer())
  const [phase, setPhase] = useState<UnlockPhase | null>(visit.phase)
  // A quiet return: no open line, so no caption either (§ 6.4).
  const [quiet] = useState(quietReturn && visit.unlock === null)
  const [caption, setCaption] = useState<PathLine | null>(
    quiet ? null : visit.caption,
  )
  const [pose, setPose] = useState<EmmaPose>(visit.restPose)
  const [wiggles, setWiggles] = useState<Partial<Record<string, number>>>({})
  const [launching, setLaunching] = useState<SkillNode | null>(null)
  const view = useMemo(() => mapBeatView(visit, phase), [visit, phase])

  const sfxRef = useRef<Sfx[]>([])
  const poofRef = useRef<Sfx | null>(null)
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const markedRef = useRef(false)
  const leftRef = useRef(false)
  /** The peek request in flight (§ 6.1); taps wait while it is set. */
  const peekRef = useRef<AbortController | null>(null)
  /** Stop taps count once the map has been up `MAP_TAP_ARM_MS` (§ 5). */
  const armedRef = useRef(false)
  /** The launch under way (§ 2.2): set from the release to the route change. */
  const launchRef = useRef<AbortController | null>(null)
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const effect = (sfx: Parameters<CreateMapSfx>[0]): Sfx => {
    const s = createSfx(sfx)
    sfxRef.current.push(s)
    return s
  }

  // The open line, or the unlock beat: once per mount.
  useEffect(() => {
    const { unlock } = visit
    if (unlock === null) {
      if (visit.caption !== null && !quiet) void player.play(visit.caption)
      return
    }
    if (!markedRef.current) {
      markedRef.current = true
      markUnlockCelebrated(world)
    }
    // Preloaded now, so the pop and the swing sound on their beat.
    const sounds: Partial<Record<UnlockPhase, Sfx>> = {}
    for (const { phase: at } of unlockTimeline(unlock)) {
      const sfx = UNLOCK_SFX[at]
      if (sfx) sounds[at] = effect(sfx)
    }
    const timers = unlockTimeline(unlock).map(({ phase: next, at }) =>
      setTimeout(() => {
        setPhase(next)
        sounds[next]?.play()
        if (next === 'cheer') {
          setPose('cheering')
          const line = unlockLine(unlock, visit.model.showLandNumber)
          setCaption(line)
          void player.play(line).then(() => {
            if (!leftRef.current) setPose(visit.restPose)
          })
        }
      }, at),
    )
    return () => timers.forEach(clearTimeout)
    // Mount-once: `visit` and `player` are fixed for the mount; the seams
    // are read at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit, player])

  // § 5: stop taps are armed `MAP_TAP_ARM_MS` after mount.
  useEffect(() => {
    const timer = setTimeout(() => {
      armedRef.current = true
    }, MAP_TAP_ARM_MS)
    return () => clearTimeout(timer)
  }, [])

  // Unmount: silence, release, and stamp the Hub's clock (map-native § 6;
  // `leave()` stamped it already on the way out through Home).
  useEffect(
    () => () => {
      leftRef.current = true
      peekRef.current?.abort()
      peekRef.current = null
      launchRef.current?.abort()
      launchRef.current = null
      if (launchTimer.current !== null) clearTimeout(launchTimer.current)
      player.unload()
      sfxRef.current.forEach((s) => s.unload())
      sfxRef.current = []
      poofRef.current = null
      if (poseTimer.current !== null) clearTimeout(poseTimer.current)
      markLeft(wallClock())
    },
    // The seams are read at unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [player],
  )

  const leave = () => {
    // Home cancels a peek request in flight (§ 6.1).
    peekRef.current?.abort()
    peekRef.current = null
    player.cancel()
    markLeft(wallClock())
  }

  const speak = (line: PathLine) => {
    setCaption(line)
    void player.play(line)
  }

  /** § 6.1: the line in flight is cut, the request goes out, taps wait. */
  const startPeek = (stop: MapStop, open: NonNullable<typeof peek>) => {
    player.cancel()
    const controller = new AbortController()
    peekRef.current = controller
    void open(stop.node, controller.signal)
      .catch(() => false)
      .then((opened) => {
        if (peekRef.current !== controller) return
        peekRef.current = null
        if (opened || leftRef.current || controller.signal.aborted) return
        // Failure: the stop's name, and taps resume.
        speak(stopNameLine(stop))
      })
  }

  /** What App does for this stop's tap, if it starts a session. */
  const launchOf = (stop: MapStop): 'play' | 'replay' | null => {
    const action = stopTapAction(view.model, stop)
    if (action === 'play' && play !== undefined) return 'play'
    if (action === 'replay' && replay !== undefined) return 'replay'
    return null
  }

  /** The launch failed or never left: the stop's name, and taps resume. */
  const failLaunch = (stop: MapStop, controller: AbortController) => {
    if (launchRef.current !== controller) return
    launchRef.current = null
    setLaunching(null)
    if (leftRef.current || controller.signal.aborted) return
    speak(stopNameLine(stop))
  }

  /**
   * Map tap-to-play § 2: the line in flight is cut, the sticker pops and
   * the launch lock starts; `LAUNCH_DELAY_MS` later App is asked. Its
   * route change unmounts the map (which keeps the lock to the end).
   */
  const startLaunch = (stop: MapStop, kind: 'play' | 'replay') => {
    player.cancel()
    const controller = new AbortController()
    launchRef.current = controller
    setLaunching(stop.node)
    launchTimer.current = setTimeout(() => {
      launchTimer.current = null
      if (leftRef.current || launchRef.current !== controller) return
      if (kind === 'play') {
        if (!play?.(stop.node)) failLaunch(stop, controller)
        return
      }
      void (replay?.(stop.node, controller.signal) ?? Promise.resolve(false))
        .catch(() => false)
        .then((opened) => {
          if (!opened) failLaunch(stop, controller)
        })
    }, LAUNCH_DELAY_MS)
  }

  /** Why a stop tap does nothing now, or null when it counts. */
  const ignoredBecause = (): MapTapPath | null => {
    if (!armedRef.current) return 'ignored(arming)'
    if (launchRef.current !== null) return 'ignored(launch-lock)'
    if (view.tapsWait) return 'ignored(beat)'
    if (peekRef.current !== null) return 'ignored(peek-out)'
    return null
  }

  const tapStop = (stop: MapStop, tap?: MapTapPoint) => {
    const ignored = ignoredBecause()
    const launch = ignored === null ? launchOf(stop) : null
    const peeks =
      ignored === null &&
      launch === null &&
      peek !== undefined &&
      stopTapAction(view.model, stop) === 'peek'
    debugLog?.(
      formatMapTap(
        stop.node,
        stop.state,
        ignored ??
          (launch === 'replay'
            ? 'replay'
            : launch === 'play'
              ? 'hub-session'
              : peeks
                ? 'peek'
                : 'name-only'),
        tap,
      ),
    )
    if (ignored !== null) return
    if (launch !== null) {
      startLaunch(stop, launch)
      return
    }
    if (peeks && peek !== undefined) {
      startPeek(stop, peek)
      return
    }
    if (stop.state === 'locked') {
      poofRef.current ??= effect(LOCKED_TAP_SFX)
      poofRef.current.play()
      setWiggles((w) => ({ ...w, [stop.node]: (w[stop.node] ?? 0) + 1 }))
      setPose('attentive-pointing')
      if (poseTimer.current !== null) clearTimeout(poseTimer.current)
      poseTimer.current = setTimeout(() => {
        poseTimer.current = null
        setPose(visit.restPose)
      }, POINTING_MS)
    }
    speak(stopLine(view.model, stop))
  }

  const tapGate = (land: MapLand) => {
    if (launchRef.current !== null) return
    if (view.tapsWait || peekRef.current !== null) return
    speak(gateLine(view.model, land))
  }

  return {
    visit,
    view,
    phase,
    caption,
    pose,
    wiggles,
    launching,
    launches: (stop) => launchOf(stop) !== null,
    launchLocked: () => launchRef.current !== null,
    tapStop,
    tapGate,
    leave,
    debugLog,
  }
}
