/**
 * Content wave 3's little stories (`design/native/content-wave-3.md` § 4):
 * the one table the canon splice, the parser and the scenes read.
 *
 * Three steps of 8 stories, one question word each (K3, D1): fox stories
 * ask "Who…?", hen stories "What…?", bug stories "Where…?". The wire stays
 * utterance-only (K5): a story's canon block carries the story in `hint`
 * and the question in `read`, and the parser finds this table's row by the
 * story text (`littleStoryForText`) to get the chips and the scene.
 *
 * Binding: § 4.7's 24 rows, word for word (`littleStories.test.ts` holds
 * them to the spec and to the rules below).
 */

export type StoryNode = 'fox-stories' | 'hen-stories' | 'bug-stories'

/** The three story steps, in tree order. */
export const STORY_NODES: readonly StoryNode[] = [
  'fox-stories',
  'hen-stories',
  'bug-stories',
]

export interface LittleStory {
  /** `'fox-1'` … `'bug-8'`; the scene file is `story-<id>.webp`. */
  id: string
  node: StoryNode
  /** The story, = the canon `hint` (Emma's 2nd-wrong and reveal read). */
  story: string
  /** The question, = the canon `read`. */
  question: string
  /** A pack word with a picture: the right chip. */
  answer: string
  /** Pack words with pictures, both in the story: the wrong chips. */
  wrong: readonly [string, string]
  /**
   * Bug stories only: the correct line's preposition ("Yes! In the cup!").
   * Fox and hen stories say "Yes! The <answer>!".
   */
  prep?: 'In' | 'On' | 'To'
}

const fox = (
  n: number,
  story: string,
  question: string,
  answer: string,
  wrong: readonly [string, string],
): LittleStory => ({
  id: `fox-${n}`,
  node: 'fox-stories',
  story,
  question,
  answer,
  wrong,
})

const hen = (
  n: number,
  story: string,
  question: string,
  answer: string,
  wrong: readonly [string, string],
): LittleStory => ({
  id: `hen-${n}`,
  node: 'hen-stories',
  story,
  question,
  answer,
  wrong,
})

const bug = (
  n: number,
  story: string,
  question: string,
  answer: string,
  prep: 'In' | 'On' | 'To',
  wrong: readonly [string, string],
): LittleStory => ({
  id: `bug-${n}`,
  node: 'bug-stories',
  story,
  question,
  answer,
  wrong,
  prep,
})

/** § 4.7's 24 stories, in canon order (fox 1–8, hen 1–8, bug 1–8). */
export const LITTLE_STORIES: readonly LittleStory[] = [
  fox(
    1,
    'The fox sat on the rug. It has a cup.',
    'Who sat on the rug?',
    'fox',
    ['rug', 'cup'],
  ),
  fox(2, 'The fox has a hat. The hat is in the box.', 'Who has a hat?', 'fox', [
    'hat',
    'box',
  ]),
  fox(
    3,
    'The fox is in the tent. The tent is on a rock.',
    'Who is in the tent?',
    'fox',
    ['tent', 'rock'],
  ),
  fox(
    4,
    'The fox sat on the bed. The hen ran to the van.',
    'Who ran to the van?',
    'hen',
    ['fox', 'van'],
  ),
  fox(5, 'The dog has a bone. The fox has a fig.', 'Who has a fig?', 'fox', [
    'dog',
    'bone',
  ]),
  fox(
    6,
    'The frog sat on a log. The fox hid in the shed.',
    'Who hid in the shed?',
    'fox',
    ['frog', 'log'],
  ),
  fox(
    7,
    'The pig got a kite. The fox ran to the pig.',
    'Who got a kite?',
    'pig',
    ['fox', 'kite'],
  ),
  fox(
    8,
    'The fox and the crab sat in the sun. The crab got a plum.',
    'Who got a plum?',
    'crab',
    ['fox', 'sun'],
  ),
  hen(
    1,
    'The hen has a cake. She is in the van.',
    'What does the hen have?',
    'cake',
    ['hen', 'van'],
  ),
  hen(
    2,
    'The hen has a tent. A pen is in the tent.',
    'What is in the tent?',
    'pen',
    ['hen', 'tent'],
  ),
  hen(
    3,
    'The hen has a bag. A plum is in the bag.',
    'What is in the bag?',
    'plum',
    ['hen', 'bag'],
  ),
  hen(
    4,
    'A pot is on the desk. The hen has a cup.',
    'What is on the desk?',
    'pot',
    ['cup', 'desk'],
  ),
  hen(
    5,
    'The hen has a drum. The pig has a kite.',
    'What does the hen have?',
    'drum',
    ['kite', 'pig'],
  ),
  hen(
    6,
    'The hen has a hat. A wig is in the pond!',
    'What is in the pond?',
    'wig',
    ['hat', 'pond'],
  ),
  hen(
    7,
    'The hen has a box and a lamp. A ring is in the box.',
    'What is in the box?',
    'ring',
    ['lamp', 'box'],
  ),
  hen(
    8,
    'The hen got a jug. Jam is in it. She has a cup.',
    'What is in the jug?',
    'jam',
    ['cup', 'jug'],
  ),
  bug(
    1,
    'The bug is in the cup. It has a fig.',
    'Where is the bug?',
    'cup',
    'In',
    ['bug', 'fig'],
  ),
  bug(
    2,
    'The bug is on the bed. It has a nut.',
    'Where is the bug?',
    'bed',
    'On',
    ['bug', 'nut'],
  ),
  bug(
    3,
    'The bug got a gem. It ran to the tent.',
    'Where did the bug go?',
    'tent',
    'To',
    ['bug', 'gem'],
  ),
  bug(
    4,
    'The bug is on the rug. The cat is on the bed.',
    'Where is the bug?',
    'rug',
    'On',
    ['bed', 'cat'],
  ),
  bug(
    5,
    'The bug is in the bag. The bag is in the van.',
    'Where is the bag?',
    'van',
    'In',
    ['bag', 'bug'],
  ),
  bug(
    6,
    'The dog ran to the pond. The bug hid. It is in the tub.',
    'Where did the dog go?',
    'pond',
    'To',
    ['tub', 'dog'],
  ),
  bug(
    7,
    'The bug is in the nest. The hen is on a log.',
    'Where is the hen?',
    'log',
    'On',
    ['nest', 'bug'],
  ),
  bug(
    8,
    'The bug is on a lid. The lid is on the pot.',
    'Where is the lid?',
    'pot',
    'On',
    ['lid', 'bug'],
  ),
]

const BY_TEXT = new Map(LITTLE_STORIES.map((s) => [s.story, s]))

/** The row whose story is `story` exactly, or undefined. */
export function littleStoryForText(story: string): LittleStory | undefined {
  return BY_TEXT.get(story)
}

/** A story step's 8 rows, in canon order. */
export function storiesOf(node: StoryNode): readonly LittleStory[] {
  return LITTLE_STORIES.filter((s) => s.node === node)
}

export function isStoryNode(node: string): node is StoryNode {
  return (STORY_NODES as readonly string[]).includes(node)
}

// ── The canon lines of a story (§ 4.6 wire, § 4.7) ─────────────────────

/** "Yes! The fox!" / "Yes! In the cup!". */
export function storyCorrectLine(s: LittleStory): string {
  return s.prep === undefined
    ? `Yes! The ${s.answer}!`
    : `Yes! ${s.prep} the ${s.answer}!`
}

/** "This one is the fox." (the 3rd wrong). */
export function storyGiveAnswerLine(s: LittleStory): string {
  return `This one is the ${s.answer}.`
}

/** The recap of all three steps (§ 4.7). */
export const STORY_RECAP_FOCUS = 'You worked on reading stories today!'

// ── Words (the card's taps, the one-word clips) ────────────────────────

/** A story's sentences, each as its words with their punctuation. */
export function storySentences(story: string): string[][] {
  return (story.match(/[^.!?]+[.!?]/g) ?? [story]).map((s) =>
    s.trim().split(/\s+/).filter(Boolean),
  )
}

/** A written word's spoken key: "Fox," → "fox", "pond!" → "pond". */
export function storyWordKey(written: string): string {
  return written.replace(/[^A-Za-z]/g, '').toLowerCase()
}

/** A story's word count (the reading beat's length, § 4.4 step 3). */
export function storyWordCount(story: string): number {
  return storySentences(story).flat().length
}

/**
 * Every distinct word of the 24 stories, in first-seen order: one
 * one-word clip each (`guide.story.word.<word>`, § 5.1).
 */
export const STORY_WORDS: readonly string[] = [
  ...new Set(
    LITTLE_STORIES.flatMap((s) => storySentences(s.story).flat()).map(
      storyWordKey,
    ),
  ),
]
