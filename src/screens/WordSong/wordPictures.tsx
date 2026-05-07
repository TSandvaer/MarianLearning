/**
 * Inline-SVG picture placeholders for the Word Song picture pack.
 *
 * Why placeholders, not real assets
 * ---------------------------------
 * Per `design/word-song-picture-pack.md` Open Q #1, the sourcing decision
 * (commission / curate / AI-gen) is deferred to Thomas. Real picture SVGs
 * land in a future PR — when they do, they drop into
 * `/public/assets/pictures/picture-{key}.svg` and this renderer swaps to
 * `<img src=...>` per the same `pictureKey` that drives the placeholders.
 *
 * Same posture as Math's inline `FlowerGroup` / `SparkleGlyph` fallbacks
 * (Math.tsx:1051-1129) — soft pastel SVGs that read at 96pt as
 * "stylised cartoon X" without pretending to be the real asset. Each
 * placeholder uses Emma's palette tokens (`--my-rose`, `--my-cream`,
 * `--ink`, `--sparkle` per spec §"Style requirements") so they don't
 * clash with Emma.
 *
 * Distinctness — what matters for v1
 * ----------------------------------
 * The picture-side discrimination is the entire point of the screen. For
 * v1 with placeholders, each picture must be *visually distinct* enough
 * at 96pt that Marian can tap-and-confirm a chip. The placeholders here
 * are deliberately schematic: each picture has a unique silhouette
 * (square, round, person-shape, vehicle-shape) plus a recognisable
 * primary feature (cat ears + tail, hat brim, fan blades). They are NOT
 * a substitute for real illustration; they are a "ship the screen, hold
 * the meaning anchor" v1 measure.
 *
 * Forbidden-pair compatibility
 * ----------------------------
 * Per `wordPack.FORBIDDEN_PAIRS` and Kyle's silhouette-distinctness
 * constraint, certain pairs (cat/dog, cap/hat, man/dad) must not appear
 * in the same trio. The distractor matrix already enforces this; the
 * placeholders here are designed to LOOK silhouette-similar for those
 * pairs (cat and dog both have animal-body shapes; cap and hat both have
 * head-covering shapes). That's intentional — the silhouette-distinctness
 * rule is the matrix's job, not the renderer's.
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
 * Render a picture placeholder for the given key. Returns an SVG element
 * sized to fit its container — the chip wrapper sets the box; the SVG
 * fills with `width: 100%; height: 100%`.
 *
 * Falls back to a generic "object" silhouette + the word in small text
 * if the key is unknown (defensive — should not happen with the curated
 * pack but kept so an unknown key doesn't crash the screen).
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
 *
 * Each picture is hand-shaped:
 *   - Animals: silhouette (cat/dog/fox) or wing-shape (bat).
 *   - Clothing: brim/visor distinguishes hat/cap.
 *   - Vehicles: bus is long with multi-windows, van is shorter.
 *   - People: stylised silhouette (man) vs parent+child (dad).
 *   - Objects: characteristic shape + label-band features.
 */
function renderPictureBody(key: string): ReactNode {
  // Palette tokens — soft pastel illustrated style per Kyle's pack-doc
  // §"Style requirements".
  const ROSE = '#FFB7C5'
  const CREAM = '#FFF5F0'
  const INK = '#3B3B3B'
  const SPARKLE = '#FFD966'
  const STROKE = '#9C5A6F' // a slightly darker rose for outlines

  switch (key) {
    case 'cat':
      // Sitting cat with pointed ears + curled tail.
      return (
        <g>
          {/* Body — soft oval */}
          <ellipse
            cx="48"
            cy="58"
            rx="22"
            ry="22"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Head */}
          <circle
            cx="48"
            cy="36"
            r="16"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Pointed ears */}
          <polygon
            points="34,24 38,12 44,22"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <polygon
            points="62,24 58,12 52,22"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Eyes */}
          <circle cx="42" cy="36" r="2" fill={INK} />
          <circle cx="54" cy="36" r="2" fill={INK} />
          {/* Whiskers */}
          <line x1="32" y1="40" x2="40" y2="40" stroke={INK} strokeWidth="1" />
          <line x1="56" y1="40" x2="64" y2="40" stroke={INK} strokeWidth="1" />
          {/* Tail */}
          <path
            d="M 70 60 Q 82 50 78 38"
            fill="none"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      )

    case 'hat':
      // Wide-brim sun hat with ribbon.
      return (
        <g>
          {/* Brim */}
          <ellipse
            cx="48"
            cy="58"
            rx="38"
            ry="8"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Crown */}
          <path
            d="M 28 58 Q 28 26 48 26 Q 68 26 68 58 Z"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Ribbon band */}
          <rect
            x="28"
            y="50"
            width="40"
            height="6"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="1"
          />
        </g>
      )

    case 'bat':
      // Friendly flying bat — wings spread, big eyes, no fangs.
      return (
        <g>
          {/* Wings */}
          <path
            d="M 14 50 Q 28 32 36 46 L 36 56 Q 28 60 14 56 Z"
            fill={STROKE}
            stroke={INK}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M 82 50 Q 68 32 60 46 L 60 56 Q 68 60 82 56 Z"
            fill={STROKE}
            stroke={INK}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Body */}
          <ellipse
            cx="48"
            cy="50"
            rx="14"
            ry="14"
            fill={INK}
            stroke="#222"
            strokeWidth="1"
          />
          {/* Eyes — big, friendly */}
          <circle cx="42" cy="46" r="3" fill={CREAM} />
          <circle cx="54" cy="46" r="3" fill={CREAM} />
          <circle cx="42" cy="46" r="1.5" fill={INK} />
          <circle cx="54" cy="46" r="1.5" fill={INK} />
          {/* Pointed ears */}
          <polygon points="40,38 38,30 44,36" fill={INK} />
          <polygon points="56,38 58,30 52,36" fill={INK} />
        </g>
      )

    case 'mat':
      // Woven mat — rectangle with simple pattern.
      return (
        <g>
          <rect
            x="14"
            y="38"
            width="68"
            height="26"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Weave stripes */}
          <line
            x1="14"
            y1="46"
            x2="82"
            y2="46"
            stroke={ROSE}
            strokeWidth="1.5"
          />
          <line
            x1="14"
            y1="54"
            x2="82"
            y2="54"
            stroke={ROSE}
            strokeWidth="1.5"
          />
          <line
            x1="32"
            y1="38"
            x2="32"
            y2="64"
            stroke={ROSE}
            strokeWidth="1.5"
          />
          <line
            x1="48"
            y1="38"
            x2="48"
            y2="64"
            stroke={ROSE}
            strokeWidth="1.5"
          />
          <line
            x1="64"
            y1="38"
            x2="64"
            y2="64"
            stroke={ROSE}
            strokeWidth="1.5"
          />
        </g>
      )

    case 'bag':
      // Tote bag — body + handle.
      return (
        <g>
          {/* Body */}
          <path
            d="M 22 38 L 22 76 Q 22 80 26 80 L 70 80 Q 74 80 74 76 L 74 38 Z"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Handle */}
          <path
            d="M 32 38 Q 32 18 48 18 Q 64 18 64 38"
            fill="none"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      )

    case 'fan':
      // Pedestal fan — base + stem + circular blade housing.
      return (
        <g>
          {/* Base */}
          <ellipse cx="48" cy="80" rx="14" ry="4" fill={STROKE} />
          {/* Stem */}
          <rect x="46" y="48" width="4" height="32" fill={STROKE} />
          {/* Blade housing */}
          <circle
            cx="48"
            cy="36"
            r="22"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Blades — 3-bladed simple */}
          <path
            d="M 48 36 L 48 16 Q 56 20 52 36 Z"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="1"
          />
          <path
            d="M 48 36 L 66 44 Q 60 50 46 40 Z"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="1"
          />
          <path
            d="M 48 36 L 30 44 Q 36 50 50 40 Z"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="1"
          />
          {/* Hub */}
          <circle cx="48" cy="36" r="3" fill={INK} />
        </g>
      )

    case 'man':
      // Stylised silhouette person (per Open Q #2 default — minimal facial
      // detail, lower visual hierarchy than Emma).
      return (
        <g>
          {/* Head */}
          <circle
            cx="48"
            cy="22"
            r="10"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Body — t-shirt + pants outline */}
          <path
            d="M 30 38 L 38 36 L 38 60 L 32 84 L 42 84 L 46 60 L 50 60 L 54 84 L 64 84 L 58 60 L 58 36 L 66 38 L 66 50 Z"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
      )

    case 'pan':
      // Frying pan — circle + handle.
      return (
        <g>
          {/* Pan body */}
          <ellipse
            cx="40"
            cy="50"
            rx="22"
            ry="20"
            fill="#888"
            stroke={INK}
            strokeWidth="2"
          />
          <ellipse cx="40" cy="46" rx="20" ry="16" fill="#aaa" />
          {/* Handle */}
          <rect
            x="60"
            y="46"
            width="28"
            height="6"
            rx="3"
            fill={STROKE}
            stroke={INK}
            strokeWidth="1"
          />
        </g>
      )

    case 'cap':
      // Baseball cap — peak + crown.
      return (
        <g>
          {/* Crown */}
          <path
            d="M 22 56 Q 22 30 48 30 Q 74 30 74 56 Z"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Peak/visor */}
          <ellipse
            cx="64"
            cy="58"
            rx="20"
            ry="6"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Button on top */}
          <circle cx="48" cy="32" r="2" fill={STROKE} />
        </g>
      )

    case 'can':
      // Soft drink can — cylinder + top ring + label band.
      return (
        <g>
          {/* Body */}
          <rect
            x="30"
            y="20"
            width="36"
            height="58"
            rx="2"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Top oval */}
          <ellipse cx="48" cy="20" rx="18" ry="4" fill={STROKE} />
          {/* Top inset */}
          <ellipse cx="48" cy="20" rx="14" ry="2.5" fill="#888" />
          {/* Pull tab */}
          <ellipse cx="50" cy="20" rx="4" ry="1.5" fill={INK} />
          {/* Label band */}
          <rect
            x="30"
            y="42"
            width="36"
            height="14"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="1"
          />
        </g>
      )

    case 'tag':
      // Price tag — diamond/parallelogram with string loop.
      return (
        <g>
          {/* Tag body */}
          <path
            d="M 30 30 L 70 30 L 80 50 L 70 70 L 30 70 Z"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* String loop */}
          <circle
            cx="36"
            cy="40"
            r="3"
            fill="none"
            stroke={STROKE}
            strokeWidth="2"
          />
          <path
            d="M 32 28 Q 24 18 18 22"
            fill="none"
            stroke={STROKE}
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Mark line where price would be */}
          <line x1="42" y1="50" x2="68" y2="50" stroke={ROSE} strokeWidth="2" />
        </g>
      )

    case 'dad':
      // Parent + child holding hands (per Open Q #3 default mitigation).
      return (
        <g>
          {/* Parent — taller, on left */}
          <circle
            cx="32"
            cy="22"
            r="8"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="2"
          />
          <path
            d="M 22 36 L 28 34 L 28 64 L 24 84 L 32 84 L 36 64 L 36 64 L 36 34 L 42 36 L 42 50 Z"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Child — smaller, on right */}
          <circle
            cx="64"
            cy="38"
            r="6"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="2"
          />
          <path
            d="M 56 50 L 60 48 L 60 64 L 58 84 L 64 84 L 66 64 L 66 64 L 66 48 L 70 50 L 70 60 Z"
            fill={SPARKLE}
            stroke={STROKE}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Connecting hands */}
          <line
            x1="42"
            y1="58"
            x2="56"
            y2="58"
            stroke={STROKE}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )

    case 'jam':
      // Jar of jam — round jar + lid + label band.
      return (
        <g>
          {/* Jar body */}
          <rect
            x="28"
            y="28"
            width="40"
            height="50"
            rx="3"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Top of contents (jam visible inside) */}
          <ellipse cx="48" cy="30" rx="20" ry="3" fill="#D63B5A" />
          {/* Lid */}
          <rect
            x="26"
            y="20"
            width="44"
            height="10"
            rx="2"
            fill={STROKE}
            stroke={INK}
            strokeWidth="1"
          />
          {/* Label band */}
          <rect
            x="28"
            y="46"
            width="40"
            height="14"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="1"
          />
          {/* Strawberry/dot on label */}
          <circle cx="48" cy="53" r="3" fill="#D63B5A" />
        </g>
      )

    case 'van':
      // Delivery van — boxy, side view, two windows, two wheels.
      return (
        <g>
          {/* Body */}
          <rect
            x="14"
            y="38"
            width="68"
            height="28"
            rx="3"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Cab front (slightly lower) */}
          <path
            d="M 14 50 L 4 50 L 4 66 L 14 66 Z"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Windows (two only) */}
          <rect
            x="20"
            y="44"
            width="14"
            height="10"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="1"
          />
          <rect
            x="38"
            y="44"
            width="14"
            height="10"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="1"
          />
          {/* Wheels */}
          <circle cx="22" cy="68" r="6" fill={INK} />
          <circle cx="22" cy="68" r="2" fill={CREAM} />
          <circle cx="68" cy="68" r="6" fill={INK} />
          <circle cx="68" cy="68" r="2" fill={CREAM} />
        </g>
      )

    // ── Distractor-only pictures ────────────────────────────────────────
    case 'bus':
      // School bus — long, multiple windows.
      return (
        <g>
          <rect
            x="6"
            y="36"
            width="84"
            height="32"
            rx="3"
            fill={SPARKLE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* 4 windows */}
          <rect
            x="12"
            y="42"
            width="14"
            height="10"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="1"
          />
          <rect
            x="30"
            y="42"
            width="14"
            height="10"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="1"
          />
          <rect
            x="48"
            y="42"
            width="14"
            height="10"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="1"
          />
          <rect
            x="66"
            y="42"
            width="14"
            height="10"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="1"
          />
          {/* Wheels */}
          <circle cx="22" cy="70" r="6" fill={INK} />
          <circle cx="74" cy="70" r="6" fill={INK} />
        </g>
      )

    case 'sun':
      // Round sun with rays.
      return (
        <g>
          <circle
            cx="48"
            cy="48"
            r="20"
            fill={SPARKLE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180
            const x1 = 48 + Math.cos(rad) * 24
            const y1 = 48 + Math.sin(rad) * 24
            const x2 = 48 + Math.cos(rad) * 36
            const y2 = 48 + Math.sin(rad) * 36
            return (
              <line
                key={deg}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={STROKE}
                strokeWidth="3"
                strokeLinecap="round"
              />
            )
          })}
        </g>
      )

    case 'dog':
      // Sitting dog — floppy ears, distinct from cat.
      return (
        <g>
          {/* Body */}
          <ellipse
            cx="48"
            cy="58"
            rx="22"
            ry="22"
            fill="#C8A27A"
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Head */}
          <circle
            cx="48"
            cy="36"
            r="16"
            fill="#C8A27A"
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Floppy ears */}
          <ellipse
            cx="34"
            cy="34"
            rx="6"
            ry="10"
            fill="#A88060"
            stroke={STROKE}
            strokeWidth="2"
          />
          <ellipse
            cx="62"
            cy="34"
            rx="6"
            ry="10"
            fill="#A88060"
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Eyes */}
          <circle cx="42" cy="36" r="2" fill={INK} />
          <circle cx="54" cy="36" r="2" fill={INK} />
          {/* Snout */}
          <ellipse
            cx="48"
            cy="42"
            rx="5"
            ry="3"
            fill="#A88060"
            stroke={STROKE}
            strokeWidth="1"
          />
          {/* Tail */}
          <path
            d="M 70 60 Q 78 56 76 50"
            fill="none"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      )

    case 'fox':
      // Cartoon fox — orange, pointed face.
      return (
        <g>
          {/* Body */}
          <ellipse
            cx="48"
            cy="60"
            rx="22"
            ry="18"
            fill="#FF8855"
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Head — triangular */}
          <path
            d="M 32 36 L 64 36 L 56 18 L 48 30 L 40 18 Z"
            fill="#FF8855"
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Ears (the upper triangles already serve as ears, but accent) */}
          <polygon points="38,22 40,18 44,28" fill={INK} />
          <polygon points="58,22 56,18 52,28" fill={INK} />
          {/* Eyes */}
          <circle cx="42" cy="32" r="2" fill={INK} />
          <circle cx="54" cy="32" r="2" fill={INK} />
          {/* White underbelly */}
          <ellipse cx="48" cy="64" rx="14" ry="10" fill={CREAM} />
          {/* Tail with white tip */}
          <path
            d="M 70 60 Q 84 50 80 40"
            fill="none"
            stroke="#FF8855"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle
            cx="80"
            cy="40"
            r="4"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="1"
          />
        </g>
      )

    case 'cup':
      // Mug with handle.
      return (
        <g>
          {/* Body */}
          <path
            d="M 26 28 L 64 28 L 60 80 L 30 80 Z"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Handle */}
          <path
            d="M 64 38 Q 80 38 80 54 Q 80 70 64 70"
            fill="none"
            stroke={STROKE}
            strokeWidth="3"
          />
          {/* Top opening */}
          <ellipse cx="45" cy="28" rx="19" ry="3" fill={ROSE} />
        </g>
      )

    case 'pen':
      // Ballpoint pen — long cylinder + tip + clip.
      return (
        <g>
          {/* Body */}
          <rect
            x="22"
            y="14"
            width="14"
            height="56"
            fill={ROSE}
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Tip */}
          <polygon
            points="22,70 36,70 29,84"
            fill={INK}
            stroke={INK}
            strokeWidth="1"
          />
          {/* Cap */}
          <rect x="22" y="14" width="14" height="14" fill={STROKE} />
          {/* Clip */}
          <path
            d="M 36 18 Q 44 18 44 30 L 40 30 L 40 22 L 36 22 Z"
            fill={STROKE}
          />
        </g>
      )

    case 'log':
      // Wood log — horizontal cylinder with bark.
      return (
        <g>
          <rect
            x="10"
            y="36"
            width="76"
            height="24"
            rx="4"
            fill="#9C6B3A"
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* End caps */}
          <ellipse
            cx="10"
            cy="48"
            rx="6"
            ry="12"
            fill="#C8946C"
            stroke={STROKE}
            strokeWidth="2"
          />
          <ellipse
            cx="86"
            cy="48"
            rx="6"
            ry="12"
            fill="#C8946C"
            stroke={STROKE}
            strokeWidth="2"
          />
          {/* Tree rings */}
          <ellipse
            cx="10"
            cy="48"
            rx="3"
            ry="6"
            fill="none"
            stroke={STROKE}
            strokeWidth="1"
          />
          <ellipse
            cx="86"
            cy="48"
            rx="3"
            ry="6"
            fill="none"
            stroke={STROKE}
            strokeWidth="1"
          />
          {/* Bark texture */}
          <line
            x1="20"
            y1="40"
            x2="22"
            y2="56"
            stroke={STROKE}
            strokeWidth="1"
          />
          <line
            x1="40"
            y1="40"
            x2="42"
            y2="56"
            stroke={STROKE}
            strokeWidth="1"
          />
          <line
            x1="60"
            y1="40"
            x2="62"
            y2="56"
            stroke={STROKE}
            strokeWidth="1"
          />
        </g>
      )

    case 'pot':
      // Cooking pot — round body, two handles.
      return (
        <g>
          {/* Body */}
          <rect
            x="22"
            y="36"
            width="52"
            height="40"
            rx="4"
            fill="#888"
            stroke={INK}
            strokeWidth="2"
          />
          {/* Top opening */}
          <ellipse
            cx="48"
            cy="36"
            rx="26"
            ry="5"
            fill="#aaa"
            stroke={INK}
            strokeWidth="1"
          />
          {/* Two handles */}
          <path
            d="M 22 44 Q 14 44 14 50"
            fill="none"
            stroke={INK}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M 74 44 Q 82 44 82 50"
            fill="none"
            stroke={INK}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      )

    // ── Novel-pool probe silhouettes (ticket 86c9m3aec) ─────────────────
    // Placeholder silhouettes for the 4 novel short-a probe words used
    // on the cvc-words graduation session. Per the ticket's recommended
    // path: ship silhouettes now, file a follow-up Kyle ticket for
    // real Midjourney → SVG illustrations. Each silhouette is
    // visually distinct from every existing pack entry per the
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

    // ── Short-o pool real SVG artwork (ticket 86c9p4uw3 — Phase 3) ────
    // Real SVG artwork for the 4 wholly-new short-o entries
    // (`mop, box, mom, hot`), traced from Thomas's Phase 2 Midjourney
    // PNGs. Files live at `public/assets/pictures/picture-{word}.svg`
    // and are served over the Vite static-asset path; the service
    // worker's `**/*.svg` precache pattern picks them up so they
    // ship offline-first alongside the rest of the bundle.
    //
    // The 4 PROMOTED short-o entries (`dog, log, pot, fox`) keep
    // their existing inline silhouettes above — they belong to the
    // short-a pack's eventual cohesion pass per
    // `design/word-song/short-o-picture-pack-prompts.md` §6, not this
    // PR's scope.
    //
    // Distinctness gates per the Phase 1 spec §5.2 are preserved by
    // each asset's authoring (see header comments inside each SVG).

    case 'mop':
    case 'box':
    case 'mom':
    case 'hot':
      // External SVG — rendered as <image> inside the wrapper <svg>
      // so the WordPicture outer envelope (data-testid, role, aria-label)
      // stays identical to the inline silhouettes. The 0..96 viewBox
      // matches the source SVGs' 0..200 design — preserveAspectRatio
      // keeps each picture centred at any chip / large size.
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
