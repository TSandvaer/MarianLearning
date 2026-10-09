// NativeWind PROBE (throwaway branch): className port of the placeholder.
import { WARM_CAP_MS } from '@marian/core/splash/splashTiming'
import { Image } from 'expo-image'
import { useEffect } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { emmaAsset } from '../assets'
import { StyleBench } from './StyleBench'

export interface SplashPlaceholderProps {
  onAdvance: () => void
}

export function SplashPlaceholder({ onAdvance }: SplashPlaceholderProps) {
  const { width, height } = useWindowDimensions()
  const logoSize = Math.min(240, Math.min(width, height) * 0.5)

  useEffect(() => {
    if (process.env.EXPO_PUBLIC_STYLE_BENCH === '1') return
    const id = setTimeout(onAdvance, WARM_CAP_MS)
    return () => clearTimeout(id)
  }, [onAdvance])

  if (process.env.EXPO_PUBLIC_STYLE_BENCH === '1') return <StyleBench />

  return (
    <View
      className="absolute inset-0 items-center justify-center bg-my-cream"
      testID="route-splash"
      accessibilityLabel="Emma is waking up"
    >
      <Image
        source={emmaAsset('logo')}
        style={{ width: logoSize, height: logoSize }}
        contentFit="contain"
      />
      <View className="mt-10 flex-row items-center gap-4">
        <View className="h-3 w-3 rounded-full bg-my-rose" />
        <View className="h-3 w-3 rounded-full bg-my-rose" />
        <View className="h-3 w-3 rounded-full bg-my-rose" />
      </View>
    </View>
  )
}
