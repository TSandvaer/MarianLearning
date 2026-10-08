/**
 * Fredoka through expo-font. Per-weight subpaths: the package index
 * requires all five TTFs (+150 KB) and the app uses three.
 */
import { Fredoka_400Regular } from '@expo-google-fonts/fredoka/400Regular'
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold'
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka/700Bold'
import { useFonts } from 'expo-font'
import { fonts } from './theme'

const FONT_MAP = {
  [fonts.regular]: Fredoka_400Regular,
  [fonts.semibold]: Fredoka_600SemiBold,
  [fonts.bold]: Fredoka_700Bold,
}

/**
 * `true` once the faces can be used (the font files ship in the binary,
 * so this is a local load, not a download). A load error also returns
 * `true`: text then falls back to the system font rather than the app
 * staying on the splash screen.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FONT_MAP)
  return loaded || error !== null
}
