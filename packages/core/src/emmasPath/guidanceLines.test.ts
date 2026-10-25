import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LITERACY_TREE, MATH_TREE } from '../progress/mastery'
import type { SkillNode } from '../progress/types'
import {
  CRITTER_NEVER_SAY,
  CRITTER_NOT_SAID,
  CRITTER_PICTURE_WORDS,
  CRITTER_SAID_WORDS,
} from '../games/playPlace'
import { STAGE_SPOKEN_NAMES } from '../sessionEnd/friendlyNodeName'
import {
  GUIDANCE_LINES,
  GUIDANCE_LINES_AWAITING_RENDER,
  critterWordLine,
  guidanceLine,
  peekLines,
  peekAskLine,
  pickerWhoLine,
  replayLines,
  sessionIntroLine,
  type GuidanceLineKind,
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
      'session-peek-open': 42,
      'session-peek-close': 42,
      // Content wave 4: more and less; bee, car (duck words' text) and sheep
      // stories. Real blending: blending sounds and sounding out. Content
      // wave 5: zeros, adding big numbers; snail and moon words (duck words'
      // text) and goat stories (sheep stories' text).
      'session-intro': 21,
      'session-hiding': 1,
      'session-replay-open': 44,
      'session-replay-close': 44,
      // Content wave 3 § 5.1: "Read the story." and the 54 word clips;
      // content wave 4 § 8.1: 17 more; content wave 5 § 9.1: 16 more.
      'story-read': 1,
      'story-word': 87,
      // Learner profiles § 1.3 (T5): the picker's "Who is playing?".
      'picker-who': 1,
      // The Play place and its two games (play-place spec § 4.1).
      play: 19,
      // The locked-stop peek prompt (locked-stop-peek-prompt § 3).
      'map-peek-ask-locked': 1,
      'map-peek-ask': 1,
      // The letter critters' said words (Thomas 2026-10-22; Dave
      // 2026-10-25: 7 more).
      'play-word': 163,
    })
    expect(GUIDANCE_LINES).toHaveLength(490)
    expect(new Set(GUIDANCE_LINES.map((l) => l.id)).size).toBe(490)
    // Bee, car, snail and moon words' leads are duck words' text (content
    // wave 4 § 11, wave 5 § 9.1), goat stories' sheep stories', and five
    // critter words' captions are story words' ("And.", "Got.", "Hid.",
    // "Ran.", "Sat."): 490 ids, 480 texts, 490 files.
    expect(new Set(GUIDANCE_LINES.map((l) => l.text)).size).toBe(480)
    expect(new Set(GUIDANCE_LINES.map((l) => l.src)).size).toBe(490)
  })

  it('AC8: both replay sets, one line per STAGE_SPOKEN_NAMES step, with the exact texts (map-tap-to-play § 6, T1 approved 2026-10-17)', () => {
    const steps = Object.keys(STAGE_SPOKEN_NAMES) as SkillNode[]
    expect(steps).toHaveLength(44)
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
    // bee, car and sheep's 27, 27, 31 and 19, 19, 23 (§ 8.1); real
    // blending sounding out's 30 and 22 (§ 11); content wave 5 zeros' 23
    // and 15, adding big numbers' 36 and 28, snail, moon and goat's 29, 28,
    // 30 and 21, 20, 22 (§ 9.1).
    expect(chars(open)).toBe(1321)
    expect(chars(close)).toBe(969)
    expect(guidanceLine('guide.session.replay-close.number-recog')?.text).toBe(
      'You know numbers!',
    )
    expect(guidanceLine('guide.session.replay-open.mult-2-5-10')?.text).toBe(
      "Let's play groups of two, five and ten again!",
    )
    expect(Math.max(...[...open, ...close].map((l) => l.text.length))).toBe(45)
    // Rendered in Lily, the story steps' 6 and hundreds' pair too (content
    // wave 3 § 5.1), more and less's pair, content wave 4's land-8 6
    // (§ 8.1), real blending's sounding-out pair (§ 11) and content wave
    // 5's Number Garden pairs and land-9 6 (§ 9.1).
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
    ).toHaveLength(490)
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

describe('the flower bed moved into adding to ten (flower-bed-into-add-to-10 § 6)', () => {
  it('C3: the 30 game lines and the game kind are gone; the 306 others are unchanged', () => {
    // The fingerprint (FNV-1a over the JSON of id, kind, world, text, input
    // and src, in order) of the 300 lines on main at 4724665f, before the
    // game lines were appended (299 at ae6472c5: 45621, b78acc53; 289 at
    // 8b0935b8: 43921, 77d72c5f; 258 at c86d551e: 39492, eea1867e). Real
    // blending's 6 session lines (§ 11) sit among them, and the Play place's
    // 18 lines (play-place spec § 4.1) follow them; the fingerprint is of
    // the other 300.
    const realBlending = new Set([
      'guide.session.intro.blending-cv',
      'guide.session.intro.sounding-out',
      'guide.session.peek-open.sounding-out',
      'guide.session.peek-close.sounding-out',
      'guide.session.replay-open.sounding-out',
      'guide.session.replay-close.sounding-out',
    ])
    expect(GUIDANCE_LINES.filter((l) => realBlending.has(l.id))).toHaveLength(6)
    const shipped = JSON.stringify(
      GUIDANCE_LINES.filter(
        (l) =>
          !realBlending.has(l.id) &&
          l.kind !== 'play' &&
          l.kind !== 'play-word' &&
          !l.kind.startsWith('map-peek-ask'),
      ).map(({ id, kind, world, text, input, src }) => [
        id,
        kind,
        world,
        text,
        input ?? null,
        src,
      ]),
    )
    let hash = 0x811c9dc5
    for (let i = 0; i < shipped.length; i++) {
      hash ^= shipped.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
    expect([shipped.length, hash.toString(16)]).toEqual([45725, '12763e65'])
    expect(
      GUIDANCE_LINES.filter((l) => l.id.startsWith('guide.game.')),
    ).toEqual([])
    // @ts-expect-error -- 'game' is no longer a GuidanceLineKind (C3).
    const retired: GuidanceLineKind = 'game'
    expect(GUIDANCE_LINES.filter((l) => l.kind === retired)).toEqual([])
    expect(GUIDANCE_LINES.filter((l) => l.src.includes('guide-game-'))).toEqual(
      [],
    )
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

/** Play-place spec § 4.1, row by row: the 19 lines of the Play place. */
function expectedPlayLines(): { id: string; text: string; input?: string }[] {
  return [
    { id: 'guide.play.open', text: 'What shall we play?' },
    { id: 'guide.play.raft.open', text: 'The raft can carry ten!' },
    ...NUMBER.map((n, i) => ({
      id: `guide.play.raft.total.${i + 1}`,
      text: `${Cap(n)}!`,
      input: `${Cap(n)},`,
    })),
    { id: 'guide.play.raft.go', text: 'Ten! Off we go!' },
    // "Splash!" left the line for the splash sound (Thomas 2026-10-22).
    { id: 'guide.play.raft.splash', text: 'Too heavy!' },
    { id: 'guide.play.raft.silly', text: 'Hee hee! Silly animals!' },
    { id: 'guide.play.raft.close', text: 'What a party on the island!' },
    // The open line and three non-word lines (Thomas 2026-10-22); the
    // open line names the drag (Thomas 2026-10-23, Marian's play test).
    {
      id: 'guide.play.critters.open',
      text: "Drag three letters up to the log. If they make a word, I'll say it!",
    },
    {
      id: 'guide.play.critters.funny.1',
      text: "Is this a word? I don't know what it means!",
    },
    { id: 'guide.play.critters.funny.2', text: 'Hmm! What could that mean?' },
    { id: 'guide.play.critters.funny.3', text: 'Hee hee! Is that a word?' },
  ]
}

describe('the Play place lines (play-place spec § 4)', () => {
  const play = GUIDANCE_LINES.filter((l) => l.kind === 'play')

  it('C7: leaves the 306 shipped lines unchanged and appends the 19 play lines', () => {
    // FNV-1a over the JSON of id, kind, world, text, input and src, in
    // order, of the 306 lines before the play lines: the 336 on main at
    // a8abb91b (50199, 9a6b2645) less the 30 game lines retired by the
    // flower bed's move into adding to ten.
    const shipped = JSON.stringify(
      GUIDANCE_LINES.slice(0, 306).map(
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
    expect([shipped.length, hash.toString(16)]).toEqual([46755, 'c9263c74'])
    expect(GUIDANCE_LINES.slice(306, 325)).toEqual(play)
  })

  it('C7: has the exact texts of § 4.1, world-free, the path src, inputs only on the totals', () => {
    expect(play).toEqual(
      expectedPlayLines().map(({ id, text, input }) => ({
        id,
        kind: 'play',
        world: null,
        text,
        ...(input === undefined ? {} : { input }),
        src: `/assets/audio/path/${id.replace(/\./g, '-')}.mp3`,
      })),
    )
    expect(play.filter((l) => l.input !== undefined).map((l) => l.id)).toEqual(
      NUMBER.map((_, i) => `guide.play.raft.total.${i + 1}`),
    )
    // About 250 Lily characters (T3); 242 when "Splash!" left, 308 with the
    // critters' new open line and three non-word lines (Thomas 2026-10-22),
    // 322 with the open line naming the drag (53 → 67, Thomas 2026-10-23).
    // The inputs are as long as the texts.
    expect(play.reduce((n, l) => n + l.text.length, 0)).toBe(322)
    expect(play.reduce((n, l) => n + (l.input ?? l.text).length, 0)).toBe(322)
  })

  it('C7: the 19 play lines are rendered in Lily (none awaits its render)', () => {
    expect(
      play.filter((l) => GUIDANCE_LINES_AWAITING_RENDER.includes(l.id)),
    ).toEqual([])
  })

  it('C8: no Emma line (kind play) says again, next, more, round, win, fast or "not a word"; the read-back words (kind play-word) are out of scope', () => {
    const banned = /\b(again|next|more|round|win|fast)\b|not a word/i
    // C8's scope (Thomas 2026-10-22): every guide.play.* line but the
    // 'play-word' ones, which only say back the run she built (§ 3.3).
    const scoped = GUIDANCE_LINES.filter(
      (l) => l.id.startsWith('guide.play.') && l.kind !== 'play-word',
    )
    expect(scoped).toEqual(play)
    expect(scoped).toHaveLength(19)
    for (const l of scoped) expect(l.text).not.toMatch(banned)
    // Out of scope by name: "Win." is the one read-back word that hits.
    expect(
      GUIDANCE_LINES.filter(
        (l) => l.kind === 'play-word' && banned.test(l.text),
      ).map((l) => l.id),
    ).toEqual(['guide.play.critters.word.win'])
  })

  it('C8: no line outside guide.play.* is a play line', () => {
    expect(
      GUIDANCE_LINES.filter(
        (l) =>
          (l.kind === 'play' || l.kind === 'play-word') !==
          l.id.startsWith('guide.play.'),
      ),
    ).toEqual([])
  })
})

describe('the locked-stop peek prompt lines (locked-stop-peek-prompt § 3)', () => {
  const ask = GUIDANCE_LINES.filter((l) => l.kind.startsWith('map-peek-ask'))

  it('AC 1: appends the two lines with the exact texts, world-free, the path src', () => {
    expect(GUIDANCE_LINES.slice(325, 327)).toEqual(ask)
    expect(ask).toEqual([
      {
        id: 'guide.map.peek-ask.locked',
        kind: 'map-peek-ask-locked',
        world: null,
        text: 'This one is locked. Want to try it?',
        src: '/assets/audio/path/guide-map-peek-ask-locked.mp3',
      },
      {
        id: 'guide.map.peek-ask',
        kind: 'map-peek-ask',
        world: null,
        text: 'Want to try it?',
        src: '/assets/audio/path/guide-map-peek-ask.mp3',
      },
    ])
    // 50 Lily characters (§ 3, T1).
    expect(ask.reduce((n, l) => n + l.text.length, 0)).toBe(50)
  })

  it('AC 2: peekAskLine is the locked line for a locked stop, the plain one for an open later stop', () => {
    expect(peekAskLine({ state: 'locked' }).id).toBe(
      'guide.map.peek-ask.locked',
    )
    expect(peekAskLine({ state: 'open' }).id).toBe('guide.map.peek-ask')
  })

  it('the two lines are rendered in Lily (none awaits its render)', () => {
    expect(
      ask.filter((l) => GUIDANCE_LINES_AWAITING_RENDER.includes(l.id)),
    ).toEqual([])
  })
})

describe('the letter critters’ said words (Thomas 2026-10-22)', () => {
  const words = GUIDANCE_LINES.filter((l) => l.kind === 'play-word')
  const cap = (w: string) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`

  it('one line per CRITTER_SAID_WORDS word, in its order, last in the catalogue', () => {
    expect(GUIDANCE_LINES.slice(327)).toEqual(words)
    expect(words).toEqual(
      CRITTER_SAID_WORDS.map((w) => ({
        id: `guide.play.critters.word.${w}`,
        kind: 'play-word',
        world: null,
        text: `${cap(w)}.`,
        // "Sat," and "Wed," read as days (ear test #661): a doubled letter.
        input:
          ({ sat: 'Satt,', wed: 'Wedd,' } as Record<string, string>)[w] ??
          `${cap(w)},`,
        src: `/assets/audio/path/guide-play-critters-word-${w}.mp3`,
      })),
    )
    // 163 inputs of four characters each, two of them five (Dave
    // 2026-10-25's seven: 28 characters).
    expect(words.reduce((n, l) => n + l.input!.length, 0)).toBe(654)
    expect(
      words.filter((l) => /^(Sat|Wed),$/.test(l.input!)).map((l) => l.id),
    ).toEqual([])
  })

  it('the 163 are rendered in Lily (none awaits its render)', () => {
    expect(
      words.filter((l) => GUIDANCE_LINES_AWAITING_RENDER.includes(l.id)),
    ).toEqual([])
  })

  it('critterWordLine finds every said word, and no picture, never-say or not-said word', () => {
    for (const w of CRITTER_SAID_WORDS)
      expect(critterWordLine(w)?.id).toBe(`guide.play.critters.word.${w}`)
    for (const w of [
      ...CRITTER_PICTURE_WORDS,
      ...CRITTER_NEVER_SAY,
      ...CRITTER_NOT_SAID,
      'tup',
    ])
      expect(critterWordLine(w)).toBeUndefined()
  })
})
