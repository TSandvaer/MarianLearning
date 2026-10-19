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
import { BIG_WORDS_STEPS } from './bigWordsSteps'
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
sheep-1 | The sheep sat in the jeep. It has a peach. | Who sat in the jeep? | sheep | | jeep, peach
sheep-2 | The sheep ran to the cart. A harp is in the barn. | What is in the barn? | harp | | sheep, barn
sheep-3 | The sheep has a leaf. It hid in the cart. | Where is the sheep? | cart | In | sheep, leaf
sheep-4 | The bee has a seed. The sheep has a card. | What does the bee have? | seed | | card, bee
sheep-5 | The seal sat on a rock. The sheep ran to the tree. | Who sat on a rock? | seal | | sheep, rock
sheep-6 | The sheep sat in the car. The bee is on the tree. | Where is the bee? | tree | On | car, sheep
sheep-7 | The sheep and the shark sat on the ship. The shark got a peach. | Who got a peach? | shark | | sheep, ship
sheep-8 | The sheep has a scarf and a card. A star is on the cart. | What is on the cart? | star | | scarf, card
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
  // Content wave 4 § 6.2.
  'sheep-1': [42, 20],
  'sheep-2': [49, 20],
  'sheep-3': [41, 19],
  'sheep-4': [41, 23],
  'sheep-5': [50, 18],
  'sheep-6': [49, 17],
  'sheep-7': [63, 16],
  'sheep-8': [56, 20],
}

describe('LITTLE_STORIES equals § 4.7 and wave 4 § 6.2 (AC 5; wave 4 AC 6)', () => {
  it('32 rows, 8 per step, in canon order', () => {
    expect(LITTLE_STORIES).toHaveLength(32)
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

  it('one question word per wave-3 step: who, what, where (K3, D1)', () => {
    const word: Partial<Record<string, string>> = {
      'fox-stories': 'Who',
      'hen-stories': 'What',
      'bug-stories': 'Where',
    }
    for (const s of LITTLE_STORIES.filter((r) => r.node !== 'sheep-stories'))
      expect(s.question.split(' ')[0], s.id).toBe(word[s.node])
  })

  it('sheep stories mix the question word: Who, What, Where, then What, Who, Where, Who, What (wave 4 § 6.1)', () => {
    expect(
      storiesOf('sheep-stories').map((s) => s.question.split(' ')[0]),
    ).toEqual(['Who', 'What', 'Where', 'What', 'Who', 'Where', 'Who', 'What'])
  })

  it('every Where row carries its preposition, and only Where rows do (wave 4 § 6.1)', () => {
    for (const s of LITTLE_STORIES)
      expect(s.prep !== undefined, s.id).toBe(s.question.startsWith('Where'))
    const sheep = storiesOf('sheep-stories')
    expect(storyCorrectLine(sheep[2]!)).toBe('Yes! In the cart!')
    expect(storyCorrectLine(sheep[5]!)).toBe('Yes! On the tree!')
    expect(storyCorrectLine(sheep[0]!)).toBe('Yes! The sheep!')
    expect(storyGiveAnswerLine(sheep[6]!)).toBe('This one is the shark.')
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
  it('2–3 sentences and 10–14 words; three sentences only in bug 6 and hen 8 (D2; wave 4 § 6.2)', () => {
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

  it('71 distinct story words, one clip each (§ 5.1; wave 4 § 6.2: 54 + 17)', () => {
    expect(STORY_WORDS).toHaveLength(71)
    expect(STORY_WORDS.every((w) => /^[a-z]+$/.test(w))).toBe(true)
  })
})

describe('sheep stories (content wave 4 § 6.2, AC 6)', () => {
  const sheep = storiesOf('sheep-stories')
  const words = (story: string) =>
    storySentences(story).flat().map(storyWordKey)
  /** The 16 bee-words and car-words targets (§ 3.2, § 4.2). */
  const BEE_CAR = new Set([
    ...BIG_WORDS_STEPS['bee-words'].map((r) => r.word),
    ...BIG_WORDS_STEPS['car-words'].map((r) => r.word),
  ])
  /** What each chip is in its story: who, what or where. */
  const KIND: Record<string, 'who' | 'what' | 'where'> = {
    sheep: 'who',
    bee: 'who',
    seal: 'who',
    shark: 'who',
    peach: 'what',
    harp: 'what',
    leaf: 'what',
    seed: 'what',
    card: 'what',
    scarf: 'what',
    star: 'what',
    jeep: 'where',
    barn: 'where',
    cart: 'where',
    rock: 'where',
    car: 'where',
    tree: 'where',
    ship: 'where',
  }

  it('2 sentences each; the two 14-word stories sit at P7 and P8', () => {
    for (const s of sheep) expect(storySentences(s.story).length, s.id).toBe(2)
    expect(sheep.map((s) => storyWordCount(s.story))).toEqual([
      10, 12, 10, 10, 12, 12, 14, 14,
    ])
  })

  it('the sheep is in every story; each uses at least 2 of the 16 bee and car words, and each of the 16 appears', () => {
    const seen = new Set<string>()
    for (const s of sheep) {
      const w = words(s.story)
      expect(w, s.id).toContain('sheep')
      const team = w.filter((x) => BEE_CAR.has(x))
      for (const x of team) seen.add(x)
      expect(new Set(team).size, s.id).toBeGreaterThanOrEqual(2)
    }
    expect([...BEE_CAR].filter((x) => !seen.has(x))).toEqual([])
  })

  it('no "she", and "it" only in stories 1 and 3', () => {
    for (const s of sheep) expect(words(s.story), s.id).not.toContain('she')
    expect(
      sheep.filter((s) => words(s.story).includes('it')).map((s) => s.id),
    ).toEqual(['sheep-1', 'sheep-3'])
  })

  it('questions fit the ribbon slot (≤ 23 characters)', () => {
    for (const s of sheep)
      expect(s.question.length, s.id).toBeLessThanOrEqual(23)
  })

  it('chip kinds: the answer is the asked kind; P1–P3 wrong chips are other kinds; P4–P8 have at least one of the same kind', () => {
    const asked = (q: string) =>
      q.split(' ')[0]!.toLowerCase() as 'who' | 'what' | 'where'
    sheep.forEach((s, i) => {
      const kind = asked(s.question)
      expect(KIND[s.answer], s.id).toBe(kind)
      const same = s.wrong.filter((w) => KIND[w] === kind).length
      if (i < 3) expect(same, s.id).toBe(0)
      else expect(same, s.id).toBeGreaterThanOrEqual(1)
    })
    // Story 8: two same-kind wrong chips, the hardest trio, last (D10).
    expect(sheep[7]!.wrong.every((w) => KIND[w] === 'what')).toBe(true)
  })

  it('stories 5 and 7 are answered by a friend, not the sheep', () => {
    expect(sheep[4]!.answer).toBe('seal')
    expect(sheep[6]!.answer).toBe('shark')
  })
})
