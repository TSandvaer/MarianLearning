/**
 * Parent Settings, native (`design/native/parent-settings-native.md`;
 * web reference `src/screens/ParentSettings/ParentSettings.tsx`, frozen).
 *
 * The parent's screen behind Emma's 3 s press on the Hub: slate on white
 * in the system font, no Emma, no sound. A fixed header keeps Done on
 * screen over one scrolling column: the pending-promotion banner, seven
 * setting rows, the defaults footnote, Backup and Cloud backup.
 *
 * Save-on-change, as on the web: every control writes the next Progress
 * through `deps.save` at once. Nothing is written on mount (the device ID
 * read creates one only if none is stored, idempotently), so re-entry and
 * the QA route are safe. On mount the held iOS audio session is released
 * (§ 6). Done and Android back → Hub. The screen handles the keyboard
 * itself (§ 4): bottom padding plus scroll-into-view for the restore field.
 */
import { HEADER_COPY } from '@marian/core/parentSettings/copy'
import {
  applySettingsPatch,
  confirmPendingPromotion,
  pendingPromotionToConfirm,
  type ParentSettingsPatch,
} from '@marian/core/parentSettings/parentSettingsModel'
import {
  defaultProgress,
  getSettings,
  type Progress,
} from '@marian/core/progress'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BackHandler,
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type KeyboardEvent,
} from 'react-native'
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated'
import { releaseAudioSession } from '../../audio/lifecycle'
import type { ParentSettingsLayout } from '../../layout/parentSettingsLayout'
import { FILL } from '../../theme'
import { BackupSection } from './BackupSection'
import { CloudBackupSection } from './CloudBackupSection'
import { PsButton } from './controls'
import {
  DEFAULT_PARENT_SETTINGS_DEPS,
  type ParentSettingsDeps,
} from './parentSettingsDeps'
import { HEADER_FONT_MAX, slate } from './psTheme'
import { SettingsCard } from './SettingsCard'
import { useLifetime } from './useTransientStatus'

export const PARENT_SETTINGS_ENTER_MS = 200
/** Restore block bottom → keyboard top, at least. */
const KEYBOARD_GAP = 16

export interface ParentSettingsProps {
  layout: ParentSettingsLayout
  /** Done / Android back: App routes to the Hub. */
  onExit: () => void
  deps?: ParentSettingsDeps
  /** Test seam: releases the held iOS audio session on mount. */
  releaseAudio?: () => void
}

export function ParentSettings({
  layout,
  onExit,
  deps = DEFAULT_PARENT_SETTINGS_DEPS,
  releaseAudio = releaseAudioSession,
}: ParentSettingsProps) {
  const reducedMotion = useReducedMotion()
  // Read once; every control writes through and updates this copy.
  const [progress, setProgress] = useState<Progress>(
    () => deps.load() ?? defaultProgress(),
  )
  const settings = useMemo(() => getSettings(progress), [progress])
  const lifetime = useLifetime()
  const alive = useCallback(() => !lifetime().aborted, [lifetime])

  const patch = useCallback(
    (p: ParentSettingsPatch) =>
      setProgress((prev) => {
        const next = applySettingsPatch(prev, p)
        deps.save(next)
        return next
      }),
    [deps],
  )
  const confirmPromotion = useCallback(
    () =>
      setProgress((prev) => {
        const next = confirmPendingPromotion(prev)
        if (next === prev) return prev
        deps.save(next)
        return next
      }),
    [deps],
  )

  // § 6: this screen plays nothing; let music Emma paused resume.
  useEffect(() => {
    releaseAudio()
  }, [releaseAudio])

  const leaving = useRef(false)
  const done = useCallback(() => {
    if (leaving.current) return
    leaving.current = true
    Keyboard.dismiss()
    onExit()
  }, [onExit])
  const doneRef = useRef(done)
  useEffect(() => {
    doneRef.current = done
  })
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      doneRef.current()
      return true
    })
    return () => sub.remove()
  }, [])

  // ── Keyboard (§ 4) ──────────────────────────────────────────────────
  const scrollRef = useRef<ScrollView>(null)
  const [keyboardPad, setKeyboardPad] = useState(0)
  const columnY = useRef(0)
  const cloudY = useRef(0)
  const restoreBottomInCard = useRef(0)
  const restoreFocused = useRef(false)
  const live = useRef({ layout, reducedMotion })
  useEffect(() => {
    live.current = { layout, reducedMotion }
  })
  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      const { layout: l, reducedMotion: still } = live.current
      const { height, screenY } = e.endCoordinates
      // iOS also reports the hide as a frame change, to off-screen.
      if (height <= 0 || screenY >= Dimensions.get('window').height) {
        setKeyboardPad(0)
        return
      }
      setKeyboardPad(Math.max(0, height - l.safeBottom))
      if (!restoreFocused.current) return
      const blockBottom =
        columnY.current + cloudY.current + restoreBottomInCard.current
      const headerBottom = l.safeTop + l.headerHeight
      const y = Math.max(
        0,
        blockBottom - (screenY - headerBottom - KEYBOARD_GAP),
      )
      // After the padding lands, so the content is tall enough.
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ y, animated: !still }),
      )
    }
    const hide = () => setKeyboardPad(0)
    const subs =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', onShow),
            Keyboard.addListener('keyboardWillChangeFrame', onShow),
            Keyboard.addListener('keyboardWillHide', hide),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', onShow),
            Keyboard.addListener('keyboardDidHide', hide),
          ]
    return () => subs.forEach((s) => s.remove())
  }, [])

  const column = { marginLeft: layout.column.x, width: layout.column.width }
  return (
    <Animated.View
      testID="parent-settings"
      entering={
        reducedMotion ? undefined : FadeIn.duration(PARENT_SETTINGS_ENTER_MS)
      }
      style={styles.root}
    >
      <View
        // The bar is `headerHeight` tall under the safe top; the 1 pt
        // border sits below it.
        style={[styles.header, { paddingTop: layout.safeTop }]}
      >
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
              {HEADER_COPY.title}
            </Text>
            <Text
              maxFontSizeMultiplier={HEADER_FONT_MAX}
              numberOfLines={1}
              style={[styles.subtitle, { fontSize: layout.subtitleSize }]}
            >
              {HEADER_COPY.subtitle}
            </Text>
          </View>
          <PsButton
            testID="parent-settings-done"
            label={HEADER_COPY.done}
            variant="secondary"
            minWidth={72}
            maxFontSizeMultiplier={HEADER_FONT_MAX}
            onPress={done}
          />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        testID="parent-settings-scroll"
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: layout.contentPadTop,
          paddingBottom: layout.contentPadBottom + keyboardPad,
        }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View
          testID="parent-settings-column"
          style={column}
          onLayout={(e) => {
            columnY.current = e.nativeEvent.layout.y
          }}
        >
          <SettingsCard
            settings={settings}
            pendingNode={pendingPromotionToConfirm(progress)}
            compact={layout.compact}
            onPatch={patch}
            onConfirmPromotion={confirmPromotion}
          />
          <View style={styles.section}>
            <BackupSection progress={progress} deps={deps} alive={alive} />
          </View>
          <View
            testID="parent-settings-cloud-wrap"
            style={styles.section}
            onLayout={(e) => {
              cloudY.current = e.nativeEvent.layout.y
            }}
          >
            <CloudBackupSection
              progress={progress}
              onProgress={setProgress}
              deps={deps}
              lifetime={lifetime}
              compact={layout.compact}
              onRestoreBottom={(bottom) => {
                restoreBottomInCard.current = bottom
              }}
              onRestoreFocusChange={(focused) => {
                restoreFocused.current = focused
              }}
            />
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Slate fills every edge, safe areas included: no cream strip.
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
  section: { marginTop: 32 },
})
