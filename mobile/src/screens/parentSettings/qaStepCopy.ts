/**
 * The QA step picker's copy (`./QaStepPicker.tsx`). Developer-facing, not
 * Marian's: Emma's vocabulary cap does not apply.
 */
import type { QaStep } from '@marian/core/debug/stepProgress'

export const QA_STEP_COPY = {
  row: 'QA: jump to a step',
  rowDescription: 'Debug only. Put this device on any step of either world.',
  title: 'QA: jump to a step',
  subtitle: 'Debug only',
  close: 'Close',
  current: 'Current',
  worlds: { math: 'Number Garden', 'word-song': 'Word Song' },
  realStart: "Back to Marian's real start",
  realStartTitle: "Back to Marian's real start?",
  realStartBody:
    "Writes Marian's starting progress on this device and clears today's history. The device ID stays.",
  jumpBody:
    "Replaces this device's progress and clears today's history. The device ID stays.",
  cloud: 'With cloud backup on, it syncs like any progress.',
  cancel: 'Cancel',
  jump: 'Jump',
  reset: 'Reset',
} as const

export function jumpTitle(step: QaStep): string {
  return `Jump to ${step.name}?`
}

export function jumpMessage(step: QaStep): string {
  return `${QA_STEP_COPY.worlds[step.world]}, step ${step.position} (${step.node}). ${QA_STEP_COPY.jumpBody}\n${QA_STEP_COPY.cloud}`
}

export function realStartMessage(): string {
  return `${QA_STEP_COPY.realStartBody}\n${QA_STEP_COPY.cloud}`
}
