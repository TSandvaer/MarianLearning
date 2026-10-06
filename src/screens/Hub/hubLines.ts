/**
 * Hub welcome-back + node-tap line manifest.
 *
 * Source-of-truth: `design/screen-hub.md` § "Audio integration contract".
 * 9 anchor lines + 9 rotation variants + 2 node-tap = 20 MP3s total.
 *
 * Voice provenance: same `en-GB-OliviaNeural` rate `-10%` config
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

// ── Entry path ───────────────────────────────────────────────────────────

/**
 * The path that brought Marian to Hub. Drives the audio gate (app-open
 * paths wait for the first tap once a line has a recording). Emma's Hub
 * lines are now the guidance lines in `hubGuidance.ts` (Guidance G1);
 * the welcome-line manifest above stays for the Howler line player.
 */
export type HubEntryPath =
  | 'first-ever' // sessionCount === 1 (just finished Greet → Math → Session-End → Hub)
  | 'app-open' // app-relaunch path; useAudioUnlockGate required
  | 'app-open-recent' // app-open within 6h of last session
  | 'session-end' // from Session-End "All done!" tap
  | 'mid-skill-back' // from Math/WordSong back-arrow
