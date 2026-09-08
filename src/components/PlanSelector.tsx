import type { CompensationPlan } from '../types/compensationPlan';

interface PlanSelectorProps {
  plans: CompensationPlan[];
  selectedPlanId: string;
  onChange: (planId: string) => void;
}

/** Dropdown to switch between registered compensation plan PDFs. */
export function PlanSelector({ plans, selectedPlanId, onChange }: PlanSelectorProps) {
  return (
    <select
      value={selectedPlanId}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-canvas-inset px-3 py-1.5 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      aria-label="Select compensation plan"
    >
      {plans.map((plan) => (
        <option key={plan.planId} value={plan.planId}>
          {plan.planName} — {plan.planPeriod.label}
        </option>
      ))}
    </select>
  );
}
