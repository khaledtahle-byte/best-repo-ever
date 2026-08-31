import type { OfferInput, OfferLineInput, ParseResult, ParseWarning, SourceType } from '@/lib/types';
import { parseCsv } from '@/lib/parsing/csv';
import { extractPdfText } from '@/lib/parsing/pdf';
import { parseXlsx } from '@/lib/parsing/xlsx';
import { textToLines } from '@/lib/parsing/text';
import {
  DEFAULT_FREIGHT,
  DEFAULT_PAYMENT_TERMS,
  extractFees,
  extractFreight,
  extractPaymentTerms,
  extractRebate,
  extractReference,
  extractSupplierName,
} from '@/lib/parsing/terms';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['.pdf', '.csv', '.tsv', '.txt', '.xlsx', '.xlsm'];

export function detectSourceType(fileName: string, mimeType: string): SourceType | null {
  const name = fileName.toLowerCase();
  if (name.endsWith('.pdf') || mimeType === 'application/pdf') return 'pdf';
  if (name.endsWith('.csv') || name.endsWith('.tsv') || mimeType === 'text/csv') return 'csv';
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xlsm') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'xlsx';
  }
  if (name.endsWith('.txt') || mimeType.startsWith('text/')) return 'text';
  return null;
}

/** Assembles line items and document-level commercial terms into one offer. */
export function buildOffer(
  lines: OfferLineInput[],
  text: string,
  overrides: Partial<OfferInput> = {},
): OfferInput {
  return {
    supplierName: overrides.supplierName ?? extractSupplierName(text) ?? '',
    reference: overrides.reference ?? extractReference(text),
    currency: overrides.currency ?? detectCurrency(text),
    quotedAt: overrides.quotedAt ?? new Date().toISOString(),
    lines: overrides.lines ?? lines,
    paymentTerms: overrides.paymentTerms ?? (text ? extractPaymentTerms(text) : { ...DEFAULT_PAYMENT_TERMS }),
    freight: overrides.freight ?? (text ? extractFreight(text) : { ...DEFAULT_FREIGHT }),
    fees: overrides.fees ?? (text ? extractFees(text) : []),
    rebate: overrides.rebate ?? (text ? extractRebate(text) : null),
    notes: overrides.notes ?? null,
  };
}

export function detectCurrency(text: string): string {
  if (/€|\bEUR\b/i.test(text)) return 'EUR';
  if (/£|\bGBP\b/i.test(text)) return 'GBP';
  if (/\bCAD\b|\bC\$/i.test(text)) return 'CAD';
  if (/\bAUD\b|\bA\$/i.test(text)) return 'AUD';
  return 'USD';
}

function meanConfidence(lines: OfferLineInput[]): number {
  if (lines.length === 0) return 0;
  const total = lines.reduce((acc, line) => acc + (line.confidence ?? 1), 0);
  return total / lines.length;
}

function finalize(
  sourceType: SourceType,
  text: string,
  lines: OfferLineInput[],
  warnings: ParseWarning[],
): ParseResult {
  const confidence = meanConfidence(lines);
  const ok = lines.length > 0;
  return {
    ok,
    sourceType,
    text: text.slice(0, 200_000),
    offer: ok ? buildOffer(lines, text) : null,
    warnings,
    confidence,
  };
}

/** Parses a pasted offer. */
export function parseOfferText(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: false,
      sourceType: 'text',
      text: '',
      offer: null,
      warnings: [{ code: 'no_lines', message: 'Nothing was pasted.' }],
      confidence: 0,
    };
  }

  // A pasted spreadsheet region is tab- or comma-delimited: try the table
  // reader first, since column headers beat any line-by-line guessing.
  const looksTabular = /\t/.test(trimmed) || trimmed.split('\n').filter((l) => l.includes(',')).length > 2;
  if (looksTabular) {
    const tabular = parseCsv(trimmed);
    if (tabular.lines.length > 0) {
      return finalize('text', trimmed, tabular.lines, tabular.warnings);
    }
  }

  const { lines, warnings } = textToLines(trimmed);
  return finalize('text', trimmed, lines, warnings);
}

/** Parses an uploaded file. Never throws — failures come back as warnings. */
export async function parseOfferFile(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
): Promise<ParseResult> {
  const sourceType = detectSourceType(fileName, mimeType);

  if (!sourceType) {
    return {
      ok: false,
      sourceType: 'manual',
      text: '',
      offer: null,
      warnings: [
        {
          code: 'unreadable_file',
          message: `"${fileName}" is not a supported file type.`,
          detail: `Upload a PDF, CSV, TSV, TXT or XLSX file, or paste the offer as text.`,
        },
      ],
      confidence: 0,
    };
  }

  try {
    if (sourceType === 'pdf') {
      const extraction = await extractPdfText(buffer);
      if (!extraction.text) return finalize('pdf', '', [], extraction.warnings);
      const { lines, warnings } = textToLines(extraction.text);
      return finalize('pdf', extraction.text, lines, [...extraction.warnings, ...warnings]);
    }

    if (sourceType === 'xlsx') {
      const parsed = await parseXlsx(buffer);
      return finalize('xlsx', parsed.text ?? '', parsed.lines, parsed.warnings);
    }

    const text = new TextDecoder('utf-8').decode(buffer).replace(/^﻿/, '');
    if (sourceType === 'csv') {
      const parsed = parseCsv(text);
      if (parsed.lines.length > 0) return finalize('csv', text, parsed.lines, parsed.warnings);
      // A .csv that is really a pasted quote still deserves a try.
      const fallback = textToLines(text);
      return finalize('csv', text, fallback.lines, [...parsed.warnings, ...fallback.warnings]);
    }

    const { lines, warnings } = textToLines(text);
    return finalize('text', text, lines, warnings);
  } catch (error) {
    return {
      ok: false,
      sourceType,
      text: '',
      offer: null,
      warnings: [
        {
          code: 'unreadable_file',
          message: `"${fileName}" could not be read.`,
          detail: error instanceof Error ? error.message : 'Unknown error while parsing the file.',
        },
      ],
      confidence: 0,
    };
  }
}
