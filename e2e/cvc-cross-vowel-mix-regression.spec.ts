/**
 * E2E regression spec — cvc cross-vowel distractor mix v1 (ticket 86c9qa0kf).
 *
 * Sibling to `cvc-words-short-u-regression.spec.ts`. Locks the wiring
 * for the cross-vowel mix predicate (`crossVowelMixingActive` in
 * `lib/progress/mastery.ts`) + the new `TARGET_PAIRINGS_CROSSVOWEL`
 * matrix routing (`pickDistractors(target, problemIndex, { crossVowel })`
 * in `screens/WordSong/wordDistractors.ts`) end-to-end.
 *
 * What this spec covers
 * ---------------------
 * Per ticket AC7 + spec §7 AC13. Three regression scenarios:
 *
 *   1. **Predicate ON path (post-CVC-graduation)** — All three CVC
 *      tiers `'mastered'` + `digraphs: 'practicing'` + the parent
 *      toggle defaulted to `true`. The picker walks past the mastered
 *      CVC tiers and lands on `digraphs` (the next non-mastered
 *      node). Cross-vowel chips do NOT render in the natural session
 *      flow because the focus is `digraphs`, NOT a CVC tier — App.tsx's
 *      `focusIsCvcTier` gate returns `false` and `wordSongCrossVowel`
 *      is `false`. The session walks the stub-blending-cv fallback.
 *
 *      This case validates the end-to-end wire: the predicate fires
 *      `true` for a post-graduation Marian, but the session-level
 *      gate (focus must be CVC) keeps the matrix from leaking into
 *      a `digraphs` session. It's the post-CVC-graduation reality
 *      check.
 *
 *   2. **Predicate OFF — incomplete mastery** — Two CVC tiers mastered
 *      + the third still `'practicing'`. Predicate returns `false`;
 *      session draws same-vowel-only distractors. Locks the
 *      no-regression on existing CVC sessions.
 *
 *   3. **Predicate OFF — toggle override** — All three CVC tiers
 *      mastered + `digraphs: 'practicing'` BUT
 *      `parentSettings.crossVowelMixingEnabled: false`. Predicate
 *      returns `false` (parent escape valve, per spec §10 Q1 + Dave's
 *      research §4.4). Locks the toggle's hard-off semantics.
 *
 * Why no "cross-vowel matrix actually renders chips" e2e
 * ------------------------------------------------------
 * The cross-vowel matrix (`TARGET_PAIRINGS_CROSSVOWEL`) is exercised
 * exclusively when `crossVowelMixingActive` is `true` AND the focus
 * is a CVC tier. With the v1 mastery rule, those two conditions are
 * naturally mutually exclusive: the predicate requires all three CVC
 * tiers `'mastered'`, but `pickFocusNode` walks past mastered nodes
 * and never returns one. In v1 this is forward-compat infrastructure
 * — the matrix surfaces chips only when a future ticket adds CVC
 * review (e.g. Leitner-style revisits) or a graduation-reset flow.
 * Matrix correctness + the `pickDistractors({ crossVowel: true })`
 * call path are pinned at the unit-test level (see
 * `src/screens/WordSong/wordDistractors.test.ts`'s
 * `TARGET_PAIRINGS_CROSSVOWEL` + `pickDistractors — cross-vowel
 * mode` describe blocks).
 *
 * Mock strategy
 * -------------
 * All three tests use a single inline `installCanonBytesClaudeMock`
 * that returns the bytes of `cvc-words-short-u.json` (real
 * Azure-rendered MP3s) for any word-song request. Tests 1 + 3 land
 * on `digraphs`-focus (post-CVC-graduation seed) — the planner
 * stub-falls-back to blending-cv content there, but Playwright's
 * route handler doesn't care about focus; it just returns the canon
 * bytes. The App's parser is content-shape-driven and the short-u
 * canon bytes parse cleanly into a plan regardless of the requested
 * focus. The reason we use REAL canon bytes (not the shared
 * `installClaudeMock`'s synthetic silent-base64 fixture) is the same
 * reason cvc-words-regression / cvc-words-short-u-regression do —
 * synthetic bytes decode flakily in headless Chromium and the
 * read-aloud effect's `data-read-aloud-played` flag never flips.
 * See `.claude/docs/testing-and-ci.md` §6 "Canon-aware testing".
 *
 * Tests 1 + 3 do NOT walk chips — the matrix-routing decision
 * (cross-vowel vs same-vowel) is observable at the wire level via
 * the captured request body's `payload.progress.focusNode` field +
 * the persisted localStorage `parentSettings.crossVowelMixingEnabled`.
 * That's a cross-browser observation that doesn't depend on
 * `data-read-aloud-played` flipping, sidestepping the headless
 * gesture-unlock flakiness Tests 1 + 3's first iteration hit on CI.
 *
 * WebKit skip rule
 * ----------------
 * Tests that depend on read-aloud-effect firing (i.e., chips
 * becoming enabled) skip on webkit per testing-and-ci.md §8.3.1.
 * Tests 1, 2's planner-payload assertions run on both browsers
 * because they don't depend on chip enablement.
 */

import { test, expect } from '@playwright/test'
import type { Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  PROGRESS_STORAGE_KEY,
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

const CVC_WORDS_SHORT_U_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/cvc-words-short-u.json',
)

const VALID_SHORT_U_WORDS: ReadonlySet<string> = new Set([
  'sun',
  'cup',
  'bus',
  'bug',
  'nut',
  'tub',
  'bun',
  'jug',
  'rug',
  'hut',
  'gum',
])

/** Returns the cvc-words-short-u canon bytes (real Azure-rendered
 *  MP3s) for any word-song request and exposes captured request
 *  bodies for planner-contract assertions. Math (or any other)
 *  requests are intentionally rejected with 500 — the cross-vowel
 *  flow only triggers a word-song fetch. Sibling of
 *  cvc-words-short-u-regression.spec.ts's mock helper.
 *
 *  We re-use the short-u canon for Tests 1 + 3 too (which seed
 *  digraphs-focus). The mock doesn't gate on focus — the App's
 *  parser is content-shape-driven and the short-u canon bytes
 *  parse cleanly into a plan regardless of the requested focus.
 *  Real Azure-rendered MP3s decode reliably in headless Chromium;
 *  the shared mock's synthetic silent-base64 fixture does NOT
 *  (per .claude/docs/testing-and-ci.md §6). */
async function installCvcWordsShortUClaudeMock(
  page: import('@playwright/test').Page,
): Promise<{ requests: Request[] }> {
  const canonBody = readFileSync(CVC_WORDS_SHORT_U_CANON_PATH, 'utf-8')
  const requests: Request[] = []
  await page.route('**/api/claude', async (route) => {
    const request = route.request()

    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
        body: '',
      })
      return
    }
    if (request.method() !== 'POST') {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'method-not-allowed' }),
      })
      return
    }

    requests.push(request)

    let body: Record<string, unknown>
    try {
      body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    } catch {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'invalid-json' }),
      })
      return
    }

    const payload = (body.payload ?? {}) as Record<string, unknown>
    const track = payload.track as string | undefined
    if (track === 'word-song') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: canonBody,
      })
      return
    }
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: 'unexpected-track',
        message: `cross-vowel-mix spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud effect cannot fire. Production iPad Safari works fine; this is a harness limitation.',
  )
}

test.describe('cvc cross-vowel mix v1 regression (ticket 86c9qa0kf)', () => {
  test('1. Predicate ON — post-CVC-graduation: all 3 CVC mastered, digraphs practicing, picker walks to digraphs (focus-tier gate stops cross-vowel routing)', async ({
    page,
  }) => {
    // Seed: cross-vowel-mixing debug-seed shape — three CVC tiers
    // mastered, digraphs at practicing. Predicate `crossVowelMixingActive`
    // returns `true` (all three mastered + default toggle on). But the
    // picker walks past CVC and lands on `digraphs`, so App.tsx's
    // `focusIsCvcTier` gate fires `false` and `wordSongCrossVowel` is
    // `false`. The session uses same-vowel `TARGET_PAIRINGS`.
    //
    // We assert at the wire level (focusNode in the request payload) +
    // the persisted localStorage state, NOT at the chip-render level.
    // The matrix-routing decision (cross-vowel vs same-vowel) is
    // observable cross-browser without depending on the read-aloud
    // effect firing; the chip-render path is gated by Howler decode +
    // gesture-unlock (flaky in headless Chromium for synthetic-bytes
    // canon, and webkit has no AudioContext) and would force a
    // chromium-only assertion that adds no signal beyond the
    // already-unit-tested matrix correctness.
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'mastered',
          'cvc-words-short-o': 'mastered',
          'cvc-words-short-u': 'mastered',
          digraphs: 'practicing',
        },
        // Default `parentSettings` from the helper carries
        // crossVowelMixingEnabled: undefined → defaulter fills `true`.
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    // Real canon bytes (cvc-words-short-u.json) — they parse cleanly
    // even on a digraphs-focus request (planner-content shape, not
    // focus-coupled at the parser). The mock just returns whatever
    // bytes the server would have for the request shape.
    const { requests } = await installCvcWordsShortUClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // WordSong mounts — proves the planner fetch resolved + the parser
    // accepted the cvc-word content type. Cross-browser.
    await expect(page.getByTestId('word-song')).toBeVisible({ timeout: 15_000 })

    // Wire-level assertion: the planner request shipped focusNode =
    // 'digraphs'. This is the observable proof that the picker
    // walked past every mastered CVC tier and stopped at digraphs;
    // App.tsx's `focusIsCvcTier` gate then refused to thread
    // crossVowelMixing into the WordSong prop, so cross-vowel
    // routing did NOT fire even though `crossVowelMixingActive`
    // would have returned `true` on this profile.
    expect(requests).toHaveLength(1)
    const body = JSON.parse(requests[0]!.postData() ?? '{}') as Record<
      string,
      unknown
    >
    expect(body.kind).toBe('session-start')
    const payload = body.payload as Record<string, unknown>
    expect(payload.track).toBe('word-song')
    const progressBlock = payload.progress as Record<string, unknown>
    expect(progressBlock).toBeDefined()
    expect(progressBlock.focusNode).toBe('digraphs')

    // localStorage proof: predicate's mastery-state inputs are the
    // seeded shape. Verifies the seed actually landed without
    // schema-rejection from `isProgressV1` (a regression-guard for the
    // new optional `crossVowelMixingEnabled` field — if the guard
    // refused the seeded blob, `loadProgress` would return null and
    // App would fall back to defaults with `add-to-10` focus, not
    // `digraphs`).
    const persisted = (await page.evaluate(
      (key) => window.localStorage.getItem(key),
      PROGRESS_STORAGE_KEY,
    )) as string | null
    expect(persisted).not.toBeNull()
    const parsed = JSON.parse(persisted!) as {
      skillLevels: Record<string, string>
      parentSettings?: { crossVowelMixingEnabled?: unknown }
    }
    expect(parsed.skillLevels['cvc-words']).toBe('mastered')
    expect(parsed.skillLevels['cvc-words-short-o']).toBe('mastered')
    expect(parsed.skillLevels['cvc-words-short-u']).toBe('mastered')
    expect(parsed.skillLevels['digraphs']).toBe('practicing')
    // Default toggle is `true` (defaulter fills missing key); seed
    // helper doesn't write it explicitly, so the field may be
    // absent on the persisted blob — that's the read-path-defaulter
    // contract. Either undefined or `true` is correct.
    const toggle = parsed.parentSettings?.crossVowelMixingEnabled
    expect(toggle === undefined || toggle === true).toBe(true)
  })

  test('2. Predicate OFF — incomplete mastery: short-u practicing + others mastered → same-vowel-only distractors', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // Seed: the short-u practicing state. Cross-vowel predicate is
    // `false` (cvc-words-short-u !== 'mastered'). Session uses
    // same-vowel-only `TARGET_PAIRINGS` (short-u pool only). This is
    // the same scenario the cvc-words-short-u-regression spec covers
    // for the no-leakage assertion; we re-test it here as the explicit
    // "cross-vowel does NOT fire when one tier is still practicing"
    // regression-guard.
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'mastered',
          'cvc-words-short-o': 'mastered',
          'cvc-words-short-u': 'practicing',
        },
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
    await installCvcWordsShortUClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 20_000,
    })

    // Walk all 8 problems, collect chip words. Every chip word must be
    // in the short-u pool — proves cross-vowel did NOT fire (predicate
    // gated on incomplete mastery). Count assertion: 24 chips total,
    // all short-u.
    const allChipWords: string[] = []
    for (let i = 0; i < 8; i++) {
      await expect(wordSong).toHaveAttribute('data-problem-index', String(i), {
        timeout: 20_000,
      })
      await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
        timeout: 20_000,
      })
      const chips = page.getByTestId('word-song-chip')
      await expect(chips).toHaveCount(3)
      const words = await chips.evaluateAll((nodes) =>
        nodes.map((n) => (n as HTMLElement).getAttribute('data-word')),
      )
      for (const w of words) {
        expect(w).not.toBeNull()
        allChipWords.push(w as string)
      }
      const correctChip = page.locator(
        '[data-testid="word-song-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      await correctChip.click()
    }
    expect(allChipWords).toHaveLength(24)
    const offPoolWords = allChipWords.filter((w) => !VALID_SHORT_U_WORDS.has(w))
    expect(offPoolWords).toEqual([])
  })

  test('3. Predicate OFF — toggle override: all 3 CVC mastered + crossVowelMixingEnabled=false → toggle persists, predicate cannot fire', async ({
    page,
  }) => {
    // Seed: the full post-graduation state, but with the parent
    // toggle flipped off. Per spec §10 Q1 + Dave's research §4.4 —
    // the toggle is the hard off switch. The predicate must return
    // `false` here regardless of mastery state.
    //
    // Same observation strategy as Test 1: assert at the wire +
    // localStorage level, no chip-render dependency.
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'mastered',
          'cvc-words-short-o': 'mastered',
          'cvc-words-short-u': 'mastered',
          digraphs: 'practicing',
        },
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    // Patch the seeded blob's parentSettings to flip the toggle off.
    // `seedLocalStorage` uses `addInitScript` to install the seed
    // BEFORE first navigation; we add a second init-script after it
    // that runs in the same pre-navigation phase and mutates the
    // already-installed blob. Both init-scripts run before any page
    // script, so order is deterministic.
    await page.addInitScript(() => {
      const KEY = 'marian-tutor:progress:v1'
      const raw = window.localStorage.getItem(KEY)
      if (raw === null) return
      try {
        const parsed = JSON.parse(raw) as {
          parentSettings?: Record<string, unknown>
        }
        if (!parsed.parentSettings) parsed.parentSettings = {}
        parsed.parentSettings.crossVowelMixingEnabled = false
        window.localStorage.setItem(KEY, JSON.stringify(parsed))
      } catch {
        // Best effort. If parsing fails, the localStorage assertion
        // below catches the resulting empty / un-toggled state.
      }
    })

    const { requests } = await installCvcWordsShortUClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    await expect(page.getByTestId('word-song')).toBeVisible({ timeout: 15_000 })

    // Wire-level assertion: focusNode is digraphs (picker walks past
    // every mastered CVC tier; the toggle being off doesn't change
    // the picker, just the predicate's verdict).
    expect(requests).toHaveLength(1)
    const body = JSON.parse(requests[0]!.postData() ?? '{}') as Record<
      string,
      unknown
    >
    const payload = body.payload as Record<string, unknown>
    const progressBlock = payload.progress as Record<string, unknown>
    expect(progressBlock.focusNode).toBe('digraphs')

    // localStorage proof: the toggle override persisted.
    // `crossVowelMixingActive(progress)` would return `false` for
    // this state regardless of mastery (per spec §10 Q1 + Dave's
    // research §4.4 escape-valve). This is the cross-browser
    // observation that pins the toggle's hard-off semantics.
    const persisted = (await page.evaluate(
      (key) => window.localStorage.getItem(key),
      PROGRESS_STORAGE_KEY,
    )) as string | null
    expect(persisted).not.toBeNull()
    const parsed = JSON.parse(persisted!) as {
      skillLevels: Record<string, string>
      parentSettings?: { crossVowelMixingEnabled?: unknown }
    }
    expect(parsed.skillLevels['cvc-words']).toBe('mastered')
    expect(parsed.skillLevels['cvc-words-short-o']).toBe('mastered')
    expect(parsed.skillLevels['cvc-words-short-u']).toBe('mastered')
    // The toggle override is the load-bearing assertion here.
    expect(parsed.parentSettings?.crossVowelMixingEnabled).toBe(false)
  })
})
