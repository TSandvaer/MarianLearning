/**
 * @vitest-environment node
 *
 * Canon checks ported from `e2e/digraphs-sh-content.spec.ts`, test 2 (React
 * Native Phase 4, `design/native/playwright-spec-sort.md`). They read the
 * committed canon from disk and never needed a browser, so they run here
 * and survive the web front end. The code below is copied from the spec
 * as it was; the comments still describe their Playwright origin.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Path to the sh-tier session canon the spec serves as the mock
 * response. Resolved relative to `process.cwd()` because Playwright
 * runs the harness from the worktree root (same place `vite preview`
 * reads `public/`). Hardcoding the relative path means the spec breaks
 * loudly if the canon ever moves.
 *
 * On current main this file does NOT exist — that absence is the
 * failing-first signal (see header). Kevin's planner PR + the AC10
 * canon bake create it.
 */
const DIGRAPHS_SH_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/digraphs-sh.json',
)

/**
 * The 3 `hybridMode: true` long-vowel sh words. Per
 * `digraphs-sh-word-list.md` §6.1 + §8 AC12: these are
 * "sight-word-hybrid" — Marian pattern-matches against Emma's audio +
 * the picture rather than fully decoding the long-vowel rest-of-word.
 * The planner must NEVER emit a segmentation / spelling /
 * decode-from-phoneme prompt for them.
 */
const HYBRID_WORDS: ReadonlySet<string> = new Set(['shoe', 'sheep', 'shark'])

/**
 * The 4 conventional decodable sh words (`hybridMode: false`). NOT
 * gated — the planner MAY emit any prompt type for these. Listed here
 * for the explicit "non-hybrid words are un-gated" assertion in test 2,
 * so a future over-broad gate (one that accidentally gates ALL sh
 * words) is caught.
 */
const NON_HYBRID_SH_WORDS: ReadonlySet<string> = new Set([
  'ship',
  'shell',
  'shed',
  'shop',
])

/**
 * Decode-style prompt-type slots that AC12 forbids for `hybridMode`
 * words. The canon's per-problem utterance ids follow the
 * `word.p<N>.<slot>` template (verified against the shipped cvc-words
 * canon: slots today are `read | correct | reprompt | hint |
 * giveAnswer`). AC12 forbids these three NEW decode-style slots from
 * ever appearing for a hybrid-word problem. If Kevin's planner
 * introduces them for non-hybrid words, that is allowed; for hybrid
 * words it is not.
 */
const FORBIDDEN_HYBRID_SLOTS: ReadonlyArray<string> = [
  'segmentation',
  'spelling',
  'decode_from_phoneme',
]

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
 * Read + parse the sh-tier canon from disk.
 *
 * On current main the file does NOT exist — `readFileSync` throws
 * `ENOENT`. We catch + re-throw with an explicit, attributable message
 * so the RED state reads unambiguously in CI logs: this is the
 * failing-first signal, not an infra flake. Post-merge (Kevin's
 * planner PR + AC10 canon bake) the file exists and this resolves
 * cleanly.
 */
function readDigraphsShCanon(): { raw: string; parsed: CanonShape } {
  if (!existsSync(DIGRAPHS_SH_CANON_PATH)) {
    throw new Error(
      `[digraphs-sh-content spec] FAILING-FIRST: sh-tier canon not found at ` +
        `${DIGRAPHS_SH_CANON_PATH}. This is the expected RED state on ` +
        `pre-merge main — the sh content does not exist yet. The spec ` +
        `flips GREEN when Kevin's feat/digraphs-sh-content-planner PR + ` +
        `Devon's feat/digraphs-sh-wordpack PR merge and the AC10 canon ` +
        `bake commits this file.`,
    )
  }
  const raw = readFileSync(DIGRAPHS_SH_CANON_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as CanonShape
  return { raw, parsed }
}

/**
 * Extract the per-problem target word from the canon `plan.utterances`
 * array. Each problem's `read` slot text is `"Read the <word>."` (the
 * shipped cvc-words convention — verified against the on-disk
 * cvc-words-short-i canon). Returns a map from problem number (1..8) to
 * the lowercase target word.
 */
function targetWordsByProblem(canon: CanonShape): Map<number, string> {
  const byProblem = new Map<number, string>()
  for (const u of canon.plan.utterances) {
    const m = u.id.match(/^word\.p(\d+)\.read$/)
    if (m === null) continue
    const problemNum = Number(m[1])
    const wordMatch = u.text.match(/^Read the (\w+)\.$/)
    if (wordMatch === null) {
      throw new Error(
        `[digraphs-sh-content spec] canon read-slot text did not match ` +
          `"Read the <word>." template: id=${u.id} text=${JSON.stringify(u.text)}`,
      )
    }
    byProblem.set(problemNum, wordMatch[1]!.toLowerCase())
  }
  return byProblem
}

describe('digraphs-sh content + hybridMode gate (AC11 + AC12) — canon checks', () => {
  /**
   * AC12 — `hybridMode: true` words never receive decode-style prompts.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit. For every
   * problem in the sh-tier canon whose target word is a `hybridMode`
   * word (`shoe`, `sheep`, `shark`), asserts NO utterance for that
   * problem carries a `segmentation` / `spelling` /
   * `decode_from_phoneme` slot. The 4 non-hybrid sh words
   * (`ship, shell, shed, shop`) are explicitly NOT gated — the test
   * asserts the canon's hybrid-word gate is the ONLY gate (a
   * regression that gated ALL sh words would be caught by the
   * non-hybrid un-gated check).
   *
   * On pre-merge main this fails at `readDigraphsShCanon()` → explicit
   * ENOENT throw.
   */
  it('2. AC12: no segmentation/spelling/decode-from-phoneme utterance for any hybridMode word (shoe/sheep/shark); non-hybrid sh words are un-gated', async () => {
    const { parsed: canon } = readDigraphsShCanon()
    const byProblem = targetWordsByProblem(canon)
    expect(byProblem.size).toBe(8)

    // Build the per-problem slot inventory from the canon's
    // `plan.utterances` array. Key = problem number, value = the set
    // of slot names emitted for that problem.
    const slotsByProblem = new Map<number, Set<string>>()
    for (const u of canon.plan.utterances) {
      const m = u.id.match(/^word\.p(\d+)\.(\w+)$/)
      if (m === null) continue // session.end.* etc — not per-problem
      const problemNum = Number(m[1])
      const slot = m[2]!
      if (!slotsByProblem.has(problemNum)) {
        slotsByProblem.set(problemNum, new Set())
      }
      slotsByProblem.get(problemNum)!.add(slot)
    }

    // Collect every (problem, word, forbidden-slot) violation across
    // all 8 problems, then assert the violation list is empty. The
    // list-then-assert-empty shape gives a failure message that names
    // exactly which hybrid word got which forbidden slot.
    const hybridViolations: Array<{
      problem: number
      word: string
      slot: string
    }> = []
    // Sanity counters — confirm the test actually exercised hybrid
    // AND non-hybrid words (guards against a canon that, e.g., shipped
    // zero hybrid words and passed vacuously).
    let hybridProblemCount = 0
    let nonHybridProblemCount = 0

    for (const [problemNum, word] of byProblem) {
      const slots = slotsByProblem.get(problemNum) ?? new Set<string>()
      if (HYBRID_WORDS.has(word)) {
        hybridProblemCount++
        for (const forbidden of FORBIDDEN_HYBRID_SLOTS) {
          if (slots.has(forbidden)) {
            hybridViolations.push({
              problem: problemNum,
              word,
              slot: forbidden,
            })
          }
        }
      } else if (NON_HYBRID_SH_WORDS.has(word)) {
        nonHybridProblemCount++
      }
    }

    // The gate is real: zero forbidden slots on any hybrid-word
    // problem.
    expect(hybridViolations).toEqual([])

    // The gate is not over-broad: the canon's 8-problem session
    // exercised at least one hybrid word AND at least one non-hybrid
    // sh word. Without this, a canon that shipped (e.g.) 8 non-hybrid
    // problems would pass `hybridViolations === []` vacuously. With 7
    // words in the pool and 8 distinct problems, the planner emits the
    // full pool + one repeat, so all 3 hybrids and all 4 non-hybrids
    // should appear — but assert the weaker ">= 1 each" so a future
    // planner pool-composition tweak doesn't false-fail this gate
    // test.
    expect(hybridProblemCount).toBeGreaterThanOrEqual(1)
    expect(nonHybridProblemCount).toBeGreaterThanOrEqual(1)
  })
})
