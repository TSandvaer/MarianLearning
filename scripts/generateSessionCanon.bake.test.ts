/**
 * @vitest-environment node
 *
 * The canon bake writes Haiku TEXT only. Every utterance gets an empty
 * audio slot (`{ kind: 'inline', base64: '', mime: 'audio/mpeg' }`), the
 * shape `scripts/revoiceCanonLily.ts --unrendered` fills with Lily. The
 * bake must never reach a TTS provider: not Azure, not ElevenLabs, not any
 * network call at all. Anthropic is a stub client here; nothing is billed.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const spies = vi.hoisted(() => ({
  synthesizeUtterance: vi.fn(async () => ({ audio: new Uint8Array([0xff]) })),
  synthesizeElevenLabs: vi.fn(async () => ({ audio: new Uint8Array([0xff]) })),
  getCanonAudioIndex: vi.fn(() => new Map<string, string>()),
}))
vi.mock('../api/_tts.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/_tts.js')>()),
  synthesizeUtterance: spies.synthesizeUtterance,
}))
vi.mock('../api/_tts_elevenlabs.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/_tts_elevenlabs.js')>()),
  synthesizeElevenLabs: spies.synthesizeElevenLabs,
}))
vi.mock('../api/_canon.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/_canon.js')>()),
  getCanonAudioIndex: spies.getCanonAudioIndex,
}))

import { canonFilePath } from '../api/_canon.js'
import type { PlannerAnthropicClient } from '../api/_planner.js'
import { bakeOne, missingBakeKeys } from './generateSessionCanon.ts'

const PLAN = {
  id: 'bake-test',
  label: 'bake test',
  utterances: [
    { id: 'math.p1.read', text: 'Two, four, six. What comes next?' },
    { id: 'math.p1.correct', text: 'Yes! Eight!' },
    { id: 'math.p2.read', text: 'Five, ten, fifteen. What comes next?' },
    { id: 'math.p2.correct', text: 'Yes! Eight!' },
  ],
}

function stubClient(): PlannerAnthropicClient {
  return {
    messages: {
      create: vi.fn(async () => ({
        content: [{ type: 'text', text: JSON.stringify(PLAN) }],
      })),
    },
  }
}

describe('bakeOne writes text-only canon (no TTS)', () => {
  let outRoot: string
  const fetchSpy = vi.fn(async () => {
    throw new Error('the bake must not make a network call')
  })
  const savedProvider = process.env.TTS_PROVIDER

  beforeEach(() => {
    outRoot = mkdtempSync(join(tmpdir(), 'canon-bake-test-'))
    vi.stubGlobal('fetch', fetchSpy)
    // The planner checks the key is present; the stub client never sends it.
    vi.stubEnv('ANTHROPIC_API_KEY', 'bake-test-placeholder-not-a-key')
  })

  afterEach(() => {
    rmSync(outRoot, { recursive: true, force: true })
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    if (savedProvider === undefined) delete process.env.TTS_PROVIDER
    else process.env.TTS_PROVIDER = savedProvider
  })

  it.each([undefined, 'elevenlabs', 'azure'])(
    'calls Haiku once and no synth, with TTS_PROVIDER=%s',
    async (provider) => {
      if (provider === undefined) delete process.env.TTS_PROVIDER
      else process.env.TTS_PROVIDER = provider
      const client = stubClient()
      const combo = {
        track: 'math' as const,
        level: 1,
        focusNode: 'skip-counting',
      }

      await bakeOne(combo, client, 'Marian', outRoot, false)

      expect(client.messages.create).toHaveBeenCalledTimes(1)
      expect(spies.synthesizeUtterance).not.toHaveBeenCalled()
      expect(spies.synthesizeElevenLabs).not.toHaveBeenCalled()
      expect(spies.getCanonAudioIndex).not.toHaveBeenCalled()
      expect(fetchSpy).not.toHaveBeenCalled()

      const written = JSON.parse(
        readFileSync(canonFilePath(outRoot, combo), 'utf8'),
      ) as {
        plan: { utterances: Array<{ id: string; text: string }> }
        utterances: Array<{ id: string; text: string; audio: unknown }>
      }
      expect(written.plan.utterances).toEqual(PLAN.utterances)
      expect(written.utterances).toEqual(
        PLAN.utterances.map((u) => ({
          id: u.id,
          text: u.text,
          audio: { kind: 'inline', base64: '', mime: 'audio/mpeg' },
        })),
      )
    },
  )
})

describe('missingBakeKeys', () => {
  it('needs only ANTHROPIC_API_KEY: no Azure or ElevenLabs key', () => {
    expect(missingBakeKeys({})).toEqual(['ANTHROPIC_API_KEY'])
    expect(missingBakeKeys({ ANTHROPIC_API_KEY: 'k' })).toEqual([])
  })
})
