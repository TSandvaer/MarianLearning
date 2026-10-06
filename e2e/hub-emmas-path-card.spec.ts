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

/** Emma's lines are recorded (Guidance G3), so on app-open she waits
 *  for the first tap (iOS audio unlock). Tap her, not a card, the way
 *  Marian would. */
async function firstTap(page: Page): Promise<void> {
  await page.getByTestId('hub-emma').click()
}

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

    // Guidance G1 / bar 14: no stardust total, no day-streak sun, and the
    // old recent-stats strip is gone.
    await expect(page.getByTestId('hub-cumulative-stardust')).toHaveCount(0)
    await expect(page.getByTestId('hub-day-streak')).toHaveCount(0)
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
    await firstTap(page)
    const bubble = page.getByTestId('hub-ribbon')
    await expect(bubble).toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator('[data-testid="hub-caption-word"][data-revealed="false"]'),
    ).toHaveCount(0, { timeout: 10_000 })
    const b = (await bubble.boundingBox())!
    for (const tree of ['number-garden', 'word-song'] as const) {
      const card = (await node(page, tree).boundingBox())!
      expect(b.y + b.height).toBeLessThan(card.y)
    }
    expect(b.x).toBeGreaterThanOrEqual(0)
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

/**
 * Guidance G1 (ClickUp 123jpnbca4r) — the four Hub states of
 * design/emmas-path/redesign/guidance-mockup.html: a (morning, both
 * open), c (Number Garden done today), d (both done) and a2 (next
 * morning). Good days are seeded relative to the real today, so the
 * good-day rule sees real calendar days. (A fake page.clock fights
 * framer-motion across a reload, so "next morning" is modelled as
 * yesterday's flowers having been seen asleep.)
 */
test.describe('Guidance G1 — Hub states (123jpnbca4r)', () => {
  /** Day D of the scenario: today. */
  const D = new Date()
  const at = (daysFromD: number, hour = 12) =>
    new Date(
      D.getFullYear(),
      D.getMonth(),
      D.getDate() + daysFromD,
      hour,
    ).toISOString()
  const dayKey = (daysFromD: number) => {
    const d = new Date(D.getFullYear(), D.getMonth(), D.getDate() + daysFromD)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  /** Number Garden on add-to-20, Word Song on blending-cv (no per-vowel
   *  sub-steps), good days at the given offsets from day D. */
  function guidanceProgress(ng: number[], ws: number[]): unknown {
    return buildSeedProgress({
      skillLevelOverrides: {
        'number-recog': 'mastered',
        'add-to-10': 'mastered',
        'add-to-20': 'practicing',
        'sub-to-10': 'locked',
        'sub-to-20': 'locked',
        'letter-names': 'mastered',
        'letter-sounds': 'mastered',
        'blending-cv': 'practicing',
        'cvc-words': 'locked',
      },
      history: [
        ...ng.map((d) => ({
          dateISO: at(d),
          skillFocus: ['add-to-20' as const],
          successRate: 1,
        })),
        ...ws.map((d) => ({
          dateISO: at(d),
          skillFocus: ['blending-cv' as const],
          successRate: 1,
        })),
      ],
    })
  }

  /** Seed once (reloads keep the app's own writes), fix the clock, open. */
  async function openGuidanceHub(
    page: Page,
    opts: { ng: number[]; ws: number[]; seenAwake?: Record<string, string> },
  ) {
    await installClaudeMock(page, { failNetwork: true })
    await seedLocalStorage(page, {
      progress: guidanceProgress(opts.ng, opts.ws),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
      seedOnce: true,
    })
    await page.addInitScript((seen) => {
      if (localStorage.getItem('e2e.wake-seeded') !== null) return
      localStorage.setItem('e2e.wake-seeded', '1')
      if (seen) localStorage.setItem('hub-flower-wake.v1', JSON.stringify(seen))
    }, opts.seenAwake ?? null)
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await firstTap(page)
  }

  const slots = (page: Page, tree: 'number-garden' | 'word-song') =>
    node(page, tree)
      .getByTestId('hub-card-seed')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))

  /** Wait until Emma's caption for `line` is fully shown, return its
   *  text. Scoped to that line's bubble: the previous line's bubble may
   *  still be fading out. */
  async function captionFor(page: Page, line: string): Promise<string> {
    const words = page.locator(
      `[data-testid="hub-caption"][data-line="${line}"] [data-testid="hub-caption-word"]`,
    )
    await expect(words.first()).toBeAttached({ timeout: 10_000 })
    await expect(
      words.and(page.locator('[data-revealed="false"]')),
    ).toHaveCount(0, { timeout: 10_000 })
    const texts = await words.evaluateAll((els) =>
      els.map((e) => e.textContent),
    )
    return texts.join(' ')
  }

  async function shot(page: Page, name: string) {
    await expectArtLoaded(page)
    await page.waitForTimeout(300) // the last caption word's fade-in
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${SHOTS}/${name}.png` })
  }

  test('a · morning, both open: Number Garden glows and Emma names it', async ({
    page,
  }) => {
    await openGuidanceHub(page, {
      ng: [-2, -1],
      ws: [],
      seenAwake: { math: dayKey(-1) },
    })
    await expect(node(page, 'number-garden')).toHaveAttribute(
      'data-suggested',
      'true',
    )
    await expect(node(page, 'word-song')).toHaveAttribute(
      'data-suggested',
      'false',
    )
    expect(await slots(page, 'number-garden')).toEqual([
      'grown',
      'grown',
      'empty',
    ])
    expect(await slots(page, 'word-song')).toEqual(['empty', 'empty', 'empty'])
    // Both cards stay open and the same size.
    const a = (await node(page, 'number-garden').boundingBox())!
    const b = (await node(page, 'word-song').boundingBox())!
    expect(Math.abs(a.width - b.width)).toBeLessThan(1)
    expect(Math.abs(a.height - b.height)).toBeLessThan(1)
    expect(await captionFor(page, 'guide.grow.number-garden')).toBe(
      "Let's grow a flower in Number Garden! Or pick Word Song.",
    )
    await expect(page.getByTestId('hub-cumulative-stardust')).toHaveCount(0)
    await expect(page.getByTestId('hub-day-streak')).toHaveCount(0)
    await shot(page, 'g1-hub-a-morning')
  })

  test('c · Number Garden done today: its flower sleeps, Word Song glows', async ({
    page,
  }) => {
    await openGuidanceHub(page, {
      ng: [-1, 0],
      ws: [],
      seenAwake: { math: dayKey(-1) },
    })
    expect(await slots(page, 'number-garden')).toEqual([
      'grown',
      'sleeping',
      'empty',
    ])
    const sleeping = node(page, 'number-garden').locator(
      '[data-testid="hub-card-seed"][data-state="sleeping"]',
    )
    await expect(sleeping.locator('img')).toHaveAttribute(
      'src',
      /ui-bud-closed-256\.webp$/,
    )
    await expect(sleeping.locator('.hub-moon')).toHaveCount(1)
    await expect(sleeping.locator('.hub-zz')).toHaveText('z')
    await expect(node(page, 'word-song')).toHaveAttribute(
      'data-suggested',
      'true',
    )
    await expect(node(page, 'number-garden')).toHaveAttribute(
      'data-suggested',
      'false',
    )
    expect(await captionFor(page, 'guide.sleeping.word-song')).toBe(
      "Your flower is sleeping. Let's play Word Song!",
    )
    await shot(page, 'g1-hub-c-one-done')
  })

  test('d · both done: no glow, Emma offers practice; a card still starts a session', async ({
    page,
  }) => {
    await openGuidanceHub(page, {
      ng: [-1, 0],
      ws: [0],
      seenAwake: { math: dayKey(-1) },
    })
    await expect(page.getByTestId('hub')).toHaveAttribute(
      'data-suggestion',
      'none',
    )
    await expect(
      page.locator('[data-testid="hub-tree-node"][data-suggested="true"]'),
    ).toHaveCount(0)
    expect(await slots(page, 'number-garden')).toEqual([
      'grown',
      'sleeping',
      'empty',
    ])
    expect(await slots(page, 'word-song')).toEqual([
      'sleeping',
      'empty',
      'empty',
    ])
    expect(await captionFor(page, 'guide.both-sleeping')).toBe(
      'Both flowers are sleeping. Want to practise more?',
    )
    await shot(page, 'g1-hub-d-both-done')

    // Practice: the card still starts a session.
    await node(page, 'number-garden').click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })
  })

  test('a2 · next morning: yesterday’s buds open once, with Emma’s line', async ({
    page,
  }) => {
    // Yesterday was state d (both flowers asleep; the newest flower seen
    // awake is from the day before). This is the next morning.
    await openGuidanceHub(page, {
      ng: [-2, -1],
      ws: [-1],
      seenAwake: { math: dayKey(-2) },
    })
    expect(await slots(page, 'number-garden')).toEqual([
      'grown',
      'grown',
      'empty',
    ])
    expect(await slots(page, 'word-song')).toEqual(['grown', 'empty', 'empty'])
    const waking = page.locator(
      '[data-testid="hub-card-seed"][data-waking="true"]',
    )
    await expect(waking).toHaveCount(2)
    await expect(waking.first().locator('img')).toHaveAttribute(
      'src',
      /ui-bud-open-256\.webp$/,
    )
    await expect(page.locator('.hub-moon')).toHaveCount(0)
    await expect(node(page, 'number-garden')).toHaveAttribute(
      'data-suggested',
      'true',
    )
    expect(await captionFor(page, 'guide.woke-up')).toBe(
      'Your flowers woke up!',
    )
    await shot(page, 'g1-hub-a2-next-morning')
    expect(await captionFor(page, 'guide.one-more')).toBe(
      'One more flower, and a new path opens!',
    )

    // Recorded so it shows once: the newest flower seen awake per world.
    expect(
      await page.evaluate(() => localStorage.getItem('hub-flower-wake.v1')),
    ).toBe(JSON.stringify({ math: dayKey(-1), 'word-song': dayKey(-1) }))

    // Once: a later visit the same morning neither animates nor says it.
    await page.reload()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('hub-card-seed')).toHaveCount(6)
    await expect(waking).toHaveCount(0)
    await expect(page.getByTestId('hub')).not.toHaveAttribute(
      'data-lines',
      /guide\.woke-up/,
    )
  })
})
