import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client. Bypasses every RLS policy, so its use is deliberately
 * narrow: reads for the public document page (which must distinguish
 * not-found from archived from expired), minting signed URLs for anonymous
 * visitors, and the create-admin bootstrap script. Everything an authenticated
 * admin does goes through the session client in ./server.ts instead.
 *
 * The "server-only" import above makes importing this from a Client Component
 * a build error rather than a leaked key.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("Missing environment variable SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createSupabaseClient<Database>(supabaseUrl(), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
