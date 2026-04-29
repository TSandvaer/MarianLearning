/**
 * Hub welcome-back + node-tap line manifest.
 *
 * Source-of-truth: `design/screen-hub.md` § "Audio integration contract".
 * 9 anchor lines + 9 rotation variants + 2 node-tap = 20 MP3s total.
 *
 * Voice provenance: same `en-US-EmmaMultilingualNeural` rate `-10%` config
 * Greet uses (re-rendered via `scripts/render-greet-mp3s.mjs` once Kyle
 * authors the line text — ticket `86c9j53yx`).
 *
 * v1 mocking
 * ----------
 * Kyle's asset-queue ticket has not yet shipped the real MP3s. For the v1
 * Hub-implementation PR we ship the MANIFEST (ids, source URLs, line
 * text, word counts) so the line-selection algorithm and tests are
 * complete; the MP3 files themselves are silent placeholders. Hub plays
 * via `playHubLine()` which gracefully falls through to "no audio +
 * caption walked at 165 wpm" if the file 404s — same shape as Math's
 * silent fallback. When Kyle ships the real audio, only the binary
 * files in `public/assets/audio/hub/` change.
 */

import type { SkillTreeId } from '../SessionEnd/sessionHistory'

/** Stable identifiers for every Hub line. */
export type HubLineId =
  // Anchor lines (always pre-rendered)
  | 'hub.welcome.first-again'
  | 'hub.welcome.what-today'
  | 'hub.welcome.try-number-garden'
  | 'hub.welcome.try-word-song'
  | 'hub.welcome.back-soon'
  | 'hub.welcome.pick-again'
  | 'hub.welcome.pick-next'
  // Rotation variants
  | 'hub.welcome.what-today.alt-1'
  | 'hub.welcome.what-today.alt-2'
  | 'hub.welcome.what-today.alt-3'
  | 'hub.welcome.try-number-garden.alt-1'
  | 'hub.welcome.try-number-garden.alt-2'
  | 'hub.welcome.try-word-song.alt-1'
  | 'hub.welcome.try-word-song.alt-2'
  | 'hub.welcome.back-soon.alt-1'
  | 'hub.welcome.back-soon.alt-2'
  // Node-tap "enter" lines
  | 'hub.enter.number-garden'
  | 'hub.enter.word-song'

export interface HubLineManifestEntry {
  /** Asset URL relative to `public/`. */
  src: string
  /** Spoken / displayed text — drives the caption ribbon. */
  text: string
}

/**
 * The line manifest. Source URLs map to mp3 files Kyle will deliver in
 * `public/assets/audio/hub/`. v1 ships silent placeholders; the real
 * audio lands via ticket `86c9j53yx`.
 */
export const HUB_LINES: Record<HubLineId, HubLineManifestEntry> = {
  'hub.welcome.first-again': {
    src: '/assets/audio/hub/hub-welcome-first-again.mp3',
    text: 'Hi again!',
  },
  'hub.welcome.what-today': {
    src: '/assets/audio/hub/hub-welcome-what-today.mp3',
    text: 'Hi! What today?',
  },
  'hub.welcome.try-number-garden': {
    src: '/assets/audio/hub/hub-welcome-try-number-garden.mp3',
    text: 'Hi! Try Number Garden?',
  },
  'hub.welcome.try-word-song': {
    src: '/assets/audio/hub/hub-welcome-try-word-song.mp3',
    text: 'Hi! Try Word Song?',
  },
  'hub.welcome.back-soon': {
    src: '/assets/audio/hub/hub-welcome-back-soon.mp3',
    text: 'Back so soon!',
  },
  'hub.welcome.pick-again': {
    src: '/assets/audio/hub/hub-welcome-pick-again.mp3',
    text: 'Pick again?',
  },
  'hub.welcome.pick-next': {
    src: '/assets/audio/hub/hub-welcome-pick-next.mp3',
    text: "Pick what's next.",
  },
  'hub.welcome.what-today.alt-1': {
    src: '/assets/audio/hub/hub-welcome-what-today-alt-1.mp3',
    text: "Hi! Look who's here!",
  },
  'hub.welcome.what-today.alt-2': {
    src: '/assets/audio/hub/hub-welcome-what-today-alt-2.mp3',
    text: 'Hi! Ready?',
  },
  'hub.welcome.what-today.alt-3': {
    src: '/assets/audio/hub/hub-welcome-what-today-alt-3.mp3',
    text: 'Hello, friend!',
  },
  'hub.welcome.try-number-garden.alt-1': {
    src: '/assets/audio/hub/hub-welcome-try-number-garden-alt-1.mp3',
    text: 'Hi! Number Garden today?',
  },
  'hub.welcome.try-number-garden.alt-2': {
    src: '/assets/audio/hub/hub-welcome-try-number-garden-alt-2.mp3',
    text: 'Hello! Want some flowers?',
  },
  'hub.welcome.try-word-song.alt-1': {
    src: '/assets/audio/hub/hub-welcome-try-word-song-alt-1.mp3',
    text: 'Hi! Word Song today?',
  },
  'hub.welcome.try-word-song.alt-2': {
    src: '/assets/audio/hub/hub-welcome-try-word-song-alt-2.mp3',
    text: 'Hello! Want some music?',
  },
  'hub.welcome.back-soon.alt-1': {
    src: '/assets/audio/hub/hub-welcome-back-soon-alt-1.mp3',
    text: 'Hi again!',
  },
  'hub.welcome.back-soon.alt-2': {
    src: '/assets/audio/hub/hub-welcome-back-soon-alt-2.mp3',
    text: "You're back!",
  },
  'hub.enter.number-garden': {
    src: '/assets/audio/hub/hub-enter-number-garden.mp3',
    text: 'Number Garden!',
  },
  'hub.enter.word-song': {
    src: '/assets/audio/hub/hub-enter-word-song.mp3',
    text: 'Word Song!',
  },
}

/** Word count per line — drives the linear caption tick interval. */
export const HUB_LINE_WORD_COUNTS: Record<HubLineId, number> =
  Object.fromEntries(
    (Object.keys(HUB_LINES) as HubLineId[]).map((k) => [
      k,
      HUB_LINES[k].text.split(/\s+/).filter(Boolean).length,
    ]),
  ) as Record<HubLineId, number>

// ── Greeting variant selection ───────────────────────────────────────────

/**
 * The path that brought Marian to Hub. Drives which welcome-line variants
 * are eligible and which audio gate the screen needs.
 */
export type HubEntryPath =
  | 'first-ever' // sessionCount === 1 (just finished Greet → Math → Session-End → Hub)
  | 'app-open' // app-relaunch path; useAudioUnlockGate required
  | 'app-open-recent' // app-open within 6h of last session
  | 'session-end' // from Session-End "All done!" tap
  | 'mid-skill-back' // from Math/WordSong back-arrow

/** What the algorithm decides for this Hub mount. */
export interface HubGreetingChoice {
  /** Which line to play. `null` ⇒ no greeting (rapid re-mount suppression). */
  lineId: HubLineId | null
  /** Did the algorithm pick the anchor (true) or a rotation variant (false)? */
  isAnchor: boolean
}

interface VariantTable {
  anchor: HubLineId
  rotation: HubLineId[]
}

/**
 * Per-entry-path variants — anchor + optional rotation pool.
 *
 * Suggestion-aware variants ('try-number-garden' / 'try-word-song') are
 * keyed off `suggestion` separately; this table covers the
 * non-suggestion paths.
 */
const VARIANTS_BY_PATH: Record<HubEntryPath, VariantTable> = {
  'first-ever': {
    anchor: 'hub.welcome.first-again',
    rotation: [], // anchor-only
  },
  'app-open': {
    anchor: 'hub.welcome.what-today',
    rotation: [
      'hub.welcome.what-today.alt-1',
      'hub.welcome.what-today.alt-2',
      'hub.welcome.what-today.alt-3',
    ],
  },
  'app-open-recent': {
    anchor: 'hub.welcome.back-soon',
    rotation: ['hub.welcome.back-soon.alt-1', 'hub.welcome.back-soon.alt-2'],
  },
  'session-end': {
    anchor: 'hub.welcome.pick-again',
    rotation: [], // anchor-only
  },
  'mid-skill-back': {
    anchor: 'hub.welcome.pick-next',
    rotation: [], // anchor-only
  },
}

/** Suggestion-aware tables — used when a non-null suggestion is set. */
const VARIANTS_BY_SUGGESTION: Record<SkillTreeId, VariantTable> = {
  'number-garden': {
    anchor: 'hub.welcome.try-number-garden',
    rotation: [
      'hub.welcome.try-number-garden.alt-1',
      'hub.welcome.try-number-garden.alt-2',
    ],
  },
  'word-song': {
    anchor: 'hub.welcome.try-word-song',
    rotation: [
      'hub.welcome.try-word-song.alt-1',
      'hub.welcome.try-word-song.alt-2',
    ],
  },
}

/**
 * Deterministic 0..1 pseudo-random keyed on a session count. Used so
 * the greeting variant for a given session is reproducible (tests can
 * assert "session 5 picks variant X" without mocking randomness).
 *
 * Lifted from a small splitmix-style hash; collisions don't matter
 * here because the only consumer is variant selection.
 */
export function pseudoRandom(seed: number): number {
  // splitmix32 on the seed; map to [0, 1).
  let z = (seed | 0) + 0x9e3779b9
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b)
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35)
  z = z ^ (z >>> 16)
  return ((z >>> 0) % 1_000_000) / 1_000_000
}

/**
 * Pick the welcome-back line for this Hub mount.
 *
 * Inputs:
 *   - `path`: how Marian got here.
 *   - `suggestion`: current soft-suggestion (or null).
 *   - `seed`: a deterministic seed (typically `sessionCount`). Same
 *     seed → same variant, every time.
 *   - `suppressed`: rapid-remount suppression flag — if true, returns
 *     `{ lineId: null, isAnchor: true }`.
 *
 * Selection rule (per spec § "Greeting model" + § "Suggestion-aware lines"):
 *   - On `app-open` or `app-open-recent` paths with a non-null
 *     suggestion, USE the suggestion table — Melody verbalises the
 *     nudge. Other paths use the path table even with a suggestion
 *     set (the suggestion is visual-only there, so we don't repeat
 *     "Pick again? Try Word Song?" on Session-End return).
 *   - 80% land on the anchor; 20% spread evenly across the rotation
 *     pool. Anchor-only tables always return the anchor.
 */
export function pickHubGreeting(opts: {
  path: HubEntryPath
  suggestion: SkillTreeId | null
  seed: number
  suppressed?: boolean
}): HubGreetingChoice {
  if (opts.suppressed) return { lineId: null, isAnchor: true }

  const useSuggestionTable =
    opts.suggestion !== null &&
    (opts.path === 'app-open' || opts.path === 'app-open-recent')

  const table = useSuggestionTable
    ? VARIANTS_BY_SUGGESTION[opts.suggestion as SkillTreeId]
    : VARIANTS_BY_PATH[opts.path]

  if (table.rotation.length === 0) {
    return { lineId: table.anchor, isAnchor: true }
  }

  const r = pseudoRandom(opts.seed)
  if (r < 0.8) return { lineId: table.anchor, isAnchor: true }

  // Rotation slot: split [0.8, 1.0) evenly across the pool.
  const idx = Math.min(
    table.rotation.length - 1,
    Math.floor(((r - 0.8) / 0.2) * table.rotation.length),
  )
  return { lineId: table.rotation[idx], isAnchor: false }
}

/**
 * Helper: when does the recent-stats strip's "today's session" line
 * qualify? Returns true iff `lastSessionCompletedAt` is within the
 * last 24h of `now`. Used by Hub to decide whether to surface the
 * stardust-today number; never displayed when no session has happened.
 */
export function isLastSessionRecent(
  lastSessionCompletedAtIso: string,
  now: Date,
  withinMs = 24 * 60 * 60 * 1000,
): boolean {
  if (!lastSessionCompletedAtIso) return false
  const last = new Date(lastSessionCompletedAtIso)
  if (Number.isNaN(last.getTime())) return false
  return now.getTime() - last.getTime() < withinMs
}

/**
 * Helper: should the day-streak band render? Per spec, only when the
 * streak is >= 1 AND last session was today or yesterday.
 */
export function shouldShowDayStreak(
  dayStreak: number,
  lastSessionCompletedAtIso: string,
  now: Date,
): boolean {
  if (dayStreak < 1) return false
  if (!lastSessionCompletedAtIso) return false
  const last = new Date(lastSessionCompletedAtIso)
  if (Number.isNaN(last.getTime())) return false
  // Local-time calendar-day delta — same rule as nextDayStreak.
  const aMid = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()
  const bMid = new Date(
    last.getFullYear(),
    last.getMonth(),
    last.getDate(),
  ).getTime()
  const diff = Math.round((aMid - bMid) / 86_400_000)
  return diff <= 1
}
