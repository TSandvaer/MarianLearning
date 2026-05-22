# Away-mode queue — items needing Thomas

Maintained by the auto-status **away** loop. Items here need Thomas's own sign-off or a subjective/visual call the orchestrator will not decide. Clear items as they're resolved.

_Last updated: 2026-05-15T14:51Z (post-drain, session-end save imminent)_

---

## ⭐ digraphs-th tier — FULLY COMPLETE + polished

All PRs merged. `main` at `ea9e53a`. Production auto-deploying.

| PR   | What                                                               | Status               |
| ---- | ------------------------------------------------------------------ | -------------------- |
| #229 | th content spec                                                    | ✅ Merged            |
| #232 | th wordPack rows                                                   | ✅ Merged            |
| #233 | th planner + canon + debugSeed                                     | ✅ Merged            |
| #230 | th E2E (failing-first)                                             | ✅ Merged            |
| #234 | th spec cleanup                                                    | ✅ Merged            |
| #235 | th mouth-cue SVG (hybrid base+overlay)                             | ✅ Merged            |
| #236 | th mouth-cue wiring (Placements A+B + e2e)                         | ✅ Merged            |
| #237 | th mouth-cue **polish** (recentre +10px, downscale 492 KB → 94 KB) | ✅ **Merged 14:51Z** |

## Polish-backlog items remaining (not blocking)

- **Cream-wash bgclear check on real iPad** — if the warm-beige MJ background reads as a halo on cream when Marian uses it, run bgclear.ai on `design/references/character-emma/transparent/emma-th-mouth.png` (NOW 260×260, 68 KB) + re-embed. Web-only tool, Thomas-manual.
- **Overflow check on real iPad** — corner cue (Placement B) at top-right vs HUD streak indicator vertical stacking; e2e covered the logical layout but not the rendered Safari result.

## Decision waiting — next wave?

Polish backlog still has open items (NOT done this session): vector re-traces of the PNG-in-SVG pose family, `attentive-pointing` wiring (needs trigger spec), `listening` wiring (needs trigger spec). All deferred to a future session.

Sight-words tier is also a future-session call.

---

## Resolved / no longer needs you

- All th-tier merge gates (CI, Kevin/Devon reviews, your visual sign-off via "go with image, correct later if needed", iPad checks deferred to polish-backlog).
- All worktrees cleaned, all branches deleted.
- Cron killed (drain).
