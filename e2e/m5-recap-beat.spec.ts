/**
 * E2E spec — M5 Session-End focus-recap beat (ticket 86c9kmwh0).
 *
 * What M5 added
 * -------------
 * A new beat at Session-End, meant to land between the opener ("You did
 * it!") and the stardust recap, surfacing Emma's line:
 *
 *     "You worked on <friendly-name> today!"
 *
 * where `<friendly-name>` is the SPOKEN child-facing phrasing of the
 * session's focus `SkillNode` (`src/screens/SessionEnd/friendlyNodeName.ts`).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ASSERTION FLIPPED (2026-06-15, post-#451 rebase) — GRACEFUL-SKIP LOCK
 * ─────────────────────────────────────────────────────────────────────────
 * The ORIGINAL spec asserted the `focus-recap` PHASE is ENTERED. That was
 * authored against Devon's M5 branch BEFORE the graceful-skip follow-up
 * landed, where `setPhase('focus-recap')` ran up front unconditionally.
 *
 * M5 #451 shipped Devon's GRACEFUL-SKIP fix (the direct answer to this
 * spec's own #453 P1 finding): the `session.end.recap.focus` utterance is
 * NOT in the committed canon bundle, so the singleton `playSessionUtterance`
 * REJECTS it. SessionEnd now commits the `focus-recap` phase + caption
 * REACTIVELY — only from inside `onPlay`/`onWordTick`, i.e. only when the
 * utterance actually engages. On reject it skips the beat ENTIRELY: no
 * phase flip, no caption, no dwell. The sequence collapses cleanly to the
 * recap beat one standard inter-beat gap later (pre-M5 cadence).
 *
 * Pre-bake — which is BOTH the headless-harness state AND the real-iPad
 * state until the canon re-bake ships — the `focus-recap` phase therefore
 * NEVER appears. The original "phase APPEARS" assertion would now FAIL for
 * the right reason (graceful-skip). It is FLIPPED to lock the skip.
 *
 * Failing-first / regression classification (per `.claude/docs/testing-and-ci.md`
 * Step 2)
 * ----------------------------------------------------------------------
 * The paired implementation PR (#451) has ALREADY MERGED, so this spec is
 * no longer pre-implementation failing-first — it is a REGRESSION-LOCK on
 * the shipped graceful-skip behaviour:
 *
 *   - "session-end mounts after a math session"
 *         → regression-lock (existing beat, unchanged by M5).
 *   - "`focus-recap` phase is NEVER entered pre-bake (graceful-skip)"
 *         → **graceful-skip regression-lock** — the load-bearing assertion.
 *         This phase value was emitted up-front by the buggy intermediate
 *         (`c62ba5d`, the #453 P1 dead-pause); this assertion fails against
 *         THAT state and passes against main's graceful-skip. It guards the
 *         #451 follow-up from regressing back to an up-front phase flip.
 *   - "the sequence is opener → recap with NO dead focus-recap dwell"
 *         → ordering regression-lock — proves the skip collapses cleanly,
 *         recap follows opener directly (no orphaned focus-recap stop).
 *
 * WHAT THIS SPEC DOES NOT ASSERT (routed out of Playwright)
 * ----------------------------------------------------------------------
 *   (A) The recap CAPTION text + the ENGAGED (baked) focus-recap beat.
 *       Routed → Thomas iPad / unit test. SessionEnd captions are driven
 *       by the real player's `onWordTick`, which only fires from a real
 *       Howler `'play'` event. `forceHowlerUnlock` stubs `Howler.ctx` to a
 *       fake `{ state: 'running' }`; no real `'play'` event fires, so NO
 *       SessionEnd caption renders in headless chromium — verified by
 *       polling `cap=""` across the full sequence. Driving the ENGAGED
 *       focus-recap path (phase DOES appear when the clip is baked + ticks)
 *       is therefore structurally invisible to Playwright; its observable
 *       surface is the `SessionEnd.test.tsx` jsdom unit (fake
 *       `playUtteranceFn` fires the ticks) + Thomas's real-iPad ear/eye
 *       gate post canon re-bake.
 *
 * OOS: `?reset=1` boot reset (Jessica's #449 owns it), the audio bake, the
 * caption-text + engaged-path observability (routed above), and the M5
 * production code itself (shipped on `main` via #451).
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'

test.describe('M5 Session-End focus-recap beat (graceful-skip lock)', () => {
  test.beforeEach(async ({ page }) => {
    // `failNetwork: true` routes the planner through the silent caption-walk
    // fallback — the established path for screen-state-machine specs that
    // don't need real audio decode (see `session-end-to-hub.spec.ts`). It
    // ALSO means the focus-recap utterance id is unbaked → `playSessionUtterance`
    // rejects → graceful-skip fires, which is exactly the pre-bake state we
    // are locking here.
    await installClaudeMock(page, { failNetwork: true })

    // Seed the focus node explicitly so the run is deterministic:
    // `number-recog` mastered + `add-to-10` practicing means
    // `pickFocusNode(progress, 'math')` lands on `add-to-10`.
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
          'number-recog': 'mastered',
          'add-to-10': 'practicing',
        },
      }),
      sessionHistory: buildSeedSessionHistory({
        sessionCount: 5,
        cumulativeStardust: 12,
      }),
    })
  })

  test('skips the focus-recap phase pre-bake; sequence collapses opener → recap', async ({
    page,
  }) => {
    await page.goto('/')

    // Bridge the headless gesture-unlock gap so Math's read-aloud gate
    // releases and chips become tappable.
    await forceHowlerUnlock(page)

    // Splash → Hub (returning user, sessionCount = 5).
    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Hub → Math (number-garden tile).
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    const math = page.getByTestId('math')
    await expect(math).toBeVisible({ timeout: 10_000 })

    // Walk all 8 problems by tapping the chip flagged `data-correct="true"`.
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

    // SessionEnd mounts after problem 8. (Regression-lock — existing beat.)
    const sessionEnd = page.getByTestId('session-end')
    await expect(sessionEnd).toBeVisible({ timeout: 10_000 })

    // Record EVERY distinct `data-phase` value via an in-page
    // MutationObserver attached the instant SessionEnd is visible. The
    // observer also captures the live value at attach time (in case a phase
    // is already current), so the full ordered phase trace is available for
    // the skip + ordering assertions below.
    const phaseTrace = await page.evaluate(() => {
      return new Promise<string[]>((resolve) => {
        const seen: string[] = []
        let last = ''
        const record = () => {
          const el = document.querySelector('[data-testid="session-end"]')
          const phase = el?.getAttribute('data-phase') ?? ''
          if (phase && phase !== last) {
            last = phase
            seen.push(phase)
          }
        }
        const observer = new MutationObserver(record)
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ['data-phase'],
          subtree: true,
        })
        // Capture the current phase immediately.
        record()
        // The full opener → … → settled walk completes in ~5-8s; 12s gives
        // comfortable headroom on noisy CI.
        window.setTimeout(() => {
          observer.disconnect()
          resolve(seen)
        }, 12_000)
      })
    })

    // ── Graceful-skip lock (load-bearing) ──────────────────────────────
    // The M5 `focus-recap` phase is NEVER entered on the unbaked path. The
    // singleton `playSessionUtterance` rejects the unbaked
    // `session.end.recap.focus` id, so SessionEnd's reactive commit (inside
    // onPlay/onWordTick) never runs and the phase is skipped entirely. This
    // assertion FAILS against the buggy up-front-`setPhase` intermediate
    // (`c62ba5d`, the #453 P1 dead-pause) and PASSES against main's
    // graceful-skip — guarding the #451 follow-up from regressing.
    expect(
      phaseTrace,
      `expected NO 'focus-recap' phase pre-bake (graceful-skip). ` +
        `Observed phase trace: ${JSON.stringify(phaseTrace)}`,
    ).not.toContain('focus-recap')

    // ── Sequence regression-locks ──────────────────────────────────────
    // The opener is the first phase (it's the live value at mount), and the
    // stardust recap follows it directly — the skip collapses cleanly with
    // no orphaned focus-recap dwell between them.
    const openerIdx = phaseTrace.indexOf('opener')
    const recapIdx = phaseTrace.indexOf('recap')
    expect(
      openerIdx,
      `expected 'opener' phase in trace: ${JSON.stringify(phaseTrace)}`,
    ).toBeGreaterThanOrEqual(0)
    expect(
      recapIdx,
      `expected 'recap' phase in trace: ${JSON.stringify(phaseTrace)}`,
    ).toBeGreaterThan(openerIdx)

    // Nothing sits BETWEEN opener and recap — recap is the immediate next
    // phase after opener (no dead focus-recap window). Exact slice equality,
    // not `.toContain`, per count-assertion discipline.
    expect(phaseTrace.slice(openerIdx, recapIdx + 1)).toEqual([
      'opener',
      'recap',
    ])
  })
})
