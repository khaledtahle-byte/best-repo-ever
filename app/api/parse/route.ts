import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/auth';
import { handleRouteError, jsonError } from '@/lib/api';
import { MAX_UPLOAD_BYTES, parseOfferFile, parseOfferText } from '@/lib/parsing';
import { parseTextRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Reads an offer and returns what it found. Deliberately does not save anything
 * or spend a quota unit — the user reviews and corrects the parse first.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) return jsonError('Sign in to analyse an offer.', 401, { code: 'unauthenticated' });

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!(file instanceof File)) return jsonError('No file was uploaded.', 400);
      if (file.size === 0) return jsonError('That file is empty.', 400);
      if (file.size > MAX_UPLOAD_BYTES) {
        return jsonError(
          `That file is ${(file.size / 1_048_576).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1_048_576} MB.`,
          413,
        );
      }

      const buffer = await file.arrayBuffer();
      const result = await parseOfferFile(buffer, file.name, file.type);
      return NextResponse.json({ ...result, fileName: file.name });
    }

    const body = await request.json();
    const { text } = parseTextRequestSchema.parse(body);
    return NextResponse.json({ ...parseOfferText(text), fileName: null });
  } catch (error) {
    return handleRouteError(error);
  }
}
