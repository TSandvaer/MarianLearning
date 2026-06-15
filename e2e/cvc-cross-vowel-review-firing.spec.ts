/**
 * E2E FAILING-FIRST spec — CVC cross-vowel REVIEW FIRING (ticket 86c9qa6n3, AC6).
 *
 * Paired implementation branch: `kevin/86c9qa6n3-cvc-review-mode`.
 *
 * INTENTIONALLY RED on `main` until the 86c9qa6n3 impl merges. This is the
 * accepted failing-first pattern (memory `feedback_progression_e2e_mandatory`
 * + `feedback_failing_first_must_prove_green`): the spec is RED today because
 * the feature does not exist, greens on rebase after Kevin's impl lands, then
 * the orchestrator merges it.
 *
 * The bug this spec locks
 * -----------------------
 * Cross-vowel distractor mixing (ticket 86c9qa0kf) is fully wired
 * client-side: `WordSong.tsx`'s `buildChipOrder(problem, crossVowelMixing)`
 * routes distractors through `TARGET_PAIRINGS_CROSSVOWEL` when its
 * `crossVowelMixing` prop is `true`. App.tsx sets that prop `true` only when
 * BOTH (a) `crossVowelMixingActive(progress)` (all 3 CVC tiers mastered +
 * toggle on) AND (b) the picked `focusNode` is a CVC tier
 * (`focusIsCvcTier`, App.tsx ~L1446).
 *
 * On `main`, once all 3 CVC tiers are `'mastered'`, `pickFocusNode` walks
 * PAST them and lands on `digraphs-sh` (or the next non-mastered node).
 * `focusIsCvcTier` is then `false`, `crossVowelMixing` is `false`, and the
 * cross-vowel matrix NEVER fires in natural production play — the existing
 * `cvc-cross-vowel-mix-regression.spec.ts` header documents this gap
 * verbatim ("the matrix surfaces chips only when a future ticket adds CVC
 * review ... or a graduation-reset flow"). 86c9qa6n3 IS that future ticket.
 *
 * The locked mechanic (Option C-then-B, per the dispatch contract):
 *   (a) a one-time GRADUATION review session fires after the 3rd CVC tier
 *       masters, routing focus back to a CVC tier (→ `cvc-words-short-u`),
 *       so cross-vowel chips actually render;
 *   (b) thereafter every 5 sessions, round-robin across the 3 CVC tiers.
 *
 * This spec is BLACK-BOX. It seeds the all-3-CVC-tiers-mastered state and
 * asserts on production-play chip RENDERING (per AC6: "the rendering
 * assertion must be real production play, NOT a debug-seeded shortcut"). It
 * does NOT depend on Kevin's internal vocabulary (`pickCvcReviewNode`,
 * `pickFocusNode` returning `{ node, mode }`, `Progress.cvcGraduationSessionFired`).
 *
 * RED-on-base evidence (the load-bearing failing-first proof)
 * -----------------------------------------------------------
 * Run on `main`:
 *   yarn e2e -- e2e/cvc-cross-vowel-review-firing.spec.ts --project=chromium
 * The picker walks to `digraphs-sh`, `crossVowelMixing` stays `false`, every
 * chip across all 8 problems is short-u → the session shows exactly ONE
 * distinct vowel. Test 1's `distinctVowels.size > 1` assertion fails.
 * (The paired RED output is pasted in the PR body's Self-Test Report.)
 *
 * Why it is genuinely made-GREEN-able (not RED for an incidental reason)
 * ---------------------------------------------------------------------
 * The RED is NOT a route-abort or static-fallback artifact
 * (`feedback_failing_first_must_prove_green`): the mock returns REAL
 * Azure-rendered short-u canon bytes, so `data-read-aloud-played` flips,
 * chips enable, and the session walks all 8 problems on BOTH base and impl.
 * The ONLY thing that changes between RED and GREEN is which vowel pools
 * the client-side distractor picker draws from — flipped solely by
 * `crossVowelMixing` going `false → true` once cvc-review routes focus back
 * to a CVC tier. The same-vowel (`TARGET_PAIRINGS`) vs cross-vowel
 * (`TARGET_PAIRINGS_CROSSVOWEL`) matrices are already shipped and
 * unit-tested; this spec only exercises the firing path that selects between
 * them. So the green path is a real, already-present code path that the
 * impl unlocks — not a fixture artifact.
 *
 * Mock strategy
 * -------------
 * `installCvcWordsShortUClaudeMock` returns the bytes of
 * `cvc-words-short-u.json` (real Azure-rendered MP3s) for any word-song
 * request — the exact same helper shape the sibling cross-vowel-mix +
 * short-u regression specs use. Synthetic silent-base64 fixtures decode
 * flakily in headless Chromium and never flip `data-read-aloud-played`
 * (.claude/docs/testing-and-ci.md §6). The mock does NOT gate on focus —
 * the App parser is content-shape-driven, so the short-u canon parses
 * cleanly whether the request's focus is `cvc-words-short-u` (impl) or
 * `digraphs-sh` (base). The distractor pool is a CLIENT decision, so the
 * canon target words being short-u is correct for both RED and GREEN; only
 * the distractors differ.
 *
 * Vowel classifier (black-box discriminator)
 * ------------------------------------------
 * Each CVC chip word carries exactly one short-vowel grapheme. `vowelOf`
 * extracts it. Same-vowel session → all chips share one vowel; cross-vowel
 * session → chips span ≥2 vowels (the short-u `TARGET_PAIRINGS_CROSSVOWEL`
 * rows pull short-a + short-o distractors, e.g. sun→[cat, mom, fan, man]).
 * Classifying by grapheme keeps the spec independent of the wordPack's
 * `vowel:` field shape and of any pool drift.
 *
 * WebKit skip rule
 * ----------------
 * The chip-render assertion needs the read-aloud effect to fire (chips
 * enable). WebKit headless has no AudioContext, so it skips per
 * testing-and-ci.md §2.2 / §8.3. Real iPad Safari is unaffected.
 */

import { test, expect } from '@playwright/test'
import type { Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

// Multi-session-shaped walk-through can run long once GREEN; size the
// per-test budget generously per testing-and-ci.md §4.1.1b. A single full
// 8-problem walk on the silent-caption fallback is ~30-50s; one test, plus
// headroom.
test.setTimeout(120_000)

const CVC_WORDS_SHORT_U_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/cvc-words-short-u.json',
)

/** The single short-vowel grapheme of a CVC word ('sun' → 'u', 'cat' → 'a').
 *  Throws if the word has zero or multiple vowel letters — every CVC pack
 *  word has exactly one, so a throw means the pack drifted and the spec
 *  should be revisited rather than silently miscounting. */
function vowelOf(word: string): 'a' | 'e' | 'i' | 'o' | 'u' {
  const vowels = word.toLowerCase().match(/[aeiou]/g) ?? []
  if (vowels.length !== 1) {
    throw new Error(
      `[spec] expected exactly one vowel grapheme in CVC word "${word}", got ${vowels.length} (${vowels.join('')})`,
    )
  }
  return vowels[0] as 'a' | 'e' | 'i' | 'o' | 'u'
}

/** Returns the cvc-words-short-u canon bytes for any word-song request and
 *  captures request bodies for the planner-contract assertion. Math (or any
 *  other) request is rejected with 500 — only word-song fetches in this
 *  flow. Identical shape to the sibling cross-vowel-mix spec's mock. */
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
        message: `cvc-review-firing spec only mocks word-song; saw track=${String(track)}`,
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
    'WebKit headless has no AudioContext → read-aloud effect cannot fire, chips never enable. Production iPad Safari works fine; harness limitation.',
  )
}

test.describe('cvc cross-vowel REVIEW FIRING (ticket 86c9qa6n3, AC6) — FAILING-FIRST, intentionally RED until impl merges', () => {
  test('1. RED-on-base lever — all 3 CVC tiers mastered → cvc-review fires → cross-vowel chips actually render in production play (≥2 distinct vowels across the 8-problem walk)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // Seed: all 3 cross-vowel CVC tiers mastered (cvc-words /
    // cvc-words-short-o / cvc-words-short-u) so `crossVowelMixingActive`
    // returns `true` (toggle defaults `true`). short-i + short-e + the
    // digraph siblings are NOT mastered, so on `main` the picker walks past
    // every CVC tier and lands on `cvc-words-short-i` (the first
    // non-mastered word-song node) — `focusIsCvcTier` is false there too
    // (the gate only matches cvc-words / -short-o / -short-u), so
    // crossVowelMixing stays `false` and the matrix never fires.
    //
    // Post-impl (86c9qa6n3): the one-time graduation review fires after the
    // 3rd CVC tier mastered and routes focus back to a CVC tier
    // (cvc-words-short-u per the locked mechanic), flipping
    // crossVowelMixing `true` so the cross-vowel distractor matrix renders.
    //
    // No internal field is seeded — `cvcGraduationSessionFired` is absent,
    // which is exactly the "graduation has not happened yet" precondition.
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'mastered',
          'cvc-words-short-o': 'mastered',
          'cvc-words-short-u': 'mastered',
          // short-i is the first non-mastered node → base picker lands
          // here (NOT a cross-vowel-gate tier), so crossVowelMixing=false
          // on main. Left at the helper default ('locked'/'intro') — do
          // not master it, or the base picker would walk further and the
          // RED reason would shift.
        },
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    const { requests } = await installCvcWordsShortUClaudeMock(page)
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

    // Walk all 8 problems of the REAL production session, collecting every
    // chip word. This is genuine production play (AC6) — not a debug-seeded
    // chip injection. The vowel set across all chips is the cross-vowel
    // discriminator.
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

    // 24 chips total (3 per problem × 8). Regression-lock: the session
    // structure is unchanged by the feature.
    expect(allChipWords).toHaveLength(24)

    // RED-on-base LEVER: in production play, the cross-vowel review session
    // must surface distractors from MORE THAN ONE vowel pool. On `main`
    // (review never fires) every chip is short-u → exactly one distinct
    // vowel → this assertion FAILS for the intended reason. Post-impl the
    // short-u TARGET_PAIRINGS_CROSSVOWEL rows pull short-a + short-o
    // distractors (e.g. sun → [cat, mom, fan, man]) → ≥2 distinct vowels.
    const distinctVowels = new Set(allChipWords.map(vowelOf))
    expect(
      distinctVowels.size,
      `cross-vowel review must render distractors across ≥2 vowel pools in real production play; ` +
        `saw vowels {${[...distinctVowels].sort().join(', ')}} across chips [${allChipWords.join(', ')}]. ` +
        `On base this is a single vowel (review never fires → same-vowel TARGET_PAIRINGS only).`,
    ).toBeGreaterThan(1)

    // RED-on-base LEVER (corroborating, same root cause): the cross-vowel
    // matrix specifically pulls short-a AND/OR short-o distractors onto a
    // short-u target session. Assert at least one chip is NOT short-u —
    // pins that the diversity above comes from genuine cross-vowel pooling,
    // not from an unrelated vowel leak. On base, zero non-short-u chips.
    const nonShortUChips = allChipWords.filter((w) => vowelOf(w) !== 'u')
    expect(
      nonShortUChips.length,
      `expected ≥1 cross-vowel (non-short-u) distractor chip in the review session; saw none — ` +
        `review did not fire (chips: [${allChipWords.join(', ')}]).`,
    ).toBeGreaterThan(0)

    // Trivially-green COUNTER-CHECK (becomes a real regression guard
    // post-impl): the correct chip on every problem must still be a valid
    // short-u target — the cross-vowel mix changes DISTRACTORS only, never
    // the target word. Passes on base for a trivial reason (base session is
    // all short-u including the targets); locks "targets stay short-u" once
    // the matrix fires. The mock canon is short-u, so the planner-emitted
    // target words are short-u on both base and impl.
    const planRequest = requests.find((r) => {
      try {
        const b = JSON.parse(r.postData() ?? '{}') as { payload?: unknown }
        return (
          (b.payload as { track?: string } | undefined)?.track === 'word-song'
        )
      } catch {
        return false
      }
    })
    expect(
      planRequest,
      'a word-song planner request must have fired',
    ).toBeDefined()
  })
})
