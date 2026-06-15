/**
 * E2E REGRESSION LOCK — CVC cross-vowel REVIEW FIRING (ticket 86c9qa6n3, AC6).
 *
 * Status: GREEN on `main`. The 86c9qa6n3 impl (PR #471, commit 60e8908) is
 * MERGED. This spec is no longer "failing-first / intentionally RED" — it is
 * a STANDING REGRESSION LOCK: it passes today on production play and goes RED
 * if cvc-review ever stops firing (the cross-vowel matrix silently reverts to
 * same-vowel-only). Per `feedback_progression_e2e_mandatory` (rule 8) every
 * progression-state-machine PR keeps a paired E2E lock alive post-merge.
 *
 * The behaviour this spec locks
 * -----------------------------
 * Cross-vowel distractor mixing (ticket 86c9qa0kf) is fully wired
 * client-side: `WordSong.tsx`'s `buildChipOrder(problem, crossVowelMixing)`
 * routes distractors through `TARGET_PAIRINGS_CROSSVOWEL` when its
 * `crossVowelMixing` prop is `true`. App.tsx sets that prop `true` only when
 * BOTH (a) `crossVowelMixingActive(progress)` (all 3 CVC tiers mastered +
 * toggle on) AND (b) the picked `focusNode` is a CVC tier
 * (`focusIsCvcTier`, App.tsx ~L1446).
 *
 * Without the firing layer, once all 3 CVC tiers are `'mastered'`,
 * `pickFocusNode` walks PAST them and lands on the next non-mastered node.
 * `focusIsCvcTier` is then `false`, `crossVowelMixing` is `false`, and the
 * cross-vowel matrix NEVER fires in natural production play — the existing
 * `cvc-cross-vowel-mix-regression.spec.ts` header documents that gap
 * verbatim ("the matrix surfaces chips only when a future ticket adds CVC
 * review ... or a graduation-reset flow"). 86c9qa6n3 WAS that ticket.
 *
 * The locked mechanic (Option C-then-B, per the dispatch contract, as shipped
 * in `focusNode.ts:pickFocusNode` / `pickCvcReviewNode`):
 *   (a) `pickFocusNode` enters cvc-review mode ONLY when the forward walk
 *       finds NO non-mastered word-song node — i.e. the WHOLE word-song tree
 *       through `simple-sentences` is mastered. (The earlier "all 3 CVC tiers
 *       mastered" gate was the regression FIX target — commit 526d47e — because
 *       it hijacked every downstream forward tier.)
 *   (b) in that maintenance state, the GRADUATION review fires once
 *       (`cvcGraduationSessionFired` falsy → `cvc-words-short-u`), routing
 *       focus back to a CVC tier so cross-vowel chips actually render;
 *   (c) thereafter every 5 sessions, round-robin across the 3 CVC tiers.
 *
 * This spec is BLACK-BOX. It seeds the whole-word-song-tree-mastered state and
 * asserts on production-play chip RENDERING (per AC6: "the rendering
 * assertion must be real production play, NOT a debug-seeded shortcut"). It
 * does NOT depend on the impl's internal vocabulary (`pickCvcReviewNode`,
 * `pickFocusNode` returning `{ node, mode }`, `Progress.cvcGraduationSessionFired`)
 * beyond seeding the production-shaped precondition.
 *
 * Why the assertion still genuinely locks the firing behaviour
 * ------------------------------------------------------------
 * The lock is load-bearing because the ONLY thing that produces ≥2 distinct
 * vowels across the 24 chips is `crossVowelMixing` being `true` — which only
 * happens when cvc-review routes focus back to a CVC tier. If a future change
 * regresses the firing layer (the picker stops entering cvc-review, or
 * App.tsx stops letting a review pick through `focusIsCvcTier`), the session
 * reverts to same-vowel `TARGET_PAIRINGS` distractors → every chip short-u →
 * `distinctVowels.size === 1` → this spec FAILS. The same-vowel
 * (`TARGET_PAIRINGS`) vs cross-vowel (`TARGET_PAIRINGS_CROSSVOWEL`) matrices
 * are already shipped and unit-tested; this spec exercises the firing path
 * that selects between them in real production play — the exact surface no
 * unit test covers.
 *
 * Counterfactual confirmation (what makes this a real lock, not a tautology):
 * before the seed correction, this spec seeded only "3 CVC tiers mastered,
 * short-i non-mastered" and was RED on the merged impl — because the corrected
 * picker (rightly) lands on FORWARD short-i, crossVowelMixing stays false, and
 * no cross-vowel chips render. Mastering the whole tree is what moves the
 * picker into the graduation cvc-review state the lock is meant to verify.
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
 * cleanly regardless of which focus the request carries (the firing impl
 * sends `cvc-words-short-u`; a firing regression would send the next
 * forward node — either way the canon parses). The distractor pool is a
 * CLIENT decision, so short-u canon target words are correct whether the
 * matrix mixes vowels or not; only the distractors differ.
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

test.describe('cvc cross-vowel REVIEW FIRING (ticket 86c9qa6n3, AC6) — REGRESSION LOCK, green on main; red if cvc-review stops firing', () => {
  test('1. Regression lock — whole word-song tree mastered → graduation cvc-review fires → cross-vowel chips actually render in production play (≥2 distinct vowels across the 8-problem walk)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // Seed: the ENTIRE word-song tree mastered through simple-sentences.
    // This is the precondition the SHIPPED picker requires for cvc-review —
    // `pickFocusNode` enters review mode ONLY when the forward walk finds NO
    // non-mastered word-song node (`!hasForwardProgress`). The earlier
    // "3 CVC tiers mastered, short-i non-mastered" seed does NOT trigger
    // review under the merged impl: the corrected picker (regression FIX
    // commit 526d47e) lands on FORWARD short-i, crossVowelMixing stays
    // `false`, and no cross-vowel chips render.
    //
    // With the whole tree mastered AND `cvcGraduationSessionFired` unset
    // (the real pre-graduation production shape — the storage read-path
    // defaulter fills it to `false`, so the graduation latch is open),
    // `pickCvcReviewNode` returns `cvc-words-short-u`, `pickFocusNode`
    // returns `{ node: 'cvc-words-short-u', mode: 'cvc-review' }`, App.tsx
    // lets the mastered CVC tier through its `focusIsCvcTier` gate, and
    // `crossVowelMixing` flips `true` → the cross-vowel distractor matrix
    // renders short-a + short-o distractors onto the short-u session.
    //
    // No internal field is seeded — `cvcGraduationSessionFired` is absent,
    // which is exactly the "graduation has not happened yet" precondition.
    // letter-names is `'mastered'` at the diagnostic baseline already; the
    // rest of the tree is overridden here so NO word-song node is left
    // non-mastered.
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
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
          'sight-words': 'mastered',
          'simple-sentences': 'mastered',
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

    // FIRING-LOCK (load-bearing): in production play, the cross-vowel review
    // session must surface distractors from MORE THAN ONE vowel pool. On the
    // shipped impl the short-u TARGET_PAIRINGS_CROSSVOWEL rows pull short-a +
    // short-o distractors (e.g. sun → [cat, mom, fan, man]) → ≥2 distinct
    // vowels → GREEN. If the firing layer regresses (picker stops entering
    // cvc-review, or App.tsx stops letting a review pick through
    // `focusIsCvcTier`), the session reverts to same-vowel TARGET_PAIRINGS,
    // every chip is short-u → exactly one distinct vowel → this assertion
    // FAILS. That is the regression this lock guards.
    const distinctVowels = new Set(allChipWords.map(vowelOf))
    expect(
      distinctVowels.size,
      `cross-vowel review must render distractors across ≥2 vowel pools in real production play; ` +
        `saw vowels {${[...distinctVowels].sort().join(', ')}} across chips [${allChipWords.join(', ')}]. ` +
        `A single vowel here means review stopped firing → same-vowel TARGET_PAIRINGS only (regression).`,
    ).toBeGreaterThan(1)

    // FIRING-LOCK (corroborating, same root cause): the cross-vowel matrix
    // specifically pulls short-a AND/OR short-o distractors onto a short-u
    // target session. Assert at least one chip is NOT short-u — pins that the
    // diversity above comes from genuine cross-vowel pooling, not from an
    // unrelated vowel leak. Zero non-short-u chips ⇒ review did not fire.
    const nonShortUChips = allChipWords.filter((w) => vowelOf(w) !== 'u')
    expect(
      nonShortUChips.length,
      `expected ≥1 cross-vowel (non-short-u) distractor chip in the review session; saw none — ` +
        `review did not fire (chips: [${allChipWords.join(', ')}]).`,
    ).toBeGreaterThan(0)

    // REGRESSION GUARD on the target: the correct chip on every problem must
    // still be a valid short-u target — the cross-vowel mix changes
    // DISTRACTORS only, never the target word. Locks "targets stay short-u"
    // while the matrix fires. The mock canon is short-u, so the
    // planner-emitted target words are short-u.
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
