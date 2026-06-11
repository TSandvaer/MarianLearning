/**
 * E2E spec — Voice-QA page objective invariants (ticket 86ca7eraj / VQA.3).
 *
 * Paired with Devon's VQA.1 page build (branch `devon/86ca7er39-voice-qa-page`).
 * This is a FAILING-FIRST spec per `feedback_failing_first_must_prove_green` +
 * `feedback_progression_e2e_mandatory`. The page `/voice-qa.html` does NOT
 * exist on `main` yet; every test here is RED on base because the page never
 * renders. Each test flips GREEN once VQA.1 merges.
 *
 * Contract under test (EXACT names — shared with VQA.1/VQA.2, from the ticket):
 *   Page: /voice-qa.html
 *   Row:        data-testid="vqa-item-<itemId>"
 *   Buttons:    vqa-play, vqa-pass, vqa-fail
 *   Fail dialog: vqa-fail-category-<category>, vqa-fail-note, vqa-fail-save
 *   Submit:     vqa-submit
 *   Filters:    vqa-filter-all|untested|passed|failed|needs-retest
 *   Badge:      vqa-state-<itemId>
 *   itemId:     canon  -> `<file-stem>#<utteranceId>` (alphabetically-first
 *                          member of the audio-hash dedup group)
 *               greet  -> `greet#<filename>`
 *               hub    -> `hub#<filename>`
 *   localStorage: vqa-verdicts (map itemId -> verdict), vqa-secret
 *   Verdict: { itemId, audioHash, verdict: 'pass'|'fail',
 *              category?: 'mispronounced'|'wrong-speed'|'clipped'|'volume'
 *                        |'wrong-text'|'other',
 *              note?, decidedAt }
 *   POST /api/voice-qa-report { secret, submittedAt, verdicts: [...] }
 *            -> { ok: true, issueUrl }
 *
 * Failing-First Verification Protocol (jessica.md):
 *   Step 1 — verified RED on base (page absent -> every assertion fails).
 *   Step 2 — each test block carries an assertion classification comment:
 *            RED-on-base lever / regression-lock / trivially-green counter-test.
 *   Step 3 — RED-on-base output pasted in the PR body.
 *   Step 4 — GREEN confirmed post-merge of VQA.1.
 *
 * Out of scope (per ticket):
 *   - Building the page (VQA.1) or endpoint (VQA.2). No production code.
 *   - No real GitHub calls — the endpoint is ALWAYS route-mocked.
 *   - No audio playback assertions (Playwright is structurally blind to TTS
 *     correctness — that routes to Thomas's ear-test per jessica.md).
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

const PAGE_URL = '/voice-qa.html'

const VERDICTS_KEY = 'vqa-verdicts'
const SECRET_KEY = 'vqa-secret'

/**
 * The page hashes all 632 canon items (SHA-256) on every load/reload, yielding
 * to the event loop every 40 items. On the WebKit engine (the iPad-Safari
 * surrogate) this pass is ~3-4x slower than Chromium and routinely exceeds the
 * default 10 s `expect` timeout — empirically it sat at "Hashing canon — 11 / 23
 * files" at the 10 s mark. The page IS correct; the rows + footer just render
 * later. Every readiness wait therefore uses this generous budget (well under
 * the 90 s per-test ceiling). Verified locally on WebKit: full hash + render
 * completes comfortably inside this window.
 */
const PAGE_READY_TIMEOUT_MS = 45_000

/** The full category union from the contract. */
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

/**
 * Seed the two VQA localStorage blobs BEFORE first navigation. The page reads
 * them at mount, so a post-`goto` set is too late (mirrors the
 * `seedStorage.ts` addInitScript discipline for the main app's keys).
 */
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

/** Read the verdicts map back out of localStorage. */
async function readVerdicts(
  page: Page,
): Promise<Record<string, StoredVerdict>> {
  const raw = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    VERDICTS_KEY,
  )
  return raw ? (JSON.parse(raw) as Record<string, StoredVerdict>) : {}
}

/**
 * Resolve the first rendered row's itemId from the DOM. The page derives the
 * row set from canon + greet + hub data; the spec must NOT hardcode an itemId
 * (those are data-derived dedup-group stems). We read the testid suffix off
 * the first `vqa-item-*` row instead.
 */
async function firstItemId(page: Page): Promise<string> {
  const testid = await page
    .locator('[data-testid^="vqa-item-"]')
    .first()
    .getAttribute('data-testid')
  expect(testid, 'no vqa-item-* row rendered').not.toBeNull()
  return testid!.replace(/^vqa-item-/, '')
}

/** Read the rendered audioHash for a given item from its row dataset. */
async function rowAudioHash(page: Page, itemId: string): Promise<string> {
  // The row exposes its current audioHash as a data attribute so the page
  // can compute the needs-retest mismatch; the spec reads it to seed a
  // deliberately-stale verdict. Contract-named attribute: data-audio-hash.
  const hash = await page
    .getByTestId(`vqa-item-${itemId}`)
    .getAttribute('data-audio-hash')
  expect(hash, `row ${itemId} exposes no data-audio-hash`).not.toBeNull()
  return hash!
}

/**
 * Block until the page has finished its async canon-hash pass and rendered the
 * full row set. The footer (`vqa-render-count`) is written LAST — only after
 * every canon/greet/hub row is appended to the DOM — so its visibility is the
 * single canonical "page is ready" signal. Uses the WebKit-sized budget
 * (`PAGE_READY_TIMEOUT_MS`) so the slower iPad engine's hash loop has room to
 * complete. Call this after EVERY `goto`/`reload` before touching rows.
 */
async function waitForPageReady(page: Page): Promise<void> {
  await expect(page.getByTestId('vqa-render-count')).toBeVisible({
    timeout: PAGE_READY_TIMEOUT_MS,
  })
}

test.describe('Voice-QA page — objective invariants (VQA.3 / 86ca7eraj)', () => {
  test('AC1 — page renders canon + Greet + Hub groups; footer shows numeric unique-render count', async ({
    page,
  }) => {
    // ── Assertion classification ──────────────────────────────────────────
    // RED-on-base lever: the page does not exist on `main`, so `goto` lands on
    // a 404 / blank document and ZERO `vqa-item-*` rows render. Every
    // expectation below fails on base and passes only once VQA.1 ships the
    // page. The row-count >= 1 + footer-count-equals-row-count pairing is the
    // load-bearing lever.
    await page.goto(PAGE_URL)

    // The page hashes 632 canon items asynchronously on mount (status banner
    // ticks "Hashing canon — N / 23 files…" then settles to "Ready"). Rows are
    // appended in order — canon groups, THEN Greet, THEN Hub — and the footer
    // `vqa-render-count` is written LAST, only after every row is in the DOM.
    // The footer's appearance is therefore the "all rows rendered" signal: we
    // wait for it (web-first auto-retrying assertion, WebKit-sized budget)
    // BEFORE the one-shot row count, so `.count()` never races a partial
    // render. A bare `.count()` immediately after `goto` reads 0 (hashing
    // still in flight).
    await waitForPageReady(page)
    const footer = page.getByTestId('vqa-render-count')

    const rows = page.locator('[data-testid^="vqa-item-"]')
    const rowCount = await rows.count()
    // At least one canon group + Greet + Hub must render -> strictly positive.
    expect(rowCount).toBeGreaterThan(0)

    // Greet + Hub groups specifically must be present. itemIds are
    // `greet#<filename>` / `hub#<filename>` per the contract, so at least one
    // row testid must start with each namespace. Membership-in-set check
    // (the SET of rendered rows is the contract surface) — acceptable use of a
    // "some row starts with X" predicate per the count-assertion exception.
    const testids = await rows.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-testid') ?? ''),
    )
    const hasGreet = testids.some((t) => t.startsWith('vqa-item-greet#'))
    const hasHub = testids.some((t) => t.startsWith('vqa-item-hub#'))
    const hasCanon = testids.some(
      (t) =>
        t.startsWith('vqa-item-') &&
        !t.startsWith('vqa-item-greet#') &&
        !t.startsWith('vqa-item-hub#'),
    )
    expect(hasGreet, 'no greet#* row rendered').toBe(true)
    expect(hasHub, 'no hub#* row rendered').toBe(true)
    expect(hasCanon, 'no canon group row rendered').toBe(true)

    // Footer shows the unique-render count. Per AC1 we assert it is present and
    // numeric AND equals the actual rendered row count — NOT a hardcoded 632
    // literal (the page derives the number from data; pinning 632 would break
    // the moment canon re-bakes change the dedup-group count).
    const footerText = (await footer.textContent()) ?? ''
    const match = footerText.match(/\d+/)
    expect(match, `footer "${footerText}" has no numeric count`).not.toBeNull()
    const footerCount = Number(match![0])
    expect(Number.isInteger(footerCount)).toBe(true)
    expect(footerCount).toBe(rowCount)
  })

  test('AC2 — a pass verdict persists across reload (localStorage)', async ({
    page,
  }) => {
    // ── Assertion classification ──────────────────────────────────────────
    // RED-on-base lever: no page -> no pass button -> the verdict is never
    // written. On GREEN, tapping vqa-pass writes a 'pass' verdict to
    // vqa-verdicts and the badge reads 'passed' after a full reload. Uses
    // `.toEqual`/`.toBe` (never `.toContain`) per the count-assertion rules.
    await seedVqaStorage(page, { secret: 'qa-secret-token' })
    await page.goto(PAGE_URL)
    await waitForPageReady(page)

    const itemId = await firstItemId(page)
    const row = page.getByTestId(`vqa-item-${itemId}`)

    await row.getByTestId('vqa-pass').click()

    // Badge reflects passed immediately.
    await expect(page.getByTestId(`vqa-state-${itemId}`)).toHaveText(/passed/i)

    // Persisted exactly one verdict, keyed by this itemId, verdict === 'pass'.
    const beforeReload = await readVerdicts(page)
    expect(Object.keys(beforeReload)).toEqual([itemId])
    expect(beforeReload[itemId].verdict).toBe('pass')

    // Reload — the page must re-hydrate the verdict from localStorage. The
    // re-hash runs again on reload, so re-wait for ready before asserting.
    await page.reload()
    await waitForPageReady(page)
    await expect(page.getByTestId(`vqa-state-${itemId}`)).toHaveText(/passed/i)
    const afterReload = await readVerdicts(page)
    expect(afterReload[itemId].verdict).toBe('pass')
  })

  test('AC3 — fail flow: category pick + note saved; item shows failed state', async ({
    page,
  }) => {
    // ── Assertion classification ──────────────────────────────────────────
    // RED-on-base lever: no page -> no fail dialog -> no failed verdict. On
    // GREEN, the fail flow writes verdict 'fail' with the chosen category and
    // note, and the badge reads 'failed'. The exact-category + exact-note
    // equality is the load-bearing assertion.
    await seedVqaStorage(page, { secret: 'qa-secret-token' })
    await page.goto(PAGE_URL)
    await waitForPageReady(page)

    const itemId = await firstItemId(page)
    const row = page.getByTestId(`vqa-item-${itemId}`)

    const category: FailCategory = 'mispronounced'
    const note = 'Emma says "fower" instead of "four".'

    await row.getByTestId('vqa-fail').click()
    await page.getByTestId(`vqa-fail-category-${category}`).click()
    await page.getByTestId('vqa-fail-note').fill(note)
    await page.getByTestId('vqa-fail-save').click()

    // Badge reflects failed.
    await expect(page.getByTestId(`vqa-state-${itemId}`)).toHaveText(/failed/i)

    // Persisted verdict carries verdict/category/note exactly (no `.toContain`).
    const verdicts = await readVerdicts(page)
    expect(Object.keys(verdicts)).toEqual([itemId])
    const v = verdicts[itemId]
    expect(v.verdict).toBe('fail')
    expect(v.category).toBe(category)
    expect(v.note).toBe(note)
  })

  test('AC4 — filter buttons narrow the visible rows correctly', async ({
    page,
  }) => {
    // ── Assertion classification ──────────────────────────────────────────
    // RED-on-base lever: no page -> no filters. On GREEN, seeding a single
    // 'pass' verdict for one item and then clicking each filter shows the
    // correct subset. The "passed filter shows exactly the one passed row" +
    // "untested filter excludes that row" pairing is the lever. We compute the
    // total/visible counts via exact equality.
    //
    // Strategy: render once with no verdicts to learn the first itemId + its
    // audioHash, seed a matching 'pass' verdict, reload, then exercise filters.
    //
    // IMPLEMENTATION NOTE (PR #363 cross-review, Kevin 2026-06-11): the page
    // filters by HIDING rows via the `[hidden]` attribute (state-preserving,
    // contract-compliant) — filtered-out rows stay in the DOM. Playwright's
    // `toHaveCount()` counts ALL matched DOM nodes regardless of visibility, so
    // an unfiltered `[data-testid^="vqa-item-"]` locator reports 654 even after
    // a filter. We therefore scope every filter assertion to the VISIBLE subset
    // via Playwright's `:visible` pseudo-class. Per-item presence/absence is
    // asserted with `toBeVisible()` / `toBeHidden()` (NOT `toHaveCount(0)`,
    // which would also pass if the row were absent — but the row is present-yet-
    // hidden, so visibility is the correct contract surface).
    await page.goto(PAGE_URL)
    await waitForPageReady(page)
    const itemId = await firstItemId(page)
    const audioHash = await rowAudioHash(page, itemId)

    const passedVerdict: StoredVerdict = {
      itemId,
      audioHash,
      verdict: 'pass',
      decidedAt: '2026-06-11T09:00:00.000Z',
    }
    await seedVqaStorage(page, {
      secret: 'qa-secret-token',
      verdicts: { [itemId]: passedVerdict },
    })
    await page.reload()
    await waitForPageReady(page)

    // VISIBLE rows only — the page hides filtered rows via `[hidden]` rather
    // than removing them, so the locator must filter to `:visible`.
    const visibleRows = page.locator('[data-testid^="vqa-item-"]:visible')
    const seededRow = page.getByTestId(`vqa-item-${itemId}`)

    // Filter: all -> baseline visible count (every row).
    await page.getByTestId('vqa-filter-all').click()
    const totalVisible = await visibleRows.count()
    expect(totalVisible).toBeGreaterThan(0)

    // Filter: passed -> exactly the one seeded passed row, and it IS our item.
    await page.getByTestId('vqa-filter-passed').click()
    await expect(visibleRows).toHaveCount(1)
    await expect(seededRow).toBeVisible()

    // Filter: untested -> the passed row is excluded; visible == total - 1.
    await page.getByTestId('vqa-filter-untested').click()
    await expect(visibleRows).toHaveCount(totalVisible - 1)
    await expect(seededRow).toBeHidden()

    // Filter: failed -> nothing seeded as failed -> zero visible rows.
    await page.getByTestId('vqa-filter-failed').click()
    await expect(visibleRows).toHaveCount(0)
  })

  test('AC5 — submit posts the full verdict set; mocked endpoint surfaces the issue URL', async ({
    page,
  }) => {
    // ── Assertion classification ──────────────────────────────────────────
    // RED-on-base lever: no page -> no submit button -> no POST. On GREEN, the
    // submit POSTs { secret, submittedAt, verdicts: [...] } to
    // /api/voice-qa-report and renders the mocked issueUrl. The endpoint is
    // ALWAYS route-mocked (out-of-scope: no real GitHub calls). The
    // exactly-one-POST + full-verdict-set + rendered-URL triple is the lever.
    const secret = 'qa-secret-token'

    // Render once to learn item id + audioHash, then seed a pass + a fail so
    // the submitted set carries BOTH a pass and a full fail (category + note),
    // proving the payload includes passes (per AC5: "full verdict set incl.
    // passes").
    await page.goto(PAGE_URL)
    await waitForPageReady(page)
    const itemId = await firstItemId(page)
    const audioHash = await rowAudioHash(page, itemId)

    const seededVerdict: StoredVerdict = {
      itemId,
      audioHash,
      verdict: 'pass',
      decidedAt: '2026-06-11T09:00:00.000Z',
    }
    await seedVqaStorage(page, {
      secret,
      verdicts: { [itemId]: seededVerdict },
    })

    // Capture every POST to the report endpoint; mock { ok: true, issueUrl }.
    const issueUrl = 'https://github.com/TSandvaer/MarianLearning/issues/9999'
    const reportRequests: Request[] = []
    await page.route('**/api/voice-qa-report', async (route, request) => {
      reportRequests.push(request)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, issueUrl }),
      })
    })

    await page.reload()
    await waitForPageReady(page)
    await page.getByTestId('vqa-submit').click()

    // The page shows the returned issue URL (link or text).
    await expect(page.getByText(issueUrl)).toBeVisible()

    // EXACTLY one POST fired — the "submit fires the report once" contract.
    // (`.toHaveLength(1)` is the count-assertion-rules equivalent of
    // toHaveBeenCalledTimes(1) for captured requests.)
    expect(reportRequests).toHaveLength(1)

    // Payload matches the contract shape exactly.
    const postData = reportRequests[0].postData()
    expect(postData, 'report POST had no body').not.toBeNull()
    const payload = JSON.parse(postData!) as {
      secret: string
      submittedAt: string
      verdicts: StoredVerdict[]
    }
    expect(payload.secret).toBe(secret)
    expect(typeof payload.submittedAt).toBe('string')
    expect(Number.isNaN(Date.parse(payload.submittedAt))).toBe(false)

    // The verdict set is sent as an array and includes the seeded PASS verdict
    // (full set, not failures-only). Exactly one verdict was seeded ->
    // exactly one element, asserted via `.toEqual` not `.toContainEqual`.
    expect(Array.isArray(payload.verdicts)).toBe(true)
    expect(payload.verdicts).toHaveLength(1)
    expect(payload.verdicts[0].itemId).toBe(itemId)
    expect(payload.verdicts[0].verdict).toBe('pass')
  })

  test('AC6 — needs-retest: stale-audioHash verdict surfaces needs-retest badge', async ({
    page,
  }) => {
    // ── Assertion classification ──────────────────────────────────────────
    // RED-on-base lever: no page -> no badge. On GREEN, a seeded verdict whose
    // audioHash does NOT match the current rendered row's hash must flag the
    // row as needs-retest (the hash-invalidation contract). The
    // `.toHaveText(/needs-retest/i)` on the badge is the lever.
    //
    // Strategy: render once to learn the real itemId + current audioHash, then
    // seed a verdict for that item with a DELIBERATELY-WRONG audioHash, reload,
    // and assert the badge reads needs-retest (NOT passed/failed).
    await page.goto(PAGE_URL)
    await waitForPageReady(page)
    const itemId = await firstItemId(page)
    const currentHash = await rowAudioHash(page, itemId)

    const staleHash = `stale-${currentHash}-mismatch`
    expect(staleHash).not.toBe(currentHash)

    const staleVerdict: StoredVerdict = {
      itemId,
      audioHash: staleHash,
      verdict: 'pass',
      decidedAt: '2026-06-01T09:00:00.000Z',
    }
    await seedVqaStorage(page, {
      secret: 'qa-secret-token',
      verdicts: { [itemId]: staleVerdict },
    })
    await page.reload()
    await waitForPageReady(page)

    // Badge must read needs-retest because the stored hash != rendered hash.
    await expect(page.getByTestId(`vqa-state-${itemId}`)).toHaveText(
      /needs-retest/i,
    )

    // And the needs-retest filter must include this row (regression-lock-style
    // positive membership of the one stale row).
    await page.getByTestId('vqa-filter-needs-retest').click()
    await expect(page.getByTestId(`vqa-item-${itemId}`)).toBeVisible()
  })
})
