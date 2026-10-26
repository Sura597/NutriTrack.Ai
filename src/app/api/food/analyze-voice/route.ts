import { z } from "zod";
import { authed, ok, parseJson } from "@/lib/api";
import { analyzeMealText } from "@/lib/analysis/pipeline";
import { getAiProvider } from "@/lib/ai/provider";
import { makeQuotaConsumer } from "@/lib/ai/quota";

// Speech-to-text happens in the browser. This route only receives the (user-edited)
// transcript and runs it through the same food-analysis pipeline as typed text.
const body = z.object({ transcript: z.string().trim().min(1, "The transcript is empty").max(1000, "Please keep it under 1000 characters") });

export const POST = authed(async ({ supabase, req }) => {
  const { transcript } = await parseJson(req, body);
  const result = await analyzeMealText(
    { supabase, provider: getAiProvider(), consumeAiQuota: makeQuotaConsumer(supabase, "analyze-voice") },
    transcript,
  );
  return ok(result);
});
