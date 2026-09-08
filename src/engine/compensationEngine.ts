/**
 * Compensation Calculation Engine
 * ================================
 * Pure, side-effect-free functions that implement the payout logic
 * described in a GitHub Revenue Compensation Exhibit:
 *
 *   1. Base Rate % = Component TIC / Component Quota            (per period)
 *   2. Base Rate is applied to the generated amount up to 100% of quota.
 *   3. Once attainment exceeds 100% of quota, an Accelerator Tier table
 *      is applied PRO-RATA: each dollar/unit generated is paid at the rate
 *      of the tier its cumulative attainment % falls into. Tiers do not
 *      retroactively re-rate amounts already paid in a lower tier.
 *
 * This module knows nothing about "Pipeline" or "SQL" specifically - it
 * operates purely on the generic `PlanComponent` / `AcceleratorTier` shapes
 * in `src/types/compensationPlan.ts`, so it works unmodified for any future
 * compensation plan JSON with different quotas, weightings or tiers.
 */
import type { AcceleratorTier, PlanComponent, QuotaPeriod } from '../types/compensationPlan';

/** One row of a component's tiered payout breakdown, for the "show every calculation step" UI. */
export interface TierBreakdownRow {
  tierIndex: number;
  label: string;
  /** Lower/upper bound of this tier, expressed as % of quota. */
  minPct: number;
  maxPct: number | null;
  /** Lower/upper bound of this tier, expressed in quota units (currency or count). */
  rangeStart: number;
  rangeEnd: number | null;
  /** Portion of the generated amount that falls inside this tier. */
  amountInTier: number;
  /** Effective rate for this tier (baseRate * tier multiplier). */
  effectiveRate: number;
  multiplier: number;
  /** Payout contributed by this tier. */
  payout: number;
}

export interface ComponentCalculationResult {
  componentId: string;
  componentName: string;
  periodId: string;
  periodLabel: string;
  unit: PlanComponent['unit'];
  quota: number;
  componentTIC: number;
  /** Component TIC / Component Quota, as defined by the plan. */
  baseRate: number;
  generatedAmount: number;
  attainmentPct: number;
  totalPayout: number;
  remainingToQuota: number;
  breakdown: TierBreakdownRow[];
  /** Payout if the rep lands exactly at 100% of quota (no accelerator). */
  payoutAtTarget: number;
  /** Info about the next accelerator tier the rep has not yet reached, if any. */
  nextTier: {
    label: string;
    minPct: number;
    amountToReach: number;
    projectedPayoutAtNextTier: number;
  } | null;
}

/**
 * Component Base Rate = Component TIC / Component Quota.
 * Works identically whether the quota is dollar-denominated (Pipeline) or
 * unit-denominated (SQL count) - the resulting rate is "$ earned per unit
 * of quota", which is exactly how the PDF defines it.
 */
export function calculateBaseRate(quotaPeriod: Pick<QuotaPeriod, 'quota' | 'componentTIC'>): number {
  if (quotaPeriod.quota <= 0) return 0;
  return quotaPeriod.componentTIC / quotaPeriod.quota;
}

/** Convert a % of quota into an absolute amount in the component's unit. */
export function pctToAmount(pct: number, quota: number): number {
  return (pct / 100) * quota;
}

/** Convert an absolute amount into a % of quota. */
export function amountToPct(amount: number, quota: number): number {
  if (quota <= 0) return 0;
  return (amount / quota) * 100;
}

/**
 * Splits a generated amount across the accelerator tier table and computes
 * the payout contributed by each tier ("pro-rata" application described in
 * the PDF). Returns a full breakdown suitable for a "show every calculation
 * step" UI, plus the summed total payout.
 */
export function calculateTieredPayout(
  generatedAmount: number,
  quota: number,
  baseRate: number,
  tiers: AcceleratorTier[],
): { breakdown: TierBreakdownRow[]; totalPayout: number } {
  const breakdown: TierBreakdownRow[] = [];
  let remaining = Math.max(generatedAmount, 0);
  let totalPayout = 0;

  const sortedTiers = [...tiers].sort((a, b) => a.minPct - b.minPct);

  // PDF tier tables are printed as human-readable, non-overlapping bands
  // (e.g. "0.00%-100.00%" then "100.01%-200.00%"). Taken literally, the
  // 0.01 percentage-point gap between bands would leave a sliver of the
  // generated amount unrated. We treat tiers as contiguous instead: each
  // tier's effective start is exactly where the previous tier ended, so
  // every dollar/unit generated is rated by exactly one tier with no gaps
  // or overlaps, while still preserving the printed labels for display.
  let previousEndPct = 0;

  sortedTiers.forEach((tier, index) => {
    const startPct = index === 0 ? tier.minPct : previousEndPct;
    const endPct = tier.maxPct;
    previousEndPct = endPct ?? previousEndPct;

    const rangeStart = pctToAmount(startPct, quota);
    const rangeEnd = endPct === null ? null : pctToAmount(endPct, quota);
    const tierCapacity = rangeEnd === null ? Infinity : Math.max(rangeEnd - rangeStart, 0);

    // Amount of the generated total that falls within this tier's window.
    const amountAboveStart = Math.max(generatedAmount - rangeStart, 0);
    const amountInTier = Math.min(amountAboveStart, tierCapacity, remaining);

    const effectiveRate = baseRate * tier.multiplier;
    const payout = amountInTier * effectiveRate;
    totalPayout += payout;
    remaining -= amountInTier;

    breakdown.push({
      tierIndex: index,
      label: tier.label,
      minPct: startPct,
      maxPct: endPct,
      rangeStart,
      rangeEnd,
      amountInTier,
      effectiveRate,
      multiplier: tier.multiplier,
      payout,
    });
  });

  return { breakdown, totalPayout };
}

/**
 * Runs the full payout calculation for a single Plan Component in a single
 * period (e.g. Pipeline in Q1, or SQL in a given month), including
 * attainment %, remaining-to-quota, at-target projection and next-tier
 * projection.
 */
export function calculateComponentResult(
  component: PlanComponent,
  periodId: string,
  generatedAmount: number,
): ComponentCalculationResult {
  const period = component.quotaPeriods.find((p) => p.id === periodId);
  if (!period) {
    throw new Error(
      `Period "${periodId}" not found for component "${component.id}". ` +
        `Available periods: ${component.quotaPeriods.map((p) => p.id).join(', ')}`,
    );
  }

  const baseRate = calculateBaseRate(period);
  const attainmentPct = amountToPct(generatedAmount, period.quota);
  const { breakdown, totalPayout } = calculateTieredPayout(
    generatedAmount,
    period.quota,
    baseRate,
    component.acceleratorTiers,
  );

  // Earnings if the rep lands exactly at 100% of quota (base rate only).
  const { totalPayout: payoutAtTarget } = calculateTieredPayout(
    period.quota,
    period.quota,
    baseRate,
    component.acceleratorTiers,
  );

  const sortedTiers = [...component.acceleratorTiers].sort((a, b) => a.minPct - b.minPct);
  const nextTierDef = sortedTiers.find((t) => t.minPct > attainmentPct);
  let nextTier: ComponentCalculationResult['nextTier'] = null;
  if (nextTierDef) {
    const amountToReach = pctToAmount(nextTierDef.minPct, period.quota) - generatedAmount;
    const { totalPayout: projectedPayoutAtNextTier } = calculateTieredPayout(
      pctToAmount(nextTierDef.minPct, period.quota),
      period.quota,
      baseRate,
      component.acceleratorTiers,
    );
    nextTier = {
      label: nextTierDef.label,
      minPct: nextTierDef.minPct,
      amountToReach: Math.max(amountToReach, 0),
      projectedPayoutAtNextTier,
    };
  }

  return {
    componentId: component.id,
    componentName: component.name,
    periodId: period.id,
    periodLabel: period.label,
    unit: component.unit,
    quota: period.quota,
    componentTIC: period.componentTIC,
    baseRate,
    generatedAmount,
    attainmentPct,
    totalPayout,
    remainingToQuota: Math.max(period.quota - generatedAmount, 0),
    breakdown,
    payoutAtTarget,
    nextTier,
  };
}
