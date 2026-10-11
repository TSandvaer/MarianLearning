/**
 * Session End's inline vector glyphs, drawn as the web's inline SVGs in
 * `src/screens/SessionEnd/SessionEnd.tsx` (`StarIcon`, `MoonIcon`,
 * `CheckIcon`, `AgainIcon`) and `src/screens/Map/mapParts.tsx`
 * (`SpeakerIcon`). Gradient ids are scoped per `Svg`, so they can repeat.
 */
import { INK } from '@marian/core/map/mapTheme'
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg'

/** A gold clay star: "you got it" feedback, never counted. */
export function StarIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="g" cx="40%" cy="30%" r="50%">
          <Stop offset="0" stopColor="#fff6a8" />
          <Stop offset="0.6" stopColor="#ffd23f" />
          <Stop offset="1" stopColor="#f0a818" />
        </RadialGradient>
      </Defs>
      <Path
        d="M50 6 L62 36 L94 38 L69 59 L77 91 L50 73 L23 91 L31 59 L6 38 L38 36 Z"
        fill="url(#g)"
        stroke="#e39a10"
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** The moon on a sleeping flower's hole. */
export function MoonIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="g" cx="35%" cy="30%" r="50%">
          <Stop offset="0" stopColor="#fffbd6" />
          <Stop offset="0.7" stopColor="#ffe27a" />
          <Stop offset="1" stopColor="#f0b72a" />
        </RadialGradient>
      </Defs>
      <Path
        d="M62 8 A44 44 0 1 0 92 70 A36 36 0 1 1 62 8 Z"
        fill="url(#g)"
        stroke="#d99a1a"
        strokeWidth={3}
      />
    </Svg>
  )
}

/** "All done": a white tick. */
export function CheckIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M20 52 L42 72 L80 30"
        stroke="#fff"
        strokeWidth={14}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** "Again": a white round arrow. */
export function AgainIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M76 34 A32 32 0 1 0 82 58"
        stroke="#fff"
        strokeWidth={12}
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M84 14 L80 40 L56 34 Z" fill="#fff" />
    </Svg>
  )
}

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
