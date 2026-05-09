/**
 * Picture renderer for the Word Song picture pack.
 *
 * Two rendering patterns coexist
 * ------------------------------
 * - **External SVG via `<image href>`** for entries whose real
 *   illustrations have been traced from Thomas's Midjourney PNGs and
 *   land in `public/assets/pictures/picture-{key}.svg`. As of ticket
 *   86c9p96zk (Phase 3 short-a + distractor pack) this is the
 *   default — 22 short-a + distractor-only entries plus the 4
 *   short-o entries from PR #156 (`mop, box, mom, hot`).
 * - **Inline-SVG placeholders** retained only for the 4 novel-pool
 *   probe words (`nap, rat, map, tap`) which still wait on a Kyle
 *   ticket for their own Midjourney → SVG illustrations.
 *
 * The wrapper-preserving choice (an `<image>` inside the existing
 * `<svg viewBox="0 0 96 96">` envelope) keeps the test contract
 * stable: tests query `svg[data-testid="word-picture"]` directly with
 * `role="img"`, `aria-label`, `data-large`, `data-picture-key`
 * attributes — only the inner body changes between an inline `case`
 * and an `<image href>`. This is the canonical pattern set in PR
 * #156 (commit `b0a5dc3`); the same convention is reused across the
 * Phase 3 short-a pack here.
 *
 * The Vite PWA `globPatterns` already covers `svg`, so new picture
 * assets are auto-precached by the service worker without config
 * changes.
 *
 * Forbidden-pair compatibility
 * ----------------------------
 * Per `wordPack.FORBIDDEN_PAIRS` and Kyle's silhouette-distinctness
 * constraint, certain pairs (cat/dog, cap/hat, man/dad, mom/dad,
 * pan/pot, bus/van) must not appear in the same trio. The distractor
 * matrix enforces that; the renderer's job is to make the picture
 * *recognisable* (cat as a cat, not just a generic furry creature).
 */

import type { ReactNode } from 'react'

interface PictureProps {
  /** Picture-pack key (per `wordPack.WordEntry.pictureKey`). */
  pictureKey: string
  /** True if this is the BIG picture above the word-card letters (180pt).
   *  False (default) renders the chip-sized version (~96pt). */
  large?: boolean
  /** Optional accessible label override. Defaults to the pictureKey. */
  ariaLabel?: string
}

/**
 * Render a picture for the given key. Returns an SVG element sized to
 * fit its container — the chip wrapper sets the box; the SVG fills
 * with `width: 100%; height: 100%`.
 *
 * Falls back to a generic "object" silhouette + the word in small
 * text if the key is unknown (defensive — should not happen with the
 * curated pack but kept so an unknown key doesn't crash the screen).
 */
export function WordPicture({
  pictureKey,
  large = false,
  ariaLabel,
}: PictureProps) {
  // Size hint via inline style — caller sets the wrapper size.
  const style = { width: '100%', height: '100%' }
  const label = ariaLabel ?? pictureKey
  const inner = renderPictureBody(pictureKey)

  return (
    <svg
      data-testid="word-picture"
      data-picture-key={pictureKey}
      data-large={large ? 'true' : 'false'}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 96 96"
      preserveAspectRatio="xMidYMid meet"
      style={style}
    >
      {inner ?? renderUnknownPicture(pictureKey)}
    </svg>
  )
}

/**
 * Picture body switch. Each branch renders the inner SVG primitives
 * for one picture key — caller wraps in the `<svg viewBox="0 0 96 96">`.
 * Returns `null` for unknown keys; caller falls back to the generic
 * unknown picture.
 */
function renderPictureBody(key: string): ReactNode {
  // Palette tokens — only used by the legacy inline novel-pool probe
  // silhouettes below. The Phase 3 real SVGs ship their own palette
  // baked into the `<image href>` files.
  const ROSE = '#FFB7C5'
  const CREAM = '#FFF5F0'
  const INK = '#3B3B3B'
  const SPARKLE = '#FFD966'
  const STROKE = '#9C5A6F' // a slightly darker rose for outlines

  switch (key) {
    // ── Short-a + distractor + short-o real SVG artwork ─────────────
    // 14 short-a target words (`cat, hat, bat, mat, bag, fan, man,
    // pan, cap, can, tag, dad, jam, van`), 4 distractor-only entries
    // (`bus, sun, cup, pen`), and the 4 promoted-from-distractor
    // short-o entries (`dog, fox, log, pot`) all consume real SVG
    // artwork hand-traced from Thomas's Phase 2 Midjourney PNGs.
    // Source files live at `public/assets/pictures/picture-{key}.svg`.
    //
    // Provenance:
    //   - `mop, box, mom, hot` shipped in PR #156 (ticket 86c9p4uw3,
    //     short-o Phase 3).
    //   - `cat, hat, bat, mat, bag, fan, man, pan, cap, can, tag,
    //     dad, jam, van, bus, sun, dog, fox, cup, pen, log, pot`
    //     ship in this PR (ticket 86c9p96zk, short-a Phase 3).
    //   - `dog` consumes the new `picture-dog.svg` per the canonical
    //     convention; the legacy `pic-dog.svg` (which predated the
    //     convention) is removed in this PR (closes ticket
    //     86c9p5epc).
    //
    // Distinctness gates per the Phase 1 spec §1.x + §2.x are
    // preserved by each asset's authoring (see header comments
    // inside each SVG file).
    case 'cat':
    case 'hat':
    case 'bat':
    case 'mat':
    case 'bag':
    case 'fan':
    case 'man':
    case 'pan':
    case 'cap':
    case 'can':
    case 'tag':
    case 'dad':
    case 'jam':
    case 'van':
    case 'bus':
    case 'sun':
    case 'dog':
    case 'fox':
    case 'cup':
    case 'pen':
    case 'log':
    case 'pot':
    case 'mop':
    case 'box':
    case 'mom':
    case 'hot':
    case 'bug':
    case 'nut':
    case 'tub':
    case 'bun':
    case 'jug':
    case 'rug':
    case 'hut':
    case 'gum':
      // Short-u pack additions (ticket 86c9q5q2d / 86c9q9ben). 8
      // wholly-new (`bug, nut, tub, bun, jug, rug, hut, gum`) plus
      // 3 retraces of existing distractor pictures (`sun, cup, bus`
      // — already in the case list above; their SVG files were
      // overwritten in PR #170 / commit ba08b69 with the new
      // short-u tier traces). PNG-in-SVG embed per
      // `.claude/docs/skill-trees-and-content.md` §"Rendering pattern
      // post-PR #157" + spec §3 Path 2.
      // External SVG — rendered as <image> inside the wrapper <svg>
      // so the WordPicture outer envelope (data-testid, role,
      // aria-label, data-large, data-picture-key) stays identical to
      // the inline silhouettes. The 0..96 viewBox matches the source
      // SVGs' 0..200 design — preserveAspectRatio keeps each picture
      // centred at any chip / large size.
      return (
        <image
          href={`/assets/pictures/picture-${key}.svg`}
          x="0"
          y="0"
          width="96"
          height="96"
          preserveAspectRatio="xMidYMid meet"
        />
      )

    // ── Novel-pool probe silhouettes (ticket 86c9m3aec) ─────────────
    // Placeholder silhouettes for the 4 novel short-a probe words
    // used on the cvc-words graduation session. Per the ticket's
    // recommended path: ship silhouettes now, file a follow-up Kyle
    // ticket for real Midjourney → SVG illustrations. Each silhouette
    // is visually distinct from every existing pack entry per the
    // forbidden-pair audit; they pair via TARGET_PAIRINGS in
    // wordPack.ts with existing distractor / canonical chips.

    case 'nap':
      // Sleeping moon-and-pillow — crescent moon over a pillow.
      // Distinct from existing pack entries (no other crescent / no
      // other pillow shape).
      return (
        <g>
          {/* Pillow */}
          <rect
            x="18"
            y="54"
            width="60"
            height="22"
            rx="6"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Pillow centre tuft */}
          <line
            x1="48"
            y1="58"
            x2="48"
            y2="72"
            stroke={STROKE}
            strokeWidth="1"
          />
          {/* Crescent moon — outer arc + inner notch */}
          <path
            d="M 60 28 A 14 14 0 1 0 60 50 A 11 11 0 1 1 60 28 Z"
            fill={SPARKLE}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Sparkle dots near moon */}
          <circle cx="32" cy="20" r="1.5" fill={INK} />
          <circle cx="76" cy="22" r="1.5" fill={INK} />
          <circle cx="36" cy="38" r="1" fill={INK} />
        </g>
      )

    case 'rat':
      // Side-profile rodent — pointed nose, long tail. Distinct from
      // cat/bat/fox by the long thin tail + pointed snout.
      return (
        <g>
          {/* Body */}
          <ellipse
            cx="46"
            cy="58"
            rx="22"
            ry="14"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Head — pointed snout */}
          <polygon
            points="22,58 12,54 14,62"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Round ears */}
          <circle
            cx="36"
            cy="46"
            r="5"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          <circle
            cx="46"
            cy="44"
            r="5"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Eye */}
          <circle cx="20" cy="56" r="1.5" fill={INK} />
          {/* Long thin tail — the discriminator */}
          <path
            d="M 68 58 Q 82 52 86 64 Q 88 74 78 78"
            fill="none"
            stroke={STROKE}
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Feet */}
          <line x1="38" y1="72" x2="38" y2="78" stroke={INK} strokeWidth="2" />
          <line x1="54" y1="72" x2="54" y2="78" stroke={INK} strokeWidth="2" />
        </g>
      )

    case 'map':
      // Folded paper map — rectangle with grid lines + a compass-rose
      // star mark + a destination pin. Distinct from mat (rectangle,
      // no grid) and bag (rounded with handle).
      return (
        <g>
          {/* Map sheet */}
          <rect
            x="14"
            y="22"
            width="68"
            height="52"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Grid / fold lines */}
          <line
            x1="36"
            y1="22"
            x2="36"
            y2="74"
            stroke={STROKE}
            strokeWidth="1"
          />
          <line
            x1="60"
            y1="22"
            x2="60"
            y2="74"
            stroke={STROKE}
            strokeWidth="1"
          />
          <line
            x1="14"
            y1="48"
            x2="82"
            y2="48"
            stroke={STROKE}
            strokeWidth="1"
          />
          {/* Land mass blob */}
          <path
            d="M 26 36 Q 38 30 50 38 Q 60 44 54 56 Q 42 62 32 56 Q 22 50 26 36 Z"
            fill={ROSE}
            opacity="0.6"
            stroke={STROKE}
            strokeWidth="1"
          />
          {/* Compass-rose star (4-point) — top-right corner */}
          <polygon
            points="72,28 76,36 72,44 68,36"
            fill={SPARKLE}
            stroke={STROKE}
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <polygon
            points="64,36 72,32 80,36 72,40"
            fill={SPARKLE}
            stroke={STROKE}
            strokeWidth="1"
            strokeLinejoin="round"
          />
          {/* Destination pin (teardrop on a small circle) */}
          <circle cx="44" cy="62" r="3" fill={INK} />
          <path d="M 44 56 L 48 50 L 40 50 Z" fill={INK} />
        </g>
      )

    case 'tap':
      // Faucet / water tap — angular spout dripping. Distinct from
      // pot (round + handle) and pan (long flat handle).
      return (
        <g>
          {/* Vertical pipe */}
          <rect
            x="38"
            y="14"
            width="8"
            height="22"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Handle (top T) */}
          <rect
            x="28"
            y="10"
            width="28"
            height="6"
            rx="2"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Spout (horizontal arm) */}
          <rect
            x="42"
            y="34"
            width="26"
            height="8"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Spout opening */}
          <rect x="62" y="40" width="6" height="4" fill={STROKE} />
          {/* Water drops falling */}
          <ellipse
            cx="65"
            cy="56"
            rx="3"
            ry="5"
            fill={SPARKLE}
            opacity="0.7"
            stroke={STROKE}
            strokeWidth="1"
          />
          <ellipse
            cx="65"
            cy="72"
            rx="2.5"
            ry="4"
            fill={SPARKLE}
            opacity="0.5"
            stroke={STROKE}
            strokeWidth="1"
          />
        </g>
      )

    default:
      return null
  }
}

/** Generic fallback for an unknown picture key. Renders a rounded square
 *  with the key text — defensive only; should never surface for the
 *  curated pack. */
function renderUnknownPicture(key: string): ReactNode {
  return (
    <g>
      <rect
        x="14"
        y="14"
        width="68"
        height="68"
        rx="8"
        fill="#FFB7C5"
        stroke="#9C5A6F"
        strokeWidth="2"
      />
      <text
        x="48"
        y="52"
        textAnchor="middle"
        fontSize="14"
        fill="#3B3B3B"
        fontFamily="sans-serif"
      >
        {key}
      </text>
    </g>
  )
}
