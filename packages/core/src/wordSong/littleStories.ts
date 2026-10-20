/**
 * Content wave 3's little stories (`design/native/content-wave-3.md` § 4),
 * content wave 4's sheep stories (`design/native/content-wave-4.md` § 6)
 * and content wave 5's goat stories (`design/native/content-wave-5.md`
 * § 7): the one table the canon splices, the parser and the scenes read.
 *
 * Wave 3: three steps of 8 stories, one question word each (K3, D1): fox
 * stories ask "Who…?", hen stories "What…?", bug stories "Where…?". Wave
 * 4's sheep stories mix them (P1–P3 Who, What, Where; then What, Who,
 * Where, Who, What), with the bee and car words; wave 5's goat stories use
 * the same format with the snail and moon words. The wire stays
 * utterance-only (K5): a story's canon block carries the story in `hint`
 * and the question in `read`, and the parser finds this table's row by the
 * story text (`littleStoryForText`) to get the chips and the scene.
 *
 * Binding: wave 3 § 4.7's 24 rows, wave 4 § 6.2's 8 and wave 5 § 7.2's 8,
 * word for word
 * (`littleStories.test.ts` holds them to the specs and to the rules below).
 */

export type StoryNode =
  | 'fox-stories'
  | 'hen-stories'
  | 'bug-stories'
  | 'sheep-stories'
  | 'goat-stories'

/** The story steps, in tree order. */
export const STORY_NODES: readonly StoryNode[] = [
  'fox-stories',
  'hen-stories',
  'bug-stories',
  'sheep-stories',
  'goat-stories',
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
   * Every Where row (bug stories, and sheep and goat stories' Where rows): the
   * correct line's preposition ("Yes! In the cup!"). Who and What rows say
   * "Yes! The <answer>!".
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

/** Wave 4 § 6.2: a sheep story; `prep` only on its Where rows. */
const sheep = (
  n: number,
  story: string,
  question: string,
  answer: string,
  wrong: readonly [string, string],
  prep?: 'In' | 'On',
): LittleStory => ({
  id: `sheep-${n}`,
  node: 'sheep-stories',
  story,
  question,
  answer,
  wrong,
  ...(prep === undefined ? {} : { prep }),
})

/** Wave 5 § 7.2: a goat story; `prep` only on its Where rows. */
const goat = (
  n: number,
  story: string,
  question: string,
  answer: string,
  wrong: readonly [string, string],
  prep?: 'In' | 'On',
): LittleStory => ({
  id: `goat-${n}`,
  node: 'goat-stories',
  story,
  question,
  answer,
  wrong,
  ...(prep === undefined ? {} : { prep }),
})

/**
 * The stories in canon order: wave 3 § 4.7's 24 (fox 1–8, hen 1–8, bug
 * 1–8), then wave 4 § 6.2's sheep 1–8, then wave 5 § 7.2's goat 1–8.
 */
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
  sheep(
    1,
    'The sheep sat in the jeep. It has a peach.',
    'Who sat in the jeep?',
    'sheep',
    ['jeep', 'peach'],
  ),
  // Dave's D9: the sheep runs to the cart, so the barn is only the harp's.
  sheep(
    2,
    'The sheep ran to the cart. A harp is in the barn.',
    'What is in the barn?',
    'harp',
    ['sheep', 'barn'],
  ),
  sheep(
    3,
    'The sheep has a leaf. It hid in the cart.',
    'Where is the sheep?',
    'cart',
    ['sheep', 'leaf'],
    'In',
  ),
  sheep(
    4,
    'The bee has a seed. The sheep has a card.',
    'What does the bee have?',
    'seed',
    ['card', 'bee'],
  ),
  sheep(
    5,
    'The seal sat on a rock. The sheep ran to the tree.',
    'Who sat on a rock?',
    'seal',
    ['sheep', 'rock'],
  ),
  sheep(
    6,
    'The sheep sat in the car. The bee is on the tree.',
    'Where is the bee?',
    'tree',
    ['car', 'sheep'],
    'On',
  ),
  sheep(
    7,
    'The sheep and the shark sat on the ship. The shark got a peach.',
    'Who got a peach?',
    'shark',
    ['sheep', 'ship'],
  ),
  sheep(
    8,
    'The sheep has a scarf and a card. A star is on the cart.',
    'What is on the cart?',
    'star',
    ['scarf', 'card'],
  ),
  goat(
    1,
    'The goat sat in the boat. It has a loaf.',
    'Who sat in the boat?',
    'goat',
    ['boat', 'loaf'],
  ),
  goat(
    2,
    'The goat is on the roof. A broom is in the train.',
    'What is in the train?',
    'broom',
    ['goat', 'train'],
  ),
  // Dave's D8: "It" is the goat, and the answer rests on the sentence that
  // names it.
  goat(
    3,
    'The goat sat on the stool. It has a hoop.',
    'Where is the goat?',
    'stool',
    ['goat', 'hoop'],
    'On',
  ),
  goat(
    4,
    'The goat has a coat. A spoon is on the tray.',
    'What is on the tray?',
    'spoon',
    ['coat', 'tray'],
  ),
  goat(
    5,
    'The snail sat on the moon. The goat sat on a log.',
    'Who sat on the moon?',
    'snail',
    ['goat', 'moon'],
  ),
  goat(
    6,
    'The goat sat in the tent. The snail hid in the boot.',
    'Where is the snail?',
    'boot',
    ['tent', 'goat'],
    'In',
  ),
  goat(
    7,
    'The goat and the snail sat on the stool. The goat got a tooth.',
    'Who got a tooth?',
    'goat',
    ['snail', 'stool'],
  ),
  goat(
    8,
    'The goat has a chain and a boot. A hoop is on the roof.',
    'What is on the roof?',
    'hoop',
    ['chain', 'boot'],
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

/** The recap of every story step (§ 4.7; wave 4 § 6.2; wave 5 § 7.2). */
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
 * Every distinct word of the stories, in first-seen order: one one-word
 * clip each (`guide.story.word.<word>`, § 5.1): wave 3's 54, then the 17
 * that sheep stories bring (wave 4 § 6.2), then goat stories' 16 (wave 5
 * § 7.2).
 */
export const STORY_WORDS: readonly string[] = [
  ...new Set(
    LITTLE_STORIES.flatMap((s) => storySentences(s.story).flat()).map(
      storyWordKey,
    ),
  ),
]
