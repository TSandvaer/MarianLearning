import {
  GREET_LINES,
  type BoundaryEvent,
} from '@marian/core/greet/greetSequence'
import { CAPTION_WALK_MS_PER_WORD, type LineCallbacks } from '../../audio'
import { createGreetSpeaker, GREET_LINE_KEYS } from './greetSpeak'

function harness(outcome: 'ok' | 'cancelled' | 'start-timeout') {
  const play = jest.fn((_key: string, opts: LineCallbacks = {}) => {
    if (outcome === 'ok') {
      opts.onPlay?.()
      opts.onWordTick?.(0)
      opts.onWordTick?.(1)
      return Promise.resolve()
    }
    return Promise.reject(new Error(outcome))
  })
  const speaker = createGreetSpeaker(play)
  const events: BoundaryEvent[] = []
  const onStart = jest.fn()
  const run = (text: string) =>
    speaker.speak(text, { onStart, onBoundary: (e) => events.push(e) })
  return { play, speaker, events, onStart, run }
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('maps every Greet line to its clip, in order', () => {
  expect(GREET_LINES.map((t) => GREET_LINE_KEYS[t])).toEqual([
    'hi',
    'imEmma',
    'niceToMeet',
    'tapHeart',
  ])
})

it('forwards onPlay and word ticks as the sequence’s onStart / boundary events', async () => {
  const { play, events, onStart, run } = harness('ok')
  await run(GREET_LINES[1])
  expect(play).toHaveBeenCalledWith('imEmma', expect.any(Object))
  expect(onStart).toHaveBeenCalledTimes(1)
  expect(events).toEqual([
    { wordIndex: 0, word: "I'm", charIndex: 0 },
    { wordIndex: 1, word: 'Emma.', charIndex: 0 },
  ])
})

it('a cancel rejects (the sequence stays silent), with no caption walk', async () => {
  const { events, onStart, run } = harness('cancelled')
  await expect(run(GREET_LINES[2])).rejects.toThrow('cancelled')
  jest.advanceTimersByTime(60_000)
  expect(events).toEqual([])
  expect(onStart).not.toHaveBeenCalled()
})

it('a failed clip walks its caption at 165 wpm and then resolves', async () => {
  const { events, onStart, run } = harness('start-timeout')
  const done = run(GREET_LINES[2]) // 6 words
  await Promise.resolve()
  await Promise.resolve()
  expect(onStart).toHaveBeenCalledTimes(1)
  expect(events.map((e) => e.wordIndex)).toEqual([0])
  jest.advanceTimersByTime(CAPTION_WALK_MS_PER_WORD * 5)
  await expect(done).resolves.toBeUndefined()
  expect(events.map((e) => e.word)).toEqual(GREET_LINES[2].split(' '))
})

it('cancelWalk stops a walk in flight (it rejects as cancelled)', async () => {
  const { speaker, events, run } = harness('start-timeout')
  const done = run(GREET_LINES[3])
  await Promise.resolve()
  await Promise.resolve()
  speaker.cancelWalk()
  await expect(done).rejects.toThrow('cancelled')
  jest.advanceTimersByTime(60_000)
  expect(events).toHaveLength(1)
})

it('rejects a line it has no clip for', async () => {
  const { play, run } = harness('ok')
  await expect(run('Goodbye!')).rejects.toThrow('no clip')
  expect(play).not.toHaveBeenCalled()
})
