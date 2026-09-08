import type { ScenarioResult } from '../engine/planEngine';
import { formatCurrency, formatPercent, formatByUnit } from '../utils/format';

interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'default' | 'success' | 'attention';
}

function MetricCard({ label, value, sublabel, tone = 'default' }: MetricCardProps) {
  const toneClass =
    tone === 'success' ? 'text-success' : tone === 'attention' ? 'text-attention' : 'text-fg';
  return (
    <div className="rounded-md border border-border-muted bg-canvas-subtle/60 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${toneClass}`}>{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-fg-subtle">{sublabel}</p>}
    </div>
  );
}

/**
 * Renders every output metric required by the compensation calculator:
 * Pipeline/SQL attainment %, Pipeline/SQL payout, accelerator impact,
 * total variable compensation, remaining-to-quota, at-target earnings and
 * next-tier earnings.
 */
export function MetricsGrid({ result }: { result: ScenarioResult }) {
  const { pipeline, sql } = result;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <MetricCard
        label="Pipeline attainment"
        value={formatPercent(pipeline.attainmentPct)}
        sublabel={`${formatCurrency(pipeline.generatedAmount)} of ${formatCurrency(pipeline.quota)} quota`}
        tone={pipeline.attainmentPct >= 100 ? 'success' : 'default'}
      />
      <MetricCard
        label="SQL attainment"
        value={formatPercent(sql.attainmentPct)}
        sublabel={`${formatByUnit(sql.generatedAmount, 'count')} of ${formatByUnit(sql.quota, 'count')} quota`}
        tone={sql.attainmentPct >= 100 ? 'success' : 'default'}
      />
      <MetricCard label="Pipeline payout" value={formatCurrency(pipeline.totalPayout)} />
      <MetricCard label="SQL payout" value={formatCurrency(sql.totalPayout)} />
      <MetricCard
        label="Accelerator impact"
        value={formatCurrency(result.totalAcceleratorImpact)}
        sublabel="Extra $ earned above flat base rate"
        tone={result.totalAcceleratorImpact > 0 ? 'success' : 'default'}
      />
      <MetricCard
        label="Total variable comp."
        value={formatCurrency(result.totalVariableCompensation)}
        sublabel="Pipeline payout + SQL payout"
      />
      <MetricCard
        label="Remaining to quota"
        value={`${formatCurrency(pipeline.remainingToQuota)} / ${formatByUnit(sql.remainingToQuota, 'count')}`}
        sublabel="Pipeline / SQL"
        tone={pipeline.remainingToQuota === 0 && sql.remainingToQuota === 0 ? 'success' : 'attention'}
      />
      <MetricCard
        label="Estimated earnings at target"
        value={formatCurrency(result.totalPayoutAtTarget)}
        sublabel="If both components land at exactly 100% of quota"
      />
      <MetricCard
        label="Earnings at next tier"
        value={formatCurrency(
          (pipeline.nextTier?.projectedPayoutAtNextTier ?? pipeline.totalPayout) +
            (sql.nextTier?.projectedPayoutAtNextTier ?? sql.totalPayout),
        )}
        sublabel={
          pipeline.nextTier || sql.nextTier
            ? [
                pipeline.nextTier ? `Pipeline: ${pipeline.nextTier.label}` : null,
                sql.nextTier ? `SQL: ${sql.nextTier.label}` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Already in the highest accelerator tier'
        }
      />
    </div>
  );
}
