/**
 * Real blending: Word Song land 2 with two stops, blending sounds then
 * sounding out (`design/native/real-blending.md` § 1, § 9, § 11, § 13,
 * ACs 5, 6, 7, 10, 11).
 *
 * Failing-first. The migration comes first: a learner past land 2 has
 * `sounding-out` filled 'mastered' and marked celebrated on load and on a
 * cloud install (T4), the older-build `'locked'` pair is repaired the same
 * way, and a fresh learner is untouched. Then the step's wiring: the tree,
 * land 2, the names, the lines, the seeds and the learner start docs.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEBUG_SEED_NAMES, applyDebugSeed } from '../debug/seeds'
import {
  GUIDANCE_LINES,
  GUIDANCE_LINES_AWAITING_RENDER,
  guidanceLine,
  sessionIntroLine,
} from '../emmasPath/guidanceLines'
import { PATH_ART_IDS } from '../emmasPath/pathArt'
import {
  BAKED_PATH_LINES,
  PATH_LINES,
  PATH_LINES_AWAITING_RENDER,
  THEN_THIS_INPUT_STEPS,
  pathLine,
} from '../emmasPath/pathLines'
import {
  activateLearner,
  addLearner,
  ensureLearnerList,
  learnerKey,
  learnerStartProgress,
  resetLearnersForTests,
  type LearnerEntry,
} from '../learners'
import { buildMapModel } from '../map/mapModel'
import {
  getKeyValueStore,
  setKeyValueStore,
  type KeyValueStore,
} from '../platform/keyValueStore'
import {
  FRIENDLY_NODE_NAMES,
  STAGE_SPOKEN_NAMES,
  STAGE_SPOKEN_NAME_VERBS,
} from '../sessionEnd/friendlyNodeName'
import { installCloudBlob } from './cloudSync'
import { defaultProgress } from './defaults'
import { WORD_SONG_NODES_IN_ORDER, pickFocusNode } from './focusNode'
import { isProgressV1 } from './guards'
import { LANDS } from './lands'
import { LITERACY_TREE, MATH_TREE, applyMasteryRule, nextNode } from './mastery'
import { pendingUnlock } from './pathBeats'
import { STORAGE_KEY, loadProgress } from './storage'
import type {
  Progress,
  SessionHistoryEntry,
  SkillLevel,
  SkillNode,
  WordSongNode,
} from './types'

/** Typed by a cast so this file typechecks before the literal exists. */
const SO = 'sounding-out' as WordSongNode

/** The Word Song steps after land 2, in tree order (the old tree's tail). */
const AFTER_LAND_2 = LITERACY_TREE.slice(LITERACY_TREE.indexOf('cvc-words'))

/**
 * A learner on `current` (practicing) who did land 2 on a build without
 * sounding out: every Word Song step before `current` mastered, nothing
 * stored for `sounding-out`, and every open step celebrated.
 */
function pastLand2(
  current: WordSongNode = 'cvc-words-short-o',
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const seed = defaultProgress('Marian')
  const levels: Record<string, unknown> = { ...seed.skillLevels }
  for (const n of LITERACY_TREE) {
    if (n === current) break
    levels[n] = 'mastered'
  }
  levels[current] = 'practicing'
  delete levels[SO]
  Object.assign(levels, extra)
  const seen = [...MATH_TREE, ...LITERACY_TREE].filter(
    (n) => n !== SO && levels[n] !== 'locked' && n !== 'number-recog',
  )
  return { ...seed, skillLevels: levels, unlocksCelebrated: seen }
}

function store(doc: Record<string, unknown>): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
}

/** The two read paths every doc goes through (Decision 2). */
const READ_PATHS: ReadonlyArray<
  [string, (doc: Record<string, unknown>) => Progress | null]
> = [
  [
    'loadProgress',
    (doc) => {
      store(doc)
      return loadProgress()
    },
  ],
  ['installCloudBlob', (doc) => installCloudBlob(structuredClone(doc))],
]

describe('the migration (§ 9, T4, AC 5)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  for (const [path, read] of READ_PATHS) {
    describe(`through ${path}`, () => {
      it("(a) blending sounds mastered, no sounding-out key → 'mastered', the list gains it, no unlock beat, the picker stays put", () => {
        const doc = pastLand2('cvc-words-short-o')
        const loaded = read(doc)!
        expect(isProgressV1(loaded)).toBe(true)
        expect(loaded.skillLevels[SO]).toBe('mastered')
        expect(loaded.unlocksCelebrated).toEqual([
          ...(doc.unlocksCelebrated as string[]),
          SO,
        ])
        expect(pendingUnlock(loaded, 'word-song')).toBeNull()
        // Before the build the picker took cvc-words-short-o, the first
        // step that isn't mastered; it still does.
        expect(pickFocusNode(loaded, 'word-song')).toEqual({
          node: 'cvc-words-short-o',
          mode: 'forward',
        })
      })

      it("(b) blending sounds mastered + a stored 'locked' (an older build's pair) → the same as (a)", () => {
        const doc = pastLand2('digraphs-sh', { [SO]: 'locked' })
        const loaded = read(doc)!
        expect(loaded.skillLevels[SO]).toBe('mastered')
        expect(loaded.unlocksCelebrated).toContain(SO)
        expect(loaded.unlocksCelebrated!.filter((n) => n === SO)).toHaveLength(
          1,
        )
        expect(pendingUnlock(loaded, 'word-song')).toBeNull()
        expect(pickFocusNode(loaded, 'word-song').node).toBe('digraphs-sh')
      })

      it("(c) blending sounds practicing, no key → 'locked' (the floor), nothing celebrated", () => {
        const doc = pastLand2('blending-cv')
        const loaded = read(doc)!
        expect(loaded.skillLevels[SO]).toBe('locked')
        expect(loaded.unlocksCelebrated).toEqual(doc.unlocksCelebrated)
        expect(pickFocusNode(loaded, 'word-song').node).toBe('blending-cv')
      })

      for (const level of ['intro', 'practicing'] as const) {
        it(`(d) blending sounds mastered + '${level}' → untouched`, () => {
          const doc = pastLand2('cvc-words', { [SO]: level })
          const loaded = read(doc)!
          expect(loaded.skillLevels[SO]).toBe(level)
          expect(loaded.unlocksCelebrated).toEqual(doc.unlocksCelebrated)
          expect(pickFocusNode(loaded, 'word-song').node).toBe(SO)
        })
      }

      it("'mastered' stays 'mastered' and the list is not grown", () => {
        const doc = pastLand2('cvc-words', { [SO]: 'mastered' })
        const loaded = read(doc)!
        expect(loaded.skillLevels[SO]).toBe('mastered')
        expect(loaded.unlocksCelebrated).toEqual(doc.unlocksCelebrated)
      })

      it('(e) no list → none created; the step is still filled', () => {
        const doc = pastLand2('cvc-words-short-u')
        delete doc.unlocksCelebrated
        const loaded = read(doc)!
        expect(loaded.skillLevels[SO]).toBe('mastered')
        expect(loaded.unlocksCelebrated).toBeUndefined()
        expect(pendingUnlock(loaded, 'word-song')).toBeNull()
      })

      it('a list that already holds sounding-out is not given a second entry', () => {
        const doc = pastLand2('cvc-words')
        doc.unlocksCelebrated = [...(doc.unlocksCelebrated as string[]), SO]
        const loaded = read(doc)!
        expect(loaded.skillLevels[SO]).toBe('mastered')
        expect(loaded.unlocksCelebrated).toEqual(doc.unlocksCelebrated)
      })

      it("a fresh learner is unaffected: sounding out stays 'locked'", () => {
        const fresh = defaultProgress('Sam') as unknown as Record<
          string,
          unknown
        >
        const loaded = read(fresh)!
        expect(loaded.skillLevels[SO]).toBe('locked')
        expect(loaded.skillLevels).toEqual(defaultProgress('Sam').skillLevels)
        expect(pickFocusNode(loaded, 'word-song').node).toBe('letter-sounds')
      })
    })
  }

  it("the cloud install keeps the appended mark when the local list doesn't have it (K3, mergeUnlocksCelebrated)", () => {
    const doc = pastLand2('cvc-words-short-i')
    const local = doc.unlocksCelebrated as SkillNode[]
    const installed = installCloudBlob(structuredClone(doc), [], {}, local)!
    expect(installed.skillLevels[SO]).toBe('mastered')
    expect(installed.unlocksCelebrated).toContain(SO)
    expect(pendingUnlock(installed, 'word-song')).toBeNull()
  })

  it('a learner doc under a suffixed key gets the rule through the scoped store (AC 11)', () => {
    const before = getKeyValueStore()
    const raw = new MapStore()
    setKeyValueStore(raw)
    try {
      ensureLearnerList()
      const b = addLearner({
        name: 'Sam',
        avatarId: 'owl',
        start: { math: 1, wordSong: 1 },
      })
      raw.setItem(
        learnerKey(STORAGE_KEY, b),
        JSON.stringify(pastLand2('cvc-words-short-e')),
      )
      activateLearner(b.id)
      const loaded = loadProgress()!
      expect(loaded.skillLevels[SO]).toBe('mastered')
      expect(loaded.unlocksCelebrated).toContain(SO)
      expect(pendingUnlock(loaded, 'word-song')).toBeNull()
    } finally {
      resetLearnersForTests()
      setKeyValueStore(before)
    }
  })
})

class MapStore implements KeyValueStore {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}

function learner(start: LearnerEntry['start']): LearnerEntry {
  return {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    name: 'Sam',
    avatarId: 'owl',
    language: 'en',
    legacySlot: false,
    start,
    createdAtISO: '2026-10-19T17:00:00.000Z',
  }
}

describe('learner start docs (AC 11)', () => {
  it("Word Song land 3 or later → sounding out 'mastered'", () => {
    for (const wordSong of [3, 4, 9]) {
      if (!LANDS.some((l) => l.world === 'word-song' && l.number === wordSong))
        continue
      const p = learnerStartProgress(learner({ math: 1, wordSong }))
      expect(p.skillLevels['blending-cv'], `land ${wordSong}`).toBe('mastered')
      expect(p.skillLevels[SO], `land ${wordSong}`).toBe('mastered')
    }
  })

  it("Word Song land 2 → blending sounds 'intro', sounding out 'locked'", () => {
    const p = learnerStartProgress(learner({ math: 1, wordSong: 2 }))
    expect(p.skillLevels['blending-cv']).toBe('intro')
    expect(p.skillLevels[SO]).toBe('locked')
  })
})

// ── Mastery (AC 6) ─────────────────────────────────────────────────────

function goodDays(node: SkillNode): SessionHistoryEntry[] {
  return [
    '2026-10-15T10:00:00.000Z',
    '2026-10-16T10:00:00.000Z',
    '2026-10-17T10:00:00.000Z',
  ].map((dateISO) => ({ dateISO, skillFocus: [node], successRate: 1 }))
}

function withLevels(
  levels: Partial<Record<SkillNode, SkillLevel>>,
  history: SessionHistoryEntry[],
): Progress {
  const seed = defaultProgress('Marian')
  return {
    ...seed,
    skillLevels: { ...seed.skillLevels, ...levels },
    history,
  }
}

describe('the mastery rule (AC 6)', () => {
  it('mastering blending sounds opens sounding out, not cat words, in the same write', () => {
    const after = applyMasteryRule(
      withLevels(
        { 'letter-sounds': 'mastered', 'blending-cv': 'practicing' },
        goodDays('blending-cv'),
      ),
    )
    expect(after.skillLevels['blending-cv']).toBe('mastered')
    expect(after.skillLevels[SO]).toBe('intro')
    expect(after.skillLevels['cvc-words']).toBe('intro') // its baseline, unchanged
  })

  it("mastering sounding out takes cat words 'locked' → 'intro'", () => {
    const after = applyMasteryRule(
      withLevels(
        {
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          [SO]: 'practicing',
          'cvc-words': 'locked',
        },
        goodDays(SO),
      ),
    )
    expect(after.skillLevels[SO]).toBe('mastered')
    expect(after.skillLevels['cvc-words']).toBe('intro')
  })
})

// ── The step's wiring (§ 1, § 13, AC 7) ────────────────────────────────

describe('sounding out in the Word Song tree (§ 1, § 13)', () => {
  it('follows blending sounds and comes before cat words, in both tree lists', () => {
    for (const tree of [LITERACY_TREE, WORD_SONG_NODES_IN_ORDER]) {
      const i = tree.indexOf('blending-cv')
      expect(tree.slice(i, i + 3)).toEqual(['blending-cv', SO, 'cvc-words'])
    }
    expect(nextNode('word-song', 'blending-cv')).toBe(SO)
    expect(nextNode('word-song', SO)).toBe('cvc-words')
  })

  it("starts 'locked' for a fresh child", () => {
    expect(defaultProgress('Marian').skillLevels[SO]).toBe('locked')
  })

  it("land 2 holds ['blending-cv', 'sounding-out']; the Word Song land count and names are unchanged; LANDS flattened equals both trees", () => {
    const ws = LANDS.filter((l) => l.world === 'word-song')
    expect(ws[1]).toEqual({
      world: 'word-song',
      number: 2,
      name: 'Blending',
      nodes: ['blending-cv', SO],
    })
    expect(ws.map((l) => l.number)).toEqual(ws.map((_, i) => i + 1))
    expect(LANDS.flatMap((l) => l.nodes)).toEqual([
      ...MATH_TREE,
      ...LITERACY_TREE,
    ])
  })

  it('the Map draws two stops in land 2', () => {
    const map = buildMapModel(defaultProgress('Marian'), 'word-song')
    const land2 = map.lands.find((l) => l.number === 2)!
    expect(land2.stops.map((s) => s.node)).toEqual(['blending-cv', SO])
  })

  it('has path art', () => {
    expect(PATH_ART_IDS).toContain(SO)
  })

  it('has its names (T1): "sounding out", "is", recap "sounding out"; spoken names stay unique', () => {
    expect(STAGE_SPOKEN_NAMES[SO]).toBe('sounding out')
    expect(STAGE_SPOKEN_NAME_VERBS[SO]).toBe('is')
    expect(FRIENDLY_NODE_NAMES[SO]).toBe('sounding out')
    expect(STAGE_SPOKEN_NAMES['blending-cv']).toBe('blending sounds')
    const nodes = [...MATH_TREE, ...LITERACY_TREE]
    expect(new Set(nodes.map((n) => STAGE_SPOKEN_NAMES[n])).size).toBe(
      nodes.length,
    )
  })
})

describe('the lines (§ 11, AC 7)', () => {
  it("the two leads: blending sounds' and sounding out's", () => {
    expect(sessionIntroLine('blending-cv')).toMatchObject({
      id: 'guide.session.intro.blending-cv',
      kind: 'session-intro',
      world: 'word-song',
      text: 'The sounds make a word!',
    })
    expect(sessionIntroLine(SO)).toMatchObject({
      id: 'guide.session.intro.sounding-out',
      text: 'Tap the letters. Hear the sounds!',
    })
  })

  it("sounding out's peek and replay lines", () => {
    expect(guidanceLine('guide.session.peek-open.sounding-out')?.text).toBe(
      "Let's look at sounding out!",
    )
    expect(guidanceLine('guide.session.peek-close.sounding-out')?.text).toBe(
      'Sounding out is for later. You will learn it!',
    )
    expect(guidanceLine('guide.session.replay-open.sounding-out')?.text).toBe(
      "Let's play sounding out again!",
    )
    expect(guidanceLine('guide.session.replay-close.sounding-out')?.text).toBe(
      'You know sounding out!',
    )
  })

  it('the path lines name the step, and the two cat-words lines carry their new text and input', () => {
    expect(pathLine('path.open.sounding-out')?.text).toBe(
      'Here is your path! You are on sounding out.',
    )
    expect(pathLine('path.stop.sounding-out')).toMatchObject({
      text: 'Sounding out.',
    })
    expect(pathLine('path.stop.sounding-out')?.input).toBeUndefined()
    expect(pathLine('path.locked.next.sounding-out')).toMatchObject({
      text: 'Sounding out! First, blending sounds. Then this!',
      input: 'Sounding out! First, blending sounds; then this!',
    })
    expect(pathLine('end.bud.sounding-out')?.text).toBe(
      'Look! A new flower for sounding out!',
    )
    expect(pathLine('end.unlock.sounding-out')?.text).toBe(
      'You learned blending sounds! Now you can do sounding out!',
    )
    expect(pathLine('path.locked.next.cvc-words')).toMatchObject({
      text: 'Cat words! First, sounding out. Then this!',
      input: 'Cat words! First, sounding out; then this!',
    })
    expect(pathLine('end.unlock.cvc-words')?.text).toBe(
      'You learned sounding out! Now you can do cat words!',
    )
    expect([...THEN_THIS_INPUT_STEPS]).toEqual(
      expect.arrayContaining([SO, 'cvc-words']),
    )
  })

  // Guidance was 354 on main with #635's 30 game lines and the Play place's
  // 18; the flower bed's move into adding to ten takes the game lines out,
  // the locked-stop peek prompt adds its 2 (peek prompt § 3), and the letter
  // critters their third non-word line and 156 said words (Thomas 2026-10-22),
  // then 7 more said words (Dave 2026-10-25), then the four-letter rounds'
  // 82 targets, 9 said-later words and open line (Dave 2026-10-26, (B)).
  it('counts: guidance 354 → 324 ids after the game lines left (582 with the peek prompt and the critter words), path lines 814 → 851, baked 254 → 259', () => {
    expect(GUIDANCE_LINES).toHaveLength(582)
    expect(PATH_LINES).toHaveLength(851)
    expect(BAKED_PATH_LINES).toHaveLength(259)
  })

  const NEW_GUIDANCE_IDS = [
    'guide.session.intro.blending-cv',
    'guide.session.intro.sounding-out',
    'guide.session.peek-open.sounding-out',
    'guide.session.peek-close.sounding-out',
    'guide.session.replay-open.sounding-out',
    'guide.session.replay-close.sounding-out',
  ]
  const NEW_PATH_IDS = [
    'path.open.sounding-out',
    'path.stop.sounding-out',
    'path.locked.next.sounding-out',
    'end.bud.sounding-out',
    'end.unlock.sounding-out',
    'path.locked.next.cvc-words',
    'end.unlock.cvc-words',
  ]

  it('the 6 new guidance lines and the 7 new or changed path lines are rendered in Lily', () => {
    for (const id of [...NEW_GUIDANCE_IDS, ...NEW_PATH_IDS]) {
      expect(GUIDANCE_LINES_AWAITING_RENDER).not.toContain(id)
      expect(PATH_LINES_AWAITING_RENDER).not.toContain(id)
    }
  })

  it('§ 11: 13 new texts (470 characters) and 13 inputs (470 characters) in these lines', () => {
    const lines = [
      ...NEW_GUIDANCE_IDS.map((id) => guidanceLine(id)!),
      ...NEW_PATH_IDS.map((id) => BAKED_PATH_LINES.find((l) => l.id === id)!),
    ]
    expect(lines.every((l) => l !== undefined)).toBe(true)
    const texts = new Set(lines.map((l) => l.text))
    expect(texts.size).toBe(13)
    expect([...texts].reduce((n, t) => n + t.length, 0)).toBe(470)
    const inputs = new Set(lines.map((l) => l.input ?? l.text))
    expect([...inputs].reduce((n, t) => n + t.length, 0)).toBe(470)
  })
})

// ── Debug seeds (§ 9, AC 10) ───────────────────────────────────────────

/** The step the picker took before the build: the old order, no sounding out. */
function oldPick(p: Progress): SkillNode {
  const order = WORD_SONG_NODES_IN_ORDER.filter((n) => n !== SO)
  return order.find((n) => p.skillLevels[n] !== 'mastered') ?? order.at(-1)!
}

describe('debug seeds (AC 10)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it("the 15 seeds with blending sounds mastered store sounding out mastered, and every seed's picker lands where it did", () => {
    let count = 0
    for (const name of DEBUG_SEED_NAMES) {
      window.localStorage.clear()
      expect(applyDebugSeed(name), name).toBe(true)
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as {
        skillLevels: Record<string, unknown>
      }
      if (stored.skillLevels['blending-cv'] === 'mastered') {
        count++
        expect(stored.skillLevels[SO], name).toBe('mastered')
      }
      const loaded = loadProgress()!
      expect(pickFocusNode(loaded, 'word-song').node, name).toBe(
        oldPick(loaded),
      )
    }
    // 15: the 12 before, and Letter critters' word hunt seeds
    // (critters-hunt, critters-hunt-four, critters-hunt-i).
    expect(count).toBe(15)
  })
})

/** The old tree's Word Song tail, so the slice above is not dead weight. */
it('cat words and every later step follow sounding out', () => {
  expect(AFTER_LAND_2[0]).toBe('cvc-words')
  expect(LITERACY_TREE.indexOf(SO)).toBe(LITERACY_TREE.indexOf('cvc-words') - 1)
})
