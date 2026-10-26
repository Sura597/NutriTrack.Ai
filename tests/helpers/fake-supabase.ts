import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Minimal Supabase stand-in whose search_foods RPC runs against the real migrated schema and seed data. */
export function pgliteSupabase(db: PGlite): SupabaseClient {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "search_foods") {
        const r = await db.query("select * from public.search_foods($1, $2)", [args.p_query, args.p_limit]);
        return { data: r.rows, error: null };
      }
      throw new Error(`unsupported rpc in test: ${name}`);
    },
  } as unknown as SupabaseClient;
}
