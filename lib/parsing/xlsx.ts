import type { TabularParse } from '@/lib/parsing/tabular';
import { gridToLines } from '@/lib/parsing/tabular';

/**
 * Reads the first worksheet that actually contains a product table. Suppliers
 * routinely put a cover sheet in front of the price list.
 */
export async function parseXlsx(buffer: ArrayBuffer): Promise<TabularParse> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  let best: TabularParse | null = null;
  const allText: string[] = [];

  workbook.eachSheet((worksheet) => {
    const grid: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber - 1] = cellToString(cell.value);
      });
      for (let i = 0; i < cells.length; i += 1) if (cells[i] === undefined) cells[i] = '';
      grid.push(cells);
    });

    if (grid.length === 0) return;
    allText.push(grid.map((row) => row.filter(Boolean).join(' ')).join('\n'));
    const parsed = gridToLines(grid);
    if (!best || parsed.lines.length > best.lines.length) best = parsed;
  });

  const text = allText.join('\n');
  if (!best) {
    return {
      lines: [],
      warnings: [{ code: 'no_lines', message: 'The workbook contained no readable rows.' }],
      text,
    };
  }
  return { ...(best as TabularParse), text };
}

/** ExcelJS cell values can be rich text, formulas, dates or hyperlinks. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if ('result' in candidate && candidate.result !== undefined) return cellToString(candidate.result);
    if ('text' in candidate && candidate.text !== undefined) return cellToString(candidate.text);
    if ('richText' in candidate && Array.isArray(candidate.richText)) {
      return candidate.richText.map((part) => String((part as { text?: string }).text ?? '')).join('');
    }
    if ('hyperlink' in candidate && 'text' in candidate) return cellToString(candidate.text);
    if ('formula' in candidate) return '';
  }
  return '';
}
