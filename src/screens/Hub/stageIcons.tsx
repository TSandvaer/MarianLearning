/**
 * Stage-icon placeholders for the path-strip inside each skill-tree node.
 *
 * Source-of-truth: `design/screen-hub.md` § "Skill-tree picker — node
 * design" → "Icon states" + "Stage path — Dave-grounded design".
 *
 * Tree-themed art (Q9=B, Thomas-locked) — Kyle owns the final SVGs in
 * ticket `86c9j53yx`. Until they land, this module emits simple inline
 * shapes that match the spec's 28pt visible / 44pt hit-zone footprint.
 * Each icon is text-free per the spec ("rely on Melody's TTS to name
 * each step; reading-emergent age means text labels are invisible").
 *
 * v2-deferred locked-state visual is sketched defensively but never
 * rendered today (no v1 node ships locked).
 *
 * Stage taxonomy + sliding-window helper live in `./stages.ts` so this
 * .tsx file exports only React components (Fast Refresh hygiene).
 */

import type { ReactElement } from 'react'
import type { StageId } from './stages'

export type { StageId } from './stages'

export type StageIconKind = 'mastered' | 'current' | 'in-progress' | 'locked'

export interface StageIconProps {
  /** Which stage's signature mini-glyph to render. */
  stage: StageId
  /** Visual state. */
  kind: StageIconKind
  /**
   * Single shimmer cycle on Hub mount when `kind === 'current'`. The
   * spec calls for opacity 0.85 → 1 → 0.85 over 800ms then settled.
   * Implemented at the consumer's motion layer; this prop just toggles
   * a `data-shimmering` attr the parent can hook.
   */
  shimmering?: boolean
}

/**
 * Render a stage icon. v1 placeholder shapes — Kyle's tree-themed SVGs
 * land via ticket `86c9j53yx`.
 *
 * The visible glyph is 28pt; the parent wraps in a 44pt hit-zone slot
 * (the path-strip is informative-only — taps are no-op — so the
 * "hit zone" is technically just for accessibility tree).
 */
export function StageIcon({
  stage,
  kind,
  shimmering,
}: StageIconProps): ReactElement {
  const colour = kind === 'locked' ? '#F8BBD0' : '#E91E63'
  const opacity = kind === 'locked' ? 0.5 : 1
  const ariaLabel = stageAriaLabel(stage, kind)

  return (
    <span
      data-testid="hub-stage-icon"
      data-stage={stage}
      data-kind={kind}
      data-shimmering={shimmering ? 'true' : 'false'}
      role="img"
      aria-label={ariaLabel}
      className="inline-flex h-7 w-7 items-center justify-center"
      style={{ color: colour, opacity }}
    >
      {kind === 'mastered' && <CheckGlyph />}
      {kind === 'locked' && <PadlockGlyph />}
      {kind === 'in-progress' && <StageGlyph stage={stage} dim />}
      {kind === 'current' && <StageGlyph stage={stage} />}
    </span>
  )
}

// ── Glyph SVGs (placeholders — Kyle's tree-themed assets land via
//    ticket 86c9j53yx) ──

function CheckGlyph(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12 L10 17 L19 7" />
    </svg>
  )
}

function PadlockGlyph(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden
    >
      <rect x="6" y="11" width="12" height="9" rx="2" />
      <path
        d="M8 11 V8 a4 4 0 0 1 8 0 v3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  )
}

interface StageGlyphProps {
  stage: StageId
  dim?: boolean
}

/**
 * Per-stage signature mini-glyph. v1 uses simple labels (`+`, `−`,
 * `×`, `Aa`, `Ca`, `Cat`) per the spec's "Stage icon authoring —
 * generic vs tree-themed" Q9. Thomas locked Q9=B (tree-themed), but
 * v1 ships placeholders until Kyle delivers the SVGs.
 */
function StageGlyph({ stage, dim }: StageGlyphProps): ReactElement {
  const opacity = dim ? 0.65 : 1
  const text = STAGE_LABEL[stage] ?? '•'
  return (
    <svg viewBox="0 0 28 28" width="22" height="22" aria-hidden>
      <text
        x="14"
        y="20"
        textAnchor="middle"
        fontFamily="serif"
        fontSize="16"
        fontWeight="700"
        fill="currentColor"
        opacity={opacity}
      >
        {text}
      </text>
    </svg>
  )
}

const STAGE_LABEL: Record<StageId, string> = {
  // Number Garden
  'number-recog': '7',
  'add-to-10': '+',
  'add-to-20': '+',
  'subtract-to-10': '−',
  'subtract-to-20': '−',
  'two-digit': '±',
  'skip-counting': '…',
  'multiply-2-5-10': '×',
  'multiply-3-4': '×',
  'multiply-6-9': '×',
  // Word Song
  'letter-names': 'A',
  'letter-sounds': 'a',
  'blending-cv': 'ca',
  'cvc-words': 'cat',
  'cvc-words-short-o': 'dog',
  'cvc-words-short-u': 'sun',
  'cvc-words-short-i': 'pig',
  'cvc-words-short-e': 'bed',
  digraphs: 'sh',
  'sight-words': 'the',
  'simple-sentences': 'I',
}

function stageAriaLabel(stage: StageId, kind: StageIconKind): string {
  const label = STAGE_LABEL[stage] ?? stage
  switch (kind) {
    case 'mastered':
      return `${label} — mastered`
    case 'current':
      return `${label} — next up`
    case 'in-progress':
      return `${label} — in progress`
    case 'locked':
      return `${label} — locked`
  }
}
