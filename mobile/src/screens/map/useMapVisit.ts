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
 * name and taps resume; on success App leaves for the peek. Back from a
 * peek (`returnFromPeek`) the map plays no open line and shows no caption:
 * Emma has just spoken.
 *
 * Web-only parts not ported: the gesture → audio-unlock calls (native
 * audio needs no unlock, hub-native § 5).
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import type { PathLine } from '@marian/core/emmasPath/pathLines'
import { gateLine, stopLine, stopNameLine } from '@marian/core/map/mapLines'
import type { MapLand, MapStop } from '@marian/core/map/mapModel'
import { isPeekableStop } from '@marian/core/map/peek'
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
  /** Back from a peek (§ 6.4): no open line, an empty caption slot. */
  returnFromPeek?: boolean
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
  tapStop: (stop: MapStop) => void
  tapGate: (land: MapLand) => void
  /** Call before leaving for the Hub. */
  leave: () => void
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
  returnFromPeek = false,
}: MapVisitOptions): MapVisitState {
  const [visit] = useState(() => planMapVisit(readProgress(), world))
  const [player] = useState<MapLinePlayer>(() => createPlayer())
  const [phase, setPhase] = useState<UnlockPhase | null>(visit.phase)
  // Back from a peek: no open line, so no caption either (§ 6.4).
  const [quietReturn] = useState(returnFromPeek && visit.unlock === null)
  const [caption, setCaption] = useState<PathLine | null>(
    quietReturn ? null : visit.caption,
  )
  const [pose, setPose] = useState<EmmaPose>(visit.restPose)
  const [wiggles, setWiggles] = useState<Partial<Record<string, number>>>({})
  const view = useMemo(() => mapBeatView(visit, phase), [visit, phase])

  const sfxRef = useRef<Sfx[]>([])
  const poofRef = useRef<Sfx | null>(null)
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const markedRef = useRef(false)
  const leftRef = useRef(false)
  /** The peek request in flight (§ 6.1); taps wait while it is set. */
  const peekRef = useRef<AbortController | null>(null)

  const effect = (sfx: Parameters<CreateMapSfx>[0]): Sfx => {
    const s = createSfx(sfx)
    sfxRef.current.push(s)
    return s
  }

  // The open line, or the unlock beat: once per mount.
  useEffect(() => {
    const { unlock } = visit
    if (unlock === null) {
      if (visit.caption !== null && !quietReturn)
        void player.play(visit.caption)
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

  // Unmount: silence, release, and stamp the Hub's clock (map-native § 6;
  // `leave()` stamped it already on the way out through Home).
  useEffect(
    () => () => {
      leftRef.current = true
      peekRef.current?.abort()
      peekRef.current = null
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

  const tapStop = (stop: MapStop) => {
    if (view.tapsWait || peekRef.current !== null) return
    if (peek !== undefined && isPeekableStop(view.model, stop)) {
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
    tapStop,
    tapGate,
    leave,
  }
}
