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
 * Graduation-gated word-song nodes (ticket 86c9m3aec, novel-word
 * generalization check on cvc-words mastery graduation).
 *
 * Per Dave's developmental review (`design/research/cvc-words-
 * developmental-review.md` § P1.2), a 90/3 mastery threshold over the
 * fixed 8-word canonical pool can reflect item familiarity rather than
 * decoding ability. For nodes in this set, the standard 90/3 rule is a
 * NECESSARY but not SUFFICIENT condition for promotion: the most
 * recent qualifying entry must additionally carry a
 * `novelPoolSuccessRate >= NOVEL_POOL_THRESHOLD` — meaning Marian
 * generalised her decoding to 2–3 NOVEL short-a words she had not
 * seen in the canonical 8-pool.
 *
 * The set is intentionally narrow: only `cvc-words` today. Future
 * sibling-vowel tiers (`cvc-words-short-o`, etc. — see
 * `design/word-song/short-o-pool-expansion.md`) will join the set when
 * those tickets ship.
 */
export const WORD_SONG_GRADUATION_GATED_NODES: readonly WordSongNode[] = [
  'cvc-words',
]

/**
 * Promotion-gate threshold on the novel-pool slice of a graduation
 * session (ticket 86c9m3aec). Lower than the canonical 90/3 percent
 * because novel-pool items are TRULY new to Marian — Dave §6 P1
 * argues that 50–80% on 2–3 novel items is a reasonable
 * generalization signal; the conservative-but-not-impossible 80%
 * is the locked v1 value.
 *
 * Tunable: keep this as a single exported constant rather than a
 * per-track parentSettings field for now — the gate is currently
 * cvc-words-only and the value is research-informed (not parent-
 * tunable in v1). When short-o pool ships and the gate generalises
 * across nodes, the value can move into parentSettings if the v2
 * UI surfaces it.
 */
export const NOVEL_POOL_THRESHOLD = 0.8

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
 *
 * cvc-words = short-a CVC. Subsequent vowels get sibling nodes
 * (cvc-words-short-o, cvc-words-short-u, cvc-words-short-i,
 * cvc-words-short-e, …). This was a deliberate backward-compat choice
 * — see design/word-song/short-o-pool-expansion.md §2 (and
 * design/word-song/short-u-pool-expansion.md §2 for the short-u tier
 * added under ticket 86c9q9ben,
 * design/word-song/short-i-pool-expansion.md §2 for the short-i tier
 * added under ticket 86c9qdba4, and
 * design/word-song/short-e-pool-expansion.md §1 for the short-e tier
 * — the final single-vowel tier in the o → u → i → e canonical arc —
 * added under ticket 86c9teua2).
 */
export const LITERACY_TREE: readonly WordSongNode[] = [
  'letter-names',
  'letter-sounds',
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
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
 *   demotion, no backwards reset). ADDITIONALLY (ticket 86c9m3brc) the
 *   rule sets `progress.pendingPromotion = <earliest-candidate-node>`
 *   so the Hub celebration fires on the next mount. The flag is
 *   transient: the next `applyMasteryRule()` call sees the queued
 *   node is no longer `'practicing'` (it's now `'mastered'`) and the
 *   stale-clear branch at the top of the function deletes it. Without
 *   this write, the celebration was effectively dead code for default
 *   users — `autoPromote` defaults to `true` and the field was only
 *   set in the `false` branch.
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
 * `applyMasteryRule(applyMasteryRule(p))` produces the same
 * `skillLevels` shape on both calls. The second call sees the freshly-
 * promoted node as `'mastered'` and skips it; the downstream node is
 * already at `'intro'` (or higher) and is not re-touched.
 *
 * The `pendingPromotion` field is INTENTIONALLY transient under
 * autoPromote=true (ticket 86c9m3brc): the first call sets it, the
 * second call's stale-clear branch deletes it. This is the natural
 * lifecycle — the field exists to drive a single Hub celebration; the
 * "next applyMasteryRule run" (ie. the next session-end) is when the
 * cleanup happens. Tests on idempotence assert on `skillLevels`
 * shape, not on `pendingPromotion`.
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

  // Shared tree list used by both the intro→practicing pass and the
  // practicing→mastered candidate scan below.
  const trees: readonly { track: MasteryTrack; nodes: readonly SkillNode[] }[] =
    [
      { track: 'math', nodes: MATH_TREE },
      { track: 'word-song', nodes: LITERACY_TREE },
    ]

  // ── intro → practicing pass (ticket 86c9qu91g) ──────────────────────────
  // Root cause: the rule below only walked nodes at 'practicing'. Any node
  // that started at 'intro' (cvc-words, sub-to-20, mult-2-5-10, sight-words
  // in the default baseline) was permanently invisible to the engine
  // regardless of how many sessions Marian completed on it. Thomas's iPhone
  // state showed skillLevels['cvc-words'] === 'intro' after 4 consecutive
  // 100% sessions — confirming the dead-end.
  //
  // Transition rule: if a node is at 'intro' AND the history contains at
  // least one entry where `skillFocus` includes that node AND
  // `successRate > 0`, advance the node to 'practicing'. One any-success
  // session is sufficient — the semantic of 'intro' is "hasn't been tried
  // yet" and the semantic of 'practicing' is "has demonstrated SOME ability
  // with this skill, now being refined." A session with successRate = 0
  // (0/8) does not clear the intro gate.
  //
  // No downstream cascade here: the locked → intro unlock only fires when
  // a node reaches 'mastered', not 'practicing'. The practicing → mastered
  // scan below runs against the updated `out.skillLevels` in the same call,
  // so a node can traverse intro → practicing → mastered in a single
  // applyMasteryRule call when history is sufficient.
  //
  // Retroactive self-healing: existing users with nodes stuck at 'intro'
  // (Thomas's iPhone) will self-heal on the next session-end call because
  // the prior session history satisfies the "at least one successRate > 0"
  // check.
  for (const { nodes } of trees) {
    for (const node of nodes) {
      if (out.skillLevels[node] !== 'intro') continue
      const hasAnySuccess = progress.history.some(
        (entry) =>
          entry.skillFocus.includes(node) && entry.successRate > 0,
      )
      if (hasAnySuccess) {
        out.skillLevels[node] = 'practicing'
      }
    }
  }

  // ── Walk both trees, evaluate promotion candidates ──
  // We collect candidates first so the autoPromote=false branch can
  // pick the earliest in tree order without scanning twice.
  const candidates: { track: MasteryTrack; node: SkillNode }[] = []

  for (const { track, nodes } of trees) {
    // Per-track threshold (ticket 86c9kwvy0) — math and word-song
    // each get their own percent/sessions pair. Read it once per
    // track outside the inner loop.
    const trackThreshold = settings.masteryThreshold[track]
    for (const node of nodes) {
      if (out.skillLevels[node] !== 'practicing') continue
      if (!qualifies(progress.history, node, trackThreshold, settings)) continue
      // Graduation gate (ticket 86c9m3aec). For graduation-gated nodes
      // the standard rule is necessary but not sufficient — the most
      // recent qualifying entry must additionally carry a passing
      // novelPoolSuccessRate. If the gate isn't satisfied, the node
      // stays at 'practicing'; the next session-start picks it up as
      // graduation-pending and the planner emits the novel-word probe.
      if (
        isGraduationGated(node) &&
        !graduationGateClears(progress.history, node, trackThreshold, settings)
      ) {
        continue
      }
      candidates.push({ track, node })
    }
  }

  if (candidates.length === 0) {
    return out
  }

  if (settings.autoPromote) {
    // Track which candidates actually promoted this call (re-check guard
    // below could in theory skip one). The earliest in tree order is the
    // node we surface to Hub via `pendingPromotion`.
    const promotedThisCall: SkillNode[] = []
    for (const { track, node } of candidates) {
      // Re-check the current level — a previous candidate in this call
      // could have moved a downstream node from `locked` to `intro`,
      // but candidates are only at `practicing`, so this is paranoia.
      if (out.skillLevels[node] !== 'practicing') continue
      out.skillLevels[node] = 'mastered'
      promotedThisCall.push(node)
      const downstream = nextNode(track, node)
      if (downstream !== null && out.skillLevels[downstream] === 'locked') {
        out.skillLevels[downstream] = 'intro'
      }
    }
    // Ticket 86c9m3brc — surface a celebration cue for the Hub. We set
    // `pendingPromotion` to the earliest tree-order node that promoted
    // this call (mirroring the autoPromote=false ordering). The flag is
    // transient: the next applyMasteryRule call will see the node is
    // `'mastered'` and the stale-clear branch above clears it, so neither
    // mode leaves a persistent artifact once the celebration plays.
    //
    // We only WRITE the field when at least one promotion fired. The
    // re-entry branch above may have already deleted a stale queue from
    // an earlier call; preserving that delete by skipping the write here
    // when no fresh candidate landed keeps the field clean.
    if (promotedThisCall.length > 0) {
      out.pendingPromotion = promotedThisCall[0]!
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

// ── Graduation-gate helpers (ticket 86c9m3aec) ─────────────────────────

/** True when `node` is in the graduation-gated set. */
function isGraduationGated(node: SkillNode): boolean {
  return (WORD_SONG_GRADUATION_GATED_NODES as readonly string[]).includes(node)
}

/**
 * For a graduation-gated node already passing `qualifies()`, return
 * true iff the MOST RECENT entry in the qualifying window carries a
 * `novelPoolSuccessRate >= NOVEL_POOL_THRESHOLD`. The shared filter
 * pipeline (skillFocus filter + cross-day dedupe + last-N window)
 * mirrors `qualifies()` so the two stay in lockstep on history shape.
 *
 * Why "most recent" and not "all of the window"
 * ---------------------------------------------
 * The novel-pool gate is a single-session generalization probe. The
 * graduation session IS the most recent of the window. Earlier
 * sessions in the window are non-graduation entries (no
 * `novelPoolSuccessRate`); requiring them to clear the novel gate
 * would never be satisfiable. So the gate reads only the tail entry.
 */
function graduationGateClears(
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
  const tail = window[window.length - 1]!
  return (
    typeof tail.novelPoolSuccessRate === 'number' &&
    tail.novelPoolSuccessRate >= NOVEL_POOL_THRESHOLD
  )
}

/**
 * Return true iff the next session for `node` on `track` should be
 * flagged as a graduation session — meaning the planner should mix
 * 2–3 novel-pool probe words into the 8-problem set so the engine
 * can verify Marian's decoding generalises beyond the canonical
 * pool (ticket 86c9m3aec).
 *
 * Rules (all must hold):
 *   1. `node` is in `WORD_SONG_GRADUATION_GATED_NODES`.
 *   2. `node` is currently at `'practicing'` (a `'mastered'` node has
 *      already promoted; an `'intro'` / `'locked'` node hasn't reached
 *      a graduation gate yet).
 *   3. The last `threshold.sessions` qualifying entries (cross-day-
 *      deduped per `parentSettings.crossDayEnforcement`) all hit
 *      `successRate >= threshold.percent`.
 *   4. NONE of those tail entries already carries a
 *      `novelPoolSuccessRate` — i.e. graduation hasn't happened yet,
 *      or the previous attempt's novel-tagged entry has aged out of
 *      the tail window.
 *
 * Rule (4) is the "engine waits for canonical 90/3 to reset" guarantee
 * from the AC. After a failed graduation (novel < 80%), the failed
 * entry sits at the tail of the qualifying window with a
 * `novelPoolSuccessRate` set — predicate returns false, so the next
 * session is a regular cvc-words session. Only after 3 fresh
 * non-graduation sessions push the failed entry out of the tail
 * window does the predicate flip true again.
 *
 * Pure read of `progress`; does not mutate. Safe to call at session-
 * start (after `loadProgress()`) or at session-end before
 * `recordProgressOnSessionEnd` runs.
 */
// ── Cross-vowel mix gate (ticket 86c9qa0kf) ─────────────────────────────

/**
 * The three CVC-tier word-song nodes that participate in cross-vowel
 * distractor mixing per `design/word-song/cross-vowel-mix-spec.md` §2.
 *
 * When ALL three are `'mastered'` AND `parentSettings.crossVowelMixingEnabled`
 * is `true`, sessions on any of these tiers can pull distractors from any
 * vowel pool — testing cross-vowel discrimination as a deliberate skill.
 *
 * This is a deliberate change point — when short-i / short-e ship,
 * Kevin or Devon adds the new node literal here. The explicit Set
 * makes the dependency visible (Dave's research §4.3 flagged this as
 * a virtue, not a bug surface).
 */
export const CVC_CROSS_VOWEL_NODES: readonly WordSongNode[] = [
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
]

/**
 * The vowel literals that participate in cross-vowel distractor mixing,
 * paired 1:1 with `CVC_CROSS_VOWEL_NODES` above (`cvc-words` → `'a'`,
 * `cvc-words-short-o` → `'o'`, `cvc-words-short-u` → `'u'`).
 *
 * Single source of truth for the cross-vowel vowel set. Consumed by
 * `wordDistractors.test.ts` to scope the `TARGET_PAIRINGS_CROSSVOWEL`
 * exhaustiveness invariants to vowels actually in the matrix — this
 * prevents new vowel-tier additions (e.g. short-i added under ticket
 * 86c9qdba4 in PR #190) from false-failing the test until the
 * cross-vowel matrix is explicitly widened to cover them.
 *
 * Widening contract: when a new tier (e.g. `cvc-words-short-i`) is
 * promoted into the cross-vowel matrix, add the matching vowel literal
 * here AND extend `CVC_CROSS_VOWEL_NODES` above. The pair must stay
 * aligned. Widening tracked under the cross-vowel matrix v2 ticket
 * (`86c9qahq7`-adjacent) per PR #190 review note.
 *
 * Typed against the same union as `WordEntry.vowel` in
 * `src/screens/WordSong/wordPack.ts` (`'a' | 'o' | 'u' | 'i' | 'e'`).
 */
export const CVC_CROSS_VOWEL_VOWELS: readonly ('a' | 'o' | 'u' | 'i' | 'e')[] =
  ['a', 'o', 'u']

/**
 * True iff cross-vowel distractor mixing is active on this Progress
 * document — meaning sessions on any of the three CVC tiers will draw
 * distractors from any vowel pool, exercising cross-vowel
 * discrimination per `design/word-song/cross-vowel-mix-spec.md` §2 +
 * Dave's research (PR #175) §3.
 *
 * Returns `true` only when ALL of:
 *   1. `cvc-words === 'mastered'`
 *   2. `cvc-words-short-o === 'mastered'`
 *   3. `cvc-words-short-u === 'mastered'`
 *   4. `parentSettings.crossVowelMixingEnabled === true` (default `true`).
 *
 * O(1). No history traversal — three skillLevels reads + one settings
 * read. Mirrors the `isGraduationSessionPending` shape.
 *
 * The predicate intentionally does NOT check the session's `focusNode`.
 * Per the dispatch contract (ticket 86c9qa0kf AC2/AC4) the caller
 * (`wordDistractors.ts pickDistractors` + `WordSong.tsx` problem-render
 * path + `api/_planner.ts` cross-vowel branch) gates on focus being a
 * CVC tier separately. The two-stage gate keeps the predicate's
 * concern (engine-level "does Marian's profile clear cross-vowel?")
 * separate from the call-site concern (focus-tier check). It also
 * makes the predicate trivially callable from non-WordSong contexts
 * (parent settings UI displaying "is mixing currently active?", debug
 * overlays, future analytics) without forcing them to invent a focus
 * value.
 *
 * Pure read of `progress` + `parentSettings`; does not mutate.
 *
 * Pool-size-floor caveat
 * ----------------------
 * `cross-vowel-mix-spec.md` §6 notes "same-tier pools have ≥ 11 entries
 * each" before cross-vowel mode fires. As of 2026-05-09: short-a = 14,
 * short-u = 11, short-o = 8 (under floor; Kyle's expansion ticket in
 * flight). The predicate does NOT gate on pool size — cross-vowel
 * firing with an 8-word short-o pool is graceful degradation, not a
 * bug. Distractor authoring just picks from whatever the pool offers;
 * if short-o is small, short-o targets pull from 7 same-tier
 * candidates instead of 10. Dave's research §3 supports this. When
 * Kyle's expansion ships, the floor is met without a code change.
 */
export function crossVowelMixingActive(
  progress: Progress,
  parentSettings?: ParentSettings,
): boolean {
  const settings = parentSettings ?? getSettings(progress)
  if (settings.crossVowelMixingEnabled !== true) return false
  const sl = progress.skillLevels
  for (const node of CVC_CROSS_VOWEL_NODES) {
    if (sl[node] !== 'mastered') return false
  }
  return true
}

export function isGraduationSessionPending(
  progress: Progress,
  node: SkillNode,
  track: MasteryTrack,
): boolean {
  if (!isGraduationGated(node)) return false
  if (progress.skillLevels[node] !== 'practicing') return false

  const settings = getSettings(progress)
  const threshold = settings.masteryThreshold[track]

  const focused = progress.history.filter((entry) =>
    entry.skillFocus.includes(node),
  )
  if (focused.length === 0) return false

  const filtered = settings.crossDayEnforcement
    ? dedupeByCalendarDay(focused)
    : focused
  if (filtered.length < threshold.sessions) return false

  const window = filtered.slice(-threshold.sessions)
  // Every entry in the window must hit the canonical threshold AND none
  // may already be tagged with a novelPoolSuccessRate. The latter
  // ensures a previous graduation (whether passing or failing) blocks
  // an immediate re-attempt.
  for (const entry of window) {
    if (entry.successRate < threshold.percent) return false
    if (entry.novelPoolSuccessRate !== undefined) return false
  }
  return true
}
