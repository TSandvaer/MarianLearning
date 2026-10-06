# Emma's Path redesign: mockups (bar #12)

Open `mockups.html` in a browser. Use the top bar to switch between 3 directions and 4 screens (Hub, Number Garden map, session end with a good-day bud, session end with an unlock). Each screen is 820×1180 iPad portrait, scaled to fit. The data is mid-tree: Number Garden is on adding to twenty with 2 of 3 good days, and Word Song is on letter sounds.

- **A · Toy Box:** glossy toy-coins on thick 3D slabs. Each Hub card shows one big "you are here" coin with its flower tray, an arrow, and one frosted, padlocked "next" coin. The map puts the same coins on stacked land shelves.
- **B · Picture Book:** bold flat illustration. Each world card is a small landscape: the current picture sits on a hill with flowers growing in front of it, and a road climbs to the next picture. The map is the same landscape zoomed out.
- **C · Board Game:** chunky outlined tiles. A flag marks the current tile, and a chevron track leads to the next prize tile. The map is a board with Emma standing on her square.
- **Recommendation: A · Toy Box.** It meets bar #10 most directly (solid fills, soft depth, press-able slabs, like current kids' apps). Its full-width cards also give the biggest one-glance hero (bar #9). B needs the most new art and has the smallest hero. C's dice and board-game associations invite chance mechanics, and its black outlines clash with Emma's soft art.
- **Build notes for A:** bake the gloss into the icon art instead of using the runtime SVG filter, for paint cost on iPad. Never add counts or rarity to the coins.
- **Changes from `emmas-path-spec.md`:**
  - The bead row is gone from the Hub (bar #9).
  - The land number always sits next to its land picture, never on its own.
  - The Hub shows letter sounds as 3 buds. The spec's 12 per-vowel buds would fail bar #9; keep those for the map.
  - The unlock plays on the session-end screen as a 2-stop mini path. The spec plays it on the map instead (§6.3).
- **Stage icons:** drawn as real SVG for all 11 Number Garden stages, 3 Word Song stages and 5 land pictures. Each direction uses one shared geometry with its own treatment, so the style is consistent within a direction. The Emma images are the existing poses, downscaled to 360 px PNG data URIs.
