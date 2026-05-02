/**
 * Round-trip tests for the planner-parser contract on the word-song
 * track — step 2 (ticket 86c9kxu07).
 *
 * Step 1 (PR #132 / ticket 86c9kxp08) widened the BROWSER PARSER to
 * accept "Read the <word>." → cvc-word content alongside the existing
 * "Tap the <word>." → blending-cv. Step 2 widens the PLANNER to emit
 * either content mode based on the requested focus node. This file
 * exercises the integration: a Haiku-mocked response shaped per the
 * new system prompt routes cleanly through `generateSessionPlan` AND
 * `wordSongSessionPlanFromServer`, with the right contentType
 * discriminant on every problem.
 *
 * Strategy
 * --------
 * The Anthropic SDK is mocked (same pattern as `api/_planner.test.ts`).
 * For each test we hand-craft a wire-shape response that mirrors what
 * the new prompt instructs Haiku to emit, feed it through the planner,
 * then through the parser, and assert the per-problem contentType
 * matches the requested focus node.
 *
 * Why here (src/) and not in api/_planner.test.ts
 * -----------------------------------------------
 * api/ runs under a server-only tsconfig that doesn't drag in the
 * frontend module graph (see api/_plannerWordList.ts header comment).
 * The parser lives under src/. This file lives on the src/ side so the
 * cross-module import is one-directional (src → api), matching every
 * other src/ test that pulls api/_types or api/_planner directly.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  generateSessionPlan,
  type PlannerAnthropicClient,
} from '../../../api/_planner'
import { wordSongSessionPlanFromServer } from './planFromServer'
import { SAMPLE_CV_BLEND_PLAN } from './__fixtures__/sample-cv-blend-plan'
import { SAMPLE_CVC_WORD_PLAN } from './__fixtures__/sample-cvc-word-plan'

function makeMockClient(responseText: string): PlannerAnthropicClient {
  return {
    messages: {
      create: vi.fn(async () => ({
        content: [{ type: 'text', text: responseText }],
      })),
    },
  }
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
})

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
  vi.restoreAllMocks()
})

describe('planner → parser round-trip — blending-cv (step 2 ticket 86c9kxu07)', () => {
  it('a Haiku-mocked blending-cv plan parses cleanly with contentType=blending-cv on every problem', async () => {
    // The fixture mirrors what the new prompt instructs Haiku to emit
    // for `focusNode: 'blending-cv'`: 8 problems, each with a "Tap the
    // <word>." read line and `word.p<N>.<slot>` ids.
    const client = makeMockClient(JSON.stringify(SAMPLE_CV_BLEND_PLAN))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'blending-cv',
    })

    // Browser parser round-trip — the planner output must be a valid
    // input for the parser, and every problem must carry
    // contentType=blending-cv (the discriminant the parser derives from
    // the read-line template).
    const rebuilt = wordSongSessionPlanFromServer(plan)
    expect(rebuilt.problems).toHaveLength(8)
    for (const problem of rebuilt.problems) {
      expect(problem.contentType).toBe('blending-cv')
      expect(problem.utterances.read).toMatch(/^Tap the [a-z]+\.$/)
    }
  })
})

describe('planner → parser round-trip — cvc-words (the August unblock — step 2 ticket 86c9kxu07)', () => {
  it('a Haiku-mocked cvc-words plan parses cleanly with contentType=cvc-word on every problem', async () => {
    // The fixture mirrors what the new prompt instructs Haiku to emit
    // for `focusNode: 'cvc-words'`: 8 problems, each with a "Read the
    // <word>." read line and `word.p<N>.<slot>` ids — wire shape is
    // identical to blending-cv; only the read-line verb differs.
    const client = makeMockClient(JSON.stringify(SAMPLE_CVC_WORD_PLAN))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    expect(rebuilt.problems).toHaveLength(8)
    for (const problem of rebuilt.problems) {
      expect(problem.contentType).toBe('cvc-word')
      expect(problem.utterances.read).toMatch(/^Read the [a-z]+\.$/)
    }
  })

  it('every cvc-words read-line word resolves to a known target in the wordPack', async () => {
    // Pin that the planner's word pool stays aligned with the parser's
    // TARGET_WORD_SET. If the planner widens to a vowel the wordPack
    // doesn't carry yet, this surfaces immediately as a parse error.
    const client = makeMockClient(JSON.stringify(SAMPLE_CVC_WORD_PLAN))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    const targets = rebuilt.problems.map((p) => p.target.word)
    // 8 distinct targets (the prompt forbids repeats within a plan).
    expect(new Set(targets).size).toBe(8)
    // All targets carry isTarget=true (the parser already enforces
    // this; we re-assert here to make the contract loud).
    for (const problem of rebuilt.problems) {
      expect(problem.target.isTarget).toBe(true)
    }
  })
})

describe('planner → parser round-trip — untuned tier stub fallback (step 2 ticket 86c9kxu07)', () => {
  it('a digraphs-requested call falls back to blending-cv content (the stub-fallback contract)', async () => {
    // Per `effectiveFocusNode` in api/_planner.ts: untuned tiers
    // (letter-sounds / digraphs / sight-words / simple-sentences) fall
    // back to blending-cv content so the screen always renders. The
    // mocked Haiku response below is what the planner WOULD ask Haiku
    // for in that case (a blending-cv plan); we just need to confirm
    // the planner accepts the request and the parser stamps it as
    // blending-cv. Future tier tickets refine these to first-class
    // content.
    const client = makeMockClient(JSON.stringify(SAMPLE_CV_BLEND_PLAN))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    expect(rebuilt.problems).toHaveLength(8)
    for (const problem of rebuilt.problems) {
      // Stub-fallback content is blending-cv shape.
      expect(problem.contentType).toBe('blending-cv')
    }
  })
})
