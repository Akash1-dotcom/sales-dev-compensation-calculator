/**
 * Compensation Plan Registry
 * ==========================
 * This app ships with NO bundled/demo compensation plan — every team's plan
 * is supplied by uploading their compensation PDF in the app (parsed by
 * `src/engine/pdfPlanParser.ts` and stored locally, see
 * `src/data/customPlans.ts`). `github-h1-fy27.plan.json` is kept only as a
 * reference fixture for the calculation-engine unit tests; it is
 * intentionally NOT exported here so it never appears in the app itself.
 */
import type { CompensationPlan } from '../../types/compensationPlan';

export const PLANS: CompensationPlan[] = [];

export function getPlanById(planId: string): CompensationPlan | undefined {
  return PLANS.find((p) => p.planId === planId);
}

export const DEFAULT_PLAN_ID = PLANS[0]?.planId ?? '';
