/**
 * Emma's Path 8/10 (ClickUp 123jpnbc3dr) — the map screen, one per world.
 * Spec: design/emmas-path/emmas-path-spec.md §3 (map), §4.1–4.2 (map
 * lines), §5, §7, §9.
 *
 * Audio is observed at the player boundary (`window.__mapLinePlays`, one
 * record per line the map asks to speak): the MP3 fetch itself is served
 * by the PWA service worker, which the page request log does not see.
 * Deferred lines (`locked-later`, `gate-locked`; src null) must show
 * their caption and reach the player with src null (no Howl is built —
 * playMapLine.test.ts), and browser speech must never be used.
 *
 * Clay redesign (Redesign R3, ClickUp 123jpnbc690): stickers on plinths,
 * stepping stones, garden-arch gates, land pills, Emma behind the current
 * stop — all art from the `pathArt` manifest (`/assets/path/*.webp`).
 *
 * Screenshots (820×1180, iPad portrait in CSS px) go to
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
const WORD = [
  'letter-names',
  'letter-sounds',
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
  'digraphs-sh',
  'digraphs-ch',
  'digraphs-th-voiceless',
  'sight-words',
  'simple-sentences',
] as const

/** Mastered before `current`, practicing at it, locked after (-1 = all mastered). */
function levels(
  tree: readonly string[],
  current: number,
): Record<string, string> {
  return Object.fromEntries(
    tree.map((n, i) => [
      n,
      current < 0 || i < current
        ? 'mastered'
        : i === current
          ? 'practicing'
          : 'locked',
    ]),
  )
}

function pastDayISO(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

interface SeedOpts {
  math?: number
  word?: number
  history?: { dateISO: string; skillFocus: string[]; successRate: number }[]
  showLevelToMarian?: boolean
}

function seedProgress(o: SeedOpts): unknown {
  const base = buildSeedProgress({
    skillLevelOverrides: {
      ...levels(MATH, o.math ?? 1),
      ...levels(WORD, o.word ?? 3),
    },
    history: o.history ?? [],
  } as Parameters<typeof buildSeedProgress>[0]) as {
    parentSettings: Record<string, unknown>
  }
  return {
    ...base,
    parentSettings: {
      ...base.parentSettings,
      showLevelToMarian: o.showLevelToMarian ?? true,
    },
  }
}

interface Probe {
  /** session-start POST tracks. */
  sessionStarts: string[]
}

async function arm(page: Page, progress: unknown | null): Promise<Probe> {
  const probe: Probe = { sessionStarts: [] }
  page.on('request', (req) => {
    const url = req.url()
    if (url.includes('/api/claude') && req.method() === 'POST') {
      try {
        const body = JSON.parse(req.postData() ?? '{}') as {
          payload?: { track?: string }
        }
        probe.sessionStarts.push(body.payload?.track ?? '?')
      } catch {
        probe.sessionStarts.push('?')
      }
    }
  })
  await page.addInitScript(() => {
    const w = window as unknown as { __speakCalls: number }
    w.__speakCalls = 0
    if ('speechSynthesis' in window) {
      const synth = window.speechSynthesis
      const orig = synth.speak.bind(synth)
      synth.speak = (u: SpeechSynthesisUtterance) => {
        w.__speakCalls += 1
        orig(u)
      }
    }
  })
  // Hold session-start long enough that a Hub → map → Hub trip happens
  // while the prefetch is still in flight.
  await installClaudeMock(page, { failNetwork: true, delayMs: 20_000 })
  await seedLocalStorage(page, {
    ...(progress === null ? {} : { progress }),
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
  return probe
}

async function openMapFromHub(page: Page, world: 'math' | 'word-song') {
  await page.goto('/')
  await forceHowlerUnlock(page)
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  await page
    .locator(`[data-testid="hub-map-button"][data-world="${world}"]`)
    .click()
  await expect(page.getByTestId('map')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('map')).toHaveAttribute('data-world', world)
  await expect(page.getByTestId('map-stop').first()).toBeVisible()
  // Let the screen fade-in settle so screenshots are not mid-fade.
  await expect(page.getByTestId('map')).toHaveCSS('opacity', '1')
  await expect(page.getByTestId('map-ribbon')).toHaveCSS('opacity', '1')
}

const stop = (page: Page, node: string) =>
  page.locator(`[data-testid="map-stop"][data-node="${node}"]`)
const gate = (page: Page, land: number) =>
  page.locator(`[data-testid="map-gate"][data-land="${land}"]`)
const ribbon = (page: Page) => page.getByTestId('map-ribbon')

interface PlayRecord {
  id: string
  src: string | null
}
async function plays(page: Page): Promise<PlayRecord[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __mapLinePlays?: PlayRecord[] }).__mapLinePlays ??
      [],
  )
}
/** Srcs the player was asked to play (null = caption-only line). */
async function playedSrcs(page: Page): Promise<(string | null)[]> {
  return (await plays(page)).map((p) => p.src)
}

async function speakCalls(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __speakCalls: number }).__speakCalls,
  )
}

interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

/** Every map image comes from the manifest and has decoded. */
async function expectArtLoaded(page: Page) {
  await expect
    .poll(() =>
      page
        .getByTestId('map')
        .locator('img')
        .evaluateAll((imgs) =>
          (imgs as HTMLImageElement[]).every(
            (i) => i.complete && i.naturalWidth > 0,
          ),
        ),
    )
    .toBe(true)
  const srcs = await page
    .getByTestId('map-path')
    .locator('img[data-art]')
    .evaluateAll((imgs) =>
      (imgs as HTMLImageElement[]).map((i) => i.getAttribute('src') ?? ''),
    )
  for (const src of srcs)
    expect(src).toMatch(/^\/assets\/path\/[a-z0-9-]+-256\.webp$/)
}

async function rectOf(page: Page, selector: string): Promise<Rect> {
  return page
    .locator(selector)
    .first()
    .evaluate((n) => {
      const r = n.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    })
}

test.describe("Emma's Path — map screen (123jpnbc3dr)", () => {
  test('Hub map buttons are 64px pills that open each world, not a session', async ({
    page,
  }) => {
    await arm(page, null)
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    const buttons = page.getByTestId('hub-map-button')
    await expect(buttons).toHaveCount(2)
    for (const world of ['math', 'word-song']) {
      const box = await page
        .locator(`[data-testid="hub-map-button"][data-world="${world}"]`)
        .boundingBox()
      expect(box?.height).toBe(64)
    }
    await expect(
      page.getByRole('button', { name: 'Number Garden map' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Word Song map' }),
    ).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/hub-map-buttons.png` })

    await page.getByRole('button', { name: 'Word Song map' }).click()
    await expect(page.getByTestId('map')).toHaveAttribute(
      'data-world',
      'word-song',
    )
    await expect(page.getByTestId('math')).toHaveCount(0)
    await expect(page.getByTestId('literacy')).toHaveCount(0)
    // First launch (default progress): Word Song current = letter-sounds
    // (per-vowel tracking not active on a fresh profile → one row of 3).
    await expect(page.getByTestId('map')).toHaveAttribute(
      'data-current',
      'letter-sounds',
    )
    await expect(
      page.locator(
        '[data-testid="map-stop"][data-node="letter-sounds"] [data-testid="map-bud"]',
      ),
    ).toHaveCount(3)
    await expect(ribbon(page)).toHaveAttribute(
      'data-line-id',
      'path.open.letter-sounds',
    )
    await expect
      .poll(() => playedSrcs(page))
      .toContain('/assets/audio/path/path-open-letter-sounds.mp3')
    await page.screenshot({ path: `${SHOTS}/map-word-first-launch.png` })
  })

  test('first launch Number Garden: Emma behind add-to-10, whole map fits, clay stickers on plinths', async ({
    page,
  }) => {
    await arm(page, null)
    await openMapFromHub(page, 'math')

    await expect(page.getByTestId('map')).toHaveAttribute(
      'data-current',
      'add-to-10',
    )
    await expect(page.getByTestId('map-emma')).toHaveAttribute(
      'data-node',
      'add-to-10',
    )
    await expect(page.getByTestId('map-stop')).toHaveCount(11)
    await expect(page.getByTestId('map-plinth')).toHaveCount(11)
    await expect(page.getByTestId('map-band')).toHaveCount(4)
    await expect(page.getByTestId('map-gate')).toHaveCount(3)
    await expect(page.getByTestId('map-land-pill')).toHaveCount(4)
    await expect(page.getByTestId('map-title')).toHaveText('Number Garden')
    await expect(ribbon(page)).toHaveText(
      'Here is your path! You are on adding to ten.',
    )
    await expect
      .poll(() => playedSrcs(page))
      .toContain('/assets/audio/path/path-open-add-to-10.mp3')
    await expectArtLoaded(page)
    await expect(
      stop(page, 'add-to-10').locator('img[data-art="add-to-10"]'),
    ).toHaveCount(1)

    // No scrolling at 820×1180.
    const scroll = await page.evaluate(() => ({
      sh: document.documentElement.scrollHeight,
      ih: window.innerHeight,
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
    }))
    expect(scroll.sh).toBeLessThanOrEqual(scroll.ih)
    expect(scroll.sw).toBeLessThanOrEqual(scroll.iw)

    // Every stop: ≥ 88px tap target, fully inside the viewport, no two
    // overlapping; the current stop is the biggest.
    const boxes = await page.getByTestId('map-stop').evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect()
        return {
          node: n.getAttribute('data-node'),
          w: r.width,
          h: r.height,
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right,
        }
      }),
    )
    for (const b of boxes) {
      expect(b.w).toBeGreaterThanOrEqual(88)
      expect(b.h).toBe(b.w)
      expect(b.top).toBeGreaterThanOrEqual(0)
      expect(b.bottom).toBeLessThanOrEqual(1180)
      expect(b.left).toBeGreaterThanOrEqual(0)
      expect(b.right).toBeLessThanOrEqual(820)
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!
        const c = boxes[j]!
        const hit =
          a.left < c.right &&
          c.left < a.right &&
          a.top < c.bottom &&
          c.top < a.bottom
        expect(hit, `${a.node} overlaps ${c.node}`).toBe(false)
      }
    const cur = boxes.find((b) => b.node === 'add-to-10')!
    for (const b of boxes.filter((x) => x !== cur))
      expect(b.w).toBeLessThan(cur.w)

    // Real Emma stands BEHIND the current stop: centred on it, her head
    // above it, stacked under it, with a soft contact shadow.
    const emma = await rectOf(page, '[data-testid="map-emma"]')
    expect((emma.left + emma.right) / 2).toBeCloseTo(
      (cur.left + cur.right) / 2,
      0,
    )
    expect(emma.top).toBeLessThan(cur.top)
    const z = await page.evaluate(() => {
      const zi = (sel: string) =>
        Number(getComputedStyle(document.querySelector(sel)!).zIndex)
      return {
        emma: zi('[data-testid="map-emma"]'),
        stop: zi('[data-testid="map-stop"]'),
        gate: zi('[data-testid="map-gate"]'),
      }
    })
    expect(z.emma).toBeLessThan(z.stop)
    expect(z.emma).toBeLessThan(z.gate)
    await expect(page.getByTestId('map-emma-shadow')).toHaveCount(1)
    await expect(page.getByTestId('map-current-glow')).toHaveCount(1)
    // The current stop shows its buds, nothing else does.
    await expect(page.getByTestId('map-buds')).toHaveCount(1)
    await expect(stop(page, 'add-to-10').getByTestId('map-bud')).toHaveCount(3)
    await page.screenshot({ path: `${SHOTS}/map-math-first-launch.png` })
  })

  test('mid-tree: stop states, buds, gates; every tap speaks; deferred lines are caption-only', async ({
    page,
  }) => {
    // Land 3 current (two-digit no-regroup), 2 good days banked on it.
    await arm(
      page,
      seedProgress({
        math: 5,
        history: [
          {
            dateISO: pastDayISO(3),
            skillFocus: ['two-digit-addsub-no-regroup'],
            successRate: 1,
          },
          {
            dateISO: pastDayISO(2),
            skillFocus: ['two-digit-addsub-no-regroup'],
            successRate: 1,
          },
        ],
      }),
    )
    await openMapFromHub(page, 'math')

    const current = 'two-digit-addsub-no-regroup'
    await expect(page.getByTestId('map-emma')).toHaveAttribute(
      'data-node',
      current,
    )
    const states = await page
      .getByTestId('map-stop')
      .evaluateAll((nodes) =>
        nodes.map((n) => [
          n.getAttribute('data-node'),
          n.getAttribute('data-state'),
        ]),
      )
    expect(states).toEqual(
      MATH.map((n, i) => [
        n,
        i < 5 ? 'mastered' : i === 5 ? 'current' : 'locked',
      ]),
    )
    // Buds: only under the current stop, 2 of 3 open.
    await expect(page.getByTestId('map-buds')).toHaveCount(1)
    await expect(stop(page, current).getByTestId('map-bud')).toHaveCount(3)
    await expect(
      stop(page, current).locator('[data-testid="map-bud"][data-open="true"]'),
    ).toHaveCount(2)
    // Mastered stops carry the bloom badge; locked ones are pale + padlock.
    await expect(page.getByTestId('map-flower-badge')).toHaveCount(5)
    await expect(page.getByTestId('map-stop-frost')).toHaveCount(5)
    await expect(page.getByTestId('map-stop-padlock')).toHaveCount(5)
    const frost = await page
      .getByTestId('map-stop-frost')
      .first()
      .evaluate((n) => getComputedStyle(n).filter)
    expect(frost).toContain('saturate(0.2)')
    expect(frost).toContain('opacity(0.62)')
    // Gates: 2 and 3 open (first step not locked), 4 closed. The closed
    // arch art carries its own padlock: nothing is overlaid on a gate.
    await expect(gate(page, 2)).toHaveAttribute('data-open', 'true')
    await expect(gate(page, 3)).toHaveAttribute('data-open', 'true')
    await expect(gate(page, 4)).toHaveAttribute('data-open', 'false')
    await expect(
      gate(page, 2).locator('img[data-art="ui-arch-open"]'),
    ).toHaveCount(1)
    await expect(
      gate(page, 4).locator('img[data-art="ui-arch-closed"]'),
    ).toHaveCount(1)
    await expect(
      page.getByTestId('map-gate').locator('img[data-art="ui-padlock"]'),
    ).toHaveCount(0)
    // Stepping stones: walked (pink) up to the current stop, ahead after.
    const stones = await page
      .getByTestId('map-stone')
      .evaluateAll((n) => n.map((s) => s.getAttribute('data-walked')))
    expect(stones.length).toBeGreaterThan(8)
    const firstAhead = stones.indexOf('false')
    expect(firstAhead).toBeGreaterThan(0)
    expect(stones.slice(firstAhead).every((w) => w === 'false')).toBe(true)
    // Land pills with their numbers (showLevelToMarian on).
    await expect(page.getByTestId('map-land-pill')).toHaveCount(4)
    await expect(page.getByTestId('map-land-number')).toHaveCount(4)
    await expectArtLoaded(page)
    await page.screenshot({ path: `${SHOTS}/map-math-mid-tree.png` })

    // Open (mastered) stop → its name.
    await stop(page, 'sub-to-10').click()
    await expect(ribbon(page)).toHaveAttribute(
      'data-line-id',
      'path.stop.sub-to-10',
    )
    await expect(ribbon(page)).toHaveText('Taking away to ten.')
    await expect
      .poll(() => playedSrcs(page))
      .toContain('/assets/audio/path/path-stop-sub-to-10.mp3')

    // Locked stop whose predecessor is current → `next` requirement, audio.
    await stop(page, 'two-digit-addsub-with-regroup').click()
    await expect(ribbon(page)).toHaveAttribute(
      'data-line-id',
      'path.locked.next.two-digit-addsub-with-regroup',
    )
    await expect(ribbon(page)).toHaveText(
      'Making tens! First, big numbers. Then this!',
    )
    await expect(page.getByTestId('map-emma')).toHaveAttribute(
      'data-pose',
      'attentive-pointing',
    )
    await expect
      .poll(() => playedSrcs(page))
      .toContain(
        '/assets/audio/path/path-locked-next-two-digit-addsub-with-regroup.mp3',
      )
    // Pointing lasts 1.5 s, then Emma is idle again.
    await expect(page.getByTestId('map-emma')).toHaveAttribute(
      'data-pose',
      'idle',
      { timeout: 3_000 },
    )

    // Locked stop further on → deferred `later` line: caption, no audio.
    await stop(page, 'mult-6-9').click()
    await expect(ribbon(page)).toHaveAttribute(
      'data-line-id',
      `path.locked.later.mult-6-9.${current}`,
    )
    await expect(ribbon(page)).toHaveText(
      'Big groups! Not yet. First, big numbers.',
    )
    await expect(ribbon(page)).toHaveAttribute('data-has-audio', 'false')

    // Closed gate → deferred `gate-locked` line: caption, no audio.
    await gate(page, 4).click()
    await expect(ribbon(page)).toHaveAttribute(
      'data-line-id',
      `path.gate.locked.math.4.${current}`,
    )
    await expect(ribbon(page)).toHaveText('Land 4: Groups! First, big numbers.')
    await expect(ribbon(page)).toHaveAttribute('data-has-audio', 'false')
    await expect(ribbon(page)).toHaveCSS('opacity', '1')
    await page.screenshot({ path: `${SHOTS}/map-math-land-gate.png` })

    // Open gate → land line with audio.
    await gate(page, 3).click()
    await expect(ribbon(page)).toHaveAttribute(
      'data-line-id',
      'path.land.math.3',
    )
    await expect(ribbon(page)).toHaveText('Land 3: Big numbers.')
    await expect
      .poll(() => playedSrcs(page))
      .toContain('/assets/audio/path/path-land-math-3.mp3')

    // Deferred lines reached the player with src null (the player builds
    // no Howl for them — playMapLine.test.ts); every other line had a
    // real MP3; browser speech never used.
    const log = await plays(page)
    const deferred = log.filter(
      (p) =>
        p.id.startsWith('path.locked.later.') ||
        p.id.startsWith('path.gate.locked.'),
    )
    expect(deferred.map((p) => p.id)).toEqual([
      `path.locked.later.mult-6-9.${current}`,
      `path.gate.locked.math.4.${current}`,
    ])
    expect(deferred.every((p) => p.src === null)).toBe(true)
    expect(
      log
        .filter((p) => !deferred.includes(p))
        .every((p) => typeof p.src === 'string' && p.src.endsWith('.mp3')),
    ).toBe(true)
    expect(await speakCalls(page)).toBe(0)
  })

  test('Word Song mid-tree (dog words current) + per-vowel letter-sounds stays mastered', async ({
    page,
  }) => {
    await arm(page, seedProgress({ word: 4 }))
    await openMapFromHub(page, 'word-song')

    await expect(page.getByTestId('map-stop')).toHaveCount(13)
    await expect(page.getByTestId('map-band')).toHaveCount(5)
    await expect(page.getByTestId('map-gate')).toHaveCount(4)
    await expect(page.getByTestId('map-emma')).toHaveAttribute(
      'data-node',
      'cvc-words-short-o',
    )
    await expect(page.getByTestId('map-title')).toHaveText('Word Song')
    await expectArtLoaded(page)
    await expect(
      gate(page, 5).locator('img[data-art="ui-arch-closed"]'),
    ).toHaveCount(1)
    await expect(ribbon(page)).toHaveText(
      'Here is your path! You are on dog words.',
    )
    // Gates: 2 (blending) and 3 (words) open, 4 and 5 closed.
    await expect(gate(page, 2)).toHaveAttribute('data-open', 'true')
    await expect(gate(page, 3)).toHaveAttribute('data-open', 'true')
    await expect(gate(page, 4)).toHaveAttribute('data-open', 'false')
    await expect(gate(page, 5)).toHaveAttribute('data-open', 'false')
    const scroll = await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    )
    expect(scroll).toBe(true)
    await page.screenshot({ path: `${SHOTS}/map-word-mid-tree.png` })

    await gate(page, 5).click()
    await expect(ribbon(page)).toHaveText(
      'Land 5: Sentences! First, dog words.',
    )
    await expect(ribbon(page)).toHaveCSS('opacity', '1')
    await page.screenshot({ path: `${SHOTS}/map-word-land-gate.png` })
  })

  test('path complete: Emma cheers on the last stop, open-done line', async ({
    page,
  }) => {
    await arm(page, seedProgress({ math: -1 }))
    await openMapFromHub(page, 'math')
    await expect(page.getByTestId('map')).toHaveAttribute(
      'data-complete',
      'true',
    )
    await expect(page.getByTestId('map-emma')).toHaveAttribute(
      'data-node',
      'mult-6-9',
    )
    await expect(page.getByTestId('map-emma')).toHaveAttribute(
      'data-pose',
      'cheering',
    )
    await expect(ribbon(page)).toHaveAttribute(
      'data-line-id',
      'path.open.done.math',
    )
    await expect
      .poll(() => playedSrcs(page))
      .toContain('/assets/audio/path/path-open-done.mp3')
    await expect(page.getByTestId('map-stop-padlock')).toHaveCount(0)
    await page.screenshot({ path: `${SHOTS}/map-math-complete.png` })
  })

  test('Home returns to the Hub: no greeting replay, prefetch not re-triggered', async ({
    page,
  }) => {
    const probe = await arm(page, null)
    await openMapFromHub(page, 'math')
    const startsBefore = probe.sessionStarts.length
    expect(startsBefore).toBe(1)

    // Stay past the Hub's own 30 s rapid-remount window is impractical
    // in e2e; the map stamps the window on leave, so the return is
    // suppressed regardless of dwell.
    await page.getByRole('button', { name: 'Home' }).click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('hub')).toHaveAttribute(
      'data-suppressed',
      'true',
    )
    await expect(page.getByTestId('hub-ribbon')).toHaveCount(0)
    await page.waitForTimeout(1000)
    expect(probe.sessionStarts).toHaveLength(startsBefore)
  })

  test('showLevelToMarian=false hides the land numbers only', async ({
    page,
  }) => {
    await arm(page, seedProgress({ math: 3, showLevelToMarian: false }))
    await openMapFromHub(page, 'math')
    await expect(page.getByTestId('map-land-pill')).toHaveCount(4)
    await expect(page.getByTestId('map-land-number')).toHaveCount(0)
    await expect(page.getByTestId('map-stop')).toHaveCount(11)
    await expect(page.getByTestId('map-gate')).toHaveCount(3)
  })
})
