/**
 * Web ↔ native parity (design/native/hub-native.md, acceptance: "for the
 * same Progress doc and day, the native Hub picks the same lines,
 * suggested card and flower-slot states as the web Hub"). The native Hub
 * mounts from `planHubVisit` (`@marian/core/hub/hubVisit`); this renders
 * the web Hub on the same doc, history, wake record and clock and reads
 * back what it shows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import {
  defaultProgress,
  type Progress,
  type SessionHistoryEntry,
  type SkillLevels,
  type SkillNode,
} from '@marian/core/progress'
import {
  SESSION_HISTORY_KEY,
  emptySessionHistory,
  type SessionHistoryV2,
} from '@marian/core/sessionEnd/sessionHistory'
import type { StorageAdapter } from '@marian/core/math/stardust'
import {
  FLOWER_WAKE_STORAGE_KEY,
  type FlowerWakeRecord,
} from '@marian/core/hub/hubGuidance'
import { planHubVisit } from '@marian/core/hub/hubVisit'
import Hub from './Hub'

const NOW = new Date(2026, 4, 10, 15, 0)

function entry(d: number, node: SkillNode): SessionHistoryEntry {
  return {
    dateISO: new Date(2026, 4, d, 12).toISOString(),
    skillFocus: [node],
    successRate: 1,
  }
}

function doc(history: SessionHistoryEntry[]): Progress {
  const p = defaultProgress()
  const allLocked = Object.fromEntries(
    Object.keys(p.skillLevels).map((k) => [k, 'locked']),
  ) as SkillLevels
  return {
    ...p,
    skillLevels: {
      ...allLocked,
      'number-recog': 'practicing',
      'letter-names': 'practicing',
    },
    history,
  }
}

interface Case {
  name: string
  history: SessionHistoryEntry[]
  seenWake?: FlowerWakeRecord
  lastSuggestion?: SessionHistoryV2['lastSuggestion']
}

const CASES: Case[] = [
  { name: 'a · fresh', history: [] },
  { name: 'a · tie after Word Song', history: [], lastSuggestion: 'word-song' },
  { name: 'c · one sleeping', history: [entry(10, 'number-recog')] },
  {
    name: 'd · both sleeping',
    history: [entry(10, 'number-recog'), entry(10, 'letter-names')],
  },
  {
    name: 'a2 · both wake',
    history: [entry(9, 'number-recog'), entry(9, 'letter-names')],
  },
  {
    name: 'a2 · one more flower',
    history: [entry(8, 'number-recog'), entry(9, 'number-recog')],
  },
  {
    name: 'already awake',
    history: [entry(9, 'number-recog')],
    seenWake: { math: '2026-05-09' },
  },
]

function memory(): StorageAdapter {
  const store = new Map<string, string>()
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v)
    },
  }
}

beforeEach(() => {
  window.sessionStorage.clear()
  window.localStorage.clear()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('web Hub = planHubVisit', () => {
  it.each(CASES)('$name', (c) => {
    const progress = doc(c.history)
    const history: SessionHistoryV2 = {
      ...emptySessionHistory(),
      lastSuggestion: c.lastSuggestion ?? null,
    }
    const storage = memory()
    storage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history))
    if (c.seenWake) {
      storage.setItem(FLOWER_WAKE_STORAGE_KEY, JSON.stringify(c.seenWake))
    }
    const native = planHubVisit({
      progress,
      history,
      now: NOW,
      seenWake: c.seenWake ?? {},
      suppressed: false,
    })

    render(
      <LazyMotion features={domAnimation}>
        <MotionConfig reducedMotion="always">
          <Hub
            storage={storage}
            progressDoc={progress}
            now={() => new Date(NOW)}
            playLineFn={() => new Promise<void>(() => {})}
            cancelLineFn={() => {}}
          />
        </MotionConfig>
      </LazyMotion>,
    )

    const hub = screen.getByTestId('hub')
    expect(hub.getAttribute('data-suggestion')).toBe(
      native.suggestion ?? 'none',
    )
    expect(hub.getAttribute('data-lines')).toBe(native.lines.join(' '))
    const trays = screen.getAllByTestId('hub-card-seeds')
    const cards = [native.numberGarden, native.wordSong]
    const wakes = [
      native.wake.wakeSlots.math,
      native.wake.wakeSlots['word-song'],
    ]
    trays.forEach((tray, i) => {
      const holes = Array.from(
        tray.querySelectorAll('[data-testid="hub-card-seed"]'),
      )
      expect(holes.map((h) => h.getAttribute('data-state'))).toEqual(
        cards[i]!.slots,
      )
      expect(
        holes.flatMap((h, j) =>
          h.getAttribute('data-waking') === 'true' ? [j] : [],
        ),
      ).toEqual(wakes[i] ?? [])
    })
  })
})
