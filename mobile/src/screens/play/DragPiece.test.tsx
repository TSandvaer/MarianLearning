/**
 * The drag layer with two fingers (play-place spec § 1.7: a second finger
 * is ignored while one drags). React Native sends every touch move to the
 * responder, whichever finger moved, and the event's top-level `pageX` /
 * `pageY` are the first changed touch's; the piece follows only the finger
 * that took it. A cancelled touch springs the piece home.
 */
import { act, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import * as Reanimated from 'react-native-reanimated'

import { resetDragForTests } from './dragLock'
import { DragPiece } from './DragPiece'

interface Finger {
  id: string
  x: number
  y: number
}

/** A native touch event: `changed` moved or lifted, `down` stay down. */
const ev = (changed: Finger[], down: Finger[]) => {
  const t = (f: Finger) => ({ identifier: f.id, pageX: f.x, pageY: f.y })
  return {
    nativeEvent: {
      ...t(changed[0]),
      changedTouches: changed.map(t),
      touches: down.map(t),
    },
  }
}

async function send(name: string, e: ReturnType<typeof ev>) {
  await act(async () => {
    const handler = screen.getByTestId('piece').props[name] as
      | ((e: unknown) => void)
      | undefined
    handler?.(e)
  })
}

/**
 * Events React Native dispatches together, in one go: a touch-cancel is an
 * `onResponderEnd` then an `onResponderTerminate`, with nothing between.
 */
async function sendTogether(...events: [string, ReturnType<typeof ev>][]) {
  await act(async () => {
    const props = screen.getByTestId('piece').props
    for (const [name, e] of events) {
      ;(props[name] as ((e: unknown) => void) | undefined)?.(e)
    }
  })
}

async function mount() {
  const calls = {
    onTap: jest.fn(),
    onDragStart: jest.fn(),
    onDrop: jest.fn(() => false),
    onDragEnd: jest.fn(),
  }
  await render(
    <DragPiece
      rect={{ x: 0, y: 0, width: 80, height: 80 }}
      testID="piece"
      accessibilityLabel="piece"
      reducedMotion
      {...calls}
    >
      <Text>piece</Text>
    </DragPiece>,
  )
  return calls
}

/** The springs the piece ran (the mock's shared values do not persist). */
const springs = jest.spyOn(Reanimated, 'withSpring')
const springsHome = () => springs.mock.calls.filter(([to]) => to === 0).length

beforeEach(() => {
  resetDragForTests()
  springs.mockClear()
})

const A0 = { id: '1', x: 10, y: 10 }
const A1 = { id: '1', x: 60, y: 70 }
const B0 = { id: '2', x: 300, y: 300 }
const B1 = { id: '2', x: 400, y: 420 }

test('a second finger neither moves nor drops the dragged piece', async () => {
  const calls = await mount()
  await send('onResponderGrant', ev([A0], [A0]))

  // Finger B comes down and moves: the piece does not start to drag.
  await send('onResponderMove', ev([B1], [A0, B1]))
  expect(calls.onDragStart).not.toHaveBeenCalled()

  // Finger A drags it.
  await send('onResponderMove', ev([A1], [A1, B1]))
  expect(calls.onDragStart).toHaveBeenCalledTimes(1)

  // B lifts (A still down): the drag goes on.
  await send('onResponderEnd', ev([B1], [A1]))
  expect(calls.onDrop).not.toHaveBeenCalled()
  expect(calls.onDragEnd).not.toHaveBeenCalled()

  // A lifts: the piece drops at A's point.
  await send('onResponderEnd', ev([A1], []))
  await send('onResponderRelease', ev([A1], []))
  expect(calls.onDrop.mock.calls).toEqual([[{ x: 60, y: 70 }]])
  expect(calls.onDragEnd).toHaveBeenCalledTimes(1)
})

test('the drag ends when its own finger lifts, while the other stays down', async () => {
  const calls = await mount()
  await send('onResponderGrant', ev([A0], [A0]))
  await send('onResponderMove', ev([A1], [A1, B0]))

  // A lifts while B rests on the piece: no release yet, but the drag ends.
  await send('onResponderEnd', ev([A1], [B0]))
  expect(calls.onDrop.mock.calls).toEqual([[{ x: 60, y: 70 }]])
  expect(calls.onDragEnd).toHaveBeenCalledTimes(1)

  // B moves and lifts: nothing more happens.
  await send('onResponderMove', ev([B1], [B1]))
  await send('onResponderEnd', ev([B1], []))
  await send('onResponderRelease', ev([B1], []))
  expect(calls.onDrop).toHaveBeenCalledTimes(1)
  expect(calls.onDragStart).toHaveBeenCalledTimes(1)
  expect(calls.onDragEnd).toHaveBeenCalledTimes(1)
  expect(calls.onTap).not.toHaveBeenCalled()
})

test('a cancelled drag springs home: no drop, no tap', async () => {
  const calls = await mount()
  await send('onResponderGrant', ev([A0], [A0]))
  await send('onResponderMove', ev([A1], [A1]))
  expect(springsHome()).toBe(0)

  // iOS cancels A (a system gesture): End, then Terminate.
  await sendTogether(
    ['onResponderEnd', ev([A1], [])],
    ['onResponderTerminate', ev([A1], [])],
  )
  expect(calls.onDrop).not.toHaveBeenCalled()
  expect(calls.onTap).not.toHaveBeenCalled()
  expect(calls.onDragEnd).toHaveBeenCalledTimes(1)
  // Home on both axes.
  expect(springsHome()).toBe(2)
})

test('a cancelled touch that never dragged is not a tap', async () => {
  const calls = await mount()
  await send('onResponderGrant', ev([A0], [A0]))
  await sendTogether(
    ['onResponderEnd', ev([A0], [])],
    ['onResponderTerminate', ev([A0], [])],
  )
  expect(calls.onTap).not.toHaveBeenCalled()
  expect(calls.onDrop).not.toHaveBeenCalled()
  expect(calls.onDragEnd).not.toHaveBeenCalled()
})

test('a lift released in one go still drops, and a still touch taps', async () => {
  const calls = await mount()
  await send('onResponderGrant', ev([A0], [A0]))
  await send('onResponderMove', ev([A1], [A1]))
  await sendTogether(
    ['onResponderEnd', ev([A1], [])],
    ['onResponderRelease', ev([A1], [])],
  )
  expect(calls.onDrop.mock.calls).toEqual([[{ x: 60, y: 70 }]])
  expect(calls.onDragEnd).toHaveBeenCalledTimes(1)
  // Refused (`onDrop` is false): home.
  expect(springsHome()).toBe(2)

  await send('onResponderGrant', ev([A0], [A0]))
  await sendTogether(
    ['onResponderEnd', ev([A0], [])],
    ['onResponderRelease', ev([A0], [])],
  )
  expect(calls.onTap).toHaveBeenCalledTimes(1)
  expect(calls.onDrop).toHaveBeenCalledTimes(1)
})
