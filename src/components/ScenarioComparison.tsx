import { calculateScenario } from '../engine/planEngine';
import type { CompensationPlan } from '../types/compensationPlan';
import type { SavedScenario } from '../types/scenario';
import { formatCurrency, formatPercent } from '../utils/format';

interface ScenarioComparisonProps {
  plan: CompensationPlan;
  scenarios: SavedScenario[];
  onRemove: (id: string) => void;
}

/** Side-by-side comparison table of every saved what-if scenario, recomputed live against the current plan. */
export function ScenarioComparison({ plan, scenarios, onRemove }: ScenarioComparisonProps) {
  if (scenarios.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-fg-muted">
        No saved scenarios yet. Build a scenario in the What-If Planner and click{' '}
        <span className="font-medium text-fg">"Save scenario"</span> to compare it here.
      </div>
    );
  }

  const results = scenarios.map((scenario) => ({
    scenario,
    result: calculateScenario(plan, scenario.inputs),
  }));

  const rows: { label: string; render: (r: ReturnType<typeof calculateScenario>) => string }[] = [
    { label: 'Quarter / Month', render: (r) => `${r.pipeline.periodLabel} / ${r.sql.periodLabel}` },
    { label: 'Pipeline generated', render: (r) => formatCurrency(r.pipeline.generatedAmount) },
    { label: 'Pipeline attainment', render: (r) => formatPercent(r.pipeline.attainmentPct) },
    { label: 'Pipeline payout', render: (r) => formatCurrency(r.pipeline.totalPayout) },
    { label: 'SQLs generated', render: (r) => `${r.sql.generatedAmount}` },
    { label: 'SQL attainment', render: (r) => formatPercent(r.sql.attainmentPct) },
    { label: 'SQL payout', render: (r) => formatCurrency(r.sql.totalPayout) },
    { label: 'Accelerator impact', render: (r) => formatCurrency(r.totalAcceleratorImpact) },
    { label: 'Total variable comp.', render: (r) => formatCurrency(r.totalVariableCompensation) },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-canvas-subtle">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-fg-muted">Metric</th>
            {results.map(({ scenario }) => (
              <th key={scenario.id} className="p-3 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-fg">{scenario.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(scenario.id)}
                    className="rounded border border-border px-1.5 py-0.5 text-xs text-fg-muted hover:border-danger hover:text-danger"
                    aria-label={`Remove scenario ${scenario.name}`}
                  >
                    ✕
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border-muted last:border-0">
              <td className="p-3 text-xs font-medium text-fg-muted">{row.label}</td>
              {results.map(({ scenario, result }) => (
                <td key={scenario.id} className="p-3 font-mono text-sm text-fg">
                  {row.render(result)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="p-3 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              Total variable comp.
            </td>
            {results.map(({ scenario, result }) => (
              <td key={scenario.id} className="p-3 font-mono text-base font-bold text-success">
                {formatCurrency(result.totalVariableCompensation)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
