/**
 * A Word Song picture (web `WordPicture`): the bundled WebP (`contain`),
 * square at `size` pt, labelled with its word. Words without art never get
 * here: their problem draws as a written-word problem
 * (`design/native/word-song-native.md` § 7), so a missing key draws an
 * empty box rather than the web's pink square.
 */
import { Image } from 'expo-image'
import { View } from 'react-native'
import { pictureAsset } from '../../assets'

export function WordPicture({
  pictureKey,
  size,
  label,
  testID,
}: {
  pictureKey: string
  size: number
  label: string
  testID?: string
}) {
  const asset = pictureAsset(pictureKey)
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ width: size, height: size }}
    >
      {asset !== undefined && (
        <Image
          testID={`word-picture-${pictureKey}`}
          source={asset}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessible={false}
          style={{ width: size, height: size }}
        />
      )}
    </View>
  )
}
