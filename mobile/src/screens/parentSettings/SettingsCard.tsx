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
import type { ToggleSettingKey } from '@marian/core/parentSettings/parentSettingsModel'
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
import type { LearnerSettingsCopy } from './learnerCopy'
import { defaultsFootnote } from './nativeCopy'
import { BODY_FONT_MAX, emerald, RADIUS, type } from './psTheme'

/** Generated from core's defaults (§ 7), not the web's stale string. */
const FOOTNOTE = defaultsFootnote(DEFAULT_PARENT_SETTINGS)

export interface SettingsCardProps {
  settings: ParentSettings
  pendingNode: SkillNode | null
  compact: boolean
  onPatch: (patch: ParentSettingsPatch) => void
  onConfirmPromotion: () => void
  /** The selected learner's strings (learner profiles § 3.6). */
  copy: LearnerSettingsCopy
}

/** A toggle row's label and description for the selected learner. */
function toggleCopy(
  id: ToggleSettingKey,
  copy: LearnerSettingsCopy,
): { label: string; description: string } {
  switch (id) {
    case 'autoPromote':
      return {
        label: TOGGLE_ROW_COPY.autoPromote.label,
        description: copy.autoPromoteDescription,
      }
    case 'showLevelToMarian':
      return {
        label: copy.showLevelLabel,
        description: copy.showLevelDescription,
      }
    case 'crossVowelMixingEnabled':
      return {
        label: TOGGLE_ROW_COPY.crossVowelMixingEnabled.label,
        description: copy.crossVowelDescription,
      }
    default:
      return TOGGLE_ROW_COPY[id]
  }
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
  copy,
}: SettingsCardProps) {
  return (
    <>
      {pendingNode !== null && (
        <View testID="parent-settings-pending-promotion" style={styles.banner}>
          <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={styles.bannerHead}>
            {PENDING_PROMOTION_COPY.heading}
          </Text>
          <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={styles.bannerText}>
            {copy.pendingBefore}
            <Text
              testID="parent-settings-pending-promotion-label"
              style={styles.bannerNode}
            >
              {labelForSkillNode(pendingNode)}
            </Text>
            {copy.pendingAfter}
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
                label={toggleCopy(row.id, copy).label}
                description={toggleCopy(row.id, copy).description}
                value={settings[row.id]}
                onChange={(v) => onPatch(togglePatch(row.id, v))}
                compact={compact}
              />
            ) : row.kind === 'session-mode' ? (
              <SegmentedRow
                id={row.id}
                label={SESSION_MODE_ROW_COPY.label}
                description={copy.sessionModeDescription}
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
                description={copy.masteryDescription}
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
