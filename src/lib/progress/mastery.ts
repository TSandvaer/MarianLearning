/**
 * Mastery promotion rule — Milestone 3 of the adaptive engine
 * (ticket 86c9kmwd0). The first PR where the app actually changes
 * Marian's curriculum based on her performance.
 *
 * Pure module. The single public entry point is `applyMasteryRule(progress)`,
 * which returns a NEW Progress document (no mutation). It must be called
 * after each session-end save so the next session-start picks up the new
 * `skillLevels` shape.
 *
 * Tunables come from `parentSettings`
 * -----------------------------------
 * Per Thomas's 2026-05-01 update on the M3 ticket: the rule reads its
 * thresholds from the M2.5 `parentSettings` shape (`getSettings()`),
 * never from hardcoded constants in this file. Defaults (per-track,
 * 2026-05-02 update / ticket 86c9kwvy0):
 *  - math: 0.95 percent / 3 sessions
 *  - word-song: 0.90 percent / 3 sessions
 * Cross-day enforcement on, auto-promote on. The percent/sessions are
 * looked up per track inside the per-track scan loop, so a single
 * call walks both trees with each track's own threshold.
 *
 * Tree adjacency lives here
 * -------------------------
 * `MATH_TREE` and `LITERACY_TREE` declare the curriculum order in ONE
 * place. The focus-node selector in `focusNode.ts` predates this module
 * and keeps its own copies (`MATH_NODES_IN_ORDER` /
 * `WORD_SONG_NODES_IN_ORDER`) — the `mastery.test.ts` regression locks
 * the two declarations against each other so a silent drift fails CI.
 *
 * Why both trees per call
 * -----------------------
 * A child does math one session and literacy the next. We don't want to
 * wait for a same-track repeat session to apply a literacy promotion —
 * the rule is cheap (a couple of array filters per track per call), so
 * we walk both. Each node only promotes when the rule's history filter
 * for THAT node qualifies, so cross-track noise is structurally
 * impossible.
 */

import { getSettings } from './parentSettings'
import type {
  MasteryThreshold,
  NumberGardenNode,
  ParentSettings,
  Progress,
  SessionHistoryEntry,
  SkillNode,
  WordSongNode,
} from './types'

export type MasteryTrack = 'math' | 'word-song'

/**
 * Math tree (Number Garden) in promotion order. Source of truth for
 * "what is the next downstream node when X is mastered". Mirrors the
 * declaration order in `types.ts NumberGardenNode` and the curriculum
 * laid out in `CLAUDE.md` `## Two skill trees`.
 */
export const MATH_TREE: readonly NumberGardenNode[] = [
  'number-recog',
  'add-to-10',
  'add-to-20',
  'sub-to-10',
  'sub-to-20',
  'two-digit-addsub',
  'skip-counting',
  'mult-2-5-10',
  'mult-3-4',
  'mult-6-9',
]

/**
 * Word Song / literacy tree in promotion order. Same contract as
 * `MATH_TREE`.
 */
export const LITERACY_TREE: readonly WordSongNode[] = [
  'letter-names',
  'letter-sounds',
  'blending-cv',
  'cvc-words',
  'digraphs',
  'sight-words',
  'simple-sentences',
]

/**
 * Return the next downstream node after `current` in `track`'s tree, or
 * `null` when `current` is the last node. `null` is also returned when
 * `current` doesn't appear in the named track at all (a programming
 * error — we don't throw because the call site doesn't need to handle
 * a thrown error).
 */
export function nextNode(
  track: MasteryTrack,
  current: SkillNode,
): SkillNode | null {
  const tree = track === 'math' ? MATH_TREE : LITERACY_TREE
  const idx = tree.indexOf(current as never)
  if (idx === -1) return null
  if (idx === tree.length - 1) return null
  return tree[idx + 1] ?? null
}

/**
 * Apply the mastery rule and return an updated Progress document.
 *
 * Rule
 * ----
 * For every node in either tree whose current `skillLevels[node]` is
 * `'practicing'` (where `track` = the node's track, math or word-song):
 *   1. Filter `progress.history` to entries whose `skillFocus` includes
 *      this node.
 *   2. If `parentSettings.crossDayEnforcement === true`, dedupe to one
 *      entry per calendar day (by `dateISO`'s `YYYY-MM-DD` prefix —
 *      same convention recordProgressOnSessionEnd writes). Keep the
 *      LAST entry per day (the most recent session of that day).
 *   3. Take the last `parentSettings.masteryThreshold[track].sessions`
 *      entries.
 *   4. If there are fewer entries than required, no promotion.
 *   5. If every retained entry has
 *      `successRate >= parentSettings.masteryThreshold[track].percent`,
 *      the node qualifies for promotion.
 *
 * Promotion
 * ---------
 * - `parentSettings.autoPromote === true`: mark `node` as `'mastered'`
 *   on a fresh `skillLevels` map. If `nextNode(track, node)` is
 *   currently `'locked'`, move it to `'intro'`. Already-`intro` /
 *   `practicing` / `mastered` downstream nodes are left alone (no
 *   demotion, no backwards reset).
 * - `parentSettings.autoPromote === false`: queue
 *   `progress.pendingPromotion = node` and do NOT mutate `skillLevels`.
 *   When multiple nodes qualify in a single call, the earliest node in
 *   tree order wins (math first, then literacy; within a track, the
 *   tree's root-to-leaf order). A `pendingPromotion` from a previous
 *   call is preserved if the parent has not flipped `autoPromote`
 *   between calls — the call is idempotent in that case.
 *
 * Auto-promote re-entry
 * ---------------------
 * If `progress.pendingPromotion` is set AND `autoPromote === true`,
 * the rule applies the queued promotion immediately and clears the
 * field. This lets the parent flip the toggle in Settings and have
 * the queued promotion take effect on the next session-end (or any
 * other call site we add later).
 *
 * Idempotence
 * -----------
 * `applyMasteryRule(applyMasteryRule(p))` is structurally equivalent
 * to `applyMasteryRule(p)`. The second call sees the freshly-promoted
 * node as `'mastered'` and skips it; the downstream node is already at
 * `'intro'` (or higher) and is not re-touched.
 */
export function applyMasteryRule(progress: Progress): Progress {
  const settings = getSettings(progress)

  // Build the working document. We always clone `skillLevels` so
  // callers can rely on the result being a fresh object — even when
  // no promotion fires, the field reads as a different reference.
  const out: Progress = {
    ...progress,
    skillLevels: { ...progress.skillLevels },
  }

  // ── Apply any queued pendingPromotion when autoPromote is now on ──
  // Run this BEFORE the per-track scan so a queued promotion + a fresh
  // qualifying session in the same call don't fight over the same
  // skillLevels slot. The queued promotion takes priority — it's
  // older.
  if (
    settings.autoPromote &&
    progress.pendingPromotion !== undefined &&
    out.skillLevels[progress.pendingPromotion] === 'practicing'
  ) {
    const queued = progress.pendingPromotion
    const queuedTrack = trackOf(queued)
    out.skillLevels[queued] = 'mastered'
    if (queuedTrack !== null) {
      const downstream = nextNode(queuedTrack, queued)
      if (downstream !== null && out.skillLevels[downstream] === 'locked') {
        out.skillLevels[downstream] = 'intro'
      }
    }
    delete out.pendingPromotion
  } else if (settings.autoPromote && progress.pendingPromotion !== undefined) {
    // autoPromote is on but the queued node is no longer at 'practicing'
    // (e.g. somebody else promoted it). Clear the stale queue.
    delete out.pendingPromotion
  }

  // ── Walk both trees, evaluate promotion candidates ──
  // We collect candidates first so the autoPromote=false branch can
  // pick the earliest in tree order without scanning twice.
  const candidates: { track: MasteryTrack; node: SkillNode }[] = []

  const trees: readonly { track: MasteryTrack; nodes: readonly SkillNode[] }[] =
    [
      { track: 'math', nodes: MATH_TREE },
      { track: 'word-song', nodes: LITERACY_TREE },
    ]

  for (const { track, nodes } of trees) {
    // Per-track threshold (ticket 86c9kwvy0) — math and word-song
    // each get their own percent/sessions pair. Read it once per
    // track outside the inner loop.
    const trackThreshold = settings.masteryThreshold[track]
    for (const node of nodes) {
      if (out.skillLevels[node] !== 'practicing') continue
      if (!qualifies(progress.history, node, trackThreshold, settings)) continue
      candidates.push({ track, node })
    }
  }

  if (candidates.length === 0) {
    return out
  }

  if (settings.autoPromote) {
    for (const { track, node } of candidates) {
      // Re-check the current level — a previous candidate in this call
      // could have moved a downstream node from `locked` to `intro`,
      // but candidates are only at `practicing`, so this is paranoia.
      if (out.skillLevels[node] !== 'practicing') continue
      out.skillLevels[node] = 'mastered'
      const downstream = nextNode(track, node)
      if (downstream !== null && out.skillLevels[downstream] === 'locked') {
        out.skillLevels[downstream] = 'intro'
      }
    }
    return out
  }

  // autoPromote === false — queue the earliest candidate in tree order
  // (math tree before word-song; within a track, the tree's order).
  // If a queue already exists from a prior call (and the prior queued
  // node is still 'practicing'), preserve it — don't stomp.
  if (
    progress.pendingPromotion !== undefined &&
    out.skillLevels[progress.pendingPromotion] === 'practicing'
  ) {
    out.pendingPromotion = progress.pendingPromotion
  } else {
    out.pendingPromotion = candidates[0]!.node
  }

  return out
}

// ── internals ──────────────────────────────────────────────────────────

/**
 * Identify which track a node belongs to. Returns `null` for an unknown
 * node (programming error — kept defensive so the caller doesn't crash
 * on an out-of-band string).
 */
function trackOf(node: SkillNode): MasteryTrack | null {
  if ((MATH_TREE as readonly string[]).includes(node)) return 'math'
  if ((LITERACY_TREE as readonly string[]).includes(node)) return 'word-song'
  return null
}

/**
 * Return true iff `node` has enough recent qualifying history to be
 * promoted under `threshold`. Pure read of `history`; does not mutate.
 *
 * `threshold` is the per-track value (math vs word-song); `settings`
 * still carries the rule-level toggles (`crossDayEnforcement`).
 */
function qualifies(
  history: readonly SessionHistoryEntry[],
  node: SkillNode,
  threshold: MasteryThreshold,
  settings: ParentSettings,
): boolean {
  const focused = history.filter((entry) => entry.skillFocus.includes(node))
  if (focused.length === 0) return false

  const filtered = settings.crossDayEnforcement
    ? dedupeByCalendarDay(focused)
    : focused
  if (filtered.length < threshold.sessions) return false

  const window = filtered.slice(-threshold.sessions)
  return window.every((entry) => entry.successRate >= threshold.percent)
}

/**
 * Reduce a list of history entries to one-per-calendar-day. The day key
 * is computed in LOCAL time, matching the streak counter's convention
 * (`sessionHistory.ts` uses an inline `differenceInCalendarDays` keyed
 * on local `getFullYear/getMonth/getDate`). Two semantics for the same
 * `dateISO` would otherwise be observable to Marian — the streak band
 * counts a Manila-evening + Manila-morning pair as two days while the
 * mastery rule used to collapse them to one (UTC offset = 8h).
 *
 * "One per day" is the LATEST entry on that day (the entry with the
 * highest position in the list — `Progress.history` is appended-only,
 * most-recent-last per `saveProgress` semantics). This mirrors how a
 * parent would think about it: "today's high score" is the one that
 * sticks.
 *
 * P0.3 history (audit follow-up to PR #120)
 * -----------------------------------------
 * Earlier shape used `entry.dateISO.slice(0, 10)` — the UTC `YYYY-MM-DD`
 * prefix produced by `Date#toISOString()`. Under Manila (UTC+8) the
 * 22:00–06:00 window collapses across the UTC midnight: a session at
 * 2026-04-30 21:00 Manila and 2026-05-01 06:00 Manila both stamp UTC
 * day `2026-04-30`, so the cross-day filter discarded one of the two
 * and `add-to-20`'s 3-session requirement could never accumulate. The
 * mastery rule's own header self-flagged the UTC choice as a "known
 * simplification" — empirically it bit. Audit:
 * `design/audits/2026-05-02-polish/jessica-qa-edge-cases.md` § P0.3.
 *
 * Edge cases:
 *   - Malformed dateISO (`Date#parse` returns NaN): fall back to using
 *     the raw `dateISO` string as the day key. A single weirdly-shaped
 *     entry doesn't poison promotion logic for the whole node.
 *   - Cross-timezone playback: the day key is computed in whatever
 *     local timezone the JS runtime is in when `applyMasteryRule()`
 *     runs. For Marian's use (single iPad in Manila), this is
 *     wall-clock-correct. A future multi-device / cross-tz scenario
 *     would need an explicit per-profile timezone — out of scope here.
 */
function dedupeByCalendarDay(
  entries: readonly SessionHistoryEntry[],
): SessionHistoryEntry[] {
  // Index of the LAST entry per local-day key. We walk the source list
  // (most-recent-last by saveProgress contract) and remember the
  // highest index per key; the surviving entries are exactly those
  // indices in original order, which preserves the chronological-ish
  // ordering `slice(-N)` upstream depends on.
  const lastIndexByKey = new Map<string, number>()
  entries.forEach((entry, idx) => {
    lastIndexByKey.set(localDayKey(entry.dateISO), idx)
  })
  const keepIndices = new Set(lastIndexByKey.values())
  return entries.filter((_entry, idx) => keepIndices.has(idx))
}

/**
 * Convert an ISO 8601 timestamp into a `YYYY-MM-DD` local-tz day key.
 * Same convention `sessionHistory.ts`'s streak counter uses (local
 * `getFullYear/getMonth/getDate`), kept inline here to avoid pulling
 * `date-fns` into the progress bundle for one helper. iPad budget rule.
 *
 * Returns the raw `dateISO` when the timestamp doesn't parse — the
 * filter then treats the malformed entry as its own day key, which
 * keeps it visible and prevents one bad row from collapsing the
 * surrounding good rows.
 */
function localDayKey(dateISO: string): string {
  const ms = Date.parse(dateISO)
  if (Number.isNaN(ms)) return dateISO
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
