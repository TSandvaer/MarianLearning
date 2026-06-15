/**
 * E2E spec — Voice-QA page must NOT submit stale / dead verdicts as fresh.
 *
 * Investigation: Thomas's report #458 re-recorded three round-6 clips
 * (`letter-sounds#session.end.recap.4`, `number-recog#math.p6.hint`,
 * `letter-sounds#session.end.streak.4`) with OLD audio hashes + OLD `decidedAt`
 * (2026-06-11), byte-identical to #446 — even though his ear had freshly passed
 * them. Root cause: `submitVerdicts()` ships `Object.values(verdicts)` — the
 * ENTIRE localStorage blob — including:
 *   (a) verdicts whose stored `audioHash` no longer matches the live row's hash
 *       (the row renders `needs-retest`, but submit ignores that signal), and
 *   (b) verdicts for itemIds that no longer have a live row at all (e.g.
 *       `number-recog#math.p6.hint`, renamed to hint1/2/3 by the W12-04 re-bake) —
 *       a DEAD-id verdict that can never flip to needs-retest yet is still shipped.
 * Both classes carry their stale `audioHash` + stale `decidedAt` into the report,
 * which reads downstream as a fresh observation of the current bytes. It is not.
 *
 * Contract under test (the fix Devon/Kevin will implement):
 *   submit must EXCLUDE any stored verdict that is not a confirmed observation of
 *   a CURRENTLY-RENDERED row's CURRENT audioHash. Equivalently: the submitted set
 *   is exactly the verdicts whose `(itemId, audioHash)` matches a live row. Stale
 *   (hash-mismatch / needs-retest) and dead-id verdicts are dropped from the POST.
 *
 * This is a FAILING-FIRST spec per `feedback_failing_first_must_prove_green` +
 * `feedback_progression_e2e_mandatory`. It is RED on current `main` (the page
 * submits the full blob); it flips GREEN when submit filters to live-matching
 * verdicts only.
 *
 * Failing-First Verification Protocol (jessica.md):
 *   Step 1 — verified RED on base (current page submits stale + dead verdicts).
 *   Step 2 — each test block carries an assertion classification comment.
 *   Step 3 — RED-on-base output pasted in the PR body.
 *   Step 4 — GREEN confirmed post-merge of the paired implementation PR.
 *
 * Out of scope (routes to a human gate, not Playwright — jessica.md):
 *   - Whether the re-baked audio SOUNDS right (Thomas's ear-test).
 *   - Real iPad service-worker / back-forward-cache staleness (Thomas's iPad).
 *     This spec exercises the page-logic gap with a deterministic seeded blob;
 *     it does not reproduce the device-level stale-page-session vector.
 *   - No real GitHub calls — the endpoint is ALWAYS route-mocked.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

const PAGE_URL = '/voice-qa.html'

const VERDICTS_KEY = 'vqa-verdicts'
const SECRET_KEY = 'vqa-secret'

/** WebKit hash-loop budget — see voice-qa-page.spec.ts for the rationale. */
const PAGE_READY_TIMEOUT_MS = 45_000

type FailCategory =
  | 'mispronounced'
  | 'wrong-speed'
  | 'clipped'
  | 'volume'
  | 'wrong-text'
  | 'other'

interface StoredVerdict {
  itemId: string
  audioHash: string
  verdict: 'pass' | 'fail'
  category?: FailCategory
  note?: string
  decidedAt: string
}

async function seedVqaStorage(
  page: Page,
  opts: { verdicts?: Record<string, StoredVerdict>; secret?: string } = {},
): Promise<void> {
  await page.addInitScript(
    ({ verdictsKey, secretKey, verdicts, secret }) => {
      if (verdicts !== undefined) {
        window.localStorage.setItem(verdictsKey, JSON.stringify(verdicts))
      }
      if (secret !== undefined) {
        window.localStorage.setItem(secretKey, secret)
      }
    },
    {
      verdictsKey: VERDICTS_KEY,
      secretKey: SECRET_KEY,
      verdicts: opts.verdicts,
      secret: opts.secret,
    },
  )
}

async function firstItemId(page: Page): Promise<string> {
  const testid = await page
    .locator('[data-testid^="vqa-item-"]')
    .first()
    .getAttribute('data-testid')
  expect(testid, 'no vqa-item-* row rendered').not.toBeNull()
  return testid!.replace(/^vqa-item-/, '')
}

async function rowAudioHash(page: Page, itemId: string): Promise<string> {
  const hash = await page
    .getByTestId(`vqa-item-${itemId}`)
    .getAttribute('data-audio-hash')
  expect(hash, `row ${itemId} exposes no data-audio-hash`).not.toBeNull()
  return hash!
}

async function waitForPageReady(page: Page): Promise<void> {
  await expect(page.getByTestId('vqa-render-count')).toBeVisible({
    timeout: PAGE_READY_TIMEOUT_MS,
  })
}

/**
 * Capture every POST to the report endpoint and mock { ok, issueUrl }. Returns
 * the captured-requests array (assert on its length + payload after submit).
 */
async function mockReportEndpoint(page: Page): Promise<Request[]> {
  const reportRequests: Request[] = []
  await page.route('**/api/voice-qa-report', async (route, request) => {
    reportRequests.push(request)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        issueUrl: 'https://github.com/TSandvaer/MarianLearning/issues/9999',
      }),
    })
  })
  return reportRequests
}

function submittedVerdicts(req: Request): StoredVerdict[] {
  const body = req.postData()
  expect(body, 'report POST had no body').not.toBeNull()
  const payload = JSON.parse(body!) as { verdicts: StoredVerdict[] }
  expect(Array.isArray(payload.verdicts), 'verdicts not an array').toBe(true)
  return payload.verdicts
}

test.describe('Voice-QA — submit drops stale / dead verdicts (report #458 regression)', () => {
  test('a stale-hash (needs-retest) verdict rides along but is NOT in the submitted set', async ({
    page,
  }) => {
    // ── Assertion classification ──────────────────────────────────────────
    // RED-on-base lever: on current `main`, submitVerdicts() ships
    // Object.values(verdicts) verbatim, so the stale-hash verdict for the
    // second item IS present in the POST alongside the fresh one. The fix
    // filters it out. The "submitted set is exactly [freshItem]" equality is
    // the load-bearing lever — this is the recap.4/streak.4 case from #458
    // (live row, bytes changed by round-6, stored verdict still on the old
    // hash). A SECOND freshly-decided verdict co-resides so the submit button
    // is enabled (submit.disabled = decided === 0; a stale-only blob keeps it
    // disabled — exactly why #458 needed 808 fresh passes alongside the 3 stale
    // ones for the button to fire at all).
    await page.goto(PAGE_URL)
    await waitForPageReady(page)

    const rowTestids = await page
      .locator('[data-testid^="vqa-item-"]')
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-testid') ?? ''),
      )
    const freshItemId = rowTestids[0].replace(/^vqa-item-/, '')
    const staleItemId = rowTestids[1].replace(/^vqa-item-/, '')
    expect(staleItemId).not.toBe(freshItemId)

    const freshHash = await rowAudioHash(page, freshItemId)
    const staleLiveHash = await rowAudioHash(page, staleItemId)
    const staleHash = `stale-${staleLiveHash}-mismatch`
    expect(staleHash).not.toBe(staleLiveHash)

    await seedVqaStorage(page, {
      secret: 'qa-secret-token',
      verdicts: {
        // Fresh, live-hash-matching observation (this session). Enables submit.
        [freshItemId]: {
          itemId: freshItemId,
          audioHash: freshHash,
          verdict: 'pass',
          decidedAt: '2026-06-15T05:00:00.000Z',
        },
        // Stale observation against pre-rebake bytes — the #458 carry-forward.
        [staleItemId]: {
          itemId: staleItemId,
          audioHash: staleHash,
          verdict: 'fail',
          category: 'mispronounced',
          note: 'pre-rebake observation',
          decidedAt: '2026-06-11T23:00:00.000Z',
        },
      },
    })

    const reportRequests = await mockReportEndpoint(page)
    await page.reload()
    await waitForPageReady(page)

    // Sanity: the stale row IS flagged needs-retest (the display signal works;
    // regression-lock half — passes on base, must still pass after fix).
    await expect(page.getByTestId(`vqa-state-${staleItemId}`)).toHaveText(
      /needs-retest/i,
    )

    await page.getByTestId('vqa-submit').click()
    await expect(
      page.getByText('https://github.com/TSandvaer/MarianLearning/issues/9999'),
    ).toBeVisible()

    expect(reportRequests).toHaveLength(1)
    const submittedIds = submittedVerdicts(reportRequests[0]).map(
      (v) => v.itemId,
    )
    // Only the fresh, live-matching verdict ships. On `main` the array is
    // [freshItemId, staleItemId] (the stale verdict rode along) → RED. After
    // the fix it is exactly [freshItemId]. Exact-array equality per the
    // count-assertion rules (never .toContain on a regression).
    expect(submittedIds).toEqual([freshItemId])
  })

  test('a confirmed (live-hash-matching) verdict IS still submitted', async ({
    page,
  }) => {
    // ── Assertion classification ──────────────────────────────────────────
    // Regression-lock: passes on base AND must still pass after the fix. The
    // filter must drop ONLY stale/dead verdicts, never a genuine current-byte
    // observation. Guards against an over-broad fix that drops everything.
    await page.goto(PAGE_URL)
    await waitForPageReady(page)

    const liveItemId = await firstItemId(page)
    const currentHash = await rowAudioHash(page, liveItemId)

    const freshVerdict: StoredVerdict = {
      itemId: liveItemId,
      audioHash: currentHash, // matches the live row → a real observation
      verdict: 'pass',
      decidedAt: '2026-06-15T05:00:00.000Z',
    }
    await seedVqaStorage(page, {
      secret: 'qa-secret-token',
      verdicts: { [liveItemId]: freshVerdict },
    })

    const reportRequests = await mockReportEndpoint(page)
    await page.reload()
    await waitForPageReady(page)

    await page.getByTestId('vqa-submit').click()
    await expect(
      page.getByText('https://github.com/TSandvaer/MarianLearning/issues/9999'),
    ).toBeVisible()

    expect(reportRequests).toHaveLength(1)
    const verdicts = submittedVerdicts(reportRequests[0])
    // Exactly the one live-matching verdict ships, hash intact.
    expect(verdicts.map((v) => v.itemId)).toEqual([liveItemId])
    expect(verdicts[0].audioHash).toBe(currentHash)
    expect(verdicts[0].verdict).toBe('pass')
  })

  test('a dead-itemId verdict (no live row) rides along but is NOT in the submitted set', async ({
    page,
  }) => {
    // ── Assertion classification ──────────────────────────────────────────
    // RED-on-base lever: a verdict whose itemId has NO live row (e.g. the
    // W12-04-renamed `number-recog#math.p6.hint`) can never flip to
    // needs-retest — there is no live row to compare — yet on `main` it is
    // still shipped by Object.values(verdicts). The fix must drop it. This is
    // the third #458 item. We use a synthetic guaranteed-dead id so the spec is
    // robust to future canon re-bakes.
    await page.goto(PAGE_URL)
    await waitForPageReady(page)

    const freshItemId = await firstItemId(page)
    const freshHash = await rowAudioHash(page, freshItemId)

    const deadItemId = 'number-recog#math.p6.hint__DEAD_NO_LIVE_ROW'
    // Confirm no live row exists for this id (defends the premise).
    await expect(page.getByTestId(`vqa-item-${deadItemId}`)).toHaveCount(0)

    await seedVqaStorage(page, {
      secret: 'qa-secret-token',
      verdicts: {
        // Fresh, live-matching observation (this session) — enables submit.
        [freshItemId]: {
          itemId: freshItemId,
          audioHash: freshHash,
          verdict: 'pass',
          decidedAt: '2026-06-15T05:00:00.000Z',
        },
        // Dead-id verdict: no live row, can never flip to needs-retest.
        [deadItemId]: {
          itemId: deadItemId,
          audioHash:
            'e64dce342eb2cd3e43cc9f9c1b020457e962e14a04380a1d431a4d934f590c98',
          verdict: 'fail',
          category: 'other',
          note: 'orphaned pre-rename verdict',
          decidedAt: '2026-06-11T23:00:00.000Z',
        },
      },
    })

    const reportRequests = await mockReportEndpoint(page)
    await page.reload()
    await waitForPageReady(page)

    await page.getByTestId('vqa-submit').click()
    await expect(
      page.getByText('https://github.com/TSandvaer/MarianLearning/issues/9999'),
    ).toBeVisible()

    expect(reportRequests).toHaveLength(1)
    const submittedIds = submittedVerdicts(reportRequests[0]).map(
      (v) => v.itemId,
    )
    // The dead-id verdict must not ride along. On `main` the array is
    // [freshItemId, deadItemId] → RED. After the fix it is exactly
    // [freshItemId].
    expect(submittedIds).toEqual([freshItemId])
  })
})
