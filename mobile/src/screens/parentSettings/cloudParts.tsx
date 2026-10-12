/**
 * Cloud backup's three blocks (`design/native/parent-settings-native.md`
 * § 4), presentational: Device ID, Last synced + Push now, Restore from
 * device ID. State and handlers are `CloudBackupSection`'s.
 */
import { CLOUD_BACKUP_COPY } from '@marian/core/parentSettings/copy'
import type { LayoutChangeEvent } from 'react-native'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { PsButton, StatusSlot, type StatusLine } from './controls'
import {
  amber700,
  BODY_FONT_MAX,
  MIN_TARGET,
  RADIUS,
  slate,
  type,
  white,
} from './psTheme'

interface Slot {
  status: StatusLine | null
  seq: number
}

function FieldLabel({ text }: { text: string }) {
  return (
    <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={type.fieldLabel}>
      {text}
    </Text>
  )
}

export interface DeviceIdBlockProps {
  deviceId: string
  compact: boolean
  onCopy: () => void
  slot: Slot
}

export function DeviceIdBlock({
  deviceId,
  compact,
  onCopy,
  slot,
}: DeviceIdBlockProps) {
  const copy = (
    <PsButton
      testID="parent-settings-cloud-copy-device-id"
      label={CLOUD_BACKUP_COPY.copy}
      variant="primary"
      minWidth={64}
      disabled={!deviceId}
      onPress={onCopy}
    />
  )
  const box = (
    <View style={[styles.idBox, !compact && styles.flex]}>
      <Text
        testID="parent-settings-cloud-device-id"
        selectable
        allowFontScaling={false}
        numberOfLines={1}
        style={[type.mono, { color: slate[700] }]}
      >
        {deviceId || CLOUD_BACKUP_COPY.deviceIdUnavailable}
      </Text>
    </View>
  )
  return (
    <View style={styles.block}>
      {compact ? (
        <>
          <View style={styles.labelRow}>
            <FieldLabel text={CLOUD_BACKUP_COPY.deviceIdLabel} />
            {copy}
          </View>
          <View style={styles.below}>{box}</View>
        </>
      ) : (
        <>
          <FieldLabel text={CLOUD_BACKUP_COPY.deviceIdLabel} />
          <View style={[styles.inlineRow, styles.below]}>
            {box}
            {copy}
          </View>
        </>
      )}
      <StatusSlot testID="parent-settings-cloud-device-id-status" {...slot} />
    </View>
  )
}

export interface LastSyncedBlockProps {
  lastSynced: string
  sending: boolean
  onPush: () => void
  slot: Slot
}

export function LastSyncedBlock({
  lastSynced,
  sending,
  onPush,
  slot,
}: LastSyncedBlockProps) {
  return (
    <View style={styles.block}>
      <View style={styles.syncRow}>
        <View style={styles.flex}>
          <FieldLabel text={CLOUD_BACKUP_COPY.lastSyncedLabel} />
          <Text
            testID="parent-settings-cloud-last-synced"
            maxFontSizeMultiplier={BODY_FONT_MAX}
            style={[type.value, styles.below]}
          >
            {lastSynced}
          </Text>
        </View>
        <PsButton
          testID="parent-settings-cloud-push-now"
          label={
            sending ? CLOUD_BACKUP_COPY.pushSending : CLOUD_BACKUP_COPY.pushNow
          }
          variant="primary"
          minWidth={112}
          disabled={sending}
          onPress={onPush}
        />
      </View>
      <StatusSlot
        testID="parent-settings-cloud-push-status"
        align="right"
        {...slot}
      />
    </View>
  )
}

export interface RestoreBlockProps {
  input: string
  onChangeInput: (text: string) => void
  onSubmit: () => void
  canSubmit: boolean
  restoring: boolean
  invalid: boolean
  focused: boolean
  onFocusChange: (focused: boolean) => void
  compact: boolean
  slot: Slot
  onLayout: (e: LayoutChangeEvent) => void
}

export function RestoreBlock({
  input,
  onChangeInput,
  onSubmit,
  canSubmit,
  restoring,
  invalid,
  focused,
  onFocusChange,
  compact,
  slot,
  onLayout,
}: RestoreBlockProps) {
  const field = (
    <TextInput
      testID="parent-settings-cloud-restore-input"
      accessibilityLabel={CLOUD_BACKUP_COPY.restoreLabel}
      value={input}
      onChangeText={onChangeInput}
      onSubmitEditing={onSubmit}
      onFocus={() => onFocusChange(true)}
      onBlur={() => onFocusChange(false)}
      placeholder={CLOUD_BACKUP_COPY.restorePlaceholder}
      placeholderTextColor={slate[400]}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      autoComplete="off"
      textContentType="none"
      importantForAutofill="no"
      keyboardType={
        Platform.OS === 'ios' ? 'ascii-capable' : 'visible-password'
      }
      returnKeyType="go"
      allowFontScaling={false}
      style={[
        styles.field,
        type.mono,
        !compact && styles.flex,
        {
          color: slate[800],
          borderColor: invalid ? amber700 : focused ? slate[500] : slate[300],
        },
      ]}
    />
  )
  const restore = (
    <PsButton
      testID="parent-settings-cloud-restore-submit"
      label={
        restoring ? CLOUD_BACKUP_COPY.restoring : CLOUD_BACKUP_COPY.restore
      }
      variant="primary"
      minWidth={112}
      disabled={!canSubmit}
      onPress={onSubmit}
    />
  )
  return (
    <View testID="parent-settings-cloud-restore" onLayout={onLayout}>
      <FieldLabel text={CLOUD_BACKUP_COPY.restoreLabel} />
      {compact ? (
        <>
          <View style={styles.below}>{field}</View>
          <View style={styles.restoreUnder}>{restore}</View>
        </>
      ) : (
        <View style={[styles.inlineRow, styles.below]}>
          {field}
          {restore}
        </View>
      )}
      <StatusSlot testID="parent-settings-cloud-restore-status" {...slot} />
    </View>
  )
}

const styles = StyleSheet.create({
  block: { marginBottom: 16 },
  flex: { flex: 1, minWidth: 0 },
  below: { marginTop: 4 },
  labelRow: {
    height: MIN_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  idBox: {
    height: MIN_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: slate[300],
    borderRadius: RADIUS,
    backgroundColor: slate[50],
  },
  field: {
    height: MIN_TARGET,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderWidth: 1,
    borderRadius: RADIUS,
    backgroundColor: white,
  },
  restoreUnder: { marginTop: 8, alignSelf: 'flex-end' },
})
