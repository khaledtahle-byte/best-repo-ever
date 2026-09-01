import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { firstIssue } from '@/lib/validation';

export interface ApiErrorBody {
  error: string;
  code?: string;
  detail?: string;
}

export function jsonError(message: string, status = 400, extra: Partial<ApiErrorBody> = {}) {
  return NextResponse.json<ApiErrorBody>({ error: message, ...extra }, { status });
}

/** One place to turn any thrown value into a safe response. */
export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError(firstIssue(error), 422, { code: 'invalid_request' });
  }
  if (error instanceof Error) {
    // Configuration mistakes should be visible; anything else stays generic.
    if (error.message.startsWith('Missing environment variable')) {
      return jsonError(error.message, 500, { code: 'not_configured' });
    }
    console.error('[dealguard]', error);
    return jsonError('Something went wrong while processing the request.', 500, {
      code: 'internal_error',
    });
  }
  console.error('[dealguard] unknown error', error);
  return jsonError('Something went wrong while processing the request.', 500);
}
