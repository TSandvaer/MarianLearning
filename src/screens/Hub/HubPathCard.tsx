/**
 * Hub card progress area — land number + hero row + all-steps bead row.
 * Replaces the 5-icon path strip. Spec: `design/emmas-path/emmas-path-spec.md`
 * §2 "Hub card" (ticket 123jpnbc3dq, Emma's Path 7/10). Data comes from
 * `buildHubCardModel` (→ `nodeProgress`).
 *
 * Not a tap target of its own: it renders inside the tree-node button,
 * so a tap anywhere on the card still starts a session (spec §2 "Beads
 * and hero are not separate tap targets").
 *
 * Sizes are CSS px taken from the spec's arithmetic (the 280pt card is
 * 373px wide; the spec's bead-row width check is against 341px usable).
 *
 * Art: the spec's 24 stop pictures (§5) are not produced yet, so the
 * hero uses the existing word pictures for the five CVC steps and the
 * old path-strip glyph for the rest. The map screen (8/10) reuses
 * `StepArt` + `Padlock` for its stops.
 */

import type { CSSProperties, ReactElement } from 'react'
import { m, useReducedMotion } from 'motion/react'
import { LITERACY_TREE, MATH_TREE, type SkillNode } from '../../lib/progress'
import type { Bead, HubCardModel } from './hubCardModel'
import { NUMBER_GARDEN_STAGES, WORD_SONG_STAGES, type StageId } from './stages'
import { StageGlyph } from './stageIcons'
import { createSfx, type Sfx } from '../../lib/sfx'

const ROSE = '#F48FB1'
const PINK_30 = 'rgba(255, 192, 203, 0.3)'
const PALE = '#FCE4EC'
const CREAM = '#FFF5F0'

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

function Bud({ open, size }: { open: boolean; size: number }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden
      data-testid="hub-card-bud"
      data-open={open ? 'true' : 'false'}
    >
      {open ? (
        <g>
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse
              key={deg}
              cx="8"
              cy="4.6"
              rx="2.6"
              ry="3.4"
              fill={ROSE}
              transform={`rotate(${deg} 8 8)`}
            />
          ))}
          <circle cx="8" cy="8" r="2.2" fill="#FFEB3B" />
        </g>
      ) : (
        <g>
          <path d="M8 15 V9" stroke="#81C784" strokeWidth="1.4" />
          <ellipse cx="8" cy="7" rx="3" ry="4" fill="#A5D6A7" />
        </g>
      )}
    </svg>
  )
}

function BloomedFlower(): ReactElement {
  return (
    <svg
      viewBox="0 0 28 28"
      width={28}
      height={28}
      aria-hidden
      data-testid="hub-card-bloom"
    >
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <ellipse
          key={deg}
          cx="14"
          cy="7"
          rx="4"
          ry="6"
          fill={ROSE}
          transform={`rotate(${deg} 14 14)`}
        />
      ))}
      <circle cx="14" cy="14" r="4" fill="#FFEB3B" />
    </svg>
  )
}

/** Pie fill for the current bead: never empties (Decision 1). */
function pieStyle(fill: number): CSSProperties {
  const deg = Math.round(fill * 360)
  return {
    background: `conic-gradient(${ROSE} 0deg ${deg}deg, ${PALE} ${deg}deg 360deg)`,
  }
}

function BeadDot({
  bead,
  fill,
  shimmer,
}: {
  bead: Bead
  fill: number
  shimmer: boolean
}): ReactElement {
  const base: CSSProperties = {
    width: 18,
    height: 18,
    borderRadius: '50%',
    boxSizing: 'border-box',
    display: 'inline-block',
  }
  let style: CSSProperties
  switch (bead.state) {
    case 'mastered':
      style = { ...base, background: ROSE }
      break
    case 'current':
      style = { ...base, border: `2px solid ${ROSE}`, ...pieStyle(fill) }
      break
    case 'open':
      style = { ...base, border: `2px solid ${ROSE}`, background: PALE }
      break
    case 'next':
      style = { ...base, border: `2px dashed ${ROSE}`, background: PALE }
      break
    case 'locked':
      style = { ...base, border: `2px solid ${PINK_30}`, opacity: 0.6 }
      break
  }
  return (
    <m.span
      data-testid="hub-card-bead"
      data-node={bead.node}
      data-state={bead.state}
      data-fill={bead.state === 'current' ? fill.toFixed(3) : undefined}
      style={style}
      initial={shimmer ? { opacity: 0.4 } : false}
      animate={shimmer ? { opacity: [0.4, 1, 0.4, 1] } : undefined}
      transition={shimmer ? { duration: 1.2, ease: 'easeInOut' } : undefined}
    />
  )
}

export interface HubPathCardProps {
  model: HubCardModel
}

export function HubPathCard({ model }: HubPathCardProps): ReactElement {
  const reduceMotion = useReducedMotion() ?? false
  return (
    <div
      data-testid="hub-card-progress"
      data-world={model.world}
      className="flex w-full flex-col items-center gap-3"
    >
      {/* Hero row — 56px tall: land number, current step, next unlock. */}
      <div
        data-testid="hub-card-hero"
        className="flex w-full items-center gap-3"
        style={{ height: 56, paddingLeft: 0 }}
      >
        {model.showLandNumber && (
          <span
            data-testid="hub-land-number"
            data-value={model.landNumber}
            aria-label={`Land ${model.landNumber}`}
            className="flex shrink-0 items-center justify-center rounded-full font-display font-bold"
            style={{
              width: 56,
              height: 56,
              background: ROSE,
              color: CREAM,
              fontSize: 34,
              lineHeight: 1,
            }}
          >
            {model.landNumber}
          </span>
        )}
        <div className="flex flex-1 items-center justify-center gap-2">
          <div className="flex flex-col items-center">
            <span
              data-testid="hub-card-current"
              data-node={model.current}
              className="flex items-center justify-center rounded-full bg-white"
              style={{
                width: 48,
                height: 48,
                boxShadow: `0 0 0 2px ${ROSE}`,
              }}
            >
              <StepArt node={model.current} size={40} />
            </span>
            {!model.complete && (
              <span
                data-testid="hub-card-buds"
                data-good-days={model.goodDays}
                data-required-days={model.requiredDays}
                className="mt-0.5 flex items-center"
                style={{ gap: 6 }}
              >
                {model.buds.map((group, gi) => (
                  <span key={gi} className="flex items-center gap-0.5">
                    {group.map((open, i) => (
                      <Bud
                        key={i}
                        open={open}
                        size={model.buds.length > 1 ? 12 : 14}
                      />
                    ))}
                  </span>
                ))}
              </span>
            )}
          </div>
          {model.unlocksNext === null ? (
            <BloomedFlower />
          ) : (
            <>
              <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden>
                <path
                  d="M1 6 H16 M12 2 L17 6 L12 10"
                  stroke={ROSE}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span
                data-testid="hub-card-next"
                data-node={model.unlocksNext}
                className="relative flex items-center justify-center"
                style={{ width: 44, height: 44 }}
              >
                {/* Spec §3.3 frost (6px blur, 55% veil) is sized for the
                    72px map stop; at 44px it erased the glyph, so it is
                    scaled down here to stay a recognisable peek. */}
                <span
                  style={{
                    filter: 'blur(1.2px) saturate(0.7)',
                    display: 'inline-flex',
                  }}
                >
                  <StepArt node={model.unlocksNext} size={40} />
                </span>
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{ background: CREAM, opacity: 0.45 }}
                />
                <span
                  aria-hidden
                  className="absolute"
                  style={{ right: -2, bottom: -2 }}
                >
                  <Padlock size={16} />
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Bead row — one bead per step, a divider between lands. */}
      <div
        data-testid="hub-card-beads"
        className="flex items-center justify-center"
      >
        {model.lands.map((land, li) => (
          <span key={land.number} className="flex items-center">
            {li > 0 && (
              <span
                aria-hidden
                data-testid="hub-card-land-divider"
                style={{
                  width: 2,
                  height: 12,
                  margin: '0 5.5px',
                  background: PINK_30,
                  borderRadius: 1,
                }}
              />
            )}
            <span
              data-testid="hub-card-land"
              data-land={land.number}
              className="flex items-center"
              style={{ gap: 5 }}
            >
              {land.beads.map((bead) => (
                <BeadDot
                  key={bead.node}
                  bead={bead}
                  fill={model.fill}
                  shimmer={bead.state === 'next' && !reduceMotion}
                />
              ))}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Map button (spec §2 "Map button", Emma's Path 8/10) ───────────────

// One plink for the app session: the tap flips the route at once, so a
// per-mount Howl unloaded with the Hub would cut the sound off.
let plinkSfx: Sfx | null = null
function playPlink(): void {
  plinkSfx ??= createSfx({ src: '/assets/sfx-plink.mp3', volume: 0.3 })
  plinkSfx.play()
}

function FoldedMap(): ReactElement {
  return (
    <svg viewBox="0 0 40 40" width={40} height={40} aria-hidden>
      <path
        d="M4 9 L14 5 L26 9 L36 5 V31 L26 35 L14 31 L4 35 Z"
        fill="#FFF9C4"
        stroke={ROSE}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 5 V31 M26 9 V35" stroke={ROSE} strokeWidth="1.5" />
      <path
        d="M8 26 Q14 18 19 22 T31 13"
        stroke="#E91E63"
        strokeWidth="1.6"
        strokeDasharray="2.5 2.5"
        fill="none"
      />
      <circle cx="31" cy="13" r="2.4" fill="#E91E63" />
    </svg>
  )
}

export interface HubMapButtonProps {
  world: HubCardModel['world']
  /** Card width — the button is a card-width pill. */
  width: string
  onOpen: () => void
  /** Fires on pointerdown, before the Hub's first-tap handler (see Hub). */
  onPress?: () => void
}

/** 64px card-width pill with a folded-map picture; tap → plink + map. */
export function HubMapButton({
  world,
  width,
  onOpen,
  onPress,
}: HubMapButtonProps): ReactElement {
  return (
    <m.button
      type="button"
      data-testid="hub-map-button"
      data-world={world}
      aria-label={world === 'math' ? 'Number Garden map' : 'Word Song map'}
      onPointerDown={onPress}
      onClick={() => {
        playPlink()
        onOpen()
      }}
      className="flex select-none touch-manipulation items-center justify-center rounded-full"
      style={{
        width,
        height: 64,
        background: CREAM,
        border: `2px solid ${ROSE}`,
      }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <FoldedMap />
    </m.button>
  )
}
