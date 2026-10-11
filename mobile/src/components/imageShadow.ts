/**
 * The web's `filter: drop-shadow(0 Y B color)` on an image (a sticker, a
 * padlock, a bud, an arch, the map icon). iOS can't filter (RN supports
 * only `brightness` and `opacity` there), so a background-less wrapper
 * gets `shadow*` props, which follow the image's alpha. Android draws RN's
 * `dropShadow` filter (Android 12+; older versions show none). CSS blur
 * radius B = Gaussian σ B / 2: RN's `standardDeviation` is σ, and iOS
 * `shadowRadius` ≈ B / 2. Shared by the Hub and the map (map-native § 5).
 */
import { Platform, type ViewStyle } from 'react-native'

export function imageShadow(y: number, blur: number, color: string): ViewStyle {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: color,
      shadowOffset: { width: 0, height: y },
      shadowOpacity: 1,
      shadowRadius: blur / 2,
    }
  }
  return {
    filter: [
      {
        dropShadow: {
          offsetX: 0,
          offsetY: y,
          standardDeviation: blur / 2,
          color,
        },
      },
    ],
  }
}
