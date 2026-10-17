/**
 * Sharing's deal schedule (`design/native/content-wave-2.md` § 2.5), as
 * the pure data `ShareStage` animates.
 */
import {
  CROSSFADE_MS,
  DEAL_FLIGHT_MS,
  deal,
  dealOrder,
  emptyPlan,
  FADE_DEAL_MS,
  FAST_FLIGHT_MS,
  INSTANT_MS,
  msUntilLanded,
  normalLaunchMs,
  shareFillEndMs,
  undealt,
  type FlightPlan,
} from './shareDeal'

const NOW = 10_000

describe('dealOrder (the deal rule)', () => {
  it('6 on 2: plate 1, 2, 1, 2, 1, 2, taken from the pile’s end', () => {
    const order = dealOrder(6, 2)
    expect(order.map((d) => d.plate + 1)).toEqual([1, 2, 1, 2, 1, 2])
    expect(order.map((d) => d.pileCell)).toEqual([5, 4, 3, 2, 1, 0])
    expect(order.map((d) => d.plateCell)).toEqual([0, 0, 1, 1, 2, 2])
  })

  it('12 on 3: every round puts one on each plate; each plate ends with 4', () => {
    const order = dealOrder(12, 3)
    for (let plate = 0; plate < 3; plate++) {
      expect(
        order.filter((d) => d.plate === plate).map((d) => d.plateCell),
      ).toEqual([0, 1, 2, 3])
    }
  })
})

describe('the normal deal', () => {
  it('launches k at k × 120 + floor(k / B) × 100 (a breath between rounds)', () => {
    expect([0, 1, 2, 3, 4, 5].map((k) => normalLaunchMs(k, 2))).toEqual([
      0, 120, 340, 460, 680, 800,
    ])
  })

  it.each([
    [6, 2, 1120],
    [12, 3, 1940],
    [20, 4, 3000],
  ])('%i on %i lasts about %i ms (§ 2.5: 1.2 s, 2.0 s, 3.0 s)', (t, b, ms) => {
    const plan = deal(emptyPlan(t), 'normal', NOW, b, false)
    expect(msUntilLanded(plan, NOW)).toBe(ms)
    expect(plan.every((f) => f?.motion === 'deal')).toBe(true)
    expect(plan[0]!.duration).toBe(DEAL_FLIGHT_MS)
  })

  it('Reduce Motion: the same schedule as 120 ms fades', () => {
    const plan = deal(emptyPlan(6), 'normal', NOW, 2, true)
    expect(plan.map((f) => f!.start - NOW)).toEqual([
      0, 120, 340, 460, 680, 800,
    ])
    expect(plan.every((f) => f!.motion === 'fade')).toBe(true)
    expect(plan[0]!.duration).toBe(FADE_DEAL_MS)
  })
})

describe('the hint deals (P4–P8)', () => {
  it('hint 2 deals exactly one round, 300 ms apart; hint 3 deals the rest on the normal rounds', () => {
    const round = deal(emptyPlan(12), 'round', NOW, 3, false)
    expect(undealt(round)).toBe(9)
    expect(round.slice(0, 3).map((f) => f!.start - NOW)).toEqual([0, 300, 600])
    const later = NOW + 2000
    const rest = deal(round, 'normal', later, 3, false)
    expect(undealt(rest)).toBe(0)
    // Flower 3 starts round 2 now; 4 and 5 follow 120 ms apart, then the
    // breath before round 3.
    expect(rest.slice(3, 7).map((f) => f!.start - later)).toEqual([
      0, 120, 240, 460,
    ])
  })

  it('hint 2 after an auto-deal deals nothing', () => {
    const dealt = deal(emptyPlan(6), 'normal', NOW, 2, false)
    expect(deal(dealt, 'round', NOW + 100, 2, false)).toBe(dealt)
  })

  it('a rest dealt while the round is still in flight waits for its last flower', () => {
    const round = deal(emptyPlan(15), 'round', NOW, 5, false)
    // The round's last flower launches at +1200; the rest starts a step later.
    const rest = deal(round, 'normal', NOW + 500, 5, false)
    expect(rest[5]!.start - NOW).toBe(
      1200 + normalLaunchMs(5, 5) - normalLaunchMs(4, 5),
    )
  })
})

describe('the fast deal and the given answer', () => {
  it('a right tap deals every flower not launched yet, within 790 ms (20 left; Kyle call 4)', () => {
    const plan = deal(emptyPlan(20), 'fast', NOW, 4, false)
    expect(plan[1]!.start - plan[0]!.start).toBe(30)
    expect(plan[0]!.duration).toBe(FAST_FLIGHT_MS)
    expect(msUntilLanded(plan, NOW)).toBe(19 * 30 + 220)
    expect(msUntilLanded(plan, NOW)).toBe(790)
  })

  it('the interval caps at 40 ms for a small pile', () => {
    const plan = deal(emptyPlan(6), 'fast', NOW, 2, false)
    expect(plan[1]!.start - plan[0]!.start).toBe(40)
  })

  it('mid-deal, a right tap re-times only the flowers still in the pile', () => {
    const auto = deal(emptyPlan(6), 'normal', NOW, 2, false)
    const at = NOW + 200 // flowers 0 and 1 have launched
    const fast = deal(auto, 'fast', at, 2, false)
    expect(fast.slice(0, 2)).toEqual(auto.slice(0, 2))
    expect(fast.slice(2).map((f) => f!.start - at)).toEqual([0, 40, 80, 120])
  })

  it('the given answer moves every flower left at once, 200 ms, no arc', () => {
    const round: FlightPlan = deal(emptyPlan(12), 'round', NOW, 3, false)
    const given = deal(round, 'instant', NOW + 1000, 3, false)
    expect(given.slice(0, 3)).toEqual(round.slice(0, 3))
    expect(
      given
        .slice(3)
        .every(
          (f) =>
            f!.start === NOW + 1000 &&
            f!.duration === INSTANT_MS &&
            f!.motion === 'instant',
        ),
    ).toBe(true)
  })

  it('Reduce Motion: fast and given are one 200 ms crossfade for all', () => {
    for (const mode of ['fast', 'instant'] as const) {
      const plan = deal(emptyPlan(8), mode, NOW, 4, true)
      expect(
        plan.every(
          (f) =>
            f!.start === NOW &&
            f!.duration === CROSSFADE_MS &&
            f!.motion === 'fade',
        ),
      ).toBe(true)
    }
  })
})

describe('shareFillEndMs (Kyle call 4: the advance waits for the picture)', () => {
  it('P6, 15 on 5, tapped before any hint: 780 + 100 + 320 + 300 = 1500 ms', () => {
    const plan = deal(emptyPlan(15), 'fast', NOW, 5, false)
    const dealEnd = msUntilLanded(plan, NOW)
    expect(dealEnd).toBe(780)
    expect(shareFillEndMs(dealEnd, 5, false)).toBe(1500)
  })

  it('no flowers left: the fill alone (P1 after its deal: 100 + 80 + 300)', () => {
    expect(shareFillEndMs(0, 2, false)).toBe(480)
  })

  it('Reduce Motion: a 200 ms crossfade deal and a 200 ms tag crossfade', () => {
    const plan = deal(emptyPlan(6), 'fast', NOW, 2, true)
    expect(shareFillEndMs(msUntilLanded(plan, NOW), 2, true)).toBe(
      200 + 80 + 200,
    )
  })
})
