/**
 * E2E spec — Progression mastery loop: intro → practicing → mastered.
 *
 * Tickets:
 *   - 86c9qu91g — original four nodes (PR #202): covers the gap that
 *     allowed the intro→practicing missing-transition bug to ship to
 *     production undetected.
 *   - 86c9teuf0 — Part 3 cvc-words-short-e (this PR): empirical
 *     lock-in for Kevin's parallel canon-wire ticket 86c9teua2. The
 *     Part 3 suite was authored failing-first against pre-canon-wire
 *     main; it flips RED→GREEN when Kevin's PR merges. See the
 *     Part 3 header block below for the contract.
 *
 * THE BUG (pre-fix on main)
 * -------------------------
 * `applyMasteryRule()` in `src/lib/progress/mastery.ts` only walked nodes
 * at `'practicing'` and explicitly skipped `'intro'`. The mastery rule
 * handled `practicing → mastered` (and `locked → intro` for downstream
 * unlocks) but had NO path for `intro → practicing`. As a result, four
 * default-`'intro'` nodes in the diagnostic baseline were permanently
 * stuck:
 *
 *   - `cvc-words`    (word-song track, diagnostic default)
 *   - `sub-to-20`    (math track, diagnostic default)
 *   - `mult-2-5-10`  (math track, diagnostic default)
 *   - `sight-words`  (word-song track, diagnostic default)
 *
 * Kevin's fix in PR #201 (commit `ce9c557`) added the intro→practicing
 * pass before the practicing→mastered scan. Rule: if history contains any
 * entry for the node with `successRate > 0`, advance to `'practicing'`.
 *
 * What these four suites lock in
 * ------------------------------
 * Each suite seeds the target node at `'intro'` with prerequisites
 * mastered, runs 2 perfect sessions (80%/2 threshold, crossDay off), and
 * asserts the post-fix terminal state.
 *
 * Graduation-gate caveat for cvc-words
 * ------------------------------------
 * `cvc-words` is graduation-gated (`WORD_SONG_GRADUATION_GATED_NODES`):
 * mastery requires a graduation session with a passing
 * `novelPoolSuccessRate`. Two plain perfect sessions advance it to
 * `'practicing'` but NOT to `'mastered'` — that's the documented
 * behaviour Kevin's own mastery.test.ts case validates. The downstream
 * `cvc-words-short-o` therefore stays `'locked'` (the unlock cascade
 * only fires on `'mastered'`). The cvc-words assertion below is the
 * `intro → practicing` half of the ladder; the graduation-session test
 * is a separate concern (covered by `plannerRoundTrip` + the existing
 * cvc-words regression specs).
 *
 * The OTHER three nodes (`sub-to-20`, `mult-2-5-10`, `sight-words`) are
 * NOT graduation-gated, so two perfect sessions DO advance them all the
 * way to `'mastered'` with the downstream node flipped to `'intro'`.
 *
 * Threshold + cross-day setup
 * ---------------------------
 * 80%/2 with `crossDayEnforcement: false` so two back-to-back sessions
 * qualify. This is the most lenient preset and sidesteps day-key
 * complexity. The bug (intro stuck forever) and the fix (intro→practicing
 * pass) are observable at any threshold; we pick the cheapest one.
 *
 * Session-driving strategy
 * ------------------------
 * Both math and word-song sessions use `failNetwork: true` (silent
 * caption-walk fallback driven by the static plan). Chips become
 * enabled once the read-aloud effect's `audioReady` flips true. No
 * audio-decode costs in CI.
 *
 * Chromium-only (webkit skip)
 * ---------------------------
 * WebKit headless has no AudioContext; the read-aloud effect's
 * `getHowlerRunningFn()` predicate stays false forever and chips never
 * enable. This is a Playwright harness limitation — real iPad Safari has
 * a working AudioContext post-gesture. Mirroring the pattern in
 * `cvc-words-regression.spec.ts`, each test calls `skipOnWebkitHeadless`
 * to skip on the webkit project. The progression-state-machine surface
 * is engine-agnostic; chromium coverage is sufficient.
 *
 * Count-based assertions
 * ----------------------
 * Per `feedback_count_assertions_on_regression_tests`: `.toBe()` with
 * exact expected values, `.toEqual([...])` for arrays. Never `.toContain`.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  forceHowlerUnlock,
  readProgressFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'

interface PersistedProgress {
  skillLevels: Record<string, string>
  history: Array<{ dateISO: string; skillFocus: string[]; successRate: number }>
}

/**
 * WebKit headless has no AudioContext. Read-aloud effect's
 * `getHowlerRunningFn()` predicate stays false forever; chips never
 * become enabled and any chip-tap test times out. Real iPad Safari
 * works fine — this is a Playwright harness limitation only.
 *
 * Pattern mirrored from `cvc-words-regression.spec.ts:282-290`.
 */
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud cannot fire. Chromium coverage is sufficient for progression state-machine surface.',
  )
}

// ── shared helpers ─────────────────────────────────────────────────────────

/**
 * Drive one complete math session: Hub → Number Garden → 8 correct chip
 * taps → SessionEnd → "All done!" → Hub.
 */
async function runOneMathSession(
  page: import('@playwright/test').Page,
): Promise<void> {
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  await page
    .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
    .click()
  await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

  for (let i = 1; i <= 8; i++) {
    const correctChip = page.locator(
      '[data-testid="math-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeEnabled({ timeout: 15_000 })
    await correctChip.click()
    if (i < 8) {
      await page.waitForTimeout(1500)
    }
  }

  await expect(page.getByTestId('session-end')).toBeVisible({ timeout: 10_000 })
  const cta = page.getByTestId('session-end-cta')
  await expect(cta).toBeVisible({ timeout: 12_000 })
  await cta.click()
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
}

/**
 * Drive one complete word-song session: Hub → Word Song → 8 correct chip
 * taps → SessionEnd → "All done!" → Hub.
 */
async function runOneWordSongSession(
  page: import('@playwright/test').Page,
): Promise<void> {
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  await page
    .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
    .click()
  await expect(page.getByTestId('word-song')).toBeVisible({ timeout: 10_000 })

  for (let i = 1; i <= 8; i++) {
    const correctChip = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeEnabled({ timeout: 15_000 })
    await correctChip.click()
    if (i < 8) {
      await page.waitForTimeout(1500)
    }
  }

  await expect(page.getByTestId('session-end')).toBeVisible({ timeout: 10_000 })
  const cta = page.getByTestId('session-end-cta')
  await expect(cta).toBeVisible({ timeout: 12_000 })
  await cta.click()
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
}

// ── Part 1 — cvc-words (graduation-gated; verifies intro → practicing) ─────

test.describe('Progression loop — cvc-words (intro → practicing, graduation-gated)', () => {
  test.beforeEach(async ({ page }) => {
    // failNetwork-canon-pinning audit (86c9y49bu): STRUCTURALLY SAFE.
    // Focus is `cvc-words` (non-add-to-10/20) but every assertion reads
    // the persisted Progress doc (skillLevels / skillFocus attribution /
    // successRate / history length) — content-agnostic. The static
    // word-song fallback emits wrong-tier (blending-cv stub) content, but
    // no assertion pins addends / words / utterance text, so the
    // §4.2 failNetwork tier-asymmetry never bites.
    await installClaudeMock(page, { failNetwork: true })

    // Seed: all word-song prerequisites mastered so pickFocusNode lands on
    // cvc-words. cvc-words at 'intro'. cvc-words-short-o 'locked'.
    const progress = buildSeedProgress({
      skillLevelOverrides: {
        'letter-names': 'mastered',
        'letter-sounds': 'mastered',
        'blending-cv': 'mastered',
        'cvc-words': 'intro',
        'cvc-words-short-o': 'locked',
        'cvc-words-short-u': 'locked',
        'cvc-words-short-i': 'locked',
        'cvc-words-short-e': 'locked',
        // Digraphs split into 3 sequential sibling nodes per PR #211.
        'digraphs-sh': 'locked',
        'digraphs-ch': 'locked',
        'digraphs-th-voiceless': 'locked',
        'sight-words': 'locked',
        'simple-sentences': 'locked',
      },
      masteryThreshold: { percent: 0.8, sessions: 2 },
    })

    // crossDayEnforcement: false so two back-to-back sessions both count.
    // buildSeedProgress hardcodes crossDayEnforcement: true; replace the
    // whole parentSettings via raw spread to override.
    //
    // GOTCHA — `isParentSettings` is STRICT on the per-track shape: when
    // `'math' in mt || 'word-song' in mt`, BOTH `mt.math` AND
    // `mt['word-song']` must be valid thresholds (guards.ts:193-197). A
    // single-track seed (`{ 'word-song': {...} }` alone) makes the guard
    // reject the whole `parentSettings` → `isProgressV1` rejects the
    // blob → `loadProgress()` returns null → app falls back to
    // defaultProgress(). Silent seed-rejection failure mode. Include
    // both tracks here.
    const progressWithNoCrossDay = {
      ...(progress as Record<string, unknown>),
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: {
          math: { percent: 0.8, sessions: 2 },
          'word-song': { percent: 0.8, sessions: 2 },
        },
        crossDayEnforcement: false,
        showLevelToMarian: false,
      },
    }

    await seedLocalStorage(page, {
      progress: progressWithNoCrossDay,
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  /**
   * Pre-fix: cvc-words stays at 'intro' forever.
   * Post-fix: 2 perfect sessions advance cvc-words to 'practicing'.
   *
   * Graduation-gate caveat: cvc-words is in
   * `WORD_SONG_GRADUATION_GATED_NODES`. Two plain perfect sessions are
   * NOT sufficient for 'mastered' — the graduation gate requires a
   * novelPoolSuccessRate entry. So we assert the half of the ladder
   * Kevin's fix actually closes: intro → practicing. cvc-words-short-o
   * stays 'locked' (downstream unlock cascades on 'mastered' only).
   */
  test('two perfect cvc-words sessions advance intro → practicing (graduation gate holds short-o locked)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    await page.goto('/')
    await forceHowlerUnlock(page)

    await runOneWordSongSession(page)
    await runOneWordSongSession(page)

    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted).not.toBeNull()

    // THE SMOKING GUN — pre-fix: 'intro'. Post-fix: 'practicing'.
    expect(persisted.skillLevels['cvc-words']).toBe('practicing')

    // Downstream stays locked — unlock only fires on 'mastered' promotion.
    expect(persisted.skillLevels['cvc-words-short-o']).toBe('locked')

    // History grew by exactly 2 entries.
    expect(persisted.history.length).toBe(2)
    const lastTwo = persisted.history.slice(-2)
    expect(lastTwo[0]!.successRate).toBe(1)
    expect(lastTwo[1]!.successRate).toBe(1)
    expect(lastTwo[0]!.skillFocus).toEqual(['cvc-words'])
    expect(lastTwo[1]!.skillFocus).toEqual(['cvc-words'])
  })
})

// ── Part 2a — sub-to-20 (math, not graduation-gated) ──────────────────────

test.describe('Progression loop — sub-to-20 (intro → mastered)', () => {
  test.beforeEach(async ({ page }) => {
    // failNetwork-canon-pinning audit (86c9y49bu): STRUCTURALLY SAFE.
    // Focus is `sub-to-20` (non-add-to-10/20) and the static fallback
    // serves the wrong-tier add-to-10 rotation — but every assertion
    // reads the persisted Progress doc (skillLevels / skillFocus /
    // history), never the rendered addends/op. Content-agnostic; the
    // §4.2 tier-asymmetry never bites. (Contrast sub-to-20.spec.ts, which
    // DID pin teen-operand content and was migrated to a canon-bytes mock.)
    await installClaudeMock(page, { failNetwork: true })

    const progress = buildSeedProgress({
      skillLevelOverrides: {
        'number-recog': 'mastered',
        'add-to-10': 'mastered',
        'add-to-20': 'mastered',
        'sub-to-10': 'mastered',
        'sub-to-20': 'intro',
        // Wave 5 (ticket 86c9y0bvc) sibling-tier split.
        'two-digit-addsub-no-regroup': 'locked',
        'two-digit-addsub-with-regroup': 'locked',
        'skip-counting': 'locked',
        'mult-2-5-10': 'locked',
        'mult-3-4': 'locked',
        'mult-6-9': 'locked',
      },
      masteryThreshold: { percent: 0.8, sessions: 2 },
    })

    // Both tracks required by isParentSettings strict per-track guard
    // (see cvc-words describe block above for full gotcha note).
    const progressWithNoCrossDay = {
      ...(progress as Record<string, unknown>),
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: {
          math: { percent: 0.8, sessions: 2 },
          'word-song': { percent: 0.8, sessions: 2 },
        },
        crossDayEnforcement: false,
        showLevelToMarian: false,
      },
    }

    await seedLocalStorage(page, {
      progress: progressWithNoCrossDay,
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  /**
   * Pre-fix: sub-to-20 stays at 'intro' forever.
   * Post-fix: 2 perfect sessions → intro → practicing → mastered in one
   * ladder traversal (intro→practicing pass fires session 1; practicing→
   * mastered fires session 2 with both qualifying entries). The NEXT
   * node in `MATH_NODES_IN_ORDER` unlocks from 'locked' → 'intro'.
   *
   * Wave 5 (ticket 86c9y0bvc) sibling-tier split: `'two-digit-addsub'`
   * is now `'two-digit-addsub-no-regroup'` (preserves the existing
   * pedagogical band) — that's the literal that unlocks here. The
   * `'two-digit-addsub-with-regroup'` tier stays 'locked' until the
   * cascade walks past no-regroup later.
   */
  test('two perfect sub-to-20 sessions promote intro → mastered and unlock two-digit-addsub-no-regroup', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    await page.goto('/')
    await forceHowlerUnlock(page)

    await runOneMathSession(page)
    await runOneMathSession(page)

    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted).not.toBeNull()

    expect(persisted.skillLevels['sub-to-20']).toBe('mastered')
    // Wave 5 (ticket 86c9y0bvc) sibling-tier split — the cascade lands
    // on the no-regroup tier first; with-regroup stays locked until
    // no-regroup masters.
    expect(persisted.skillLevels['two-digit-addsub-no-regroup']).toBe('intro')
    expect(persisted.skillLevels['two-digit-addsub-with-regroup']).toBe(
      'locked',
    )

    expect(persisted.history.length).toBe(2)
    const lastTwo = persisted.history.slice(-2)
    expect(lastTwo[0]!.successRate).toBe(1)
    expect(lastTwo[1]!.successRate).toBe(1)
    expect(lastTwo[0]!.skillFocus).toEqual(['sub-to-20'])
    expect(lastTwo[1]!.skillFocus).toEqual(['sub-to-20'])
  })
})

// ── Part 2b — mult-2-5-10 (math, not graduation-gated) ─────────────────────

test.describe('Progression loop — mult-2-5-10 (intro → mastered)', () => {
  test.beforeEach(async ({ page }) => {
    // failNetwork-canon-pinning audit (86c9y49bu): STRUCTURALLY SAFE.
    // Focus is `mult-2-5-10` (non-add-to-10/20) → static fallback serves
    // wrong-tier add-to-10 content, but every assertion reads the
    // persisted Progress doc (skillLevels / skillFocus / history). No
    // multiplication operand/×-glyph content is pinned, so the §4.2
    // tier-asymmetry never bites.
    await installClaudeMock(page, { failNetwork: true })

    const progress = buildSeedProgress({
      skillLevelOverrides: {
        'number-recog': 'mastered',
        'add-to-10': 'mastered',
        'add-to-20': 'mastered',
        'sub-to-10': 'mastered',
        'sub-to-20': 'mastered',
        // Wave 5 (ticket 86c9y0bvc) sibling-tier split — both tiers
        // mastered to land the picker downstream at mult-2-5-10.
        'two-digit-addsub-no-regroup': 'mastered',
        'two-digit-addsub-with-regroup': 'mastered',
        'skip-counting': 'mastered',
        'mult-2-5-10': 'intro',
        'mult-3-4': 'locked',
        'mult-6-9': 'locked',
      },
      masteryThreshold: { percent: 0.8, sessions: 2 },
    })

    // Both tracks required (see cvc-words describe block for the gotcha).
    const progressWithNoCrossDay = {
      ...(progress as Record<string, unknown>),
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: {
          math: { percent: 0.8, sessions: 2 },
          'word-song': { percent: 0.8, sessions: 2 },
        },
        crossDayEnforcement: false,
        showLevelToMarian: false,
      },
    }

    await seedLocalStorage(page, {
      progress: progressWithNoCrossDay,
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  /**
   * Pre-fix: mult-2-5-10 stays at 'intro' forever.
   * Post-fix: full intro → practicing → mastered ladder, mult-3-4 unlocks.
   */
  test('two perfect mult-2-5-10 sessions promote intro → mastered and unlock mult-3-4', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    await page.goto('/')
    await forceHowlerUnlock(page)

    await runOneMathSession(page)
    await runOneMathSession(page)

    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted).not.toBeNull()

    expect(persisted.skillLevels['mult-2-5-10']).toBe('mastered')
    expect(persisted.skillLevels['mult-3-4']).toBe('intro')

    expect(persisted.history.length).toBe(2)
    const lastTwo = persisted.history.slice(-2)
    expect(lastTwo[0]!.successRate).toBe(1)
    expect(lastTwo[1]!.successRate).toBe(1)
    expect(lastTwo[0]!.skillFocus).toEqual(['mult-2-5-10'])
    expect(lastTwo[1]!.skillFocus).toEqual(['mult-2-5-10'])
  })
})

// ── Part 3 — cvc-words-short-e (intro → practicing → mastered) ────────────
//
// Ticket 86c9teuf0 — paired with Kevin's canon-wire ticket 86c9teua2.
//
// THE FAILING-FIRST CONTRACT
// --------------------------
// This describe block was authored BEFORE Kevin's PR landed
// `cvc-words-short-e` in the codebase. On main at authoring time
// (commit d56103a), the node literal `'cvc-words-short-e'` exists
// nowhere in source:
//   - NOT in `WordSongNode` union (`src/lib/progress/types.ts`)
//   - NOT in `SKILL_NODES` (`src/lib/progress/guards.ts`)
//   - NOT in `LITERACY_TREE` (`src/lib/progress/mastery.ts`)
//   - NOT in `WORD_SONG_NODES_IN_ORDER` (`src/lib/progress/focusNode.ts`)
//   - NOT in `DEFAULT_SKILL_LEVELS` (this file's seed defaults)
//
// On pre-Kevin main, the test runs but fails for the right reason:
//   1. Seeding `'cvc-words-short-e': 'intro'` as an extra
//      skillLevels key passes the strict guard (the guard iterates
//      the known SKILL_NODES set and reads each — extra keys are
//      tolerated, see isSkillLevels in guards.ts:55-64).
//   2. `pickFocusNode` walks `WORD_SONG_NODES_IN_ORDER` left-to-right
//      and stops at the first non-mastered node. With every node
//      through `cvc-words-short-i` seeded `'mastered'`, the picker
//      lands on `digraphs-sh` (currently `'locked'`) — NOT on the new
//      `cvc-words-short-e` which is invisible to the picker.
//   3. Sessions therefore log `skillFocus: ['digraphs-sh']`, NOT
//      `['cvc-words-short-e']`. `applyMasteryRule` iterates
//      `LITERACY_TREE` (which doesn't contain the new node either),
//      so the intro→practicing pass never fires on the new node
//      and the practicing→mastered scan never sees it. The extra
//      key stays at `'intro'` forever in the persisted blob.
//   4. The final assertion `.toBe('mastered')` fails on pre-Kevin
//      main: actual is `'intro'`. This is the RED state — the
//      empirical proof that without Kevin's wire-up, the node is
//      unreachable by the state machine.
//      (PR #211 note: post-split, the leading digraph node is
//      `digraphs-sh` rather than the legacy `digraphs` literal —
//      same shape, just renamed.)
//
// POST-KEVIN GREEN STATE
// ----------------------
// Kevin's PR (ticket 86c9teua2) adds `cvc-words-short-e` to all
// five lists above, slotting it BETWEEN `cvc-words-short-i` and
// `digraphs` in both the tree and the picker order. After the rebase
// onto post-merge main:
//   1. The picker chooses `cvc-words-short-e` (since it's now in
//      the order and seeded `'intro'` < `'mastered'`).
//   2. Session 1 records `skillFocus: ['cvc-words-short-e']`,
//      `successRate: 1.0`. `applyMasteryRule` runs after save: the
//      intro→practicing pass sees `successRate > 0` and advances
//      the node to `'practicing'`.
//   3. Sessions 2-4 record three more perfect entries. The
//      practicing→mastered scan in session 4's `applyMasteryRule`
//      call walks the 90/3 window, sees the last 3 entries all
//      hit 1.0 >= 0.9, and promotes to `'mastered'`. Downstream
//      `digraphs-sh` flips `'locked' → 'intro'`.
//   4. The final assertions all pass: short-e is `'mastered'`,
//      `digraphs-sh` is `'practicing'` (after session 4 ran on it),
//      history has 4 entries.
//
// FOUR TRANSITIONS LOCKED
// -----------------------
//   - `locked → intro` (covered by the schema-floor seed default
//     pattern; this suite seeds short-e directly at `'intro'` so
//     the test focuses on the downstream three edges)
//   - `intro → practicing` (session 1's intro-pass; PR #201 invariant)
//   - `practicing → mastered` (session 4's 90/3 scan; standard rule)
//   - `digraphs-sh: locked → intro` (downstream unlock cascade)
//
// THRESHOLD CHOICE
// ----------------
// Per-track 90/3 with `crossDayEnforcement: false`. Matches the
// project default (`word-song: 0.9 percent / 3 sessions`) — verifies
// AC10 (the 90/3 rule applies without special-casing for short-e).
// Earlier suites in this file used 80/2 to minimise session count
// for the intro-pass-specific regressions; this suite uses 90/3 to
// pin the full production threshold path end-to-end.
//
// Why 4 sessions, not 3
// ---------------------
// The intro→practicing pass fires INSIDE the same `applyMasteryRule`
// call that records session 1's entry. After session 1: node is
// `'practicing'`, history has 1 entry — not enough for promotion
// (1 < 3). After session 3: 3 entries, all at 1.0 — the
// practicing→mastered scan promotes in session 3's call. 3 perfect
// sessions are mathematically sufficient.
//
// The brief specified "1 perfect session" then "3 more" (= 4 total)
// to make the intermediate `'practicing'` state observable as its
// own assertion checkpoint. We run all 4 and assert at two
// checkpoints (after session 1: `'practicing'`; after session 4:
// `'mastered'` plus digraphs unlock). The session 4 read is a
// belt-and-braces on idempotence — `applyMasteryRule` after
// promotion leaves `'mastered'` undisturbed.

test.describe('Progression loop — cvc-words-short-e (intro → practicing → mastered)', () => {
  test.beforeEach(async ({ page }) => {
    // failNetwork-canon-pinning audit (86c9y49bu): STRUCTURALLY SAFE.
    // Focus is `cvc-words-short-e` (non-add-to-10/20) → static word-song
    // fallback emits wrong-tier (blending-cv stub) content, but every
    // assertion reads the persisted Progress doc (skillLevels /
    // skillFocus / history). No short-e word/picture content is pinned,
    // so the §4.2 tier-asymmetry never bites.
    await installClaudeMock(page, { failNetwork: true })

    // Seed: every word-song node UP TO AND INCLUDING `cvc-words-short-i`
    // is `'mastered'`. The new sibling `cvc-words-short-e` lives at
    // `'intro'`. `digraphs` is `'locked'` so we can observe the
    // downstream cascade on promotion.
    //
    // Note: seed via `skillLevelOverrides` even for `cvc-words-short-e`
    // — the helper's type signature is `Record<string, string>`, so
    // the new node literal (not yet in `WordSongNode` union on
    // pre-Kevin main) is accepted as a string key. The runtime guard
    // tolerates the extra key (`isSkillLevels` only requires the
    // known set to be present, not exclusive). Post-Kevin-merge, the
    // type widens and the literal becomes well-typed without any
    // change to this seed shape.
    const progress = buildSeedProgress({
      skillLevelOverrides: {
        'letter-names': 'mastered',
        'letter-sounds': 'mastered',
        'blending-cv': 'mastered',
        'cvc-words': 'mastered',
        'cvc-words-short-o': 'mastered',
        'cvc-words-short-u': 'mastered',
        'cvc-words-short-i': 'mastered',
        'cvc-words-short-e': 'intro',
        // Digraphs split into 3 sequential sibling nodes per PR #211.
        // The leading sibling `digraphs-sh` is the downstream node
        // that unlocks on cvc-words-short-e mastery.
        'digraphs-sh': 'locked',
        'digraphs-ch': 'locked',
        'digraphs-th-voiceless': 'locked',
        'sight-words': 'locked',
        'simple-sentences': 'locked',
      },
      // 90/3 — full production word-song threshold. AC10 in the
      // dispatch brief calls this out explicitly: short-e must
      // graduate under the standard rule without special-casing.
      masteryThreshold: { percent: 0.9, sessions: 3 },
    })

    // Both tracks required by the strict per-track guard (see the
    // cvc-words describe block above for the long-form gotcha). We
    // intentionally set math to a value that can never qualify
    // accidentally (95/3) so the four word-song sessions in this
    // suite don't get caught by some unrelated math node we missed.
    const progressWithNoCrossDay = {
      ...(progress as Record<string, unknown>),
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: {
          math: { percent: 0.95, sessions: 3 },
          'word-song': { percent: 0.9, sessions: 3 },
        },
        crossDayEnforcement: false,
        showLevelToMarian: false,
      },
    }

    await seedLocalStorage(page, {
      progress: progressWithNoCrossDay,
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  /**
   * Pre-Kevin (RED): `pickFocusNode` chooses `digraphs-sh` because
   * `cvc-words-short-e` is invisible to the picker. Sessions log
   * `skillFocus: ['digraphs-sh']`. The extra `'cvc-words-short-e': 'intro'`
   * key sits inert in `skillLevels`. After 4 sessions, the assertion
   * `.toBe('practicing')` after session 1 fails on actual `'intro'`.
   *
   * Post-Kevin (GREEN): all four transitions fire, sessions log
   * `['cvc-words-short-e']` focus, history accumulates to 4 entries,
   * mastery rule promotes to `'mastered'` and unlocks `digraphs-sh`.
   * (PR #211 split the dead `digraphs` literal into 3 sequential
   * sibling nodes; the leading sibling `digraphs-sh` is the downstream
   * node that unlocks on cvc-words-short-e mastery — same shape as
   * the pre-split contract, just renamed.)
   */
  test('four perfect cvc-words-short-e sessions: intro → practicing (session 1) → mastered (session 4); digraphs-sh unlocks', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // 4 sessions × ~25s each (1500ms × 8 chips + nav overhead) overruns
    // the 90s default Playwright test timeout. The other suites in this
    // file are 2-session and fit comfortably. Bump per-test to give the
    // 4-session ladder ~30s of headroom on slow CI runners.
    test.setTimeout(240_000)

    await page.goto('/')
    await forceHowlerUnlock(page)

    // ── Session 1: intro → practicing ─────────────────────────────────
    await runOneWordSongSession(page)

    const afterSession1 = (await readProgressFromPage(
      page,
    )) as PersistedProgress
    expect(afterSession1).not.toBeNull()

    // SMOKING GUN A — intro→practicing fires on first perfect session.
    expect(afterSession1.skillLevels['cvc-words-short-e']).toBe('practicing')

    // Downstream stays locked (cascade only fires on 'mastered').
    expect(afterSession1.skillLevels['digraphs-sh']).toBe('locked')

    // Exactly one history entry recorded against the new node.
    expect(afterSession1.history.length).toBe(1)
    expect(afterSession1.history[0]!.skillFocus).toEqual(['cvc-words-short-e'])
    expect(afterSession1.history[0]!.successRate).toBe(1)

    // ── Sessions 2-4: practicing → mastered + digraphs unlock ─────────
    await runOneWordSongSession(page)
    await runOneWordSongSession(page)
    await runOneWordSongSession(page)

    const afterSession4 = (await readProgressFromPage(
      page,
    )) as PersistedProgress
    expect(afterSession4).not.toBeNull()

    // SMOKING GUN B — practicing→mastered fires under the 90/3 window
    // (AC10: standard rule applies, no special-casing for short-e).
    expect(afterSession4.skillLevels['cvc-words-short-e']).toBe('mastered')

    // SMOKING GUN C — downstream `digraphs-sh` unlocks on mastery
    // and immediately advances to 'practicing' on session 4.
    //
    // Cascade chain: session 3's `applyMasteryRule` call promotes
    // short-e to 'mastered' and flips `digraphs-sh: 'locked' → 'intro'`
    // in the same pass. The picker then targets `digraphs-sh` for
    // session 4 (next non-mastered word-song node). Session 4's
    // `applyMasteryRule` call observes a `digraphs-sh` history entry
    // with successRate=1.0 and fires the PR #201 intro→practicing
    // rule. Net post-session-4 state: digraphs-sh at 'practicing'.
    //
    // This is the empirically-correct compounded state — confirms
    // BOTH the unlock cascade and the intro→practicing rule are
    // wired correctly through the cvc-words-short-e milestone.
    // (PR #211 split the dead `digraphs` literal into 3 sequential
    // sibling nodes; this assertion pins the leading sibling as the
    // freshly-unlocked downstream.)
    expect(afterSession4.skillLevels['digraphs-sh']).toBe('practicing')

    // History has all 4 entries. The first 3 are short-e (sessions
    // 1-3 ran short-e per pickFocusNode); session 4 ran digraphs-sh
    // because short-e mastered at end-of-session-3 advanced the
    // picker.
    expect(afterSession4.history.length).toBe(4)
    const lastFour = afterSession4.history.slice(-4)
    expect(lastFour[0]!.successRate).toBe(1)
    expect(lastFour[1]!.successRate).toBe(1)
    expect(lastFour[2]!.successRate).toBe(1)
    expect(lastFour[3]!.successRate).toBe(1)
    expect(lastFour[0]!.skillFocus).toEqual(['cvc-words-short-e'])
    expect(lastFour[1]!.skillFocus).toEqual(['cvc-words-short-e'])
    expect(lastFour[2]!.skillFocus).toEqual(['cvc-words-short-e'])
    expect(lastFour[3]!.skillFocus).toEqual(['digraphs-sh'])
  })
})

// ── Part 2c — sight-words (word-song, not graduation-gated) ────────────────

test.describe('Progression loop — sight-words (intro → mastered)', () => {
  test.beforeEach(async ({ page }) => {
    // failNetwork-canon-pinning audit (86c9y49bu): STRUCTURALLY SAFE.
    // Focus is `sight-words` (non-add-to-10/20) → static word-song
    // fallback emits wrong-tier content, but every assertion reads the
    // persisted Progress doc (skillLevels / skillFocus / history). No
    // sight-word content is pinned, so the §4.2 tier-asymmetry never bites.
    await installClaudeMock(page, { failNetwork: true })

    // Seed: all word-song prerequisites mastered (including the three
    // digraph siblings, the nodes directly before sight-words in
    // WORD_SONG_NODES_IN_ORDER post-PR-#211 split).
    //
    // `cvc-words-short-e` mastered too (ticket 86c9teua2) — without
    // this entry the picker would land on cvc-words-short-e (default
    // 'locked') before reaching sight-words, and the simulated "perfect
    // sight-words session" would run a short-e session instead, leaving
    // sight-words at 'intro' forever. Mirrors the same Place-8 widening
    // applied to `cvc-cross-vowel-mix-regression.spec.ts` in PR #208.
    //
    // PR #211 split the dead `digraphs` literal into 3 sequential
    // sibling nodes; all three must be at 'mastered' here for the
    // picker to reach `sight-words`. Same Place-8 pattern.
    const progress = buildSeedProgress({
      skillLevelOverrides: {
        'letter-names': 'mastered',
        'letter-sounds': 'mastered',
        'blending-cv': 'mastered',
        'cvc-words': 'mastered',
        'cvc-words-short-o': 'mastered',
        'cvc-words-short-u': 'mastered',
        'cvc-words-short-i': 'mastered',
        'cvc-words-short-e': 'mastered',
        'digraphs-sh': 'mastered',
        'digraphs-ch': 'mastered',
        'digraphs-th-voiceless': 'mastered',
        'sight-words': 'intro',
        'simple-sentences': 'locked',
      },
      masteryThreshold: { percent: 0.8, sessions: 2 },
    })

    // Both tracks required (see cvc-words describe block for the gotcha).
    const progressWithNoCrossDay = {
      ...(progress as Record<string, unknown>),
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: {
          math: { percent: 0.8, sessions: 2 },
          'word-song': { percent: 0.8, sessions: 2 },
        },
        crossDayEnforcement: false,
        showLevelToMarian: false,
      },
    }

    await seedLocalStorage(page, {
      progress: progressWithNoCrossDay,
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  /**
   * Pre-fix: sight-words stays at 'intro' forever.
   * Post-fix: full intro → practicing → mastered, simple-sentences unlocks.
   */
  test('two perfect sight-words sessions promote intro → mastered and unlock simple-sentences', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    await page.goto('/')
    await forceHowlerUnlock(page)

    await runOneWordSongSession(page)
    await runOneWordSongSession(page)

    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted).not.toBeNull()

    expect(persisted.skillLevels['sight-words']).toBe('mastered')
    expect(persisted.skillLevels['simple-sentences']).toBe('intro')

    expect(persisted.history.length).toBe(2)
    const lastTwo = persisted.history.slice(-2)
    expect(lastTwo[0]!.successRate).toBe(1)
    expect(lastTwo[1]!.successRate).toBe(1)
    expect(lastTwo[0]!.skillFocus).toEqual(['sight-words'])
    expect(lastTwo[1]!.skillFocus).toEqual(['sight-words'])
  })
})
