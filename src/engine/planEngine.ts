/**
 * Plan-level orchestration on top of `compensationEngine`.
 * Combines the Pipeline (quarterly) and SQL (monthly) components into the
 * single "scenario result" the UI renders: attainment %, payout, accelerator
 * impact, remaining-to-quota, at-target and next-tier projections, and a
 * grand total of variable compensation earned across both components.
 */
import type { CompensationPlan, PlanComponent } from '../types/compensationPlan';
import { calculateComponentResult, type ComponentCalculationResult } from './compensationEngine';

/** Raw user inputs collected from the calculator / what-if form. */
export interface ScenarioInputs {
  /** Selected quarter id, e.g. "Q1". Drives which Pipeline quota/TIC applies. */
  quarterId: string;
  /** Selected month id, e.g. "2026-07". Drives which SQL quota/TIC applies. */
  monthId: string;
  pipelineGenerated: number;
  sqlGenerated: number;
}

export interface ScenarioResult {
  inputs: ScenarioInputs;
  pipeline: ComponentCalculationResult;
  sql: ComponentCalculationResult;
  /** Extra $ earned solely due to accelerator tiers beating a flat base rate. */
  pipelineAcceleratorImpact: number;
  sqlAcceleratorImpact: number;
  totalAcceleratorImpact: number;
  totalVariableCompensation: number;
  totalPayoutAtTarget: number;
}

function findComponent(plan: CompensationPlan, id: string): PlanComponent {
  const component = plan.components.find((c) => c.id === id);
  if (!component) throw new Error(`Component "${id}" not found in plan "${plan.planId}"`);
  return component;
}

/**
 * "Accelerator impact" = the amount earned above what a flat (non-tiered)
 * base rate would have paid on the same generated amount. This isolates
 * how much of the payout came purely from exceeding quota and unlocking
 * higher tiers.
 */
function acceleratorImpact(result: ComponentCalculationResult): number {
  const flatPayout = result.generatedAmount * result.baseRate;
  return result.totalPayout - flatPayout;
}

/** Runs both components for a given set of scenario inputs. */
export function calculateScenario(plan: CompensationPlan, inputs: ScenarioInputs): ScenarioResult {
  const pipelineComponent = findComponent(plan, 'pipeline');
  const sqlComponent = findComponent(plan, 'sql');

  const pipeline = calculateComponentResult(pipelineComponent, inputs.quarterId, inputs.pipelineGenerated);
  const sql = calculateComponentResult(sqlComponent, inputs.monthId, inputs.sqlGenerated);

  const pipelineAcceleratorImpact = acceleratorImpact(pipeline);
  const sqlAcceleratorImpact = acceleratorImpact(sql);

  return {
    inputs,
    pipeline,
    sql,
    pipelineAcceleratorImpact,
    sqlAcceleratorImpact,
    totalAcceleratorImpact: pipelineAcceleratorImpact + sqlAcceleratorImpact,
    totalVariableCompensation: pipeline.totalPayout + sql.totalPayout,
    totalPayoutAtTarget: pipeline.payoutAtTarget + sql.payoutAtTarget,
  };
}

/** Generates the (attainment %, payout) curve for a component, for charting payout vs. attainment. */
export function generatePayoutCurve(
  component: PlanComponent,
  periodId: string,
  maxPct = 300,
  steps = 60,
): { pct: number; payout: number }[] {
  const period = component.quotaPeriods.find((p) => p.id === periodId);
  if (!period) return [];
  const points: { pct: number; payout: number }[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const pct = (maxPct / steps) * i;
    const amount = (pct / 100) * period.quota;
    const { totalPayout } = calculateComponentResult(component, periodId, amount);
    points.push({ pct, payout: totalPayout });
  }
  return points;
}
