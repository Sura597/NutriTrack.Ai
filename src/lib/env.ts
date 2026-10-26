/**
 * Environment access. Server-only values must never be read from client code.
 * Missing configuration is reported, not thrown at import time, so the app can
 * start and show a setup message.
 */

export function supabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || url.includes("YOUR-PROJECT") || anonKey.startsWith("YOUR-")) {
    return null;
  }
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return supabasePublicConfig() !== null;
}

export function serviceRoleKey(): string | null {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return k && !k.startsWith("YOUR-") ? k : null;
}

export type AiProviderName = "anthropic" | "openai" | "mock";

export function aiConfig() {
  const provider = (process.env.AI_PROVIDER || "none").toLowerCase();
  const apiKey = process.env.AI_API_KEY || "";
  const model = process.env.AI_MODEL || "";
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 25_000;

  // A clearly labelled demo adapter for local development and automated tests only.
  // It is ignored in production so mock output can never pass as real analysis.
  if (provider === "mock") {
    if (process.env.NODE_ENV === "production") return null;
    return { provider: "mock" as const, apiKey: "", model: "mock", baseUrl: undefined, timeoutMs };
  }
  if (provider === "none" || !apiKey || !model) return null;
  if (provider !== "anthropic" && provider !== "openai") return null;
  return {
    provider: provider as AiProviderName,
    apiKey,
    model,
    baseUrl: process.env.AI_BASE_URL || undefined,
    timeoutMs,
  };
}

export const aiDailyLimit = () => Number(process.env.AI_DAILY_LIMIT_PER_USER) || 30;
export const maxUploadBytes = () => (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024;
export const foodImageBucket = () => process.env.FOOD_IMAGE_BUCKET || "food-images";
