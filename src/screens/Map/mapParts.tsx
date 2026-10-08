/**
 * Clay map pieces (Redesign R3, ClickUp 123jpnbc690): stops on plinths,
 * bud trays, garden-arch gates, land pills, header + caption chrome.
 * Look: `design/emmas-path/redesign/real-art-check.html` (map tab),
 * quality bars 9-13 (`.claude/quality-bars.md`). Art comes from the
 * `pathArt` manifest only.
 */

import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { m } from 'motion/react'
import {
  landArtId,
  pathArtSrc,
  type PathArtId,
} from '@marian/core/emmasPath/pathArt'
import type { MasteryTrack } from '@marian/core/progress'
import { STAGE_SPOKEN_NAMES } from '@marian/core/sessionEnd/friendlyNodeName'
import type { MapStop } from '@marian/core/map/mapModel'
import type { Side } from '@marian/core/map/mapLayout'
import { INK } from '@marian/core/map/mapTheme'

const GOLD = '#ffd23f'

const LOCKED_FILTER =
  'saturate(0.2) brightness(1.12) opacity(0.62) drop-shadow(0 4px 3px rgba(60,30,10,0.12))'
const STICKER_FILTER = 'drop-shadow(0 5px 3px rgba(60,30,10,0.25))'

/** One manifest image, 256 or 512 picked by the browser for `px`. */
export function PathImg({
  id,
  px,
  style,
  testId,
}: {
  id: PathArtId
  px: number
  style?: CSSProperties
  testId?: string
}): ReactElement {
  return (
    <img
      src={pathArtSrc(id, 256)}
      srcSet={`${pathArtSrc(id, 256)} 256w, ${pathArtSrc(id, 512)} 512w`}
      sizes={`${Math.round(px)}px`}
      alt=""
      aria-hidden
      draggable={false}
      data-testid={testId}
      data-art={id}
      style={{ display: 'block', width: px, height: px, ...style }}
    />
  )
}

/** `count` sparkles flying out from the centre (spec §6 pops). */
export function SparkleBurst({
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
            style={{
              width: 10,
              height: 10,
              left: -5,
              top: -5,
              background: i % 2 ? '#ff8fb1' : GOLD,
            }}
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

/** Soft gold halo behind the current stop (and behind Emma). */
export function CurrentGlow({
  x,
  y,
  size,
  reduceMotion,
}: {
  x: number
  y: number
  size: number
  reduceMotion: boolean
}): ReactElement {
  const d = Math.round(size * 1.5)
  return (
    <m.span
      aria-hidden
      data-testid="map-current-glow"
      className="pointer-events-none absolute rounded-full"
      style={{
        left: x - d / 2,
        top: y - d / 2,
        width: d,
        height: d,
        zIndex: 1,
        background:
          'radial-gradient(circle, #fff7c2 0, #ffe066aa 42%, #ffd23f00 70%)',
        boxShadow: '0 0 0 5px #ffe27a, 0 0 30px 8px #ffd23f88',
      }}
      animate={
        reduceMotion
          ? undefined
          : {
              boxShadow: [
                '0 0 0 5px #ffe27a, 0 0 30px 8px #ffd23f88',
                '0 0 0 5px #fff0a8, 0 0 44px 14px #ffd23fbb',
                '0 0 0 5px #ffe27a, 0 0 30px 8px #ffd23f88',
              ],
            }
      }
      transition={
        reduceMotion
          ? undefined
          : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
      }
    />
  )
}

/** Hole size for a bud tray: one row of N, or one group per vowel. */
function holeSize(buds: boolean[][]): number {
  const total = buds.reduce((n, g) => n + g.length, 0)
  if (buds.length === 1 && total <= 4) return 42
  return total <= 8 ? 30 : 22
}

/** Clay seed tray under the current stop: one hole per good day needed. */
export function BudTray({
  buds,
  top,
}: {
  buds: boolean[][]
  top: number
}): ReactElement {
  const hole = holeSize(buds)
  return (
    <span
      data-testid="map-buds"
      className="absolute flex items-center"
      style={{
        top,
        left: '50%',
        transform: 'translateX(-50%)',
        gap: hole > 30 ? 4 : 10,
        padding: '4px 10px',
        borderRadius: 30,
        whiteSpace: 'nowrap',
        background: 'linear-gradient(#c58a55, #a86c3c)',
        boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.2), 0 5px 0 #7d4a26',
      }}
    >
      {buds.map((group, gi) => (
        <span key={gi} className="flex items-center" style={{ gap: 3 }}>
          {group.map((open, i) => (
            <span
              key={i}
              data-testid="map-bud"
              data-open={open ? 'true' : 'false'}
              className="relative rounded-full"
              style={{
                width: hole,
                height: hole,
                background:
                  'radial-gradient(circle at 50% 62%, #6b4128 0, #4e2c19 60%, #3d2112 100%)',
                boxShadow:
                  'inset 0 6px 8px rgba(0,0,0,0.45), 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              {open && (
                <PathImg
                  id="ui-bud-open"
                  px={hole}
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: Math.round(hole * 0.08),
                    filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))',
                  }}
                />
              )}
            </span>
          ))}
        </span>
      ))}
    </span>
  )
}

export function StopView({
  stop,
  x,
  y,
  size,
  reduceMotion,
  bloom = false,
  popping = false,
  wiggle = 0,
  onTap,
}: {
  stop: MapStop
  x: number
  y: number
  size: number
  reduceMotion: boolean
  /** Unlock beat: the just-mastered stop's flower badge blooms in. */
  bloom?: boolean
  /** Unlock beat: the padlock pops and the paleness fades off this stop. */
  popping?: boolean
  /** Bumped on every tap of a locked stop → one "not yet" wiggle. */
  wiggle?: number
  onTap: () => void
}): ReactElement {
  const locked = stop.state === 'locked'
  const sticker = Math.round(size * 0.84)
  const lock = Math.round(size * 0.46)
  return (
    <button
      type="button"
      data-testid="map-stop"
      data-node={stop.node}
      data-state={stop.state}
      aria-label={STAGE_SPOKEN_NAMES[stop.node]}
      onClick={onTap}
      className="absolute select-none touch-manipulation"
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        background: 'transparent',
        border: 0,
        padding: 0,
        zIndex: 3,
      }}
    >
      {/* Plinth: a clay disc under the sticker. */}
      <span
        aria-hidden
        data-testid="map-plinth"
        className="absolute rounded-[50%]"
        style={{
          left: '4%',
          right: '4%',
          bottom: '-6%',
          height: '42%',
          background: locked
            ? 'radial-gradient(ellipse at 45% 30%, #fffdf8 0, #f3e8d8 60%, #e2d0b6 100%)'
            : 'radial-gradient(ellipse at 45% 30%, #fffaf0 0, #efdcc0 60%, #d6b890 100%)',
          boxShadow: locked
            ? '0 6px 0 #cdb592, 0 9px 10px rgba(60,30,10,0.12)'
            : '0 7px 0 #b8946a, 0 10px 12px rgba(60,30,10,0.2)',
        }}
      />
      <m.span
        key={wiggle}
        data-testid="map-stop-sticker"
        data-nearly-there={stop.nearlyThere ? 'true' : 'false'}
        className="absolute"
        style={{
          left: (size - sticker) / 2,
          // Low enough that the sticker sits ON the plinth.
          top: Math.round(size * 0.08),
          width: sticker,
          height: sticker,
        }}
        animate={
          wiggle > 0 && !reduceMotion
            ? { rotate: [0, -7, 7, -4, 0] }
            : stop.nearlyThere && !reduceMotion
              ? { opacity: [0.6, 1, 0.6] }
              : { rotate: 0 }
        }
        transition={
          wiggle > 0 && !reduceMotion
            ? { duration: 0.5 }
            : stop.nearlyThere && !reduceMotion
              ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
              : undefined
        }
      >
        <span
          data-testid={locked ? 'map-stop-frost' : undefined}
          className="block"
          style={{ filter: locked ? LOCKED_FILTER : STICKER_FILTER }}
        >
          <PathImg id={stop.node} px={sticker} />
        </span>
        {popping && (
          <m.span
            aria-hidden
            data-testid="map-frost-fade"
            className="absolute inset-0"
            style={{ filter: LOCKED_FILTER }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <PathImg id={stop.node} px={sticker} />
          </m.span>
        )}
      </m.span>
      {locked && (
        <PathImg
          id="ui-padlock"
          px={lock}
          testId="map-stop-padlock"
          style={{
            position: 'absolute',
            right: '-8%',
            bottom: '-6%',
            filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.25))',
          }}
        />
      )}
      {popping && (
        <>
          <m.span
            aria-hidden
            data-testid="map-padlock-pop"
            className="absolute"
            style={{ right: '-8%', bottom: '-6%', width: lock, height: lock }}
            initial={{ scale: 1, opacity: 1 }}
            animate={
              reduceMotion
                ? { opacity: 0 }
                : { scale: [1, 1.35, 0], opacity: [1, 1, 0] }
            }
            transition={{ duration: reduceMotion ? 0.2 : 0.4 }}
          >
            <PathImg id="ui-padlock" px={lock} />
          </m.span>
          {!reduceMotion && (
            <SparkleBurst
              count={8}
              radius={size * 0.7}
              testId="map-pop-sparkles"
            />
          )}
        </>
      )}
      {stop.state === 'mastered' && (
        <m.span
          aria-hidden
          data-testid="map-flower-badge"
          className="absolute"
          style={{ right: '-8%', top: '-8%' }}
          initial={
            bloom ? (reduceMotion ? { opacity: 0 } : { scale: 0 }) : false
          }
          animate={reduceMotion ? { opacity: 1 } : { scale: 1 }}
          transition={{ duration: reduceMotion ? 0.2 : 0.3 }}
        >
          <PathImg
            id="ui-bloom"
            px={Math.round(size * 0.4)}
            testId={bloom ? 'map-flower-bloom' : undefined}
            style={{ filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.2))' }}
          />
        </m.span>
      )}
      {stop.state === 'current' && stop.buds.length > 0 && (
        <BudTray buds={stop.buds} top={Math.round(size * 1.02)} />
      )}
    </button>
  )
}

// ── Gate ────────────────────────────────────────────────────────────────

/**
 * Garden-arch gate. The closed arch art already carries its own padlock,
 * so nothing is overlaid on it.
 */
export function GateView({
  land,
  open,
  x,
  y,
  size,
  swinging,
  reduceMotion,
  onTap,
}: {
  land: number
  open: boolean
  x: number
  y: number
  size: number
  /** Land beat: the closed arch gives way to the open one. */
  swinging: boolean
  reduceMotion: boolean
  onTap: () => void
}): ReactElement {
  const art = Math.round(size * 1.1)
  return (
    <button
      type="button"
      data-testid="map-gate"
      data-land={land}
      data-open={open ? 'true' : 'false'}
      aria-label={`Land ${land}`}
      onClick={onTap}
      className="absolute flex select-none touch-manipulation items-center justify-center"
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        background: 'transparent',
        border: 0,
        padding: 0,
        zIndex: 3,
      }}
    >
      <PathImg
        id={open ? 'ui-arch-open' : 'ui-arch-closed'}
        px={art}
        testId="map-gate-arch"
        style={{
          flex: 'none',
          filter: 'drop-shadow(0 5px 3px rgba(60,30,10,0.25))',
        }}
      />
      {swinging && (
        <>
          <m.span
            aria-hidden
            data-testid="map-gate-swing"
            className="absolute"
            style={{ left: (size - art) / 2, top: (size - art) / 2 }}
            initial={{ opacity: 1, scale: 1 }}
            animate={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: [1, 1, 0], scale: [1, 1.12, 1.2] }
            }
            transition={{ duration: reduceMotion ? 0.2 : 0.6 }}
          >
            <PathImg id="ui-arch-closed" px={art} />
          </m.span>
          {!reduceMotion && (
            <SparkleBurst count={12} radius={64} testId="map-gate-sparkles" />
          )}
        </>
      )}
    </button>
  )
}

// ── Chrome ──────────────────────────────────────────────────────────────

/** Land pill: the land's emblem, plus its number when the parent allows. */
export function LandPill({
  world,
  land,
  side,
  top,
  showNumber,
}: {
  world: MasteryTrack
  land: number
  side: Side
  top: number
  showNumber: boolean
}): ReactElement {
  return (
    <span
      data-testid="map-land-pill"
      data-land={land}
      aria-hidden
      className="absolute flex items-center font-display font-bold"
      style={{
        [side]: 30,
        top,
        zIndex: 2,
        height: 50,
        gap: 2,
        padding: showNumber ? '0 14px 0 4px' : '0 4px',
        borderRadius: 30,
        background: 'linear-gradient(#fffaf0, #f3e3c8)',
        boxShadow: 'inset 0 3px 0 #fff, 0 5px 0 rgba(90,50,20,0.35)',
        fontSize: 28,
        color: INK,
      }}
    >
      <PathImg id={landArtId({ world, number: land })} px={46} />
      {showNumber && <span data-testid="map-land-number">{land}</span>}
    </span>
  )
}

export function HomeButton({ onTap }: { onTap: () => void }): ReactElement {
  return (
    <button
      type="button"
      data-testid="map-back"
      aria-label="Home"
      onClick={onTap}
      className="absolute grid select-none touch-manipulation place-items-center rounded-full active:translate-y-[6px]"
      style={{
        left: 24,
        top: 14,
        width: 96,
        height: 96,
        border: 0,
        padding: 0,
        background:
          'radial-gradient(circle at 40% 32%, #e7b07a 0, #c98a55 55%, #a86c3c 100%)',
        boxShadow:
          'inset 0 5px 0 rgba(255,255,255,0.3), 0 8px 0 #7d4a26, 0 12px 16px rgba(60,30,10,0.3)',
      }}
    >
      <PathImg id="ui-house" px={68} />
    </button>
  )
}

const TITLE: Record<MasteryTrack, [string, string]> = {
  math: ['Number', 'Garden'],
  'word-song': ['Word', 'Song'],
}

/** Clay-letter world title, as on the Hub cards. */
export function MapTitle({ world }: { world: MasteryTrack }): ReactElement {
  const [a, b] = TITLE[world]
  const math = world === 'math'
  return (
    <h1
      data-testid="map-title"
      className="m-0 font-display font-bold"
      style={{
        fontSize: 52,
        lineHeight: 1,
        letterSpacing: 0.5,
        color: math ? '#ffd54a' : '#ff79a8',
        textShadow: math
          ? '0 2px 0 #fff3b0, 0 5px 0 #8a5a1f, 0 6px 0 #8a5a1f, 0 10px 10px rgba(0,0,0,0.2)'
          : '0 2px 0 #ffd0e2, 0 5px 0 #8f3c5f, 0 6px 0 #8f3c5f, 0 10px 10px rgba(0,0,0,0.2)',
      }}
    >
      {a} <span style={{ color: math ? '#9ee070' : '#ffcf3d' }}>{b}</span>
    </h1>
  )
}

export function SpeakerIcon(): ReactElement {
  return (
    <svg viewBox="0 0 100 100" width={38} height={38} aria-hidden>
      <path d="M14 38 H32 L54 18 V82 L32 62 H14 Z" fill={INK} />
      <path
        d="M66 34 Q76 50 66 66 M76 24 Q92 50 76 76"
        stroke={INK}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Clay caption slab — children are the spoken line. */
export function CaptionSlab({
  children,
}: {
  children: ReactNode
}): ReactElement {
  return (
    // Landscape: the caption sits in a narrow left column and wraps; the
    // speaker keeps its size instead of shrinking beside the text.
    <span
      className="flex items-center landscape:[&>svg]:shrink-0"
      style={{ gap: 14 }}
    >
      <SpeakerIcon />
      <span>{children}</span>
    </span>
  )
}
