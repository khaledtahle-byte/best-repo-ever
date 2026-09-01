import Papa from 'papaparse';
import type { ParseWarning } from '@/lib/types';
import { gridToLines, type TabularParse } from '@/lib/parsing/tabular';

/** Reads a CSV/TSV buffer into a raw grid, letting Papa sniff the delimiter. */
export function csvToGrid(text: string): string[][] {
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    delimiter: '',
  });
  return (result.data ?? []).map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? '')) : []));
}

export function parseCsv(text: string): TabularParse {
  const grid = csvToGrid(text);
  if (grid.length === 0) {
    const warnings: ParseWarning[] = [
      { code: 'no_lines', message: 'The CSV file appears to be empty.' },
    ];
    return { lines: [], warnings, text };
  }
  return { ...gridToLines(grid), text };
}
