import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { generatePayoutCurve } from '../engine/planEngine';
import type { PlanComponent } from '../types/compensationPlan';
import { formatCurrency, formatPercent } from '../utils/format';

interface PayoutChartProps {
  component: PlanComponent;
  periodId: string;
  currentAttainmentPct: number;
  currentPayout: number;
  color: string;
}

/** Line chart of payout ($) vs. attainment (% of quota), with the current scenario marked. */
export function PayoutChart({ component, periodId, currentAttainmentPct, currentPayout, color }: PayoutChartProps) {
  const maxPct = Math.max(300, Math.ceil(currentAttainmentPct / 50) * 50 + 50);
  const data = generatePayoutCurve(component, periodId, maxPct, 60);

  return (
    <div className="rounded-lg border border-border bg-canvas-subtle p-4">
      <h3 className="mb-3 text-sm font-semibold text-fg">{component.name} — Payout vs. Attainment</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis
            dataKey="pct"
            stroke="#8b949e"
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            stroke="#8b949e"
            tickFormatter={(v: number) => formatCurrency(v)}
            tick={{ fontSize: 11 }}
            width={80}
          />
          <Tooltip
            contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, fontSize: 12 }}
            labelFormatter={(v: number) => `Attainment: ${formatPercent(v)}`}
            formatter={(v: number) => [formatCurrency(v), 'Payout']}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="payout" name="Payout" stroke={color} dot={false} strokeWidth={2} />
          <ReferenceDot
            x={currentAttainmentPct}
            y={currentPayout}
            r={5}
            fill={color}
            stroke="#e6edf3"
            strokeWidth={1}
            isFront
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
