import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiDailyLimit } from "@/lib/env";
import { ApiError } from "@/lib/api";

/** Records one AI call against the user's rolling 24h quota. Returns false when the limit is reached. */
export function makeQuotaConsumer(supabase: SupabaseClient, endpoint: string) {
  return async () => {
    const { data, error } = await supabase.rpc("consume_ai_quota", { p_endpoint: endpoint, p_limit: aiDailyLimit() });
    if (error) {
      console.error("[quota] rpc failed:", error.code ?? "error");
      throw new ApiError(500, "quota_error", "Couldn't check your usage limit. Please try again.");
    }
    return data === true;
  };
}
