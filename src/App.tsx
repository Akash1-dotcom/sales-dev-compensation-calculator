import { useEffect, useMemo, useState } from 'react';
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

const LOGO = (
  <svg viewBox="0 0 16 16" className="h-5 w-5 fill-fg" aria-hidden>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
);

export default function App() {
  // Every plan comes from an uploaded compensation PDF - there is no
  // bundled/demo plan. Until at least one is uploaded, the app only shows
  // an upload prompt.
  const [customPlans, setCustomPlans] = useState<CompensationPlan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [planId, setPlanId] = useState('');
  const [inputs, setInputs] = useState<ScenarioInputs>(() => defaultInputsFor(undefined));

  useEffect(() => {
    const loaded = loadCustomPlans();
    setCustomPlans(loaded);
    setPlansLoaded(true);
    // Plans are loaded from localStorage asynchronously; once available,
    // point the scenario at the first one so `inputs` (period ids, etc.)
    // always matches an actual plan and never references a stale/empty period.
    if (loaded.length > 0) {
      setPlanId(loaded[0].planId);
      setInputs(defaultInputsFor(loaded[0]));
    }
  }, []);
  const plans = customPlans;

  const plan = useMemo(() => plans.find((p) => p.planId === planId) ?? plans[0], [plans, planId]);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [scenarios, setScenarios] = useLocalStorageState<SavedScenario[]>('comp-calc:scenarios', []);
  const [uploadOpen, setUploadOpen] = useState(false);

  const result = useMemo(() => (plan ? calculateScenario(plan, inputs) : null), [plan, inputs]);

  const pipelineComponent = plan?.components.find((c) => c.id === 'pipeline');
  const sqlComponent = plan?.components.find((c) => c.id === 'sql');

  const handlePlanChange = (nextPlanId: string) => {
    setPlanId(nextPlanId);
    setInputs(defaultInputsFor(plans.find((p) => p.planId === nextPlanId)));
  };

  const handleSaveScenario = () => {
    if (!plan) return;
    const name = window.prompt('Name this scenario', `Scenario ${scenarios.length + 1}`);
    if (!name) return;
    setScenarios([
      ...scenarios,
      { id: crypto.randomUUID(), name, planId: plan.planId, inputs, createdAt: new Date().toISOString() },
    ]);
  };

  const handlePlanUploaded = (uploadedPlan: CompensationPlan) => {
    // Don't route through handlePlanChange here: it reads `plans` from the
    // React state closure, which is still stale at this point (setCustomPlans
    // hasn't applied yet) and would not contain the just-uploaded plan -
    // leaving `inputs` pointed at an empty/undefined period and crashing the
    // very next render. Derive planId/inputs straight from uploadedPlan instead.
    const next = saveCustomPlan(uploadedPlan);
    setCustomPlans(next);
    setPlanId(uploadedPlan.planId);
    setInputs(defaultInputsFor(uploadedPlan));
  };

  const handleRemoveCustomPlan = () => {
    if (!plan) return;
    if (!window.confirm(`Remove uploaded plan "${plan.planName}"? This cannot be undone.`)) return;
    const next = removeCustomPlan(plan.planId);
    setCustomPlans(next);
    setPlanId(next[0]?.planId ?? '');
    setInputs(defaultInputsFor(next[0]));
  };

  const [showBreakdown, setShowBreakdown] = useState(false);

  // Nothing uploaded yet: show a single upload gate instead of the calculator.
  if (plansLoaded && !plan) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <header className="border-b border-border bg-canvas-subtle">
          <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:px-6">
            {LOGO}
            <h1 className="text-sm font-semibold text-fg">Compensation Calculator</h1>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
          <svg viewBox="0 0 16 16" className="mb-4 h-10 w-10 fill-fg-muted" aria-hidden>
            <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14H2.75Z" />
            <path d="M7.25 7.689 5.03 9.91a.75.75 0 0 1-1.06-1.06l3.5-3.5a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 1 1-1.06 1.06L8.75 7.689V12a.75.75 0 0 1-1.5 0V7.689Z" />
          </svg>
          <h2 className="text-base font-semibold text-fg">Upload a compensation plan to get started</h2>
          <p className="mt-2 max-w-md text-sm text-fg-muted">
            This calculator has no built-in demo plan. Upload your team's compensation plan PDF and every quota,
            weighting, base rate and accelerator tier is extracted automatically - entirely in your browser.
          </p>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="mt-6 rounded-md bg-success-emphasis px-4 py-2 text-sm font-medium text-white hover:bg-success"
          >
            Upload plan PDF
          </button>
        </main>

        <footer className="border-t border-border py-6 text-center text-xs text-fg-subtle">
          All calculations run locally in your browser. No data leaves this device.
        </footer>

        <UploadPlanModal open={uploadOpen} onClose={() => setUploadOpen(false)} onSave={handlePlanUploaded} />
      </div>
    );
  }

  if (!plan || !result || !pipelineComponent || !sqlComponent) {
    // Plans are still loading from localStorage on first render.
    return null;
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="border-b border-border bg-canvas-subtle">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            {LOGO}
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
            <button
              type="button"
              onClick={handleRemoveCustomPlan}
              className="rounded-md border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
            >
              Remove
            </button>
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
