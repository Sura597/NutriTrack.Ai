import { z } from "zod";
import { normalizeUnitToken } from "@/lib/analysis/text-parser";

/**
 * Strict validation of model output. The model is untrusted: every number is
 * range-checked, units are normalised to our own list, and the meal total is
 * recomputed from the items instead of trusting what the model reported.
 */

// Models sometimes send "150" instead of 150. Accept clean numeric strings only.
const numberLike = z.preprocess((v) => (typeof v === "string" && /^\d+(?:\.\d+)?$/.test(v.trim()) ? Number(v) : v), z.number().finite());

const rawItem = z.object({
  food_name: z.string().trim().min(1).max(120),
  quantity: numberLike.pipe(z.number().gt(0).max(5000)),
  unit: z.string().trim().min(1).max(30),
  grams: numberLike.pipe(z.number().gt(0).max(5000)).optional(),
  calories_kcal: numberLike.pipe(z.number().min(0).max(3000)),
  protein_g: numberLike.pipe(z.number().min(0).max(300)),
  carbs_g: numberLike.pipe(z.number().min(0).max(500)),
  fat_g: numberLike.pipe(z.number().min(0).max(300)),
  fiber_g: numberLike.pipe(z.number().min(0).max(100)).optional(),
  confidence: numberLike.pipe(z.number().min(0).max(1)).optional(),
  assumptions: z.array(z.string().trim().max(200)).max(6).optional().default([]),
});

export const aiResponseSchema = z.object({
  items: z.array(rawItem).min(1).max(15),
  needs_confirmation: z.boolean().optional(),
  follow_up_questions: z.array(z.string().trim().min(1).max(200)).max(3).optional().default([]),
}).passthrough(); // extra keys such as meal_total are tolerated and ignored

const MAX_PER_UNIT: Record<string, number> = {
  g: 3000, ml: 3000, kg: 3, l: 3, piece: 30, cup: 8, bowl: 8, katori: 10, tbsp: 20, tsp: 30, slice: 20, glass: 6, plate: 5,
};
const MAX_KCAL_PER_GRAM = 9.5; // pure fat is ~9

export interface ValidatedItem {
  food_name: string;
  quantity: number;
  unit: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: number | null;
  assumptions: string[];
  warnings: string[];
  estimation_source: "ai";
}

export type ValidationResult =
  | {
      ok: true;
      items: ValidatedItem[];
      follow_up_questions: string[];
      /** Recomputed from the items; the model's own total is ignored. */
      meal_total: { calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number };
    }
  | { ok: false; reason: string };

const r1 = (n: number) => Math.round(n * 10) / 10;

export function validateAnalysis(raw: unknown): ValidationResult {
  const parsed = aiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: `schema: ${parsed.error.issues[0]?.path.join(".") || "root"} ${parsed.error.issues[0]?.message ?? "invalid"}` };
  }

  const items: ValidatedItem[] = [];
  for (const it of parsed.data.items) {
    const warnings: string[] = [];
    const assumptions = [...it.assumptions];
    let unit = normalizeUnitToken(it.unit);
    let quantity = it.quantity;

    if (!unit) {
      // Unknown unit such as "serving": use the model's gram estimate if it gave one, and say so.
      if (it.grams) {
        unit = "g";
        quantity = it.grams;
        assumptions.push(`Portion given as "${it.quantity} ${it.unit}", shown here as an estimated ${it.grams} g`);
      } else {
        return { ok: false, reason: `unit: unrecognised unit for ${it.food_name}` };
      }
    }

    if (quantity > (MAX_PER_UNIT[unit] ?? 1000)) return { ok: false, reason: `quantity: unreasonable amount for ${it.food_name}` };

    const grams = unit === "g" || unit === "ml" ? quantity : unit === "kg" || unit === "l" ? quantity * 1000 : null;
    if (grams !== null && grams > 0 && it.calories_kcal / grams > MAX_KCAL_PER_GRAM) {
      return { ok: false, reason: `calories: ${it.food_name} has more calories per gram than pure fat` };
    }

    let confidence = it.confidence ?? null;
    const expected = 4 * it.protein_g + 4 * it.carbs_g + 9 * it.fat_g;
    if (it.calories_kcal >= 50 && Math.abs(expected - it.calories_kcal) / it.calories_kcal > 0.35) {
      warnings.push("The calories and macros for this item don't quite add up. Please double-check them.");
      confidence = Math.min(confidence ?? 0.4, 0.4);
    }
    if (confidence !== null && confidence < 0.5) warnings.push("The portion or ingredients are uncertain, so treat this as a rough guess.");

    items.push({
      food_name: it.food_name,
      quantity: r1(quantity),
      unit,
      calories_kcal: Math.round(it.calories_kcal),
      protein_g: r1(it.protein_g),
      carbs_g: r1(it.carbs_g),
      fat_g: r1(it.fat_g),
      fiber_g: r1(it.fiber_g ?? 0),
      confidence,
      assumptions,
      warnings: [...new Set(warnings)],
      estimation_source: "ai",
    });
  }

  const meal_total = items.reduce(
    (t, i) => ({
      calories_kcal: t.calories_kcal + i.calories_kcal,
      protein_g: r1(t.protein_g + i.protein_g),
      carbs_g: r1(t.carbs_g + i.carbs_g),
      fat_g: r1(t.fat_g + i.fat_g),
    }),
    { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
  if (meal_total.calories_kcal > 6000) return { ok: false, reason: "total: implausibly large meal" };

  return { ok: true, items, follow_up_questions: parsed.data.follow_up_questions, meal_total };
}

/** Pull the first balanced JSON object out of a model reply (handles ```json fences and chatter). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  if (start === -1) throw new SyntaxError("no JSON object found");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return JSON.parse(body.slice(start, i + 1));
  }
  throw new SyntaxError("unterminated JSON object");
}
