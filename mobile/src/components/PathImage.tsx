/**
 * One piece of Emma's Path clay art (web `PathImg`, `src/screens/Map/
 * mapParts.tsx`): a square WebP at `px` points. The web's `srcSet` picks
 * the 256 or 512 export by the device pixels it covers; so does this.
 * Decorative: screen readers skip it, as the web's `aria-hidden`.
 */
import type { PathArtId } from '@marian/core/emmasPath/pathArt'
import { Image } from 'expo-image'
import { PixelRatio, type ImageStyle, type StyleProp } from 'react-native'
import { pathArtAsset } from '../assets'

export interface PathImageProps {
  id: PathArtId
  px: number
  testID?: string
  style?: StyleProp<ImageStyle>
}

export function PathImage({ id, px, testID, style }: PathImageProps) {
  const size = px * PixelRatio.get() > 256 ? 512 : 256
  return (
    <Image
      testID={testID}
      source={pathArtAsset(id, size)}
      contentFit="contain"
      cachePolicy="memory-disk"
      accessible={false}
      style={[{ width: px, height: px }, style]}
    />
  )
}
