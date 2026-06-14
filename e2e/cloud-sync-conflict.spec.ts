/**
 * E2E spec — cloud-sync conflict resolution behaviour.
 *
 * Coverage gap (Jessica, 2026-05-09)
 * ----------------------------------
 * Cloud-sync (ticket 86c9pkfyu, PR #160) shipped a `reconcileWithCloud`
 * boot-time helper that compares cloud `lastModifiedISO` against local
 * `profile.lastPlayedISO` and routes the winner. The unit tests in
 * `cloudSync.test.ts` cover the helper logic in isolation; what's not
 * pinned at the e2e layer is the actual browser → /api/progress round
 * trip on a conflict scenario.
 *
 * The risk: a future refactor of `reconcileWithCloud`'s call site in
 * App.tsx (or a change to how the App reads localStorage at boot)
 * could silently change the merge shape. This spec pins the CURRENT
 * documented behaviour from `cloudSync.ts`:
 *
 *   - Cloud strictly newer → install cloud blob, last-write-wins on
 *     every field EXCEPT `history`, which is UNION-MERGED with local
 *     (concat + dedupe-by-stable-key + sort ascending). skillLevels /
 *     parentSettings / lifetimeFirstEncounters / leitner box stay
 *     last-write-wins (cloud wins).
 *   - Local strictly newer → push local ENTIRELY to cloud.
 *   - Equal timestamps → noop (next saveProgress will sync naturally).
 *   - Cloud 404 + local present → push local (first-launch backup).
 *   - Cloud 5xx → cloud-error result, local kept, no push attempted.
 *
 * History-array merge (ticket 86c9qa6na — P1 data-loss fix)
 * --------------------------------------------------------
 * Test 1 below was previously a "whole-blob replacement" pin that
 * asserted the cloud history CLOBBERED local. Jessica flagged this as a
 * P1 data-loss surface (PR #182): a session Marian played on the
 * slower-clock (losing) device was silently dropped on a cloud-wins
 * install. The merge now unions the two histories so no local session
 * is lost. Test 1 asserts the MERGE shape; tests 2-5 are unchanged
 * (they exercise the push / noop / reject paths where history is not
 * merged).
 *
 * Mock strategy
 * -------------
 * `installCloudSyncMock` from `_helpers/cloudSyncFixtures.ts` routes
 * every `/api/progress*` request away from the real Upstash KV. The
 * helper exposes captured requests + a re-arm hook so each test
 * scripts the cloud-side response and asserts on what the App did.
 *
 * `installClaudeMock` runs alongside so any session-start fetch the
 * App fires (e.g. on a Math/Hub mount) doesn't hit the real Anthropic
 * pipeline.
 *
 * Why iPad-portrait viewport
 * --------------------------
 * Cloud-sync isn't viewport-sensitive, but the harness pins all e2e
 * to iPad portrait per `feedback_jessica_first_for_objective_gates.md`
 * — a misconfigured viewport that incidentally affects the App's
 * mount-time behaviour shouldn't mask a real cloud-sync regression.
 *
 * Why count-based assertions
 * --------------------------
 * Per `feedback_count_assertions_on_regression_tests.md`. We assert
 * exact request counts (`gets.length`, `posts.length`) and exact
 * post-body shapes — never `.toContain` on history arrays, never
 * "at least one POST fired."
 */

import { expect, test } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import { IPAD_PORTRAIT_VIEWPORT } from './_helpers/iPadViewport'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  readProgressFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'
import {
  TEST_DEVICE_ID,
  buildCloudProgressBlob,
  installCloudSyncMock,
  seedDeviceId,
} from './_helpers/cloudSyncFixtures'

// Sufficient time for the App to mount, kick the boot reconcile, and
// the route handler to fulfil. Boot reconcile fires inside a useEffect
// after the initial render commit so we wait for at least one round
// trip to be observable.
const RECONCILE_OBSERVATION_MS = 2000

test.describe('cloud-sync conflict resolution (boot reconcile)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({
      width: IPAD_PORTRAIT_VIEWPORT.width,
      height: IPAD_PORTRAIT_VIEWPORT.height,
    })
    // Mock /api/claude so any incidental session-start fetches don't
    // hit the live pipeline. Cloud-sync specs don't drive sessions —
    // we only need the boot reconcile cycle.
    await installClaudeMock(page, { failNetwork: true })
    // Seed the device id so the post-body assertion can pin against
    // a known value.
    await seedDeviceId(page, TEST_DEVICE_ID)
  })

  // -------------------------------------------------------------------------
  // Test 1 — Cloud strictly newer: cloud wins last-write-wins on
  //          skillLevels, but `history` UNION-MERGES with local so no
  //          local session is lost (ticket 86c9qa6na — P1 data-loss fix).
  // -------------------------------------------------------------------------

  test('cloud newer → skillLevels clobbered (LWW) but history union-merges (no local session lost)', async ({
    page,
  }) => {
    // Local seed: laptop side, cvc-words: practicing, history len 6.
    const localProgress = buildSeedProgress({
      skillLevelOverrides: {
        'cvc-words': 'practicing',
      },
      history: [
        {
          dateISO: '2026-05-08T08:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.5,
        },
        {
          dateISO: '2026-05-08T10:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.625,
        },
        {
          dateISO: '2026-05-08T12:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.75,
        },
        {
          dateISO: '2026-05-08T14:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.625,
        },
        {
          dateISO: '2026-05-08T16:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.875,
        },
        {
          dateISO: '2026-05-09T09:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.875,
        },
      ],
      lastPlayedISO: '2026-05-09T09:00:00.000Z',
    })
    await seedLocalStorage(page, {
      progress: localProgress,
      sessionHistory: buildSeedSessionHistory(),
    })

    // Cloud seed: iPad side wrote LATER, cvc-words: mastered, history
    // length 5 (different sessions, different success rates).
    const cloudBlob = buildCloudProgressBlob({
      lastPlayedISO: '2026-05-09T11:00:00.000Z',
      skillLevels: {
        'cvc-words': 'mastered',
        'cvc-words-short-o': 'intro',
      },
      history: [
        {
          dateISO: '2026-05-09T10:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 1.0,
        },
        {
          dateISO: '2026-05-09T10:30:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 1.0,
        },
        {
          dateISO: '2026-05-09T10:45:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.875,
        },
        {
          dateISO: '2026-05-09T11:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 1.0,
        },
        {
          dateISO: '2026-05-09T11:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.875,
        },
      ],
      lifetimeFirstEncounters: [
        'letter-names',
        'letter-sounds',
        'blending-cv',
        'cvc-words',
      ],
    })
    const mock = await installCloudSyncMock(page, {
      kind: 'found',
      blob: cloudBlob,
      lastModifiedISO: '2026-05-09T11:00:00.000Z',
    })

    await page.goto('/')
    await page.waitForTimeout(RECONCILE_OBSERVATION_MS)

    // App fired exactly one GET (boot reconcile). No push because
    // cloud was newer.
    expect(mock.gets).toHaveLength(1)
    expect(mock.posts).toHaveLength(0)

    // localStorage now reflects the merge: skillLevels last-write-wins
    // (cloud), history union-merged (local + cloud).
    const installed = (await readProgressFromPage(page)) as {
      skillLevels: Record<string, string>
      history: ReadonlyArray<{ dateISO: string; successRate: number }>
      lifetimeFirstEncounters: string[]
    }
    expect(installed).not.toBeNull()
    // AC2: cloud skill levels won — local 'practicing' was clobbered to
    // 'mastered' (last-write-wins is correct for skillLevels).
    expect(installed.skillLevels['cvc-words']).toBe('mastered')
    expect(installed.skillLevels['cvc-words-short-o']).toBe('intro')
    // AC1 — the load-bearing data-loss assertion: local's 6 sessions are
    // NOT clobbered. Merged = local(6) ∪ cloud(5), no dateISO overlap, so
    // 11 entries sorted ascending by dateISO. Marian's losing-device
    // sessions survive.
    expect(installed.history).toHaveLength(11)
    // First entry is the earliest local session (2026-05-08T08:00).
    expect(installed.history[0]?.dateISO).toBe('2026-05-08T08:00:00.000Z')
    expect(installed.history[0]?.successRate).toBe(0.5)
    // Last entry is the latest cloud session (2026-05-09T11:00, rate 0.875).
    expect(installed.history[10]?.dateISO).toBe('2026-05-09T11:00:00.000Z')
    expect(installed.history[10]?.successRate).toBe(0.875)
    // The local-only sessions (cloud never carried these dates) survived.
    const dates = installed.history.map((h) => h.dateISO)
    expect(dates).toEqual([
      '2026-05-08T08:00:00.000Z',
      '2026-05-08T10:00:00.000Z',
      '2026-05-08T12:00:00.000Z',
      '2026-05-08T14:00:00.000Z',
      '2026-05-08T16:00:00.000Z',
      '2026-05-09T09:00:00.000Z',
      '2026-05-09T10:00:00.000Z',
      '2026-05-09T10:30:00.000Z',
      '2026-05-09T10:45:00.000Z',
      '2026-05-09T11:00:00.000Z',
      '2026-05-09T11:00:00.000Z',
    ])
    // AC2: lifetimeFirstEncounters stays last-write-wins (cloud won).
    expect(installed.lifetimeFirstEncounters).toEqual([
      'letter-names',
      'letter-sounds',
      'blending-cv',
      'cvc-words',
    ])
  })

  // -------------------------------------------------------------------------
  // Test 2 — Local strictly newer: local pushes to cloud, no install
  // -------------------------------------------------------------------------

  test('local newer → local pushes to cloud, localStorage unchanged', async ({
    page,
  }) => {
    const localProgress = buildSeedProgress({
      skillLevelOverrides: {
        'cvc-words': 'practicing',
      },
      history: [
        {
          dateISO: '2026-05-09T11:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.875,
        },
      ],
      lastPlayedISO: '2026-05-09T11:00:00.000Z',
    })
    await seedLocalStorage(page, {
      progress: localProgress,
      sessionHistory: buildSeedSessionHistory(),
    })

    // Cloud is older (iPad opened earlier in the day, laptop just
    // played a session).
    const cloudBlob = buildCloudProgressBlob({
      lastPlayedISO: '2026-05-08T08:00:00.000Z',
      skillLevels: { 'cvc-words': 'intro' },
    })
    const mock = await installCloudSyncMock(page, {
      kind: 'found',
      blob: cloudBlob,
      lastModifiedISO: '2026-05-08T08:00:00.000Z',
    })

    await page.goto('/')
    await page.waitForTimeout(RECONCILE_OBSERVATION_MS)

    // App fired exactly one GET + one POST (push local).
    expect(mock.gets).toHaveLength(1)
    expect(mock.posts).toHaveLength(1)

    // Push body shape — pin the deviceId + the local blob bytes.
    const post = mock.posts[0]!
    expect(post.method()).toBe('POST')
    const body = JSON.parse(post.postData() ?? '{}') as {
      deviceId: string
      blob: {
        skillLevels: Record<string, string>
        profile: { lastPlayedISO: string }
      }
      lastModifiedISO: string
    }
    expect(body.deviceId).toBe(TEST_DEVICE_ID)
    expect(body.blob.skillLevels['cvc-words']).toBe('practicing')
    expect(body.lastModifiedISO).toBe('2026-05-09T11:00:00.000Z')

    // localStorage is UNCHANGED — push doesn't roundtrip into local.
    const installed = (await readProgressFromPage(page)) as {
      skillLevels: Record<string, string>
      history: unknown[]
    }
    expect(installed.skillLevels['cvc-words']).toBe('practicing')
    expect(installed.history).toHaveLength(1)
  })

  // -------------------------------------------------------------------------
  // Test 3 — Cloud 404 (first-launch device) + local present: push local
  // -------------------------------------------------------------------------

  test('cloud 404 + local present → local pushes to cloud (first-launch backup)', async ({
    page,
  }) => {
    const localProgress = buildSeedProgress({
      lastPlayedISO: '2026-05-09T10:00:00.000Z',
    })
    await seedLocalStorage(page, {
      progress: localProgress,
      sessionHistory: buildSeedSessionHistory(),
    })
    const mock = await installCloudSyncMock(page, { kind: 'not-found' })

    await page.goto('/')
    await page.waitForTimeout(RECONCILE_OBSERVATION_MS)

    expect(mock.gets).toHaveLength(1)
    expect(mock.posts).toHaveLength(1)

    const body = JSON.parse(mock.posts[0]!.postData() ?? '{}') as {
      deviceId: string
      blob: { profile: { lastPlayedISO: string } }
    }
    expect(body.deviceId).toBe(TEST_DEVICE_ID)
    expect(body.blob.profile.lastPlayedISO).toBe('2026-05-09T10:00:00.000Z')
  })

  // -------------------------------------------------------------------------
  // Test 4 — Cloud 5xx: cloud-error, local kept, NO push attempted
  // -------------------------------------------------------------------------

  test('cloud GET 5xx → reconcile bails to cloud-error, local unchanged, no push', async ({
    page,
  }) => {
    const localProgress = buildSeedProgress({
      skillLevelOverrides: { 'cvc-words': 'practicing' },
      lastPlayedISO: '2026-05-09T10:00:00.000Z',
    })
    await seedLocalStorage(page, {
      progress: localProgress,
      sessionHistory: buildSeedSessionHistory(),
    })
    const mock = await installCloudSyncMock(page, {
      kind: 'error',
      status: 503,
    })

    await page.goto('/')
    await page.waitForTimeout(RECONCILE_OBSERVATION_MS)

    expect(mock.gets).toHaveLength(1)
    // Critical: no push fires when cloud GET errored. App proceeds
    // with local state and the next saveProgress (via session-end)
    // will retry the push naturally.
    expect(mock.posts).toHaveLength(0)

    // localStorage is unchanged.
    const installed = (await readProgressFromPage(page)) as {
      skillLevels: Record<string, string>
    }
    expect(installed.skillLevels['cvc-words']).toBe('practicing')
  })

  // -------------------------------------------------------------------------
  // Test 5 — Cloud blob with malformed shape on cloud-newer path → reject,
  //          local kept (defaulter cannot heal a non-Progress shape)
  // -------------------------------------------------------------------------

  test('cloud blob with malformed shape on cloud-newer path → cloud-blob-rejected, local kept', async ({
    page,
  }) => {
    // Local has no last-played, so any cloud blob with a parseable
    // timestamp is "strictly newer" — the install path is taken, the
    // strict guard rejects the malformed blob, and local is kept.
    const localProgress = buildSeedProgress({
      lastPlayedISO: null,
    })
    await seedLocalStorage(page, {
      progress: localProgress,
      sessionHistory: buildSeedSessionHistory(),
    })
    // A "blob" missing required fields — schemaVersion present but
    // skillLevels and other top-level fields absent. The withDefaulted-
    // SkillLevels defaulter only fills missing skill-level keys; it
    // can't fabricate skillLevels from thin air, so isProgressV1
    // rejects the result.
    const mock = await installCloudSyncMock(page, {
      kind: 'found',
      blob: { schemaVersion: 1, garbage: true },
      lastModifiedISO: '2026-05-09T11:00:00.000Z',
    })

    await page.goto('/')
    await page.waitForTimeout(RECONCILE_OBSERVATION_MS)

    expect(mock.gets).toHaveLength(1)
    // No push — local is older but reconcile took the cloud-wins
    // branch first, then bailed on validation. Local survives.
    expect(mock.posts).toHaveLength(0)

    // Local progress unchanged — read back the same shape we seeded.
    const installed = (await readProgressFromPage(page)) as {
      profile: { lastPlayedISO: string | null }
    }
    expect(installed.profile.lastPlayedISO).toBeNull()
  })
})
