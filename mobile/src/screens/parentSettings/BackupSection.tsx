/**
 * Backup (`design/native/parent-settings-native.md` § 3): the web's
 * heading and description, then [Copy] [Share…] and a status slot. The
 * JSON is built at tap time (the web's versioned envelope), so
 * `exportedAtISO` is the moment of the copy or share. Share… replaces the
 * web's `<textarea>` fallback.
 */
import { BACKUP_COPY, COPY_STATUS_COPY } from '@marian/core/parentSettings/copy'
import {
  buildBackupJson,
  safelyReadSessionHistory,
} from '@marian/core/parentSettings/parentSettingsModel'
import type { Progress } from '@marian/core/progress'
import { useRef } from 'react'
import { findNodeHandle, StyleSheet, Text, View } from 'react-native'
import { Card, PsButton, StatusSlot, type StatusLine } from './controls'
import type { LearnerSettingsCopy } from './learnerCopy'
import { NATIVE_COPY } from './nativeCopy'
import type { ParentSettingsDeps } from './parentSettingsDeps'
import { BODY_FONT_MAX, type } from './psTheme'
import { useTransientStatus } from './useTransientStatus'

type BackupStatus = 'idle' | 'copied' | 'copy-error' | 'share-error'

const resets = (s: BackupStatus) => s !== 'idle'

const LINES: Record<Exclude<BackupStatus, 'idle'>, StatusLine> = {
  copied: { tone: 'ok', text: COPY_STATUS_COPY.copied },
  'copy-error': { tone: 'error', text: NATIVE_COPY.copyFailedUseShare },
  'share-error': { tone: 'error', text: NATIVE_COPY.shareFailed },
}

export interface BackupSectionProps {
  progress: Progress
  deps: ParentSettingsDeps
  /** False once the screen is gone: a late result is ignored. */
  alive: () => boolean
  /** The selected learner's strings (learner profiles § 3.6). */
  copy: LearnerSettingsCopy
}

export function BackupSection({
  progress,
  deps,
  alive,
  copy: learnerCopy,
}: BackupSectionProps) {
  const status = useTransientStatus<BackupStatus>('idle', resets)
  const shareAnchor = useRef<View>(null)

  const json = () =>
    buildBackupJson(
      progress,
      safelyReadSessionHistory(deps.loadSessionHistory),
      new Date().toISOString(),
    )

  const copy = () => {
    deps.writeClipboard(json()).then(
      () => alive() && status.set('copied'),
      () => alive() && status.set('copy-error'),
    )
  }

  const share = () => {
    const anchor = shareAnchor.current
      ? findNodeHandle(shareAnchor.current)
      : null
    // A dismissed sheet shows nothing; only a failure to open says so.
    deps.share(json(), anchor).catch(() => {
      if (alive()) status.set('share-error')
    })
  }

  return (
    <Card padded testID="parent-settings-backup">
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={BODY_FONT_MAX}
        style={type.heading}
      >
        {BACKUP_COPY.heading}
      </Text>
      <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={type.description}>
        {learnerCopy.backupBody}
      </Text>
      <View style={styles.buttons}>
        <PsButton
          testID="parent-settings-backup-copy"
          label={BACKUP_COPY.copy}
          variant="primary"
          minWidth={64}
          onPress={copy}
        />
        <View ref={shareAnchor} collapsable={false}>
          <PsButton
            testID="parent-settings-backup-share"
            label={NATIVE_COPY.share}
            variant="secondary"
            minWidth={64}
            onPress={share}
          />
        </View>
      </View>
      <StatusSlot
        testID="parent-settings-backup-status"
        status={status.value === 'idle' ? null : LINES[status.value]}
        seq={status.seq}
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 12, marginTop: 12 },
})
