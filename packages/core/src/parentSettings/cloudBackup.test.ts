/**
 * Parent Settings cloud-backup status machines, restore input handling
 * and the two restore flows (web: ID first; native: read first), plus the
 * copy JSX used to assemble. "Web parity" checks compare against the web
 * screen's pre-extraction logic (origin/main 054928c).
 */
import { describe, expect, it, vi } from 'vitest'
import type { ReconcileOutcome } from '../progress/cloudSync'
import { defaultProgress } from '../progress/defaults'
import { isValidUuid } from '../progress/deviceId'
import {
  adoptDeviceId,
  adoptDeviceIdAfterRead,
  canSubmitRestore,
  copyStatusResets,
  parseRestoreInput,
  progressAfterRestore,
  pushStatusResets,
  restoreFailureReason,
  restoreStatusAfterEdit,
  restoreStatusTag,
  STATUS_RESET_MS,
  type AdoptDeviceIdDeps,
  type RestoreStatus,
} from './cloudBackup'
import {
  CLOUD_BACKUP_COPY,
  PENDING_PROMOTION_COPY,
  restoreFailedMessage,
} from './copy'

const UUID = '0b8f3f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'

describe('status machines', () => {
  it('push: only the three results reset, after 2.4 s', () => {
    expect(STATUS_RESET_MS).toBe(2400)
    expect(pushStatusResets('sent')).toBe(true)
    expect(pushStatusResets('failed')).toBe(true)
    expect(pushStatusResets('skipped')).toBe(true)
    expect(pushStatusResets('sending')).toBe(false)
    expect(pushStatusResets('idle')).toBe(false)
  })

  it('copy: copied and error reset', () => {
    expect(copyStatusResets('copied')).toBe(true)
    expect(copyStatusResets('error')).toBe(true)
    expect(copyStatusResets('idle')).toBe(false)
  })
})

describe('restore input', () => {
  const INPUTS = [
    '',
    '   ',
    'not-a-uuid',
    UUID,
    `  ${UUID}\n`,
    UUID.toUpperCase(),
    `${UUID}x`,
  ]

  it('matches the web trim + isValidUuid check', () => {
    for (const raw of INPUTS) {
      const trimmed = raw.trim()
      expect(parseRestoreInput(raw)).toBe(isValidUuid(trimmed) ? trimmed : null)
    }
  })

  it('enables Restore with input and no restore running', () => {
    const idle: RestoreStatus = { kind: 'idle' }
    expect(canSubmitRestore('', idle)).toBe(false)
    expect(canSubmitRestore('  ', idle)).toBe(false)
    expect(canSubmitRestore('x', idle)).toBe(true)
    expect(canSubmitRestore(UUID, { kind: 'restoring' })).toBe(false)
    expect(canSubmitRestore('x', { kind: 'invalid-format' })).toBe(true)
  })

  it('typing clears only invalid-format (web)', () => {
    expect(restoreStatusAfterEdit({ kind: 'invalid-format' })).toEqual({
      kind: 'idle',
    })
    const restored: RestoreStatus = {
      kind: 'restored',
      outcome: { kind: 'pushed-to-cloud' },
    }
    expect(restoreStatusAfterEdit(restored)).toBe(restored)
  })

  it('reports an Error message, else "unknown"', () => {
    expect(restoreFailureReason(new Error('boom'))).toBe('boom')
    expect(restoreFailureReason('boom')).toBe('unknown')
    expect(restoreFailedMessage('boom')).toBe('Restore failed (boom).')
  })
})

describe('restore status', () => {
  it('tags each status like the web data-status', () => {
    expect(restoreStatusTag({ kind: 'idle' })).toBeNull()
    expect(restoreStatusTag({ kind: 'restoring' })).toBeNull()
    expect(restoreStatusTag({ kind: 'invalid-format' })).toBe('invalid-format')
    expect(restoreStatusTag({ kind: 'restore-failed', reason: 'x' })).toBe(
      'restore-failed',
    )
    const outcomes: ReconcileOutcome[] = [
      { kind: 'installed-from-cloud', progress: defaultProgress() },
      { kind: 'noop', reason: 'equal' },
      { kind: 'cloud-error', reason: 'timeout' },
    ]
    expect(
      outcomes.map((outcome) =>
        restoreStatusTag({ kind: 'restored', outcome }),
      ),
    ).toEqual([
      'restored-installed-from-cloud',
      'restored-noop',
      'restored-cloud-error',
    ])
  })

  it('shows the installed blob, else re-reads storage', () => {
    const installed = defaultProgress()
    const reload = vi.fn(() => null)
    expect(
      progressAfterRestore(
        { kind: 'installed-from-cloud', progress: installed },
        reload,
      ),
    ).toBe(installed)
    expect(reload).not.toHaveBeenCalled()
    const fresh = defaultProgress()
    expect(progressAfterRestore({ kind: 'pushed-to-cloud' }, () => fresh)).toBe(
      fresh,
    )
    expect(
      progressAfterRestore({ kind: 'cloud-blob-rejected' }, reload),
    ).toBeNull()
  })
})

/** Deps that log the call order and answer the reconcile with `outcome`. */
function recordingDeps(outcome: ReconcileOutcome) {
  const order: string[] = []
  const local = defaultProgress()
  const deps: AdoptDeviceIdDeps = {
    writeDeviceId: (id) => order.push(`write:${id}`),
    loadLocal: () => {
      order.push('load')
      return local
    },
    reconcile: async (id, p) => {
      order.push(`reconcile:${id}`)
      expect(p).toBe(local)
      return outcome
    },
  }
  return { order, deps }
}

describe('adoptDeviceId (web)', () => {
  it('installs the ID first, then reconciles that ID against local', async () => {
    const { order, deps } = recordingDeps({ kind: 'noop', reason: 'equal' })
    await expect(adoptDeviceId(UUID, deps)).resolves.toEqual({
      kind: 'noop',
      reason: 'equal',
    })
    expect(order).toEqual([`write:${UUID}`, 'load', `reconcile:${UUID}`])
  })

  it('a throwing dependency rejects instead of throwing', async () => {
    const p = adoptDeviceId(UUID, {
      writeDeviceId: () => {
        throw new Error('quota')
      },
      loadLocal: () => null,
      reconcile: async () => ({ kind: 'pushed-to-cloud' }),
    })
    await expect(p).rejects.toThrow('quota')
  })
})

describe('adoptDeviceIdAfterRead (native)', () => {
  it('reconciles first, then installs the ID', async () => {
    const outcome: ReconcileOutcome = {
      kind: 'installed-from-cloud',
      progress: defaultProgress(),
    }
    const { order, deps } = recordingDeps(outcome)
    await expect(adoptDeviceIdAfterRead(UUID, deps)).resolves.toBe(outcome)
    expect(order).toEqual(['load', `reconcile:${UUID}`, `write:${UUID}`])
  })

  it.each<ReconcileOutcome>([
    { kind: 'pushed-to-cloud' },
    { kind: 'noop', reason: 'no-cloud-record' },
    { kind: 'noop', reason: 'equal' },
  ])('installs the ID after a read that succeeded ($kind)', async (outcome) => {
    const { order, deps } = recordingDeps(outcome)
    await adoptDeviceIdAfterRead(UUID, deps)
    expect(order).toEqual(['load', `reconcile:${UUID}`, `write:${UUID}`])
  })

  it('a failed or aborted read changes nothing: no ID write', async () => {
    const { order, deps } = recordingDeps({
      kind: 'cloud-error',
      reason: 'timeout',
    })
    await expect(adoptDeviceIdAfterRead(UUID, deps)).resolves.toEqual({
      kind: 'cloud-error',
      reason: 'timeout',
    })
    expect(order).toEqual(['load', `reconcile:${UUID}`])
  })

  // The other device's copy was read but not installed, so this device
  // still holds its own progress. Adopting the ID would point its next
  // session-end push at the other device's record and overwrite it.
  it('a rejected cloud copy keeps this device on its own ID: no ID write', async () => {
    const { order, deps } = recordingDeps({ kind: 'cloud-blob-rejected' })
    await expect(adoptDeviceIdAfterRead(UUID, deps)).resolves.toEqual({
      kind: 'cloud-blob-rejected',
    })
    expect(order).toEqual(['load', `reconcile:${UUID}`])
  })

  it('a reconcile that throws (install failed) rejects with no ID write', async () => {
    const order: string[] = []
    const p = adoptDeviceIdAfterRead(UUID, {
      writeDeviceId: (id) => order.push(`write:${id}`),
      loadLocal: () => defaultProgress(),
      reconcile: async () => {
        throw new Error('quota')
      },
    })
    await expect(p).rejects.toThrow('quota')
    expect(order).toEqual([])
  })
})

describe('copy', () => {
  it('keeps the web strings that JSX assembled', () => {
    expect(CLOUD_BACKUP_COPY.invalidFormat).toBe(
      "That doesn't look like a device ID. Expected: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.",
    )
    expect(
      `${PENDING_PROMOTION_COPY.before}add to 10${PENDING_PROMOTION_COPY.after}`,
    ).toBe(
      'Marian has met the mastery threshold for add to 10. Confirm to advance her to the next skill.',
    )
  })
})
