import { describe, expect, it } from 'vitest';
import {
  amountToPct,
  calculateBaseRate,
  calculateComponentResult,
  calculateTieredPayout,
  pctToAmount,
} from '../engine/compensationEngine';
import plan from '../data/plans/github-h1-fy27.plan.json';
import type { CompensationPlan } from '../types/compensationPlan';

const typedPlan = plan as unknown as CompensationPlan;
const pipeline = typedPlan.components.find((c) => c.id === 'pipeline')!;
const sql = typedPlan.components.find((c) => c.id === 'sql')!;

describe('calculateBaseRate', () => {
  it('divides component TIC by component quota', () => {
    expect(calculateBaseRate({ quota: 800000, componentTIC: 1253.54 })).toBeCloseTo(0.00156693, 6);
  });

  it('returns 0 for a zero or negative quota (avoids divide-by-zero)', () => {
    expect(calculateBaseRate({ quota: 0, componentTIC: 500 })).toBe(0);
    expect(calculateBaseRate({ quota: -10, componentTIC: 500 })).toBe(0);
  });

  it('matches the PDF-stated SQL base rate of ~21.43 per SQL', () => {
    const rate = calculateBaseRate({ quota: 13, componentTIC: 278.565 });
    expect(rate).toBeCloseTo(21.43, 1);
  });
});

describe('pctToAmount / amountToPct', () => {
  it('round-trips between percent and absolute amount', () => {
    expect(pctToAmount(50, 800000)).toBe(400000);
    expect(amountToPct(400000, 800000)).toBe(50);
  });

  it('handles a zero quota safely', () => {
    expect(amountToPct(100, 0)).toBe(0);
  });
});

describe('calculateTieredPayout (Pipeline accelerator tiers)', () => {
  const quota = 800000;
  const baseRate = 1253.54 / quota;

  it('pays base rate only when at or under 100% of quota', () => {
    const { totalPayout, breakdown } = calculateTieredPayout(400000, quota, baseRate, pipeline.acceleratorTiers);
    expect(totalPayout).toBeCloseTo(400000 * baseRate, 6);
    // Only tier 0 (0-100%) should have any amount in it.
    expect(breakdown[0].amountInTier).toBeCloseTo(400000, 6);
    expect(breakdown.slice(1).every((row) => row.amountInTier === 0)).toBe(true);
  });

  it('applies the 110% accelerator pro-rata between 100% and 200% of quota', () => {
    // 150% of quota => 100% at base rate + 50% at 110% base rate.
    const generated = quota * 1.5;
    const { totalPayout, breakdown } = calculateTieredPayout(generated, quota, baseRate, pipeline.acceleratorTiers);
    const expected = quota * baseRate + quota * 0.5 * (baseRate * 1.1);
    expect(totalPayout).toBeCloseTo(expected, 4);
    expect(breakdown[1].amountInTier).toBeCloseTo(quota * 0.5, 4);
  });

  it('applies the 125% tier between 200% and 250%, then drops back to 100% above 250%', () => {
    const generated = quota * 3; // 300% of quota
    const { totalPayout } = calculateTieredPayout(generated, quota, baseRate, pipeline.acceleratorTiers);
    const tier0 = quota * baseRate; // 0-100%
    const tier1 = quota * 1.0 * (baseRate * 1.1); // 100-200%
    const tier2 = quota * 0.5 * (baseRate * 1.25); // 200-250%
    const tier3 = quota * 0.5 * (baseRate * 1.0); // 250-300%
    expect(totalPayout).toBeCloseTo(tier0 + tier1 + tier2 + tier3, 4);
  });

  it('pays nothing for zero generated amount', () => {
    const { totalPayout } = calculateTieredPayout(0, quota, baseRate, pipeline.acceleratorTiers);
    expect(totalPayout).toBe(0);
  });
});

describe('calculateTieredPayout (SQL accelerator tiers)', () => {
  const quota = 13;
  const baseRate = 278.565 / quota;

  it('applies the 130% tier for attainment between 150% and 400%', () => {
    const generated = 20; // ~153.8% of quota (13)
    const { totalPayout } = calculateTieredPayout(generated, quota, baseRate, sql.acceleratorTiers);
    const tier0 = 13 * baseRate; // 0-100% (13 SQLs)
    const tier1 = 13 * 0.25 * (baseRate * 1.1); // 100-125% (3.25 SQLs)
    const tier2 = 13 * 0.25 * (baseRate * 1.2); // 125-150% (3.25 SQLs)
    const remaining = generated - quota * 1.5; // amount above 150%
    const tier3 = remaining * (baseRate * 1.3);
    expect(totalPayout).toBeCloseTo(tier0 + tier1 + tier2 + tier3, 4);
  });
});

describe('calculateComponentResult (Pipeline)', () => {
  it('computes attainment %, payout, remaining-to-quota and at-target payout for Q1', () => {
    const result = calculateComponentResult(pipeline, 'Q1', 800000);
    expect(result.attainmentPct).toBeCloseTo(100, 6);
    expect(result.remainingToQuota).toBe(0);
    expect(result.totalPayout).toBeCloseTo(1253.54, 2);
    expect(result.payoutAtTarget).toBeCloseTo(1253.54, 2);
  });

  it('reports the next tier and the amount needed to reach it when under quota', () => {
    const result = calculateComponentResult(pipeline, 'Q1', 400000);
    expect(result.attainmentPct).toBeCloseTo(50, 6);
    expect(result.remainingToQuota).toBe(400000);
    expect(result.nextTier).not.toBeNull();
    expect(result.nextTier?.minPct).toBeCloseTo(100.01, 2);
    expect(result.nextTier?.amountToReach).toBeCloseTo(400080, 0);
  });

  it('returns null nextTier once the final unbounded tier is reached', () => {
    const result = calculateComponentResult(pipeline, 'Q1', 800000 * 3);
    expect(result.nextTier).toBeNull();
  });

  it('throws a descriptive error for an unknown period id', () => {
    expect(() => calculateComponentResult(pipeline, 'Q9', 1000)).toThrow(/Period "Q9" not found/);
  });
});

describe('calculateComponentResult (SQL)', () => {
  it('computes monthly SQL attainment and payout for a specific month', () => {
    const result = calculateComponentResult(sql, '2026-07', 13);
    expect(result.attainmentPct).toBeCloseTo(100, 6);
    expect(result.totalPayout).toBeCloseTo(278.565, 2);
  });

  it('accelerates payout once SQLs generated exceed the monthly quota', () => {
    const result = calculateComponentResult(sql, '2026-07', 16); // ~123% of quota
    expect(result.attainmentPct).toBeGreaterThan(100);
    expect(result.totalPayout).toBeGreaterThan(16 * (278.565 / 13));
  });
});
