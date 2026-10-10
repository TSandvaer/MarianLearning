import { CAPTION_WALK_MS_PER_WORD } from '../../audio'
import { createSilentMathPlayer } from './silentPlayer'

const W = CAPTION_WALK_MS_PER_WORD // 60000 / 165

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('web timing: onPlay + word 0 at once, a word per 363.6 ms, ends one interval after the last', async () => {
  const player = createSilentMathPlayer()
  const ticks: number[] = []
  const onPlay = jest.fn()
  let done = false
  void player
    .play('Three plus two. How many?', {
      onPlay,
      onWordTick: (i) => ticks.push(i),
    })
    .then(() => {
      done = true
    })
  expect(onPlay).toHaveBeenCalledTimes(1)
  expect(ticks).toEqual([0])
  jest.advanceTimersByTime(W)
  expect(ticks).toEqual([0, 1])
  jest.advanceTimersByTime(3 * W)
  expect(ticks).toEqual([0, 1, 2, 3, 4])
  // 5 words: the web's interval fires at 5 × W, then a tail of W.
  jest.advanceTimersByTime(2 * W - 1)
  await Promise.resolve()
  expect(done).toBe(false)
  jest.advanceTimersByTime(1)
  await Promise.resolve()
  expect(done).toBe(true)
})

it('a one-word line ends after one interval', async () => {
  const player = createSilentMathPlayer()
  let done = false
  void player.play('Yes!').then(() => {
    done = true
  })
  jest.advanceTimersByTime(W)
  await Promise.resolve()
  expect(done).toBe(true)
})

it('cancel (and a newer line) rejects the walk in flight and stops its ticks', async () => {
  const player = createSilentMathPlayer()
  const ticks: number[] = []
  const first = player.play('One two three four', {
    onWordTick: (i) => ticks.push(i),
  })
  const second = player.play('Five six')
  await expect(first).rejects.toThrow('cancelled')
  player.cancel()
  await expect(second).rejects.toThrow('cancelled')
  jest.advanceTimersByTime(10 * W)
  expect(ticks).toEqual([0])
})
