/**
 * The `'little-story'` route of `wordSongSessionPlanFromServer`
 * (`design/native/content-wave-3.md` § 4.6, AC 5): the question is the
 * read, the story rides in `hint`, the target comes from the correct line,
 * and the chips are the story row's own. Native only: without
 * `{ littleStories: true }` a story read throws, as the frozen web needs.
 */
import { describe, expect, it } from 'vitest'
import {
  LITTLE_STORIES,
  storiesOf,
  storyCorrectLine,
  storyGiveAnswerLine,
  type LittleStory,
} from './littleStories'
import {
  PlanFromServerError,
  wordSongSessionPlanFromServer,
  wordSongWarmupFromServer,
} from './planFromServer'
import { buildWordRound, readAloudDelayMs, storyReadBeatMs } from './wordRound'

function block(n: number, s: LittleStory, prefix = 'p') {
  return [
    { id: `word.${prefix}${n}.read`, text: s.question },
    { id: `word.${prefix}${n}.correct`, text: storyCorrectLine(s) },
    { id: `word.${prefix}${n}.reprompt`, text: 'Hmm... try again?' },
    { id: `word.${prefix}${n}.hint`, text: s.story },
    { id: `word.${prefix}${n}.giveAnswer`, text: storyGiveAnswerLine(s) },
  ]
}

function planOf(rows: readonly LittleStory[]) {
  return {
    id: 'fox-stories-level-1',
    label: 'Fox Stories — Level 1',
    utterances: rows.flatMap((s, i) => block(i + 1, s)),
  }
}

const OPTS = { littleStories: true } as const

describe('little-story plans (§ 4.6)', () => {
  it('each story step parses 8/8 with its row (story, id, question, target)', () => {
    for (const node of ['fox-stories', 'hen-stories', 'bug-stories'] as const) {
      const rows = storiesOf(node)
      const plan = wordSongSessionPlanFromServer(planOf(rows), OPTS)
      expect(plan.problems).toHaveLength(8)
      plan.problems.forEach((p, i) => {
        const s = rows[i]!
        expect(p).toMatchObject({
          index: i + 1,
          contentType: 'little-story',
          story: s.story,
          storyId: s.id,
          question: s.question,
        })
        expect(p.target.word).toBe(s.answer)
      })
    }
  })

  it("the chips are the row's answer and wrong words, shuffled; picture chips, the story card", () => {
    const plan = wordSongSessionPlanFromServer(
      planOf(storiesOf('fox-stories')),
      OPTS,
    )
    plan.problems.forEach((p, i) => {
      const s = storiesOf('fox-stories')[i]!
      const round = buildWordRound(p, { crossVowel: false })
      expect(round.card).toBe('story')
      expect(round.chipFace).toBe('picture')
      expect(round.chips.map((e) => e.word).sort()).toEqual(
        [s.answer, ...s.wrong].sort(),
      )
      // Deterministic: the same order twice.
      expect(buildWordRound(p, { crossVowel: true }).chips).toEqual(round.chips)
    })
  })

  it('the reading beat: 1500 ms a word, clamped to 12–21 s (D3)', () => {
    const plan = wordSongSessionPlanFromServer(
      planOf(storiesOf('fox-stories')),
      OPTS,
    )
    // fox-1: 10 words → 15 s; fox-8: 14 words → 21 s.
    expect(storyReadBeatMs(plan.problems[0]!)).toBe(15000)
    expect(storyReadBeatMs(plan.problems[7]!)).toBe(21000)
    expect(readAloudDelayMs(plan.problems[0]!)).toBe(15000)
    for (const p of plan.problems) {
      expect(storyReadBeatMs(p)).toBeGreaterThanOrEqual(12000)
      expect(storyReadBeatMs(p)).toBeLessThanOrEqual(21000)
    }
  })

  it('without `littleStories` a story read throws (the frozen web)', () => {
    expect(() =>
      wordSongSessionPlanFromServer(planOf(storiesOf('fox-stories'))),
    ).toThrow(PlanFromServerError)
  })

  it('an unknown story text throws', () => {
    const plan = planOf(storiesOf('fox-stories'))
    plan.utterances[3] = {
      id: 'word.p1.hint',
      text: 'The fox sat on the mat. It has a cup.',
    }
    expect(() => wordSongSessionPlanFromServer(plan, OPTS)).toThrow(
      PlanFromServerError,
    )
  })

  it("a correct line whose word isn't the row's answer throws", () => {
    const plan = planOf(storiesOf('fox-stories'))
    plan.utterances[1] = { id: 'word.p1.correct', text: 'Yes! The rug!' }
    expect(() => wordSongSessionPlanFromServer(plan, OPTS)).toThrow(
      PlanFromServerError,
    )
  })

  it("a correct line that isn't the story shape throws", () => {
    const plan = planOf(storiesOf('fox-stories'))
    plan.utterances[1] = { id: 'word.p1.correct', text: "Yes! That's a fox." }
    expect(() => wordSongSessionPlanFromServer(plan, OPTS)).toThrow(
      PlanFromServerError,
    )
  })

  it('a review mixing story blocks with word blocks parses (stories join reviews, D7)', () => {
    const plan = planOf(LITTLE_STORIES.slice(0, 7))
    plan.utterances.push(
      { id: 'word.p8.read', text: 'Read the cake.' },
      { id: 'word.p8.correct', text: "Yes! That's a cake." },
      { id: 'word.p8.reprompt', text: 'Hmm... try again?' },
      { id: 'word.p8.hint', text: "Let's look. Cake." },
      { id: 'word.p8.giveAnswer', text: 'This one is cake.' },
    )
    const parsed = wordSongSessionPlanFromServer(plan, OPTS)
    expect(parsed.problems.map((p) => p.contentType)).toEqual([
      ...Array(7).fill('little-story'),
      'cvc-word',
    ])
  })

  it('warm-up blocks take the option too', () => {
    const plan = {
      id: 'x',
      label: 'x',
      utterances: block(1, LITTLE_STORIES[0]!, 'w'),
    }
    expect(wordSongWarmupFromServer(plan)).toEqual([])
    expect(wordSongWarmupFromServer(plan, OPTS)).toHaveLength(1)
  })
})
