# GitHub Compensation Calculator

A local, backend-free compensation calculator that models a GitHub Revenue
Compensation Exhibit exactly as extracted from the source PDF ("H1 FY27,
APAC EBR IN" plan is included as a worked example) and lets you calculate
projected earnings, run what-if scenarios, and compare them side by side.

Everything runs **entirely in your browser**. No data is sent anywhere -
including uploaded plan PDFs, which are parsed client-side and never leave
your machine.

**Live demo:** https://Akash1-dotcom.github.io/sales-dev-compensation-calculator/

## Stack

- React 18 + TypeScript
- Vite
- TailwindCSS
- Recharts (payout-vs-attainment graphs)
- pdf.js (client-side PDF text extraction for the plan upload feature)
- Vitest + Testing Library (unit tests)


## Getting started

```bash
npm install
npm run dev       # start the local dev server
npm run build     # production build to dist/
npm run test      # run the unit test suite once
npm run test:watch
```

## How the plan was modeled

The PDF defines two Plan Components for this participant:

| Component | Cadence | Quota | Component TIC | Base Rate |
|---|---|---|---|---|
| Sourced Pipeline | Quarterly | $800,000 / quarter | $1,253.54 / quarter | TIC ÷ Quota = 0.1567% of Contract Value |
| Sales Qualified Leads (SQL) | Monthly | 13 SQLs / month | ~$278.57 / month | TIC ÷ Quota ≈ $21.43 / SQL |

Each component pays its Base Rate on generated amounts up to 100% of quota.
Beyond 100%, an **accelerator tier table** is applied pro-rata (each
tier's rate applies only to the slice of production that falls inside that
tier's band):

- **Pipeline**: 100–200% → 110% of Base Rate · 200–250% → 125% · 250%+ → 100%
- **SQL**: 100–125% → 110% · 125–150% → 120% · 150–400% → 130%

See `src/data/plans/github-h1-fy27.plan.json` for the exact values and
`src/components/PlanDetails.tsx` (the "Plan Details" tab in the app) to
review everything the app extracted from the PDF at a glance.

## Architecture

```
src/
  types/compensationPlan.ts   - Generic plan schema (components, quotas, TIC, accelerator tiers)
  data/plans/*.plan.json      - One JSON file per compensation plan PDF (data, not code)
  data/plans/index.ts         - Registry that the UI's plan selector reads from
  engine/compensationEngine.ts- Pure calculation functions: base rate, tiered payout, attainment %, projections
  engine/planEngine.ts        - Combines Pipeline + SQL into one scenario result; payout curve generator for charts
  components/                - Dashboard, What-If Planner, Comparison, Plan Details UI
  __tests__/                 - Vitest unit tests validating every calculation path
```

The calculation engine is **completely decoupled from the UI and from any
specific plan's numbers**. It only understands the generic
`CompensationPlan` / `PlanComponent` / `AcceleratorTier` shapes.

## Supporting a new compensation plan PDF

Different teams/geos are issued the same Exhibit template with different
quotas, TIC weightings and accelerator tiers. Two ways to add one:

### Option A - Upload it in the app (no code, no rebuild)

1. Click **"Upload plan PDF"** in the header.
2. Choose the team's compensation plan PDF - it's parsed entirely in your
   browser (`src/engine/pdfPlanParser.ts` + `src/utils/pdfText.ts`, using
   pdf.js) by matching the same structural anchors the GitHub template uses
   (Component Quotas, Pipeline/SQL Rates tables, Draw schedule, etc.).
3. Review the extracted plan in the editable JSON panel. Any field the
   parser couldn't confidently locate is called out as a warning so you can
   fix it by hand before saving.
4. Click **Save plan** - it's stored in your browser's `localStorage`
   (`src/data/customPlans.ts`) and immediately appears in the plan selector
   alongside the bundled plans. Nothing is uploaded anywhere, and no code
   change or rebuild is needed.
5. Uploaded plans can be removed at any time via the **"Remove plan"**
   button next to the plan selector.

### Option B - Add it as a bundled JSON file (for a plan that should ship with the app)

1. Read the new PDF and fill out a JSON file matching
   `src/types/compensationPlan.ts` (copy
   `src/data/plans/github-h1-fy27.plan.json` as a template - update quotas,
   TIC weightings, base rates and accelerator tiers).
2. Save it in `src/data/plans/your-plan.plan.json`.
3. Import and add it to the `PLANS` array in `src/data/plans/index.ts`.
4. Reload the app - the new plan appears in the plan selector dropdown and
   every calculation, chart and comparison uses its data automatically.

## Features

- **Dashboard** - live scenario inputs (Pipeline generated, SQLs generated,
  Quarter, Month), all required output metrics, payout-vs-attainment charts,
  and a full step-by-step tier breakdown.
- **What-If Planner** - adjust inputs, project earnings at any hypothetical
  attainment % via independent sliders, and save named scenarios.
- **Comparison** - every saved scenario shown side by side with its own
  attainment, payout and total variable compensation.
- **Plan Details** - a transparent, human-readable view of every rule the
  app extracted from the source PDF.
- **Upload plan PDF** - parse a different team's compensation plan PDF
  client-side, review/correct the extraction, and use it immediately - no
  code change, rebuild or redeploy required.

## Testing

`src/__tests__/compensationEngine.test.ts` and `planEngine.test.ts` cover:
base rate derivation, percent/amount conversions, pro-rata accelerator tier
math (including boundary conditions and the unbounded final tier), full
component/scenario results, next-tier projections, and payout curve
generation. `src/__tests__/pdfPlanParser.test.ts` validates PDF text
extraction against a synthetic plan document (quotas, TIC, weightings,
accelerator tables, draw policy, and graceful handling of unrecognized
text). Run them all with `npm run test`.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which installs
dependencies, runs the unit tests, builds the app with the GitHub Pages
base path, and publishes `dist/` to GitHub Pages via
`actions/deploy-pages`. Enable Pages once under
**Settings → Pages → Source: GitHub Actions** and every subsequent push to
`main` redeploys automatically.
