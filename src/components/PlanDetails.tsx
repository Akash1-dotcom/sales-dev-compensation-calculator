import type { CompensationPlan } from '../types/compensationPlan';
import { calculateBaseRate } from '../engine/compensationEngine';
import { formatByUnit, formatCurrency, formatPercent } from '../utils/format';

/**
 * Read-only view of every rule extracted from the plan PDF: quotas, TIC
 * weightings, base rates and accelerator tiers per component. Confirms the
 * plan was modeled correctly and doubles as documentation for reviewers.
 */
export function PlanDetails({ plan }: { plan: CompensationPlan }) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-canvas-subtle p-4">
        <h2 className="text-lg font-semibold text-fg">{plan.planName}</h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-fg-muted">Participant</dt>
            <dd className="text-fg">{plan.participant ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Geo</dt>
            <dd className="text-fg">{plan.geo ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Plan period</dt>
            <dd className="text-fg">{plan.planPeriod.label}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Total Plan Period TIC</dt>
            <dd className="font-mono text-fg">{formatCurrency(plan.totalPlanPeriodTIC)}</dd>
          </div>
        </dl>
      </div>

      {plan.components.map((component) => (
        <div key={component.id} className="rounded-lg border border-border bg-canvas-subtle p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-fg">{component.name}</h3>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-fg-muted">
              {component.ticWeightingPct}% of TIC · {component.cadence} quota
            </span>
          </div>
          {component.description && <p className="mt-2 text-sm text-fg-muted">{component.description}</p>}

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-fg-muted">
                  <th className="py-1.5 pr-3 font-medium">Period</th>
                  <th className="py-1.5 pr-3 font-medium">Quota</th>
                  <th className="py-1.5 pr-3 font-medium">Component TIC</th>
                  <th className="py-1.5 pr-3 font-medium">Base rate</th>
                </tr>
              </thead>
              <tbody>
                {component.quotaPeriods.map((period) => {
                  const baseRate = calculateBaseRate(period);
                  return (
                    <tr key={period.id} className="border-b border-border-muted last:border-0">
                      <td className="py-1.5 pr-3">{period.label}</td>
                      <td className="py-1.5 pr-3 font-mono">{formatByUnit(period.quota, component.unit)}</td>
                      <td className="py-1.5 pr-3 font-mono">{formatCurrency(period.componentTIC)}</td>
                      <td className="py-1.5 pr-3 font-mono">
                        {component.unit === 'currency' ? `${(baseRate * 100).toFixed(4)}%` : formatCurrency(baseRate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-muted">Accelerator tiers</p>
            <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              {component.acceleratorTiers.map((tier) => (
                <li key={tier.label} className="rounded border border-border-muted px-2 py-1 font-mono text-xs">
                  {formatPercent(tier.minPct)} – {tier.maxPct === null ? '∞' : formatPercent(tier.maxPct)}:{' '}
                  <span className="text-fg">{tier.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}

      {plan.draw && (
        <div className="rounded-lg border border-border bg-canvas-subtle p-4">
          <h3 className="text-base font-semibold text-fg">Draw Policy</h3>
          <p className="mt-1 text-sm text-fg-muted">
            {plan.draw.recoverable ? 'Recoverable' : 'Non-recoverable'} draw of{' '}
            <span className="font-mono text-fg">{formatCurrency(plan.draw.amount)}</span> over{' '}
            {plan.draw.lengthMonths} months ({plan.draw.startDate} – {plan.draw.endDate}).
          </p>
        </div>
      )}
    </div>
  );
}
