/**
 * Map screen — one per world. Emma's Path 8/10 (ClickUp 123jpnbc3dr).
 * Spec: `design/emmas-path/emmas-path-spec.md` §3 (map), §4.1–4.2 (map
 * lines), §5 (pictures), §7 (motion).
 *
 * Portrait, one screen, no scroll: header (clay Home button + world
 * title), the path region (one tinted clay band per land, land 1 at the
 * bottom, garden-arch gates between), clay caption slab. Every tap
 * speaks: a stop says its name, a locked stop says its requirement as a
 * task, a gate says its land.
 *
 * Look: clay "Toy Box" redesign, direction A (Redesign R3, ClickUp
 * 123jpnbc690; `design/emmas-path/redesign/real-art-check.html` map tab,
 * quality bars 9-13). Stickers on plinths, stepping stones, land pills
 * and arches come from the `pathArt` manifest (`mapParts.tsx`); Emma
 * stands behind the current stop.
 *
 * Audio: Lily MP3s from `pathLines.ts` via `createMapLinePlayer` (own
 * Howls, unloaded when the map leaves — the session-audio singleton is
 * never touched, so a Hub prefetch survives a map visit). Deferred lines
 * (`src: null`) show their caption and play nothing.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import type { EmmaPose } from '../../lib/character/emmaPose'
import {
  resumeHowlerContextOnGesture,
  unlockIosAudioSession,
} from '../../lib/audio'
import { drainOnGesture } from '../../lib/audio/pendingResumeGate'
import type { PathLine } from '../../lib/emmasPath/pathLines'
import {
  loadProgress,
  type MasteryTrack,
  type Progress,
} from '../../lib/progress'
import { createSfx, type Sfx } from '../../lib/sfx'
import { HUB_LAST_UNMOUNT_KEY } from '../Hub/useRapidRemountSuppression'
import { buildMapModel, type MapLand, type MapStop } from './mapModel'
import {
  BAND_INSET,
  emmaBadge,
  GATE_TAP,
  LANDSCAPE_TRAY_ROOM,
  landscapeScale,
  layoutMap,
} from './mapLayout'
import { BAND_TINTS, INK } from './mapTheme'
import { EmmaBadge } from './EmmaBadge'
import {
  CaptionSlab,
  CurrentGlow,
  GateView,
  HomeButton,
  LandPill,
  MapTitle,
  StopView,
} from './mapParts'
import { gateLine, openLine, stopLine } from './mapLines'
import { createMapLinePlayer, type MapLinePlayer } from './playMapLine'
import { pendingUnlock, type PendingUnlock } from '../../lib/progress/pathBeats'
import {
  persistUnlockCelebrated,
  reached,
  unlockLine,
  unlockTimeline,
  type UnlockPhase,
} from './unlockBeat'

const HEADER = 124
const RIBBON = 128
const POINTING_MS = 1500

export interface MapScreenProps {
  world: MasteryTrack
  /** Progress doc to render; omitted → `loadProgress()`. */
  progressDoc?: Progress | null
  /** Home button → Hub. */
  onBack: () => void
  /** Test seam: line player factory. */
  createPlayer?: () => MapLinePlayer
  /** Test seam: sfx factory. */
  createSfxFn?: typeof createSfx
  /** Test seam: save the unlock seen-marker (default: progress storage). */
  markUnlockCelebrated?: (world: MasteryTrack) => void
}

function safeLoadProgress(): Progress | null {
  try {
    return loadProgress()
  } catch {
    return null
  }
}

// ── Screen ──────────────────────────────────────────────────────────────

export function MapScreen({
  world,
  progressDoc,
  onBack,
  createPlayer,
  createSfxFn = createSfx,
  markUnlockCelebrated = persistUnlockCelebrated,
}: MapScreenProps): ReactElement {
  const reduceMotion = useReducedMotion() ?? false
  const doc = useMemo<Progress | null>(
    () => (progressDoc !== undefined ? progressDoc : safeLoadProgress()),
    [progressDoc],
  )
  const finalModel = useMemo(() => buildMapModel(doc, world), [doc, world])

  // Unlock beat (Emma's Path 9/10): an unlock not celebrated yet is
  // frozen at mount and played once; `phase` walks the spec §6 timeline.
  const [unlock] = useState<PendingUnlock | null>(() =>
    doc === null ? null : pendingUnlock(doc, world),
  )
  const [phase, setPhase] = useState<UnlockPhase | null>(
    unlock === null ? null : 'bloom',
  )
  // Before the pop the new stop still wears its frost + padlock; before
  // the swing its land's gate is still closed.
  const model = useMemo(
    () => (unlock === null ? finalModel : beatModel(finalModel, unlock, phase)),
    [finalModel, unlock, phase],
  )

  // Path-region size → layout.
  const regionRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = regionRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSize((prev) =>
        prev.w === r.width && prev.h === r.height
          ? prev
          : { w: r.width, h: r.height },
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Landscape: laid out on a taller virtual region, then scaled to fit
  // (see `landscapeScale`). Portrait: the region as it is.
  const landscape = useLandscape()
  const scale = landscape ? landscapeScale(model.lands.length, size.h) : 1
  const pathW = size.w / scale
  const pathH = landscape ? size.h / scale - LANDSCAPE_TRAY_ROOM : size.h
  const layout = useMemo(
    () => layoutMap(model, pathW, pathH),
    [model, pathW, pathH],
  )

  // Audio: one player + poof for this mount; both released on leave.
  const playerRef = useRef<MapLinePlayer | null>(null)
  const poofRef = useRef<Sfx | null>(null)
  const getPlayer = useCallback((): MapLinePlayer => {
    playerRef.current ??= createPlayer ? createPlayer() : createMapLinePlayer()
    return playerRef.current
  }, [createPlayer])

  // The open line's caption shows from the first frame; its audio
  // starts in the mount effect below. An unlock beat holds the ribbon
  // until Emma speaks its line.
  const [caption, setCaption] = useState<PathLine | null>(() =>
    unlock === null ? openLine(model) : null,
  )
  const [pose, setPose] = useState<EmmaPose>(
    model.complete ? 'cheering' : 'idle',
  )
  const sfxRef = useRef<Sfx[]>([])
  const poseTimer = useRef<number | null>(null)

  const speak = useCallback(
    (line: PathLine) => {
      setCaption(line)
      void getPlayer().play(line)
    },
    [getPlayer],
  )

  // Map opens → "Here is your path! You are on {name}." The Hub tap that
  // brought us here already unlocked the audio context.
  //
  // Unlock beat instead (spec §6): flower blooms → Emma hops → padlock
  // pops (+ gate swings on a new land) → Emma cheers and says the line.
  // The seen-marker is saved first, so leaving mid-beat never replays it.
  useEffect(() => {
    if (unlock === null) {
      if (caption !== null) void getPlayer().play(caption)
      return
    }
    markUnlockCelebrated(world)
    const sfx = (src: string, volume: number) => {
      const s = createSfxFn({ src, volume })
      sfxRef.current.push(s)
      return s
    }
    const timers = unlockTimeline(unlock).map(({ phase: next, at }) =>
      window.setTimeout(() => {
        setPhase(next)
        if (next === 'pop') sfx('/assets/sfx-chime-soft.mp3', 0.85).play()
        if (next === 'gate') sfx('/assets/sfx-cheer.mp3', 0.7).play()
        if (next === 'cheer') {
          setPose('cheering')
          const line = unlockLine(unlock, finalModel.showLandNumber)
          setCaption(line)
          void getPlayer()
            .play(line)
            .then(() => setPose(finalModel.complete ? 'cheering' : 'idle'))
        }
      }, at),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
    // Mount-once: the beat (or open line) fires once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () => () => {
      playerRef.current?.unload()
      playerRef.current = null
      poofRef.current?.unload()
      poofRef.current = null
      sfxRef.current.forEach((s) => s.unload())
      sfxRef.current = []
      if (poseTimer.current !== null) window.clearTimeout(poseTimer.current)
      // Back to the Hub counts as a rapid re-mount: no welcome-back
      // greeting replay however long the map was open (spec §3.6).
      try {
        window.sessionStorage.setItem(HUB_LAST_UNMOUNT_KEY, String(Date.now()))
      } catch {
        // Private mode — the Hub's own 30 s window still applies.
      }
    },
    [],
  )

  const gesture = () =>
    drainOnGesture(resumeHowlerContextOnGesture, unlockIosAudioSession)

  // Taps wait until the unlock beat has reached Emma's line.
  const beatRunning = phase !== null && phase !== 'cheer'

  // Locked-stop taps: one "not yet" wiggle per tap.
  const [wiggles, setWiggles] = useState<Partial<Record<string, number>>>({})

  const handleStopTap = (stop: MapStop) => {
    gesture()
    if (beatRunning) return
    if (stop.state === 'locked') {
      poofRef.current ??= createSfxFn({
        src: '/assets/sfx-poof.mp3',
        volume: 0.45,
      })
      poofRef.current.play()
      setWiggles((w) => ({ ...w, [stop.node]: (w[stop.node] ?? 0) + 1 }))
      setPose('attentive-pointing')
      if (poseTimer.current !== null) window.clearTimeout(poseTimer.current)
      poseTimer.current = window.setTimeout(() => {
        poseTimer.current = null
        setPose(model.complete ? 'cheering' : 'idle')
      }, POINTING_MS)
    }
    speak(stopLine(model, stop))
  }

  const handleGateTap = (land: MapLand) => {
    gesture()
    if (beatRunning) return
    speak(gateLine(model, land))
  }

  // Emma's badge marks the just-mastered stop until she hops (unlock beat).
  const emmaNode =
    unlock !== null && !reached(phase, 'hop') ? unlock.mastered : model.current
  const emmaStop = layout.stops.find((s) => s.node === emmaNode)
  const emmaBox = emmaStop ? emmaBadge(emmaStop) : null
  const currentStop = model.complete
    ? undefined
    : layout.stops.find((s) => s.node === model.current)
  const ready = size.w > 0 && size.h > 0

  return (
    <m.main
      data-testid="map"
      data-world={world}
      data-current={model.current}
      data-complete={model.complete ? 'true' : 'false'}
      data-beat={unlock === null ? 'none' : unlock.land ? 'land' : 'unlock'}
      data-beat-phase={phase ?? 'none'}
      // Landscape (iPad sideways in Safari, 640-900 tall): a header row
      // and a caption row leave the path too short, so the stops ran into
      // the caption. Header and caption move to a left column and the path
      // takes the full height on the right.
      className="
        relative flex h-full w-full flex-col overflow-hidden font-display
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
        landscape:grid landscape:grid-cols-[minmax(230px,24vw)_minmax(0,1fr)]
        landscape:grid-rows-[auto_minmax(0,1fr)]
      "
      style={{
        color: INK,
        background:
          'linear-gradient(#cdeeff 0, #e6f6ff 9%, #d9f0c2 14%, #cde8b0 100%)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* Header — clay Home button + world title. */}
      <header
        className="
          relative flex w-full shrink-0 items-center justify-center
          landscape:col-start-1 landscape:row-start-1 landscape:!h-auto
          landscape:pt-[124px] landscape:text-center
        "
        style={{ height: HEADER }}
      >
        <HomeButton
          onTap={() => {
            gesture()
            onBack()
          }}
        />
        <MapTitle world={world} />
      </header>

      {/* Path region — bands, stones, gates, pills, stops, Emma's badge. */}
      <div
        ref={regionRef}
        data-testid="map-path"
        className="
          relative w-full flex-1
          landscape:col-start-2 landscape:row-span-2 landscape:row-start-1
          landscape:my-2
        "
        style={{ minHeight: 0 }}
      >
        {ready && (
          <LandscapeFrame
            on={landscape}
            scale={scale}
            width={pathW}
            height={pathH}
          >
            {layout.bands.map((band, i) => {
              // A land gate opening fades its band tint in (spec §6 step 4).
              const newLand = unlock?.land?.number === band.land
              const [hi, lo] = BAND_TINTS[i % BAND_TINTS.length]!
              return (
                <m.div
                  key={band.land}
                  data-testid="map-band"
                  data-land={band.land}
                  aria-hidden
                  className="absolute"
                  style={{
                    left: BAND_INSET,
                    right: BAND_INSET,
                    top: band.top,
                    height: band.height,
                    borderRadius: 48,
                    background: `linear-gradient(${hi}, ${lo})`,
                    boxShadow: `inset 0 5px 0 rgba(255,255,255,0.4), inset 0 -8px 0 rgba(0,0,0,0.08), 0 10px 0 ${lo}, 0 18px 24px rgba(60,40,10,0.15)`,
                  }}
                  initial={false}
                  animate={{
                    opacity: newLand && !reached(phase, 'gate') ? 0.35 : 1,
                  }}
                  transition={{ duration: 0.6 }}
                />
              )
            })}

            {layout.stones.map((st, i) => (
              <span
                key={i}
                data-testid="map-stone"
                data-walked={st.walked ? 'true' : 'false'}
                aria-hidden
                className="pointer-events-none absolute rounded-[50%]"
                style={{
                  left: st.x - 19,
                  top: st.y - 10,
                  width: 38,
                  height: 20,
                  zIndex: 1,
                  background: st.walked
                    ? 'radial-gradient(ellipse at 45% 30%, #ffe3ee 0, #ff9fbf 60%, #f07aa2 100%)'
                    : 'radial-gradient(ellipse at 45% 30%, #fffaf0 0, #ead6b8 60%, #cdb08a 100%)',
                  boxShadow: st.walked ? '0 4px 0 #c9577f' : '0 4px 0 #b39268',
                }}
              />
            ))}

            {layout.pills.map((p) => (
              <LandPill
                key={p.land}
                world={world}
                land={p.land}
                side={p.side}
                top={p.top}
                showNumber={model.showLandNumber}
              />
            ))}

            {currentStop && (
              <CurrentGlow
                x={currentStop.x}
                y={currentStop.y}
                size={currentStop.size}
                reduceMotion={reduceMotion}
              />
            )}

            {emmaBox && (
              <AnimatePresence initial={false}>
                <m.div
                  // Reduced motion: the hop is a cross-fade (a new key per stop).
                  key={reduceMotion ? emmaNode : 'emma'}
                  data-testid="map-emma"
                  data-node={emmaNode}
                  data-pose={pose}
                  className="pointer-events-none absolute"
                  style={{
                    width: emmaBox.size,
                    height: emmaBox.height,
                    // Her badge sits above her stop, clear of it
                    // (mapLayout.ts). Stacked under every stop and gate all
                    // the same, so it never hides one.
                    zIndex: 2,
                  }}
                  initial={
                    reduceMotion
                      ? { opacity: 0, left: emmaBox.left, top: emmaBox.top }
                      : false
                  }
                  animate={{ opacity: 1, left: emmaBox.left, top: emmaBox.top }}
                  exit={{ opacity: 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0.2 }
                      : { type: 'spring', stiffness: 260, damping: 22 }
                  }
                >
                  <EmmaBadge
                    size={emmaBox.size}
                    height={emmaBox.height}
                    pose={pose}
                    hopping={phase === 'hop'}
                    reduceMotion={reduceMotion}
                  />
                </m.div>
              </AnimatePresence>
            )}

            {layout.gates.map((g) => {
              const land = model.lands.find((l) => l.number === g.land)!
              return (
                <GateView
                  key={g.land}
                  land={g.land}
                  open={land.open}
                  x={g.x}
                  y={g.y}
                  size={GATE_TAP}
                  swinging={unlock?.land?.number === g.land && phase === 'gate'}
                  reduceMotion={reduceMotion}
                  onTap={() => handleGateTap(land)}
                />
              )
            })}

            {model.lands.flatMap((land) =>
              land.stops.map((stop) => {
                const pos = layout.stops.find((s) => s.node === stop.node)!
                return (
                  <StopView
                    key={stop.node}
                    stop={stop}
                    x={pos.x}
                    y={pos.y}
                    size={pos.size}
                    reduceMotion={reduceMotion}
                    bloom={unlock?.mastered === stop.node}
                    popping={unlock?.unlocked === stop.node && phase === 'pop'}
                    wiggle={wiggles[stop.node] ?? 0}
                    onTap={() => handleStopTap(stop)}
                  />
                )
              }),
            )}
          </LandscapeFrame>
        )}
      </div>

      {/* Caption — a clay slab mirroring the spoken line. */}
      <div
        className="
          flex w-full shrink-0 items-center justify-center
          landscape:col-start-1 landscape:row-start-2 landscape:!h-auto
          landscape:items-end landscape:!px-3 landscape:!pb-6
        "
        style={{ height: RIBBON, padding: '0 40px' }}
      >
        {caption !== null && (
          <m.div
            key={caption.id}
            data-testid="map-ribbon"
            data-line-id={caption.id}
            data-has-audio={caption.src === null ? 'false' : 'true'}
            role="status"
            aria-live="polite"
            className="flex w-full items-center font-semibold"
            style={{
              minHeight: 80,
              padding: '12px 26px',
              borderRadius: 40,
              background: 'linear-gradient(#fffdf8, #fff1e2)',
              boxShadow:
                'inset 0 3px 0 #fff, 0 8px 0 #e3c6a6, 0 14px 22px rgba(60,30,10,0.2)',
              fontSize: 28,
              lineHeight: 1.2,
              color: INK,
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CaptionSlab>{caption.text}</CaptionSlab>
          </m.div>
        )}
      </div>
    </m.main>
  )
}

const LANDSCAPE_QUERY = '(orientation: landscape)'

/** True while the screen is wider than tall (the CSS `landscape:` rules). */
function useLandscape(): boolean {
  const [on, setOn] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(LANDSCAPE_QUERY).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(LANDSCAPE_QUERY)
    const update = () => setOn(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return on
}

/**
 * Landscape: the path drawn on its virtual region (room for the bud tray
 * below), scaled down into the real one. Portrait:
 * the path as it is, straight in the region.
 */
function LandscapeFrame({
  on,
  scale,
  width,
  height,
  children,
}: {
  on: boolean
  scale: number
  width: number
  height: number
  children: ReactNode
}): ReactElement {
  if (!on) return <>{children}</>
  return (
    <div
      data-testid="map-path-frame"
      className="absolute left-0"
      style={{
        top: 0,
        width,
        height,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
      }}
    >
      {children}
    </div>
  )
}

/**
 * The model as the unlock beat shows it at `phase`: before the pop the new
 * stop is still locked (frost + padlock, no buds); before the swing its
 * land's gate is still closed.
 */
function beatModel(
  model: ReturnType<typeof buildMapModel>,
  unlock: PendingUnlock,
  phase: UnlockPhase | null,
): ReturnType<typeof buildMapModel> {
  const stillLocked = !reached(phase, 'pop')
  const gateClosed = unlock.land !== null && !reached(phase, 'gate')
  if (!stillLocked && !gateClosed) return model
  return {
    ...model,
    lands: model.lands.map((land) => ({
      ...land,
      open:
        gateClosed && land.number === unlock.land?.number ? false : land.open,
      stops: land.stops.map((stop) =>
        stillLocked && stop.node === unlock.unlocked
          ? { ...stop, state: 'locked' as const, buds: [], nearlyThere: false }
          : stop,
      ),
    })),
  }
}

export default MapScreen
