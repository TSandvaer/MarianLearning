/**
 * @vitest-environment node
 *
 * No-Claude plan phase 4 (`design/native/no-claude-sizing.md` § 1 row 3,
 * § 4 row 4): a letter-sounds session with a vowel map is built on the
 * device. The real `/api/claude` handler is the reference for which vowel
 * the session practises and what the response stamps for the session-end
 * write (`currentTargetVowel`).
 *
 * For every one of the 81 vowel-state maps:
 * - the device builds the session (no planner call), and the server, which
 *   runs the planner for a map past greenfield, asks it for the same vowel
 *   the device's session practises;
 * - the device returns the server's `currentTargetVowel` (or none, as the
 *   server does for greenfield and a fully mastered tier).
 *
 * Every composed vowel session passes the bake-time letter-sounds
 * composition lint (`scripts/compositionLint.ts`, called as it is) over
 * many seeds, and reads as 8 letter-sounds problems in core's plan adapter.
 *
 * Nothing here calls Anthropic or a TTS: the planner is a stub that
 * records the prompt, and the renderer is mocked.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/_session.js', () => ({
  renderSessionAudio: vi.fn(
    async (plan: { utterances: { id: string; text: string }[] }) => ({
      ok: true,
      kind: 'session-start',
      plan,
      utterances: plan.utterances.map((u) => ({
        ...u,
        audio: { kind: 'inline', base64: 'TElWRQ==', mime: 'audio/mpeg' },
      })),
    }),
  ),
  EMMA_VOICE_CONFIG: {
    voice: 'en-GB-OliviaNeural',
    rate: '-10%',
    pitch: '+0Hz',
    volume: '+0%',
  },
  extractUtteranceTexts: vi.fn(() => []),
}))

import { handler } from '../../api/claude.js'
import { getCanonEntry } from '../../api/_canon.js'
import type { PlannerAnthropicClient } from '../../api/_planner.js'
import { createRateLimiter } from '../../api/_rateLimit.js'
import { createSessionCache } from '../../api/_sessionCache.js'
import type { SessionStartResponse } from '../../api/_types.js'
import {
  canonTextKey,
  composeSession,
  type CanonLine,
  type CanonText,
  type CanonTextResolver,
} from '../../packages/core/src/session/composeSession.js'
import { LETTER_SOUND_MNEMONIC_TO_LETTER } from '../../packages/core/src/wordSong/letterSoundsPool.js'
import { wordSongSessionPlanFromServer } from '../../packages/core/src/wordSong/planFromServer.js'
import { lintLetterSoundsComposition } from '../../scripts/compositionLint.js'
import bundle from '../../mobile/assets/canon/canon-text.json'

const BUNDLE = bundle as unknown as Readonly<Record<string, CanonText>>
const bundled: CanonTextResolver = (key) =>
  Object.prototype.hasOwnProperty.call(BUNDLE, canonTextKey(key))
    ? BUNDLE[canonTextKey(key)]!
    : null

type State = 'intro' | 'practicing' | 'mastered'
type Map4 = Record<'/o/' | '/u/' | '/i/' | '/e/', State>
const STATES: readonly State[] = ['intro', 'practicing', 'mastered']

/** All 81 maps, named by their states' first letters (/o/ /u/ /i/ /e/). */
const MAPS: { name: string; map: Map4 }[] = []
for (const o of STATES)
  for (const u of STATES)
    for (const i of STATES)
      for (const e of STATES) {
        MAPS.push({
          name: `${o[0]}${u[0]}${i[0]}${e[0]}`,
          map: { '/o/': o, '/u/': u, '/i/': i, '/e/': e },
        })
      }

const prompts: string[] = []
const planner: PlannerAnthropicClient = {
  messages: {
    create: async (args: unknown) => {
      const content = (args as { messages: { content: string }[] }).messages[0]!
        .content
      prompts.push(content)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: 'haiku-letter-sounds',
              label: 'live',
              utterances: [
                { id: 'word.p1.read', text: 'Which letter says mmm?' },
              ],
            }),
          },
        ],
      }
    },
  },
}

async function serve(
  payload: unknown,
): Promise<{ status: number; body: SessionStartResponse }> {
  const response = await handler(
    new Request('https://example.test/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'session-start', payload }),
    }),
    {
      anthropicClient: planner,
      rateLimiter: createRateLimiter({ limit: 1_000_000, windowMs: 60_000 }),
      sessionCache: createSessionCache({ ttlMs: 60_000 }),
      getCanonEntry,
    },
  )
  return {
    status: response.status,
    body: (await response.json()) as SessionStartResponse,
  }
}

const payloadFor = (map: Map4, seed?: number, extra: object = {}) => ({
  track: 'word-song',
  level: 1,
  childName: 'friend',
  progress: {
    focusNode: 'letter-sounds',
    recentSuccessRate: 0.8,
    lifetimeFirstEncounters: ['letter-names', 'letter-sounds'],
    letterSoundsVowelStates: map,
  },
  ...(seed !== undefined ? { seed } : {}),
  ...extra,
})

/** The letter each problem's read line asks for (`word.p<N>.read`). */
function targets(lines: readonly CanonLine[]): string[] {
  return lines
    .filter((u) => /^word\.p\d+\.read$/.test(u.id))
    .map((u) => {
      const m = /says\s+([a-z]+)\s*[.?]/i.exec(u.text)
      return LETTER_SOUND_MNEMONIC_TO_LETTER[m?.[1]?.toLowerCase() ?? ''] ?? '?'
    })
}

/** The vowel letter a session practises: the one at P6 and P8. */
const practised = (lines: readonly CanonLine[]) => {
  const t = targets(lines)
  expect(t[5]).toBe(t[7])
  return t[5]!
}

const LETTER_OF_VOWEL: Record<string, string> = {
  '/o/': 'O',
  '/u/': 'U',
  '/i/': 'I',
  '/e/': 'E',
}

let savedKey: string | undefined
beforeAll(() => {
  savedKey = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
})
afterAll(() => {
  if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = savedKey
})

describe('the vowel the session practises and stamps, against the server', () => {
  it('every one of the 81 vowel-state maps', async () => {
    const shapes = new Set<string>()
    for (const { name, map } of MAPS) {
      const before = prompts.length
      const served = await serve(payloadFor(map))
      expect(served.status, name).toBe(200)
      const composed = composeSession(payloadFor(map, 3), bundled)
      expect(composed.kind, name).toBe('local')
      if (composed.kind !== 'local') throw new Error('unreachable')

      // The session-end write reads this field: same as the server's.
      expect(composed.currentTargetVowel, name).toBe(
        served.body.currentTargetVowel,
      )

      const greenfield = Object.values(map).every((s) => s === 'intro')
      if (greenfield) {
        // Canon on both sides: no planner, the same session.
        expect(prompts.length, name).toBe(before)
        expect(composed.served, name).toBe('canon')
        expect(composed.session.plan).toEqual(served.body.plan)
        shapes.add('greenfield')
        continue
      }
      // Past greenfield the server asks the planner for a vowel; the
      // device's session practises that vowel.
      expect(prompts.length, name).toBe(before + 1)
      const asked = /CURRENT TARGET VOWEL: \/([a-z])\//.exec(prompts.at(-1)!)
      expect(asked, name).not.toBeNull()
      expect(composed.served, name).toBe('vowel')
      expect(practised(composed.session.utterances), name).toBe(
        asked![1]!.toUpperCase(),
      )
      if (served.body.currentTargetVowel !== undefined) {
        expect(asked![1]!.toUpperCase()).toBe(
          LETTER_OF_VOWEL[served.body.currentTargetVowel],
        )
      }
      const states = new Set(Object.values(map))
      shapes.add(
        served.body.currentTargetVowel === undefined
          ? 'no stamp past greenfield'
          : states.size === 1
            ? `all ${[...states][0]}`
            : 'mixed',
      )
    }
    // Greenfield, every vowel practising or mastered, mixed maps, all
    // mastered (no stamp), and the /e/-guard maps that stamp nothing.
    expect([...shapes].sort()).toEqual([
      'all practicing',
      'greenfield',
      'mixed',
      'no stamp past greenfield',
    ])
    // Each vowel is the server's stamp for at least one map.
    const stamped = new Set<string>()
    for (const { map } of MAPS) {
      const c = composeSession(payloadFor(map), bundled)
      if (c.kind === 'local' && c.currentTargetVowel !== undefined) {
        stamped.add(c.currentTargetVowel)
      }
    }
    expect([...stamped].sort()).toEqual(['/e/', '/i/', '/o/', '/u/'])
  }, 60_000)

  it('a warm-up rides on a vowel session, as on the server', async () => {
    const map: Map4 = {
      '/o/': 'mastered',
      '/u/': 'practicing',
      '/i/': 'intro',
      '/e/': 'intro',
    }
    const warmup = { blocks: [{ node: 'letter-names', problem: 2 }] }
    const composed = composeSession(payloadFor(map, 0, { warmup }), bundled)
    const served = await serve(payloadFor(map, undefined, { warmup }))
    expect(composed.kind).toBe('local')
    if (composed.kind !== 'local') throw new Error('unreachable')
    const warm = (lines: readonly { id: string; text: string }[]) =>
      lines
        .filter((u) => u.id.startsWith('word.w'))
        .map((u) => ({ id: u.id, text: u.text }))
    expect(warm(composed.session.utterances)).toEqual(
      warm(served.body.utterances),
    )
    expect(warm(composed.session.utterances).length).toBeGreaterThan(0)
  })
})

describe('every composed vowel session passes the composition lint', () => {
  it('81 maps × 40 seeds: lint-clean, 8 problems, the session-end lines', () => {
    const endIds = BUNDLE['word-song/level-1/letter-sounds']!.utterances.filter(
      (u) => u.id.startsWith('session.end.'),
    ).map((u) => u.id)
    const seen = new Map<string, Set<string>>()
    let sessions = 0
    for (const { name, map } of MAPS) {
      for (let seed = 0; seed < 40; seed++) {
        const composed = composeSession(payloadFor(map, seed), bundled)
        if (composed.kind !== 'local') throw new Error(name)
        const { plan, utterances } = composed.session
        const planLines = (plan as { utterances: CanonLine[] }).utterances
        const where = `${name} seed ${seed}`
        expect(
          lintLetterSoundsComposition({
            utterances: planLines as SessionStartResponse['utterances'],
          }),
          where,
        ).toEqual([])
        expect(
          lintLetterSoundsComposition({
            utterances: utterances as SessionStartResponse['utterances'],
          }),
          where,
        ).toEqual([])
        expect(planLines.map((u) => u.id)).toEqual(utterances.map((u) => u.id))
        expect(
          utterances
            .filter((u) => u.id.startsWith('session.end.'))
            .map((u) => u.id),
        ).toEqual(endIds)
        const parsed = wordSongSessionPlanFromServer(plan, {
          step: 'letter-sounds',
          littleStories: true,
          blendReads: true,
        })
        expect(parsed.problems, where).toHaveLength(8)
        const t = targets(utterances)
        const key = practised(utterances)
        if (!seen.has(key)) seen.set(key, new Set())
        seen.get(key)!.add(t.join(''))
        sessions += 1
      }
    }
    expect(sessions).toBe(81 * 40)
    // Every vowel is built; /o/ is the canon's pinned session, and the
    // other vowels vary with the seed.
    expect([...seen.keys()].sort()).toEqual(['E', 'I', 'O', 'U'])
    expect(seen.get('O')!.size).toBe(1)
    for (const v of ['U', 'I', 'E'])
      expect(seen.get(v)!.size).toBeGreaterThan(5)
  }, 60_000)

  it('the same seed builds the same session (the Hub prefetch and the tap agree)', () => {
    const map: Map4 = {
      '/o/': 'mastered',
      '/u/': 'mastered',
      '/i/': 'practicing',
      '/e/': 'intro',
    }
    const a = composeSession(payloadFor(map, 11), bundled)
    const b = composeSession(payloadFor(map, 11), bundled)
    expect(a).toEqual(b)
  })

  it('every line is a baked canon line: no new audio', () => {
    const baked = new Set(
      Object.values(BUNDLE).flatMap((e) => e.utterances.map((u) => u.text)),
    )
    for (const { map } of MAPS) {
      for (const seed of [0, 1, 2, 5, 9, 17]) {
        const composed = composeSession(payloadFor(map, seed), bundled)
        if (composed.kind !== 'local') throw new Error('not local')
        for (const u of composed.session.utterances) {
          expect(baked.has(u.text), u.text).toBe(true)
        }
      }
    }
  }, 30_000)
})
