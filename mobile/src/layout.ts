/**
 * Pure layout maths for the three form factors (phone portrait, phone
 * landscape, tablet). Every screen gets Emma's frame from here so the App-
 * level Emma stage can animate her between screens (the layoutId stand-in —
 * see components/EmmaStage.tsx). The rest of each screen lays out with
 * flexbox inside `content`.
 *
 * Web reference values:
 *  - Greet portrait: Emma slot h-[60vh], ribbon w-[88%] max-w-2xl, heart
 *    160x117 px; landscape: Emma left half at h-[min(80vh,50vw)], ribbon +
 *    heart in the right half.
 *  - Greet caption: text-[2.4rem] (38.4 px) — >= 28 pt spec floor on iPad.
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Insets {
  top: number
  bottom: number
  left: number
  right: number
}

export interface Viewport {
  width: number
  height: number
  insets: Insets
}

export interface ScreenLayout {
  landscape: boolean
  tablet: boolean
  emma: Rect
  content: Rect
  captionFontSize: number
}

const PAD = 16

export function safeRect(v: Viewport): Rect {
  return {
    x: v.insets.left,
    y: v.insets.top,
    width: Math.max(0, v.width - v.insets.left - v.insets.right),
    height: Math.max(0, v.height - v.insets.top - v.insets.bottom),
  }
}

export function isLandscape(v: Viewport): boolean {
  return v.width > v.height
}

/** iPad mini portrait is 744 pt wide; phones top out around 440 pt. */
export function isTablet(v: Viewport): boolean {
  return Math.min(v.width, v.height) >= 600
}

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** 38.4 px on iPad (web value), floors at 22 px on phones. */
export function captionFontSize(v: Viewport): number {
  return Math.round(clamp(22, Math.min(v.width, v.height) * 0.05, 38.4))
}

/** Heart button size: web 160x117, shrunk on short viewports. */
export function heartSize(v: Viewport): { width: number; height: number } {
  const s = safeRect(v)
  const height = clamp(64, s.height * 0.16, 117)
  return { width: (height * 160) / 117, height }
}

export function greetLayout(v: Viewport): ScreenLayout {
  const s = safeRect(v)
  const landscape = isLandscape(v)
  const base = {
    landscape,
    tablet: isTablet(v),
    captionFontSize: captionFontSize(v),
  }
  if (landscape) {
    const half = s.width / 2
    const emmaSize = Math.min(s.height * 0.8, half)
    return {
      ...base,
      emma: {
        x: s.x + (half - emmaSize) / 2,
        y: s.y + (s.height - emmaSize) / 2,
        width: emmaSize,
        height: emmaSize,
      },
      content: {
        x: s.x + half + PAD,
        y: s.y + PAD,
        width: half - PAD * 2,
        height: s.height - PAD * 2,
      },
    }
  }
  const emmaSize = Math.min(s.height * 0.55, s.width)
  const emmaY = s.y + PAD
  const contentY = emmaY + emmaSize + 8
  return {
    ...base,
    emma: {
      x: s.x + (s.width - emmaSize) / 2,
      y: emmaY,
      width: emmaSize,
      height: emmaSize,
    },
    content: {
      x: s.x + PAD,
      y: contentY,
      width: s.width - PAD * 2,
      height: s.y + s.height - PAD - contentY,
    },
  }
}

/** Math: Emma perches upper-left; problem + chips fill the rest. */
export function mathLayout(v: Viewport): ScreenLayout {
  const s = safeRect(v)
  const landscape = isLandscape(v)
  const base = {
    landscape,
    tablet: isTablet(v),
    captionFontSize: Math.round(captionFontSize(v) * 0.85),
  }
  if (landscape) {
    const emmaSize = Math.min(s.height * 0.6, s.width * 0.3)
    const emma = {
      x: s.x + PAD,
      y: s.y + PAD,
      width: emmaSize,
      height: emmaSize,
    }
    const contentX = emma.x + emmaSize + PAD
    return {
      ...base,
      emma,
      content: {
        x: contentX,
        y: s.y + PAD,
        width: s.x + s.width - PAD - contentX,
        height: s.height - PAD * 2,
      },
    }
  }
  const emmaSize = Math.min(s.height * 0.26, s.width * 0.42)
  const emma = { x: s.x + PAD, y: s.y + PAD, width: emmaSize, height: emmaSize }
  return {
    ...base,
    emma,
    // Content spans the full width; the caption row sits beside Emma.
    content: {
      x: s.x + PAD,
      y: s.y + PAD,
      width: s.width - PAD * 2,
      height: s.height - PAD * 2,
    },
  }
}

/** Hub stub: Emma in a top band (web Hub uses a 22vh band). */
export function hubLayout(v: Viewport): ScreenLayout {
  const s = safeRect(v)
  const landscape = isLandscape(v)
  const emmaSize = Math.min(s.height * (landscape ? 0.42 : 0.3), s.width)
  const emma = {
    x: s.x + (s.width - emmaSize) / 2,
    y: s.y + PAD,
    width: emmaSize,
    height: emmaSize,
  }
  const contentY = emma.y + emmaSize + 8
  return {
    landscape,
    tablet: isTablet(v),
    captionFontSize: captionFontSize(v),
    emma,
    content: {
      x: s.x + PAD,
      y: contentY,
      width: s.width - PAD * 2,
      height: s.y + s.height - PAD - contentY,
    },
  }
}
