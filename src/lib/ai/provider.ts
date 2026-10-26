import "server-only";
import { ApiError } from "@/lib/api";
import { aiConfig } from "@/lib/env";
import { extractJson } from "./validate";

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
}

export interface AiRequest {
  system: string;
  user: string;
  image?: ImageInput;
}

/**
 * Replaceable server-side adapter. Implementations return the model's parsed JSON
 * (still untrusted: callers must run it through validateAnalysis).
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  readonly supportsVision: boolean;
  /** True only for the development mock; the UI labels its output as demo data. */
  readonly isDemo: boolean;
  completeJson(req: AiRequest): Promise<unknown>;
}

const MAX_TOKENS = 1500;

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  // One retry for transient failures (network error, 429, 5xx). Never retry a timeout:
  // that would double the wait and the cost.
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
      if (res.ok) return (await res.json()) as unknown;
      const transient = res.status === 429 || res.status >= 500;
      if (transient && attempt === 0) continue;
      console.error(`[ai] provider returned HTTP ${res.status}`);
      if (res.status === 429) throw new ApiError(503, "ai_busy", "The AI service is busy right now. Please try again in a moment.");
      if (res.status === 401 || res.status === 403) throw new ApiError(503, "ai_misconfigured", "The AI service rejected this app's credentials. The site owner needs to check the API key.");
      throw new ApiError(502, "ai_unavailable", "The AI service couldn't process that. Please try again, or add foods manually.");
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (e instanceof Error && e.name === "AbortError") throw new ApiError(504, "ai_timeout", "The AI service took too long. Please try again, or add foods manually.");
      if (attempt === 0) continue;
      console.error("[ai] network error");
      throw new ApiError(502, "ai_unavailable", "Couldn't reach the AI service. Please try again, or add foods manually.");
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ApiError(502, "ai_unavailable", "The AI service couldn't process that.");
}

function parseModelJson(text: string): unknown {
  try {
    return extractJson(text);
  } catch {
    throw new ApiError(502, "ai_bad_output", "The AI reply couldn't be understood. Please try again, or add foods manually.");
  }
}

class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly supportsVision = true;
  readonly isDemo = false;
  constructor(readonly model: string, private apiKey: string, private baseUrl: string, private timeoutMs: number) {}
  async completeJson(req: AiRequest) {
    const content: unknown[] = [];
    if (req.image) content.push({ type: "image", source: { type: "base64", media_type: req.image.mediaType, data: req.image.base64 } });
    content.push({ type: "text", text: req.user });
    const json = (await postJson(
      `${this.baseUrl}/v1/messages`,
      { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      { model: this.model, max_tokens: MAX_TOKENS, system: req.system, messages: [{ role: "user", content }] },
      this.timeoutMs,
    )) as { content?: { type: string; text?: string }[] };
    const text = json.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
    return parseModelJson(text);
  }
}

class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly supportsVision = true;
  readonly isDemo = false;
  constructor(readonly model: string, private apiKey: string, private baseUrl: string, private timeoutMs: number) {}
  async completeJson(req: AiRequest) {
    const userContent: unknown[] = [{ type: "text", text: req.user }];
    if (req.image) userContent.push({ type: "image_url", image_url: { url: `data:${req.image.mediaType};base64,${req.image.base64}` } });
    const json = (await postJson(
      `${this.baseUrl}/v1/chat/completions`,
      { Authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: req.system }, { role: "user", content: userContent }],
      },
      this.timeoutMs,
    )) as { choices?: { message?: { content?: string } }[] };
    return parseModelJson(json.choices?.[0]?.message?.content ?? "");
  }
}

/**
 * Development/test-only adapter. Output is clearly labelled and the UI shows a
 * "demo data" banner. aiConfig() refuses to enable it in production.
 */
class MockProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "mock";
  readonly supportsVision = true;
  readonly isDemo = true;
  async completeJson(req: AiRequest) {
    const label = "DEMO DATA: not a real AI analysis";
    if (req.image) {
      return {
        items: [
          { food_name: "Demo: dal and rice plate", quantity: 1, unit: "plate", grams: 300, calories_kcal: 420, protein_g: 14, carbs_g: 70, fat_g: 8, fiber_g: 6, confidence: 0.3, assumptions: [label] },
        ],
        needs_confirmation: true,
        follow_up_questions: [],
      };
    }
    return {
      items: [{ food_name: "Demo: mixed vegetable curry", quantity: 100, unit: "g", grams: 100, calories_kcal: 80, protein_g: 2, carbs_g: 8, fat_g: 4, fiber_g: 3, confidence: 0.3, assumptions: [label] }],
      needs_confirmation: true,
      follow_up_questions: [],
    };
  }
}

let override: AIProvider | null | undefined;
/** Tests inject a provider here; pass undefined to restore normal behaviour. */
export function setAiProviderForTests(p: AIProvider | null | undefined) {
  override = p;
}

export function getAiProvider(): AIProvider | null {
  if (override !== undefined) return override;
  const cfg = aiConfig();
  if (!cfg) return null;
  if (cfg.provider === "mock") return new MockProvider();
  if (cfg.provider === "anthropic") return new AnthropicProvider(cfg.model, cfg.apiKey, (cfg.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, ""), cfg.timeoutMs);
  return new OpenAIProvider(cfg.model, cfg.apiKey, (cfg.baseUrl ?? "https://api.openai.com").replace(/\/$/, ""), cfg.timeoutMs);
}
