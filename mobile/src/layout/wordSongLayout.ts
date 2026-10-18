/**
 * Word Song's frames, per `design/native/word-song-native.md` § 1–§ 3.
 * Pure maths; `wordSongLayout.test.ts` pins the spec's § 2 table.
 *
 * - **W / TL (tablet)**: `mathLayout`'s tablet frames (HUD 96, Emma 26vh,
 *   the ribbon's reserved 2-line slot) with the web Word Song's sizes:
 *   picture 180, letters 96, chips 112 with 24 pt gaps, 32 pt above the
 *   safe bottom. The stage runs from Math's problem top to the chips.
 * - **P (phone portrait)**: Math's two-row HUD and Emma rule (with Word
 *   Song's room), a fixed 3-line ribbon slot, chips clamp(88, …, 104) in a
 *   bottom row.
 * - **L (phone landscape)**: Math's Emma column and back arrow; the chips
 *   in a column on the right edge; HUD row, 2-line ribbon slot and the
 *   stage in the middle pane.
 *
 * The stage holds the card, centred vertically: the picture (P × P), 8 pt,
 * the letter row (cells F + 16 tall); or one glyph in a P × P box; or the
 * square scene, 12 pt, the sentence panel.
 */
import {
  isLandscape,
  isTablet,
  safeRect,
  type Rect,
  type ScreenLayout,
  type Viewport,
} from './layout'
import {
  FIGURE_LEFT,
  FIGURE_RIGHT,
  mathLayout,
  PHONE_BACK,
  type HudLayout,
  type HudMetrics,
  type MathForm,
} from './mathLayout'

export const PHONE_CAPTION_PT = 22
export const CAPTION_LINE_HEIGHT = 1.375
/** Tablet: the web's chips, picture, letters (§ 2 "Tablet"). */
export const TABLET_CHIP = 112
export const TABLET_CHIP_GAP = 24
export const TABLET_PICTURE = 180
export const TABLET_LETTER_FONT = 96
/** Phones: letters 72 (P) / 56 (L); chips clamp(88, …, 104). */
export const P_LETTER_FONT = 72
export const L_LETTER_FONT = 56
export const PHONE_CHIP_MIN = 88
export const PHONE_CHIP_MAX = 104
/** The smallest P card: 120 picture + 8 + 88 letter cells. */
export const P_MIN_CARD = 216
/** The th corner cue: the web's 64pt × 88pt on a tablet, 48 × 66 on phones. */
const TH_CUE_TABLET = { width: 85, height: 117 }
const TH_CUE_PHONE = { width: 48, height: 66 }

export interface SentenceMetrics {
  font: number
  lineHeight: number
  padding: { horizontal: number; vertical: number }
  /** The panel's reserved height (P: 2 lines, L: 1 line, tablet: 1 line). */
  slot: number
}

/**
 * A little story's card (content wave 3 § 4.2, § 4.3): Fredoka 600 at
 * `font` on `lineHeight` lines (≥ 44 pt, so every word's tap area is), the
 * sentence panel's 3 pt border, at the top of the stage. The reveal scene
 * fills `reveal` below it (see `storyRevealScene`).
 */
export interface StoryCardMetrics {
  font: number
  lineHeight: number
  padding: { horizontal: number; vertical: number }
  /** The card's width (stage-wide, at most `maxWidth`). */
  width: number
  /** The reveal scene's cap: 200 on phones, 280 on tablets. */
  sceneMax: number
  /**
   * Where the scene may grow after the answer, without the card: from the
   * card's bottom + 12 to the chips' bottom, stage-wide (P, tablets); the
   * chip column in phone landscape.
   */
  reveal: Rect
  /** `reveal.y` is measured below the card (P, tablets); not in L. */
  revealBelowCard: boolean
}

/** The card's border (the sentence panel's, 3 pt). */
export const STORY_CARD_BORDER = 3
/** Gap between the card's bottom and the reveal scene (§ 4.3). */
export const STORY_REVEAL_GAP = 12
/** The reveal scene is never smaller than this (§ 4.3). */
export const STORY_SCENE_MIN = 120

/** The card's height for `lines` lines of text. */
export function storyCardHeight(m: StoryCardMetrics, lines: number): number {
  return lines * m.lineHeight + 2 * m.padding.vertical + 2 * STORY_CARD_BORDER
}

/** Words are 0.35 em apart; each word's box takes half on each side (§ 4.3). */
export const STORY_WORD_GAP_EM = 0.35
/**
 * The spotlight is the word's width + 4 (§ 4.2): it overhangs the word by 2
 * on each side, drawn over the half-gap, so it takes no layout width.
 */
export const STORY_SPOT_OVERHANG = 2

/** The card's text width: inside its padding and border. */
export function storyTextWidth(m: StoryCardMetrics): number {
  return m.width - 2 * m.padding.horizontal - 2 * STORY_CARD_BORDER
}

/**
 * The card's line count, given each sentence's word widths: each sentence
 * starts a line and wraps word boxes (text + the gap) as the card's
 * flex-wrap rows do.
 */
export function storyLineCount(
  m: StoryCardMetrics,
  sentences: readonly (readonly number[])[],
): number {
  const width = storyTextWidth(m)
  const gap = STORY_WORD_GAP_EM * m.font
  let lines = 0
  for (const words of sentences) {
    let x = 0
    lines += 1
    for (const w of words) {
      const box = w + gap
      if (x > 0 && x + box > width) {
        lines += 1
        x = 0
      }
      x += box
    }
  }
  return lines
}

/**
 * The reveal scene's side (§ 4.3): min(the rect's height, its width, 200
 * on phones / 280 on tablets), at least 120. In P and on tablets the rect
 * starts `STORY_REVEAL_GAP` below the card (`cardHeight`); in phone
 * landscape it is the chip column, and the scene takes the column's width
 * (99–104 pt, the table's value: no 120 floor there).
 */
export function storyRevealScene(
  m: StoryCardMetrics,
  cardHeight: number,
): { x: number; y: number; size: number } {
  const top = m.revealBelowCard
    ? m.reveal.y + cardHeight + STORY_REVEAL_GAP
    : m.reveal.y
  const height = m.reveal.y + m.reveal.height - top
  const fit = Math.min(height, m.reveal.width, m.sceneMax)
  const size = m.revealBelowCard ? Math.max(STORY_SCENE_MIN, fit) : fit
  return {
    x: m.reveal.x + (m.reveal.width - size) / 2,
    y: top + Math.max(0, (height - size) / 2),
    size,
  }
}

export interface WordSongLayout extends ScreenLayout {
  form: MathForm
  safe: Rect
  hud: HudLayout
  hudMetrics: HudMetrics
  /** The ribbon hangs from (x, y) at this width, in a slot `maxHeight` tall. */
  ribbon: { x: number; y: number; width: number; maxHeight: number }
  ribbonPadding: { horizontal: number; vertical: number }
  captionLineHeight: number
  /** Between the ribbon row and the chips; the card centres in it. */
  stage: Rect
  /** P: the picture (and the letter tiers' glyph box). */
  picture: number
  /** F: the word card's letters. */
  letterFont: number
  /** Minimum letter cell width (48, 56 on a tablet). */
  letterCellMin: number
  sentence: SentenceMetrics
  /** The scene, square. */
  scene: number
  chips: { rect: Rect; size: number; gap: number; axis: 'row' | 'column' }
  thCue: { width: number; height: number }
  story: StoryCardMetrics
}

const clamp = (min: number, value: number, max: number) =>
  Math.max(min, Math.min(max, value))

const PHONE_RIBBON_PADDING = { horizontal: 16, vertical: 10 }

function slot(lines: number): number {
  return Math.ceil(
    lines * PHONE_CAPTION_PT * CAPTION_LINE_HEIGHT +
      PHONE_RIBBON_PADDING.vertical * 2,
  )
}

/** A sentence panel `lines` tall: text, padding and the 3 pt border. */
function sentence(
  font: number,
  lineHeight: number,
  padding: { horizontal: number; vertical: number },
  lines: number,
): SentenceMetrics {
  return {
    font,
    lineHeight,
    padding,
    slot: Math.ceil(lines * font * lineHeight + padding.vertical * 2 + 6),
  }
}

function phonePortrait(v: Viewport): WordSongLayout {
  const m = mathLayout(v)
  const s = safeRect(v)
  const pad = 16
  const chip = clamp(
    PHONE_CHIP_MIN,
    Math.floor((s.width - 64) / 3),
    PHONE_CHIP_MAX,
  )
  const chipsTop = s.y + s.height - 32 - chip
  const gap = Math.floor((s.width - 32 - 3 * chip) / 2)
  const emmaTop = s.y + 104
  const e = Math.max(
    120,
    Math.min(
      Math.round(0.22 * s.height),
      chipsTop - 16 - P_MIN_CARD - 8 - emmaTop,
    ),
  )
  const emma = { x: s.x + 8 - FIGURE_LEFT * e, y: emmaTop, width: e, height: e }
  const ribbonX = emma.x + FIGURE_RIGHT * e + 8
  const stageTop = emma.y + e + 8
  const stage = {
    x: s.x + pad,
    y: stageTop,
    width: s.width - pad * 2,
    height: Math.max(0, chipsTop - 16 - stageTop),
  }
  const panel = sentence(24, 1.4, { horizontal: 16, vertical: 12 }, 2)
  return {
    form: 'phone-portrait',
    landscape: false,
    tablet: false,
    safe: s,
    emma,
    // Math's (the shell's placeholder panel and Emma's stage read it).
    content: m.content,
    captionFontSize: PHONE_CAPTION_PT,
    captionLineHeight: PHONE_CAPTION_PT * CAPTION_LINE_HEIGHT,
    hud: m.hud,
    hudMetrics: m.hudMetrics,
    ribbon: {
      x: ribbonX,
      y: s.y + 112,
      width: s.x + s.width - pad - ribbonX,
      maxHeight: slot(3),
    },
    ribbonPadding: PHONE_RIBBON_PADDING,
    stage,
    picture: clamp(120, stage.height - 8 - 88, 160),
    letterFont: P_LETTER_FONT,
    letterCellMin: 48,
    sentence: panel,
    scene: clamp(88, stage.height - 12 - panel.slot, 160),
    chips: {
      rect: {
        x: s.x + pad,
        y: chipsTop,
        width: s.width - pad * 2,
        height: chip,
      },
      size: chip,
      gap,
      axis: 'row',
    },
    thCue: TH_CUE_PHONE,
    story: {
      font: 24,
      lineHeight: 46,
      padding: { horizontal: 16, vertical: 12 },
      width: stage.width,
      sceneMax: 200,
      reveal: {
        x: stage.x,
        y: stage.y,
        width: stage.width,
        height: chipsTop + chip - stage.y,
      },
      revealBelowCard: true,
    },
  }
}

function phoneLandscape(v: Viewport): WordSongLayout {
  const m = mathLayout(v)
  const s = safeRect(v)
  const pad = 16
  const column = clamp(120, Math.round(s.width * 0.24), 200)
  const chip = clamp(
    PHONE_CHIP_MIN,
    Math.floor((s.height - 56) / 3),
    PHONE_CHIP_MAX,
  )
  const chipX = s.x + s.width - pad - chip
  const chipsH = 3 * chip + 2 * 16
  const paneX = s.x + column
  const paneW = chipX - 16 - paneX
  const hudRow = { x: paneX, y: s.y + 8, width: paneW, height: 44 }
  const ribbonY = s.y + 60
  const stageTop = ribbonY + slot(2) + 8
  const stage = {
    x: paneX,
    y: stageTop,
    width: paneW,
    height: Math.max(0, s.y + s.height - 16 - stageTop),
  }
  const panel = sentence(22, 1.4, { horizontal: 16, vertical: 10 }, 1)
  return {
    form: 'phone-landscape',
    landscape: true,
    tablet: false,
    safe: s,
    emma: m.emma,
    // Math's (the shell's placeholder panel and Emma's stage read it).
    content: m.content,
    captionFontSize: PHONE_CAPTION_PT,
    captionLineHeight: PHONE_CAPTION_PT * CAPTION_LINE_HEIGHT,
    hud: {
      kind: 'split',
      back: { x: s.x + pad, y: s.y + 8, width: PHONE_BACK, height: PHONE_BACK },
      beads: hudRow,
      status: hudRow,
    },
    hudMetrics: m.hudMetrics,
    ribbon: { x: paneX, y: ribbonY, width: paneW, maxHeight: slot(2) },
    ribbonPadding: PHONE_RIBBON_PADDING,
    stage,
    picture: clamp(96, stage.height - 8 - 72, 160),
    letterFont: L_LETTER_FONT,
    letterCellMin: 48,
    sentence: panel,
    scene: clamp(88, stage.height - 8 - panel.slot, 160),
    chips: {
      rect: {
        x: chipX,
        y: s.y + s.height - 16 - chipsH,
        width: chip,
        height: chipsH,
      },
      size: chip,
      gap: 16,
      axis: 'column',
    },
    thCue: TH_CUE_PHONE,
    story: {
      font: 22,
      lineHeight: 44,
      padding: { horizontal: 16, vertical: 10 },
      width: stage.width,
      sceneMax: 200,
      // The chip column: small, on the form Marian doesn't use (§ 4.3).
      reveal: {
        x: chipX,
        y: s.y + s.height - 16 - chipsH,
        width: chip,
        height: chipsH,
      },
      revealBelowCard: false,
    },
  }
}

function tablet(v: Viewport, landscape: boolean): WordSongLayout {
  const m = mathLayout(v)
  const s = safeRect(v)
  const chipsTop = s.y + s.height - 32 - TABLET_CHIP
  const rowLeft = m.chips.rect.x
  const rowWidth = m.chips.rect.width
  const stage = {
    x: m.problem.x,
    y: m.problem.y,
    width: m.problem.width,
    height: Math.max(0, chipsTop - m.problem.y),
  }
  return {
    form: landscape ? 'tablet-landscape' : 'tablet-portrait',
    landscape,
    tablet: true,
    safe: s,
    emma: m.emma,
    // Math's (the shell's placeholder panel and Emma's stage read it).
    content: m.content,
    captionFontSize: m.captionFontSize,
    captionLineHeight: m.captionLineHeight,
    hud: m.hud,
    hudMetrics: m.hudMetrics,
    ribbon: m.ribbon,
    ribbonPadding: m.ribbonPadding,
    stage,
    picture: TABLET_PICTURE,
    letterFont: TABLET_LETTER_FONT,
    letterCellMin: 56,
    sentence: sentence(32, 1.625, { horizontal: 24, vertical: 16 }, 1),
    scene: 210,
    chips: {
      rect: { x: rowLeft, y: chipsTop, width: rowWidth, height: TABLET_CHIP },
      size: TABLET_CHIP,
      gap: TABLET_CHIP_GAP,
      axis: 'row',
    },
    thCue: TH_CUE_TABLET,
    story: {
      font: 32,
      lineHeight: 56,
      padding: { horizontal: 24, vertical: 16 },
      width: Math.min(stage.width, STORY_TABLET_TEXT_MAX + 2 * 24 + 6),
      sceneMax: 280,
      reveal: {
        x: stage.x,
        y: stage.y,
        width: stage.width,
        height: chipsTop + TABLET_CHIP - stage.y,
      },
      revealBelowCard: true,
    },
  }
}

/** A tablet story card's text is at most this wide (§ 4.3). */
export const STORY_TABLET_TEXT_MAX = 586

export function wordSongLayout(v: Viewport): WordSongLayout {
  const landscape = isLandscape(v)
  if (isTablet(v)) return tablet(v, landscape)
  return landscape ? phoneLandscape(v) : phonePortrait(v)
}

/** Chip content metrics, scaled from the web's 112 pt tile (§ 3). */
export function chipInner(size: number) {
  const k = size / TABLET_CHIP
  return {
    radius: Math.round(size * (32 / TABLET_CHIP)),
    inset: Math.round(size * (12 / TABLET_CHIP)),
    letterFont: Math.round(0.57 * size),
    wordFont: Math.round(0.32 * size),
    /** The written word never shrinks below this. */
    wordFontMin: 24,
    burstDistance: 75 * k,
    sparkle: 16 * k,
  }
}
