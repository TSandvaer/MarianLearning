# Assets TODO — Session 1

Tracker for assets that Kyle (UX) cannot author directly and are flagged for Thomas / a future asset pass.
Authoring environment is text-only (no audio synthesis, no raster painting), so any binary asset that
isn't trivially renderable from SVG ends up here.

Last updated: 2026-04-25 — bundle for ticket `86c9gkm42`.

---

## Outstanding (blocks Devon's Greet ticket `86c9gnhez` final acceptance)

### `sfx-chime-soft.mp3`

- **Used by:** Screen 2 (heart tap), Screen 4 ("Got it" tap), Screen 5 (Home tap). Reused 3x in Session 1.
- **Path expected by code:** `MarianLearning/public/assets/sfx-chime-soft.mp3`
- **Spec source:** `design/session-1.md` Screen 2, "Assets required".
- **Required spec:**
  - Duration: **400–600 ms** (target 500 ms).
  - Tone: **single bell strike**, pastel-soft, glassy. Think a small wind-chime tap or a celesta note.
  - **No reverb tail** longer than ~150 ms — must not bleed into TTS that follows.
  - **No metallic ring**, no sustained pad, no whoosh. We want "delicate", not "magical-fanfare".
  - File size target: **~8 KB MP3** (128 kbps mono is fine, 96 kbps acceptable).
  - Volume normalised to **-14 LUFS** so it sits under TTS without ducking.
- **Why no placeholder:** silence is a clearer "missing-asset" signal to dev/QA than a tone-deaf stand-in.
  Howler will throw a load error at boot — Kevin/Devon will see it immediately.
- **How to source (recommend to Thomas):**
  1. **freesound.org** — search "soft chime", "glass bell", "celesta tap". Filter CC0 or CC-BY. Trim to 500 ms in Audacity, export 128 kbps mono MP3. Add attribution to `design/credits.md` if CC-BY.
  2. **Free SFX libraries:** Pixabay Music, Mixkit, Zapsplat (free tier).
  3. **Generate:** any DAW (GarageBand celesta patch, single C5–E5 note, fade out 150 ms).
- **Owner:** Thomas (or whoever runs the next asset pass). Logged via Matt.

---

## Spec deltas this bundle introduces (for Matt to land on `design/session-1.md`)

Authored as separate PR / commit so the asset PR stays clean. Summary:

1. **`melody-idle.png` → `melody-idle.svg`.** Authored as SVG instead of PNG. Reasoning: Melody's
   visual style is flat, bounded colour fields with no photographic texture — vector renders perfectly
   on iPad Retina, scales to any size with zero resampling, and avoids the @2x/@3x sprite ladder.
   Bundle cost is lower than the ~80 KB PNG target. Update spec asset table accordingly.
2. **`melody-happy.png` → `melody-happy.svg`.** Same reasoning. Cross-fade swap with idle works
   identically in `<AnimatePresence>` whether they're SVG or PNG.
3. **No `melody-puzzled.svg` / `melody-cheering.svg` in this bundle.** Those are required for
   Screens 3 + 5 (out of scope of the 6-asset minimum bundle for Devon's Splash + Greet tickets).
   Logged as a follow-up asset pass — flagged below.

## Follow-up assets (not in this bundle — out of scope of `86c9gkm42`'s minimum)

These are listed in `session-1.md` for Screens 3, 4, 5 but not part of Devon's immediate Splash + Greet
critical path. Track separately so they don't slip:

- `melody-puzzled.svg` — Screen 3 wrong-answer state. Head tilt ~15°, ears slightly down.
- `melody-cheering.svg` — Screen 5 reward. Ears way up, mouth open, both arms-up if rigged.
- `bg-garden.svg` — Screen 3 background.
- `bg-song.svg` — Screen 4 background.
- `bg-twilight.svg` — Screen 5 background. (Open Q from spec: share base with `bg-clouds.svg` via
  CSS hue-rotate? Pending Thomas decision.)
- `flower-glyph.svg`, `sparkle-particle.svg`, `icon-speaker.svg`, `icon-paw.svg`,
  `icon-check.svg`, `star-filled.svg`, `jar.svg`, `silhouette-fox.svg`, `icon-home.svg`.
- ~~`pic-dog.svg`~~ — **SHIPPED** (2026-04-27, ticket `86c9grn2q`). Lives at `public/assets/pictures/pic-dog.svg`, ~4.4 KB. SVG format locked for all CVC word pictures per Thomas.
- SFX: `sfx-sparkle.mp3`, `sfx-poof.mp3`, `sfx-plink.mp3`, `sfx-cheer.mp3` — all blocked on the
  same audio-authoring constraint as `sfx-chime-soft.mp3`. Same sourcing recommendation.

---

## IP / licensing note

All Melody character vectors in this bundle (`melody-logo.svg`, `melody-idle.svg`, `melody-happy.svg`)
are **original artwork** in the visual family of Sanrio's My Melody (rounded hood, long lobed ears,
pink + cream palette, heart accent) but contain no traced or copied geometry from copyrighted source
material. Safe to ship for Marian's personal-use PWA. If the project ever distributes beyond the
family (App Store, public URL with attribution to a brand), revisit with a lawyer.

Audio assets, when sourced from freesound / Pixabay / Mixkit, must have their licence + attribution
recorded in `design/credits.md` (create if absent).
