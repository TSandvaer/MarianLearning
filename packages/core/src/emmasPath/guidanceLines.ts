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

export interface GuidanceLine {
  /** Dotted id, e.g. `guide.hub.suggest.math`. */
  id: string
  kind: GuidanceLineKind
  /** The world the line suggests; `null` for world-free lines. */
  world: World | null
  text: string
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
  ) => lines.push({ id, kind, world, text, src: pathLineSrc(id) })

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
  return lines
}

/**
 * The intro lead line of each new step (§ 6.1). A step without an entry has
 * no intro. Each text is the step's own, not a template: "Two letters, one
 * sound!" names duck words' idea, not their name.
 */
const SESSION_INTRO_TEXTS: Readonly<Partial<Record<SkillNode, string>>> = {
  // Word Song land 6 (content wave 1 § 3.3, § 4.3).
  'duck-words': 'Two letters, one sound!',
  'crab-words': 'Read all the letters!',
}

const sessionIntroId = (n: SkillNode) => `guide.session.intro.${n}`
const SESSION_HIDING_ID = 'guide.session.hiding'

/** The steps a Map peek can reach in `world`: all but its first, in order. */
function peekableSteps(world: World): SkillNode[] {
  return pathStepsOf(world).slice(1)
}

const peekOpenId = (n: SkillNode) => `guide.session.peek-open.${n}`
const peekCloseId = (n: SkillNode) => `guide.session.peek-close.${n}`

/** Every guidance line: Hub, then session end, then in session. */
export const GUIDANCE_LINES: readonly GuidanceLine[] = buildLines()

/**
 * Lines whose MP3 is not rendered yet. Until the render commit adds their
 * clips (`scripts/renderGuidanceLinesLily.ts`, then `npm run export-audio`
 * in `mobile/`), the players walk their captions silently, and the
 * bundled-MP3 tests expect exactly these to be missing. The render commit
 * sets this list to `[]` (the tests fail while a listed clip exists).
 *
 * Now: content wave 1's lead lines (§ 6.1) and its Word Song peek pairs
 * (duck words, crab words; `design/native/content-wave-1.md` § 6.2 rows
 * 3-6).
 */
export const GUIDANCE_LINES_AWAITING_RENDER: readonly string[] = [
  // In `GUIDANCE_LINES` order (the bundled-MP3 test compares the lists).
  'guide.session.peek-open.duck-words',
  'guide.session.peek-open.crab-words',
  'guide.session.peek-close.duck-words',
  'guide.session.peek-close.crab-words',
  'guide.session.intro.duck-words',
  'guide.session.intro.crab-words',
  SESSION_HIDING_ID,
]

const BY_ID = new Map(GUIDANCE_LINES.map((l) => [l.id, l]))

/** Line for an id, or undefined for an id the catalogue does not define. */
export function guidanceLine(id: string): GuidanceLine | undefined {
  return BY_ID.get(id)
}

/** The intro lead line of `node` (§ 6.1), or undefined for a step with none. */
export function sessionIntroLine(node: SkillNode): GuidanceLine | undefined {
  return BY_ID.get(sessionIntroId(node))
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
