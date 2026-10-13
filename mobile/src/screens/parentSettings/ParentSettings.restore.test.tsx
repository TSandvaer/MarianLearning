/**
 * Native Parent Settings: Restore from device ID and the keyboard
 * (`design/native/parent-settings-native.md` § 4): invalid and own-ID
 * caught inline, one system alert, the read-first restore with the
 * screen's lifetime signal, and scroll-into-view above the keyboard.
 */
import {
  DEFAULT_PARENT_SETTINGS,
  defaultProgress,
  type Progress,
  type ReconcileOutcome,
} from '@marian/core/progress'
import { act, fireEvent, screen } from '@testing-library/react-native'
import {
  Alert,
  Keyboard,
  ScrollView,
  type AlertButton,
  type KeyboardEvent,
} from 'react-native'
import {
  advance,
  deferred,
  DEVICE_ID,
  fakeDeps,
  flat,
  flushPromises,
  mount,
  OTHER_ID,
  PHONE,
} from '../../../test/parentSettingsHarness'
import { formatLastSynced } from './nativeCopy'

const INPUT = 'parent-settings-cloud-restore-input'
const SUBMIT = 'parent-settings-cloud-restore-submit'
const STATUS = 'parent-settings-cloud-restore-status'
const LAST_SYNCED = 'parent-settings-cloud-last-synced'
const SYNCED_AT = '2026-10-13T09:41:00.000Z'

let alert: jest.SpyInstance

beforeEach(() => {
  jest.useFakeTimers()
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})
afterEach(() => {
  alert.mockRestore()
  jest.useRealTimers()
})

async function typeAndRestore(text: string): Promise<void> {
  await fireEvent.changeText(screen.getByTestId(INPUT), text)
  await fireEvent.press(screen.getByTestId(SUBMIT))
}

/** Presses the alert's button labelled `label`. */
async function answerAlert(label: string): Promise<void> {
  const buttons = alert.mock.calls.at(-1)![2] as AlertButton[]
  await act(async () => {
    buttons.find((b) => b.text === label)!.onPress?.()
  })
  await flushPromises()
}

describe('caught inline', () => {
  it('an invalid ID: the web line, an amber field, no alert; editing clears it', async () => {
    const h = await mount()
    await typeAndRestore('abc')
    expect(screen.getByTestId(STATUS).props.children).toBe(
      "That doesn't look like a device ID. Expected: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.",
    )
    expect(flat(screen.getByTestId(INPUT).props.style).borderColor).toBe(
      '#B45309',
    )
    expect(alert).not.toHaveBeenCalled()
    expect(h.mocks.restoreFromDeviceId).not.toHaveBeenCalled()
    await fireEvent.changeText(screen.getByTestId(INPUT), 'abcd')
    expect(screen.queryByTestId(STATUS)).toBeNull()
  })

  it("this device's own ID (any case): an inline line, no alert, no write", async () => {
    const h = await mount()
    await typeAndRestore(`  ${DEVICE_ID.toUpperCase()} `)
    expect(screen.getByTestId(STATUS).props.children).toBe(
      "That's this device's own ID.",
    )
    expect(alert).not.toHaveBeenCalled()
    expect(h.mocks.restoreFromDeviceId).not.toHaveBeenCalled()
  })

  it('the field is a code field: no autocorrect, no capitals, no suggestions, unscaled', async () => {
    await mount()
    expect(screen.getByTestId(INPUT).props).toMatchObject({
      autoCapitalize: 'none',
      autoCorrect: false,
      spellCheck: false,
      autoComplete: 'off',
      textContentType: 'none',
      importantForAutofill: 'no',
      keyboardType: 'ascii-capable',
      returnKeyType: 'go',
      allowFontScaling: false,
      placeholder: 'paste UUID here',
    })
  })
})

describe('confirmed restore', () => {
  it('asks once in a system alert, after closing the keyboard; Cancel changes nothing', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss')
    const h = await mount()
    await typeAndRestore(OTHER_ID)
    expect(dismiss).toHaveBeenCalled()
    expect(alert).toHaveBeenCalledTimes(1)
    const [title, message] = alert.mock.calls[0]!
    expect(title).toBe('Restore from that device?')
    expect(message).toBe(
      'This device will use that ID from now on. The newer progress of the two devices is kept, and the older one is replaced.',
    )
    await answerAlert('Cancel')
    expect(h.mocks.restoreFromDeviceId).not.toHaveBeenCalled()
    expect(screen.getByTestId(INPUT).props.value).toBe(OTHER_ID)
    dismiss.mockRestore()
  })

  it('Restore: "Restoring…", then the outcome, the adopted ID and the refreshed settings', async () => {
    const fake = fakeDeps()
    const done = deferred<ReconcileOutcome>()
    fake.mocks.restoreFromDeviceId.mockReturnValueOnce(done.promise)
    await mount(fake)
    await typeAndRestore(OTHER_ID)
    await answerAlert('Restore')
    const [uuid, signal] = fake.mocks.restoreFromDeviceId.mock.calls[0]!
    expect(uuid).toBe(OTHER_ID)
    expect(signal.aborted).toBe(false)
    expect(screen.getByText('Restoring…')).toBeOnTheScreen()
    expect(screen.getByTestId(SUBMIT).props.accessibilityState).toMatchObject({
      disabled: true,
    })

    const installed: Progress = {
      ...defaultProgress(),
      parentSettings: { ...DEFAULT_PARENT_SETTINGS, showLevelToMarian: false },
    }
    fake.mocks.getDeviceId.mockReturnValue(OTHER_ID)
    done.resolve({ kind: 'installed-from-cloud', progress: installed })
    await flushPromises()
    expect(screen.getByTestId(STATUS).props.children).toBe(
      "Restored Marian's progress from that device.",
    )
    expect(
      screen.getByTestId('parent-settings-cloud-device-id').props.children,
    ).toBe(OTHER_ID)
    expect(
      screen.getByTestId('parent-settings-switch-showLevelToMarian', {
        includeHiddenElements: true,
      }).props.value,
    ).toBe(false)
  })

  it('the keyboard Go key submits like the button', async () => {
    await mount()
    await fireEvent.changeText(screen.getByTestId(INPUT), OTHER_ID)
    await fireEvent(screen.getByTestId(INPUT), 'submitEditing')
    expect(alert).toHaveBeenCalledTimes(1)
  })

  it('a rejected restore shows its reason', async () => {
    const fake = fakeDeps()
    fake.mocks.restoreFromDeviceId.mockRejectedValueOnce(new Error('boom'))
    await mount(fake)
    await typeAndRestore(OTHER_ID)
    await answerAlert('Restore')
    expect(screen.getByTestId(STATUS).props.children).toBe(
      'Restore failed (boom).',
    )
  })

  it('a restore that synced shows the new Last synced at once', async () => {
    const fake = fakeDeps()
    fake.mocks.restoreFromDeviceId.mockImplementationOnce(async () => {
      // What core's sync listener records during the restore's read.
      fake.setLastSync(SYNCED_AT)
      return { kind: 'installed-from-cloud', progress: defaultProgress() }
    })
    await mount(fake)
    expect(screen.getByTestId(LAST_SYNCED).props.children).toBe('Never')
    await typeAndRestore(OTHER_ID)
    await answerAlert('Restore')
    expect(screen.getByTestId(LAST_SYNCED).props.children).toBe(
      formatLastSynced(SYNCED_AT, 'Never'),
    )
    expect(fake.mocks.readLastSync).toHaveBeenCalledTimes(2)
  })

  it('leaving mid-restore aborts the request; its late result is ignored', async () => {
    const fake = fakeDeps()
    const done = deferred<ReconcileOutcome>()
    fake.mocks.restoreFromDeviceId.mockReturnValueOnce(done.promise)
    const h = await mount(fake)
    await typeAndRestore(OTHER_ID)
    await answerAlert('Restore')
    const signal = fake.mocks.restoreFromDeviceId.mock.calls[0]![1]
    await h.unmount()
    expect(signal.aborted).toBe(true)
    done.resolve({ kind: 'cloud-error', reason: 'timeout' })
    await flushPromises()
    expect(fake.mocks.getDeviceId).toHaveBeenCalledTimes(1)
  })
})

describe('keyboard', () => {
  it('pads the content by the keyboard and scrolls the restore block above it', async () => {
    const handlers = new Map<string, (e: KeyboardEvent) => void>()
    const add = jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((event, fn) => {
        handlers.set(event, fn as (e: KeyboardEvent) => void)
        return { remove: jest.fn() } as never
      })
    const scrollTo = ScrollView.prototype.scrollTo as unknown as jest.Mock
    scrollTo.mockClear()
    await mount()
    const layout = (id: string, y: number, height = 10) =>
      fireEvent(screen.getByTestId(id), 'layout', {
        nativeEvent: { layout: { x: 0, y, width: 300, height } },
      })
    await layout('parent-settings-column', 20)
    await layout('parent-settings-cloud-wrap', 900)
    await layout('parent-settings-cloud-blocks', 80)
    await layout('parent-settings-cloud-restore', 160, 84)
    await fireEvent(screen.getByTestId(INPUT), 'focus')

    // A 300 pt keyboard on the 375×667 phone: its top at y 367.
    await act(async () => {
      handlers.get('keyboardWillShow')!({
        endCoordinates: { height: 300, screenY: 367, screenX: 0, width: 375 },
      } as KeyboardEvent)
    })
    await advance(16)
    const padding = () =>
      flat(
        screen.getByTestId('parent-settings-scroll').props
          .contentContainerStyle,
      ).paddingBottom
    expect(padding()).toBe(PHONE.contentPadBottom + 300)
    // Block bottom 20 + 900 + (80 + 160 + 84) = 1244; visible down to
    // 367 − 56 (header) − 16 = 295 below the header.
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 949, animated: true })

    await act(async () => {
      handlers.get('keyboardWillHide')!({
        endCoordinates: { height: 0, screenY: 667, screenX: 0, width: 375 },
      } as KeyboardEvent)
    })
    await advance(16)
    expect(padding()).toBe(PHONE.contentPadBottom)
    add.mockRestore()
  })

  it('taps reach the controls while the keyboard is up', async () => {
    await mount()
    expect(screen.getByTestId('parent-settings-scroll').props).toMatchObject({
      keyboardShouldPersistTaps: 'handled',
      keyboardDismissMode: 'interactive',
      contentInsetAdjustmentBehavior: 'never',
    })
  })
})
