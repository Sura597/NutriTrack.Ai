import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api";
import { searchFoods, normalizeQuery, type FoodHit } from "@/lib/food-search";
import { scaleNutrition, type ScalableFood } from "@/lib/nutrition/units";
import { nameVariants, parseMealText, type ParsedSegment } from "@/lib/analysis/text-parser";
import { validateAnalysis, type ValidatedItem } from "@/lib/ai/validate";
import { IMAGE_SYSTEM, TEXT_SYSTEM, imageUserMessage, textUserMessage } from "@/lib/ai/prompts";
import type { AIProvider, ImageInput } from "@/lib/ai/provider";

export interface AnalyzedItem {
  food_name: string;
  quantity: number;
  unit: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  micronutrients: Record<string, number>;
  confidence: number | null;
  assumptions: string[];
  warnings: string[];
  estimation_source: "database" | "ai";
  food_database_id: string | null;
  /** Present for database items so the client can re-scale exactly without another request. */
  food?: ScalableFood & { micronutrients: Record<string, number> };
}

export interface AnalysisResult {
  items: AnalyzedItem[];
  follow_ups: string[];
  /** Foods we couldn't resolve and (without AI) need the user to search or enter by hand. */
  unmatched: string[];
  ai_used: boolean;
  ai_available: boolean;
  /** True when the AI output is demo data from the development mock. */
  ai_demo: boolean;
  notes: string[];
}

export interface PipelineContext {
  supabase: SupabaseClient;
  provider: AIProvider | null;
  /** Atomically checks and records one AI call against the user's quota. */
  consumeAiQuota: () => Promise<boolean>;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const MAX_SEGMENTS = 20;

type Strength = "exact" | "partial";
interface Match {
  food: FoodHit;
  strength: Strength;
}

const tokens = (s: string) => new Set(normalizeQuery(s).split(" ").filter(Boolean));

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** A one-word query that is a small typo of a one-word food name or alias ("panner" -> "paneer"). */
function isTypoOf(q: string, hit: FoodHit): boolean {
  if (q.includes(" ") || q.length < 4) return false;
  const maxDist = q.length >= 8 ? 2 : 1;
  return [hit.normalized_name, ...hit.aliases].some((c) => !c.includes(" ") && Math.abs(c.length - q.length) <= maxDist && editDistance(q, c) <= maxDist);
}

/** Find the best food-table record for a typed name. Exact name/alias beats a partial token match. */
export async function matchFood(supabase: SupabaseClient, name: string): Promise<Match | null> {
  let partial: Match | null = null;
  for (const variant of nameVariants(normalizeQuery(name))) {
    const hits = await searchFoods(supabase, variant, 6);
    const exact = hits.find((h) => h.normalized_name === variant || h.aliases.includes(variant));
    if (exact) return { food: exact, strength: "exact" };
    if (!partial) {
      const q = tokens(variant);
      const hit = hits.find((h) => {
        const hay = tokens([h.normalized_name, ...h.aliases].join(" "));
        return (q.size > 0 && [...q].every((t) => hay.has(t))) || isTypoOf(variant, h);
      });
      if (hit) partial = { food: hit, strength: "partial" };
    }
  }
  return partial;
}

function foodToItem(
  food: FoodHit,
  quantity: number,
  unit: string,
  extra: { assumptions?: string[]; warnings?: string[] } = {},
): AnalyzedItem | null {
  const scaled = scaleNutrition(food, quantity, unit);
  if (!scaled) return null;
  const servingGrams = scaleNutrition(food, food.serving_quantity, food.serving_unit)?.grams || 1;
  const ratio = scaled.grams / servingGrams;
  const warnings = [...(extra.warnings ?? [])];
  if (scaled.approximate) warnings.push("Household measures like cups, pieces and bowls are approximate.");
  return {
    food_name: food.food_name,
    quantity: r1(quantity),
    unit,
    calories_kcal: scaled.calories_kcal,
    protein_g: scaled.protein_g,
    carbs_g: scaled.carbs_g,
    fat_g: scaled.fat_g,
    fiber_g: scaled.fiber_g,
    micronutrients: Object.fromEntries(Object.entries(food.micronutrients ?? {}).map(([k, v]) => [k, r1(Number(v) * ratio)])),
    confidence: null,
    assumptions: extra.assumptions ?? [],
    warnings: [...new Set(warnings)],
    estimation_source: "database",
    food_database_id: food.id,
    food: { ...food },
  };
}

/** Turn a parsed segment plus its matched food into a portion, never silently inventing a quantity. */
export function itemFromSegment(match: Match, seg: ParsedSegment): AnalyzedItem | null {
  const { food, strength } = match;
  const assumptions: string[] = [];
  const warnings: string[] = [];
  if (strength === "partial" || normalizeQuery(seg.name) !== food.normalized_name) {
    assumptions.push(`Matched "${seg.name}" to "${food.food_name}" in the food table. Change it if that's not what you ate`);
  }

  let quantity: number;
  let unit: string;
  if (seg.unit) {
    quantity = seg.quantity;
    unit = seg.unit;
    if (!scaleNutrition(food, quantity, unit)) {
      // We can't convert e.g. "bowl" for this food: fall back to servings and say so.
      quantity = seg.quantity * food.serving_quantity;
      unit = food.serving_unit;
      warnings.push(
        `We don't have a size for "${seg.unit}" of ${food.food_name}, so we counted ${seg.quantity} serving${seg.quantity === 1 ? "" : "s"} ` +
          `(1 serving = ${food.serving_quantity} ${food.serving_unit}). Please check the portion.`,
      );
    }
  } else {
    quantity = seg.quantity * food.serving_quantity;
    unit = food.serving_unit;
    if (seg.quantityAssumed) {
      warnings.push(`No amount was given, so we assumed 1 serving (${food.serving_quantity} ${food.serving_unit}). Please check the portion.`);
    } else if (food.serving_unit === "g" || food.serving_unit === "ml") {
      assumptions.push(`Counted as ${seg.quantity} serving${seg.quantity === 1 ? "" : "s"} of ${food.serving_quantity} ${food.serving_unit}`);
    }
  }
  return foodToItem(food, quantity, unit, { assumptions, warnings });
}

/**
 * AI items whose name exactly matches a food-table record take the table's
 * deterministic nutrition (scaled to the AI's portion). Anything else keeps the
 * AI estimate, clearly labelled.
 */
async function reconcileAiItem(supabase: SupabaseClient, ai: ValidatedItem): Promise<AnalyzedItem> {
  const aiItem: AnalyzedItem = { ...ai, micronutrients: {}, food_database_id: null };
  const match = await matchFood(supabase, ai.food_name);
  if (match?.strength === "exact") {
    const fromTable = foodToItem(match.food, ai.quantity, ai.unit, {
      assumptions: [...ai.assumptions, `Nutrition values come from the food table. The portion is the AI's estimate`],
      warnings: ai.confidence !== null && ai.confidence < 0.6 ? ["The AI wasn't sure about this portion. Please check the quantity."] : [],
    });
    if (fromTable) return fromTable;
  }
  return aiItem;
}

function followUpsFor(segments: ParsedSegment[]): string[] {
  return segments
    .filter((s) => s.quantityAssumed)
    .slice(0, 3)
    .map((s) => `How much ${s.name} did you have? (for example 1 katori, 1 cup, or 100 g)`);
}

async function callAi(provider: AIProvider, req: Parameters<AIProvider["completeJson"]>[0]) {
  const raw = await provider.completeJson(req);
  const v = validateAnalysis(raw);
  if (!v.ok) {
    console.error("[ai] rejected model output:", v.reason.split(":")[0]);
    throw new ApiError(502, "ai_bad_output", "The AI reply didn't look reliable, so we discarded it. Please try again, or add foods manually.");
  }
  return v;
}

export async function analyzeMealText(ctx: PipelineContext, text: string): Promise<AnalysisResult> {
  const segments = parseMealText(text).slice(0, MAX_SEGMENTS);
  if (segments.length === 0) throw new ApiError(400, "no_food_found", "We couldn't find any foods in that. Try something like \"2 rotis, 1 bowl dal\".");

  const resolved = await Promise.all(
    segments.map(async (seg) => {
      const match = await matchFood(ctx.supabase, seg.name);
      return { seg, match, item: match ? itemFromSegment(match, seg) : null };
    }),
  );
  const items: AnalyzedItem[] = resolved.flatMap((r) => (r.item ? [r.item] : []));
  const unresolved = resolved.filter((r) => !r.item).map((r) => r.seg);

  const result: AnalysisResult = {
    items,
    follow_ups: followUpsFor(resolved.filter((r) => r.item).map((r) => r.seg)),
    unmatched: [],
    ai_used: false,
    ai_available: !!ctx.provider,
    ai_demo: !!ctx.provider?.isDemo,
    notes: [],
  };
  if (unresolved.length === 0) {
    result.notes.push("Matched from our food table. No AI was used.");
    return result;
  }

  if (!ctx.provider) {
    result.unmatched = unresolved.map((s) => s.name);
    result.notes.push("AI analysis isn't set up on this server, so we only matched foods from our food table. Search for the rest or enter their calories manually.");
    return result;
  }

  if (!(await ctx.consumeAiQuota())) {
    throw new ApiError(429, "ai_quota_exceeded", "You've reached today's AI analysis limit. You can still log foods by searching or entering them manually.");
  }
  try {
    const v = await callAi(ctx.provider, { system: TEXT_SYSTEM, user: textUserMessage(unresolved.map((s) => s.raw).join(", ")) });
    for (const ai of v.items) items.push(await reconcileAiItem(ctx.supabase, ai));
    result.ai_used = true;
    result.follow_ups = [...new Set([...v.follow_up_questions, ...result.follow_ups])].slice(0, 3);
    result.notes.push(`${v.items.length === 1 ? "One food was" : "Some foods were"} not in our food table, so they were estimated by AI. AI estimates can be off. Please review.`);
  } catch (e) {
    if (e instanceof ApiError && items.length > 0) {
      // Keep what we matched deterministically; ask the user to handle the rest.
      result.unmatched = unresolved.map((s) => s.name);
      result.notes.push(`${e.message} We kept the foods we could match from the food table.`);
    } else throw e;
  }
  return result;
}

export async function analyzeMealImage(ctx: PipelineContext, image: ImageInput, hint?: string): Promise<AnalysisResult> {
  if (!ctx.provider || !ctx.provider.supportsVision) {
    throw new ApiError(
      503,
      "ai_not_configured",
      "Photo analysis needs an AI vision model, which isn't set up on this server. You can still log by typing, speaking or searching foods.",
    );
  }
  if (!(await ctx.consumeAiQuota())) {
    throw new ApiError(429, "ai_quota_exceeded", "You've reached today's AI analysis limit. You can still log foods by searching or entering them manually.");
  }
  const v = await callAi(ctx.provider, { system: IMAGE_SYSTEM, user: imageUserMessage(hint), image });
  const items: AnalyzedItem[] = [];
  for (const ai of v.items) items.push(await reconcileAiItem(ctx.supabase, ai));
  return {
    items,
    follow_ups: v.follow_up_questions,
    unmatched: [],
    ai_used: true,
    ai_available: true,
    ai_demo: ctx.provider.isDemo,
    notes: ["Estimated from the photo by AI. Portions and hidden ingredients (oil, ghee, sugar) are guesses, so please check each item."],
  };
}
