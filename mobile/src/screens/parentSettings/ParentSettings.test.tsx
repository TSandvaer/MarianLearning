/**
 * Native Parent Settings: rows, save-on-change, the promotion banner,
 * exit, the audio-session release and the compact / wide forms
 * (`design/native/parent-settings-native.md` §§ 1, 2, 6, 7). Ports the
 * web screen's component tests where they apply.
 */
import {
  DEFAULT_PARENT_SETTINGS,
  defaultProgress,
  type Progress,
} from '@marian/core/progress'
import { fireEvent, screen } from '@testing-library/react-native'
import { BackHandler, Keyboard } from 'react-native'
import {
  fakeDeps,
  flat,
  mount,
  PHONE,
  TABLET,
} from '../../../test/parentSettingsHarness'

const ROW_ID = /^parent-settings-(toggle|row)-(.+)$/

function rowOrder(): string[] {
  return screen
    .getAllByTestId(ROW_ID)
    .map((el) => String(el.props.testID).replace(ROW_ID, '$2'))
}

/** The Switch is hidden from accessibility (the row speaks for it). */
const switchEl = (id: string) =>
  screen.getByTestId(`parent-settings-switch-${id}`, {
    includeHiddenElements: true,
  })

const switchValue = (id: string) => switchEl(id).props.value as boolean

const selected = (id: string) =>
  screen.getByTestId(id).props.accessibilityState?.selected === true

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})

describe('rendering', () => {
  it('renders the seven rows in the web order, with the web labels', async () => {
    await mount()
    expect(rowOrder()).toEqual([
      'autoPromote',
      'sessionModePicker',
      'masteryThreshold-math',
      'masteryThreshold-word-song',
      'crossDayEnforcement',
      'showLevelToMarian',
      'crossVowelMixingEnabled',
    ])
    expect(screen.getByText('Auto-promote on mastery')).toBeOnTheScreen()
    expect(screen.getByText('Mix vowels in chip trios')).toBeOnTheScreen()
    expect(screen.getByText('Parent settings')).toBeOnTheScreen()
    expect(screen.getByText('Changes save automatically.')).toBeOnTheScreen()
  })

  it('shows the loaded values, not always the defaults', async () => {
    const doc: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        autoPromote: false,
        sessionModePicker: 'on',
        masteryThreshold: {
          math: { percent: 0.8, sessions: 2 },
          'word-song': { percent: 0.95, sessions: 3 },
        },
        showLevelToMarian: false,
      },
    }
    await mount(fakeDeps(doc))
    expect(switchValue('autoPromote')).toBe(false)
    expect(switchValue('showLevelToMarian')).toBe(false)
    expect(switchValue('crossDayEnforcement')).toBe(true)
    expect(selected('parent-settings-segmented-sessionModePicker-on')).toBe(
      true,
    )
    expect(
      selected('parent-settings-segmented-masteryThreshold-math-80-2'),
    ).toBe(true)
    expect(
      selected('parent-settings-segmented-masteryThreshold-word-song-95-3'),
    ).toBe(true)
  })

  it('empty storage: the defaults (88% / 3 both tracks), and nothing is written on mount', async () => {
    const fake = fakeDeps(null)
    const h = await mount(fake)
    expect(
      selected('parent-settings-segmented-masteryThreshold-math-88-3'),
    ).toBe(true)
    expect(
      selected('parent-settings-segmented-masteryThreshold-word-song-88-3'),
    ).toBe(true)
    expect(switchValue('autoPromote')).toBe(true)
    expect(h.saved).toEqual([])
  })

  it('native copy: the corrected threshold line and the generated footnote (§ 7)', async () => {
    await mount()
    expect(
      screen.getAllByText(
        "How many sessions at this success rate Marian needs before a skill counts as mastered. They don't have to be in a row.",
      ),
    ).toHaveLength(2)
    expect(screen.queryByText(/in-a-row sessions/)).toBeNull()
    expect(screen.getByTestId('parent-settings-footnote').props.children).toBe(
      'Defaults: auto-promote on, fresh-day mastery on, math threshold 88% / 3 sessions, word-song threshold 88% / 3 sessions, level shown, mode picker off, cross-vowel mixing on (active after all three short-vowel CVC tiers master).',
    )
  })
})

describe('save-on-change', () => {
  it('a tap anywhere on a toggle row flips it once and writes the full settings', async () => {
    const h = await mount()
    await fireEvent.press(
      screen.getByTestId('parent-settings-toggle-autoPromote'),
    )
    expect(h.saved).toHaveLength(1)
    expect(h.saved[0]!.parentSettings).toEqual({
      ...DEFAULT_PARENT_SETTINGS,
      autoPromote: false,
    })
    expect(switchValue('autoPromote')).toBe(false)
    // The Switch takes no touches itself: one handler, no double toggle.
    const holder = switchEl('autoPromote').parent
    expect(flat(holder?.props.style).pointerEvents).toBe('none')
  })

  it('each threshold track changes independently; other fields survive', async () => {
    const base = defaultProgress()
    const h = await mount(fakeDeps(base))
    await fireEvent.press(
      screen.getByTestId(
        'parent-settings-segmented-masteryThreshold-math-95-3',
      ),
    )
    await fireEvent.press(
      screen.getByTestId('parent-settings-segmented-sessionModePicker-on'),
    )
    expect(h.saved).toHaveLength(2)
    const last = h.saved[1]!
    expect(last.parentSettings?.masteryThreshold).toEqual({
      math: { percent: 0.95, sessions: 3 },
      'word-song': DEFAULT_PARENT_SETTINGS.masteryThreshold['word-song'],
    })
    expect(last.parentSettings?.sessionModePicker).toBe('on')
    expect(last.history).toEqual(base.history)
    expect(last.skillLevels).toEqual(base.skillLevels)
    expect(
      selected('parent-settings-segmented-masteryThreshold-math-95-3'),
    ).toBe(true)
  })
})

describe('pending-promotion banner', () => {
  function withPending(autoPromote: boolean): Progress {
    const base = defaultProgress()
    return {
      ...base,
      pendingPromotion: 'add-to-10',
      parentSettings: { ...DEFAULT_PARENT_SETTINGS, autoPromote },
      skillLevels: { ...base.skillLevels, 'add-to-10': 'practicing' },
    }
  }

  it('hidden when auto-promote is on', async () => {
    await mount(fakeDeps(withPending(true)))
    expect(screen.queryByTestId('parent-settings-pending-promotion')).toBeNull()
  })

  it('shows the skill; Confirm masters it, saves once, and hides the banner', async () => {
    const h = await mount(fakeDeps(withPending(false)))
    expect(
      screen.getByTestId('parent-settings-pending-promotion-label').props
        .children,
    ).toBe('add to 10')
    await fireEvent.press(
      screen.getByTestId('parent-settings-confirm-promotion'),
    )
    expect(h.saved).toHaveLength(1)
    expect(h.saved[0]!.skillLevels['add-to-10']).toBe('mastered')
    expect(h.saved[0]!.pendingPromotion).toBeUndefined()
    expect(h.saved[0]!.parentSettings?.autoPromote).toBe(false)
    expect(screen.queryByTestId('parent-settings-pending-promotion')).toBeNull()
  })
})

describe('entry and exit', () => {
  it('releases the iOS audio session once on mount', async () => {
    const h = await mount()
    expect(h.releaseAudio).toHaveBeenCalledTimes(1)
  })

  it('Done closes the keyboard, then exits once (a double tap exits once)', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss')
    const h = await mount()
    await fireEvent.press(screen.getByTestId('parent-settings-done'))
    await fireEvent.press(screen.getByTestId('parent-settings-done'))
    expect(h.onExit).toHaveBeenCalledTimes(1)
    expect(dismiss.mock.invocationCallOrder[0]).toBeLessThan(
      h.onExit.mock.invocationCallOrder[0]!,
    )
    dismiss.mockRestore()
  })

  it('Android back = Done, and is consumed', async () => {
    const add = jest.spyOn(BackHandler, 'addEventListener')
    const h = await mount()
    const handler = add.mock.calls.at(-1)![1] as () => boolean
    expect(handler()).toBe(true)
    expect(h.onExit).toHaveBeenCalledTimes(1)
    add.mockRestore()
  })
})

describe('forms', () => {
  it('compact (phone portrait): segmented controls under their text at full width', async () => {
    expect(PHONE.compact).toBe(true)
    await mount(fakeDeps(), PHONE)
    const row = screen.getByTestId('parent-settings-row-masteryThreshold-math')
    expect(flat(row.props.style).flexDirection).toBeUndefined()
    const seg = screen.getByTestId(
      'parent-settings-segmented-masteryThreshold-math-88-3',
    )
    expect(flat(seg.props.style).flex).toBe(1)
  })

  it('wide (tablet): controls inline on the right, 80 pt threshold segments', async () => {
    expect(TABLET.compact).toBe(false)
    await mount(fakeDeps(), TABLET)
    const row = screen.getByTestId('parent-settings-row-masteryThreshold-math')
    expect(flat(row.props.style).flexDirection).toBe('row')
    const seg = screen.getByTestId(
      'parent-settings-segmented-masteryThreshold-math-88-3',
    )
    expect(flat(seg.props.style)).toMatchObject({ minWidth: 80, height: 44 })
  })

  it('every button and segment is at least 44 pt tall', async () => {
    await mount()
    for (const b of screen.getAllByRole('button')) {
      expect(flat(b.props.style).minHeight).toBeGreaterThanOrEqual(44)
    }
    for (const s of screen.getAllByRole('radio')) {
      expect(flat(s.props.style).height).toBe(44)
    }
  })
})
