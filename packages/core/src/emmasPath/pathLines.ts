/**
 * Emma's Path Lily line catalogue (Emma's Path 10/10, ClickUp 123jpnbc3du).
 *
 * Every line of the audio script in `design/emmas-path/emmas-path-spec.md`
 * §4 (map open, stop tap, gate tap, locked-stop requirement, session-end
 * beats), expanded to one entry per variant: line id → text → bundled MP3.
 * Each line is baked WHOLE (team/DECISIONS.md 2026-10-05) — no name +
 * carrier splicing, so a line that names two stages (the locked `later`
 * form, closed gates, unlocks) has one entry per stage pair that can occur.
 *
 * Stage names come from `STAGE_SPOKEN_NAMES` (spec §4.3); land names from
 * `LANDS` with "&" read as "and". Order inside a world = the land table's
 * flattened order, which `lands.test.ts` locks to `MATH_TREE` /
 * `LITERACY_TREE`; `pathLines.test.ts` locks the predecessor used here to
 * `PREREQUISITES[node][0]`.
 *
 * MP3s live under `public/assets/audio/path/` and are rendered by
 * `scripts/renderPathLinesLily.ts` from `PATH_LINES`, so text and audio
 * cannot drift. Wiring the lines into the map and session-end screens is
 * the build tickets' job (8/10, 9/10); this module is data only.
 *
 * Pure data module: type-only imports plus `lands.ts` (itself type-only), so
 * the node-typed render script can load it.
 */
import { LANDS, type Land } from '../progress/lands'
import type { SkillNode } from '../progress/types'
import {
  STAGE_SPOKEN_NAMES,
  capitalizeSpokenName,
} from '../sessionEnd/friendlyNodeName'

/** A world (`'math'` | `'word-song'`). */
type MasteryTrack = Land['world']

export type PathLineKind =
  | 'open'
  | 'open-done'
  | 'stop'
  | 'land'
  | 'locked-next'
  | 'locked-later'
  | 'gate-locked'
  | 'end-bud'
  | 'end-unlock'
  | 'end-land'
  | 'end-land-no-number'

export interface PathLine {
  /** Dotted id, e.g. `path.locked.later.mult-6-9.add-to-10`. */
  id: string
  kind: PathLineKind
  world: MasteryTrack
  text: string
  /**
   * What the render sends to Lily when it is not `text` (as guidance
   * lines' `input`): a `THEN_THIS_INPUT_STEPS` step's locked-next line goes
   * as "<Name>! First, <previous>; then this!" (content wave 5 § 9.1; the
   * ". Then this!" take came back scratchy twice, #599 and #607 take 3).
   * The caption stays `text`. Undefined = `text`.
   */
  input?: string
  /** Bundled MP3 path relative to `public/`; `null` = not baked yet
   *  (a `DEFERRED_PATH_LINE_KINDS` line). */
  src: string | null
}

/**
 * The steps whose locked-next line renders from "…; then this!" (content
 * wave 5 § 9.1). Only steps whose line has no clip yet: a shipped line keeps
 * no input, so nothing already rendered re-renders. Real blending § 11:
 * sounding out's line is new, and cat words' changes text ("First,
 * sounding out.").
 */
export const THEN_THIS_INPUT_STEPS: ReadonlySet<SkillNode> = new Set<SkillNode>(
  ['sounding-out', 'cvc-words'],
)

/**
 * One line's render input, by line id: a one-word clip goes to Lily as
 * "Word," (one word alone reads as an abbreviation: "Sat." came back as
 * "Saturday", #607; content wave 5 lesson 3). The caption stays `text`.
 */
const LINE_INPUTS: Readonly<Record<string, string>> = {}

/**
 * Two-name forms, one bake per (stop, current step) pair: 111 `locked-later`
 * + 38 `gate-locked` lines. Deferred by Thomas 2026-10-05 until he has heard
 * the first batch (140 one-name lines); their text is final, their audio is
 * not rendered and `src` is `null`.
 */
export const DEFERRED_PATH_LINE_KINDS: ReadonlySet<PathLineKind> = new Set([
  'locked-later',
  'gate-locked',
])

const WORLDS: readonly MasteryTrack[] = ['math', 'word-song']

/** Steps of one world in tree order (flattened land table). */
export function pathStepsOf(world: MasteryTrack): SkillNode[] {
  return LANDS.filter((l) => l.world === world).flatMap((l) => [...l.nodes])
}

/** Spoken land name: `lands.ts` name with "&" read as "and" (spec §4.3). */
export function spokenLandName(name: string): string {
  return name.replace(/\s*&\s*/g, ' and ')
}

const name = (n: SkillNode) => STAGE_SPOKEN_NAMES[n]
const Name = (n: SkillNode) => capitalizeSpokenName(STAGE_SPOKEN_NAMES[n])

/** MP3 path for a line id: dots → dashes under /assets/audio/path/. */
export function pathLineSrc(id: string): string {
  return `/assets/audio/path/${id.replace(/\./g, '-')}.mp3`
}

/** Both worlds' "path complete" open line has the same words → one file. */
const OPEN_DONE_SRC = '/assets/audio/path/path-open-done.mp3'

function buildLines(): PathLine[] {
  const lines: PathLine[] = []
  const add = (
    id: string,
    kind: PathLineKind,
    world: MasteryTrack,
    text: string,
    src: string | null = DEFERRED_PATH_LINE_KINDS.has(kind)
      ? null
      : pathLineSrc(id),
    input: string | undefined = LINE_INPUTS[id],
  ) =>
    lines.push({
      id,
      kind,
      world,
      text,
      ...(input === undefined ? {} : { input }),
      src,
    })

  for (const world of WORLDS) {
    const steps = pathStepsOf(world)
    const lands = LANDS.filter((l) => l.world === world)

    // §4.1 map open / stop tap / gate tap
    for (const n of steps)
      add(
        `path.open.${n}`,
        'open',
        world,
        `Here is your path! You are on ${name(n)}.`,
      )
    add(
      `path.open.done.${world}`,
      'open-done',
      world,
      'You did all of it! Look at your flowers!',
      OPEN_DONE_SRC,
    )
    for (const n of steps) add(`path.stop.${n}`, 'stop', world, `${Name(n)}.`)
    for (const land of lands)
      add(
        `path.land.${world}.${land.number}`,
        'land',
        world,
        `Land ${land.number}: ${spokenLandName(land.name)}.`,
      )

    // §4.2 locked stops. A stop at index j is locked while the current step
    // is at index < j. `next` = its predecessor is current; `later` = the
    // current step is further back (index ≤ j − 2) and is named instead.
    steps.forEach((n, j) => {
      if (j === 0) return
      add(
        `path.locked.next.${n}`,
        'locked-next',
        world,
        `${Name(n)}! First, ${name(steps[j - 1])}. Then this!`,
        undefined,
        THEN_THIS_INPUT_STEPS.has(n)
          ? `${Name(n)}! First, ${name(steps[j - 1])}; then this!`
          : undefined,
      )
      for (let i = 0; i <= j - 2; i++)
        add(
          `path.locked.later.${n}.${steps[i]}`,
          'locked-later',
          world,
          `${Name(n)}! Not yet. First, ${name(steps[i])}.`,
        )
    })
    // Closed gate = its land's first step is locked = current is before it.
    for (const land of lands) {
      if (land.number === 1) continue
      const first = steps.indexOf(land.nodes[0])
      for (let i = 0; i < first; i++)
        add(
          `path.gate.locked.${world}.${land.number}.${steps[i]}`,
          'gate-locked',
          world,
          `Land ${land.number}: ${spokenLandName(land.name)}! First, ${name(steps[i])}.`,
        )
    }

    // §4.4 session-end beats
    for (const n of steps)
      add(
        `end.bud.${n}`,
        'end-bud',
        world,
        `Look! A new flower for ${name(n)}!`,
      )
    steps.forEach((n, j) => {
      if (j === 0) return
      add(
        `end.unlock.${n}`,
        'end-unlock',
        world,
        `You learned ${name(steps[j - 1])}! Now you can do ${name(n)}!`,
      )
    })
    for (const land of lands) {
      if (land.number === 1) continue
      const landName = spokenLandName(land.name)
      add(
        `end.land.${world}.${land.number}`,
        'end-land',
        world,
        `A new land! Land ${land.number}: ${landName}!`,
      )
      // §6: `showLevelToMarian === false` drops the "Land {n}" words.
      add(
        `end.land.${world}.${land.number}.no-number`,
        'end-land-no-number',
        world,
        `A new land: ${landName}!`,
      )
    }
  }
  return lines
}

/** Every Emma's Path line, grouped by world then by script section. */
export const PATH_LINES: readonly PathLine[] = buildLines()

/** Lines with a bundled MP3 — the render script's and voice-QA's input. */
export const BAKED_PATH_LINES: readonly (PathLine & { src: string })[] =
  PATH_LINES.filter((l): l is PathLine & { src: string } => l.src !== null)

/**
 * Baked lines whose MP3 is not rendered yet (as `GUIDANCE_LINES_AWAITING_
 * RENDER` in `guidanceLines.ts`). They stay in `BAKED_PATH_LINES`, the
 * render script's input; until the render commit adds their clips
 * (`scripts/renderPathLinesLily.ts`, then `npm run export-audio` in
 * `mobile/`) the Map walks their captions silently, and the bundled-MP3
 * tests expect exactly these to be missing. The render commit sets this
 * list to `[]`.
 *
 * Now: real blending's 5 sounding-out lines and the 2 cat-words lines whose
 * text changed (§ 11): their old clips said "blending sounds", so they are
 * removed until the render.
 */
export const PATH_LINES_AWAITING_RENDER: readonly string[] = [
  'path.open.sounding-out',
  'path.stop.sounding-out',
  'path.locked.next.sounding-out',
  'end.bud.sounding-out',
  'end.unlock.sounding-out',
  'path.locked.next.cvc-words',
  'end.unlock.cvc-words',
]

const BY_ID = new Map(PATH_LINES.map((l) => [l.id, l]))

/** Line for an id, or undefined for an id the script does not define. */
export function pathLine(id: string): PathLine | undefined {
  return BY_ID.get(id)
}
