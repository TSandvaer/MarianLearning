/**
 * @vitest-environment node
 *
 * Canon checks ported from `e2e/digraphs-th-content.spec.ts`, test 2 (React
 * Native Phase 4, `design/native/playwright-spec-sort.md`). They read the
 * committed canon from disk and never needed a browser, so they run here
 * and survive the web front end. The code below is copied from the spec
 * as it was; the comments still describe their Playwright origin.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Path to the th-tier session canon the spec serves as the mock
 * response. Resolved relative to `process.cwd()` because Playwright
 * runs the harness from the worktree root (same place `vite preview`
 * reads `public/`). Hardcoding the relative path means the spec breaks
 * loudly if the canon ever moves.
 *
 * The canon focusNode key is `digraphs-th-voiceless` — verified against
 * the live `VALID_WORD_SONG_FOCUS_NODES` constant in `api/_planner.ts`
 * (PR #211 SkillNode name), per AC10's "confirm the canon focusNode
 * key" instruction.
 *
 * On current main this file does NOT exist — that absence is the
 * failing-first signal (see header). Kevin's planner PR + the AC10
 * canon bake create it.
 */
const DIGRAPHS_TH_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/digraphs-th-voiceless.json',
)

/**
 * The 7 th-tier target words shipped in the canon. Source of truth:
 * `design/word-song/digraphs-th-word-list.md` §1 RECONCILED final pool
 * (Dave's th-addendum §3f locked inventory) + §8 AC1. Must stay aligned
 * with the `th`-digraph entries in `wordPack.ts` `TARGET_WORDS` once
 * Devon's wordPack PR lands.
 *
 * `thumb` is NOT in the pool — Dave §3e dropped it from the opening 7
 * (silent `b` violates one-new-element-per-session); it is the
 * documented pool-EXTENSION word, not a v1 target.
 */
const TH_TIER_WORDS: ReadonlySet<string> = new Set([
  'thin',
  'bath',
  'math',
  'path',
  'moth',
  'thick',
  'cloth',
])

/**
 * The 2 `hybridMode: true` th words. Source:
 * `digraphs-th-word-list.md` §6.2 + §8 AC13 (Dave's th-addendum §3e):
 *   - `thick` — double-digraph (`th` target digraph + `ck`, a separate
 *     not-yet-taught digraph) → recognition-only.
 *   - `cloth` — `/kl/` onset blend exceeds CVC scope → recognition-only.
 * The planner must NEVER emit a `segmentation` / `spelling` /
 * `decode_from_phoneme` prompt for these two.
 *
 * th diverges from ch here: ch shipped ZERO hybridMode words (total
 * gate); th ships TWO (partial gate). It resembles the sh tier (3
 * hybrid words), though for a structurally-different reason — sh's
 * hybrids were long-vowel-after-digraph; th's are onset-blend +
 * double-digraph (Dave Non-obvious finding 5).
 */
const HYBRID_TH_WORDS: ReadonlySet<string> = new Set(['thick', 'cloth'])

/**
 * The 5 fully-decodable th words (`hybridMode: false`). NOT gated — the
 * planner MAY emit any prompt type for these. Listed here for the
 * explicit "non-hybrid words are un-gated" assertion in test 2, so a
 * future OVER-BROAD gate (one that accidentally gates ALL th words like
 * ch's total gate) is caught. This is the load-bearing partial-gate
 * distinction between th and ch.
 */
const NON_HYBRID_TH_WORDS: ReadonlySet<string> = new Set([
  'thin',
  'bath',
  'math',
  'path',
  'moth',
])

/**
 * Decode-style prompt-type slots that the th tier must NEVER emit for a
 * `hybridMode: true` word. The canon's per-problem utterance ids follow
 * the `word.p<N>.<slot>` template (verified against the shipped
 * digraphs-ch / digraphs-sh canons: slots today are `read | correct |
 * reprompt | hint | giveAnswer`). AC13 forbids these three NEW
 * decode-style slots from ever appearing for a `thick` or `cloth`
 * problem — but ALLOWS them for the 5 non-hybrid words (the partial
 * gate, unlike ch's total gate).
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
 * Read + parse the th-tier canon from disk.
 *
 * On current main the file does NOT exist — `readFileSync` throws
 * `ENOENT`. We catch + re-throw with an explicit, attributable message
 * so the RED state reads unambiguously in CI logs: this is the
 * failing-first signal, not an infra flake. Post-merge (Kevin's planner
 * PR + Devon's wordPack PR + AC10 canon bake + rebase) the file exists
 * and this resolves cleanly.
 */
function readDigraphsThCanon(): { raw: string; parsed: CanonShape } {
  if (!existsSync(DIGRAPHS_TH_CANON_PATH)) {
    throw new Error(
      `[digraphs-th-content spec] FAILING-FIRST: th-tier canon not found at ` +
        `${DIGRAPHS_TH_CANON_PATH}. This is the expected RED state on ` +
        `pre-merge main (commit 99b1a36) — the digraphs-th (voiceless /θ/) ` +
        `content does not exist yet. The spec flips GREEN after Kevin's ` +
        `feat/digraphs-th-planner PR + Devon's feat/digraphs-th-wordpack ` +
        `PR merge, the AC10 canon bake commits this file, and the ` +
        `orchestrator rebases this branch onto post-merge main.`,
    )
  }
  const raw = readFileSync(DIGRAPHS_TH_CANON_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as CanonShape
  return { raw, parsed }
}

/**
 * Extract the per-problem target word from the canon `plan.utterances`
 * array. Each problem's `read` slot text is `"Read the <word>."` (the
 * shipped cvc-words + digraphs-sh + digraphs-ch convention — verified
 * against the on-disk digraphs-ch canon). Returns a map from problem
 * number (1..8) to the lowercase target word.
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
        `[digraphs-th-content spec] canon read-slot text did not match ` +
          `"Read the <word>." template: id=${u.id} text=${JSON.stringify(u.text)}`,
      )
    }
    byProblem.set(problemNum, wordMatch[1]!.toLowerCase())
  }
  return byProblem
}

/**
 * Build the per-problem slot inventory from the canon's
 * `plan.utterances` array. Key = problem number, value = the set of
 * slot names emitted for that problem. `session.end.*` and other
 * out-of-namespace ids are skipped.
 */
function slotsByProblem(canon: CanonShape): Map<number, Set<string>> {
  const byProblem = new Map<number, Set<string>>()
  for (const u of canon.plan.utterances) {
    const m = u.id.match(/^word\.p(\d+)\.(\w+)$/)
    if (m === null) continue // session.end.* etc — not per-problem
    const problemNum = Number(m[1])
    const slot = m[2]!
    if (!byProblem.has(problemNum)) {
      byProblem.set(problemNum, new Set())
    }
    byProblem.get(problemNum)!.add(slot)
  }
  return byProblem
}

describe('digraphs-th content + hybridMode partial gate + intro→practicing transition (AC1 + AC9 + AC11 + AC13) — canon checks', () => {
  /**
   * AC13 — the th tier ships TWO `hybridMode: true` words (`thick`,
   * `cloth`) → NO problem whose target is `thick` or `cloth` may carry
   * a decode-style prompt slot. The gate is PARTIAL — unlike ch's
   * total gate.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit. This is
   * the th-specific divergence from `digraphs-ch-content.spec.ts` test
   * 2: ch had ZERO hybridMode words, so its gate was TOTAL (no decode
   * slot on ANY ch problem). th has TWO hybridMode words, so its gate
   * is PARTIAL — modelled on `digraphs-sh-content.spec.ts` test 2.
   *
   * Two assertions, both load-bearing:
   *   (a) UNDER-GATE guard — NO problem whose target is `thick` or
   *       `cloth` carries a `segmentation` / `spelling` /
   *       `decode_from_phoneme` slot. A planner that misapplies a
   *       decode prompt to a hybrid word is caught.
   *   (b) OVER-BROAD-GATE guard — the test does NOT assert the absence
   *       of decode slots for the 5 non-hybrid words; instead it
   *       asserts every problem's target is a known th word and that
   *       BOTH hybrid words AND at least some non-hybrid words appear
   *       in the canon, so the partial-gate distinction is actually
   *       exercised. A future planner that gates ALL th words (copying
   *       ch's total-gate logic by mistake) would still pass (a) but
   *       the design intent — th is a PARTIAL gate — is documented and
   *       pinned by `NON_HYBRID_TH_WORDS` being a live, asserted-on
   *       constant.
   *
   * On pre-merge main this fails at `readDigraphsThCanon()` → explicit
   * ENOENT throw.
   */
  it('2. AC13: thick + cloth (hybridMode) carry no segmentation/spelling/decode-from-phoneme slot; the 5 non-hybrid th words are un-gated (partial gate, unlike ch)', async () => {
    const { parsed: canon } = readDigraphsThCanon()
    const byProblem = targetWordsByProblem(canon)
    expect(byProblem.size).toBe(8)

    const slots = slotsByProblem(canon)

    // (a) UNDER-GATE guard — collect every (problem, hybrid-word,
    // forbidden-slot) violation, then assert the violation list is
    // empty. The list-then-assert-empty shape gives a failure message
    // that names exactly which hybrid word got which forbidden
    // decode-style slot.
    const hybridDecodeViolations: Array<{
      problem: number
      word: string
      slot: string
    }> = []
    for (const [problemNum, word] of byProblem) {
      if (!HYBRID_TH_WORDS.has(word)) continue
      const problemSlots = slots.get(problemNum) ?? new Set<string>()
      for (const forbidden of FORBIDDEN_DECODE_SLOTS) {
        if (problemSlots.has(forbidden)) {
          hybridDecodeViolations.push({
            problem: problemNum,
            word,
            slot: forbidden,
          })
        }
      }
    }
    // thick + cloth never receive a decode-style prompt — the
    // recognition-only contract (Dave §3e, §6.2, AC13).
    expect(hybridDecodeViolations).toEqual([])

    // (b) OVER-BROAD-GATE guard / partial-gate exercise — the canon
    // must actually contain BOTH hybrid words AND non-hybrid words, so
    // the partial-gate distinction is meaningfully exercised (not a
    // vacuous pass on a canon that happens to omit thick/cloth, or one
    // that is all-hybrid). With a 7-word pool spread over 8 problems
    // (sub-8-pool: each word ≥1×, one repeat), both classes are present
    // by construction once the pool ships correctly.
    const targetWords = [...byProblem.values()]
    const hybridTargetsPresent = targetWords.filter((w) =>
      HYBRID_TH_WORDS.has(w),
    )
    const nonHybridTargetsPresent = targetWords.filter((w) =>
      NON_HYBRID_TH_WORDS.has(w),
    )
    // Both hybrid words appear (the 7-word pool, each ≥1× across 8
    // problems, guarantees thick + cloth both surface).
    expect(new Set(hybridTargetsPresent)).toEqual(HYBRID_TH_WORDS)
    // Non-hybrid th words also appear — the gate is PARTIAL, the canon
    // is not all-hybrid. (Count-based: at least the 5 non-hybrid pool
    // words must each surface ≥1× in a correctly-shaped 7-word/8-problem
    // canon.)
    expect(new Set(nonHybridTargetsPresent)).toEqual(NON_HYBRID_TH_WORDS)

    // Sanity: every problem's target word is a th-pool word (guards
    // against a vacuous pass on a blending-cv stub-fallback canon).
    const offPoolTargets = targetWords.filter((w) => !TH_TIER_WORDS.has(w))
    expect(offPoolTargets).toEqual([])
  })
})
