/**
 * `LITTLE_STORIES` against `design/native/content-wave-3.md` § 4.7 (AC 5):
 * the 24 rows word for word, and the rules a splice lint holds them to
 * (shape, chips, pictures, forbidden pairs). The taught-words rule (D2)
 * needs the canon files, so `scripts/spliceContentWave3Canon.test.ts`
 * checks it.
 */
import { describe, expect, it } from 'vitest'
import {
  LITTLE_STORIES,
  STORY_NODES,
  STORY_WORDS,
  littleStoryForText,
  storiesOf,
  storyCorrectLine,
  storyGiveAnswerLine,
  storySentences,
  storyWordCount,
  storyWordKey,
} from './littleStories'
import { getWordEntry, isForbiddenPair } from './wordPack'

/** § 4.7, as written: story → question → answer (prep) / wrong chips. */
const SPEC = `
fox-1 | The fox sat on the rug. It has a cup. | Who sat on the rug? | fox | | rug, cup
fox-2 | The fox has a hat. The hat is in the box. | Who has a hat? | fox | | hat, box
fox-3 | The fox is in the tent. The tent is on a rock. | Who is in the tent? | fox | | tent, rock
fox-4 | The fox sat on the bed. The hen ran to the van. | Who ran to the van? | hen | | fox, van
fox-5 | The dog has a bone. The fox has a fig. | Who has a fig? | fox | | dog, bone
fox-6 | The frog sat on a log. The fox hid in the shed. | Who hid in the shed? | fox | | frog, log
fox-7 | The pig got a kite. The fox ran to the pig. | Who got a kite? | pig | | fox, kite
fox-8 | The fox and the crab sat in the sun. The crab got a plum. | Who got a plum? | crab | | fox, sun
hen-1 | The hen has a cake. She is in the van. | What does the hen have? | cake | | hen, van
hen-2 | The hen has a tent. A pen is in the tent. | What is in the tent? | pen | | hen, tent
hen-3 | The hen has a bag. A plum is in the bag. | What is in the bag? | plum | | hen, bag
hen-4 | A pot is on the desk. The hen has a cup. | What is on the desk? | pot | | cup, desk
hen-5 | The hen has a drum. The pig has a kite. | What does the hen have? | drum | | kite, pig
hen-6 | The hen has a hat. A wig is in the pond! | What is in the pond? | wig | | hat, pond
hen-7 | The hen has a box and a lamp. A ring is in the box. | What is in the box? | ring | | lamp, box
hen-8 | The hen got a jug. Jam is in it. She has a cup. | What is in the jug? | jam | | cup, jug
bug-1 | The bug is in the cup. It has a fig. | Where is the bug? | cup | In | bug, fig
bug-2 | The bug is on the bed. It has a nut. | Where is the bug? | bed | On | bug, nut
bug-3 | The bug got a gem. It ran to the tent. | Where did the bug go? | tent | To | bug, gem
bug-4 | The bug is on the rug. The cat is on the bed. | Where is the bug? | rug | On | bed, cat
bug-5 | The bug is in the bag. The bag is in the van. | Where is the bag? | van | In | bag, bug
bug-6 | The dog ran to the pond. The bug hid. It is in the tub. | Where did the dog go? | pond | To | tub, dog
bug-7 | The bug is in the nest. The hen is on a log. | Where is the hen? | log | On | nest, bug
bug-8 | The bug is on a lid. The lid is on the pot. | Where is the lid? | pot | On | lid, bug
`
  .trim()
  .split('\n')
  .map((row) => {
    const [id, story, question, answer, prep, wrong] = row
      .split('|')
      .map((c) => c.trim())
    return {
      id: id!,
      story: story!,
      question: question!,
      answer: answer!,
      prep: prep === '' ? undefined : prep,
      wrong: wrong!.split(', '),
    }
  })

/** § 4.7's character counts: story, question. */
const CHARACTERS: Record<string, [number, number]> = {
  'fox-1': [37, 19],
  'fox-2': [41, 14],
  'fox-3': [46, 19],
  'fox-4': [47, 19],
  'fox-5': [38, 14],
  'fox-6': [47, 20],
  'fox-7': [43, 15],
  'fox-8': [57, 15],
  'hen-1': [38, 23],
  'hen-2': [41, 20],
  'hen-3': [40, 19],
  'hen-4': [40, 20],
  'hen-5': [39, 23],
  'hen-6': [40, 20],
  'hen-7': [51, 19],
  'hen-8': [47, 19],
  'bug-1': [36, 17],
  'bug-2': [36, 17],
  'bug-3': [38, 21],
  'bug-4': [45, 17],
  'bug-5': [45, 17],
  'bug-6': [55, 21],
  'bug-7': [44, 17],
  'bug-8': [43, 17],
}

describe('LITTLE_STORIES equals § 4.7 (AC 5)', () => {
  it('24 rows, 8 per step, in canon order', () => {
    expect(LITTLE_STORIES).toHaveLength(24)
    expect(
      LITTLE_STORIES.map(({ id, story, question, answer, prep, wrong }) => ({
        id,
        story,
        question,
        answer,
        prep,
        wrong: [...wrong],
      })),
    ).toEqual(SPEC)
    for (const node of STORY_NODES) {
      const rows = storiesOf(node)
      expect(rows.map((r) => r.id)).toEqual(
        Array.from({ length: 8 }, (_, i) => `${node.split('-')[0]}-${i + 1}`),
      )
    }
  })

  it("the characters match the spec's counts", () => {
    for (const s of LITTLE_STORIES)
      expect([s.story.length, s.question.length], s.id).toEqual(
        CHARACTERS[s.id],
      )
  })

  it('one question word per step: who, what, where (K3, D1)', () => {
    const word = {
      'fox-stories': 'Who',
      'hen-stories': 'What',
      'bug-stories': 'Where',
    }
    for (const s of LITTLE_STORIES)
      expect(s.question.split(' ')[0], s.id).toBe(word[s.node])
  })

  it('the correct and given-answer lines (§ 4.6, § 4.7)', () => {
    const [fox1, bug1, bug3] = ['fox-1', 'bug-1', 'bug-3'].map(
      (id) => LITTLE_STORIES.find((s) => s.id === id)!,
    )
    expect(storyCorrectLine(fox1!)).toBe('Yes! The fox!')
    expect(storyCorrectLine(bug1!)).toBe('Yes! In the cup!')
    expect(storyCorrectLine(bug3!)).toBe('Yes! To the tent!')
    expect(storyGiveAnswerLine(fox1!)).toBe('This one is the fox.')
    for (const s of LITTLE_STORIES) {
      expect(storyCorrectLine(s).length).toBe(
        (s.prep === undefined ? 10 : 13) + s.answer.length,
      )
      expect(storyGiveAnswerLine(s).length).toBe(17 + s.answer.length)
    }
  })

  it('littleStoryForText finds a row by its exact story, and nothing else', () => {
    for (const s of LITTLE_STORIES) expect(littleStoryForText(s.story)).toBe(s)
    expect(littleStoryForText('The fox sat on the mat.')).toBeUndefined()
    expect(
      littleStoryForText(' The fox sat on the rug. It has a cup.'),
    ).toBeUndefined()
  })
})

describe('the rules (§ 4.7)', () => {
  it('2–3 sentences and 10–14 words; three sentences only in bug 6 and hen 8 (D2)', () => {
    for (const s of LITTLE_STORIES) {
      const n = storySentences(s.story).length
      expect(n, s.id).toBeGreaterThanOrEqual(2)
      expect(n, s.id).toBeLessThanOrEqual(3)
      const words = storyWordCount(s.story)
      expect(words, s.id).toBeGreaterThanOrEqual(10)
      expect(words, s.id).toBeLessThanOrEqual(14)
    }
    expect(
      LITTLE_STORIES.filter((s) => storySentences(s.story).length === 3).map(
        (s) => s.id,
      ),
    ).toEqual(['hen-8', 'bug-6'])
  })

  it('every chip is a different pack word with a picture, in the story; no forbidden pair', () => {
    for (const s of LITTLE_STORIES) {
      const words = new Set(storySentences(s.story).flat().map(storyWordKey))
      const trio = [s.answer, ...s.wrong]
      expect(new Set(trio).size, s.id).toBe(3)
      for (const w of trio) {
        expect(words.has(w), `${s.id} ${w}`).toBe(true)
        const entry = getWordEntry(w)
        expect(entry.pictureKey, `${s.id} ${w}`).toBe(w)
        expect(entry.sightWord ?? false, `${s.id} ${w}`).toBe(false)
      }
      for (let i = 0; i < 3; i++)
        for (let j = i + 1; j < 3; j++)
          expect(isForbiddenPair(trio[i]!, trio[j]!), s.id).toBe(false)
    }
  })

  it('"shed" is the one story noun without a chip (never a chip)', () => {
    const chips = new Set(LITTLE_STORIES.flatMap((s) => [s.answer, ...s.wrong]))
    expect(chips.has('shed')).toBe(false)
  })

  it('54 distinct story words, one clip each (§ 5.1)', () => {
    expect(STORY_WORDS).toHaveLength(54)
    expect(STORY_WORDS.every((w) => /^[a-z]+$/.test(w))).toBe(true)
  })
})
