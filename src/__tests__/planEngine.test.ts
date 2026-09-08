import { describe, expect, it } from 'vitest';
import { calculateScenario, generatePayoutCurve } from '../engine/planEngine';
import plan from '../data/plans/github-h1-fy27.plan.json';
import type { CompensationPlan } from '../types/compensationPlan';

const typedPlan = plan as unknown as CompensationPlan;

describe('calculateScenario', () => {
  it('combines pipeline + SQL results into a single scenario at exactly-on-target', () => {
    const result = calculateScenario(typedPlan, {
      quarterId: 'Q1',
      monthId: '2026-07',
      pipelineGenerated: 800000,
      sqlGenerated: 13,
    });

    expect(result.pipeline.attainmentPct).toBeCloseTo(100, 6);
    expect(result.sql.attainmentPct).toBeCloseTo(100, 6);
    expect(result.totalVariableCompensation).toBeCloseTo(1253.54 + 278.565, 2);
    // At exactly 100% attainment there is no accelerator benefit.
    expect(result.totalAcceleratorImpact).toBeCloseTo(0, 6);
    expect(result.totalPayoutAtTarget).toBeCloseTo(result.totalVariableCompensation, 2);
  });

  it('produces a positive accelerator impact once both components exceed quota', () => {
    const result = calculateScenario(typedPlan, {
      quarterId: 'Q1',
      monthId: '2026-07',
      pipelineGenerated: 1200000, // 150% of pipeline quota
      sqlGenerated: 18, // ~138% of SQL quota
    });

    expect(result.pipelineAcceleratorImpact).toBeGreaterThan(0);
    expect(result.sqlAcceleratorImpact).toBeGreaterThan(0);
    expect(result.totalAcceleratorImpact).toBeCloseTo(
      result.pipelineAcceleratorImpact + result.sqlAcceleratorImpact,
      6,
    );
  });

  it('scopes quota/TIC to the selected quarter and month independently', () => {
    const q1 = calculateScenario(typedPlan, {
      quarterId: 'Q1',
      monthId: '2026-09',
      pipelineGenerated: 800000,
      sqlGenerated: 13,
    });
    const q2 = calculateScenario(typedPlan, {
      quarterId: 'Q2',
      monthId: '2026-10',
      pipelineGenerated: 800000,
      sqlGenerated: 13,
    });
    // Both quarters share identical quotas in this plan, so payouts match,
    // but the period labels/ids must reflect the selection made.
    expect(q1.pipeline.periodId).toBe('Q1');
    expect(q2.pipeline.periodId).toBe('Q2');
    expect(q1.pipeline.totalPayout).toBeCloseTo(q2.pipeline.totalPayout, 6);
  });

  it('throws when an unknown component id is requested via period lookup', () => {
    expect(() =>
      calculateScenario(typedPlan, {
        quarterId: 'Q1',
        monthId: 'not-a-real-month',
        pipelineGenerated: 100,
        sqlGenerated: 5,
      }),
    ).toThrow();
  });
});

describe('generatePayoutCurve', () => {
  it('produces a monotonically non-decreasing payout curve for Pipeline', () => {
    const pipeline = typedPlan.components.find((c) => c.id === 'pipeline')!;
    const curve = generatePayoutCurve(pipeline, 'Q1', 300, 30);
    expect(curve.length).toBe(31);
    for (let i = 1; i < curve.length; i += 1) {
      expect(curve[i].payout).toBeGreaterThanOrEqual(curve[i - 1].payout);
    }
  });

  it('returns an empty array for an unknown period id', () => {
    const pipeline = typedPlan.components.find((c) => c.id === 'pipeline')!;
    expect(generatePayoutCurve(pipeline, 'unknown', 100, 10)).toEqual([]);
  });
});
