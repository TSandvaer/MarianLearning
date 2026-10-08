/** Spec colour tokens, copied from the web `tailwind.config.js`. */
export const colors = {
  myPink: '#FFC0CB',
  myCream: '#FFF5F0',
  myRose: '#F48FB1',
  ink: '#3D2B3D',
  sparkle: '#FFD966',
  white: '#FFFFFF',
} as const

/**
 * Fredoka faces registered in App.tsx via expo-font. The web caption uses
 * `ui-rounded` (SF Pro Rounded on iPad); Android has no SF Rounded, so the
 * native port uses Fredoka on both platforms for one consistent look.
 */
export const fonts = {
  regular: 'Fredoka_400Regular',
  semibold: 'Fredoka_600SemiBold',
  bold: 'Fredoka_700Bold',
} as const

/**
 * Full-bleed absolute fill. RN 0.86 removed `StyleSheet.absoluteFillObject`
 * (tsc: "Property 'absoluteFillObject' does not exist").
 */
export const FILL = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const

export const EMMA_SOURCES = {
  idle: require('../assets/emma/idle.webp'),
  celebration: require('../assets/emma/celebration.webp'),
  'puzzled-tilt': require('../assets/emma/puzzled-tilt.webp'),
} as const

export type SpikePose = keyof typeof EMMA_SOURCES

export const LOGO_SOURCE = require('../assets/emma/logo.webp')
