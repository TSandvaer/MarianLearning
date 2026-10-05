/**
 * Emma's Path 7/10 (ClickUp 123jpnbc3dq) — Hub card: land number +
 * all-steps bead row, replacing the 5-icon path strip.
 * Spec: design/emmas-path/emmas-path-spec.md §2 + §9.
 *
 * Seed: number-recog mastered, add-to-10 practicing with 2 good days
 * (two distinct past days at 100%), the rest of Number Garden locked.
 * Expected: math land number 2 (add-to-10 is in land 2), 11 beads in
 * 4 lands, add-to-10 the current bead at 2/3 fill, add-to-20 the next.
 */
import { test, expect, type Page } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

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
      'add-to-10': 'practicing',
      'add-to-20': 'locked',
      'sub-to-10': 'locked',
      'sub-to-20': 'locked',
    },
    history: [
      { dateISO: pastDayISO(3), skillFocus: ['add-to-10'], successRate: 1 },
      { dateISO: pastDayISO(2), skillFocus: ['add-to-10'], successRate: 1 },
    ],
  }) as { parentSettings: Record<string, unknown> }
  return {
    ...base,
    parentSettings: { ...base.parentSettings, showLevelToMarian },
  }
}

async function openHub(page: Page, showLevelToMarian: boolean) {
  await installClaudeMock(page, { failNetwork: true })
  await seedLocalStorage(page, {
    progress: seedProgress(showLevelToMarian),
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
  await page.goto('/')
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
}

const card = (page: Page, world: 'math' | 'word-song') =>
  page.locator(`[data-testid="hub-card-progress"][data-world="${world}"]`)

test.describe("Emma's Path — Hub card (123jpnbc3dq)", () => {
  test('land number + bead row + hero come from nodeProgress', async ({
    page,
  }) => {
    await openHub(page, true)

    const math = card(page, 'math')
    await expect(math.getByTestId('hub-land-number')).toHaveAttribute(
      'data-value',
      '2',
    )
    await expect(math.getByTestId('hub-card-bead')).toHaveCount(11)
    await expect(math.getByTestId('hub-card-land')).toHaveCount(4)

    const states = await math
      .getByTestId('hub-card-bead')
      .evaluateAll((nodes) =>
        nodes.map((n) => [
          n.getAttribute('data-node'),
          n.getAttribute('data-state'),
        ]),
      )
    expect(states.slice(0, 4)).toEqual([
      ['number-recog', 'mastered'],
      ['add-to-10', 'current'],
      ['add-to-20', 'next'],
      ['sub-to-10', 'locked'],
    ])
    await expect(
      math.locator('[data-testid="hub-card-bead"][data-state="current"]'),
    ).toHaveAttribute('data-fill', '0.667')

    await expect(math.getByTestId('hub-card-current')).toHaveAttribute(
      'data-node',
      'add-to-10',
    )
    await expect(math.getByTestId('hub-card-next')).toHaveAttribute(
      'data-node',
      'add-to-20',
    )
    await expect(
      math.locator('[data-testid="hub-card-bud"][data-open="true"]'),
    ).toHaveCount(2)
    await expect(math.getByTestId('hub-card-bud')).toHaveCount(3)

    const word = card(page, 'word-song')
    await expect(word.getByTestId('hub-card-bead')).toHaveCount(13)
    await expect(word.getByTestId('hub-card-land')).toHaveCount(5)
    await expect(word.getByTestId('hub-land-number')).toHaveCount(1)

    // Out of scope until 8/10: no map button renders.
    await expect(page.getByRole('button', { name: /map/i })).toHaveCount(0)
  })

  test('showLevelToMarian=false hides only the land numbers', async ({
    page,
  }) => {
    await openHub(page, false)
    await expect(page.getByTestId('hub-land-number')).toHaveCount(0)
    await expect(card(page, 'math').getByTestId('hub-card-bead')).toHaveCount(
      11,
    )
    await expect(
      card(page, 'word-song').getByTestId('hub-card-bead'),
    ).toHaveCount(13)
    await expect(page.getByTestId('hub-card-current')).toHaveCount(2)
  })

  test('the card stays one start target: tapping a bead opens Math', async ({
    page,
  }) => {
    await openHub(page, true)
    await card(page, 'math').getByTestId('hub-card-bead').first().click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })
  })
})
