/**
 * Parent Settings' controls (`design/native/parent-settings-native.md`
 * § 2): buttons, switch rows, drawn segmented controls and status slots.
 */
import type { SegmentedOption } from '@marian/core/parentSettings/parentSettingsModel'
import { useEffect, type ReactNode } from 'react'
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated'
import {
  BODY_FONT_MAX,
  emerald,
  MIN_TARGET,
  RADIUS,
  slate,
  STATUS_COLOR,
  type,
  white,
  type StatusTone,
} from './psTheme'

// ── Buttons ─────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'confirm'

const BUTTON_COLORS: Record<
  ButtonVariant,
  { fill: string; pressed: string; border: string; label: string }
> = {
  primary: {
    fill: slate[700],
    pressed: slate[800],
    border: slate[700],
    label: white,
  },
  secondary: {
    fill: white,
    pressed: slate[100],
    border: slate[300],
    label: slate[700],
  },
  confirm: {
    fill: emerald[700],
    pressed: emerald[800],
    border: emerald[700],
    label: white,
  },
}

export interface PsButtonProps {
  label: string
  onPress: () => void
  variant: ButtonVariant
  /** Wide enough for the longest label, so it never changes width. */
  minWidth: number
  disabled?: boolean
  testID: string
  accessibilityLabel?: string
  maxFontSizeMultiplier?: number
}

export function PsButton({
  label,
  onPress,
  variant,
  minWidth,
  disabled = false,
  testID,
  accessibilityLabel,
  maxFontSizeMultiplier = BODY_FONT_MAX,
}: PsButtonProps) {
  const c = BUTTON_COLORS[variant]
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { minWidth, backgroundColor: c.fill, borderColor: c.border },
        pressed && { backgroundColor: c.pressed },
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        style={[type.button, { color: disabled ? slate[500] : c.label }]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

// ── Rows ────────────────────────────────────────────────────────────────

function RowText({
  label,
  description,
}: {
  label: string
  description: string
}) {
  return (
    <>
      <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={type.rowLabel}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={type.description}>
        {description}
      </Text>
    </>
  )
}

export interface SwitchRowProps {
  id: string
  label: string
  description: string
  value: boolean
  onChange: (next: boolean) => void
  compact: boolean
}

/**
 * A toggle row: the whole row is one Pressable that flips the native
 * `Switch` (which takes no touches itself, so there is one handler and no
 * double toggle). A scroll that starts on the row cancels the press.
 */
export function SwitchRow({
  id,
  label,
  description,
  value,
  onChange,
  compact,
}: SwitchRowProps) {
  return (
    <Pressable
      testID={`parent-settings-toggle-${id}`}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={description}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.row,
        styles.inline,
        { gap: compact ? 16 : 24 },
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowText}>
        <RowText label={label} description={description} />
      </View>
      <View
        style={styles.noTouch}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Switch
          testID={`parent-settings-switch-${id}`}
          value={value}
          trackColor={{ false: slate[300], true: slate[700] }}
          ios_backgroundColor={slate[300]}
          thumbColor={white}
        />
      </View>
    </Pressable>
  )
}

export interface SegmentedRowProps<T extends string> {
  id: string
  label: string
  description: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (next: T) => void
  compact: boolean
  /** Wide form: each segment's minimum width (80 threshold, 72 mode). */
  segmentMinWidth: number
}

/**
 * A row with a drawn segmented control: inline on the right (wide), or
 * under the text at the full card width with equal segments (compact).
 */
export function SegmentedRow<T extends string>({
  id,
  label,
  description,
  value,
  options,
  onChange,
  compact,
  segmentMinWidth,
}: SegmentedRowProps<T>) {
  const control = (
    <View
      testID={`parent-settings-segmented-${id}`}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.segmented, compact && styles.segmentedFull]}
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <Pressable
            key={opt.value}
            testID={`parent-settings-segmented-${id}-${opt.value}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.segment,
              compact ? styles.segmentFlex : { minWidth: segmentMinWidth },
              selected
                ? styles.segmentSelected
                : pressed && styles.segmentPressed,
            ]}
          >
            <Text
              maxFontSizeMultiplier={BODY_FONT_MAX}
              numberOfLines={1}
              style={[type.button, { color: selected ? white : slate[700] }]}
            >
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
  return (
    <View
      testID={`parent-settings-row-${id}`}
      style={[styles.row, !compact && [styles.inline, { gap: 24 }]]}
    >
      <View style={compact ? undefined : styles.rowText}>
        <RowText label={label} description={description} />
      </View>
      {compact ? <View style={styles.stacked}>{control}</View> : control}
    </View>
  )
}

/** The 1 pt slate-200 line between two rows. */
export function RowDivider() {
  return <View style={styles.divider} />
}

// ── Status slot ─────────────────────────────────────────────────────────

export interface StatusLine {
  tone: StatusTone
  text: string
}

export interface StatusSlotProps {
  testID: string
  /** Null: the slot stays empty (its height is kept). */
  status: StatusLine | null
  /** The tap counter: a new value re-mounts (re-fades, re-announces) the line. */
  seq: number
  align?: 'left' | 'right'
}

const STATUS_FADE_MS = 150

/**
 * A status line in its reserved slot (4 + 16 pt from mount), so nothing
 * below it moves when it shows or clears. Fades over 150 ms (none with
 * Reduce Motion). Announced: a polite live region on Android,
 * `announceForAccessibility` on iOS.
 */
export function StatusSlot({
  testID,
  status,
  seq,
  align = 'left',
}: StatusSlotProps) {
  const reducedMotion = useReducedMotion()
  const text = status?.text ?? null
  useEffect(() => {
    if (text !== null && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(text)
    }
  }, [text, seq])
  return (
    <View style={styles.statusSlot}>
      {status && (
        <Animated.Text
          key={seq}
          testID={testID}
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={BODY_FONT_MAX}
          entering={reducedMotion ? undefined : FadeIn.duration(STATUS_FADE_MS)}
          exiting={reducedMotion ? undefined : FadeOut.duration(STATUS_FADE_MS)}
          style={[
            type.status,
            { color: STATUS_COLOR[status.tone], textAlign: align },
          ]}
        >
          {status.text}
        </Animated.Text>
      )}
    </View>
  )
}

/** A white card with the 1 pt slate-200 border. */
export function Card({
  children,
  padded,
  testID,
}: {
  children: ReactNode
  padded: boolean
  testID?: string
}) {
  return (
    <View testID={testID} style={[styles.card, padded && styles.cardPadded]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TARGET,
    paddingHorizontal: 16,
    borderRadius: RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { backgroundColor: slate[300], borderColor: slate[300] },
  row: { paddingVertical: 16, paddingHorizontal: 20 },
  rowPressed: { backgroundColor: slate[50] },
  inline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  rowText: { flex: 1, minWidth: 0 },
  stacked: { marginTop: 12 },
  noTouch: { pointerEvents: 'none' },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: slate[300],
    borderRadius: RADIUS,
    overflow: 'hidden',
    backgroundColor: white,
    alignSelf: 'flex-start',
  },
  segmentedFull: { alignSelf: 'stretch' },
  segment: {
    height: MIN_TARGET,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: white,
  },
  segmentFlex: { flex: 1 },
  segmentSelected: { backgroundColor: slate[700] },
  segmentPressed: { backgroundColor: slate[100] },
  divider: { height: 1, backgroundColor: slate[200] },
  statusSlot: { minHeight: 16, marginTop: 4 },
  card: {
    backgroundColor: white,
    borderWidth: 1,
    borderColor: slate[200],
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  cardPadded: { padding: 20 },
})
