/**
 * Screen — Parent Settings (M2.5 — ticket 86c9kpjc7).
 *
 * Hidden parent-only surface reached via the 3-second long-press on
 * Hub character art. Renders one row per setting with a control:
 *  - autoPromote: toggle
 *  - sessionModePicker: two-way segmented (off | on)
 *  - masteryThreshold: TWO three-way segmented controls — one for
 *    math (default 95/3), one for word-song (default 90/3). Presets:
 *    80/2 | 90/3 | 95/3 (ticket 86c9kwvy0).
 *  - crossDayEnforcement: toggle
 *  - showLevelToMarian: toggle
 *
 * Save-on-change (no explicit save button) — every control writes the
 * updated Progress through `saveProgress()` immediately. The "Done"
 * button at the top calls back to the orchestrator to leave the
 * screen; no save is required at exit.
 *
 * Visual contract
 * ---------------
 * Plain, parent-styled. Slate text on white, system font, no Marian-
 * themed art. The point is "this is obviously not a Marian screen" so
 * there's no chance Marian thinks she opened a hidden game-mode.
 *
 * No setting is consumed yet — wiring lands in M3 (mastery), M4
 * (Leitner / session mode), M5 (level visibility). This screen only
 * persists the values.
 */

import { useCallback, useMemo, useState, type ReactElement } from 'react'
import {
  DEFAULT_PARENT_SETTINGS,
  MASTERY_THRESHOLD_PRESETS,
  applyMasteryRule,
  defaultProgress,
  getSettings,
  loadProgress,
  saveProgress,
  type MasteryThreshold,
  type MasteryTrackKey,
  type ParentSettings,
  type Progress,
  type SessionModePicker,
} from '../../lib/progress'
import { labelForSkillNode } from '../Hub/progressProjection'

// ── Public types ────────────────────────────────────────────────────────

export interface ParentSettingsProps {
  /** Fires when the parent taps "Done" — orchestrator routes back to Hub. */
  onExit?: () => void
  /**
   * Test seam: replace the storage read/write pair so tests don't
   * touch real localStorage. The default uses the project's
   * `loadProgress()` / `saveProgress()` from `lib/progress`.
   */
  storage?: ParentSettingsStorage
}

export interface ParentSettingsStorage {
  load: () => Progress | null
  save: (p: Progress) => void
}

/**
 * Sparse patch shape for the local `update()` callback. `Partial<>`
 * widens every top-level field to optional, AND widens the nested
 * `masteryThreshold` so a single-track update doesn't have to supply
 * both tracks. The merge in `update()` fills the missing track from
 * the current value.
 */
type ParentSettingsPatch = Partial<Omit<ParentSettings, 'masteryThreshold'>> & {
  masteryThreshold?: Partial<ParentSettings['masteryThreshold']>
}

const DEFAULT_STORAGE: ParentSettingsStorage = {
  load: loadProgress,
  save: saveProgress,
}

// ── Component ────────────────────────────────────────────────────────────

export default function ParentSettings({
  onExit,
  storage = DEFAULT_STORAGE,
}: ParentSettingsProps): ReactElement {
  /**
   * Read once on mount. The screen owns the in-memory copy; every
   * control update writes through to localStorage immediately AND
   * updates this state so the rendered controls stay in sync without
   * a re-mount.
   *
   * If no document exists yet (first run / private mode), seed with
   * a fresh defaultProgress() so saves still work — getSettings()
   * yields the same defaults shown in the UI.
   */
  const [progress, setProgress] = useState<Progress>(() => {
    const loaded = storage.load()
    return loaded ?? defaultProgress()
  })

  const settings: ParentSettings = useMemo(
    () => getSettings(progress),
    [progress],
  )

  /**
   * Apply a settings patch and write through. Always merges OVER the
   * fully-defaulted current settings so a sparse patch doesn't drop
   * keys.
   *
   * `masteryThreshold` is a per-track map (ticket 86c9kwvy0); the
   * patch carries a `Partial<PerTrackMasteryThreshold>` so a control
   * can update one track at a time. Missing tracks are preserved
   * from the current value.
   */
  const update = useCallback(
    (patch: ParentSettingsPatch) => {
      setProgress((prev) => {
        const current = getSettings(prev)
        const next: ParentSettings = {
          ...current,
          ...patch,
          // Nested per-track object — patch may carry one or both
          // tracks. Merge per-key so a single-track patch doesn't drop
          // the other track.
          masteryThreshold: patch.masteryThreshold
            ? { ...current.masteryThreshold, ...patch.masteryThreshold }
            : current.masteryThreshold,
        }
        const updated: Progress = { ...prev, parentSettings: next }
        storage.save(updated)
        return updated
      })
    },
    [storage],
  )

  /**
   * Confirm the queued `pendingPromotion` (M3 audit follow-up, ticket
   * 86c9kwnkw). Applies the promotion via `applyMasteryRule()` against a
   * temporarily-`autoPromote=true` view of the document — the rule's
   * "auto-promote re-entry" branch picks up the queued node, marks it
   * `'mastered'`, unlocks the downstream node, and clears the field.
   *
   * After the apply, we restore the parent's actual `autoPromote`
   * preference. Side effect: any FRESH promotion that the rule would
   * have queued in the same call is also applied (unlikely — it requires
   * a second node to qualify on the current history). That's acceptable;
   * the alternative (carrying the parent's autoPromote=false and
   * synthesising a single-node mutation) duplicates the rule's logic.
   */
  const handleConfirmPromotion = useCallback(() => {
    setProgress((prev) => {
      if (prev.pendingPromotion === undefined) return prev
      const trueAutoPromote: Progress = {
        ...prev,
        parentSettings: {
          ...getSettings(prev),
          autoPromote: true,
        },
      }
      const promoted = applyMasteryRule(trueAutoPromote)
      // Restore the parent's actual autoPromote setting in the persisted
      // shape — they didn't ask to flip the toggle, just to confirm one
      // queued promotion.
      const restored: Progress = {
        ...promoted,
        parentSettings: {
          ...getSettings(promoted),
          autoPromote: getSettings(prev).autoPromote,
        },
      }
      storage.save(restored)
      return restored
    })
  }, [storage])

  return (
    <main
      data-testid="parent-settings"
      className="
        min-h-full w-full
        bg-slate-50 text-slate-900
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
        font-body
      "
    >
      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Header — deliberately drab. No Emma, no pastel. */}
        <header className="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Parent settings
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Changes save automatically.
            </p>
          </div>
          <button
            type="button"
            data-testid="parent-settings-done"
            onClick={onExit}
            className="
              rounded-md border border-slate-300 bg-white px-4 py-2
              text-sm font-medium text-slate-700
              hover:bg-slate-100
              focus:outline-none focus:ring-2 focus:ring-slate-400
            "
          >
            Done
          </button>
        </header>

        {/* Pending-promotion banner (M3 audit follow-up, ticket 86c9kwnkw).
            Surfaced ONLY when auto-promote is off AND the engine has queued
            a node. When auto-promote is on the engine applies promotions
            silently and `pendingPromotion` is never written, so this banner
            stays hidden in the default flow. */}
        {progress.pendingPromotion !== undefined && !settings.autoPromote && (
          <section
            data-testid="parent-settings-pending-promotion"
            data-node={progress.pendingPromotion}
            className="
              mb-6 rounded-md border border-emerald-300 bg-emerald-50 p-4
            "
          >
            <h2 className="text-base font-semibold text-emerald-900">
              Promotion ready to confirm
            </h2>
            <p className="mt-1 text-sm text-emerald-900/80">
              Marian has met the mastery threshold for{' '}
              <span
                data-testid="parent-settings-pending-promotion-label"
                className="font-medium"
              >
                {labelForSkillNode(progress.pendingPromotion)}
              </span>
              . Confirm to advance her to the next skill.
            </p>
            <button
              type="button"
              data-testid="parent-settings-confirm-promotion"
              onClick={handleConfirmPromotion}
              className="
                mt-3 rounded-md border border-emerald-700 bg-emerald-700
                px-4 py-2 text-sm font-medium text-white
                hover:bg-emerald-800
                focus:outline-none focus:ring-2 focus:ring-emerald-500
              "
            >
              Confirm promotion
            </button>
          </section>
        )}

        <div
          data-testid="parent-settings-rows"
          className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white"
        >
          <ToggleRow
            id="autoPromote"
            label="Auto-promote on mastery"
            description="Advance Marian to the next skill once she meets the mastery threshold."
            value={settings.autoPromote}
            onChange={(v) => update({ autoPromote: v })}
          />

          <SegmentedRow
            id="sessionModePicker"
            label="Session-mode picker"
            description="Off: the engine picks the session shape. On: Marian sees a review / focus / mixed choice on the Hub."
            value={settings.sessionModePicker}
            options={SESSION_MODE_OPTIONS}
            onChange={(v) => update({ sessionModePicker: v })}
          />

          <MasteryThresholdRow
            track="math"
            value={settings.masteryThreshold.math}
            onChange={(v) => update({ masteryThreshold: { math: v } })}
          />

          <MasteryThresholdRow
            track="word-song"
            value={settings.masteryThreshold['word-song']}
            onChange={(v) => update({ masteryThreshold: { 'word-song': v } })}
          />

          <ToggleRow
            id="crossDayEnforcement"
            label="Require fresh-day mastery"
            description="Hold off promotion that would happen mid-session — wait for a new day."
            value={settings.crossDayEnforcement}
            onChange={(v) => update({ crossDayEnforcement: v })}
          />

          <ToggleRow
            id="showLevelToMarian"
            label="Show level to Marian"
            description="Surface her current curriculum level on the Hub. Off by default."
            value={settings.showLevelToMarian}
            onChange={(v) => update({ showLevelToMarian: v })}
          />
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Defaults: auto-promote on, fresh-day mastery on, math threshold 95% /
          3 sessions, word-song threshold 90% / 3 sessions, level hidden, mode
          picker off.
        </p>
      </div>
    </main>
  )
}

// ── Row components ──────────────────────────────────────────────────────

interface RowFrameProps {
  id: string
  label: string
  description: string
  control: ReactElement
}

function RowFrame({
  id,
  label,
  description,
  control,
}: RowFrameProps): ReactElement {
  return (
    <div
      data-testid="parent-settings-row"
      data-row-id={id}
      className="flex items-start justify-between gap-6 px-5 py-4"
    >
      <div className="min-w-0 flex-1">
        <label
          htmlFor={`parent-settings-${id}`}
          className="block text-base font-medium text-slate-800"
        >
          {label}
        </label>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex shrink-0 items-center">{control}</div>
    </div>
  )
}

interface ToggleRowProps {
  id: string
  label: string
  description: string
  value: boolean
  onChange: (next: boolean) => void
}

function ToggleRow({
  id,
  label,
  description,
  value,
  onChange,
}: ToggleRowProps): ReactElement {
  return (
    <RowFrame
      id={id}
      label={label}
      description={description}
      control={
        <button
          type="button"
          role="switch"
          id={`parent-settings-${id}`}
          data-testid={`parent-settings-toggle-${id}`}
          data-value={value ? 'on' : 'off'}
          aria-checked={value}
          onClick={() => onChange(!value)}
          className={[
            'relative inline-flex h-7 w-12 items-center rounded-full transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-slate-400',
            value ? 'bg-slate-700' : 'bg-slate-300',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
              value ? 'translate-x-6' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
      }
    />
  )
}

interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedRowProps<T extends string> {
  id: string
  label: string
  description: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (next: T) => void
}

function SegmentedRow<T extends string>({
  id,
  label,
  description,
  value,
  options,
  onChange,
}: SegmentedRowProps<T>): ReactElement {
  return (
    <RowFrame
      id={id}
      label={label}
      description={description}
      control={
        <div
          role="radiogroup"
          aria-label={label}
          data-testid={`parent-settings-segmented-${id}`}
          className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white"
        >
          {options.map((opt) => {
            const selected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`parent-settings-segmented-${id}-${opt.value}`}
                data-selected={selected ? 'true' : 'false'}
                onClick={() => onChange(opt.value)}
                className={[
                  'px-3 py-1.5 text-sm font-medium',
                  'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-inset',
                  selected
                    ? 'bg-slate-700 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-100',
                ].join(' ')}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      }
    />
  )
}

const SESSION_MODE_OPTIONS: readonly SegmentedOption<SessionModePicker>[] = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
]

// ── Mastery threshold row ───────────────────────────────────────────────

interface MasteryThresholdRowProps {
  track: MasteryTrackKey
  value: MasteryThreshold
  onChange: (next: MasteryThreshold) => void
}

const TRACK_LABELS: Record<MasteryTrackKey, { label: string; rowId: string }> =
  {
    math: { label: 'Math threshold', rowId: 'masteryThreshold-math' },
    'word-song': {
      label: 'Word Song threshold',
      rowId: 'masteryThreshold-word-song',
    },
  }

function MasteryThresholdRow({
  track,
  value,
  onChange,
}: MasteryThresholdRowProps): ReactElement {
  /**
   * Match the current value to a preset by exact equality. If somehow
   * none match (a future schema-shape that didn't propagate to the UI),
   * fall back to the per-track default for THIS track so the control
   * still has SOMETHING selected — matches the Thomas-locked default.
   */
  const presetIndex = useMemo(() => {
    const idx = MASTERY_THRESHOLD_PRESETS.findIndex(
      (p) => p.percent === value.percent && p.sessions === value.sessions,
    )
    if (idx !== -1) return idx
    const fallback = DEFAULT_PARENT_SETTINGS.masteryThreshold[track]
    return MASTERY_THRESHOLD_PRESETS.findIndex(
      (p) => p.percent === fallback.percent && p.sessions === fallback.sessions,
    )
  }, [value, track])

  const { label, rowId } = TRACK_LABELS[track]

  return (
    <RowFrame
      id={rowId}
      label={label}
      description="How many in-a-row sessions Marian needs at this success rate before a skill counts as mastered."
      control={
        <div
          role="radiogroup"
          aria-label={label}
          data-testid={`parent-settings-segmented-${rowId}`}
          data-track={track}
          data-percent={value.percent}
          data-sessions={value.sessions}
          className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white"
        >
          {MASTERY_THRESHOLD_PRESETS.map((preset, i) => {
            const selected = i === presetIndex
            const presetId = `${Math.round(preset.percent * 100)}-${preset.sessions}`
            return (
              <button
                key={presetId}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`parent-settings-segmented-${rowId}-${presetId}`}
                data-selected={selected ? 'true' : 'false'}
                data-percent={preset.percent}
                data-sessions={preset.sessions}
                onClick={() => onChange({ ...preset })}
                className={[
                  'px-3 py-1.5 text-sm font-medium',
                  'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-inset',
                  selected
                    ? 'bg-slate-700 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-100',
                ].join(' ')}
              >
                {Math.round(preset.percent * 100)}% / {preset.sessions}
              </button>
            )
          })}
        </div>
      }
    />
  )
}
