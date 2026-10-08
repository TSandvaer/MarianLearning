// @vitest-environment node
/**
 * The non-storage host seams, exercised without a browser: the progress
 * clock's day-offset source, and cloud sync's secret source + API base.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  setApiBase,
  setCloudSyncAuthSecretSource,
  setDayOffsetSource,
} from '../index'
import {
  MAX_DAY_OFFSET,
  dayOffset,
  localDateKey,
  now,
  parseDayOffset,
} from '../progress/clock'
import { pushProgressToCloud } from '../progress/cloudSync'
import { defaultProgress } from '../progress/defaults'

const VALID_UUID = '11111111-2222-4333-8444-555555555555'

afterEach(() => {
  setDayOffsetSource(null)
  setCloudSyncAuthSecretSource(null)
  setApiBase('')
  vi.useRealTimers()
})

describe('progress clock day-offset source', () => {
  it('no source installed: plain wall-clock time', () => {
    expect(dayOffset()).toBe(0)
  })

  it('applies a valid offset from the source', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 8, 12))
    setDayOffsetSource(() => '2')
    expect(dayOffset()).toBe(2)
    expect(localDateKey(now())).toBe('2026-10-10')
  })

  it('a throwing source reads as no offset', () => {
    setDayOffsetSource(() => {
      throw new Error('no location')
    })
    expect(dayOffset()).toBe(0)
  })

  it.each([null, '', '-1', '1.5', 'abc', String(MAX_DAY_OFFSET + 1)])(
    'parseDayOffset(%j) is 0',
    (raw) => {
      expect(parseDayOffset(raw)).toBe(0)
    },
  )

  it('parseDayOffset accepts 0..MAX_DAY_OFFSET', () => {
    expect(parseDayOffset('0')).toBe(0)
    expect(parseDayOffset(String(MAX_DAY_OFFSET))).toBe(MAX_DAY_OFFSET)
  })
})

describe('cloud sync host seams', () => {
  it('no secret source installed: push is skipped, no request', async () => {
    const fetchImpl = vi.fn()
    const result = await pushProgressToCloud(VALID_UUID, defaultProgress(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toBe('skipped')
    expect(fetchImpl).toHaveBeenCalledTimes(0)
  })

  it('uses the installed secret and the API base', async () => {
    setCloudSyncAuthSecretSource(() => 'host-secret')
    setApiBase('https://example.test')
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }))
    const result = await pushProgressToCloud(VALID_UUID, defaultProgress(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toBe('sent')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ]
    expect(url).toBe('https://example.test/api/progress')
    expect(init.headers.Authorization).toBe('Bearer host-secret')
  })

  it('a non-string or empty secret counts as not configured', async () => {
    const fetchImpl = vi.fn()
    for (const secret of [undefined, '', 42]) {
      setCloudSyncAuthSecretSource(() => secret)
      const result = await pushProgressToCloud(VALID_UUID, defaultProgress(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
      expect(result).toBe('skipped')
    }
    expect(fetchImpl).toHaveBeenCalledTimes(0)
  })
})
