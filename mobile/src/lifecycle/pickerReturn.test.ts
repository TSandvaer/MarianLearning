/**
 * The return rule (learner profiles § 2.2, AC 31): 10 minutes hidden on
 * Greet, the Hub, the Map or Session End with 2+ learners → the picker.
 */
import type { Route } from '../router/routes'
import {
  PICKER_AFTER_HIDDEN_MS,
  PICKER_RETURN_ROUTES,
  opensPickerOnReturn,
} from './pickerReturn'

const TEN_MIN = 600_000

it('is 10 minutes, on Greet, the Hub, the Map, Session End and the Play place only', () => {
  expect(PICKER_AFTER_HIDDEN_MS).toBe(TEN_MIN)
  expect([...PICKER_RETURN_ROUTES].sort()).toEqual(
    ['greet', 'hub', 'map', 'session-end', 'play-place'].sort(),
  )
})

it.each(['greet', 'hub', 'map', 'session-end', 'play-place'] as Route[])(
  '%s: 10 min with 2+ learners opens the picker; 9 min 59 s or 1 learner does not',
  (route) => {
    expect(opensPickerOnReturn(route, TEN_MIN, 2)).toBe(true)
    expect(opensPickerOnReturn(route, TEN_MIN, 4)).toBe(true)
    expect(opensPickerOnReturn(route, TEN_MIN - 1000, 2)).toBe(false)
    expect(opensPickerOnReturn(route, TEN_MIN, 1)).toBe(false)
  },
)

it.each([
  'math',
  'literacy',
  'peek',
  'parent-settings',
  'picker',
  'play-game',
] as Route[])('%s: never interrupted', (route) => {
  expect(opensPickerOnReturn(route, 10 * TEN_MIN, 4)).toBe(false)
})
