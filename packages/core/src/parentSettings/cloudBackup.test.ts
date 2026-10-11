/**
 * Parent Settings backup JSON, cloud-backup status machines, restore
 * flow and copy. "Web parity" blocks run the web screen's
 * pre-extraction code (verbatim from `src/screens/ParentSettings/
 * ParentSettings.tsx` at origin/main 054928c) as an oracle.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ReconcileOutcome } from '../progress/cloudSync'
import { defaultProgress } from '../progress/defaults'
import { isValidUuid } from '../progress/deviceId'
import type { Progress } from '../progress/types'
import {
  emptySessionHistory,
  type SessionHistoryV2,
} from '../sessionEnd/sessionHistory'
import { backupJson, buildBackupPayload } from './backup'
import {
  adoptDeviceId,
  canSubmitRestore,
  copyStatusResets,
  parseRestoreInput,
  progressAfterRestore,
  pushStatusResets,
  restoreFailureReason,
  restoreOutcomeMessage,
  restoreStatusAfterEdit,
  restoreStatusTag,
  STATUS_RESET_MS,
  type RestoreStatus,
} from './cloudBackup'
import {
  CLOUD_BACKUP_COPY,
  PENDING_PROMOTION_COPY,
  restoreFailedMessage,
} from './copy'

const UUID = '0b8f3f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const AT = new Date('2026-10-11T12:00:00.000Z')

// ── Web reference ───────────────────────────────────────────────────────

function webBackupJson(
  progress: Progress,
  loadSessionHistory: (() => SessionHistoryV2) | undefined,
  now: Date,
): string {
  const safely = (read: () => SessionHistoryV2) => {
    try {
      return read()
    } catch {
      return null
    }
  }
  const sessionHistory = loadSessionHistory ? safely(loadSessionHistory) : null
  return JSON.stringify(
    {
      kind: 'marian-tutor.backup' as const,
      version: 1 as const,
      exportedAtISO: now.toISOString(),
      progress,
      sessionHistory,
    },
    null,
    2,
  )
}

const OUTCOMES: ReconcileOutcome[] = [
  { kind: 'installed-from-cloud', progress: defaultProgress() },
  { kind: 'pushed-to-cloud' },
  { kind: 'noop', reason: 'no-cloud-record' },
  { kind: 'noop', reason: 'no-local-blob' },
  { kind: 'noop', reason: 'equal' },
  { kind: 'cloud-blob-rejected' },
  { kind: 'cloud-error', reason: 'timeout' },
  { kind: 'cloud-error', reason: 'auth-not-configured' },
]

// ── Backup ──────────────────────────────────────────────────────────────

describe('backup JSON', () => {
  const history = { ...emptySessionHistory(), sessionCount: 5 }
  const throwing = () => {
    throw new Error('storage unavailable')
  }

  it('matches the web textarea for a reader, no reader and a throwing reader', () => {
    for (const read of [() => history, undefined, throwing]) {
      expect(backupJson(defaultProgress(), read, AT)).toBe(
        webBackupJson(defaultProgress(), read, AT),
      )
    }
  })

  it('carries the versioned envelope, in key order', () => {
    const payload = buildBackupPayload(defaultProgress(), () => history, AT)
    expect(Object.keys(payload)).toEqual([
      'kind',
      'version',
      'exportedAtISO',
      'progress',
      'sessionHistory',
    ])
    expect(payload.kind).toBe('marian-tutor.backup')
    expect(payload.version).toBe(1)
    expect(payload.exportedAtISO).toBe('2026-10-11T12:00:00.000Z')
    expect(payload.sessionHistory).toEqual(history)
  })

  it('a throwing reader gives sessionHistory null', () => {
    expect(
      buildBackupPayload(defaultProgress(), throwing, AT).sessionHistory,
    ).toBeNull()
  })
})

// ── Status machines ─────────────────────────────────────────────────────

describe('status machines', () => {
  it('push: only the three results reset, after 2.4 s', () => {
    expect(STATUS_RESET_MS).toBe(2400)
    expect(pushStatusResets('sent')).toBe(true)
    expect(pushStatusResets('failed')).toBe(true)
    expect(pushStatusResets('skipped')).toBe(true)
    expect(pushStatusResets('sending')).toBe(false)
    expect(pushStatusResets('idle')).toBe(false)
  })

  it('device-ID copy: copied and error reset', () => {
    expect(copyStatusResets('copied')).toBe(true)
    expect(copyStatusResets('error')).toBe(true)
    expect(copyStatusResets('idle')).toBe(false)
  })
})

// ── Restore ─────────────────────────────────────────────────────────────

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

  it('typing clears only invalid-format', () => {
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

describe('restore outcome', () => {
  it('tags each status like the web data-status', () => {
    expect(restoreStatusTag({ kind: 'idle' })).toBeNull()
    expect(restoreStatusTag({ kind: 'restoring' })).toBeNull()
    expect(restoreStatusTag({ kind: 'invalid-format' })).toBe('invalid-format')
    expect(restoreStatusTag({ kind: 'restore-failed', reason: 'x' })).toBe(
      'restore-failed',
    )
    expect(
      OUTCOMES.map((outcome) =>
        restoreStatusTag({ kind: 'restored', outcome }),
      ),
    ).toEqual([
      'restored-installed-from-cloud',
      'restored-pushed-to-cloud',
      'restored-noop',
      'restored-noop',
      'restored-noop',
      'restored-cloud-blob-rejected',
      'restored-cloud-error',
      'restored-cloud-error',
    ])
  })

  it('words every outcome as the web did', () => {
    expect(OUTCOMES.map(restoreOutcomeMessage)).toEqual([
      "Restored Marian's progress from that device.",
      "That device had older progress; this device's progress was kept.",
      'No progress found for that device ID.',
      "That device hasn't synced anything yet.",
      'Both devices have the same progress.',
      "That device's backup is in an unexpected format.",
      "Couldn't reach the server (timeout).",
      "Couldn't reach the server (auth-not-configured).",
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

describe('adoptDeviceId', () => {
  it('installs the ID first, then reconciles that ID against local', async () => {
    const order: string[] = []
    const local = defaultProgress()
    const outcome = await adoptDeviceId(UUID, {
      writeDeviceId: (id) => order.push(`write:${id}`),
      loadLocal: () => {
        order.push('load')
        return local
      },
      reconcile: async (id, p) => {
        order.push(`reconcile:${id}`)
        expect(p).toBe(local)
        return { kind: 'noop', reason: 'equal' }
      },
    })
    expect(order).toEqual([`write:${UUID}`, 'load', `reconcile:${UUID}`])
    expect(outcome).toEqual({ kind: 'noop', reason: 'equal' })
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
