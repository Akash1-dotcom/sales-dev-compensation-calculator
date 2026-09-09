/**
 * PDF Plan Parser
 * ===============
 * Best-effort extraction of a `CompensationPlan` from the raw text of a
 * GitHub-style "Revenue Compensation Exhibit" PDF. Different teams/geos are
 * issued the same template with different participant names, quotas, TIC
 * weightings, base rates and accelerator tiers - this parser looks for the
 * same structural anchors ("Component Quotas", "% to Quota / Rates" tables,
 * "Draw" section, etc.) that are stable across teams and pulls out the
 * numbers that vary.
 *
 * Because compensation PDFs are not perfectly consistent in formatting,
 * extraction is intentionally conservative: every field it fills in is
 * shown to the user in an editable review step (see UploadPlanModal.tsx)
 * before the plan is saved, so a partial or slightly-off extraction can
 * always be corrected by hand rather than silently producing wrong payouts.
 */
import type {
  AcceleratorTier,
  CompensationPlan,
  PlanComponent,
} from '../types/compensationPlan';

export interface ParsedPlanWarning {
  field: string;
  message: string;
}

export interface ParsePdfPlanResult {
  plan: CompensationPlan;
  warnings: ParsedPlanWarning[];
  /** Raw extracted text, kept around for manual troubleshooting. */
  rawText: string;
}

function toNumber(raw: string): number {
  return Number(raw.replace(/[,$%]/g, '').trim());
}

/** Parses an "X.XX% - Y.YY%" style row into a min/max pct pair (max is null for "+" / open-ended rows). */
function parseTierRow(pctRange: string, rateLabel: string): AcceleratorTier | null {
  const openEnded = /\+\s*$/.test(pctRange);
  const nums = pctRange.match(/[\d.]+/g);
  if (!nums || nums.length === 0) return null;
  const minPct = toNumber(nums[0]);
  const maxPct = openEnded || nums.length < 2 ? null : toNumber(nums[1]);

  const multiplierMatch = rateLabel.match(/([\d.]+)%\s*x\s*Base Rate/i);
  const multiplier = multiplierMatch ? toNumber(multiplierMatch[1]) / 100 : /base rate/i.test(rateLabel) ? 1 : NaN;
  if (Number.isNaN(multiplier)) return null;

  return { minPct, maxPct, multiplier, label: rateLabel.trim() };
}

/** Extracts a labeled "% to Quota / Rates" table (Pipeline Rates, SQL Rates) from raw text. */
function extractTierTable(text: string, tableHeading: string, otherHeadings: string[] = []): AcceleratorTier[] {
  const headingIndex = text.indexOf(tableHeading);
  if (headingIndex === -1) return [];

  // Look at a bounded window after the heading so we don't bleed into the next
  // table - stop either at a hard character cap or at the next known table
  // heading, whichever comes first.
  const searchStart = headingIndex + tableHeading.length;
  const nextHeadingIndex = otherHeadings
    .map((h) => text.indexOf(h, searchStart))
    .filter((idx) => idx !== -1)
    .reduce((min, idx) => Math.min(min, idx), Infinity);
  const windowEnd = Math.min(headingIndex + 1200, Number.isFinite(nextHeadingIndex) ? nextHeadingIndex : Infinity);
  const window = text.slice(headingIndex, windowEnd);
  const rowPattern = /([\d.]+%\s*-\s*[\d.]+%|[\d.]+%\s*\+)\s*(Base Rate|[\d.]+%\s*x\s*Base Rate)/gi;
  const tiers: AcceleratorTier[] = [];
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(window)) !== null) {
    const tier = parseTierRow(match[1], match[2]);
    if (tier) tiers.push(tier);
  }
  return tiers;
}

/**
 * Finds the first *quota-shaped* amount (e.g. "800,000" or "$800,000")
 * following a label. Quota amounts always have thousands-separator commas
 * or are at least 3 digits (100+) - this deliberately excludes 1-2 digit
 * numbers so it can't accidentally match the "1" in "Quarter 1" or the "2"
 * in "Quarter 2" when those labels themselves appear before the real
 * number in the PDF's extracted text order (tables often extract as
 * "label label ... value value" rather than "label value label value").
 */
function extractAmountAfter(text: string, label: string, occurrence = 0): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `${escaped}[\\s\\S]{0,400}?\\$?(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d{3,}(?:\\.\\d+)?)`,
    'gi',
  );
  const matches = [...text.matchAll(pattern)];
  const m = matches[occurrence];
  return m ? toNumber(m[1]) : null;
}

function extractPercentAfter(text: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}[\\s\\S]{0,120}?([\\d]+(?:\\.\\d+)?)\\s*%`, 'i');
  const m = text.match(pattern);
  return m ? toNumber(m[1]) : null;
}

function buildMonthsForQuarters(
  quarters: { id: string; label: string; startISO: string }[],
): { id: string; label: string; quarterId: string }[] {
  const months: { id: string; label: string; quarterId: string }[] = [];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  quarters.forEach((q) => {
    const start = new Date(q.startISO);
    for (let i = 0; i < 3; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const id = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ id, label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`, quarterId: q.id });
    }
  });
  return months;
}

/**
 * Attempts to parse a GitHub-style Revenue Compensation Exhibit from its
 * extracted text. Returns a best-guess `CompensationPlan` plus a list of
 * warnings for any field that could not be located, defaulted to a
 * reasonable placeholder for the user to fix in the review step.
 */
export function parsePlanFromText(rawText: string, sourceFileName: string): ParsePdfPlanResult {
  const text = rawText.replace(/\r/g, '');
  const warnings: ParsedPlanWarning[] = [];

  // A person's name is at most a few words - bound it tightly and stop at
  // the next known label ("Effective Date"), a newline, or end of string
  // (using a lookahead so we don't require one of those literally at the
  // very end) so the match can't bleed into adjacent fields when the PDF's
  // text-extraction order interleaves labels and values (e.g. "Participant:
  // Jane Doe Effective Date: 7/1/2026").
  const participantMatch = text.match(
    /Participant:?\s*([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,3}?)\s*(?=Effective Date|Geo|\n|$)/,
  );
  const participant = participantMatch?.[1]?.trim();
  if (!participant) warnings.push({ field: 'participant', message: 'Could not find a Participant name.' });

  // Same bleed-through risk as Participant above - a Geo value is a short
  // code like "APAC EBR IN", so stop at the next known label.
  const geoMatch = text.match(
    /Geo\s*\n?\s*([A-Z][A-Za-z0-9 /]{2,30}?)\s*(?=Plan Components|Component Quotas|\n|$)/,
  );
  const geo = geoMatch?.[1]?.trim();

  const planPeriodMatch = text.match(/Plan Period:?\s*([A-Za-z0-9 ]+FY\d{2})\s*\(([^)]+)\)/);
  const planPeriodLabel = planPeriodMatch?.[1]?.trim() ?? 'Plan Period';
  const planPeriodRange = planPeriodMatch?.[2] ?? '';
  const rangeMatch = planPeriodRange.match(
    /([A-Za-z]+ \d{1,2},? \d{4})\s*-\s*([A-Za-z]+ \d{1,2},? \d{4})/,
  );
  const parseDate = (s: string) => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const startDate = rangeMatch ? parseDate(rangeMatch[1]) : null;
  const endDate = rangeMatch ? parseDate(rangeMatch[2]) : null;
  if (!startDate || !endDate) {
    warnings.push({ field: 'planPeriod', message: 'Could not confidently parse the plan period date range.' });
  }

  // Component TIC + weighting rows, e.g. "Pipeline - Quarter 1 30% 1,253.54 0.1567%"
  const pipelineQ1Row = text.match(/Pipeline\s*-\s*Quarter 1\s*(\d+(?:\.\d+)?)%\s*([\d,]+\.\d+)/i);
  const pipelineQ2Row = text.match(/Pipeline\s*-\s*Quarter 2\s*(\d+(?:\.\d+)?)%\s*([\d,]+\.\d+)/i);
  const sqlRow = text.match(/Sales Qualified Leads[\s\S]{0,40}?\n?\s*\(SQL\)\s*(\d+(?:\.\d+)?)%\s*([\d,]+\.\d+)/i);

  const pipelineQ1TIC = pipelineQ1Row ? toNumber(pipelineQ1Row[2]) : 0;
  const pipelineQ2TIC = pipelineQ2Row ? toNumber(pipelineQ2Row[2]) : 0;
  const pipelineWeighting = pipelineQ1Row ? toNumber(pipelineQ1Row[1]) : extractPercentAfter(text, 'Pipeline - Quarter 1') ?? 30;
  const sqlTIC = sqlRow ? toNumber(sqlRow[2]) : 0;
  const sqlWeighting = sqlRow ? toNumber(sqlRow[1]) : extractPercentAfter(text, 'Sales Qualified Leads') ?? 40;

  if (!pipelineQ1Row || !pipelineQ2Row) {
    warnings.push({ field: 'pipeline.componentTIC', message: 'Could not confidently find Pipeline Component TIC per quarter - please verify.' });
  }
  if (!sqlRow) {
    warnings.push({ field: 'sql.componentTIC', message: 'Could not confidently find SQL Component TIC - please verify.' });
  }

  // "Total Plan Period TIC" is meant to equal the sum of every component's
  // TIC (Pipeline Q1 + Pipeline Q2 + SQL) - it's just as reliable, and far
  // less prone to table-column reordering, to compute it from those already
  // -parsed values than to regex-match a single figure out of the table
  // (whose real total can land many cells away from the "Total Plan Period
  // TIC" heading depending on how the PDF's columns were laid out).
  const componentTICSum = pipelineQ1TIC + pipelineQ2TIC + sqlTIC;
  const totalTICMatch = text.match(/Total Plan Period\s*\n?\s*TIC[\s\S]{0,200}?([\d][\d,]*\.\d+)/i);
  const totalPlanPeriodTIC = componentTICSum > 0 ? componentTICSum : totalTICMatch ? toNumber(totalTICMatch[1]) : 0;
  if (componentTICSum <= 0 && !totalTICMatch) {
    warnings.push({ field: 'totalPlanPeriodTIC', message: 'Could not find Total Plan Period TIC.' });
  }

  // Pipeline: Quarter 1 / Quarter 2 quotas, from the "Component Quotas" section.
  const q1Quota = extractAmountAfter(text, 'Quarter 1', 0) ?? 0;
  const q2Quota = extractAmountAfter(text, 'Quarter 2', 0) ?? 0;
  if (!q1Quota || !q2Quota) {
    warnings.push({ field: 'pipeline.quota', message: 'Could not confidently find Quarter 1 / Quarter 2 Sourced Pipeline quotas.' });
  }

  // SQL monthly quota, e.g. "Monthly SQL Quota ... 13"
  const sqlQuotaMatch = text.match(/Monthly SQL Quota[\s\S]{0,120}?(\d+)/i);
  const sqlQuota = sqlQuotaMatch ? toNumber(sqlQuotaMatch[1]) : 0;
  if (!sqlQuotaMatch) warnings.push({ field: 'sql.quota', message: 'Could not find Monthly SQL Quota.' });

  const pipelineTiers = extractTierTable(text, 'Pipeline Rates', ['SQL Rates', 'Draw']);
  const sqlTiers = extractTierTable(text, 'SQL Rates', ['Draw']);
  if (pipelineTiers.length === 0) {
    warnings.push({ field: 'pipeline.acceleratorTiers', message: 'Could not find a "Pipeline Rates" accelerator table - defaulted to base-rate-only.' });
  }
  if (sqlTiers.length === 0) {
    warnings.push({ field: 'sql.acceleratorTiers', message: 'Could not find a "SQL Rates" accelerator table - defaulted to base-rate-only.' });
  }

  const fallbackTier: AcceleratorTier[] = [{ minPct: 0, maxPct: null, multiplier: 1, label: 'Base Rate' }];

  // Draw policy, e.g. "3  6/1/2026 - 8/31/2026  2,089.24"
  const drawMatch = text.match(
    /(\d+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+([\d,]+\.\d+)/,
  );

  const planStart = startDate ?? new Date();
  const planYearStart = planStart.getFullYear();
  const q1Start = new Date(planYearStart, planStart.getMonth(), 1);
  const q2Start = new Date(planYearStart, planStart.getMonth() + 3, 1);
  const quarters = [
    { id: 'Q1', label: 'Quarter 1', startISO: q1Start.toISOString() },
    { id: 'Q2', label: 'Quarter 2', startISO: q2Start.toISOString() },
  ];

  const pipelineComponent: PlanComponent = {
    id: 'pipeline',
    name: 'Sourced Pipeline',
    description: 'Extracted from uploaded PDF. Review quotas, TIC and accelerator tiers before use.',
    unit: 'currency',
    cadence: 'quarterly',
    ticWeightingPct: pipelineWeighting,
    quotaPeriods: [
      { id: 'Q1', label: 'Quarter 1', quota: q1Quota, componentTIC: pipelineQ1TIC },
      { id: 'Q2', label: 'Quarter 2', quota: q2Quota, componentTIC: pipelineQ2TIC },
    ],
    acceleratorTiers: pipelineTiers.length > 0 ? pipelineTiers : fallbackTier,
  };

  const months = buildMonthsForQuarters(quarters.map((q) => ({ id: q.id, label: q.label, startISO: q.startISO })));
  const sqlComponent: PlanComponent = {
    id: 'sql',
    name: 'Sales Qualified Leads (SQL)',
    description: 'Extracted from uploaded PDF. Review quotas, TIC and accelerator tiers before use.',
    unit: 'count',
    cadence: 'monthly',
    ticWeightingPct: sqlWeighting,
    quotaPeriods: months.map((m) => ({
      id: m.id,
      label: m.label,
      quota: sqlQuota,
      componentTIC: sqlTIC / 3, // split the quarterly-reported SQL TIC evenly across its 3 months
    })),
    acceleratorTiers: sqlTiers.length > 0 ? sqlTiers : fallbackTier,
  };

  const planId = `${sourceFileName.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

  const plan: CompensationPlan = {
    planId,
    planName: 'GitHub Revenue Compensation Exhibit',
    participant,
    geo,
    currency: 'USD',
    planPeriod: {
      label: planPeriodLabel,
      start: startDate ? startDate.toISOString().slice(0, 10) : '',
      end: endDate ? endDate.toISOString().slice(0, 10) : '',
    },
    totalPlanPeriodTIC,
    quarters: quarters.map((q) => ({ id: q.id, label: q.label })),
    months,
    components: [pipelineComponent, sqlComponent],
    draw: drawMatch
      ? {
          lengthMonths: toNumber(drawMatch[1]),
          startDate: drawMatch[2],
          endDate: drawMatch[3],
          amount: toNumber(drawMatch[4]),
          recoverable: false,
        }
      : undefined,
  };

  return { plan, warnings, rawText: text };
}
