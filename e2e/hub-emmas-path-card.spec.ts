/**
 * Redesign R2 (ClickUp 123jpnbc68z) — the clay Hub world cards
 * (direction A "Toy Box"). Replaces the Emma's Path 7/10 bead-row card.
 * Reference: design/emmas-path/redesign/real-art-check.html (Hub tab);
 * quality bars 9-13 in .claude/quality-bars.md.
 *
 * Seed (mid-tree, the reference's data): Number Garden on add-to-20 with
 * 2 of 3 good days (two distinct past days at 100%), Word Song on
 * letter-sounds with 1. Expected: math land 2, word land 1; current
 * add-to-20 → next sub-to-10; current letter-sounds → next blending-cv.
 *
 * Screenshots land in design/emmas-path/screens/ (820×1180, the
 * reference canvas) for the PR and Thomas's look.
 */
import { test, expect, type Page } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

const SHOTS = 'design/emmas-path/screens'
/** 44pt in CSS px (1pt = 4/3 px). */
const MIN_TARGET_PX = (44 * 4) / 3

test.use({ viewport: { width: 820, height: 1180 } })

function pastDayISO(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

function seedProgress(showLevelToMarian: boolean): unknown {
  const base = buildSeedProgress({
    skillLevelOverrides: {
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'practicing',
      'sub-to-10': 'locked',
      'sub-to-20': 'locked',
      'letter-names': 'mastered',
      'letter-sounds': 'practicing',
      'blending-cv': 'locked',
    },
    history: [
      { dateISO: pastDayISO(3), skillFocus: ['add-to-20'], successRate: 1 },
      { dateISO: pastDayISO(2), skillFocus: ['add-to-20'], successRate: 1 },
      {
        dateISO: pastDayISO(2),
        skillFocus: ['letter-sounds'],
        successRate: 1,
      },
    ],
  }) as { parentSettings: Record<string, unknown> }
  return {
    ...base,
    parentSettings: { ...base.parentSettings, showLevelToMarian },
  }
}

async function openHub(page: Page, showLevelToMarian = true) {
  await installClaudeMock(page, { failNetwork: true })
  await seedLocalStorage(page, {
    progress: seedProgress(showLevelToMarian),
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
  await page.goto('/')
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
}

const node = (page: Page, tree: 'number-garden' | 'word-song') =>
  page.locator(`[data-testid="hub-tree-node"][data-tree="${tree}"]`)

/** Every clay image on the Hub decoded (no broken art). */
async function expectArtLoaded(page: Page) {
  const imgs = page.locator('[data-testid="hub-stage"] img')
  await expect
    .poll(
      () =>
        imgs.evaluateAll((els) =>
          (els as HTMLImageElement[]).every(
            (i) => i.complete && i.naturalWidth > 0,
          ),
        ),
      { timeout: 10_000 },
    )
    .toBe(true)
}

test.describe('Redesign R2 — clay Hub cards (123jpnbc68z)', () => {
  test('cards show current, padlocked next, land pill and seed holes from nodeProgress', async ({
    page,
  }) => {
    await openHub(page)

    const math = node(page, 'number-garden')
    await expect(math.getByTestId('hub-card-current')).toHaveAttribute(
      'data-node',
      'add-to-20',
    )
    await expect(math.getByTestId('hub-card-next')).toHaveAttribute(
      'data-node',
      'sub-to-10',
    )
    await expect(math.getByTestId('hub-card-lock')).toHaveCount(1)
    await expect(math.getByTestId('hub-land-number')).toHaveAttribute(
      'data-value',
      '2',
    )
    await expect(math.getByTestId('hub-card-seed')).toHaveCount(3)
    await expect(
      math.locator('[data-testid="hub-card-seed"][data-filled="true"]'),
    ).toHaveCount(2)

    const word = node(page, 'word-song')
    await expect(word.getByTestId('hub-card-current')).toHaveAttribute(
      'data-node',
      'letter-sounds',
    )
    await expect(word.getByTestId('hub-card-next')).toHaveAttribute(
      'data-node',
      'blending-cv',
    )
    await expect(word.getByTestId('hub-land-number')).toHaveAttribute(
      'data-value',
      '1',
    )
    await expect(word.getByTestId('hub-card-seed')).toHaveCount(3)
    await expect(
      word.locator('[data-testid="hub-card-seed"][data-filled="true"]'),
    ).toHaveCount(1)

    // Clay art from the manifest, not the old glyphs.
    await expect(math.getByTestId('hub-card-current')).toHaveAttribute(
      'src',
      '/assets/path/add-to-20-512.webp',
    )

    // Bar 9: no bead row on the Hub.
    await expect(page.getByTestId('hub-card-bead')).toHaveCount(0)

    // One map button inside each card.
    await expect(math.getByTestId('hub-map-button')).toHaveCount(1)
    await expect(word.getByTestId('hub-map-button')).toHaveCount(1)

    // Stardust shown once; the old recent-stats strip is gone.
    await expect(page.getByTestId('hub-cumulative-stardust')).toHaveCount(1)
    await expect(page.getByTestId('hub-stardust-today')).toHaveCount(0)
    await expect(page.getByTestId('hub-recent-stats')).toHaveCount(0)

    // Real Emma art, unchanged, with a soft shadow.
    const emma = page.getByTestId('hub-emma')
    await expect(emma).toHaveCount(1)
    await expect(emma).toHaveAttribute('src', /emma-idle\.svg$/)
    expect(await emma.evaluate((e) => getComputedStyle(e).filter)).toContain(
      'drop-shadow',
    )

    await expectArtLoaded(page)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${SHOTS}/r2-hub-clay.png` })
  })

  test("Emma's speech bubble sits beside her, clear of the cards", async ({
    page,
  }) => {
    await openHub(page)
    // First gesture on the meadow (not Emma, not a card) unlocks audio;
    // the greeting caption walks even when the clip cannot play.
    await page.mouse.click(110, 330)
    const bubble = page.getByTestId('hub-ribbon')
    await expect(bubble).toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator('[data-testid="hub-caption-word"][data-revealed="false"]'),
    ).toHaveCount(0, { timeout: 10_000 })
    const b = (await bubble.boundingBox())!
    const card = (await node(page, 'word-song').boundingBox())!
    expect(b.y + b.height).toBeLessThan(card.y)
    expect(b.x + b.width).toBeLessThanOrEqual(820)
    await expectArtLoaded(page)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${SHOTS}/r2-hub-clay-greeting.png` })
  })

  test('showLevelToMarian=false hides only the land pill', async ({ page }) => {
    await openHub(page, false)
    await expect(page.getByTestId('hub-land-number')).toHaveCount(0)
    await expect(page.getByTestId('hub-card-current')).toHaveCount(2)
    await expect(page.getByTestId('hub-card-next')).toHaveCount(2)
    await expect(page.getByTestId('hub-card-seed')).toHaveCount(6)
    await expect(page.getByTestId('hub-map-button')).toHaveCount(2)
    await expectArtLoaded(page)
    await page.screenshot({ path: `${SHOTS}/r2-hub-clay-no-level.png` })
  })

  test('the card starts its world; the map button opens the map only', async ({
    page,
  }) => {
    await openHub(page)
    await node(page, 'number-garden').getByTestId('hub-map-button').click()
    await expect(page.getByTestId('map')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('math')).toHaveCount(0)

    await openHub(page)
    // A tap on the hero sticker (not a separate target) starts the world.
    await node(page, 'number-garden').getByTestId('hub-card-current').click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })
  })

  for (const viewport of [
    { width: 820, height: 1180 },
    { width: 810, height: 1080 },
  ]) {
    test(`touch targets are 44pt or more at ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await openHub(page)
      const targets = [
        node(page, 'number-garden'),
        node(page, 'word-song'),
        ...(await page.getByTestId('hub-map-button').all()),
      ]
      expect(targets).toHaveLength(4)
      for (const t of targets) {
        const box = (await t.boundingBox())!
        expect(box.width).toBeGreaterThanOrEqual(MIN_TARGET_PX)
        expect(box.height).toBeGreaterThanOrEqual(MIN_TARGET_PX)
      }
      // Nothing spills off the screen.
      const stage = (await page.getByTestId('hub-stage').boundingBox())!
      expect(stage.x).toBeGreaterThanOrEqual(0)
      expect(stage.x + stage.width).toBeLessThanOrEqual(viewport.width + 0.5)
      expect(stage.y + stage.height).toBeLessThanOrEqual(viewport.height + 0.5)
    })
  }

  test('reduced motion stills the glow and sparkles', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openHub(page)
    const names = await page
      .locator('.hub-glow, .hub-spark')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName))
    expect(names.length).toBeGreaterThan(0)
    expect(new Set(names)).toEqual(new Set(['none']))

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const glow = await page
      .locator('.hub-glow')
      .first()
      .evaluate((e) => getComputedStyle(e).animationName)
    expect(glow).toBe('hub-glow')
  })
})
