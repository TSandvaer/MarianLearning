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

// SafeAreaProvider renders nothing until native reports the insets; the
// library's mock supplies fixed metrics (320 x 640, no insets).
jest.mock(
  'react-native-safe-area-context',
  () =>
    jest.requireActual<{ default: unknown }>(
      'react-native-safe-area-context/jest/mock',
    ).default,
)
