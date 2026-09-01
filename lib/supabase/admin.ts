import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { supabaseServiceRoleKey, supabaseUrl } from '@/lib/supabase/env';

/**
 * Service-role client. It bypasses row-level security, so it is used only where
 * there is no user session to trust: the Stripe webhook, usage metering and
 * API-key authentication. Never import this from a Client Component.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
