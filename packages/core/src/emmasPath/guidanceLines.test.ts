import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LITERACY_TREE, MATH_TREE } from '../progress/mastery'
import type { SkillNode } from '../progress/types'
import { STAGE_SPOKEN_NAMES } from '../sessionEnd/friendlyNodeName'
import {
  GUIDANCE_LINES,
  GUIDANCE_LINES_AWAITING_RENDER,
  guidanceLine,
  peekLines,
  pickerWhoLine,
  replayLines,
  sessionIntroLine,
} from './guidanceLines'
import { PATH_LINES } from './pathLines'

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const norm = (s: string) => s.replace(/’/g, "'")

describe('GUIDANCE_LINES (Guidance G3)', () => {
  it('has exactly the expected line count per kind', () => {
    const counts: Record<string, number> = {}
    for (const l of GUIDANCE_LINES) counts[l.kind] = (counts[l.kind] ?? 0) + 1
    expect(counts).toEqual({
      'hub-suggest': 2,
      'hub-sleeping': 2,
      'hub-both-sleeping': 1,
      'hub-woke': 1,
      'hub-woke-one': 1,
      'hub-one-more': 1,
      'end-right': 2,
      'end-flower': 1,
      'end-count': 3,
      'end-sleeps': 1,
      'end-path-opens': 1,
      'end-not-yet-praise': 1,
      'end-not-yet-again': 1,
      'end-world-done': 1,
      'end-fast-track': 1,
      'session-review': 1,
      'session-warmup': 1,
      'session-knew': 1,
      'session-peek-open': 41,
      'session-peek-close': 41,
      // Content wave 4: more and less; bee, car (duck words' text) and sheep
      // stories. Content wave 5: zeros, adding big numbers; snail and moon
      // words (duck words' text) and goat stories (sheep stories' text).
      'session-intro': 19,
      'session-hiding': 1,
      'session-replay-open': 43,
      'session-replay-close': 43,
      // Content wave 3 § 5.1: "Read the story." and the 54 word clips;
      // content wave 4 § 8.1: 17 more; content wave 5 § 9.1: 16 more.
      'story-read': 1,
      'story-word': 87,
      // Learner profiles § 1.3 (T5): the picker's "Who is playing?".
      'picker-who': 1,
      // The first mini-game, Fill the flower bed (mini-game spec § 3.1).
      game: 30,
    })
    expect(GUIDANCE_LINES).toHaveLength(330)
    expect(new Set(GUIDANCE_LINES.map((l) => l.id)).size).toBe(330)
    // Bee, car, snail and moon words' leads are duck words' text (content
    // wave 4 § 11, wave 5 § 9.1), goat stories' sheep stories': 330 ids,
    // 325 texts, 330 files.
    expect(new Set(GUIDANCE_LINES.map((l) => l.text)).size).toBe(325)
    expect(new Set(GUIDANCE_LINES.map((l) => l.src)).size).toBe(330)
  })

  it('AC8: both replay sets, one line per STAGE_SPOKEN_NAMES step, with the exact texts (map-tap-to-play § 6, T1 approved 2026-10-17)', () => {
    const steps = Object.keys(STAGE_SPOKEN_NAMES) as SkillNode[]
    expect(steps).toHaveLength(43)
    expect([...MATH_TREE, ...LITERACY_TREE].sort()).toEqual([...steps].sort())
    for (const node of steps) {
      const name = STAGE_SPOKEN_NAMES[node]
      const world = (MATH_TREE as readonly SkillNode[]).includes(node)
        ? 'math'
        : 'word-song'
      expect(replayLines(node)).toEqual({
        open: {
          id: `guide.session.replay-open.${node}`,
          kind: 'session-replay-open',
          world,
          text: `Let's play ${name} again!`,
          src: `/assets/audio/path/guide-session-replay-open-${node}.mp3`,
        },
        close: {
          id: `guide.session.replay-close.${node}`,
          kind: 'session-replay-close',
          world,
          text: `You know ${name}!`,
          src: `/assets/audio/path/guide-session-replay-close-${node}.mp3`,
        },
      })
    }
    // The spec's range and Lily character count (§ 6).
    const open = GUIDANCE_LINES.filter((l) => l.kind === 'session-replay-open')
    const close = GUIDANCE_LINES.filter(
      (l) => l.kind === 'session-replay-close',
    )
    const chars = (ls: typeof open) => ls.reduce((n, l) => n + l.text.length, 0)
    // Content wave 3 adds the story steps' 3 × 29 and 3 × 21, and
    // hundreds' 26 and 18; content wave 4 more and less's 31 and 23, and
    // bee, car and sheep's 27, 27, 31 and 19, 19, 23 (§ 8.1); content wave
    // 5 zeros' 23 and 15, adding big numbers' 36 and 28, snail, moon and
    // goat's 29, 28, 30 and 21, 20, 22 (§ 9.1).
    expect(chars(open)).toBe(1291)
    expect(chars(close)).toBe(947)
    expect(guidanceLine('guide.session.replay-close.number-recog')?.text).toBe(
      'You know numbers!',
    )
    expect(guidanceLine('guide.session.replay-open.mult-2-5-10')?.text).toBe(
      "Let's play groups of two, five and ten again!",
    )
    expect(Math.max(...[...open, ...close].map((l) => l.text.length))).toBe(45)
    // Rendered in Lily, the story steps' 6 and hundreds' pair too (content
    // wave 3 § 5.1), more and less's pair, content wave 4's land-8 6
    // (§ 8.1), and content wave 5's Number Garden pairs and land-9 6 (§ 9.1).
    expect(
      [...open, ...close].filter((l) =>
        GUIDANCE_LINES_AWAITING_RENDER.includes(l.id),
      ),
    ).toEqual([])
  })

  it('bakes each world and count variant', () => {
    expect(guidanceLine('guide.hub.suggest.math')?.text).toBe(
      "Let's grow a flower in Number Garden! Or pick Word Song.",
    )
    expect(guidanceLine('guide.hub.suggest.word-song')?.text).toBe(
      "Let's grow a flower in Word Song! Or pick Number Garden.",
    )
    expect(guidanceLine('guide.hub.sleeping.math')?.text).toBe(
      "Your flower is sleeping. Let's play Number Garden!",
    )
    expect(guidanceLine('guide.hub.sleeping.word-song')?.text).toBe(
      "Your flower is sleeping. Let's play Word Song!",
    )
    expect(
      ['1', '2', '3'].map((n) => guidanceLine(`guide.end.count.${n}`)?.text),
    ).toEqual(['One of three!', 'Two of three!', 'Three of three!'])
    expect(guidanceLine('guide.end.right.7')?.text).toBe(
      'Seven right! You worked hard!',
    )
    expect(guidanceLine('guide.end.right.8')?.text).toBe(
      'Eight right! You worked hard!',
    )
    expect(guidanceLine('guide.hub.woke.one')?.text).toBe(
      'Your flower woke up!',
    )
    expect(guidanceLine('guide.end.world-done')?.src).toBe(
      '/assets/audio/path/guide-end-world-done.mp3',
    )
    expect(guidanceLine('guide.end.right.7')?.src).toBe(
      '/assets/audio/path/guide-end-right-7.mp3',
    )
    // The review opener and the warm-up line (native review / warm-up
    // spec § 4, approved as written by Thomas 2026-10-14).
    expect(guidanceLine('guide.session.review')?.text).toBe(
      "Your flower is sleeping. Let's play the ones you know!",
    )
    expect(guidanceLine('guide.session.review')?.src).toBe(
      '/assets/audio/path/guide-session-review.mp3',
    )
    expect(guidanceLine('guide.session.warmup')?.text).toBe(
      'Remember this one?',
    )
    expect(guidanceLine('guide.session.warmup')?.src).toBe(
      '/assets/audio/path/guide-session-warmup.mp3',
    )
  })

  it('bakes the fast-track spec § 8 lines with their exact approved texts (AC 11)', () => {
    expect(guidanceLine('guide.end.fast-track')?.text).toBe(
      'You know this! All your flowers grew!',
    )
    expect(guidanceLine('guide.session.knew')?.text).toBe(
      'You just knew that one!',
    )
    // The generic peek lines are retired: every peek names its step.
    expect(guidanceLine('guide.session.peek-open')).toBeUndefined()
    expect(guidanceLine('guide.session.peek-close')).toBeUndefined()
  })

  it('bakes the lead lines of content wave 1 § 6.1 with their exact approved texts (AC 6)', () => {
    expect(guidanceLine('guide.session.hiding')).toMatchObject({
      kind: 'session-hiding',
      world: 'math',
      text: 'Some flowers are hiding!',
      src: '/assets/audio/path/guide-session-hiding.mp3',
    })
    // Every intro line is `guide.session.intro.<step>`, kind
    // `session-intro`, with its step's world.
    for (const l of GUIDANCE_LINES.filter((x) => x.kind === 'session-intro')) {
      const node = l.id.slice('guide.session.intro.'.length)
      expect(sessionIntroLine(node as never)).toBe(l)
      const tree = l.world === 'math' ? MATH_TREE : LITERACY_TREE
      expect(tree as readonly string[]).toContain(node)
    }
    // A step with no intro text has no line.
    expect(sessionIntroLine('add-to-10')).toBeUndefined()
    // Times mix (§ 6.2 rows 1, 2, 7).
    expect(sessionIntroLine('mult-mix')).toMatchObject({
      id: 'guide.session.intro.mult-mix',
      world: 'math',
      text: "Let's play all the groups!",
      src: '/assets/audio/path/guide-session-intro-mult-mix.mp3',
    })
    expect(peekLines('mult-mix')?.open.text).toBe(
      "Let's look at all the groups!",
    )
    expect(peekLines('mult-mix')?.close.text).toBe(
      'All the groups are for later. You will learn it!',
    )
    // Word Song land 6 (§ 6.2 rows 8-9).
    expect(sessionIntroLine('duck-words')).toMatchObject({
      id: 'guide.session.intro.duck-words',
      kind: 'session-intro',
      world: 'word-song',
      text: 'Two letters, one sound!',
      src: '/assets/audio/path/guide-session-intro-duck-words.mp3',
    })
    expect(sessionIntroLine('crab-words')).toMatchObject({
      id: 'guide.session.intro.crab-words',
      world: 'word-song',
      text: 'Read all the letters!',
      src: '/assets/audio/path/guide-session-intro-crab-words.mp3',
    })
    // Sharing (content wave 2 § 6.2; Thomas approved the texts 2026-10-17).
    expect(sessionIntroLine('div-share')).toMatchObject({
      id: 'guide.session.intro.div-share',
      kind: 'session-intro',
      world: 'math',
      text: "Let's share the flowers!",
      src: '/assets/audio/path/guide-session-intro-div-share.mp3',
    })
    expect(peekLines('div-share')?.open.text).toBe("Let's look at sharing!")
    expect(peekLines('div-share')?.close.text).toBe(
      'Sharing is for later. You will learn it!',
    )
    // Content wave 2 (design/native/content-wave-2.md § 6.2, T2).
    expect(sessionIntroLine('tent-words')).toMatchObject({
      id: 'guide.session.intro.tent-words',
      world: 'word-song',
      text: 'Read to the end!',
      src: '/assets/audio/path/guide-session-intro-tent-words.mp3',
    })
    expect(sessionIntroLine('cake-words')).toMatchObject({
      id: 'guide.session.intro.cake-words',
      world: 'word-song',
      text: 'The E is quiet. It makes the A say its name.',
      src: '/assets/audio/path/guide-session-intro-cake-words.mp3',
    })
    // Rendered in Lily, like wave 1's and sharing's (content wave 2 § 6.2).
    for (const n of [
      'mult-mix',
      'div-share',
      'duck-words',
      'crab-words',
      'tent-words',
      'cake-words',
    ])
      expect(GUIDANCE_LINES_AWAITING_RENDER).not.toContain(
        `guide.session.intro.${n}`,
      )
  })

  it('has the picker line (learner profiles § 1.3, T5), rendered in Lily', () => {
    expect(pickerWhoLine()).toEqual({
      id: 'guide.picker.who',
      kind: 'picker-who',
      world: null,
      text: 'Who is playing?',
      src: '/assets/audio/path/guide-picker-who.mp3',
    })
    // 15 characters of Lily (T5).
    expect(pickerWhoLine().text).toHaveLength(15)
    expect(GUIDANCE_LINES_AWAITING_RENDER).toEqual([])
  })

  it('names the step in the peek opener and closer (Thomas 2026-10-15), with the path lines’ spoken names and their verb', () => {
    expect(peekLines('sub-to-10')).toMatchObject({
      open: {
        id: 'guide.session.peek-open.sub-to-10',
        world: 'math',
        text: "Let's look at taking away to ten!",
        src: '/assets/audio/path/guide-session-peek-open-sub-to-10.mp3',
      },
      close: {
        id: 'guide.session.peek-close.sub-to-10',
        text: 'Taking away to ten is for later. You will learn it!',
      },
    })
    expect(peekLines('digraphs-sh')?.open.text).toBe(
      "Let's look at ship words!",
    )
    expect(peekLines('mult-2-5-10')?.close.text).toBe(
      'Groups of two, five and ten are for later. You will learn it!',
    )
    expect(peekLines('cvc-words')?.close.text).toBe(
      'Cat words are for later. You will learn it!',
    )
    // "blending sounds" is the activity: "is", though it ends in "s".
    expect(peekLines('blending-cv')?.close.text).toBe(
      'Blending sounds is for later. You will learn it!',
    )
    // Content wave 1 (design/native/content-wave-1.md § 6.2 rows 3-6).
    expect(peekLines('duck-words')).toMatchObject({
      open: { text: "Let's look at duck words!", world: 'word-song' },
      close: { text: 'Duck words are for later. You will learn it!' },
    })
    expect(peekLines('crab-words')).toMatchObject({
      open: { text: "Let's look at crab words!", world: 'word-song' },
      close: { text: 'Crab words are for later. You will learn it!' },
    })
    // Content wave 2 (design/native/content-wave-2.md § 6.2).
    expect(peekLines('tent-words')).toMatchObject({
      open: { text: "Let's look at tent words!", world: 'word-song' },
      close: { text: 'Tent words are for later. You will learn it!' },
    })
    expect(peekLines('cake-words')).toMatchObject({
      open: { text: "Let's look at cake words!", world: 'word-song' },
      close: { text: 'Cake words are for later. You will learn it!' },
    })
    // Plural noun phrases take "are"; activity (gerund) names take "is".
    const ARE = new Set([
      'two-digit-addsub-no-regroup',
      'mult-2-5-10',
      'mult-3-4',
      'mult-6-9',
      'mult-mix',
      'letter-sounds',
      'cvc-words',
      'cvc-words-short-o',
      'cvc-words-short-u',
      'cvc-words-short-i',
      'cvc-words-short-e',
      'digraphs-sh',
      'digraphs-ch',
      'digraphs-th-voiceless',
      'sight-words',
      'duck-words',
      'crab-words',
      'tent-words',
      'cake-words',
      'fox-stories',
      'hen-stories',
      'bug-stories',
      'hundreds',
      'hundreds-addsub',
      'hundreds-zeros',
      'bee-words',
      'car-words',
      'sheep-stories',
      'snail-words',
      'moon-words',
      'goat-stories',
    ])
    // Every step but a world's first (a peek never reaches it) has both.
    for (const tree of [MATH_TREE, LITERACY_TREE]) {
      expect(peekLines(tree[0]!)).toBeNull()
      for (const node of tree.slice(1)) {
        const lines = peekLines(node)
        expect(lines).not.toBeNull()
        // The name is the path stop line's ("Taking away to ten.").
        const stop = PATH_LINES.find((l) => l.id === `path.stop.${node}`)!
        const name = stop.text.replace(/\.$/, '')
        const verb = ARE.has(node) ? 'are' : 'is'
        expect(lines!.close.text).toBe(
          `${name} ${verb} for later. You will learn it!`,
        )
        expect(lines!.open.text).toBe(
          `Let's look at ${name.charAt(0).toLowerCase()}${name.slice(1)}!`,
        )
      }
    }
  })

  it('has a bundled MP3 for every line but the ones awaiting their render', () => {
    const missing = GUIDANCE_LINES.filter(
      (l) => !existsSync(join(process.cwd(), 'public', l.src)),
    ).map((l) => l.id)
    // Exactly the awaiting list: the render commit adds the clips AND
    // empties `GUIDANCE_LINES_AWAITING_RENDER`.
    expect(missing.sort()).toEqual([...GUIDANCE_LINES_AWAITING_RENDER].sort())
    expect(
      GUIDANCE_LINES.filter((l) =>
        l.src.startsWith('/assets/audio/path/guide-'),
      ),
    ).toHaveLength(330)
  })

  it('repeats no Emma’s Path line', () => {
    const pathTexts = new Set(PATH_LINES.map((l) => l.text))
    const pathSrcs = new Set(PATH_LINES.map((l) => l.src))
    expect(GUIDANCE_LINES.filter((l) => pathTexts.has(l.text))).toEqual([])
    expect(GUIDANCE_LINES.filter((l) => pathSrcs.has(l.src))).toEqual([])
  })

  it('covers every Emma caption in the approved guidance mockup', () => {
    const html = read('design/emmas-path/redesign/guidance-mockup.html')
    const states = html.slice(
      html.indexOf('const STATES'),
      html.indexOf('const ORDER'),
    )
    const captions = [...states.matchAll(/lines:\s*\[([\s\S]*?)\],\s*look:/g)]
      .flatMap((m) => [...m[1].matchAll(/(['"])((?:(?!\1).)+)\1/g)])
      .map((m) => norm(m[2]))
    expect(captions.length).toBeGreaterThanOrEqual(15)
    const known = new Set([
      ...GUIDANCE_LINES.map((l) => l.text),
      ...PATH_LINES.filter((l) => l.src !== null).map((l) => l.text),
    ])
    expect(captions.filter((c) => !known.has(c))).toEqual([])
  })

  it('lists every clip, with its text, as the voice-QA Guidance group', () => {
    const html = read('public/voice-qa.html')
    const block = html.slice(
      html.indexOf('const GUIDANCE_FILES'),
      html.indexOf('// ── State'),
    )
    const listed = [
      ...block.matchAll(
        /\[\s*(['"])([^'"]+\.mp3)\1,\s*(['"])(.*?)\3\s*,?\s*\]/g,
      ),
    ].map((m) => `${m[2]}|${m[4]}`)
    const expected = GUIDANCE_LINES.map(
      (l) => `${l.src.split('/').pop()}|${l.text}`,
    )
    expect(listed.sort()).toEqual(expected.sort())
    expect(html).toContain("appendGroup('Guidance'")
  })
})

const NUMBER = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
] as const
const Cap = (w: string) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`

/** Mini-game spec § 3.1, row by row: the 30 lines of Fill the flower bed. */
function expectedGameLines(): {
  id: string
  world: 'math' | null
  text: string
}[] {
  const lines: { id: string; world: 'math' | null; text: string }[] = [
    { id: 'guide.game.again', world: null, text: 'Hmm... try again?' },
  ]
  NUMBER.forEach((n, i) =>
    lines.push({
      id: `guide.game.this-is.${i + 1}`,
      world: null,
      text: `This one is ${n}.`,
    }),
  )
  lines.push({
    id: 'guide.game.bed.open',
    world: 'math',
    text: 'Ten flowers in every bed!',
  })
  NUMBER.forEach((n, i) =>
    lines.push({
      id: `guide.game.bed.ask.${i + 1}`,
      world: 'math',
      text: `${Cap(n)} and what make ten?`,
    }),
  )
  NUMBER.forEach((n, i) =>
    lines.push({
      id: `guide.game.bed.yes.${i + 1}`,
      world: 'math',
      text: `Yes! ${Cap(n)} and ${NUMBER[8 - i]} make ten!`,
    }),
  )
  lines.push({
    id: 'guide.game.bed.close',
    world: 'math',
    text: 'Ten every time! What a garden!',
  })
  return lines
}

describe('the mini-game lines (mini-game spec § 3)', () => {
  const game = GUIDANCE_LINES.filter((l) => l.kind === 'game')

  it('C4: leaves the 300 shipped lines unchanged and appends the 30 game lines', () => {
    // The fingerprint (FNV-1a over the JSON of id, kind, world, text, input
    // and src, in order) of the 300 lines on main at 4724665f, taken before
    // the game lines were added (299 at ae6472c5: 45621, b78acc53; 289 at
    // 8b0935b8: 43921, 77d72c5f; 258 at c86d551e: 39492, eea1867e).
    const shipped = JSON.stringify(
      GUIDANCE_LINES.slice(0, 300).map(
        ({ id, kind, world, text, input, src }) => [
          id,
          kind,
          world,
          text,
          input ?? null,
          src,
        ],
      ),
    )
    let hash = 0x811c9dc5
    for (let i = 0; i < shipped.length; i++) {
      hash ^= shipped.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
    expect([shipped.length, hash.toString(16)]).toEqual([45725, '12763e65'])
    expect(GUIDANCE_LINES.slice(300)).toEqual(game)
  })

  it('C4: has the exact texts of § 3.1, no render input and the path src', () => {
    expect(game).toEqual(
      expectedGameLines().map((l) => ({
        ...l,
        kind: 'game',
        src: `/assets/audio/path/${l.id.replace(/\./g, '-')}.mp3`,
      })),
    )
    expect(game.filter((l) => l.input !== undefined)).toEqual([])
    expect(game.reduce((n, l) => n + l.text.length, 0)).toBe(684)
    expect(Math.min(...game.map((l) => l.text.length))).toBe(16)
    expect(Math.max(...game.map((l) => l.text.length))).toBe(30)
  })

  it('C4: the 30 game lines are rendered in Lily (none awaits its render)', () => {
    expect(
      game.filter((l) => GUIDANCE_LINES_AWAITING_RENDER.includes(l.id)),
    ).toEqual([])
  })

  it('C5: no game line says "play", "next" or "round"; only the retry says "again"', () => {
    for (const l of game) expect(l.text).not.toMatch(/\b(play|next|round)/i)
    expect(game.filter((l) => /again/i.test(l.text)).map((l) => l.id)).toEqual([
      'guide.game.again',
    ])
  })

  it('C4: no line outside guide.game.* names a game (Emma never suggests one)', () => {
    const others = GUIDANCE_LINES.filter((l) => l.kind !== 'game')
    expect(others.filter((l) => /flower bed|\bgame\b/i.test(l.text))).toEqual(
      [],
    )
    expect(others.filter((l) => l.id.startsWith('guide.game.'))).toEqual([])
  })
})
