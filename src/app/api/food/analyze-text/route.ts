import { z } from "zod";
import { authed, ok, parseJson } from "@/lib/api";
import { analyzeMealText } from "@/lib/analysis/pipeline";
import { getAiProvider } from "@/lib/ai/provider";
import { makeQuotaConsumer } from "@/lib/ai/quota";

const body = z.object({ text: z.string().trim().min(1, "Describe what you ate").max(1000, "Please keep it under 1000 characters") });

export const POST = authed(async ({ supabase, req }) => {
  const { text } = await parseJson(req, body);
  const result = await analyzeMealText(
    { supabase, provider: getAiProvider(), consumeAiQuota: makeQuotaConsumer(supabase, "analyze-text") },
    text,
  );
  return ok(result);
});
