/**
 * The speaker at the start of Emma's caption slab (web `SpeakerIcon`,
 * `src/screens/Map/mapParts.tsx`). Session End and the map.
 */
import { INK } from '@marian/core/map/mapTheme'
import Svg, { Path } from 'react-native-svg'

/** The speaker at the start of Emma's caption (web `SpeakerIcon`, 38 px). */
export function SpeakerIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M14 38 H32 L54 18 V82 L32 62 H14 Z" fill={INK} />
      <Path
        d="M66 34 Q76 50 66 66 M76 24 Q92 50 76 76"
        stroke={INK}
        strokeWidth={6}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  )
}
