/**
 * The session-start extras a Word Song session freezes (web `src/App.tsx`
 * kick-effect, `focusIsCvcTier` + the #231 th block): cross-vowel mixing
 * and the digraphs-th mouth-cue state. Ported from the web Playwright
 * specs `cvc-cross-vowel-mix-regression`, `cvc-cross-vowel-review-firing`
 * and `digraphs-th-mouth-cue-display` (Phase 4 spec sort, items 6, 7, 18).
 */
import { setDayOffsetSource, setKeyValueStore } from '@marian/core'
import {
  WORD_SONG_NODES_IN_ORDER,
  defaultProgress,
  getSettings,
  saveProgress,
  type Progress,
  type SkillLevel,
} from '@marian/core/progress'
import {
  NO_EXTRAS,
  readWordSongProgressHints,
  readWordSongSessionExtras,
  type WordSongProgressHints,
} from './wordSongHints'

beforeEach(() => {
  const map = new Map<string, string>()
  setKeyValueStore({
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  })
  setDayOffsetSource(null)
})

/** Hints as `readWordSongProgressHints` would build them, by hand. */
function hints(
  over: Partial<WordSongProgressHints> = {},
): WordSongProgressHints {
  return {
    focusNode: undefined,
    focusMode: 'forward',
    recentSuccessRate: null,
    isGraduationSession: false,
    lifetimeFirstEncounters: [],
    letterSoundsVowelStates: undefined,
    planKind: { kind: 'forward', warmup: [] },
    ...over,
  }
}

/** Default progress with some skill levels and top-level fields changed. */
function seed(
  levels: Partial<Progress['skillLevels']>,
  over: Partial<Progress> = {},
): void {
  const base = defaultProgress()
  saveProgress({
    ...base,
    ...over,
    skillLevels: { ...base.skillLevels, ...levels },
  })
}

const CVC_ALL_MASTERED = {
  'cvc-words': 'mastered',
  'cvc-words-short-o': 'mastered',
  'cvc-words-short-u': 'mastered',
} as const

const toggleOff = (): Partial<Progress> => ({
  parentSettings: { ...getSettings(null), crossVowelMixingEnabled: false },
})

describe('no saved progress', () => {
  it('returns the frozen defaults: no mixing, th locked, no first encounter', () => {
    expect(
      readWordSongSessionExtras(hints({ focusNode: 'cvc-words' })),
    ).toEqual({ crossVowel: false, thLevel: 'locked', thFirstEncounter: false })
    expect(NO_EXTRAS).toEqual({
      crossVowel: false,
      thLevel: 'locked',
      thFirstEncounter: false,
    })
  })
})

describe('cross-vowel session gate', () => {
  it('all three CVC tiers mastered, toggle on, a CVC focus: mixing on', () => {
    seed(CVC_ALL_MASTERED)
    for (const focusNode of [
      'cvc-words',
      'cvc-words-short-o',
      'cvc-words-short-u',
    ] as const) {
      expect(readWordSongSessionExtras(hints({ focusNode })).crossVowel).toBe(
        true,
      )
    }
  })

  it('a CVC review session mixes too', () => {
    seed(CVC_ALL_MASTERED)
    expect(
      readWordSongSessionExtras(
        hints({ focusNode: 'cvc-words-short-o', focusMode: 'cvc-review' }),
      ).crossVowel,
    ).toBe(true)
  })

  it('the parent toggle off: no mixing, even with all three mastered', () => {
    seed(CVC_ALL_MASTERED, toggleOff())
    expect(
      readWordSongSessionExtras(hints({ focusNode: 'cvc-words-short-u' }))
        .crossVowel,
    ).toBe(false)
    expect(
      readWordSongSessionExtras(
        hints({ focusNode: 'cvc-words', focusMode: 'cvc-review' }),
      ).crossVowel,
    ).toBe(false)
  })

  it('one CVC tier not yet mastered: same-vowel chips on a CVC session', () => {
    seed({ ...CVC_ALL_MASTERED, 'cvc-words-short-u': 'practicing' })
    expect(
      readWordSongSessionExtras(hints({ focusNode: 'cvc-words-short-u' }))
        .crossVowel,
    ).toBe(false)
  })

  it('a non-CVC forward session never mixes, even after CVC graduation', () => {
    seed(CVC_ALL_MASTERED)
    for (const focusNode of [
      'digraphs-sh',
      'cvc-words-short-i',
      'cvc-words-short-e',
      'blending-cv',
    ] as const) {
      expect(readWordSongSessionExtras(hints({ focusNode })).crossVowel).toBe(
        false,
      )
    }
  })

  it('end to end: past the CVC tiers the picker lands on digraphs-sh, and the session does not mix', () => {
    seed({
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      ...CVC_ALL_MASTERED,
      'cvc-words-short-i': 'mastered',
      'cvc-words-short-e': 'mastered',
      'digraphs-sh': 'practicing',
    })
    const h = readWordSongProgressHints()
    expect([h.focusNode, h.focusMode]).toEqual(['digraphs-sh', 'forward'])
    expect(readWordSongSessionExtras(h).crossVowel).toBe(false)
  })

  it('end to end: the whole tree mastered fires the CVC review, and that session mixes', () => {
    const allMastered = Object.fromEntries(
      WORD_SONG_NODES_IN_ORDER.map((n) => [n, 'mastered' as SkillLevel]),
    )
    seed(allMastered, { cvcGraduationSessionFired: false })
    const h = readWordSongProgressHints()
    expect([h.focusNode, h.focusMode]).toEqual([
      'cvc-words-short-u',
      'cvc-review',
    ])
    expect(readWordSongSessionExtras(h).crossVowel).toBe(true)
  })
})

describe('th mouth-cue state', () => {
  const extras = (level: SkillLevel, met: readonly string[]) => {
    seed({ 'digraphs-th-voiceless': level })
    const { thLevel, thFirstEncounter } = readWordSongSessionExtras(
      hints({
        focusNode: 'digraphs-th-voiceless',
        lifetimeFirstEncounters: met,
      }),
    )
    return { thLevel, thFirstEncounter }
  }

  it('locked: no cue state', () => {
    expect(extras('locked', [])).toEqual({
      thLevel: 'locked',
      thFirstEncounter: false,
    })
  })

  it('intro, never met: the first encounter (the intro panel shows)', () => {
    expect(extras('intro', ['letter-sounds'])).toEqual({
      thLevel: 'intro',
      thFirstEncounter: true,
    })
  })

  it('intro, already met: not a first encounter', () => {
    expect(extras('intro', ['digraphs-th-voiceless'])).toEqual({
      thLevel: 'intro',
      thFirstEncounter: false,
    })
  })

  it('practicing: the level passes through, never a first encounter', () => {
    expect(extras('practicing', [])).toEqual({
      thLevel: 'practicing',
      thFirstEncounter: false,
    })
  })

  it('mastered: the level passes through, never a first encounter', () => {
    expect(extras('mastered', [])).toEqual({
      thLevel: 'mastered',
      thFirstEncounter: false,
    })
  })
})
