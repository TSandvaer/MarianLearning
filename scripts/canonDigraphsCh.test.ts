/**
 * @vitest-environment node
 *
 * Canon checks ported from `e2e/digraphs-ch-content.spec.ts`, test 2 (React
 * Native Phase 4, `design/native/playwright-spec-sort.md`). They read the
 * committed canon from disk and never needed a browser, so they run here
 * and survive the web front end. The code below is copied from the spec
 * as it was; the comments still describe their Playwright origin.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Path to the ch-tier session canon the spec serves as the mock
 * response. Resolved relative to `process.cwd()` because Playwright
 * runs the harness from the worktree root (same place `vite preview`
 * reads `public/`). Hardcoding the relative path means the spec breaks
 * loudly if the canon ever moves.
 *
 * On current main this file does NOT exist — that absence is the
 * failing-first signal (see header). Kevin's planner PR + the AC10
 * canon bake create it.
 */
const DIGRAPHS_CH_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/digraphs-ch.json',
)

/**
 * The 7 ch-tier target words shipped in the canon. Source of truth:
 * `design/word-song/digraphs-ch-word-list.md` §1 final pool (Dave's
 * §3c locked inventory) + §8 AC1. Must stay aligned with the `ch`-onset
 * entries in `wordPack.ts` `TARGET_WORDS` once Devon's wordPack PR
 * lands.
 */
const CH_TIER_WORDS: ReadonlySet<string> = new Set([
  'chin',
  'chip',
  'chop',
  'chat',
  'chest',
  'chug',
  'chick',
])

/**
 * Decode-style prompt-type slots that the ch tier must NEVER emit. The
 * sh tier gated these THREE slots for its 3 `hybridMode: true` words
 * (`shoe`, `sheep`, `shark`). The ch tier has ZERO `hybridMode` words
 * (`digraphs-ch-word-list.md` §6.1 + §8 AC12 — Dave's addendum §3d /
 * non-obvious finding #1), so the gate is TOTAL for ch: no problem in
 * the ch canon may carry any of these slots. A regression that emitted
 * a decode-style prompt for any ch word is caught by test 2.
 *
 * The canon's per-problem utterance ids follow the `word.p<N>.<slot>`
 * template (verified against the shipped digraphs-sh canon: slots today
 * are `read | correct | reprompt | hint | giveAnswer`).
 */
const FORBIDDEN_DECODE_SLOTS: ReadonlyArray<string> = [
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
 * Read + parse the ch-tier canon from disk.
 *
 * On current main the file does NOT exist — `readFileSync` throws
 * `ENOENT`. We catch + re-throw with an explicit, attributable message
 * so the RED state reads unambiguously in CI logs: this is the
 * failing-first signal, not an infra flake. Post-merge (Kevin's
 * planner PR + Devon's wordPack PR + AC10 canon bake + rebase) the file
 * exists and this resolves cleanly.
 */
function readDigraphsChCanon(): { raw: string; parsed: CanonShape } {
  if (!existsSync(DIGRAPHS_CH_CANON_PATH)) {
    throw new Error(
      `[digraphs-ch-content spec] FAILING-FIRST: ch-tier canon not found at ` +
        `${DIGRAPHS_CH_CANON_PATH}. This is the expected RED state on ` +
        `pre-merge main (commit 8e04a10) — the ch content does not exist ` +
        `yet. The spec flips GREEN after Kevin's feat/digraphs-ch-planner ` +
        `PR + Devon's feat/digraphs-ch-wordpack PR merge, the AC10 canon ` +
        `bake commits this file, and the orchestrator rebases this branch ` +
        `onto post-merge main.`,
    )
  }
  const raw = readFileSync(DIGRAPHS_CH_CANON_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as CanonShape
  return { raw, parsed }
}

/**
 * Extract the per-problem target word from the canon `plan.utterances`
 * array. Each problem's `read` slot text is `"Read the <word>."` (the
 * shipped cvc-words + digraphs-sh convention — verified against the
 * on-disk digraphs-sh canon). Returns a map from problem number (1..8)
 * to the lowercase target word.
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
        `[digraphs-ch-content spec] canon read-slot text did not match ` +
          `"Read the <word>." template: id=${u.id} text=${JSON.stringify(u.text)}`,
      )
    }
    byProblem.set(problemNum, wordMatch[1]!.toLowerCase())
  }
  return byProblem
}

describe('digraphs-ch content + intro→practicing transition (AC1 + AC9 + AC11 + AC12) — canon checks', () => {
  /**
   * AC12 — the ch tier has ZERO `hybridMode` words → NO problem in the
   * ch canon may carry a decode-style prompt slot.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit. The sh
   * tier gated `segmentation` / `spelling` / `decode_from_phoneme`
   * slots for its 3 `hybridMode: true` words only; the 4 non-hybrid sh
   * words were un-gated. The ch tier has ZERO `hybridMode` words
   * (`digraphs-ch-word-list.md` §6.1, §8 AC12 — Dave's addendum §3d /
   * non-obvious finding #1: "the ch tier sets `hybridMode: true` on
   * ZERO entries"). So the gate is TOTAL for ch: this test asserts NO
   * problem — for any of the 7 ch words — carries any forbidden
   * decode-style slot. A regression where Kevin's planner emitted a
   * decode-style prompt for a ch word (e.g. by misapplying the sh
   * tier's hybridMode planner logic to ch) is caught here.
   *
   * On pre-merge main this fails at `readDigraphsChCanon()` → explicit
   * ENOENT throw.
   */
  it('2. AC12: zero hybridMode words → no segmentation/spelling/decode-from-phoneme slot on any ch-tier problem', async () => {
    const { parsed: canon } = readDigraphsChCanon()
    const byProblem = targetWordsByProblem(canon)
    expect(byProblem.size).toBe(8)

    // Build the per-problem slot inventory from the canon's
    // `plan.utterances` array. Key = problem number, value = the set of
    // slot names emitted for that problem.
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
    // exactly which ch word got which forbidden decode-style slot.
    const decodeSlotViolations: Array<{
      problem: number
      word: string
      slot: string
    }> = []
    for (const [problemNum, word] of byProblem) {
      const slots = slotsByProblem.get(problemNum) ?? new Set<string>()
      for (const forbidden of FORBIDDEN_DECODE_SLOTS) {
        if (slots.has(forbidden)) {
          decodeSlotViolations.push({
            problem: problemNum,
            word,
            slot: forbidden,
          })
        }
      }
    }

    // The ch tier is hybridMode-free: zero decode-style slots on ANY
    // problem. Total gate — unlike sh, there is no un-gated subset.
    expect(decodeSlotViolations).toEqual([])

    // Sanity: the test actually exercised all 8 problems against ch
    // words (guards against a vacuous pass on an empty/malformed
    // canon). Every problem's target word is a ch-pool word.
    const offPoolTargets = [...byProblem.values()].filter(
      (w) => !CH_TIER_WORDS.has(w),
    )
    expect(offPoolTargets).toEqual([])
  })
})
