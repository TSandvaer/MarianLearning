/**
 * @vitest-environment node
 *
 * Unit tests for the pre-baked session-canon read API
 * (`getCanonEntry`). Covers hit, miss, corrupted file, shape mismatch,
 * and in-memory cache behaviour.
 *
 * The implementation reads JSON from disk, so we use a temp directory
 * via `os.tmpdir()` rather than mocking `fs`. That means these tests
 * exercise the real readFileSync codepath, which is what the function
 * runtime hits — closer to integration than unit, but still hermetic.
 *
 * Ticket 86c9kwhbc (D — pre-baked session canon).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  _resetCanonCacheForTesting,
  canonCacheKey,
  canonFilePath,
  getCanonEntry,
} from './_canon.js'
import type { SessionStartResponse } from './_types.js'

let tempRoot: string

/** A well-formed SessionStartResponse for fixture writing. */
const FIXTURE: SessionStartResponse = {
  ok: true,
  kind: 'session-start',
  plan: {
    id: 'add-to-10-canon',
    label: 'add-to-10',
    utterances: [{ id: 'math.p1.read', text: 'Three plus two. How many?' }],
  },
  utterances: [
    {
      id: 'math.p1.read',
      text: 'Three plus two. How many?',
      audio: { kind: 'inline', base64: 'AAEC', mime: 'audio/mpeg' },
    },
  ],
}

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'canon-test-'))
  _resetCanonCacheForTesting()
})

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true })
  _resetCanonCacheForTesting()
  vi.restoreAllMocks()
})

/** Write a fixture canon file at the canonical on-disk path. */
function writeFixture(
  root: string,
  key: Parameters<typeof canonFilePath>[1],
  body: unknown,
): string {
  const path = canonFilePath(root, key)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(body), 'utf8')
  return path
}

describe('canonCacheKey + canonFilePath — path conventions', () => {
  it('builds a cache key in <track>/level-<n>/<focusNode> shape', () => {
    expect(
      canonCacheKey({ track: 'math', level: 1, focusNode: 'add-to-10' }),
    ).toBe('math/level-1/add-to-10')
    expect(
      canonCacheKey({
        track: 'word-song',
        level: 1,
        focusNode: 'blending-cv',
      }),
    ).toBe('word-song/level-1/blending-cv')
  })

  it('builds a file path with .json extension under the canon root', () => {
    const path = canonFilePath('/tmp/canon', {
      track: 'math',
      level: 1,
      focusNode: 'add-to-10',
    })
    // Allow either separator (Windows ↔ POSIX); we only care the structure
    // is right.
    expect(path).toMatch(/canon[\\/]math[\\/]level-1[\\/]add-to-10\.json$/)
  })
})

describe('getCanonEntry — hit', () => {
  it('returns the parsed SessionStartResponse on a hit', () => {
    writeFixture(
      tempRoot,
      { track: 'math', level: 1, focusNode: 'add-to-10' },
      FIXTURE,
    )

    const result = getCanonEntry(
      { track: 'math', level: 1, focusNode: 'add-to-10' },
      tempRoot,
    )

    expect(result).not.toBeNull()
    expect(result?.kind).toBe('session-start')
    expect(result?.utterances).toHaveLength(1)
    expect(result?.utterances[0]!.id).toBe('math.p1.read')
  })

  it('caches the parsed canon — second call does not re-read the file', () => {
    writeFixture(
      tempRoot,
      { track: 'math', level: 1, focusNode: 'add-to-10' },
      FIXTURE,
    )

    const first = getCanonEntry(
      { track: 'math', level: 1, focusNode: 'add-to-10' },
      tempRoot,
    )
    // Delete the file out from under the reader. If the cache works, the
    // second call still returns the parsed entry; if it doesn't, the
    // second call returns null.
    rmSync(
      canonFilePath(tempRoot, {
        track: 'math',
        level: 1,
        focusNode: 'add-to-10',
      }),
    )
    const second = getCanonEntry(
      { track: 'math', level: 1, focusNode: 'add-to-10' },
      tempRoot,
    )

    expect(first).not.toBeNull()
    expect(second).toBe(first) // identical reference — proves the cache returned the same object
  })
})

describe('getCanonEntry — miss', () => {
  it('returns null when the file does not exist', () => {
    const result = getCanonEntry(
      { track: 'math', level: 1, focusNode: 'mult-6-9' },
      tempRoot,
    )
    expect(result).toBeNull()
  })

  it('negative-caches a miss — second lookup with the same key does not stat the disk again', () => {
    // Drive a miss, then create the file. The cached null should still be
    // returned because the negative cache entry is sticky for the
    // function-instance lifetime.
    const key = { track: 'math', level: 1, focusNode: 'mult-3-4' } as const

    expect(getCanonEntry(key, tempRoot)).toBeNull()

    writeFixture(tempRoot, key, FIXTURE)

    expect(getCanonEntry(key, tempRoot)).toBeNull()
  })
})

describe('getCanonEntry — corrupted blobs', () => {
  it('returns null on malformed JSON', () => {
    const path = canonFilePath(tempRoot, {
      track: 'math',
      level: 1,
      focusNode: 'add-to-10',
    })
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, '{this is not, json}', 'utf8')

    const result = getCanonEntry(
      { track: 'math', level: 1, focusNode: 'add-to-10' },
      tempRoot,
    )
    expect(result).toBeNull()
  })

  it('returns null when JSON parses but does not match SessionStartResponse', () => {
    writeFixture(
      tempRoot,
      { track: 'math', level: 1, focusNode: 'add-to-10' },
      // Wrong shape — `kind` is wrong, no `utterances` array.
      { ok: true, kind: 'something-else', plan: {} },
    )

    const result = getCanonEntry(
      { track: 'math', level: 1, focusNode: 'add-to-10' },
      tempRoot,
    )
    expect(result).toBeNull()
  })

  it('returns null when an utterance is malformed (missing audio.base64)', () => {
    writeFixture(
      tempRoot,
      { track: 'math', level: 1, focusNode: 'add-to-10' },
      {
        ok: true,
        kind: 'session-start',
        plan: {},
        utterances: [
          {
            id: 'math.p1.read',
            text: 'x',
            audio: { kind: 'inline', mime: 'audio/mpeg' /* no base64 */ },
          },
        ],
      },
    )

    const result = getCanonEntry(
      { track: 'math', level: 1, focusNode: 'add-to-10' },
      tempRoot,
    )
    expect(result).toBeNull()
  })
})

describe('getCanonEntry — key isolation', () => {
  it('does not return a math entry for a word-song lookup', () => {
    writeFixture(
      tempRoot,
      { track: 'math', level: 1, focusNode: 'add-to-10' },
      FIXTURE,
    )

    const wordSong = getCanonEntry(
      { track: 'word-song', level: 1, focusNode: 'blending-cv' },
      tempRoot,
    )
    expect(wordSong).toBeNull()
  })

  it('does not return level-1 for a level-2 lookup (forward-compat guard)', () => {
    writeFixture(
      tempRoot,
      { track: 'math', level: 1, focusNode: 'add-to-10' },
      FIXTURE,
    )

    const level2 = getCanonEntry(
      { track: 'math', level: 2, focusNode: 'add-to-10' },
      tempRoot,
    )
    expect(level2).toBeNull()
  })
})
