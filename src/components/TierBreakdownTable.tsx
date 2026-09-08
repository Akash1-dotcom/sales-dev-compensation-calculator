import type { ComponentCalculationResult } from '../engine/compensationEngine';
import { formatByUnit, formatCurrency, formatPercent } from '../utils/format';

/**
 * Shows every calculation step for one component: base rate derivation,
 * then each accelerator tier's range, effective rate, amount inside the
 * tier, and the payout it contributed - so the math is fully auditable.
 */
export function TierBreakdownTable({ result }: { result: ComponentCalculationResult }) {
  return (
    <div className="rounded-lg border border-border bg-canvas-subtle p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">
          {result.componentName} — {result.periodLabel}
        </h3>
        <span className="text-xs text-fg-muted">
          Base Rate = {formatCurrency(result.componentTIC)} TIC ÷ {formatByUnit(result.quota, result.unit)} quota ={' '}
          {result.unit === 'currency' ? `${(result.baseRate * 100).toFixed(4)}%` : formatCurrency(result.baseRate)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-fg-muted">
              <th className="py-2 pr-3 font-medium">Tier</th>
              <th className="py-2 pr-3 font-medium">% to quota range</th>
              <th className="py-2 pr-3 font-medium">Amount range</th>
              <th className="py-2 pr-3 font-medium">Effective rate</th>
              <th className="py-2 pr-3 font-medium">Amount in tier</th>
              <th className="py-2 pr-3 text-right font-medium">Payout</th>
            </tr>
          </thead>
          <tbody>
            {result.breakdown.map((row) => (
              <tr
                key={row.tierIndex}
                className={`border-b border-border-muted last:border-0 ${
                  row.amountInTier > 0 ? 'text-fg' : 'text-fg-subtle'
                }`}
              >
                <td className="py-2 pr-3">{row.label}</td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {formatPercent(row.minPct)} – {row.maxPct === null ? '∞' : formatPercent(row.maxPct)}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {formatByUnit(row.rangeStart, result.unit)} –{' '}
                  {row.rangeEnd === null ? '∞' : formatByUnit(row.rangeEnd, result.unit)}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {result.unit === 'currency'
                    ? `${(row.effectiveRate * 100).toFixed(4)}%`
                    : formatCurrency(row.effectiveRate)}{' '}
                  <span className="text-fg-subtle">({row.multiplier.toFixed(2)}x)</span>
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{formatByUnit(row.amountInTier, result.unit)}</td>
                <td className="py-2 pr-3 text-right font-mono text-xs font-semibold">
                  {formatCurrency(row.payout)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="pt-3 text-right text-xs font-medium uppercase tracking-wide text-fg-muted">
                Total payout
              </td>
              <td className="pt-3 text-right font-mono text-sm font-bold text-success">
                {formatCurrency(result.totalPayout)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
