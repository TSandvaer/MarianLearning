/**
 * The games' drag layer (play-place spec § 1.7): a piece that follows the
 * finger 1:1, with no lag. A touch that moves under 8 pt is a tap. A
 * dragged piece lifts (scale 1.08 over 120 ms; not under Reduce Motion)
 * and, dropped where the game does not take it, springs back to where it
 * came from (spring 300 / 22). Only one piece moves at a time: a second
 * finger is ignored while one drags.
 *
 * Built on React Native's responder system with Reanimated shared values:
 * the app has no gesture-handler dependency, and the responder events are
 * all a one-finger drag needs. Every touch move reaches the responder,
 * whichever finger moved, so the piece follows only the touch that took it
 * (by `identifier`) and its drag ends when that touch lifts. A touch-cancel
 * also arrives as `onResponderEnd`, followed in the same dispatch by
 * `onResponderTerminate`, so a lift waits for the dispatch to finish: a
 * terminate in it springs the piece home instead. Drop points are in screen
 * points (the app's root fills the window, so `pageX` / `pageY` are layout
 * coordinates).
 *
 * VoiceOver: the piece is a button; "activate" runs `onTap`, so a drag is
 * never the only way (§ 2.6, § 3.8).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  StyleSheet,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import type { Rect } from '../../layout/layout'
import type { Point } from './playGeometry'

import {
  dragLock,
  LIFT_MS,
  LIFT_SCALE,
  PIECE_Z,
  SPRING,
  TAP_SLOP,
} from './dragLock'

export interface DragPieceProps {
  rect: Rect
  testID: string
  accessibilityLabel: string
  /** Extra VoiceOver actions (besides "activate"). */
  accessibilityActions?: readonly AccessibilityActionInfo[]
  onAccessibilityAction?: (name: string) => void
  /** No touches at all (taps and drags). */
  disabled?: boolean
  /** Out of VoiceOver too (the word hunt's vowel while it is out). */
  hidden?: boolean
  /** Taps only; a drag springs home (e.g. nothing boards while away). */
  dragDisabled?: boolean
  reducedMotion: boolean
  onTap: () => void
  /** VoiceOver's "activate" (default: `onTap`). */
  onActivate?: () => void
  onDragStart?: () => void
  /** `true`: the game took the piece (its state moves it); else home. */
  onDrop?: (at: Point) => boolean
  /** Any end of a drag: dropped, refused or cancelled. */
  onDragEnd?: () => void
  /** A change drops a drag in flight where it is and springs it home. */
  cancelKey?: string
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

export function DragPiece({
  rect,
  testID,
  accessibilityLabel,
  accessibilityActions = [],
  onAccessibilityAction,
  disabled = false,
  hidden = false,
  dragDisabled = false,
  reducedMotion,
  onTap,
  onActivate,
  onDragStart,
  onDrop,
  onDragEnd,
  cancelKey,
  style,
  children,
}: DragPieceProps) {
  const [me] = useState(() => Symbol(testID))
  const start = useRef<Point | null>(null)
  const finger = useRef<number | null>(null)
  const dragging = useRef(false)
  // The drag's finger lifted at this point; drops or taps once confirmed.
  const lifted = useRef<Point | null>(null)
  const dx = useSharedValue(0)
  const dy = useSharedValue(0)
  const scale = useSharedValue(1)

  const springHome = () => {
    dx.set(withSpring(0, SPRING))
    dy.set(withSpring(0, SPRING))
    scale.set(withTiming(1, { duration: LIFT_MS }))
  }
  const release = () => {
    const was = dragging.current
    start.current = null
    finger.current = null
    dragging.current = false
    lifted.current = null
    if (dragLock.held === me) dragLock.held = null
    return was
  }

  // A cancel (background, rotation): the drag in flight springs home.
  const cancelRef = useRef(cancelKey)
  useEffect(() => {
    if (cancelRef.current === cancelKey) return
    cancelRef.current = cancelKey
    if (start.current === null) return
    const was = release()
    springHome()
    if (was) onDragEnd?.()
    // Only a new key cancels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelKey])

  useEffect(
    () => () => {
      if (dragLock.held === me) dragLock.held = null
    },
    [me],
  )

  // The drag's own finger among the touches that changed, else null.
  const at = (e: GestureResponderEvent): Point | null => {
    const t = e.nativeEvent.changedTouches.find(
      (c) => c.identifier === finger.current,
    )
    return t ? { x: t.pageX, y: t.pageY } : null
  }

  const onGrant = (e: GestureResponderEvent) => {
    dragLock.held = me
    finger.current = e.nativeEvent.identifier
    start.current = at(e)
    dragging.current = false
  }
  const onMove = (e: GestureResponderEvent) => {
    const from = start.current
    if (from === null || dragLock.held !== me) return
    const p = at(e)
    if (p === null) return
    const mx = p.x - from.x
    const my = p.y - from.y
    if (!dragging.current) {
      if (dragDisabled || Math.hypot(mx, my) < TAP_SLOP) return
      dragging.current = true
      if (!reducedMotion) {
        scale.set(withTiming(LIFT_SCALE, { duration: LIFT_MS }))
      }
      onDragStart?.()
    }
    dx.set(mx)
    dy.set(my)
  }
  // A touch lifted or was cancelled (`onResponderEnd`): the drag's own
  // finger waits for the rest of the dispatch (a cancel terminates there).
  const onEnd = (e: GestureResponderEvent) => {
    if (start.current === null || dragLock.held !== me) return
    if (lifted.current !== null) return
    const p = at(e)
    if (p === null) return
    lifted.current = p
    void Promise.resolve().then(finish)
  }
  // The dispatch ended without a terminate: the drag's finger lifted.
  const finish = () => {
    const p = lifted.current
    if (p === null) return
    const was = release()
    if (!was) {
      onTap()
      return
    }
    const taken = onDrop?.(p) ?? false
    if (taken) {
      dx.set(0)
      dy.set(0)
      scale.set(1)
    } else springHome()
    onDragEnd?.()
  }
  // The last touch lifted (never after a cancel): no need to wait.
  const onRelease = (e: GestureResponderEvent) => {
    onEnd(e)
    finish()
  }
  const onTerminate = () => {
    if (start.current === null) return
    const was = release()
    springHome()
    if (was) onDragEnd?.()
  }

  const moved = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx.get() },
      { translateY: dy.get() },
      { scale: scale.get() },
    ],
  }))

  return (
    <Animated.View
      testID={testID}
      accessible={!hidden}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'activate' }, ...accessibilityActions]}
      onAccessibilityAction={(e: AccessibilityActionEvent) => {
        if (disabled) return
        const name = e.nativeEvent.actionName
        if (name === 'activate') (onActivate ?? onTap)()
        else onAccessibilityAction?.(name)
      }}
      onStartShouldSetResponder={() => !disabled && dragLock.held === null}
      onMoveShouldSetResponder={() => false}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderEnd={onEnd}
      onResponderRelease={onRelease}
      onResponderTerminate={onTerminate}
      style={[
        styles.piece,
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
        style,
        moved,
      ]}
    >
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', zIndex: PIECE_Z },
})
