/**
 * Tests for cloud-sync browser helpers (ticket 86c9pkfyu).
 *
 * Covers:
 *  - pushProgressToCloud: success, server-error, network-throw, no-auth
 *    short-circuit
 *  - fetchProgressFromCloud: 200 found, 404 not-found, 401 / 429 / 5xx /
 *    timeout / network-error / malformed-json
 *  - reconcileWithCloud: cloud-newer (install), local-newer (push),
 *    equal (noop), cloud-not-found (push or noop), cloud-error (noop),
 *    cloud-blob-rejected (validation fail keeps local)
 *  - withDefaultedSkillLevels parity: cloud blob missing a key gets
 *    healed before install (mirrors T1)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchProgressFromCloud,
  pushProgressToCloud,
  reconcileWithCloud,
  type FetchResult,
  type ReconcileOutcome,
} from './cloudSync'
import { defaultProgress } from './defaults'
import { isProgressV1 } from './guards'
import type { Progress, SkillLevels } from './types'

const VALID_UUID = '11111111-2222-4333-8444-555555555555'
const SECRET = 'test-secret'

beforeEach(() => {
  window.localStorage.clear()
  // Silence the warn-spam from the failure paths; some tests assert
  // they were called.
})

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// pushProgressToCloud
// ---------------------------------------------------------------------------

describe('pushProgressToCloud', () => {
  it('returns "skipped" when the auth secret is unset', async () => {
    const fetchImpl = vi.fn()
    const result = await pushProgressToCloud(VALID_UUID, defaultProgress(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      authSecret: null,
    })
    expect(result).toBe('skipped')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('POSTs the body shape on success', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    const progress: Progress = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-05-07T10:00:00.000Z',
      },
    }
    const result = await pushProgressToCloud(VALID_UUID, progress, {
      fetchImpl,
      authSecret: SECRET,
    })
    expect(result).toBe('sent')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const call = fetchImpl.mock.calls[0]
    expect(call).toBeDefined()
    const [url, init] = call as [string, RequestInit]
    expect(url).toBe('/api/progress')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${SECRET}`)
    const body = JSON.parse(init.body as string) as {
      deviceId: string
      blob: Progress
      lastModifiedISO: string
    }
    expect(body.deviceId).toBe(VALID_UUID)
    expect(body.blob).toEqual(progress)
    expect(body.lastModifiedISO).toBe('2026-05-07T10:00:00.000Z')
  })

  it('returns "failed" when the server returns 5xx', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = vi.fn(async () => new Response('', { status: 502 }))
    const result = await pushProgressToCloud(VALID_UUID, defaultProgress(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      authSecret: SECRET,
    })
    expect(result).toBe('failed')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('status=502')
  })

  it('returns "failed" without throwing on network errors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })
    const result = await pushProgressToCloud(VALID_UUID, defaultProgress(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      authSecret: SECRET,
    })
    expect(result).toBe('failed')
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// fetchProgressFromCloud
// ---------------------------------------------------------------------------

describe('fetchProgressFromCloud', () => {
  it('returns "found" with blob + lastModifiedISO on 200', async () => {
    const cloudBlob = { ...defaultProgress() }
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            blob: cloudBlob,
            lastModifiedISO: '2026-05-07T10:00:00.000Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    const result = await fetchProgressFromCloud(VALID_UUID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      authSecret: SECRET,
    })
    expect(result).toEqual({
      kind: 'found',
      blob: cloudBlob,
      lastModifiedISO: '2026-05-07T10:00:00.000Z',
    })
    const call = fetchImpl.mock.calls[0]
    expect(call).toBeDefined()
    const url = (call as unknown as [string])[0]
    expect(url).toContain(`deviceId=${VALID_UUID}`)
  })

  it('returns "not-found" on 404 (first-launch case)', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 }))
    const result = await fetchProgressFromCloud(VALID_UUID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      authSecret: SECRET,
    })
    expect(result).toEqual({ kind: 'not-found' })
  })

  it('returns auth-failed on 401', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 401 }))
    const result = await fetchProgressFromCloud(VALID_UUID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      authSecret: SECRET,
    })
    expect(result).toEqual({ kind: 'error', reason: 'auth-failed' })
  })

  it('returns rate-limited on 429', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 429 }))
    const result = await fetchProgressFromCloud(VALID_UUID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      authSecret: SECRET,
    })
    expect(result).toEqual({ kind: 'error', reason: 'rate-limited' })
  })

  it('returns server-error on 5xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 503 }))
    const result = await fetchProgressFromCloud(VALID_UUID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      authSecret: SECRET,
    })
    expect(result).toEqual({ kind: 'error', reason: 'server-error' })
  })

  it('returns malformed-response when body is not the expected shape', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    const result = await fetchProgressFromCloud(VALID_UUID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      authSecret: SECRET,
    })
    expect(result).toEqual({ kind: 'error', reason: 'malformed-response' })
  })

  it('returns network-error when fetch throws (non-abort)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('connection refused')
    })
    const result = await fetchProgressFromCloud(VALID_UUID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      authSecret: SECRET,
    })
    expect(result).toEqual({ kind: 'error', reason: 'network-error' })
  })

  it('returns timeout when AbortController fires', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn(async (_url, init) => {
      // Simulate a fetch that respects the signal: abort it then throw
      // an AbortError, which is what real fetch does.
      ;(init as RequestInit).signal?.addEventListener('abort', () => {
        // no-op
      })
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    })
    const result = await fetchProgressFromCloud(VALID_UUID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      authSecret: SECRET,
      abortController: controller,
      timeoutMs: 5,
    })
    expect(result).toEqual({ kind: 'error', reason: 'timeout' })
  })

  it('short-circuits to auth-not-configured when no secret', async () => {
    const fetchImpl = vi.fn()
    const result = await fetchProgressFromCloud(VALID_UUID, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      authSecret: null,
    })
    expect(result).toEqual({ kind: 'error', reason: 'auth-not-configured' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// reconcileWithCloud
// ---------------------------------------------------------------------------

describe('reconcileWithCloud', () => {
  function makeFetchReturning(result: FetchResult): typeof fetch {
    return vi.fn(async () => {
      if (result.kind === 'found') {
        return new Response(
          JSON.stringify({
            ok: true,
            blob: result.blob,
            lastModifiedISO: result.lastModifiedISO,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (result.kind === 'not-found') {
        return new Response('', { status: 404 })
      }
      // error — return the closest status
      return new Response('', { status: 503 })
    }) as unknown as typeof fetch
  }

  it('cloud newer → installs cloud blob locally and returns installed-from-cloud', async () => {
    const cloudBlob = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-05-07T11:00:00.000Z',
      },
    }
    const local: Progress = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-05-07T10:00:00.000Z',
      },
    }
    const installed: Progress[] = []
    const pushImpl = vi.fn(async () => 'sent' as const)

    const outcome: ReconcileOutcome = await reconcileWithCloud(
      VALID_UUID,
      local,
      {
        fetchImpl: makeFetchReturning({
          kind: 'found',
          blob: cloudBlob,
          lastModifiedISO: '2026-05-07T11:00:00.000Z',
        }),
        authSecret: SECRET,
        installLocally: (p) => installed.push(p),
        pushImpl,
      },
    )

    expect(outcome.kind).toBe('installed-from-cloud')
    expect(installed).toHaveLength(1)
    expect(installed[0]!.profile.lastPlayedISO).toBe('2026-05-07T11:00:00.000Z')
    expect(pushImpl).not.toHaveBeenCalled()
  })

  it('local newer → pushes local to cloud and returns pushed-to-cloud', async () => {
    const cloudBlob = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-05-07T08:00:00.000Z',
      },
    }
    const local: Progress = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-05-07T10:00:00.000Z',
      },
    }
    const installed: Progress[] = []
    const pushImpl = vi.fn(async () => 'sent' as const)

    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: '2026-05-07T08:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl,
    })

    expect(outcome.kind).toBe('pushed-to-cloud')
    expect(pushImpl).toHaveBeenCalledTimes(1)
    const pushCall = pushImpl.mock.calls[0]
    expect(pushCall).toBeDefined()
    expect((pushCall as unknown as [string, Progress])[0]).toBe(VALID_UUID)
    expect((pushCall as unknown as [string, Progress])[1]).toEqual(local)
    expect(installed).toHaveLength(0)
  })

  it('equal timestamps → noop (next saveProgress will sync)', async () => {
    const ts = '2026-05-07T10:00:00.000Z'
    const cloudBlob = {
      ...defaultProgress(),
      profile: { ...defaultProgress().profile, lastPlayedISO: ts },
    }
    const local: Progress = {
      ...defaultProgress(),
      profile: { ...defaultProgress().profile, lastPlayedISO: ts },
    }
    const installed: Progress[] = []
    const pushImpl = vi.fn(async () => 'sent' as const)

    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: ts,
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl,
    })

    expect(outcome).toEqual({ kind: 'noop', reason: 'equal' })
    expect(installed).toHaveLength(0)
    expect(pushImpl).not.toHaveBeenCalled()
  })

  it('cloud 404 + local present → pushes local to cloud', async () => {
    const local = defaultProgress()
    const pushImpl = vi.fn(async () => 'sent' as const)
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({ kind: 'not-found' }),
      authSecret: SECRET,
      pushImpl,
    })
    expect(outcome.kind).toBe('pushed-to-cloud')
    expect(pushImpl).toHaveBeenCalledTimes(1)
  })

  it('cloud 404 + no local → noop (genuine first-launch)', async () => {
    const pushImpl = vi.fn(async () => 'sent' as const)
    const outcome = await reconcileWithCloud(VALID_UUID, null, {
      fetchImpl: makeFetchReturning({ kind: 'not-found' }),
      authSecret: SECRET,
      pushImpl,
    })
    expect(outcome).toEqual({ kind: 'noop', reason: 'no-local-blob' })
    expect(pushImpl).not.toHaveBeenCalled()
  })

  it('cloud 5xx → cloud-error (proceed with local)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const local = defaultProgress()
    const pushImpl = vi.fn(async () => 'sent' as const)
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'error',
        reason: 'server-error',
      }),
      authSecret: SECRET,
      pushImpl,
    })
    expect(outcome).toEqual({ kind: 'cloud-error', reason: 'server-error' })
    expect(pushImpl).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })

  it('cloud blob with extra/legacy schema heals via withDefaultedSkillLevels (T1 parity)', async () => {
    const seed = defaultProgress()
    const skillLevelsMissing = { ...seed.skillLevels } as Partial<SkillLevels>
    delete (skillLevelsMissing as Record<string, unknown>)['cvc-words-short-o']
    const cloudBlob = {
      ...seed,
      profile: { ...seed.profile, lastPlayedISO: '2026-05-07T11:00:00.000Z' },
      skillLevels: skillLevelsMissing,
    }
    const local = defaultProgress()
    const installed: Progress[] = []
    const pushImpl = vi.fn(async () => 'sent' as const)
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: '2026-05-07T11:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl,
    })
    expect(outcome.kind).toBe('installed-from-cloud')
    expect(installed).toHaveLength(1)
    // The defaulter healed the missing key to 'locked'.
    expect(installed[0]!.skillLevels['cvc-words-short-o']).toBe('locked')
    // The result remains a valid v1 doc.
    expect(isProgressV1(installed[0]!)).toBe(true)
  })

  it('cloud blob without lifetimeFirstEncounters (pre-86c9q9ben device) → field inferred at install time', async () => {
    // T1 parity for the lifetimeFirstEncounters defaulter (ticket
    // 86c9q9ben — AC9e). A cloud blob written by a device on an
    // older bundle that doesn't know about the field comes in with
    // it absent. The cloudSync install path must run the same
    // inference rule the storage adapter does — short-a Marian
    // gets letter-names / letter-sounds / blending-cv / cvc-words /
    // sight-words filled in from her diagnostic skillLevels;
    // short-o + short-u stay greenfield.
    const seed = defaultProgress()
    // Strip the field as if the blob came from an older device.
    const cloudBlob: Record<string, unknown> = {
      ...seed,
      profile: { ...seed.profile, lastPlayedISO: '2026-05-09T10:00:00.000Z' },
    }
    delete cloudBlob.lifetimeFirstEncounters
    const local = defaultProgress()
    const installed: Progress[] = []
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: '2026-05-09T10:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl: vi.fn(async () => 'sent' as const),
    })
    expect(outcome.kind).toBe('installed-from-cloud')
    expect(installed).toHaveLength(1)
    const installedProgress = installed[0]!
    // Defaulter inferred from skillLevels — same rule as
    // storage.ts:withDefaultedLifetimeFirstEncounters.
    expect(installedProgress.lifetimeFirstEncounters).toEqual([
      'letter-names',
      'letter-sounds',
      'blending-cv',
      'cvc-words',
      'sight-words',
    ])
    expect(isProgressV1(installedProgress)).toBe(true)
  })

  it('cloud blob with present lifetimeFirstEncounters preserves it verbatim across install', async () => {
    // Round-trip pin: a cloud blob that already carries the field
    // (from a device on the same bundle) must NOT have it
    // overwritten by the inference rule. The defaulter only fills
    // when the field is missing.
    const cloudBlob: Progress = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-05-09T10:00:00.000Z',
      },
      // Hand-set list — different from what the inference rule
      // would produce — so we can prove the defaulter respects
      // the existing value.
      lifetimeFirstEncounters: ['cvc-words-short-u'],
    }
    const local = defaultProgress()
    const installed: Progress[] = []
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: '2026-05-09T10:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl: vi.fn(async () => 'sent' as const),
    })
    expect(outcome.kind).toBe('installed-from-cloud')
    expect(installed).toHaveLength(1)
    expect(installed[0]!.lifetimeFirstEncounters).toEqual(['cvc-words-short-u'])
  })

  it('letterSoundsVowelStates parity — cloud blob without literacy (pre-W9.2 device) → field defaulted at install time', async () => {
    // T1 parity for the W9.2 letterSoundsVowelStates defaulter (ticket
    // 86c9ya3gd). A cloud blob written by a device on an older bundle
    // that doesn't know about the `literacy` namespace comes in with it
    // absent. The cloudSync install path must run the SAME defaulter the
    // storage adapter does — all four trackable vowels filled to 'intro'.
    // Pins cloudSync.ts:withDefaultedLetterSoundsVowelStates against
    // storage.ts:withDefaultedLetterSoundsVowelStates.
    const seed = defaultProgress()
    const cloudBlob: Record<string, unknown> = {
      ...seed,
      profile: { ...seed.profile, lastPlayedISO: '2026-06-07T10:00:00.000Z' },
    }
    delete cloudBlob.literacy
    const local = defaultProgress()
    const installed: Progress[] = []
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: '2026-06-07T10:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl: vi.fn(async () => 'sent' as const),
    })
    expect(outcome.kind).toBe('installed-from-cloud')
    expect(installed).toHaveLength(1)
    expect(installed[0]!.literacy?.letterSoundsVowelStates).toEqual({
      '/o/': 'intro',
      '/u/': 'intro',
      '/i/': 'intro',
      '/e/': 'intro',
    })
    expect(isProgressV1(installed[0]!)).toBe(true)
  })

  it('letterSoundsVowelStates parity — cloud blob with a partial map fills missing vowels + preserves earned ones', async () => {
    // A cloud blob carrying a PARTIAL letterSoundsVowelStates (only /o/
    // earned) must heal identically to the local read path: missing
    // vowels filled to 'intro', the earned /o/ preserved verbatim.
    const seed = defaultProgress()
    const cloudBlob = {
      ...seed,
      profile: { ...seed.profile, lastPlayedISO: '2026-06-07T10:00:00.000Z' },
      literacy: {
        letterSoundsVowelStates: { '/o/': 'mastered' },
      },
    }
    const local = defaultProgress()
    const installed: Progress[] = []
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: '2026-06-07T10:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl: vi.fn(async () => 'sent' as const),
    })
    expect(outcome.kind).toBe('installed-from-cloud')
    expect(installed).toHaveLength(1)
    expect(installed[0]!.literacy?.letterSoundsVowelStates).toEqual({
      '/o/': 'mastered',
      '/u/': 'intro',
      '/i/': 'intro',
      '/e/': 'intro',
    })
    expect(isProgressV1(installed[0]!)).toBe(true)
  })

  it('cloud blob with completely invalid shape → cloud-blob-rejected (local kept)', async () => {
    const local = defaultProgress()
    const installed: Progress[] = []
    const pushImpl = vi.fn(async () => 'sent' as const)
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: { schemaVersion: 1, garbage: true }, // missing required fields
        lastModifiedISO: '2026-05-07T11:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl,
    })
    expect(outcome).toEqual({ kind: 'cloud-blob-rejected' })
    expect(installed).toHaveLength(0)
    expect(pushImpl).not.toHaveBeenCalled()
  })

  it('local lastPlayedISO null + cloud has blob → cloud wins', async () => {
    const cloudBlob = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-05-07T11:00:00.000Z',
      },
    }
    const local: Progress = {
      ...defaultProgress(),
      profile: { ...defaultProgress().profile, lastPlayedISO: null },
    }
    const installed: Progress[] = []
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: '2026-05-07T11:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl: vi.fn(async () => 'sent' as const),
    })
    expect(outcome.kind).toBe('installed-from-cloud')
    expect(installed).toHaveLength(1)
  })
})
