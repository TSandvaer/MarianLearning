/**
 * Splash placeholder (the real screen is a Phase 3 port of
 * `src/screens/Splash.tsx`).
 *
 * Silent. Shows the Emma logo on cream, the same picture as the native
 * splash screen, so the hand-off from the OS splash is seamless. Advances
 * after `WARM_CAP_MS`: the web's 3000 ms cold cap covers an un-cached
 * service worker, and native assets ship in the binary, so every native
 * launch is "warm". App decides the next route (`nextAfterSplash()`).
 */
import { WARM_CAP_MS } from '@marian/core/splash/splashTiming'
import { Image } from 'expo-image'
import { useEffect } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { emmaAsset } from '../assets'
import { colors, FILL } from '../theme'

export interface SplashPlaceholderProps {
  onAdvance: () => void
}

export function SplashPlaceholder({ onAdvance }: SplashPlaceholderProps) {
  const { width, height } = useWindowDimensions()
  const logoSize = Math.min(240, Math.min(width, height) * 0.5)

  useEffect(() => {
    const id = setTimeout(onAdvance, WARM_CAP_MS)
    return () => clearTimeout(id)
  }, [onAdvance])

  return (
    <View
      style={styles.root}
      testID="route-splash"
      accessibilityLabel="Emma is waking up"
    >
      <Image
        source={emmaAsset('logo')}
        style={{ width: logoSize, height: logoSize }}
        contentFit="contain"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...FILL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.myCream,
  },
})
