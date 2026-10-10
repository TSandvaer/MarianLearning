/**
 * Placeholder for every route except Splash until Phase 3 ports the real
 * screen. Developer-facing: it names the route, shows the persisted
 * `sessionCount` (what Splash branched on) and offers a button per exit
 * in `ROUTE_EXITS`, so the whole state machine can be walked by hand.
 * Session End also shows the payload Math handed it (the web's shape),
 * until the real screen consumes it.
 * Laid out in the part of the route's content area Emma does not cover.
 */
import { readSessionHistory } from '@marian/core/sessionEnd/sessionHistory'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { panelRect, type ScreenLayout } from '../layout/layout'
import type { LaunchFlags } from '../platform/launchFlags'
import { ROUTE_EXITS, ROUTE_LABELS, type Route } from '../router/routes'
import type { SessionEndPayload } from '../session/sessionEndPayload'
import { colors, fonts } from '../theme'

export interface RoutePlaceholderProps {
  route: Route
  layout: ScreenLayout
  flags: LaunchFlags
  onNavigate: (to: Route) => void
  /** Session End: what the finished session handed over. */
  sessionEnd?: SessionEndPayload | null
}

export function RoutePlaceholder({
  route,
  layout,
  flags,
  onNavigate,
  sessionEnd = null,
}: RoutePlaceholderProps) {
  const panel = panelRect(layout)
  const { sessionCount } = readSessionHistory()

  return (
    <View
      testID={`route-${route}`}
      style={[
        styles.panel,
        {
          left: panel.x,
          top: panel.y,
          width: panel.width,
          height: panel.height,
        },
      ]}
    >
      <Text style={styles.title} accessibilityRole="header">
        {ROUTE_LABELS[route]}
      </Text>
      <Text style={styles.note}>Placeholder: the real screen is Phase 3.</Text>

      <View style={styles.exits}>
        {ROUTE_EXITS[route].map((to) => (
          <Pressable
            key={to}
            testID={`exit-${to}`}
            accessibilityRole="button"
            onPress={() => onNavigate(to)}
            style={({ pressed }) => [styles.exit, pressed && styles.pressed]}
          >
            <Text style={styles.exitLabel}>{ROUTE_LABELS[to]}</Text>
          </Pressable>
        ))}
      </View>

      {sessionEnd !== null && (
        <Text style={styles.status} testID="session-end-handoff">
          {`${sessionEnd.surface} · ${sessionEnd.totalCorrect}/${sessionEnd.perProblemCorrect?.length ?? '?'} correct · first try ${sessionEnd.perProblemCorrect?.filter(Boolean).length ?? '?'} · +${sessionEnd.earnedThisSession} stardust (${sessionEnd.totalStardust}) · streak ${sessionEnd.finalStreak}`}
        </Text>
      )}

      <Text style={styles.status} testID="status">
        {`route ${route} · sessionCount ${sessionCount}`}
        {flags.debug
          ? ` · debug${flags.seed ? ` seed ${flags.seed}` : ''}`
          : ''}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 34,
    color: colors.ink,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
    opacity: 0.6,
  },
  exits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  exit: {
    minHeight: 56,
    minWidth: 120,
    paddingHorizontal: 20,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.myPink,
  },
  pressed: { backgroundColor: colors.myRose },
  exitLabel: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    color: colors.ink,
  },
  status: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink,
    opacity: 0.45,
  },
})
