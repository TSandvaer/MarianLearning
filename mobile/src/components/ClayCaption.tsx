/**
 * Emma's spoken line on a cream clay slab with a speaker (web
 * `.se-caption` and the map's `map-ribbon`), shown whole as she starts the
 * line, as the web does. Session End and the map.
 */
import { StyleSheet, Text, View } from 'react-native'
import type { CaptionMetrics } from '../layout/layout'
import { fonts } from '../theme'
import { SpeakerIcon } from './SpeakerIcon'

export function ClayCaption({
  text,
  metrics: c,
  testID,
  textTestID,
}: {
  text: string
  metrics: CaptionMetrics
  /** The slab's test id. */
  testID: string
  /** The text's test id. */
  textTestID: string
}) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
      style={[
        styles.caption,
        {
          minHeight: c.minHeight,
          gap: c.gap,
          paddingHorizontal: c.padding.horizontal,
          paddingVertical: c.padding.vertical,
          borderRadius: c.radius,
        },
      ]}
    >
      <SpeakerIcon size={c.speaker} />
      <Text
        testID={textTestID}
        allowFontScaling={false}
        style={[
          styles.captionText,
          { fontSize: c.font, lineHeight: c.lineHeight },
        ]}
      >
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ee',
    experimental_backgroundImage: 'linear-gradient(#fffdf8, #fff1e2)',
    boxShadow:
      'inset 0 3px 0 #ffffff, 0 8px 0 #e3c6a6, 0 14px 22px rgba(60, 30, 10, 0.2)',
  },
  captionText: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    color: '#6b3f1f',
  },
})
