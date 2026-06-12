/**
 * E2E spec — simple-sentences CONTENT round-trip + sentence-completion
 * render mechanic + silent-demote guard.
 *
 * Ticket: 86ca8d4ar (W13-05). Wave 13 simple-sentences content tier —
 *   the LAST Word Song content frontier (terminal node of
 *   `WORD_SONG_NODES_IN_ORDER`, `nextNode → null`). Paired with Kevin's
 *   content PR (W13-03, ticket per `design/wave-13-simple-sentences-plan.md`
 *   Track 2) + Devon's render PR (W13-04, conditional Track 3). Pedagogy
 *   gate: `design/research/simple-sentences-sequence-marian.md` (Dave,
 *   W13-01 — PROCEED-SENTENCE-COMPLETION). Render contract:
 *   `design/word-song/simple-sentences-content.md` (Kyle, W13-02, PR #421).
 *
 * VOCABULARY CONTRACT (binding, from Kyle's W13-02 spec §1)
 * --------------------------------------------------------
 *   - `WordSongContentType` value:  'simple-sentence'
 *   - read-line template:           "Finish the sentence: <sentence>."
 *       <sentence> carries the gap as the literal token `___` (3 ASCII
 *       underscores). The target word is NOT in the read line — Emma must
 *       not say the answer aloud (cloze). On the wire the TTS read
 *       substitutes the spoken word "blank" for `___`.
 *   - sentence-frame field:         WordSongProblem.sentenceFrame?: string
 *       (the full sentence WITH `___` preserved, for display).
 *   - target resolution:            from the `correct` utterance
 *       ("Yes! Sat." → `sat`), NOT from the gapped read line (§1.2).
 *
 * WHAT THIS SPEC PINS — three RED-on-base levers + counter-test + guard
 * --------------------------------------------------------------------
 *   1. CONTENT round-trip (test 1, RED-on-base lever): the `/api/claude`
 *      mock serves the bytes of the on-disk simple-sentences canon. That
 *      canon file does NOT exist on `main` yet (W13-03 bakes it), so the
 *      mock-install throws an explicit ENOENT — the RED signal. Post-merge:
 *      the seeded session fires exactly one planner request whose body
 *      carries `progress.focusNode === 'simple-sentences'` (a POSITIVE
 *      request-body discriminator per `testing-and-ci.md` §4.1.1e — NOT a
 *      negative-membership chip assertion). The served canon parses to
 *      `contentType: 'simple-sentence'` with a populated `sentenceFrame`
 *      carrying exactly one `___` gap token per problem.
 *
 *   2. MAKEABLE-GREEN counter-test (test 2): a HAND-MOCKED simple-sentences
 *      plan shape (no on-disk dependency) proves the positive
 *      request-body + sentenceFrame + target-from-correct assertions go
 *      GREEN the moment a real plan is served — demonstrating the spec is
 *      not just verifiable-RED but credibly-makeable-GREEN
 *      (`feedback_failing_first_must_prove_green`).
 *
 *   3. RENDER mechanic (test 3, RED-on-base lever): the sentence-completion
 *      mechanic Kyle specified is a sentence PANEL with a styled blank
 *      (`word-song-sentence-panel` / `word-song-sentence-gap`) above
 *      written-word chips — NO picture card (`word-song-word-picture`
 *      ABSENT). On `main` a simple-sentences session runs the
 *      `blending-cv` stub (the planner's `effectiveFocusNode` demotes it),
 *      which renders a picture card + `<WordPicture>` SVG chips — exactly
 *      the mechanic Dave's research rules OUT. So the assertions FAIL on
 *      base for the right reason. Devon's W13-04 render PR adds the
 *      `simple-sentence` content-type branch → GREEN.
 *
 *   4. SILENT-DEMOTE guard (woven into tests 1 + 3): the tier must NOT
 *      serve `blending-cv` fallback content. Tests assert POSITIVE
 *      discriminators — the served sentenceFrame carries `___` (the CVC
 *      stub never does), the render shows the sentence panel + written
 *      chips (the stub shows a picture card). Both are count-based.
 *
 * WHY RED ON BASE (the failing-first contract)
 * --------------------------------------------
 * On `main`, `simple-sentences` is a STUB tier (verified @ checkout):
 *   - The `SkillNode` literal + picker order + tree exist (it is the
 *     terminal node) but the planner's `effectiveFocusNode` demotes
 *     `simple-sentences` → `blending-cv` content
 *     (`WORD_SONG_FIRST_CLASS_FOCUS_NODES` stops before it).
 *   - There is NO simple-sentences canon JSON on disk.
 *   - The `WordSongContentType` union does NOT include `'simple-sentence'`
 *     and `planFromServer.ts` has no `"Finish the sentence:"` template.
 *   - `WordSongProblem` has no `sentenceFrame` field.
 * So:
 *   - test 1 throws ENOENT at mock-install (canon file missing).
 *   - test 3, running the blending-cv stub, renders a
 *     `word-song-word-picture` picture card — the render assertions FAIL
 *     for the right reason.
 *
 * TRAP AVOIDANCE (testing-and-ci.md §4.1.1d/e + §4.1.2)
 * ----------------------------------------------------
 *   - NO `failNetwork: true` + negative-membership assertions (the
 *     trivially-green trap). Real plans served; POSITIVE discriminators.
 *   - test 3 does NOT call `forceHowlerUnlock` — it serves real on-disk
 *     canon MP3 bytes; `forceHowlerUnlock`'s stubbed AudioContext breaks
 *     the decode → silent demote to the static stub (testing-and-ci.md
 *     §4.1.2 silent-demote caveat + §4.1.6 / §4.2a). The real
 *     gesture-unlock chain + a `data-read-aloud-played` canon-landed gate
 *     is the correct mechanism — mirrors `sight-words-content.spec.ts`
 *     test 3 and `digraphs-sh-content.spec.ts` test 3.
 *
 * COUNT-ASSERTION DISCIPLINE
 * --------------------------
 * Per `feedback_count_assertions_on_regression_tests`: `.toEqual([...])`
 * / `.toBe(N)` / `.toHaveLength(N)` / `.toHaveCount(N)`. The single
 * `.toContain` use is on a chip's full text content (membership of the
 * chip word within the chip's rendered text), where the SET (the chip
 * text) is the contract — the permitted membership-in-set exception.
 *
 * WEBKIT SKIP
 * -----------
 * WebKit headless has no AudioContext → the read-aloud effect never
 * fires and chips never enable. Pure payload assertions (tests 1, 2) run
 * on BOTH engines; the chip/panel UI walk (test 3) is chromium-only.
 * Real iPad Safari is unaffected.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

/**
 * Path to the simple-sentences session canon. Resolved relative to
 * `process.cwd()` (Playwright runs the harness from the worktree root,
 * the same place `vite preview` reads `public/`). Per Devon NOF #3
 * (testing-and-ci.md §4.1.3), the read is wrapped in a function so it
 * resolves at TEST time and throws loudly on a path mismatch.
 *
 * On current `main` this file does NOT exist — that absence IS the
 * failing-first signal (see header). Kevin's W13-03 content PR + canon
 * bake create it.
 */
const SIMPLE_SENTENCES_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/simple-sentences.json',
)

/** The literal gap token in the read line + sentenceFrame (Kyle §1). */
const GAP_TOKEN = '___'

/**
 * The verified simple-sentences vocabulary pool. Source of truth:
 * `design/research/simple-sentences-sequence-marian.md` §"Verified
 * sentence pool" — the ~80 taught CVC content words + the 20 shipped
 * Dolch sight words + the 5 inherited Wave 11 deferrals
 * (they / then / there / where / were). Every gap-target the canon
 * serves must be drawn from this set; a `blending-cv` stub fallback
 * would serve short-a CVC targets that ARE in here (cat, bat, ...) —
 * which is WHY the sentenceFrame `___` discriminator (not pool
 * membership alone) is the load-bearing silent-demote guard. Pool
 * membership is a secondary positive check.
 *
 * Kevin's W13-03 content PR ships a subset for the first bake. The
 * membership assertion tolerates any subset — it asserts every SERVED
 * target is IN this pool. Widen only if W13-03 ships a target outside
 * Dave's verified pool (itself a pedagogy-gate violation worth flagging,
 * not silently accommodating).
 */
const SIMPLE_SENTENCES_POOL: ReadonlySet<string> = new Set([
  // CVC content words (taught — Dave §"Verified sentence pool").
  'cat',
  'hat',
  'bat',
  'mat',
  'bag',
  'fan',
  'man',
  'pan',
  'cap',
  'can',
  'tag',
  'dad',
  'jam',
  'van',
  'nap',
  'rat',
  'map',
  'tap',
  'dog',
  'mop',
  'log',
  'pot',
  'box',
  'fox',
  'mom',
  'hot',
  'sun',
  'cup',
  'bus',
  'bug',
  'jug',
  'mud',
  'nut',
  'tub',
  'pup',
  'hug',
  'bun',
  'gum',
  'sit',
  'bit',
  'hip',
  'sip',
  'lip',
  'kit',
  'tip',
  'dip',
  'fin',
  'wig',
  'bin',
  'pin',
  'bed',
  'red',
  'leg',
  'net',
  'pen',
  'web',
  'hen',
  'peg',
  'beg',
  'jet',
  'ship',
  'shell',
  'shed',
  'shop',
  'shoe',
  'sheep',
  'shark',
  'chin',
  'chip',
  'chop',
  'chat',
  'chest',
  'chug',
  'chick',
  'thin',
  'thick',
  'math',
  'bath',
  'moth',
  'path',
  'with',
  // Common verbs / adjectives used as gap targets (Dave templates A/E/F).
  'sat',
  'ran',
  'run',
  'see',
  'go',
  'big',
  'sad',
  'mad',
  'fat',
  // Shipped 20 Dolch sight words.
  'the',
  'a',
  'i',
  'is',
  'it',
  'in',
  'to',
  'no',
  'do',
  'was',
  'said',
  'he',
  'she',
  'we',
  'for',
  'on',
  'not',
  // Inherited Wave 11 deferrals (first-class here).
  'they',
  'then',
  'there',
  'where',
  'were',
])

/** Minimal shape of the on-disk session canon this spec inspects. */
interface CanonUtterance {
  id: string
  text: string
}
interface CanonShape {
  ok: boolean
  kind: string
  plan: { id: string; label: string; utterances: CanonUtterance[] }
  utterances: Array<{ id: string; text: string }>
}

/**
 * Read + parse the simple-sentences canon from disk.
 *
 * On current `main` the file does NOT exist — `existsSync` is false and
 * this throws an explicit, attributable message so the RED state reads
 * unambiguously in CI logs: this is the failing-first signal, not an
 * infra flake. Post-merge (Kevin's W13-03 PR + canon bake) the file
 * exists and this resolves cleanly.
 */
function readSimpleSentencesCanon(): { raw: string; parsed: CanonShape } {
  if (!existsSync(SIMPLE_SENTENCES_CANON_PATH)) {
    throw new Error(
      `[simple-sentences-content spec] FAILING-FIRST: simple-sentences ` +
        `canon not found at ${SIMPLE_SENTENCES_CANON_PATH}. This is the ` +
        `expected RED state on pre-merge main — the simple-sentences ` +
        `content does not exist yet (the planner demotes simple-sentences ` +
        `→ blending-cv stub). The spec flips GREEN when Kevin's W13-03 ` +
        `content PR merges and the canon bake commits this file.`,
    )
  }
  const raw = readFileSync(SIMPLE_SENTENCES_CANON_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as CanonShape
  return { raw, parsed }
}

/**
 * Pull the per-problem `read` line and `correct` line out of a canon's
 * `plan.utterances`. The cloze mechanic (Kyle §1.2) means the answer is
 * NOT in the read line — it is gapped with `___`. The target word is
 * resolved from the `correct` line ("Yes! <Word>."), mirroring every
 * other tier's stable target encoding.
 *
 * Returns a map keyed by problem number with both slots so the test can
 * assert (a) the read carries exactly one `___` gap and (b) the target
 * is in-pool.
 */
function problemSlots(
  canon: CanonShape,
): Map<number, { read: string; correctWord: string }> {
  const reads = new Map<number, string>()
  const corrects = new Map<number, string>()
  for (const u of canon.plan.utterances) {
    const rm = u.id.match(/^word\.p(\d+)\.read$/)
    if (rm !== null) {
      reads.set(Number(rm[1]), u.text)
      continue
    }
    const cm = u.id.match(/^word\.p(\d+)\.correct$/)
    if (cm !== null) {
      const wordMatch = u.text.match(/^Yes!\s+([A-Za-z]+)\.?$/)
      if (wordMatch === null) {
        throw new Error(
          `[simple-sentences-content spec] canon correct-slot text did ` +
            `not match "Yes! <Word>." template: id=${u.id} ` +
            `text=${JSON.stringify(u.text)}`,
        )
      }
      corrects.set(Number(cm[1]), wordMatch[1]!.toLowerCase())
    }
  }
  const out = new Map<number, { read: string; correctWord: string }>()
  for (const [n, read] of reads) {
    const correctWord = corrects.get(n)
    if (correctWord === undefined) {
      throw new Error(
        `[simple-sentences-content spec] problem ${n} has a read slot ` +
          `but no correct slot — malformed canon.`,
      )
    }
    out.set(n, { read, correctWord })
  }
  return out
}

/**
 * Count `___` gap-token occurrences in a read line. The cloze invariant
 * (Kyle §1.2) is EXACTLY ONE gap per sentence. Zero or two+ is a
 * malformed cloze — a `blending-cv` stub read ("Tap the cat.") carries
 * ZERO, which is the silent-demote tell.
 */
function gapTokenCount(read: string): number {
  // Split on the literal token; occurrences = (parts - 1).
  return read.split(GAP_TOKEN).length - 1
}

/**
 * Build a hand-mocked simple-sentences session plan that mirrors the
 * wire shape Kevin's W13-03 canon will produce. Used by test 2 to prove
 * the positive request-body + sentenceFrame + target-from-correct
 * assertions are CREDIBLY MAKEABLE-GREEN against a real served plan —
 * independent of whether the on-disk canon exists yet
 * (`feedback_failing_first_must_prove_green`).
 *
 * The `read` slot uses the `"Finish the sentence: <sentence-with-blank>."`
 * template with the spoken-form "blank" replaced by the literal `___`
 * data token (the planner emits the `___` form in the canon read text;
 * the TTS substitution to "blank" happens at render-line build time —
 * Kyle §4. For the wire+parser contract this spec pins, the `___` token
 * is what the parser splits on).
 */
const HAND_MOCK_SENTENCES: ReadonlyArray<{ frame: string; target: string }> = [
  { frame: `The cat ${GAP_TOKEN} the mat.`, target: 'sat' },
  { frame: `The dog ${GAP_TOKEN}.`, target: 'ran' },
  { frame: `The sun is ${GAP_TOKEN}.`, target: 'hot' },
  { frame: `I see the ${GAP_TOKEN}.`, target: 'dog' },
  { frame: `${GAP_TOKEN} are in the van.`, target: 'they' },
  { frame: `Put it ${GAP_TOKEN} the mat.`, target: 'on' },
  { frame: `The mat is ${GAP_TOKEN}.`, target: 'red' },
  { frame: `We can go ${GAP_TOKEN}.`, target: 'there' },
]

function handMockedSimpleSentencesPlan(): CanonShape {
  const utterances: CanonUtterance[] = []
  HAND_MOCK_SENTENCES.forEach(({ frame, target }, i) => {
    const n = i + 1
    const cap = target[0]!.toUpperCase() + target.slice(1)
    utterances.push(
      { id: `word.p${n}.read`, text: `Finish the sentence: ${frame}` },
      { id: `word.p${n}.correct`, text: `Yes! ${cap}.` },
      { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
      {
        id: `word.p${n}.hint`,
        text: `Listen. ${frame.replace(GAP_TOKEN, target)}`,
      },
      { id: `word.p${n}.giveAnswer`, text: `This one is ${target}.` },
    )
  })
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: 'simple-sentences-warm-up',
      label: 'Simple sentences — warm up',
      utterances,
    },
    utterances: utterances.map((u) => ({ id: u.id, text: u.text })),
  }
}

/**
 * Install a `/api/claude` mock and capture every observed request body.
 * `canonBody` is the JSON string served on word-song requests — resolved
 * EAGERLY by the caller BEFORE install, so an on-disk-canon read throws
 * its ENOENT failing-first error here (pre-navigation), giving a clean,
 * attributable RED on base. Mirrors `sight-words-content.spec.ts`'s
 * `installSightWordsClaudeMock`. Math (or any other) track is rejected
 * 500 so a stray request fails loudly rather than passing silently.
 */
async function installSimpleSentencesClaudeMock(
  page: Page,
  canonBody: string,
): Promise<{ requests: Request[] }> {
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
        message: `simple-sentences-content spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

/**
 * Seed the persisted Progress + SessionHistory blobs so the App routes
 * Splash → Hub directly with `simple-sentences` as the picked focus node.
 *
 *  - Every word-song node before `simple-sentences` is `'mastered'` so
 *    `pickFocusNode()` walks the track and stops at `simple-sentences`
 *    (the terminal node). `sight-words` is the immediate predecessor.
 *  - `simple-sentences` is bumped to `'practicing'` (the post-sight-words
 *    state Marian is in once she reaches the terminal tier).
 *  - SessionHistory `sessionCount: 5` skips Greet (Splash advances
 *    direct to Hub when sessionCount > 0).
 *
 * `skillLevelOverrides` is typed `Record<string, string>` and accepts the
 * `simple-sentences` literal (already canonical in the `SkillNode` union
 * on main — the failing-first signal here is the missing CANON + RENDER
 * mechanic, not a missing node literal). See `testing-and-ci.md` §4.1.1a.
 */
async function seedSimpleSentencesProgress(page: Page): Promise<void> {
  await seedLocalStorage(page, {
    progress: buildSeedProgress({
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
        'sight-words': 'mastered',
        'simple-sentences': 'practicing',
      },
    }),
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

/**
 * Skip helper for tests that depend on the read-aloud effect firing.
 * WebKit headless has no AudioContext — same harness limitation as the
 * sight-words / cvc / digraph content siblings.
 */
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud effect cannot fire. Production iPad Safari works fine; this is a harness limitation. Tests 1 + 2 (payload assertions) cover the content round-trip on webkit.',
  )
}

test.describe('simple-sentences content round-trip + sentence-completion mechanic (W13-05)', () => {
  test.beforeEach(async ({ page }) => {
    await seedSimpleSentencesProgress(page)
  })

  /**
   * TEST 1 — CONTENT round-trip against the on-disk canon.
   *
   * CLASSIFICATION: RED-on-base lever. The mock-install reads the on-disk
   * simple-sentences canon; on `main` that file is absent →
   * `readSimpleSentencesCanon()` throws ENOENT and this test FAILS at
   * setup for the right reason (the content does not exist yet).
   * Post-merge (Kevin's W13-03 canon bake) the file exists and the
   * assertions run.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit (does not
   * depend on chip enablement). Asserts:
   *   - The seeded `simple-sentences` session fires exactly one planner
   *     request whose body carries `progress.focusNode ===
   *     'simple-sentences'` (POSITIVE request-body discriminator —
   *     testing-and-ci.md §4.1.1e — proves the picker landed on the
   *     terminal tier and the wire carried it).
   *   - The served canon has 8 problems.
   *   - SILENT-DEMOTE GUARD: every problem's `read` line carries EXACTLY
   *     ONE `___` gap token (the cloze invariant). A `blending-cv` stub
   *     read ("Tap the cat.") carries ZERO — so this count-based positive
   *     assertion fails loudly if the demote leaks.
   *   - Every gap-target word is drawn from Dave's verified pool.
   */
  test('1. CONTENT: simple-sentences session fires a planner request with focusNode=simple-sentences and the on-disk canon carries 8 single-gap cloze problems', async ({
    page,
  }) => {
    // Read the on-disk canon EAGERLY — throws ENOENT on pre-merge main,
    // the failing-first RED signal (pre-navigation, clean message).
    const { requests } = await installSimpleSentencesClaudeMock(
      page,
      readSimpleSentencesCanon().raw,
    )
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // WordSong mounts — proves the planner fetch resolved and the parser
    // accepted the simple-sentences content.
    await expect(page.getByTestId('word-song')).toBeVisible({
      timeout: 15_000,
    })

    // Exactly one /api/claude POST observed for this session-start.
    expect(requests).toHaveLength(1)
    const recorded = requests[0]!
    const body = JSON.parse(recorded.postData() ?? '{}') as Record<
      string,
      unknown
    >
    expect(body.kind).toBe('session-start')
    const payload = body.payload as Record<string, unknown>
    expect(payload.track).toBe('word-song')
    const progressBlock = payload.progress as Record<string, unknown>
    expect(progressBlock).toBeDefined()
    // POSITIVE discriminator — the picker chose the terminal tier and the
    // wire carried it. This is the load-bearing failing-first assertion.
    expect(progressBlock.focusNode).toBe('simple-sentences')

    // Inspect the on-disk canon payload directly.
    const { parsed: canon } = readSimpleSentencesCanon()
    expect(canon.ok).toBe(true)
    expect(canon.kind).toBe('session-start')

    const slots = problemSlots(canon)
    // 8 problems per session — count-based assertion.
    expect(slots.size).toBe(8)

    // SILENT-DEMOTE GUARD (positive, count-based): every read line carries
    // exactly one `___` cloze gap. Compute the per-problem gap counts and
    // assert the whole array is [1,1,1,1,1,1,1,1] so a single bad problem
    // names itself in the failure. A blending-cv stub read carries 0.
    const gapCounts = [...slots.keys()]
      .sort((a, b) => a - b)
      .map((n) => gapTokenCount(slots.get(n)!.read))
    expect(gapCounts).toEqual([1, 1, 1, 1, 1, 1, 1, 1])

    // Every gap-target word is in Dave's verified pool. Compute the
    // off-pool intersection explicitly so the failure names exactly which
    // words leaked (a blending-cv stub's correct slot ALSO names CVC words
    // that happen to be in-pool — which is WHY the `___` gap count above is
    // the load-bearing demote guard, and this is the secondary check).
    const targetWords = [...slots.values()].map((s) => s.correctWord)
    const offPoolWords = targetWords.filter(
      (w) => !SIMPLE_SENTENCES_POOL.has(w),
    )
    expect(offPoolWords).toEqual([])
  })

  /**
   * TEST 2 — MAKEABLE-GREEN proof against a hand-mocked plan.
   *
   * CLASSIFICATION: Trivially-green counter-test on base for the
   * request-body half, but it serves a REAL simple-sentences plan shape
   * (not `failNetwork`), so it proves the positive discriminators in
   * test 1 are CREDIBLY makeable-green the moment a real plan is served —
   * independent of whether the on-disk canon file exists yet
   * (`feedback_failing_first_must_prove_green`). It does NOT read the
   * on-disk canon, so it runs (and passes) on pre-merge main, confirming
   * the assertion lever is satisfiable, not structurally impossible.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit.
   */
  test('2. MAKEABLE-GREEN: a served simple-sentences plan yields focusNode=simple-sentences on the wire, 8 single-gap clozes, in-pool targets (hand-mocked, no on-disk dependency)', async ({
    page,
  }) => {
    const handMock = handMockedSimpleSentencesPlan()
    const { requests } = await installSimpleSentencesClaudeMock(
      page,
      JSON.stringify(handMock),
    )
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()
    await expect(page.getByTestId('word-song')).toBeVisible({
      timeout: 15_000,
    })

    expect(requests).toHaveLength(1)
    const body = JSON.parse(requests[0]!.postData() ?? '{}') as Record<
      string,
      unknown
    >
    const payload = body.payload as Record<string, unknown>
    const progressBlock = payload.progress as Record<string, unknown>
    // Same positive discriminator as test 1 — green against a real plan.
    expect(progressBlock.focusNode).toBe('simple-sentences')

    // The served plan's 8 problems are single-gap clozes with in-pool
    // targets — the demote guard + membership assertion are satisfiable
    // against a real plan (test 1's GREEN path).
    const slots = problemSlots(handMock)
    expect(slots.size).toBe(8)
    const gapCounts = [...slots.keys()]
      .sort((a, b) => a - b)
      .map((n) => gapTokenCount(slots.get(n)!.read))
    expect(gapCounts).toEqual([1, 1, 1, 1, 1, 1, 1, 1])
    const offPoolWords = [...slots.values()]
      .map((s) => s.correctWord)
      .filter((w) => !SIMPLE_SENTENCES_POOL.has(w))
    expect(offPoolWords).toEqual([])
  })

  /**
   * TEST 3 — RENDER mechanic: sentence-completion panel + written-word
   * chips, NO picture card.
   *
   * CLASSIFICATION: RED-on-base lever. On `main` a simple-sentences
   * session runs the `blending-cv` stub, which renders a
   * `word-song-word-picture` picture card and `<WordPicture>` SVG chips —
   * exactly the mechanic Dave's research rules OUT — and renders NO
   * `word-song-sentence-panel`. So the assertions below FAIL on base for
   * the right reason. Devon's W13-04 render PR adds the simple-sentence
   * content-type branch (sentence panel with a styled blank, written-word
   * text chips, no picture card) → GREEN.
   *
   * Asserts the sentence-completion mechanic Kyle specified (W13-02 §3 ACs):
   *   - SILENT-DEMOTE GUARD A: NO picture card (`word-song-word-picture`
   *     count = 0). The CVC/blending-cv stub always renders exactly one;
   *     the sentence-completion mechanic renders zero.
   *   - The sentence panel (`word-song-sentence-panel`) is PRESENT with a
   *     styled blank gap (`word-song-sentence-gap`) — the net-new
   *     reading surface.
   *   - Each chip presents the WRITTEN word as visible text (no picture
   *     SVG). 3 chips per problem; exactly one correct, drawn from pool.
   *
   * Chromium-only — depends on the read-aloud effect firing to enable
   * chips. Does NOT call `forceHowlerUnlock` (serves real canon MP3 bytes;
   * the stubbed ctx would break decode → silent demote, testing-and-ci.md
   * §4.1.2). The real gesture-unlock chain + the `data-read-aloud-played`
   * gate is the correct mechanism — mirrors `sight-words-content.spec.ts`
   * test 3.
   */
  test('3. RENDER: simple-sentences shows a sentence panel + styled gap + written-word chips with NO picture card (sentence-completion mechanic)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // Single-session walk (~30-50s on the silent caption-walk fallback)
    // + setup. The default 90s budget is adequate for one session; give
    // comfortable headroom on slow CI runners.
    test.setTimeout(120_000)

    // Read the on-disk canon EAGERLY — throws ENOENT on pre-merge main,
    // the failing-first RED signal (pre-navigation, clean message).
    await installSimpleSentencesClaudeMock(page, readSimpleSentencesCanon().raw)
    await page.goto('/')
    // Do NOT call forceHowlerUnlock — see header / testing-and-ci.md
    // §4.1.2 silent-demote caveat.
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    const allChipWords: string[] = []
    const allTargetWords: string[] = []

    for (let i = 0; i < 8; i++) {
      await expect(wordSong).toHaveAttribute('data-problem-index', String(i), {
        timeout: 20_000,
      })
      await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
        timeout: 20_000,
      })

      // SILENT-DEMOTE GUARD A — NO picture card for the target. The
      // blending-cv stub (base) renders exactly one; the
      // sentence-completion mechanic renders zero.
      await expect(page.getByTestId('word-song-word-picture')).toHaveCount(0)

      // MECHANIC ASSERTION — the sentence panel + styled gap are present.
      // This is the net-new reading surface (Kyle §3.2). The blending-cv
      // stub renders neither.
      await expect(page.getByTestId('word-song-sentence-panel')).toHaveCount(1)
      await expect(page.getByTestId('word-song-sentence-gap')).toHaveCount(1)

      const chips = page.getByTestId('word-song-chip')
      await expect(chips).toHaveCount(3)

      // Each chip presents the WRITTEN word as visible text. Read each
      // chip's `data-word` and its rendered text content; the text must
      // contain the word (membership-in-set exception per count-assertion
      // rules — the chip text IS the contract). On base, the chip renders
      // a picture SVG with no text node → `innerText` empty → this fails
      // for the right reason.
      const chipData = await chips.evaluateAll((nodes) =>
        nodes.map((n) => ({
          word: (n as HTMLElement).getAttribute('data-word'),
          text: ((n as HTMLElement).innerText || '').trim().toLowerCase(),
          correct: (n as HTMLElement).getAttribute('data-correct') === 'true',
        })),
      )
      expect(chipData).toHaveLength(3)
      for (const { word, text, correct } of chipData) {
        expect(word).not.toBeNull()
        const w = (word as string).toLowerCase()
        allChipWords.push(w)
        if (correct) allTargetWords.push(w)
        // The written word is visible as chip text.
        expect(text).toContain(w)
      }

      const correctChip = page.locator(
        '[data-testid="word-song-chip"][data-correct="true"]',
      )
      await expect(correctChip).toHaveCount(1)
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      const correctWord = (
        await correctChip.getAttribute('data-word')
      )?.toLowerCase()
      expect(correctWord).toBeDefined()
      // The correct chip's word is a simple-sentences-pool TARGET.
      expect(SIMPLE_SENTENCES_POOL.has(correctWord!)).toBe(true)

      await correctChip.click()
    }

    // Count-based assertions: 24 chip renders (3 × 8), 8 targets.
    expect(allChipWords).toHaveLength(24)
    expect(allTargetWords).toHaveLength(8)

    // Every target word is in the simple-sentences pool.
    const offPoolTargets = allTargetWords.filter(
      (w) => !SIMPLE_SENTENCES_POOL.has(w),
    )
    expect(offPoolTargets).toEqual([])

    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })
  })
})
