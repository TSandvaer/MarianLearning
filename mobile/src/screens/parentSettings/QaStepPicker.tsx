/**
 * QA: jump to a step. A debug-only tool at the bottom of Parent Settings
 * (Thomas approved it 2026-10-13; a parent/QA tool, so plain system UI and
 * no Kyle spec). Parent Settings renders the row and this picker only when
 * App hands it `onQaJump`, which App does only when the debug launch flag
 * is on, the same gate the debug seeds use.
 *
 * Both worlds are listed in tree order with the steps' spoken names. A tap
 * asks for confirmation (a system alert), then writes
 * `progressAtStep(node)` through core's `jumpToStep` (today's session
 * history cleared, the device ID kept) and calls `onJumped`. App then
 * restarts its screens on the Hub, where that step is current. "Back to
 * <name>'s real start" writes the playing learner's start doc the same
 * way (learner profiles § 4.8; for the migrated learner 1, Marian's
 * defaults as before).
 *
 * With the progress secret set, a jump is pushed and reconciled like any
 * progress; the confirm text says so in one line. There is no new cloud
 * logic here.
 */
import {
  QA_STEPS,
  jumpToRealStart,
  jumpToStep,
  type QaStep,
} from '@marian/core/debug/stepProgress'
import { activeLearner, startProgressForActive } from '@marian/core/learners'
import type { MasteryTrack, SkillNode } from '@marian/core/progress'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { ParentSettingsLayout } from '../../layout/parentSettingsLayout'
import { FILL } from '../../theme'
import { Card, PsButton } from './controls'
import { learnerSettingsCopy, type LearnerSettingsCopy } from './learnerCopy'
import {
  jumpMessage,
  jumpTitle,
  QA_STEP_COPY,
  realStartMessage,
} from './qaStepCopy'
import {
  BODY_FONT_MAX,
  HEADER_FONT_MAX,
  MIN_TARGET,
  slate,
  type,
  white,
} from './psTheme'

/** The row at the bottom of Parent Settings that opens the picker. */
export function QaStepRow({ onPress }: { onPress: () => void }) {
  return (
    <Card padded={false} testID="parent-settings-qa-step">
      <Pressable
        testID="parent-settings-qa-step-row"
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.rowText}>
          <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={type.rowLabel}>
            {QA_STEP_COPY.row}
          </Text>
          <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={type.description}>
            {QA_STEP_COPY.rowDescription}
          </Text>
        </View>
        <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={styles.chevron}>
          ›
        </Text>
      </Pressable>
    </Card>
  )
}

export interface QaStepPickerProps {
  layout: ParentSettingsLayout
  /** Each world's current step, marked in the list. */
  current: Readonly<Record<MasteryTrack, SkillNode>>
  onClose: () => void
  /** After a jump or the reset was written: App restarts on the Hub. */
  onJumped: () => void
  /** Test seams: the two writes (core's by default). */
  jump?: (node: SkillNode) => void
  resetToRealStart?: () => void
  /** The playing learner's strings; Parent Settings passes them. */
  copy?: LearnerSettingsCopy
}

/** The playing learner's strings, or the doc's name with no list installed. */
function playingCopy(): LearnerSettingsCopy {
  return learnerSettingsCopy(
    activeLearner()?.name ?? startProgressForActive().profile.childName,
  )
}

const WORLDS: readonly MasteryTrack[] = ['math', 'word-song']

export function QaStepPicker({
  layout,
  current,
  onClose,
  onJumped,
  jump = jumpToStep,
  resetToRealStart = jumpToRealStart,
  copy = playingCopy(),
}: QaStepPickerProps) {
  const pick = (step: QaStep) =>
    Alert.alert(jumpTitle(step), jumpMessage(step), [
      { text: QA_STEP_COPY.cancel, style: 'cancel' },
      {
        text: QA_STEP_COPY.jump,
        style: 'destructive',
        onPress: () => {
          jump(step.node)
          onJumped()
        },
      },
    ])
  const reset = () =>
    Alert.alert(copy.qaRealStartTitle, realStartMessage(copy.qaRealStartBody), [
      { text: QA_STEP_COPY.cancel, style: 'cancel' },
      {
        text: QA_STEP_COPY.reset,
        style: 'destructive',
        onPress: () => {
          resetToRealStart()
          onJumped()
        },
      },
    ])

  const column = { marginLeft: layout.column.x, width: layout.column.width }
  return (
    <View testID="qa-step-picker" style={styles.root}>
      <View style={[styles.header, { paddingTop: layout.safeTop }]}>
        <View
          style={[styles.headerRow, column, { height: layout.headerHeight }]}
        >
          <View style={styles.headerText}>
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={HEADER_FONT_MAX}
              numberOfLines={1}
              style={[styles.title, { fontSize: layout.titleSize }]}
            >
              {QA_STEP_COPY.title}
            </Text>
            <Text
              maxFontSizeMultiplier={HEADER_FONT_MAX}
              numberOfLines={1}
              style={[styles.subtitle, { fontSize: layout.subtitleSize }]}
            >
              {QA_STEP_COPY.subtitle}
            </Text>
          </View>
          <PsButton
            testID="qa-step-picker-close"
            label={QA_STEP_COPY.close}
            variant="secondary"
            minWidth={72}
            maxFontSizeMultiplier={HEADER_FONT_MAX}
            onPress={onClose}
          />
        </View>
      </View>
      <ScrollView
        testID="qa-step-picker-scroll"
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: layout.contentPadTop,
          paddingBottom: layout.contentPadBottom,
        }}
        contentInsetAdjustmentBehavior="never"
      >
        <View style={column}>
          {WORLDS.map((world) => (
            <View key={world} style={styles.world}>
              <Text
                accessibilityRole="header"
                maxFontSizeMultiplier={BODY_FONT_MAX}
                style={[type.heading, styles.worldHeading]}
              >
                {QA_STEP_COPY.worlds[world]}
              </Text>
              <Card padded={false} testID={`qa-step-world-${world}`}>
                {QA_STEPS.filter((s) => s.world === world).map((step, i) => (
                  <Pressable
                    key={step.node}
                    testID={`qa-step-${step.node}`}
                    accessibilityRole="button"
                    onPress={() => pick(step)}
                    style={({ pressed }) => [
                      styles.step,
                      i > 0 && styles.stepDivider,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <View style={styles.rowText}>
                      <Text
                        maxFontSizeMultiplier={BODY_FONT_MAX}
                        style={type.rowLabel}
                      >
                        {`${step.position}. ${step.name}`}
                      </Text>
                      <Text
                        maxFontSizeMultiplier={BODY_FONT_MAX}
                        style={[type.mono, styles.node]}
                      >
                        {`Land ${step.land} · ${step.node}`}
                      </Text>
                    </View>
                    {current[world] === step.node && (
                      <Text
                        testID={`qa-step-current-${world}`}
                        maxFontSizeMultiplier={BODY_FONT_MAX}
                        style={styles.current}
                      >
                        {QA_STEP_COPY.current}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </Card>
            </View>
          ))}
          <View style={styles.footer}>
            <PsButton
              testID="qa-step-real-start"
              label={copy.qaRealStart}
              variant="secondary"
              minWidth={200}
              onPress={reset}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { ...FILL, backgroundColor: slate[50] },
  header: {
    backgroundColor: slate[50],
    borderBottomWidth: 1,
    borderBottomColor: slate[200],
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontWeight: '600', color: slate[900] },
  subtitle: { fontWeight: '400', color: slate[500] },
  scroll: { flex: 1 },
  world: { marginBottom: 24 },
  worldHeading: { marginBottom: 8 },
  row: {
    minHeight: MIN_TARGET,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowPressed: { backgroundColor: slate[50] },
  rowText: { flex: 1, minWidth: 0 },
  chevron: { fontSize: 22, color: slate[400] },
  step: {
    minHeight: MIN_TARGET,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: white,
  },
  stepDivider: { borderTopWidth: 1, borderTopColor: slate[200] },
  node: { color: slate[500], marginTop: 2 },
  current: { fontSize: 12, fontWeight: '600', color: slate[700] },
  footer: { alignItems: 'flex-start', marginTop: 8 },
})
