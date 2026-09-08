/**
 * Generic, PDF-agnostic data model for a GitHub-style Revenue Compensation
 * Exhibit. Every numeric rule extracted from a compensation plan PDF
 * (quotas, TIC weightings, base rates, accelerator tiers, draws, etc.)
 * is represented here as data, NOT code, so that:
 *   1. The calculation engine (src/engine) never hard-codes plan specifics.
 *   2. A brand new plan PDF (different quotas/accelerators/components) can
 *      be supported by dropping a new JSON file in src/data/plans and
 *      selecting it in the UI - no code changes required.
 */

/** The unit a component's quota/generated-amount is measured in. */
export type ComponentUnit = 'currency' | 'count';

/** How often a component's quota resets. */
export type ComponentCadence = 'quarterly' | 'monthly' | 'annual';

/**
 * One row of an accelerator rate table, e.g.
 * "100.01% - 200.00% => 110% x Base Rate".
 * Percent bounds are expressed as % of quota (100 = 100% of quota).
 * `maxPct === null` means the tier is unbounded ("250.01%+").
 */
export interface AcceleratorTier {
  minPct: number;
  maxPct: number | null;
  /** Multiplier applied to the component's base rate within this tier. */
  multiplier: number;
  /** Human readable label as printed in the PDF, e.g. "110% x Base Rate". */
  label: string;
}

/**
 * A quota + TIC allocation for one recurring period of a component
 * (e.g. "Q1" and "Q2" can each have their own quota/TIC even though they
 * belong to the same component).
 */
export interface QuotaPeriod {
  /** Period identifier, e.g. "Q1", "Q2", or a month name. */
  id: string;
  /** Display label, e.g. "Quarter 1". */
  label: string;
  quota: number;
  componentTIC: number;
}

/**
 * One compensable Plan Component (e.g. "Sourced Pipeline",
 * "Sales Qualified Leads (SQL)").
 */
export interface PlanComponent {
  id: string;
  name: string;
  description?: string;
  unit: ComponentUnit;
  cadence: ComponentCadence;
  /** % of Total Plan Period TIC this component represents. */
  ticWeightingPct: number;
  /**
   * One or more recurring periods for this component. Sourced Pipeline has
   * one QuotaPeriod per quarter; SQL has one QuotaPeriod per month.
   */
  quotaPeriods: QuotaPeriod[];
  /** Accelerator rate table applied once attainment exceeds 100% of quota. */
  acceleratorTiers: AcceleratorTier[];
}

/** Optional new-hire non-recoverable draw policy. */
export interface DrawPolicy {
  lengthMonths: number;
  startDate: string;
  endDate: string;
  amount: number;
  recoverable: boolean;
}

/** The root object describing one compensation plan PDF. */
export interface CompensationPlan {
  planId: string;
  planName: string;
  participant?: string;
  geo?: string;
  currency: string;
  planPeriod: {
    label: string;
    start: string;
    end: string;
  };
  totalPlanPeriodTIC: number;
  /** Ordered list of quarter ids available for selection, e.g. ["Q1","Q2"]. */
  quarters: { id: string; label: string }[];
  /** Ordered list of months, each tagged with the quarter it rolls up to. */
  months: { id: string; label: string; quarterId: string }[];
  components: PlanComponent[];
  draw?: DrawPolicy;
}
