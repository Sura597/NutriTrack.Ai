import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serviceRoleKey, supabasePublicConfig } from "@/lib/env";

/**
 * Service-role client. BYPASSES RLS. Use only in server code for tasks that
 * genuinely need it (account deletion, storage cleanup), and always scope
 * queries by an already-authenticated user id.
 */
export function createAdminClient() {
  const cfg = supabasePublicConfig();
  const key = serviceRoleKey();
  if (!cfg || !key) return null;
  return createClient(cfg.url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
