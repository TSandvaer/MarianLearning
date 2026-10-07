/**
 * Every screen fits iPad landscape.
 *
 * Thomas plays in iPad Safari held sideways: in a Safari tab the
 * manifest's portrait lock does not apply, and the toolbar leaves about
 * 1000-1180 × 640-680 CSS px. Portrait was the only layout the app was
 * built for, so in landscape Emma pushed the panel, chips and buttons
 * down past the bottom edge and captions landed on buttons.
 *
 * Guard, at four landscape sizes (Thomas's iPad in Safari, Safari-with-
 * toolbar for the 10th-gen iPad / iPad Air, and the iPad Pro):
 *  - every visible button is fully inside the viewport once the screen
 *    has settled, and is at least 44 px in both directions;
 *  - every visible caption ribbon is fully inside the viewport, and the
 *    page does not scroll;
 *  - an in-page monitor checks every animation frame that no visible
 *    caption ribbon intersects a visible button.
 * Screens: Greet, Hub, Map (both worlds), a Math session, a Word Song
 * session, and Session End (good day with every beat, and a not-yet day).
 *
 * With LANDSCAPE_SHOTS=before|after the 1180×680 chromium screens are
 * saved to design/emmas-path/screens/landscape-<screen>-<tag>.png.
 */
import { test, expect, type Page } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'

const SHOTS = 'design/emmas-path/screens'
const SHOT_TAG = process.env.LANDSCAPE_SHOTS

const VIEWPORTS = [
  // Thomas's iPad in Safari (screenshot 2026-10-07).
  { width: 1000, height: 670 },
  { width: 1180, height: 680 },
  { width: 1080, height: 640 },
  { width: 1366, height: 900 },
] as const

/** Full-bleed tap layers: they cover the screen on purpose. */
const FULL_BLEED = ['greet-wake-tap-target']

const MATH = [
  'number-recog',
  'add-to-10',
  'add-to-20',
  'sub-to-10',
  'sub-to-20',
  'two-digit-addsub-no-regroup',
  'two-digit-addsub-with-regroup',
  'skip-counting',
  'mult-2-5-10',
  'mult-3-4',
  'mult-6-9',
] as const

function pastDayISO(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

/**
 * Math current = MATH[current] (add-to-10 by default) with
 * `goodDaysBefore` prior 100 % days on it.
 */
function seedProgress(goodDaysBefore: number, current = 1): unknown {
  const base = buildSeedProgress({
    skillLevelOverrides: Object.fromEntries(
      MATH.map((n, i) => [
        n,
        i < current ? 'mastered' : i === current ? 'practicing' : 'locked',
      ]),
    ),
    history: Array.from({ length: goodDaysBefore }, (_, i) => ({
      dateISO: pastDayISO(goodDaysBefore - i),
      skillFocus: [MATH[current]],
      successRate: 1,
    })),
  } as Parameters<typeof buildSeedProgress>[0]) as {
    parentSettings: Record<string, unknown>
  }
  return {
    ...base,
    parentSettings: { ...base.parentSettings, showLevelToMarian: true },
  }
}

interface Overlap {
  caption: string
  button: string
}

/**
 * Every frame: each visible caption ribbon against each visible button.
 * Records the captions seen and any overlap.
 */
function installOverlapMonitor(fullBleed: string[]): void {
  const w = window as unknown as {
    __captionOverlaps: Overlap[]
    __captionsSeen: string[]
  }
  w.__captionOverlaps = []
  w.__captionsSeen = []
  const visible = (el: Element): boolean => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.display === 'none' || s.visibility === 'hidden') return false
      if (Number(s.opacity) < 0.05) return false
    }
    return true
  }
  const tick = () => {
    document.querySelectorAll('[data-testid$="-ribbon"]').forEach((ribbon) => {
      if (!visible(ribbon)) return
      const text = ribbon.textContent?.trim() ?? ''
      if (!text) return
      if (!w.__captionsSeen.includes(text)) w.__captionsSeen.push(text)
      const c = ribbon.getBoundingClientRect()
      document.querySelectorAll('button, [role="button"]').forEach((b) => {
        if (fullBleed.includes(b.getAttribute('data-testid') ?? '')) return
        if (!visible(b)) return
        const r = b.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return
        const hit =
          r.left < c.right &&
          c.left < r.right &&
          r.top < c.bottom &&
          c.top < r.bottom
        const name =
          b.getAttribute('aria-label') ??
          b.getAttribute('data-testid') ??
          b.textContent?.trim() ??
          '?'
        if (
          hit &&
          !w.__captionOverlaps.some(
            (o) => o.caption === text && o.button === name,
          )
        )
          w.__captionOverlaps.push({ caption: text, button: name })
      })
    })
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

async function arm(page: Page, progress: unknown | null): Promise<void> {
  await page.addInitScript(installOverlapMonitor, FULL_BLEED)
  await installClaudeMock(page, { failNetwork: true })
  if (progress !== null)
    await seedLocalStorage(page, {
      progress,
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
      seedOnce: true,
    })
}

interface Box {
  name: string
  testId: string
  left: number
  top: number
  right: number
  bottom: number
}

/** Every visible match of `selector`, in viewport coordinates. */
async function visibleBoxes(page: Page, selector: string): Promise<Box[]> {
  return page.evaluate(
    ([sel, fullBleed]) => {
      const visible = (el: Element): boolean => {
        for (let n: Element | null = el; n; n = n.parentElement) {
          const s = getComputedStyle(n)
          if (s.display === 'none' || s.visibility === 'hidden') return false
          if (Number(s.opacity) < 0.05) return false
        }
        return true
      }
      return [...document.querySelectorAll(sel)]
        .filter(
          (b) =>
            visible(b) &&
            !fullBleed.includes(b.getAttribute('data-testid') ?? ''),
        )
        .map((b) => {
          const r = b.getBoundingClientRect()
          return {
            name:
              b.getAttribute('aria-label') ??
              b.getAttribute('data-testid') ??
              b.textContent?.trim() ??
              '?',
            testId: b.getAttribute('data-testid') ?? '',
            left: Math.round(r.left),
            top: Math.round(r.top),
            right: Math.round(r.right),
            bottom: Math.round(r.bottom),
          }
        })
        .filter((b) => b.right > b.left && b.bottom > b.top)
    },
    [selector, FULL_BLEED] as const,
  )
}

const BUTTONS = 'button, [role="button"]'

/** Button boxes once they stop moving (entrance springs, bobbing cards). */
async function settledButtons(page: Page): Promise<Box[]> {
  let prev = JSON.stringify(await visibleBoxes(page, BUTTONS))
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(250)
    const next = JSON.stringify(await visibleBoxes(page, BUTTONS))
    if (next === prev) break
    prev = next
  }
  return JSON.parse(prev) as Box[]
}

/**
 * Settled screen: every button fully on screen and >= 44 px; every
 * caption ribbon fully on screen; the page does not scroll.
 */
async function expectFits(page: Page, minButtons = 1): Promise<void> {
  await page.waitForTimeout(800)
  const vp = page.viewportSize()!
  const buttons = await settledButtons(page)
  expect.soft(buttons.length).toBeGreaterThanOrEqual(minButtons)
  const off = buttons.filter(
    (b) =>
      b.left < 0 || b.top < 0 || b.right > vp.width || b.bottom > vp.height,
  )
  expect.soft(off, 'buttons outside the viewport').toEqual([])
  // The tappable letters of a CVC word are as wide as their glyph ("t"
  // is ~37 px) in every orientation; only their height is checked here.
  const small = buttons.filter(
    (b) =>
      (b.right - b.left < 44 && b.testId !== 'word-song-letter') ||
      b.bottom - b.top < 44,
  )
  expect.soft(small, 'buttons under 44 px').toEqual([])
  const ribbons = await visibleBoxes(page, '[data-testid$="-ribbon"]')
  const ribbonOff = ribbons.filter(
    (b) =>
      b.left < 0 || b.top < 0 || b.right > vp.width || b.bottom > vp.height,
  )
  expect.soft(ribbonOff, 'captions outside the viewport').toEqual([])
  // The page itself never scrolls.
  const scroll = await page.evaluate(() => ({
    h: document.documentElement.scrollHeight,
    w: document.documentElement.scrollWidth,
  }))
  expect.soft(scroll.h).toBeLessThanOrEqual(vp.height)
  expect.soft(scroll.w).toBeLessThanOrEqual(vp.width)
}

async function expectNoOverlap(page: Page, lines: string[] = []) {
  const seen = await page.evaluate(
    () => (window as unknown as { __captionsSeen: string[] }).__captionsSeen,
  )
  for (const l of lines) expect.soft(seen).toContain(l)
  const overlaps = await page.evaluate(
    () =>
      (window as unknown as { __captionOverlaps: Overlap[] }).__captionOverlaps,
  )
  expect.soft(overlaps, 'captions over buttons').toEqual([])
}

interface Rect {
  name: string
  l: number
  t: number
  r: number
  b: number
}

/**
 * Map, settled: no two stops overlap; Emma's badge clears every stop and
 * gate; the current stop's bud tray clears every stop and gate; the
 * caption clears all of them. Thomas's iPad (2026-10-07): in landscape the
 * bands were so short that the tray sat on the stop below, the stop above
 * hid Emma, and the caption covered the bottom land. Then (same day) the
 * current stop's pot still hid her body, and the standing art has no
 * legs: a "you are here" badge marks her stop instead. The whole badge,
 * tail included, must clear her own stop, its pot art and its bud tray,
 * sit fully inside the viewport, and stay >= 56 px across.
 */
async function expectMapClear(page: Page): Promise<void> {
  const found = await page.evaluate(() => {
    const rect = (e: Element, name: string) => {
      const r = e.getBoundingClientRect()
      return { name, l: r.left, t: r.top, r: r.right, b: r.bottom }
    }
    const all = (sel: string, name: (e: Element) => string) =>
      [...document.querySelectorAll(sel)].map((e) => rect(e, name(e)))
    const current = document
      .querySelector('[data-testid="map"]')
      ?.getAttribute('data-current')
    const stops = all(
      '[data-testid="map-stop"]',
      (e) => `stop ${e.getAttribute('data-node')}`,
    )
    const gates = all(
      '[data-testid="map-gate"]',
      (e) => `gate ${e.getAttribute('data-land')}`,
    )
    const trays = all('[data-testid="map-buds"]', () => 'bud tray')
    const ribbons = all('[data-testid="map-ribbon"]', () => 'caption')
    // Her whole badge: circle + tail.
    const emmaBox = all('[data-testid="map-emma"]', () => 'emma badge')
    // The circle alone (its diameter is the face's size).
    const circle = all('[data-testid="map-emma-badge"]', () => 'emma circle')
    // The current stop and its pot art (the sticker image).
    const own = all(
      `[data-testid="map-stop"][data-node="${current}"]`,
      () => 'current stop',
    )
    const ownArt = all(
      `[data-testid="map-stop"][data-node="${current}"] [data-testid="map-stop-sticker"] img`,
      () => 'current stop art',
    )
    return {
      current,
      stops,
      gates,
      trays,
      ribbons,
      emmaBox,
      circle,
      own,
      ownArt,
      vw: window.innerWidth,
      vh: window.innerHeight,
    }
  })
  const hit = (a: Rect, c: Rect) =>
    a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b
  const clashes: string[] = []
  const check = (as: Rect[], cs: Rect[], skip?: (c: Rect) => boolean) => {
    for (const a of as)
      for (const c of cs)
        if (a !== c && !skip?.(c) && hit(a, c))
          clashes.push(`${a.name} × ${c.name}`)
  }
  const { stops, gates, trays, ribbons, emmaBox, circle, own, ownArt } = found
  const emma = emmaBox
  expect(stops.length).toBeGreaterThan(0)
  expect(trays.length).toBe(1)
  expect(emma.length).toBe(1)
  expect(circle.length).toBe(1)
  expect(own.length).toBe(1)
  expect(ownArt.length).toBe(1)
  check(stops, stops)
  check(emma, stops)
  check(emma, gates)
  // Fully visible: nothing at her stop covers any part of her box.
  const ownClashes: string[] = []
  for (const c of [...own, ...ownArt, ...trays])
    if (hit(emmaBox[0]!, c)) ownClashes.push(`emma box × ${c.name}`)
  expect.soft(ownClashes, 'Emma covered at her stop').toEqual([])
  // Fully inside the viewport, and big enough to recognise her face.
  const e = emmaBox[0]!
  expect.soft(e.l, 'badge left').toBeGreaterThanOrEqual(0)
  expect.soft(e.t, 'badge top').toBeGreaterThanOrEqual(0)
  expect.soft(e.r, 'badge right').toBeLessThanOrEqual(found.vw)
  expect.soft(e.b, 'badge bottom').toBeLessThanOrEqual(found.vh)
  const c = circle[0]!
  expect.soft(c.r - c.l, 'badge diameter').toBeGreaterThanOrEqual(56)
  check(trays, [...stops, ...gates])
  check(ribbons, [...stops, ...gates, ...trays, ...emma])
  expect.soft(clashes, 'map pieces overlapping').toEqual([])
  // Stops stay tappable after the landscape scale-down.
  for (const st of stops) {
    expect.soft(st.r - st.l, st.name).toBeGreaterThanOrEqual(44)
  }
}

async function shot(page: Page, name: string): Promise<void> {
  const vp = page.viewportSize()!
  if (!SHOT_TAG || test.info().project.name !== 'chromium') return
  if (vp.width !== 1180) return
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/landscape-${name}-${SHOT_TAG}.png` })
}

async function openHub(page: Page): Promise<void> {
  await page.goto('/')
  await forceHowlerUnlock(page)
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
}

async function playToEnd(
  page: Page,
  screen: 'math' | 'word-song',
): Promise<void> {
  const chip =
    screen === 'math'
      ? '[data-testid="math-chip"][data-correct="true"]'
      : '[data-testid="word-song-chip"][data-correct="true"]'
  for (let i = 1; i <= 8; i++) {
    const correct = page.locator(chip)
    await expect(correct).toBeEnabled({ timeout: 15_000 })
    // Mid-session the screen must fit too (checked on the first problem).
    if (i === 1) {
      await shot(page, screen)
      await expectFits(page, 3)
    }
    await correct.click()
    if (i < 8) await page.waitForTimeout(1500)
  }
  await expect(page.getByTestId('session-end')).toBeVisible({
    timeout: 10_000,
  })
}

for (const vp of VIEWPORTS) {
  test.describe(`landscape fit @ ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp })

    test('Greet', async ({ page }) => {
      test.setTimeout(120_000)
      await arm(page, null)
      await page.goto('/')
      await expect(page.getByTestId('greet')).toBeVisible({ timeout: 10_000 })
      await forceHowlerUnlock(page)
      // Wake tap, then Emma's intro lines walk and the heart comes in.
      // The wake tap can land before the gate is listening; tap until the
      // intro starts.
      await expect(async () => {
        if (await page.getByTestId('greet-ribbon').isVisible()) return
        await page.getByTestId('greet-wake-tap-target').click({ timeout: 2000 })
        await expect(page.getByTestId('greet-ribbon')).toBeVisible({
          timeout: 3000,
        })
      }).toPass({ timeout: 30_000 })
      await expect(page.getByTestId('greet-heart')).toBeVisible({
        timeout: 60_000,
      })
      await shot(page, 'greet')
      await expectFits(page, 1)
      await expectNoOverlap(page)
    })

    test('Hub', async ({ page }) => {
      await arm(page, seedProgress(1))
      await openHub(page)
      await page.waitForTimeout(4000)
      await shot(page, 'hub')
      await expectFits(page, 4)
      await expectNoOverlap(page)
    })

    const maps = [
      // Thomas's screenshot: current stop on land 2.
      { world: 'math', current: 1, name: 'map-math' },
      // Five lands, current stop on the bottom land (bud tray below it).
      { world: 'word-song', current: 1, name: 'map-word-song' },
      // Current stop on the top land (Emma's badge above it).
      { world: 'math', current: MATH.length - 1, name: 'map-math-top' },
    ] as const
    for (const { world, current, name } of maps) {
      test(`Map (${name})`, async ({ page }) => {
        await arm(page, seedProgress(1, current))
        await openHub(page)
        await page
          .locator(`[data-testid="hub-map-button"][data-world="${world}"]`)
          .click()
        await expect(page.getByTestId('map')).toBeVisible({ timeout: 5_000 })
        await expect(page.getByTestId('map')).toHaveCSS('opacity', '1')
        await page.waitForTimeout(3000)
        await shot(page, name)
        await expectFits(page, 2)
        await expectMapClear(page)
        await expectNoOverlap(page)
      })
    }

    test('Math session → Session End (good day, every beat)', async ({
      page,
    }) => {
      test.setTimeout(150_000)
      await arm(page, seedProgress(1))
      await openHub(page)
      await page
        .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
        .click()
      await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })
      await playToEnd(page, 'math')
      await expect(page.getByTestId('session-end-caption')).toHaveText(
        'It sleeps tonight. Come back tomorrow for one more.',
        { timeout: 15_000 },
      )
      await expect(page.getByTestId('session-end')).toHaveAttribute(
        'data-phase',
        'settled',
        { timeout: 25_000 },
      )
      await shot(page, 'session-end')
      await expectFits(page, 1)
      await expectNoOverlap(page, [
        'Eight right! You worked hard!',
        'You got a flower!',
        'Two of three!',
        'It sleeps tonight. Come back tomorrow for one more.',
      ])
    })

    test('Session End (not-yet day: Again + Home)', async ({ page }) => {
      test.setTimeout(90_000)
      await arm(page, seedProgress(1))
      await page.goto('/?route=session-end')
      await forceHowlerUnlock(page)
      await expect(page.getByTestId('session-end-caption')).toHaveText(
        "Play again to get today's flower.",
        { timeout: 15_000 },
      )
      await expect(page.getByTestId('session-end')).toHaveAttribute(
        'data-phase',
        'settled',
        { timeout: 25_000 },
      )
      await shot(page, 'session-end-not-yet')
      await expectFits(page, 2)
      await expectNoOverlap(page, [
        'You practised hard! Good work!',
        "Play again to get today's flower.",
      ])
    })

    test('Word Song session', async ({ page }) => {
      test.setTimeout(150_000)
      await arm(page, seedProgress(1))
      await openHub(page)
      await page
        .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
        .click()
      await expect(page.getByTestId('word-song')).toBeVisible({
        timeout: 10_000,
      })
      await playToEnd(page, 'word-song')
      await expectNoOverlap(page)
    })
  })
}
