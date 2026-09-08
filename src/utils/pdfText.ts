/**
 * Thin wrapper around pdfjs-dist that extracts plain text from an uploaded
 * PDF File entirely in the browser (no upload to any server).
 */
import * as pdfjsLib from 'pdfjs-dist';
// Vite serves this worker as a standalone asset; the ?url suffix gives us
// the final built URL so pdf.js can load it in a worker thread.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Reads a File (expected to be a PDF) and returns its concatenated page text, in reading order. */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pageTexts.push(pageText);
  }

  return pageTexts.join('\n\n');
}
