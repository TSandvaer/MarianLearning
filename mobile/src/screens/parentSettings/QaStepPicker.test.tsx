/**
 * The debug-only QA step picker: its row at the bottom of Parent Settings
 * (absent without `onQaJump`, i.e. without the debug flag), the list of
 * both worlds in tree order, the confirm alert, and the two writes.
 * The writes themselves (progressAtStep, today's history, the device ID)
 * are core's (`stepProgress.test.ts`); App.test.tsx runs them end to end.
 */
import { QA_STEPS } from '@marian/core/debug/stepProgress'
import { LITERACY_TREE, MATH_TREE, type SkillNode } from '@marian/core/progress'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { Alert, BackHandler, type AlertButton } from 'react-native'
import { fakeDeps, mount, PHONE } from '../../../test/parentSettingsHarness'
import { QA_STEP_COPY } from './qaStepCopy'
import { QaStepPicker } from './QaStepPicker'

const STEP_ID = /^qa-step-(?!picker|world|current|real)(.+)$/

function listed(world?: 'math' | 'word-song'): string[] {
  const scope = world
    ? within(screen.getByTestId(`qa-step-world-${world}`))
    : screen
  return scope
    .getAllByTestId(STEP_ID)
    .map((el) => String(el.props.testID).replace(STEP_ID, '$1'))
}

/** The buttons of the one alert shown since `alert` was spied. */
function alertButtons(alert: jest.SpyInstance): AlertButton[] {
  expect(alert).toHaveBeenCalledTimes(1)
  return alert.mock.calls[0]![2] as AlertButton[]
}

function press(buttons: AlertButton[], text: string): void {
  const button = buttons.find((b) => b.text === text)
  expect(button).toBeDefined()
  button!.onPress?.()
}

async function renderPicker() {
  const jump = jest.fn<void, [SkillNode]>()
  const reset = jest.fn<void, []>()
  const onJumped = jest.fn()
  const onClose = jest.fn()
  await render(
    <QaStepPicker
      layout={PHONE}
      current={{ math: 'add-to-10', 'word-song': 'letter-sounds' }}
      onClose={onClose}
      onJumped={onJumped}
      jump={jump}
      resetToRealStart={reset}
    />,
  )
  return { jump, reset, onJumped, onClose }
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('the picker', () => {
  it('lists both worlds in tree order: 14 Number Garden steps, then 20 Word Song steps', async () => {
    await renderPicker()
    expect(listed('math')).toEqual([...MATH_TREE])
    expect(listed('word-song')).toEqual([...LITERACY_TREE])
    expect(listed()).toHaveLength(34)
    expect(screen.getByText('11. Big groups')).toBeOnTheScreen()
    expect(screen.getByText('12. All the groups')).toBeOnTheScreen()
    // Content wave 2 § 1: sharing, the 5th stop of land 4.
    expect(screen.getByText('13. Sharing')).toBeOnTheScreen()
    expect(screen.getByText('Land 4 · div-share')).toBeOnTheScreen()
    // Content wave 3 § 1: hundreds, land 5's one stop.
    expect(screen.getByText('14. Hundreds')).toBeOnTheScreen()
    expect(screen.getByText('Land 5 · hundreds')).toBeOnTheScreen()
    expect(screen.getByText('13. Reading sentences')).toBeOnTheScreen()
    expect(screen.getByText('14. Duck words')).toBeOnTheScreen()
    expect(screen.getByText('15. Crab words')).toBeOnTheScreen()
    expect(screen.getByText('Land 6 · crab-words')).toBeOnTheScreen()
    expect(screen.getByText('16. Tent words')).toBeOnTheScreen()
    expect(screen.getByText('17. Cake words')).toBeOnTheScreen()
    expect(screen.getByText('Land 6 · cake-words')).toBeOnTheScreen()
    expect(screen.getByText('Land 3 · cvc-words-short-o')).toBeOnTheScreen()
  })

  it('marks each world’s current step, once', async () => {
    await renderPicker()
    expect(
      within(screen.getByTestId('qa-step-add-to-10')).getByTestId(
        'qa-step-current-math',
      ),
    ).toBeOnTheScreen()
    expect(
      within(screen.getByTestId('qa-step-letter-sounds')).getByTestId(
        'qa-step-current-word-song',
      ),
    ).toBeOnTheScreen()
    expect(screen.getAllByText(QA_STEP_COPY.current)).toHaveLength(2)
  })

  it('a tap asks first (with the cloud line); Cancel writes nothing', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const h = await renderPicker()
    await fireEvent.press(screen.getByTestId('qa-step-mult-6-9'))
    expect(alert.mock.calls[0]![0]).toBe('Jump to Big groups?')
    expect(alert.mock.calls[0]![1]).toBe(
      "Number Garden, step 11 (mult-6-9). Replaces this device's progress and clears today's history. The device ID stays.\nWith cloud backup on, it syncs like any progress.",
    )
    press(alertButtons(alert), QA_STEP_COPY.cancel)
    expect(h.jump).not.toHaveBeenCalled()
    expect(h.onJumped).not.toHaveBeenCalled()
  })

  it('Jump writes that step once, then hands over once', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const h = await renderPicker()
    await fireEvent.press(screen.getByTestId('qa-step-simple-sentences'))
    press(alertButtons(alert), QA_STEP_COPY.jump)
    expect(h.jump.mock.calls).toEqual([['simple-sentences']])
    expect(h.onJumped).toHaveBeenCalledTimes(1)
    expect(h.reset).not.toHaveBeenCalled()
  })

  it('every listed step jumps to itself', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const h = await renderPicker()
    for (const { node } of QA_STEPS) {
      alert.mockClear()
      await fireEvent.press(screen.getByTestId(`qa-step-${node}`))
      press(alertButtons(alert), QA_STEP_COPY.jump)
    }
    expect(h.jump.mock.calls.map(([n]) => n)).toEqual(
      QA_STEPS.map((s) => s.node),
    )
    expect(h.onJumped).toHaveBeenCalledTimes(34)
  })

  it("Back to Marian's real start asks, then resets once", async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const h = await renderPicker()
    await fireEvent.press(screen.getByTestId('qa-step-real-start'))
    expect(alert.mock.calls[0]![0]).toBe("Back to Marian's real start?")
    expect(alert.mock.calls[0]![1]).toContain(QA_STEP_COPY.cloud)
    press(alertButtons(alert), QA_STEP_COPY.reset)
    expect(h.reset).toHaveBeenCalledTimes(1)
    expect(h.onJumped).toHaveBeenCalledTimes(1)
    expect(h.jump).not.toHaveBeenCalled()
  })

  it('Close closes', async () => {
    const h = await renderPicker()
    await fireEvent.press(screen.getByTestId('qa-step-picker-close'))
    expect(h.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('in Parent Settings', () => {
  it('release safety: without onQaJump (no debug flag) there is no row and no picker', async () => {
    await mount()
    expect(screen.queryByTestId('parent-settings-qa-step-row')).toBeNull()
    expect(screen.queryByText(QA_STEP_COPY.row)).toBeNull()
    expect(screen.queryByTestId('qa-step-picker')).toBeNull()
  })

  it('with onQaJump: the row is the last section of the column, and opens the picker', async () => {
    const onQaJump = jest.fn()
    const h = await mount(fakeDeps(), PHONE, onQaJump)
    // In tree order: rows, footnote, Backup, Cloud backup, then the QA row.
    const SECTION =
      /^parent-settings-(rows|footnote|backup|cloud-wrap|qa-step-row)$/
    expect(
      within(screen.getByTestId('parent-settings-column'))
        .getAllByTestId(SECTION)
        .map((el) => String(el.props.testID).replace(SECTION, '$1')),
    ).toEqual(['rows', 'footnote', 'backup', 'cloud-wrap', 'qa-step-row'])
    expect(screen.getByText(QA_STEP_COPY.row)).toBeOnTheScreen()
    expect(screen.queryByTestId('qa-step-picker')).toBeNull()

    await fireEvent.press(screen.getByTestId('parent-settings-qa-step-row'))
    expect(screen.getByTestId('qa-step-picker')).toBeOnTheScreen()
    expect(listed()).toHaveLength(34)
    // Opening writes nothing and jumps nowhere.
    expect(h.saved).toEqual([])
    expect(onQaJump).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByTestId('qa-step-picker-close'))
    expect(screen.queryByTestId('qa-step-picker')).toBeNull()
    expect(screen.getByTestId('parent-settings')).toBeOnTheScreen()
  })

  it('Android back closes the picker first, then leaves Parent Settings', async () => {
    const add = jest.spyOn(BackHandler, 'addEventListener')
    const h = await mount(fakeDeps(), PHONE, jest.fn())
    await fireEvent.press(screen.getByTestId('parent-settings-qa-step-row'))
    const handler = add.mock.calls.at(-1)![1] as () => boolean
    let consumed = false
    await act(async () => {
      consumed = handler()
    })
    expect(consumed).toBe(true)
    expect(screen.queryByTestId('qa-step-picker')).toBeNull()
    expect(h.onExit).not.toHaveBeenCalled()
    await act(async () => {
      handler()
    })
    expect(h.onExit).toHaveBeenCalledTimes(1)
  })
})
