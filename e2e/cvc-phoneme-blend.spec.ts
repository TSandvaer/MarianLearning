/**
 * E2E spec — CVC phoneme-blend prompt on the 2nd wrong tap (ticket
 * 86c9qa6n3, MVP).
 *
 * What this locks in
 * ------------------
 * The MVP replaces the empty 2nd-wrong `hint` beat with a real
 * phoneme-blend sound-out ("c - a - t ... cat") for `cvc-word` problems
 * whose session bundle carries a baked `word.p{N}.blend` utterance, and
 * GRACEFUL-SKIPS to the existing `hint` line when the blend slot is absent
 * (every tier today, pre-bake). Two cases:
 *
 *   1. **Blend fires** — a canon mutated to carry `blend` lines → the 2nd
 *      wrong tap plays the blend (caption shows the segmented text) and the
 *      letters highlight in sequence.
 *   2. **Graceful-skip (pre-bake)** — the REAL production cvc-words canon
 *      (no `blend` slot) → the 2nd wrong tap fires the existing
 *      "Let's look. <Word>." hint, no letter highlight, no soft-lock.
 *
 * Mock strategy
 * -------------
 * Same posture as `cvc-words-regression.spec.ts`: fulfill `/api/claude`
 * word-song requests with the EXACT bytes of the production cvc-words
 * canon (so the MP3s decode cleanly in headless Chromium and the
 * read-aloud effect completes). For the blend-fires case we mutate the
 * canon in memory to add a `word.p{N}.blend` utterance per problem,
 * REUSING the problem's `hint` audio bytes so the blend line decodes and
 * fires `onWordTick` (the audio CONTENT doesn't matter for the render
 * assertions — only that it plays).
 *
 * WebKit headless has no AudioContext (read-aloud never fires, chips never
 * enable), so these tests are chromium-only — same harness limitation the
 * cvc-words regression spec documents.
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'

const CVC_WORDS_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/cvc-words.json',
)

interface CanonUtterance {
  id: string
  text: string
  audio?: { kind: string; base64: string; mime: string }
}
interface Canon {
  ok: boolean
  kind: string
  plan: {
    id: string
    label: string
    utterances: { id: string; text: string }[]
  }
  utterances: CanonUtterance[]
}

/** The production cvc-words canon, parsed. */
function loadCanon(): Canon {
  return JSON.parse(readFileSync(CVC_WORDS_CANON_PATH, 'utf-8')) as Canon
}

/** Derive the target word from a "Read the <word>." read line. */
function wordFromRead(read: string): string {
  const m = read.match(/^Read the ([a-z]+)\.$/i)
  if (!m) throw new Error(`unexpected read line: ${read}`)
  return m[1]!.toLowerCase()
}

/** ASCII-7 segmented blend text for a word, e.g. "c - a - t ... cat". */
function blendText(word: string): string {
  return `${word.split('').join(' - ')} ... ${word}`
}

/**
 * Return a deep copy of the canon with a `word.p{N}.blend` utterance added
 * to every problem, reusing that problem's `hint` audio bytes so the blend
 * line decodes + plays (the content is irrelevant for the render check).
 */
function canonWithBlend(): Canon {
  const canon = loadCanon()
  // 8 problems.
  for (let n = 1; n <= 8; n++) {
    const read = canon.plan.utterances.find((u) => u.id === `word.p${n}.read`)
    const hint = canon.utterances.find((u) => u.id === `word.p${n}.hint`)
    if (!read || !hint?.audio) continue
    const word = wordFromRead(read.text)
    const text = blendText(word)
    canon.plan.utterances.push({ id: `word.p${n}.blend`, text })
    canon.utterances.push({
      id: `word.p${n}.blend`,
      text,
      audio: { ...hint.audio },
    })
  }
  return canon
}

/** Install a word-song /api/claude mock returning the given canon body. */
async function installMock(page: Page, body: string): Promise<void> {
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
      await route.fulfill({ status: 405, body: '' })
      return
    }
    const payload = (JSON.parse(request.postData() ?? '{}').payload ?? {}) as {
      track?: string
    }
    if (payload.track === 'word-song') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body,
      })
      return
    }
    await route.fulfill({ status: 500, body: '' })
  })
}

/** Drive Hub → Word Song and wait for the first read-aloud to complete. */
async function enterWordSong(page: Page): Promise<void> {
  await page.goto('/?debug=1&seed=cvc-words')
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 15_000 })
  await page
    .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
    .click()
  const wordSong = page.getByTestId('word-song')
  await expect(wordSong).toBeVisible({ timeout: 15_000 })
  // Read-aloud completed → chips enabled.
  await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
    timeout: 20_000,
  })
}

/** Tap a wrong chip once. */
async function tapWrongChip(page: Page): Promise<void> {
  const wrong = page
    .locator('[data-testid="word-song-chip"][data-correct="false"]')
    .first()
  await wrong.click()
}

/**
 * Drive the 2nd-wrong beat: tap a wrong chip, wait for that reprompt to
 * fully settle (so the two reprompts don't overlap and trip the in-flight
 * stale-guard — `repromptInFlightRef`), then tap wrong again. The 2nd tap's
 * reprompt `.then()` schedules the hint/blend 600ms later.
 */
async function tapWrongTwice(page: Page): Promise<void> {
  await tapWrongChip(page)
  // Let the 1st reprompt's audio + .finally() FULLY complete before the 2nd
  // tap. If the 2nd tap lands while the 1st reprompt is still in-flight, the
  // 1st tap's .finally() can clear `repromptInFlightRef` between the 2nd
  // tap's speak() and its .then(), and the stale-guard bails the hint/blend
  // schedule (a pre-existing reprompt-overlap race, not introduced here).
  // The reprompt clip runs ~2.5s; 3.5s is comfortable headroom.
  await page.waitForTimeout(3500)
  await tapWrongChip(page)
}

/** Reconstruct the current caption from the `word-song-caption-word` spans. */
async function captionText(page: Page): Promise<string> {
  return page
    .getByTestId('word-song-caption-word')
    .evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).getAttribute('data-word')).join(' '),
    )
}

test.describe('CVC phoneme-blend prompt (2nd wrong tap, ticket 86c9qa6n3)', () => {
  // Both tests are chromium-only: WebKit headless has no AudioContext, so
  // the read-aloud effect never fires and chips never enable. Production
  // iPad Safari works fine — this is the documented harness limitation
  // (see cvc-words-regression.spec.ts header).
  test('blend fires on the 2nd wrong tap, with the letters highlighting in sequence', async ({
    page,
  }, testInfo) => {
    testInfo.skip(testInfo.project.name === 'webkit')
    await installMock(page, JSON.stringify(canonWithBlend()))
    await enterWordSong(page)

    const wordSong = page.getByTestId('word-song')
    const targetWord = await page
      .getByTestId('word-song-word-card')
      .getAttribute('data-word')
    expect(targetWord).not.toBeNull()

    await tapWrongTwice(page)

    // The blend caption appears (segmented "<g> - <g> - <g> ... <word>").
    // Assert the SEGMENTED shape specifically — the reprompt "Hmm... try
    // again?" also contains "..." but never the " - " grapheme separators.
    await expect
      .poll(() => captionText(page), { timeout: 15_000 })
      .toMatch(/^[a-z]( - [a-z])+ \.\.\. [a-z]+$/)

    // At some point during the blend, at least one letter is highlighted
    // (data-highlighted="true"). We poll because the highlight walks as the
    // audio ticks; the whole-word beat lights ALL letters.
    await expect
      .poll(
        async () =>
          page
            .locator(
              '[data-testid="word-song-letter"][data-highlighted="true"]',
            )
            .count(),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0)

    // Emma is in the attentive-pointing pose for the blend beat.
    await expect(
      page.locator(
        '[data-testid="word-song-emma"][data-pose="attentive-pointing"]',
      ),
    ).toHaveCount(1, { timeout: 5_000 })

    // No soft-lock: the chips stay tappable. data-read-aloud-played stays true.
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true')
  })

  test('graceful-skip: the REAL canon (no blend slot) fires the existing hint, no letter highlight, no soft-lock', async ({
    page,
  }, testInfo) => {
    testInfo.skip(testInfo.project.name === 'webkit')
    // Real production canon — carries NO `blend` slot (pre-bake state).
    await installMock(page, readFileSync(CVC_WORDS_CANON_PATH, 'utf-8'))
    await enterWordSong(page)

    const wordSong = page.getByTestId('word-song')

    await tapWrongTwice(page)

    // The existing hint fires — caption shows "Let's look. <Word>." NO blend
    // grapheme separators.
    await expect
      .poll(() => captionText(page), { timeout: 15_000 })
      .toContain("Let's")

    const caption = await captionText(page)
    // The hint caption never carries the " - " grapheme-segmentation shape.
    expect(caption).not.toMatch(/ - /)

    // No letter is blend-highlighted (the hint path never drives the
    // per-letter reveal).
    await expect(
      page.locator('[data-testid="word-song-letter"][data-highlighted="true"]'),
    ).toHaveCount(0)

    // No soft-lock: chips stay tappable.
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true')
  })
})
