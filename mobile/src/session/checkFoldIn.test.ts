/**
 * The cat words check folded into the plant sessions (Dave's ruling
 * 2026-10-25, `tmp/specs/dave-check-foldin-ruling.txt`; Thomas, build 22:
 * "even if i play twice or three times to get the required plants i have
 * to play two more times?").
 *
 * Each test plays real sessions on the device's wiring: the hints the
 * session starts from, the Word Song session (the committed cvc-words
 * canon plan with the bundled probe words swapped in), Session End's write
 * and guidance, and the Hub visit. No network, no audio, no paid call.
 *
 * The rule under test, from (1)-(5):
 * - every forward cat-words session carries 3 probes (problems 2/5/7)
 *   from the learner's first one until a 6-word attempt passes at 5 of 6,
 *   except the 1 plain session after a failed attempt;
 * - the flower reads the practised words only, on the 8-problem scale;
 * - the row's last flower is held until the check passes, so a full row
 *   always means the step opens;
 * - a row already full when the build lands stays full (the migration
 *   marker).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setDayOffsetSource, setKeyValueStore } from '@marian/core'
import { planHubVisit } from '@marian/core/hub/hubVisit'
import type { FlowerWakeRecord } from '@marian/core/hub/hubGuidance'
import { placeAtStep } from '@marian/core/learners/startDoc'
import {
  defaultProgress,
  getSettings,
  loadProgress,
  saveProgress,
  type MasteryThreshold,
  type Progress,
  type SessionHistoryEntry,
} from '@marian/core/progress'
import { nodeProgress } from '@marian/core/progress/nodeProgress'
import { readSessionHistoryForToday } from '@marian/core/sessionEnd/sessionHistory'
import { GRADUATION_PROBE_WORDS } from '@marian/core/wordSong/novelProbeWords'
import type { LoadedSessionAudio, PreparedSession } from '../audio'
import { writeSessionEnd } from './sessionEndWrite'
import { readWordSongProgressHints } from './wordSongHints'
import { createWordSongSessionController } from './wordSongSession'

const canonDoc = (stem: string) =>
  JSON.parse(
    readFileSync(
      resolve(
        __dirname,
        '../../../public/canon/word-song/level-1',
        `${stem}.json`,
      ),
      'utf8',
    ),
  )
const CVC = canonDoc('cvc-words')
const PROBE = canonDoc('cvc-words-probe')
const CANON_WORDS = ['hat', 'fan', 'man', 'van', 'cat', 'bag', 'pan', 'tag']
const PROBES: ReadonlySet<string> = new Set(GRADUATION_PROBE_WORDS)

let clockNow = new Date('2026-10-26T09:00:00')
const clock = () => clockNow
function setNow(local: string): void {
  clockNow = new Date(local)
  jest.setSystemTime(clockNow)
}

const N2: MasteryThreshold = { percent: 0.8, sessions: 2 }
const N3: MasteryThreshold = { percent: 0.875, sessions: 3 }

/**
 * A learner at cat words for the first time: the steps before it grown,
 * cat words at intro, no cat-words history.
 */
function freshLearner(
  threshold: MasteryThreshold,
  crossDayEnforcement: boolean,
  autoPromote = true,
): Progress {
  const placed = placeAtStep(defaultProgress(), 'cvc-words')
  return {
    ...placed,
    parentSettings: {
      ...getSettings(placed),
      autoPromote,
      crossDayEnforcement,
      masteryThreshold: { math: threshold, 'word-song': threshold },
    },
  }
}

function fakeAudio(lines: ReadonlyArray<{ id: string; text: string }>) {
  const textToId = new Map<string, string>()
  for (const l of lines) if (!textToId.has(l.text)) textToId.set(l.text, l.id)
  const audio: LoadedSessionAudio = {
    sessionId: 's',
    playUtterance: jest.fn(() => Promise.resolve()),
    playUtteranceById: jest.fn(() => Promise.resolve()),
    prewarm: jest.fn(),
    fileFor: jest.fn(() => undefined),
    textToId,
    utteranceCount: lines.length,
    fileCount: textToId.size,
    bundledCount: 0,
    filesWritten: 0,
    bytesWritten: 0,
    ready: Promise.resolve(),
    unload: jest.fn(),
  }
  return audio
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
}

/**
 * One Word Song session at `local` time on the persisted progress, played
 * with `correct(word)` as every first tap, then Session End's write.
 */
async function play(local: string, correct: (word: string) => boolean) {
  setNow(local)
  const hints = readWordSongProgressHints()
  const review = hints.planKind.kind === 'review'
  const loadProbeAudio = jest.fn(() => fakeAudio(PROBE.utterances))
  let resolveStart!: (p: PreparedSession) => void
  const session = createWordSongSessionController({
    start: jest.fn(
      () =>
        new Promise<PreparedSession>((res) => {
          resolveStart = res
        }),
    ),
    fallbackPlanId: () => 'cvc',
    loadProbeAudio,
  } as unknown as Parameters<typeof createWordSongSessionController>[0])
  session.kick()
  resolveStart({
    sessionId: 'x',
    track: 'word-song',
    plan: review ? { ...CVC.plan, id: 'review-cvc' } : CVC.plan,
    audio: fakeAudio(CVC.utterances),
    fetchMs: 1,
  })
  await flush()
  const snap = session.getSnapshot()
  const words = snap
    .plan!.problems.slice(snap.warmupCount)
    .map((p) => p.target.word)
  const perProblemCorrect = words.map(correct)
  const result = writeSessionEnd(
    {
      totalCorrect: perProblemCorrect.filter(Boolean).length,
      totalStardust: 0,
      finalStreak: 0,
      earnedThisSession: 0,
      surface: 'word-song',
      targetWords: words,
      perProblemCorrect,
      firstTapCorrect: perProblemCorrect,
      sessionFocus: session.sessionFocus ?? undefined,
      ...(snap.review ? { review: true as const } : {}),
    },
    { clock },
  )
  session.tearDown()
  return {
    hints,
    review: snap.review,
    words,
    probes: words.flatMap((w, i) => (PROBES.has(w) ? [i + 1] : [])),
    probeAudio: loadProbeAudio.mock.calls.length > 0,
    day: result.guidance.day,
    before: result.guidance.slotsBefore,
    after: result.guidance.slotsAfter,
    newSlot: result.guidance.newSlot,
    bonusSlots: result.guidance.bonusSlots,
    countText: result.guidance.countText,
    lines: result.guidance.lines.map((l) => l.id),
    beat: result.beat.kind,
  }
}

const allRight = () => true
const missing =
  (...missed: string[]) =>
  (w: string) =>
    !missed.includes(w)

let seenWake: FlowerWakeRecord = {}
/** The Hub as it mounts at `local` time (the wake record carried over). */
function hub(local: string) {
  setNow(local)
  const visit = planHubVisit({
    progress: loadProgress(),
    history: readSessionHistoryForToday(clockNow),
    now: clockNow,
    seenWake,
    suppressed: false,
  })
  seenWake = visit.wake.next
  return {
    slots: visit.wordSong.slots,
    numberGarden: visit.numberGarden.slots,
    suggestion: visit.suggestion,
    lines: visit.lines,
  }
}

const cat = () => loadProgress()!.skillLevels['cvc-words']
const last = (): SessionHistoryEntry =>
  loadProgress()!
    .history.filter((e) => e.skillFocus.includes('cvc-words'))
    .at(-1)!

const G = 'grown'
const S = 'sleeping'
const E = 'empty'

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
  seenWake = {}
  jest.useFakeTimers({ now: clockNow, doNotFake: ['setImmediate'] })
  // Cloud sync is skipped without a secret; nothing reaches the network.
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('N=2 (0.8/2), separate days off: the simulator pre-check', () => {
  it('session 1: part 1 + flower 1; the Hub says one more; session 2: part 2 passes and the 2nd flower is the unlock day', async () => {
    saveProgress(freshLearner(N2, false))
    const s1 = await play('2026-10-26T09:00:00', allRight)
    expect(s1.hints.isGraduationSession).toBe(true)
    expect(s1.words).toEqual([
      'hat',
      'map',
      'man',
      'van',
      'nap',
      'bag',
      'rat',
      'tag',
    ])
    expect(s1.probes).toEqual([2, 5, 7])
    expect(last().novelPoolPart).toEqual({
      words: ['map', 'nap', 'rat'],
      correct: 3,
      next: ['ham', 'cab', 'rag'],
    })
    expect(s1.day).toBe('good-day')
    expect(s1.before).toEqual([E, E])
    expect(s1.after).toEqual([G, E])
    expect(s1.newSlot).toBe(0)
    expect(s1.countText).toBe('1 of 2')
    expect(s1.lines).toEqual(['guide.end.right.8', 'guide.end.flower'])

    const between = hub('2026-10-26T09:05:00')
    expect(between.slots).toEqual([G, E])
    expect(between.suggestion).toBe('word-song')
    expect(between.lines).toEqual(['guide.one-more'])

    const s2 = await play('2026-10-26T09:20:00', allRight)
    expect(s2.probes).toEqual([2, 5, 7])
    expect(s2.words.filter((w) => PROBES.has(w))).toEqual(['ham', 'cab', 'rag'])
    expect(last().novelPoolSuccessRate).toBe(1)
    expect(cat()).toBe('mastered')
    expect(loadProgress()!.skillLevels['cvc-words-short-o']).toBe('intro')
    expect(s2.beat).toBe('unlock')
    expect(s2.day).toBe('unlock')
    expect(s2.before).toEqual([G, E])
    expect(s2.after).toEqual([G, G])
    expect(s2.newSlot).toBe(1)
    expect(s2.countText).toBe('2 of 2!')
    expect(s2.lines).toEqual([
      'guide.end.right.8',
      'guide.end.flower',
      'guide.end.path-opens',
    ])
  })

  it('a failed attempt: held flower (practice day, row 1/2, one more), 1 plain session, then a 2-session retake whose pass lands the held flower even on a weak session', async () => {
    saveProgress(freshLearner(N2, false))
    const s1 = await play('2026-10-26T09:00:00', missing('map', 'nap'))
    expect(s1.day).toBe('good-day')
    expect(s1.after).toEqual([G, E])
    const s2 = await play('2026-10-26T09:20:00', allRight)
    expect(last().novelPoolSuccessRate).toBeCloseTo(4 / 6)
    expect(cat()).toBe('practicing')
    // Two good sessions banked, the second flower held for the check.
    expect(nodeProgress(loadProgress()!, 'cvc-words').goodDays).toBe(1)
    expect(s2.day).toBe('practice')
    expect(s2.before).toEqual([G, E])
    expect(s2.after).toEqual([G, E])
    expect(s2.newSlot).toBeNull()
    expect(s2.lines).toEqual(['guide.end.not-yet.praise'])
    expect(hub('2026-10-26T09:25:00')).toMatchObject({
      slots: [G, E],
      lines: ['guide.one-more'],
    })

    // The 1 plain session after a failed attempt.
    const s3 = await play('2026-10-26T09:40:00', allRight)
    expect(s3.hints.isGraduationSession).toBe(false)
    expect(s3.words).toEqual(CANON_WORDS)
    expect(s3.probeAudio).toBe(false)
    expect(s3.day).toBe('practice')
    expect(s3.after).toEqual([G, E])
    expect(s3.lines).toEqual(['guide.end.not-yet.praise'])

    // The retake: the next 2 forward sessions.
    const s4 = await play('2026-10-26T10:00:00', allRight)
    expect(s4.probes).toEqual([2, 5, 7])
    expect(s4.words.filter((w) => PROBES.has(w))).toEqual(['ram', 'pad', 'rat'])
    expect(s4.day).toBe('practice')
    expect(s4.lines).toEqual(['guide.end.not-yet.praise'])
    const s5 = await play('2026-10-26T10:20:00', missing('hat', 'man'))
    expect(last().successRate).toBe(6 / 8)
    expect(last().novelPoolSuccessRate).toBe(1)
    expect(cat()).toBe('mastered')
    expect(s5.day).toBe('unlock')
    expect(s5.before).toEqual([G, E])
    expect(s5.after).toEqual([G, G])
    expect(s5.lines).toEqual([
      'guide.end.not-yet.praise',
      'guide.end.flower',
      'guide.end.path-opens',
    ])
  })

  it('autoPromote off: the pass fills the row (in the parent’s queue), then no more probes', async () => {
    saveProgress(freshLearner(N2, false, false))
    await play('2026-10-26T09:00:00', allRight)
    const s2 = await play('2026-10-26T09:20:00', allRight)
    expect(cat()).toBe('practicing')
    expect(loadProgress()!.pendingPromotion).toBe('cvc-words')
    expect(s2.after).toEqual([G, G])
    expect(s2.day).toBe('good-day')
    const s3 = await play('2026-10-26T09:40:00', allRight)
    expect(s3.hints.isGraduationSession).toBe(false)
    expect(s3.words).toEqual(CANON_WORDS)
    expect(s3.day).toBe('practice')
    expect(s3.after).toEqual([G, G])
    expect(s3.lines).toEqual(['guide.end.not-yet.praise'])
  })
})

describe('N=3 (0.875/3), separate days on', () => {
  it('pass on the first attempt: 3 days; same-day sessions are reviews with no probes', async () => {
    saveProgress(freshLearner(N3, true))
    // One practised miss: a good day, not a secure one (no fast track).
    const d1 = await play('2026-10-26T09:00:00', missing('hat'))
    expect(d1.probes).toEqual([2, 5, 7])
    expect(d1.day).toBe('good-day')
    expect(d1.after).toEqual([S, E, E])
    expect(d1.lines).toEqual([
      'guide.end.right.7',
      'guide.end.flower',
      'guide.end.count.1',
      'guide.end.sleeps',
    ])

    // A same-day replay is a review: no probes, no history, the attempt waits.
    const review = await play('2026-10-26T09:30:00', allRight)
    expect(review.hints.planKind.kind).toBe('review')
    expect(review.review).toBe(true)
    expect(review.probes).toEqual([])
    expect(review.probeAudio).toBe(false)
    expect(review.day).toBe('practice')
    expect(review.after).toEqual([S, E, E])
    expect(last().novelPoolPart?.words).toEqual(['map', 'nap', 'rat'])

    const d2 = await play('2026-10-27T09:00:00', allRight)
    expect(d2.words.filter((w) => PROBES.has(w))).toEqual(['ham', 'cab', 'rag'])
    expect(last().novelPoolSuccessRate).toBe(1)
    expect(cat()).toBe('practicing')
    expect(d2.day).toBe('good-day')
    expect(d2.before).toEqual([G, E, E])
    expect(d2.after).toEqual([G, S, E])
    expect(d2.lines).toEqual([
      'guide.end.right.8',
      'guide.end.flower',
      'guide.end.count.2',
      'guide.end.sleeps',
    ])

    const d3 = await play('2026-10-28T09:00:00', allRight)
    expect(d3.hints.isGraduationSession).toBe(false)
    expect(d3.words).toEqual(CANON_WORDS)
    expect(cat()).toBe('mastered')
    expect(d3.day).toBe('unlock')
    expect(d3.after).toEqual([G, G, G])
    expect(d3.lines).toEqual([
      'guide.end.right.8',
      'guide.end.flower',
      'guide.end.count.3',
      'guide.end.path-opens',
    ])
  })

  it('fail, then retake: flower 2 sleeps as a shown flower; the held 3rd never sleeps; Emma names only shown sleeping flowers', async () => {
    saveProgress(freshLearner(N3, true))
    await play('2026-10-26T09:00:00', allRight)
    const d2 = await play('2026-10-27T09:00:00', missing('ham', 'cab'))
    expect(last().novelPoolSuccessRate).toBeCloseTo(4 / 6)
    expect(d2.day).toBe('good-day')
    expect(d2.after).toEqual([G, S, E])
    expect(d2.lines).toEqual([
      'guide.end.not-yet.praise',
      'guide.end.flower',
      'guide.end.count.2',
      'guide.end.sleeps',
    ])
    // Word Song's shown flower sleeps: Emma sends her to Number Garden.
    const hubD2 = hub('2026-10-27T09:05:00')
    expect(hubD2.slots).toEqual([G, S, E])
    expect(hubD2.lines.at(-1)).toBe('guide.sleeping.number-garden')

    // Day 3: the 1 plain session; its good day is banked but held.
    const d3 = await play('2026-10-28T09:00:00', allRight)
    expect(d3.hints.isGraduationSession).toBe(false)
    expect(d3.day).toBe('practice')
    expect(d3.before).toEqual([G, G, E])
    expect(d3.after).toEqual([G, G, E])
    expect(d3.lines).toEqual(['guide.end.not-yet.praise'])
    // A held flower is not a sleeping one: Number Garden can still grow.
    const hubD3 = hub('2026-10-28T09:05:00')
    expect(hubD3.slots).toEqual([G, G, E])
    expect(hubD3.suggestion).toBe('number-garden')
    expect(hubD3.lines.at(-1)).toBe('guide.grow.number-garden')
    // Today's good day is banked: a replay is a review, with no probes.
    const review = await play('2026-10-28T09:30:00', allRight)
    expect(review.review).toBe(true)
    expect(review.probes).toEqual([])
    expect(review.after).toEqual([G, G, E])
    expect(review.lines).toEqual(['guide.end.not-yet.praise'])

    const d4 = await play('2026-10-29T09:00:00', allRight)
    expect(d4.probes).toEqual([2, 5, 7])
    expect(d4.day).toBe('practice')
    expect(d4.after).toEqual([G, G, E])
    const d5 = await play('2026-10-30T09:00:00', allRight)
    expect(cat()).toBe('mastered')
    expect(d5.day).toBe('unlock')
    expect(d5.before).toEqual([G, G, E])
    expect(d5.after).toEqual([G, G, G])
    expect(d5.lines).toEqual([
      'guide.end.right.8',
      'guide.end.flower',
      'guide.end.count.3',
      'guide.end.path-opens',
    ])
  })

  it('fast track: every first tap right, probes included, opens the path on day 2', async () => {
    saveProgress(freshLearner(N3, true))
    await play('2026-10-26T09:00:00', allRight)
    const d2 = await play('2026-10-27T09:00:00', allRight)
    expect(cat()).toBe('mastered')
    expect(d2.day).toBe('unlock')
    expect(d2.before).toEqual([G, E, E])
    expect(d2.after).toEqual([G, G, G])
    expect(d2.newSlot).toBe(1)
    expect(d2.bonusSlots).toEqual([2])
    expect(d2.lines).toEqual([
      'guide.end.right.8',
      'guide.end.fast-track',
      'guide.end.count.3',
      'guide.end.path-opens',
    ])
  })

  it('the flower reads the practised words on the 8 scale: 1 practised miss is still a flower at 0.875, probes never count', async () => {
    saveProgress(freshLearner(N3, true))
    const d1 = await play(
      '2026-10-26T09:00:00',
      missing('hat', 'map', 'nap', 'rat'),
    )
    expect(last().successRate).toBe(7 / 8)
    expect(last().novelPoolPart?.correct).toBe(0)
    expect(d1.day).toBe('good-day')
    expect(d1.after).toEqual([S, E, E])
  })

  it('at 0.95 a practised miss on a probe session is no flower; all 5 practised right is', async () => {
    saveProgress(freshLearner({ percent: 0.95, sessions: 3 }, true))
    const d1 = await play('2026-10-26T09:00:00', missing('hat'))
    expect(d1.probes).toEqual([2, 5, 7])
    expect(last().successRate).toBe(7 / 8)
    expect(d1.day).toBe('not-yet')
    const d2 = await play('2026-10-27T09:00:00', missing('ham'))
    expect(last().successRate).toBe(1)
    expect(d2.day).toBe('good-day')
  })
})

describe('N=1 (a non-preset setting): the first good day is held until part 2', () => {
  it('2 sessions: part 1 is practice with "one more", part 2 opens the path', async () => {
    saveProgress(freshLearner({ percent: 0.875, sessions: 1 }, false))
    const s1 = await play('2026-10-26T09:00:00', allRight)
    expect(s1.probes).toEqual([2, 5, 7])
    expect(s1.day).toBe('practice')
    expect(s1.after).toEqual([E])
    expect(s1.lines).toEqual(['guide.end.not-yet.praise'])
    expect(hub('2026-10-26T09:05:00').lines).toEqual(['guide.one-more'])
    const s2 = await play('2026-10-26T09:20:00', allRight)
    expect(cat()).toBe('mastered')
    expect(s2.day).toBe('unlock')
    expect(s2.after).toEqual([G])
  })
})

describe('the migration marker: a row already full when the build lands stays full', () => {
  /** A doc written before this build: no marker field. */
  const withoutMarker = (p: Progress): Progress => {
    const doc = { ...p } as Progress & { keptFullRows?: unknown }
    delete doc.keptFullRows
    return doc
  }

  /**
   * Shaped like Thomas's phone at 17:50 on 2026-10-25 (build 22): Word Song
   * 0.8 / 2, separate days off, three good cat-words sessions, the last one
   * the check's part 1 (map, nap, rat, 3 right). No marker yet.
   */
  function thomasPhone(withPart1 = true): Progress {
    const placed = placeAtStep(defaultProgress(), 'cvc-words')
    const at = (hhmm: string) => `2026-10-25T${hhmm}:00.000Z`
    return withoutMarker({
      ...placed,
      skillLevels: { ...placed.skillLevels, 'cvc-words': 'practicing' },
      parentSettings: {
        ...getSettings(placed),
        crossDayEnforcement: false,
        masteryThreshold: { math: N2, 'word-song': N2 },
      },
      goodDays: { 'cvc-words': ['2026-10-25'] },
      secureDays: { 'cvc-words': ['2026-10-25'] },
      history: [
        { dateISO: at('17:40'), skillFocus: ['blending-cv'], successRate: 1 },
        { dateISO: at('17:41'), skillFocus: ['cvc-words'], successRate: 1 },
        { dateISO: at('17:43'), skillFocus: ['cvc-words'], successRate: 1 },
        ...(withPart1
          ? [
              {
                dateISO: at('17:50'),
                skillFocus: ['cvc-words' as const],
                successRate: 1,
                novelPoolPart: {
                  words: ['map', 'nap', 'rat'],
                  correct: 3,
                  next: ['ham', 'cab', 'rag'],
                },
              },
            ]
          : []),
      ],
    } as Progress)
  }

  it('Thomas’s phone: the row stays 2/2 with no Word Song line; part 2 is next and its pass is the unlock day', async () => {
    saveProgress(thomasPhone())
    expect(loadProgress()!.keptFullRows).toEqual(['cvc-words'])
    const before = hub('2026-10-26T09:00:00')
    expect(before.slots).toEqual([G, G])
    expect(before.lines).toEqual([])
    const s = await play('2026-10-26T09:10:00', allRight)
    expect(s.words.filter((w) => PROBES.has(w))).toEqual(['ham', 'cab', 'rag'])
    expect(cat()).toBe('mastered')
    expect(s.day).toBe('unlock')
    expect(s.before).toEqual([G, G])
    expect(s.after).toEqual([G, G])
    expect(s.newSlot).toBeNull()
    expect(s.lines).toEqual(['guide.end.right.8', 'guide.end.path-opens'])
  })

  it('Thomas’s phone, part 2 failed: the row stays full (the marker, not a derived rule), endings are practice days, retake as anyone', async () => {
    saveProgress(thomasPhone())
    const fail = await play('2026-10-26T09:10:00', missing('ham', 'cab'))
    expect(last().novelPoolSuccessRate).toBeCloseTo(4 / 6)
    expect(fail.day).toBe('practice')
    expect(fail.after).toEqual([G, G])
    expect(fail.lines).toEqual(['guide.end.not-yet.praise'])
    expect(loadProgress()!.keptFullRows).toEqual(['cvc-words'])
    const plain = await play('2026-10-26T09:30:00', allRight)
    expect(plain.words).toEqual(CANON_WORDS)
    expect(plain.after).toEqual([G, G])
    expect(plain.lines).toEqual(['guide.end.not-yet.praise'])
    const part1 = await play('2026-10-26T09:50:00', allRight)
    expect(part1.probes).toEqual([2, 5, 7])
    expect(part1.after).toEqual([G, G])
    expect(part1.lines).toEqual(['guide.end.not-yet.praise'])
    const part2 = await play('2026-10-26T10:10:00', allRight)
    expect(cat()).toBe('mastered')
    expect(part2.day).toBe('unlock')
    expect(part2.lines).toEqual(['guide.end.right.8', 'guide.end.path-opens'])
  })

  it('a full row with no check yet (the phone at 17:43): the check starts with no wait', async () => {
    saveProgress(thomasPhone(false))
    expect(loadProgress()!.keptFullRows).toEqual(['cvc-words'])
    expect(hub('2026-10-26T09:00:00').slots).toEqual([G, G])
    const s = await play('2026-10-26T09:10:00', allRight)
    expect(s.probes).toEqual([2, 5, 7])
    expect(s.day).toBe('practice')
    expect(s.after).toEqual([G, G])
  })

  it('Marian’s iPad (cat words grown, dog words open): no marker, nothing changes', () => {
    const placed = placeAtStep(defaultProgress(), 'cvc-words-short-o')
    saveProgress({
      ...withoutMarker(placed),
      history: [
        {
          dateISO: '2026-10-25T13:12:24.694Z',
          skillFocus: ['cvc-words'],
          successRate: 1,
          novelPoolSuccessRate: 1,
        },
      ],
    })
    const loaded = loadProgress()!
    expect(loaded.keptFullRows).toEqual([])
    expect(loaded.skillLevels['cvc-words']).toBe('mastered')
    expect(nodeProgress(loaded, 'cvc-words').goodDays).toBe(3)
  })
})
