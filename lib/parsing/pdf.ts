import type { ParseWarning } from '@/lib/types';

export interface PdfExtraction {
  text: string;
  pages: number;
  warnings: ParseWarning[];
}

/**
 * Pulls the text layer out of a PDF. Scanned documents have no text layer at
 * all, which is a normal outcome — the caller falls back to manual entry.
 */
export async function extractPdfText(buffer: ArrayBuffer): Promise<PdfExtraction> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const document = await getDocumentProxy(new Uint8Array(buffer));
    const { text, totalPages } = await extractText(document, { mergePages: true });
    const merged = Array.isArray(text) ? text.join('\n') : text;
    const trimmed = (merged ?? '').trim();

    if (trimmed.length < 20) {
      return {
        text: trimmed,
        pages: totalPages ?? 0,
        warnings: [
          {
            code: 'unreadable_file',
            message: 'This PDF has no text layer — it looks like a scan or a photo.',
            detail:
              'DealGuard cannot read scanned pages. Ask the supplier for the original file, or enter the lines by hand below.',
          },
        ],
      };
    }

    return { text: trimmed, pages: totalPages ?? 1, warnings: [] };
  } catch (error) {
    return {
      text: '',
      pages: 0,
      warnings: [
        {
          code: 'unreadable_file',
          message: 'This PDF could not be opened.',
          detail: error instanceof Error ? error.message : 'The file may be corrupt or password protected.',
        },
      ],
    };
  }
}
