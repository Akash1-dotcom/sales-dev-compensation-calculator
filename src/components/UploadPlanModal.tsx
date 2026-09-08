import { useRef, useState } from 'react';
import type { CompensationPlan } from '../types/compensationPlan';
import { extractTextFromPdf } from '../utils/pdfText';
import { parsePlanFromText, type ParsedPlanWarning } from '../engine/pdfPlanParser';

interface UploadPlanModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (plan: CompensationPlan) => void;
}

type Stage = 'idle' | 'parsing' | 'review' | 'error';

/**
 * Upload → parse → review → save flow for a new team's compensation plan
 * PDF. Parsing runs entirely client-side (pdf.js) and is best-effort; the
 * user always reviews (and can hand-edit) the extracted JSON before it is
 * saved, so an imperfect extraction can never silently produce wrong
 * payouts.
 */
export function UploadPlanModal({ open, onClose, onSave }: UploadPlanModalProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [fileName, setFileName] = useState('');
  const [warnings, setWarnings] = useState<ParsedPlanWarning[]>([]);
  const [jsonDraft, setJsonDraft] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileSelected = async (file: File) => {
    setFileName(file.name);
    setStage('parsing');
    setError('');
    try {
      const text = await extractTextFromPdf(file);
      const { plan, warnings: parseWarnings } = parsePlanFromText(text, file.name);
      setWarnings(parseWarnings);
      setJsonDraft(JSON.stringify(plan, null, 2));
      setStage('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read this PDF.');
      setStage('error');
    }
  };

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonDraft) as CompensationPlan;
      if (!parsed.planId || !parsed.components?.length) {
        setError('The plan JSON must include a planId and at least one component.');
        return;
      }
      onSave(parsed);
      reset();
      onClose();
    } catch {
      setError('That is not valid JSON. Fix the syntax error and try again.');
    }
  };

  const reset = () => {
    setStage('idle');
    setFileName('');
    setWarnings([]);
    setJsonDraft('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-canvas-subtle shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-base font-semibold text-fg">Upload a compensation plan PDF</h2>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-md px-2 py-1 text-fg-muted hover:bg-canvas hover:text-fg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {stage === 'idle' && (
            <div>
              <p className="mb-3 text-sm text-fg-muted">
                Upload a "GitHub Revenue Compensation Exhibit"-style PDF for another team/geo. Quotas, TIC
                weightings, base rates and accelerator tiers are extracted automatically - you'll get a chance to
                review and correct everything before it's saved.
              </p>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-10 text-center hover:border-accent">
                <span className="text-sm font-medium text-fg">Click to choose a PDF file</span>
                <span className="mt-1 text-xs text-fg-subtle">Processed locally in your browser — never uploaded anywhere</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileSelected(file);
                  }}
                />
              </label>
            </div>
          )}

          {stage === 'parsing' && (
            <div className="py-10 text-center text-sm text-fg-muted">Parsing “{fileName}”…</div>
          )}

          {stage === 'error' && (
            <div className="space-y-3">
              <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-fg hover:bg-canvas"
              >
                Try another file
              </button>
            </div>
          )}

          {stage === 'review' && (
            <div className="space-y-4">
              {warnings.length > 0 && (
                <div className="rounded-md border border-attention/40 bg-attention/10 p-3 text-sm text-attention">
                  <p className="mb-1 font-medium">Some fields couldn't be confidently extracted from "{fileName}":</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {warnings.map((w) => (
                      <li key={w.field}>{w.message}</li>
                    ))}
                  </ul>
                  <p className="mt-1">Review and correct the values below before saving.</p>
                </div>
              )}

              {error && <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}

              <div>
                <label className="mb-1 block text-xs font-medium text-fg-muted" htmlFor="plan-json">
                  Extracted plan (editable JSON)
                </label>
                <textarea
                  id="plan-json"
                  className="h-80 w-full resize-y rounded-md border border-border bg-canvas-inset p-3 font-mono text-xs text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  value={jsonDraft}
                  onChange={(e) => setJsonDraft(e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </div>

        {stage === 'review' && (
          <div className="flex justify-end gap-2 border-t border-border p-4">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-fg hover:bg-canvas"
            >
              Start over
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-success-emphasis px-3 py-1.5 text-sm font-medium text-white hover:bg-success"
            >
              Save plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
