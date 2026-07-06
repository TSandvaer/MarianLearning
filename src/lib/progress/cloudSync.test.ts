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
 *  - mergeSessionHistories: union-dedupe-sort of two history arrays
 *    (ticket 86c9qa6na — P1 data-loss fix)
 *  - reconcile cloud-newer history merge: local sessions survive a
 *    cloud-wins install instead of being clobbered (the regression)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchProgressFromCloud,
  mergeSessionHistories,
  pushProgressToCloud,
  reconcileWithCloud,
  type FetchResult,
  type ReconcileOutcome,
} from './cloudSync'
import { defaultProgress } from './defaults'
import { isProgressV1 } from './guards'
import { STORAGE_KEY, loadProgress } from './storage'
import type { Progress, SessionHistoryEntry, SkillLevels } from './types'

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

  it('withDefaultedSkillLevels parity — cloud blob with a legacy `digraphs` key installs the level onto `digraphs-sh`, matching local load (P0-6)', async () => {
    // P0-6 (2026-07-06): the cloud install path now shares
    // storage.ts:withDefaultedSkillLevels, which carries the
    // `digraphs → digraphs-sh` dead-letter remap. Pre-fix, the private
    // cloudSync mirror lacked it: the legacy key rode along and
    // `digraphs-sh` floor-filled to 'locked', silently dropping the level
    // — divergent from the local load path.
    const seed = defaultProgress()
    const skillLevels: Record<string, unknown> = { ...seed.skillLevels }
    delete skillLevels['digraphs-sh']
    skillLevels['digraphs'] = 'mastered' // QA hand-edit on a retired literal
    const cloudBlob = {
      ...seed,
      profile: { ...seed.profile, lastPlayedISO: '2026-07-06T11:00:00.000Z' },
      skillLevels,
    }
    const installed: Progress[] = []
    const outcome = await reconcileWithCloud(VALID_UUID, defaultProgress(), {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: '2026-07-06T11:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl: vi.fn(async () => 'sent' as const),
    })
    expect(outcome.kind).toBe('installed-from-cloud')
    // Level preserved on the new sibling key — NOT floor-filled to 'locked'.
    expect(installed[0]!.skillLevels['digraphs-sh']).toBe('mastered')
    // Legacy literal stripped from the installed skillLevels.
    expect(
      (installed[0]!.skillLevels as Record<string, unknown>)['digraphs'],
    ).toBeUndefined()
    // Literal parity: the same blob loaded from localStorage yields the
    // same skillLevels (both paths call the shared storage-side defaulter).
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudBlob))
    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(installed[0]!.skillLevels).toEqual(loaded!.skillLevels)
  })

  it('withDefaultedSkillLevels parity — cloud blob with a legacy `two-digit-addsub` key installs the level onto `two-digit-addsub-no-regroup`, matching local load (P0-6)', async () => {
    const seed = defaultProgress()
    const skillLevels: Record<string, unknown> = { ...seed.skillLevels }
    delete skillLevels['two-digit-addsub-no-regroup']
    skillLevels['two-digit-addsub'] = 'practicing'
    const cloudBlob = {
      ...seed,
      profile: { ...seed.profile, lastPlayedISO: '2026-07-06T11:00:00.000Z' },
      skillLevels,
    }
    const installed: Progress[] = []
    const outcome = await reconcileWithCloud(VALID_UUID, defaultProgress(), {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: '2026-07-06T11:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl: vi.fn(async () => 'sent' as const),
    })
    expect(outcome.kind).toBe('installed-from-cloud')
    expect(installed[0]!.skillLevels['two-digit-addsub-no-regroup']).toBe(
      'practicing',
    )
    expect(
      (installed[0]!.skillLevels as Record<string, unknown>)[
        'two-digit-addsub'
      ],
    ).toBeUndefined()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudBlob))
    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(installed[0]!.skillLevels).toEqual(loaded!.skillLevels)
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

  it('cvcGraduationSessionFired parity — cloud blob without the field (pre-86c9qa6n3 device) → defaulted to false at install time', async () => {
    // T1 parity for the CVC-review-mode latch defaulter (ticket
    // 86c9qa6n3). A cloud blob written by a device predating CVC review
    // mode comes in with `cvcGraduationSessionFired` absent. The
    // cloudSync install path must normalise it to `false`, matching
    // storage.ts:withDefaultedCvcGraduationSessionFired, so a Marian who
    // already mastered all three CVC tiers on the old device still gets
    // her one-shot graduation review on the next eligible session.
    const seed = defaultProgress()
    const cloudBlob: Record<string, unknown> = {
      ...seed,
      profile: { ...seed.profile, lastPlayedISO: '2026-06-15T10:00:00.000Z' },
    }
    delete cloudBlob.cvcGraduationSessionFired
    const local = defaultProgress()
    const installed: Progress[] = []
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: '2026-06-15T10:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl: vi.fn(async () => 'sent' as const),
    })
    expect(outcome.kind).toBe('installed-from-cloud')
    expect(installed).toHaveLength(1)
    expect(installed[0]!.cvcGraduationSessionFired).toBe(false)
    expect(isProgressV1(installed[0]!)).toBe(true)
  })

  it('cvcGraduationSessionFired parity — cloud blob with the latch true preserves it verbatim across install', async () => {
    // Round-trip pin: a cloud blob that already fired the graduation
    // review (latch true) must NOT have it reset to false by the
    // defaulter — that would re-fire the one-shot graduation session.
    const cloudBlob: Progress = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-06-15T10:00:00.000Z',
      },
      cvcGraduationSessionFired: true,
    }
    const local = defaultProgress()
    const installed: Progress[] = []
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: '2026-06-15T10:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl: vi.fn(async () => 'sent' as const),
    })
    expect(outcome.kind).toBe('installed-from-cloud')
    expect(installed).toHaveLength(1)
    expect(installed[0]!.cvcGraduationSessionFired).toBe(true)
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

  // -------------------------------------------------------------------------
  // History merge under cloud-wins (ticket 86c9qa6na — P1 data-loss fix).
  //
  // THE REGRESSION: before this fix, a cloud-newer reconcile clobbered
  // local `history` wholesale. A session Marian played on the slower-clock
  // (losing) device — present in `local.history`, absent from the cloud
  // blob — disappeared on install. These tests pin that the install path
  // now UNION-MERGES the two histories so no local session is lost.
  // -------------------------------------------------------------------------

  it('cloud newer → local-only history entries survive the install (no data loss)', async () => {
    // Local (losing device) carries a session the cloud blob never saw.
    const localOnly: SessionHistoryEntry = {
      dateISO: '2026-05-09T07:30:00.000Z',
      skillFocus: ['cvc-words'],
      successRate: 0.75,
    }
    const shared: SessionHistoryEntry = {
      dateISO: '2026-05-09T09:00:00.000Z',
      skillFocus: ['cvc-words'],
      successRate: 0.875,
    }
    const cloudOnly: SessionHistoryEntry = {
      dateISO: '2026-05-09T10:30:00.000Z',
      skillFocus: ['cvc-words'],
      successRate: 1.0,
    }
    const local: Progress = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-05-09T09:00:00.000Z',
      },
      history: [localOnly, shared],
    }
    const cloudBlob = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-05-09T11:00:00.000Z',
      },
      // Cloud has the shared session + its own later one; it does NOT
      // carry `localOnly`.
      history: [shared, cloudOnly],
    }
    const installed: Progress[] = []
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: '2026-05-09T11:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl: vi.fn(async () => 'sent' as const),
    })

    expect(outcome.kind).toBe('installed-from-cloud')
    expect(installed).toHaveLength(1)
    // Union of {localOnly, shared} ∪ {shared, cloudOnly}, deduped to 3,
    // sorted ascending by dateISO. The load-bearing assertion: the
    // local-only session SURVIVED rather than being clobbered.
    expect(installed[0]!.history).toEqual([localOnly, shared, cloudOnly])
  })

  it('cloud newer → other cloud fields still win last-write-wins; only history merges', async () => {
    const localEntry: SessionHistoryEntry = {
      dateISO: '2026-05-09T07:00:00.000Z',
      skillFocus: ['cvc-words'],
      successRate: 0.5,
    }
    const cloudEntry: SessionHistoryEntry = {
      dateISO: '2026-05-09T10:00:00.000Z',
      skillFocus: ['cvc-words'],
      successRate: 1.0,
    }
    const local: Progress = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-05-09T08:00:00.000Z',
      },
      skillLevels: { ...defaultProgress().skillLevels, 'cvc-words': 'intro' },
      history: [localEntry],
    }
    const cloudBlob = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-05-09T11:00:00.000Z',
      },
      // Cloud advanced cvc-words to 'mastered' — that state must WIN
      // last-write-wins; only `history` is union-merged.
      skillLevels: {
        ...defaultProgress().skillLevels,
        'cvc-words': 'mastered',
      },
      history: [cloudEntry],
    }
    const installed: Progress[] = []
    const outcome = await reconcileWithCloud(VALID_UUID, local, {
      fetchImpl: makeFetchReturning({
        kind: 'found',
        blob: cloudBlob,
        lastModifiedISO: '2026-05-09T11:00:00.000Z',
      }),
      authSecret: SECRET,
      installLocally: (p) => installed.push(p),
      pushImpl: vi.fn(async () => 'sent' as const),
    })

    expect(outcome.kind).toBe('installed-from-cloud')
    expect(installed).toHaveLength(1)
    // AC2: skillLevels stays last-write-wins — cloud's 'mastered' won.
    expect(installed[0]!.skillLevels['cvc-words']).toBe('mastered')
    // History union-merged both sessions.
    expect(installed[0]!.history).toEqual([localEntry, cloudEntry])
  })
})

// ---------------------------------------------------------------------------
// mergeSessionHistories (ticket 86c9qa6na — P1 data-loss fix)
//
// AC3: 5+ tests pinning the merge logic — empty-on-empty,
// empty-on-populated, populated-on-populated-no-overlap,
// populated-on-populated-with-overlap (dedupe fires),
// populated-on-populated-with-stale-stamps (no time travel — output is
// sorted ascending regardless of input order). Count-based assertions
// via `.toEqual` on the merged array; never `.toContain`.
// ---------------------------------------------------------------------------

describe('mergeSessionHistories', () => {
  function entry(
    dateISO: string,
    successRate: number,
    skillFocus: SessionHistoryEntry['skillFocus'] = ['cvc-words'],
  ): SessionHistoryEntry {
    return { dateISO, skillFocus, successRate }
  }

  it('empty ∪ empty → empty', () => {
    expect(mergeSessionHistories([], [])).toEqual([])
  })

  it('empty local ∪ populated cloud → cloud entries, sorted', () => {
    const a = entry('2026-05-09T09:00:00.000Z', 0.875)
    const b = entry('2026-05-09T10:00:00.000Z', 1.0)
    // Cloud given OUT of order to prove the sort runs.
    expect(mergeSessionHistories([], [b, a])).toEqual([a, b])
  })

  it('populated local ∪ empty cloud → local entries, sorted', () => {
    const a = entry('2026-05-09T08:00:00.000Z', 0.5)
    const b = entry('2026-05-09T12:00:00.000Z', 0.75)
    expect(mergeSessionHistories([b, a], [])).toEqual([a, b])
  })

  it('no-overlap → full union of both, deduped count == sum, sorted ascending', () => {
    const l1 = entry('2026-05-09T07:00:00.000Z', 0.5)
    const l2 = entry('2026-05-09T11:00:00.000Z', 0.875)
    const c1 = entry('2026-05-09T08:30:00.000Z', 0.625)
    const c2 = entry('2026-05-09T13:00:00.000Z', 1.0)
    const merged = mergeSessionHistories([l1, l2], [c1, c2])
    // No shared keys → all 4 survive.
    expect(merged).toHaveLength(4)
    expect(merged).toEqual([l1, c1, l2, c2])
  })

  it('with-overlap → the shared session dedupes (local copy kept), distinct ones survive', () => {
    const shared = entry('2026-05-09T09:00:00.000Z', 0.875)
    const localOnly = entry('2026-05-09T07:00:00.000Z', 0.5)
    const cloudOnly = entry('2026-05-09T11:00:00.000Z', 1.0)
    // `shared` present on BOTH sides — must appear exactly ONCE.
    const merged = mergeSessionHistories(
      [localOnly, shared],
      [shared, cloudOnly],
    )
    expect(merged).toHaveLength(3)
    expect(merged).toEqual([localOnly, shared, cloudOnly])
  })

  it('distinct sessions sharing a dateISO but differing on successRate are BOTH kept', () => {
    // Same millisecond start is implausible across real sessions, but the
    // key includes successRate + skillFocus so a genuine collision-free
    // pair is never falsely merged.
    const a = entry('2026-05-09T09:00:00.000Z', 0.5)
    const b = entry('2026-05-09T09:00:00.000Z', 1.0)
    const merged = mergeSessionHistories([a], [b])
    expect(merged).toHaveLength(2)
    // Stable sort preserves insertion order on equal dateISO.
    expect(merged).toEqual([a, b])
  })

  it('distinct sessions sharing dateISO + successRate but differing skillFocus are BOTH kept', () => {
    const a = entry('2026-05-09T09:00:00.000Z', 0.875, ['cvc-words'])
    const b = entry('2026-05-09T09:00:00.000Z', 0.875, ['add-to-10'])
    const merged = mergeSessionHistories([a], [b])
    expect(merged).toHaveLength(2)
    expect(merged).toEqual([a, b])
  })

  it('stale stamps → output is sorted ascending regardless of either side ordering (no time travel)', () => {
    // Cloud carries an OLDER session than local's newest; local carries an
    // OLDER session than cloud's newest. Inputs are deliberately unsorted.
    // Output must be globally ascending by dateISO.
    const oldest = entry('2026-05-08T06:00:00.000Z', 0.375)
    const mid = entry('2026-05-09T09:00:00.000Z', 0.75)
    const newest = entry('2026-05-09T18:00:00.000Z', 1.0)
    const merged = mergeSessionHistories([newest, oldest], [mid])
    expect(merged).toEqual([oldest, mid, newest])
  })

  it('does not mutate either input array', () => {
    const l = [entry('2026-05-09T11:00:00.000Z', 1.0)]
    const c = [entry('2026-05-09T08:00:00.000Z', 0.5)]
    const lSnapshot = [...l]
    const cSnapshot = [...c]
    mergeSessionHistories(l, c)
    expect(l).toEqual(lSnapshot)
    expect(c).toEqual(cSnapshot)
  })

  it('preserves optional fields (latencyMs / novelPoolSuccessRate) on surviving entries', () => {
    const rich: SessionHistoryEntry = {
      dateISO: '2026-05-09T09:00:00.000Z',
      skillFocus: ['cvc-words'],
      successRate: 0.875,
      novelPoolSuccessRate: 0.8,
      latencyMs: [1200, 900, 1500],
    }
    const merged = mergeSessionHistories([rich], [])
    expect(merged).toEqual([rich])
    // Identity of the optional fields preserved verbatim.
    expect(merged[0]!.novelPoolSuccessRate).toBe(0.8)
    expect(merged[0]!.latencyMs).toEqual([1200, 900, 1500])
  })
})
