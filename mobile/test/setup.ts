// Reanimated and its worklets runtime need native code; under Jest they
// run on the libraries' own mocks (react-native-reanimated testing docs).
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/src/mock'),
)
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  // Missing from the 4.5.1 mock ("useReducedMotion: ADD ME IF NEEDED").
  useReducedMotion: () => false,
}))

// Audio is silent everywhere automated: expo-audio is a fake whose status
// the test drives by hand (test/fakeAudio.ts). No jest run can create a
// native player.
jest.mock('expo-audio', () => jest.requireActual('./fakeAudio'))

// Session audio writes MP3s through expo-file-system; tests inject an
// in-memory SessionFileStore, and this mock fails loudly if a test forgets.
jest.mock('expo-file-system', () => {
  const unavailable = () => {
    throw new Error('expo-file-system is mocked: inject a SessionFileStore')
  }
  return {
    Paths: {
      get cache() {
        return unavailable()
      },
    },
    Directory: jest.fn(unavailable),
    File: jest.fn(unavailable),
  }
})

// SafeAreaProvider renders nothing until native reports the insets; the
// library's mock supplies fixed metrics (320 x 640, no insets).
jest.mock(
  'react-native-safe-area-context',
  () =>
    jest.requireActual<{ default: unknown }>(
      'react-native-safe-area-context/jest/mock',
    ).default,
)

// No test reaches the network. Session starts are faked where a test
// needs one; anything else (App's Math kick) fails like an offline device.
globalThis.fetch = jest.fn(() =>
  Promise.reject(new TypeError('Network request failed (jest is offline)')),
)
