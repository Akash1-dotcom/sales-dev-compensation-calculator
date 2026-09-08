import type { CompensationPlan } from '../types/compensationPlan';
import type { ScenarioInputs } from '../engine/planEngine';

interface ScenarioFormProps {
  plan: CompensationPlan;
  inputs: ScenarioInputs;
  onChange: (inputs: ScenarioInputs) => void;
}

/**
 * The single, reusable inputs form: Quarter, Month, Pipeline generated,
 * SQLs generated. Selecting a quarter narrows the month dropdown to the
 * months that roll up to it (per the plan's `months` mapping), and vice
 * versa - matching how Pipeline (quarterly) and SQL (monthly) quotas are
 * defined in the source PDF.
 */
export function ScenarioForm({ plan, inputs, onChange }: ScenarioFormProps) {
  const monthsInQuarter = plan.months.filter((m) => m.quarterId === inputs.quarterId);

  const handleQuarterChange = (quarterId: string) => {
    const stillValid = monthsInQuarterFor(quarterId).some((m) => m.id === inputs.monthId);
    onChange({
      ...inputs,
      quarterId,
      monthId: stillValid ? inputs.monthId : monthsInQuarterFor(quarterId)[0]?.id ?? inputs.monthId,
    });
  };

  function monthsInQuarterFor(quarterId: string) {
    return plan.months.filter((m) => m.quarterId === quarterId);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-fg-muted" htmlFor="quarter">
          Quarter
        </label>
        <select
          id="quarter"
          className="w-full rounded-md border border-border bg-canvas-inset px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          value={inputs.quarterId}
          onChange={(e) => handleQuarterChange(e.target.value)}
        >
          {plan.quarters.map((q) => (
            <option key={q.id} value={q.id}>
              {q.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-fg-muted" htmlFor="month">
          Month
        </label>
        <select
          id="month"
          className="w-full rounded-md border border-border bg-canvas-inset px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          value={inputs.monthId}
          onChange={(e) => onChange({ ...inputs, monthId: e.target.value })}
        >
          {monthsInQuarter.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-fg-muted" htmlFor="pipelineGenerated">
          Pipeline generated ($)
        </label>
        <input
          id="pipelineGenerated"
          type="number"
          min={0}
          step={1000}
          className="w-full rounded-md border border-border bg-canvas-inset px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          value={inputs.pipelineGenerated}
          onChange={(e) => onChange({ ...inputs, pipelineGenerated: Number(e.target.value) || 0 })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-fg-muted" htmlFor="sqlGenerated">
          SQLs generated (count)
        </label>
        <input
          id="sqlGenerated"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className="w-full rounded-md border border-border bg-canvas-inset px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          value={inputs.sqlGenerated}
          onChange={(e) => onChange({ ...inputs, sqlGenerated: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
        />
      </div>
    </div>
  );
}
