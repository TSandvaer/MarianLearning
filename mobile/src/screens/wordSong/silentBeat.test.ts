import {
  LETTER_TAP_HOLD_MS,
  SILENT_BEAT_CAP_MS,
  startSilentBeat,
} from './silentBeat'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('reads after 1.5 s of foreground time', () => {
  const done = jest.fn()
  startSilentBeat(1500, false, done)
  jest.advanceTimersByTime(1499)
  expect(done).not.toHaveBeenCalled()
  jest.advanceTimersByTime(1)
  expect(done).toHaveBeenCalledTimes(1)
})

it('pauses in the background and resumes with the time it had left', () => {
  const done = jest.fn()
  const beat = startSilentBeat(1500, false, done)
  jest.advanceTimersByTime(1000)
  beat.setHidden(true)
  jest.advanceTimersByTime(60_000)
  expect(done).not.toHaveBeenCalled()
  beat.setHidden(false)
  jest.advanceTimersByTime(499)
  expect(done).not.toHaveBeenCalled()
  jest.advanceTimersByTime(1)
  expect(done).toHaveBeenCalledTimes(1)
})

it('starts paused when the card appears in the background', () => {
  const done = jest.fn()
  const beat = startSilentBeat(1500, true, done)
  jest.advanceTimersByTime(10_000)
  expect(done).not.toHaveBeenCalled()
  beat.setHidden(false)
  jest.advanceTimersByTime(1500)
  expect(done).toHaveBeenCalledTimes(1)
})

it('a letter tap holds the read to 1 s after it', () => {
  const done = jest.fn()
  const beat = startSilentBeat(1500, false, done)
  jest.advanceTimersByTime(1200)
  beat.letterTapped()
  jest.advanceTimersByTime(LETTER_TAP_HOLD_MS - 1)
  expect(done).not.toHaveBeenCalled()
  jest.advanceTimersByTime(1)
  expect(done).toHaveBeenCalledTimes(1)
})

it('an early tap does not shorten the beat', () => {
  const done = jest.fn()
  const beat = startSilentBeat(1500, false, done)
  jest.advanceTimersByTime(100)
  beat.letterTapped()
  jest.advanceTimersByTime(1399)
  expect(done).not.toHaveBeenCalled()
  jest.advanceTimersByTime(1)
  expect(done).toHaveBeenCalledTimes(1)
})

it('never holds past 5 s, however she taps', () => {
  const done = jest.fn()
  const beat = startSilentBeat(1500, false, done)
  for (let t = 0; t < 4900; t += 700) {
    jest.advanceTimersByTime(700)
    beat.letterTapped()
  }
  jest.advanceTimersByTime(SILENT_BEAT_CAP_MS - 4900 - 1)
  expect(done).not.toHaveBeenCalled()
  jest.advanceTimersByTime(1)
  expect(done).toHaveBeenCalledTimes(1)
})

it('cancel stops it for good', () => {
  const done = jest.fn()
  const beat = startSilentBeat(1500, false, done)
  beat.cancel()
  beat.letterTapped()
  beat.setHidden(false)
  jest.advanceTimersByTime(10_000)
  expect(done).not.toHaveBeenCalled()
})
