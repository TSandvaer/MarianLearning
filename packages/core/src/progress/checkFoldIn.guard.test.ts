/**
 * Guard for the check fold-in (Dave 2026-10-25): every step WITHOUT the
 * graduation check keeps its flowers and Emma's lines byte for byte. The
 * golden file was written by this test on origin/main 2cdfa910, before the
 * fold-in touched any code (`WRITE_GOLDEN=1 npx vitest run <this file>`);
 * the test now replays every scenario and compares.
 *
 * A scenario: one step, a parent setting, k good days on earlier days and
 * one of five "today" shapes. Per scenario the summary holds the step's
 * `nodeProgress`, both Hub cards, Emma's Hub lines (no wake-up, a wake-up
 * in the step's world, in both), the step's map stop, and the Session End
 * guidance of today's session. Marian's iPad today (cat words grown, dog
 * words open) is in the set too: the fold-in must not touch a grown row.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildHubCardModel, type HubCardModel } from '../hub/hubCardModel'
import { pickGuidanceLines, suggestWorld } from '../hub/hubGuidance'
import { placeAtStep } from '../learners/startDoc'
import { buildMapModel } from '../map/mapModel'
import { sessionEndGuidance } from '../sessionEnd/sessionEndGuidance'
import { defaultProgress } from './defaults'
import { applyMasteryRule, trackOf } from './mastery'
import { nodeProgress } from './nodeProgress'
import { seedUnlocksCelebrated, sessionEndBeat } from './pathBeats'
import type { ParentSettings, Progress, SkillNode } from './types'

const GOLDEN = join(__dirname, 'checkFoldIn.guard.golden.json')
const TODAY = '2026-10-10'

/** 2026-10-(10 - daysAgo) at `hour` local. */
const at = (daysAgo: number, hour = 18) =>
  new Date(2026, 9, 10 - daysAgo, hour, 0).toISOString()

const entry = (node: SkillNode, dateISO: string, successRate: number) => ({
  dateISO,
  skillFocus: [node] as Progress['history'][number]['skillFocus'],
  successRate,
})

const SETTINGS: Record<
  string,
  Pick<ParentSettings, 'crossDayEnforcement' | 'autoPromote'> & {
    percent: number
    sessions: number
  }
> = {
  '80/2 off': {
    percent: 0.8,
    sessions: 2,
    crossDayEnforcement: false,
    autoPromote: true,
  },
  '87.5/3 on': {
    percent: 0.875,
    sessions: 3,
    crossDayEnforcement: true,
    autoPromote: true,
  },
  '87.5/3 on, auto off': {
    percent: 0.875,
    sessions: 3,
    crossDayEnforcement: true,
    autoPromote: false,
  },
}

/** Today's sessions before the one that ends now, and its score. */
const TODAY_SHAPES: Record<string, { earlier: number[]; now: number }> = {
  good: { earlier: [], now: 1 },
  weak: { earlier: [], now: 5 / 8 },
  'good, then good': { earlier: [1], now: 1 },
  'good, then weak': { earlier: [1], now: 5 / 8 },
  'weak, then good': { earlier: [5 / 8], now: 1 },
}

const STEPS: readonly SkillNode[] = [
  'add-to-10',
  'letter-sounds',
  'blending-cv',
  'sounding-out',
  'cvc-words-short-o',
]

function withSettings(p: Progress, key: string): Progress {
  const s = SETTINGS[key]!
  const threshold = { percent: s.percent, sessions: s.sessions }
  return {
    ...p,
    parentSettings: {
      ...p.parentSettings!,
      masteryThreshold: { math: threshold, 'word-song': threshold },
      crossDayEnforcement: s.crossDayEnforcement,
      autoPromote: s.autoPromote,
    },
  }
}

const slotStr = (slots: readonly string[]) => slots.map((s) => s[0]).join('')

function cardSummary(c: HubCardModel): string {
  return [
    c.current,
    slotStr(c.slots),
    c.slotDays.map((d) => d ?? '-').join(','),
    `t=${c.earnedToday}`,
    `u=${c.flowersToUnlock}`,
    `c=${c.complete}`,
    `n=${c.unlocksNext}`,
  ].join(' ')
}

function summarise(before: Progress, after: Progress, node: SkillNode) {
  const world = trackOf(node)!
  const np = nodeProgress(after, node)
  const ng = buildHubCardModel(after, 'math', TODAY)
  const ws = buildHubCardModel(after, 'word-song', TODAY)
  const suggestion = suggestWorld(ng, ws, null)
  const hubLines = (wakeWorlds: ('math' | 'word-song')[]) =>
    pickGuidanceLines({
      numberGarden: ng,
      wordSong: ws,
      suggestion,
      wakeWorlds,
    })
      .map((id) => id.replace('guide.', ''))
      .join(',')
  const stop = buildMapModel(after, world)
    .lands.flatMap((l) => l.stops)
    .find((s) => s.node === node)!
  const g = sessionEndGuidance({
    before,
    after,
    node,
    beat: sessionEndBeat(before, after, node),
    totalCorrect: Math.round((after.history.at(-1)?.successRate ?? 0) * 8),
    today: TODAY,
    nudgeSaidToday: false,
  })
  return {
    node: [
      np.level,
      `${np.goodDays}/${np.requiredDays}`,
      `last=${np.lastSuccessRate}`,
      `awaiting=${np.awaitingNovelWordCheck}`,
      ...(np.vowels ?? []).map(
        (v) => `${v.vowel}:${v.state}:${v.goodDays}/${v.requiredDays}`,
      ),
    ].join(' '),
    hub: [
      `ng: ${cardSummary(ng)}`,
      `ws: ${cardSummary(ws)}`,
      `suggest=${suggestion}`,
      `lines=${hubLines([])}`,
      `woke=${hubLines([world])}`,
    ].join(' | '),
    map: `${stop.state} ${stop.buds.map((b) => b.map((x) => (x ? 1 : 0)).join('')).join('/')} nearly=${stop.nearlyThere}`,
    end: [
      g.day,
      `${slotStr(g.slotsBefore)}>${slotStr(g.slotsAfter)}`,
      `new=${g.newSlot}`,
      `bonus=${g.bonusSlots.join(',')}`,
      `count=${g.countText}`,
      g.lines.map((l) => l.id.replace('guide.end.', '')).join(','),
    ].join(' '),
  }
}

/** One scenario: `before` (k earlier good days + today's earlier sessions) and `after`. */
function scenario(
  node: SkillNode,
  settingsKey: string,
  k: number,
  shape: string,
): { before: Progress; after: Progress } {
  const placed = placeAtStep(defaultProgress(), node)
  const start = withSettings(
    {
      ...placed,
      skillLevels: { ...placed.skillLevels, [node]: 'practicing' },
      goodDays: {},
    },
    settingsKey,
  )
  const { earlier, now } = TODAY_SHAPES[shape]!
  const history = [
    ...Array.from({ length: k }, (_, i) => entry(node, at(k - i), 1)),
    ...earlier.map((rate, i) => entry(node, at(0, 9 + i), rate)),
  ]
  const before = applyMasteryRule({ ...start, history })
  const seeded = { ...before, unlocksCelebrated: seedUnlocksCelebrated(before) }
  const after = applyMasteryRule({
    ...seeded,
    history: [...seeded.history, entry(node, at(0, 18), now)],
  })
  return { before: seeded, after }
}

/** Marian's iPad on 2026-10-25: cat words grown by a passed one-session check, dog words open. */
function marianIpad(): { before: Progress; after: Progress } {
  const placed = placeAtStep(defaultProgress(), 'cvc-words-short-o')
  const start = withSettings(placed, '87.5/3 on')
  const history = [
    entry('cvc-words', at(3), 1),
    entry('cvc-words', at(2), 1),
    {
      ...entry('cvc-words', at(1), 1),
      novelPoolSuccessRate: 1,
    },
  ]
  const before = { ...start, history: history as Progress['history'] }
  const seeded = { ...before, unlocksCelebrated: seedUnlocksCelebrated(before) }
  const after = applyMasteryRule({
    ...seeded,
    history: [...seeded.history, entry('cvc-words-short-o', at(0), 1)],
  })
  return { before: seeded, after }
}

function allSummaries(): Record<string, ReturnType<typeof summarise>> {
  const out: Record<string, ReturnType<typeof summarise>> = {}
  for (const node of STEPS) {
    for (const settingsKey of Object.keys(SETTINGS)) {
      for (const k of [0, 1, 2, 3]) {
        for (const shape of Object.keys(TODAY_SHAPES)) {
          const { before, after } = scenario(node, settingsKey, k, shape)
          out[`${node} | ${settingsKey} | ${k} earlier | ${shape}`] = summarise(
            before,
            after,
            node,
          )
        }
      }
    }
  }
  const ipad = marianIpad()
  out['marian ipad: cat words grown | dog words'] = summarise(
    ipad.before,
    ipad.after,
    'cvc-words-short-o',
  )
  out['marian ipad: cat words grown | cat words'] = summarise(
    ipad.before,
    ipad.after,
    'cvc-words',
  )
  return out
}

describe('check fold-in guard: steps without the check are byte-identical', () => {
  it('every scenario matches the golden written on main before the fold-in', () => {
    const now = allSummaries()
    if (process.env.WRITE_GOLDEN === '1') {
      writeFileSync(GOLDEN, `${JSON.stringify(now, null, 2)}\n`)
    }
    expect(existsSync(GOLDEN)).toBe(true)
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as typeof now
    expect(Object.keys(now)).toEqual(Object.keys(golden))
    for (const key of Object.keys(golden)) {
      expect({ key, ...now[key] }).toEqual({ key, ...golden[key] })
    }
  })
})
