'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/supabase/types';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env';

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser-side Supabase client. Safe to call repeatedly — the client is reused. */
export function createClient() {
  if (!cached) {
    cached = createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
  }
  return cached;
}
