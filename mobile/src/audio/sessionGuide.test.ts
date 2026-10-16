/**
 * The round's lead lines (content wave 1 § 6.1): at most one line before
 * each problem's read, by priority — a review's or a peek's opener (problem
 * 1), a warm-up heart's "Remember this one?", the step intro (scored problem
 * 1), the hiding line (the round's first missing-number problem whose slot
 * is still free).
 */
import {
  leadLinesForRound,
  SESSION_GUIDE_MANIFEST,
  sessionGuideLine,
  type SessionGuideLineId,
} from './sessionGuide'

// Any step's intro id; the rule does not depend on which.
const INTRO: SessionGuideLineId = 'guide.session.intro.mult-6-9'
const no = (n: number) => Array.from({ length: n }, () => false)
const at = (n: number, ...idx: number[]) =>
  Array.from({ length: n }, (_, i) => idx.includes(i))

describe('leadLinesForRound (§ 6.1)', () => {
  it('a plain forward round has no leads', () => {
    expect(
      leadLinesForRound(8, {
        opener: null,
        warmupCount: 0,
        intro: null,
        hiding: no(8),
        peek: false,
      }),
    ).toEqual(Array(8).fill(null))
  })

  it('the hiding line goes before the first missing-number problem only (AC 11)', () => {
    const leads = leadLinesForRound(8, {
      opener: null,
      warmupCount: 0,
      intro: null,
      hiding: at(8, 3, 5, 7),
      peek: false,
    })
    expect(leads).toEqual([
      null,
      null,
      null,
      'guide.session.hiding',
      null,
      null,
      null,
      null,
    ])
  })

  it('the step intro goes before the scored problem 1, after the warm-up hearts', () => {
    const leads = leadLinesForRound(10, {
      opener: null,
      warmupCount: 2,
      intro: INTRO,
      hiding: no(10),
      peek: false,
    })
    expect(leads.slice(0, 3)).toEqual([
      'guide.session.warmup',
      'guide.session.warmup',
      INTRO,
    ])
    expect(leads.slice(3)).toEqual(Array(7).fill(null))
  })

  it('a warm-up heart keeps its own line; the hiding line moves to the first scored missing number', () => {
    const leads = leadLinesForRound(10, {
      opener: null,
      warmupCount: 2,
      intro: null,
      // Heart 2 and scored P4 / P6 are missing-number problems.
      hiding: at(10, 1, 5, 7),
      peek: false,
    })
    expect(leads[1]).toBe('guide.session.warmup')
    expect(leads[5]).toBe('guide.session.hiding')
    expect(leads.filter((l) => l === 'guide.session.hiding')).toHaveLength(1)
  })

  it("a review's opener holds problem 1; the hiding line goes to the next missing number", () => {
    const leads = leadLinesForRound(8, {
      opener: 'guide.session.review',
      warmupCount: 0,
      intro: null,
      hiding: at(8, 0, 4),
      peek: false,
    })
    expect(leads[0]).toBe('guide.session.review')
    expect(leads[4]).toBe('guide.session.hiding')
    expect(leads.filter((l) => l !== null)).toHaveLength(2)
  })

  it('a review with no missing-number block plays no hiding line', () => {
    const leads = leadLinesForRound(8, {
      opener: 'guide.session.review',
      warmupCount: 0,
      intro: null,
      hiding: no(8),
      peek: false,
    })
    expect(leads).toEqual(['guide.session.review', ...Array(7).fill(null)])
  })

  it('the intro outranks the hiding line on the same problem', () => {
    const leads = leadLinesForRound(8, {
      opener: null,
      warmupCount: 0,
      intro: INTRO,
      hiding: at(8, 0, 3),
      peek: false,
    })
    expect(leads[0]).toBe(INTRO)
    expect(leads[3]).toBe('guide.session.hiding')
  })

  it('a peek plays its opener and nothing else (never an intro or the hiding line)', () => {
    const leads = leadLinesForRound(3, {
      opener: 'guide.session.peek-open.add-to-20',
      warmupCount: 0,
      intro: INTRO,
      hiding: at(3, 0, 1, 2),
      peek: true,
    })
    expect(leads).toEqual(['guide.session.peek-open.add-to-20', null, null])
  })

  it('the hiding line is a catalogued session line', () => {
    expect(SESSION_GUIDE_MANIFEST['guide.session.hiding']).toBeDefined()
    expect(sessionGuideLine('guide.session.hiding').text).toBe(
      'Some flowers are hiding!',
    )
  })
})
