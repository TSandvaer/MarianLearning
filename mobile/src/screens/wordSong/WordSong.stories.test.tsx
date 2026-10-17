/**
 * Content wave 3's little stories on the native Word Song
 * (`design/native/content-wave-3.md` § 4.4, § 4.5, AC 11–AC 14), decode
 * first:
 * - the card shows with no picture and no chips; "Read the story." (none
 *   right after the step's own lead; after an opener, 400 ms later); the
 *   beat (15 s for fox 1's 10 words, foreground time; a word tap holds it
 *   ≥ 2 s); the question, as the chips mount, closed until it ends;
 * - a word tap plays that word's clip and lights it; inert while Emma
 *   speaks; records nothing;
 * - wrong 1 asks again, wrong 2 reads the story with the read-along and
 *   asks again, wrong 3 gives the answer — never a red X;
 * - a right tap: "Yes! The fox!", the chips go, the scene (the answer's
 *   picture until the scenes exist) enters, Emma reads the story with the
 *   read-along (the ribbon keeps its line), 800 ms, the next card.
 * Fakes for Emma's voice, the session guide and the story players.
 */
import {
  LITTLE_STORIES,
  storiesOf,
  storyCorrectLine,
  storyGiveAnswerLine,
  type LittleStory,
  type StoryNode,
} from '@marian/core/wordSong/littleStories'
import { wordSongSessionPlanFromServer } from '@marian/core/wordSong/planFromServer'
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
  type Line,
} from '../../../test/wordSongHarness'
import {
  STORY_ASK_AGAIN_MS,
  STORY_READ_DARK_MS,
  STORY_REVEAL_DELAY_MS,
  STORY_REVEAL_HOLD_MS,
  STORY_REVEAL_READ_GAP_MS,
  STORY_SCENE_LAND_MS,
} from './WordSong'

function block(n: number, s: LittleStory) {
  return [
    { id: `word.p${n}.read`, text: s.question },
    { id: `word.p${n}.correct`, text: storyCorrectLine(s) },
    { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
    { id: `word.p${n}.hint`, text: s.story },
    { id: `word.p${n}.giveAnswer`, text: storyGiveAnswerLine(s) },
  ]
}

/** A story step's 8 canon problems, as the native app parses them. */
function storyPlan(node: StoryNode): WordSongSessionPlan {
  return wordSongSessionPlanFromServer(
    {
      id: `${node}-level-1`,
      label: node,
      utterances: storiesOf(node).flatMap((s, i) => block(i + 1, s)),
    },
    { littleStories: true },
  )
}

const FOX = storyPlan('fox-stories')
const FOX_1 = LITTLE_STORIES[0]!
const FOX_2 = LITTLE_STORIES[1]!

interface FakeLine<Id> {
  id: Id
  opts: LineCallbacks
  end: () => void
}

/** A manifest-line player the test drives (the guide's or the stories'). */
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

async function renderStory(extra: Parameters<typeof renderWordSong>[0] = {}) {
  const prompt = fakePlayer<StoryGuideLineId>()
  const words = fakePlayer<StoryGuideLineId>()
  const guide = fakePlayer<SessionGuideLineId>()
  const h = await renderWordSong({
    plan: FOX,
    storyGuide: prompt.player as StoryGuidePlayer,
    storyWords: words.player as StoryGuidePlayer,
    sessionGuide: guide.player as SessionGuidePlayer,
    ...extra,
  })
  await flush()
  return { ...h, prompt, words, guide }
}

type StoryHarness = Awaited<ReturnType<typeof renderStory>>

const chips = () => screen.queryByTestId('word-song-chips')
const scene = () => screen.queryByTestId('word-story-scene')
const lit = () =>
  screen
    .queryAllByTestId(/^word-story-lit-\d+$/)
    .map((n) => Number(String(n.props.testID).replace('word-story-lit-', '')))
const lastVoice = (h: StoryHarness): Line => h.voice.lines.at(-1)!

/** "Read the story." ends, the 15 s beat runs out: the question starts. */
async function toQuestion(h: StoryHarness, beat = 15_000) {
  await endLine(h.prompt.lines.at(-1)!)
  await advance(beat)
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('the reading beat (AC 11)', () => {
  it('the card shows, no chip and no picture; the question starts 15,000 ms after "Read the story." ends', async () => {
    const h = await renderStory()
    expect(screen.getByTestId('word-story').props.accessibilityLabel).toBe(
      FOX_1.story,
    )
    expect(screen.getAllByTestId(/^word-story-word-\d+$/)).toHaveLength(10)
    expect(h.prompt.lines.map((l) => l.id)).toEqual(['guide.story.read'])
    expect(chips()).toBeNull()
    expect(scene()).toBeNull()
    expect(screen.queryAllByTestId(/^word-picture-/)).toHaveLength(0)
    await endLine(h.prompt.lines[0]!)
    await advance(14_999)
    expect(h.voice.lines).toHaveLength(0)
    expect(chips()).toBeNull()
    await advance(1)
    expect(h.voice.texts()).toEqual([FOX_1.question])
    // The chips mount with the question, closed until it ends.
    expect(chips()).not.toBeNull()
    expect(screen.queryAllByTestId(/^word-picture-/)).toHaveLength(3)
    await fireEvent.press(screen.getByTestId('word-song-chip-fox'))
    await flush()
    expect(h.sfx.sparkle.play).not.toHaveBeenCalled()
    await say(lastVoice(h))
    await fireEvent.press(screen.getByTestId('word-song-chip-fox'))
    await flush()
    expect(h.sfx.sparkle.play).toHaveBeenCalledTimes(1)
  })

  it('a word tap at 14,000 ms moves the question to 16,000', async () => {
    const h = await renderStory()
    await endLine(h.prompt.lines[0]!)
    await advance(14_000)
    await fireEvent.press(screen.getByTestId('word-story-word-1'))
    await flush()
    await advance(1_999)
    expect(h.voice.lines).toHaveLength(0)
    await advance(1)
    expect(h.voice.texts()).toEqual([FOX_1.question])
  })

  it('counts foreground time only: 5 s in the background add nothing', async () => {
    const h = await renderStory()
    await endLine(h.prompt.lines[0]!)
    await advance(10_000)
    await act(async () => h.vis.set(true))
    await advance(5_000)
    await act(async () => h.vis.set(false))
    await advance(4_999)
    expect(h.voice.lines).toHaveLength(0)
    await advance(1)
    expect(h.voice.texts()).toEqual([FOX_1.question])
  })

  it('right after the step\'s own lead: no "Read the story.", the beat counts from the lead\'s end', async () => {
    const h = await renderStory({
      sessionIntro: 'guide.session.intro.fox-stories',
    })
    expect(h.guide.lines.map((l) => l.id)).toEqual([
      'guide.session.intro.fox-stories',
    ])
    await endLine(h.guide.lines[0]!)
    await advance(15_000)
    expect(h.prompt.lines).toHaveLength(0)
    expect(h.voice.texts()).toEqual([FOX_1.question])
  })

  it('after a peek opener: the opener, 400 ms, "Read the story.", the beat', async () => {
    const h = await renderStory({ peek: 'fox-stories' })
    expect(h.guide.lines.map((l) => l.id)).toEqual([
      'guide.session.peek-open.fox-stories',
    ])
    await endLine(h.guide.lines[0]!)
    await advance(399)
    expect(h.prompt.lines).toHaveLength(0)
    await advance(1)
    expect(h.prompt.lines.map((l) => l.id)).toEqual(['guide.story.read'])
    await toQuestion(h)
    expect(h.voice.texts()).toEqual([FOX_1.question])
  })
})

describe('word taps (AC 13)', () => {
  it('a tap plays that word alone and lights it, for at least 400 ms', async () => {
    const h = await renderStory()
    await endLine(h.prompt.lines[0]!)
    await fireEvent.press(screen.getByTestId('word-story-word-1'))
    await flush()
    expect(h.words.lines.map((l) => l.id)).toEqual(['guide.story.word.fox'])
    expect(lit()).toEqual([1])
    await endLine(h.words.lines[0]!)
    await advance(399)
    expect(lit()).toEqual([1])
    await advance(1)
    expect(lit()).toEqual([])
  })

  it('a new tap cuts the last; "Rug." has no comma or stop in its id', async () => {
    const h = await renderStory()
    await endLine(h.prompt.lines[0]!)
    await fireEvent.press(screen.getByTestId('word-story-word-1'))
    await flush()
    await fireEvent.press(screen.getByTestId('word-story-word-5'))
    await flush()
    expect(h.words.lines.map((l) => l.id)).toEqual([
      'guide.story.word.fox',
      'guide.story.word.rug',
    ])
    expect(lit()).toEqual([5])
  })

  it('inert while Emma speaks; records nothing: no sound effect, no pose, no answer', async () => {
    const h = await renderStory()
    // "Read the story." in flight.
    await fireEvent.press(screen.getByTestId('word-story-word-1'))
    await flush()
    expect(h.words.lines).toHaveLength(0)
    await endLine(h.prompt.lines[0]!)
    const poses = h.poses.length
    await fireEvent.press(screen.getByTestId('word-story-word-1'))
    await flush()
    expect(h.words.lines).toHaveLength(1)
    expect(h.poses).toHaveLength(poses)
    for (const s of [h.sfx.sparkle, h.sfx.poof, h.sfx.plink])
      expect(s.play).not.toHaveBeenCalled()
    // The question in flight: inert again.
    await advance(15_000)
    await fireEvent.press(screen.getByTestId('word-story-word-2'))
    await flush()
    expect(h.words.lines).toHaveLength(1)
    // After it: live (she may re-read).
    await say(lastVoice(h))
    await fireEvent.press(screen.getByTestId('word-story-word-2'))
    await flush()
    expect(h.words.lines.map((l) => l.id)).toEqual([
      'guide.story.word.fox',
      'guide.story.word.sat',
    ])
  })
})

describe('the wrong taps: never a red X (AC 12)', () => {
  it('1st: re-prompt, 400 ms, the question; 2nd: re-prompt, 600 ms, the story with the read-along, 400 ms, the question; 3rd: the given answer', async () => {
    const h = await renderStory()
    await toQuestion(h)
    await say(lastVoice(h))
    // 1st wrong.
    await fireEvent.press(screen.getByTestId('word-song-chip-rug'))
    await flush()
    expect(h.sfx.poof.play).toHaveBeenCalledTimes(1)
    expect(h.poses).toContain('puzzled-tilt')
    expect(lastVoice(h).text).toBe('Hmm... try again?')
    await say(lastVoice(h))
    await advance(STORY_ASK_AGAIN_MS - 1)
    expect(lastVoice(h).text).toBe('Hmm... try again?')
    await advance(1)
    expect(lastVoice(h).text).toBe(FOX_1.question)
    await say(lastVoice(h))
    // 2nd wrong.
    await fireEvent.press(screen.getByTestId('word-song-chip-cup'))
    await flush()
    await say(lastVoice(h))
    await advance(600)
    const story = lastVoice(h)
    expect(story.text).toBe(FOX_1.story)
    expect(h.poses.at(-1)).toBe('attentive-pointing')
    const ribbon = screen.getByTestId('word-song-ribbon')
    await say(story, { end: false })
    // The read-along walks the words; the ribbon keeps its last line.
    expect(lit()).toEqual([9])
    expect(
      screen.getByTestId('word-song-ribbon').props.accessibilityLabel,
    ).toBe(ribbon.props.accessibilityLabel)
    await act(async () => story.resolve())
    await flush()
    await advance(STORY_READ_DARK_MS)
    expect(lit()).toEqual([])
    await advance(STORY_ASK_AGAIN_MS - STORY_READ_DARK_MS)
    expect(lastVoice(h).text).toBe(FOX_1.question)
    await say(lastVoice(h))
    // 3rd wrong.
    await fireEvent.press(screen.getByTestId('word-song-chip-rug'))
    await flush()
    await say(lastVoice(h))
    expect(lastVoice(h).text).toBe('This one is the fox.')
    // The scene never shows before the answer.
    expect(scene()).toBeNull()
  })
})

describe('the reveal (AC 11, AC 14)', () => {
  it('a right tap: "Yes! The fox!", the chips go, the answer\'s picture enters, the read-along, 800 ms, the next card', async () => {
    const h = await renderStory()
    await toQuestion(h)
    await say(lastVoice(h))
    await fireEvent.press(screen.getByTestId('word-song-chip-fox'))
    await flush()
    expect(h.poses).toContain('celebration')
    expect(lastVoice(h).text).toBe('Yes! The fox!')
    await say(lastVoice(h))
    expect(chips()).not.toBeNull()
    expect(scene()).toBeNull()
    await advance(STORY_REVEAL_DELAY_MS)
    expect(chips()).toBeNull()
    // No scene file yet (§ 6, a later job): the answer's pack picture.
    expect(scene()).not.toBeNull()
    expect(screen.getByTestId('word-story-scene-picture')).toBeOnTheScreen()
    expect(screen.getByTestId('word-picture-fox')).toBeOnTheScreen()
    await advance(STORY_SCENE_LAND_MS + STORY_REVEAL_READ_GAP_MS - 1)
    expect(lastVoice(h).text).toBe('Yes! The fox!')
    await advance(1)
    const story = lastVoice(h)
    expect(story.text).toBe(FOX_1.story)
    // Word taps end at the reveal.
    await act(async () => story.opts.onPlay?.())
    await act(async () => story.opts.onWordTick?.(3))
    await flush()
    expect(lit()).toEqual([3])
    await act(async () => story.resolve())
    await flush()
    await advance(STORY_REVEAL_HOLD_MS - 1)
    expect(screen.getByTestId('word-story').props.accessibilityLabel).toBe(
      FOX_1.story,
    )
    await advance(1)
    expect(screen.getByTestId('word-story').props.accessibilityLabel).toBe(
      FOX_2.story,
    )
    expect(scene()).toBeNull()
    expect(chips()).toBeNull()
    expect(h.prompt.lines).toHaveLength(2)
  })

  it('a word tap is dead from the reveal on', async () => {
    const h = await renderStory()
    await toQuestion(h)
    await say(lastVoice(h))
    await fireEvent.press(screen.getByTestId('word-song-chip-fox'))
    await flush()
    await say(lastVoice(h))
    await advance(STORY_REVEAL_DELAY_MS)
    await fireEvent.press(screen.getByTestId('word-story-word-1'))
    await flush()
    expect(h.words.lines).toHaveLength(0)
  })

  it('the session result names the answers and the tapped chips, as today', async () => {
    const h = await renderStory()
    for (let i = 0; i < 8; i++) {
      await toQuestion(h, 21_000)
      await say(lastVoice(h))
      await fireEvent.press(
        screen.getByTestId(`word-song-chip-${FOX.problems[i]!.target.word}`),
      )
      await flush()
      await say(lastVoice(h))
      await advance(
        STORY_REVEAL_DELAY_MS + STORY_SCENE_LAND_MS + STORY_REVEAL_READ_GAP_MS,
      )
      await say(lastVoice(h))
      await advance(STORY_REVEAL_HOLD_MS)
    }
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
    const result = h.onSessionComplete.mock.calls[0]![0]
    expect(result.targetWords).toEqual(
      storiesOf('fox-stories').map((s) => s.answer),
    )
    expect(result.perProblemAnswerWord).toEqual(result.targetWords)
    expect(result.perProblemCorrect).toEqual(Array(8).fill(true))
    expect(result.firstTapCorrect).toEqual(Array(8).fill(true))
  })
})
