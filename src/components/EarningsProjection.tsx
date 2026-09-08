import { useMemo, useState } from 'react';
import { calculateComponentResult, pctToAmount } from '../engine/compensationEngine';
import type { PlanComponent } from '../types/compensationPlan';
import { formatByUnit, formatCurrency, formatPercent } from '../utils/format';

interface EarningsProjectionProps {
  pipelineComponent: PlanComponent;
  sqlComponent: PlanComponent;
  quarterId: string;
  monthId: string;
}

/**
 * Earnings projection calculator: lets the rep drag independent "what if I
 * land at X% of quota" sliders for Pipeline and SQL and immediately see the
 * projected payout for each, without touching the main scenario inputs.
 */
export function EarningsProjection({ pipelineComponent, sqlComponent, quarterId, monthId }: EarningsProjectionProps) {
  const [pipelinePct, setPipelinePct] = useState(100);
  const [sqlPct, setSqlPct] = useState(100);

  const pipelinePeriod = pipelineComponent.quotaPeriods.find((p) => p.id === quarterId);
  const sqlPeriod = sqlComponent.quotaPeriods.find((p) => p.id === monthId);

  const pipelineProjection = useMemo(() => {
    if (!pipelinePeriod) return null;
    const amount = pctToAmount(pipelinePct, pipelinePeriod.quota);
    return calculateComponentResult(pipelineComponent, quarterId, amount);
  }, [pipelineComponent, quarterId, pipelinePct, pipelinePeriod]);

  const sqlProjection = useMemo(() => {
    if (!sqlPeriod) return null;
    const amount = pctToAmount(sqlPct, sqlPeriod.quota);
    return calculateComponentResult(sqlComponent, monthId, amount);
  }, [sqlComponent, monthId, sqlPct, sqlPeriod]);

  return (
    <div className="rounded-lg border border-border bg-canvas-subtle p-4">
      <h3 className="mb-1 text-sm font-semibold text-fg">Earnings Projection Calculator</h3>
      <p className="mb-4 text-xs text-fg-muted">
        Drag each slider to a hypothetical attainment % to project earnings independently of the main inputs above.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-fg-muted">
            <span>Pipeline attainment</span>
            <span className="font-mono text-fg">{formatPercent(pipelinePct)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={300}
            step={1}
            value={pipelinePct}
            onChange={(e) => setPipelinePct(Number(e.target.value))}
            className="w-full accent-accent"
          />
          {pipelinePeriod && (
            <p className="mt-2 text-xs text-fg-subtle">
              {formatByUnit(pctToAmount(pipelinePct, pipelinePeriod.quota), 'currency')} generated
            </p>
          )}
          <p className="mt-1 text-xl font-semibold text-success">
            {formatCurrency(pipelineProjection?.totalPayout ?? 0)}
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-fg-muted">
            <span>SQL attainment</span>
            <span className="font-mono text-fg">{formatPercent(sqlPct)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={400}
            step={1}
            value={sqlPct}
            onChange={(e) => setSqlPct(Number(e.target.value))}
            className="w-full accent-accent"
          />
          {sqlPeriod && (
            <p className="mt-2 text-xs text-fg-subtle">
              {formatByUnit(pctToAmount(sqlPct, sqlPeriod.quota), 'count')} generated
            </p>
          )}
          <p className="mt-1 text-xl font-semibold text-success">{formatCurrency(sqlProjection?.totalPayout ?? 0)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-border-muted bg-canvas p-3 text-sm">
        <span className="text-fg-muted">Projected total variable compensation: </span>
        <span className="font-mono text-lg font-bold text-fg">
          {formatCurrency((pipelineProjection?.totalPayout ?? 0) + (sqlProjection?.totalPayout ?? 0))}
        </span>
      </div>
    </div>
  );
}
