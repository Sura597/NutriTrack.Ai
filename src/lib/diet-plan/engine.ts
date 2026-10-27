/**
 * Basic one-day meal plan generator (pure functions, no AI).
 *
 * It composes familiar Indian meals from the food table, respecting diet type and
 * allergens, and sizes the main item of each meal so the day lands close to the
 * user's calorie target. Every number comes from the food table, so it is only as
 * accurate as that data. This is general guidance, not a prescription.
 */
import { dietAllows, type DietaryType } from "@/lib/recommendations/engine";

export type PlanMeal = "breakfast" | "lunch" | "snack" | "dinner";

export interface PlanFood {
  id: string;
  normalized_name: string;
  food_name: string;
  dietary_type: DietaryType;
  allergens: string[];
  serving_quantity: number;
  serving_unit: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  /** Rupees for ONE database serving, or null when we have no price. */
  cost_per_serving_inr: number | null;
}

interface Group {
  key: string;
  /** Candidate normalized_names, in preference order. */
  options: { name: string; servings: number }[];
  /** The one item per meal that is resized to hit the calorie target. */
  adjust?: { min: number; max: number; step: number };
}

const MEAL_SHARE: Record<PlanMeal, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };
export const MEAL_LABEL: Record<PlanMeal, string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Evening snack", dinner: "Dinner" };

const GRAINS: Group["options"] = [
  { name: "roti chapati plain", servings: 2 },
  { name: "cooked white rice", servings: 1 },
  { name: "bajra roti", servings: 2 },
  { name: "cooked brown rice", servings: 1 },
  { name: "ragi roti", servings: 2 },
];
const CURRIES: Group["options"] = [
  { name: "dal tadka", servings: 1 },
  { name: "rajma curry", servings: 1 },
  { name: "chole chickpea curry", servings: 1 },
  { name: "paneer curry e g matar paneer", servings: 1 },
  { name: "chicken curry", servings: 1 },
  { name: "moong dal cooked", servings: 1 },
  { name: "soya chunks curry", servings: 1 },
  { name: "fish curry", servings: 1 },
  { name: "chana dal cooked", servings: 1 },
  { name: "egg bhurji 2 eggs", servings: 1 },
];
const VEG: Group["options"] = [
  { name: "mixed vegetable sabzi", servings: 1.5 },
  { name: "palak sabzi spinach", servings: 1.5 },
  { name: "bhindi okra sabzi", servings: 1.5 },
  { name: "aloo gobi", servings: 1.5 },
  { name: "baingan bharta", servings: 1.5 },
];
const SIDES: Group["options"] = [
  { name: "curd dahi", servings: 1 },
  { name: "green salad cucumber tomato onion", servings: 1.5 },
  { name: "buttermilk chaas", servings: 1 },
];

const TEMPLATES: Record<PlanMeal, Group[]> = {
  breakfast: [
    {
      key: "main",
      adjust: { min: 0.5, max: 3, step: 0.5 },
      options: [
        { name: "poha cooked", servings: 1 },
        { name: "idli", servings: 3 },
        { name: "besan chilla", servings: 2 },
        { name: "upma", servings: 1 },
        { name: "plain dosa", servings: 2 },
        { name: "rolled oats cooked in water", servings: 1 },
        { name: "roti chapati plain", servings: 2 },
      ],
    },
    {
      key: "protein",
      options: [
        { name: "boiled egg", servings: 2 },
        { name: "curd dahi", servings: 1 },
        { name: "moong sprouts", servings: 1 },
        { name: "toned milk 3 fat", servings: 1 },
        { name: "roasted chana", servings: 1 },
      ],
    },
    {
      key: "fruit",
      options: [
        { name: "banana", servings: 1 },
        { name: "apple", servings: 1 },
        { name: "guava", servings: 1 },
        { name: "orange mosambi", servings: 1 },
        { name: "papaya", servings: 1.5 },
      ],
    },
  ],
  lunch: [
    { key: "grain", adjust: { min: 1, max: 4, step: 0.5 }, options: GRAINS },
    { key: "curry", options: CURRIES },
    { key: "veg", options: VEG },
    { key: "side", options: SIDES },
  ],
  snack: [
    {
      key: "main",
      adjust: { min: 0.5, max: 3, step: 0.5 },
      options: [
        { name: "roasted chana", servings: 1 },
        { name: "makhana fox nuts", servings: 1 },
        { name: "peanuts roasted", servings: 1 },
        { name: "moong sprouts", servings: 1 },
        { name: "boiled egg", servings: 1 },
      ],
    },
    {
      key: "fruit",
      options: [
        { name: "guava", servings: 1 },
        { name: "apple", servings: 1 },
        { name: "orange mosambi", servings: 1 },
        { name: "buttermilk chaas", servings: 1 },
        { name: "banana", servings: 1 },
      ],
    },
  ],
  dinner: [
    { key: "grain", adjust: { min: 1, max: 4, step: 0.5 }, options: [...GRAINS.slice(0, 1), ...GRAINS.slice(2, 3), ...GRAINS.slice(4), ...GRAINS.slice(1, 2), ...GRAINS.slice(3, 4)] },
    { key: "curry", options: [...CURRIES.slice(5), ...CURRIES.slice(0, 5)] },
    { key: "veg", options: [...VEG.slice(2), ...VEG.slice(0, 2)] },
    { key: "side", options: [...SIDES.slice(1), ...SIDES.slice(0, 1)] },
  ],
};

export interface PlanItem {
  food_id: string;
  food_name: string;
  quantity: number;
  unit: string;
  servings: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  cost_inr: number | null;
}
export interface PlanSlot {
  meal_type: PlanMeal;
  label: string;
  target_kcal: number;
  items: PlanItem[];
  totals: { calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
}
export interface DayPlan {
  slots: PlanSlot[];
  totals: PlanSlot["totals"];
  target_kcal: number;
  target_protein_g: number | null;
  est_cost_inr: number;
  priced_items: number;
  unpriced_items: number;
  notes: string[];
}

export interface PlanInput {
  foods: PlanFood[];
  diet: DietaryType;
  allergies: string[];
  targetKcal: number;
  targetProteinG: number | null;
  dailyBudgetInr: number | null;
  /** Different values rotate through different food choices. */
  variant: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

function toItem(f: PlanFood, servings: number): PlanItem {
  return {
    food_id: f.id,
    food_name: f.food_name,
    quantity: r1(f.serving_quantity * servings),
    unit: f.serving_unit,
    servings,
    calories_kcal: Math.round(f.calories_kcal * servings),
    protein_g: r1(f.protein_g * servings),
    carbs_g: r1(f.carbs_g * servings),
    fat_g: r1(f.fat_g * servings),
    fiber_g: r1(f.fiber_g * servings),
    cost_inr: f.cost_per_serving_inr === null ? null : r2(f.cost_per_serving_inr * servings),
  };
}

const sum = (items: PlanItem[]) => ({
  calories_kcal: Math.round(items.reduce((a, i) => a + i.calories_kcal, 0)),
  protein_g: r1(items.reduce((a, i) => a + i.protein_g, 0)),
  carbs_g: r1(items.reduce((a, i) => a + i.carbs_g, 0)),
  fat_g: r1(items.reduce((a, i) => a + i.fat_g, 0)),
  fiber_g: r1(items.reduce((a, i) => a + i.fiber_g, 0)),
});

function buildSlot(meal: PlanMeal, input: PlanInput, byName: Map<string, PlanFood>, cheapFirst: boolean): PlanSlot {
  const target = Math.round(input.targetKcal * MEAL_SHARE[meal]);
  const chosen: { food: PlanFood; servings: number; adjust?: Group["adjust"] }[] = [];
  const mealOffset = Object.keys(MEAL_SHARE).indexOf(meal);

  TEMPLATES[meal].forEach((group, gi) => {
    let options = group.options
      .map((o) => ({ food: byName.get(o.name), servings: o.servings }))
      .filter((o): o is { food: PlanFood; servings: number } => !!o.food);
    if (cheapFirst) {
      options = [...options].sort((a, b) => (a.food.cost_per_serving_inr ?? 1e9) - (b.food.cost_per_serving_inr ?? 1e9));
    }
    if (options.length === 0) return;
    const pick = options[(input.variant + mealOffset + gi) % options.length];
    chosen.push({ food: pick.food, servings: pick.servings, adjust: group.adjust });
  });

  // Resize the main item so the meal lands as close to its calorie share as the allowed steps permit.
  const adj = chosen.find((c) => c.adjust);
  if (adj?.adjust) {
    const others = chosen.filter((c) => c !== adj).reduce((a, c) => a + c.food.calories_kcal * c.servings, 0);
    const { min, max, step } = adj.adjust;
    // Pieces (roti, idli, egg) are only sensible in whole numbers.
    const stepSize = ["piece", "slice"].includes(adj.food.serving_unit) ? Math.max(1, step) : step;
    let best = adj.servings;
    let bestGap = Infinity;
    for (let s = min; s <= max + 1e-9; s += stepSize) {
      const gap = Math.abs(others + adj.food.calories_kcal * s - target);
      if (gap < bestGap) {
        bestGap = gap;
        best = s;
      }
    }
    adj.servings = best;
  }

  const items = chosen.map((c) => toItem(c.food, c.servings));
  return { meal_type: meal, label: MEAL_LABEL[meal], target_kcal: target, items, totals: sum(items) };
}

function assemble(input: PlanInput, byName: Map<string, PlanFood>, cheapFirst: boolean): DayPlan {
  const meals: PlanMeal[] = ["breakfast", "lunch", "snack", "dinner"];
  const slots = meals.map((m) => buildSlot(m, input, byName, cheapFirst)).filter((s) => s.items.length > 0);
  const all = slots.flatMap((s) => s.items);
  const priced = all.filter((i) => i.cost_inr !== null);
  return {
    slots,
    totals: sum(all),
    target_kcal: input.targetKcal,
    target_protein_g: input.targetProteinG,
    est_cost_inr: r2(priced.reduce((a, i) => a + (i.cost_inr ?? 0), 0)),
    priced_items: priced.length,
    unpriced_items: all.length - priced.length,
    notes: [],
  };
}

export function generateDayPlan(input: PlanInput): DayPlan {
  const blocked = new Set(input.allergies.map((a) => a.toLowerCase()));
  const allowed = input.foods.filter((f) => dietAllows(input.diet, f.dietary_type) && !f.allergens.some((a) => blocked.has(a.toLowerCase())));
  const byName = new Map(allowed.map((f) => [f.normalized_name, f]));

  let plan = assemble(input, byName, false);
  const notes: string[] = [];

  if (input.dailyBudgetInr !== null && plan.est_cost_inr > input.dailyBudgetInr) {
    const cheaper = assemble(input, byName, true);
    if (cheaper.est_cost_inr < plan.est_cost_inr) {
      plan = cheaper;
      notes.push("We picked lower-cost options to stay closer to your daily budget.");
    }
  }
  if (input.dailyBudgetInr !== null && plan.est_cost_inr > input.dailyBudgetInr) {
    notes.push(`Estimated cost is above your ₹${Math.round(input.dailyBudgetInr)} budget. Dal, rajma, chole, eggs and seasonal vegetables are usually the cheapest ways to bring it down.`);
  }
  if (plan.slots.length < 4) notes.push("Some meals couldn't be built with your diet and allergy settings. Add your own foods to fill the gaps.");

  const gap = plan.totals.calories_kcal - input.targetKcal;
  if (Math.abs(gap) > 0.12 * input.targetKcal) {
    notes.push(`This plan is about ${Math.abs(Math.round(gap))} kcal ${gap < 0 ? "below" : "above"} your target. Adjust portions or add a snack to close the gap.`);
  }
  if (input.targetProteinG && plan.totals.protein_g < 0.85 * input.targetProteinG) {
    notes.push("Protein is a bit under your target. Extra dal, curd, paneer, eggs or sprouts would help, within your diet.");
  }
  if (plan.unpriced_items > 0) notes.push(`${plan.unpriced_items} item${plan.unpriced_items === 1 ? "" : "s"} have no price estimate, so the cost shown is a lower bound.`);

  return { ...plan, notes };
}
