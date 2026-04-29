# Hub audio assets

This directory holds the 18 pre-rendered MP3s for the Hub welcome-back
greetings + node-tap chime utterances. Per `design/screen-hub.md`
§ "Audio integration contract", these are static (never vary per session)
so they are pre-rendered once at build-time and served via the PWA
service worker — NOT through the Path A `/api/claude` pipeline.

## Source-of-truth manifest

The canonical list of expected files lives in
`src/screens/Hub/hubLines.ts` (`HUB_LINES`). The Hub component reads
that map directly; if a file is missing on disk the corresponding line
silently falls back to the in-memory caption walk (165 wpm). No error
chime, no nag copy — same posture as Math's silent-fallback path.

## Authoring

Render via Azure Speech REST using
`scripts/render-greet-mp3s.mjs` as the template. Voice config:
`en-US-EmmaMultilingualNeural`, rate `-10%`, default pitch.

Ticket `86c9j53yx` (Kyle's asset queue) tracks the actual line
recording. The Hub-implementation PR (ticket `86c9j53ra`) ships the
manifest + a graceful fallback, so the screen renders correctly
even before the binaries land.
