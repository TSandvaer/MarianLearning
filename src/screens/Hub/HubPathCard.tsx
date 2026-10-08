/**
 * Hub world card in clay — Redesign R2 (ClickUp 123jpnbc68z), direction A
 * "Toy Box". Reference: `design/emmas-path/redesign/real-art-check.html`
 * (Hub tab) + `concepts/direction-a-hub.png`; quality bars 9-13.
 *
 * One sculpted slab per world: crown + clay title, the current step as a
 * big glowing clay sticker on a plinth, the next step as a small padlocked
 * sticker, the land pill, a tray of flower slots (one per required good
 * day: grown / sleeping / empty, Guidance G1), and a round wooden map
 * button. No bead row: the all-steps overview
 * lives on the map (bar 9). Data comes from `buildHubCardModel`
 * (→ `nodeProgress`); art from the `pathArt` manifest.
 *
 * The whole slab is the start target (role="button"); the map button is
 * the only other target inside it and never starts a session.
 *
 * `StepArt` + `Padlock` stay exported for the map and session-end screens
 * (they move to clay art in R3 / R4).
 */

import {
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
} from 'react'
import { LITERACY_TREE, MATH_TREE, type SkillNode } from '@marian/core/progress'
import { pathArtSrc } from '@marian/core/emmasPath/pathArt'
import type { SkillTreeId } from '@marian/core/sessionEnd/sessionHistory'
import type { HubCardModel } from '@marian/core/hub/hubCardModel'
import {
  NUMBER_GARDEN_STAGES,
  WORD_SONG_STAGES,
  type StageId,
} from '@marian/core/hub/stages'
import { StageGlyph } from './stageIcons'
import { createSfx, type Sfx } from '../../lib/sfx'
import './hubClay.css'

const ROSE = '#F48FB1'

const CVC_PICTURES: Partial<Record<SkillNode, string>> = {
  'cvc-words': 'cat',
  'cvc-words-short-o': 'dog',
  'cvc-words-short-u': 'sun',
  'cvc-words-short-i': 'pig',
  'cvc-words-short-e': 'bed',
}

function stageIdOf(node: SkillNode): StageId {
  const mi = MATH_TREE.indexOf(node as (typeof MATH_TREE)[number])
  if (mi >= 0) return NUMBER_GARDEN_STAGES[mi]!
  const wi = LITERACY_TREE.indexOf(node as (typeof LITERACY_TREE)[number])
  return WORD_SONG_STAGES[wi]!
}

export function StepArt({
  node,
  size,
}: {
  node: SkillNode
  size: number
}): ReactElement {
  const picture = CVC_PICTURES[node]
  if (picture !== undefined) {
    return (
      <img
        src={`/assets/pictures/picture-${picture}.svg`}
        alt=""
        width={size}
        height={size}
        draggable={false}
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    )
  }
  return (
    <span style={{ color: '#E91E63' }}>
      <StageGlyph stage={stageIdOf(node)} size={size} />
    </span>
  )
}

export function Padlock({ size }: { size: number }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <rect x="5" y="10" width="14" height="11" rx="2.5" fill={ROSE} />
      <path
        d="M8 10 V7.5 a4 4 0 0 1 8 0 V10"
        stroke={ROSE}
        strokeWidth="2.4"
        fill="none"
      />
    </svg>
  )
}

// ── Clay world card ───────────────────────────────────────────────────

/** A length in reference px (820-wide stage), scaled by `--u`. */
const u = (px: number): string => `calc(var(--u) * ${px})`

// One plink for the app session: the tap flips the route at once, so a
// per-mount Howl unloaded with the Hub would cut the sound off.
let plinkSfx: Sfx | null = null
function playPlink(): void {
  plinkSfx ??= createSfx({ src: '/assets/sfx-plink.mp3', volume: 0.3 })
  plinkSfx.play()
}

function Spark({
  left,
  top,
  delay,
}: {
  left: number
  top: number
  delay: number
}): ReactElement {
  return (
    <svg
      className="hub-spark"
      style={{ left: u(left), top: u(top), animationDelay: `${delay}s` }}
      viewBox="0 0 100 100"
      aria-hidden
    >
      <path
        d="M50 0 L60 40 L100 50 L60 60 L50 100 L40 60 L0 50 L40 40 Z"
        fill="#fff6b0"
      />
    </svg>
  )
}

const TITLES: Record<SkillTreeId, [string, string]> = {
  'number-garden': ['Number', 'Garden'],
  'word-song': ['Word', 'Song'],
}

export interface HubWorldCardProps {
  tree: SkillTreeId
  label: string
  model: HubCardModel
  suggested: boolean
  onTap: () => void
  /**
   * Fires on `pointerdown`, before the event bubbles to the Hub's
   * first-tap handler (see Hub `handleNodePress`).
   */
  onPress?: () => void
  /** Map button inside the card; omitted → no map button. */
  onOpenMap?: () => void
  /** Slot indexes whose flower wakes (bud opens) on this visit. */
  wakeSlots?: readonly number[]
}

/** Moon for a sleeping flower (mockup `MOON`). */
function Moon(): ReactElement {
  return (
    <svg className="hub-moon" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id="hub-moon-fill" cx="35%" cy="30%">
          <stop offset="0" stopColor="#fffbd6" />
          <stop offset=".7" stopColor="#ffe27a" />
          <stop offset="1" stopColor="#f0b72a" />
        </radialGradient>
      </defs>
      <path
        d="M62 8 A44 44 0 1 0 92 70 A36 36 0 1 1 62 8 Z"
        fill="url(#hub-moon-fill)"
        stroke="#d99a1a"
        strokeWidth="3"
      />
    </svg>
  )
}

export function HubWorldCard({
  tree,
  label,
  model,
  suggested,
  onTap,
  onPress,
  onOpenMap,
  wakeSlots = [],
}: HubWorldCardProps): ReactElement {
  const [down, setDown] = useState(false)
  const [title1, title2] = TITLES[tree]
  const mapLabel =
    model.world === 'math' ? 'Number Garden map' : 'Word Song map'

  const onMapButton = (target: EventTarget): boolean =>
    target instanceof Element &&
    target.closest('[data-testid="hub-map-button"]') !== null

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    onPress?.()
    if (!onMapButton(e.target)) setDown(true)
  }
  const release = () => setDown(false)
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onTap()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      data-testid="hub-tree-node"
      data-tree={tree}
      data-suggested={suggested ? 'true' : 'false'}
      className={[
        'hub-card',
        tree === 'number-garden' ? 'hub-card--math' : 'hub-card--word',
        down ? 'is-down' : '',
      ].join(' ')}
      onPointerDown={handlePointerDown}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onClick={(e) => {
        if (onMapButton(e.target)) return
        onTap()
      }}
      onKeyDown={handleKeyDown}
    >
      {/* The face carries the slab and everything on it, and is what bobs
          when the card is suggested; the card's own box never moves. */}
      <div className="hub-card-face">
        <div className="hub-crown" aria-hidden />
        <div className="hub-title" aria-hidden data-testid="hub-tree-label">
          {title1}
          <br />
          <span className="hub-title-2">{title2}</span>
        </div>

        <div
          data-testid="hub-card-progress"
          data-world={model.world}
          aria-hidden
        >
          <div
            className="hub-plinth"
            style={{ left: u(50), top: u(380), width: u(208), height: u(64) }}
          />
          <div
            className="hub-glow"
            style={{ left: u(36), top: u(170), width: u(236), height: u(236) }}
          />
          <img
            className="hub-sticker"
            data-testid="hub-card-current"
            data-node={model.current}
            src={pathArtSrc(model.current, 512)}
            alt=""
            draggable={false}
            style={{ left: u(46), top: u(180), width: u(216), height: u(216) }}
          />
          <Spark left={52} top={196} delay={0} />
          <Spark left={236} top={360} delay={0.7} />

          <div
            className="hub-next"
            data-testid={
              model.unlocksNext === null ? 'hub-card-bloom' : 'hub-card-next'
            }
            data-node={model.unlocksNext ?? undefined}
          >
            <div
              className="hub-plinth"
              style={{
                left: u(262),
                top: u(388),
                width: u(104),
                height: u(34),
              }}
            />
            <img
              className="hub-sticker"
              src={pathArtSrc(model.unlocksNext ?? 'ui-bloom', 256)}
              alt=""
              draggable={false}
              style={{
                left: u(258),
                top: u(290),
                width: u(112),
                height: u(112),
              }}
            />
            {model.unlocksNext !== null && (
              <img
                className="hub-lock"
                data-testid="hub-card-lock"
                src={pathArtSrc('ui-padlock', 256)}
                alt=""
                draggable={false}
                style={{
                  left: u(318),
                  top: u(350),
                  width: u(52),
                  height: u(52),
                }}
              />
            )}
          </div>

          {model.showLandNumber && (
            <div
              className="hub-landpill"
              data-testid="hub-land-number"
              data-value={model.landNumber}
            >
              <img
                src={pathArtSrc(model.landArt, 256)}
                alt=""
                draggable={false}
              />
              {model.landNumber}
            </div>
          )}

          <div
            className="hub-tray"
            data-testid="hub-card-seeds"
            data-good-days={model.slots.filter((s) => s !== 'empty').length}
            data-required-days={model.slots.length}
          >
            {model.slots.map((slot, i) => {
              const waking = slot === 'grown' && wakeSlots.includes(i)
              return (
                <div
                  key={i}
                  className={[
                    'hub-hole',
                    slot === 'sleeping' ? 'is-sleeping' : '',
                    waking ? 'is-waking' : '',
                  ].join(' ')}
                  data-testid="hub-card-seed"
                  data-filled={slot === 'empty' ? 'false' : 'true'}
                  data-state={slot}
                  data-waking={waking ? 'true' : undefined}
                >
                  {slot !== 'empty' && (
                    <img
                      src={pathArtSrc(
                        slot === 'sleeping' ? 'ui-bud-closed' : 'ui-bud-open',
                        256,
                      )}
                      alt=""
                      draggable={false}
                    />
                  )}
                  {slot === 'sleeping' && (
                    <>
                      <Moon />
                      <span className="hub-zz">z</span>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {onOpenMap && (
          <button
            type="button"
            className="hub-mapbtn"
            data-testid="hub-map-button"
            data-world={model.world}
            aria-label={mapLabel}
            onClick={() => {
              playPlink()
              onOpenMap()
            }}
          >
            <img src={pathArtSrc('ui-map', 256)} alt="" draggable={false} />
          </button>
        )}
      </div>
    </div>
  )
}
