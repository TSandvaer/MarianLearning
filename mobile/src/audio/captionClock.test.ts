import {
  FALLBACK_WPM,
  STATUS_INTERVAL_MS,
  countWords,
  wordIndexAt,
} from './captionClock'

/**
 * The web's tick schedule (`preRecorded.ts` / `sessionAudio.ts` /
 * `playHubLine.ts`): word 0 on `play`, then a `setInterval` of
 * `duration / wordCount` reveals word 1, 2, ... — i.e. word i at
 * `i * interval` ms.
 */
function webRevealMs(durationS: number, wordCount: number): number[] {
  const totalMs =
    durationS > 0 ? durationS * 1000 : (wordCount / FALLBACK_WPM) * 60_000
  const interval = totalMs / wordCount
  return Array.from({ length: wordCount }, (_, i) => i * interval)
}

/** Native: the first 50 ms status sample at which each word is visible. */
function nativeRevealMs(durationS: number, wordCount: number): number[] {
  const reveal: number[] = []
  for (let t = 0; reveal.length < wordCount; t += STATUS_INTERVAL_MS) {
    const idx = wordIndexAt(t / 1000, durationS, wordCount)
    while (reveal.length <= idx) reveal.push(t)
  }
  return reveal
}

describe('caption clock', () => {
  it('counts words like the web (whitespace split, empties dropped)', () => {
    expect(countWords("It's so nice to meet you.")).toBe(6)
    expect(countWords('  Hi!  ')).toBe(1)
    expect(countWords('')).toBe(0)
  })

  it.each([
    ['Hi!', 0.62],
    ["I'm Emma.", 0.98],
    ["It's so nice to meet you.", 1.86],
    ['Three plus two. How many?', 2.4],
  ])(
    'reveals each word of "%s" at most one status interval after the web',
    (text, durationS) => {
      const n = countWords(text)
      const web = webRevealMs(durationS, n)
      const native = nativeRevealMs(durationS, n)
      expect(native).toHaveLength(n)
      native.forEach((ms, i) => {
        expect(ms).toBeGreaterThanOrEqual(web[i])
        expect(ms - web[i]).toBeLessThan(STATUS_INTERVAL_MS)
      })
    },
  )

  it('falls back to 165 wpm when the duration is unknown', () => {
    // 6 words at 165 wpm: 60000/165 ≈ 363.6 ms per word.
    expect(wordIndexAt(0.36, 0, 6)).toBe(0)
    expect(wordIndexAt(0.37, 0, 6)).toBe(1)
    expect(wordIndexAt(1.82, 0, 6)).toBe(5)
  })

  it('clamps to the last word and never goes below 0', () => {
    expect(wordIndexAt(99, 2, 4)).toBe(3)
    expect(wordIndexAt(-1, 2, 4)).toBe(0)
    expect(wordIndexAt(5, 1, 1)).toBe(0)
  })

  it('uses the 50 ms status interval (expo-audio defaults to 500 ms)', () => {
    expect(STATUS_INTERVAL_MS).toBe(50)
  })
})
