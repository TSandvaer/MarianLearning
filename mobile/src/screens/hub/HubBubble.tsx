/**
 * Emma's speech bubble on the Hub (web `.hub-bubble`): the shared caption
 * ribbon as a cream clay slab with brown text and a tail. W: the web's
 * values × u, tail on the right pointing at Emma. P / L: radius 28, tail
 * at the top centre pointing up at her. It hangs from the layout's fixed
 * top and grows down, so nothing moves when a line starts or wraps.
 *
 * Keyed by line by the caller: between two lines it leaves (web exit:
 * opacity 0, 0.25 s) and the next line's bubble enters with its first word.
 */
import { StyleSheet, View } from 'react-native'
import { FadeOut } from 'react-native-reanimated'
import Svg, { Polygon } from 'react-native-svg'
import { CaptionRibbon } from '../../components/CaptionRibbon'
import type { HubBubbleLayout } from '../../layout/hubLayout'

/** Web `.hub-bubble p` colour; tail fill `#fff8ee`. */
export const BUBBLE_TEXT = '#6b3f1f'
const TAIL_FILL = '#fff8ee'
export const BUBBLE_EXIT_MS = 250

function Tail({ tail }: { tail: HubBubbleLayout['tail'] }) {
  const { width: w, height: h } = tail
  // Web `clip-path: polygon(0 0, 100% 55%, 0 100%)`; P / L: point up.
  const points =
    tail.side === 'right'
      ? `0,0 ${w},${0.55 * h} 0,${h}`
      : `0,${h} ${w / 2},0 ${w},${h}`
  return (
    <View
      pointerEvents="none"
      style={[styles.tail, { left: tail.x, top: tail.y, width: w, height: h }]}
    >
      <Svg width={w} height={h}>
        <Polygon points={points} fill={TAIL_FILL} />
      </Svg>
    </View>
  )
}

export interface HubBubbleProps {
  bubble: HubBubbleLayout
  text: string
  revealedCount: number
  lineKey: string
}

export function HubBubble({
  bubble,
  text,
  revealedCount,
  lineKey,
}: HubBubbleProps) {
  return (
    <CaptionRibbon
      testID="hub-bubble"
      text={text}
      revealedCount={revealedCount}
      lineKey={lineKey}
      fontSize={bubble.fontSize}
      lineHeight={bubble.lineHeight}
      padding={bubble.padding}
      color={BUBBLE_TEXT}
      exiting={FadeOut.duration(BUBBLE_EXIT_MS)}
      style={[
        styles.bubble,
        {
          left: bubble.x,
          top: bubble.y,
          width: bubble.width,
          borderRadius: bubble.radius,
          boxShadow: bubble.shadow,
        },
      ]}
    >
      <Tail tail={bubble.tail} />
    </CaptionRibbon>
  )
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    borderWidth: 0,
    pointerEvents: 'none',
    backgroundColor: '#fff7ee',
    experimental_backgroundImage: 'linear-gradient(#fffdf8, #fff1e2)',
  },
  tail: { position: 'absolute' },
})
