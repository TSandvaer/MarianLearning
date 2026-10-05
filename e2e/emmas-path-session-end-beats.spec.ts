/**
 * Emma's Path 9/10 (ClickUp 123jpnbc3dt) — session-end progress beats.
 * Spec: design/emmas-path/emmas-path-spec.md §6 (flow), §4.4 (lines), §7.
 *
 *  1. Good day → SessionEnd shows the bud beat (focus stop + a new open
 *     bud) and Emma says `end.bud.{node}`; "All done" → Hub as before.
 *  2. Unlock → "All done" goes to the MAP: Emma starts on the mastered
 *     stop, hops, the padlock pops and she says `end.unlock.{new}`.
 *  3. Land gate → as 2, plus the gate swings and the line is
 *     `end.land.{world}.{n}`.
 *  4. Bad day → no bud, no beat line, "All done" → Hub (never a negative
 *     beat).
 *  5. One-shot → after a reload neither the Hub nor the map replays the
 *     unlock.
 *
 * Sessions are played for real (8 correct math taps on the offline
 * fallback plan, `failNetwork: true`); the session's focus step is the
 * seeded current step. Audio is observed at the line-player boundary
 * (`window.__mapLinePlays`). Screenshots (820×1180) go to
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
  // Land numbers shown (the production default; the seed helper's is off).
  return {
    ...base,
    parentSettings: { ...base.parentSettings, showLevelToMarian: true },
  }
}

async function arm(page: Page, progress: unknown): Promise<void> {
  await installClaudeMock(page, { failNetwork: true })
  // seedOnce: the reload in test 5 must keep what the app saved.
  await seedLocalStorage(page, {
    progress,
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    seedOnce: true,
  })
}

/** Hub → Number Garden → 8 correct taps → SessionEnd. */
async function playGoodMathSession(page: Page): Promise<void> {
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

async function tapAllDone(page: Page): Promise<void> {
  const cta = page.getByTestId('session-end-cta')
  await expect(cta).toBeVisible({ timeout: 20_000 })
  await cta.click()
}

const linePlays = (page: Page) =>
  page.evaluate(() =>
    (
      (window as unknown as { __mapLinePlays?: { id: string }[] })
        .__mapLinePlays ?? []
    ).map((r) => r.id),
  )

/** Session-end caption: one span per word, so join the words. */
const captionWords = (page: Page) =>
  page
    .getByTestId('session-end-caption-word')
    .allTextContents()
    .then((w) => w.join(' '))

/**
 * Record every `data-beat-phase` the map walks through (a MutationObserver
 * sees each phase, however short) — installed before the map mounts.
 */
async function recordBeatPhases(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __beatPhases: string[] }
    w.__beatPhases = []
    const seen = (el: Element | null) => {
      const phase = el?.getAttribute('data-beat-phase')
      if (phase && w.__beatPhases.at(-1) !== phase) w.__beatPhases.push(phase)
    }
    new MutationObserver(() =>
      seen(document.querySelector('[data-testid="map"]')),
    ).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-beat-phase'],
    })
  })
}
const beatPhases = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __beatPhases?: string[] }).__beatPhases ?? [],
  )

/** Wait (rAF polling) until the map reaches `phase` — short phases too. */
async function untilPhase(page: Page, phase: string): Promise<void> {
  await page.waitForFunction(
    (p) =>
      document
        .querySelector('[data-testid="map"]')
        ?.getAttribute('data-beat-phase') === p,
    phase,
    { polling: 'raf', timeout: 5_000 },
  )
}

const stop = (page: Page, node: string) =>
  page.locator(`[data-testid="map-stop"][data-node="${node}"]`)

test.describe("Emma's Path session-end beats", () => {
  test('1. good day → bud beat on SessionEnd + end.bud line; All done → Hub', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await arm(page, seedProgress(1, 0)) // add-to-10, no good days yet
    await playGoodMathSession(page)

    const beat = page.getByTestId('session-end-bud-beat')
    await expect(beat).toBeVisible({ timeout: 15_000 })
    await expect(beat).toHaveAttribute('data-node', 'add-to-10')
    await expect(page.getByTestId('session-end')).toHaveAttribute(
      'data-path-beat',
      'bud',
    )
    const buds = page.getByTestId('session-end-bud')
    await expect(buds).toHaveCount(3)
    await expect(
      page.locator('[data-testid="session-end-bud"][data-open="true"]'),
    ).toHaveCount(1)
    await expect(
      page.locator('[data-testid="session-end-bud"][data-new="true"]'),
    ).toHaveCount(1)
    await expect
      .poll(() => linePlays(page), { timeout: 5_000 })
      .toContain('end.bud.add-to-10')
    await expect
      .poll(() => captionWords(page))
      .toBe('Look! A new flower for adding to ten!')
    await page.waitForTimeout(800) // bud pop settles
    await page.screenshot({ path: `${SHOTS}/end-bud-beat.png` })

    await tapAllDone(page)
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('hub')).toHaveAttribute(
      'data-path',
      'session-end',
    )
    // Exactly one bud line for the session.
    expect(
      (await linePlays(page)).filter((id) => id.startsWith('end.')),
    ).toEqual(['end.bud.add-to-10'])
  })

  test('2. unlock → All done opens the map: hop, padlock pop, end.unlock line — and 5. a reload never replays it', async ({
    page,
  }) => {
    test.setTimeout(150_000)
    await arm(page, seedProgress(1, 2)) // third good day masters add-to-10
    await playGoodMathSession(page)

    await expect(page.getByTestId('session-end')).toHaveAttribute(
      'data-path-beat',
      'unlock',
    )
    await expect(page.getByTestId('session-end-bud-beat')).toHaveCount(0)
    await recordBeatPhases(page)
    await tapAllDone(page)

    const map = page.getByTestId('map')
    await expect(map).toBeVisible({ timeout: 10_000 })
    await expect(map).toHaveAttribute('data-world', 'math')
    await expect(map).toHaveAttribute('data-beat', 'unlock')
    await expect(page.getByTestId('hub')).toHaveCount(0)

    await untilPhase(page, 'pop')
    await expect(page.getByTestId('map-padlock-pop')).toHaveCount(1)
    await page.screenshot({ path: `${SHOTS}/end-unlock-pop.png` })

    await expect(map).toHaveAttribute('data-beat-phase', 'cheer', {
      timeout: 5_000,
    })
    await expect(page.getByTestId('map-emma')).toHaveAttribute(
      'data-node',
      'add-to-20',
    )
    expect(await beatPhases(page)).toEqual(['bloom', 'hop', 'pop', 'cheer'])
    await expect(stop(page, 'add-to-20')).toHaveAttribute(
      'data-state',
      'current',
    )
    await expect(page.getByTestId('map-ribbon')).toHaveAttribute(
      'data-line-id',
      'end.unlock.add-to-20',
    )
    await expect(page.getByTestId('map-ribbon')).toHaveText(
      'You learned adding to ten! Now you can do adding to twenty!',
    )
    await expect
      .poll(() => linePlays(page), { timeout: 5_000 })
      .toContain('end.unlock.add-to-20')
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${SHOTS}/end-unlock-line.png` })

    // Home → Hub: no unlock overlay on the Hub either.
    await page.getByTestId('map-back').click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('hub-promotion-celebration')).toHaveCount(0)
    await expect(page.getByTestId('hub-emma')).toHaveCount(1)

    // 5. Reload: Hub plain, the map opens with the normal line, no beat.
    await page.reload()
    await forceHowlerUnlock(page)
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('hub-promotion-celebration')).toHaveCount(0)
    await page
      .locator('[data-testid="hub-map-button"][data-world="math"]')
      .click()
    await expect(map).toBeVisible({ timeout: 5_000 })
    await expect(map).toHaveAttribute('data-beat', 'none')
    await expect(page.getByTestId('map-ribbon')).toHaveAttribute(
      'data-line-id',
      'path.open.add-to-20',
    )
    await page.waitForTimeout(2_500)
    expect(
      (await linePlays(page)).filter((id) => id.startsWith('end.')),
    ).toEqual([])
  })

  test('3. a land gate opening → gate swings + end.land line', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await arm(page, seedProgress(4, 2)) // sub-to-20 → opens land 3
    await playGoodMathSession(page)
    await recordBeatPhases(page)
    await tapAllDone(page)

    const map = page.getByTestId('map')
    await expect(map).toBeVisible({ timeout: 10_000 })
    await expect(map).toHaveAttribute('data-beat', 'land')
    const gate3 = page.locator('[data-testid="map-gate"][data-land="3"]')
    await expect(gate3).toHaveAttribute('data-open', 'false')

    await untilPhase(page, 'gate')
    await expect(gate3).toHaveAttribute('data-open', 'true')
    await page.screenshot({ path: `${SHOTS}/end-land-gate.png` })

    await expect(map).toHaveAttribute('data-beat-phase', 'cheer', {
      timeout: 5_000,
    })
    await expect(page.getByTestId('map-ribbon')).toHaveAttribute(
      'data-line-id',
      'end.land.math.3',
    )
    await expect(page.getByTestId('map-ribbon')).toHaveText(
      'A new land! Land 3: Big numbers!',
    )
    await expect(page.getByTestId('map-emma')).toHaveAttribute(
      'data-node',
      'two-digit-addsub-no-regroup',
    )
    expect(await beatPhases(page)).toEqual([
      'bloom',
      'hop',
      'pop',
      'gate',
      'cheer',
    ])
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${SHOTS}/end-land-line.png` })
  })

  test('4. bad day → no bud, no beat line; All done → Hub', async ({
    page,
  }) => {
    // SessionEnd mounted straight from the QA route has the zero payload
    // (0 correct) — a bad day for the seeded focus step.
    await arm(page, seedProgress(1, 0))
    await page.goto('/?route=session-end')
    const end = page.getByTestId('session-end')
    await expect(end).toBeVisible({ timeout: 10_000 })
    await expect(end).toHaveAttribute('data-path-beat', 'none')
    await tapAllDone(page)
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('session-end-bud-beat')).toHaveCount(0)
    expect(
      (await linePlays(page)).filter((id) => id.startsWith('end.')),
    ).toEqual([])
  })
})
