import { describe, expect, it } from 'vitest';
import { parsePlanFromText } from '../engine/pdfPlanParser';

// A condensed synthetic reproduction of the structural anchors the parser
// looks for in a real "GitHub Revenue Compensation Exhibit" PDF, using
// different numbers than the bundled H1 FY27 plan to simulate a different
// team/geo's plan.
const SYNTHETIC_PDF_TEXT = `
GitHub Revenue Compensation Exhibit
Participant: Jane Doe
Geo
EMEA EBR UK
Plan Period: H1 FY27 (July 1, 2026 - December 31, 2026)

Total Plan Period
TIC
5,000.00

Component Quotas
Quarter 1
600,000
Quarter 2
650,000
Monthly SQL Quota
10

Component TIC Weighting
Pipeline - Quarter 1 30% 1,500.00 0.25%
Pipeline - Quarter 2 30% 1,500.00 0.25%
Sales Qualified Leads
(SQL) 40% 2,000.00 0.33%

Pipeline Rates
0.00% - 100.00% Base Rate
100.01% - 200.00% 110% x Base Rate
200.01% + 125% x Base Rate

SQL Rates
0.00% - 100.00% Base Rate
100.01% + 120% x Base Rate

Draw
3 6/1/2026 - 8/31/2026 2,500.00
`;

describe('parsePlanFromText', () => {
  const { plan, warnings } = parsePlanFromText(SYNTHETIC_PDF_TEXT, 'emea-ebr-uk.pdf');

  it('extracts participant and geo', () => {
    expect(plan.participant).toBe('Jane Doe');
    expect(plan.geo).toBe('EMEA EBR UK');
  });

  it('extracts total plan period TIC', () => {
    expect(plan.totalPlanPeriodTIC).toBe(5000);
  });

  it('extracts pipeline quotas per quarter', () => {
    const pipeline = plan.components.find((c) => c.id === 'pipeline')!;
    expect(pipeline.quotaPeriods[0].quota).toBe(600000);
    expect(pipeline.quotaPeriods[1].quota).toBe(650000);
    expect(pipeline.quotaPeriods[0].componentTIC).toBe(1500);
    expect(pipeline.ticWeightingPct).toBe(30);
  });

  it('extracts SQL monthly quota and TIC split across 3 months per quarter', () => {
    const sql = plan.components.find((c) => c.id === 'sql')!;
    expect(sql.quotaPeriods).toHaveLength(6);
    expect(sql.quotaPeriods[0].quota).toBe(10);
    expect(sql.quotaPeriods[0].componentTIC).toBeCloseTo(2000 / 3, 5);
    expect(sql.ticWeightingPct).toBe(40);
  });

  it('extracts accelerator tier tables for both components', () => {
    const pipeline = plan.components.find((c) => c.id === 'pipeline')!;
    const sql = plan.components.find((c) => c.id === 'sql')!;
    expect(pipeline.acceleratorTiers).toEqual([
      { minPct: 0, maxPct: 100, multiplier: 1, label: 'Base Rate' },
      { minPct: 100.01, maxPct: 200, multiplier: 1.1, label: '110% x Base Rate' },
      { minPct: 200.01, maxPct: null, multiplier: 1.25, label: '125% x Base Rate' },
    ]);
    expect(sql.acceleratorTiers).toEqual([
      { minPct: 0, maxPct: 100, multiplier: 1, label: 'Base Rate' },
      { minPct: 100.01, maxPct: null, multiplier: 1.2, label: '120% x Base Rate' },
    ]);
  });

  it('extracts draw policy', () => {
    expect(plan.draw).toEqual({
      lengthMonths: 3,
      startDate: '6/1/2026',
      endDate: '8/31/2026',
      amount: 2500,
      recoverable: false,
    });
  });

  it('produces no warnings when all fields are found', () => {
    expect(warnings).toEqual([]);
  });

  it('reports warnings instead of throwing when key fields are missing', () => {
    const { plan: sparsePlan, warnings: sparseWarnings } = parsePlanFromText(
      'Just some unrelated text with no structure.',
      'unknown.pdf',
    );
    expect(sparseWarnings.length).toBeGreaterThan(0);
    expect(sparsePlan.components).toHaveLength(2);
    expect(sparsePlan.components[0].acceleratorTiers).toEqual([
      { minPct: 0, maxPct: null, multiplier: 1, label: 'Base Rate' },
    ]);
  });
});

// A condensed reproduction of pdf.js's *actual* extraction order for a real
// GitHub Revenue Compensation Exhibit: labels are read left-to-right within
// each table row, which for the "Component Quotas" table means both
// "Quarter 1" and "Quarter 2" headers appear *before* either quarter's
// actual quota value. A naive "grab the first number after 'Quarter 1'"
// parse previously matched the "2" inside the literal text "Quarter 2"
// (which appears between the "Quarter 1" label and the real 800,000 value)
// instead of the real quota - this regression test locks in the fix.
const REAL_WORLD_ORDER_PDF_TEXT = `
GitHub Revenue Compensation Exhibit
Participant: Shambhavi Chhabra
Geo
APAC EBR IN
Plan Period: H1 FY27 (July 1, 2026 - December 31, 2026)

Component Quotas
Geo
APAC EBR IN
Plan Components
Component Quotas Quarter 1
All values are in USD ($)
Quarter 2
All values are in USD ($)
Sourced Pipeline
(Quarterly Quotas)
800,000
800,000
Monthly SQL Quota
Sales Qualified Lead (SQL)
(Monthly Quotas)
13

Total Plan Period
TIC
4,178.48

Pipeline - Quarter 1 30% 1,253.54 0.1567%
Pipeline - Quarter 2 30% 1,253.54 0.1567%
Sales Qualified Leads
(SQL) 40% 1,671.39 21.43%

Pipeline Rates
0.00% - 100.00% Base Rate
100.01% - 200.00% 110% x Base Rate
200.01% - 250.00% 125% x Base Rate
250.01% + 100% x Base Rate

SQL Rates
0.00% - 100.00% Base Rate
100.01% - 125.00% 110% x Base Rate
125.01% - 150.00% 120% x Base Rate
150.01% - 400.00% 130% x Base Rate
`;

describe('parsePlanFromText with real-world PDF text ordering', () => {
  const { plan } = parsePlanFromText(REAL_WORLD_ORDER_PDF_TEXT, 'callidus.pdf');
  const pipeline = plan.components.find((c) => c.id === 'pipeline')!;
  const sql = plan.components.find((c) => c.id === 'sql')!;

  it('extracts the real 800,000 pipeline quota for both quarters, not the "2" from the "Quarter 2" label', () => {
    expect(pipeline.quotaPeriods[0].quota).toBe(800000);
    expect(pipeline.quotaPeriods[1].quota).toBe(800000);
  });

  it('extracts the monthly SQL quota', () => {
    expect(sql.quotaPeriods[0].quota).toBe(13);
  });
});
