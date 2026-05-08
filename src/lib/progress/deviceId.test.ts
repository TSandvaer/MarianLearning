/**
 * Tests for `deviceId.ts` (cloud-sync, ticket 86c9pkfyu).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEVICE_ID_STORAGE_KEY,
  getOrCreateDeviceId,
  isValidUuid,
  readStoredDeviceId,
  writeStoredDeviceId,
} from './deviceId'

const VALID = '11111111-2222-4333-8444-555555555555'

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  window.localStorage.clear()
})

describe('isValidUuid', () => {
  it('accepts canonical v4-shaped UUIDs', () => {
    expect(isValidUuid(VALID)).toBe(true)
  })
  it('rejects malformed strings', () => {
    expect(isValidUuid('')).toBe(false)
    expect(isValidUuid('not-a-uuid')).toBe(false)
    expect(isValidUuid(VALID + 'x')).toBe(false)
    expect(isValidUuid(VALID.slice(0, 35))).toBe(false)
  })
  it('rejects non-strings', () => {
    expect(isValidUuid(undefined)).toBe(false)
    expect(isValidUuid(null)).toBe(false)
    expect(isValidUuid(123)).toBe(false)
  })
})

describe('getOrCreateDeviceId', () => {
  it('first launch generates a fresh UUID and persists it', () => {
    expect(window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(null)
    const id = getOrCreateDeviceId()
    expect(isValidUuid(id)).toBe(true)
    expect(window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(id)
  })

  it('second launch reads the existing UUID (idempotent)', () => {
    const first = getOrCreateDeviceId()
    const second = getOrCreateDeviceId()
    expect(second).toEqual(first)
  })

  it('regenerates when the stored value is malformed', () => {
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, 'corrupted-value')
    const id = getOrCreateDeviceId()
    expect(isValidUuid(id)).toBe(true)
    expect(id).not.toEqual('corrupted-value')
    // The new value is now persisted.
    expect(window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(id)
  })
})

describe('readStoredDeviceId', () => {
  it('returns null when nothing is stored', () => {
    expect(readStoredDeviceId()).toBe(null)
  })
  it('returns the stored UUID when present and valid', () => {
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, VALID)
    expect(readStoredDeviceId()).toBe(VALID)
  })
  it('returns null when the stored value is malformed', () => {
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, 'not-uuid')
    expect(readStoredDeviceId()).toBe(null)
  })
})

describe('writeStoredDeviceId', () => {
  it('overwrites the persisted UUID (Restore-from-device-ID flow)', () => {
    getOrCreateDeviceId()
    writeStoredDeviceId(VALID)
    expect(window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(VALID)
    expect(readStoredDeviceId()).toBe(VALID)
  })
})
