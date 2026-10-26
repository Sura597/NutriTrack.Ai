import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "@/lib/env";

/** Server client bound to the request's auth cookies (acts as the signed-in user, RLS applies). */
export async function createClient() {
  // Read cookies first so Next always treats callers as request-time (dynamic),
  // even when Supabase isn't configured and we're about to throw.
  const cookieStore = await cookies();
  const cfg = supabasePublicConfig();
  if (!cfg) throw new SupabaseNotConfiguredError();

  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured");
    this.name = "SupabaseNotConfiguredError";
  }
}
