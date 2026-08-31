import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@/lib/supabase/types';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env';

/**
 * Server-side Supabase client bound to the request's cookies. Every query it
 * runs is subject to row-level security, which is what keeps one buyer's price
 * history out of another's.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Components cannot write cookies; middleware refreshes the
          // session instead, so this is safe to ignore.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 });
        } catch {
          // See above.
        }
      },
    },
  });
}
