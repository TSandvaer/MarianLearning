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
import { recordSessionEnd } from '@marian/core/sessionEnd/sessionHistory'
import {
  NO_EXTRAS,
  buildWordSongSessionPayload,
  readWordSongProgressHints,
  readWordSongSessionExtras,
  type WordSongProgressHints,
} from './wordSongHints'
import { wordSongRoundFromServer } from './wordSongSession'

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

describe('the step intro lead line (content wave 1 § 6.1)', () => {
  /** Every Word Song step before `node` mastered, `node` at `level`. */
  function seedOn(
    node:
      | 'duck-words'
      | 'crab-words'
      | 'tent-words'
      | 'cake-words'
      | 'fox-stories'
      | 'hen-stories'
      | 'bug-stories',
    level: SkillLevel,
  ) {
    const before = WORD_SONG_NODES_IN_ORDER.slice(
      0,
      WORD_SONG_NODES_IN_ORDER.indexOf(node),
    )
    seed({
      ...Object.fromEntries(before.map((n) => [n, 'mastered' as SkillLevel])),
      [node]: level,
    })
  }

  it('a forward session on duck words or crab words carries its intro until the step is mastered', () => {
    seedOn('duck-words', 'intro')
    expect(readWordSongProgressHints()).toMatchObject({
      focusNode: 'duck-words',
      intro: 'guide.session.intro.duck-words',
    })
    seedOn('duck-words', 'practicing')
    expect(readWordSongProgressHints().intro).toBe(
      'guide.session.intro.duck-words',
    )
    seedOn('crab-words', 'practicing')
    expect(readWordSongProgressHints()).toMatchObject({
      focusNode: 'crab-words',
      intro: 'guide.session.intro.crab-words',
    })
  })

  it('content wave 2: tent words and cake words carry their intros until mastered (§ 6.1, D9)', () => {
    seedOn('tent-words', 'intro')
    expect(readWordSongProgressHints()).toMatchObject({
      focusNode: 'tent-words',
      intro: 'guide.session.intro.tent-words',
    })
    seedOn('cake-words', 'practicing')
    expect(readWordSongProgressHints()).toMatchObject({
      focusNode: 'cake-words',
      intro: 'guide.session.intro.cake-words',
    })
  })

  it('content wave 3: each story step carries its lead until mastered (§ 5.1, D12)', () => {
    for (const node of ['fox-stories', 'hen-stories', 'bug-stories'] as const) {
      seedOn(node, 'intro')
      expect(readWordSongProgressHints()).toMatchObject({
        focusNode: node,
        intro: `guide.session.intro.${node}`,
      })
      seedOn(node, 'practicing')
      expect(readWordSongProgressHints().intro).toBe(
        `guide.session.intro.${node}`,
      )
    }
  })

  it('a step without an intro gets none', () => {
    seed({ 'letter-sounds': 'practicing' })
    expect(readWordSongProgressHints().intro).toBeNull()
  })

  it('the round passes a forward intro through and drops it in a review', () => {
    const utterances = (prefix: string) => [
      { id: `${prefix}.read`, text: 'Read the duck.' },
      { id: `${prefix}.correct`, text: "Yes! That's a duck." },
      { id: `${prefix}.reprompt`, text: 'Hmm... try again?' },
      { id: `${prefix}.hint`, text: "Let's look. Duck." },
      { id: `${prefix}.giveAnswer`, text: 'This one is duck.' },
    ]
    const intro = 'guide.session.intro.duck-words' as const
    const eight = Array.from({ length: 8 }, (_, i) =>
      utterances(`word.p${i + 1}`),
    ).flat()
    const forward = wordSongRoundFromServer(
      { id: 'word-song-duck-words', label: 'Duck words', utterances: eight },
      { planKind: { kind: 'forward', warmup: [] }, intro },
    )
    expect(forward.intro).toBe(intro)
    expect(forward.plan.problems.map((p) => p.contentType)).toEqual(
      Array(8).fill('cvc-word'),
    )
    const review = wordSongRoundFromServer(
      { id: 'review-word-song', label: 'Review', utterances: eight },
      { planKind: { kind: 'review', blocks: [] }, intro },
    )
    expect(review.intro).toBeNull()
  })
})

describe('letter sounds: the vowel map and its seed (no-Claude plan phase 4)', () => {
  it('reads the vowel map and the session count, and only the device payload carries them', () => {
    const vowels = {
      '/o/': 'mastered',
      '/u/': 'practicing',
      '/i/': 'intro',
      '/e/': 'intro',
    } as const
    const base = defaultProgress()
    seed(
      { 'letter-names': 'mastered', 'letter-sounds': 'practicing' },
      { literacy: { ...base.literacy, letterSoundsVowelStates: vowels } },
    )
    recordSessionEnd(3)
    recordSessionEnd(5)
    const h = readWordSongProgressHints()
    expect(h.focusNode).toBe('letter-sounds')
    expect(h.letterSoundsVowelStates).toEqual(vowels)
    expect(h.seed).toBe(2)
    const sent = buildWordSongSessionPayload(h, true)
    expect(sent.seed).toBe(2)
    expect(sent.progress).toMatchObject({ letterSoundsVowelStates: vowels })
    const bare = buildWordSongSessionPayload(h, false)
    expect(bare).not.toHaveProperty('seed')
    expect(bare.progress).not.toHaveProperty('letterSoundsVowelStates')
  })

  it('another step carries neither', () => {
    seed({ 'letter-names': 'mastered', 'letter-sounds': 'mastered' })
    const h = readWordSongProgressHints()
    expect(h.focusNode).not.toBe('letter-sounds')
    expect(h.seed).toBeUndefined()
    expect(buildWordSongSessionPayload(h, true)).not.toHaveProperty('seed')
  })
})
