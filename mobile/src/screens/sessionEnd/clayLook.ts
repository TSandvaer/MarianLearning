/**
 * Session End's clay button looks (web `sessionEndClay.css` `.se-btn`):
 * green `go` (All done, Again) and caramel `alt` (Home). The map's peek
 * button wears `go` too (`locked-stop-peek-prompt.md` § 4).
 */
export const CLAY_LOOK = {
  go: {
    face: 'linear-gradient(#7fd364, #5cb945)',
    flat: '#6cc655',
    slab: '#3f8a2e',
    highlight: 'rgba(255, 255, 255, 0.35)',
    drop: 'rgba(40, 90, 20, 0.3)',
  },
  alt: {
    face: 'linear-gradient(#e7b07a, #c98a55)',
    flat: '#d89d67',
    slab: '#7d4a26',
    highlight: 'rgba(255, 255, 255, 0.3)',
    drop: 'rgba(60, 30, 10, 0.3)',
  },
} as const
