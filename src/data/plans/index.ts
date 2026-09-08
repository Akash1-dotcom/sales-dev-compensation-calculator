/**
 * Compensation Plan Registry
 * ==========================
 * To support a NEW compensation plan PDF, you do not need to touch any
 * calculation or UI code:
 *   1. Extract its rules into a JSON file matching `CompensationPlan`
 *      (see src/types/compensationPlan.ts for the schema, and
 *      github-h1-fy27.plan.json for a worked example).
 *   2. Drop the JSON file in this folder.
 *   3. Import + register it in the `PLANS` array below.
 * The plan then appears automatically in the plan selector, and every
 * calculation, chart, and comparison in the app is driven from its data.
 */
import type { CompensationPlan } from '../../types/compensationPlan';
import githubH1FY27 from './github-h1-fy27.plan.json';

export const PLANS: CompensationPlan[] = [githubH1FY27 as unknown as CompensationPlan];

export function getPlanById(planId: string): CompensationPlan | undefined {
  return PLANS.find((p) => p.planId === planId);
}

export const DEFAULT_PLAN_ID = PLANS[0]?.planId ?? '';
