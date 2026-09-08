/**
 * Storage for user-uploaded compensation plans (parsed from PDFs). These
 * are kept in localStorage - separate from the bundled plans shipped in
 * `src/data/plans` - so uploading a new team's plan never requires a code
 * change or rebuild.
 */
import type { CompensationPlan } from '../types/compensationPlan';

const STORAGE_KEY = 'comp-calc:custom-plans';

export function loadCustomPlans(): CompensationPlan[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CompensationPlan[];
  } catch {
    return [];
  }
}

export function saveCustomPlan(plan: CompensationPlan): CompensationPlan[] {
  const existing = loadCustomPlans().filter((p) => p.planId !== plan.planId);
  const next = [...existing, plan];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeCustomPlan(planId: string): CompensationPlan[] {
  const next = loadCustomPlans().filter((p) => p.planId !== planId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
