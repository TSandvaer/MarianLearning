/**
 * @vitest-environment node
 *
 * The planner prompt is learner-neutral (Thomas, 2026-10-19): the app is
 * multi-user, any learner of about 6-9, so no model-facing text may name
 * one child or one first language. The browser sends `childName: 'friend'`
 * (PR #622), so a prompt built for 'friend' must carry no learner name and
 * no language claim, on every planner path: both tracks, every focus node,
 * and every user-message directive (Leitner, slow facts, graduation,
 * letter-sounds vowel).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  generateSessionPlan,
  VALID_MATH_FOCUS_NODES,
  VALID_WORD_SONG_FOCUS_NODES,
  type GenerateSessionPlanArgs,
  type PlannerAnthropicClient,
} from './_planner.js'

const LEARNER_SPECIFIC = /marian|tagalog|filipino/i

interface CapturedRequest {
  system: { text: string }[]
  messages: { content: string }[]
}

/** Builds the prompts for one call and returns them as one string. The
 *  mock reply is not a plan, so the planner rejects it after the request
 *  is captured; only the request matters here. */
async function promptFor(
  args: Omit<GenerateSessionPlanArgs, 'client' | 'level' | 'childName'>,
): Promise<string> {
  let captured: CapturedRequest | undefined
  const client: PlannerAnthropicClient = {
    messages: {
      create: async (req: unknown) => {
        captured = req as CapturedRequest
        return { content: [{ type: 'text', text: '{}' }] }
      },
    },
  }
  await generateSessionPlan({
    ...args,
    client,
    level: 1,
    childName: 'friend',
  }).catch(() => undefined)
  if (!captured) throw new Error('planner made no request')
  return [
    ...captured.system.map((block) => block.text),
    ...captured.messages.map((message) => message.content),
  ].join('\n')
}

const leitner: GenerateSessionPlanArgs['leitner'] = [
  { a: 3, b: 7, op: '+', box: 1 },
]
const slowFacts: GenerateSessionPlanArgs['slowFacts'] = [
  {
    fact: { a: 6, b: 4, op: '+' },
    attempts: 6,
    correctRate: 1,
    medianLatencyMs: 6000,
  },
]

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
})

describe('planner prompt is learner-neutral', () => {
  it.each(VALID_MATH_FOCUS_NODES)('math, %s', async (focusNode) => {
    const prompt = await promptFor({
      track: 'math',
      focusNode,
      recentSuccessRate: 0.5,
      leitner,
      slowFacts,
    })
    expect(prompt.match(LEARNER_SPECIFIC)).toBeNull()
  })

  it.each(VALID_WORD_SONG_FOCUS_NODES)('word song, %s', async (focusNode) => {
    const prompt = await promptFor({
      track: 'word-song',
      focusNode,
      isGraduationSession: true,
    })
    expect(prompt.match(LEARNER_SPECIFIC)).toBeNull()
  })

  it.each(['ɒ', 'ʌ', 'ɪ', 'ɛ', undefined])(
    'word song, letter-sounds, current vowel %s',
    async (currentTargetVowel) => {
      const prompt = await promptFor({
        track: 'word-song',
        focusNode: 'letter-sounds',
        currentTargetVowel,
      })
      expect(prompt.match(LEARNER_SPECIFIC)).toBeNull()
    },
  )

  it('with no focus node (track defaults)', async () => {
    for (const track of ['math', 'word-song'] as const) {
      const prompt = await promptFor({ track })
      expect(prompt.match(LEARNER_SPECIFIC)).toBeNull()
    }
  })
})
