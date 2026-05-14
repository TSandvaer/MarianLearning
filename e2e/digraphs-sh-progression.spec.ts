/**
 * E2E spec — digraphs-sh progression mastery loop:
 * locked → intro → practicing → mastered + downstream unlock of digraphs-ch.
 *
 * Ticket: paired with Kevin's SkillNode-split impl PR on branch
 *         `feat/digraph-skillnode-split` (proposal at
 *         design/architecture/digraph-architecture-proposal.md).
 *
 * Mandatory per `feedback_progression_e2e_mandatory.md` memory: any PR
 * touching `mastery.ts` / `focusNode.ts` / `firstEncounterGate.ts` /
 * `parentSettings.ts` must be paired with a Jessica failing-first E2E
 * spec authored AT dispatch time, not after the impl lands. Kevin's
 * split PR touches all of mastery.ts, focusNode.ts, guards.ts, types.ts,
 * defaults.ts (LITERACY_TREE / WORD_SONG_NODES_IN_ORDER / SKILL_NODES /
 * WordSongNode union / SCHEMA_FLOOR_NODES + DEFAULT_SKILL_LEVELS).
 *
 * THE FAILING-FIRST CONTRACT
 * --------------------------
 * This spec was authored BEFORE Kevin's PR landed `digraphs-sh`,
 * `digraphs-ch`, or `digraphs-th-voiceless` in the codebase. On main
 * at authoring time (commit 0c34d89), the only literal that exists is
 * the legacy `'digraphs'` SkillNode which the planner stub-falls-back
 * to `blending-cv` content. None of the three new literals
 * (`'digraphs-sh'`, `'digraphs-ch'`, `'digraphs-th-voiceless'`)
 * exists anywhere in source:
 *   - NOT in `WordSongNode` union (`src/lib/progress/types.ts`)
 *   - NOT in `SKILL_NODES` (`src/lib/progress/guards.ts`)
 *   - NOT in `LITERACY_TREE` (`src/lib/progress/mastery.ts`)
 *   - NOT in `WORD_SONG_NODES_IN_ORDER` (`src/lib/progress/focusNode.ts`)
 *   - NOT in `DEFAULT_SKILL_LEVELS` (`e2e/_helpers/seedStorage.ts`)
 *   - NOT in `SCHEMA_FLOOR_NODES` (`src/lib/progress/defaults.ts`)
 *
 * On pre-Kevin main, the test runs but FAILS for the right reason:
 *   1. Seeding the three new node literals as extra `skillLevels` keys
 *      passes the strict guard (`isSkillLevels` in `guards.ts:55-64`
 *      iterates the known SKILL_NODES set and reads each — extra keys
 *      are tolerated silently). The seeded blob round-trips through
 *      `loadProgress` cleanly.
 *   2. `pickFocusNode` walks `WORD_SONG_NODES_IN_ORDER` left-to-right.
 *      With every node through `cvc-words-short-e` seeded `'mastered'`,
 *      the picker lands on the legacy `'digraphs'` node (currently
 *      `'locked'`) — NOT on the seeded `'digraphs-sh'` which is
 *      invisible to the picker on pre-Kevin main.
 *   3. Sessions therefore log `skillFocus: ['digraphs']`, NOT
 *      `['digraphs-sh']`. `applyMasteryRule` iterates `LITERACY_TREE`
 *      (which doesn't contain the new nodes either), so the
 *      intro→practicing pass never fires on the seeded
 *      `'digraphs-sh': 'intro'` entry. The extra key sits inert at
 *      `'intro'` forever in the persisted blob.
 *   4. The first assertion checkpoint `.toBe('practicing')` after
 *      session 1 fails on pre-Kevin main: actual is `'intro'`. This
 *      is the RED state — the empirical proof that without Kevin's
 *      SkillNode split, the new digraph nodes are unreachable by
 *      the state machine.
 *
 * POST-KEVIN GREEN STATE
 * ----------------------
 * Kevin's PR adds `digraphs-sh`, `digraphs-ch`, and
 * `digraphs-th-voiceless` to all five-plus lists above, slotting them
 * BETWEEN `cvc-words-short-e` and `sight-words` in both the tree and
 * the picker order. After rebase onto post-merge main:
 *   1. The picker chooses `digraphs-sh` (since it's now in the order
 *      and seeded `'intro'` < `'mastered'`).
 *   2. Session 1 records `skillFocus: ['digraphs-sh']`,
 *      `successRate: 1.0`. `applyMasteryRule` runs after save: the
 *      intro→practicing pass sees `successRate > 0` and advances the
 *      node to `'practicing'`.
 *   3. Sessions 2-3 record two more perfect entries. The
 *      practicing→mastered scan in session 3's `applyMasteryRule` call
 *      walks the 90/3 window, sees the last 3 entries all hit
 *      1.0 >= 0.9, and promotes to `'mastered'`. Downstream
 *      `digraphs-ch` flips `'locked' → 'intro'`.
 *   4. Session 4 runs `digraphs-ch` per the picker's new selection.
 *      Session 4's intro→practicing pass advances it to `'practicing'`.
 *   5. The final assertions all pass: `digraphs-sh: 'mastered'`,
 *      `digraphs-ch: 'practicing'`, history has 4 entries.
 *
 * FOUR TRANSITIONS LOCKED
 * -----------------------
 *   - `locked → intro` (covered by the schema-floor seed default
 *     pattern; this suite seeds `digraphs-sh` directly at `'intro'` so
 *     the test focuses on the downstream three edges. The schema-floor
 *     fill behaviour is tested separately in `storage.test.ts`.)
 *   - `intro → practicing` (session 1's intro-pass; PR #201 invariant)
 *   - `practicing → mastered` (session 3's 90/3 scan; standard rule
 *     per `parentSettings.masteryThreshold['word-song']` default)
 *   - `digraphs-ch: locked → intro → practicing` (downstream unlock
 *     cascade + first-session intro-pass — same compounded state the
 *     short-e spec asserts for the digraphs cascade)
 *
 * THRESHOLD CHOICE
 * ----------------
 * Per-track 90/3 with `crossDayEnforcement: false`. Matches the
 * project default (`word-song: 0.9 percent / 3 sessions`). Same shape
 * as the cvc-words-short-e Part 3 suite in
 * `progression-mastery-loop.spec.ts` — verifies the standard rule
 * applies to digraph-sh without special-casing.
 *
 * Why 4 sessions, not 3
 * ---------------------
 * 3 perfect sessions are mathematically sufficient to promote
 * `digraphs-sh` to `'mastered'` and unlock `digraphs-ch` to `'intro'`.
 * Running a 4th session demonstrates the picker's onward walk
 * (`digraphs-sh` mastered → picker lands on `digraphs-ch`) AND
 * confirms the intro→practicing self-heal fires for the freshly-
 * unlocked downstream node. Same belt-and-braces pattern as the
 * short-e spec's Part 3 final-state assertion.
 *
 * NODE NAMING SOURCE
 * ------------------
 * The three node literals (`'digraphs-sh'`, `'digraphs-ch'`,
 * `'digraphs-th-voiceless'`) come from §2.5 of
 * `design/architecture/digraph-architecture-proposal.md`. Kevin's
 * split PR uses these exact strings (verified in proposal §2.5 lines
 * 185-204).
 *
 * SUSPECT REGRESSION GUARD
 * ------------------------
 * If a future PR adds `digraphs-sh` to `SKILL_NODES`/types but FAILS
 * to insert it into `WORD_SONG_NODES_IN_ORDER`, the picker would
 * still bypass it and land on the legacy `'digraphs'` (or, if that's
 * removed, on `sight-words`). This spec catches that regression
 * because the first-session assertion requires the picker to actually
 * focus `digraphs-sh` — not just for the literal to exist in the
 * union.
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
 * Pattern mirrored from `progression-mastery-loop.spec.ts`.
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

/**
 * Drive one complete word-song session: Hub → Word Song → 8 correct
 * chip taps → SessionEnd → "All done!" → Hub. Mirrors the helper in
 * `progression-mastery-loop.spec.ts:155-180`.
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

// ── digraphs-sh progression (locked → intro → practicing → mastered) ───────

test.describe('Progression loop — digraphs-sh (intro → practicing → mastered; unlocks digraphs-ch)', () => {
  test.beforeEach(async ({ page }) => {
    await installClaudeMock(page, { failNetwork: true })

    // Seed: every word-song node UP TO AND INCLUDING `cvc-words-short-e`
    // is `'mastered'`. The three new digraph siblings carry the shape
    // Kevin's PR will introduce — `digraphs-sh: 'intro'`, the other two
    // `'locked'`. The legacy single `digraphs` literal is also seeded at
    // `'locked'` so pre-Kevin main runs with a consistent baseline (the
    // picker on pre-Kevin main lands on `'digraphs'`; on post-Kevin main
    // the legacy literal is either renamed-to or removed and the seeded
    // extra key is invisible to the runtime).
    //
    // Per `testing-and-ci.md` §4.1.1a: `skillLevelOverrides` is typed
    // `Record<string, string>`, so the new literals (not yet in
    // `WordSongNode` union on pre-Kevin main) are accepted as string
    // keys. The runtime guard tolerates extra keys (`isSkillLevels`
    // only requires the known set to be present, not exclusive). Post-
    // Kevin merge, the type widens and the literals become well-typed
    // without any change to this seed shape.
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
        // Pre-Kevin main has only `digraphs` as a known literal; post-
        // Kevin main introduces the three siblings below. Seed both
        // shapes — the strict guard tolerates extra keys, and the
        // post-Kevin picker walks past the (now-irrelevant or removed)
        // legacy `digraphs` key.
        digraphs: 'locked',
        'digraphs-sh': 'intro',
        'digraphs-ch': 'locked',
        'digraphs-th-voiceless': 'locked',
        'sight-words': 'locked',
        'simple-sentences': 'locked',
      },
      // 90/3 — full production word-song threshold. Verifies the
      // standard mastery rule applies to digraphs-sh without
      // special-casing.
      masteryThreshold: { percent: 0.9, sessions: 3 },
    })

    // GOTCHA — `isParentSettings` is STRICT on the per-track shape: when
    // `'math' in mt || 'word-song' in mt`, BOTH `mt.math` AND
    // `mt['word-song']` must be valid thresholds (guards.ts:194-197).
    // A single-track seed (`{ 'word-song': {...} }` alone) makes the
    // guard reject the whole `parentSettings` → `isProgressV1`
    // rejects the blob → `loadProgress()` returns null → app falls
    // back to `defaultProgress()`. Silent seed-rejection failure mode.
    // Both tracks must be included. Math is set to 95/3 (default-
    // shape value, never qualifies accidentally on the four word-song
    // sessions in this suite).
    //
    // crossDayEnforcement: false so four back-to-back sessions all count.
    // buildSeedProgress hardcodes crossDayEnforcement: true; replace
    // the whole parentSettings via raw spread to override.
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
   * Pre-Kevin (RED): `pickFocusNode` chooses the legacy `'digraphs'`
   * literal because the three new digraph siblings are invisible to
   * the picker. Sessions log `skillFocus: ['digraphs']`. The seeded
   * `'digraphs-sh': 'intro'` extra-key sits inert in `skillLevels`.
   * After 4 sessions, the first assertion checkpoint
   * `.toBe('practicing')` after session 1 fails on actual `'intro'`.
   *
   * Post-Kevin (GREEN): all four transitions fire, sessions 1-3 log
   * `['digraphs-sh']` focus, session 4 logs `['digraphs-ch']` after the
   * unlock cascade, history accumulates to 4 entries, mastery rule
   * promotes `digraphs-sh` to `'mastered'` at end-of-session-3 and
   * unlocks `digraphs-ch` to `'intro'`. Session 4 advances it to
   * `'practicing'` via the intro→practicing self-heal (PR #201).
   *
   * Failing-first per `feedback_progression_e2e_mandatory`. Will be
   * RED until Kevin's SkillNode-split PR merges.
   */
  test('four perfect digraphs-sh sessions: intro → practicing (session 1) → mastered (session 3); digraphs-ch unlocks → practicing', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // 4 sessions × ~25s each (1500ms × 8 chips + nav overhead) overruns
    // the 90s default Playwright test timeout. Per
    // `testing-and-ci.md` §4.1.1b sizing rule:
    //   sessions × wall_time + ≥30s headroom = 4 × 50s + 40s = 240s.
    // Same as the cvc-words-short-e Part 3 suite — proven survivor of
    // a full GREEN walk-through on the silent-caption-walk fallback
    // path.
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
    // Pre-Kevin: this is 'intro' because the picker focused the legacy
    // `'digraphs'` literal, not `'digraphs-sh'`. Post-Kevin: this is
    // 'practicing' per PR #201's intro-pass.
    expect(afterSession1.skillLevels['digraphs-sh']).toBe('practicing')

    // Downstream siblings stay locked (cascade only fires on
    // 'mastered'). Verifying both `digraphs-ch` and
    // `digraphs-th-voiceless` keeps the lock invariant pinned for
    // future cross-digraph mixing infrastructure work.
    expect(afterSession1.skillLevels['digraphs-ch']).toBe('locked')
    expect(afterSession1.skillLevels['digraphs-th-voiceless']).toBe('locked')

    // Exactly one history entry recorded against the new node.
    // Pre-Kevin RED: this entry would carry `skillFocus: ['digraphs']`
    // (the legacy literal the picker actually focused). Post-Kevin
    // GREEN: it carries `['digraphs-sh']`.
    expect(afterSession1.history.length).toBe(1)
    expect(afterSession1.history[0]!.skillFocus).toEqual(['digraphs-sh'])
    expect(afterSession1.history[0]!.successRate).toBe(1)

    // ── Sessions 2-3: practicing → mastered + digraphs-ch unlock ─────
    await runOneWordSongSession(page)
    await runOneWordSongSession(page)

    const afterSession3 = (await readProgressFromPage(
      page,
    )) as PersistedProgress
    expect(afterSession3).not.toBeNull()

    // SMOKING GUN B — practicing→mastered fires under the 90/3 window
    // at end-of-session-3 (3 entries at successRate 1.0 ≥ 0.9).
    expect(afterSession3.skillLevels['digraphs-sh']).toBe('mastered')

    // SMOKING GUN C — downstream `digraphs-ch` unlocks on mastery of
    // `digraphs-sh`. Cascade chain: session 3's `applyMasteryRule`
    // call promotes `digraphs-sh` to 'mastered' and flips
    // `digraphs-ch: 'locked' → 'intro'` in the same pass via
    // `nextNode('word-song', 'digraphs-sh')`. At this checkpoint (end
    // of session 3, before session 4) `digraphs-ch` is exactly
    // 'intro'.
    expect(afterSession3.skillLevels['digraphs-ch']).toBe('intro')

    // The downstream-from-ch sibling stays locked — only one cascade
    // level fires per promotion.
    expect(afterSession3.skillLevels['digraphs-th-voiceless']).toBe('locked')

    // ── Session 4: picker advances to digraphs-ch, intro→practicing ──
    await runOneWordSongSession(page)

    const afterSession4 = (await readProgressFromPage(
      page,
    )) as PersistedProgress
    expect(afterSession4).not.toBeNull()

    // `digraphs-sh` mastered state survives — `applyMasteryRule` is
    // idempotent under repeated calls on a 'mastered' node.
    expect(afterSession4.skillLevels['digraphs-sh']).toBe('mastered')

    // SMOKING GUN D — `digraphs-ch` advances 'intro' → 'practicing'
    // on session 4 via the PR #201 intro-pass (one history entry with
    // `skillFocus.includes('digraphs-ch')` AND `successRate > 0`).
    // This confirms BOTH the unlock cascade and the intro-pass are
    // wired correctly through the digraphs-sh → digraphs-ch milestone.
    expect(afterSession4.skillLevels['digraphs-ch']).toBe('practicing')

    // The downstream-from-ch sibling still locked.
    expect(afterSession4.skillLevels['digraphs-th-voiceless']).toBe('locked')

    // History has all 4 entries. The first 3 are `digraphs-sh` (sessions
    // 1-3 ran short-e per pickFocusNode); session 4 ran `digraphs-ch`
    // because `digraphs-sh` mastered at end-of-session-3 advanced the
    // picker to the next unmastered word-song node.
    expect(afterSession4.history.length).toBe(4)
    const lastFour = afterSession4.history.slice(-4)
    expect(lastFour[0]!.successRate).toBe(1)
    expect(lastFour[1]!.successRate).toBe(1)
    expect(lastFour[2]!.successRate).toBe(1)
    expect(lastFour[3]!.successRate).toBe(1)
    expect(lastFour[0]!.skillFocus).toEqual(['digraphs-sh'])
    expect(lastFour[1]!.skillFocus).toEqual(['digraphs-sh'])
    expect(lastFour[2]!.skillFocus).toEqual(['digraphs-sh'])
    expect(lastFour[3]!.skillFocus).toEqual(['digraphs-ch'])
  })
})
