/**
 * Emma's guidance-layer Lily line catalogue (Guidance G3, ClickUp
 * 123jpnbca4u).
 *
 * Every Emma caption in `design/emmas-path/redesign/guidance-mockup.html`
 * (its `STATES` object: screens a, b, c, d, a2, e, f), approved in
 * team/DECISIONS.md "2026-10-06 — Guidance layer approved". A line that
 * names a world has one entry per world, a line that names a count one entry
 * per count, and the effort-praise line one entry per good-day score (7, 8).
 * Lines already in `PATH_LINES` (the e2 map-unlock line is
 * `end.unlock.sub-to-10`) are not repeated here. Each line is baked whole.
 *
 * MP3s live next to the path lines under `public/assets/audio/path/`
 * (`guide-*.mp3`) and are rendered by `scripts/renderGuidanceLinesLily.ts`
 * from `GUIDANCE_LINES`, so text and audio cannot drift. Wiring the lines
 * into the Hub and session-end screens is G1/G2's job; this module is data
 * only (its runtime imports are `pathLines.ts` and the spoken step names it
 * already uses, both loadable by the node-typed render scripts).
 */
import type { Land } from '../progress/lands'
import type { SkillNode } from '../progress/types'
import {
  STAGE_SPOKEN_NAME_VERBS,
  STAGE_SPOKEN_NAMES,
  capitalizeSpokenName,
} from '../sessionEnd/friendlyNodeName'
import {
  STORY_WORDS,
  storiesOf,
  storySentences,
  storyWordKey,
} from '../wordSong/littleStories'
import { pathLineSrc, pathStepsOf } from './pathLines'

/** A world (`'math'` | `'word-song'`). */
type World = Land['world']

export type GuidanceLineKind =
  | 'hub-suggest'
  | 'hub-sleeping'
  | 'hub-both-sleeping'
  | 'hub-woke'
  | 'hub-woke-one'
  | 'hub-one-more'
  | 'end-right'
  | 'end-flower'
  | 'end-count'
  | 'end-sleeps'
  | 'end-path-opens'
  | 'end-not-yet-praise'
  | 'end-not-yet-again'
  | 'end-world-done'
  | 'end-fast-track'
  | 'session-review'
  | 'session-warmup'
  | 'session-knew'
  | 'session-peek-open'
  | 'session-peek-close'
  | 'session-intro'
  | 'session-hiding'
  | 'session-replay-open'
  | 'session-replay-close'
  | 'story-read'
  | 'story-word'

export interface GuidanceLine {
  /** Dotted id, e.g. `guide.hub.suggest.math`. */
  id: string
  kind: GuidanceLineKind
  /** The world the line suggests; `null` for world-free lines. */
  world: World | null
  text: string
  /**
   * What the render sends to Lily when it is not `text`: the one-word story
   * clips that sheep stories bring go as "Word," (content wave 4 § 8.1;
   * "Sat." came back as "Saturday", `audio-system.md`). The caption stays
   * `text`. Undefined = `text`.
   */
  input?: string
  /** Bundled MP3 path relative to `public/`. */
  src: string
}

const WORLD_NAMES: Record<World, string> = {
  math: 'Number Garden',
  'word-song': 'Word Song',
}
const OTHER: Record<World, World> = { math: 'word-song', 'word-song': 'math' }
const WORLDS: readonly World[] = ['math', 'word-song']
const COUNT_WORDS = ['One', 'Two', 'Three'] as const
const SCORE_WORDS: Record<number, string> = { 7: 'Seven', 8: 'Eight' }

function buildLines(): GuidanceLine[] {
  const lines: GuidanceLine[] = []
  const add = (
    id: string,
    kind: GuidanceLineKind,
    text: string,
    world: World | null = null,
    input?: string,
  ) =>
    lines.push({
      id,
      kind,
      world,
      text,
      ...(input === undefined ? {} : { input }),
      src: pathLineSrc(id),
    })

  // Hub (screens a, c, d, a2). `world` = the world Emma suggests.
  for (const w of WORLDS)
    add(
      `guide.hub.suggest.${w}`,
      'hub-suggest',
      `Let's grow a flower in ${WORLD_NAMES[w]}! Or pick ${WORLD_NAMES[OTHER[w]]}.`,
      w,
    )
  for (const w of WORLDS)
    add(
      `guide.hub.sleeping.${w}`,
      'hub-sleeping',
      `Your flower is sleeping. Let's play ${WORLD_NAMES[w]}!`,
      w,
    )
  add(
    'guide.hub.both-sleeping',
    'hub-both-sleeping',
    'Both flowers are sleeping. Want to practise more?',
  )
  add('guide.hub.woke', 'hub-woke', 'Your flowers woke up!')
  // Next morning when only one world had a sleeping flower.
  add('guide.hub.woke.one', 'hub-woke-one', 'Your flower woke up!')
  add(
    'guide.hub.one-more',
    'hub-one-more',
    'One more flower, and a new path opens!',
  )

  // Session end (screens b, e, f).
  for (const n of [7, 8])
    add(
      `guide.end.right.${n}`,
      'end-right',
      `${SCORE_WORDS[n]} right! You worked hard!`,
    )
  add('guide.end.flower', 'end-flower', 'You got a flower!')
  COUNT_WORDS.forEach((c, i) =>
    add(`guide.end.count.${i + 1}`, 'end-count', `${c} of three!`),
  )
  add(
    'guide.end.sleeps',
    'end-sleeps',
    'It sleeps tonight. Come back tomorrow for one more.',
  )
  add('guide.end.path-opens', 'end-path-opens', 'A new path opens. Look!')
  add(
    'guide.end.not-yet.praise',
    'end-not-yet-praise',
    'You practised hard! Good work!',
  )
  add(
    'guide.end.not-yet.again',
    'end-not-yet-again',
    "Play again to get today's flower.",
  )
  // The flower that finishes a world's last step.
  add('guide.end.world-done', 'end-world-done', 'You grew your whole garden!')
  // The fast-track day, in place of "You got a flower!" (native spec
  // design/native/fast-track-native.md § 8, text approved by Thomas
  // 2026-10-14, T1).
  add(
    'guide.end.fast-track',
    'end-fast-track',
    'You know this! All your flowers grew!',
  )

  // In session (native spec design/native/review-mode-and-warmup-native.md
  // § 4, text approved by Thomas 2026-10-14): a review's opener, and the
  // line before each warm-up problem.
  add(
    'guide.session.review',
    'session-review',
    "Your flower is sleeping. Let's play the ones you know!",
  )
  add('guide.session.warmup', 'session-warmup', 'Remember this one?')
  // Fast-track spec § 8 (T1, approved as written 2026-10-14): a quick
  // warm-up answer (§ 7).
  add('guide.session.knew', 'session-knew', 'You just knew that one!')
  // The Map peek's opener and closer name the step (§ 6.3, § 8; Thomas's
  // device check 2026-10-15): "Let's look at <name>!" / "<Name> is (are)
  // for later. You will learn it!", with the spoken step names the path
  // lines use and each name's own verb ("Cat words are …", "Adding to ten
  // is …"). One pair per step a peek can reach: every step but a world's
  // first (a peek is a stop after the current one).
  for (const w of WORLDS)
    for (const n of peekableSteps(w))
      add(
        peekOpenId(n),
        'session-peek-open',
        `Let's look at ${STAGE_SPOKEN_NAMES[n]}!`,
        w,
      )
  for (const w of WORLDS)
    for (const n of peekableSteps(w))
      add(
        peekCloseId(n),
        'session-peek-close',
        `${capitalizeSpokenName(STAGE_SPOKEN_NAMES[n])} ${STAGE_SPOKEN_NAME_VERBS[n]} for later. You will learn it!`,
        w,
      )
  // Lead lines (content wave 1 § 6.1, texts approved by Thomas 2026-10-16):
  // one short line before a problem's read that introduces a new thing. A
  // step's intro plays before the scored problem 1 of its forward sessions
  // until it is mastered; the hiding line before a round's first
  // missing-number problem. The screens decide which problem gets which
  // (`leadLinesForRound` in the native app's `audio/sessionGuide.ts`).
  for (const w of WORLDS)
    for (const n of pathStepsOf(w)) {
      const text = SESSION_INTRO_TEXTS[n]
      if (text !== undefined) add(sessionIntroId(n), 'session-intro', text, w)
    }
  add(SESSION_HIDING_ID, 'session-hiding', 'Some flowers are hiding!', 'math')
  // The Map replay's opener and closer (native spec
  // design/native/map-tap-to-play.md § 6, T1 approved by Thomas
  // 2026-10-17): "Let's play <name> again!" / "You know <name>!". One pair
  // per step of both worlds: every step can become mastered, so every step
  // can be replayed. The closer praises what she knows (D4); no line
  // anywhere suggests a replay.
  for (const w of WORLDS)
    for (const n of pathStepsOf(w))
      add(
        replayOpenId(n),
        'session-replay-open',
        `Let's play ${STAGE_SPOKEN_NAMES[n]} again!`,
        w,
      )
  for (const w of WORLDS)
    for (const n of pathStepsOf(w))
      add(
        replayCloseId(n),
        'session-replay-close',
        `You know ${STAGE_SPOKEN_NAMES[n]}!`,
        w,
      )
  // Little stories (content wave 3 § 4.4, § 5.1): "Read the story." on a
  // story card, and one clip per distinct story word that a word tap plays
  // ("Fox."). The word list comes from `LITTLE_STORIES`. The words sheep
  // stories bring are rendered from "Word," (content wave 4 § 8.1); wave
  // 3's 54 keep their committed MP3s and take picks.
  add(STORY_READ_ID, 'story-read', 'Read the story.', 'word-song')
  for (const word of STORY_WORDS) {
    const cap = `${word.charAt(0).toUpperCase()}${word.slice(1)}`
    add(
      storyWordId(word),
      'story-word',
      `${cap}.`,
      'word-song',
      WAVE_3_STORY_WORDS.has(word) ? undefined : `${cap},`,
    )
  }
  return lines
}

/** The story words wave 3 rendered from "Word." (fox, hen and bug stories). */
const WAVE_3_STORY_WORDS: ReadonlySet<string> = new Set(
  (['fox-stories', 'hen-stories', 'bug-stories'] as const).flatMap((n) =>
    storiesOf(n).flatMap((s) =>
      storySentences(s.story).flat().map(storyWordKey),
    ),
  ),
)

/**
 * The intro lead line of each new step (§ 6.1). A step without an entry has
 * no intro. Each text is the step's own, not a template: "Two letters, one
 * sound!" names duck words' idea, not their name.
 */
const SESSION_INTRO_TEXTS: Readonly<Partial<Record<SkillNode, string>>> = {
  'mult-mix': "Let's play all the groups!",
  // Number Garden land 4 (content wave 2 § 2.4, § 6.2; Thomas 2026-10-17).
  'div-share': "Let's share the flowers!",
  // Number Garden land 5 (content wave 3 § 5.1; Thomas approved T2).
  hundreds: 'Hundreds, tens and ones!',
  // Number Garden land 5's 2nd stop (content wave 4 § 2.4, § 8.1; Thomas
  // approved T2). Its pill pulses on "More" only (D1).
  'hundreds-addsub': 'More and less!',
  // Number Garden land 5's 3rd stop and land 6 (content wave 5 § 2.4,
  // § 3.4, § 9.1; Thomas approved T2; Dave D2, D4): the empty tens tray
  // pulses on each "tens"; the two trays pulse on "Tens" and "ones".
  'hundreds-zeros': 'No tens? Zero tens!',
  'add-two-digit': 'Tens and ones!',
  // Word Song land 6 (content wave 1 § 3.3, § 4.3).
  'duck-words': 'Two letters, one sound!',
  'crab-words': 'Read all the letters!',
  // Word Song land 6 (content wave 2 § 3.3, § 4.3, § 6.2; Thomas 2026-10-17).
  'tent-words': 'Read to the end!',
  'cake-words': 'The E is quiet. It makes the A say its name.',
  // Word Song land 7 (content wave 3 § 5.1, D12; Thomas 2026-10-17): one
  // frame for all three, "Read the story. Who / What / Where is it?".
  'fox-stories': 'Read the story. Who is it?',
  'hen-stories': 'Read the story. What is it?',
  'bug-stories': 'Read the story. Where is it?',
  // Word Song land 8 (content wave 4 § 3.3, § 4.3, § 6.1; Thomas approved
  // T2): bee and car words reuse duck words' lead and cue (D6); sheep
  // stories mix the three question words.
  'bee-words': 'Two letters, one sound!',
  'car-words': 'Two letters, one sound!',
  'sheep-stories': 'Read the story. Who, what or where?',
}

const sessionIntroId = (n: SkillNode) => `guide.session.intro.${n}`
const SESSION_HIDING_ID = 'guide.session.hiding'

/** The steps a Map peek can reach in `world`: all but its first, in order. */
function peekableSteps(world: World): SkillNode[] {
  return pathStepsOf(world).slice(1)
}

const peekOpenId = (n: SkillNode) => `guide.session.peek-open.${n}`
const peekCloseId = (n: SkillNode) => `guide.session.peek-close.${n}`
const replayOpenId = (n: SkillNode) => `guide.session.replay-open.${n}`
const replayCloseId = (n: SkillNode) => `guide.session.replay-close.${n}`
const STORY_READ_ID = 'guide.story.read'
const storyWordId = (word: string) => `guide.story.word.${word}`

/** Every guidance line: Hub, then session end, then in session. */
export const GUIDANCE_LINES: readonly GuidanceLine[] = buildLines()

/**
 * Lines whose MP3 is not rendered yet. Until the render commit adds their
 * clips (`scripts/renderGuidanceLinesLily.ts`, then `npm run export-audio`
 * in `mobile/`), the players walk their captions silently, and the
 * bundled-MP3 tests expect exactly these to be missing. The render commit
 * sets this list to `[]` (the tests fail while a listed clip exists).
 *
 * Now: content wave 5's Number Garden lines (§ 9.1): zeros' and adding big
 * numbers' leads, peeks and replays.
 */
export const GUIDANCE_LINES_AWAITING_RENDER: readonly string[] = [
  'hundreds-zeros',
  'add-two-digit',
].flatMap((n) => [
  `guide.session.intro.${n}`,
  `guide.session.peek-open.${n}`,
  `guide.session.peek-close.${n}`,
  `guide.session.replay-open.${n}`,
  `guide.session.replay-close.${n}`,
])

const BY_ID = new Map(GUIDANCE_LINES.map((l) => [l.id, l]))

/** Line for an id, or undefined for an id the catalogue does not define. */
export function guidanceLine(id: string): GuidanceLine | undefined {
  return BY_ID.get(id)
}

/** The intro lead line of `node` (§ 6.1), or undefined for a step with none. */
export function sessionIntroLine(node: SkillNode): GuidanceLine | undefined {
  return BY_ID.get(sessionIntroId(node))
}

/** "Read the story." (content wave 3 § 4.4): before a story card's beat. */
export function storyReadLine(): GuidanceLine {
  return BY_ID.get(STORY_READ_ID)!
}

/** A story word's own clip ("Fox."), or undefined for a word without one. */
export function storyWordLine(word: string): GuidanceLine | undefined {
  return BY_ID.get(storyWordId(word))
}

/** "Some flowers are hiding!" (§ 6.1): before a round's first missing number. */
export function sessionHidingLine(): GuidanceLine {
  return BY_ID.get(SESSION_HIDING_ID)!
}

/**
 * The Map peek's opener and closer for `node` (fast-track spec § 8), or
 * `null` for a step with none (a world's first step, which a peek never
 * reaches).
 */
export function peekLines(
  node: SkillNode,
): { open: GuidanceLine; close: GuidanceLine } | null {
  const open = BY_ID.get(peekOpenId(node))
  const close = BY_ID.get(peekCloseId(node))
  return open !== undefined && close !== undefined ? { open, close } : null
}

/**
 * The Map replay's opener and closer for `node` (map-tap-to-play § 6):
 * "Let's play <name> again!" / "You know <name>!". Every step has both.
 */
export function replayLines(node: SkillNode): {
  open: GuidanceLine
  close: GuidanceLine
} {
  const open = BY_ID.get(replayOpenId(node))
  const close = BY_ID.get(replayCloseId(node))
  if (open === undefined || close === undefined) {
    throw new Error(`no replay lines for ${node}`)
  }
  return { open, close }
}
