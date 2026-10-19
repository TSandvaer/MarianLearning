/**
 * A learner's picture (learner profiles § 1.2, § 9): their fixed colour
 * disc, with the clay animal inside at 90% of it once the picture is
 * bundled (`avatarAsset`). Until then, the disc alone. Used on the picker
 * tiles, the Hub badge and Parent Settings.
 */
import type { AvatarId } from '@marian/core/learners'
import { Image } from 'expo-image'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { avatarAsset } from '../../assets'
import { ANIMAL_OF_DISC } from '../../layout/pickerLayout'
import { AVATAR_COLORS } from './avatars'

export interface AvatarDiscProps {
  avatarId: AvatarId
  /** Diameter (pt). */
  size: number
  testID?: string
  style?: StyleProp<ViewStyle>
}

export function AvatarDisc({ avatarId, size, testID, style }: AvatarDiscProps) {
  const source = avatarAsset(avatarId)
  const animal = size * ANIMAL_OF_DISC
  return (
    <View
      testID={testID ?? `avatar-disc-${avatarId}`}
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: AVATAR_COLORS[avatarId],
        },
        style,
      ]}
    >
      {source !== undefined && (
        <Image
          testID={`avatar-image-${avatarId}`}
          source={source}
          contentFit="contain"
          style={{ width: animal, height: animal }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
})
