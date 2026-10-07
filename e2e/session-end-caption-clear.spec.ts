/**
 * Session end — Emma's caption never covers a button.
 *
 * Bug (production 15426e5, iPad): on the good-day screen the two-line
 * "It sleeps tonight. Come back tomorrow for one more." ribbon sat on
 * top of the All done button. The ribbon was pinned to the bottom of the
 * screen outside the layout, so nothing kept the buttons above it.
 *
 * Guard: for every session-end guidance line (guide.end.*) at both iPad
 * portrait sizes the suite uses, an in-page monitor checks every
 * animation frame that the caption ribbon's box does not intersect any
 * visible button's box, and the settled screen is checked once more.
 *
 *  1. good day → right.8, flower, count.2, sleeps (the reported screen)
 *  2. first good day → count.1, sleeps
 *     (`guide.end.right.7` is not reachable by tapping — only a guided
 *     problem withholds a point — and it is the same length as right.8.)
 *  3. not-yet day → not-yet.praise, not-yet.again (Again + Home)
 *  4. 3rd good day → count.3, path-opens
 *  5. last step of the world → world-done
 *
 * Sessions are played for real on the offline fallback plan
 * (`failNetwork: true`). With END_CAPTION_SHOTS=before|after the sleeps
 * and not-yet screens are saved to design/emmas-path/screens/ (chromium).
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
/** Set to `before` / `after` to save the PR's comparison screenshots. */
const SHOT_TAG = process.env.END_CAPTION_SHOTS

const VIEWPORTS = [
  { width: 810, height: 1080 },
  { width: 820, height: 1180 },
] as const

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

function mathLevels(current: number): Record<string, string> {
  return Object.fromEntries(
    MATH.map((n, i) => [
      n,
      i < current ? 'mastered' : i === current ? 'practicing' : 'locked',
    ]),
  )
}

function pastDayISO(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

/** Math current = MATH[current]; `goodDaysBefore` prior 100 % days on it. */
function seedProgress(current: number, goodDaysBefore: number): unknown {
  const node = MATH[current]
  const base = buildSeedProgress({
    skillLevelOverrides: mathLevels(current),
    history: Array.from({ length: goodDaysBefore }, (_, i) => ({
      dateISO: pastDayISO(goodDaysBefore - i),
      skillFocus: [node],
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
 * Every frame: the caption ribbon's box against each visible button on
 * the session-end screen. Records the captions seen and any overlap.
 */
function installOverlapMonitor(): void {
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
    const ribbon = document.querySelector('[data-testid="session-end-ribbon"]')
    if (ribbon && visible(ribbon)) {
      const text = ribbon.textContent?.trim() ?? ''
      if (text && !w.__captionsSeen.includes(text)) w.__captionsSeen.push(text)
      const c = ribbon.getBoundingClientRect()
      document
        .querySelectorAll('[data-testid="session-end"] button')
        .forEach((b) => {
          if (!visible(b)) return
          const r = b.getBoundingClientRect()
          const hit =
            r.left < c.right &&
            c.left < r.right &&
            r.top < c.bottom &&
            c.top < r.bottom
          if (
            hit &&
            !w.__captionOverlaps.some(
              (o) => o.caption === text && o.button === b.ariaLabel,
            )
          )
            w.__captionOverlaps.push({
              caption: text,
              button: b.ariaLabel ?? '?',
            })
        })
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

async function arm(page: Page, progress: unknown): Promise<void> {
  await page.addInitScript(installOverlapMonitor)
  await installClaudeMock(page, { failNetwork: true })
  await seedLocalStorage(page, {
    progress,
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    seedOnce: true,
  })
}

async function playNumberGarden(page: Page) {
  await page.goto('/')
  await forceHowlerUnlock(page)
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  await page
    .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
    .click()
  await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })
  for (let i = 1; i <= 8; i++) {
    const correct = page.locator(
      '[data-testid="math-chip"][data-correct="true"]',
    )
    await expect(correct).toBeEnabled({ timeout: 15_000 })
    await correct.click()
    if (i < 8) await page.waitForTimeout(1500)
  }
  await expect(page.getByTestId('session-end')).toBeVisible({
    timeout: 10_000,
  })
}

const caption = (page: Page) => page.getByTestId('session-end-caption')

/** Settled screen: the ribbon box clears every button box (with a gap). */
async function expectSettledClear(page: Page): Promise<void> {
  await expect(page.getByTestId('session-end')).toHaveAttribute(
    'data-phase',
    'settled',
    { timeout: 25_000 },
  )
  await page.waitForTimeout(600)
  const ribbon = await page.getByTestId('session-end-ribbon').boundingBox()
  expect(ribbon).not.toBeNull()
  const buttons = page.getByTestId('session-end').locator('button')
  const n = await buttons.count()
  expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) {
    const b = await buttons.nth(i).boundingBox()
    expect(b).not.toBeNull()
    // The caption sits below the buttons, clear of the button's slab.
    expect(b!.y + b!.height).toBeLessThanOrEqual(ribbon!.y)
  }
  // The ribbon stays on screen.
  const vp = page.viewportSize()!
  expect(ribbon!.y + ribbon!.height).toBeLessThanOrEqual(vp.height)
}

async function expectNoOverlap(page: Page, lines: string[]): Promise<void> {
  const seen = await page.evaluate(
    () => (window as unknown as { __captionsSeen: string[] }).__captionsSeen,
  )
  for (const l of lines) expect(seen).toContain(l)
  const overlaps = await page.evaluate(
    () =>
      (window as unknown as { __captionOverlaps: Overlap[] }).__captionOverlaps,
  )
  expect(overlaps).toEqual([])
}

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOT_TAG || test.info().project.name !== 'chromium') return
  await page.waitForTimeout(500)
  const w = page.viewportSize()!.width
  await page.screenshot({
    path: `${SHOTS}/end-caption-overlap-${name}-${w}-${SHOT_TAG}.png`,
  })
}

for (const vp of VIEWPORTS) {
  test.describe(`session-end caption clear of buttons @ ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp })

    test('1. good day: "It sleeps tonight…" never covers All done', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      await arm(page, seedProgress(1, 1))
      await playNumberGarden(page)
      await expect(caption(page)).toHaveText(
        'It sleeps tonight. Come back tomorrow for one more.',
        { timeout: 15_000 },
      )
      await expect(page.getByTestId('session-end-cta')).toBeVisible()
      await shot(page, 'sleeps')
      await expectSettledClear(page)
      await expectNoOverlap(page, [
        'Eight right! You worked hard!',
        'You got a flower!',
        'Two of three!',
        'It sleeps tonight. Come back tomorrow for one more.',
      ])
    })

    test('2. first good day: "One of three!"', async ({ page }) => {
      test.setTimeout(120_000)
      await arm(page, seedProgress(1, 0))
      await playNumberGarden(page)
      await expectSettledClear(page)
      await expectNoOverlap(page, [
        'You got a flower!',
        'One of three!',
        'It sleeps tonight. Come back tomorrow for one more.',
      ])
    })

    test('3. not-yet day: "Play again…" never covers Again or Home', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      await arm(page, seedProgress(1, 1))
      await page.goto('/?route=session-end')
      await forceHowlerUnlock(page)
      await expect(caption(page)).toHaveText(
        "Play again to get today's flower.",
        { timeout: 15_000 },
      )
      await expect(page.getByTestId('session-end-again')).toBeVisible()
      await shot(page, 'not-yet-again')
      await expectSettledClear(page)
      await expectNoOverlap(page, [
        'You practised hard! Good work!',
        "Play again to get today's flower.",
      ])
    })

    test('4. 3rd good day: "A new path opens. Look!"', async ({ page }) => {
      test.setTimeout(120_000)
      await arm(page, seedProgress(1, 2))
      await playNumberGarden(page)
      await expectSettledClear(page)
      await expectNoOverlap(page, [
        'Three of three!',
        'A new path opens. Look!',
      ])
    })

    test('5. last step: "You grew your whole garden!"', async ({ page }) => {
      test.setTimeout(120_000)
      await arm(page, seedProgress(MATH.length - 1, 2))
      await playNumberGarden(page)
      await expectSettledClear(page)
      await expectNoOverlap(page, ['You grew your whole garden!'])
    })
  })
}
