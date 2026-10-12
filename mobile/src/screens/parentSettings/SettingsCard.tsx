/**
 * Parent Settings' upper half: the pending-promotion banner (when one is
 * queued), the seven setting rows in the web's order, and the defaults
 * footnote. Rows, presets and copy are core's
 * (`@marian/core/parentSettings/*`), shared with the web screen; the
 * threshold description and the footnote are native's § 7 departures.
 */
import { labelForSkillNode } from '@marian/core/hub/progressProjection'
import {
  MASTERY_ROW_LABELS,
  PENDING_PROMOTION_COPY,
  SESSION_MODE_ROW_COPY,
  TOGGLE_ROW_COPY,
} from '@marian/core/parentSettings/copy'
import {
  SESSION_MODE_OPTIONS,
  SETTINGS_ROWS,
  masteryPatch,
  presetId,
  presetIndexFor,
  presetLabel,
  togglePatch,
  type ParentSettingsPatch,
  type SegmentedOption,
} from '@marian/core/parentSettings/parentSettingsModel'
import {
  DEFAULT_PARENT_SETTINGS,
  MASTERY_THRESHOLD_PRESETS,
  type MasteryThreshold,
  type MasteryTrackKey,
  type ParentSettings,
  type SkillNode,
} from '@marian/core/progress'
import { Fragment } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Card, PsButton, RowDivider, SegmentedRow, SwitchRow } from './controls'
import { defaultsFootnote, NATIVE_COPY } from './nativeCopy'
import { BODY_FONT_MAX, emerald, RADIUS, type } from './psTheme'

/** Generated from core's defaults (§ 7), not the web's stale string. */
const FOOTNOTE = defaultsFootnote(DEFAULT_PARENT_SETTINGS)

export interface SettingsCardProps {
  settings: ParentSettings
  pendingNode: SkillNode | null
  compact: boolean
  onPatch: (patch: ParentSettingsPatch) => void
  onConfirmPromotion: () => void
}

/** Segment option values must be strings: a preset is keyed by its id. */
function presetOptions(): readonly SegmentedOption<string>[] {
  return MASTERY_THRESHOLD_PRESETS.map((p) => ({
    value: presetId(p),
    label: presetLabel(p),
  }))
}
const PRESET_OPTIONS = presetOptions()

function presetById(id: string): MasteryThreshold {
  const preset = MASTERY_THRESHOLD_PRESETS.find((p) => presetId(p) === id)!
  return { ...preset }
}

function selectedPresetId(
  value: MasteryThreshold,
  track: MasteryTrackKey,
): string {
  const preset = MASTERY_THRESHOLD_PRESETS[presetIndexFor(value, track)]
  return preset ? presetId(preset) : ''
}

export function SettingsCard({
  settings,
  pendingNode,
  compact,
  onPatch,
  onConfirmPromotion,
}: SettingsCardProps) {
  return (
    <>
      {pendingNode !== null && (
        <View testID="parent-settings-pending-promotion" style={styles.banner}>
          <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={styles.bannerHead}>
            {PENDING_PROMOTION_COPY.heading}
          </Text>
          <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={styles.bannerText}>
            {PENDING_PROMOTION_COPY.before}
            <Text
              testID="parent-settings-pending-promotion-label"
              style={styles.bannerNode}
            >
              {labelForSkillNode(pendingNode)}
            </Text>
            {PENDING_PROMOTION_COPY.after}
          </Text>
          <View style={styles.bannerButton}>
            <PsButton
              testID="parent-settings-confirm-promotion"
              label={PENDING_PROMOTION_COPY.confirm}
              variant="confirm"
              minWidth={0}
              onPress={onConfirmPromotion}
            />
          </View>
        </View>
      )}

      <Card padded={false} testID="parent-settings-rows">
        {SETTINGS_ROWS.map((row, i) => (
          <Fragment key={row.id}>
            {i > 0 && <RowDivider />}
            {row.kind === 'toggle' ? (
              <SwitchRow
                id={row.id}
                label={TOGGLE_ROW_COPY[row.id].label}
                description={TOGGLE_ROW_COPY[row.id].description}
                value={settings[row.id]}
                onChange={(v) => onPatch(togglePatch(row.id, v))}
                compact={compact}
              />
            ) : row.kind === 'session-mode' ? (
              <SegmentedRow
                id={row.id}
                label={SESSION_MODE_ROW_COPY.label}
                description={SESSION_MODE_ROW_COPY.description}
                value={settings.sessionModePicker}
                options={SESSION_MODE_OPTIONS}
                onChange={(v) => onPatch({ sessionModePicker: v })}
                compact={compact}
                segmentMinWidth={72}
              />
            ) : (
              <SegmentedRow
                id={row.id}
                label={MASTERY_ROW_LABELS[row.track]}
                description={NATIVE_COPY.masteryDescription}
                value={selectedPresetId(
                  settings.masteryThreshold[row.track],
                  row.track,
                )}
                options={PRESET_OPTIONS}
                onChange={(id) =>
                  onPatch(masteryPatch(row.track, presetById(id)))
                }
                compact={compact}
                segmentMinWidth={80}
              />
            )}
          </Fragment>
        ))}
      </Card>

      <Text
        testID="parent-settings-footnote"
        maxFontSizeMultiplier={BODY_FONT_MAX}
        style={[type.footnote, styles.footnote]}
      >
        {FOOTNOTE}
      </Text>
    </>
  )
}

const styles = StyleSheet.create({
  banner: {
    marginBottom: 24,
    padding: 16,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: emerald[300],
    backgroundColor: emerald[50],
  },
  bannerHead: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
    color: emerald[900],
  },
  bannerText: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: emerald[900],
    opacity: 0.8,
  },
  bannerNode: { fontWeight: '500' },
  bannerButton: { marginTop: 12, alignSelf: 'flex-start' },
  footnote: { marginTop: 24 },
})
