/**
 * `design/native/word-song-native.md` § 2: the sizes table, row for row,
 * and the tablet worst case (iPad mini landscape: a 325 pt stage).
 */
import type { Viewport } from './layout'
import { mathLayout } from './mathLayout'
import {
  chipInner,
  storyCardHeight,
  storyRevealScene,
  wordSongLayout,
} from './wordSongLayout'

const vp = (
  width: number,
  height: number,
  [top, bottom, left, right] = [0, 0, 0, 0],
): Viewport => ({ width, height, insets: { top, bottom, left, right } })

interface Row {
  name: string
  v: Viewport
  form: 'phone-portrait' | 'phone-landscape'
  /** Emma's frame (P) or Emma's column (L). */
  emma: number
  ribbonText: number
  stage: [number, number]
  picture: number
  scene: number
  chip: number
  gap?: number
  letters: number
}

const TABLE: Row[] = [
  {
    name: '375×667',
    v: vp(375, 667),
    form: 'phone-portrait',
    emma: 147,
    ribbonText: 228.7,
    stage: [343, 257],
    picture: 160,
    scene: 147,
    chip: 103,
    gap: 17,
    letters: 72,
  },
  {
    name: '390×844 (t47 b34)',
    v: vp(390, 844, [47, 34, 0, 0]),
    form: 'phone-portrait',
    emma: 168,
    ribbonText: 231.9,
    stage: [358, 331],
    picture: 160,
    scene: 160,
    chip: 104,
    gap: 23,
    letters: 72,
  },
  {
    name: '411×914 (t24 b24)',
    v: vp(411, 914, [24, 24, 0, 0]),
    form: 'phone-portrait',
    emma: 191,
    ribbonText: 240,
    stage: [379, 411],
    picture: 160,
    scene: 160,
    chip: 104,
    gap: 33,
    letters: 72,
  },
  {
    name: '667×375',
    v: vp(667, 375),
    form: 'phone-landscape',
    emma: 160,
    ribbonText: 339,
    stage: [371, 210],
    picture: 130,
    scene: 145,
    chip: 104,
    letters: 56,
  },
  {
    name: '667×375 (b21)',
    v: vp(667, 375, [0, 21, 0, 0]),
    form: 'phone-landscape',
    emma: 160,
    ribbonText: 344,
    stage: [376, 189],
    picture: 109,
    scene: 124,
    chip: 99,
    letters: 56,
  },
  {
    name: '844×390 (l47 r47 b21)',
    v: vp(844, 390, [0, 21, 47, 47]),
    form: 'phone-landscape',
    emma: 180,
    ribbonText: 402,
    stage: [434, 204],
    picture: 124,
    scene: 139,
    chip: 104,
    letters: 56,
  },
  {
    name: '914×411 (l24 r24)',
    v: vp(914, 411, [0, 0, 24, 24]),
    form: 'phone-landscape',
    emma: 200,
    ribbonText: 498,
    stage: [530, 246],
    picture: 160,
    scene: 160,
    chip: 104,
    letters: 56,
  },
]

describe.each(TABLE)('$name', (row) => {
  const l = wordSongLayout(row.v)

  it('matches the spec table', () => {
    expect(l.form).toBe(row.form)
    const emma =
      row.form === 'phone-portrait' ? l.emma.width : l.stage.x - l.safe.x
    expect(emma).toBe(row.emma)
    const text = l.ribbon.width - l.ribbonPadding.horizontal * 2
    expect(text).toBeCloseTo(row.ribbonText, 0)
    expect([l.stage.width, l.stage.height]).toEqual(row.stage)
    expect(l.picture).toBe(row.picture)
    expect(l.scene).toBe(row.scene)
    expect(l.chips.size).toBe(row.chip)
    if (row.gap !== undefined) expect(l.chips.gap).toBe(row.gap)
    expect(l.letterFont).toBe(row.letters)
  })

  it('keeps the chips ≥ 16 apart, inside the safe rect, clear of the stage', () => {
    const { rect, size, gap, axis } = l.chips
    expect(gap).toBeGreaterThanOrEqual(16)
    const s = l.safe
    expect(rect.x).toBeGreaterThanOrEqual(s.x)
    expect(rect.y).toBeGreaterThanOrEqual(s.y)
    expect(rect.x + rect.width).toBeLessThanOrEqual(s.x + s.width)
    expect(rect.y + rect.height).toBeLessThanOrEqual(s.y + s.height)
    if (axis === 'row') {
      expect(3 * size + 2 * gap).toBeLessThanOrEqual(rect.width)
      expect(l.stage.y + l.stage.height).toBeLessThanOrEqual(rect.y - 16)
    } else {
      expect(rect.height).toBe(3 * size + 2 * gap)
      expect(l.stage.x + l.stage.width).toBeLessThanOrEqual(rect.x - 16)
    }
  })

  it('never lets the ribbon slot reach the stage', () => {
    expect(l.ribbon.y + l.ribbon.maxHeight).toBeLessThanOrEqual(l.stage.y)
  })

  it('puts Emma exactly where Math does (no jump between the worlds)', () => {
    expect(l.emma).toEqual(mathLayout(row.v).emma)
  })
})

it('P keeps a 3-line ribbon slot (111), L a 2-line slot (81)', () => {
  expect(wordSongLayout(vp(375, 667)).ribbon.maxHeight).toBe(111)
  expect(wordSongLayout(vp(667, 375)).ribbon.maxHeight).toBe(81)
})

it('sentence slots: P 98 (2 lines), L 57 (1 line)', () => {
  expect(wordSongLayout(vp(375, 667)).sentence.slot).toBe(98)
  expect(wordSongLayout(vp(667, 375)).sentence.slot).toBe(57)
})

it('tablet: the web sizes, and a 325 pt stage on iPad mini landscape', () => {
  const mini = wordSongLayout(vp(1133, 744, [24, 20, 0, 0]))
  expect(mini.form).toBe('tablet-landscape')
  expect(mini.stage.height).toBe(325)
  // The card needs 300 (180 + 8 + 112), the sentence block 312.
  expect(180 + 8 + (96 + 16)).toBeLessThanOrEqual(mini.stage.height)
  expect(210 + 12 + mini.sentence.slot).toBeLessThanOrEqual(mini.stage.height)
  for (const v of [
    vp(834, 1194, [24, 20, 0, 0]),
    vp(1194, 834, [24, 20, 0, 0]),
  ]) {
    const t = wordSongLayout(v)
    expect([t.picture, t.letterFont, t.chips.size, t.chips.gap]).toEqual([
      180, 96, 112, 24,
    ])
    expect(t.emma).toEqual(mathLayout(v).emma)
    expect(t.chips.rect.y + 112 + 32).toBe(t.safe.y + t.safe.height)
  }
})

it('chip insides scale from the web 112 pt tile', () => {
  expect(chipInner(112)).toMatchObject({
    radius: 32,
    inset: 12,
    letterFont: 64,
    wordFont: 36,
    burstDistance: 75,
    sparkle: 16,
  })
  expect(chipInner(103)).toMatchObject({ radius: 29, inset: 11, wordFont: 33 })
})

describe('the little-story card and its reveal scene (content wave 3 § 4.3, AC 10)', () => {
  const NO = { top: 0, bottom: 0, left: 0, right: 0 }
  const forms: [string, Viewport, number, number, number, number][] = [
    // [name, viewport, font, line, 3-line card, scene below a 3-line card]
    ['P 375×667', { width: 375, height: 667, insets: NO }, 24, 46, 168, 196],
    [
      'L 667×375 b21',
      { width: 667, height: 375, insets: { ...NO, bottom: 21 } },
      22,
      44,
      158,
      99,
    ],
    [
      'iPad mini L 1133×744 b20',
      { width: 1133, height: 744, insets: { ...NO, bottom: 20 } },
      32,
      56,
      206,
      243,
    ],
    [
      'TP 744×1133 t24 b20',
      { width: 744, height: 1133, insets: { ...NO, top: 24, bottom: 20 } },
      32,
      56,
      206,
      280,
    ],
  ]
  it.each(forms)('%s', (_name, v, font, line, card, sceneSize) => {
    const m = wordSongLayout(v).story
    expect([m.font, m.lineHeight]).toEqual([font, line])
    expect(m.lineHeight).toBeGreaterThanOrEqual(44)
    expect(storyCardHeight(m, 3)).toBe(card)
    expect(storyRevealScene(m, storyCardHeight(m, 3)).size).toBe(sceneSize)
  })

  it('P: a 2-line card leaves room for the 200 pt cap; the text is 305 pt wide', () => {
    const l = wordSongLayout({ width: 375, height: 667, insets: NO })
    expect(storyCardHeight(l.story, 2)).toBe(122)
    expect(storyRevealScene(l.story, storyCardHeight(l.story, 2)).size).toBe(
      200,
    )
    expect(l.story.width - 2 * l.story.padding.horizontal - 6).toBe(305)
  })

  it('tablets: the text is at most 586 pt wide, the card centred in the stage', () => {
    const l = wordSongLayout({
      width: 1133,
      height: 744,
      insets: { ...NO, bottom: 20 },
    })
    expect(l.story.width - 2 * l.story.padding.horizontal - 6).toBe(586)
    expect(l.story.width).toBeLessThan(l.stage.width)
  })

  it('the scene stays inside its rect and never under 120 pt below the card', () => {
    for (const [, v] of forms) {
      const m = wordSongLayout(v).story
      for (const lines of [2, 3]) {
        const s = storyRevealScene(m, storyCardHeight(m, lines))
        if (m.revealBelowCard) expect(s.size).toBeGreaterThanOrEqual(120)
        expect(s.x).toBeGreaterThanOrEqual(m.reveal.x)
        expect(s.x + s.size).toBeLessThanOrEqual(
          m.reveal.x + m.reveal.width + 0.001,
        )
        expect(s.y + s.size).toBeLessThanOrEqual(
          m.reveal.y + m.reveal.height + 0.001,
        )
      }
    }
  })
})
