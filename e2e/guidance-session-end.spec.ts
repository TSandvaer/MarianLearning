/**
 * Guidance G2 (ClickUp 123jpnbca4t) — session-end guidance in clay.
 * Reference: design/emmas-path/redesign/guidance-mockup.html screens
 * b / e / e2 / f; team/DECISIONS.md "2026-10-06 — Guidance layer approved".
 *
 *  1. Good day → effort praise, the new flower flies into its slot,
 *     "2 of 3", "It sleeps tonight. Come back tomorrow for one more.";
 *     All done → Hub.
 *  2. 3rd good day → "3 of 3!", "A new path opens. Look!"; All done →
 *     the map's unlock beat (#504, on the clay map from #509).
 *  3. Not-yet day (5/8) → warm praise, tray untouched, "Play again to get
 *     today's flower." once; Again starts a new session; a second not-yet
 *     session the same day gets the practice line only; Home → Hub.
 *  4. Same-day replay after today's flower → practice praise, no new
 *     flower, today's flower still asleep.
 *  5. Reload mid-celebration → nothing replays and nothing is lost: the
 *     session is recorded once, and the unlock still plays once on the map.
 *
 * Sessions are played for real on the offline fallback plan
 * (`failNetwork: true`). Emma's lines are observed at the line-player
 * boundary (`window.__mapLinePlays`). Screenshots (820×1180) go to
 * design/emmas-path/screens/ for the PR.
 */
import { test, expect, type Page } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'

test.use({ viewport: { width: 820, height: 1180 } })

const SHOTS = 'design/emmas-path/screens'

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

/** Mastered before `current`, practicing at it, locked after. */
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

/**
 * Math current = add-to-10 with `goodDaysBefore` earlier 100 % days, plus
 * one 100 % session earlier today when `earnedToday`.
 */
function seedProgress(goodDaysBefore: number, earnedToday = false): unknown {
  const node = 'add-to-10'
  const history = Array.from({ length: goodDaysBefore }, (_, i) => ({
    dateISO: pastDayISO(goodDaysBefore - i),
    skillFocus: [node],
    successRate: 1,
  }))
  if (earnedToday) {
    const d = new Date()
    d.setMinutes(d.getMinutes() - 5)
    history.push({
      dateISO: d.toISOString(),
      skillFocus: [node],
      successRate: 1,
    })
  }
  const base = buildSeedProgress({
    skillLevelOverrides: mathLevels(1),
    history,
  } as Parameters<typeof buildSeedProgress>[0]) as {
    parentSettings: Record<string, unknown>
  }
  return {
    ...base,
    parentSettings: { ...base.parentSettings, showLevelToMarian: true },
  }
}

async function arm(page: Page, progress: unknown): Promise<void> {
  await installClaudeMock(page, { failNetwork: true })
  // seedOnce: reloads keep what the app saved.
  await seedLocalStorage(page, {
    progress,
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    seedOnce: true,
  })
}

async function openNumberGarden(page: Page): Promise<void> {
  await page.goto('/')
  await forceHowlerUnlock(page)
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  await page
    .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
    .click()
}

/**
 * Play the 8 problems already on screen; problems in `wrongFirst`
 * (1-based) get a wrong first tap, then the right one.
 */
async function playMath(page: Page, wrongFirst: number[] = []): Promise<void> {
  await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })
  for (let i = 1; i <= 8; i++) {
    if (wrongFirst.includes(i)) {
      const wrong = page
        .locator('[data-testid="math-chip"][data-correct="false"]')
        .first()
      await expect(wrong).toBeEnabled({ timeout: 15_000 })
      await wrong.click()
    }
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

const linePlays = (page: Page) =>
  page.evaluate(() =>
    (
      (window as unknown as { __mapLinePlays?: { id: string }[] })
        .__mapLinePlays ?? []
    ).map((r) => r.id),
  )
const endLines = async (page: Page) =>
  (await linePlays(page)).filter((id) => id.startsWith('guide.end.'))

const slots = (page: Page) =>
  page
    .getByTestId('session-end-slot')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-slot')))

const caption = (page: Page) => page.getByTestId('session-end-caption')

async function waitSettled(page: Page): Promise<void> {
  await expect(page.getByTestId('session-end')).toHaveAttribute(
    'data-phase',
    'settled',
    { timeout: 25_000 },
  )
}

const historyLength = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('marian-tutor:progress:v1')
    return raw ? (JSON.parse(raw) as { history: unknown[] }).history.length : 0
  })

test.describe('Guidance G2 — session end', () => {
  test('1. good day: praise → flower flies in → "2 of 3" → sleeps tonight; All done → Hub', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await arm(page, seedProgress(1))
    await openNumberGarden(page)
    await playMath(page)

    const end = page.getByTestId('session-end')
    await expect(end).toHaveAttribute('data-day', 'good-day')
    await expect(caption(page)).toHaveText('Eight right! You worked hard!')
    expect(await slots(page)).toEqual(['grown', 'empty', 'empty'])
    await expect(page.getByTestId('session-end-cta')).toHaveCount(0)
    await page.screenshot({ path: `${SHOTS}/g2-end-b-praise.png` })

    // The flower pops in, then flies to slot 2.
    const flower = page.getByTestId('session-end-new-flower')
    await expect(flower).toBeVisible({ timeout: 6_000 })
    await expect(caption(page)).toHaveText('You got a flower!')
    await expect(flower).toHaveAttribute('data-stage', 'fly', {
      timeout: 3_000,
    })
    await page.waitForTimeout(350)
    await page.screenshot({ path: `${SHOTS}/g2-end-b-flower-flying.png` })

    await expect(page.getByTestId('session-end-count')).toHaveText('2 of 3', {
      timeout: 4_000,
    })
    expect(await slots(page)).toEqual(['grown', 'sleeping', 'empty'])
    await expect(caption(page)).toHaveText(
      'It sleeps tonight. Come back tomorrow for one more.',
      { timeout: 6_000 },
    )
    await expect(page.getByTestId('session-end-cta')).toBeVisible()
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SHOTS}/g2-end-b-sleeps.png` })

    await waitSettled(page)
    expect(await endLines(page)).toEqual([
      'guide.end.right.8',
      'guide.end.flower',
      'guide.end.count.2',
      'guide.end.sleeps',
    ])
    // No stardust total anywhere on the screen.
    await expect(page.getByTestId('stardust-counter')).toHaveCount(0)
    await expect(
      page.getByTestId('session-end-stars').locator('svg'),
    ).toHaveCount(8)

    await page.getByTestId('session-end-cta').click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  })

  test('2. 3rd good day: "3 of 3!" + "A new path opens. Look!"; All done → map unlock beat', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await arm(page, seedProgress(2))
    await openNumberGarden(page)
    await playMath(page)

    const end = page.getByTestId('session-end')
    await expect(end).toHaveAttribute('data-day', 'unlock')
    expect(await slots(page)).toEqual(['grown', 'grown', 'empty'])
    await expect(page.getByTestId('session-end-count')).toHaveText('3 of 3!', {
      timeout: 10_000,
    })
    expect(await slots(page)).toEqual(['grown', 'grown', 'grown'])
    await expect(caption(page)).toHaveText('A new path opens. Look!', {
      timeout: 6_000,
    })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SHOTS}/g2-end-e-three-of-three.png` })
    await waitSettled(page)
    expect(await endLines(page)).toEqual([
      'guide.end.right.8',
      'guide.end.flower',
      'guide.end.count.3',
      'guide.end.path-opens',
    ])

    await page.getByTestId('session-end-cta').click()
    const map = page.getByTestId('map')
    await expect(map).toBeVisible({ timeout: 10_000 })
    await expect(map).toHaveAttribute('data-beat', 'unlock')
    await expect(map).toHaveAttribute('data-beat-phase', 'cheer', {
      timeout: 8_000,
    })
    await expect(page.getByTestId('map-ribbon')).toHaveAttribute(
      'data-line-id',
      'end.unlock.add-to-20',
    )
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SHOTS}/g2-end-e2-map-unlock.png` })
  })

  test('3. not-yet day: warm praise, tray untouched, "Play again…" at most once a day; Again → a real session that earns today’s flower', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await arm(page, seedProgress(1))
    // The QA route mounts SessionEnd with the zero payload (0 of 8) — a
    // not-yet day for the seeded focus step.
    await page.goto('/?route=session-end')
    await forceHowlerUnlock(page)

    const end = page.getByTestId('session-end')
    await expect(end).toHaveAttribute('data-day', 'not-yet', {
      timeout: 10_000,
    })
    await expect(page.getByTestId('session-end-emma')).toHaveAttribute(
      'src',
      '/assets/emma-idle.svg',
    )
    await expect(caption(page)).toHaveText('You practised hard! Good work!')
    await expect(caption(page)).toHaveText(
      "Play again to get today's flower.",
      { timeout: 6_000 },
    )
    await expect(page.getByTestId('session-end-again')).toBeVisible()
    await expect(page.getByTestId('session-end-cta')).toHaveAttribute(
      'aria-label',
      'Home',
    )
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SHOTS}/g2-end-f-not-yet.png` })
    await waitSettled(page)
    expect(await slots(page)).toEqual(['grown', 'empty', 'empty'])
    await expect(page.getByTestId('session-end-new-flower')).toHaveCount(0)
    await expect(page.getByTestId('session-end-count')).toHaveCount(0)
    expect(await endLines(page)).toEqual([
      'guide.end.not-yet.praise',
      'guide.end.not-yet.again',
    ])
    const text = ((await end.textContent()) ?? '').toLowerCase()
    for (const bad of ['wrong', 'failed', 'oops', '✗', '❌']) {
      expect(text).not.toContain(bad)
    }

    // A second not-yet session the same day: the practice line only.
    await page.goto('/?route=session-end')
    await forceHowlerUnlock(page)
    await expect(end).toHaveAttribute('data-day', 'not-yet', {
      timeout: 10_000,
    })
    await waitSettled(page)
    expect(await endLines(page)).toEqual(['guide.end.not-yet.praise'])
    await expect(caption(page)).toHaveText('You practised hard! Good work!')
    await expect(page.getByTestId('session-end-again')).toBeVisible()

    // Again → a new Number Garden session straight from session end; a
    // good one earns today's flower after all.
    await page.getByTestId('session-end-again').click()
    await playMath(page)
    await expect(end).toHaveAttribute('data-day', 'good-day')
    await expect(page.getByTestId('session-end-count')).toHaveText('2 of 3', {
      timeout: 12_000,
    })
    await waitSettled(page)
    await page.getByTestId('session-end-cta').click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  })

  test('4. same-day replay after today’s flower: practice praise, no new flower, flower still asleep', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await arm(page, seedProgress(1, true))
    await openNumberGarden(page)
    await playMath(page)

    const end = page.getByTestId('session-end')
    await expect(end).toHaveAttribute('data-day', 'practice')
    await expect(caption(page)).toHaveText('You practised hard! Good work!')
    await waitSettled(page)
    expect(await slots(page)).toEqual(['grown', 'sleeping', 'empty'])
    await expect(page.getByTestId('session-end-new-flower')).toHaveCount(0)
    await expect(page.getByTestId('session-end-count')).toHaveCount(0)
    await expect(page.getByTestId('session-end-cta')).toHaveAttribute(
      'aria-label',
      'All done!',
    )
    await expect(page.getByTestId('session-end-again')).toHaveCount(0)
    expect(await endLines(page)).toEqual(['guide.end.not-yet.praise'])
    await page.screenshot({ path: `${SHOTS}/g2-end-practice.png` })
  })

  test('5. reload mid-celebration: nothing replays, nothing is lost (session saved once; the unlock still plays once)', async ({
    page,
  }) => {
    test.setTimeout(150_000)
    await arm(page, seedProgress(2))
    await openNumberGarden(page)
    await playMath(page)
    await expect(page.getByTestId('session-end')).toHaveAttribute(
      'data-day',
      'unlock',
    )
    await expect(page.getByTestId('session-end-new-flower')).toBeVisible({
      timeout: 6_000,
    })
    const saved = await historyLength(page)

    await page.reload()
    await forceHowlerUnlock(page)
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('session-end')).toHaveCount(0)
    await page.waitForTimeout(2_000)
    expect(await endLines(page)).toEqual([])
    expect(await historyLength(page)).toBe(saved)

    // Never lost: the map still plays the unlock beat, once.
    await page
      .locator('[data-testid="hub-map-button"][data-world="math"]')
      .click()
    const map = page.getByTestId('map')
    await expect(map).toBeVisible({ timeout: 10_000 })
    await expect(map).toHaveAttribute('data-beat', 'unlock')
    await expect(map).toHaveAttribute('data-beat-phase', 'cheer', {
      timeout: 8_000,
    })
    await page.getByTestId('map-back').click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    await page.reload()
    await forceHowlerUnlock(page)
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-map-button"][data-world="math"]')
      .click()
    await expect(map).toBeVisible({ timeout: 10_000 })
    await expect(map).toHaveAttribute('data-beat', 'none')
  })
})
