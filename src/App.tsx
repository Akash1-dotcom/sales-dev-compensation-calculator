import { useEffect, useMemo, useState } from 'react';
import { PLANS as BUNDLED_PLANS, DEFAULT_PLAN_ID } from './data/plans';
import { loadCustomPlans, removeCustomPlan, saveCustomPlan } from './data/customPlans';
import { calculateScenario, type ScenarioInputs } from './engine/planEngine';
import type { CompensationPlan } from './types/compensationPlan';
import type { SavedScenario } from './types/scenario';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import { PlanSelector } from './components/PlanSelector';
import { ScenarioForm } from './components/ScenarioForm';
import { MetricsGrid } from './components/MetricsGrid';
import { TierBreakdownTable } from './components/TierBreakdownTable';
import { PayoutChart } from './components/PayoutChart';
import { EarningsProjection } from './components/EarningsProjection';
import { ScenarioComparison } from './components/ScenarioComparison';
import { PlanDetails } from './components/PlanDetails';
import { UploadPlanModal } from './components/UploadPlanModal';

type Tab = 'dashboard' | 'comparison' | 'plan-details';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'plan-details', label: 'Plan Details' },
];

function defaultInputsFor(plan: CompensationPlan | undefined): ScenarioInputs {
  return {
    quarterId: plan?.quarters[0]?.id ?? '',
    monthId: plan?.months[0]?.id ?? '',
    pipelineGenerated: plan?.components.find((c) => c.id === 'pipeline')?.quotaPeriods[0]?.quota ?? 0,
    sqlGenerated: plan?.components.find((c) => c.id === 'sql')?.quotaPeriods[0]?.quota ?? 0,
  };
}

export default function App() {
  // Bundled plans ship with the app; custom plans are uploaded PDFs parsed
  // and stored locally so different teams' plans can be added without a
  // code change or rebuild.
  const [customPlans, setCustomPlans] = useState<CompensationPlan[]>([]);
  useEffect(() => {
    setCustomPlans(loadCustomPlans());
  }, []);
  const plans = useMemo(() => [...BUNDLED_PLANS, ...customPlans], [customPlans]);

  const [planId, setPlanId] = useState(DEFAULT_PLAN_ID);
  const plan = useMemo(() => plans.find((p) => p.planId === planId) ?? plans[0], [plans, planId]);

  const [inputs, setInputs] = useState<ScenarioInputs>(() => defaultInputsFor(plans[0]));
  const [tab, setTab] = useState<Tab>('dashboard');
  const [scenarios, setScenarios] = useLocalStorageState<SavedScenario[]>('comp-calc:scenarios', []);
  const [uploadOpen, setUploadOpen] = useState(false);

  const result = useMemo(() => calculateScenario(plan, inputs), [plan, inputs]);

  const pipelineComponent = plan.components.find((c) => c.id === 'pipeline')!;
  const sqlComponent = plan.components.find((c) => c.id === 'sql')!;

  const handlePlanChange = (nextPlanId: string) => {
    setPlanId(nextPlanId);
    setInputs(defaultInputsFor(plans.find((p) => p.planId === nextPlanId)));
  };

  const handleSaveScenario = () => {
    const name = window.prompt('Name this scenario', `Scenario ${scenarios.length + 1}`);
    if (!name) return;
    setScenarios([
      ...scenarios,
      { id: crypto.randomUUID(), name, planId, inputs, createdAt: new Date().toISOString() },
    ]);
  };

  const handlePlanUploaded = (uploadedPlan: CompensationPlan) => {
    const next = saveCustomPlan(uploadedPlan);
    setCustomPlans(next);
    handlePlanChange(uploadedPlan.planId);
  };

  const isCustomPlan = customPlans.some((p) => p.planId === plan.planId);
  const handleRemoveCustomPlan = () => {
    if (!isCustomPlan) return;
    if (!window.confirm(`Remove uploaded plan "${plan.planName}"? This cannot be undone.`)) return;
    const next = removeCustomPlan(plan.planId);
    setCustomPlans(next);
    handlePlanChange(BUNDLED_PLANS[0]?.planId ?? '');
  };

  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="border-b border-border bg-canvas-subtle">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 16 16" className="h-5 w-5 fill-fg" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            <h1 className="text-sm font-semibold text-fg">Compensation Calculator</h1>
          </div>

          <div className="flex items-center gap-1 rounded-md border border-border bg-canvas p-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  tab === t.id ? 'bg-canvas-subtle text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PlanSelector plans={plans} selectedPlanId={plan.planId} onChange={handlePlanChange} />
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg hover:bg-canvas"
            >
              Upload plan
            </button>
            {isCustomPlan && (
              <button
                type="button"
                onClick={handleRemoveCustomPlan}
                className="rounded-md border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        {tab === 'dashboard' && (
          <>
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-fg">Scenario</h2>
                <button
                  type="button"
                  onClick={handleSaveScenario}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg hover:bg-canvas-subtle"
                >
                  Save scenario
                </button>
              </div>
              <ScenarioForm plan={plan} inputs={inputs} onChange={setInputs} />
            </section>

            <MetricsGrid result={result} />

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PayoutChart
                component={pipelineComponent}
                periodId={inputs.quarterId}
                currentAttainmentPct={result.pipeline.attainmentPct}
                currentPayout={result.pipeline.totalPayout}
                color="#2f81f7"
              />
              <PayoutChart
                component={sqlComponent}
                periodId={inputs.monthId}
                currentAttainmentPct={result.sql.attainmentPct}
                currentPayout={result.sql.totalPayout}
                color="#3fb950"
              />
            </section>

            <EarningsProjection
              pipelineComponent={pipelineComponent}
              sqlComponent={sqlComponent}
              quarterId={inputs.quarterId}
              monthId={inputs.monthId}
            />

            <section>
              <button
                type="button"
                onClick={() => setShowBreakdown((v) => !v)}
                className="flex w-full items-center justify-between rounded-md border border-border bg-canvas-subtle px-4 py-2.5 text-sm font-semibold text-fg hover:bg-canvas"
                aria-expanded={showBreakdown}
              >
                Detailed calculation breakdown
                <span className="text-fg-muted">{showBreakdown ? '−' : '+'}</span>
              </button>
              {showBreakdown && (
                <div className="mt-3 space-y-4">
                  <TierBreakdownTable result={result.pipeline} />
                  <TierBreakdownTable result={result.sql} />
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'comparison' && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-fg">Side-by-side scenario comparison</h2>
            <ScenarioComparison
              plan={plan}
              scenarios={scenarios.filter((s) => s.planId === plan.planId)}
              onRemove={(id) => setScenarios(scenarios.filter((s) => s.id !== id))}
            />
          </section>
        )}

        {tab === 'plan-details' && <PlanDetails plan={plan} />}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-fg-subtle">
        All calculations run locally in your browser. No data leaves this device.
      </footer>

      <UploadPlanModal open={uploadOpen} onClose={() => setUploadOpen(false)} onSave={handlePlanUploaded} />
    </div>
  );
}
