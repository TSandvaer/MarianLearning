/** Spec colour tokens, from the web's `tailwind.config.js`. */
export const colors = {
  myPink: '#FFC0CB',
  myCream: '#FFF5F0',
  myRose: '#F48FB1',
  ink: '#3D2B3D',
  sparkle: '#FFD966',
  white: '#FFFFFF',
} as const

/**
 * Fredoka faces, loaded by `useAppFonts()` (`./fonts.ts`) under these
 * family names. The web loads the same family through `@fontsource/fredoka`.
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
