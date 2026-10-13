/**
 * Word Song rounds that must never show a picture of the answer: sight
 * words (Emma says the word, Marian taps one of three written words) and
 * simple sentences (a sentence with one gap, written-word chips), plus the
 * digraphs-th mouth cue's display states. Ported from the web Playwright
 * specs `sight-words-content` (test 3), `simple-sentences-content` (test 3)
 * and `digraphs-th-mouth-cue-display` (Phase 4 spec sort, items 18, 46, 49).
 * The sight-word and sentence plans are the live canon, parsed by core.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ADVANCE_AFTER_CORRECT_MS } from '@marian/core/shared/gameplayConstants'
import { wordSongSessionPlanFromServer } from '@marian/core/wordSong/planFromServer'
import type { WordSongSessionPlan } from '@marian/core/wordSong/wordSessionPlans'
import { fireEvent, screen, within } from '@testing-library/react-native'
import {
  advance,
  planOf,
  renderWordSong,
  say,
} from '../../../test/wordSongHarness'
import { REPO_ROOT } from '../../../test/webSource'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

function canonPlan(tier: string): WordSongSessionPlan {
  const file = resolve(
    REPO_ROOT,
    'public',
    'canon',
    'word-song',
    'level-1',
    `${tier}.json`,
  )
  return wordSongSessionPlanFromServer(
    JSON.parse(readFileSync(file, 'utf8')).plan,
  )
}

/** The three answer chips (not the row, not a chip's inner text). */
function chipWords(): string[] {
  return screen
    .getAllByTestId(/^word-song-chip-/)
    .map((c) => String(c.props.testID))
    .filter((id) => !id.startsWith('word-song-chip-text-'))
    .map((id) => id.replace('word-song-chip-', ''))
}

/** Each chip shows its word as written text, and nothing else. */
function expectWrittenWordChips(target: string) {
  const words = chipWords()
  expect(words).toHaveLength(3)
  expect(words.filter((w) => w === target)).toEqual([target])
  for (const w of words) {
    const c = screen.getByTestId(`word-song-chip-${w}`)
    const text = within(c).getByTestId('word-song-chip-text-written-word')
    expect(text.props.children).toBe(w)
    expect(c.props.accessibilityLabel).toBe(`Word ${w}`)
  }
  expect(
    screen.getAllByTestId('word-song-chip-text-written-word'),
  ).toHaveLength(3)
  // No picture anywhere: not the card, not on a chip.
  expect(screen.queryByTestId('word-song-word-picture')).toBeNull()
  expect(screen.queryAllByTestId(/^word-picture-/)).toHaveLength(0)
}

/** Walk the session: read, tap the answer, "Yes!", advance. */
async function walk(
  plan: WordSongSessionPlan,
  r: Awaited<ReturnType<typeof renderWordSong>>,
  check: (i: number, target: string) => void,
) {
  for (let i = 0; i < plan.problems.length; i++) {
    const target = plan.problems[i]!.target.word
    await say(r.voice.lines.at(-1)!)
    check(i, target)
    await fireEvent.press(screen.getByTestId(`word-song-chip-${target}`))
    await say(r.voice.lines.at(-1)!)
    await advance(ADVANCE_AFTER_CORRECT_MS)
  }
  expect(r.onSessionComplete).toHaveBeenCalledTimes(1)
}

describe('sight words (live canon)', () => {
  const plan = canonPlan('sight-words')

  it('the canon parses to 8 sight-word problems', () => {
    expect(plan.problems.map((p) => p.contentType)).toEqual(
      Array(8).fill('sight-word'),
    )
  })

  it('every round: no card, three written-word chips, one of them the target', async () => {
    const r = await renderWordSong({ plan })
    expect(screen.queryByTestId('word-song-word-card')).toBeNull()
    expect(screen.queryByTestId('word-song-letters-card')).toBeNull()
    expect(screen.queryByTestId('word-song-sentence-panel')).toBeNull()
    const seen: string[] = []
    await walk(plan, r, (_i, target) => {
      expectWrittenWordChips(target)
      seen.push(target)
    })
    expect(seen).toEqual(plan.problems.map((p) => p.target.word))
  })
})

describe('simple sentences (live canon)', () => {
  const plan = canonPlan('simple-sentences')

  it('the canon parses to 8 one-gap sentence problems', () => {
    expect(plan.problems.map((p) => p.contentType)).toEqual(
      Array(8).fill('simple-sentence'),
    )
    for (const p of plan.problems) {
      expect(p.sentenceFrame!.split('___')).toHaveLength(2)
    }
  })

  it('every round: one sentence panel with one gap, three written-word chips, no picture card', async () => {
    const r = await renderWordSong({ plan })
    await walk(plan, r, (_i, target) => {
      expect(screen.getAllByTestId('word-song-sentence-panel')).toHaveLength(1)
      expect(screen.getAllByTestId('word-song-sentence-gap')).toHaveLength(1)
      expect(screen.getAllByTestId('word-song-sentence-blank')).toHaveLength(1)
      expect(screen.queryByTestId('word-song-sentence-filled')).toBeNull()
      expectWrittenWordChips(target)
    })
  })

  it('the right answer fills the gap with the target word', async () => {
    const r = await renderWordSong({ plan })
    const target = plan.problems[0]!.target.word
    await say(r.voice.lines.at(-1)!)
    await fireEvent.press(screen.getByTestId(`word-song-chip-${target}`))
    expect(screen.queryByTestId('word-song-sentence-blank')).toBeNull()
    expect(screen.getByTestId('word-song-sentence-filled').props.children).toBe(
      target,
    )
  })
})

describe('th mouth cue', () => {
  const thPlan = planOf('blending-cv', ['thin', 'path', 'bath'])
  // Both cues are decorative, hidden from screen readers, so the query
  // has to include hidden elements.
  const hidden = { includeHiddenElements: true }
  const cues = () => ({
    intro: screen.queryAllByTestId('th-intro-panel', hidden).length,
    corner: screen.queryAllByTestId('th-corner-cue', hidden).length,
  })

  it('first encounter, while the session loads: the intro panel only', async () => {
    await renderWordSong({
      plan: thPlan,
      audioReady: false,
      digraphsThNodeLevel: 'intro',
      digraphsThFirstEncounter: true,
    })
    expect(cues()).toEqual({ intro: 1, corner: 0 })
  })

  it('first encounter, once the session is ready: the corner cue, no intro panel', async () => {
    await renderWordSong({
      plan: thPlan,
      digraphsThNodeLevel: 'intro',
      digraphsThFirstEncounter: true,
    })
    expect(cues()).toEqual({ intro: 0, corner: 1 })
  })

  it('practicing: the corner cue, never the intro panel', async () => {
    await renderWordSong({
      plan: thPlan,
      audioReady: false,
      digraphsThNodeLevel: 'practicing',
      digraphsThFirstEncounter: false,
    })
    expect(cues()).toEqual({ intro: 0, corner: 0 })
    screen.unmount()
    await renderWordSong({
      plan: thPlan,
      digraphsThNodeLevel: 'practicing',
      digraphsThFirstEncounter: false,
    })
    expect(cues()).toEqual({ intro: 0, corner: 1 })
  })

  it('locked or mastered: no cue at all', async () => {
    for (const level of ['locked', 'mastered'] as const) {
      await renderWordSong({
        plan: thPlan,
        digraphsThNodeLevel: level,
        digraphsThFirstEncounter: false,
      })
      expect(cues()).toEqual({ intro: 0, corner: 0 })
      screen.unmount()
    }
  })
})
