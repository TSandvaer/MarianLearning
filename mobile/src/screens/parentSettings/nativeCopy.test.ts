import {
  DEFAULT_PARENT_SETTINGS,
  type ParentSettings,
} from '@marian/core/progress'
import { defaultsFootnote, formatLastSynced } from './nativeCopy'

describe('defaultsFootnote', () => {
  it("reads the spec's exact line for today's defaults", () => {
    expect(defaultsFootnote(DEFAULT_PARENT_SETTINGS)).toBe(
      'Defaults: auto-promote on, fresh-day mastery on, math threshold 88% / 3 sessions, word-song threshold 88% / 3 sessions, level shown, mode picker off, cross-vowel mixing on (active after all three short-vowel CVC tiers master).',
    )
  })

  it('follows the settings it is given', () => {
    const other: ParentSettings = {
      autoPromote: false,
      sessionModePicker: 'on',
      masteryThreshold: {
        math: { percent: 0.95, sessions: 3 },
        'word-song': { percent: 0.8, sessions: 2 },
      },
      crossDayEnforcement: false,
      showLevelToMarian: false,
      crossVowelMixingEnabled: false,
    }
    expect(defaultsFootnote(other)).toBe(
      'Defaults: auto-promote off, fresh-day mastery off, math threshold 95% / 3 sessions, word-song threshold 80% / 2 sessions, level hidden, mode picker on, cross-vowel mixing off (active after all three short-vowel CVC tiers master).',
    )
  })
})

describe('formatLastSynced', () => {
  it('says "Never" for null', () => {
    expect(formatLastSynced(null, 'Never')).toBe('Never')
  })

  it('returns an unparseable value unchanged', () => {
    expect(formatLastSynced('not a date', 'Never')).toBe('not a date')
  })

  it('formats with the spec options in local time', () => {
    const toLocale = jest.spyOn(Date.prototype, 'toLocaleString')
    const out = formatLastSynced('2026-10-11T12:32:00.000Z', 'Never')
    expect(toLocale).toHaveBeenCalledWith(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(out).not.toBe('2026-10-11T12:32:00.000Z')
    expect(out).toContain('2026')
    toLocale.mockRestore()
  })

  it('a formatter that throws gives the raw string', () => {
    const toLocale = jest
      .spyOn(Date.prototype, 'toLocaleString')
      .mockImplementation(() => {
        throw new RangeError('no Intl')
      })
    expect(formatLastSynced('2026-10-11T12:32:00.000Z', 'Never')).toBe(
      '2026-10-11T12:32:00.000Z',
    )
    toLocale.mockRestore()
  })
})
