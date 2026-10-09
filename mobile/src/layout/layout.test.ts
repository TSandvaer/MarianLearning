import { ROUTES } from '../router/routes'
import { greetLayout } from './greetLayout'
import {
  isTablet,
  mathLayout,
  panelRect,
  safeRect,
  type Rect,
  type Viewport,
} from './layout'
import { layoutForRoute } from './routeLayout'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }

/** Phone portrait/landscape (notch insets), iPad portrait/landscape. */
const VIEWPORTS: Record<string, Viewport> = {
  'phone portrait': {
    width: 402,
    height: 874,
    insets: { top: 62, bottom: 34, left: 0, right: 0 },
  },
  'phone landscape': {
    width: 874,
    height: 402,
    insets: { top: 0, bottom: 21, left: 62, right: 62 },
  },
  'iPad portrait': { width: 834, height: 1194, insets: NO_INSETS },
  'iPad landscape': { width: 1194, height: 834, insets: NO_INSETS },
}

function inside(inner: Rect, outer: Rect): boolean {
  const eps = 0.001
  return (
    inner.x >= outer.x - eps &&
    inner.y >= outer.y - eps &&
    inner.x + inner.width <= outer.x + outer.width + eps &&
    inner.y + inner.height <= outer.y + outer.height + eps
  )
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  )
}

describe.each(Object.entries(VIEWPORTS))('%s', (_name, viewport) => {
  // Greet has its own layout and tests (greetLayout.test.ts): Emma's frame
  // may overhang the screen there, as on the web.
  it.each(ROUTES.filter((r) => r !== 'splash' && r !== 'greet'))(
    '%s: Emma and the placeholder panel sit in the safe area, apart',
    (route) => {
      const layout = layoutForRoute(route, viewport)
      const safe = safeRect(viewport)
      const panel = panelRect(layout)
      expect(inside(layout.emma, safe)).toBe(true)
      expect(inside(panel, safe)).toBe(true)
      expect(panel.height).toBeGreaterThan(0)
      expect(overlaps(layout.emma, panel)).toBe(false)
    },
  )
})

describe('form factors', () => {
  it('iPads are tablets, phones are not', () => {
    expect(isTablet(VIEWPORTS['iPad portrait']!)).toBe(true)
    expect(isTablet(VIEWPORTS['phone landscape']!)).toBe(false)
  })

  it('landscape puts Greet’s Emma in the left half', () => {
    const v = VIEWPORTS['iPad landscape']!
    const { emma } = greetLayout(v)
    expect(emma.x + emma.width).toBeLessThanOrEqual(v.width / 2)
  })

  it('Math perches Emma in the upper-left', () => {
    const v = VIEWPORTS['phone portrait']!
    const { emma } = mathLayout(v)
    const safe = safeRect(v)
    expect(emma.x).toBeLessThan(safe.x + safe.width / 2)
    expect(emma.y).toBeLessThan(safe.y + safe.height / 3)
  })
})
