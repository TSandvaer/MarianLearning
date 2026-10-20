/**
 * Cloud backup (`design/native/parent-settings-native.md` § 4): device ID
 * + Copy, Last synced (local time) + Push now, Restore from device ID.
 *
 * Last synced is this device's last successful cloud sync (`readLastSync`),
 * not the web's `profile.lastPlayedISO`. The cloud helpers record it; the
 * row reads it on mount and again when a push or restore settles, so a
 * "Synced." shows the new time at once.
 *
 * A Restore tap, in order: an invalid ID → the web's invalid-format line
 * (amber field); this device's own ID → an inline line; else the keyboard
 * closes and a system alert asks once. Restore then reads the other
 * device's record and adopts its ID (`adoptDeviceIdAfterRead`); the
 * outcome line, the stored device ID and the refreshed progress follow.
 * Requests take the screen's lifetime signal: Done aborts them, and a
 * late result is ignored.
 */
import {
  CLOUD_BACKUP_COPY,
  COPY_STATUS_COPY,
  PUSH_STATUS_COPY,
  restoreFailedMessage,
} from '@marian/core/parentSettings/copy'
import {
  canSubmitRestore,
  copyStatusResets,
  parseRestoreInput,
  progressAfterRestore,
  pushStatusResets,
  restoreFailureReason,
  type CopyStatus,
  type PushStatus,
  type RestoreStatus,
} from '@marian/core/parentSettings/cloudBackup'
import type { Progress } from '@marian/core/progress'
import { useRef, useState } from 'react'
import { Alert, Keyboard, Text, View } from 'react-native'
import { Card, type StatusLine } from './controls'
import { DeviceIdBlock, LastSyncedBlock, RestoreBlock } from './cloudParts'
import type { LearnerSettingsCopy } from './learnerCopy'
import { formatLastSynced, NATIVE_COPY } from './nativeCopy'
import type { ParentSettingsDeps } from './parentSettingsDeps'
import { BODY_FONT_MAX, type } from './psTheme'
import { useTransientStatus } from './useTransientStatus'

/**
 * Core's restore statuses plus native's own-ID catch, and a code another
 * learner on this device holds (learner profiles § 3.4).
 */
export type NativeRestoreStatus =
  | RestoreStatus
  | { kind: 'own-id' }
  | { kind: 'code-held'; name: string }

const PUSH_LINES: Record<'sent' | 'failed' | 'skipped', StatusLine> = {
  sent: { tone: 'ok', text: PUSH_STATUS_COPY.sent },
  failed: { tone: 'error', text: PUSH_STATUS_COPY.failed },
  skipped: { tone: 'neutral', text: PUSH_STATUS_COPY.skipped },
}

function pushLine(s: PushStatus): StatusLine | null {
  return s === 'idle' || s === 'sending' ? null : PUSH_LINES[s]
}

function copyLine(s: CopyStatus): StatusLine | null {
  if (s === 'copied') return { tone: 'ok', text: COPY_STATUS_COPY.copied }
  if (s === 'error') return { tone: 'error', text: COPY_STATUS_COPY.error }
  return null
}

function restoreLine(
  s: NativeRestoreStatus,
  copy: LearnerSettingsCopy,
): StatusLine | null {
  switch (s.kind) {
    case 'invalid-format':
      return { tone: 'error', text: CLOUD_BACKUP_COPY.invalidFormat }
    case 'own-id':
      return { tone: 'error', text: NATIVE_COPY.ownDeviceId }
    case 'code-held':
      return { tone: 'error', text: NATIVE_COPY.codeHeld(s.name) }
    case 'restored':
      return { tone: 'ok', text: copy.restoreOutcome(s.outcome) }
    case 'restore-failed':
      return { tone: 'error', text: restoreFailedMessage(s.reason) }
    default:
      return null
  }
}

export interface CloudBackupSectionProps {
  progress: Progress
  onProgress: (next: Progress) => void
  deps: ParentSettingsDeps
  /** The screen's lifetime signal (aborted on unmount). */
  lifetime: () => AbortSignal
  compact: boolean
  /** The restore block's bottom (status slot included), in this card. */
  onRestoreBottom: (bottomInCard: number) => void
  onRestoreFocusChange: (focused: boolean) => void
  /** The selected learner's strings (learner profiles § 3.6). */
  copy: LearnerSettingsCopy
}

export function CloudBackupSection({
  progress,
  onProgress,
  deps,
  lifetime,
  compact,
  onRestoreBottom,
  onRestoreFocusChange,
  copy,
}: CloudBackupSectionProps) {
  const blocksY = useRef(0)
  const restoreRect = useRef<{ y: number; height: number } | null>(null)
  const reportRestoreBottom = () => {
    const r = restoreRect.current
    if (r) onRestoreBottom(blocksY.current + r.y + r.height)
  }
  // Generated and stored on first read, as on the web: idempotent.
  const [deviceId, setDeviceId] = useState(() => deps.getDeviceId())
  const [lastSyncISO, setLastSyncISO] = useState(() => deps.readLastSync())
  const refreshLastSync = () => setLastSyncISO(deps.readLastSync())
  const idCopy = useTransientStatus<CopyStatus>('idle', copyStatusResets)
  const push = useTransientStatus<PushStatus>('idle', pushStatusResets)
  const [input, setInput] = useState('')
  const [restore, setRestore] = useState<{
    status: NativeRestoreStatus
    seq: number
  }>({ status: { kind: 'idle' }, seq: 0 })
  const [focused, setFocused] = useState(false)

  const showRestore = (status: NativeRestoreStatus) =>
    setRestore((r) => ({ status, seq: r.seq + 1 }))

  const copyDeviceId = () => {
    const signal = lifetime()
    deps.writeClipboard(deviceId).then(
      () => !signal.aborted && idCopy.set('copied'),
      () => !signal.aborted && idCopy.set('error'),
    )
  }

  const pushNow = () => {
    const signal = lifetime()
    push.set('sending')
    deps.pushNow(progress, signal).then(
      (result) => {
        if (signal.aborted) return
        push.set(result)
        refreshLastSync()
      },
      () => {
        if (signal.aborted) return
        push.set('failed')
        refreshLastSync()
      },
    )
  }

  const runRestore = (uuid: string) => {
    const signal = lifetime()
    if (signal.aborted) return
    showRestore({ kind: 'restoring' })
    deps.restoreFromDeviceId(uuid, signal).then(
      (outcome) => {
        if (signal.aborted) return
        if (outcome.kind === 'code-held') {
          return showRestore({ kind: 'code-held', name: outcome.learner.name })
        }
        showRestore({ kind: 'restored', outcome })
        refreshLastSync()
        // What storage now holds: the adopted ID, or this device's own
        // when the read failed.
        setDeviceId(deps.getDeviceId())
        const fresh = progressAfterRestore(outcome, () => deps.load())
        if (fresh !== null) onProgress(fresh)
      },
      (err: unknown) => {
        if (signal.aborted) return
        showRestore({
          kind: 'restore-failed',
          reason: restoreFailureReason(err),
        })
        refreshLastSync()
      },
    )
  }

  const status = restore.status
  const canSubmit = canSubmitRestore(
    input,
    status.kind === 'own-id' || status.kind === 'code-held'
      ? { kind: 'idle' }
      : status,
  )

  const submitRestore = () => {
    if (!canSubmit) return
    const uuid = parseRestoreInput(input)
    if (uuid === null) return showRestore({ kind: 'invalid-format' })
    if (uuid.toLowerCase() === deviceId.toLowerCase()) {
      return showRestore({ kind: 'own-id' })
    }
    Keyboard.dismiss()
    Alert.alert(
      NATIVE_COPY.restoreAlertTitle,
      NATIVE_COPY.restoreAlertMessage,
      [
        { text: NATIVE_COPY.cancel, style: 'cancel' },
        {
          text: CLOUD_BACKUP_COPY.restore,
          style: 'destructive',
          onPress: () => runRestore(uuid),
        },
      ],
    )
  }

  const editInput = (text: string) => {
    setInput(text)
    // An edit ends the restore line (§ 5), except while one runs.
    if (status.kind !== 'idle' && status.kind !== 'restoring') {
      showRestore({ kind: 'idle' })
    }
  }

  const focusChange = (next: boolean) => {
    setFocused(next)
    onRestoreFocusChange(next)
  }

  return (
    <Card padded testID="parent-settings-cloud-backup">
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={BODY_FONT_MAX}
        style={type.heading}
      >
        {CLOUD_BACKUP_COPY.heading}
      </Text>
      <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={type.description}>
        {copy.cloudBody}
      </Text>
      <View
        testID="parent-settings-cloud-blocks"
        style={{ marginTop: 16 }}
        onLayout={(e) => {
          blocksY.current = e.nativeEvent.layout.y
          reportRestoreBottom()
        }}
      >
        <DeviceIdBlock
          deviceId={deviceId}
          compact={compact}
          onCopy={copyDeviceId}
          slot={{ status: copyLine(idCopy.value), seq: idCopy.seq }}
        />
        <LastSyncedBlock
          lastSynced={formatLastSynced(
            lastSyncISO,
            CLOUD_BACKUP_COPY.neverSynced,
          )}
          sending={push.value === 'sending'}
          onPush={pushNow}
          slot={{ status: pushLine(push.value), seq: push.seq }}
        />
        <RestoreBlock
          input={input}
          onChangeInput={editInput}
          onSubmit={submitRestore}
          canSubmit={canSubmit}
          restoring={status.kind === 'restoring'}
          invalid={status.kind === 'invalid-format'}
          focused={focused}
          onFocusChange={focusChange}
          compact={compact}
          slot={{ status: restoreLine(status, copy), seq: restore.seq }}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout
            restoreRect.current = { y, height }
            reportRestoreBottom()
          }}
        />
      </View>
    </Card>
  )
}
