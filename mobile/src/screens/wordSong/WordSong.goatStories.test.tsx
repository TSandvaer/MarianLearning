/**
 * Content wave 5's goat stories on the native Word Song
 * (`design/native/content-wave-5.md` § 7, AC 15): sheep stories' format
 * exactly. The lead "Read the story. Who, what or where?" (sheep stories'
 * text) plays once, before problem 1 (no "Read the story." right after
 * it); every later card opens with "Read the story."; the Where rows
 * answer "Yes! On the stool!" / "Yes! In the boot!". Until the goat scenes
 * are picked, a story reveals its answer's pack picture (the shipped
 * fallback, § 11). Fakes for Emma's voice, the session guide and the story
 * players.
 */
import {
  storiesOf,
  storyCorrectLine,
  storyGiveAnswerLine,
  type LittleStory,
} from '@marian/core/wordSong/littleStories'
import { wordSongSessionPlanFromServer } from '@marian/core/wordSong/planFromServer'
import { storyReadBeatMs } from '@marian/core/wordSong/wordRound'
import type { WordSongSessionPlan } from '@marian/core/wordSong/wordSessionPlans'
import { act, fireEvent, screen } from '@testing-library/react-native'
import type {
  SessionGuideLineId,
  SessionGuidePlayer,
  StoryGuideLineId,
  StoryGuidePlayer,
} from '../../audio'
import type { LineCallbacks } from '../../audio/linePlayback'
import {
  advance,
  flush,
  renderWordSong,
  say,
} from '../../../test/wordSongHarness'
import {
  STORY_REVEAL_DELAY_MS,
  STORY_REVEAL_HOLD_MS,
  STORY_REVEAL_READ_GAP_MS,
  STORY_SCENE_LAND_MS,
} from './WordSong'

const INTRO = 'guide.session.intro.goat-stories' as const
const GOAT = storiesOf('goat-stories')

function block(n: number, s: LittleStory) {
  return [
    { id: `word.p${n}.read`, text: s.question },
    { id: `word.p${n}.correct`, text: storyCorrectLine(s) },
    { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
    { id: `word.p${n}.hint`, text: s.story },
    { id: `word.p${n}.giveAnswer`, text: storyGiveAnswerLine(s) },
  ]
}

const PLAN: WordSongSessionPlan = wordSongSessionPlanFromServer(
  {
    id: 'goat-stories-level-1',
    label: 'goat-stories',
    utterances: GOAT.flatMap((s, i) => block(i + 1, s)),
  },
  { littleStories: true, step: 'goat-stories' },
)

interface FakeLine<Id> {
  id: Id
  opts: LineCallbacks
  end: () => void
}

function fakePlayer<Id extends string>() {
  const lines: FakeLine<Id>[] = []
  let active: FakeLine<Id> | null = null
  const player = {
    playLine: jest.fn(
      (id: Id, opts: LineCallbacks = {}) =>
        new Promise<void>((resolve) => {
          active?.end()
          const line: FakeLine<Id> = {
            id,
            opts,
            end: () => {
              if (active === line) active = null
              resolve()
            },
          }
          active = line
          lines.push(line)
        }),
    ),
    cancelActive: jest.fn(() => active?.end()),
    unload: jest.fn(),
  }
  return { lines, player }
}

async function endLine(line: { end: () => void; opts: LineCallbacks }) {
  await act(async () => {
    line.opts.onPlay?.()
    line.opts.onWordTick?.(0)
    line.end()
  })
  await flush()
}

async function renderGoat(extra: Parameters<typeof renderWordSong>[0] = {}) {
  const prompt = fakePlayer<StoryGuideLineId>()
  const words = fakePlayer<StoryGuideLineId>()
  const guide = fakePlayer<SessionGuideLineId>()
  const h = await renderWordSong({
    plan: PLAN,
    storyGuide: prompt.player as StoryGuidePlayer,
    storyWords: words.player as StoryGuidePlayer,
    sessionGuide: guide.player as SessionGuidePlayer,
    ...extra,
  })
  await flush()
  return { ...h, prompt, words, guide }
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('goat stories (AC 15)', () => {
  it('the 8 problems parse as little stories in canon order, goat-1 … goat-8', () => {
    expect(PLAN.problems.map((p) => [p.contentType, p.storyId])).toEqual(
      GOAT.map((s) => ['little-story', s.id]),
    )
  })

  it('the lead plays once before problem 1, with no "Read the story." after it; the beat counts from its end', async () => {
    const h = await renderGoat({ sessionIntro: INTRO })
    expect(h.guide.lines.map((l) => l.id)).toEqual([INTRO])
    await endLine(h.guide.lines[0]!)
    // Goat 1: 10 words, 15 s.
    expect(storyReadBeatMs(PLAN.problems[0]!)).toBe(15_000)
    await advance(14_999)
    expect(h.voice.lines).toHaveLength(0)
    await advance(1)
    expect(h.prompt.lines).toHaveLength(0)
    expect(h.voice.texts()).toEqual(['Who sat in the boat?'])
  })

  it('P1–P8 in order: the mixed questions, the answers and their correct lines; the lead never again; "Read the story." on P2–P8', async () => {
    const h = await renderGoat({ sessionIntro: INTRO })
    await endLine(h.guide.lines[0]!)
    const heard: string[] = []
    for (let i = 0; i < 8; i++) {
      const s = GOAT[i]!
      if (i > 0) {
        expect(h.prompt.lines.at(-1)!.id).toBe('guide.story.read')
        await endLine(h.prompt.lines.at(-1)!)
      }
      await advance(storyReadBeatMs(PLAN.problems[i]!))
      const question = h.voice.lines.at(-1)!
      expect(question.text).toBe(s.question)
      await say(question)
      await fireEvent.press(screen.getByTestId(`word-song-chip-${s.answer}`))
      await flush()
      const correct = h.voice.lines.at(-1)!
      heard.push(correct.text)
      await say(correct)
      await advance(
        STORY_REVEAL_DELAY_MS + STORY_SCENE_LAND_MS + STORY_REVEAL_READ_GAP_MS,
      )
      // No goat scene yet (§ 10.2 comes after the pack picks): the
      // answer's pack picture is revealed instead (§ 11).
      if (i === 0) {
        expect(screen.getByTestId('word-story-scene-picture')).toBeTruthy()
        expect(screen.queryByTestId('word-story-scene-art')).toBeNull()
      }
      const story = h.voice.lines.at(-1)!
      expect(story.text).toBe(s.story)
      await say(story)
      await advance(STORY_REVEAL_HOLD_MS)
    }
    expect(heard).toEqual([
      'Yes! The goat!',
      'Yes! The broom!',
      'Yes! On the stool!',
      'Yes! The spoon!',
      'Yes! The snail!',
      'Yes! In the boot!',
      'Yes! The goat!',
      'Yes! The hoop!',
    ])
    expect(h.guide.lines.map((l) => l.id)).toEqual([INTRO])
    expect(h.prompt.lines).toHaveLength(7)
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
  })

  it('wrong 3 gives the answer: "This one is the stool."', async () => {
    const h = await renderGoat({
      plan: { ...PLAN, problems: [{ ...PLAN.problems[2]!, index: 1 }] },
    })
    await endLine(h.prompt.lines[0]!)
    await advance(storyReadBeatMs(PLAN.problems[2]!))
    await say(h.voice.lines.at(-1)!)
    for (let k = 0; k < 3; k++) {
      await fireEvent.press(screen.getByTestId('word-song-chip-hoop'))
      await flush()
      for (let n = 0; n < 4; n++) {
        const last = h.voice.lines.at(-1)
        if (last === undefined) break
        await say(last)
        await advance(1_000)
      }
    }
    expect(h.voice.texts()).toContain('This one is the stool.')
  })
})
