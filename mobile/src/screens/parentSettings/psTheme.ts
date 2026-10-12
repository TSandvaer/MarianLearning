/**
 * Parent Settings' look (`design/native/parent-settings-native.md` § 2):
 * the web's Tailwind slate / emerald / amber, the system font (no
 * Fredoka: this is not a Marian screen) and the type scale.
 */
import { Platform, type TextStyle } from 'react-native'

/** Tailwind colour values the web screen uses. */
export const slate = {
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
} as const

export const emerald = {
  50: '#ECFDF5',
  300: '#6EE7B7',
  700: '#047857',
  800: '#065F46',
  900: '#064E3B',
} as const

export const amber700 = '#B45309'
export const white = '#FFFFFF'

/** Device ID and the restore field: a code to compare, not prose. */
export const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' })

/** System text size cap for body text (the header caps at 1.2). */
export const BODY_FONT_MAX = 1.5
export const HEADER_FONT_MAX = 1.2

export const RADIUS = 6
/** Every button, segment and switch row is at least this tall. */
export const MIN_TARGET = 44

export const type = {
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 21,
    color: slate[800],
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
    color: slate[800],
  },
  description: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: slate[500],
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: slate[600],
  },
  value: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: slate[700],
  },
  status: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  footnote: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: slate[400],
  },
  button: { fontSize: 14, fontWeight: '500' },
  mono: { fontFamily: MONO, fontSize: 12, fontWeight: '400' },
} as const satisfies Record<string, TextStyle>

/** Status line colours: ok, error, neutral. */
export const STATUS_COLOR = {
  ok: emerald[700],
  error: amber700,
  neutral: slate[500],
} as const

export type StatusTone = keyof typeof STATUS_COLOR
