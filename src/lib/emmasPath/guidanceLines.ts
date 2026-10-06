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
 * only (its one runtime import is `pathLines.ts`, itself loadable by the
 * node-typed render scripts).
 */
import type { Land } from '../progress/lands'
import { pathLineSrc } from './pathLines'

/** A world (`'math'` | `'word-song'`). */
type World = Land['world']

export type GuidanceLineKind =
  | 'hub-suggest'
  | 'hub-sleeping'
  | 'hub-both-sleeping'
  | 'hub-woke'
  | 'hub-one-more'
  | 'end-right'
  | 'end-flower'
  | 'end-count'
  | 'end-sleeps'
  | 'end-path-opens'
  | 'end-not-yet-praise'
  | 'end-not-yet-again'

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
  return lines
}

/** Every guidance line, Hub first, then session end. */
export const GUIDANCE_LINES: readonly GuidanceLine[] = buildLines()

const BY_ID = new Map(GUIDANCE_LINES.map((l) => [l.id, l]))

/** Line for an id, or undefined for an id the catalogue does not define. */
export function guidanceLine(id: string): GuidanceLine | undefined {
  return BY_ID.get(id)
}
