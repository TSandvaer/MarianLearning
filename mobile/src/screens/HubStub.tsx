/**
 * Hub stub — the returning-launch destination (sessionCount >= 1). Proves
 * the storage round-trip: the count shown here was read synchronously
 * through the localStorage polyfill on boot.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import type { ScreenLayout } from '../layout'
import { colors, FILL, fonts } from '../theme'

export interface HubStubProps {
  layout: ScreenLayout
  sessionCount: number
  onPlayMath: () => void
  onReplayGreet: () => void
  onReset: () => void
}

export function HubStub({
  layout,
  sessionCount,
  onPlayMath,
  onReplayGreet,
  onReset,
}: HubStubProps) {
  const { content } = layout
  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(250)}
      style={styles.root}
    >
      <View
        style={[
          styles.content,
          {
            left: content.x,
            top: content.y,
            width: content.width,
            height: content.height,
          },
        ]}
      >
        <Text style={styles.title}>Hub (stub)</Text>
        <Text style={styles.count}>Sessions started: {sessionCount}</Text>
        <View style={styles.row}>
          <Pressable onPress={onPlayMath} style={[styles.btn, styles.primary]}>
            <Text style={[styles.btnText, styles.primaryText]}>Math</Text>
          </Pressable>
          <Pressable onPress={onReplayGreet} style={styles.btn}>
            <Text style={styles.btnText}>Greet again</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={onReset}
          style={styles.reset}
          accessibilityHint="Clears the stored session count"
        >
          <Text style={styles.resetText}>
            Reset storage (next launch shows Greet)
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: { ...FILL, backgroundColor: colors.myCream },
  content: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: { fontFamily: fonts.bold, fontSize: 28, color: colors.ink },
  count: { fontFamily: fonts.regular, fontSize: 20, color: colors.ink },
  row: { flexDirection: 'row', gap: 16 },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.myRose,
    backgroundColor: colors.white,
  },
  primary: { backgroundColor: colors.myRose },
  btnText: { fontFamily: fonts.semibold, fontSize: 20, color: colors.ink },
  primaryText: { color: colors.white },
  reset: { marginTop: 8, padding: 8 },
  resetText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink,
    opacity: 0.5,
    textDecorationLine: 'underline',
  },
})
