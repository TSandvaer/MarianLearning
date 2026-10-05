/**
 * Map screen — one per world. Emma's Path 8/10 (ClickUp 123jpnbc3dr).
 * Spec: `design/emmas-path/emmas-path-spec.md` §3 (map), §4.1–4.2 (map
 * lines), §5 (pictures), §7 (motion).
 *
 * Portrait, one screen, no scroll: 88px header (Home + world emblem),
 * the path region (one band per land, land 1 at the bottom, gates
 * between), 96px caption ribbon. Every tap speaks: a stop says its name,
 * a locked stop says its requirement as a task, a gate says its land.
 *
 * Art: the spec's stop / gate pictures (§8) are not produced yet. Stops
 * reuse the Hub card's art (`StepArt`: word pictures for the CVC steps,
 * the old path-strip glyphs for the rest); gates are a drawn arch.
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
} from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { EmmaCharacter } from '../../components/EmmaCharacter'
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
import { Padlock, StepArt } from '../Hub/HubPathCard'
import { STAGE_SPOKEN_NAMES } from '../SessionEnd/friendlyNodeName'
import { HUB_LAST_UNMOUNT_KEY } from '../Hub/useRapidRemountSuppression'
import { Bud } from './Bud'
import { buildMapModel, type MapLand, type MapStop } from './mapModel'
import { layoutMap, STOP_SIZE, STOP_TAP } from './mapLayout'
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

const ROSE = '#F48FB1'
const ROSE_DEEP = '#E91E63'
const PINK_50 = 'rgba(255, 192, 203, 0.5)'
const CREAM = '#FFF5F0'
const HEADER = 88
const RIBBON = 96
const EMMA_H = 112
const POINTING_MS = 1500

const BAND_TINTS = ['#C8E6C9', '#FFE0B2', '#BBDEFB', '#E1BEE7', '#FFF9C4']

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

// ── Small pictures ──────────────────────────────────────────────────────

function FlowerBadge(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      aria-hidden
      data-testid="map-flower-badge"
    >
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <ellipse
          key={deg}
          cx="12"
          cy="6"
          rx="3.4"
          ry="5"
          fill={ROSE}
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="3.4" fill="#FFEB3B" />
    </svg>
  )
}

function HouseIcon(): ReactElement {
  return (
    <svg viewBox="0 0 40 40" width={40} height={40} aria-hidden>
      <path
        d="M5 20 L20 6 L35 20"
        stroke={ROSE_DEEP}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 18 V34 H30 V18"
        fill="#FFF9C4"
        stroke={ROSE_DEEP}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="17" y="24" width="7" height="10" rx="1.5" fill={ROSE} />
    </svg>
  )
}

function WorldEmblem({ world }: { world: MasteryTrack }): ReactElement {
  return world === 'math' ? (
    <svg
      viewBox="0 0 48 48"
      width={48}
      height={48}
      aria-hidden
      data-testid="map-emblem"
    >
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <ellipse
          key={deg}
          cx="24"
          cy="12"
          rx="6"
          ry="11"
          fill="#F48FB1"
          transform={`rotate(${deg} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="6" fill="#FFEB3B" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 48 48"
      width={48}
      height={48}
      aria-hidden
      data-testid="map-emblem"
    >
      <g fill="#9C27B0">
        <ellipse cx="14" cy="34" rx="7" ry="5.5" />
        <rect x="19" y="10" width="2.5" height="25" />
        <ellipse cx="34" cy="30" rx="7" ry="5.5" />
        <rect x="39" y="6" width="2.5" height="25" />
        <path d="M19 10 L41.5 6 V11 L19 15 Z" />
      </g>
    </svg>
  )
}

/** 64×40 garden arch; closed = frosted with a padlock (spec §3.5). */
function GateArch({ open }: { open: boolean }): ReactElement {
  return (
    <span className="relative inline-flex" style={{ width: 64, height: 40 }}>
      <svg
        viewBox="0 0 64 40"
        width={64}
        height={40}
        aria-hidden
        style={open ? undefined : { filter: 'blur(1.5px) saturate(0.7)' }}
      >
        <path
          d="M8 40 V18 A24 18 0 0 1 56 18 V40"
          fill="none"
          stroke="#81C784"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {[14, 24, 32, 40, 50].map((x, i) => (
          <circle key={x} cx={x} cy={i % 2 ? 4 : 9} r="3" fill={ROSE} />
        ))}
        {open ? (
          <>
            <path
              d="M12 38 L4 34 V22 L12 24 Z"
              fill="#FFE0B2"
              stroke="#BCAAA4"
              strokeWidth="1.5"
            />
            <path
              d="M52 38 L60 34 V22 L52 24 Z"
              fill="#FFE0B2"
              stroke="#BCAAA4"
              strokeWidth="1.5"
            />
          </>
        ) : (
          <rect
            x="12"
            y="20"
            width="40"
            height="18"
            rx="2"
            fill="#FFE0B2"
            stroke="#BCAAA4"
            strokeWidth="1.5"
          />
        )}
      </svg>
      {!open && (
        <>
          <span
            aria-hidden
            className="absolute inset-0 rounded-md"
            style={{ background: CREAM, opacity: 0.45 }}
          />
          <span aria-hidden className="absolute" style={{ left: 22, top: 18 }}>
            <Padlock size={20} />
          </span>
        </>
      )}
    </span>
  )
}

/** `count` pink sparkles flying out from the centre (spec §6 pops). */
function SparkleBurst({
  count,
  radius,
  testId,
}: {
  count: number
  radius: number
  testId: string
}): ReactElement {
  return (
    <span
      aria-hidden
      data-testid={testId}
      className="pointer-events-none absolute"
      style={{ left: '50%', top: '50%', width: 0, height: 0 }}
    >
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2
        return (
          <m.span
            key={i}
            className="absolute rounded-full"
            style={{ width: 8, height: 8, left: -4, top: -4, background: ROSE }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(a) * radius,
              y: Math.sin(a) * radius,
              opacity: 0,
              scale: 0.4,
            }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )
      })}
    </span>
  )
}

// ── Stop ────────────────────────────────────────────────────────────────

function StopView({
  stop,
  x,
  y,
  reduceMotion,
  bloom = false,
  popping = false,
  onTap,
}: {
  stop: MapStop
  x: number
  y: number
  reduceMotion: boolean
  /** Unlock beat: the just-mastered stop's flower badge blooms in. */
  bloom?: boolean
  /** Unlock beat: the padlock pops and the frost fades off this stop. */
  popping?: boolean
  onTap: () => void
}): ReactElement {
  const locked = stop.state === 'locked'
  const ring =
    stop.state === 'current'
      ? `0 0 0 3px ${ROSE}`
      : stop.state === 'open'
        ? `0 0 0 2px ${ROSE}`
        : '0 2px 6px rgba(244,143,177,0.25)'
  const budSize = stop.buds.length > 1 ? 12 : 16
  return (
    <button
      type="button"
      data-testid="map-stop"
      data-node={stop.node}
      data-state={stop.state}
      aria-label={STAGE_SPOKEN_NAMES[stop.node]}
      onClick={onTap}
      className="absolute flex select-none touch-manipulation items-center justify-center"
      style={{
        left: x - STOP_TAP / 2,
        top: y - STOP_TAP / 2,
        width: STOP_TAP,
        height: STOP_TAP,
        background: 'transparent',
        border: 0,
        padding: 0,
        zIndex: 2,
      }}
    >
      <m.span
        data-testid="map-stop-disc"
        className="relative flex items-center justify-center rounded-full bg-white"
        style={{ width: STOP_SIZE, height: STOP_SIZE, boxShadow: ring }}
        animate={
          stop.nearlyThere && !reduceMotion
            ? { opacity: [0.6, 1, 0.6] }
            : undefined
        }
        transition={
          stop.nearlyThere && !reduceMotion
            ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            : undefined
        }
        data-nearly-there={stop.nearlyThere ? 'true' : 'false'}
      >
        <span
          data-testid={locked ? 'map-stop-frost' : undefined}
          className="inline-flex"
          style={
            locked
              ? // Spec §3.3 asks 6px blur + 55% veil; on the placeholder
                // glyphs that erased the picture (same finding as the Hub
                // card's next-unlock), so the frost is lighter here to
                // stay "a peek, not a hidden box". Revisit with real art.
                { filter: 'blur(2px) saturate(0.7)', display: 'inline-flex' }
              : undefined
          }
        >
          <StepArt node={stop.node} size={56} />
        </span>
        {locked && (
          <>
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ background: CREAM, opacity: 0.45 }}
            />
            <span
              aria-hidden
              data-testid="map-stop-padlock"
              className="absolute"
              style={{ left: STOP_SIZE / 2 - 14, bottom: -10 }}
            >
              <Padlock size={28} />
            </span>
          </>
        )}
        {popping && (
          <>
            <m.span
              aria-hidden
              data-testid="map-frost-fade"
              className="absolute inset-0 rounded-full"
              style={{
                background: CREAM,
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)',
              }}
              initial={{ opacity: 0.45 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            />
            <m.span
              aria-hidden
              data-testid="map-padlock-pop"
              className="absolute"
              style={{ left: STOP_SIZE / 2 - 14, bottom: -10 }}
              initial={{ scale: 1, opacity: 1 }}
              animate={
                reduceMotion
                  ? { opacity: 0 }
                  : { scale: [1, 1.3, 0], opacity: [1, 1, 0] }
              }
              transition={{ duration: reduceMotion ? 0.2 : 0.4 }}
            >
              <Padlock size={28} />
            </m.span>
            {!reduceMotion && (
              <SparkleBurst count={6} radius={56} testId="map-pop-sparkles" />
            )}
          </>
        )}
        {stop.state === 'mastered' && (
          <m.span
            aria-hidden
            data-testid={bloom ? 'map-flower-bloom' : undefined}
            className="absolute"
            style={{ right: -6, top: -6 }}
            initial={
              bloom ? (reduceMotion ? { opacity: 0 } : { scale: 0 }) : false
            }
            animate={reduceMotion ? { opacity: 1 } : { scale: 1 }}
            transition={{ duration: reduceMotion ? 0.2 : 0.3 }}
          >
            <FlowerBadge />
          </m.span>
        )}
      </m.span>
      {stop.buds.length > 0 && (
        <span
          data-testid="map-buds"
          className="absolute flex items-center justify-center"
          style={{
            top: STOP_TAP / 2 + STOP_SIZE / 2 + 4,
            left: '50%',
            transform: 'translateX(-50%)',
            gap: 12,
            whiteSpace: 'nowrap',
          }}
        >
          {stop.buds.map((group, gi) => (
            <span
              key={gi}
              className="flex items-center"
              style={{ gap: stop.buds.length > 1 ? 2 : 6 }}
            >
              {group.map((open, i) => (
                <Bud key={i} open={open} size={budSize} />
              ))}
            </span>
          ))}
        </span>
      )}
    </button>
  )
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
  const layout = useMemo(
    () => layoutMap(model, size.w, size.h),
    [model, size.w, size.h],
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

  const handleStopTap = (stop: MapStop) => {
    gesture()
    if (beatRunning) return
    if (stop.state === 'locked') {
      poofRef.current ??= createSfxFn({
        src: '/assets/sfx-poof.mp3',
        volume: 0.45,
      })
      poofRef.current.play()
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

  // Emma stands on the just-mastered stop until she hops (unlock beat).
  const emmaNode =
    unlock !== null && !reached(phase, 'hop') ? unlock.mastered : model.current
  const currentPos = layout.stops.find((s) => s.node === emmaNode)
  const toPoints = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x},${p.y}`).join(' ')
  const ready = size.w > 0 && size.h > 0

  return (
    <m.main
      data-testid="map"
      data-world={world}
      data-current={model.current}
      data-complete={model.complete ? 'true' : 'false'}
      data-beat={unlock === null ? 'none' : unlock.land ? 'land' : 'unlock'}
      data-beat-phase={phase ?? 'none'}
      className="
        relative flex h-full w-full flex-col overflow-hidden
        bg-my-cream text-ink
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
      "
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* Header — Home (64px house) + world emblem. */}
      <header
        className="relative flex w-full shrink-0 items-center justify-center"
        style={{ height: HEADER }}
      >
        <button
          type="button"
          data-testid="map-back"
          aria-label="Home"
          onClick={() => {
            gesture()
            onBack()
          }}
          className="absolute flex select-none touch-manipulation items-center justify-center rounded-full bg-white"
          style={{
            left: 16,
            top: (HEADER - 64) / 2,
            width: 64,
            height: 64,
            border: `2px solid ${ROSE}`,
          }}
        >
          <HouseIcon />
        </button>
        <WorldEmblem world={world} />
      </header>

      {/* Path region — bands, gates, trail, stops, Emma. */}
      <div
        ref={regionRef}
        data-testid="map-path"
        className="relative w-full flex-1"
        style={{ minHeight: 0 }}
      >
        {ready && (
          <>
            {layout.bands.map((band, i) => {
              // A land gate opening fades its band tint in (spec §6 step 4).
              const newLand = unlock?.land?.number === band.land
              return (
                <m.div
                  key={band.land}
                  data-testid="map-band"
                  data-land={band.land}
                  aria-hidden
                  className="absolute left-0 right-0"
                  style={{
                    top: band.top,
                    height: band.height,
                    background: BAND_TINTS[i % BAND_TINTS.length],
                    borderRadius: 24,
                  }}
                  initial={false}
                  animate={{
                    opacity: newLand && !reached(phase, 'gate') ? 0 : 0.35,
                  }}
                  transition={{ duration: 0.6 }}
                />
              )
            })}

            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0"
              width={size.w}
              height={size.h}
              style={{ zIndex: 1 }}
            >
              <polyline
                points={toPoints(layout.trail)}
                fill="none"
                stroke={PINK_50}
                strokeWidth={10}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="1 18"
              />
              {layout.walked.length > 1 && (
                <polyline
                  data-testid="map-trail-walked"
                  points={toPoints(layout.walked)}
                  fill="none"
                  stroke={ROSE}
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>

            {model.showLandNumber &&
              layout.pebbles.map((p) => (
                <span
                  key={p.land}
                  data-testid="map-land-pebble"
                  data-land={p.land}
                  aria-hidden
                  className="absolute flex items-center justify-center rounded-full font-display font-bold"
                  style={{
                    left: p.x - 10,
                    top: p.y - 10,
                    width: 20,
                    height: 20,
                    background: ROSE,
                    color: CREAM,
                    fontSize: 13,
                    lineHeight: 1,
                  }}
                >
                  {p.land}
                </span>
              ))}

            {layout.gates.map((g) => {
              const land = model.lands.find((l) => l.number === g.land)!
              return (
                <button
                  key={g.land}
                  type="button"
                  data-testid="map-gate"
                  data-land={g.land}
                  data-open={land.open ? 'true' : 'false'}
                  aria-label={`Land ${g.land}`}
                  onClick={() => handleGateTap(land)}
                  className="absolute flex select-none touch-manipulation items-center justify-center"
                  style={{
                    left: g.x - 44,
                    top: g.y - 28,
                    width: 88,
                    height: 56,
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    zIndex: 2,
                  }}
                >
                  <GateArch open={land.open} />
                  {unlock?.land?.number === g.land && phase === 'gate' && (
                    <>
                      <m.span
                        aria-hidden
                        data-testid="map-gate-swing"
                        className="absolute"
                        style={{
                          left: 12 + 12,
                          top: 20 + 8,
                          width: 40,
                          height: 18,
                          background: '#FFE0B2',
                          border: '1.5px solid #BCAAA4',
                          borderRadius: 2,
                          transformOrigin: 'left center',
                          transformPerspective: 200,
                        }}
                        initial={{ rotateY: 0, opacity: 1 }}
                        animate={
                          reduceMotion
                            ? { opacity: 0 }
                            : { rotateY: -70, opacity: [1, 1, 0] }
                        }
                        transition={{ duration: reduceMotion ? 0.2 : 0.6 }}
                      />
                      {!reduceMotion && (
                        <SparkleBurst
                          count={12}
                          radius={64}
                          testId="map-gate-sparkles"
                        />
                      )}
                    </>
                  )}
                </button>
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
                    reduceMotion={reduceMotion}
                    bloom={unlock?.mastered === stop.node}
                    popping={unlock?.unlocked === stop.node && phase === 'pop'}
                    onTap={() => handleStopTap(stop)}
                  />
                )
              }),
            )}

            {currentPos && (
              <AnimatePresence initial={false}>
                <m.div
                  // Reduced motion: the hop is a cross-fade (a new key per stop).
                  key={reduceMotion ? emmaNode : 'emma'}
                  data-testid="map-emma"
                  data-node={emmaNode}
                  data-pose={pose}
                  className="pointer-events-none absolute"
                  style={{
                    width: 120,
                    height: EMMA_H,
                    zIndex: 3,
                    // One grid cell: the pose cross-fade keeps the old and
                    // new image mounted together; stacked, not side by side.
                    display: 'grid',
                    justifyItems: 'center',
                  }}
                  initial={
                    reduceMotion
                      ? {
                          opacity: 0,
                          left: currentPos.x - 60,
                          top: currentPos.y - STOP_SIZE / 2 - EMMA_H + 6,
                        }
                      : false
                  }
                  animate={{
                    opacity: 1,
                    left: currentPos.x - 60,
                    top: currentPos.y - STOP_SIZE / 2 - EMMA_H + 6,
                  }}
                  exit={{ opacity: 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0.2 }
                      : { type: 'spring', stiffness: 260, damping: 22 }
                  }
                >
                  {/* Two small arcs while she hops (spec §6, 700 ms). */}
                  <m.div
                    style={{ gridArea: '1 / 1', height: '100%' }}
                    animate={
                      phase === 'hop' && !reduceMotion
                        ? { y: [0, -28, 0, -18, 0] }
                        : { y: 0 }
                    }
                    transition={{ duration: 0.7, ease: 'easeInOut' }}
                  >
                    <EmmaCharacter
                      pose={pose}
                      data-testid="map-emma-character"
                      className="h-full w-auto select-none"
                      style={{ gridArea: '1 / 1' }}
                    />
                  </m.div>
                </m.div>
              </AnimatePresence>
            )}
          </>
        )}
      </div>

      {/* Caption ribbon — mirrors the spoken line. */}
      <div
        className="flex w-full shrink-0 items-center justify-center px-6"
        style={{ height: RIBBON }}
      >
        {caption !== null && (
          <m.div
            key={caption.id}
            data-testid="map-ribbon"
            data-line-id={caption.id}
            data-has-audio={caption.src === null ? 'false' : 'true'}
            role="status"
            aria-live="polite"
            className="rounded-3xl border-[3px] border-my-pink bg-white px-6 py-2 text-center font-display text-2xl text-ink shadow-[0_8px_24px_rgba(244,143,177,0.18)]"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {caption.text}
          </m.div>
        )}
      </div>
    </m.main>
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
