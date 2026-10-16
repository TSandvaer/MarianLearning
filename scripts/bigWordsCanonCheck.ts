/**
 * Canon check for the two land-6 Word Song steps, duck words and crab words
 * (content wave 1, `design/native/content-wave-1.md` § 3, § 4, § 6.2).
 *
 * Both steps are served from canon on every session, the same 8 words in
 * the same order (K9), and their lines are fixed by the spec. Haiku writes
 * the bake, so this check holds it to the spec: the bake (`bakeOne` in
 * `generateSessionCanon.ts`) refuses a drifted plan, and
 * `canonBigWords.test.ts` runs it over the committed files.
 *
 * Per problem N (word W from `bigWordsSteps.ts`, Cap = W capitalised):
 *   word.pN.read        "Read the W."
 *   word.pN.correct     "Yes! That's a W."
 *   word.pN.reprompt    "Hmm... try again?"
 *   word.pN.hint        "Let's look. Cap."
 *   word.pN.giveAnswer  "This one is W."
 * and no `word.pN.blend` (K11). The recap line is the "reading words" one.
 */
import {
  BIG_WORDS_STEP_IDS,
  bigWordsOf,
  type BigWordsStep,
} from '@marian/core/wordSong/bigWordsSteps'

interface UtteranceLike {
  id: string
  text: string
}

export function isBigWordsStep(node: string): node is BigWordsStep {
  return (BIG_WORDS_STEP_IDS as readonly string[]).includes(node)
}

/** The exact `word.p*` lines a step's canon must carry, in canon order. */
export function expectedBigWordsLines(
  step: BigWordsStep,
): readonly UtteranceLike[] {
  return bigWordsOf(step).flatMap((word, i) => {
    const n = i + 1
    const cap = word.charAt(0).toUpperCase() + word.slice(1)
    return [
      { id: `word.p${n}.read`, text: `Read the ${word}.` },
      { id: `word.p${n}.correct`, text: `Yes! That's a ${word}.` },
      { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
      { id: `word.p${n}.hint`, text: `Let's look. ${cap}.` },
      { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
    ]
  })
}

export const BIG_WORDS_RECAP_FOCUS = 'You worked on reading words today!'

/** Every way `utterances` departs from the step's fixed canon; `[]` = clean. */
export function bigWordsCanonViolations(
  step: BigWordsStep,
  utterances: readonly UtteranceLike[],
): string[] {
  const out: string[] = []
  const problemLines = utterances.filter((u) => u.id.startsWith('word.'))
  const expected = expectedBigWordsLines(step)
  const got = new Map(problemLines.map((u) => [u.id, u.text]))
  for (const e of expected) {
    const text = got.get(e.id)
    if (text === undefined) out.push(`missing ${e.id} ("${e.text}")`)
    else if (text !== e.text)
      out.push(`${e.id} is "${text}", expected "${e.text}"`)
  }
  const known = new Set(expected.map((e) => e.id))
  for (const u of problemLines)
    if (!known.has(u.id)) out.push(`unexpected ${u.id} ("${u.text}")`)
  const recap = utterances.find((u) => u.id === 'session.end.recap.focus')
  if (recap !== undefined && recap.text !== BIG_WORDS_RECAP_FOCUS)
    out.push(
      `session.end.recap.focus is "${recap.text}", expected "${BIG_WORDS_RECAP_FOCUS}"`,
    )
  return out
}
